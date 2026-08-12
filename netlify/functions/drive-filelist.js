// drive-filelist.js — „📋 Skráalisti": telur og listar ALLAR skrár í Drive-möppu.
//
// Til hvers (Agnar 2026-08-12): „choose folder and get a list with all the names of
// files in that folder and total count, exportable to excel or into google sheets …
// this will help finding missing files and compare 2 lists together." Sem sagt:
// hrátt yfirlit til að bera saman tvær möppur og sjá HVAÐ VANTAR — ekki flokkun,
// ekki OCR, engin tenging. Þess vegna er þetta aðskilið frá multitoolinu.
//
//   GET  /api/drive-filelist?folder=<id>[&recurse=1][&cap=5000]
//        → { ok, folder, folder_name, total, folders, truncated, files:[…] }
//        Hver skrá: { id, name, stem, ext, mime, is_folder, size, modified, created,
//                     folder_id, folder_name }
//
//   POST /api/drive-filelist { action:'sheet', title, tabs:[{title, rows:[[…]]}] }
//        → { ok, id, url }  (nýtt Google Sheet með gögnunum)
//
// ÖRYGGI: GET er les-eingöngu. POST býr til NÝTT skjal í Drive og snertir aldrei
// skrárnar sem verið er að telja — hvorki endurnefnir, færir né eyðir.

const { freshAccessToken, json, cors } = require('./_google');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const HARD_CAP = 20000;          // þak á skráafjölda (varnagli, ekki venjuleg mörk)
const MAX_PAGES = 60;            // þak á Drive-köllum svo fallið renni ekki út á tíma

function folderId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }
function stemOf(name) { const s = String(name || ''); const i = s.lastIndexOf('.'); return (i > 0 ? s.slice(0, i) : s); }
function extOf(name) { const s = String(name || ''); const i = s.lastIndexOf('.'); return (i > 0 ? s.slice(i + 1).toLowerCase() : ''); }

async function listChildren(token, folder, budget) {
  const out = []; let pageToken = '';
  do {
    if (budget.pages >= MAX_PAGES) { budget.truncated = true; break; }
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,createdTime),nextPageToken',
      pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives',
      orderBy: 'name',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    budget.pages++;
    if (!r.ok) throw new Error('Drive list ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    out.push(...(d.files || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function folderName(token, id) {
  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,name&supportsAllDrives=true', { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return '';
    return (await r.json()).name || '';
  } catch (_) { return ''; }
}

// Gengur um möppuna (og undirmöppur ef beðið er um) og skilar hverri skrá EINU sinni.
async function walk(token, root, rootName, recurse, cap) {
  const files = [];
  const budget = { pages: 0, truncated: false };
  const queue = [{ id: root, name: rootName || '' }];
  const seen = new Set();
  let folders = 0;
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f.id)) continue; seen.add(f.id);
    const kids = await listChildren(token, f.id, budget);
    for (const c of kids) {
      if (c.mimeType === FOLDER_MIME) {
        folders++;
        if (recurse) queue.push({ id: c.id, name: c.name || '' });
        continue;
      }
      if (files.length >= cap) { budget.truncated = true; continue; }
      files.push({
        id: c.id,
        name: c.name || '',
        stem: stemOf(c.name),
        ext: extOf(c.name),
        mime: c.mimeType || '',
        size: c.size ? Number(c.size) : null,
        modified: c.modifiedTime || '',
        created: c.createdTime || '',
        folder_id: f.id,
        folder_name: f.name || '',
      });
    }
    if (budget.truncated && !recurse) break;
  }
  files.sort((a, b) => String(a.name).localeCompare(String(b.name), 'is'));
  return { files, folders, truncated: budget.truncated };
}

// Býr til NÝTT Google Sheet með einum flipa per `tabs`-hlut. Engin skrá snert.
async function makeSheet(token, title, tabs) {
  const clean = (Array.isArray(tabs) ? tabs : []).filter(t => t && Array.isArray(t.rows));
  if (!clean.length) return { ok: false, error: 'tabs required' };
  const create = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: String(title || 'Skráalisti').slice(0, 120), locale: 'is_IS', timeZone: 'Atlantic/Reykjavik' },
      sheets: clean.map((t, i) => ({ properties: { sheetId: i, title: String(t.title || ('Blað ' + (i + 1))).slice(0, 90) } })),
    }),
  });
  if (!create.ok) return { ok: false, error: 'sheets.create ' + create.status + ': ' + (await create.text()).slice(0, 200) };
  const sheet = await create.json();
  // Gildin skrifuð í einu batchUpdate-kalli (öll blöðin saman).
  const data = clean.map((t, i) => ({
    range: `'${String(t.title || ('Blað ' + (i + 1))).slice(0, 90).replace(/'/g, "''")}'!A1`,
    values: t.rows.map(r => (Array.isArray(r) ? r.map(c => (c == null ? '' : String(c))) : [String(r == null ? '' : r)])),
  })).filter(d => d.values.length);
  if (data.length) {
    const up = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    });
    if (!up.ok) return { ok: false, error: 'values ' + up.status + ': ' + (await up.text()).slice(0, 200), id: sheet.spreadsheetId, url: sheet.spreadsheetUrl };
  }
  // Feitletra fyrstu röð + frysta hana á hverju blaði (snyrtilegt, ekki nauðsyn).
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: clean.flatMap((t, i) => ([
          { repeatCell: { range: { sheetId: i, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
          { updateSheetProperties: { properties: { sheetId: i, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        ])),
      }),
    });
  } catch (_) {}
  return { ok: true, id: sheet.spreadsheetId, url: sheet.spreadsheetUrl };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  if (event.httpMethod === 'POST') {
    let b; try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'bad json' }); }
    if (b.action !== 'sheet') return json(400, { error: "action must be 'sheet'" });
    let token; try { token = await freshAccessToken(); } catch (e) { return json(401, { error: e.message }); }
    try { return json(200, await makeSheet(token, b.title, b.tabs)); }
    catch (e) { return json(200, { ok: false, error: String(e.message || e) }); }
  }

  if (event.httpMethod !== 'GET') return json(405, { error: 'GET (listi) eða POST {action:sheet}' });

  const p = event.queryStringParameters || {};
  const folder = folderId(p.folder);
  if (!folder) return json(400, { error: 'folder required' });
  const recurse = p.recurse === '1' || p.recurse === 'true';
  const cap = Math.min(Math.max(parseInt(p.cap || '5000', 10) || 5000, 1), HARD_CAP);

  let token; try { token = await freshAccessToken(); } catch (e) { return json(401, { error: e.message }); }

  try {
    const name = await folderName(token, folder);
    const { files, folders, truncated } = await walk(token, folder, name, recurse, cap);
    return json(200, { ok: true, folder, folder_name: name, total: files.length, folders, recurse, truncated, files });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
