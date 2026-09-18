// drive-files-search.js — leit í Google Drive eftir nafni (og innihaldi), valfrjálst innan möppu.
// GET /api/drive-files-search?q=Efnislisti+Fjarðagata
//   → { files: [{id, name, mime, modified, web_link, parents, folder_name}] }
//
// 18.09.2026 (Agnar: „leitargluggi sem leitar í Google Drive … í ákveðnu folderi"):
//   &folder=<möppu-ID eða heil drive.google.com/…/folders/<id> slóð>  → leitar AÐEINS þar
//   &deep=1      → líka í öllum undirmöppum (gengið niður tréð, mest 400 möppur)
//   &content=1   → leitar líka í INNIHALDI skjala (Drive fullText), ekki bara heiti
//   &folders=1   → möppur mega koma í niðurstöðum
// Án folder hagar fallið sér eins og áður (Vinnubókar-viðhengjaleitin notar það þannig).

const { freshAccessToken, json, cors } = require('./_google');

const FOLDER = 'application/vnd.google-apps.folder';
const MAX_FOLDERS = 400;

const folderId = (s) => {
  const t = String(s || '').trim();
  const m = t.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || t.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : '';
};

async function drive(token, params) {
  const url = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
    includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives', ...params,
  });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { const e = new Error(`Drive API ${r.status}`); e.status = r.status; e.body = (await r.text()).slice(0, 500); throw e; }
  return r.json();
}

// Allar undirmöppur (breidd fyrst). Skilar Map id → nafn, rótin meðtalin.
async function allFolders(token, rootId, rootName) {
  const names = new Map([[rootId, rootName || '']]);
  let layer = [rootId];
  while (layer.length && names.size < MAX_FOLDERS) {
    const next = [];
    for (let i = 0; i < layer.length && names.size < MAX_FOLDERS; i += 25) {
      const part = layer.slice(i, i + 25);
      let pageToken;
      do {
        const d = await drive(token, {
          q: `(${part.map((id) => `'${id}' in parents`).join(' or ')}) and mimeType = '${FOLDER}' and trashed=false`,
          fields: 'files(id,name),nextPageToken', pageSize: '200', ...(pageToken ? { pageToken } : {}),
        });
        for (const f of (d.files || [])) if (!names.has(f.id)) { names.set(f.id, f.name); next.push(f.id); }
        pageToken = d.nextPageToken;
      } while (pageToken && names.size < MAX_FOLDERS);
    }
    layer = next;
  }
  return names;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const q = (p.q || '').trim();
  const fid = folderId(p.folder);
  if (p.folder && !fid) return json(400, { error: 'Skil ekki möppuna — límdu slóðina úr Drive (…/folders/<id>) eða ID-ið.' });
  if (!q && !fid) return json(400, { error: 'q (search query) required' });
  const limit = Math.min(parseInt(p.limit || '25', 10) || 25, 200);
  const deep = p.deep === '1' || p.deep === 'true';
  const content = p.content === '1' || p.content === 'true';
  const withFolders = p.folders === '1' || p.folders === 'true';

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    const safe = q.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const match = !q ? '' : (content ? `(name contains '${safe}' or fullText contains '${safe}')` : `name contains '${safe}'`);
    const base = [match, withFolders ? '' : `mimeType != '${FOLDER}'`, 'trashed=false'].filter(Boolean).join(' and ');
    const fields = 'files(id,name,mimeType,modifiedTime,webViewLink,parents,size),nextPageToken';

    let files = [], folderNames = new Map(), folderMeta = null, truncated = false;
    if (!fid) {
      // fullText-leit leyfir ekki orderBy (Drive raðar þá eftir vægi)
      const d = await drive(token, { q: base, fields, pageSize: String(limit), ...(content ? {} : { orderBy: 'modifiedTime desc' }) });
      files = d.files || [];
    } else {
      // heiti rótarmöppunnar (og aðgangspróf um leið — 404 ef tengdi Google-reikningurinn sér hana ekki)
      const mr = await fetch(`https://www.googleapis.com/drive/v3/files/${fid}?fields=id,name,mimeType&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
      if (!mr.ok) return json(mr.status === 404 ? 404 : mr.status, { error: mr.status === 404 ? 'Mappan finnst ekki eða tengdi Google-reikningurinn hefur ekki aðgang að henni.' : `Drive API ${mr.status}` });
      folderMeta = await mr.json();
      folderNames = deep ? await allFolders(token, fid, folderMeta.name) : new Map([[fid, folderMeta.name]]);
      truncated = folderNames.size >= MAX_FOLDERS;
      const ids = [...folderNames.keys()];
      for (let i = 0; i < ids.length && files.length < limit; i += 25) {
        const part = ids.slice(i, i + 25);
        const d = await drive(token, {
          q: `(${part.map((id) => `'${id}' in parents`).join(' or ')}) and ${base}`,
          fields, pageSize: String(Math.min(200, limit)),
        });
        files.push(...(d.files || []));
      }
      files.sort((a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')));
      files = files.slice(0, limit);
    }

    return json(200, {
      q, folder: folderMeta ? { id: folderMeta.id, name: folderMeta.name } : null,
      deep, content, folders_searched: folderNames.size || null, truncated,
      files: files.map((f) => ({
        id: f.id, name: f.name, mime: f.mimeType, modified: f.modifiedTime, web_link: f.webViewLink,
        parents: f.parents || [], size: f.size != null ? Number(f.size) : null,
        is_folder: f.mimeType === FOLDER,
        folder_name: (f.parents || []).map((id) => folderNames.get(id)).find(Boolean) || null,
      })),
    });
  } catch (e) {
    return json(e.status || 502, { error: e.message, body: e.body });
  }
};
