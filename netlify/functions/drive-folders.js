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
  const roots = (p.roots === '1' || p.roots === 'true');   // sýna GRUNN-möppur (efsta lag)
  const limit = Math.min(parseInt(p.limit || '40', 10) || 40, 100);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const mapFile = f => ({
    id: f.id, name: f.name, mime: f.mimeType,
    is_folder: f.mimeType === 'application/vnd.google-apps.folder',
    parents: f.parents || [], modified: f.modifiedTime,
    owners: (f.owners || []).map(o => o.emailAddress).filter(Boolean),
    web_link: f.webViewLink, drive_id: f.driveId || null,
  });
  const fetchFolders = async (driveQ, order) => {
    const url = `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
      q: driveQ,
      fields: 'files(id,name,mimeType,parents,modifiedTime,owners(displayName,emailAddress),webViewLink,driveId),nextPageToken',
      pageSize: String(limit),
      includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
      orderBy: order || 'modifiedTime desc',
    });
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Drive API ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return ((await r.json()).files || []);
  };

  try {
    // GRUNN-möppur (efsta lag): möppur beint undir „My Drive" rót OG möppur sem deilt
    // er með reikningnum („shared with me") — svo grunn-möpppurnar sjáist, ekki bara
    // undirmöppur í flötum nýlega-breytt lista. Aðeins þegar hvorki parent né leit.
    if (roots && !childrenOf && !q) {
      const F = 'application/vnd.google-apps.folder';
      const [own, shared] = await Promise.all([
        fetchFolders(`mimeType='${F}' and 'root' in parents and trashed=false`, 'name'),
        fetchFolders(`mimeType='${F}' and sharedWithMe=true and trashed=false`, 'name'),
      ]);
      const seen = new Set(), merged = [];
      for (const f of [...own, ...shared]) { if (seen.has(f.id)) continue; seen.add(f.id); merged.push(f); }
      merged.sort((a, b) => String(a.name).localeCompare(String(b.name), 'is'));
      return json(200, { q: '', parent: '', roots: true, count: merged.length, files: merged.map(mapFile) });
    }

    let driveQ;
    if (childrenOf) {
      driveQ = `'${childrenOf}' in parents and trashed=false`;
    } else if (q) {
      const safeQ = q.replace(/'/g, "\\'");
      driveQ = `mimeType='application/vnd.google-apps.folder' and name contains '${safeQ}' and trashed=false`;
    } else {
      driveQ = `mimeType='application/vnd.google-apps.folder' and trashed=false`;
    }
    const files = await fetchFolders(driveQ);
    return json(200, { q, parent: childrenOf, count: files.length, files: files.map(mapFile) });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
