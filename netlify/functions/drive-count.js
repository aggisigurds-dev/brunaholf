// drive-count.js — count files in the Drive "reikningar" (master) and "skýrslur"
// (reports) folders, with a per-year breakdown parsed from each file name.
// Powers the Bakendi „📊 Skjalatalning" card (manual refresh). Read-only: no move,
// no DB write. Recurses into subfolders by default so year-subfolders are counted.
//
//   GET /api/drive-count?reikningar=<id>&skyrslur=<id>[&recurse=0]
//     → { folders: { reikningar:{total,pdf,byYear,subfolders}, skyrslur:{…} }, generated_ms }
//
// Defaults match the Drive-flokkun master/reports folders.
const { freshAccessToken, json, cors } = require('./_google');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DEFAULTS = {
  reikningar: '1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p',   // master (reikningar)
  skyrslur:   '1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg',   // skýrslur (úttektarskýrslur)
};

function folderId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }

// Year from a file name. The Drive-flokkun namer writes „… - <ár> - …"; take a
// standalone 20xx, else a dd.mm.yy / dd.mm.yyyy date, else null (óþekkt).
function yearFrom(name) {
  const s = String(name || '');
  let m = s.match(/\b(20\d{2})\b/); if (m) return +m[1];
  m = s.match(/\b\d{1,2}\.\d{1,2}\.(20\d{2})\b/); if (m) return +m[1];
  m = s.match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m) return 2000 + (+m[1]);
  return null;
}

async function listChildren(token, folder) {
  const out = []; let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType),nextPageToken',
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

// Walk a folder tree, tallying files (non-folders) by year. Returns
// { total, pdf, subfolders, byYear:{ '2026': n, …, 'óþekkt': n } }.
async function tally(token, root, recurse) {
  const byYear = {}; let total = 0, pdf = 0, subfolders = 0;
  const queue = [root]; const seen = new Set();
  while (queue.length) {
    const folder = queue.shift();
    if (seen.has(folder)) continue; seen.add(folder);
    const kids = await listChildren(token, folder);
    for (const c of kids) {
      if (c.mimeType === FOLDER_MIME) { subfolders++; if (recurse) queue.push(c.id); continue; }
      total++;
      if (/pdf/i.test(c.mimeType || '') || /\.pdf$/i.test(c.name || '')) pdf++;
      const y = yearFrom(c.name);
      const key = y ? String(y) : 'óþekkt';
      byYear[key] = (byYear[key] || 0) + 1;
    }
  }
  return { total, pdf, subfolders, byYear };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  try {
    const p = event.queryStringParameters || {};
    const recurse = p.recurse !== '0' && p.recurse !== 'false';
    const ids = {
      reikningar: folderId(p.reikningar || DEFAULTS.reikningar),
      skyrslur:   folderId(p.skyrslur   || DEFAULTS.skyrslur),
    };
    const token = await freshAccessToken();
    const folders = {};
    for (const key of ['reikningar', 'skyrslur']) {
      folders[key] = Object.assign({ folder_id: ids[key] }, await tally(token, ids[key], recurse));
    }
    return json(200, { folders, recurse });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
