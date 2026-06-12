// payday-ingest-drive.js — ingest a Payday invoices xlsx export from Google
// Drive into the `invoices` table (source='payday').
//
//   GET /api/payday-ingest-drive[?fileId=ID]
//     (no fileId → newest Drive file whose name contains "payday")
//     → { ok, file, invoices, upserted }
//
// The export is LINE-level (one row per invoice line, invoice fields repeated)
// — rows are grouped by "Reikningur nr." and the line amounts summed. Mapping
// mirrors the existing rows: tilvisun = Reikningur nr. (dedup key with
// source='payday'), hofudstoll = Σ "Upphæð án vsk.", upphaed_total =
// Σ "Upphæð m.vsk.", status = "Staða" verbatim (Ógreitt/Greiddur/Kredit…).
// worksite_match is intentionally NOT written — it's curated by hand in the
// hub and merge-duplicates leaves untouched columns alone.

const XLSX = require('xlsx');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH = 200;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  const p = event.queryStringParameters || {};

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    let fileId = (p.fileId || '').trim(), fileName = '';
    if (!fileId) {
      const found = await newestByName(token, 'payday', p.folder);
      if (!found) return json(404, { error: 'Engin "payday" skrá fannst í Drive.' });
      fileId = found.id; fileName = found.name;
    }
    const buf = await download(fileId, token);
    if (!fileName) fileName = fileId;

    const invoices = parsePayday(buf);
    if (!invoices.length) return json(200, { ok: true, file: fileName, invoices: 0, upserted: 0, note: 'Engir reikningar fundust.' });

    let upserted = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < invoices.length; i += BATCH) {
      const slice = invoices.slice(i, i + BATCH).map(r => ({ ...r, source: 'payday', imported_at: now }));
      const u = await fetch(`${SUPABASE_URL}/rest/v1/invoices?on_conflict=tilvisun,source`, {
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
    return json(200, { ok: true, file: fileName, invoices: invoices.length, upserted });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function newestByName(token, needle, folder) {
  const qParts = [`name contains '${needle}'`, 'trashed=false'];
  if (folder) qParts.unshift(`'${folder.replace(/'/g, "\\'")}' in parents`);
  const params = new URLSearchParams({
    q: qParts.join(' and '), orderBy: 'modifiedTime desc',
    fields: 'files(id,name)', pageSize: '1',
    includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
  });
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Drive search ' + r.status);
  const d = await r.json();
  return (d.files || [])[0] || null;
}
async function download(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Drive download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

function parsePayday(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (data.length < 2) return [];
  const headers = data[0].map(h => h == null ? '' : String(h));
  const col = (...cands) => {
    for (const c of cands) {
      const i = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
      if (i !== -1) return i;
    }
    return -1;
  };
  const cNr      = col('reikningur nr');
  const cCust    = col('viðskiptavinur', 'vidskiptavinur');
  const cKt      = headers.findIndex(h => h.trim().toLowerCase() === 'kt');
  const cGjald   = col('gjalddagi');
  const cEind    = col('eindagi');
  const cGreitt  = col('greitt dags');
  const cExVat   = col('upphæð án vsk', 'upphaed an vsk');
  const cIncVat  = col('upphæð m.vsk', 'upphaed m.vsk');
  const cStada   = col('staða', 'stada');
  if (cNr === -1) throw new Error('Fann ekki "Reikningur nr." dálk. Hausar: ' + headers.slice(0, 8).join(' | '));

  const byNr = new Map();
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const nr = r[cNr] != null ? String(r[cNr]).trim() : '';
    if (!nr) continue;                       // continuation/blank line
    let inv = byNr.get(nr);
    if (!inv) {
      inv = {
        tilvisun: nr,
        customer_name: str(r[cCust]),
        kt_greidanda: fmtKt(r[cKt]),
        gjalddagi: isoDate(r[cGjald]),
        eindagi: isoDate(r[cEind]),
        greidsla_date: isoDate(r[cGreitt]),
        status: str(r[cStada]) || null,
        hofudstoll: 0, upphaed_total: 0,
      };
      byNr.set(nr, inv);
    }
    inv.hofudstoll += num(r[cExVat]);
    inv.upphaed_total += num(r[cIncVat]);
    if (!inv.status) inv.status = str(r[cStada]) || null;
    if (!inv.greidsla_date) inv.greidsla_date = isoDate(r[cGreitt]);
  }
  return [...byNr.values()].map(v => ({
    ...v,
    hofudstoll: Math.round(v.hofudstoll),
    upphaed_total: Math.round(v.upphaed_total),
  }));
}

function str(v) { return v == null ? null : String(v).trim() || null; }
function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[. ]/g, '').replace(/,/g, '.'));
  return isFinite(n) ? n : 0;
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
    if (!d) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);                       // 12.6.2026
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
