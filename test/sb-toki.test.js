// Próf fyrir /api/sb-toki (netlify/functions/sb-toki.js), 23.11.2026. Keyrsla: node --test test/sb-toki.test.js
// fetch er skipt út fyrir gervi-PostgREST og gervi-Slökkvitæki; kökurnar eru undirritaðar eins og hub-adgangar.js gerir.
// Það sem má aldrei bila:
//   1. óinnskráður, fölsuð/útrunnin/gömul kaka eða óvirkur notandi → 401, og EKKERT kall fer til Slökkvitækis;
//   2. tákn frá Slökkvitæki er aðeins tekið gilt fyrir SAMA notanda og SAMA hlutverk (annars 502);
//   3. Slökkvitæki niðri eða hangir → 502 (aldrei opið, aldrei hangandi);
//   4. sé SUPABASE_JWT_SECRET sett er táknið myntað hér og ekkert kall fer út;
//   5. svarið ber Cache-Control: no-store.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.SUPABASE_URL = 'https://gervi.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'gervilykill';
delete process.env.SUPABASE_JWT_SECRET;
const LEYND = 'leynd-session-lykill';
const PW_CHANGED = '2026-10-19T12:00:00Z';
const SLOKK = 'https://slokkvitaeki.netlify.app/api/hub-adgangar';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(payload) { return b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(payload) + '.sig'; }
const nu = () => Math.floor(Date.now() / 1000);

function gervi({ slokk } = {}) {
  const s = { utkoll: [], db_nidri: false };
  const notendur = { 1: { id: 1, rola: 'Admin', virkur: true }, 2: { id: 2, rola: 'Starfsmaður', virkur: true }, 3: { id: 3, rola: 'Starfsmaður', virkur: false } };
  const svar = (st, j) => ({ ok: st < 300, status: st, json: async () => j, text: async () => JSON.stringify(j) });
  s.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    if (u.origin === 'https://gervi.supabase.co') {
      if (s.db_nidri) return svar(500, {});
      const t = u.pathname.replace('/rest/v1/', '');
      if (t === 'hub_adgangar_stilling') return svar(200, [{ session_secret: LEYND, pw_changed_at: PW_CHANGED }]);
      if (t === 'hub_adgangar') { const id = (u.searchParams.get('id') || '').replace('eq.', ''); return svar(200, notendur[id] ? [notendur[id]] : []); }
      return svar(404, {});
    }
    s.utkoll.push({ url: String(url), cookie: (init.headers || {}).cookie });
    if (String(url) !== SLOKK) return svar(404, {});
    return slokk ? slokk(init) : svar(200, { authed: true, sb_jwt: jwt({ role: 'authenticated', sub: 'hub:1', rola: 'Admin', iat: nu(), exp: nu() + 36000 }) });
  };
  return s;
}

function toki(uid, { leynd = LEYND, v = PW_CHANGED, exp = nu() + 3600 } = {}) {
  const gogn = Buffer.from(JSON.stringify({ uid, exp, v })).toString('base64url');
  return gogn + '.' + crypto.createHmac('sha256', leynd).update(gogn).digest('base64url');
}
const event = ({ uid, t, method = 'GET' } = {}) => ({ httpMethod: method, headers: uid || t ? { cookie: 'hub_user=' + encodeURIComponent(t || toki(uid)) } : {} });

let fall;
test.before(() => { fall = require('../netlify/functions/sb-toki.js'); });

async function kalla(s, ev) {
  const fyrri = global.fetch;
  global.fetch = s.fetch;
  try { const r = await fall.handler(ev); return { status: r.statusCode, headers: r.headers, body: JSON.parse(r.body || 'null') }; }
  finally { global.fetch = fyrri; }
}

test('óinnskráður, fölsuð, útrunnin og gömul kaka og óvirkur notandi fá 401 — og ekkert fer til Slökkvitækis', async () => {
  const s = gervi();
  for (const ev of [event(), event({ t: toki(1, { leynd: 'röng' }) }), event({ t: toki(1, { exp: nu() - 5 }) }),
    event({ t: toki(1, { v: '2020-01-01' }) }), event({ uid: 3 }), event({ uid: 99 }), event({ t: 'rusl' })]) {
    const r = await kalla(s, ev);
    assert.strictEqual(r.status, 401);
    assert.strictEqual(r.body.sb_jwt, undefined);
  }
  assert.strictEqual(s.utkoll.length, 0);
});

test('innskráður fær tákn Slökkvitækis; aðeins kakan fer yfir; no-store', async () => {
  const s = gervi();
  const r = await kalla(s, event({ uid: 1 }));
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.uppruni, 'slokkvitaeki');
  assert.ok(r.body.sb_jwt && r.body.exp > nu());
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');
  assert.strictEqual(s.utkoll.length, 1);
  assert.strictEqual(s.utkoll[0].url, SLOKK);
  assert.strictEqual(s.utkoll[0].cookie, 'hub_user=' + toki(1));
});

test('tákn fyrir annan notanda, annað hlutverk, anon eða útrunnið → 502', async () => {
  const slaem = [
    { role: 'authenticated', sub: 'hub:2', rola: 'Admin', exp: nu() + 3600 },
    { role: 'authenticated', sub: 'hub:1', rola: 'Starfsmaður', exp: nu() + 3600 },
    { role: 'anon', sub: 'hub:1', rola: 'Admin', exp: nu() + 3600 },
    { role: 'authenticated', sub: 'hub:1', rola: 'Admin', exp: nu() + 10 },
  ];
  for (const p of slaem) {
    const s = gervi({ slokk: async () => ({ ok: true, status: 200, json: async () => ({ authed: true, sb_jwt: jwt(p) }) }) });
    const r = await kalla(s, event({ uid: 1 }));
    assert.strictEqual(r.status, 502, JSON.stringify(p));
    assert.strictEqual(r.body.sb_jwt, undefined);
  }
});

test('Slökkvitæki niðri, villa eða án tákns → 502/503, aldrei tákn', async () => {
  const tilvik = [
    [async () => ({ ok: false, status: 500, json: async () => ({}) }), 502],
    [async () => { throw new Error('net'); }, 502],
    [async () => ({ ok: true, status: 200, json: async () => ({ authed: false }) }), 401],
    [async () => ({ ok: true, status: 200, json: async () => ({ authed: true }) }), 503],
  ];
  for (const [slokk, vaent] of tilvik) {
    const r = await kalla(gervi({ slokk }), event({ uid: 1 }));
    assert.strictEqual(r.status, vaent);
    assert.strictEqual(r.body.sb_jwt, undefined);
  }
});

test('gagnagrunnur niðri → 502; POST → 405', async () => {
  const s = gervi(); s.db_nidri = true;
  assert.strictEqual((await kalla(s, event({ uid: 1 }))).status, 502);
  assert.strictEqual((await kalla(gervi(), event({ uid: 1, method: 'POST' }))).status, 405);
});

test('SUPABASE_JWT_SECRET sett → myntað hér, rétt claim, ekkert kall út', async () => {
  process.env.SUPABASE_JWT_SECRET = 'prufu-jwt-leyndarmal';
  try {
    const s = gervi();
    const r = await kalla(s, event({ uid: 2 }));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.uppruni, 'brunaholf');
    assert.strictEqual(s.utkoll.length, 0);
    const { verifyStaffJwt } = require('../netlify/functions/_sb-jwt.js');
    const p = verifyStaffJwt(r.body.sb_jwt);
    assert.ok(p);
    assert.strictEqual(p.sub, 'hub:2');
    assert.strictEqual(p.rola, 'Starfsmaður');
    assert.strictEqual(p.role, 'authenticated');
  } finally { delete process.env.SUPABASE_JWT_SECRET; }
});
