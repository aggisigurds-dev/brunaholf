// nlsh-stada.js — NLSH: uppsöfnuð Done-staða per verkliður í lok mánaðar.
//
//   GET /api/nlsh-stada?til=2026-08          (sjálfgefið: síðasti heili mánuður)
//     → { month, fra, til_exclusive,
//         lines:[{verk_nr, label, groups:[ajour-flokkar], stakar_alls, stakar_manudur, heilar_alls, ekki_done}],
//         unmapped:[{category_group, stakar_alls, stakar_manudur, ekki_done}],
//         totals:{stakar_alls, stakar_manudur, heilar_alls, unmapped_alls}, ekki_done }
//
// Agnar 02.09.2026: „þarf eiginlega bara total stöðuna í lok mánaðar af hvað er
// búið mikið af hverri tegund og setja það inní töfluna sem reiknar rest."
// Samningsblaðið (Google Sheet) reiknar heildir, verð og mánaðarmun SJÁLFT —
// þetta fall skilar aðeins talningunni sem límd er inn: stakir SerialNumber
// með registration_status = Done, kláraðir (checked_date, annars
// execution_date) FYRIR fyrsta dag næsta mánaðar. Sama uppspretta og
// nlsh-uppgjor.js og VERK-taflan þaðan (einn staður fyrir kortlagninguna).
// Talningin sjálf er í SQL-fallinu nlsh_stada: count(distinct) er ekki til í
// PostgREST og safnið er of stórt til að síða í gegnum innan 10 s.
//
// Tölurnar stemma EKKI upp á stak við blaðið: ~510 skráningar eru hálfkláraðar
// eða ekki merktar Done (ekki_done). Það er vitað og í lagi (Agnar 02.09.2026).

const { VERK, NLSH_NAMES } = require('./nlsh-uppgjor.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const qs = event.queryStringParameters || {};
  const month = String(qs.til || '').trim() || sidastiManudur();
  if (!/^\d{4}-\d{2}$/.test(month)) return json(400, { error: 'til verður að vera YYYY-MM' });
  const [y, m] = month.split('-').map(Number);
  const fra = `${month}-01`;
  const til = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);   // fyrsti dagur næsta mánaðar

  let groups;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nlsh_stada`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_names: NLSH_NAMES, p_fra: fra, p_til: til }),
    });
    if (!r.ok) throw new Error(`nlsh_stada: ${r.status} ${(await r.text()).slice(0, 200)}`);
    groups = await r.json();
  } catch (e) { return json(502, { error: e.message }); }

  // Línurnar í VERK-röð (= röð samningsblaðsins) — alltaf allar 15, líka tómar,
  // svo afritaði dálkurinn sé jafnlangur og blaðið.
  const lines = VERK.map(v => ({ verk_nr: v.verk_nr, label: v.label, full: !!v.full,
    groups: [], stakar_alls: 0, stakar_manudur: 0, heilar_alls: 0, ekki_done: 0 }));
  const unmapped = [];
  let ekkiDone = 0;
  for (const g of groups) {
    const alls = Number(g.stakar_alls) || 0, man = Number(g.stakar_manudur) || 0, ed = Number(g.ekki_done) || 0;
    ekkiDone += ed;
    const i = VERK.findIndex(v => v.test.test(g.category_group));
    if (i < 0) { if (alls || man || ed) unmapped.push({ category_group: g.category_group, stakar_alls: alls, stakar_manudur: man, ekki_done: ed }); continue; }
    lines[i].groups.push(g.category_group);
    lines[i].stakar_alls += alls; lines[i].stakar_manudur += man; lines[i].ekki_done += ed;
  }
  // Sama heildar-regla og nlsh-uppgjor.js (blaðið reiknar sínar eigin heildir —
  // þetta er aðeins til viðmiðunar á skjánum).
  for (const L of lines) L.heilar_alls = L.full ? L.stakar_alls : L.stakar_alls / 2;

  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
  return json(200, {
    month, fra, til_exclusive: til, lines, unmapped,
    totals: { stakar_alls: sum(lines, 'stakar_alls'), stakar_manudur: sum(lines, 'stakar_manudur'),
      heilar_alls: sum(lines, 'heilar_alls'), unmapped_alls: sum(unmapped, 'stakar_alls') },
    ekki_done: ekkiDone,
  });
};

function sidastiManudur() {
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}
function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
