// Próf: field-app.js tekur við efniskostnaði verkstjóra (kind 'kostnadur') — staðfest skrif, höfnun á rugli (stub-fetch, ekkert fer í lifandi grunn).
'use strict';
process.env.SUPABASE_URL = 'http://stub.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub';
delete process.env.FIELD_APP_TOKEN;
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../netlify/functions/field-app.js');

function stub() {
  const kall = [];
  global.fetch = async (url, opt) => {
    const body = opt && opt.body ? JSON.parse(opt.body) : null;
    kall.push({ url: String(url), method: (opt && opt.method) || 'GET', body });
    return { ok: true, status: 200, json: async () => (body ? [Object.assign({ id: 1 }, body)] : []), text: async () => '' };
  };
  return kall;
}
const post = (b) => F.handler({ httpMethod: 'POST', body: JSON.stringify(b), headers: {}, queryStringParameters: {} });
const gott = { action: 'add', kind: 'kostnadur', worksite_name: 'Heklu reitur', work_month: '2026-11', item_label: 'Skrúfur og festingar', category: 'BYKO', unit_price: 8065, note: 'kvittun m. vsk 10.000 kr', author: 'Lena' };

test('kostnadur: gilt skráning fer í field_entries með qty 1 og unit „kaup“', async () => {
  const kall = stub();
  const r = await post(gott);
  assert.equal(r.statusCode, 200);
  const sent = kall.find((k) => k.method === 'POST' && /field_entries/.test(k.url)).body;
  assert.equal(sent.kind, 'kostnadur');
  assert.equal(sent.unit_price, 8065);
  assert.equal(sent.qty, 1);
  assert.equal(sent.unit, 'kaup');
  assert.equal(sent.category, 'BYKO');
  assert.equal(sent.status, 'new');
});

test('kostnadur: vantar verkstað, lýsingu eða upphæð → 400 og ekkert skrifað', async () => {
  for (const bad of [{ worksite_name: '' }, { item_label: '' }, { item_label: 'a' }, { unit_price: 0 }, { unit_price: -5 }, { unit_price: 'mikið' }, { unit_price: 9999999 }]) {
    const kall = stub();
    const r = await post(Object.assign({}, gott, bad));
    assert.equal(r.statusCode, 400, JSON.stringify(bad));
    assert.equal(kall.filter((k) => k.method === 'POST').length, 0);
  }
});

test('efni af lager er óbreytt: kind efni þarf ekki upphæð', async () => {
  const kall = stub();
  const r = await post({ action: 'add', kind: 'efni', worksite_name: 'Heklu reitur', item_label: 'Brunakítti', qty: 2, unit: 'stk', unit_price: 1500 });
  assert.equal(r.statusCode, 200);
  assert.equal(kall.find((k) => k.method === 'POST').body.qty, 2);
});

test('verk: starfsmaður bætir við verki — nafn skylda, bil felld saman; of stutt nafn hafnað', async () => {
  const kall = stub();
  const r = await post({ action: 'add', kind: 'verk', worksite_name: '  Suðurlandsbraut   14  ', note: 'Fyrstur á staðinn', author: 'Lena' });
  assert.equal(r.statusCode, 200);
  assert.equal(kall.find((k) => k.method === 'POST' && /field_entries/.test(k.url)).body.worksite_name, 'Suðurlandsbraut 14');
  for (const bad of ['', 'ab', '  x ']) {
    const k2 = stub();
    assert.equal((await post({ action: 'add', kind: 'verk', worksite_name: bad })).statusCode, 400, JSON.stringify(bad));
    assert.equal(k2.filter((k) => k.method === 'POST').length, 0);
  }
});

test('bootstrap: verk í vinnslu = Tímavera mánaðarins + vika + ósend drög + bætt við; of gamalt og gervi-verk sleppt', async () => {
  const idag = new Date().toISOString().slice(0, 10), fyrr = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), gamalt = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  global.fetch = async (url) => {
    const u = new URL(String(url)); const t = u.pathname.replace('/rest/v1/', ''); const d = u.searchParams.getAll('date');
    const lo = (d.find((x) => x.startsWith('gte.')) || '').slice(4), hi = (d.find((x) => x.startsWith('lte.')) || '').slice(4);
    const tv = [{ project: 'Mánaðarverk', hours: 5, date: idag, employee: 'a' }, { project: 'Vikuverk', hours: 4, date: fyrr, employee: 'b' }, { project: 'Gamalt', hours: 3, date: gamalt, employee: 'c' }, { project: 'Veikindi', hours: 8, date: idag, employee: 'a' }]
      .filter((r) => (!lo || r.date >= lo) && (!hi || r.date <= hi));
    const data = { timavera_entries: tv, invoice_drafts: [{ worksite_name: 'Drög í Kröfu yfirliti' }], field_entries: u.searchParams.get('kind') === 'eq.verk' ? [{ worksite_name: 'Nýtt verk', note: 'úr appi' }] : [] }[t] || [];
    return { ok: true, status: 200, json: async () => data, text: async () => '' };
  };
  const r = await F.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { op: 'bootstrap', month: idag.slice(0, 7) } });
  const ws = Object.fromEntries(JSON.parse(r.body).worksites.map((w) => [w.name, w.tags]));
  assert.ok('Mánaðarverk' in ws, 'Tímavera mánaðarins');
  assert.deepEqual(ws['Vikuverk'], ['vika']);
  assert.deepEqual(ws['Drög í Kröfu yfirliti'], ['krofur']);
  assert.deepEqual(ws['Nýtt verk'], ['nytt']);
  assert.ok(!('Gamalt' in ws), 'verk án tíma í viku á ekki heima á listanum');
  assert.ok(!('Veikindi' in ws), 'gervi-verkefni Tímaveru eru ekki verk');
});

test('óþekkt kind er enn hafnað', async () => {
  stub();
  assert.equal((await post({ action: 'add', kind: 'laun', worksite_name: 'x' })).statusCode, 400);
});
