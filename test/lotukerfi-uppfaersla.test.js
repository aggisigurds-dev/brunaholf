// Próf: lotukerfið sækir sjálft nýjustu útgáfu sína (tools/_uppfaera.cjs) + lásinn á notendaskránni (tools/_lokanir.cjs).
// Keyrsla: node --test test/lotukerfi-uppfaersla.test.js
//
// AF HVERJU: 18.11.2026 var innskráning lotna löguð á einni vél og Agnar fékk sömu spurninguna áfram af hinum („ennþá
// veseeeen“) — enginn sækir nýja útgáfu af hookunum á hinar vélarnar. Nú gerir lotukerfið það sjálft. Það sem má ALDREI bila:
//   1. vinnutré sem er á main og hreint fær nýjustu útgáfu (hraðspólun);
//   2. ALLT annað er látið ósnert: óvistaðar breytingar, grein, staðbundin commit, órakin skrá í veginum, worktree;
//   3. net/git-bilun kastar engu og snertir ekkert;
//   4. byrjun lotu tefst ekki: uppfærslan er ræst í aðskildu ferli, mest einu sinni á 3 klst. á vél;
//   5. tvær lotur sem byrja í sömu andrá tvítaka ekki kaflana í ~/.claude/CLAUDE.md.
// Allt keyrir á bráðabirgða-git-repóum í tmp; ekkert net og ekkert raunverulegt vinnutré er snert.
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
// Skrár í git-vinnutré: Windows-vél með core.autocrlf skilar CRLF við útskrift — efnið er borið saman án þess.
const efni = (p) => lesa(p).replace(/\r\n/g, '\n');
const g = (cwd, ...arg) => execFileSync('git', ['-c', 'user.name=Prof', '-c', 'user.email=prof@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...arg],
  { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/* origin (bert repó) + „höfundur“ sem ýtir + „vél“ sem er klónuð á main. Skilar líka fallinu yta(skra, efni). */
function umhverfi() {
  const rot = tmp('git');
  const origin = path.join(rot, 'origin.git'), hof = path.join(rot, 'hofundur'), vel = path.join(rot, 'vel'), heima = path.join(rot, 'heima');
  g(rot, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  g(rot, 'clone', '--quiet', origin, hof);
  g(hof, 'checkout', '--quiet', '-B', 'main');
  fs.writeFileSync(path.join(hof, 'hook.txt'), 'utgafa 1\n');
  g(hof, 'add', '-A'); g(hof, 'commit', '--quiet', '-m', 'fyrsta'); g(hof, 'push', '--quiet', 'origin', 'main');
  g(rot, 'clone', '--quiet', origin, vel);
  const yta = (skra, efni) => { fs.writeFileSync(path.join(hof, skra), efni); g(hof, 'add', '-A'); g(hof, 'commit', '--quiet', '-m', 'breyting ' + skra); g(hof, 'push', '--quiet', 'origin', 'main'); };
  return { rot, origin, hof, vel, heima, yta, haus: () => g(vel, 'rev-parse', 'HEAD') };
}
const stada = (heima) => JSON.parse(lesa(path.join(heima, 'lotukerfi-uppfaersla.json')));

test('á main og hreint → nýjasta útgáfa sótt (hraðspólun) og staðan skráð; önnur keyrsla: ekkert að sækja', () => {
  const u = umhverfi();
  u.yta('hook.txt', 'utgafa 2\n'); u.yta('nytt.txt', 'ny skra\n');
  const r = UPP.uppfaera({ repo: u.vel, heima: u.heima, nu: 1000 });
  assert.equal(r.stada, 'uppfaert'); assert.equal(r.sott, 2); assert.equal(r.a_eftir, 0); assert.equal(r.grein, 'main');
  assert.equal(efni(path.join(u.vel, 'hook.txt')), 'utgafa 2\n');
  assert.ok(fs.existsSync(path.join(u.vel, 'nytt.txt')));
  assert.equal(u.haus(), g(u.hof, 'rev-parse', 'HEAD'));
  assert.deepEqual(stada(u.heima), r);
  assert.equal(UPP.uppfaera({ repo: u.vel, heima: u.heima }).stada, 'nyjast');
  assert.equal(UPP.lina({ heima: u.heima }), '', 'engin lína þegar vélin er með nýjustu útgáfu');
});

test('óvistaðar breytingar í rakinni skrá → EKKERT snert; línan segir lotunni frá, Agnar er ekki spurður', () => {
  const u = umhverfi(), fyrir = u.haus();
  fs.writeFileSync(path.join(u.vel, 'hook.txt'), 'vinna annarrar lotu\n');
  u.yta('hook.txt', 'utgafa 2\n');
  const r = UPP.uppfaera({ repo: u.vel, heima: u.heima });
  assert.equal(r.stada, 'a_eftir'); assert.equal(r.a_eftir, 1); assert.match(r.astaeda, /óvistaðar breytingar/);
  assert.equal(efni(path.join(u.vel, 'hook.txt')), 'vinna annarrar lotu\n', 'óvistuð vinna stendur óbreytt');
  assert.equal(u.haus(), fyrir);
  const l = UPP.lina({ heima: u.heima });
  assert.match(l, /er 1 commit á eftir origin\/main \(óvistaðar breytingar í vinnutrénu\)/);
  assert.ok(l.includes('git -C "' + u.vel + '" pull --ff-only'));
  assert.match(l, /Annars láttu það vera/); assert.match(l, /Spurðu Agnar ekki/);
  assert.ok(!/stash|reset|checkout|force/.test(l), 'línan má aldrei stinga upp á að henda eða fela vinnu');
});

test('á grein, á lausu commiti, með staðbundið commit eða órakta skrá í veginum → ekkert snert, ástæðan skráð', () => {
  // grein
  let u = umhverfi(); g(u.vel, 'checkout', '--quiet', '-b', 'vinna'); let fyrir = u.haus(); u.yta('hook.txt', 'utgafa 2\n');
  let r = UPP.uppfaera({ repo: u.vel, heima: u.heima });
  assert.deepEqual([r.stada, r.grein, r.a_eftir], ['a_eftir', 'vinna', 1]); assert.match(r.astaeda, /greininni vinna/);
  assert.equal(u.haus(), fyrir); assert.equal(g(u.vel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'vinna');
  // laust commit (detached HEAD)
  u = umhverfi(); g(u.vel, 'checkout', '--quiet', '--detach'); fyrir = u.haus(); u.yta('hook.txt', 'utgafa 2\n');
  r = UPP.uppfaera({ repo: u.vel, heima: u.heima });
  assert.equal(r.stada, 'a_eftir'); assert.match(r.astaeda, /lausu commiti/); assert.equal(u.haus(), fyrir);
  // staðbundið commit á main (sundurleitt) — engin samruna-commit verður til
  u = umhverfi(); fs.writeFileSync(path.join(u.vel, 'stadbundid.txt'), 'x\n'); g(u.vel, 'add', '-A'); g(u.vel, 'commit', '--quiet', '-m', 'stadbundid'); fyrir = u.haus();
  u.yta('hook.txt', 'utgafa 2\n');
  r = UPP.uppfaera({ repo: u.vel, heima: u.heima });
  assert.equal(r.stada, 'a_eftir'); assert.match(r.astaeda, /hraðspólun gekk ekki/);
  assert.equal(u.haus(), fyrir); assert.equal(efni(path.join(u.vel, 'hook.txt')), 'utgafa 1\n');
  // órakin skrá sem nýja útgáfan myndi yfirskrifa
  u = umhverfi(); fs.writeFileSync(path.join(u.vel, 'nytt.txt'), 'mitt eigið\n'); fyrir = u.haus(); u.yta('nytt.txt', 'fra origin\n');
  r = UPP.uppfaera({ repo: u.vel, heima: u.heima });
  assert.equal(r.stada, 'a_eftir'); assert.equal(u.haus(), fyrir);
  assert.equal(efni(path.join(u.vel, 'nytt.txt')), 'mitt eigið\n', 'órakin skrá er aldrei yfirskrifuð');
});

test('worktree (.git er skrá) → sleppt og ekkert ræst; origin næst ekki → villa, ekkert kast, ekkert snert', () => {
  const u = umhverfi();
  const wt = path.join(u.rot, 'wt'); g(u.vel, 'worktree', 'add', '--quiet', '-b', 'onnur', wt);
  assert.equal(UPP.erAdaltre(u.vel), true); assert.equal(UPP.erAdaltre(wt), false); assert.equal(UPP.erAdaltre(path.join(u.rot, 'ekki-til')), false);
  assert.equal(UPP.uppfaera({ repo: wt, heima: u.heima }).stada, 'sleppt');
  let raest = 0;
  assert.equal(UPP.raesa({ repo: wt, heima: u.heima, raesir: () => { raest++; return { unref() {} }; } }), false);
  assert.equal(raest, 0);
  // origin horfið
  const fyrir = u.haus();
  g(u.vel, 'remote', 'set-url', 'origin', path.join(u.rot, 'horfid.git'));
  const r = UPP.uppfaera({ repo: u.vel, heima: u.heima });
  assert.equal(r.stada, 'villa'); assert.ok(r.astaeda); assert.equal(u.haus(), fyrir);
  assert.equal(UPP.lina({ heima: u.heima }), '', 'bilun í neti er ekki mál lotunnar — engin lína');
});

test('raesa: aðskilið ferli, mest einu sinni á 3 klst.; slökkt með LOTUKERFI_UPPFAERSLA=0; bilun fellir ekkert', () => {
  const u = umhverfi(), kall = [];
  const raesir = (...a) => { kall.push(a); return { unref() {}, on() {} }; };
  const T = 1700000000000;
  assert.equal(UPP.raesa({ repo: u.vel, heima: u.heima, nu: T, raesir }), true);
  assert.equal(kall.length, 1);
  const [exe, arg, opt] = kall[0];
  assert.equal(exe, process.execPath);
  assert.deepEqual(arg, [path.join(ROT, 'tools', '_uppfaera.cjs'), '--keyra', u.vel, u.heima]);
  assert.deepEqual([opt.detached, opt.stdio, opt.windowsHide], [true, 'ignore', true], 'aðskilið, hljótt og gluggalaust');
  assert.equal(stada(u.heima).reynt, T, 'tímastimpill skrifaður ÁÐUR en ferlið er ræst');
  assert.equal(UPP.raesa({ repo: u.vel, heima: u.heima, nu: T + UPP.BIL_MS - 1, raesir }), false, 'innan 3 klst.: ekki aftur');
  assert.equal(UPP.raesa({ repo: u.vel, heima: u.heima, nu: T + UPP.BIL_MS + 1, raesir }), true, 'eftir 3 klst.: aftur');
  assert.equal(kall.length, 2);
  // slökkt
  const adur = process.env.LOTUKERFI_UPPFAERSLA;
  process.env.LOTUKERFI_UPPFAERSLA = '0';
  try { assert.equal(UPP.raesa({ repo: u.vel, heima: path.join(u.rot, 'h2'), raesir }), false); } finally { if (adur === undefined) delete process.env.LOTUKERFI_UPPFAERSLA; else process.env.LOTUKERFI_UPPFAERSLA = adur; }
  assert.equal(kall.length, 2);
  // ræsirinn kastar / heimamappa er skrá → false, ekkert kast
  assert.equal(UPP.raesa({ repo: u.vel, heima: path.join(u.rot, 'h3'), raesir: () => { throw new Error('spawn brást'); } }), false);
  const skra = path.join(u.rot, 'er-skra'); fs.writeFileSync(skra, 'x');
  assert.equal(UPP.raesa({ repo: u.vel, heima: skra, raesir }), false);
});

test('lina: aðeins þegar vélin er á eftir og kerfið gat ekki lagað það sjálft', () => {
  const heima = tmp('lina');
  const setja = (j) => fs.writeFileSync(path.join(heima, 'lotukerfi-uppfaersla.json'), JSON.stringify(j));
  assert.equal(UPP.lina({ heima }), '', 'engin staða enn');
  for (const j of [{ stada: 'nyjast', a_eftir: 0 }, { stada: 'uppfaert', a_eftir: 0, sott: 3 }, { stada: 'villa', a_eftir: null }, { stada: 'sleppt' }, { stada: 'a_eftir', a_eftir: 0 }, { reynt: 1 }]) {
    setja(j); assert.equal(UPP.lina({ heima }), '', JSON.stringify(j));
  }
  setja({ stada: 'a_eftir', a_eftir: 7, repo: 'X:\\verk\\brunaholf', astaeda: 'vinnutréð er á greininni vinna' });
  assert.match(UPP.lina({ heima }), /^Lotukerfið á þessari vél er 7 commit á eftir origin\/main \(vinnutréð er á greininni vinna\)/);
  fs.writeFileSync(path.join(heima, 'lotukerfi-uppfaersla.json'), '{skemmt');
  assert.equal(UPP.lina({ heima }), '', 'skemmd skrá fellir ekkert');
});

test('ENDA Í ENDA: raesa ræsir raunverulegt aðskilið ferli sem sækir nýjustu útgáfu án þess að kallandinn bíði', async () => {
  const u = umhverfi();
  u.yta('hook.txt', 'utgafa 2\n');
  const t0 = Date.now();
  assert.equal(UPP.raesa({ repo: u.vel, heima: u.heima }), true);
  assert.ok(Date.now() - t0 < 1500, 'raesa snýr strax við (' + (Date.now() - t0) + ' ms)');
  let s = {};
  for (let i = 0; i < 150 && s.stada !== 'uppfaert'; i++) { await new Promise((r) => setTimeout(r, 200)); try { s = stada(u.heima); } catch (_) {} }
  assert.equal(s.stada, 'uppfaert', 'aðskilda ferlið kláraði: ' + JSON.stringify(s));
  assert.equal(efni(path.join(u.vel, 'hook.txt')), 'utgafa 2\n');
});

test('lotu-byrjun: línan um gamla útgáfu fylgir í byrjun lotu þegar vélin er á eftir — annars ekki', () => {
  const heima = tmp('hook'), cwd = tmp('cwd'), tom = tmp('tomt');
  const keyra = () => {
    const r = spawnSync(process.execPath, [path.join(ROT, 'tools', 'lotu-byrjun.cjs')], {
      input: JSON.stringify({ session_id: 's1', cwd }), encoding: 'utf8', timeout: 20000,
      env: Object.assign({}, process.env, { USERPROFILE: heima, HOME: heima, SL_REPO: tom, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_KEY: '', LOTUKERFI_UPPFAERSLA: '0' }),
    });
    assert.equal(r.status, 0);
    return JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  };
  assert.ok(!/Lotukerfið á þessari vél/.test(keyra()));
  assert.ok(!fs.existsSync(path.join(heima, '.claude', 'lotukerfi-uppfaersla.json')), 'LOTUKERFI_UPPFAERSLA=0: ekkert ræst og ekkert skráð');
  fs.writeFileSync(path.join(heima, '.claude', 'lotukerfi-uppfaersla.json'), JSON.stringify({ stada: 'a_eftir', a_eftir: 4, repo: 'X:\\verk\\brunaholf', astaeda: 'óvistaðar breytingar í vinnutrénu' }));
  const ctx = keyra();
  assert.match(ctx, /Lotukerfið á þessari vél er 4 commit á eftir/);
  assert.ok(ctx.indexOf('Lokanir (Agnar') < ctx.indexOf('Lotukerfið á þessari vél'), 'á eftir lokanakaflanum');
});

/* ── Lásinn á ~/.claude/CLAUDE.md ─────────────────────────────────────────────────────────────── */
const A = '<!-- lotukerfi:innskraning byrjar', B = '<!-- lotukerfi:lokanir byrjar';
const fjoldi = (t, m) => t.split(m).length - 1;

test('lás: önnur lota að skrifa → „upptekid“ og ekkert skrifað; gamall lás (dautt ferli) er tekinn yfir og fjarlægður', () => {
  const heima = tmp('las'), skra = path.join(heima, 'CLAUDE.md'), las = skra + '.lotukerfi-las';
  fs.writeFileSync(las, '');
  assert.deepEqual(LOK.tryggjaNotandaskra({ heima }), { stada: 'upptekid', kaflar: [] });
  assert.ok(!fs.existsSync(skra));
  const gamalt = new Date(Date.now() - 60000); fs.utimesSync(las, gamalt, gamalt);
  assert.equal(LOK.tryggjaNotandaskra({ heima }).stada, 'buin_til');
  assert.ok(!fs.existsSync(las), 'lásinn fjarlægður eftir skrif');
  const t = lesa(skra); assert.equal(fjoldi(t, A), 1); assert.equal(fjoldi(t, B), 1);
});

test('átta lotur byrja í sömu andrá → hvor kafli fer inn NÁKVÆMLEGA einu sinni og eldra efni stendur', async () => {
  const heima = tmp('samtimis'), skra = path.join(heima, 'CLAUDE.md');
  fs.writeFileSync(skra, '# Mitt\n');
  const kodi = 'const L=require(process.argv[1]);const r=L.tryggjaNotandaskra({heima:process.argv[2]});process.stdout.write(r.stada)';
  const ut = await Promise.all(Array.from({ length: 8 }, () => new Promise((res) => {
    const b = spawn(process.execPath, ['-e', kodi, path.join(ROT, 'tools', '_lokanir.cjs'), heima], { stdio: ['ignore', 'pipe', 'ignore'] });
    let o = ''; b.stdout.on('data', (d) => { o += d; }); b.on('close', () => res(o));
  })));
  assert.ok(ut.every((s) => ['baett_vid', 'til', 'upptekid'].includes(s)), ut.join(','));
  assert.equal(ut.filter((s) => s === 'baett_vid').length, 1, 'nákvæmlega ein lota skrifaði: ' + ut.join(','));
  const t = lesa(skra);
  assert.ok(t.startsWith('# Mitt\n'));
  assert.equal(fjoldi(t, A), 1); assert.equal(fjoldi(t, B), 1);
  assert.ok(!fs.existsSync(skra + '.lotukerfi-las'));
});
