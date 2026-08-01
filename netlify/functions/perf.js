// perf.js — lifandi frammistöðumæling fyrir þrýstimæla-spjaldið í Jarvis.
//
//   GET /api/perf
//     → { ok, generated_at, targets:[ { key, label, ms, base, ceiling, status, code } ] }
//
// Mælir svartíma nokkurra lykil-endapunkta (og Supabase Data API beint) EINU
// SINNI per kall. `base` = grunnlína mæld 2026-08-01 með luna-bridge SLÖKKT.
// `status`: 'ok' (<= base×1.4) · 'alag' (> base×1.4, komið í álag) · 'nidri'
// (ekki 200 eða timeout). Þrýstimælirinn í HUD-inu les þetta.
//
// ⚠ Þetta fall kallar á N endapunkta → keyrðu það EKKI í þéttri lykkju. HUD-ið
// kallar á það handvirkt eða á 5 mín fresti í mesta lagi.

const SELF = process.env.URL || 'https://brunaholf.netlify.app';
const SUPA_PUB = 'sb_publishable_YVpznM5EK01qOdevQwOcIg_rMjTkT7f';   // opinber (publishable) lykill
const SUPA_URL = 'https://osfdzskyvisifcwyjkuk.supabase.co';

// key, label, slóð, grunnlína(ms) — grunnlínur mældar 2026-08-01, luna-bridge slökkt.
const TARGETS = [
  { key: 'data',    label: 'Supabase Data API', url: SUPA_URL + '/rest/v1/app_settings?select=id&limit=1', apikey: true, base: 200 },
  { key: 'heilsa',  label: 'Kerfisheilsa',       url: SELF + '/api/kerfisheilsa',           base: 650 },
  { key: 'veidin',  label: 'Veiðin',             url: SELF + '/api/veidin',                 base: 700 },
  { key: 'worksites', label: 'Verkstaðir',       url: SELF + '/api/worksites',              base: 3100 },
  { key: 'debtors', label: 'Skuldunautar',       url: SELF + '/api/debtors',                base: 1150 },
  { key: 'krofur',  label: 'Kröfur',             url: SELF + '/api/krofur-yfirlit',         base: 1800 },
  { key: 'dss',     label: 'Gagnalindir',        url: SELF + '/api/data-sources-status',    base: 3100 },
];

async function maela(t) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  let code = 0;
  try {
    const headers = t.apikey ? { apikey: SUPA_PUB } : { accept: 'application/json' };
    const r = await fetch(t.url, { headers, signal: ctrl.signal });
    code = r.status;
    await r.arrayBuffer();                       // lesa til fulls svo tíminn sé raunsannur
  } catch (e) {
    code = 0;                                     // timeout / abort / net
  } finally {
    clearTimeout(to);
  }
  const ms = Date.now() - t0;
  const ceiling = Math.round(t.base * 1.4);
  let status;
  if (code !== 200) status = 'nidri';
  else if (ms > ceiling) status = 'alag';
  else status = 'ok';
  return { key: t.key, label: t.label, ms, base: t.base, ceiling, status, code };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  const targets = await Promise.all(TARGETS.map(maela));
  const alls = targets.length;
  const ok = targets.filter(t => t.status === 'ok').length;
  const alag = targets.filter(t => t.status === 'alag').length;
  const nidri = targets.filter(t => t.status === 'nidri').length;
  return json(200, { ok: true, generated_at: new Date().toISOString(),
    yfirlit: { alls, ok, alag, nidri }, targets });
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type',
           'access-control-allow-methods': 'GET,OPTIONS' };
}
function json(code, obj) {
  return { statusCode: code,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()),
    body: JSON.stringify(obj) };
}
