// efnislisti-scan.js — recursively scan a worksite's Drive folder for Efnislisti
// (or reikningur) files and match each to a YYYY-MM month.
//
//   GET /api/efnislisti-scan?folderId=<driveFolderId>[&worksite=Name]
//     → { worksite, folderId, folders_visited, candidate_count, months: [
//          { month:'2026-04', files:[{id,name,mime,modified,web_link,path}], pick:{...} }
//        ] }
//
// Amount extraction is deliberately NOT done here (it requires downloading +
// parsing each file, which is slow). The frontend links the `pick` file to the
// month, then calls /api/efnislisti-amount per file to get a suggested amount.

const { freshAccessToken, json, cors } = require('./_google');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const NAME_RE = /efnisl|reikn/i;   // Efnislisti / reikningur (diacritic-tolerant enough)
const MAX_FOLDERS = 80;            // safety cap on folders visited
const MAX_DEPTH = 4;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const folderId = (p.folderId || p.folder || '').trim();
  if (!folderId) return json(400, { error: 'folderId required' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  async function listChildren(id) {
    const base = `https://www.googleapis.com/drive/v3/files?`;
    const baseParams = {
      q: `'${id}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)',
      pageSize: '200',
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
      corpora: 'allDrives',
      orderBy: 'modifiedTime desc',
    };
    let out = [], pageToken = '';
    do {
      const params = new URLSearchParams(baseParams);
      if (pageToken) params.set('pageToken', pageToken);
      const r = await fetch(base + params.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const d = await r.json();
      out = out.concat(d.files || []);
      pageToken = d.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  const candidates = [];
  let visited = 0;
  const queue = [{ id: folderId, path: '', depth: 0 }];
  try {
    while (queue.length && visited < MAX_FOLDERS) {
      const { id, path, depth } = queue.shift();
      visited++;
      const children = await listChildren(id);
      for (const c of children) {
        if (c.mimeType === FOLDER_MIME) {
          if (depth < MAX_DEPTH) {
            queue.push({ id: c.id, path: path ? path + '/' + c.name : c.name, depth: depth + 1 });
          }
        } else if (isParsable(c.mimeType) && NAME_RE.test(c.name)) {
          candidates.push({
            id: c.id, name: c.name, mime: c.mimeType,
            modified: c.modifiedTime, web_link: c.webViewLink, path,
          });
        }
      }
    }
  } catch (e) {
    return json(502, { error: e.message });
  }

  // Match each candidate to a month from its filename, falling back to its path.
  const byMonth = {};
  for (const f of candidates) {
    const month = parseMonth(f.name) || parseMonth(f.path);
    if (!month) continue;
    (byMonth[month] = byMonth[month] || []).push(f);
  }

  const months = Object.keys(byMonth).sort().map((month) => {
    const files = byMonth[month];
    // Prefer PDF (the user's authoritative export); then most-recently modified.
    const pick = files.slice().sort((a, b) => {
      const ap = a.mime === 'application/pdf' ? 0 : 1;
      const bp = b.mime === 'application/pdf' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (b.modified || '').localeCompare(a.modified || '');
    })[0];
    return { month, files, pick };
  });

  return json(200, {
    worksite: p.worksite || null,
    folderId,
    folders_visited: visited,
    candidate_count: candidates.length,
    months,
  });
};

function isParsable(mime) {
  return mime === 'application/pdf'
    || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mime === 'application/vnd.ms-excel'
    || mime === 'application/vnd.google-apps.spreadsheet';
}

const IS_MONTHS = {
  'jan': 1, 'januar': 1, 'janúar': 1,
  'feb': 2, 'februar': 2, 'febrúar': 2,
  'mar': 3, 'mars': 3,
  'apr': 4, 'april': 4, 'apríl': 4,
  'mai': 5, 'maí': 5,
  'jun': 6, 'juni': 6, 'júní': 6, 'jún': 6,
  'jul': 7, 'juli': 7, 'júlí': 7, 'júl': 7,
  'agu': 8, 'agust': 8, 'ágúst': 8, 'ágú': 8, 'aug': 8,
  'sep': 9, 'sept': 9, 'september': 9,
  'okt': 10, 'oktober': 10, 'október': 10, 'oct': 10,
  'nov': 11, 'november': 11, 'nóvember': 11, 'nóv': 11,
  'des': 12, 'desember': 12, 'dec': 12,
};

// Parse a "YYYY-MM" from a string using numeric dates first, then IS month names.
function parseMonth(s) {
  if (!s) return null;
  const t = String(s).toLowerCase();

  // 1) YYYY-MM / YYYY.MM / YYYY_MM
  let m = t.match(/(20\d{2})[-_.](0?[1-9]|1[0-2])(?!\d)/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;

  // 2) dd.mm.yyyy → take mm + yyyy
  m = t.match(/\b(0?[1-9]|[12]\d|3[01])[.\-/](0?[1-9]|1[0-2])[.\-/](20\d{2})\b/);
  if (m) return `${m[3]}-${String(+m[2]).padStart(2, '0')}`;

  // 3) mm.yyyy
  m = t.match(/\b(0?[1-9]|1[0-2])[.\-/](20\d{2})\b/);
  if (m) return `${m[2]}-${String(+m[1]).padStart(2, '0')}`;

  // 4) <monthname> <year>  and  <year> <monthname>
  const names = Object.keys(IS_MONTHS).sort((a, b) => b.length - a.length).join('|');
  m = t.match(new RegExp(`(?:^|[^a-zà-ÿ])(${names})[a-zà-ÿ]*\\.?[\\s_-]*(20\\d{2})`, 'i'));
  if (m) return `${m[2]}-${String(IS_MONTHS[m[1]]).padStart(2, '0')}`;
  m = t.match(new RegExp(`(20\\d{2})[\\s_-]*(${names})`, 'i'));
  if (m) return `${m[1]}-${String(IS_MONTHS[m[2]]).padStart(2, '0')}`;

  return null;
}
