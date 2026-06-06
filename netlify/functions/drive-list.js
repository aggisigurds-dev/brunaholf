// drive-list.js — list Drive files under a folder (or by a raw Drive query),
// paginated. Used by the luna-bridge doc-indexer to enumerate Slökkvitæki
// customer reikningar / úttektarskýrslur folders.
//
//   GET /api/drive-list?folder=FOLDER_ID[&pageToken=…][&limit=200]
//   GET /api/drive-list?q=<raw Drive query>[&pageToken=…]
//     → { files:[{id,name,mime,size,modified,parents}], nextPageToken }
//
// Reuses the same Google OAuth token as the other drive-* functions.

const { freshAccessToken, json, cors } = require('./_google');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const limit = Math.min(parseInt(p.limit || '200', 10) || 200, 1000);
  let driveQ;
  if (p.q) driveQ = p.q;
  else if (p.folder) driveQ = `'${p.folder.replace(/'/g, "\\'")}' in parents and trashed=false`;
  else return json(400, { error: 'folder or q query param required' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const params = new URLSearchParams({
    q: driveQ,
    fields: 'files(id,name,mimeType,size,modifiedTime,parents),nextPageToken',
    pageSize: String(limit),
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    corpora: 'allDrives',
    orderBy: 'modifiedTime desc',
  });
  if (p.pageToken) params.set('pageToken', p.pageToken);

  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = {}; }
  if (!r.ok) return json(r.status, { error: `Drive API ${r.status}`, body: t.slice(0, 300) });

  return json(200, {
    files: (d.files || []).map(f => ({
      id: f.id, name: f.name, mime: f.mimeType, size: f.size, modified: f.modifiedTime, parents: f.parents,
    })),
    nextPageToken: d.nextPageToken || null,
  });
};
