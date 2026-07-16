// _bunadur.js — SAMEIGINLEG „Fjöldi"-lína búnaðar-lógík fyrir úttektarskýrslur.
// Notað af skyrsla-bunadur.js og felag-endurlestur.js (áður tvítekið — og bæði
// með sömu CO2-villuna).
//
// CO2-GILDRA (2026-07-16): pdf-parse brýtur ₂-subscriptið í „Co₂" upp á EIGIN
// LÍNU — textinn verður „Slökkvitæki Co\n2\n 2 kg. Fjöldi: 1 …". Þar með náðu
// [^\n]-byggðu co2-regexin ALDREI línunni, og meira að segja róbusta
// „Slökkvitæki … Fjöldi"-summan missti hana (merki og Fjöldi á sitthvorri
// línu) → co2_2/co2_5 kerfisbundið 0 í arsskodun_report_facts þó skýrslan
// telji CO2-tæki. normalizeText límir subscript-brotið saman áður en parsað er.

// Sum the integers in a "Fjöldi" value: "1+1 ABF" → 2 · "x" → 0 · "2" → 2.
function sumNums(s){ const m = String(s||'').match(/\d+/g); return m ? m.reduce((a,b) => a + (+b), 0) : 0; }

// Normalize PDF text before any line-based parsing:
// - \r + NBSP → venjulegt
// - ₂ (U+2082 subscript) → 2
// - pdf-parse línubrot í miðju „Co₂"-merki: "Co\n2\n" → "Co2 " (sama lína aftur)
function normalizeText(raw){
  let t = String(raw||'').replace(/\r/g,'').replace(/ /g,' ').replace(/₂/g,'2');
  t = t.replace(/\b(co)[ \t]*\n[ \t]*2[ \t]*\n?/gi, (_, p) => p + '2 ');
  return t;
}

// Each category line: "<label> … Fjöldi: <value> [Í lagi: …]". Value is read up to
// "Í lagi" (or line end) so the "Já/nei/x" status never leaks into the count.
// CO2/kolsýru-línurnar þola að „Slökkvitæki"-forskeytið vanti („Kolsýrutæki 5 kg",
// „CO2 slökkvitæki 2 kg") — línan verður samt að bera „Fjöldi:" svo prósa-texti
// í „Annað" (t.d. „2 kg kolsýruslökkvitæki (Co2) var komið fyrir") telst aldrei.
const CO2_LABEL = '(?:sl[öo]kkvit[æa]ki[ \\t]+)?(?:c[ \\t]?o[ \\t]?2|kols[ýy]r)[^\\n]*?';
const CATS = [
  { key:'lettvatn', grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+l[ée]ttvatn[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'duft_2',   grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+duft\s*2[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'duft_6',   grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+duft\s*6[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'co2_2',    grp:'slk',   re:new RegExp(CO2_LABEL + '2\\s*kg[^\\n]*?fj[öo]ldi:?\\s*([^\\n]*?)(?:[íi]\\s*lagi|$)', 'i') },
  { key:'co2_5',    grp:'slk',   re:new RegExp(CO2_LABEL + '5\\s*kg[^\\n]*?fj[öo]ldi:?\\s*([^\\n]*?)(?:[íi]\\s*lagi|$)', 'i') },
  { key:'bsl',      grp:'bsl',   re:/brunasl[öo]ng[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'teppi',    grp:'teppi', re:/eldvarnarteppi[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'rs',       grp:'rs',    re:/reykskynjar[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
];

function parseBunadur(text){
  const t = normalizeText(text);
  // Per-subtype (best effort, for the tooltip/detail).
  const detail = {};
  for (const c of CATS){ const m = t.match(c.re); detail[c.key] = m ? sumNums(m[1]) : null; }
  // Slk total is computed ROBUSTLY from EVERY "Slökkvitæki … Fjöldi: N" line so a
  // subtype whose exact-size regex misses is never dropped from the sum.
  let slk = 0; { const re = /sl[öo]kkvit[æa]ki\b[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|\n|$)/gi; let m;
    while ((m = re.exec(t))){ slk += sumNums(m[1]); if (re.lastIndex === m.index) re.lastIndex++; } }
  // CO2 total (sömu róbustheit): allar co2/kolsýru-Fjöldi-línur — stærðarlaus
  // CO2-lína (hvorki 2 kg né 5 kg) endar í co2_5 gegnum co2_unknown.
  let co2All = 0; { const re = new RegExp(CO2_LABEL + 'fj[öo]ldi:?\\s*([^\\n]*?)(?:[íi]\\s*lagi|\\n|$)', 'gi'); let m;
    while ((m = re.exec(t))){ co2All += sumNums(m[1]); if (re.lastIndex === m.index) re.lastIndex++; } }
  const co2_unknown = Math.max(0, co2All - (detail.co2_2||0) - (detail.co2_5||0));
  const matched = Object.values(detail).filter(v => v != null).length;
  return { slk, rs: detail.rs||0, bsl: detail.bsl||0, teppi: detail.teppi||0, detail, matched, co2_unknown };
}

// Map parseBunadur → the detailed equipment keys Slökkvitæki's eqGroups() sums
// (lettvatn+duft2+duft6_12+co2_2+co2_5 = SLT; brunaslongur = BSL; reykskynjarar
// = RS). Stærðarlaus CO2 fer í co2_5; any Slk remainder the exact-size regex
// missed is dumped into duft6_12 so the SLT total never under-counts.
function toEquipment(b){
  const d = b.detail || {};
  const co2u = b.co2_unknown || 0;
  const known = (d.lettvatn||0)+(d.duft_2||0)+(d.duft_6||0)+(d.co2_2||0)+(d.co2_5||0)+co2u;
  const remainder = Math.max(0, (b.slk||0) - known);
  return {
    lettvatn: d.lettvatn||0, duft2: d.duft_2||0, duft6_12: (d.duft_6||0)+remainder,
    co2_2: d.co2_2||0, co2_5: (d.co2_5||0)+co2u,
    brunaslongur: b.bsl||0, reykskynjarar: b.rs||0, eldvarnarteppi: b.teppi||0,
  };
}

module.exports = { sumNums, normalizeText, CATS, parseBunadur, toEquipment };
