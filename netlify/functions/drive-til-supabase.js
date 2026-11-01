// drive-til-supabase.js — afritar Drive-skjal yfir í Supabase storage (bucket `samningar`) og tengir
// customer_documents.storage_path, svo skjalið lifi án Google Drive (Factcheck: „skjölin heim á Supabase").
//
//   POST /api/drive-til-supabase  { ids: [customer_documents.id, …], dry?: boolean }   (≤ 5 id í kalli)
//     dry (sjálfgefið TRUE) → les aðeins lýsigögn úr Drive og segir hvað yrði gert; ekkert skrifað.
//     dry:false             → sækir skrána, vistar í storage og skrifar storage_path á RÖÐINA.
//   GET → 405. Ekkert keyrir á GET (sbr. doc-index/reikningar-read sem gera það).
//
// Öryggi:
//   • Drive er AÐEINS lesið — ekkert fært, endurnefnt eða eytt. Afritið bætist við, frumritið stendur.
//   • Röðin er EKKI færð á annan stað: fyrirtaeki_id/customer_base_id/doc_type/year haldast. Aðeins storage_path
//     (+ link_ok/link_status/link_checked_at) breytist. Sé skjal rangt nefnt eða rangt tengt er það því jafn
//     rangt og áður — engin ný ágiskun bætist við (Agnar 01.11: „alltaf möguleiki að skjal beri rangt nafn").
//   • Heiti hlutarins í storage er EKKI dregið af Drive-heitinu (sem getur verið rangt): drive-afrit/<doc_type>/<doc_id>_<drive_file_id>.<ending>.
//     Drive-heitið kemur aðeins í svarinu og í override_log-athugasemdinni.
//   • Röð með storage_path, is_duplicate eða án drive_file_id er sleppt. Hámark 15 MB á skrá.
//   • Google-skjöl (Docs/Sheets) eru flutt út sem PDF; aðrar skrár sóttar óbreyttar (alt=media).
//   • Hver aðgerð skráð í override_log (field 'drive_til_supabase', best-effort).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY + Google OAuth gegnum _google.js (aðaltenging, svo hinir tengdu reikningar).

const { freshAccessToken, freshAccessTokenFor, listConnectedAccounts, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'samningar';
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_IDS = 5;
const NATIVE = 'application/vnd.google-apps.';

const EXT_BY_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/tiff': 'tif',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt', 'text/csv': 'csv',
};

const sbH = (extra) => Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {});

// Hrein föll (prófuð í test/drive-til-supabase.test.js).
function slug(s) { return String(s || 'annad').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'annad'; }
function endingFor(mime, name) {
  if (String(mime || '').startsWith(NATIVE)) return 'pdf';
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  const m = String(name || '').match(/\.([A-Za-z0-9]{1,5})$/);
  return m ? m[1].toLowerCase() : 'bin';
}
function objectPath(docType, docId, fileId, mime, name) {
  const safeId = String(fileId || '').replace(/[^A-Za-z0-9_-]/g, '');
  return `drive-afrit/${slug(docType)}/${Number(docId)}_${safeId}.${endingFor(mime, name)}`;
}

async function sbJson(path, opts) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, Object.assign({}, opts, { headers: sbH(Object.assign({ 'Content-Type': 'application/json' }, (opts || {}).headers)) }));
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

// Allir tengdir Google-reikningar (aðaltenging fyrst) — skrá getur legið á öðrum reikningi en þeim fyrsta.
async function allTokens() {
  const out = [];
  try { out.push({ email: 'adal', token: await freshAccessToken() }); } catch (_) {}
  try {
    for (const a of await listConnectedAccounts()) {
      try { out.push({ email: a.user_email, token: await freshAccessTokenFor(a.user_email) }); } catch (_) {}
    }
  } catch (_) {}
  const seen = new Set();
  return out.filter(t => t.token && !seen.has(t.token) && seen.add(t.token));
}

async function driveMeta(tokens, id) {
  for (const t of tokens) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,trashed&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${t.token}` } });
    if (r.ok) return { meta: await r.json(), token: t.token, account: t.email };
  }
  return null;
}

async function driveBytes(token, meta) {
  const native = String(meta.mimeType || '').startsWith(NATIVE);
  const url = native
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}/export?mimeType=application%2Fpdf`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}?alt=media&supportsAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive niðurhal ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return { buf: Buffer.from(await r.arrayBuffer()), mime: native ? 'application/pdf' : (meta.mimeType || 'application/octet-stream') };
}

async function upload(path, buf, mime) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST', headers: sbH({ 'Content-Type': mime, 'x-upsert': 'false' }), body: buf,
  });
  if (r.ok) return 'uploaded';
  const txt = await r.text();
  if (r.status === 409 || /already exists|Duplicate/i.test(txt)) return 'exists';
  throw new Error(`Storage ${r.status}: ${txt.slice(0, 160)}`);
}

async function eitt(tokens, id, dry) {
  const rows = await sbJson(`customer_documents?id=eq.${Number(id)}&select=id,doc_type,year,fyrirtaeki_id,drive_file_id,storage_path,is_duplicate&limit=1`);
  const row = rows && rows[0];
  if (!row) return { id, status: 'engin_rod' };
  if (row.is_duplicate) return { id, status: 'sleppt_tvitak' };
  if (String(row.storage_path || '').trim()) return { id, status: 'sleppt_thegar_a_supabase', storage_path: row.storage_path };
  if (!String(row.drive_file_id || '').trim()) return { id, status: 'sleppt_enginn_drive_hlekkur' };

  const found = await driveMeta(tokens, row.drive_file_id);
  if (!found) return { id, status: 'drive_finnst_ekki', drive_file_id: row.drive_file_id };
  const { meta, token, account } = found;
  if (meta.trashed) return { id, status: 'drive_i_rusli', drive_nafn: meta.name };
  const size = Number(meta.size || 0);
  if (size > MAX_BYTES) return { id, status: 'of_stor', bytes: size, drive_nafn: meta.name };

  const path = objectPath(row.doc_type, row.id, meta.id, meta.mimeType, meta.name);
  const base = { id, drive_nafn: meta.name, mime: meta.mimeType, bytes: size || null, reikningur: account, fyrirtaeki_id: row.fyrirtaeki_id, year: row.year, hlutur: `${BUCKET}/${path}` };
  if (dry) return Object.assign(base, { status: 'dry_yrdi_afritad' });

  const { buf, mime } = await driveBytes(token, meta);
  if (!buf.length) throw new Error('Drive skilaði 0 bætum');
  if (buf.length > MAX_BYTES) return Object.assign(base, { status: 'of_stor', bytes: buf.length });
  const up = await upload(path, buf, mime);
  await sbJson(`customer_documents?id=eq.${row.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ storage_path: `${BUCKET}/${path}`, link_ok: true, link_status: '200', link_checked_at: new Date().toISOString() }),
  });
  try {
    await sbJson('override_log', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ field: 'drive_til_supabase', old_value: row.drive_file_id, new_value: `${BUCKET}/${path}`, page: 'drive-til-supabase', co_id: row.fyrirtaeki_id || null, resolved: true, note: `Afrit úr Drive (nafn í Drive: ${String(meta.name || '').slice(0, 120)}) — röðin ekki færð` }),
    });
  } catch (_) { /* rekjanleiki best-effort */ }
  return Object.assign(base, { status: up === 'exists' ? 'tengt_hlutur_var_til' : 'afritad', bytes: buf.length });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only — ekkert keyrir á GET' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Invalid JSON' }); }
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
  if (!ids.length) return json(400, { error: 'ids (listi af customer_documents.id) vantar' });
  if (ids.length > MAX_IDS) return json(400, { error: `í mesta lagi ${MAX_IDS} id í kalli` });
  const dry = b.dry !== false;
  const tokens = await allTokens();
  if (!tokens.length) return json(500, { error: 'Enginn Google-reikningur tengdur' });
  const results = [];
  for (const id of ids) {
    try { results.push(await eitt(tokens, id, dry)); }
    catch (e) { results.push({ id, status: 'villa', villa: String((e && e.message) || e).slice(0, 240) }); }
  }
  return json(200, { ok: true, dry, results });
};

exports._test = { slug, endingFor, objectPath };
