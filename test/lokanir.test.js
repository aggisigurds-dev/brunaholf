// Próf: „burt með þessar lokanir“ (Agnar 18.11.2026) — tools/_lokanir.cjs + lotu-byrjun.cjs + router.cjs.
// Keyrsla: node --test test/lokanir.test.js
//
// AF HVERJU: þrjár lotur stöðvuðust 18.11.2026 á innskráningu („Búinn að skrá inn / Nota Chrome“), földum vafraglugga og
// skjali sem komst ekki í opinbert repó. Leiðbeiningarnar voru til, en aðeins í ~/.claude/CLAUDE.md á einni vél; loturnar
// sem spurðu enn keyrðu á öðrum vélum. Hookarnir í þessu repói keyra í hverri lotu á hverri vél — lagfæringin býr því þar.
// Það sem má ALDREI bila:
//   1. hver NÝ lota fær kaflann (SessionStart), og lota sem var þegar í gangi fær hann EINU SINNI (UserPromptSubmit);
//   2. kaflarnir í ~/.claude/CLAUDE.md eru eins og FRUMRITIÐ (claude-global/CLAUDE.md): bætt við ef vantar, uppfærðir ef
//      frumritið breytist — en efni UTAN merkjanna er aldrei snert og eldra eintak er alltaf afritað fyrst;
//   3. handvirka samstillingin (global-samstilling.cjs) og hookurinn eru sammála — annað þurrkar ekki út verk hins;
//   4. bilun (frumrit vantar, skrifvarin mappa, skemmd eða UTF-16 skrá) fellir aldrei lotuna og skemmir ekkert;
//   5. hvergi í leiðbeiningunum er lotu sagt að mynta uid 1, og í skránum er hvorki kaka né lykill.
// Prófin skrifa aðeins í tmp: heimamappa, vinnuskjalamappa og Supabase eru öll sett á prófgildi.
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
const fjoldi = (t, m) => t.split(m).length - 1;
const A = '<!-- lotukerfi:innskraning byrjar', B = '<!-- lotukerfi:lokanir byrjar';
const A_END = '<!-- lotukerfi:innskraning endar -->', B_END = '<!-- lotukerfi:lokanir endar -->';
const afrit = (heima) => { const m = path.join(heima, 'backups', 'lotukerfi'); return fs.existsSync(m) ? fs.readdirSync(m).map((d) => path.join(m, d, 'CLAUDE.md')) : []; };

test('kaflinn í byrjun lotu: stuttur, nefnir lokanirnar þrjár, allt sem Agnar á sjálfur og hvar skjöl eiga heima', () => {
  const mappa = path.join('X:', 'verk', '_vinnuskjol');
  const t = LOK.texti({ mappa });
  assert.match(t, /^Lokanir \(Agnar 18\.11\.2026/);
  assert.match(t, /uid 10 \(aldrei uid 1\)/);
  assert.match(t, /Búinn að skrá inn \/ Nota Chrome/);
  assert.match(t, /read_page, get_page_text og javascript_tool/);
  assert.match(t, /fara ALDREI í repó/); assert.match(t, /farðu ekki framhjá henni/);
  assert.ok(t.includes(mappa));
  // Það sem lotan má ALDREI gera án Agnars verður allt að vera talið upp — annars les lota „augljós næstu skref“ of vítt.
  for (const ord of ['póst/SMS', 'kröfur/reikninga/kredit/peninga', 'eyðingu gagna', 'sameiningu fyrirtækja', 'kennitölu eða verði', 'borð annarra']) assert.ok(t.includes(ord), ord);
  assert.ok(t.length < 1500, 'kaflinn kostar tóka í hverri lotu — ' + t.length + ' stafir');
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}|session_secret\s*[:=]/.test(t));
});

test('vinnuskjalamappan er við hlið AÐALvinnutrésins — líka úr worktree — og aldrei inni í repói', () => {
  const rot = tmp('tre');
  const adal = path.join(rot, 'verk', 'brunaholf'); fs.mkdirSync(path.join(adal, '.git', 'worktrees', 'x'), { recursive: true });
  // worktree við hliðina (eins og C:\projects\brunaholf-img404) og worktree INNI í repóinu (.claude/worktrees/x)
  for (const wt of [path.join(rot, 'verk', 'bh-grein'), path.join(adal, '.claude', 'worktrees', 'x')]) {
    fs.mkdirSync(wt, { recursive: true });
    fs.writeFileSync(path.join(wt, '.git'), 'gitdir: ' + path.join(adal, '.git', 'worktrees', 'x').replace(/\\/g, '/') + '\n');
    assert.equal(LOK.adalRepo(wt), adal);
    assert.equal(LOK.vinnuskjol({ bh: wt }), path.join(rot, 'verk', '_vinnuskjol'), 'úr ' + wt);
  }
  assert.equal(LOK.vinnuskjol({ bh: adal }), path.join(rot, 'verk', '_vinnuskjol'));
  assert.equal(LOK.adalRepo(path.join(rot, 'ekki-repo')), path.join(rot, 'ekki-repo'), 'ekkert .git → mappan sjálf, ekkert kast');
  assert.match(lesa(path.join(ROT, '.gitignore')), /^_vinnuskjol\/$/m, 'til vara: mappan er í .gitignore');
});

test('frumritið (claude-global/CLAUDE.md): báðir kaflar með merkjum; hvergi myntun á uid 1, kaka né lykill', () => {
  assert.equal(LOK.SNID, path.join(ROT, 'claude-global', 'CLAUDE.md'), 'eitt frumrit — það sama og global-samstilling notar');
  const k = LOK.lesaSnid();
  assert.deepEqual(Object.keys(k).sort(), ['innskraning', 'lokanir']);
  for (const n of ['innskraning', 'lokanir']) {
    assert.ok(k[n].startsWith('<!-- lotukerfi:' + n + ' byrjar'), n);
    assert.ok(k[n].endsWith('<!-- lotukerfi:' + n + ' endar -->'), n);
  }
  assert.match(k.innskraning, /innri\.lotu_koku\(10, 2\)/);
  assert.match(k.innskraning, /Myntaðu ALDREI uid 1/);
  assert.match(k.innskraning, /Skrifaðu kökuna ALDREI/);
  assert.match(k.lokanir, /Falinn vafragluggi/); assert.match(k.lokanir, /fara aldrei í repó/);
  for (const ord of ['póst og SMS', 'kröfur, reikninga, kredit og peninga', 'eyðingu', 'sameiningu fyrirtækja', 'kennitölu eða verði', 'borð annarra starfsmanna']) assert.ok(lf(k.lokanir).replace(/\n\s*/g, ' ').includes(ord), ord);
  // Allar leiðbeiningar sem lotur lesa um innskráningu: hvergi má standa kall sem myntar uid 1 (úreltur kafli í CLAUDE.md
  // gerði það til 18.11.2026 — kaflinn í byrjun lotu vísar á „Innskráning lotunnar“ og má ekki vísa á slíkt).
  for (const skra of ['CLAUDE.md', path.join('claude-global', 'CLAUDE.md')]) {
    const t = lesa(path.join(ROT, skra));
    assert.ok(!/lotu_koku\(\s*1\s*[,)]/.test(t), skra + ' má hvergi sýna myntun á uid 1');
    assert.ok(!/lotu_koku\(\s*\)/.test(t), skra + ': kall án uid er ekki sýnt');
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(t), skra + ': engin kaka (JWT/undirrituð)');
    assert.ok(!/session_secret\s*[:=]|sk-ant-/.test(t), skra + ': enginn lykill');
  }
  assert.equal(fjoldi(lesa(path.join(ROT, 'CLAUDE.md')), '## Innskráning lotunnar'), 1, 'einn kafli um innskráningu í CLAUDE.md, ekki tveir sem stangast á');
});
function lf(s) { return s.replace(/\r\n/g, '\n'); }

test('notendaskrá vantar → búin til með báðum köflum; önnur keyrsla breytir engu', () => {
  const heima = tmp('ny');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'buin_til', kaflar: ['innskraning', 'lokanir'] });
  const t = lesa(path.join(heima, 'CLAUDE.md'));
  assert.equal(fjoldi(t, A), 1); assert.equal(fjoldi(t, B), 1);
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'til', kaflar: [] });
  assert.equal(lesa(path.join(heima, 'CLAUDE.md')), t, 'engin breyting í annarri keyrslu');
  assert.deepEqual(afrit(heima), [], 'ný skrá: ekkert að afrita');
});

test('notendaskrá með ÖÐRU efni → kaflarnir bætast aftast; það sem fyrir var stendur staf fyrir staf og er afritað fyrst', () => {
  const heima = tmp('annad'), skra = path.join(heima, 'CLAUDE.md');
  const fyrir = '# Mínar reglur\r\n\r\nAlltaf svara á íslensku.\r\nEkki nota töflur.';   // CRLF og enginn línuendi aftast
  fs.writeFileSync(skra, fyrir, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'baett_vid', kaflar: ['innskraning', 'lokanir'] });
  const t = lesa(skra);
  assert.ok(t.startsWith(fyrir + '\n\n' + A), 'eldra efni fremst, óbreytt, og autt bil á undan kaflanum');
  assert.equal(fjoldi(t, A), 1); assert.equal(fjoldi(t, B), 1);
  const a = afrit(heima); assert.equal(a.length, 1); assert.equal(lesa(a[0]), fyrir, 'eldra eintak geymt óbreytt');
  // tóm skrá: kaflarnir fara inn án auðra lína fremst
  const h2 = tmp('tom'); fs.writeFileSync(path.join(h2, 'CLAUDE.md'), '');
  assert.equal(LOK.tryggjaNotandaskra({ heima: h2 }).stada, 'baett_vid');
  assert.ok(lesa(path.join(h2, 'CLAUDE.md')).startsWith(A));
});

test('vélin þar sem innskráningarkaflinn var handskrifaður (án merkja) fær AÐEINS lokanakaflann — engin tvítekning', () => {
  const heima = tmp('eldri'), skra = path.join(heima, 'CLAUDE.md');
  const fyrir = '# Leiðbeiningar Agnars\n\n## Innskráning í Slökkvitæki / Brunahólf — lotan skráir sig inn SJÁLF (18.11.2026)\n\ntexti\n';
  fs.writeFileSync(skra, fyrir, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'baett_vid', kaflar: ['lokanir'] });
  const t = lesa(skra);
  assert.ok(t.startsWith(fyrir) && t.includes(B) && !t.includes(A));
  assert.equal(fjoldi(t, 'lotan skráir sig inn SJÁLF'), 1, 'innskráningarkaflinn er ekki tvítekinn');
});

test('LEIÐRÉTTING BERST: kafli með báðum merkjum en gömlu efni (t.d. „myntaðu uid 1“) er uppfærður á sínum stað', () => {
  const heima = tmp('gamalt'), skra = path.join(heima, 'CLAUDE.md');
  const fyrir = '# Mitt efni fremst\n\n' + A + ' -->\nGömul útgáfa: select * from innri.lotu_koku(1, 12);\n' + A_END + '\n\n# Mitt efni á milli\n\n'
    + LOK.lesaSnid().lokanir + '\n\n# Mitt efni aftast\n';
  fs.writeFileSync(skra, fyrir, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'uppfaert', kaflar: ['innskraning'] });
  const t = lesa(skra);
  assert.ok(!t.includes('lotu_koku(1, 12)'), 'gamla, hættulega útgáfan er farin');
  assert.ok(t.includes(LOK.lesaSnid().innskraning), 'kaflinn er nú eins og frumritið');
  assert.ok(t.startsWith('# Mitt efni fremst\n\n' + A), 'efni fyrir framan ósnert');
  assert.ok(t.includes(A_END + '\n\n# Mitt efni á milli\n\n' + B), 'efni á milli kafla ósnert');
  assert.ok(t.endsWith(B_END + '\n\n# Mitt efni aftast\n'), 'efni fyrir aftan ósnert');
  assert.equal(fjoldi(t, A), 1); assert.equal(fjoldi(t, B), 1);
  const a = afrit(heima); assert.equal(a.length, 1); assert.equal(lesa(a[0]), fyrir, 'eldra eintak afritað áður en skrifað var');
  assert.deepEqual(fs.readdirSync(heima).filter((f) => /\.tmp$|-las$/.test(f)), [], 'hvorki bráðabirgðaskrá né lás skilin eftir');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'til', kaflar: [] }, 'önnur keyrsla breytir engu');
  assert.equal(afrit(heima).length, 1, 'ekkert nýtt afrit þegar ekkert breytist');
});

test('ósnert: kafli sem eigandinn tók yfir (endamerki fjarlægt), og skrá sem munar aðeins á línuendum (CRLF)', () => {
  // endamerki fjarlægt → kaflinn er eigandans; hvorki uppfærður né bætt við aftur
  const heima = tmp('yfirtekid'), skra = path.join(heima, 'CLAUDE.md');
  const mitt = A + ' -->\n(mín eigin útgáfa, engin endamerki)\n\n' + B + ' -->\nLíka mín.\n';
  fs.writeFileSync(skra, mitt, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'til', kaflar: [] });
  assert.equal(lesa(skra), mitt);
  // sama efni með CRLF (t.d. opnað og vistað í Notepad) telst EKKI breyting → engin endurskrif í hverri lotu
  const h2 = tmp('crlf'), s2 = path.join(h2, 'CLAUDE.md');
  LOK.tryggjaNotandaskra({ heima: h2 });
  const crlf = lesa(s2).replace(/\n/g, '\r\n'); fs.writeFileSync(s2, crlf, 'utf8');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima: h2 }), { stada: 'til', kaflar: [] });
  assert.equal(lesa(s2), crlf);
});

test('skrá sem er ekki UTF-8 (UTF-16 úr Notepad, skemmd bæti) er EKKI snert — efni eigandans má ekki skemmast', () => {
  const daemi = [['utf16', Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('# Mínar reglur\r\n', 'utf16le')])], ['skemmd', Buffer.from([0x23, 0x20, 0xC3, 0x28, 0x0A])]];
  for (const [heiti, baeti] of daemi) {
    const heima = tmp(heiti), skra = path.join(heima, 'CLAUDE.md');
    fs.writeFileSync(skra, baeti);
    const r = LOK.tryggjaNotandaskra({ heima });
    assert.equal(r.stada, 'sleppt', heiti); assert.deepEqual(r.kaflar, []);
    assert.ok(fs.readFileSync(skra).equals(baeti), heiti + ': bætin óbreytt');
  }
  // UTF-8 með BOM er í lagi og BOM-ið helst fremst
  const heima = tmp('bom'), skra = path.join(heima, 'CLAUDE.md');
  fs.writeFileSync(skra, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('# Mitt\n', 'utf8')]));
  assert.equal(LOK.tryggjaNotandaskra({ heima }).stada, 'baett_vid');
  const b = fs.readFileSync(skra);
  assert.deepEqual([...b.subarray(0, 3)], [0xEF, 0xBB, 0xBF]); assert.ok(b.toString('utf8').includes(A));
});

test('handvirka samstillingin og hookurinn eru sammála: hvorugt þurrkar út verk hins (sama frumrit)', () => {
  const heima = tmp('samst');
  const keyra = (kodi) => {
    const r = spawnSync(process.execPath, ['-e', kodi], { cwd: ROT, encoding: 'utf8', timeout: 20000, env: Object.assign({}, process.env, { BH_GLOBAL_HEIMA: heima, BH_GLOBAL_SAMSTILLING: '' }) });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const samstilla = () => keyra('const r=require("./tools/global-samstilling.cjs").samstilla();process.stdout.write(JSON.stringify({breytt:r.breytt,villur:r.villur}))');
  // 1. hookurinn fyrst (ný vél) → handvirk samstilling yfirskrifar með öllu frumritinu → hookurinn hefur ekkert að gera
  assert.equal(LOK.tryggjaNotandaskra({ heima }).stada, 'buin_til');
  const s1 = samstilla();
  assert.deepEqual(s1.villur, []); assert.ok(s1.breytt.includes('CLAUDE.md'), 'samstillingin setti allt frumritið inn: ' + s1.breytt.join(','));
  const eftir = fs.readFileSync(path.join(heima, 'CLAUDE.md'));
  assert.ok(eftir.equals(fs.readFileSync(LOK.SNID)), 'afritið er nú frumritið í heild');
  assert.ok(eftir.includes(A) && eftir.includes(B), 'kaflarnir lifðu samstillinguna af — þeir ERU í frumritinu');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'til', kaflar: [] });
  // 2. og öfugt: eftir hookinn sér samstillingin engan mun á CLAUDE.md
  assert.ok(!samstilla().breytt.includes('CLAUDE.md'), 'engin víxlverkun: önnur samstilling breytir engu');
  assert.ok(fs.readFileSync(path.join(heima, 'CLAUDE.md')).equals(eftir));
});

test('bilun fellir aldrei neitt: frumrit vantar, hálfur kafli í frumriti, heimamappa sem er skrá', () => {
  const heima = tmp('villa');
  const r1 = LOK.tryggjaNotandaskra({ heima, snid: path.join(heima, 'ekki-til.md') });
  assert.equal(r1.stada, 'villa'); assert.ok(r1.villa);
  assert.ok(!fs.existsSync(path.join(heima, 'CLAUDE.md')), 'ekkert skrifað þegar frumritið vantar');
  // Frumrit þar sem endamerki annars kaflans vantar: sá kafli fer EKKI inn (aldrei hálfur kafli), hinn fer.
  const snid = path.join(heima, 'snid.md');
  fs.writeFileSync(snid, A + ' -->\nA-texti\n' + A_END + '\n\n' + B + ' -->\nB-texti án endamerkis\n', 'utf8');
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
  assert.deepEqual(fs.readdirSync(heima).filter((f) => f.endsWith('.tmp')), [], 'engar bráðabirgðaskrár skildar eftir');
  // Skemmd skrá: lesin sem tóm, ekkert kast.
  fs.writeFileSync(path.join(heima, 'lokanir-sed.json'), '{skemmt', 'utf8');
  assert.equal(LOK.einuSinni('lota-d', { heima }), true);
  // Heimamappa sem ekki er hægt að skrifa í → false (betra að þegja en að endurtaka í hverju skeyti).
  const skra = path.join(heima, 'er-skra'); fs.writeFileSync(skra, 'x');
  assert.equal(LOK.einuSinni('lota-e', { heima: skra }), false);
});

/* ── Hookarnir sjálfir, keyrðir sem ferli eins og Claude Code keyrir þá ───────────────────────────── */
// Allt á prófgildum: heimamappa (USERPROFILE/HOME), vinnuskjalamappa (LOTUKERFI_VINNUSKJOL), tóm SL_REPO → enginn
// Supabase-lykill → ekkert netkall, og LOTUKERFI_UPPFAERSLA=0 → ekkert spurt um origin (sjá lotukerfi-uppfaersla.test.js).
function hook(skra, stdin, heima, arg = []) {
  const tom = tmp('tomt'), vs = path.join(tmp('vs'), '_vinnuskjol');
  const r = spawnSync(process.execPath, [path.join(ROT, 'tools', skra), ...arg], {
    input: JSON.stringify(stdin), encoding: 'utf8', timeout: 20000,
    env: Object.assign({}, process.env, { USERPROFILE: heima, HOME: heima, SL_REPO: tom, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_KEY: '', LOTUKERFI_UPPFAERSLA: '0', LOTUKERFI_VINNUSKJOL: vs }),
  });
  let ctx = '';
  try { ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch (_) { ctx = r.stdout || ''; }
  return { kodi: r.status, ctx, hratt: r.stdout, vs };
}

test('lotu-byrjun (SessionStart): ný lota fær kaflann, vélin fær notendaskrá og vinnuskjalamöppu, router endurtekur EKKI', () => {
  const heima = tmp('hook'), cwd = tmp('cwd');
  const b = hook('lotu-byrjun.cjs', { session_id: 'ny-lota-1', cwd, source: 'startup' }, heima);
  assert.equal(b.kodi, 0);
  assert.match(b.ctx, /^Keflið \(boðhlaup/, 'keflið er áfram fyrsta línan');
  assert.match(b.ctx, /\nLokanir \(Agnar 18\.11\.2026/);
  assert.match(b.ctx, /Lotuminnið|Síðustu lotur/, 'lotuminnið fylgir áfram á eftir');
  assert.ok(b.ctx.includes(b.vs), 'kaflinn nefnir vinnuskjalamöppu ÞESSARAR vélar');
  assert.ok(fs.statSync(b.vs).isDirectory(), 'og mappan er til');
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
  assert.ok(!fs.existsSync(path.join(heima, '.claude')), '--texti má ekkert skrifa í heimamöppuna');
  assert.ok(!fs.existsSync(t.vs), '--texti býr ekki til vinnuskjalamöppuna');
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

test('hookarnir lifa af að nýju einingarnar vanti eða séu gallaðar (hálfsótt útgáfa): require er inni í try', () => {
  // Afrit af tools/ þar sem _lokanir.cjs er gölluð og _uppfaera.cjs vantar → lotu-byrjun og router skila samt gildu úttaki.
  const rot = tmp('gallad'), tools = path.join(rot, 'bh', 'tools'), heima = tmp('hook5'), cwd = tmp('cwd5');
  fs.mkdirSync(tools, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROT, 'tools'))) { const p = path.join(ROT, 'tools', f); if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(tools, f)); }
  fs.writeFileSync(path.join(tools, '_lokanir.cjs'), 'þetta er ekki javascript {{{');
  fs.unlinkSync(path.join(tools, '_uppfaera.cjs'));
  for (const d of ['data', 'docs']) { try { fs.cpSync(path.join(ROT, d), path.join(rot, 'bh', d), { recursive: true }); } catch (_) {} }
  const keyra = (skra, stdin) => spawnSync(process.execPath, [path.join(tools, skra)], { input: JSON.stringify(stdin), encoding: 'utf8', timeout: 20000,
    env: Object.assign({}, process.env, { USERPROFILE: heima, HOME: heima, SL_REPO: tmp('tomt'), SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_KEY: '', LOTUKERFI_UPPFAERSLA: '0' }) });
  const b = keyra('lotu-byrjun.cjs', { session_id: 'g', cwd });
  assert.equal(b.status, 0, b.stderr);
  const ctx = JSON.parse(b.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /^Keflið/); assert.ok(!/Lokanir \(Agnar/.test(ctx), 'kaflinn fellur út, lotan ekki');
  const r = keyra('router.cjs', { session_id: 'g', cwd, prompt: 'hæ' });
  assert.equal(r.status, 0, r.stderr);
  if (r.stdout) assert.doesNotThrow(() => JSON.parse(r.stdout));
});
