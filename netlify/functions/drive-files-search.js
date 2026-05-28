// drive-files-search.js — search Google Drive for files (xlsx / pdf / docx) by name.
// GET /api/drive-files-search?q=Efnislisti+Fjarðagata
//   → { files: [{id, name, mime, modified, web_link}] }

const { freshAccessToken, json, cors } = require('./_google');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const q = (p.q || '').trim();
  if (!q) return json(400, { error: 'q (search query) required' });
  const limit = Math.min(parseInt(p.limit || '25', 10) || 25, 50);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const safe = q.replace(/'/g, "\\'");
  // Match files (not folders) whose name contains the query, prefer Efnislisti spreadsheets/PDFs/docx.
  const driveQ = `name contains '${safe}' and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
    q: driveQ,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,parents),nextPageToken',
    pageSize: String(limit),
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    corpora: 'allDrives',
    orderBy: 'modifiedTime desc',
  });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const txt = await r.text();
    return json(r.status, { error: `Drive API ${r.status}`, body: txt.slice(0, 500) });
  }
  const data = await r.json();
  return json(200, {
    q,
    files: (data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mime: f.mimeType,
      modified: f.modifiedTime,
      web_link: f.webViewLink,
      parents: f.parents || [],
    })),
  });
};
