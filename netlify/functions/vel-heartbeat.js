// vel-heartbeat.js — LÍFSMARK FRÁ TÖLVUNUM.
//
//   POST /api/vel-heartbeat   { vel, hostname, os, notendanafn, repos[], verkfaeri[], verk[], athugasemd }
//        → upsert á `vel_heartbeat` (lykill = vel). Kallað af heartbeat.js á hverri vél.
//   GET  /api/vel-heartbeat   → allar vélar + aldur síðasta lífsmarks + staða.
//
// AF HVERJU (2026-07-31, Agnar): „lendi í því mörgum sinnum á dag að vera búinn
// að hamast í einhverju, síðan kemur í ljós að tengingin sé farin" — og „veit
// ekkert hvar repo-ið er í neinum af tölvunum". Vélarnar sögðu hvergi frá sér;
// eina merkið um að ein væri dottin út var að gögn hættu að berast. Núna segir
// hver vél sjálf: hver hún er, hvað hún keyrir, hvar repo-in liggja og hvenær
// hún sást síðast.
//
// ÖRYGGI: taflan er RLS-varin og aðeins service role (þetta fall) kemst í hana
// — vélanöfn og skráaslóðir fara aldrei í gegnum anon-lykilinn. POST krefst
// `VEL_HEARTBEAT_TOKEN` (env) þegar hann er settur; annars er hann opinn svo
// hægt sé að koma fyrstu vélinni inn, og fallið segir frá því í svarinu.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.VEL_HEARTBEAT_TOKEN || '';

// Þröskuldar: vél telst í lagi ef hún sást innan 90 mín (lífsmark á 30 mín
// fresti gefur tvö tækifæri til að klikka áður en hún verður gul).
const OK_MIN = 90, GAMALT_MIN = 60 * 24;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const rows = await sb('vel_heartbeat?select=*&order=at.desc');
    const now = Date.now();
    const velar = (rows || []).map(r => {
      const min = r.at ? Math.round((now - new Date(r.at).getTime()) / 60000) : null;
      return Object.assign({}, r, {
        aldur_min: min,
        status: min == null ? 'graat' : min <= OK_MIN ? 'graent' : min <= GAMALT_MIN ? 'gult' : 'raudt',
      });
    });
    return json(200, { ok: true, token_required: !!TOKEN, velar });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if (TOKEN) {
    const gefinn = (event.headers['x-vel-token'] || event.headers['X-Vel-Token'] || '').trim();
    if (gefinn !== TOKEN) return json(401, { error: 'Rangur eða enginn X-Vel-Token' });
  }

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Ógilt JSON' }); }
  const vel = String(b.vel || b.hostname || '').trim();
  if (!vel) return json(400, { error: 'vel/hostname vantar' });

  const row = {
    vel,
    hostname: b.hostname || null,
    os: b.os || null,
    notendanafn: b.notendanafn || null,
    repos: Array.isArray(b.repos) ? b.repos : [],
    verkfaeri: Array.isArray(b.verkfaeri) ? b.verkfaeri : [],
    verk: Array.isArray(b.verk) ? b.verk : [],
    athugasemd: b.athugasemd || null,
    at: new Date().toISOString(),
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/vel_heartbeat?on_conflict=vel`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) return json(500, { error: 'Upsert féll: ' + (await r.text()).slice(0, 200) });
  return json(200, { ok: true, vel, at: row.at, token_required: !!TOKEN });
};

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json().catch(() => []) : [];
}
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-vel-token',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
}
function resp(code, body, headers) { return { statusCode: code, headers: headers || {}, body }; }
function json(code, obj) {
  return resp(code, JSON.stringify(obj), Object.assign(
    { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()));
}
