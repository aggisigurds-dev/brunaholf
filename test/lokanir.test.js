// Próf: „burt með þessar lokanir“ (Agnar 18.11.2026) — tools/_lokanir.cjs + lotu-byrjun.cjs + router.cjs.
// Keyrsla: node --test test/lokanir.test.js
//
// AF HVERJU: þrjár lotur stöðvuðust 18.11.2026 á innskráningu („Búinn að skrá inn / Nota Chrome“), földum vafraglugga og
// skjali sem komst ekki í opinbert repó. Leiðbeiningarnar voru til, en aðeins í ~/.claude/CLAUDE.md á einni vél; loturnar
// sem spurðu enn keyrðu á öðrum vélum. Hookarnir í þessu repói keyra í hverri lotu á hverri vél — lagfæringin býr því þar.
// Það sem má ALDREI bila:
//   1. hver NÝ lota fær kaflann (SessionStart), og lota sem var þegar í gangi fær hann EINU SINNI (UserPromptSubmit);
//   2. notendaskráin á vélinni fær kaflana ef þá vantar — en engu er nokkurn tíma yfirskrifað eða eytt úr henni;
//   3. kafli sem eigandinn breytti eða tæmdi á vélinni kemur EKKI aftur (merkið dugar);
//   4. bilun (snið vantar, skrifvarin mappa, skemmd skrá) fellir aldrei lotuna — hookurinn skilar samt gildu úttaki;
//   5. í skránum er hvorki kaka né lykill, og uid 1 er hvergi myntað.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROT = path.join(__dirname, '..');
const LOK = require(path.join(ROT, 'tools', '_lokanir.cjs'));
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), 'lokanir-' + n + '-'));
const lesa = (p) => fs.readFileSync(p, 'utf8');
const A = '<!-- lotukerfi:innskraning byrjar', B = '<!-- lotukerfi:lokanir byrjar';

test('kaflinn í byrjun lotu: stuttur, nefnir þrjár lokanirnar og hvar skjöl eiga heima', () => {
  const t = LOK.texti({ rot: path.join('X:', 'verk') });
  assert.match(t, /^Lokanir \(Agnar 18\.11\.2026/);
  assert.match(t, /uid 10 \(aldrei uid 1\)/);
  assert.match(t, /Búinn að skrá inn \/ Nota Chrome/);
  assert.match(t, /read_page, get_page_text og javascript_tool/);
  assert.match(t, /fara ALDREI í repó/); assert.match(t, /farðu ekki framhjá henni/);
  assert.ok(t.includes(path.join('X:', 'verk', '_vinnuskjol')), 'vinnuskjalamappan er reiknuð frá rót repóanna á ÞESSARI vél');
  assert.ok(t.length < 1500, 'kaflinn kostar tóka í hverri lotu — ' + t.length + ' stafir');
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}|session_secret\s*[:=]/.test(t));
});

test('sniðið (docs/NOTANDA-CLAUDE.md): báðir kaflar með byrjunar- og endamerki, engin kaka né lykill', () => {
  const k = LOK.lesaSnid();
  assert.deepEqual(Object.keys(k).sort(), ['innskraning', 'lokanir']);
  for (const n of ['innskraning', 'lokanir']) {
    assert.ok(k[n].startsWith('<!-- lotukerfi:' + n + ' byrjar'), n);
    assert.ok(k[n].endsWith('<!-- lotukerfi:' + n + ' endar -->'), n);
  }
  assert.match(k.innskraning, /innri\.lotu_koku\(10, 2\)/);
  assert.match(k.innskraning, /Myntaðu ALDREI uid 1/);
  assert.match(k.innskraning, /Skrifaðu kökuna ALDREI/);
  assert.ok(!/lotu_koku\(\s*1\s*,/.test(k.innskraning), 'sniðið má hvergi sýna myntun á uid 1');
  assert.match(k.lokanir, /Falinn vafragluggi/); assert.match(k.lokanir, /fara aldrei í repó/);
  const allt = lesa(LOK.SNID);
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(allt), 'engin kaka (JWT/undirrituð) í sniðinu');
  assert.ok(!/session_secret\s*[:=]|service_role[^\n]{0,20}eyJ|sk-ant-/.test(allt), 'enginn lykill í sniðinu');
});

test('notendaskrá vantar → búin til með báðum köflum; önnur keyrsla breytir engu', () => {
  const heima = tmp('ny');
  const r = LOK.tryggjaNotandaskra({ heima });
  assert.deepEqual(r, { stada: 'buin_til', kaflar: ['innskraning', 'lokanir'] });
  const t = lesa(path.join(heima, 'CLAUDE.md'));
  assert.ok(t.includes(A) && t.includes(B));
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'til', kaflar: [] });
  assert.equal(lesa(path.join(heima, 'CLAUDE.md')), t, 'engin breyting í annarri keyrslu');
});

test('notendaskrá með ÖÐRU efni → kaflarnir bætast aftast; það sem fyrir var stendur óbreytt, staf fyrir staf', () => {
  const heima = tmp('annad'), skra = path.join(heima, 'CLAUDE.md');
  const fyrir = '# Mínar reglur\r\n\r\nAlltaf svara á íslensku.\r\nEkki nota töflur.';   // CRLF og enginn línuendi aftast
  fs.writeFileSync(skra, fyrir, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'baett_vid', kaflar: ['innskraning', 'lokanir'] });
  const t = lesa(skra);
  assert.ok(t.startsWith(fyrir + '\n\n' + A), 'eldra efni fremst, óbreytt, og autt bil á undan kaflanum');
  assert.equal((t.match(/lotukerfi:innskraning byrjar/g) || []).length, 1);
  assert.equal((t.match(/lotukerfi:lokanir byrjar/g) || []).length, 1);
});

test('vélin þar sem innskráningarkaflinn var handskrifaður (án merkis) fær AÐEINS lokanakaflann — engin tvítekning', () => {
  const heima = tmp('eldri'), skra = path.join(heima, 'CLAUDE.md');
  const fyrir = '# Leiðbeiningar Agnars\n\n## Innskráning í Slökkvitæki / Brunahólf — lotan skráir sig inn SJÁLF (18.11.2026)\n\ntexti\n';
  fs.writeFileSync(skra, fyrir, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'baett_vid', kaflar: ['lokanir'] });
  const t = lesa(skra);
  assert.ok(t.startsWith(fyrir) && t.includes(B) && !t.includes(A));
  assert.equal((t.match(/lotan skráir sig inn SJÁLF/g) || []).length, 1, 'innskráningarkaflinn er ekki tvítekinn');
});

test('kafli sem eigandinn tæmdi eða breytti á vélinni kemur EKKI aftur — merkið dugar', () => {
  const heima = tmp('breytt'), skra = path.join(heima, 'CLAUDE.md');
  const mitt = A + ' -->\n(ég tók þetta út)\n\n' + B + ' -->\nMín eigin útgáfa.\n';
  fs.writeFileSync(skra, mitt, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'til', kaflar: [] });
  assert.equal(lesa(skra), mitt);
});

test('bilun fellir aldrei neitt: snið vantar, hálfur kafli í sniði, heimamappa sem er skrá', () => {
  const heima = tmp('villa');
  const r1 = LOK.tryggjaNotandaskra({ heima, snid: path.join(heima, 'ekki-til.md') });
  assert.equal(r1.stada, 'villa'); assert.ok(r1.villa);
  assert.ok(!fs.existsSync(path.join(heima, 'CLAUDE.md')), 'ekkert skrifað þegar sniðið vantar');
  // Snið þar sem endamerki annars kaflans vantar: sá kafli fer EKKI inn (aldrei hálfur kafli), hinn fer.
  const snid = path.join(heima, 'snid.md');
  fs.writeFileSync(snid, A + ' -->\nA-texti\n<!-- lotukerfi:innskraning endar -->\n\n' + B + ' -->\nB-texti án endamerkis\n', 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima, snid }), { stada: 'buin_til', kaflar: ['innskraning'] });
  assert.ok(!lesa(path.join(heima, 'CLAUDE.md')).includes('B-texti'));
  // „Heimamappa“ sem er skrá → villa, ekkert kast.
  const skra = path.join(heima, 'er-skra'); fs.writeFileSync(skra, 'x');
  assert.equal(LOK.tryggjaNotandaskra({ heima: skra }).stada, 'villa');
});

test('einuSinni: satt í fyrsta sinn fyrir hverja lotu, aldrei aftur; án lotunúmers aldrei; skemmd skrá fellir ekkert', () => {
  const heima = tmp('sed');
  assert.equal(LOK.einuSinni('lota-a', { heima }), true);
  assert.equal(LOK.einuSinni('lota-a', { heima }), false);
  assert.equal(LOK.einuSinni('lota-b', { heima }), true);
  for (const x of [undefined, null, '']) assert.equal(LOK.einuSinni(x, { heima }), false, 'án lotunúmers: ' + String(x));
  // merkja (lotu-byrjun) → router sýnir kaflann ekki aftur í sömu lotu
  assert.equal(LOK.merkja('lota-c', { heima }), true);
  assert.equal(LOK.einuSinni('lota-c', { heima }), false);
  // Skráin heldur mest 300 nýjustu lotum.
  for (let i = 0; i < 320; i++) LOK.merkja('fjoldi-' + i, { heima, nu: 1000 + i });
  const s = JSON.parse(lesa(path.join(heima, 'lokanir-sed.json')));
  assert.equal(Object.keys(s).length, 300);
  assert.ok(s['fjoldi-319'] && !s['fjoldi-0']);
  // Skemmd skrá: lesin sem tóm, ekkert kast.
  fs.writeFileSync(path.join(heima, 'lokanir-sed.json'), '{skemmt', 'utf8');
  assert.equal(LOK.einuSinni('lota-d', { heima }), true);
  // Heimamappa sem ekki er hægt að skrifa í → false (betra að þegja en að endurtaka í hverju skeyti).
  const skra = path.join(heima, 'er-skra'); fs.writeFileSync(skra, 'x');
  assert.equal(LOK.einuSinni('lota-e', { heima: skra }), false);
});

/* ── Hookarnir sjálfir, keyrðir sem ferli eins og Claude Code keyrir þá ───────────────────────────── */
// Heimamappan er prófmappa (USERPROFILE/HOME) og SL_REPO bendir á tóma möppu → enginn Supabase-lykill → ekkert netkall.
function hook(skra, stdin, heima, arg = []) {
  const tom = tmp('tomt');
  const r = spawnSync(process.execPath, [path.join(ROT, 'tools', skra), ...arg], {
    input: JSON.stringify(stdin), encoding: 'utf8', timeout: 20000,
    // LOTUKERFI_UPPFAERSLA=0: prófið má hvorki sækja af netinu né hraðspóla raunverulegu vinnutré (sjá lotukerfi-uppfaersla.test.js).
    env: Object.assign({}, process.env, { USERPROFILE: heima, HOME: heima, SL_REPO: tom, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_KEY: '', LOTUKERFI_UPPFAERSLA: '0' }),
  });
  let ctx = '';
  try { ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch (_) { ctx = r.stdout || ''; }
  return { kodi: r.status, ctx, hratt: r.stdout };
}

test('lotu-byrjun (SessionStart): ný lota fær kaflann, notendaskráin er sett upp á vélinni og router endurtekur hann EKKI', () => {
  const heima = tmp('hook'), cwd = tmp('cwd');
  const b = hook('lotu-byrjun.cjs', { session_id: 'ny-lota-1', cwd, source: 'startup' }, heima);
  assert.equal(b.kodi, 0);
  assert.match(b.ctx, /^Keflið \(boðhlaup/, 'keflið er áfram fyrsta línan');
  assert.match(b.ctx, /\nLokanir \(Agnar 18\.11\.2026/);
  assert.match(b.ctx, /Lotuminnið|Síðustu lotur/, 'lotuminnið fylgir áfram á eftir');
  const skra = lesa(path.join(heima, '.claude', 'CLAUDE.md'));
  assert.ok(skra.includes(A) && skra.includes(B), 'notendaskráin sett upp á vélinni');
  // Sama lota sendir skeyti: router bætir kaflanum EKKI við aftur.
  const r1 = hook('router.cjs', { session_id: 'ny-lota-1', cwd, prompt: 'hæ' }, heima);
  assert.equal(r1.kodi, 0);
  assert.ok(!/Lokanir \(Agnar/.test(r1.ctx), 'engin endurtekning í lotu sem fékk kaflann í byrjun');
});

test('router (UserPromptSubmit): lota sem var ÞEGAR í gangi fær kaflann einu sinni, og vélin fær notendaskrána', () => {
  const heima = tmp('hook2'), cwd = tmp('cwd2');
  const r1 = hook('router.cjs', { session_id: 'gomul-lota', cwd, prompt: 'hæ' }, heima);
  assert.equal(r1.kodi, 0);
  assert.match(r1.ctx, /^Lokanir \(Agnar 18\.11\.2026/, 'fyrsta skeyti eftir uppfærslu ber kaflann: ' + r1.hratt.slice(0, 200));
  assert.ok(lesa(path.join(heima, '.claude', 'CLAUDE.md')).includes(A));
  const r2 = hook('router.cjs', { session_id: 'gomul-lota', cwd, prompt: 'og meira' }, heima);
  assert.ok(!/Lokanir \(Agnar/.test(r2.ctx), 'annað skeyti sömu lotu ber hann ekki');
  // Úttakið er gilt hook-JSON þegar eitthvað er sagt.
  const j = JSON.parse(r1.hratt);
  assert.equal(j.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
});

test('skoðunarhamur og tvítekningarvörn óbreytt: --texti skrifar ekkert á vélina; --notandi þegir þegar verkefnið á hookinn', () => {
  const heima = tmp('hook3'), cwd = tmp('cwd3');
  const t = hook('lotu-byrjun.cjs', { session_id: 'x', cwd }, heima, ['--texti']);
  assert.match(t.ctx, /Lokanir \(Agnar/);
  assert.ok(!fs.existsSync(path.join(heima, '.claude')), '--texti má ekkert skrifa');
  // Verkefnið sjálft á hookinn → notendahookurinn þegir alveg (annars kæmi allt tvisvar).
  fs.mkdirSync(path.join(cwd, '.claude'));
  fs.writeFileSync(path.join(cwd, '.claude', 'settings.json'), '{"hooks":{"SessionStart":[{"hooks":[{"command":"node tools/lotu-byrjun.cjs"}]}],"UserPromptSubmit":[{"hooks":[{"command":"node tools/router.cjs"}]}]}}');
  const n1 = hook('lotu-byrjun.cjs', { session_id: 'y', cwd }, heima, ['--notandi']);
  const n2 = hook('router.cjs', { session_id: 'y', cwd, prompt: 'hæ' }, heima, ['--notandi']);
  assert.deepEqual([n1.hratt, n2.hratt], ['', '']);
  assert.ok(!fs.existsSync(path.join(heima, '.claude', 'CLAUDE.md')));
});

test('hookurinn lifir af bilun: heimamappa sem ekki er hægt að skrifa í → lotan fær samt gilt úttak', () => {
  const grunnur = tmp('hook4'), cwd = tmp('cwd4');
  const heima = path.join(grunnur, 'heim'); fs.mkdirSync(heima);
  fs.writeFileSync(path.join(heima, '.claude'), 'þetta er skrá, ekki mappa');   // ~/.claude er skrá → öll skrif bregðast
  const b = hook('lotu-byrjun.cjs', { session_id: 'z', cwd }, heima);
  assert.equal(b.kodi, 0);
  assert.match(b.ctx, /Keflið/); assert.match(b.ctx, /Lokanir \(Agnar/);
  const r = hook('router.cjs', { session_id: 'z', cwd, prompt: 'hæ' }, heima);
  assert.equal(r.kodi, 0);
});
