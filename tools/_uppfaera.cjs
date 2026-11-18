/* _uppfaera.cjs — lotukerfið sækir sjálft nýjustu útgáfu sína á hverri vél (18.11.2026).
 *
 * AF HVERJU: hookarnir (lotu-byrjun, router, verðir) keyra úr brunaholf-möppunni á hverri vél, en enginn sækir nýja
 * útgáfu þangað nema lota geri `git pull` af tilviljun. 18.11.2026 lagaði ein lota innskráninguna — á EINNI vél — og
 * Agnar fékk sömu spurninguna áfram af hinum („ennþá veseeeen“). Lagfæring á lotukerfinu er einskis virði ef hún situr
 * á vélinni þar sem hún var skrifuð.
 *
 *   raesa()     kallað úr lotu-byrjun (SessionStart). Mest einu sinni á 3 klst. á hverri vél ræsir það uppfaera() í
 *               AÐSKILDU ferli og snýr strax við — byrjun lotu tefst ekki um eina sekúndu vegna nets eða git.
 *   uppfaera()  git fetch, og hraðspólun (merge --ff-only) AÐEINS þegar hún er hættulaus: aðalvinnutré (ekki worktree),
 *               á main, engar óvistaðar breytingar í raktum skrám. Allt annað → ekkert snert, staðan skráð.
 *   lina()      ein lína í byrjun lotu þegar vélin er á eftir og uppfærslan komst ekki í gegn sjálf, svo lotan sjái
 *               að hookarnir hér eru gamlir. Agnar er ekki spurður.
 *
 * Aldrei: reset, stash, checkout, force, push. Mistakist eitthvað stendur vinnutréð óhreyft. Ekkert hér má fella lotu.
 * Slökkt með LOTUKERFI_UPPFAERSLA=0 (prófin nota það, svo þau snerti hvorki net né raunverulegt vinnutré). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const G = require('./_lotu-grunnur.cjs');

const BIL_MS = 3 * 3600 * 1000;
const GREIN = 'main';
const skra = (heima) => path.join(heima, 'lotukerfi-uppfaersla.json');

function lesa(heima = G.HEIMA) {
  try { const j = JSON.parse(fs.readFileSync(skra(heima), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; }
}
/* Skrifað í bráðabirgðaskrá og endurnefnt, svo önnur lota lesi aldrei hálfa skrá. */
function skrifa(heima, j) {
  fs.mkdirSync(heima, { recursive: true });
  const t = skra(heima) + '.' + process.pid + '.tmp';
  fs.writeFileSync(t, JSON.stringify(j), 'utf8');
  try { fs.renameSync(t, skra(heima)); } catch (e) { try { fs.unlinkSync(t); } catch (_) {} throw e; }
}
/* Aðalvinnutré = .git er MAPPA. Í worktree er .git skrá: þar er unnið á grein og ekkert á að sækja. */
function erAdaltre(repo) { try { return fs.statSync(path.join(repo, '.git')).isDirectory(); } catch (_) { return false; } }

function git(repo, arg, ms = 20000) {
  return execFileSync('git', arg, {
    cwd: repo, encoding: 'utf8', timeout: ms, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    // Aldrei gluggi sem biður um lykilorð: repóið er opinbert og þarf ekkert; bili það, þá bilar það hljóðlaust.
    env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }),
  }).trim();
}

/* Vinnan sjálf. Skilar og skráir { reynt, repo, stada, a_eftir, grein, astaeda, sott? }:
 *   nyjast   ekkert að sækja            uppfaert  hraðspólað (sott = fjöldi commita)
 *   a_eftir  á eftir en EKKI snert (á grein / óvistaðar breytingar / staðbundin commit) — astaeda segir hvers vegna
 *   sleppt   ekki aðalvinnutré          villa     git eða net brást — ekkert snert */
function uppfaera({ repo = G.BH, grein = GREIN, heima = G.HEIMA, nu = Date.now() } = {}) {
  const ut = { reynt: nu, repo, stada: 'villa', a_eftir: null, grein: null, astaeda: '' };
  const skila = () => { try { skrifa(heima, ut); } catch (_) {} return ut; };
  try {
    if (!erAdaltre(repo)) { ut.stada = 'sleppt'; ut.astaeda = 'ekki aðalvinnutré'; return skila(); }
    git(repo, ['fetch', '--quiet', 'origin', grein], 90000);
    ut.grein = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
    ut.a_eftir = Number(git(repo, ['rev-list', '--count', 'HEAD..origin/' + grein])) || 0;
    if (!ut.a_eftir) { ut.stada = 'nyjast'; return skila(); }
    ut.stada = 'a_eftir';
    if (ut.grein !== grein) { ut.astaeda = 'vinnutréð er á ' + (ut.grein === 'HEAD' ? 'lausu commiti' : 'greininni ' + ut.grein); return skila(); }
    if (git(repo, ['status', '--porcelain', '--untracked-files=no'])) { ut.astaeda = 'óvistaðar breytingar í vinnutrénu'; return skila(); }
    try {
      git(repo, ['merge', '--ff-only', '--quiet', 'origin/' + grein], 60000);
      ut.stada = 'uppfaert'; ut.sott = ut.a_eftir; ut.a_eftir = 0;
    } catch (_) { ut.astaeda = 'hraðspólun gekk ekki (staðbundin commit eða órakin skrá í veginum)'; }
  } catch (e) {
    ut.stada = 'villa'; ut.astaeda = String((e && e.message) || e).split('\n')[0].slice(0, 140);
  }
  return skila();
}

/* Úr lotu-byrjun. Skilar true ef uppfærsla var ræst. Tímastimpillinn er skrifaður FYRST, svo tvær lotur sem byrja í
 * sömu andrá ræsi ekki tvær uppfærslur og bilun endurtaki sig ekki í hverri lotu. */
function raesa({ repo = G.BH, heima = G.HEIMA, nu = Date.now(), raesir = spawn } = {}) {
  try {
    if (process.env.LOTUKERFI_UPPFAERSLA === '0') return false;
    if (!erAdaltre(repo)) return false;
    const s = lesa(heima);
    if (s.repo === repo && s.reynt && nu - s.reynt < BIL_MS) return false;
    skrifa(heima, Object.assign({}, s, { reynt: nu, repo }));
    const barn = raesir(process.execPath, [__filename, '--keyra', repo, heima], { detached: true, stdio: 'ignore', windowsHide: true, cwd: repo });
    if (barn && barn.on) barn.on('error', () => {});
    if (barn && barn.unref) barn.unref();
    return true;
  } catch (_) { return false; }
}

/* Lína í byrjun lotu — aðeins þegar vélin er á eftir og kerfið gat ekki lagað það sjálft. */
function lina({ heima = G.HEIMA } = {}) {
  try {
    const s = lesa(heima);
    if (s.stada !== 'a_eftir' || !(s.a_eftir > 0)) return '';
    return 'Lotukerfið á þessari vél er ' + s.a_eftir + ' commit á eftir origin/' + GREIN + ' (' + (s.astaeda || 'ástæða óþekkt') + '), svo hookar og leiðbeiningar hér geta verið gamlar. '
      + 'Sé engin vinna annarrar lotu í húfi þar: `git -C "' + s.repo + '" pull --ff-only`. Annars láttu það vera og nefndu það í einni línu. Spurðu Agnar ekki.';
  } catch (_) { return ''; }
}

module.exports = { raesa, uppfaera, lina, lesa, erAdaltre, BIL_MS, GREIN };
// Aðskilda ferlið: node _uppfaera.cjs --keyra [<repo> <heimamappa>]
if (require.main === module && process.argv[2] === '--keyra') {
  try { uppfaera({ repo: process.argv[3] || G.BH, heima: process.argv[4] || G.HEIMA }); } catch (_) {}
}
