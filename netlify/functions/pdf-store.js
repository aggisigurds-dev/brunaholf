// pdf-store.js — store a browser-generated PDF (Efnislisti / Tímaskýrsla) into
// **Supabase Storage** (bucket `efnislisti-pdf`, public) and record it in
// `efnislisti_documents` so it shows up in the "Vistuð PDF-skjöl" list and can be
// e-mailed to the accountant.
//
//   POST /api/pdf-store
//     body { fileName, contentBase64, worksite_name, work_month, doc_type }
//        doc_type: 'efnislisti_pdf' | 'timabok_pdf' | 'innra' (innra viðhengi — hvaða skrá sem er,
//                  mimeType fylgir; sendist aldrei með skýrslu, sjá index.html)
//     → 200 { ok, id, storage_path, public_url, title }
//
// Twin of `efnislisti-pdf.js` (the Drive path) but with NO Google OAuth — service
// role only. That is the whole point: the office (and anyone the office shares
// with) can view/send these PDFs without ever logging into Google Drive.
//
// The doc is recorded with a synthetic `drive_file_id = 'sb:' + storage_path` so
// the existing (worksite_name, work_month, drive_file_id) primary key + the
// EFDOCS index + the delete-by-fid flow keep working unchanged; the frontend
// prefers `public_url` when present and only falls back to a Drive link for the
// old Drive-hosted rows.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'efnislisti-pdf';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const fileName = String(body.fileName || '').trim();
  const b64 = String(body.contentBase64 || '');
  const worksite_name = String(body.worksite_name || '').trim();
  const work_month = String(body.work_month || '').trim();
  const doc_type = (body.doc_type === 'timabok_pdf' || body.doc_type === 'innra') ? body.doc_type : 'efnislisti_pdf';
  if (!fileName || !b64) return json(400, { error: 'fileName + contentBase64 required' });
  if (!worksite_name || !work_month) return json(400, { error: 'worksite_name + work_month required' });

  const pdfBuf = Buffer.from(b64, 'base64');
  if (!pdfBuf.length) return json(400, { error: 'contentBase64 decoded to 0 bytes' });
  // 🔒 innra: hvaða skrá sem er — ending úr nafni, mime úr beiðni (hvítlisti, annars octet-stream).
  const MIME_OK = new Set(['application/pdf','image/jpeg','image/png','image/webp','image/gif','image/heic','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
  const ext = doc_type === 'innra' ? ((fileName.match(/\.([A-Za-z0-9]{1,5})$/) || [null, 'bin'])[1].toLowerCase()) : 'pdf';
  const contentType = doc_type === 'innra' ? (MIME_OK.has(String(body.mimeType || '')) ? body.mimeType : 'application/octet-stream') : 'application/pdf';

  // Deterministic-ish object path: <ascii-worksite>/<month>/<doc_type>-<rand>.pdf
  const slug = worksite_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 48) || 'verkstadur';
  // overwrite=true → fast slóð per (verkstaður, mánuður, tegund) svo endur-vistun
  // SKRIFAR YFIR fyrra PDF (sami storage-hlutur + sama efnislisti_documents röð).
  // Annars random slóð (mörg söguleg eintök leyfð).
  const storage_path = body.overwrite
    ? `${slug}/${work_month}/${doc_type}.${ext}`
    : `${slug}/${work_month}/${doc_type}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  // 1) Upload to Supabase Storage (service role → no auth flow for the user).
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(storage_path)}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'Cache-Control': 'max-age=31536000',
    },
    body: pdfBuf,
  });
  if (!up.ok) return json(up.status, { error: `Storage upload ${up.status}: ${(await up.text()).slice(0, 300)}` });

  // Cache-buster (?v=) svo yfirskrifað PDF birtist strax þrátt fyrir CDN-cache.
  const ver = Date.now();
  const public_url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(storage_path)}?v=${ver}`;
  // Niðurhal með RÉTTU skráarnafni: vafrinn nefnir annars eftir slóðinni
  // (efnislisti_pdf-xxxx.pdf). Supabase Storage styður ?download=<nafn>.
  const download_url = `${public_url}&download=${encodeURIComponent(fileName)}`;
  const drive_file_id = 'sb:' + storage_path;

  // 2) Record it so the "Vistuð PDF-skjöl" list + send flow can find it.
  const payload = { worksite_name, work_month, drive_file_id, title: fileName, doc_type, storage_path, public_url };
  const rec = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?on_conflict=worksite_name,work_month,drive_file_id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  // A recording failure shouldn't lose the uploaded file — return it either way.
  const recErr = rec.ok ? null : (await rec.text()).slice(0, 200);

  return json(200, { ok: true, id: drive_file_id, storage_path, public_url, download_url, title: fileName, recErr });
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
