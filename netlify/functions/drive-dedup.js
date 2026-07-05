// drive-dedup.js — find duplicate-named files in a Google Drive folder and
// (on explicit confirmation) MOVE the extra copies into a "delete" folder.
//
// Two-step, human-in-the-loop. Never deletes — only moves, so nothing is lost:
// the user reviews the list first, then confirms the move to the bin folder.
//
//   GET  /api/drive-dedup?folder=ID[&cap=100]
//        → scan the folder, group files by normalised name, return the
//          duplicate groups (keeper + extra copies to move). cap = stop after
//          this many duplicate files are collected (0 = whole folder).
//   POST /api/drive-dedup { action:'move', fileIds:[…], trashFolder:'…' }
//        → move each fileId into trashFolder (removeParents = its current
//          parents). Returns { moved:[…], errors:[…] }.
//
// The bin folder defaults to the Slökkvitæki "delete" folder the user set up.

const { freshAccessToken, json, cors } = require('./_google');

const DEFAULT_TRASH = '1CnnNHm1xCukiTs806z9Ha1nZnSELM9k8';

// Pull a folder id out of a raw id OR a full Drive URL the user pasted.
function folderId(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/[-\w]{25,}/);
  return m ? m[0] : s;
}

// Normalise a filename for duplicate grouping: drop the extension, drop a
// trailing Drive copy suffix " (1)" / " (2)", collapse whitespace, lowercase.
// So "Foo.pdf", "Foo (1).pdf" and "foo .pdf" all group together.
function normName(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s*\((\d+)\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function hasCopySuffix(name) {
  return /\s*\((\d+)\)\s*(\.[a-z0-9]+)?$/i.test(String(name || ''));
}

async function listFolder(token, folder) {
  const out = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,createdTime,modifiedTime,size,mimeType,parents),nextPageToken',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error('Drive list ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const d = await r.json();
    (d.files || []).forEach((f) => out.push(f));
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}

async function scan(folder, cap) {
  const token = await freshAccessToken();
  const files = await listFolder(token, folder);

  // group by normalised name
  const groups = new Map();
  for (const f of files) {
    const k = normName(f.name);
    if (!k) continue;
    (groups.get(k) || groups.set(k, []).get(k)).push(f);
  }

  const dupGroups = [];
  let dupeCount = 0;
  let totalDupes = 0;
  // stable order: alphabetical by name
  const keys = [...groups.keys()].sort();
  for (const k of keys) {
    const arr = groups.get(k);
    if (arr.length < 2) continue;
    // keeper: prefer a name WITHOUT a copy-suffix; then the earliest created.
    const sorted = arr.slice().sort((a, b) => {
      const sa = hasCopySuffix(a.name) ? 1 : 0;
      const sb = hasCopySuffix(b.name) ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return String(a.createdTime || '').localeCompare(String(b.createdTime || ''));
    });
    const keeper = sorted[0];
    const dupes = sorted.slice(1);
    totalDupes += dupes.length;
    // respect the cap on how many duplicate FILES we return/act on
    if (cap > 0 && dupeCount >= cap) continue;
    const take = cap > 0 ? dupes.slice(0, Math.max(0, cap - dupeCount)) : dupes;
    dupeCount += take.length;
    dupGroups.push({
      name: keeper.name,
      keeper: { id: keeper.id, name: keeper.name, createdTime: keeper.createdTime, size: keeper.size || null,
                viewUrl: 'https://drive.google.com/file/d/' + keeper.id + '/view' },
      dupes: take.map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime, size: f.size || null,
                 viewUrl: 'https://drive.google.com/file/d/' + f.id + '/view' })),
    });
  }

  return {
    folder,
    total_files: files.length,
    group_count: dupGroups.length,
    dupe_count: dupeCount,          // how many are in this response
    total_dupe_count: totalDupes,   // how many exist in the whole folder
    capped: cap > 0 && totalDupes > dupeCount,
    cap: cap || 0,
    groups: dupGroups,
  };
}

async function moveToTrash(fileIds, trashFolder) {
  const token = await freshAccessToken();
  const trash = folderId(trashFolder) || DEFAULT_TRASH;
  const moved = [];
  const errors = [];
  for (const id of fileIds) {
    try {
      // fetch current parents so we can remove them precisely
      const gr = await fetch('https://www.googleapis.com/drive/v3/files/' + id +
        '?fields=id,parents&supportsAllDrives=true', { headers: { Authorization: `Bearer ${token}` } });
      if (!gr.ok) throw new Error('get ' + gr.status);
      const meta = await gr.json();
      const parents = (meta.parents || []).join(',');
      const params = new URLSearchParams({ addParents: trash, supportsAllDrives: 'true', fields: 'id,parents' });
      if (parents) params.set('removeParents', parents);
      const pr = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?' + params,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
      if (!pr.ok) throw new Error('move ' + pr.status + ': ' + (await pr.text()).slice(0, 200));
      moved.push(id);
    } catch (e) {
      errors.push({ id, error: String(e.message || e) });
    }
  }
  return { moved, moved_count: moved.length, errors, trashFolder: trash };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  try {
    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
      if (body.action === 'move') {
        const ids = Array.isArray(body.fileIds) ? body.fileIds.filter(Boolean) : [];
        if (!ids.length) return json(400, { error: 'no fileIds' });
        if (ids.length > 500) return json(400, { error: 'too many at once (max 500)' });
        return json(200, await moveToTrash(ids, body.trashFolder || DEFAULT_TRASH));
      }
      return json(400, { error: 'unknown action' });
    }
    const p = event.queryStringParameters || {};
    const folder = folderId(p.folder);
    if (!folder) return json(400, { error: 'folder required' });
    const cap = Math.max(0, parseInt(p.cap || '0', 10) || 0);
    return json(200, await scan(folder, cap));
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
