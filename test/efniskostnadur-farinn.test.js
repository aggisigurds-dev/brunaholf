// Próf: Efniskostnaður hrynur ekki þegar notandinn fer af síðunni á meðan beðið er (17.11.2026, Verkefnalisti f19c0503).
// Keyrsla: node --test test/efniskostnadur-farinn.test.js
//
// AF HVERJU: villur #21 (39×) og #763 (7×) — „Cannot set properties of null" sem unhandledrejection á #ajour. Bæði föllin
// bíða eftir fetch; fari notandinn á aðra síðu á meðan eru hólfin horfin. renderEfniskostnadur skrifaði þá í #ef-meta í
// catch (sem kastaði sjálft) og efKostnadarYfirlit setti drop.onclick á null. Það sem má aldrei bila: hvorugt fallið
// kastar þegar hólfin hverfa á meðan beðið er — það hættir hljóðlaust.
// VERK_INDEX=<slóð> keyrir prófið á annarri útgáfu af index.html (t.d. origin/main fyrir lagfæringu — á þá að falla).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(process.env.VERK_INDEX || path.join(__dirname, '..', 'index.html'), 'utf8');
function fall(heiti) {
  const i = SRC.indexOf('async function ' + heiti + '(');
  assert.ok(i > 0, heiti + ' finnst í index.html');
  const j = SRC.indexOf('\n}\n', i);
  return SRC.slice(i, j + 2);
}

// Hermd síða: hólf eru til þar til `farinn` verður satt (notandinn fór) — þá skilar getElementById null.
function sida() {
  const s = { farinn: false };
  const hlutur = () => ({ innerHTML: '', textContent: '', style: {}, value: '', onclick: null, addEventListener() {}, appendChild() {}, get isConnected() { return !s.farinn; } });
  const hlutir = {};
  s.document = { getElementById(id) { if (s.farinn) return null; return (hlutir[id] = hlutir[id] || hlutur()); }, createElement: hlutur };
  return s;
}

test('renderEfniskostnadur: notandinn fer á meðan beðið er → engin villa (áður #21)', async () => {
  const s = sida();
  const ctx = { document: s.document, $view: { innerHTML: '' }, efKostnadarYfirlit() {}, efReadRedder() {}, console, Promise, Error, Math, Date, JSON, String, Number, Array, Object };
  ctx.fetch = async () => { s.farinn = true; return { ok: true, status: 200, json: async () => ({ rows: [], invoices: [] }) }; };
  vm.runInNewContext(fall('renderEfniskostnadur') + '\nthis.f = renderEfniskostnadur;', ctx);
  await assert.doesNotReject(() => ctx.f({}));
});

test('renderEfniskostnadur: fetch bregst EFTIR að notandinn fór → catch kastar ekki', async () => {
  const s = sida();
  const ctx = { document: s.document, $view: { innerHTML: '' }, efKostnadarYfirlit() {}, efReadRedder() {}, console, Promise, Error };
  ctx.fetch = async () => { s.farinn = true; throw new Error('net niðri'); };
  vm.runInNewContext(fall('renderEfniskostnadur') + '\nthis.f = renderEfniskostnadur;', ctx);
  await assert.doesNotReject(() => ctx.f({}));
});

test('renderEfniskostnadur: notandinn enn á síðunni og fetch bregst → villan sést í #ef-meta', async () => {
  const s = sida();
  const ctx = { document: s.document, $view: { innerHTML: '' }, efKostnadarYfirlit() {}, efReadRedder() {}, console, Promise, Error };
  ctx.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  vm.runInNewContext(fall('renderEfniskostnadur') + '\nthis.f = renderEfniskostnadur;', ctx);
  await ctx.f({});
  assert.match(s.document.getElementById('ef-meta').textContent, /Villa: HTTP 500/);
});

test('efKostnadarYfirlit: notandinn fer á meðan kúnnalistinn er sóttur → engin villa (áður #763)', async () => {
  const s = sida();
  const ctx = { document: s.document, sessionStorage: { setItem() {} }, location: {}, vidmotArfur() { return 0; }, vidmotSetja() {}, console, Promise, Error, Math, Date, JSON, String, Number, Array, Object };
  ctx.fetch = async () => { s.farinn = true; return { ok: true, json: async () => ({ kunnaIds: {}, kunnalisti: [] }) }; };
  vm.runInNewContext(fall('efKostnadarYfirlit') + '\nthis.f = efKostnadarYfirlit;', ctx);
  await assert.doesNotReject(() => ctx.f());
});
