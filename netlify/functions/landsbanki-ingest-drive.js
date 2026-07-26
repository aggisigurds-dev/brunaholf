// landsbanki-ingest-drive.js — ingest the newest Landsbanki account-ledger
// xlsx export from Google Drive into the `bank_transactions` table. The
// web-runnable twin of payday-ingest-drive.js / timavera-ingest-drive.js —
// same Drive-newest-file pattern, same xlsx lib, same forgiving header match,
// same ?dry=1 preview mode — so a Drive upload keeps the bank ledger fresh
// without the desktop CSV export step.
//
//   GET /api/landsbanki-ingest-drive[?dry=1][?folder=ID][?file=ID]
//     (no file → newest Drive file whose name matches SEARCH_RE)
//     ?dry=1  → { ok, file, parsed, skipped, headers, mapping, rows } (NO write)
//     (default) → { ok, file, parsed, upserted, skipped }
//
// Writes ONLY the columns the readers use (worksites/debtors/hreyfingar/
// krofur-yfirlit read trans_date, amount, text, kt_counterparty, description):
//   trans_date · tnr · amount · kt_counterparty · text · description
//   + source='landsbankinn_account' · company='brunaholf' · imported_at
// Upsert / dedupe key = (trans_date, tnr, amount) — same as the desktop path.

const XLSX = require('xlsx');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH = 200;
const SOURCE = 'landsbankinn_account';
const COMPANY = 'brunaholf';

// Landsbanki exports get named all sorts of things ("Hreyfingar", "Account
// statement", the bank name…) — match any of these, newest wins.
const SEARCH_RE = /landsbank|hreyf|a[ck]count|f[æa]rsl/i;
// Drive `name contains` needles that feed SEARCH_RE (query can't do regex).
const NAME_NEEDLES = ['landsbank', 'hreyf', 'account', 'ackount', 'færsl', 'faersl'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  const p = event.queryStringParameters || {};
  const dry = p.dry === '1' || p.dry === 'true';

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    let fileId = (p.file || p.fileId || '').trim(), fileName = '';
    if (!fileId) {
      const found = await newestByPattern(token, p.folder);
      if (!found) return json(404, { error: 'Engin Landsbanka-hreyfingaskrá fannst í Drive (leitað að: ' + NAME_NEEDLES.join(' / ') + ').' });
      fileId = found.id; fileName = found.name;
    }
    const buf = await download(fileId, token);
    if (!fileName) fileName = fileId;

    const { rows, headers, mapping } = parseLedger(buf);
    if (!rows.length) {
      return json(200, { ok: true, file: fileName, parsed: 0, upserted: 0, skipped: 0, headers, mapping, note: 'Engar gildar færslur (fann ekki dags/upphæð).' });
    }

    // Dedupe within the file by the upsert key (identical rows trip the upsert).
    const seen = new Map();
    for (const r of rows) seen.set(`${r.trans_date}|${r.tnr || ''}|${r.amount}`, r);
    const uniq = [...seen.values()];

    if (dry) {
      return json(200, {
        ok: true, dry: true, file: fileName,
        parsed: rows.length, unique: uniq.length, skipped: rows.length - uniq.length,
        headers, mapping,
        rows: uniq.slice(0, 40), // sample for the office to eyeball the mapping
      });
    }

    let upserted = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < uniq.length; i += BATCH) {
      const slice = uniq.slice(i, i + BATCH).map(r => ({
        ...r, source: SOURCE, company: COMPANY, imported_at: now,
      }));
      const u = await fetch(`${SUPABASE_URL}/rest/v1/bank_transactions?on_conflict=trans_date,tnr,amount`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(slice),
      });
      if (!u.ok) throw new Error('Upsert ' + u.status + ': ' + (await u.text()).slice(0, 200));
      upserted += slice.length;
    }
    return json(200, { ok: true, file: fileName, parsed: rows.length, upserted, skipped: rows.length - uniq.length });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function newestByPattern(token, folder) {
  const names = '(' + NAME_NEEDLES.map(n => `name contains '${n.replace(/'/g, "\\'")}'`).join(' or ') + ')';
  const qParts = [names, 'trashed=false'];
  if (folder) qParts.unshift(`'${folder.replace(/'/g, "\\'")}' in parents`);
  const params = new URLSearchParams({
    q: qParts.join(' and '), orderBy: 'modifiedTime desc',
    fields: 'files(id,name,modifiedTime)', pageSize: '25',
    includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
  });
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Drive search ' + r.status);
  const d = await r.json();
  // Newest (already sorted) whose name really matches the pattern + is a spreadsheet.
  return (d.files || []).find(f => SEARCH_RE.test(f.name || '') && /\.(xlsx?|xlsm)$/i.test(f.name || '')) ||
         (d.files || []).find(f => SEARCH_RE.test(f.name || '')) || null;
}
async function download(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Drive download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// ── Parsing — forgiving fuzzy-header match (exact Landsbanki headers unknown) ─
function pickColumn(headers, candidates) {
  for (const cand of candidates) {
    const idx = headers.findIndex(h => (h || '').toString().toLowerCase().includes(cand.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}
function parseLedger(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (data.length < 2) return { rows: [], headers: [], mapping: {} };

  // Some exports carry title rows above the real header — find the row that
  // actually looks like a header (has a date-ish AND amount-ish column).
  let hdrRow = 0;
  for (let i = 0; i < Math.min(data.length, 12); i++) {
    const hs = (data[i] || []).map(h => (h == null ? '' : String(h)).toLowerCase());
    const hasDate = hs.some(h => /dags|bókun|bokun|date|vaxtadag/.test(h));
    const hasAmt = hs.some(h => /upph[æa]|amount|fj[áa]rh|debet|kredit|hreyf/.test(h));
    if (hasDate && hasAmt) { hdrRow = i; break; }
  }
  const headers = (data[hdrRow] || []).map(h => h == null ? '' : String(h));

  // TODO verify against a real Landsbanki export — mapping is best-guess by
  // Icelandic header substring; ?dry=1 exists so the office confirms first.
  const dateCol = pickColumn(headers, ['dagsetning', 'bókunardagur', 'bokunardagur', 'bókun', 'bokun', 'dags', 'date']);
  const amtCol  = pickColumn(headers, ['upphæð', 'upphaed', 'fjárhæð', 'fjarhaed', 'amount', 'hreyfing']);
  const ktCol   = pickColumn(headers, ['kennitala', 'kt.', ' kt', 'kt ', ' kennit']);
  // Reference / transaction number → tnr (part of the dedupe key).
  const tnrCol  = pickColumn(headers, ['færslunúmer', 'faerslunumer', 'tnr', 'færslunr', 'faerslunr', 'tilvísunarnúmer', 'númer', 'numer']);
  // Free-text explanation of the counterparty → text (+ description).
  const textCol = pickColumn(headers, ['skýring', 'skyring', 'texti', 'tilvísun', 'tilvisun', 'lýsing', 'lysing', 'grein']);

  const mapping = {
    trans_date: headers[dateCol] || null,
    amount: headers[amtCol] || null,
    kt_counterparty: ktCol !== -1 ? headers[ktCol] : null,
    tnr: tnrCol !== -1 ? headers[tnrCol] : null,
    text: textCol !== -1 ? headers[textCol] : null,
    _all_headers: headers,
  };
  if (dateCol === -1 || amtCol === -1) {
    // Can't safely build a row without a date+amount; surface for ?dry review.
    return { rows: [], headers, mapping };
  }

  const rows = [];
  for (let i = hdrRow + 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const trans_date = isoDate(r[dateCol]);
    if (!trans_date) continue;                 // title/summary/blank rows
    const amount = num(r[amtCol]);
    if (amount === null) continue;             // no parseable amount → skip
    const text = textCol !== -1 ? str(r[textCol]) : null;
    rows.push({
      trans_date,
      tnr: tnrCol !== -1 ? str(r[tnrCol]) : null,
      amount,
      kt_counterparty: ktCol !== -1 ? fmtKt(r[ktCol]) : null,
      text,
      description: text,
    });
  }
  return { rows, headers, mapping };
}

function str(v) { return v == null ? null : String(v).trim() || null; }
// Icelandic money: `.`=thousands, `,`=decimal; may be negative (leading OR
// trailing „-" as some Icelandic exports print). Returns null when not a number.
function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  let neg = false;
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }  // trailing minus
  s = s.replace(/kr\.?/ig, '').replace(/\s| /g, '');
  s = s.replace(/\./g, '').replace(/,/g, '.');
  const n = Number(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}
function fmtKt(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(0, 6) + '-' + d.slice(6, 10) : (d || null);
}
function isoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);   // 12.6.2026 / 12/06/26
  if (m) {
    let y = m[3]; if (y.length === 2) y = '20' + y;
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                        // 2026-06-12
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
