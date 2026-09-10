#!/usr/bin/env node
/* ajour-vinnutimi.cjs — hvenær var raunverulega unnið, EINGÖNGU út frá Ajour.
 *
 *   node tools/ajour-vinnutimi.cjs <export.json|export.xml> [--nr 20,24] [--hvida 20]
 *
 * Agnar 10.09.2026: „ekki skoða tímavera". Tímaskráningin er sjálfsögð og
 * mælist að hluta til vera sniðmát — hjá tveimur af fjórum starfsmönnum er
 * mætingin innan ±2 mínútna af sama tíma nær alla daga, sem er ekki maður að
 * stimpla sig inn. Þessi greining snertir hana ekki. Hún notar EINGÖNGU
 * tímastimpla sem verða til við vinnuna sjálfa: `CheckListItemCheckedDate`.
 *
 * ── HVAÐ STIMPILLINN SEGIR, OG HVAÐ HANN SEGIR EKKI ───────────────────────
 * Hann segir hvenær gátlistinn var HAKAÐUR, ekki hvenær gatið var gert.
 * Mælt í raungögnum (Hamza, 4. sept): sex göt skráð 08:56–08:59 og önnur sex
 * 14:42–14:44. Hann vinnur og skráir svo í hviðum. Þess vegna:
 *   • FYRSTA hviða  = EFRI mörk á upphafi dags — götin voru unnin á undan.
 *   • SÍÐASTA hviða = NEÐRI mörk á lokum — hann var að minnsta kosti að
 *     störfum þangað til.
 *   • Spönnin milli þeirra er ÖRUGGUR vinnutími, aldrei allur vinnutíminn.
 * Talan er því gólf, ekki mæling. Hún er samt sú eina í kerfinu sem verður til
 * af vinnunni sjálfri og enginn slær inn eftir á.
 *
 * FJÖLDI HVIÐA segir hversu oft dagurinn var skráður. Ein hviða klukkan hálf
 * fjögur þýðir að allur dagurinn var skráður eftir minni í lokin — þá er
 * dagsetningin sjálf ónákvæm. Tvær eða þrjár hviður dreifðar um daginn þýða
 * að skráð var jafnóðum og tímarnir eru marktækir.
 *
 * TÖFIN (skráð − framkvæmt) afhjúpar hitt: sé gat framkvæmt á þriðjudegi en
 * hakað á fimmtudegi eru allar dagatölur þess manns skakkar.
 *
 * Skráin kemur beint úr Ajour: Export → „Export all filtered data" → Json
 * (eða Xml). CSV DUGAR EKKI — það snið hendir `RegistrationCreatedDate`-
 * tímanum og geymir aðeins sekúndur á gátlistanum; JSON/XML bera millisekúndur
 * og hreiðraða gátlista. Ekkert sniðanna ber tímabelti.
 */
const fs = require('fs');

const args = process.argv.slice(2);
const skra = args.find(a => !a.startsWith('--'));
const argVal = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const siaNr = (argVal('nr', '') || '').split(',').map(x => x.trim()).filter(Boolean);
const HVIDA_MIN = +argVal('hvida', 20);          // hlé lengra en þetta hefur nýja hviðu

if (!skra) {
  console.error('Notkun: node tools/ajour-vinnutimi.cjs <export.json|export.xml> [--nr 20,24] [--hvida 20]');
  process.exit(1);
}

const hrátt = fs.readFileSync(skra, 'utf8').replace(/^﻿/, '');
const skraningar = skra.toLowerCase().endsWith('.xml') ? lesXml(hrátt) : lesJson(hrátt);

// ── Lesarar ───────────────────────────────────────────────────────────────
function lesJson(t) {
  const d = JSON.parse(t);
  const rows = Array.isArray(d) ? d : (d.data || Object.values(d)[0]);
  return rows.map(r => ({
    serial: String(r.SerialNumber || ''),
    nr: nrAf(r.Category),
    stada: r.RegistrationStatus || '',
    framkvaemt: (r.ExecutionDateFrom || '').slice(0, 10),
    hok: (r.CheckListItems || []).map(i => i.CheckListItemCheckedDate).filter(Boolean),
  }));
}
// Nógu góður lesari fyrir þetta eina snið — ekki almennur XML-þáttari.
function lesXml(t) {
  const ut = [];
  const blokkir = t.split('<ExportRegistrationModel>').slice(1);
  for (const b of blokkir) {
    const g = (n) => { const m = b.match(new RegExp('<' + n + '>([^<]*)</' + n + '>')); return m ? m[1] : ''; };
    const hok = [...b.matchAll(/<CheckListItemCheckedDate>([^<]*)<\/CheckListItemCheckedDate>/g)].map(m => m[1]).filter(Boolean);
    ut.push({ serial: g('SerialNumber'), nr: nrAf(g('Category')), stada: g('RegistrationStatus'), framkvaemt: g('ExecutionDateFrom').slice(0, 10), hok });
  }
  return ut;
}
function nrAf(c) { const m = String(c || '').match(/(\d+)/); return m ? m[1] : null; }

// ── Safna: starfsmaður → dagur → göt með sínum fyrsta haka ────────────────
const per = new Map();
let tafir = [];
for (const r of skraningar) {
  if (!r.nr || !r.hok.length) continue;
  if (siaNr.length && !siaNr.includes(r.nr)) continue;
  const fyrsti = r.hok.slice().sort()[0];
  const dagur = fyrsti.slice(0, 10);
  if (!per.has(r.nr)) per.set(r.nr, new Map());
  const dg = per.get(r.nr);
  if (!dg.has(dagur)) dg.set(dagur, new Map());
  const g = dg.get(dagur);
  if (!g.has(r.serial) || fyrsti < g.get(r.serial)) g.set(r.serial, fyrsti);
  if (r.framkvaemt && r.framkvaemt !== dagur) {
    tafir.push({ nr: r.nr, serial: r.serial, framkvaemt: r.framkvaemt, skrad: dagur,
      dagar: Math.round((new Date(dagur) - new Date(r.framkvaemt)) / 86400000) });
  }
}

const mín = s => +s.slice(11, 13) * 60 + +s.slice(14, 16);
const hhmm = s => s.slice(11, 16);

console.log('Skrá: ' + skra + '   ' + skraningar.length + ' skráningar' + (siaNr.length ? '   sía: nr ' + siaNr.join(', ') : ''));
console.log('Hviða = nýtt skráningarlot þegar meira en ' + HVIDA_MIN + ' mín líða á milli.\n');

const samtals = [];
for (const nr of [...per.keys()].sort((a, b) => +a - +b)) {
  const dagar = per.get(nr);
  console.log('══ Starfsmaður ' + nr + '  (' + dagar.size + ' dagar)');
  console.log('   DAGUR       FYRSTA  SÍÐASTA  ÖRUGG SPÖNN  HVIÐUR  GÖT   SKRÁNINGARLOT');
  const spannir = [];
  for (const dagur of [...dagar.keys()].sort()) {
    const t = [...dagar.get(dagur).values()].sort();
    const spönn = (mín(t[t.length - 1]) - mín(t[0])) / 60;
    spannir.push(spönn);
    // hviður
    const hv = [[t[0]]];
    for (let i = 1; i < t.length; i++) {
      if (mín(t[i]) - mín(t[i - 1]) > HVIDA_MIN) hv.push([t[i]]);
      else hv[hv.length - 1].push(t[i]);
    }
    console.log('   ' + dagur + '   ' + hhmm(t[0]) + '   ' + hhmm(t[t.length - 1]) +
      '    ' + spönn.toFixed(2).padStart(6) + ' klst' +
      '   ' + String(hv.length).padStart(4) +
      '  ' + String(t.length).padStart(4) +
      '   ' + hv.map(h => hhmm(h[0]) + '(' + h.length + ')').join(' '));
  }
  const m = spannir.reduce((a, b) => a + b, 0) / spannir.length;
  console.log('   → örugg spönn að meðaltali ' + m.toFixed(2) + ' klst/dag\n');
  samtals.push({ nr, dagar: dagar.size, medal: m });
}

if (tafir.length) {
  console.log('⏳ SKRÁÐ Á ÖÐRUM DEGI EN FRAMKVÆMT (' + tafir.length + ') — dagatölur þessara manna eru skakkar:');
  const eftirNr = {};
  tafir.forEach(t => { (eftirNr[t.nr] = eftirNr[t.nr] || []).push(t.dagar); });
  Object.entries(eftirNr).forEach(([nr, d]) => {
    d.sort((a, b) => a - b);
    console.log('   nr ' + nr + ': ' + d.length + ' göt, töf ' + d[0] + '–' + d[d.length - 1] + ' dagar (miðgildi ' + d[Math.floor(d.length / 2)] + ')');
  });
} else {
  console.log('✅ Ekkert gat skráð á öðrum degi en það var framkvæmt — dagsetningarnar halda.');
}
