// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js.
//
// VIÐSKIPTAVINIR — það sem má aldrei bila í /api/verkkaupar eftir 16.11.2026:
//   1. samningsviðræðurnar (GET ?samningar=1 og skrif samningur/punktur) krefjast INNSKRÁNINGAR (hub_user-kakan) — líka
//      þegar HUB_STAFF_PASSWORD er ekki sett, eins og í loftinu. Fyrsta útgáfan treysti á P.requireStaff, sem hleypir öllu
//      í gegn þar (charlize 2475), og stóð opin hverjum sem kunni slóðina;
//   2. meginmál pósta (body_preview), viðtakendur og viðhengi fylgja AÐEINS innskráðum notanda — annars aðeins útdrátturinn;
//   3. vanti innskráningarkerfið sjálft er svarað 503, grunnur niðri 502 — aldrei hleypt í gegn;
//   4. innskráður notandi kemst að öllu þessu.
// Gögnin eru tilbúin (engin raunveruleg nöfn, netföng eða upphæðir).
//
// Keyrsla: node --test test/verkkaupar-laest.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.SUPABASE_URL = 'https://x.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
delete process.env.HUB_STAFF_PASSWORD;   // eins og í loftinu: starfsmannahliðið ÓVIRKT — fallið verður samt að vera lokað

const { handler } = require('../netlify/functions/verkkaupar');

const LEYND = 'prufuleyndarmal-verkkaupar-0123456789';
const PW_BREYTT = '2026-11-01T00:00:00+00:00';
let STILLING, NOTENDUR, SKRIF, PRUFA_SLOD;
function nyGogn() {
  STILLING = [{ session_secret: LEYND, pw_changed_at: PW_BREYTT }];
  NOTENDUR = [
    { id: 1, nafn: 'Prufa Stjóri', notandanafn: 'stjori', rola: 'Admin', virkur: true },
    { id: 3, nafn: 'Prufa Hættur', notandanafn: 'haettur', rola: 'Admin', virkur: false },
  ];
  SKRIF = []; PRUFA_SLOD = [];
}
const PG = [{ customer_name: 'Prufa ehf.', worksite_name: 'Prufugata 7', kennitala: '0000000000', dagvinna_rate: 9951 }];
global.fetch = async (url, opts = {}) => {
  const u = new URL(url), tafla = u.pathname.split('/').pop(), m = String(opts.method || 'GET').toUpperCase();
  const svar = (body, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });
  if (tafla === 'hub_adgangar_stilling') return STILLING === 'bilad' ? svar({ message: 'niðri' }, 500) : svar(STILLING);
  if (tafla === 'hub_adgangar') { const mm = /^eq\.(.+)$/.exec(u.searchParams.get('id') || ''); return svar(mm ? NOTENDUR.filter((r) => String(r.id) === mm[1]) : NOTENDUR); }
  if (m !== 'GET') { SKRIF.push(m + ' ' + tafla); return svar([{ id: 1 }], 201); }
  if (tafla === 'email_digest') { PRUFA_SLOD.push(decodeURIComponent(u.searchParams.get('select') || ''));  /* aðeins SELECT-hlutinn: or-síunin leitar líka í meginmáli án þess að skila því */ return svar([{ id: 1, account: 'prufa@brunaholf.is', sender_name: 'Prufa', subject: 'Prufa', snippet: 'útdráttur' }]); }
  if (tafla === 'pricing_guide') return svar(PG);
  return svar([]);
};

function toki(uid, o) {
  o = o || {};
  const gogn = Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + (o.exp == null ? 3600 : o.exp), v: o.v == null ? PW_BREYTT : o.v })).toString('base64url');
  return gogn + '.' + crypto.createHmac('sha256', o.leynd || LEYND).update(gogn).digest('base64url');
}
const kaka = (uid, o) => ({ cookie: 'annad=1; hub_user=' + encodeURIComponent(toki(uid == null ? 1 : uid, o)) });
const kall = (method, q, body, hausar) => handler({ httpMethod: method, headers: Object.assign({}, hausar || {}), body: body ? JSON.stringify(body) : null, queryStringParameters: q || {} });
const SV_SKRIF = { action: 'samningur', heiti: 'Prufuverk', stada: 'i_vidraedum' };

test('án innskráningar: samningsviðræður lokaðar — lestur og skrif — þótt starfsmannahliðið sé óvirkt', async () => {
  nyGogn();
  assert.equal(process.env.HUB_STAFF_PASSWORD, undefined, 'prófið líkir eftir loftinu');
  assert.equal((await kall('GET', { samningar: '1' })).statusCode, 401);
  for (const a of ['samningur', 'samningur_eyda', 'punktur', 'punktur_eyda']) {
    assert.equal((await kall('POST', {}, Object.assign({}, SV_SKRIF, { action: a, texti: 'x', id: 1 }))).statusCode, 401, a);
  }
  assert.equal(SKRIF.length, 0, 'ekkert skrifað');
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
    'ólöglegt %-snið': { cookie: 'hub_user=%E0%A4%A' },
  };
  for (const [nafn, h] of Object.entries(tilraunir)) {
    assert.equal((await kall('GET', { samningar: '1' }, null, h)).statusCode, 401, nafn + ' · lestur');
    assert.equal((await kall('POST', {}, SV_SKRIF, h)).statusCode, 401, nafn + ' · skrif');
  }
  assert.equal(SKRIF.length, 0);
});

test('innskráningarkerfið ekki sett upp eða niðri: lokað (503 / 502), aldrei hleypt í gegn', async () => {
  nyGogn();
  STILLING = [];
  assert.equal((await kall('GET', { samningar: '1' }, null, kaka(1))).statusCode, 503);
  assert.equal((await kall('POST', {}, SV_SKRIF, kaka(1))).statusCode, 503);
  STILLING = 'bilad';
  assert.equal((await kall('GET', { samningar: '1' }, null, kaka(1))).statusCode, 502);
  assert.equal(SKRIF.length, 0);
});

test('innskráður notandi kemst í samningsviðræðurnar', async () => {
  nyGogn();
  const r = await kall('GET', { samningar: '1' }, null, kaka(1));
  assert.equal(r.statusCode, 200);
  assert.ok(Array.isArray(JSON.parse(r.body).samningar));
  const s = await kall('POST', {}, SV_SKRIF, kaka(1));
  assert.equal(s.statusCode, 200);
  assert.ok(SKRIF.some((x) => /vk_samningar/.test(x)), 'skrifað í vk_samningar');
});

test('póstur á prófíl: án innskráningar aðeins útdrátturinn — með innskráningu líka meginmálið', async () => {
  nyGogn();
  const an = JSON.parse((await kall('GET', { name: 'Prufa ehf.' })).body);
  assert.equal(an.postur_lokad, true);
  assert.ok(PRUFA_SLOD.length, 'póstfyrirspurn gerð');
  assert.ok(!/body_preview|to_addresses|attachment_names/.test(PRUFA_SLOD[0]), 'meginmál ekki sótt án innskráningar: ' + PRUFA_SLOD[0].slice(0, 160));
  PRUFA_SLOD.length = 0;
  const med = JSON.parse((await kall('GET', { name: 'Prufa ehf.' }, null, kaka(1))).body);
  assert.equal(med.postur_lokad, false);
  assert.ok(/body_preview/.test(PRUFA_SLOD[0]) && /to_addresses/.test(PRUFA_SLOD[0]), 'meginmál sótt fyrir innskráðan');
  // innskráningarkerfið niðri → prófíllinn opnast samt, bara án meginmáls
  PRUFA_SLOD.length = 0; STILLING = 'bilad';
  const nidri = JSON.parse((await kall('GET', { name: 'Prufa ehf.' }, null, kaka(1))).body);
  assert.equal(nidri.postur_lokad, true);
  assert.ok(!/body_preview/.test(PRUFA_SLOD[0]));
});
