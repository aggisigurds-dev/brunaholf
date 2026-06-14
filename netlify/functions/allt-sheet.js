// allt-sheet.js — build a sortable "whole database" Google Sheet from the
// úttektarskýrslu filenames in a Drive folder (default: the "Allt" folder).
//   GET /api/allt-sheet[?folder=ID][&title=...]
// Lists every file, parses "Fyrirtæki - Heimilisfang - Kennitala - Mánuður - Ár"
// out of the name, creates a Google Sheet IN that same folder, and returns its url.
const { freshAccessToken, json, cors } = require('./_google');

const DEFAULT_FOLDER = '11Gf4yUeR6tQ2HcFxWk-50IFQl2xBUQOg';
const MONTHS = { 'janúar':1,'jan':1,'febrúar':2,'feb':2,'mars':3,'mar':3,'apríl':4,'apr':4,'maí':5,'mai':5,
  'júní':6,'jún':6,'jun':6,'júlí':7,'júl':7,'jul':7,'ágúst':8,'ágú':8,'agust':8,
  'september':9,'sep':9,'sept':9,'október':10,'okt':10,'nóvember':11,'nóv':11,'nov':11,'desember':12,'des':12 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const title = (p.title || ('Úttektarskýrslur — yfirlit (' + new Date().toISOString().slice(0,10) + ')')).trim();

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    const files = await listFiles(folder, token);
    const rows = files.map(f => parseName(f.name, f.id));
    rows.sort((a,b) => (a[0]||'').toLowerCase() < (b[0]||'').toLowerCase() ? -1 :
                       (a[0]||'').toLowerCase() > (b[0]||'').toLowerCase() ? 1 :
                       (a[3]||'') < (b[3]||'') ? -1 : (a[3]||'') > (b[3]||'') ? 1 :
                       (a[4]||99) - (b[4]||99));
    const header = ['Fyrirtæki','Heimilisfang','Kennitala','Ár','Mán.nr','Mánuður','Skráarnafn','Tengill'];
    const values = [header].concat(rows);

    // 1. create spreadsheet
    const cr = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { title, timeZone: 'Atlantic/Reykjavik' } }),
    });
    if (!cr.ok) return json(cr.status, { error: 'create: ' + (await cr.text()).slice(0,300) });
    const sheet = await cr.json();
    const id = sheet.spreadsheetId;

    // 2. write values
    const wr = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Sheet1!A1?valueInputOption=RAW`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    if (!wr.ok) return json(wr.status, { error: 'write: ' + (await wr.text()).slice(0,300) });

    // 3. bold + freeze header
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [
        { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
        { setBasicFilter: { filter: { range: { sheetId: 0 } } } },
      ] }),
    }).catch(()=>{});

    // 4. move into the source folder
    try {
      const meta = await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=parents&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })).json();
      const prev = (meta.parents || []).join(',');
      const q = new URLSearchParams({ addParents: folder, supportsAllDrives: 'true', fields: 'id,parents' });
      if (prev) q.set('removeParents', prev);
      await fetch(`https://www.googleapis.com/drive/v3/files/${id}?${q}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    } catch (e) { /* still usable even if move fails */ }

    return json(200, { ok: true, id, url: sheet.spreadsheetUrl, rows: rows.length, folder });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function listFiles(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name),nextPageToken', pageSize: '1000',
      includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('list ' + r.status + ' ' + (await r.text()).slice(0,200));
    const d = await r.json();
    for (const f of (d.files || [])) out.push(f);
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}

function fmtKt(s){ const d = String(s||'').replace(/\D/g,''); return d.length>=10 ? d.slice(0,6)+'-'+d.slice(6,10) : d; }
function parseName(name, id){
  const nm = String(name||'').trim();
  const base = nm.replace(/\.pdf$/i,'');
  const parts = base.split(' - ').map(s => s.trim());
  const ktExact = /^\d{6}-?\d{4}$/;
  let kti = parts.findIndex(p => ktExact.test(p));
  let company='', address='', kt='', tail=[];
  if (kti >= 0) {
    kt = fmtKt(parts[kti]); tail = parts.slice(kti+1);
    if (kti === 0) { company=''; address=''; }
    else if (kti === 1) { company=parts[0]; address=''; }
    else { company = parts.slice(0, kti-1).join(' - '); address = parts[kti-1]; }
  } else {
    const m = base.match(/\b(\d{6})-?(\d{4})\b/); kt = m ? fmtKt(m[0]) : '';
    company = parts[0]||''; address = parts[1]||''; tail = parts.slice(2);
  }
  const ys = base.match(/\b(20[12]\d)\b/g); const year = ys ? ys[ys.length-1] : '';
  let mon='', monnum='';
  for (const p of tail.concat(parts)) { const k = p.toLowerCase().replace(/\.$/,''); if (MONTHS[k]) { mon=p; monnum=MONTHS[k]; break; } }
  return [company, address, kt, year, monnum, mon, nm, 'https://drive.google.com/file/d/'+id+'/view'];
}
