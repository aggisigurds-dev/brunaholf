// Próf: smámyndir teikninga úr skjalasafni Reykjavíkur og samsöfnun auðlindavillna (18.11.2026).
// Keyrsla: node --test test/teikn-smamynd.test.js
//
// AF HVERJU: villur #1306–#1427 — „Náði ekki í img" á /#vidskiptavinir og /#krofuyfirlit, 28 raðir, allar
// https://skjalasafn.reykjavik.is/fotoweb/cache/v2/…<lykill>.jpg. Safnið skiptir um lykilinn í slóðinni á 1–2 dögum
// (mælt 18.11: 12 af 13 geymdum slóðum svara 404) en slóðin var geymd í verkstadur_info.teikningar og sett beint í <img>.
// Það sem má aldrei bila:
//   1. panillinn setur ENGA fotoweb/cache-slóð í <img> — smámyndin er sótt eftir varanlega permalinknum (infoUrl);
//   2. mynd sem næst ekki fær staðgengil (onerror), ekki brotna mynd;
//   3. „Sækja aftur" sendir enga fotoweb/cache-slóð til vistunar, og þjónninn geymir hana ekki þótt hún berist;
//   4. villuskráin telur 24 dauðar myndir af sama hýsli sem EINA villu (fjoldi 24), ekki 24 ólíkar.
// VERK_ROT=<slóð> keyrir prófið á annarri útgáfu af repóinu (t.d. main fyrir lagfæringu — á þá að falla).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROT = process.env.VERK_ROT || path.join(__dirname, '..');
process.env.SUPABASE_URL = 'https://x.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';

const SAFN = 'https://skjalasafn.reykjavik.is/fotoweb';
const INFO = (n) => `${SAFN}/archives/5000-A%C3%B0aluppdr%C3%A6ttir/A%C3%B0aluppdr%C3%A6ttir/2009/12/2009-12-03_${n}.tif.info`;
const DAUD = (n) => `${SAFN}/cache/v2/Y/Z/A%C3%B0aluppdr%C3%A6ttir/2009/12/2009-12-03_${n}.tif.iCfzjfSHMrETQxNhkAMA.CeUhHo64ND.jpg`;
const KORTASJA = 'https://teikningar.hafnarfjordur.is/skjol/dalshraun-1b.pdf';
const teikn = (n) => ({ filename: n + '.tif', infoUrl: INFO(n), thumb: DAUD(n), lysing: 'Grunnmynd ' + n, tegund: 'Aðaluppdrættir', dags: '2009-12-03' });

// ── Hermdur vafri fyrir js/verkstadur.js ──────────────────────────────────────────────────────────────────────────
function vafri(svor) {
  const kost = [];                                    // öll fetch-köll: { url, opts }
  const hnutar = {};
  const hnutur = () => ({ innerHTML: '', textContent: '', value: '', hidden: false, disabled: false, style: {}, dataset: {}, onclick: null, onchange: null,
    isConnected: true, offsetParent: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, focus() {}, select() {}, querySelectorAll() { return []; }, querySelector() { return null; } });
  const el = hnutur();
  el.querySelector = (s) => (hnutar[s] = hnutar[s] || hnutur());
  const document = { querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {}, createElement: hnutur, activeElement: null,
    head: { appendChild() {} }, body: { appendChild() {} } };
  const fetch = async (url, opts) => {
    kost.push({ url: String(url), opts: opts || {} });
    const s = svor(String(url), opts || {});
    return { ok: true, status: 200, json: async () => s, text: async () => JSON.stringify(s) };
  };
  const ctx = vm.createContext({ window: {}, document, localStorage: { getItem() { return null; }, setItem() {} }, fetch, console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(ROT, 'js', 'verkstadur.js'), 'utf8'), ctx);
  return { V: ctx.window.BhVerkstadur, el, hnutar, kost };
}
const myndir = (html) => [...String(html).matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const afkoda = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('panill: dauðar fotoweb/cache-slóðir fara aldrei í <img> — smámyndin er sótt eftir infoUrl gegnum teikn-mynd', async () => {
  const row = { worksite_name: 'Grímsbær', heimilisfang: 'Efstaland 26, 108', hus: { eign: { svfnr: '0000', landnr: '108817' }, teikningar: { fjoldi: 3 } },
    teikningar: [teikn('124'), teikn('130'), { filename: 'dalshraun-1b.pdf', infoUrl: KORTASJA, thumb: null, lysing: 'Kortasjá' }] };
  const { V, el } = vafri((url) => (/\/api\/verkstadur\?ws=/.test(url) ? { row, ajour: null, bord: null } : {}));
  await V.teikna(el, 'Grímsbær', {});
  assert.ok(!/fotoweb\/cache/.test(el.innerHTML), 'engin fotoweb/cache-slóð í panilnum');
  const m = myndir(el.innerHTML).map(afkoda).filter((x) => /teikn-mynd/.test(x));
  assert.equal(m.length, 2, 'tvær Reykjavíkurteikningar → tvær smámyndir');
  for (const n of ['124', '130']) {
    const slod = 'https://slokkvitaeki.netlify.app/.netlify/functions/teikn-mynd?staerd=400&url=' + encodeURIComponent(INFO(n));
    assert.ok(m.some((x) => x.includes('src="' + slod + '"')), 'smámynd ' + n + ' sótt eftir permalink');
  }
  assert.ok(m.every((x) => /onerror="[^"]*kyvs-pdf[^"]*replaceWith/.test(x)), 'mynd sem næst ekki fær staðgengil');
  assert.ok(el.innerHTML.includes('<span class="kyvs-pdf">PDF</span>'), 'blað án forskoðunar (kortasjá) heldur PDF-merkinu');
  assert.ok(el.innerHTML.includes('href="' + INFO('124') + '"'), 'tengillinn á blaðið er óbreyttur');
});

test('teiknSmamynd: permalink ræður; önnur stöðug smámynd heldur sér; fotoweb/cache án permalinks → engin mynd', () => {
  const { V } = vafri(() => ({}));
  assert.match(V.teiknSmamynd(teikn('001')), /teikn-mynd\?staerd=400&url=https%3A%2F%2Fskjalasafn\.reykjavik\.is%2Ffotoweb%2Farchives%2F/);
  assert.equal(V.teiknSmamynd({ infoUrl: KORTASJA, thumb: 'https://x.test/smamynd.jpg' }), 'https://x.test/smamynd.jpg');
  assert.equal(V.teiknSmamynd({ infoUrl: KORTASJA, thumb: DAUD('9') }), '');
  assert.equal(V.teiknSmamynd({ infoUrl: KORTASJA, thumb: null }), '');
  assert.equal(V.teiknSmamynd(null), '');
});

test('„Sækja aftur": engin fotoweb/cache-slóð send til vistunar (infoUrl fylgir áfram)', async () => {
  const row = { worksite_name: 'Grímsbær', heimilisfang: 'Efstaland 26, 108', heimilisfang_heimild: 'handvirkt', hus: { eign: { svfnr: '0000' } }, teikningar: [teikn('124')] };
  const { V, el, hnutar, kost } = vafri((url, opts) => {
    if (/hus-upplysingar/.test(url)) return { eign: { svfnr: '0000', label: 'Efstaland 26', postnr: '108' }, results: [teikn('124'), teikn('130')], teikningar: { fjoldi: 2 } };
    if (/\/api\/verkstadur$/.test(url) && opts.method === 'POST') return { ok: true, row: Object.assign({}, row, { teikningar: JSON.parse(opts.body).teikningar }) };
    if (/\/api\/verkstadur\?ws=/.test(url)) return { row, ajour: null, bord: null };
    return {};
  });
  await V.teikna(el, 'Grímsbær', {});
  await hnutar['[data-vs="aftur"]'].onclick();
  const vistun = kost.find((k) => /\/api\/verkstadur$/.test(k.url) && k.opts.method === 'POST');
  assert.ok(vistun, 'vistun fór til /api/verkstadur');
  const b = JSON.parse(vistun.opts.body);
  assert.equal(b.action, 'vista');
  assert.equal(b.teikningar.length, 2);
  assert.ok(!/fotoweb\/cache/.test(vistun.opts.body), 'engin fotoweb/cache-slóð í vistuninni');
  assert.deepEqual(b.teikningar.map((t) => t.infoUrl).sort(), [INFO('124'), INFO('130')]);
  assert.ok(!/fotoweb\/cache/.test(el.innerHTML), 'og engin í panilnum eftir endursókn');
});

test('þjónn (verkstadur): fotoweb/cache-slóð er ekki geymd þótt gamall vafri sendi hana', async () => {
  const F = require(path.join(ROT, 'netlify', 'functions', 'verkstadur.js'));
  const sent = [];
  const upprunalegt = global.fetch;
  global.fetch = async (url, opts) => {
    sent.push({ url: String(url), opts: opts || {} });
    return { ok: true, status: 201, json: async () => [JSON.parse((opts && opts.body) || '{}')], text: async () => '' };
  };
  try {
    const r = await F._innra({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'vista', ws: 'Grímsbær', heimilisfang: 'Efstaland 26, 108',
      teikningar: [teikn('124'), { infoUrl: KORTASJA, thumb: 'https://x.test/smamynd.jpg' }], by: 'próf' }) });
    assert.equal(r.statusCode, 200);
  } finally { global.fetch = upprunalegt; }
  const skrif = sent.find((s) => /\/rest\/v1\/verkstadur_info\?on_conflict=worksite_name/.test(s.url));
  assert.ok(skrif, 'röðin var skrifuð');
  const rod = JSON.parse(skrif.opts.body);
  assert.equal(rod.teikningar[0].thumb, null, 'fotoweb/cache-slóðin hreinsuð');
  assert.equal(rod.teikningar[0].infoUrl, INFO('124'), 'permalinkurinn geymdur');
  assert.equal(rod.teikningar[1].thumb, 'https://x.test/smamynd.jpg', 'önnur smámynd ósnert');
});

// ── Villuskráin: ein bilun = ein röð ──────────────────────────────────────────────────────────────────────────────
function villuGrunnur() {
  const radir = []; let nid = 1;
  const upprunalegt = global.fetch;
  global.fetch = async (url, opts) => {
    url = String(url); opts = opts || {};
    const svar = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (!/\/rest\/v1\/villur/.test(url)) return svar(200, []);
    if (opts.method === 'POST') {
      const r = JSON.parse(opts.body);
      if (radir.some((x) => x.fingrafar === r.fingrafar)) return svar(409, {});
      radir.push(Object.assign({ id: nid++ }, r)); return svar(201, {});
    }
    if (opts.method === 'PATCH') {
      const id = +(/id=eq\.(\d+)/.exec(url) || [])[1];
      Object.assign(radir.find((x) => x.id === id) || {}, JSON.parse(opts.body)); return svar(204, {});
    }
    const fp = decodeURIComponent((/fingrafar=eq\.([^&]+)/.exec(url) || [])[1] || '');
    return svar(200, radir.filter((x) => x.fingrafar === fp).map((x) => ({ id: x.id, fjoldi: x.fjoldi })));
  };
  return { radir, loka() { global.fetch = upprunalegt; } };
}
const skra = (F, b) => F._innra({ httpMethod: 'POST', headers: {}, body: JSON.stringify(Object.assign({ uppruni: 'brunaholf', slod: '/#vidskiptavinir' }, b)) });

test('villur: 24 dauðar smámyndir af sama hýsli → EIN röð með fjoldi 24 og nýjasta dæminu', async () => {
  const F = require(path.join(ROT, 'netlify', 'functions', 'villur.js'));
  const g = villuGrunnur();
  try {
    for (let i = 1; i <= 24; i++) {
      const r = await skra(F, { tegund: 'audlind', skilabod: 'Náði ekki í img', skra: DAUD(String(i).padStart(3, '0')) });
      assert.equal(r.statusCode, 200);
    }
  } finally { g.loka(); }
  assert.equal(g.radir.length, 1, 'ein röð, ekki 24');
  assert.equal(g.radir[0].fjoldi, 24);
  assert.equal(g.radir[0].skra, DAUD('024'), 'röðin sýnir nýjasta dæmið — heila slóð sem hægt er að prófa');
  assert.equal(g.radir[0].fingrafar, 'brunaholf|Náði ekki í img|https://skjalasafn.reykjavik.is/fotoweb/cache/…');
});

test('villur: sama fall með ólíkri fyrirspurn er sama villan; ólíkar eigin skrár og aðrar villutegundir haldast aðskildar', async () => {
  const F = require(path.join(ROT, 'netlify', 'functions', 'villur.js'));
  const g = villuGrunnur();
  const TM = 'https://slokkvitaeki.netlify.app/.netlify/functions/teikn-mynd?url=';
  try {
    await skra(F, { tegund: 'audlind', skilabod: 'Náði ekki í img', skra: TM + 'a.pdf' });
    await skra(F, { tegund: 'audlind', skilabod: 'Náði ekki í img', skra: TM + 'b.pdf' });
    await skra(F, { tegund: 'audlind', skilabod: 'Náði ekki í img', skra: 'https://brunaholf.netlify.app/img/a.png?v=1' });
    await skra(F, { tegund: 'audlind', skilabod: 'Náði ekki í img', skra: 'https://brunaholf.netlify.app/img/b.png' });
    await skra(F, { tegund: 'audlind', skilabod: 'Náði ekki í script', skra: 'https://slokkvitaeki.netlify.app/js/_bundle-4.1159411ec1.js' });
    await skra(F, { tegund: 'audlind', skilabod: 'Náði ekki í script', skra: 'https://slokkvitaeki.netlify.app/js/_bundle-4.c692664506.js' });
    await skra(F, { tegund: 'onerror', skilabod: 'x is not defined', skra: 'https://brunaholf.netlify.app/index.html:10:5' });
    await skra(F, { tegund: 'onerror', skilabod: 'x is not defined', skra: 'https://brunaholf.netlify.app/index.html:20:5' });
  } finally { g.loka(); }
  const fp = g.radir.map((x) => x.fingrafar);
  assert.equal(fp.filter((x) => /teikn-mynd/.test(x)).length, 1, 'teikn-mynd?url=… er ein röð');
  assert.equal(fp.filter((x) => /\/img\//.test(x)).length, 2, 'tvær ólíkar myndaskrár á eigin vef eru tvær raðir');
  assert.equal(fp.filter((x) => /_bundle-4/.test(x)).length, 1, 'sami pakki með nýju tætigildi eftir birtingu er ein röð');
  assert.equal(fp.filter((x) => /index\.html/.test(x)).length, 2, 'JS-villur (ekki auðlind) eru óbreyttar: skrá:lína:dálkur ræður');
  assert.equal(g.radir.length, 6);
});

test('audlindLykill: brúnirnar', () => {
  const { _audlindLykill: L } = require(path.join(ROT, 'netlify', 'functions', 'villur.js'));
  assert.equal(L(DAUD('001')), 'https://skjalasafn.reykjavik.is/fotoweb/cache/…');
  assert.equal(L('https://fonts.gstatic.com/s/inter.woff2'), 'https://fonts.gstatic.com/s/inter.woff2');
  assert.equal(L('https://brunaholf.netlify.app/css/theme.css?v=3#x'), 'https://brunaholf.netlify.app/css/theme.css');
  assert.equal(L('https://slokkvitaeki.netlify.app/js/_bundle-1.4bf996ad8d.js'), 'https://slokkvitaeki.netlify.app/js/_bundle-1.*.js');
  assert.equal(L('ekki-slod?x=1'), 'ekki-slod');
  assert.equal(L(null), null);
  assert.equal(L(''), '');
});
