/* _uppfaera.cjs — lotukerfið veit hvort vélin er með nýjustu útgáfu, og segir lotunni frá ef ekki (18.11.2026).
 *
 * AF HVERJU: hookarnir (lotu-byrjun, router, verðir) keyra úr brunaholf-möppunni á hverri vél, en enginn sækir nýja
 * útgáfu þangað nema lota geri `git pull` af tilviljun. 18.11.2026 lagaði ein lota innskráninguna — á EINNI vél — og
 * Agnar fékk sömu spurninguna áfram af hinum („ennþá veseeeen“). Lagfæring á lotukerfinu er einskis virði ef hún situr
 * á vélinni þar sem hún var skrifuð.
 *
 * HVAÐ ÞETTA GERIR — og gerir EKKI:
 *   athuga()  í byrjun lotu, mest á 3 klst. fresti á vél: `git ls-remote origin refs/heads/main` (les eitt auðkenni af
 *             netinu, skrifar EKKERT í repóið) og ber það saman við HEAD. Niðurstaðan fer í
 *             ~/.claude/lotukerfi-uppfaersla.json. Keyrir samhliða Supabase-kallinu í lotu-byrjun, með 2,5 s þaki.
 *   lina()    sé vélin á eftir fær lotan EINA línu: gáðu að stöðunni og sæktu ef vinnutréð er hreint og á main.
 *
 * Þetta sækir ekkert og sameinar ekkert sjálft. Fyrsta útgáfa gerði það í aðskildu ferli; óháð rýni sýndi að
 * sjálfvirk hraðspólun getur skilið vinnutré eftir hálfuppfært (skrá læst af öðru forriti), lent í miðri vinnu annarrar
 * lotu, og haldið pípu hooksins opinni undir PowerShell. Lota sem gerir `git pull` sér villurnar og getur brugðist við;
 * bakgrunnsferli getur það ekki. Þess vegna: kerfið TILKYNNIR, lotan FRAMKVÆMIR.
 *
 * Ekkert hér má fella lotu. Slökkt með LOTUKERFI_UPPFAERSLA=0 (prófin nota það). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const G = require('./_lotu-grunnur.cjs');

const BIL_MS = 3 * 3600 * 1000;        // athugað mest á 3 klst. fresti á hverri vél
const BIL_VILLA_MS = 30 * 60 * 1000;   // náðist ekki í origin: reynt aftur eftir hálftíma
const FRESTUR_MS = 2500;               // hookurinn hefur 5 s alls; Supabase-kallið í lotu-byrjun (3 s) keyrir samhliða
const GREIN = 'main';
const skra = (heima) => path.join(heima, 'lotukerfi-uppfaersla.json');
// Aldrei gluggi sem biður um lykilorð: repóið er opinbert og þarf ekkert; bili það, þá bilar það hljóðlaust.
const umhverfi = () => Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' });

function lesa(heima = G.HEIMA) {
  try { const j = JSON.parse(fs.readFileSync(skra(heima), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; }
}
/* Skrifað í bráðabirgðaskrá og endurnefnt, svo önnur lota lesi aldrei hálfa skrá. Á Windows bregst endurnefning (EPERM)
 * á meðan annað ferli les skrána; þá er reynt aftur í nokkrar ms og að lokum skrifað beint (sama aðferð og í _lokanir.cjs —
 * endurtekin hér viljandi, svo einingarnar tvær séu óháðar og bilun í annarri felli ekki hina). */
function skrifa(heima, j) {
  fs.mkdirSync(heima, { recursive: true });
  const mark = skra(heima), t = mark + '.' + process.pid + '.tmp', efni = JSON.stringify(j);
  const upptekin = (e) => ['EPERM', 'EBUSY', 'EACCES'].includes(e && e.code);
  fs.writeFileSync(t, efni, 'utf8');
  try {
    for (let i = 0; ; i++) {
      try { fs.renameSync(t, mark); return; }
      catch (e) { if (!upptekin(e) || i >= 5) throw e; try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15 * (i + 1)); } catch (_) {} }
    }
  } catch (e) {
    try { fs.unlinkSync(t); } catch (_) {}
    if (!upptekin(e)) throw e;
    fs.writeFileSync(mark, efni, 'utf8');
  }
}
/* Aðalvinnutré = .git er MAPPA. Í worktree er .git skrá: þar er unnið á grein og hookarnir þar eru viljandi aðrir. */
function erAdaltre(repo) { try { return fs.statSync(path.join(repo, '.git')).isDirectory(); } catch (_) { return false; } }

function gitA(repo, arg, ms) {
  return new Promise((res, rej) => {
    execFile('git', arg, { cwd: repo, encoding: 'utf8', timeout: ms, windowsHide: true, env: umhverfi() }, (e, ut) => (e ? rej(e) : res(String(ut || ''))));
  });
}
/* Er commitið þegar í HEAD? Tvö skref, bæði lesa aðeins:
 *   1. `rev-parse --verify --quiet <sha>^{commit}`  0 = commitið er til á vélinni; 1 = ekki til (→ vélin er á eftir)
 *   2. `merge-base --is-ancestor <sha> HEAD`        0 = já; 1 = nei
 * Allt annað (git vantar, repóið ólæsilegt = 128, tímaþak) er BILUN og kastar — þá er engu haldið fram um vélina.
 * Tímaþakið er stutt: hookurinn hefur 5 s alls og þetta er samstillt. */
function inniheldur(repo, sha) {
  const keyra = (arg) => {
    try { execFileSync('git', arg, { cwd: repo, timeout: 1500, windowsHide: true, stdio: 'ignore', env: umhverfi() }); return true; }
    catch (e) { if (e && e.status === 1) return false; throw e; }
  };
  return keyra(['rev-parse', '--verify', '--quiet', sha + '^{commit}']) && keyra(['merge-base', '--is-ancestor', sha, 'HEAD']);
}

/* Úr lotu-byrjun. Skilar stöðunni sem var skráð, eða null ef ekkert var athugað (of stutt síðan, worktree, slökkt).
 * Stimpillinn er skrifaður fyrst svo bilun endurtaki sig ekki í hverri lotu. Byrji tvær lotur í sömu andrá geta báðar
 * athugað; það er meinlaust (tveir lestrar af netinu, sama niðurstaða). */
async function athuga({ repo = G.BH, heima = G.HEIMA, nu = Date.now(), grein = GREIN, frestur = FRESTUR_MS } = {}) {
  try {
    if (process.env.LOTUKERFI_UPPFAERSLA === '0') return null;
    if (!erAdaltre(repo)) return null;
    const s = lesa(heima);
    const fyrri = s.repo === repo ? s : {};
    if (fyrri.naest && nu < fyrri.naest) return null;
    let ut = Object.assign({}, fyrri, { repo, reynt: nu, naest: nu + BIL_MS });
    delete ut.villa;
    skrifa(heima, ut);
    try {
      const svar = await gitA(repo, ['ls-remote', 'origin', 'refs/heads/' + grein], frestur);
      const sha = (/^([0-9a-f]{40})\s/m.exec(svar) || [])[1];
      if (!sha) throw new Error('origin skilaði engu fyrir ' + grein);
      ut = { repo, reynt: nu, naest: nu + BIL_MS, sha, stada: inniheldur(repo, sha) ? 'nyjast' : 'a_eftir' };
    } catch (e) {
      // Náðist ekki í origin: fyrri niðurstaða stendur (vél sem var á eftir er það enn) og reynt er fyrr aftur.
      ut.naest = nu + BIL_VILLA_MS;
      ut.villa = String((e && e.message) || e).split('\n')[0].slice(0, 140);
    }
    skrifa(heima, ut);
    return ut;
  } catch (_) { return null; }
}

/* Lína í byrjun lotu — aðeins þegar vélin er á eftir. Sannreynt á staðnum í hvert sinn (les aðeins), svo línan hverfi
 * um leið og einhver lota hefur sótt nýju útgáfuna, án þess að bíða næstu athugunar. */
function lina({ heima = G.HEIMA, ferskt = null } = {}) {
  try {
    const s = lesa(heima);
    if (s.stada !== 'a_eftir' || !s.sha || !s.repo) return '';
    // ferskt = niðurstaða athuga() í ÞESSARI keyrslu: þá var þetta mælt rétt í þessu og óþarfi að kalla á git aftur.
    const nymaelt = ferskt && ferskt.stada === 'a_eftir' && ferskt.sha === s.sha && !ferskt.villa;
    if (!nymaelt && inniheldur(s.repo, s.sha)) { try { skrifa(heima, Object.assign({}, s, { stada: 'nyjast' })); } catch (_) {} return ''; }
    return 'Lotukerfið á þessari vél er á eftir origin/' + GREIN + ', svo hookar og leiðbeiningar hér eru gamlar. Fyrsta verk, áður en annað: '
      + '`git -C "' + s.repo + '" status -sb`. Sýni það `## ' + GREIN + '...` og engar breyttar skrár: `git -C "' + s.repo + '" pull --ff-only`. '
      + 'Sýni það aðra grein eða breyttar skrár er önnur lota að vinna þar: snertu ekkert og nefndu það í einni línu í svarinu. Spurðu Agnar ekki.';
  } catch (_) { return ''; }   // git svarar ekki núna → þegja frekar en að fullyrða
}

module.exports = { athuga, lina, lesa, erAdaltre, inniheldur, BIL_MS, BIL_VILLA_MS, FRESTUR_MS, GREIN };
