// „Sent í bókun" er ekki ósent. Það telur með ógreiddu þar til drögin parast við kröfuna. Gervigögn.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../netlify/functions/_krofu-flokkun.js');

const drog = (extra) => Object.assign({ worksite_name: 'Rafís', work_month: '2026-10', total_m_vsk: 2586543, status: 'draft', payday_invoice_id: null }, extra || {});
const mt = (extra) => Object.assign({ sent: false, done: false, paid: false, hidden: false }, extra || {});

test('ósent drög án merkingar eru ósent og ekki í bókun', () => {
  const d = drog();
  assert.equal(K.erOsent(d, new Map(), mt()), true);
  assert.equal(K.erSentIBokun(d, new Map(), mt()), false);
});

test('sent í bókun er ekki ósent og telur með ógreiddu þar til pörun', () => {
  const d = drog();
  const m = mt({ sent: true });
  assert.equal(K.erOsent(d, new Map(), m), false);
  assert.equal(K.erSentIBokun(d, new Map(), m), true);
});

test('þegar krafan parast dettur dragið úr báðum — engin tvítölun', () => {
  const d = drog();
  const m = mt({ sent: true });
  const tenging = new Map([[K.draftKey(d), { tilvisun: '379', status: 'SENT' }]]);
  assert.equal(K.erOsent(d, tenging, m), false);
  assert.equal(K.erSentIBokun(d, tenging, m), false);
});

test('krafa send (done) er hvorki ósent né í bókunar-ógreiddu', () => {
  const d = drog();
  const m = mt({ sent: true, done: true });
  assert.equal(K.erOsent(d, new Map(), m), false);
  assert.equal(K.erSentIBokun(d, new Map(), m), false);
});

test('greitt og payday-tengd drög eru ekki í bókunar-ógreiddu', () => {
  assert.equal(K.erSentIBokun(drog(), new Map(), mt({ sent: true, paid: true })), false);
  assert.equal(K.erSentIBokun(drog({ payday_invoice_id: 12 }), new Map(), mt({ sent: true })), false);
});
