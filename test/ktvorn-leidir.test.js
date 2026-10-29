// Samþættingarpróf: raunverulegu handlerarnir (match-station, verkkaupar, doc-index, reikningar-read) gegn gervi-PostgREST.
// `node --test test/ktvorn-leidir.test.js` — ekkert fer í lifandi grunn. Þungar utanaðkomandi einingar eru stubbaðar (hlaðast ekki).
'use strict';
process.env.SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {   // pdf-parse o.fl. koma við sögu í require-keðjunni en eru ekki notaðar í þessum leiðum
  if (['pdf-parse', 'pdf-lib', 'xlsx', 'mailparser'].includes(request)) return function () { return {}; };
  return origLoad.apply(this, arguments);
};
const test = require('node:test');
const assert = require('node:assert/strict');
const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');
const dashKt = (s) => { const d = digits(s); return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : s; };

function gervi(seed) {
  const db = { fyrirtaeki: (seed.fyrirtaeki || []).map((r) => Object.assign({ deleted_at: null, er_i_thjonustu: false, stadur_nr: null, kennitala: null, heimilisfang: null, customer_base_id: null }, r)),
    customers_base: (seed.customers_base || []).map((r) => Object.assign({}, r)), nextId: 3000, nextBase: 800, log: [], failGet: {}, };
  const res = (status, body) => { const t = typeof body === 'string' ? body : JSON.stringify(body); return { ok: status >= 200 && status < 300, status, text: async () => t, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) }; };
  global.fetch = async (url, init) => {
    init = init || {};
    const u = new URL(url); const method = init.method || 'GET'; const table = u.pathname.split('/').pop(); const q = u.searchParams;
    db.log.push({ method, table, search: u.search });
    if (method === 'GET' && db.failGet[table] > 0) { db.failGet[table]--; return res(500, { message: 'timeout (gervi)' }); }
    const T = db[table]; if (!T) return res(404, { message: 'tafla' });
    const filt = (r) => {
      if (q.get('deleted_at') === 'is.null' && r.deleted_at != null) return false;
      const or = q.get('or'); if (or && !or.replace(/^\(|\)$/g, '').split(',').map((p) => p.replace(/^kennitala\.eq\./, '')).includes(r.kennitala)) return false;
      const kt = q.get('kennitala'); if (kt && kt !== 'eq.' + r.kennitala) return false;   // customers_base?kennitala=eq.<dash>
      const cb = q.get('customer_base_id'); if (cb && cb !== 'eq.' + r.customer_base_id) return false;
      const id = q.get('id'); if (id && id !== 'eq.' + r.id) return false;
      return true;
    };
    if (method === 'GET') return res(200, T.filter(filt).sort((a, b) => a.id - b.id));
    const body = init.body ? JSON.parse(init.body) : null;
    if (method === 'POST') {
      const p = Object.assign({}, Array.isArray(body) ? body[0] : body);
      if (table === 'customers_base') { p.id = db.nextBase++; p.kennitala = dashKt(p.kennitala); T.push(p); return res(201, [p]); }
      Object.assign(p, { deleted_at: null, er_i_thjonustu: p.er_i_thjonustu === true, stadur_nr: p.stadur_nr == null ? null : p.stadur_nr });
      if (p.kennitala) p.kennitala = dashKt(p.kennitala);
      const kd = digits(p.kennitala);
      if (p.stadur_nr != null && T.some((r) => digits(r.kennitala) === kd && r.stadur_nr === p.stadur_nr)) return res(409, { code: '23505', message: 'duplicate key' });
      if (p.stadur_nr == null && kd.length === 10) { const sam = T.filter((r) => digits(r.kennitala) === kd); if (sam.length) p.stadur_nr = sam.reduce((m, r) => Math.max(m, r.stadur_nr || 0), 0) + 1; }
      p.id = db.nextId++; T.push(p); return res(201, [p]);
    }
    if (method === 'PATCH') { const hit = T.filter(filt); hit.forEach((r) => Object.assign(r, body)); return res(200, hit); }
    return res(405, { message: 'ekki stutt' });
  };
  return db;
}
const fyPosts = (db) => db.log.filter((l) => l.method === 'POST' && l.table === 'fyrirtaeki');
const KROKUR = () => ({
  fyrirtaeki: [{ id: 1895, nafn: 'Krókur 77 ehf.', kennitala: '490517-1620', heimilisfang: 'Suðurlandsbraut Suðurlandsbraut 44, 108 Reykjavík', er_i_thjonustu: false, stadur_nr: null, customer_base_id: 1238 }],
  customers_base: [{ id: 1238, nafn: 'Krókur 77 ehf.', kennitala: '490517-1620' }],
});
const post = (o) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(o) });
const body = (r) => JSON.parse(r.body);

const matchStation = require('../netlify/functions/match-station.js');
const verkkaupar = require('../netlify/functions/verkkaupar.js');
const docIndex = require('../netlify/functions/doc-index.js');
const reikningar = require('../netlify/functions/reikningar-read.js');

// ── match-station add-site ──────────────────────────────────────────────────
test('match-station add-site: sama nafn á kt → röðin sem er til, sett í þjónustu, ENGIN ný röð (Krókur-mynstrið)', async () => {
  const db = gervi(KROKUR());
  const r = await matchStation.handler(post({ action: 'add-site', base_id: 1238, nafn: 'Krókur 77 ehf.', heimilisfang: 'Suðurlandsbraut 4, 108 Reykjavík' }));
  assert.equal(r.statusCode, 200);
  assert.deepEqual([body(r).existed, body(r).astaeda, body(r).site.id], [true, 'nafn', 1895]);
  assert.equal(fyPosts(db).length, 0);
  assert.equal(db.fyrirtaeki[0].er_i_thjonustu, true);
});
test('match-station add-site: nýtt nafn + annað heimilisfang → nýr staður með nr 2 (∅ ⇒ 2), í þjónustu, sama base', async () => {
  const db = gervi(KROKUR());
  const r = await matchStation.handler(post({ action: 'add-site', base_id: 1238, nafn: 'Krókur 77 ehf. - Suðurhella 5', heimilisfang: 'Suðurhella 5, 221 Hafnarfjörður' }));
  assert.equal(r.statusCode, 200);
  assert.equal(body(r).existed, false);
  const s = body(r).site;
  assert.deepEqual([s.stadur_nr, s.er_i_thjonustu, s.customer_base_id, s.kennitala], [2, true, 1238, '490517-1620']);
  assert.equal(fyPosts(db).length, 1);
});
test('match-station add-site: sama heimilisfang (þágufall) annað nafn → röðin sem er til', async () => {
  const db = gervi({ fyrirtaeki: [{ id: 1, nafn: 'Pitstop þjónustan ehf.', kennitala: '660219-0480', heimilisfang: 'Hjallahrauni 4, 220 Hafnarfirði', customer_base_id: 9 }], customers_base: [{ id: 9, kennitala: '660219-0480' }] });
  const r = await matchStation.handler(post({ action: 'add-site', base_id: 9, nafn: 'Pitstop Hjallahraun', heimilisfang: 'Hjallahraun 4, 220 Hafnarfjörður' }));
  assert.deepEqual([body(r).existed, body(r).astaeda], [true, 'heimilisfang']);
  assert.equal(fyPosts(db).length, 0);
});
test('match-station add-site: LEITARVILLA → 500 og EKKERT stofnað', async () => {
  const db = gervi(KROKUR()); db.failGet.fyrirtaeki = 1;
  const r = await matchStation.handler(post({ action: 'add-site', base_id: 1238, nafn: 'Krókur 77 ehf.', heimilisfang: 'Suðurlandsbraut 4, 108 Reykjavík' }));
  assert.equal(r.statusCode, 500);
  assert.match(body(r).error, /ekkert stofnað/);
  assert.equal(fyPosts(db).length, 0);
});
test('match-station add-site: base án gildrar kt (VANTAR-…) → leitað á base, ekkert stadur_nr á kt-lausa röð', async () => {
  const db = gervi({ fyrirtaeki: [{ id: 5, nafn: 'Hótel Atlantic', kennitala: 'VANTAR-1301', heimilisfang: 'Gata 1, 220', customer_base_id: 1078 }], customers_base: [{ id: 1078, kennitala: 'VANTAR-1301' }] });
  const r1 = await matchStation.handler(post({ action: 'add-site', base_id: 1078, nafn: 'Hótel Atlantic', heimilisfang: '' }));
  assert.equal(body(r1).existed, true);                                  // sama nafn á base
  const r2 = await matchStation.handler(post({ action: 'add-site', base_id: 1078, nafn: 'Hótel Atlantic annex', heimilisfang: 'Önnur 2, 220 Hafnarfjörður' }));
  assert.equal(body(r2).existed, false);
  assert.equal(body(r2).site.stadur_nr, null);
});

// ── verkkaupar stofna_stad ───────────────────────────────────────────────────
const stofna = (o) => verkkaupar.handler(post(Object.assign({ action: 'stofna_stad', customer_name: 'Krókur 77 ehf.' }, o)));
test('verkkaupar stofna_stad: sama nafn, kt án bandstriks, örlítið annað heimilisfang → röðin sem er til (áður: tvífari)', async () => {
  const db = gervi(KROKUR());
  const r = await stofna({ nafn: 'Krókur 77 ehf.', heimilisfang: 'Suðurlandsbraut 4, 108 Reykjavík', kennitala: '4905171620' });
  assert.equal(r.statusCode, 200);
  assert.deepEqual([body(r).existed, body(r).id], [true, 1895]);
  assert.equal(fyPosts(db).length, 0);
  assert.equal(db.fyrirtaeki[0].er_i_thjonustu, false);                  // þessi leið setur ekki í þjónustu
});
test('verkkaupar stofna_stad: nýr staður → nr 2, ekki í þjónustu, bandstrikssnið kt', async () => {
  const db = gervi(KROKUR());
  const r = await stofna({ nafn: 'Krókur 77 - Suðurhella', heimilisfang: 'Suðurhella 5, 221 Hafnarfjörður', kennitala: '490517-1620' });
  assert.equal(body(r).existed, false);
  const s = db.fyrirtaeki.find((x) => x.id === body(r).id);
  assert.deepEqual([s.stadur_nr, s.er_i_thjonustu, s.kennitala], [2, false, '490517-1620']);
});
test('verkkaupar stofna_stad: LEITARVILLA → 502 og EKKERT stofnað', async () => {
  const db = gervi(KROKUR()); db.failGet.fyrirtaeki = 1;
  const r = await stofna({ nafn: 'Krókur 77 ehf.', heimilisfang: 'Suðurlandsbraut 4, 108 Reykjavík', kennitala: '490517-1620' });
  assert.equal(r.statusCode, 502);
  assert.equal(fyPosts(db).length, 0);
});
test('verkkaupar stofna_stad: heimilisfang án póstnúmers → 400 (óbreytt)', async () => {
  gervi(KROKUR());
  const r = await stofna({ nafn: 'X', heimilisfang: 'Bara gata', kennitala: '490517-1620' });
  assert.equal(r.statusCode, 400);
});

// ── doc-index create / reikningar-read create ───────────────────────────────────
const create = (h, o) => h.handler(post(Object.assign({ action: 'create', kt: '490517-1620', customer_name: 'Krókur 77 ehf.', address: 'Suðurlandsbraut 4, 108 Reykjavík' }, o)));
for (const [nafn, h] of [['doc-index', docIndex], ['reikningar-read', reikningar]]) {
  test(nafn + ' create: kt á þegar base og röð → engin ný fyrirtaeki-röð', async () => {
    const db = gervi(KROKUR());
    const r = await create(h);
    assert.equal(r.statusCode, 200);
    assert.equal(body(r).base_id, 1238);
    assert.equal(fyPosts(db).length, 0);
  });
  test(nafn + ' create: ný kt → base + EIN fyrirtaeki-röð (án nr)', async () => {
    const db = gervi({ fyrirtaeki: [], customers_base: [] });
    const r = await create(h, { kt: '551295-2499', customer_name: 'Glæný ehf.' });
    assert.equal(r.statusCode, 200);
    assert.equal(fyPosts(db).length, 1);
    assert.equal(db.fyrirtaeki[0].kennitala, '551295-2499');
    assert.equal(db.fyrirtaeki[0].stadur_nr, null);
  });
  test(nafn + ' create: fyrirtaeki-leit bilar → engin röð stofnuð (áður: villusvar lesið sem „ekkert til" → tvífari)', async () => {
    const db = gervi(KROKUR()); db.failGet.fyrirtaeki = 1;
    const r = await create(h);
    assert.equal(r.statusCode, 200);                                      // base fannst; fyrirtaeki-greinin er best-effort
    assert.equal(fyPosts(db).length, 0);
  });
  test(nafn + ' create: base-leit bilar → villa og ENGIN skrif (áður: ný base-röð á kt sem átti röð)', async () => {
    const db = gervi(KROKUR()); db.failGet.customers_base = 1;
    const r = await create(h);
    assert.ok(r.statusCode >= 500, 'staða ' + r.statusCode);
    assert.equal(db.log.filter((l) => l.method === 'POST').length, 0);
  });
  test(nafn + ' create: eydd röð á kt telst ekki til (live-leit) en lifandi röð gerir það', async () => {
    const db = gervi({ fyrirtaeki: [{ id: 7, nafn: 'Eydd ehf.', kennitala: '700000-0000', deleted_at: '2026-01-01', customer_base_id: 3 }], customers_base: [{ id: 3, kennitala: '700000-0000' }] });
    await create(h, { kt: '700000-0000', customer_name: 'Ný ehf.' });
    assert.equal(fyPosts(db).length, 1);                                  // engin lifandi röð → ein ný
    await create(h, { kt: '700000-0000', customer_name: 'Ný ehf.' });
    assert.equal(fyPosts(db).length, 1);                                  // nú er lifandi röð til → engin önnur
  });
}
