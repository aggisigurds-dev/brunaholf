// Próf: lotukerfið veit hvort vélin er með nýjustu útgáfu og segir lotunni frá ef ekki (tools/_uppfaera.cjs),
// + lásinn á notendaskránni (tools/_lokanir.cjs).
// Keyrsla: node --test test/lotukerfi-uppfaersla.test.js
//
// AF HVERJU: 18.11.2026 var innskráning lotna löguð á einni vél og Agnar fékk sömu spurninguna áfram af hinum („ennþá
// veseeeen“) — enginn sækir nýja útgáfu af hookunum á hinar vélarnar. Það sem má ALDREI bila:
//   1. vél sem er á eftir origin/main: lotan fær EINA línu um að sækja; vél með nýjustu útgáfu: engin lína;
//   2. athugunin SKRIFAR EKKERT í repóið — hún sækir ekki, sameinar ekki og snertir ekki vinnutréð (rýni 18.11.2026 sýndi
//      að sjálfvirk hraðspólun getur skilið tré eftir hálfuppfært; þess vegna tilkynnir kerfið og lotan framkvæmir);
//   3. línan hverfur um leið og lota hefur sótt, án nets;
//   4. net/git-bilun kastar engu, og vél sem var á eftir telst það áfram;
//   5. byrjun lotu tefst ekki að ráði: mest ein athugun á 3 klst., með tímaþaki;
//   6. tvær lotur sem byrja í sömu andrá tvítaka ekki kaflana í ~/.claude/CLAUDE.md.
// Allt keyrir á bráðabirgða-git-repóum í tmp („origin“ er mappa á diski): ekkert net, ekkert raunverulegt vinnutré.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');

const ROT = path.join(__dirname, '..');
const UPP = require(path.join(ROT, 'tools', '_uppfaera.cjs'));
const LOK = require(path.join(ROT, 'tools', '_lokanir.cjs'));
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), 'uppf-' + n + '-'));
const lesa = (p) => fs.readFileSync(p, 'utf8');
const g = (cwd, ...arg) => execFileSync('git', ['-c', 'user.name=Prof', '-c', 'user.email=prof@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...arg],
  { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/* origin (bert repó) + „höfundur“ sem ýtir + „vél“ sem er klónuð á main. yta(skra, efni) bætir commiti við origin. */
function umhverfi() {
  const rot = tmp('git');
  const origin = path.join(rot, 'origin.git'), hof = path.join(rot, 'hofundur'), vel = path.join(rot, 'vel'), heima = path.join(rot, 'heima');
  g(rot, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  g(rot, 'clone', '--quiet', origin, hof);
  g(hof, 'checkout', '--quiet', '-B', 'main');
  fs.writeFileSync(path.join(hof, 'hook.txt'), 'utgafa 1\n');
  g(hof, 'add', '-A'); g(hof, 'commit', '--quiet', '-m', 'fyrsta'); g(hof, 'push', '--quiet', 'origin', 'main');
  g(rot, 'clone', '--quiet', origin, vel);
  const yta = (skra, efni) => { fs.writeFileSync(path.join(hof, skra), efni); g(hof, 'add', '-A'); g(hof, 'commit', '--quiet', '-m', 'breyting ' + skra); g(hof, 'push', '--quiet', 'origin', 'main'); return g(hof, 'rev-parse', 'HEAD'); };
  // „fingrafar“ vinnutrésins og .git: ef athugunin skrifar nokkuð í repóið breytist það
  const fingrafar = () => [g(vel, 'rev-parse', 'HEAD'), g(vel, 'status', '--porcelain'), g(vel, 'for-each-ref'), fs.existsSync(path.join(vel, '.git', 'FETCH_HEAD')), lesa(path.join(vel, 'hook.txt'))].join('|');
  return { rot, origin, hof, vel, heima, yta, fingrafar };
}
const stada = (heima) => JSON.parse(lesa(path.join(heima, 'lotukerfi-uppfaersla.json')));
const T = 1700000000000;

test('vél með nýjustu útgáfu → „nyjast“ og engin lína; origin fær nýtt commit → „a_eftir“ og lotan fær línuna', async () => {
  const u = umhverfi();
  let r = await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T });
  assert.equal(r.stada, 'nyjast'); assert.equal(r.sha, g(u.vel, 'rev-parse', 'HEAD'));
  assert.deepEqual(stada(u.heima), r);
  assert.equal(UPP.lina({ heima: u.heima }), '');

  const nytt = u.yta('hook.txt', 'utgafa 2\n');
  const fyrir = u.fingrafar();
  r = await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T + UPP.BIL_MS + 1 });
  assert.equal(r.stada, 'a_eftir'); assert.equal(r.sha, nytt);
  assert.equal(u.fingrafar(), fyrir, 'athugunin skrifaði EKKERT í repóið: sama HEAD, sömu tilvísanir, ekkert FETCH_HEAD, sama skrá');

  const l = UPP.lina({ heima: u.heima });
  assert.match(l, /^Lotukerfið á þessari vél er á eftir origin\/main/);
  assert.ok(l.includes('git -C "' + u.vel + '" status -sb') && l.includes('git -C "' + u.vel + '" pull --ff-only'));
  assert.match(l, /Sýni það aðra grein eða breyttar skrár er önnur lota að vinna þar: snertu ekkert/);
  assert.match(l, /Spurðu Agnar ekki/);
  assert.ok(!/stash|reset|checkout|force|clean/.test(l), 'línan má aldrei stinga upp á að henda eða fela vinnu');
  assert.equal(u.fingrafar(), fyrir, 'lina() les aðeins');
});

test('línan hverfur um leið og lota hefur sótt — án nets og án þess að bíða næstu athugunar', async () => {
  const u = umhverfi();
  u.yta('hook.txt', 'utgafa 2\n');
  await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T });
  assert.ok(UPP.lina({ heima: u.heima }));
  g(u.vel, 'pull', '--quiet', '--ff-only');                                        // lotan gerir það sem línan segir
  g(u.vel, 'remote', 'set-url', 'origin', path.join(u.rot, 'horfid.git'));         // og netið er farið
  assert.equal(UPP.lina({ heima: u.heima }), '');
  assert.equal(stada(u.heima).stada, 'nyjast', 'staðan leiðrétt á staðnum');
  // Vinnutré á grein sem inniheldur EKKI nýjasta main telst á eftir (hookarnir þar eru gamlir) — línan segir þá „snertu ekkert“.
  const v = umhverfi(); g(v.vel, 'checkout', '--quiet', '-b', 'vinna'); v.yta('hook.txt', 'utgafa 2\n');
  assert.equal((await UPP.athuga({ repo: v.vel, heima: v.heima, nu: T })).stada, 'a_eftir');
  assert.match(UPP.lina({ heima: v.heima }), /aðra grein/);
});

test('mest ein athugun á 3 klst. á vél: innan bilsins er ekkert spurt og ekkert skráð', async () => {
  const u = umhverfi();
  assert.ok(await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T }));
  const skrad = lesa(path.join(u.heima, 'lotukerfi-uppfaersla.json'));
  u.yta('hook.txt', 'utgafa 2\n');
  assert.equal(await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T + UPP.BIL_MS - 1 }), null, 'innan 3 klst.: ekki aftur');
  assert.equal(lesa(path.join(u.heima, 'lotukerfi-uppfaersla.json')), skrad);
  assert.equal((await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T + UPP.BIL_MS })).stada, 'a_eftir', 'eftir 3 klst.: aftur');
});

test('origin næst ekki → engu kastað, fyrri niðurstaða stendur (vél sem var á eftir er það enn) og reynt fyrr aftur', async () => {
  const u = umhverfi();
  u.yta('hook.txt', 'utgafa 2\n');
  const r1 = await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T });
  assert.equal(r1.stada, 'a_eftir');
  g(u.vel, 'remote', 'set-url', 'origin', path.join(u.rot, 'horfid.git'));
  const t2 = T + UPP.BIL_MS + 5;
  const r2 = await UPP.athuga({ repo: u.vel, heima: u.heima, nu: t2 });
  assert.equal(r2.stada, 'a_eftir', 'fyrri niðurstaða stendur'); assert.equal(r2.sha, r1.sha); assert.ok(r2.villa);
  assert.equal(r2.naest, t2 + UPP.BIL_VILLA_MS, 'reynt aftur eftir hálftíma, ekki þrjá');
  assert.ok(UPP.lina({ heima: u.heima }), 'línan helst');
  // Vél sem hefur aldrei náð í origin: engin fullyrðing, engin lína.
  const v = umhverfi(); g(v.vel, 'remote', 'set-url', 'origin', path.join(v.rot, 'horfid.git'));
  const r3 = await UPP.athuga({ repo: v.vel, heima: v.heima, nu: T });
  assert.ok(r3.villa && !r3.stada);
  assert.equal(UPP.lina({ heima: v.heima }), '');
  // Tímaþak: git sem svarar ekki innan frests → villa skráð, ekkert kast.
  const w = umhverfi();
  const r4 = await UPP.athuga({ repo: w.vel, heima: w.heima, nu: T, frestur: 1 });
  assert.ok(r4 && (r4.villa || r4.stada), 'skilar alltaf einhverju');
});

test('ekkert athugað: worktree (.git er skrá), LOTUKERFI_UPPFAERSLA=0, ekki repó, heimamappa sem er skrá', async () => {
  const u = umhverfi();
  const wt = path.join(u.rot, 'wt'); g(u.vel, 'worktree', 'add', '--quiet', '-b', 'onnur', wt);
  assert.equal(UPP.erAdaltre(u.vel), true); assert.equal(UPP.erAdaltre(wt), false); assert.equal(UPP.erAdaltre(path.join(u.rot, 'ekki-til')), false);
  assert.equal(await UPP.athuga({ repo: wt, heima: u.heima, nu: T }), null);
  assert.equal(await UPP.athuga({ repo: path.join(u.rot, 'ekki-til'), heima: u.heima, nu: T }), null);
  const adur = process.env.LOTUKERFI_UPPFAERSLA;
  process.env.LOTUKERFI_UPPFAERSLA = '0';
  try { assert.equal(await UPP.athuga({ repo: u.vel, heima: u.heima, nu: T }), null); }
  finally { if (adur === undefined) delete process.env.LOTUKERFI_UPPFAERSLA; else process.env.LOTUKERFI_UPPFAERSLA = adur; }
  assert.ok(!fs.existsSync(path.join(u.heima, 'lotukerfi-uppfaersla.json')), 'ekkert skráð í neinu þessara tilvika');
  const skra = path.join(u.rot, 'er-skra'); fs.writeFileSync(skra, 'x');
  assert.equal(await UPP.athuga({ repo: u.vel, heima: skra, nu: T }), null, 'heimamappa sem er skrá: ekkert kast');
});

test('lina: þegir nema staðan sé „a_eftir“ með auðkenni; skemmd skrá og horfið repó fella ekkert', () => {
  const heima = tmp('lina');
  const setja = (j) => fs.writeFileSync(path.join(heima, 'lotukerfi-uppfaersla.json'), typeof j === 'string' ? j : JSON.stringify(j));
  assert.equal(UPP.lina({ heima }), '', 'engin staða enn');
  for (const j of [{ stada: 'nyjast', sha: 'a'.repeat(40), repo: 'X:\\v' }, { villa: 'ekkert net' }, { stada: 'a_eftir' }, { stada: 'a_eftir', sha: 'a'.repeat(40) }, { reynt: 1 }, '{skemmt', '[]']) {
    setja(j); assert.equal(UPP.lina({ heima }), '', JSON.stringify(j));
  }
  setja({ stada: 'a_eftir', sha: 'a'.repeat(40), repo: path.join(heima, 'repo-sem-er-horfid') });
  assert.equal(UPP.lina({ heima }), '', 'repóið finnst ekki → þegja frekar en að fullyrða');
  // Mappa sem git getur ekki lesið sem repó (kóði 128) er BILUN, ekki „á eftir“ — engin lína (rýni 18.11.2026).
  const ekkiRepo = tmp('ekki-repo');
  setja({ stada: 'a_eftir', sha: 'a'.repeat(40), repo: ekkiRepo });
  assert.equal(UPP.lina({ heima }), '', 'git les ekki repóið → engu haldið fram');
  assert.throws(() => UPP.inniheldur(ekkiRepo, 'a'.repeat(40)));
  // Í raunverulegu repói: commit sem er ekki til á vélinni = á eftir (false), HEAD sjálft = inni (true).
  const u = umhverfi();
  assert.equal(UPP.inniheldur(u.vel, 'a'.repeat(40)), false);
  assert.equal(UPP.inniheldur(u.vel, g(u.vel, 'rev-parse', 'HEAD')), true);
});

/* ── Í gegnum raunverulega hookinn ─────────────────────────────────────────────────────────────── */
function byrjun(u, auka = {}) {
  const cwd = tmp('cwd'), tom = tmp('tomt');
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROT, 'tools', 'lotu-byrjun.cjs')], {
    input: JSON.stringify({ session_id: 's-' + t0, cwd }), encoding: 'utf8', timeout: 20000,
    env: Object.assign({}, process.env, { USERPROFILE: u.heimili, HOME: u.heimili, SL_REPO: tom, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_KEY: '',
      LOTUKERFI_VINNUSKJOL: path.join(tom, '_vinnuskjol') }, auka),
  });
  assert.equal(r.status, 0, r.stderr);
  return { ctx: JSON.parse(r.stdout).hookSpecificOutput.additionalContext, ms: Date.now() - t0 };
}

test('ENDA Í ENDA: byrjun lotu á vél sem er á eftir → línan kemur í SÖMU byrjun, innan tímamarka hooksins (5 s)', () => {
  // BH_REPO bendir hookunum á prófvélina (aðalvinnutré á main, einu commiti á eftir „origin“ á diski).
  const u = umhverfi(); u.heimili = tmp('heim');
  u.yta('hook.txt', 'utgafa 2\n');
  const fyrir = u.fingrafar();
  const b = byrjun(u, { BH_REPO: u.vel, LOTUKERFI_UPPFAERSLA: '' });
  assert.match(b.ctx, /^Keflið/);
  assert.match(b.ctx, /Lotukerfið á þessari vél er á eftir origin\/main/);
  assert.ok(b.ctx.includes('git -C "' + u.vel + '" pull --ff-only'));
  assert.ok(b.ms < 5000, 'hookurinn kláraðist á ' + b.ms + ' ms');
  assert.equal(u.fingrafar(), fyrir, 'hookurinn skrifaði ekkert í repóið');
  assert.equal(stada(path.join(u.heimili, '.claude')).stada, 'a_eftir');
  // Lotan sækir → næsta byrjun (innan 3 klst., engin ný athugun) ber enga línu.
  g(u.vel, 'pull', '--quiet', '--ff-only');
  assert.ok(!/Lotukerfið á þessari vél/.test(byrjun(u, { BH_REPO: u.vel, LOTUKERFI_UPPFAERSLA: '' }).ctx));
});

test('lotu-byrjun: slökkt (LOTUKERFI_UPPFAERSLA=0) → ekkert athugað, ekkert skráð, engin lína — og --texti athugar aldrei', () => {
  const u = umhverfi(); u.heimili = tmp('heim');
  u.yta('hook.txt', 'utgafa 2\n');
  const b = byrjun(u, { BH_REPO: u.vel, LOTUKERFI_UPPFAERSLA: '0' });
  assert.ok(!/Lotukerfið á þessari vél/.test(b.ctx));
  assert.ok(!fs.existsSync(path.join(u.heimili, '.claude', 'lotukerfi-uppfaersla.json')));
  const nytt = tmp('heim2');   // ný heimamappa: --texti (skoðunarhamur) má ekkert skilja eftir sig, þótt kveikt sé á athuguninni
  const r = spawnSync(process.execPath, [path.join(ROT, 'tools', 'lotu-byrjun.cjs'), '--texti'], { input: '{}', encoding: 'utf8', timeout: 20000,
    env: Object.assign({}, process.env, { USERPROFILE: nytt, HOME: nytt, SL_REPO: tmp('tomt'), SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_KEY: '', BH_REPO: u.vel, LOTUKERFI_UPPFAERSLA: '' }) });
  assert.equal(r.status, 0);
  assert.ok(!fs.existsSync(path.join(nytt, '.claude')), '--texti skrifar ekkert og spyr origin einskis');
});

/* ── Lásinn á ~/.claude/CLAUDE.md ─────────────────────────────────────────────────────────────── */
const A = '<!-- lotukerfi:innskraning byrjar', B = '<!-- lotukerfi:lokanir byrjar';
const fjoldi = (t, m) => t.split(m).length - 1;
const FRUM = path.join(ROT, 'claude-global', 'CLAUDE.md');   // frumritið gefið beint (sjálfgefna leiðin les aðeins aðalvinnutré á main)

test('lás: önnur lota að skrifa → „upptekid“ og ekkert skrifað; gamall lás (dautt ferli) er tekinn yfir og fjarlægður', () => {
  const heima = tmp('las'), skra = path.join(heima, 'CLAUDE.md'), las = skra + '.lotukerfi-las';
  fs.writeFileSync(las, '');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima, snid: FRUM }), { stada: 'upptekid', kaflar: [] });
  assert.ok(!fs.existsSync(skra));
  const gamalt = new Date(Date.now() - 60000); fs.utimesSync(las, gamalt, gamalt);
  assert.equal(LOK.tryggjaNotandaskra({ heima, snid: FRUM }).stada, 'buin_til');
  assert.ok(!fs.existsSync(las), 'lásinn fjarlægður eftir skrif');
  const t = lesa(skra); assert.equal(fjoldi(t, A), 1); assert.equal(fjoldi(t, B), 1);
});

test('átta lotur byrja í sömu andrá → hvor kafli fer inn NÁKVÆMLEGA einu sinni og eldra efni stendur', async () => {
  const heima = tmp('samtimis'), skra = path.join(heima, 'CLAUDE.md');
  fs.writeFileSync(skra, '# Mitt\n');
  const kodi = 'const L=require(process.argv[1]);const r=L.tryggjaNotandaskra({heima:process.argv[2],snid:process.argv[3]});process.stdout.write(r.stada)';
  const ut = await Promise.all(Array.from({ length: 8 }, () => new Promise((res) => {
    const b = spawn(process.execPath, ['-e', kodi, path.join(ROT, 'tools', '_lokanir.cjs'), heima, FRUM], { stdio: ['ignore', 'pipe', 'ignore'] });
    let o = ''; b.stdout.on('data', (d) => { o += d; }); b.on('close', () => res(o));
  })));
  assert.ok(ut.every((s) => ['baett_vid', 'til', 'upptekid'].includes(s)), ut.join(','));
  assert.equal(ut.filter((s) => s === 'baett_vid').length, 1, 'nákvæmlega ein lota skrifaði: ' + ut.join(','));
  const t = lesa(skra);
  assert.ok(t.startsWith('# Mitt\n'));
  assert.equal(fjoldi(t, A), 1); assert.equal(fjoldi(t, B), 1);
  assert.ok(!fs.existsSync(skra + '.lotukerfi-las'));
});
