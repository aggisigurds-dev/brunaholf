/* _lokanir.cjs — „burt með þessar lokanir“ (Agnar 18.11.2026).
 *
 * Þrjár lotur stöðvuðust sama dag á hlutum sem eiga ekki að stöðva neina lotu: innskráningu í vafra lotunnar („Búinn að skrá
 * inn / Nota Chrome“), földum vafraglugga („ég sá þetta ekki á skjá“) og vinnuskjali sem öryggisvörn Claude Code hleypti
 * ekki í opinbert repó („Á ég að ýta skránni?“). Leiðbeiningarnar voru til — en aðeins í ~/.claude/CLAUDE.md á EINNI vél
 * (búin til sama dag); loturnar sem spurðu enn keyrðu á öðrum vélum. Notendaskráin er per vél, hookarnir ekki: þeir liggja
 * í þessu repói og keyra í hverri lotu á hverri vél (setja-hooka.cjs). Þess vegna býr lagfæringin hér:
 *
 *   texti()               stuttur kafli sem lotu-byrjun.cjs setur í byrjun hverrar nýrrar lotu (SessionStart) og router.cjs
 *                         EINU SINNI í lotu sem var þegar í gangi (UserPromptSubmit) — einuSinni() heldur utan um það.
 *   tryggjaNotandaskra()  setur kaflana úr docs/NOTANDA-CLAUDE.md í ~/.claude/CLAUDE.md á vélinni EF þá vantar. Bætir aðeins
 *                         við; yfirskrifar aldrei og snertir ekki annað efni skrárinnar. Kaflarnir eru afmarkaðir með
 *                         <!-- lotukerfi:<nafn> byrjar/endar -->, svo þeim má breyta eða eyða á vélinni án þess að þeir komi aftur
 *                         (merkið „byrjar“ dugar til að kaflinn teljist til staðar).
 *
 * Ekkert hér má nokkurn tíma fella lotu: allt er í try/catch, engin netköll, samstillt og < 20 ms. */
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./_lotu-grunnur.cjs');

const SNID = path.join(G.BH, 'docs', 'NOTANDA-CLAUDE.md');
const KAFLAR = [
  // eldri = texti sem sannar að kaflinn sé þegar í skránni án merkis (vélin þar sem hann var fyrst handskrifaður 18.11.2026)
  { nafn: 'innskraning', eldri: /lotan skráir sig inn SJÁLF/ },
  { nafn: 'lokanir', eldri: null },
];
const byrjar = (n) => '<!-- lotukerfi:' + n + ' byrjar';
const endar = (n) => '<!-- lotukerfi:' + n + ' endar -->';

/* Kaflinn sem fer í byrjun lotu. Stuttur viljandi: hann kostar tóka í HVERRI lotu. Ítarefnið er í notendaskránni. */
function texti({ rot = G.ROT } = {}) {
  const mappa = path.join(rot, '_vinnuskjol');
  return [
    'Lokanir (Agnar 18.11.2026: „burt með þessar lokanir“) — ekkert af þessu stöðvar lotu og Agnar er ekki spurður:',
    '- Innskráning í Slökkvitæki/Brunahólf: lotan skráir sig inn SJÁLF sem „Lota (Claude)“, uid 10 (aldrei uid 1). Aðferðin er í ~/.claude/CLAUDE.md og í CLAUDE.md beggja repóa („Innskráning lotunnar“). Bjóddu aldrei „Búinn að skrá inn / Nota Chrome“; án Supabase-tóls: segðu það í einni línu og vinndu það sem þarf ekki innskráningu.',
    '- Falinn vafragluggi: read_page, get_page_text og javascript_tool virka samt — sannreyndu þannig í stað þess að segja „ég sá þetta ekki á skjá“.',
    '- Vinnuskjöl með kúnnagögnum, pósti eða tölum fara ALDREI í repó (repóin eru opinber; öryggisvörn Claude Code stöðvar það réttilega — farðu ekki framhjá henni og spurðu ekki hvort eigi að ýta). Vistaðu í möppu lotunnar sé hún ekki repó, annars í ' + mappa + ', eða sem nótu á Þjónustuborðinu, og haltu áfram.',
    '- Augljós næstu skref: gerðu þau og segðu frá. Spurðu aðeins um póst/SMS út úr húsi, peninga, eyðingu, verð og borð annarra.',
  ].join('\n');
}

/* Kaflar sniðsins: { nafn → texti með merkjum }. Sniðið verður að bera bæði merkin, annars er kaflanum sleppt (aldrei hálfur kafli). */
function lesaSnid(snid = SNID) {
  const t = fs.readFileSync(snid, 'utf8').replace(/\r\n/g, '\n');
  const ut = {};
  for (const { nafn } of KAFLAR) {
    const a = t.indexOf(byrjar(nafn)), b = t.indexOf(endar(nafn));
    if (a >= 0 && b > a) ut[nafn] = t.slice(a, b + endar(nafn).length);
  }
  return ut;
}

/* Setur þá kafla sem vantar í ~/.claude/CLAUDE.md. Skilar { stada: 'til' | 'buin_til' | 'baett_vid' | 'villa', kaflar: [...], villa? }.
 * Skrifar AÐEINS þegar eitthvað vantar; þá er eldra efni skrárinnar haldið óbreyttu fremst og kaflarnir settir aftast. */
function tryggjaNotandaskra({ heima = G.HEIMA, snid = SNID } = {}) {
  try {
    const kaflar = lesaSnid(snid);
    const skra = path.join(heima, 'CLAUDE.md');
    const stada = () => {
      let nu = null;
      try { nu = fs.readFileSync(skra, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      return { nu, vantar: KAFLAR.filter(({ nafn, eldri }) => kaflar[nafn] && !(nu != null && (nu.includes(byrjar(nafn)) || (eldri && eldri.test(nu))))) };
    };
    if (!stada().vantar.length) return { stada: 'til', kaflar: [] };   // algengasta leiðin: einn lestur, ekkert skrifað
    fs.mkdirSync(heima, { recursive: true });
    // Lás: margar lotur byrja oft í sömu andrá (Powerplan ræsti sjö í einu). Án hans læsu tvær „vantar“ og bættu báðar við.
    const r = medLas(skra + '.lotukerfi-las', () => {
      const { nu, vantar } = stada();   // lesið AFTUR undir lásnum
      if (!vantar.length) return { stada: 'til', kaflar: [] };
      const vidbot = vantar.map(({ nafn }) => kaflar[nafn]).join('\n\n') + '\n';
      if (nu == null) fs.writeFileSync(skra, vidbot, 'utf8');
      else fs.appendFileSync(skra, (nu.endsWith('\n') ? '\n' : '\n\n') + vidbot, 'utf8');
      return { stada: nu == null ? 'buin_til' : 'baett_vid', kaflar: vantar.map((k) => k.nafn) };
    });
    return r || { stada: 'upptekid', kaflar: [] };   // önnur lota er að skrifa núna — hún klárar verkið
  } catch (e) {
    return { stada: 'villa', kaflar: [], villa: String((e && e.message) || e).slice(0, 160) };
  }
}

/* Einkalás með skrá (búin til með 'wx'). Skilar gildi fn(), eða null ef önnur lota heldur lásnum. Lás eldri en 30 s er
 * leifar af ferli sem dó og er tekinn yfir. */
function medLas(las, fn) {
  let fd;
  try { fd = fs.openSync(las, 'wx'); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let aldur = 0;
    try { aldur = Date.now() - fs.statSync(las).mtimeMs; } catch (_) {}
    if (aldur < 30000) return null;
    try { fs.unlinkSync(las); fd = fs.openSync(las, 'wx'); } catch (_) { return null; }
  }
  try { return fn(); } finally { try { fs.closeSync(fd); } catch (_) {} try { fs.unlinkSync(las); } catch (_) {} }
}

/* Vinnuskjalamappan utan git — búin til ef hana vantar, svo lotan hafi alltaf stað fyrir skjöl sem mega ekki í repó. */
function tryggjaVinnuskjol({ rot = G.ROT } = {}) {
  try { const m = path.join(rot, '_vinnuskjol'); fs.mkdirSync(m, { recursive: true }); return m; } catch (_) { return null; }
}

/* Hefur þessi lota þegar fengið kaflann? Skrá: ~/.claude/lokanir-sed.json { <session_id>: <ms> }, mest 300 nýjustu.
 * merkja(id) skráir; einuSinni(id) skilar true í FYRSTA sinn og skráir um leið. Án session_id: aldrei (false) — betra að
 * þegja en að endurtaka kaflann í hverju skeyti. Bilun í skránni → false. */
const SED = (heima) => path.join(heima, 'lokanir-sed.json');
function lesaSed(heima) { try { const j = JSON.parse(fs.readFileSync(SED(heima), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; } }
function merkja(id, { heima = G.HEIMA, nu = Date.now() } = {}) {
  if (!id) return false;
  try {
    const s = lesaSed(heima);
    s[String(id)] = nu;
    const ny = Object.fromEntries(Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 300));
    fs.mkdirSync(heima, { recursive: true });
    // Bráðabirgðaskrá + endurnefning: önnur lota les aldrei hálfskrifaða skrá (hún læsist þá sem tóm og allar lotur fengju kaflann aftur).
    const t = SED(heima) + '.' + process.pid + '.tmp';
    fs.writeFileSync(t, JSON.stringify(ny), 'utf8');
    try { fs.renameSync(t, SED(heima)); } catch (e) { try { fs.unlinkSync(t); } catch (_) {} throw e; }
    return true;
  } catch (_) { return false; }
}
function einuSinni(id, opt = {}) {
  if (!id) return false;
  const heima = opt.heima || G.HEIMA;
  try { if (Object.prototype.hasOwnProperty.call(lesaSed(heima), String(id))) return false; } catch (_) { return false; }
  return merkja(id, opt);
}

module.exports = { texti, tryggjaNotandaskra, tryggjaVinnuskjol, einuSinni, merkja, lesaSnid, medLas, KAFLAR, SNID };
