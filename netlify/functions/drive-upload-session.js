// drive-upload-session.js — initiate a Google Drive resumable upload session
// on behalf of the local-mcp running on the heimaskrifstofa tölva.
//
// Why: Netlify functions have body-size and timeout limits that make
// streaming a multi-GB file through them impractical. Google Drive's
// resumable upload protocol lets us split that — we (brunaholf) create
// the upload session with auth, and the local MCP PUTs the file bytes
// directly to Google's session URL, no bytes flow through Netlify.
//
//   POST /api/drive-upload-session
//     Header: X-Brunaholf-Token: <LOCAL_UPLOAD_TOKEN>
//     Body: {
//       folderId: "<DriveFolderId>",
//       fileName: "All mail Including Spam and Trash.mbox",
//       mimeType: "application/mbox" | "application/octet-stream" | …,
//       size:     1234567890
//     }
//     → 200 { uploadUrl, expiresHint }
//
// Local MCP then:
//   PUT <uploadUrl>
//     Content-Length: <size>
//     Body: file bytes
//   → 200 { id, name, mimeType, size, ... }  ← that's the new Drive file
//
// Env vars (set in Netlify):
//   LOCAL_UPLOAD_TOKEN  — shared secret the MCP sends
//   (plus existing Google OAuth vars used by _google.js)

const { freshAccessToken, json, cors } = require('./_google');

const TOKEN = process.env.LOCAL_UPLOAD_TOKEN;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!TOKEN) return json(500, { error: 'LOCAL_UPLOAD_TOKEN vantar í Netlify env' });

  const sent = (event.headers['x-brunaholf-token'] || event.headers['X-Brunaholf-Token'] || '').trim();
  if (!sent || sent !== TOKEN) return json(401, { error: 'Ógilt eða vantandi X-Brunaholf-Token' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { error: 'Invalid JSON' }); }

  const folderId = String(body.folderId || '').trim();
  const fileName = String(body.fileName || '').trim();
  const mimeType = String(body.mimeType || 'application/octet-stream').trim();
  const size = Number(body.size);

  if (!folderId) return json(400, { error: 'folderId vantar' });
  if (!fileName) return json(400, { error: 'fileName vantar' });
  if (!isFinite(size) || size <= 0) return json(400, { error: 'size vantar (positive number)' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: 'Drive OAuth feilaði: ' + e.message }); }

  // Drive resumable upload init
  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(size),
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
        mimeType,
      }),
    }
  );
  if (!initRes.ok) {
    const txt = (await initRes.text()).slice(0, 300);
    return json(initRes.status, { error: `Drive session init ${initRes.status}: ${txt}` });
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    return json(502, { error: 'Drive did not return a Location header (resumable session url)' });
  }

  return json(200, {
    ok: true,
    uploadUrl,
    folderId,
    fileName,
    mimeType,
    size,
    note: 'PUT raw bytes to uploadUrl with Content-Length=size. On 200, response body is the new Drive file metadata (id, mimeType, size).',
  });
};
