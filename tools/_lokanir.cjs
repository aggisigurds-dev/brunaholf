/* _lokanir.cjs — „burt með þessar lokanir“ (Agnar 18.11.2026).
 *
 * Þrjár lotur stöðvuðust sama dag á hlutum sem eiga ekki að stöðva neina lotu: innskráningu í vafra lotunnar („Búinn að skrá
 * inn / Nota Chrome“), földum vafraglugga („ég sá þetta ekki á skjá“) og vinnuskjali sem öryggisvörn Claude Code hleypti
 * ekki í opinbert repó („Á ég að ýta skránni?“). Leiðbeiningarnar voru til — en aðeins í ~/.claude/CLAUDE.md á EINNI vél
 * (búin til sama dag); loturnar sem spurðu enn keyrðu á öðrum vélum. Notendaskráin er per vél, hookarnir ekki: þeir liggja
 * í þessu repói og keyra í hverri lotu á hverri vél. Þess vegna býr lagfæringin hér:
 *
 *   texti()               stuttur kafli sem lotu-byrjun.cjs setur í byrjun hverrar nýrrar lotu (SessionStart) og router.cjs
 *                         EINU SINNI í lotu sem var þegar í gangi (UserPromptSubmit) — einuSinni() heldur utan um það.
 *   tryggjaNotandaskra()  heldur köflunum milli <!-- lotukerfi:<nafn> byrjar/endar --> í ~/.claude/CLAUDE.md eins og í
 *                         FRUMRITINU, claude-global/CLAUDE.md: bætir við kafla sem vantar og uppfærir kafla sem er
 *                         frábrugðinn (svo leiðrétting á frumritinu berist á allar vélar). Efni UTAN merkjanna er aldrei
 *                         snert, og eldra eintak skrárinnar fer í ~/.claude/backups/lotukerfi/ áður en henni er breytt.
 *                         tools/global-samstilling.cjs (handvirkt) yfirskrifar alla skrána með sama frumriti, svo þessi
 *                         tvö verkfæri eru alltaf sammála um kaflana.
 *
 * Ekkert hér má nokkurn tíma fella lotu: allt er í try/catch, engin netköll, samstillt og fáeinar ms. */
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./_lotu-grunnur.cjs');

const SNID = path.join(G.BH, 'claude-global', 'CLAUDE.md');
const KAFLAR = [
  // eldri = texti sem sannar að kaflinn sé þegar í skránni ÁN merkja (handskrifaður á vél 18.11.2026) → ekki tvítekinn
  { nafn: 'innskraning', eldri: /lotan skráir sig inn SJÁLF/ },
  { nafn: 'lokanir', eldri: null },
];
const byrjar = (n) => '<!-- lotukerfi:' + n + ' byrjar';
const endar = (n) => '<!-- lotukerfi:' + n + ' endar -->';
const lf = (s) => s.replace(/\r\n/g, '\n');

/* Aðalvinnutré repósins. Í worktree er .git SKRÁ sem bendir á <aðaltré>/.git/worktrees/<nafn>. */
function adalRepo(bh = G.BH) {
  try {
    const p = path.join(bh, '.git');
    if (fs.statSync(p).isDirectory()) return bh;
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(p, 'utf8'));
    if (m) {
      const g = path.resolve(bh, m[1]).replace(/\\/g, '/');
      const i = g.lastIndexOf('/.git/worktrees/');
      if (i > 0) return path.normalize(g.slice(0, i));
    }
  } catch (_) {}
  return bh;
}
/* Vinnuskjalamappan: við hlið AÐALvinnutrésins, aldrei inni í repói. Reiknuð frá aðaltrénu svo worktree undir
 * <repo>/.claude/worktrees/ setji hana ekki inn í opinbera tréð. (Hún er líka í .gitignore, til vara.) */
function vinnuskjol({ bh = G.BH } = {}) {
  if (process.env.LOTUKERFI_VINNUSKJOL) return path.resolve(process.env.LOTUKERFI_VINNUSKJOL);
  return path.join(path.dirname(adalRepo(bh)), '_vinnuskjol');
}

/* Kaflinn sem fer í byrjun lotu. Stuttur viljandi: hann kostar tóka í HVERRI lotu. Ítarefnið er í notendaskránni. */
function texti({ mappa = vinnuskjol() } = {}) {
  return [
    'Lokanir (Agnar 18.11.2026: „burt með þessar lokanir“) — ekkert af þessu stöðvar lotu og Agnar er ekki spurður:',
    '- Innskráning í Slökkvitæki/Brunahólf: lotan skráir sig inn SJÁLF sem „Lota (Claude)“, uid 10 (aldrei uid 1). Aðferðin er í ~/.claude/CLAUDE.md og í CLAUDE.md beggja repóa („Innskráning lotunnar“). Bjóddu aldrei „Búinn að skrá inn / Nota Chrome“; án Supabase-tóls: segðu það í einni línu og vinndu það sem þarf ekki innskráningu.',
    '- Falinn vafragluggi: read_page, get_page_text og javascript_tool virka samt — sannreyndu þannig í stað þess að segja „ég sá þetta ekki á skjá“.',
    '- Vinnuskjöl með kúnnagögnum, pósti eða tölum fara ALDREI í repó (repóin eru opinber; öryggisvörn Claude Code stöðvar það réttilega — farðu ekki framhjá henni og spurðu ekki hvort eigi að ýta). Vistaðu í möppu lotunnar sé hún ekki repó, annars í ' + mappa + ', eða sem nótu á Þjónustuborðinu, og haltu áfram.',
    '- Augljós næstu skref: gerðu þau og segðu frá. Spurðu aðeins um það sem Agnar á alltaf sjálfur: póst/SMS út úr húsi, kröfur/reikninga/kredit/peninga, eyðingu gagna, sameiningu fyrirtækja, breytingu á kennitölu eða verði, og borð annarra.',
  ].join('\n');
}

/* Kaflar frumritsins: { nafn → texti með merkjum }. Vanti annað merkið er kaflanum sleppt (aldrei hálfur kafli). */
function lesaSnid(snid = SNID) {
  const t = lf(fs.readFileSync(snid, 'utf8'));
  const ut = {};
  for (const { nafn } of KAFLAR) {
    const a = t.indexOf(byrjar(nafn)), b = t.indexOf(endar(nafn), a);
    if (a >= 0 && b > a) ut[nafn] = t.slice(a, b + endar(nafn).length);
  }
  return ut;
}

/* Hvað vantar og hvað er frábrugðið frumritinu?  nu = núverandi efni skrárinnar (null = skráin er ekki til).
 *   vantar  kaflinn er hvergi í skránni (hvorki með merki né sem eldri handskrifuð útgáfa) → bætt við aftast
 *   breytt  kaflinn er þar með BÁÐUM merkjum en efnið er annað en í frumritinu → skipt út á sínum stað
 *   Byrjunarmerki án endamerkis = eigandinn hefur tekið kaflann yfir → látinn alveg ósnertur. */
function greina(nu, kaflar) {
  const vantar = [], breytt = [];
  for (const { nafn, eldri } of KAFLAR) {
    if (!kaflar[nafn]) continue;
    if (nu == null) { vantar.push(nafn); continue; }
    const a = nu.indexOf(byrjar(nafn));
    if (a < 0) { if (!(eldri && eldri.test(nu))) vantar.push(nafn); continue; }
    const b = nu.indexOf(endar(nafn), a);
    if (b < 0) continue;
    if (lf(nu.slice(a, b + endar(nafn).length)) !== kaflar[nafn]) breytt.push(nafn);   // línuendar einir teljast ekki breyting
  }
  return { vantar, breytt };
}
function beita(nu, kaflar, { vantar, breytt }) {
  let t = nu == null ? '' : nu;
  for (const nafn of breytt) {
    const a = t.indexOf(byrjar(nafn)), b = t.indexOf(endar(nafn), a);
    t = t.slice(0, a) + kaflar[nafn] + t.slice(b + endar(nafn).length);
  }
  if (vantar.length) {
    const vidbot = vantar.map((n) => kaflar[n]).join('\n\n') + '\n';
    t = !t.trim() ? vidbot : t + (t.endsWith('\n') ? '\n' : '\n\n') + vidbot;
  }
  return t;
}

/* Skilar { stada, kaflar }:  til (ekkert að gera) · buin_til · baett_vid · uppfaert (kafla skipt út; e.t.v. líka bætt við)
 *   upptekid (önnur lota er að skrifa núna) · sleppt (skráin er ekki UTF-8 — ekki snert) · villa (ekkert kast). */
function tryggjaNotandaskra({ heima = G.HEIMA, snid = SNID } = {}) {
  try {
    const kaflar = lesaSnid(snid);
    const skra = path.join(heima, 'CLAUDE.md');
    const lesa = () => {
      let b = null;
      for (let i = 0; ; i++) {
        try { b = fs.readFileSync(skra); break; }
        catch (e) {
          if (e.code === 'ENOENT') break;
          if (!UPPTEKIN.includes(e.code) || i >= 3) throw e;   // önnur lota er að skipta skránni út í þessari andrá
          bida(15 * (i + 1));
        }
      }
      if (b == null) return { nu: null, utf8: true };
      const nu = b.toString('utf8');
      return { nu, utf8: Buffer.from(nu, 'utf8').equals(b) };   // UTF-16 eða skemmd skrá lifir ekki af umritun → ekki snert
    };
    const fyrst = lesa();
    if (!fyrst.utf8) return { stada: 'sleppt', kaflar: [], villa: 'CLAUDE.md er ekki UTF-8' };
    const g0 = greina(fyrst.nu, kaflar);
    if (!g0.vantar.length && !g0.breytt.length) return { stada: 'til', kaflar: [] };   // algengasta leiðin: einn lestur, ekkert skrifað
    fs.mkdirSync(heima, { recursive: true });
    // Lás: margar lotur byrja oft í sömu andrá (Powerplan ræsti sjö í einu). Án hans læsu tvær „vantar“ og bættu báðar við.
    const r = medLas(skra + '.lotukerfi-las', () => {
      const { nu, utf8 } = lesa();   // lesið AFTUR undir lásnum
      if (!utf8) return { stada: 'sleppt', kaflar: [], villa: 'CLAUDE.md er ekki UTF-8' };
      const g = greina(nu, kaflar);
      if (!g.vantar.length && !g.breytt.length) return { stada: 'til', kaflar: [] };
      const nytt = beita(nu, kaflar, g);
      if (nu == null) fs.writeFileSync(skra, nytt, 'utf8');
      else {
        const afrit = path.join(heima, 'backups', 'lotukerfi', new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid);
        fs.mkdirSync(afrit, { recursive: true });
        fs.writeFileSync(path.join(afrit, 'CLAUDE.md'), nu, 'utf8');
        skrifaHeilt(skra, nytt);
      }
      return { stada: nu == null ? 'buin_til' : g.breytt.length ? 'uppfaert' : 'baett_vid',
        kaflar: KAFLAR.map((k) => k.nafn).filter((n) => g.vantar.includes(n) || g.breytt.includes(n)) };
    });
    return r || { stada: 'upptekid', kaflar: [] };   // önnur lota er að skrifa núna — hún klárar verkið
  } catch (e) {
    return { stada: 'villa', kaflar: [], villa: String((e && e.message) || e).slice(0, 160) };
  }
}

/* Bráðabirgðaskrá + endurnefning: enginn les hálfskrifaða skrá. Sé skráin tákntengill er skrifað í skrána sem hann
 * bendir á, svo tengillinn haldist. Á Windows bregst endurnefning (EPERM) á meðan annað ferli hefur skrána opna til
 * lestrar — mælt 18.11.2026 með átta lotum í einu — svo reynt er aftur í nokkrar ms, og að lokum skrifað beint í skrána. */
const UPPTEKIN = ['EPERM', 'EBUSY', 'EACCES'];
function bida(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {} }
function skrifaHeilt(skra, efni) {
  let mark = skra;
  try { if (fs.lstatSync(skra).isSymbolicLink()) mark = fs.realpathSync(skra); } catch (_) {}
  const t = mark + '.' + process.pid + '.tmp';
  fs.writeFileSync(t, efni, 'utf8');
  try {
    for (let i = 0; ; i++) {
      try { fs.renameSync(t, mark); return; }
      catch (e) { if (!UPPTEKIN.includes(e.code) || i >= 5) throw e; bida(15 * (i + 1)); }
    }
  } catch (e) {
    try { fs.unlinkSync(t); } catch (_) {}
    if (!UPPTEKIN.includes(e.code)) throw e;
    fs.writeFileSync(mark, efni, 'utf8');   // lesandi heldur skránni enn: beint í hana (afrit er þegar til)
  }
}

/* Einkalás með skrá (búin til með 'wx'). Skilar gildi fn(), eða null ef önnur lota heldur lásnum. Lás eldri en 30 s er
 * leifar af ferli sem dó og er tekinn yfir. */
function medLas(las, fn) {
  let fd;
  try { fd = fs.openSync(las, 'wx'); }
  catch (e) {
    // EPERM/EACCES/EBUSY: á Windows er lás sem annað ferli er AÐ eyða í „eyðing í bið“ og opnast ekki — sama og upptekinn.
    if (e.code !== 'EEXIST' && !UPPTEKIN.includes(e.code)) throw e;
    let aldur = 0;
    try { aldur = Date.now() - fs.statSync(las).mtimeMs; } catch (_) {}
    if (aldur < 30000) return null;
    try { fs.unlinkSync(las); fd = fs.openSync(las, 'wx'); } catch (_) { return null; }
  }
  try { return fn(); } finally { try { fs.closeSync(fd); } catch (_) {} try { fs.unlinkSync(las); } catch (_) {} }
}

/* Vinnuskjalamappan — búin til ef hana vantar, svo lotan hafi alltaf stað fyrir skjöl sem mega ekki í repó. */
function tryggjaVinnuskjol(opt = {}) {
  try { const m = vinnuskjol(opt); fs.mkdirSync(m, { recursive: true }); return m; } catch (_) { return null; }
}

/* Hefur þessi lota þegar fengið kaflann? Skrá: ~/.claude/lokanir-sed.json { <session_id>: <ms> }, mest 300 nýjustu.
 * merkja(id) skráir; einuSinni(id) skilar true í FYRSTA sinn og skráir um leið. Án session_id: aldrei (false) — betra að
 * þegja en að endurtaka kaflann í hverju skeyti. Bilun í skránni → false. Tvær lotur í sömu andrá geta misst merki hvor
 * annarrar; versta afleiðing er að kaflinn birtist einu sinni enn í annarri þeirra. */
const SED = (heima) => path.join(heima, 'lokanir-sed.json');
function lesaSed(heima) { try { const j = JSON.parse(fs.readFileSync(SED(heima), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; } }
function merkja(id, { heima = G.HEIMA, nu = Date.now() } = {}) {
  if (!id) return false;
  try {
    const s = lesaSed(heima);
    s[String(id)] = nu;
    const ny = Object.fromEntries(Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 300));
    fs.mkdirSync(heima, { recursive: true });
    skrifaHeilt(SED(heima), JSON.stringify(ny));
    return true;
  } catch (_) { return false; }
}
function einuSinni(id, opt = {}) {
  if (!id) return false;
  const heima = opt.heima || G.HEIMA;
  try { if (Object.prototype.hasOwnProperty.call(lesaSed(heima), String(id))) return false; } catch (_) { return false; }
  return merkja(id, opt);
}

module.exports = { texti, tryggjaNotandaskra, tryggjaVinnuskjol, vinnuskjol, adalRepo, einuSinni, merkja, lesaSnid, medLas, skrifaHeilt, KAFLAR, SNID };
