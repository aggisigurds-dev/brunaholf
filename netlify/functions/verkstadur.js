// verkstadur.js — mynd, heimilisfang, húsupplýsingar og teikningar per verkstað (tafla verkstadur_info).
//
// 02.11.2026 (Agnar, Kröfu yfirlit: „vanti mynd þarna af heimilisfanginu og að það sé hægt að sjá betri
// upplýsingar og teikningar af verkstaðnum eins og á slökkvitæki company profiles").
//
//   GET  /api/verkstadur?all=1   → { rows:[{ worksite_name, heimilisfang, mynd_url, mynd_texti, hus, … }] }  (án teikningalista)
//   GET  /api/verkstadur?ws=NAFN → { row }  (með teikningalista)
//   POST /api/verkstadur { action:'vista', ws, heimilisfang, heimilisfang_heimild, hus, teikningar,
//                          mynd:{ b64, type, heimild, texti } | null, by }
//        → myndin fer í public bucket `verkstadir`, röðin upsertast. mynd:null = reynt, engin mynd fannst.
//
// Vafrinn sækir sjálfur úr Slökkvitækja-föllunum (hus-upplysingar + husmynd, CORS *) og sendir hingað til
// geymslu — svo engin keðja ytri kalla lendir á 10 s þaki fallsins. Sótt aðeins við raunverulegan smell.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'verkstadir';
const LISTI = 'worksite_name,heimilisfang,heimilisfang_heimild,mynd_url,mynd_heimild,mynd_texti,hus,updated_at,updated_by';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    if (q.ws) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?worksite_name=eq.${encodeURIComponent(q.ws)}&select=*`, { headers: H });
      if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
      return json(200, { row: (await r.json())[0] || null });
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?select=${LISTI}&order=worksite_name`, { headers: { ...H, Range: '0-999' } });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { rows: await r.json() });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  if (b.action !== 'vista') return json(400, { error: 'action vantar' });
  const ws = String(b.ws || '').trim();
  if (!ws) return json(400, { error: 'ws vantar' });

  const rod = {
    worksite_name: ws,
    heimilisfang: String(b.heimilisfang || '').trim() || null,
    heimilisfang_heimild: b.heimilisfang_heimild || null,
    hus: b.hus || null,
    teikningar: Array.isArray(b.teikningar) ? b.teikningar.slice(0, 60) : null,
    updated_at: new Date().toISOString(),
    updated_by: String(b.by || '').slice(0, 60) || null,
  };
  const m = b.mynd;
  if (m && m.b64) {
    const tegund = /^image\/(jpeg|png|webp)$/.test(m.type || '') ? m.type : 'image/jpeg';
    const bytes = Buffer.from(String(m.b64), 'base64');
    if (bytes.length < 2000 || bytes.length > 4e6) return json(400, { error: 'mynd of lítil eða of stór' });
    const slod = `${slug(ws)}-${Date.now()}.${tegund === 'image/png' ? 'png' : tegund === 'image/webp' ? 'webp' : 'jpg'}`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${slod}`, {
      method: 'POST', headers: { ...H, 'Content-Type': tegund, 'x-upsert': 'true', 'Cache-Control': '31536000' }, body: bytes,
    });
    if (!up.ok) return json(up.status, { error: 'geymsla: ' + (await up.text()).slice(0, 200) });
    rod.mynd_url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${slod}`;
    rod.mynd_heimild = String(m.heimild || '').slice(0, 40) || null;
    rod.mynd_texti = String(m.texti || '').slice(0, 120) || null;
  } else if (m === null) {
    // Reynt og engin mynd fannst — gamla myndin (ef einhver) víkur ekki nema heimilisfangið hafi breyst.
    rod.mynd_heimild = 'engin';
    if (b.nytt_heimilisfang) { rod.mynd_url = null; rod.mynd_texti = null; }
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?on_conflict=worksite_name`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rod),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  return json(200, { ok: true, row: (await r.json())[0] || null });
};

function slug(s) {
  return String(s).toLowerCase().replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ö/g, 'o')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'verkstadur';
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
