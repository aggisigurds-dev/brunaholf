// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js.
//
// ÓÐINN — reglubókin í Jarvis (16.11.2026). Það sem má aldrei bila í /api/odin:
//   1. enginn les né skrifar án starfsmanna-session;
//   2. heimildin „sjálfur" fæst ALDREI héðan fyrir reglu sem undirbýr póst, kröfur eða reikninga, né fyrir reglu
//      sem er ákvörðun Agnars — starfsmanna-lykilorðið er sameiginlegt og ber ekki nafn;
//   3. skrif koma aðeins frá sama vef;
//   4. tveir rangir dómar færa reglu sjálfkrafa aftur í „leggja til";
//   5. svarið segir það sem STENDUR í grunninum eftir skrifin.
// Gögnin eru tilbúin (engin raunveruleg nöfn eða upphæðir).
//
// Keyrsla: node --test test/odin.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://x.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
process.env.HUB_STAFF_PASSWORD = 'prufulykilord-odin';   // starfsmannahliðið VIRKT í þessu prófi

const P = require('../netlify/functions/_portal');
const { handler, _maVerdaSjalfur } = require('../netlify/functions/odin');

let REGLUR, URSK, LOG, SKRIF;
function nyGogn() {
  REGLUR = [
    { id: 1, heiti: 'Leyst skv. gögnum', flokkur: 'samthykki', urskurdur: 'loka_med_sonnun', heimild: 'leggja_til', virk: true, rett: 0, rangt: 0 },
    { id: 2, heiti: 'Póstur til kúnna', flokkur: 'samthykki', urskurdur: 'undirbua_afgreidslu', heimild: 'leggja_til', virk: true, rett: 0, rangt: 0 },
    { id: 3, heiti: 'Þjónustustaða', flokkur: 'samthykki', urskurdur: 'til_agnars', heimild: 'leggja_til', virk: true, rett: 0, rangt: 0 },
    { id: 4, heiti: 'Tillaga úr fordæmum', flokkur: 'samthykki', urskurdur: 'loka_med_sonnun', heimild: 'leggja_til', virk: false, rett: 0, rangt: 0 },
    { id: 5, heiti: 'Sjálfvirk regla', flokkur: 'vordur', urskurdur: 'senda_agent', heimild: 'sjalfur', virk: true, rett: 0, rangt: 1 },
  ];
  URSK = [{ id: 10, created_at: new Date().toISOString(), tegund: 'samthykki', regla_id: 5, urskurdur: 'senda_agent', gert: true, rokstudningur: 'x', domur: null, afturkallad_at: null }];
  LOG = []; SKRIF = [];
}
const sia = (rows, u) => { const m = /^eq\.(.+)$/.exec(u.searchParams.get('id') || ''); return m ? rows.filter((r) => String(r.id) === m[1]) : rows; };
global.fetch = async (url, opts = {}) => {
  const u = new URL(url), tafla = u.pathname.split('/').pop(), m = String(opts.method || 'GET').toUpperCase();
  const svar = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  if (tafla === 'agent_logs') { LOG.push(JSON.parse(opts.body)); return svar([{}], 201); }
  const rows = tafla === 'odin_reglur' ? REGLUR : tafla === 'odin_urskurdir' ? URSK : null;
  if (!rows) return svar({ message: 'óþekkt tafla ' + tafla }, 404);
  if (m === 'GET') return svar(sia(rows, u).map((r) => Object.assign({}, r)));
  if (m === 'PATCH') { const b = JSON.parse(opts.body); SKRIF.push({ tafla, id: u.searchParams.get('id'), b }); sia(rows, u).forEach((r) => Object.assign(r, b)); return svar(sia(rows, u)); }
  return svar({ message: 'óvænt aðferð ' + m }, 405);
};

const kaka = () => ({ cookie: P.STAFF_COOKIE + '=' + P.signStaff() });
const kall = (method, body, hausar) => handler({ httpMethod: method, headers: Object.assign({ origin: 'https://brunaholf.netlify.app' }, hausar || {}), body: body ? JSON.stringify(body) : null, queryStringParameters: {} });
const lesa = async (r) => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') });

test('án starfsmanna-session: hvorki lestur né skrif', async () => {
  nyGogn();
  assert.equal((await kall('GET', null, {})).statusCode, 401);
  assert.equal((await kall('POST', { action: 'heimild', id: 1, heimild: 'sjalfur' }, {})).statusCode, 401);
  assert.equal(SKRIF.length, 0);
  assert.equal(REGLUR[0].heimild, 'leggja_til');
});

test('lestur: reglur, tölur og hvort regla má verða „sjálfur"', async () => {
  nyGogn();
  const r = await lesa(await kall('GET', null, kaka()));
  assert.equal(r.status, 200);
  assert.equal(r.json.reglur.length, 5);
  assert.deepEqual({ virkar: r.json.tolur.virkar, sjalfur: r.json.tolur.sjalfur, leggja_til: r.json.tolur.leggja_til, tillogur: r.json.tolur.tillogur }, { virkar: 4, sjalfur: 1, leggja_til: 3, tillogur: 1 });
  const ma = Object.fromEntries(r.json.reglur.map((x) => [x.id, x.ma_verda_sjalfur]));
  assert.deepEqual(ma, { 1: true, 2: false, 3: false, 4: true, 5: true });
  assert.equal(r.json.tolur.odaemt, 1);
});

test('heimildin „sjálfur": veitt fyrir innri, afturkræfa reglu', async () => {
  nyGogn();
  const r = await lesa(await kall('POST', { action: 'heimild', id: 1, heimild: 'sjalfur' }, kaka()));
  assert.equal(r.status, 200);
  assert.equal(r.json.regla.heimild, 'sjalfur');
  assert.equal(REGLUR[0].heimild, 'sjalfur');
  assert.equal(LOG.filter((l) => l.agent === 'odin' && l.action === 'odin_heimild').length, 1, 'skrifin eru skráð í agent_logs');
});

test('heimildin „sjálfur": ALDREI fyrir póst og peninga, né fyrir ákvörðun Agnars', async () => {
  nyGogn();
  for (const id of [2, 3]) {
    const r = await lesa(await kall('POST', { action: 'heimild', id, heimild: 'sjalfur' }, kaka()));
    assert.equal(r.status, 403, 'regla ' + id);
    assert.match(r.json.error, /orðum í lotu/);
  }
  assert.equal(REGLUR[1].heimild, 'leggja_til');
  assert.equal(REGLUR[2].heimild, 'leggja_til');
  assert.equal(SKRIF.length, 0, 'ekkert var skrifað');
  assert.equal(_maVerdaSjalfur({ urskurdur: 'undirbua_afgreidslu' }), false);
  assert.equal(_maVerdaSjalfur({ urskurdur: 'til_agnars' }), false);
  assert.equal(_maVerdaSjalfur(null), false);
});

test('tillaga staðfest verður virk án þess að fá heimild; óvirkjuð regla missir heimildina', async () => {
  nyGogn();
  let r = await lesa(await kall('POST', { action: 'stadfesta', id: 4 }, kaka()));
  assert.equal(r.status, 200);
  assert.equal(REGLUR[3].virk, true);
  assert.equal(REGLUR[3].heimild, 'leggja_til', 'staðfesting veitir ekki heimild');
  r = await lesa(await kall('POST', { action: 'ovirkja', id: 5 }, kaka()));
  assert.equal(REGLUR[4].virk, false);
  assert.equal(REGLUR[4].heimild, 'leggja_til', 'óvirk regla ber aldrei heimildina sjálfur');
});

test('skrif frá öðrum vef er hafnað þótt session sé gilt', async () => {
  nyGogn();
  const r = await kall('POST', { action: 'heimild', id: 1, heimild: 'sjalfur' }, Object.assign(kaka(), { origin: 'https://annar-vefur.example' }));
  assert.equal(r.statusCode, 403);
  assert.equal(SKRIF.length, 0);
});

test('dómur: rangt í annað sinn færir reglu aftur í „leggja til"', async () => {
  nyGogn();   // regla 5 er sjalfur með rangt = 1
  const r = await lesa(await kall('POST', { action: 'domur', id: 10, domur: 'rangt', athugasemd: 'Þetta átti að fara til mín' }, kaka()));
  assert.equal(r.status, 200);
  assert.equal(r.json.aftur_i_leggja_til, true);
  assert.equal(REGLUR[4].rangt, 2);
  assert.equal(REGLUR[4].heimild, 'leggja_til');
  assert.equal(URSK[0].domur, 'rangt');
  assert.equal(URSK[0].domur_athugasemd, 'Þetta átti að fara til mín');
});

test('dómur: rétt hækkar teljarann og heldur heimildinni; sami dómur aftur telur ekki tvisvar', async () => {
  nyGogn();
  await kall('POST', { action: 'domur', id: 10, domur: 'rett' }, kaka());
  assert.equal(REGLUR[4].rett, 1);
  assert.equal(REGLUR[4].heimild, 'sjalfur');
  await kall('POST', { action: 'domur', id: 10, domur: 'rett' }, kaka());
  assert.equal(REGLUR[4].rett, 1, 'endurtekinn dómur telur ekki aftur');
});

test('ógild beiðni: óþekkt aðgerð, id vantar, regla ekki til', async () => {
  nyGogn();
  assert.equal((await kall('POST', { action: 'eyda', id: 1 }, kaka())).statusCode, 400);
  assert.equal((await kall('POST', { action: 'stadfesta' }, kaka())).statusCode, 400);
  assert.equal((await kall('POST', { action: 'stadfesta', id: 999 }, kaka())).statusCode, 404);
  assert.equal((await kall('POST', { action: 'domur', id: 10, domur: 'kannski' }, kaka())).statusCode, 400);
});
