// payday-reikningur-vista.js — speglar Payday-reikning (PDF) inn í okkar kerfi og FESTIR hann
// á efnislistann: ný `efnislisti_documents` röð `doc_type='payday_reikningur'` á sama
// (verkstaður, mánuður) og efnislistinn. Þá haldast efnislisti + reikningur saman og hverfa
// aldrei — líka þegar röðin dettur úr Kröfu yfirliti (sést áfram í „Fyrri reikningar" verkstaðar).
//
//   POST /api/payday-reikningur-vista  body { tilvisun | uuid, worksite_name, work_month, force? }
//     → 200 { ok, public_url, storage_path, title, tilvisun, skipped? }
//
// Agnar 25.11.2026: „downloada reikningum inn í kerfið til baka og festast á gamla efnislistann"
// + „sjálfkrafa við pörun". Bakgrunns-speglunin (payday-reikningur-spegla-background) kallar á
// `vista()` hér fyrir hvert parað verk. LES AÐEINS úr Payday. Skrifar aðeins í OKKAR Storage +
// efnislisti_documents (afturkræft: DELETE /api/efnislisti-docs {drive_file_id}). Breytir engu í
// Payday, sölum, drögum né kröfum.

const pdf = require('./payday-invoice-pdf.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'efnislisti-pdf';
const DOC_TYPE = 'payday_reikningur';
const sbH = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 48) || 'verkstadur';

async function finnaVistad(worksite_name, work_month) {
  const u = `${SUPABASE_URL}/rest/v1/efnislisti_documents?select=*&worksite_name=eq.${encodeURIComponent(worksite_name)}&work_month=eq.${encodeURIComponent(work_month)}&doc_type=eq.${DOC_TYPE}&limit=1`;
  const r = await fetch(u, { headers: sbH });
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

// Kjarninn — notað af bakgrunns-speglinum OG HTTP-endapunktinum.
// Hugfast (idempotent): ein `payday_reikningur` röð per (verkstaður, mánuður), fast storage-stígur
// svo endur-keyrsla skrifar yfir sama hlut (CDN cache-buster ?v= svo nýtt PDF birtist strax).
async function vista({ tilvisun, uuid, worksite_name, work_month, force } = {}) {
  worksite_name = String(worksite_name || '').trim();
  work_month = String(work_month || '').trim();
  if (!worksite_name || !/^\d{4}-\d{2}$/.test(work_month)) return { ok: false, error: 'worksite_name + work_month (YYYY-MM) vantar' };
  if (!tilvisun && !uuid) return { ok: false, error: 'tilvisun eða uuid vantar' };

  if (!force) {
    const til = await finnaVistad(worksite_name, work_month);
    if (til && (til.public_url || til.drive_file_id)) {
      return { ok: true, skipped: true, public_url: til.public_url || null, storage_path: til.storage_path || null, title: til.title || null, tilvisun: String(tilvisun || '') };
    }
  }

  const { buf, tilvisun: tv } = await pdf.saekjaPdfBuffer({ tilvisun, uuid });
  const ref = String(tv || tilvisun || uuid).replace(/^R-?/i, '');
  const storage_path = `${slugify(worksite_name)}/${work_month}/payday-reikningur.pdf`;

  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encPath(storage_path)}`, {
    method: 'POST',
    headers: { ...sbH, 'Content-Type': 'application/pdf', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
    body: buf,
  });
  if (!up.ok) return { ok: false, error: `Storage upload ${up.status}: ${(await up.text()).slice(0, 200)}` };

  const public_url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encPath(storage_path)}?v=${Date.now()}`;
  const title = `Payday reikningur R-${ref}`;
  const payload = { worksite_name, work_month, drive_file_id: 'sb:' + storage_path, title, doc_type: DOC_TYPE, storage_path, public_url };
  const rec = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?on_conflict=worksite_name,work_month,drive_file_id`, {
    method: 'POST',
    headers: { ...sbH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });
  const recErr = rec.ok ? null : (await rec.text()).slice(0, 200);
  return { ok: true, public_url, storage_path, title, tilvisun: 'R-' + ref, recErr };
}
exports.vista = vista;

const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' });
const json = (s, p) => ({ statusCode: s, headers: { 'content-type': 'application/json; charset=utf-8', ...cors() }, body: JSON.stringify(p) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  try {
    const out = await vista(body);
    return json(out.ok ? 200 : 400, out);
  } catch (e) {
    if (e && e.code === 'ekki_til') return json(404, { error: e.message, via: e.via });
    if (e && (e.code === 'payday' || e.code === 'ekki_pdf')) return json(502, { error: e.message, uuid: e.uuid });
    return json(500, { error: String((e && e.message) || e) });
  }
};

// ── Vörður (Powerplan lota 13, 17.11.2026): innskráning (hub_user) eða tóki (x-hub-toki / _hubtoki) — sjá _vord.js ──
{ const _V = require('./_vord'); exports._innra = exports.handler; exports.handler = _V.vafinn(exports.handler, { fall: 'payday-reikningur-vista' }); }
