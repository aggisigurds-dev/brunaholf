// Próf fyrir K.tvifarar og K.kreditPor í netlify/functions/_krofu-flokkun.js — keyrt með `node --test test/krofu-flokkun-tvifarar.test.js`.
// Agnar 03.11.2026 (ÞG verktakar, Viðskiptavinir): „Taka tvítök". Gervigögn eftir raunverulegum röðum, ekkert fer í lifandi grunn.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../netlify/functions/_krofu-flokkun.js');

const pd = (id, tilv, st, kr, extra) => Object.assign({ id, tilvisun: tilv, source: 'payday', status: st, kt_greidanda: '581198-2569', customer_name: 'ÞG verktakar ehf.', gjalddagi: '2026-05-25', upphaed_total: kr }, extra || {});
const lb = (id, tilv, st, kr, extra) => Object.assign({ id, tilvisun: tilv, source: 'landsbankinn_krafnir', status: st, kt_greidanda: '5811982569', customer_name: 'ÞG verktakar ehf.', gjalddagi: '2026-05-25', upphaed_total: kr }, extra || {});

test('ÞG R-310: bankaspegill „310.0" (kt án bandstriks) er tvífari Payday-raðarinnar', () => {
  const inv = [pd(84, '310', 'PAID', 7665338, { greidsla_date: '2026-05-29' }), lb(82, '310.0', 'Greidd', 7665338, { greidsla_date: '2026-05-29' })];
  const t = K.tvifarar(inv);
  assert.deepEqual([...t], ['landsbankinn_krafnir|310.0']);
});

test('bankaupphæð með gjöldum er samt tvífari (Össur R-190: 218.514 í banka, 215.987 í Payday)', () => {
  const inv = [pd(205, '190', 'PAID', 215987, { kt_greidanda: '671106-0670' }), lb(2, '190.0', 'Greidd', 218514, { kt_greidanda: '6711060670' })];
  assert.equal(K.tvifarar(inv).size, 1);
});

test('bankaröð án Payday-tvífara stendur (önnur kt eða annað númer)', () => {
  const inv = [pd(84, '310', 'PAID', 7665338), lb(82, '311.0', 'Greidd', 7665338), lb(83, '310.0', 'Greidd', 7665338, { kt_greidanda: '1111111111' })];
  assert.equal(K.tvifarar(inv).size, 0);
});

test('Payday-röðin sjálf er aldrei tvífari', () => {
  const inv = [pd(84, '310', 'PAID', 7665338), lb(82, '310.0', 'Greidd', 7665338)];
  assert.ok(!K.tvifarar(inv).has('payday|310'));
});

test('Reitir: handskráð Tekjur-röð með sömu upphæð og sama greiðsludag og R-227 er tvífari', () => {
  const r = { customer_name: 'Reitir atvinnuhúsnæði ehf.' };
  const inv = [
    Object.assign({ id: 167, source: 'payday', tilvisun: '227', status: 'PAID', kt_greidanda: '530117-0300', upphaed_total: 8772244, gjalddagi: '2025-12-10', greidsla_date: '2025-12-19' }, r),
    Object.assign({ id: 250, source: 'tekjur_sheet_manual', tilvisun: 'TEKJUR-NOV-GRIMSBAER', status: 'Greitt', kt_greidanda: null, upphaed_total: 8772244, gjalddagi: '2025-11-30', greidsla_date: '2025-12-19' }, r),
  ];
  assert.deepEqual([...K.tvifarar(inv)], ['tekjur_sheet_manual|TEKJUR-NOV-GRIMSBAER']);
  inv[1].greidsla_date = '2025-12-20';
  assert.equal(K.tvifarar(inv).size, 0, 'annar greiðsludagur → ekki tvífari');
});

test('ÞG 297/298: ógiltur reikningur og kreditreikningurinn hans verða par', () => {
  const inv = [pd(97, '297', 'CANCELLED', 27207026, { gjalddagi: '2026-04-07' }), pd(96, '298', 'CREDIT', -27207026, { gjalddagi: '2026-04-07', greidsla_date: '2026-04-07' }), pd(95, '299', 'PAID', 25846645, { gjalddagi: '2026-04-07' })];
  const p = K.kreditPor(inv);
  assert.equal(p.size, 1);
  assert.equal(p.get('payday|297').tilvisun, '298');
});

test('Eykt 280/284: sama upphæð tvisvar — gjalddaginn ræður hvaða kredit fer með hvaða reikningi', () => {
  const e = { customer_name: 'Eykt ehf.' };
  const inv = [
    pd(1, '280', 'CANCELLED', 7613974, Object.assign({ gjalddagi: '2026-03-16' }, e)), pd(2, '283', 'CREDIT', -7613974, Object.assign({ gjalddagi: '2026-03-16' }, e)),
    pd(3, '284', 'CANCELLED', 7613974, Object.assign({ gjalddagi: '2026-03-09' }, e)), pd(4, '285', 'CREDIT', -7613974, Object.assign({ gjalddagi: '2026-03-09' }, e)),
  ];
  const p = K.kreditPor(inv);
  assert.equal(p.get('payday|280').tilvisun, '283');
  assert.equal(p.get('payday|284').tilvisun, '285');
});

test('stakur kreditreikningur án ógilts reiknings parast ekki', () => {
  const inv = [pd(1, '40', 'PAID', -333091, { customer_name: 'JL Rafverktakar ehf.' }), pd(2, '41', 'PAID', 333091, { customer_name: 'JL Rafverktakar ehf.' })];
  assert.equal(K.kreditPor(inv).size, 0);
});
