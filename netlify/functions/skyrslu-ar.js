// skyrslu-ar.js — incremental „lesa ár + mánuð úr skýrslum". Many úttektarskýrslu
// file names carry NO date (e.g. „Torfufell 50 111 Reykjavík - 481074-1349.pdf"),
// so Skjalatalning bins them as „óþekkt". These reports are app-generated PDFs with
// a real TEXT LAYER („…yfirfarin af Slökkvitæki ehf í nóvember 2025"), so we read
// the date straight from the text with pdf-parse — NO OCR (no Google-Doc copy) —
// and RENAME the file to append „ - <ár> - <mánuður>". The cheap filename counter
// then picks up the year for good (one-time read, not per refresh).
//
//   GET /api/skyrslu-ar?folder=<skyrslur-id>[&limit=4][&dry=1]
//     → process up to `limit` dateless reports; call repeatedly until done:true.
//
// Read + rename only (no move, no DB write). Batched so a call never exceeds the
// function timeout; the UI loops until done.
const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DEFAULT_SKYRSLUR = '1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg';
const MONTHS = 'janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember';
const MNAME = { 1: 'janúar', 2: 'febrúar', 3: 'mars', 4: 'apríl', 5: 'maí', 6: 'júní', 7: 'júlí', 8: 'ágúst', 9: 'september', 10: 'október', 11: 'nóvember', 12: 'desember' };

function folderId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }

// same year-from-name test the counter uses — a file "has a year" when this ≠ null
function yearFromName(name) {
  const stem = String(name || '').replace(/\.[a-z0-9]+$/i, '');
  const maxY = new Date().getFullYear() + 1;
  const ok = (y) => y >= 2008 && y <= maxY;
  for (const seg of stem.split(/\s+-\s+/)) { const mm = seg.trim().match(/^(20\d{2})$/); if (mm && ok(+mm[1])) return +mm[1]; }
  let m = stem.match(/\b\d{1,2}\.\d{1,2}\.(20\d{2})\b/); if (m && ok(+m[1])) return +m[1];
  m = stem.match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m && ok(2000 + +m[1])) return 2000 + +m[1];
  const re = /(?:^|\s)(20\d{2})(?=\s|$)/g; let x; const c = [];
  while ((x = re.exec(stem))) c.push(+x[1]);
  for (let i = c.length - 1; i >= 0; i--) if (ok(c[i])) return c[i];
  return null;
}

// Date from the report's TEXT LAYER — prefer „Dags 28.11.2024", else the first
// „{mánuður} {ár}" that is NOT a „Næsta skoðun" date (the report writes „…yfirfarin
// af Slökkvitæki ehf í <mánuður> <ár>"). Returns { year:Number, month:String }|null.
function dateInfo(text) {
  const t = String(text || '');
  let m = t.match(/\bdags\.?\s*:?\s*(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/i);
  if (m) { const mo = +m[2]; let y = m[3]; if (y.length === 2) y = '20' + y; if (mo >= 1 && mo <= 12 && /^20\d{2}$/.test(y)) return { year: +y, month: MNAME[mo] }; }
  const re = new RegExp('\\b(' + MONTHS + ')\\s+(20\\d{2})\\b', 'gi'); let mm;
  while ((mm = re.exec(t))) { const before = t.slice(Math.max(0, mm.index - 32), mm.index); if (/næst|next/i.test(before)) continue; return { year: +mm[2], month: mm[1].toLowerCase() }; }
  m = t.match(/\b(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})\b/);   // any dd.mm.yyyy
  if (m) { const mo = +m[2]; return { year: +m[3], month: (mo >= 1 && mo <= 12) ? MNAME[mo] : '' }; }
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
// All date-less PDF reports anywhere under the folder.
async function datelessReports(token, root) {
  const files = []; const queue = [root]; const seen = new Set();
  while (queue.length) {
    const folder = queue.shift(); if (seen.has(folder)) continue; seen.add(folder);
    for (const c of await listChildren(token, folder)) {
      if (c.mimeType === FOLDER_MIME) { queue.push(c.id); continue; }
      const isPdf = /pdf/i.test(c.mimeType || '') || /\.pdf$/i.test(c.name || '');
      if (isPdf && yearFromName(c.name) == null) files.push(c);
    }
  }
  return files;
}
// Read the PDF TEXT LAYER with pdf-parse. NO OCR — these reports are vector-text.
async function readText(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('download ' + r.status);
  const d = await pdf(Buffer.from(await r.arrayBuffer()));
  return d ? (d.text || '') : '';
}
async function renameFile(token, id, newName) {
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?supportsAllDrives=true&fields=id', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }),
  });
  if (!r.ok) throw new Error('rename ' + r.status + ': ' + (await r.text()).slice(0, 160));
}
// Append „ - <ár> - <mánuður>" to the existing base name (keeps company/kt/address).
function nameWithDate(oldName, year, month) {
  const stem = String(oldName).replace(/\.pdf$/i, '').replace(/\s+$/, '');
  return stem + ' - ' + year + (month ? ' - ' + month : '') + '.pdf';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  try {
    const p = event.queryStringParameters || {};
    const folder = folderId(p.folder || DEFAULT_SKYRSLUR);
    const limit = Math.min(Math.max(parseInt(p.limit || '4', 10) || 4, 1), 10);
    const dry = p.dry === '1' || p.dry === 'true';
    const token = await freshAccessToken();

    const pending = await datelessReports(token, folder);
    const batch = pending.slice(0, limit);
    const results = []; let renamed = 0, unread = 0;
    for (const f of batch) {
      try {
        const text = await readText(f.id, token);
        const di = dateInfo(text);
        if (!di || !di.year) { unread++; results.push({ name: f.name, status: 'ólæsilegt', reason: 'engin dagsetning í texta' }); continue; }
        const nn = nameWithDate(f.name, di.year, di.month);
        if (!dry) await renameFile(token, f.id, nn);
        renamed++;
        results.push({ name: f.name, status: 'ár', year: di.year, month: di.month || '', newName: nn });
      } catch (e) {
        results.push({ name: f.name, status: 'villa', reason: String(e.message || e) });
      }
    }
    // remaining = date-less files still needing a successful read next time.
    // (unreadable ones stay in the list; the UI stops when a whole batch yields 0 renamed.)
    const remaining = Math.max(0, pending.length - renamed);
    return json(200, { processed: batch.length, renamed, unread, remaining, total_yearless: pending.length, done: batch.length === 0, dry, results });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
