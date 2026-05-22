// drive-download.js — fetch a file from Drive and return its bytes as base64.
// GET /api/drive-download?id=FILE_ID
//
// Used so the calling tool can fetch XLSX/PDF content even though the page itself
// only renders metadata. Limited to small files (Drive API streams; we cap output).

const { freshAccessToken, json, cors } = require('./_google');

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const id = (event.queryStringParameters || {}).id;
  if (!id) return json(400, { error: 'id is required' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  // First fetch metadata so we know the size + mime + name
  let meta;
  try {
    const mr = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,size,webViewLink&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mr.ok) return json(mr.status, { error: `meta ${mr.status}: ${(await mr.text()).slice(0, 200)}` });
    meta = await mr.json();
  } catch (e) { return json(500, { error: e.message }); }

  if (meta.size && Number(meta.size) > MAX_BYTES) {
    return json(413, { error: `File too large (${meta.size} bytes; cap ${MAX_BYTES})`, meta });
  }

  try {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return json(r.status, { error: `download ${r.status}: ${(await r.text()).slice(0, 200)}` });
    const buf = Buffer.from(await r.arrayBuffer());
    return json(200, {
      id: meta.id,
      name: meta.name,
      mime: meta.mimeType,
      size: buf.length,
      web_link: meta.webViewLink,
      base64: buf.toString('base64'),
    });
  } catch (e) { return json(500, { error: e.message }); }
};
