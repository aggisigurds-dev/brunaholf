// Próf á hliði gmail-send.js (15.11.2026) — engin netsamskipti, enginn póstur, engin gögn snert.
//   node tools/test-gmail-send-hlid.cjs
// Raunveruleg föll: gmail-send.js, hub-adgangar.js (á Supabase-líkani í minni), _postur-toki.js, daily-health.js.
// Stubbað: _google (token + Gmail API). Prófar að EKKERT sendist án innskráningar eða gilds tóka, að hliðið lokist
// (503) ef innskráningarfallið bilar, og að þjónarnir sem senda (aðgangspóstur, heilsuvakt) komist í gegn.
const path = require('path');
const crypto = require('crypto');
const FN = path.join(__dirname, '..', 'netlify', 'functions');
const { CODE } = require('./_hub-adgangar-mock.cjs');   // setur SUPABASE_* env + fetch-líkan
const mockFetch = global.fetch;

const gpath = require.resolve(path.join(FN, '_google.js'));
require.cache[gpath] = { id: gpath, filename: gpath, loaded: true, exports: {
  freshAccessTokenFor: async () => 'tok', freshAccessToken: async () => 'tok',
  listConnectedAccounts: async () => [{ user_email: 'eldklar@eldklar.is', scope: 'gmail.send' }],
  json: (c, b) => ({ statusCode: c, headers: {}, body: JSON.stringify(b) }), cors: () => ({}),
} };
const GS = require(path.join(FN, 'gmail-send.js'));
const T = require(path.join(FN, '_postur-toki.js'));
const HUB = require(path.join(FN, 'hub-adgangar.js'));

let sent = 0;
global.fetch = async (url, opt = {}) => {
  const u = new URL(url);
  const resp = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  if (u.hostname === 'gmail.googleapis.com') { if (/messages\/send$/.test(u.pathname)) sent++; return resp(200, { id: 'm', threadId: 't', messages: [] }); }
  if (u.pathname === '/api/gmail-send') {
    const h = {}; for (const k of Object.keys(opt.headers || {})) h[k.toLowerCase()] = opt.headers[k];
    const r = await GS.handler({ httpMethod: opt.method || 'GET', headers: { host: u.host, ...h }, body: opt.body || null, queryStringParameters: {} });
    return { ok: r.statusCode < 300, status: r.statusCode, json: async () => JSON.parse(r.body), text: async () => r.body };
  }
  if (u.pathname === '/api/data-sources-status') return resp(200, { sources: [] });
  return mockFetch(url, opt);
};

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const gs = async (method, body, headers) => {
  const r = await GS.handler({ httpMethod: method, headers: { host: 'brunaholf.netlify.app', ...(headers || {}) }, body: body ? JSON.stringify(body) : null, queryStringParameters: { status: '1' } });
  return { status: r.statusCode, body: JSON.parse(r.body || '{}') };
};
const toki = (key, ms) => { const m = Math.floor((ms || Date.now()) / 60000); return m + '.' + crypto.createHmac('sha256', key).update('postur-senda|' + m).digest('hex'); };
const SEND = { account: 'eldklar@eldklar.is', to: ['prof@example.invalid'], subject: 'Próf', html: '<p>x</p>' };

(async () => {
  const su = await HUB.handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'setup', code: CODE, password: 'Proforð-1234' }), headers: { host: 'brunaholf.netlify.app', cookie: '' }, queryStringParameters: {} });
  const koka = ((su.headers || {})['Set-Cookie'] || '').split(';')[0];
  let r;
  console.log('Lokað án innskráningar');
  r = await gs('POST', SEND); ok(r.status === 401 && r.body.need_login && sent === 0, 'POST án innskráningar → 401, ekkert sent');
  r = await gs('GET'); ok(r.status === 401, 'GET status án innskráningar → 401');
  r = await gs('POST', { prufa: true }, { cookie: 'hub_user=falsad' }); ok(r.status === 401, 'fölsuð kaka → 401');
  r = await gs('POST', { prufa: true }, { 'x-postur-toki': toki('rangur') }); ok(r.status === 401, 'tóki með röngum lykli → 401');
  r = await gs('POST', { prufa: true }, { 'x-postur-toki': toki(process.env.SUPABASE_SERVICE_ROLE_KEY, Date.now() - 11 * 60000) }); ok(r.status === 401, 'tóki eldri en 10 mín → 401');
  r = await gs('POST', SEND, { origin: 'https://slokkvitaeki.netlify.app' }); ok(r.status === 401 && /endurhladdu/i.test(r.body.message), 'gamall app-flipi → 401 „endurhladdu"');
  console.log('Opið innskráðum og þjónum með tóka');
  r = await gs('POST', { prufa: true }, { cookie: koka }); ok(r.status === 200 && r.body.via === 'innskraning' && sent === 0, 'prufa innskráður → 200, sendir ekkert');
  r = await gs('POST', { prufa: true }, { 'x-postur-toki': T.posturToki() }); ok(r.status === 200 && r.body.via === 'toki' && sent === 0, 'prufa með tóka → 200, sendir ekkert');
  r = await gs('GET', null, { cookie: koka }); ok(r.status === 200 && r.body.accounts.length === 1, 'GET status innskráður → 200');
  r = await gs('POST', SEND, { cookie: koka }); ok(r.status === 200 && sent === 1, 'sending innskráður → 200');
  console.log('Lokað ef innskráningarfallið bilar');
  const orig = HUB.handler; HUB.handler = async () => { throw new Error('niðri'); };
  r = await gs('POST', SEND, { cookie: koka }); ok(r.status === 503 && sent === 1, 'innskráningarfall kastar → 503, ekkert sent');
  HUB.handler = orig;
  console.log('Þjónar sem senda');
  const lst = await HUB.handler({ httpMethod: 'GET', queryStringParameters: { listi: '1' }, headers: { host: 'brunaholf.netlify.app', cookie: koka } });
  const id = JSON.parse(lst.body).users.find((u) => u.nn === 'LS').id;
  const s1 = await HUB.handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'senda', id }), headers: { host: 'brunaholf.netlify.app', cookie: koka }, queryStringParameters: {} });
  ok(s1.statusCode === 200 && sent === 2, 'hub-adgangar aðgangspóstur kemst í gegn (tóki)');
  const DH = require(path.join(FN, 'daily-health.js'));
  const d = await DH.handler({ httpMethod: 'GET', queryStringParameters: { send: '1', force: '1' }, headers: { host: 'brunaholf.netlify.app' } });
  ok(d.statusCode === 200 && JSON.parse(d.body).sent === true && sent === 3, 'daily-health heilsuvakt kemst í gegn (tóki)');
  console.log(`\n${pass} í lagi, ${fail} féllu`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
