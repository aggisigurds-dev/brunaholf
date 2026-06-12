// reikningar-read.js — Bakendi "Reikningalesari": reads the SENT Slökkvitæki
// invoice PDFs in a Drive folder and extracts, per invoice:
//   Fyrirtækjanafn · Kennitala · Reikningsnúmer (R-107899) · Dagsetning · Heildarupphæð
//
//   GET /api/reikningar-read?folder=ID[&dry=1][&limit=6][&offset=N]
//     → { total, scanned, indexed, dupSkip, notSlokkvitaeki, errors, offset,
//         nextOffset, rows:[{ fileId, file, company, kt, invoice_number,
//                             date, total, year, base_id, base_name }] }
//
// Batched (each PDF download+parse takes time, ~10s/invocation) — the UI pages
// through with `offset`. dry=1 reads + returns without writing. When not dry it
// upserts customer_documents (doc_type='reikningur', dedup on drive_file_id)
// with the parsed amount / invoice_number / doc_date / customer_name.
// The summary Google Sheet is written separately by /api/reikningar-sheet.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEFAULT_FOLDER = '1TDusB2NLhr-OMLnojSk3iw0oiuiuFMLM'; // slökkvitæki - Reikningar - Master

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const dry = p.dry === '1' || p.dry === 'true';
  const limit = Math.min(parseInt(p.limit || '6', 10) || 6, 12);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const stats = { folder, dry, scanned: 0, indexed: 0, dupSkip: 0, notSlokkvitaeki: 0, errors: 0, rows: [] };

  try {
    const files = await listPdfs(folder, token);
    stats.total = files.length;
    stats.offset = offset;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        const text = await readPdfText(f.id, token);
        if (!text) { stats.errors++; continue; }
        const norm = text.replace(/\s+/g, ' ');
        // Only OUR sent invoices (issuer kt 600508-0400) — skip vendor bills.
        if (norm.replace(/\D/g, '').indexOf(ISSUER_KT) === -1) { stats.notSlokkvitaeki++; continue; }

        const invoice_number = extractInvoiceNumber(text);
        const date = extractDate(text);                       // ISO yyyy-mm-dd
        const year = date ? parseInt(date.slice(0, 4), 10) : extractYear(norm);
        const total = extractTotal(text);                     // heildarupphæð m. vsk
        let kt = customerKt(norm) || customerKtFromName(f.name);
        const company = extractCompany(text, f.name, kt);
        const address = extractAddress(text, f.name);
        const base = kt ? await matchBase(kt) : null;

        const row = {
          fileId: f.id, file: f.name,
          company, address, kt: kt ? dash(kt) : '', invoice_number,
          date, total, year,
          base_id: base ? base.id : null, base_name: base ? base.nafn : null,
        };
        stats.rows.push(row);

        if (!dry) {
          if (await alreadyIndexed(f.id)) { stats.dupSkip++; }
          await upsertDoc({
            customer_base_id: base ? base.id : null,
            doc_type: 'reikningur', year, drive_file_id: f.id,
            source: 'gdrive', found_by: 'code',
            amount: total, invoice_number, doc_date: date, customer_name: company,
            notes: (company || f.name.replace(/\.pdf$/i, '')) + (address ? ', ' + address : '')
                 + (kt ? ' · kt ' + dash(kt) : '')
                 + (invoice_number ? ' · ' + invoice_number : '') + (base ? '' : ' · RESOLVE'),
          });
          stats.indexed++;
        }
      } catch (e) { stats.errors++; }
    }
    stats.processed = slice.length;
    stats.nextOffset = (offset + slice.length < files.length) ? offset + slice.length : null;
  } catch (e) {
    return json(500, { error: e.message, stats });
  }
  return json(200, stats);
};

// ── Drive ────────────────────────────────────────────────────────────────────
async function listPdfs(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType),nextPageToken',
      pageSize: '200', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    for (const f of (d.files || [])) if (/pdf$/i.test(f.name) || f.mimeType === 'application/pdf') out.push(f);
    pageToken = d.nextPageToken;
  } while (pageToken);
  out.sort((a, b) => a.name.localeCompare(b.name, 'is'));
  return out;
}
async function readPdfText(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const d = await pdf(buf).catch(() => null);
  return d ? d.text : null;
}

// ── Extraction ───────────────────────────────────────────────────────────────
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
function customerKtFromName(name) { for (const kt of allKts(String(name || ''))) if (kt !== ISSUER_KT) return kt; return null; }

// "Reikningur 107899" → "R-107899" (also tolerates an existing R- prefix).
function extractInvoiceNumber(text) {
  const m = text.match(/Reikningur\s*\.?\s*:?\s*R?-?\s*(\d{3,8})/i);
  return m ? 'R-' + m[1] : '';
}
// "Dagsetning: 26.02.26" → "2026-02-26"
function extractDate(text) {
  let m = text.match(/Dagsetning\s*:?\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/i);
  if (!m) m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (!m) return '';
  let [, d, mo, y] = m;
  y = y.length === 2 ? '20' + y : y;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function extractYear(s) {
  let m = s.match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m) return 2000 + parseInt(m[1], 10);
  m = s.match(/\b(20\d{2})\b/); if (m) return parseInt(m[1], 10);
  return null;
}
// Heildarupphæð m. vsk = the largest ISK-formatted figure on the invoice (the
// grand total is ≥ every line amount and the VSK amount). Numbers without a
// thousands separator (invoice nr, raðnr) are excluded by requiring "N.NNN".
function extractTotal(text) {
  // Prefer an explicit total line when present.
  const kw = text.match(/(?:Til\s*greiðslu|Samtals(?:\s*m(?:eð)?\.?\s*vsk)?)\s*:?\s*(?:kr\.?)?\s*([\d.]{4,})/i);
  let best = 0;
  if (kw) { const n = parseInt(kw[1].replace(/\./g, ''), 10); if (Number.isFinite(n)) best = n; }
  const re = /\b\d{1,3}(?:\.\d{3})+\b/g; let m;
  while ((m = re.exec(text))) { const n = parseInt(m[0].replace(/\./g, ''), 10); if (n > best) best = n; }
  return best || null;
}
// Company / bill-to name. The bill-to block sits after the issuer address and
// before "Reikningur". Take the first letter-bearing line there that isn't an
// issuer line or a field label. Falls back to the (renamed) filename.
function extractCompany(text, fileName, kt) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const isIssuer = l => /slökkvitæki|brunakerfi|helluhraun|hafnarfj|vsk\s*nr|kt:\s*600508|600508-0400/i.test(l);
  const isLabel = l => /^(reikningur|dagsetning|greiðsl|afh\.?skilm|starfsma|tilvísun|tilvisun|raðnr|radnr|vörunúmer|vorunumer|lýsing|kt\.?|pósthólf|postholf|sími|simi|netfang|s:|\d|kennitala)/i.test(l);
  // Find where the issuer header ends, then take the first plausible name line.
  let started = false;
  for (const l of lines) {
    if (isIssuer(l)) { started = true; continue; }
    if (!started) continue;
    if (/reikningur/i.test(l)) break;
    if (isLabel(l)) continue;
    if (!/[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]/.test(l)) continue;
    if (l.replace(/\D/g, '').length >= 7) continue; // looks like a kt / number line
    if (l.length > 60) continue;
    return l.replace(/\s+/g, ' ').trim();
  }
  // Fallback: first " - " segment of the (renamed) filename, else filename stem.
  const base = String(fileName || '').replace(/\.pdf$/i, '');
  const seg = base.split(' - ').map(s => s.trim()).filter(Boolean);
  if (seg.length && !/^\d/.test(seg[0])) return seg[0];
  return base;
}
// Customer address: the postcode/city line in the bill-to block plus the
// street/pósthólf line just above it (e.g. "Pósthólf 8940, 128 Reykjavík" or
// "Helluhrauni 10, 220 Hafnarfjörður"). Falls back to the filename's address
// segment (the renamer writes "Fyrirtæki - Heimilisfang - Kennitala - …").
function extractAddress(text, fileName) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const cityRe = /\b\d{3}\s+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]/;          // 128 Reykjavík
  const streetRe = /(pósthólf|postholf|p\.?o\.?\s*box|\d)/i;        // street number or PO box
  const isIssuerAddr = l => /helluhraun|220\s*hafnarfj/i.test(l);
  let cityIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/reikningur/i.test(lines[i])) break;
    if (isIssuerAddr(lines[i])) continue;
    if (cityRe.test(lines[i]) && lines[i].replace(/\D/g, '').length < 7) { cityIdx = i; break; }
  }
  if (cityIdx >= 0) {
    const city = lines[cityIdx].replace(/\s+/g, ' ').trim();
    let street = '';
    for (let j = cityIdx - 1; j >= 0 && j >= cityIdx - 3; j--) {
      const l = lines[j];
      if (isIssuerAddr(l) || /reikningur/i.test(l)) break;
      if (/^\d{6}-?\d{4}$/.test(l.replace(/\s/g, ''))) continue;     // kt
      if (streetRe.test(l) && l.replace(/\D/g, '').length < 7 && l.length < 50) { street = l.replace(/\s+/g, ' ').trim(); break; }
    }
    return street ? street + ', ' + city : city;
  }
  // Fallback: filename "Company - Address - kt - …"
  const base = String(fileName || '').replace(/\.pdf$/i, '');
  const seg = base.split(' - ').map(s => s.trim());
  const ktIdx = seg.findIndex(p => /^\d{6}-?\d{4}$/.test(p));
  if (ktIdx >= 2) return seg[ktIdx - 1];
  return '';
}
const dash = kt => kt.length === 10 ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;

// ── Supabase REST ────────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function alreadyIndexed(driveFileId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(driveFileId)}&select=id&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
async function matchBase(kt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
// Upsert on drive_file_id so re-runs refresh the parsed fields (table has a
// unique constraint on drive_file_id — see cowork-doc-sweep skill).
async function upsertDoc(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?on_conflict=drive_file_id`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('upsert ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
