// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js.
//
// 1000-RAÐA ÞAKIÐ í charlize-stada.js (10.11.2026). PostgREST skilar mest 1000 röðum í kalli, hvað sem
// `limit` segir. Fallið bað um `limit=10000` í einu kalli og „Minnið“ í Jarvis sagði 976 virkar staðreyndir
// þegar þær voru 2.133 (kúnnaminni 83 í stað 793) — án fyrirvara. Þetta próf líkir eftir þakinu: gerviþjónninn
// skilar ALDREI fleiri en 1000 röðum, svo fall sem flettir ekki fellur hér.
//
// Sannað rautt á gamla kóðanum 10.11.2026 (active 1000 ≠ 2133) áður en lagfæringin fór inn.
//
// Keyrsla: node --test test/charlize-stada-thak.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://x.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
delete process.env.HUB_STAFF_PASSWORD;          // starfsmannahliðið er óvirkt án lykilorðs

const THAK = 1000;
const KN = [];
for (let i = 1; i <= 2168; i++) {
  KN.push({
    id: i,
    status: i <= 2133 ? 'active' : (i <= 2165 ? 'superseded' : 'wrong'),
    scope: i % 3 === 0 ? 'kunni' : 'kerfi',
    agent: i % 2 ? 'claude-code' : 'cowork',
    kennitala: i % 3 === 0 ? String(4000000000 + (i % 250)) : null,
    topic: 'efni', updated_at: '2026-11-10T00:00:00Z',
  });
}
const IB = [];
for (let i = 1; i <= 2500; i++) {
  IB.push({ id: i, status: 'pending', scope: 'kerfi', agent: 'postur', topic: 'x', fact: 'f' + i, created_at: '2026-11-0' + (1 + (i % 9)) + 'T00:00:00Z' });
}
const GOGN = { charlize_knowledge: KN, charlize_inbox: IB, customers_base: Array.from({ length: 1222 }, (_, i) => ({ id: i + 1 })) };

const koll = [];
global.fetch = async (url, opts = {}) => {
  assert.equal(String(opts.method || 'GET').toUpperCase(), 'GET', 'prófið má aðeins lesa');
  const u = new URL(url);
  const tafla = u.pathname.split('/').pop();
  const p = u.searchParams;
  let rows = GOGN[tafla];
  assert.ok(rows, 'óþekkt tafla í prófi: ' + tafla);
  for (const [k, v] of p) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^eq\.(.*)$/.exec(v);
    if (m) rows = rows.filter((r) => String(r[k]) === m[1]);
    else if (v === 'not.is.null') rows = rows.filter((r) => r[k] != null);
    else assert.fail('sía sem gerviþjónninn kann ekki: ' + k + '=' + v);
  }
  const off = parseInt(p.get('offset') || '0', 10);
  const lim = Math.min(parseInt(p.get('limit') || String(THAK), 10), THAK);   // ÞAKIÐ — eins og alvöru PostgREST
  const sida = rows.slice(off, off + lim);
  koll.push({ tafla, order: p.get('order'), limit: p.get('limit'), offset: off, skilad: sida.length });
  return {
    ok: true, status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-range' ? `${off}-${off + sida.length - 1}/${rows.length}` : null) },
    json: async () => sida, text: async () => '',
  };
};

const { handler } = require('../netlify/functions/charlize-stada.js');
const get = async (q) => {
  const r = await handler({ httpMethod: 'GET', queryStringParameters: q || {}, headers: {} });
  assert.equal(r.statusCode, 200, r.body);
  return JSON.parse(r.body);
};

test('staðan telur ALLAR raðir þótt þjónninn skili mest 1000 í kalli', async () => {
  koll.length = 0;
  const j = await get();
  assert.equal(j.knowledge.active, 2133);
  assert.equal(j.knowledge.superseded, 32);
  assert.equal(j.knowledge.wrong, 3);
  assert.equal(j.kunni.faerslur, KN.filter((r) => r.status === 'active' && r.scope === 'kunni').length);
  assert.equal(j.inbox.pending, 2500);
  const kn = koll.filter((k) => k.tafla === 'charlize_knowledge');
  assert.equal(kn.length, 3, 'þrjár síður: 1000 + 1000 + 168');
  assert.deepEqual(kn.map((k) => k.offset), [0, 1000, 2000]);
});

test('hver síða ber fasta röð — annars getur röð fallið milli síðna', async () => {
  koll.length = 0;
  await get();
  const gagnakoll = koll.filter((k) => k.tafla !== 'customers_base');
  assert.ok(gagnakoll.length > 0);
  for (const k of gagnakoll) assert.ok(k.order, `kall á ${k.tafla} (offset ${k.offset}) án order`);
});

test('`limit` í kallinu er heildarþak: biðstofan sækir mest 2000 af 2500', async () => {
  koll.length = 0;
  const j = await get({ op: 'inbox' });
  assert.equal(j.alls, 2000);
  assert.equal(j.rows.length, 40);
  const ib = koll.filter((k) => k.tafla === 'charlize_inbox');
  assert.deepEqual(ib.map((k) => [k.offset, k.skilad]), [[0, 1000], [1000, 1000]]);
});

test('lítil tafla kostar eitt kall, ekki tvö', async () => {
  koll.length = 0;
  const j = await get({ op: 'kunni' });
  assert.ok(j);
  const kn = koll.filter((k) => k.tafla === 'charlize_knowledge');
  assert.equal(kn.length, 1, 'kunni-virkt er undir 1000 í gervigögnunum → ein síða');
});
