// drive-folders.js — search Google Drive for folders by name fragment.
// GET /api/drive-folders?q=Dalvegur
// GET /api/drive-folders?ids=folder1,folder2 (returns children of those folders)

const { freshAccessToken, json, cors } = require('./_google');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const q = (p.q || '').trim();
  const childrenOf = (p.parent || '').trim();
  const limit = Math.min(parseInt(p.limit || '40', 10) || 40, 100);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    let driveQ;
    if (childrenOf) {
      driveQ = `'${childrenOf}' in parents and trashed=false`;
    } else if (q) {
      // Folder name contains q (case-insensitive)
      const safeQ = q.replace(/'/g, "\\'");
      driveQ = `mimeType='application/vnd.google-apps.folder' and name contains '${safeQ}' and trashed=false`;
    } else {
      driveQ = `mimeType='application/vnd.google-apps.folder' and trashed=false`;
    }
    const url = `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
      q: driveQ,
      fields: 'files(id,name,mimeType,parents,modifiedTime,owners(displayName,emailAddress),webViewLink,driveId),nextPageToken',
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
      q, parent: childrenOf,
      count: (data.files || []).length,
      files: (data.files || []).map(f => ({
        id: f.id,
        name: f.name,
        mime: f.mimeType,
        is_folder: f.mimeType === 'application/vnd.google-apps.folder',
        parents: f.parents || [],
        modified: f.modifiedTime,
        owners: (f.owners || []).map(o => o.emailAddress).filter(Boolean),
        web_link: f.webViewLink,
        drive_id: f.driveId || null,
      })),
    });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
