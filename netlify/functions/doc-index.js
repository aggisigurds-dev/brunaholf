// doc-index.js — server-side Google Drive → customer_documents indexer.
// The web-runnable form of the luna-bridge doc-indexer: a button in the
// brunahólf Verkfæri panel calls this to connect Slökkvitæki invoices /
// úttektarskýrslur to customers without any desktop script.
//
//   GET /api/doc-index?folder=FOLDER_ID[&dry=1][&limit=N]
//     → { scanned, indexed, dupSkip, notSlokkvitaeki, noKt, errors,
//         unmatched:[{file,kt,doc_type,year}], added:[…] }
//
// For each PDF in the folder it: reads the text, REQUIRES the Slökkvitæki
// issuer kt (600508-0400) so vendor invoices are skipped, takes the customer
// kt (the non-issuer kt), classifies, matches kt→customers_base, and upserts
// customer_documents (deduped on drive_file_id). dry=1 reports without writing.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEFAULT_FOLDER = '1ApVH4kzbZ4SmwXsLtFqUOn3hotSNECTk';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const dry = p.dry === '1' || p.dry === 'true';
  // Process one bounded batch per call (each PDF download+parse takes time, and
  // a function invocation has ~10s). The caller pages through with `offset`.
  const limit = Math.min(parseInt(p.limit || '8', 10) || 8, 50);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const stats = {
    folder, dry, scanned: 0, indexed: 0, dupSkip: 0,
    notSlokkvitaeki: 0, noKt: 0, errors: 0, unmatched: [], added: [],
  };

  try {
    const files = await listPdfs(folder, token);
    stats.total = files.length;
    stats.offset = offset;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        if (await alreadyIndexed(f.id)) { stats.dupSkip++; continue; }
        const text = await readPdfText(f.id, token);
        if (!text) { stats.errors++; continue; }
        const norm = text.replace(/\s+/g, ' ');
        if (norm.replace(/\D/g, '').indexOf(ISSUER_KT) === -1) { stats.notSlokkvitaeki++; continue; }
        const kt = customerKt(norm);
        if (!kt) { stats.noKt++; continue; }
        const doc_type = classify(norm);
        const year = extractYear(norm);
        const amount = doc_type === 'reikningur' ? extractAmount(norm) : null;
        const base = await matchBase(kt);
        const rec = { file: f.name, kt: dash(kt), doc_type, year, base_id: base ? base.id : null, base_name: base ? base.nafn : null };
        if (!base) stats.unmatched.push(rec);
        if (!dry) {
          await insertDoc({
            customer_base_id: base ? base.id : null,
            doc_type, year, drive_file_id: f.id, source: 'gdrive', found_by: 'code', amount,
            notes: f.name.replace(/\.pdf$/i, '') + ' · kt ' + dash(kt) + (base ? '' : ' · RESOLVE'),
          });
        }
        stats.indexed++;
        stats.added.push(rec);
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
  const out = [];
  let pageToken = null;
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
function classify(s) {
  if (/skýrsla\s+vegna\s+úttektar|úttektarskýrsl|uttektarskyrsl/i.test(s)) return 'uttektarskyrsla';
  if (/þjónustusamning|þjonustusamning/i.test(s)) return 'samningur';
  return 'reikningur';
}
function extractYear(s) {
  let m = s.match(/\b\d{2}\.\d{2}\.(\d{2})\b/); if (m) return 2000 + parseInt(m[1], 10);
  m = s.match(/\b(20\d{2})\b/); if (m) return parseInt(m[1], 10);
  return null;
}
function extractAmount(s) {
  const m = s.match(/til\s+greiðslu\s*:?\s*([\d.]+)/i); if (!m) return null;
  const n = parseInt(m[1].replace(/\./g, ''), 10); return Number.isFinite(n) ? n : null;
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
async function insertDoc(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('insert ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
