// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js.
//
// ÓÐINN — reglubókin í Jarvis (16.11.2026). Það sem má aldrei bila í /api/odin:
//   1. enginn les né skrifar án INNSKRÁNINGAR (hub_user-kakan) — líka þegar HUB_STAFF_PASSWORD er ekki sett, eins og
//      í loftinu. Fyrsta útgáfan treysti á P.requireStaff, sem hleypir öllu í gegn þar, og stóð opin í nokkrar mínútur;
//   2. aðeins STJÓRNANDI skrifar; innskráður starfsmaður les;
//   3. vanti innskráningarkerfið sjálft er svarað 503 — aldrei hleypt í gegn;
//   4. heimildin „sjálfur" fæst ALDREI héðan fyrir reglu sem undirbýr póst, kröfur eða reikninga, né fyrir reglu
//      sem er ákvörðun Agnars;
//   5. skrif koma aðeins frá sama vef — og skrif án Origin-hauss er hafnað;
//   6. tveir rangir dómar færa reglu sjálfkrafa aftur í „leggja til";
//   7. svarið segir það sem STENDUR í grunninum eftir skrifin.
// Gögnin eru tilbúin (engin raunveruleg nöfn eða upphæðir).
//
// Keyrsla: node --test test/odin.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.SUPABASE_URL = 'https://x.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
delete process.env.HUB_STAFF_PASSWORD;   // eins og í loftinu: starfsmannahliðið ÓVIRKT — fallið verður samt að vera lokað

const { handler, _maVerdaSjalfur } = require('../netlify/functions/odin');

const LEYND = 'prufuleyndarmal-odin-0123456789';
const PW_BREYTT = '2026-11-01T00:00:00+00:00';
let REGLUR, URSK, LOG, SKRIF, STILLING, NOTENDUR;
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
  STILLING = [{ session_secret: LEYND, pw_changed_at: PW_BREYTT }];
  NOTENDUR = [
    { id: 1, nafn: 'Prufa Stjóri', notandanafn: 'stjori', rola: 'Admin', virkur: true },
    { id: 2, nafn: 'Prufa Starfsmaður', notandanafn: 'starfs', rola: 'Starfsmaður', virkur: true },
    { id: 3, nafn: 'Prufa Hættur', notandanafn: 'haettur', rola: 'Admin', virkur: false },
  ];
}
const sia = (rows, u) => { const m = /^eq\.(.+)$/.exec(u.searchParams.get('id') || ''); return m ? rows.filter((r) => String(r.id) === m[1]) : rows; };
global.fetch = async (url, opts = {}) => {
  const u = new URL(url), tafla = u.pathname.split('/').pop(), m = String(opts.method || 'GET').toUpperCase();
  const svar = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  if (tafla === 'agent_logs') { LOG.push(JSON.parse(opts.body)); return svar([{}], 201); }
  if (tafla === 'hub_adgangar_stilling') return STILLING === 'bilad' ? svar({ message: 'niðri' }, 500) : svar(STILLING);
  if (tafla === 'hub_adgangar') return svar(sia(NOTENDUR, u));
  const rows = tafla === 'odin_reglur' ? REGLUR : tafla === 'odin_urskurdir' ? URSK : null;
  if (!rows) return svar({ message: 'óþekkt tafla ' + tafla }, 404);
  if (m === 'GET') return svar(sia(rows, u).map((r) => Object.assign({}, r)));
  if (m === 'PATCH') { const b = JSON.parse(opts.body); SKRIF.push({ tafla, id: u.searchParams.get('id'), b }); sia(rows, u).forEach((r) => Object.assign(r, b)); return svar(sia(rows, u)); }
  return svar({ message: 'óvænt aðferð ' + m }, 405);
};

// Innskráningarkaka eins og hub-login gefur hana út: base64url(JSON) + '.' + base64url(HMAC-SHA256).
function toki(uid, o) {
  o = o || {};
  const gogn = Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + (o.exp == null ? 3600 : o.exp), v: o.v == null ? PW_BREYTT : o.v })).toString('base64url');
  const undir = crypto.createHmac('sha256', o.leynd || LEYND).update(gogn).digest('base64url');
  return gogn + '.' + undir;
}
const kaka = (uid, o) => ({ cookie: 'annad=1; hub_user=' + encodeURIComponent(toki(uid == null ? 1 : uid, o)) });
const stjori = () => kaka(1);
const kall = (method, body, hausar) => handler({ httpMethod: method, headers: Object.assign({ origin: 'https://brunaholf.netlify.app' }, hausar || {}), body: body ? JSON.stringify(body) : null, queryStringParameters: {} });
const lesa = async (r) => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') });

test('án innskráningar: hvorki lestur né skrif — þótt starfsmannahliðið sé óvirkt', async () => {
  nyGogn();
  assert.equal(process.env.HUB_STAFF_PASSWORD, undefined, 'prófið líkir eftir loftinu');
  assert.equal((await kall('GET', null, {})).statusCode, 401);
  assert.equal((await kall('POST', { action: 'heimild', id: 1, heimild: 'sjalfur' }, {})).statusCode, 401);
  assert.equal(SKRIF.length, 0);
  assert.equal(REGLUR[0].heimild, 'leggja_til');
});

test('ógild innskráning: fölsuð undirskrift, útrunnin, gamalt lykilorð, óvirkur notandi, rusl', async () => {
  nyGogn();
  const tilraunir = {
    'fölsuð undirskrift': kaka(1, { leynd: 'annad-leyndarmal' }),
    'útrunnin': kaka(1, { exp: -60 }),
    'lykilorði breytt síðan': kaka(1, { v: '2026-01-01T00:00:00+00:00' }),
    'óvirkur notandi': kaka(3),
    'notandi ekki til': kaka(999),
    'rusl': { cookie: 'hub_user=' + 'a'.repeat(40) },
    'engin undirskrift': { cookie: 'hub_user=' + encodeURIComponent(toki(1).split('.')[0] + '.') },
  };
  for (const [nafn, h] of Object.entries(tilraunir)) {
    assert.equal((await kall('GET', null, h)).statusCode, 401, nafn + ' · lestur');
    assert.equal((await kall('POST', { action: 'heimild', id: 1, heimild: 'sjalfur' }, h)).statusCode, 401, nafn + ' · skrif');
  }
  assert.equal(SKRIF.length, 0);
});

test('innskráningarkerfið ekki sett upp eða niðri: lokað (503 / 502), aldrei hleypt í gegn', async () => {
  nyGogn();
  STILLING = [];
  assert.equal((await kall('GET', null, stjori())).statusCode, 503);
  assert.equal((await kall('POST', { action: 'stadfesta', id: 4 }, stjori())).statusCode, 503);
  STILLING = [{ session_secret: null, pw_changed_at: PW_BREYTT }];
  assert.equal((await kall('GET', null, stjori())).statusCode, 503);
  STILLING = 'bilad';
  assert.equal((await kall('GET', null, stjori())).statusCode, 502);
  assert.equal(SKRIF.length, 0);
});

test('innskráður starfsmaður les en skrifar ekki — aðeins stjórnandi breytir reglubókinni', async () => {
  nyGogn();
  assert.equal((await kall('GET', null, kaka(2))).statusCode, 200);
  for (const b of [{ action: 'heimild', id: 1, heimild: 'sjalfur' }, { action: 'stadfesta', id: 4 }, { action: 'ovirkja', id: 5 }, { action: 'domur', id: 10, domur: 'rett' }]) {
    assert.equal((await kall('POST', b, kaka(2))).statusCode, 403, b.action);
  }
  assert.equal(SKRIF.length, 0);
  assert.equal(REGLUR[0].heimild, 'leggja_til');
  assert.equal(REGLUR[3].virk, false);
});

test('lestur: reglur, tölur og hvort regla má verða „sjálfur"', async () => {
  nyGogn();
  const r = await lesa(await kall('GET', null, stjori()));
  assert.equal(r.status, 200);
  assert.equal(r.json.reglur.length, 5);
  assert.deepEqual({ virkar: r.json.tolur.virkar, sjalfur: r.json.tolur.sjalfur, leggja_til: r.json.tolur.leggja_til, tillogur: r.json.tolur.tillogur }, { virkar: 4, sjalfur: 1, leggja_til: 3, tillogur: 1 });
  const ma = Object.fromEntries(r.json.reglur.map((x) => [x.id, x.ma_verda_sjalfur]));
  assert.deepEqual(ma, { 1: true, 2: false, 3: false, 4: true, 5: true });
  assert.equal(r.json.tolur.odaemt, 1);
});

test('heimildin „sjálfur": veitt fyrir innri, afturkræfa reglu — og skráð á nafn stjórnandans', async () => {
  nyGogn();
  const r = await lesa(await kall('POST', { action: 'heimild', id: 1, heimild: 'sjalfur', by_who: 'einhver annar' }, stjori()));
  assert.equal(r.status, 200);
  assert.equal(r.json.regla.heimild, 'sjalfur');
  assert.equal(REGLUR[0].heimild, 'sjalfur');
  const skrad = LOG.filter((l) => l.agent === 'odin' && l.action === 'odin_heimild');
  assert.equal(skrad.length, 1, 'skrifin eru skráð í agent_logs');
  assert.match(skrad[0].by_who, /^Prufa · jarvis$/, 'nafnið kemur úr innskráningunni, ekki úr beiðninni');
});

test('heimildin „sjálfur": ALDREI fyrir póst og peninga, né fyrir ákvörðun Agnars', async () => {
  nyGogn();
  for (const id of [2, 3]) {
    const r = await lesa(await kall('POST', { action: 'heimild', id, heimild: 'sjalfur' }, stjori()));
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
  let r = await lesa(await kall('POST', { action: 'stadfesta', id: 4 }, stjori()));
  assert.equal(r.status, 200);
  assert.equal(REGLUR[3].virk, true);
  assert.equal(REGLUR[3].heimild, 'leggja_til', 'staðfesting veitir ekki heimild');
  r = await lesa(await kall('POST', { action: 'ovirkja', id: 5 }, stjori()));
  assert.equal(REGLUR[4].virk, false);
  assert.equal(REGLUR[4].heimild, 'leggja_til', 'óvirk regla ber aldrei heimildina sjálfur');
});

test('skrif frá öðrum vef, eða án Origin-hauss, er hafnað þótt innskráning sé gild', async () => {
  nyGogn();
  const b = { action: 'heimild', id: 1, heimild: 'sjalfur' };
  assert.equal((await kall('POST', b, Object.assign(stjori(), { origin: 'https://annar-vefur.example' }))).statusCode, 403);
  assert.equal((await kall('POST', b, Object.assign(stjori(), { origin: 'https://brunaholf.netlify.app.annar.example' }))).statusCode, 403);
  const anOrigin = await handler({ httpMethod: 'POST', headers: stjori(), body: JSON.stringify(b), queryStringParameters: {} });
  assert.equal(anOrigin.statusCode, 403, 'skrif án Origin-hauss');
  assert.equal(SKRIF.length, 0);
});

test('dómur: rangt í annað sinn færir reglu aftur í „leggja til"', async () => {
  nyGogn();   // regla 5 er sjalfur með rangt = 1
  const r = await lesa(await kall('POST', { action: 'domur', id: 10, domur: 'rangt', athugasemd: 'Þetta átti að fara til mín' }, stjori()));
  assert.equal(r.status, 200);
  assert.equal(r.json.aftur_i_leggja_til, true);
  assert.equal(REGLUR[4].rangt, 2);
  assert.equal(REGLUR[4].heimild, 'leggja_til');
  assert.equal(URSK[0].domur, 'rangt');
  assert.equal(URSK[0].domur_athugasemd, 'Þetta átti að fara til mín');
});

test('dómur: rétt hækkar teljarann og heldur heimildinni; sami dómur aftur telur ekki tvisvar', async () => {
  nyGogn();
  await kall('POST', { action: 'domur', id: 10, domur: 'rett' }, stjori());
  assert.equal(REGLUR[4].rett, 1);
  assert.equal(REGLUR[4].heimild, 'sjalfur');
  await kall('POST', { action: 'domur', id: 10, domur: 'rett' }, stjori());
  assert.equal(REGLUR[4].rett, 1, 'endurtekinn dómur telur ekki aftur');
});

test('ógild beiðni: óþekkt aðgerð, id vantar, regla ekki til', async () => {
  nyGogn();
  assert.equal((await kall('POST', { action: 'eyda', id: 1 }, stjori())).statusCode, 400);
  assert.equal((await kall('POST', { action: 'stadfesta' }, stjori())).statusCode, 400);
  assert.equal((await kall('POST', { action: 'stadfesta', id: 999 }, stjori())).statusCode, 404);
  assert.equal((await kall('POST', { action: 'domur', id: 10, domur: 'kannski' }, stjori())).statusCode, 400);
});
