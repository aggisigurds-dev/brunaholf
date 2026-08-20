// reikningar-sheet.js — write the parsed invoice rows into a Google Sheet that
// lives INSIDE the Reikningar folder, so the sheet doubles as a sortable
// database summary of every sent invoice.
//   POST /api/reikningar-sheet  body { folder, rows:[{company,kt,invoice_number,
//        date,total,year,base_name,file,fileId}], title? }
// Find-or-create one stable sheet ("Reikningar – gagnayfirlit") in the folder
// and overwrite its contents (so re-running keeps ONE living summary, not many).
// Returns { ok, id, url, rows, created }.

const { freshAccessToken, json, cors } = require('./_google');

const DEFAULT_FOLDER = '1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p';
const SHEET_TITLE = 'Reikningar – gagnayfirlit';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const folder = (body.folder || DEFAULT_FOLDER).trim();
  const title = (body.title || SHEET_TITLE).trim();
  const inRows = Array.isArray(body.rows) ? body.rows : [];

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    // Sort by company, then date — the readable order for a summary.
    const rows = inRows.slice().sort((a, b) =>
      (a.company || '').localeCompare(b.company || '', 'is') ||
      String(a.date || '').localeCompare(String(b.date || '')));

    const header = ['Fyrirtæki', 'Heimilisfang', 'Kennitala', 'Tegund', 'Reikningsnúmer', 'Dagsetning', 'Heildarupphæð', 'Ár', 'Viðskiptavinur (grunnur)', 'Skráarnafn', 'Tengill'];
    const values = [header].concat(rows.map(r => [
      r.company || '', r.address || '', r.kt || '',
      r.kredit ? 'Kreditreikningur' : 'Reikningur', r.invoice_number || '',
      r.date ? fmtDate(r.date) : '',
      (r.total != null && r.total !== '') ? Number(r.total) : '',
      r.year || (r.date ? r.date.slice(0, 4) : ''),
      r.base_name || (r.base_id ? '#' + r.base_id : ''),
      r.file || '',
      r.fileId ? 'https://brunaholf.netlify.app/api/skjal?id=' + r.fileId : '',
    ]));

    // 1. find-or-create the one stable summary sheet in the folder
    let id = await findSheet(folder, title, token);
    let created = false;
    if (!id) {
      const cr = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { title, timeZone: 'Atlantic/Reykjavik' } }),
      });
      if (!cr.ok) return json(cr.status, { error: 'create: ' + (await cr.text()).slice(0, 300) });
      id = (await cr.json()).spreadsheetId;
      created = true;
      await moveIntoFolder(id, folder, token);
    } else {
      // clear old contents so a shrunk dataset doesn't leave stale rows behind
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1:Z100000:clear`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
      }).catch(() => {});
    }

    // 2. write the values
    const wr = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    if (!wr.ok) return json(wr.status, { error: 'write: ' + (await wr.text()).slice(0, 300) });

    // 3. bold + freeze header, basic filter
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [
        { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
        { setBasicFilter: { filter: { range: { sheetId: 0 } } } },
      ] }),
    }).catch(() => {});

    const url = 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
    return json(200, { ok: true, id, url, rows: rows.length, created, folder });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function findSheet(folder, title, token) {
  const params = new URLSearchParams({
    q: `'${folder.replace(/'/g, "\\'")}' in parents and name='${title.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id,name)', pageSize: '5',
    includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
  });
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.files && d.files[0]) ? d.files[0].id : null;
}
async function moveIntoFolder(id, folder, token) {
  try {
    const meta = await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=parents&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const prev = (meta.parents || []).join(',');
    const q = new URLSearchParams({ addParents: folder, supportsAllDrives: 'true', fields: 'id,parents' });
    if (prev) q.set('removeParents', prev);
    await fetch(`https://www.googleapis.com/drive/v3/files/${id}?${q}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
  } catch (e) { /* still usable even if move fails */ }
}
function fmtDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || '');
}
