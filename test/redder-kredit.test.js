// Kreditreikningur frá Redder (skilað efni) á að dragast frá efni verksins, ekki klippast við 0.
const test = require('node:test');
const assert = require('node:assert');
const { virkUpphaed } = require('../netlify/functions/redder-invoices.js');

test('virkUpphaed: venjulegur reikningur mínus undanskildar línur, aldrei undir 0', () => {
  assert.strictEqual(virkUpphaed(137131, 0, null), 137131);
  assert.strictEqual(virkUpphaed(137131, 8112, null), 129019);
  assert.strictEqual(virkUpphaed(1000, 5000, null), 0);
});

test('virkUpphaed: kreditreikningur heldur mínustölunni', () => {
  assert.strictEqual(virkUpphaed(-56711, 0, null), -56711);
  // undanskilin skilalína (mínus) minnkar frádráttinn, en snýr honum aldrei í plús
  assert.strictEqual(virkUpphaed(-56711, -48752, null), -7959);
  assert.strictEqual(virkUpphaed(-1000, -5000, null), 0);
});

test('virkUpphaed: handsett endurkrafa (recharge_amount) ræður alltaf', () => {
  assert.strictEqual(virkUpphaed(137131, 0, 50000), 50000);
  assert.strictEqual(virkUpphaed(-56711, 0, 0), 0);
});
