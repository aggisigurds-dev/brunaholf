// vel-skipun.js — SKIPANA-HÓLFIÐ. Þú ýtir á takka í símanum, vélin keyrir.
//
//   POST {action:'senda', vel, uppskrift, beidandi?}  → setja í röð (af borðinu)
//   GET  ?vel=<vél>&taka=1                            → vélin sækir næstu skipun
//   POST {action:'skila', id, utkoma, exit_code}      → vélin skilar úttakinu
//   GET                                               → síðustu skipanir (borðið)
//   GET  ?uppskriftir=1                               → listinn sem má keyra
//
// AF HVERJU (2026-07-31, Agnar: „I hate working in PowerShell — somehow save me
// from that"). Vélarnar senda þegar lífsmark á 30 mín fresti. Hér er því snúið
// við: í sömu ferð spyr vélin „nokkuð fyrir mig?" og fær uppskrift til baka.
// Þú sérð aldrei skipunina — bara „✓ Búið" og úttakið.
//
// ÖRYGGIS-SAMNINGURINN, í þremur liðum:
//   1. UPPSKRIFTIR ERU FASTAR Í ÞESSARI SKRÁ. Hólfið tekur EKKI við frjálsum
//      texta — aðeins auðkenni úr listanum hér að neðan. Þótt einhver kæmist í
//      gagnagrunninn gæti hann ekki búið til nýja skipun, aðeins raðað þeim sem
//      eru þegar samþykktar. Þetta er munurinn á verkfæri og bakdyrum.
//   2. HVER KEYRSLA ER SKRÁÐ — hver bað, hvenær, hvað kom út, hvaða exit-kóði.
//   3. HÓLFIÐ ER LÆST með `VEL_HEARTBEAT_TOKEN` þegar hann er settur (sami og
//      lífsmarkið notar). Án hans kemst vélin ekki í röðina.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.VEL_HEARTBEAT_TOKEN || '';

// ─────────────────────────────────────────────────────────────────────────
// UPPSKRIFTIRNAR. Bæta við hér — ALDREI úr vafra eða gagnagrunni.
// `skel` segir vélinni hvernig á að keyra; `cmd` er nákvæmlega það sem keyrt er.
// `mappa` er valfrjáls: 'repo' = mappa heartbeat.js (luna-bridge).
// ─────────────────────────────────────────────────────────────────────────
const UPPSKRIFTIR = [
  { id: 'staða', heiti: '📋 Staða vélarinnar', lysing: 'Hvaða greinar, hvað er óvistað, hvað er laust pláss.',
    skel: 'auto', cmd: 'STADA' },
  { id: 'git-pull', heiti: '⬇️ Sækja nýjasta kóðann', lysing: 'git pull í öllum repo-um sem vélin þekkir.',
    skel: 'auto', cmd: 'GIT_PULL' },
  { id: 'bru', heiti: '📧 Keyra póst-brúna', lysing: 'Les Thunderbird-möppurnar og sendir í email_digest.',
    skel: 'node', cmd: 'bridge.js', mappa: 'repo' },
  { id: 'timavera', heiti: '🕒 Keyra Tímaveru-innsog', lysing: 'Les nýjustu vinnufærslu-skrána úr Downloads.',
    skel: 'node', cmd: 'timavera-bridge.js', mappa: 'repo' },
  { id: 'ajour', heiti: '🏗 Keyra Ajour-innsog', lysing: 'Les nýjustu AjourRegistrationData*.csv úr Downloads.',
    skel: 'py', cmd: 'ajour-ingest.py', mappa: 'repo' },
  { id: 'lifsmark', heiti: '💓 Senda lífsmark núna', lysing: 'Uppfærir stöðuna á borðinu strax.',
    skel: 'node', cmd: 'heartbeat.js', mappa: 'repo' },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const p = event.queryStringParameters || {};

  try {
    if (event.httpMethod === 'GET') {
      if (p.uppskriftir === '1') {
        return json(200, { ok: true, uppskriftir: UPPSKRIFTIR.map(u => ({ id: u.id, heiti: u.heiti, lysing: u.lysing })) });
      }
      if (p.taka === '1') return await taka(event, p);
      const rows = await sbGet('vel_skipanir?select=*&order=created_at.desc&limit=' + Math.min(60, +p.limit || 25));
      return json(200, { ok: true, skipanir: (rows || []).map(skreyta) });
    }

    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Ógilt JSON' }); }
      if (b.action === 'senda') return await senda(b);
      if (b.action === 'skila') return await skila(event, b);
      return json(400, { error: 'Óþekkt action' });
    }
    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

/* Setja skipun í röð — AÐEINS uppskrift sem er til í listanum hér að ofan. */
async function senda(b) {
  const vel = String(b.vel || '').trim();
  const u = UPPSKRIFTIR.find(x => x.id === b.uppskrift);
  if (!vel) return json(400, { error: 'vel vantar' });
  if (!u) return json(400, { error: 'Óþekkt uppskrift — aðeins fastar uppskriftir eru leyfðar' });

  // Ekki hlaða sömu skipun tvisvar í röðina á sömu vél.
  const bid = await sbGet(`vel_skipanir?select=id&vel=eq.${encodeURIComponent(vel)}` +
    `&uppskrift=eq.${encodeURIComponent(u.id)}&stada=in.(bid,sott)&limit=1`);
  if (bid && bid.length) return json(200, { ok: true, thegar_i_rod: true, id: bid[0].id });

  const r = await sbPost('vel_skipanir', {
    vel, uppskrift: u.id, stada: 'bid', beidandi: b.beidandi ? String(b.beidandi).slice(0, 60) : null,
  });
  if (!r.ok) return json(500, { error: 'Vistun féll' });
  const [ny] = await r.json();
  return json(200, { ok: true, id: ny.id, heiti: u.heiti });
}

/* Vélin sækir næstu skipun. Skilar HREINU verkefni — vélin þarf ekki að vita
   neitt um hólfið, bara hvað á að keyra. */
async function taka(event, p) {
  const vantar = tokenVantar(event);
  if (vantar) return vantar;
  const vel = String(p.vel || '').trim();
  if (!vel) return json(400, { error: 'vel vantar' });

  const rows = await sbGet(`vel_skipanir?select=*&vel=eq.${encodeURIComponent(vel)}` +
    '&stada=eq.bid&order=created_at.asc&limit=1');
  const s = rows && rows[0];
  if (!s) return json(200, { ok: true, skipun: null });

  await sbPatch(`vel_skipanir?id=eq.${s.id}`, { stada: 'sott', sott_at: new Date().toISOString() });
  const u = UPPSKRIFTIR.find(x => x.id === s.uppskrift);
  if (!u) {
    await sbPatch(`vel_skipanir?id=eq.${s.id}`, { stada: 'villa', utkoma: 'Uppskrift ekki lengur til', lokid_at: new Date().toISOString() });
    return json(200, { ok: true, skipun: null });
  }
  return json(200, { ok: true, skipun: { id: s.id, uppskrift: u.id, heiti: u.heiti, skel: u.skel, cmd: u.cmd, mappa: u.mappa || null } });
}

/* Vélin skilar úttakinu. Geymt stytt — logg eiga ekki að fylla gagnagrunninn. */
async function skila(event, b) {
  const vantar = tokenVantar(event);
  if (vantar) return vantar;
  if (!b.id) return json(400, { error: 'id vantar' });
  const kode = Number.isFinite(b.exit_code) ? b.exit_code : null;
  await sbPatch(`vel_skipanir?id=eq.${+b.id}`, {
    stada: kode === 0 ? 'lokid' : 'villa',
    utkoma: String(b.utkoma || '').slice(-4000),   // SÍÐUSTU línurnar — þar er niðurstaðan
    exit_code: kode, lokid_at: new Date().toISOString(),
  });
  return json(200, { ok: true });
}

function skreyta(r) {
  const u = UPPSKRIFTIR.find(x => x.id === r.uppskrift);
  return Object.assign({}, r, { heiti: u ? u.heiti : r.uppskrift });
}
function tokenVantar(event) {
  if (!TOKEN) return null;
  const h = event.headers || {};
  const g = (h['x-vel-token'] || h['X-Vel-Token'] || '').trim();
  return g === TOKEN ? null : json(401, { error: 'Rangt eða ekkert X-Vel-Token' });
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json().catch(() => []) : [];
}
function sbPost(table, row) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json', prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
}
function sbPatch(path, row) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(row),
  });
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
