// _rekstur.js — reiknireglur Rekstrarskýrslunnar (Agnar 18.11.2026: „Rekstrarskýrslu fyrir daginn, fyrir bæði félögin").
//
// Hrein föll: taka hráar raðir (sóttar í rekstrarskyrsla.js) og skila tölum fyrir 7 tímabil:
//   dag · vika (mán→dagur) · svika (fyrri mán–sun) · man (1. → dagur) · m1 · m2 · m3 (þrír heilir mánuðir á undan).
// Ísland er UTC allt árið, svo dagsetning = fyrstu 10 stafir ISO-tímans.
//
// EIN skilgreining per tölu — engin ný regla búin til hér:
//  • Tekjur Slökkvitækis = tekjuregla slokkvitaeki/netlify/functions/_tekjur.cjs (slokkvitaekiGildar): solur status
//    'final', upphaed_an_vsk eftir created_at, kreditnóta á ógilda sölu úti.
//    KREDITNÓTUR MIÐAST VIÐ DAGSETNINGU FRUMSÖLUNNAR (Agnar 22.11.2026: „0 fellur bara út“): nóta (credit_of → frumsala) telst á
//    created_at frumsölunnar (tekjur, ný tæki) og paid_at||created_at hennar (verslun), svo salan og nótan jafnast út í sama
//    tímabili. Finnist frumsalan ekki (g.frumsolur) heldur nótan eigin degi og er talin í ut.kreditAnFrumsolu — aldrei þögult.
//  • Ný slökkvitæki = public.solulina_vara/solulina_magn (slokkvitaeki sql/vorur_selt_og_birgdahreyfing.sql),
//    vorur.flokkur 'Slökkvitæki', allar 'final' sölur (kredit ber neikvætt magn).
//  • Rukkanlegir tímar = Tímavera án K.ORUKKANLEGT og K.GATA (_krofu-flokkun.js); virði = klst × dagvinnutaxti
//    verkstaðar í Verðskrá (pricing_guide), annars 9.951 (sjálfgefni taxti drog-timar.js). Yfirvinna ekki reiknuð.
//  • Landspítalinn = nlsh-uppgjor.js (VERK, studull): stakir SerialNumber per category_group, × taxti m. vsk, ÷ 1,24.
//    „NLSH 5-6. hæð · gatakort" er AFRIT sömu gata í skr_hub_skraningar (mælt 18.11: 2.203 vs 2.188 Done-raðir) → sleppt.
//    Dagsett eftir checked_date (annars execution_date), sama og uppgjörssíðan.
//  • Heklureitur = gata-uppgjor.js: Gat*-raðir eftir execution_date × hole_size_rates (heklureitur → generic, miðja bils).
//  • Dalvegur 30 er líka gataverk (K.GATA: tímar hans ekki rukkanlegir) en göt hans eru EKKI verðlögð hér — ekkert
//    Done-gat síðan 03.07.2026 og engir tímar frá ágúst (mælt 18.11). Fari verkið aftur af stað þarf að bæta því við.
//  • Greitt Brunahólfi = Payday PAID eftir greidsla_date (hofudstoll); Slökkvitæki = payday_invoices_slokk PAID (amount_ex).
// Allar fjárhæðir án vsk.

const { ORUKKANLEGT, GATA } = require('./_krofu-flokkun.js');
const { VERK, studull, NLSH_NAMES } = require('./nlsh-uppgjor.js');

const SJALFGEFINN_TAXTI = 9951;
const VSK = 1.24;
const NLSH_AFRIT = 'NLSH 5-6. hæð · gatakort';
const HEKLU_NOFN = ['Heklureitur', 'Heklu reitur'];
const MAN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
const VIKUDAGAR = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];

// ---- dagsetningar ----
const iso = (d) => d.toISOString().slice(0, 10);
const dagsetning = (s) => new Date(s + 'T00:00:00Z');
const plusDagar = (s, n) => { const d = dagsetning(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dagur = (v) => (v ? String(v).slice(0, 10) : null);
function manudagur(s) { const d = dagsetning(s); const wd = (d.getUTCDay() + 6) % 7; return plusDagar(s, -wd); }
function manFyrsti(s, aftur = 0) { const d = dagsetning(s); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - aftur); return iso(d); }
function manSidasti(s, aftur) { return plusDagar(manFyrsti(s, aftur - 1), -1); }
const ddmm = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;

// Tímabilin sjö fyrir valinn dag.
function timabil(d) {
  const man = manudagur(d);
  const t = [
    { k: 'dag', fra: d, til: d },
    { k: 'vika', fra: man, til: d },
    { k: 'svika', fra: plusDagar(man, -7), til: plusDagar(man, -1) },
    { k: 'man', fra: manFyrsti(d), til: d },
  ];
  for (let i = 1; i <= 3; i++) t.push({ k: 'm' + i, fra: manFyrsti(d, i), til: manSidasti(d, i) });
  return t.map((p) => ({ ...p, heiti: heitiTimabils(p, d) }));
}
function heitiTimabils(p, d) {
  if (p.k === 'dag') return { n: ddmm(d), s: VIKUDAGAR[dagsetning(d).getUTCDay()] };
  if (p.k === 'vika') return { n: 'VIKAN', s: p.fra === p.til ? ddmm(p.fra) : `${ddmm(p.fra)}–${ddmm(p.til)}` };
  if (p.k === 'svika') return { n: 'SÍÐASTA VIKA', s: `${ddmm(p.fra)}–${ddmm(p.til)}` };
  const m = MAN[dagsetning(p.fra).getUTCMonth()].toUpperCase();
  if (p.k === 'man') return { n: m, s: `${ddmm(p.fra)}–${ddmm(p.til)}` };
  return { n: m, s: 'heill mánuður' };
}
// „Hvernig gengur reksturinn?“ (22.11.2026): sex heilir mánuðir á undan + líðandi mánuður til dags — sjö tímabil, sama lögun og
// timabil() svo brunaholf()/slokkvitaeki() nýtist óbreytt.
function manudir(d) {
  const t = [];
  for (let i = 6; i >= 1; i--) t.push({ k: 'm' + i, fra: manFyrsti(d, i), til: manSidasti(d, i) });
  t.push({ k: 'man', fra: manFyrsti(d), til: d });
  return t.map((p) => ({ ...p, heiti: heitiTimabils(p, d) }));
}
// Fyrsti dagur sem gögn þarf að sækja frá: elsti mánuðurinn eða 35 dagar aftur (röðin + samanburður vikna).
function fyrstiDagur(d) { const a = manFyrsti(d, 3), b = plusDagar(d, -34); return a < b ? a : b; }

const tomt = () => [0, 0, 0, 0, 0, 0, 0];
function iTimabilum(per, s, fn) { if (!s) return; for (let i = 0; i < per.length; i++) if (s >= per[i].fra && s <= per[i].til) fn(i); }
const tala = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ---- Slökkvitæki ----
function vorurKort(vorur) {
  const byId = new Map(), byNafn = new Map();
  const rodud = [...(vorur || [])].sort((a, b) => (b.virkt === true) - (a.virkt === true) || Number(a.id) - Number(b.id));
  for (const v of rodud) {
    byId.set(Number(v.id), v);
    const k = String(v.nafn || '').trim().toLowerCase();
    if (k && !byNafn.has(k)) byNafn.set(k, v);
  }
  return { byId, byNafn };
}
// = public.solulina_vara(l)
function solulinaVara(l, kort) {
  const pid = l && l.product_id != null ? String(l.product_id) : '';
  if (/^\d+$/.test(pid)) return kort.byId.get(Number(pid)) || null;
  if (pid !== '') return null;
  const nafn = String((l && l.desc) || '')
    .replace(/^\s*(Nýtt|Vara)\s*·\s*/i, '')
    .replace(/\s*·\s*[−-]\s*\d+([.,]\d+)?\s*%.*$/, '')
    .trim().toLowerCase();
  return kort.byNafn.get(nafn) || null;
}
// = public.solulina_magn(l)
function solulinaMagn(l) {
  const q = l && l.qty != null ? String(l.qty) : '';
  return /^\s*-?\d+(\.\d+)?\s*$/.test(q) ? Number(q) : 0;
}

function slokkvitaeki(per, g) {
  const ut = { tekjur: tomt(), verslun: tomt(), krafa: tomt(), reikn: tomt(), ny: tomt(), uttekt: tomt(),
    inn: tomt(), ut: tomt(), sent: tomt(), sentN: tomt(), greitt: tomt(), greittN: tomt(), verkstaedi: { nu: 0, bida: 0 } };
  const voidIds = new Set((g.voidIds || []).map(Number));
  const kort = vorurKort(g.vorur);
  // frumsölur kreditnóta: úr sama lestri eða g.frumsolur (sótt sér, því nótan getur verið í öðru tímabili en frumsalan)
  const frum = new Map();
  for (const s of g.frumsolur || []) frum.set(Number(s.id), s);
  for (const s of g.solur || []) frum.set(Number(s.id), s);
  ut.kreditAnFrumsolu = 0;
  for (const s of g.solur || []) {
    const st = String(s.status || '');
    const upph = tala(s.upphaed_an_vsk);
    if (st !== 'void' && s.krafa_sent_at) iTimabilum(per, dagur(s.krafa_sent_at), (i) => { ut.sent[i] += upph; ut.sentN[i]++; });
    if (st !== 'final') continue;
    // Kreditnóta fylgir frumsölunni: dagsetning hennar ræður tímabilinu (Agnar 22.11.2026)
    const fs = s.credit_of != null ? frum.get(Number(s.credit_of)) : null;
    if ((s.credit_of != null || s.is_credit === true) && !fs && !(s.credit_of != null && voidIds.has(Number(s.credit_of)))) ut.kreditAnFrumsolu++;
    const dagSolu = dagur((fs || s).created_at);
    const dagGreitt = dagur((fs || s).paid_at || (fs || s).created_at);
    // ný tæki: allar lokaðar sölur, eins og v_vorur_selt
    if (Array.isArray(s.linur)) {
      let q = 0;
      for (const l of s.linur) { const v = solulinaVara(l, kort); if (v && v.flokkur === 'Slökkvitæki') q += solulinaMagn(l); }
      if (q) iTimabilum(per, dagSolu, (i) => { ut.ny[i] += q; });
    }
    const kredit = s.is_credit === true;
    // tekjuregla (_tekjur.cjs slokkvitaekiGildar): röð sem vísar á ógilda sölu (credit_of) er úti, hvort sem is_credit er sett eða ekki
    if (s.credit_of != null && voidIds.has(Number(s.credit_of))) continue;
    iTimabilum(per, dagSolu, (i) => { ut.tekjur[i] += upph; });
    if (s.greitt_med === 'kort' || s.greitt_med === 'reidufe') iTimabilum(per, dagGreitt, (i) => { ut.verslun[i] += upph; });
    if (s.greitt_med === 'reikningur' && !kredit) iTimabilum(per, dagur(s.created_at), (i) => { ut.krafa[i] += upph; ut.reikn[i]++; });
  }
  // verkstæði: eitt tæki = ein verklidur-röð á lifandi verkbeiðni
  const taeki = new Map();
  for (const l of g.verklidur || []) {
    if (l.eytt_at || l.status === 'eytt') continue;
    taeki.set(l.job_id, (taeki.get(l.job_id) || 0) + 1);
  }
  for (const b of g.verkbeidnir || []) {
    if (b.eytt_at || b.status === 'eytt') continue;
    const n = taeki.get(b.id) || 0;
    if (b.status === 'received' || b.status === 'inprogress') ut.verkstaedi.nu += n;
    if (b.status === 'ready') ut.verkstaedi.bida += n;
    iTimabilum(per, dagur(b.created_at), (i) => { ut.inn[i] += n; });
    if (b.status === 'collected') iTimabilum(per, dagur(b.pickup), (i) => { ut.ut[i] += n; });
  }
  for (const d of g.uttektir || []) {
    if (d.is_duplicate === true) continue;
    iTimabilum(per, dagur(d.doc_date), (i) => { ut.uttekt[i]++; });
  }
  for (const p of g.paydaySl || []) {
    if (p.status !== 'PAID') continue;
    iTimabilum(per, dagur(p.paid_date), (i) => { ut.greitt[i] += tala(p.amount_ex); ut.greittN[i]++; });
  }
  return ut;
}

// ---- Brunahólf ----
function taxtar(pricing) {
  const m = new Map();
  const rodud = [...(pricing || [])].filter((p) => tala(p.dagvinna_rate) > 0)
    .sort((a, b) => String(b.effective_from || '').localeCompare(String(a.effective_from || '')));
  // distinct on (lower(trim(nafn))) order by effective_from desc nulls last
  const medDags = rodud.filter((p) => p.effective_from), anDags = rodud.filter((p) => !p.effective_from);
  for (const p of [...medDags, ...anDags]) {
    const k = String(p.worksite_name || '').trim().toLowerCase();
    if (k && !m.has(k)) m.set(k, tala(p.dagvinna_rate));
  }
  return m;
}
const rukkanlegt = (verk) => !ORUKKANLEGT.test(String(verk || '')) && !GATA.test(String(verk || ''));

function heklaTaxtar(rates) {
  const rateBySize = new Map();
  const rodud = [...(rates || [])].sort((a, b) => Number(a.size_min_mm) - Number(b.size_min_mm));
  for (const r of rodud) {
    const key = `${r.size_min_mm}-${r.size_max_mm}`;
    const fyrir = rateBySize.get(key);
    if (!fyrir || r.scope === 'heklureitur') rateBySize.set(key, r);
  }
  return function taxti(group) {
    const m = String(group || '').match(/(\d{3,4})-(\d{3,4})/);
    if (!m) return null;
    const lo = parseInt(m[1], 10), hi = parseInt(m[2], 10);
    const beint = rateBySize.get(`${lo}-${hi}`);
    if (beint) return Number(beint.rate_an_vsk);
    const mid = (lo + hi) / 2;
    for (const r of rateBySize.values()) if (mid >= Number(r.size_min_mm) && mid < Number(r.size_max_mm) + 1) return Number(r.rate_an_vsk);
    return null;
  };
}

// NLSH-virði (án vsk) fyrir safn raða: stakir serial per (category_group, mánuður) × studull × taxti ÷ 1,24.
function nlshVirdi(radir) {
  const hopar = new Map();
  for (const r of radir) {
    // eins og nlsh-uppgjor.js: tómur flokkur eða serial ekki talinn, flokkur snyrtur
    const g = String(r.category_group || '').trim();
    if (!g || !r.serial_number) continue;
    const k = `${g}|${r.dd.slice(0, 7)}`;
    if (!hopar.has(k)) hopar.set(k, { g, man: r.dd.slice(0, 7), s: new Set() });
    hopar.get(k).s.add(r.serial_number);
  }
  let mvsk = 0, stakar = 0;
  for (const h of hopar.values()) {
    stakar += h.s.size;
    const v = VERK.find((x) => x.test.test(h.g));
    if (!v) continue;
    mvsk += h.s.size * studull(v, h.man) * v.rate;
  }
  return { stakar, an_vsk: mvsk / VSK };
}

function brunaholf(per, g) {
  const ut = { klst: tomt(), tima: tomt(), got: tomt(), lshG: tomt(), lshV: tomt(), hekG: tomt(), hekV: tomt(),
    bokun: tomt(), bokunN: tomt(), greitt: tomt(), greittN: tomt(), virdi: tomt() };
  const tx = taxtar(g.pricing);
  for (const e of g.timavera || []) {
    if (!rukkanlegt(e.project)) continue;
    const h = tala(e.hours);
    const rate = tx.get(String(e.project || '').trim().toLowerCase()) || SJALFGEFINN_TAXTI;
    iTimabilum(per, dagur(e.date), (i) => { ut.klst[i] += h; ut.tima[i] += h * rate; });
  }
  // Ajour: lokin göt (Done), afritið af NLSH úti. Dagsetning eftir uppgjörsreglu verksins svo talan stemmi við
  // uppgjörssíðuna: Landspítalinn = checked_date, annars execution_date (nlsh-uppgjor.js); önnur verk = execution_date
  // (gata-uppgjor.js), annars checked_date.
  const nlshNofn = new Set(NLSH_NAMES);
  const done = [];
  for (const r of g.ajour || []) {
    if (r.registration_status !== 'Done' || r.project_name === NLSH_AFRIT) continue;
    const dd = dagur(nlshNofn.has(r.project_name) ? (r.checked_date || r.execution_date) : (r.execution_date || r.checked_date));
    if (!dd) continue;
    done.push({ ...r, dd });
  }
  const heklaTaxti = heklaTaxtar(g.holeRates);
  per.forEach((p, i) => {
    const inni = done.filter((r) => r.dd >= p.fra && r.dd <= p.til);
    ut.got[i] = new Set(inni.map((r) => `${r.project_name}|${r.serial_number}`)).size;
    const nl = nlshVirdi(inni.filter((r) => nlshNofn.has(r.project_name)));
    ut.lshG[i] = nl.stakar;
    ut.lshV[i] = nl.an_vsk;
    for (const r of inni) {
      if (!HEKLU_NOFN.includes(r.project_name) || !r.execution_date || !/^gat/i.test(String(r.category_group || ''))) continue;
      const t = heklaTaxti(r.category_group);
      if (t == null) continue;
      ut.hekG[i]++;
      ut.hekV[i] += t;
    }
  });
  // Sent til bókunar úr Kröfu yfirliti: lykill draftinv|<verkstaður>|<mánuður> → drögin
  const drog = new Map((g.drog || []).map((d) => [`draftinv|${d.worksite_name}|${d.work_month}`, tala(d.total_m_vsk)]));
  for (const m of g.sentMeta || []) {
    if (m.sent !== true || !m.sent_at || !drog.has(m.inv_key)) continue;
    iTimabilum(per, dagur(m.sent_at), (i) => { ut.bokun[i] += drog.get(m.inv_key) / VSK; ut.bokunN[i]++; });
  }
  for (const r of g.paydayBh || []) {
    if (r.status !== 'PAID') continue;
    iTimabilum(per, dagur(r.greidsla_date), (i) => { ut.greitt[i] += tala(r.hofudstoll); ut.greittN[i]++; });
  }
  for (let i = 0; i < 7; i++) ut.virdi[i] = ut.tima[i] + ut.lshV[i] + ut.hekV[i];
  return ut;
}

// Dagleg röð (síðustu 30 dagar) og samanburður: dagur ↔ sami vikudagur fyrri viku, vikan ↔ sömu dagar fyrri viku,
// síðasta vika ↔ vikan á undan. Notar sömu reglur, einn dag í senn.
function dagsrod(d, g) {
  const fra = plusDagar(d, -34);
  const dagar = [];
  for (let s = fra; s <= d; s = plusDagar(s, 1)) dagar.push({ k: s, fra: s, til: s });
  const ut = [];
  for (let i = 0; i < dagar.length; i += 7) {
    const hluti = dagar.slice(i, i + 7);
    while (hluti.length < 7) hluti.push({ k: 'x', fra: '9999-12-31', til: '9999-12-31' });
    const sl = slokkvitaeki(hluti, g), bh = brunaholf(hluti, g);
    hluti.forEach((p, j) => { if (p.k !== 'x') ut.push({ d: p.k, sl: Math.round(sl.tekjur[j]), bh: Math.round(bh.virdi[j]) }); });
  }
  return ut;
}
function samanburdur(d, rod) {
  const summa = (fra, til) => rod.filter((r) => r.d >= fra && r.d <= til).reduce((a, r) => ({ sl: a.sl + r.sl, bh: a.bh + r.bh }), { sl: 0, bh: 0 });
  const man = manudagur(d);
  const vd = VIKUDAGAR[dagsetning(d).getUTCDay()].slice(0, 3) + '.';
  return {
    dag: { nu: summa(d, d), fyrr: summa(plusDagar(d, -7), plusDagar(d, -7)), merki: `${vd} ${ddmm(plusDagar(d, -7))}` },
    vika: { nu: summa(man, d), fyrr: summa(plusDagar(man, -7), plusDagar(d, -7)), merki: 'sömu daga í fyrri viku' },
    svika: { nu: summa(plusDagar(man, -7), plusDagar(man, -1)), fyrr: summa(plusDagar(man, -14), plusDagar(man, -8)), merki: 'vikuna á undan' },
  };
}

// INNHEIMTA Brunahólfs (án vsk, höfuðstóll) — sama skilgreining og hjá Slökkvitæki (payday_invoices_slokk), svo tölurnar séu samanburðarhæfar:
//   innheimtuhlutfall = greitt ÷ (greitt + gjaldfallið ógreitt) á reikningum útgefnum frá `fra`;
//   gjaldfallið = SENT (ekki greiddur í Payday og ekki merktur greiddur í Kröfu yfirliti) með gjalddaga á undan deginum í dag;
//   greiðsluhraði = miðgildi daga frá útgáfu til greiðslu á reikningum greiddum síðustu 90 daga.
// Greitt = Payday PAID (greidsla_date) + SENT merktur greiddur í Kröfu yfirliti innan 120 daga frá útgáfu (sama regla og saekja()).
// radir = invoices (source payday) {tilvisun, status, utgafudagur, gjalddagi, greidsla_date, hofudstoll}; hand = krofur_yfirlit_meta paid.
function innheimta(radir, hand, idag, fra) {
  const handAf = new Map();
  for (const m of hand || []) {
    const t = (/^payday\|(\d{1,12})$/.exec((m && m.inv_key) || '') || [])[1];
    if (t && m.paid_at) handAf.set(String(t), dagur(m.paid_at));
  }
  const DAGUR_MS = 86400000;
  const dagaMilli = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAGUR_MS);
  const ut = { fra, greitt_kr: 0, greitt_n: 0, gjaldfallid_kr: 0, gjaldfallid_n: 0, yfir45_kr: 0, yfir45_n: 0, ogreitt_kr: 0, ogreitt_n: 0, hand_n: 0 };
  const hradi = [];
  const fyrir90 = plusDagar(idag, -90), fyrir45 = plusDagar(idag, -45);
  for (const r of radir || []) {
    const utg = dagur(r.utgafudagur), kr = tala(r.hofudstoll);
    if (!utg || utg < fra || !(kr > 0)) continue;
    let greiddur = null;
    if (r.status === 'PAID' && r.greidsla_date) greiddur = dagur(r.greidsla_date);
    else if (r.status === 'SENT' && handAf.has(String(r.tilvisun))) {
      const dm = dagaMilli(utg, handAf.get(String(r.tilvisun)));
      if (dm >= 0 && dm <= 120 && handAf.get(String(r.tilvisun)) <= idag) { greiddur = handAf.get(String(r.tilvisun)); ut.hand_n++; }
    }
    if (greiddur) {
      ut.greitt_kr += kr; ut.greitt_n++;
      if (greiddur >= fyrir90 && greiddur <= idag) { const dm = dagaMilli(utg, greiddur); if (dm >= 0) hradi.push(dm); }
      continue;
    }
    if (r.status !== 'SENT') continue;
    ut.ogreitt_kr += kr; ut.ogreitt_n++;
    const gj = dagur(r.gjalddagi);
    if (gj && gj < idag) {
      ut.gjaldfallid_kr += kr; ut.gjaldfallid_n++;
      if (gj < fyrir45) { ut.yfir45_kr += kr; ut.yfir45_n++; }
    }
  }
  const nefnari = ut.greitt_kr + ut.gjaldfallid_kr;
  ut.hlutfall = nefnari > 0 ? Math.round((1000 * ut.greitt_kr) / nefnari) / 10 : null;
  hradi.sort((a, b) => a - b);
  ut.hradi_n = hradi.length;
  ut.hradi_midgildi = hradi.length ? (hradi.length % 2 ? hradi[(hradi.length - 1) / 2] : (hradi[hradi.length / 2 - 1] + hradi[hradi.length / 2]) / 2) : null;
  for (const k of ['greitt_kr', 'gjaldfallid_kr', 'yfir45_kr', 'ogreitt_kr']) ut[k] = Math.round(ut[k]);
  return ut;
}

function skyrsla(d, g) {
  const per = timabil(d);
  const sl = slokkvitaeki(per, g);
  const bh = brunaholf(per, g);
  const rodAll = dagsrod(d, g);
  const kr = (a) => a.map((x) => Math.round(x));
  const klst = (a) => a.map((x) => Math.round(x * 10) / 10);
  return {
    dagur: d,
    timabil: per,
    sl: { ...sl, tekjur: kr(sl.tekjur), verslun: kr(sl.verslun), krafa: kr(sl.krafa), sent: kr(sl.sent), greitt: kr(sl.greitt) },
    bh: { ...bh, klst: klst(bh.klst), tima: kr(bh.tima), lshV: kr(bh.lshV), hekV: kr(bh.hekV), bokun: kr(bh.bokun), greitt: kr(bh.greitt), virdi: kr(bh.virdi) },
    badir: {
      tekjur: per.map((_, i) => Math.round(sl.tekjur[i] + bh.virdi[i])),
      inn: per.map((_, i) => Math.round(sl.verslun[i] + sl.greitt[i] + bh.greitt[i])),
    },
    rod: rodAll.slice(-30),
    samanburdur: samanburdur(d, rodAll),
  };
}

module.exports = { skyrsla, timabil, manudir, innheimta, fyrstiDagur, slokkvitaeki, brunaholf, solulinaVara, solulinaMagn, vorurKort, heklaTaxtar, taxtar, nlshVirdi, manudagur, plusDagar, NLSH_AFRIT };
