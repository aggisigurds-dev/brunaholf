// skjalavarsla.js — keep the canonical doc folders tidy by filing every file into a
// „<ár>/" subfolder (2024/, 2025/, …, óþekkt/) by the year in its NAME (cheap — no
// OCR). Also consolidates: point `src` at an OLD folder and its files are moved into
// `dest/<ár>/` (names kept — no rename, so well-named files are never downgraded).
// Same-name duplicates within a year go to the bin folder.
//
//   GET /api/skjalavarsla?dest=<canonical>[&src=<old-folder>][&dupes=<bin>][&limit=20][&dry=1]
//     → files up to `limit` files; call repeatedly until done:true.
//
// Work-list per call = flat file children of `dest` (not yet in a year subfolder)
// + (if src given and ≠ dest) every file under `src`. Year subfolders + their
// contents are left alone, so nothing is re-moved. Move only — no rename, no DB.
const { freshAccessToken, json, cors } = require('./_google');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DEFAULT_DUPES = '1CnnNHm1xCukiTs806z9Ha1nZnSELM9k8';   // rusl
function folderId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }

function yearLabel(name) {
  const stem = String(name || '').replace(/\.[a-z0-9]+$/i, '');
  const maxY = new Date().getFullYear() + 1;
  const ok = (y) => y >= 2008 && y <= maxY;
  for (const seg of stem.split(/\s+-\s+/)) { const mm = seg.trim().match(/^(20\d{2})$/); if (mm && ok(+mm[1])) return String(+mm[1]); }
  let m = stem.match(/\b\d{1,2}\.\d{1,2}\.(20\d{2})\b/); if (m && ok(+m[1])) return String(+m[1]);
  m = stem.match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m && ok(2000 + +m[1])) return String(2000 + +m[1]);
  const re = /(?:^|\s)(20\d{2})(?=\s|$)/g; let x; const c = [];
  while ((x = re.exec(stem))) c.push(+x[1]);
  for (let i = c.length - 1; i >= 0; i--) if (ok(c[i])) return String(c[i]);
  return 'óþekkt';
}

async function listChildren(token, folder, foldersOnly) {
  const out = []; let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false` + (foldersOnly ? ` and mimeType='${FOLDER_MIME}'` : ''),
      fields: 'files(id,name,mimeType,parents),nextPageToken',
      pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    out.push(...(d.files || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function allFilesUnder(token, root) {
  const files = []; const queue = [root]; const seen = new Set();
  while (queue.length) {
    const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
    for (const c of await listChildren(token, f)) {
      if (c.mimeType === FOLDER_MIME) queue.push(c.id); else files.push(c);
    }
  }
  return files;
}
async function createFolder(token, parent, name) {
  const r = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  });
  if (!r.ok) throw new Error('mkdir ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return (await r.json()).id;
}
async function moveFile(token, id, destFolder, fromParents) {
  const params = new URLSearchParams({ addParents: destFolder, supportsAllDrives: 'true', fields: 'id' });
  if (fromParents) params.set('removeParents', fromParents);
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?' + params, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!r.ok) throw new Error('move ' + r.status + ': ' + (await r.text()).slice(0, 160));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  try {
    const p = event.queryStringParameters || {};
    const dest = folderId(p.dest);
    if (!dest) return json(400, { error: 'dest required' });
    const src = p.src ? folderId(p.src) : null;
    const dupes = folderId(p.dupes || DEFAULT_DUPES);
    const limit = Math.min(Math.max(parseInt(p.limit || '20', 10) || 20, 1), 100);
    const dry = p.dry === '1' || p.dry === 'true';
    const token = await freshAccessToken();

    // existing year subfolders under dest (name → id) + their file-name sets
    const yearFolders = {};                      // '2025' → folderId
    const yearNames = {};                         // '2025' → Set(filenames)
    for (const f of await listChildren(token, dest, true)) yearFolders[f.name] = f.id;
    async function ensureYear(y) {
      if (!yearFolders[y]) { yearFolders[y] = dry ? ('(nýtt:' + y + ')') : await createFolder(token, dest, y); yearNames[y] = new Set(); }
      if (!yearNames[y]) { yearNames[y] = new Set((dry && String(yearFolders[y]).startsWith('(') ? [] : await listChildren(token, yearFolders[y])).map(f => f.name.toLowerCase())); }
      return yearFolders[y];
    }

    // work-list: flat file children of dest (not yet filed) + all files under src
    const flat = (await listChildren(token, dest)).filter(f => f.mimeType !== FOLDER_MIME);
    const fromSrc = (src && src !== dest) ? await allFilesUnder(token, src) : [];
    const worklist = flat.concat(fromSrc);
    const batch = worklist.slice(0, limit);

    const results = []; let filed = 0, duped = 0; const movedByYear = {};
    for (const f of batch) {
      try {
        const y = yearLabel(f.name);
        const yf = await ensureYear(y);
        const from = (f.parents || []).join(',');
        const lc = f.name.toLowerCase();
        if (yearNames[y] && yearNames[y].has(lc)) {
          if (!dry) await moveFile(token, f.id, dupes, from);
          duped++; results.push({ name: f.name, action: 'dupe', year: y });
        } else {
          if (!dry) await moveFile(token, f.id, yf, from);
          if (yearNames[y]) yearNames[y].add(lc);
          filed++; movedByYear[y] = (movedByYear[y] || 0) + 1;
          results.push({ name: f.name, action: 'filed', year: y });
        }
      } catch (e) { results.push({ name: f.name, action: 'error', error: String(e.message || e) }); }
    }
    // In dry mode nothing moves, so „remaining" = whole worklist; live shrinks it.
    const remaining = dry ? Math.max(0, worklist.length - batch.length) : Math.max(0, worklist.length - (filed + duped));
    return json(200, { processed: batch.length, filed, duped, movedByYear, remaining, worklist: worklist.length, done: batch.length === 0, dry, results });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
