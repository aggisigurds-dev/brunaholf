// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js.
//
// js/hub-bru.js (Powerplan lota 13): innfelld Brunahólfs-síða í Slökkvitæki-appinu biður appið um tóka og setur hann á
// eigin /api-köll. Það sem má aldrei bila:
//   1. á efsta stigi (kakan fylgir) og í ramma hjá öðrum en appinu gerir skráin EKKERT;
//   2. tókinn fer aðeins á SAMA uppruna /api/ og /.netlify/functions/ — aldrei á aðra hýsingu;
//   3. aðeins svar frá appinu (rétt origin + foreldrið sjálft) er tekið gilt; rusltóki er hunsaður;
//   4. svari appið ekki fer kallið samt (án tóka) — síðan hangir aldrei; tókinn er geymdur milli kalla.
// Keyrsla: node --test test/hub-bru.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KODI = fs.readFileSync(path.join(__dirname, '..', 'js', 'hub-bru.js'), 'utf8');
const APP = 'https://slokkvitaeki.netlify.app';
const GILDUR = '29000000.' + 'a'.repeat(64);

function gluggi({ efst = false, forfadir = [APP], search = '?embed=1', svara = true, strax = false } = {}) {
  const kollud = [], skeyti = [], hlustar = [];
  const parent = { postMessage(d, o) { skeyti.push({ d, o }); if (svara) setImmediate(() => hlustar.forEach(f => f({ origin: APP, source: parent, data: { type: 'hub-toki-svar', id: d.id, toki: GILDUR, gildir_ms: 600000 } }))); } };
  const w = {
    location: { origin: 'https://brunaholf.netlify.app', href: 'https://brunaholf.netlify.app/' + search + '#krofuyfirlit', search, ancestorOrigins: forfadir },
    document: { referrer: '' }, URL, Headers, Promise, setImmediate,
    setTimeout: strax ? (f) => { setImmediate(f); return 1; } : setTimeout, clearTimeout,
    addEventListener(t, f) { if (t === 'message') hlustar.push(f); },
    fetch: async (input, init) => { kollud.push({ url: String(input), toki: new Headers((init && init.headers) || {}).get('x-hub-toki') }); return { status: 200 }; },
  };
  w.window = w; w.self = w; w.top = efst ? w : {}; w.parent = parent;
  vm.runInNewContext(KODI, w);
  return { w, kollud, skeyti, hlustar, parent };
}

test('efsta stig: fetch óbreytt og ekkert beðið um tóka', async () => {
  const g = gluggi({ efst: true });
  await g.w.fetch('/api/worksites');
  assert.equal(g.skeyti.length, 0);
  assert.equal(g.kollud[0].toki, null);
});
test('innfelld hjá öðrum en appinu: óvirk', async () => {
  const g = gluggi({ forfadir: ['https://illt.example'] });
  await g.w.fetch('/api/worksites');
  assert.equal(g.skeyti.length, 0);
});
test('innfelld í appinu: biður appið um tóka (aðeins til APP) og setur hann á /api og /.netlify/functions', async () => {
  const g = gluggi();
  await g.w.fetch('/api/krofu-yfirlit-bru?x=1');
  await g.w.fetch('https://brunaholf.netlify.app/.netlify/functions/debtors', { method: 'POST', headers: { 'content-type': 'application/json' } });
  assert.equal(g.skeyti.length, 1, 'tókinn geymdur milli kalla');
  assert.equal(g.skeyti[0].o, APP);
  assert.equal(g.skeyti[0].d.type, 'hub-toki');
  assert.equal(g.kollud[0].toki, GILDUR);
  assert.equal(g.kollud[1].toki, GILDUR);
});
test('önnur hýsing og síður (ekki föll) fá aldrei tókann', async () => {
  const g = gluggi();
  await g.w.fetch('https://illt.example/api/worksites');
  await g.w.fetch('/index.html');
  assert.equal(g.skeyti.length, 0);
  assert.deepEqual(g.kollud.map(k => k.toki), [null, null]);
});
test('svari appið ekki fer kallið samt, án tóka', async () => {
  const g = gluggi({ svara: false, strax: true });
  await g.w.fetch('/api/worksites');
  assert.equal(g.kollud.length, 1);
  assert.equal(g.kollud[0].toki, null);
});
test('skeyti frá röngum uppruna eða með rusltóka er hunsað', async () => {
  const g = gluggi({ svara: false, strax: true });
  const p = g.w.fetch('/api/worksites');
  const id = g.skeyti[0].d.id;
  g.hlustar.forEach(f => f({ origin: 'https://illt.example', source: g.parent, data: { type: 'hub-toki-svar', id, toki: GILDUR } }));
  g.hlustar.forEach(f => f({ origin: APP, source: g.parent, data: { type: 'hub-toki-svar', id, toki: 'rusl<script>' } }));
  await p;
  assert.equal(g.kollud[0].toki, null);
});
