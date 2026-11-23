// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js.
//
// js/sb-starfstok.js (23.11.2026): bein köll Brunahólfs-síðna á Supabase REST fá starfsmannatáknið úr /api/sb-toki.
// Það sem má aldrei bila:
//   1. aðeins hýsill verkefnisins og /rest/v1/ — aðrir hýslar, /storage/ og /api/ fara óbreytt;
//   2. aðeins köll með apikey og ENGU Authorization eða 'Bearer ' + apikey — köll með eigið tákn fara óbreytt;
//   3. virkar á venjulegum hlut, Headers-tilviki og Request-inntaki (supabase-js, innskotið, jarvis-mælirinn);
//   4. ekkert tákn (401) → kallið fer óbreytt og ekki er reynt aftur strax; tákninu er haldið milli kalla.
// Keyrsla: node --test test/sb-starfstok.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KODI = fs.readFileSync(path.join(__dirname, '..', 'js', 'sb-starfstok.js'), 'utf8');
const U = 'https://osfdzskyvisifcwyjkuk.supabase.co';
const K = 'sb_publishable_prufa';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOK = b64({ alg: 'HS256' }) + '.' + b64({ role: 'authenticated', rola: 'Admin', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.sig';

function gluggi({ innskradur = true } = {}) {
  const kollud = [];
  let tokkoll = 0;
  const w = {
    location: { href: 'https://brunaholf.netlify.app/hledsluaaetlun.html' },
    URL, Headers, Request, Promise, setTimeout, clearTimeout,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async (input, init) => {
      const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
      if (url === '/api/sb-toki') { tokkoll++; return innskradur ? { ok: true, json: async () => ({ sb_jwt: TOK }) } : { ok: false, status: 401, json: async () => ({}) }; }
      const h = new Headers((init && init.headers) || (input && input.headers) || {});
      kollud.push({ url, auth: h.get('authorization'), apikey: h.get('apikey'), body: init && init.body });
      return { ok: true, status: 200 };
    },
  };
  w.window = w;
  vm.runInNewContext(KODI, w);
  return { w, kollud, tokkoll: () => tokkoll };
}

test('apikey án Authorization (jarvis-mælirinn) og Bearer+apikey (innskotið) fá táknið', async () => {
  const g = gluggi();
  await g.w.fetch(U + '/rest/v1/app_settings?select=id&limit=1', { headers: { apikey: K }, cache: 'no-store' });
  await g.w.fetch(U + '/rest/v1/cowork_js_patches?id=eq.kerfisheilsa&select=code', { headers: { apikey: K, Authorization: 'Bearer ' + K } });
  assert.equal(g.kollud[0].auth, 'Bearer ' + TOK);
  assert.equal(g.kollud[0].apikey, K);
  assert.equal(g.kollud[1].auth, 'Bearer ' + TOK);
  assert.equal(g.tokkoll(), 1, 'táknið sótt einu sinni og haldið');
});

test('Headers-tilvik (supabase-js) og Request-inntak fá táknið; meginmál helst', async () => {
  const g = gluggi();
  const h = new Headers({ apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' });
  await g.w.fetch(U + '/rest/v1/rpc/reikningslestur_skra', { method: 'POST', headers: h, body: '{"p":1}' });
  await g.w.fetch(new Request(U + '/rest/v1/customer_documents?select=id', { headers: { apikey: K } }));
  assert.equal(g.kollud[0].auth, 'Bearer ' + TOK);
  assert.equal(g.kollud[0].body, '{"p":1}');
  assert.equal(g.kollud[1].auth, 'Bearer ' + TOK);
});

test('annar hýsill, /storage/, /api/ og köll með eigið tákn fara óbreytt — og ekkert tákn sótt', async () => {
  const g = gluggi();
  await g.w.fetch('https://annad.supabase.co/rest/v1/x', { headers: { apikey: K } });
  await g.w.fetch(U + '/storage/v1/object/public/vefverslun/a.png', { headers: { apikey: K } });
  await g.w.fetch('/api/worksites');
  await g.w.fetch(U + '/rest/v1/x', { headers: { apikey: K, Authorization: 'Bearer eitthvad.annad.tokn' } });
  await g.w.fetch(U + '/rest/v1/x');
  assert.deepEqual(g.kollud.map(k => k.auth), [null, null, null, 'Bearer eitthvad.annad.tokn', null]);
  assert.equal(g.tokkoll(), 0);
});

test('óinnskráður: kallið fer óbreytt, ekki reynt aftur innan 60 s', async () => {
  const g = gluggi({ innskradur: false });
  await g.w.fetch(U + '/rest/v1/app_settings', { headers: { apikey: K, Authorization: 'Bearer ' + K } });
  await g.w.fetch(U + '/rest/v1/app_settings', { headers: { apikey: K } });
  assert.equal(g.kollud[0].auth, 'Bearer ' + K);
  assert.equal(g.kollud[1].auth, null);
  assert.equal(g.tokkoll(), 1);
  assert.equal(await g.w.__sbToki(), null);
});

test('hlaðið tvisvar: fetch vafið einu sinni', async () => {
  const g = gluggi();
  const fyrst = g.w.fetch;
  vm.runInNewContext(KODI, g.w);
  assert.equal(g.w.fetch, fyrst);
});
