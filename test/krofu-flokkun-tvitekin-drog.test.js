// Próf fyrir K.tvitekinPaydayDrog í netlify/functions/_krofu-flokkun.js — keyrt með `node --test test/krofu-flokkun-tvitekin-drog.test.js`.
// Payday-drög sem afrita ógreiddan Payday-reikning (sama kt, sama upphæð) teljast ekki aftur sem ósend. Gervigögn, ekkert fer í lifandi grunn.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../netlify/functions/_krofu-flokkun.js');

const KT = '680923-0510';
const rod = (id, tilv, st, kr, extra) => Object.assign({ id, tilvisun: tilv, source: 'payday', status: st, kt_greidanda: KT, customer_name: 'Deluxe Lodges ehf.', gjalddagi: '2026-09-07', upphaed_total: kr }, extra || {});
const metaBy = (rows) => new Map((rows || []).map((m) => [m.inv_key, m]));

test('Tindasel: Payday-drög með sömu kt og upphæð og ógreiddur R-364 sameinast reikningnum', () => {
  const inv = [rod(40895, '364', 'SENT', 1006129), rod(87472, 'PD-6bd6e3b2-6378-458c-96cb-6aeda1b9cf89', 'DRAFT', 1006129, { gjalddagi: '2026-11-04' })];
  const t = K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() });
  assert.equal(t.size, 1);
  const hit = t.get('payday|PD-6bd6e3b2-6378-458c-96cb-6aeda1b9cf89');
  assert.ok(hit);
  assert.equal(hit.tilvisun, '364');
});

test('„Drög" (íslenska) og vikmörk 1 kr', () => {
  const inv = [rod(1, '10', 'SENT', 500000), rod(2, 'PD-x', 'Drög', 500001)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() }).size, 1);
  const langt = [rod(1, '10', 'SENT', 500000), rod(2, 'PD-x', 'Drög', 500002)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: langt, metaBy: metaBy() }).size, 0);
});

test('GREIDDUR reikningur sameinar ekki — sama upphæð á nýjum drögum getur verið næsti mánuður', () => {
  const inv = [rod(1, '10', 'PAID', 750000), rod(2, 'PD-x', 'DRAFT', 750000)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() }).size, 0);
  // handvirkt „merkt greitt" í krofur_yfirlit_meta telst líka greitt
  const handv = [rod(1, '10', 'SENT', 750000), rod(2, 'PD-x', 'DRAFT', 750000)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: handv, metaBy: metaBy([{ inv_key: 'payday|10', paid: true }]) }).size, 0);
});

test('kreditfærður/cancelled reikningur sameinar ekki', () => {
  const inv = [rod(1, '10', 'CANCELLED', 750000), rod(2, '11', 'CREDIT', 750000), rod(3, 'PD-x', 'DRAFT', 750000)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() }).size, 0);
});

test('falinn eða „📨 Krafa send" reikningur sameinar ekki — drögin sjást áfram', () => {
  const inv = [rod(1, '10', 'SENT', 750000), rod(2, 'PD-x', 'DRAFT', 750000)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy([{ inv_key: 'payday|10', hidden: true }]) }).size, 0);
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy([{ inv_key: 'payday|10', done: true }]) }).size, 0);
});

test('önnur kennitala eða önnur upphæð sameinar ekki', () => {
  const annarKt = [rod(1, '10', 'SENT', 750000), rod(2, 'PD-x', 'DRAFT', 750000, { kt_greidanda: '111111-1111' })];
  assert.equal(K.tvitekinPaydayDrog({ invoices: annarKt, metaBy: metaBy() }).size, 0);
  const annarUpph = [rod(1, '10', 'SENT', 750000), rod(2, 'PD-x', 'DRAFT', 760000)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: annarUpph, metaBy: metaBy() }).size, 0);
});

test('drög án kennitölu (DRAFT-3295122) sameinast ekki — engin trygg pörun', () => {
  const inv = [rod(1, '10', 'SENT', 750000), rod(2, 'DRAFT-1', 'Drög', 750000, { kt_greidanda: null })];
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() }).size, 0);
});

test('hver ógreidd röð tekur ein drög — hin tvítaka drögin standa eftir sem ósend', () => {
  const inv = [rod(1, '10', 'SENT', 750000), rod(5, 'PD-a', 'DRAFT', 750000), rod(6, 'PD-b', 'DRAFT', 750000)];
  const t = K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() });
  assert.equal(t.size, 1);
  assert.ok(t.has('payday|PD-a'), 'elstu drög (lægra id) fyrst');
  assert.equal(t.has('payday|PD-b'), false);
});

test('tvær ógreiddar raðir með sömu upphæð taka sín drögin hvor', () => {
  const inv = [rod(1, '10', 'SENT', 750000, { gjalddagi: '2026-08-01' }), rod(2, '11', 'SENT', 750000, { gjalddagi: '2026-09-01' }), rod(5, 'PD-a', 'DRAFT', 750000), rod(6, 'PD-b', 'DRAFT', 750000)];
  const t = K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() });
  assert.equal(t.size, 2);
  assert.equal(t.get('payday|PD-a').tilvisun, '10');
  assert.equal(t.get('payday|PD-b').tilvisun, '11');
});

test('önnur source (landsbankinn_krafnir) tekur ekki þátt', () => {
  const inv = [rod(1, '10.0', 'Ógreidd', 750000, { source: 'landsbankinn_krafnir' }), rod(2, 'PD-x', 'DRAFT', 750000)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy() }).size, 0);
});

test('handvirkt greitt á drögunum sjálfum: þau eru þegar „greitt" og detta ekki í þessa reglu', () => {
  const inv = [rod(1, '10', 'SENT', 750000), rod(2, 'PD-x', 'DRAFT', 750000)];
  assert.equal(K.tvitekinPaydayDrog({ invoices: inv, metaBy: metaBy([{ inv_key: 'payday|PD-x', paid: true }]) }).size, 0);
});
