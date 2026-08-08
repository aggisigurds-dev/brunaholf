// eydublod.js — vistuð eyðublöð (Eyðublöð-síðan, /eydublod.html) + útgáfusaga.
//
// Vistar PDF-inn sem vafrinn bjó til (jsPDF, vektor) í Supabase Storage og
// skráir röð í `eydublod_skjol` MEÐ reitagildunum (`gogn`). Gögnin eru
// uppspretta sannleikans: þess vegna er hægt að opna skjal aftur, breyta því
// og vista sem NÝJA útgáfu — gamli PDF-inn stendur óhreyfður (hann er
// mögulega þegar farinn til verkkaupa).
//
//   GET  /api/eydublod                → { ok, docs:[…] }  (nýjast fyrst)
//        ?form_id=…                   → sía á eyðublaðategund
//        ?skjal_id=…                  → allar útgáfur eins skjals
//        ?all=1                       → allar útgáfur (annars nýjasta per skjal)
//
//   POST /api/eydublod
//     { action:'save', form_id, titill, stadur, dagsetning, gogn,
//       fileName, contentBase64, skjal_id? }
//        skjal_id vantar  → nýtt skjal, útgáfa 1
//        skjal_id gefið   → næsta útgáfa á sama skjali
//        → 200 { ok, id, skjal_id, utgafa, public_url }
//
//     { action:'delete', id }         → eyðir EINNI útgáfu (röð + storage-hlut)
//
// Sami þjónustulyklastíll og `pdf-store.js`: service role, engin Google-innskráning,
// public fata svo hlekkurinn opnist beint hjá verkkaupa.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'eydublod';
const TABLE = 'eydublod_skjol';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'GET') return await list(event.queryStringParameters || {});
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return json(400, { error: 'Invalid JSON' }); }

      if (body.action === 'delete') return await del(body);
      if (body.action === 'confirm') return await confirm_(body);
      return await save(body);                       // sjálfgefið: vista
    }
    return json(405, { error: 'GET eða POST' });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

/* ── Listi ────────────────────────────────────────────────────────────── */
async function list(q) {
  const params = new URLSearchParams({
    select: 'id,skjal_id,utgafa,form_id,titill,stadur,dagsetning,gogn,skra_nafn,storage_path,public_url,created_at,created_by',
    order: 'created_at.desc',
  });
  if (q.form_id) params.set('form_id', 'eq.' + q.form_id);
  if (q.skjal_id) params.set('skjal_id', 'eq.' + q.skjal_id);

  const rows = await sbAll(`${SUPABASE_URL}/rest/v1/${TABLE}?${params}`);

  // Sjálfgefið skilar listinn NÝJUSTU útgáfu hvers skjals (?all=1 skilar öllum).
  let docs = rows;
  if (!q.all && !q.skjal_id) {
    const best = new Map();
    for (const r of rows) {
      const cur = best.get(r.skjal_id);
      if (!cur || (r.utgafa || 0) > (cur.utgafa || 0)) best.set(r.skjal_id, r);
    }
    docs = [...best.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  return json(200, { ok: true, docs });
}

/* ── Vistun (ný útgáfa) ───────────────────────────────────────────────── */
async function save(body) {
  const form_id = String(body.form_id || '').trim();
  const b64 = String(body.contentBase64 || '');
  if (!form_id) return json(400, { error: 'form_id vantar' });
  if (!b64) return json(400, { error: 'contentBase64 vantar' });

  const pdfBuf = Buffer.from(b64, 'base64');
  if (!pdfBuf.length) return json(400, { error: 'contentBase64 varð að 0 bætum' });

  // Ný útgáfa á sama skjali ef skjal_id fylgir, annars nýtt skjal.
  let skjal_id = String(body.skjal_id || '').trim();
  let utgafa = 1;
  if (skjal_id) {
    const prev = await sbAll(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=utgafa&skjal_id=eq.${encodeURIComponent(skjal_id)}` +
      `&order=utgafa.desc&limit=1`);
    utgafa = (prev[0] && prev[0].utgafa ? prev[0].utgafa : 0) + 1;
  } else {
    skjal_id = randomUuid();
  }

  const slug = String(body.stadur || body.titill || form_id)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .toLowerCase().slice(0, 48) || 'skjal';

  // Hver útgáfa fær sinn eigin hlut — ekkert skrifast yfir.
  const storage_path = `${form_id}/${slug}-${skjal_id.slice(0, 8)}-v${utgafa}.pdf`;

  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(storage_path)}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
      'Cache-Control': 'max-age=31536000',
    },
    body: pdfBuf,
  });
  if (!up.ok) return json(up.status, { error: `Storage upload ${up.status}: ${(await up.text()).slice(0, 300)}` });

  const public_url =
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(storage_path)}?v=${Date.now()}`;

  const row = {
    skjal_id, utgafa, form_id,
    titill: str(body.titill),
    stadur: str(body.stadur),
    dagsetning: body.dagsetning || null,
    gogn: body.gogn && typeof body.gogn === 'object' ? body.gogn : {},
    skra_nafn: str(body.fileName),
    storage_path, public_url,
    created_by: str(body.created_by),
  };

  const rec = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!rec.ok) {
    // Skráning brást en PDF-inn er kominn upp — skilum slóðinni svo hann tapist ekki.
    return json(502, { error: `DB ${rec.status}: ${(await rec.text()).slice(0, 300)}`, public_url, storage_path });
  }
  const saved = (await rec.json())[0] || {};
  return json(200, { ok: true, ...saved, skjal_id, utgafa, public_url });
}

/* ── Staðfesting (patch gogn, engin ný útgáfa) ────────────────────────── */
async function confirm_(body) {
  const id = String(body.id || '').trim();
  if (!id) return json(400, { error: 'id vantar' });
  const by = String(body.by || '').slice(0, 100);
  const at = new Date().toISOString();
  const rows = await sbAll(
    `${SUPABASE_URL}/rest/v1/${TABLE}?select=gogn&id=eq.${encodeURIComponent(id)}`);
  if (!rows[0]) return json(404, { error: 'Skjal fannst ekki' });
  const gogn = Object.assign({}, rows[0].gogn || {},
    { _stadfest: true, _stadfest_at: at, _stadfest_by: by });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ gogn }),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  return json(200, { ok: true, id, stadfest_at: at });
}

/* ── Eyðing (ein útgáfa) ──────────────────────────────────────────────── */
async function del(body) {
  const id = String(body.id || '').trim();
  if (!id) return json(400, { error: 'id vantar' });

  const rows = await sbAll(
    `${SUPABASE_URL}/rest/v1/${TABLE}?select=id,storage_path&id=eq.${encodeURIComponent(id)}`);
  const row = rows[0];
  if (!row) return json(404, { error: 'Skjal fannst ekki' });

  if (row.storage_path) {
    // Skráin má vera farin nú þegar — það á ekki að stoppa eyðingu raðarinnar.
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(row.storage_path)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    }).catch(() => {});
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  return json(200, { ok: true, id });
}

/* ── Hjálparföll ──────────────────────────────────────────────────────── */
// Supabase skilar mest 1000 röðum í einu — sækjum allt með Range-síðuskiptingu.
async function sbAll(url) {
  const out = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + step - 1}`,
      },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < step) break;
  }
  return out;
}

const str = v => (v == null ? null : String(v).slice(0, 500));

function randomUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return require('crypto').randomUUID();
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
