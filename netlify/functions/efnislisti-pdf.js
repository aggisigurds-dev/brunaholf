// efnislisti-pdf.js — store a browser-generated PDF (Efnislisti / Tímaskýrsla)
// into Google Drive and record it in `efnislisti_documents` so it shows up in
// the "Vistuð PDF-skjöl" list where the office can open + download it.
//
//   POST /api/efnislisti-pdf
//     body {
//       fileName,                 // "Efnislisti - <verkstaður> - <mánuður>.pdf"
//       contentBase64,            // the PDF bytes, base64 (small files, a few hundred KB)
//       worksite_name, work_month,
//       doc_type,                 // 'efnislisti_pdf' | 'timabok_pdf'
//       folderId?                 // optional target folder; else find-or-create the default one
//     }
//     → 200 { ok, drive_file_id, webViewLink, downloadUrl, folderId }
//
// Uses the same Google OAuth as the other Drive functions (_google.js) and the
// Supabase service key. Small PDFs go through a single multipart upload (well
// under Netlify's 6 MB sync-body limit) — no resumable session needed.

const { freshAccessToken, cors, json } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_FOLDER_NAME = 'Brunahólf – Reikningar & Tímaskýrslur (sjálfvirkt)';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const fileName = String(body.fileName || '').trim();
  const b64 = String(body.contentBase64 || '');
  const worksite_name = String(body.worksite_name || '').trim();
  const work_month = String(body.work_month || '').trim();
  const doc_type = body.doc_type === 'timabok_pdf' ? 'timabok_pdf' : 'efnislisti_pdf';
  if (!fileName || !b64) return json(400, { error: 'fileName + contentBase64 required' });
  if (!worksite_name || !work_month) return json(400, { error: 'worksite_name + work_month required' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: 'Drive OAuth feilaði (tengdu Google): ' + e.message }); }

  // 1) Resolve target folder (explicit → given; else find-or-create the default).
  let folderId = String(body.folderId || '').trim();
  if (!folderId) {
    try { folderId = await ensureFolder(token, DEFAULT_FOLDER_NAME); }
    catch (e) { return json(502, { error: 'Gat ekki fundið/búið til Drive-möppu: ' + e.message }); }
  }

  // 2) Multipart upload the PDF bytes.
  const pdfBuf = Buffer.from(b64, 'base64');
  const boundary = 'bh_' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/pdf' });
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, 'utf8');
  const post = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const multipart = Buffer.concat([pre, pdfBuf, post]);

  const up = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(multipart.length),
      },
      body: multipart,
    }
  );
  if (!up.ok) return json(up.status, { error: `Drive upload ${up.status}: ${(await up.text()).slice(0, 300)}` });
  const file = await up.json();
  const drive_file_id = file.id;

  // 3) Record it so the list can show it (service key → bypasses doc_type coercion).
  const payload = { worksite_name, work_month, drive_file_id, title: fileName, doc_type };
  const rec = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?on_conflict=worksite_name,work_month,drive_file_id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  // A recording failure shouldn't lose the uploaded file — return it either way.
  const recErr = rec.ok ? null : (await rec.text()).slice(0, 200);

  return json(200, {
    ok: true,
    drive_file_id,
    folderId,
    webViewLink: file.webViewLink || `https://drive.google.com/file/d/${drive_file_id}/view`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${drive_file_id}`,
    recorded: rec.ok,
    record_error: recErr,
  });
};

// Find a folder by name (owned, not trashed); create it if missing.
async function ensureFolder(token, name) {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`);
  const find = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (find.ok) {
    const j = await find.json();
    if (j.files && j.files.length) return j.files[0].id;
  }
  const mk = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!mk.ok) throw new Error(`${mk.status}: ${(await mk.text()).slice(0, 200)}`);
  return (await mk.json()).id;
}
