// drive-flatten.js — collapse a folder's SUBFOLDERS into the folder itself.
//
// The invoice + report master folders should be ONE flat folder each (no year
// subfolders): the system links documents by drive_file_id + parsed content, the
// standard file names already carry the year, and the readers / drive-dedup work
// flat. This moves every file that lives in a subfolder (any depth) up into the
// root `folder`; files already directly in `folder` are left alone. Folders are
// never deleted — empty year subfolders just remain (harmless). Nothing is
// deleted, only MOVED, so it is safe + resumable.
//
//   GET /api/drive-flatten?folder=ID[&dry=1][&limit=N]
//     dry=1 → count what would move, move nothing
//     limit → max files to move per call (default 25, max 100) — the UI loops
//
// Reuses the connected Google OAuth (same account as drive-sort).

const { json, cors, freshAccessToken } = require('./_google');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
function folderId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }

async function listChildren(token, folder) {
  const out = []; let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,parents),nextPageToken',
      pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ': ' + (await r.text()).slice(0, 160));
    const d = await r.json();
    out.push(...(d.files || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return out;
}

// Walk every SUBFOLDER of root (any depth) and collect the files inside them —
// files that are already direct children of root are skipped. Stops once `limit`
// files are gathered so each call stays quick and resumable.
async function collectNested(token, root, limit) {
  const files = []; const queue = []; const seen = new Set();
  // seed the queue with root's subfolders only (root's own files stay put)
  for (const c of await listChildren(token, root)) if (c.mimeType === FOLDER_MIME) queue.push(c.id);
  while (queue.length && files.length < limit) {
    const folder = queue.shift();
    if (seen.has(folder)) continue; seen.add(folder);
    for (const c of await listChildren(token, folder)) {
      if (c.mimeType === FOLDER_MIME) queue.push(c.id);
      else { files.push(c); if (files.length >= limit) break; }
    }
  }
  return files;
}

async function moveTo(token, fileId, addParent, removeParents) {
  const params = new URLSearchParams({ addParents: addParent, supportsAllDrives: 'true', fields: 'id,parents' });
  if (removeParents) params.set('removeParents', removeParents);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?` + params, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!r.ok) throw new Error('move ' + r.status + ': ' + (await r.text()).slice(0, 160));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  try {
    const p = event.queryStringParameters || {};
    const folder = folderId(p.folder);
    if (!folder) return json(400, { error: 'folder required' });
    const dry = p.dry === '1' || p.dry === 'true';
    const limit = Math.min(Math.max(parseInt(p.limit || '25', 10) || 25, 1), 100);
    const token = await freshAccessToken();

    const files = await collectNested(token, folder, limit + 1);   // +1 to detect "more remain"
    const batch = files.slice(0, limit);
    const results = [];
    if (!dry) {
      for (const f of batch) {
        const from = (f.parents || []).filter(x => x !== folder).join(',');
        try { await moveTo(token, f.id, folder, from); results.push({ name: f.name, ok: true }); }
        catch (e) { results.push({ name: f.name, ok: false, error: String(e.message || e) }); }
      }
    } else {
      batch.forEach(f => results.push({ name: f.name, dry: true }));
    }
    const moved = dry ? 0 : results.filter(r => r.ok).length;
    const errors = results.filter(r => r.ok === false).length;
    const more = files.length > limit;                              // more remain beyond this batch
    // done when nothing was found to move this call — i.e. all subfolders are empty
    // of files (loop keeps calling until then). `more` just hints there's another batch.
    const done = batch.length === 0;
    return json(200, { folder, dry, moved, errors, batch: batch.length, more, done, results });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
