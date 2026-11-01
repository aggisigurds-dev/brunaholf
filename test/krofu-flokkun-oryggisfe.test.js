// Próf fyrir öryggisfé í netlify/functions/_krofu-flokkun.js (sjalfvirkTenging) — keyrt með `node --test test/krofu-flokkun-oryggisfe.test.js`.
// Landsspitalinn/ÞG: Payday-reikningurinn er 95% af uppgjörinu (5% öryggisfé, ekki afsláttur). Gervigögn, ekkert fer í lifandi grunn.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../netlify/functions/_krofu-flokkun.js');

const KT = '1111111111';
const rod = (id, nr, kr, gjd, st, kt, nm) => ({ id, tilvisun: nr, source: 'payday', status: st, kt_greidanda: kt || KT, customer_name: nm || 'ÞG verktakar ehf.', gjalddagi: gjd, upphaed_total: kr });
const drog = (ws, man, kr, extra) => Object.assign({ worksite_name: ws, work_month: man, total_m_vsk: kr, customer_name: 'ÞG verktakar ehf.', kennitala: KT, status: 'draft', payday_invoice_id: null }, extra || {});
const kort = (ret) => [{ customer_name: 'ÞG verktakar ehf.', worksite_name: 'Landsspitalinn', kt_greidanda: KT, confidence: 'payday-tilvisun', tilvisun: null, retention_pct: ret }];

function keyra(drafts, invoices, cwmap) {
  const resolvePayer = K.greidendur({ cwmap, pguide: [], invoices });
  return K.sjalfvirkTenging({ drafts, invoices, resolvePayer });
}

test('95% reikningur tengist drögum á verkstað með öryggisfé og mismunurinn er skráður sem haldið eftir', () => {
  const t = keyra([drog('Landsspitalinn', '2026-09', 3827435)], [rod(72282, '376', 3636063, '2026-10-15', 'PAID')], kort('10'));
  const hit = t.get('draftinv|Landsspitalinn|2026-09');
  assert.ok(hit, 'sept-drög tengd við R-376');
  assert.equal(hit.tilvisun, '376');
  assert.equal(hit.haldid_eftir, 191372);
});

test('kortagildi 10% og raunin 5% passa bæði (kortið segir 10, reikningarnir eru 95%)', () => {
  const inv90 = [rod(1, '500', 900000, '2026-10-10', 'SENT')];
  assert.ok(keyra([drog('Landsspitalinn', '2026-10', 1000000)], inv90, kort('10')).has('draftinv|Landsspitalinn|2026-10'));
  const inv95 = [rod(2, '501', 950000, '2026-10-10', 'SENT')];
  assert.ok(keyra([drog('Landsspitalinn', '2026-10', 1000000)], inv95, kort('10')).has('draftinv|Landsspitalinn|2026-10'));
});

test('verkstaður án öryggisfjár tengist EKKI við 95% (aðeins 100%)', () => {
  const inv = [rod(3, '900', 950000, '2026-10-10', 'PAID', '2222222222', 'Annar ehf.')];
  const d = drog('Verk B', '2026-10', 1000000, { kennitala: '2222222222', customer_name: 'Annar ehf.' });
  assert.equal(keyra([d], inv, []).size, 0);
  // retention_pct 0 í kortinu = ekkert öryggisfé
  const kort0 = [{ customer_name: 'Annar ehf.', worksite_name: 'Verk B', kt_greidanda: '2222222222', confidence: 'manual', retention_pct: '0' }];
  assert.equal(keyra([d], inv, kort0).size, 0);
});

test('100% tenging virkar áfram og ber engan mismun', () => {
  const t = keyra([drog('Landsspitalinn', '2026-08', 6114101)], [rod(4, '370', 6114101, '2026-09-07', 'PAID')], kort('10'));
  const hit = t.get('draftinv|Landsspitalinn|2026-08');
  assert.ok(hit);
  assert.equal(hit.haldid_eftir, undefined);
});

test('handslegin upphæð sem passar ekki (júní 7.096.000 á móti 6.737.520) tengist ekki — ströng regla', () => {
  assert.equal(keyra([drog('Landsspitalinn', '2026-06', 7096000)], [rod(5, '343', 6737520, '2026-07-06', 'PAID')], kort('10')).size, 0);
});

test('hver Payday-röð tengist í mesta lagi einum drögum og frátekin röð (payday_invoice_id) er aldrei notuð', () => {
  const inv = [rod(6, '352', 10044433, '2026-08-07', 'PAID')];
  const tveir = [drog('Landsspitalinn', '2026-07', 10573087), drog('Landsspitalinn', '2026-08', 10573087)];
  assert.equal(keyra(tveir, inv, kort('10')).size, 1);
  const fratekin = [drog('Landsspitalinn', '2026-07', 10573087), drog('Landsspitalinn', '2026-06', 1, { payday_invoice_id: 6 })];
  assert.equal(keyra(fratekin, inv, kort('10')).has('draftinv|Landsspitalinn|2026-07'), false);
});

test('drög án kennitölu finna greiðandann í kortinu (maí og júlí á Landsspitalinn)', () => {
  const t = keyra([drog('Landsspitalinn', '2026-05', 4643084, { kennitala: null, customer_name: null })], [rod(7, '319', 4410930, '2026-05-31', 'PAID')], kort('10'));
  assert.equal(t.get('draftinv|Landsspitalinn|2026-05').haldid_eftir, 232154);
});
