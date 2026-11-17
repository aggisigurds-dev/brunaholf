// Próf fyrir /api/postmoppur (netlify/functions/postmoppur.js). Keyrsla: node --test test/postmoppur.test.js
// fetch er skipt út fyrir gervi-PostgREST; innskráningartókin eru undirrituð eins og hub-adgangar.js gerir.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.SUPABASE_URL = 'https://gervi.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'gervilykill';
const LEYND = 'leynd-session-lykill';
const PW_CHANGED = '2026-10-19T12:00:00Z';

function gervi() {
  const kv = new Map();
  const s = { kv, skrif: [] };
  kv.set('bru_moppur:DESKTOP-M5FO3I6', { vel: 'DESKTOP-M5FO3I6', uppfaert: '2026-11-15T20:00:00Z', utilokad: ['eldklar@eldklar.is'],
    holf: { 'Brunaholf@brunaholf.is': [{ mappa: 'Tilboð send-1', bytes: 1000, lesid: 0 }, { mappa: 'INBOX/Redder ehf', bytes: 500, lesid: 0 }] } });
  const notendur = { 1: { id: 1, nafn: 'Agnar Sigurðsson', notandanafn: 'AS', rola: 'Admin', virkur: true }, 2: { id: 2, nafn: 'Starfs Maður', notandanafn: 'SM', rola: 'Starfsmaður', virkur: true } };
  const postur = { 46992: { id: 46992, account: 'Brunaholf@brunaholf.is', subject: 'Sending tollafgreidd', source_path: 'C:\\TB\\INBOX' }, 7: { id: 7, account: 'eldklar@eldklar.is', subject: 'Gmail', source_path: null } };
  s.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const t = u.pathname.replace('/rest/v1/', '');
    const q = (k) => (u.searchParams.get(k) || '').replace(/^(eq|like)\./, '');
    const svar = (st, j) => ({ ok: st < 300, status: st, json: async () => j, text: async () => JSON.stringify(j) });
    if (t === 'hub_adgangar_stilling') return svar(200, [{ session_secret: LEYND, pw_changed_at: PW_CHANGED }]);
    if (t === 'hub_adgangar') return svar(200, notendur[q('id')] ? [notendur[q('id')]] : []);
    if (t === 'email_digest') return svar(200, postur[q('id')] ? [postur[q('id')]] : []);
    if (t === 'app_kv' && (init.method || 'GET') === 'GET') {
      const key = q('key');
      if (key.endsWith('*')) return svar(200, [...kv].filter(([k]) => k.startsWith(key.slice(0, -1))).map(([k, v]) => ({ key: k, value: v, updated_at: 'x' })));
      return svar(200, kv.has(key) ? [{ value: kv.get(key), updated_at: 'x' }] : []);
    }
    if (t === 'app_kv' && init.method === 'POST') { const r = JSON.parse(init.body); kv.set(r.key, r.value); s.skrif.push(r.key); return svar(201, null); }
    return svar(404, { villa: url });
  };
  return s;
}

function toki(uid, { leynd = LEYND, v = PW_CHANGED, exp = Math.floor(Date.now() / 1000) + 3600 } = {}) {
  const gogn = Buffer.from(JSON.stringify({ uid, exp, v })).toString('base64url');
  return gogn + '.' + crypto.createHmac('sha256', leynd).update(gogn).digest('base64url');
}
const event = (method, { uid, body, toki: t } = {}) => ({
  httpMethod: method, headers: uid || t ? { cookie: 'hub_user=' + encodeURIComponent(t || toki(uid)) } : {}, body: body ? JSON.stringify(body) : undefined,
});

let fall;
test.before(() => { fall = require('../netlify/functions/postmoppur.js'); });

async function kalla(s, ev) {
  const fyrri = global.fetch;
  global.fetch = s.fetch;
  try { const r = await (fall._innra || fall.handler)(ev); return { status: r.statusCode, body: JSON.parse(r.body || 'null') }; }
  finally { global.fetch = fyrri; }
}

test('óinnskráður, fölsuð undirritun og útrunnið tók fá 401', async () => {
  const s = gervi();
  assert.strictEqual((await kalla(s, event('GET'))).status, 401);
  assert.strictEqual((await kalla(s, event('GET', { toki: toki(1, { leynd: 'röng' }) }))).status, 401);
  assert.strictEqual((await kalla(s, event('GET', { toki: toki(1, { exp: 100 }) }))).status, 401);
  assert.strictEqual((await kalla(s, event('GET', { toki: toki(1, { v: 'eldra-lykilorð' }) }))).status, 401);
});

test('starfsmaður sér listann en getur ekki breytt', async () => {
  const s = gervi();
  const g = await kalla(s, event('GET', { uid: 2 }));
  assert.strictEqual(g.status, 200);
  assert.strictEqual(g.body.stjornandi, false);
  assert.strictEqual(g.body.velar[0].vel, 'DESKTOP-M5FO3I6');
  assert.deepStrictEqual(g.body.velar[0].utilokad, ['eldklar@eldklar.is']);
  const p = await kalla(s, event('POST', { uid: 2, body: { action: 'kveikja', account: 'Brunaholf@brunaholf.is', mappa: 'Tilboð send-1' } }));
  assert.strictEqual(p.status, 403);
  assert.deepStrictEqual(s.skrif, []);
});

test('stjórnandi kveikir og slekkur; aðeins möppur sem brúin sendi', async () => {
  const s = gervi();
  const ny = await kalla(s, event('POST', { uid: 1, body: { action: 'kveikja', account: 'Brunaholf@brunaholf.is', mappa: '../../Windows' } }));
  assert.strictEqual(ny.status, 400);
  const k = await kalla(s, event('POST', { uid: 1, body: { action: 'kveikja', account: 'brunaholf@BRUNAHOLF.is', mappa: 'Tilboð send-1' } }));
  assert.strictEqual(k.status, 200, JSON.stringify(k.body));
  assert.deepStrictEqual(s.kv.get('bru_moppur_kveikt')['brunaholf@BRUNAHOLF.is'], ['Tilboð send-1']);
  assert.strictEqual(s.kv.get('bru_moppur_kveikt')._breytt.af, 'Agnar');
  await kalla(s, event('POST', { uid: 1, body: { action: 'kveikja', account: 'Brunaholf@brunaholf.is', mappa: 'INBOX/Redder ehf' } }));
  assert.deepStrictEqual(s.kv.get('bru_moppur_kveikt')['brunaholf@BRUNAHOLF.is'], ['INBOX/Redder ehf', 'Tilboð send-1'], 'sami lykill, ekki tvítekið hólf');
  await kalla(s, event('POST', { uid: 1, body: { action: 'kveikja', account: 'Brunaholf@brunaholf.is', mappa: 'Tilboð send-1', kveikt: false } }));
  assert.deepStrictEqual(s.kv.get('bru_moppur_kveikt')['brunaholf@BRUNAHOLF.is'], ['INBOX/Redder ehf']);
  await kalla(s, event('POST', { uid: 1, body: { action: 'kveikja', account: 'Brunaholf@brunaholf.is', mappa: 'INBOX/Redder ehf', kveikt: false } }));
  assert.ok(!('brunaholf@BRUNAHOLF.is' in s.kv.get('bru_moppur_kveikt')), 'tómt hólf hverfur úr listanum');
});

test('viðhengi eftir beiðni: aðeins Thunderbird-póstur, ein beiðni á póst', async () => {
  const s = gervi();
  assert.strictEqual((await kalla(s, event('POST', { uid: 1, body: { action: 'saekja_vidhengi', email_id: 'abc' } }))).status, 400);
  assert.strictEqual((await kalla(s, event('POST', { uid: 1, body: { action: 'saekja_vidhengi', email_id: 999 } }))).status, 404);
  assert.strictEqual((await kalla(s, event('POST', { uid: 1, body: { action: 'saekja_vidhengi', email_id: 7 } }))).status, 400, 'Gmail-póstur á ekki mbox-skrá');
  const a = await kalla(s, event('POST', { uid: 1, body: { action: 'saekja_vidhengi', email_id: 46992 } }));
  assert.strictEqual(a.status, 200);
  await kalla(s, event('POST', { uid: 1, body: { action: 'saekja_vidhengi', email_id: 46992 } }));
  const b = s.kv.get('bru_vidhengi_bid').beidnir;
  assert.strictEqual(b.length, 1, 'endurbeiðni kemur í stað þeirrar fyrri');
  assert.strictEqual(b[0].email_id, 46992);
  assert.strictEqual(b[0].efni, 'Sending tollafgreidd');
  assert.ok(b[0].at);
  assert.strictEqual((await kalla(s, event('POST', { uid: 2, body: { action: 'saekja_vidhengi', email_id: 46992 } }))).status, 403);
});
