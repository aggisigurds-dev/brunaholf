// _krofu-flokkun.js — EIN skilgreining á „ógreitt" og „ósent" fyrir Brunahólf.
//
// Notað af: krofu-yfirlit-bru.js (Kröfu yfirlit) og verkkaupar.js (Viðskiptavinir).
//
// Af hverju þetta er sér skrá (31.10.2026, allsherjar úttekt): tvítalningin frá 20.10
// (drög sem voru þegar komin í Payday töldust líka „ósent") var aðeins löguð í Kröfu
// yfirliti. Viðskiptavinir-síðan hélt eigin afriti af reglunum og sýndi 70,4 m.kr.
// „ógreitt" (Payday-drög og faldar kröfur taldar með) og 82,8 m.kr. „ósent" (41,3 m.kr.
// af því þegar í Payday) á meðan Kröfu yfirlit sagði 6,2 m.kr. Reglurnar búa nú hér og
// hvergi annars staðar — breyting á einum stað gildir á báðum síðum.

const digits = (s) => String(s || '').replace(/\D/g, '');
const lc = (s) => String(s || '').trim().toLowerCase();

// Status-flokkun (case-insensitive). Allt sem er hvorki greitt, kreditfært/
// cancelled né draft telst ÓGREITT (þ.m.t. Payday `SENT`).
const PAID = new Set(['greitt', 'greidd', 'greiddur', 'paid']);
const CREDIT = new Set(['kreditreikningur', 'kreditfærður', 'kreditfaerdur', 'credit', 'cancelled', 'cancel', 'reversed']);
const DRAFT = new Set(['drög', 'drog', 'draft']);
// invoice_drafts-staða sem þýðir að drögin eru EKKI ósend (reikningsfærð, ógild, sleppt, sameinuð).
const EKKI_OSENT = new Set(['invoiced', 'void', 'skipped', 'merged']);

// Lykillinn sem krofur_yfirlit_meta (greitt/falið/sent) notar.
const invKey = (r) => `${r.source || 'x'}|${r.tilvisun || r.id}`;
const draftKey = (d) => `draftinv|${d.worksite_name}|${String(d.work_month || '')}`;

/* Verkstaður → greiðandi. Sami verkstaður („Landsspitalinn") er rukkaður af einum
 * greiðanda („ÞG verktakar ehf."). Handvirk tenging í customer_worksite_map gengur
 * fyrir ('manual' fremst), verðskráin fyllir í eyðurnar. kt greiðandans: kortið
 * sjálft, svo fyrri Payday-reikningar á sama nafni. */
function greidendur({ cwmap, pguide, invoices }) {
  const worksiteToPayer = new Map();  // lc(worksite) -> payer customer_name
  // 12.10.2026: kt og tilvísun verkstaðarins úr kortinu sjálfu (✎ Greiðandi í Kröfu yfirliti) — áður
  // kom kt AÐEINS úr fyrri Payday-reikningum á sama nafni, svo nýr greiðandi stóð kt-laus.
  const wsKt = new Map(), wsTilv = new Map();
  // 01.11.2026: öryggisfé (customer_worksite_map.retention_pct > 0) → prósentur sem Payday-reikningurinn má vera lægri um. Sjá sjalfvirkTenging.
  const wsHald = new Map();
  const cwRod = [...(cwmap || [])].sort((a, b) => (b.confidence === 'manual') - (a.confidence === 'manual'));
  for (const m of cwRod) {
    const w = lc(m.worksite_name), p = String(m.customer_name || '').trim();
    if (w && p && !worksiteToPayer.has(w)) {
      worksiteToPayer.set(w, p);
      if (digits(m.kt_greidanda)) wsKt.set(w, digits(m.kt_greidanda));
      if (String(m.tilvisun || '').trim()) wsTilv.set(w, String(m.tilvisun).trim());
      if (Number(m.retention_pct) > 0) wsHald.set(w, [...new Set([5, 10, Number(m.retention_pct)])]);
    }
  }
  for (const g of (pguide || [])) {
    const w = lc(g.worksite_name), p = String(g.customer_name || '').trim();
    if (w && p && !worksiteToPayer.has(w)) worksiteToPayer.set(w, p);
  }
  const payerKt = new Map();           // lc(customer_name) -> kt (digits)
  for (const inv of (invoices || [])) {
    const nm = lc(inv.customer_name), kt = digits(inv.kt_greidanda);
    if (nm && kt && !payerKt.has(nm)) payerKt.set(nm, kt);
  }
  return function resolvePayer(name) {
    const payer = worksiteToPayer.get(lc(name));
    if (!payer) return null;
    return { customer: payer, kt: wsKt.get(lc(name)) || payerKt.get(lc(payer)) || '', tilvisun: wsTilv.get(lc(name)) || '', hald: wsHald.get(lc(name)) || [] };
  };
}

/* Sjálfvirk tenging: ósend drög ↔ Payday-reikningur sem er þegar til.
 * Agnar 20.10.2026: „láta hina hverfa eða þær mergast þegar kerfið finnur kröfuna í Payday, svo það sé ekki að tvítelja".
 *
 * VANDINN (mældur): bókarinn býr reikninginn til í Payday eftir að drögin fóru „Sent í bókun" — kerfið veit þá ekki að þetta
 * er sami hluturinn (drögin bera ekki `payday_invoice_id`, aðeins þegar reikningurinn er sendur beint úr Gerð reikninga).
 *
 * REGLAN (ströng, því röng tenging felur raunveruleg drög): sama kennitala, upphæð innan 1 kr, Payday-röð með stöðuna SENT
 * eða PAID, gjalddagi ekki fyrr en vinnumánuður drags byrjar, hver Payday-röð tengist í mesta lagi EINUM drögum (elsta drög
 * fyrst), og röð sem hangir þegar á drögum (payday_invoice_id) er frátekin. Ekkert er skrifað — drögin detta aðeins úr Ósent.
 * Skilar Map: draftKey → Payday-röðin (invoices) sem drögin eiga.
 *
 * ÖRYGGISFÉ (Agnar 01.11.2026): „5-10 er ekki afsláttur heldur öryggismörk — við fáum það allt greitt þegar verkið er búið … við sendum
 * ekki kröfurnar úr okkar kerfi heldur Payday, þess vegna standa drögin eftir". Á verkstað með retention_pct > 0 í customer_worksite_map
 * (Landsspitalinn/ÞG) er Payday-reikningurinn (100 − p)% af uppgjörinu í drögunum: R-310, 319, 343, 352, 370 og 376 (apríl–sept 2026) eru
 * allir 95% upp á krónu (sept 3.827.435 → R-376 3.636.063). Þar passar reikningur líka þegar hann er 95% eða 90% (eða kortagildið) af
 * drögunum — enn með 1 kr vikmörkum og sömu skilyrðum að öðru leyti; aðrir verkstaðir passa aðeins á 100%. Mismunurinn er EKKI afsláttur:
 * hann fylgir tengingunni sem `haldid_eftir` (kr) svo hann týnist ekki — hann innheimtist þegar verkinu lýkur. */
function sjalfvirkTenging({ drafts, invoices, resolvePayer }) {
  const out = new Map();
  const frataekid = new Set((drafts || []).filter((d) => d.payday_invoice_id != null).map((d) => String(d.payday_invoice_id)));
  const paydayRodur = (invoices || []).filter((r) => lc(r.source) === 'payday' && /^(sent|paid)$/.test(lc(r.status)) && digits(r.kt_greidanda) && (+r.upphaed_total || 0) > 0 && r.gjalddagi);
  const kandidatar = (drafts || [])
    .filter((d) => !EKKI_OSENT.has(String(d.status || '')) && d.payday_invoice_id == null && d.worksite_name && /^\d{4}-\d{2}$/.test(String(d.work_month || '')) && (+d.total_m_vsk || 0) > 0)
    .sort((a, b) => String(a.work_month).localeCompare(String(b.work_month)));
  for (const d of kandidatar) {
    const payer = resolvePayer(d.worksite_name) || resolvePayer(d.customer_name);
    const kt = digits(d.kennitala) || (payer && digits(payer.kt)) || '';
    if (!kt) continue;
    const amt = +d.total_m_vsk, manudur = d.work_month + '-01';
    const faktorar = [1, ...((payer && payer.hald) || []).map((p) => 1 - p / 100)];
    const hit = paydayRodur
      .filter((r) => !frataekid.has(String(r.id)) && digits(r.kt_greidanda) === kt && faktorar.some((f) => Math.abs((+r.upphaed_total) - amt * f) <= 1) && String(r.gjalddagi) >= manudur)
      .sort((a, b) => String(a.gjalddagi).localeCompare(String(b.gjalddagi)))[0];
    if (!hit) continue;
    frataekid.add(String(hit.id));
    const haldid = Math.round(amt - (+hit.upphaed_total));
    out.set(draftKey(d), haldid > 1 ? Object.assign({}, hit, { haldid_eftir: haldid }) : hit);
  }
  return out;
}

/* TVÍTEKIN PAYDAY-DRÖG (Agnar 01.11.2026): „Eins og þetta — þú mátt reyna sameina". Tindasel/Deluxe Lodges: R-364 (SENT, 1.006.129 kr,
 * 55 daga gamall) og Payday-drög (R-PD-6bd6e3b2…, sama kt, sama upphæð, stofnað 01.11) birtust bæði — Ógreitt 1.006.129 OG Ósent 1.006.129,
 * þótt krafan sé ein. Drögin eru annar hlutur í Payday (annað uuid), ekki sama röðin, svo ekkert í gögnunum sjálfum tengir þau.
 *
 * REGLAN (ströng, því röng sameining felur raunveruleg drög): Payday-röð í stöðunni drög/Drög/DRAFT (ekki handvirkt merkt greitt) á sömu kt
 * og upphæð innan 1 kr og Payday-reikningur sem er ÓGREIDDUR (K.flokkaReikning = 'ogreitt', t.d. SENT) og sést í summum (ekki falinn, ekki
 * „📨 Krafa send"). Greiddur reikningur sameinar EKKI — samskonar upphæð á nýjum drögum gæti verið næsti mánuður í föstum reikningi. Hver
 * ógreiddur reikningur tekur í mesta lagi ein drög (elstu drög fyrst). Ekkert er skrifað eða eytt: drögin lifa í töflunni, detta aðeins úr
 * Ósent; verði reikningurinn greiddur/kreditfærður/falinn birtast þau aftur — þá er kominn tími til að horfa á þau.
 * Skilar Map: lykill drag-raðarinnar (invKey) → ógreidda Payday-röðin sem hún afritar. */
function tvitekinPaydayDrog({ invoices, metaBy }) {
  const out = new Map();
  const mtOf = (r) => (metaBy && metaBy.get(invKey(r))) || {};
  const upph = (r) => +r.upphaed_total || +r.hofudstoll || 0;
  const paydayRodur = (invoices || []).filter((r) => lc(r.source) === 'payday' && digits(r.kt_greidanda) && upph(r) > 0);
  const drog = paydayRodur.filter((r) => flokkaReikning(r, mtOf(r)) === 'drog').sort((a, b) => (+a.id || 0) - (+b.id || 0));
  const ogreidd = paydayRodur
    .filter((r) => flokkaReikning(r, mtOf(r)) === 'ogreitt' && iSummu(mtOf(r)))
    .sort((a, b) => String(a.gjalddagi || '').localeCompare(String(b.gjalddagi || '')));
  const tekid = new Set();
  for (const d of drog) {
    const kt = digits(d.kt_greidanda), amt = upph(d);
    const hit = ogreidd.find((r) => !tekid.has(String(r.id)) && digits(r.kt_greidanda) === kt && Math.abs(upph(r) - amt) <= 1);
    if (!hit) continue;
    tekid.add(String(hit.id));
    out.set(invKey(d), hit);
  }
  return out;
}

/* Flokkun einnar invoices-raðar: 'kredit' | 'greitt' | 'drog' | 'ogreitt'.
 * `mt` = krofur_yfirlit_meta-röðin (handvirkt merkt greitt telst greitt). */
function flokkaReikning(r, mt) {
  const st = lc(r.status);
  const amt = +r.upphaed_total || +r.hofudstoll || 0;
  if (CREDIT.has(st) || amt < 0) return 'kredit';
  if (PAID.has(st) || (mt && mt.paid)) return 'greitt';
  if (DRAFT.has(st)) return 'drog';
  return 'ogreitt';
}

/* Er invoice_drafts-röð ÓSEND? Sama regla og þrep 2 í Kröfu yfirliti: staðan er ekki invoiced/void/skipped/merged,
 * engin Payday-röð hangir á henni (payday_invoice_id eða sjálfvirk tenging), upphæð > 0, ekki handvirkt merkt greitt. */
function erOsent(d, tenging, mt) {
  if (EKKI_OSENT.has(String(d.status || ''))) return false;
  if (d.payday_invoice_id != null) return false;
  if (d.merged_into) return false;
  if (tenging && tenging.has(draftKey(d))) return false;
  if (!((+d.total_m_vsk || 0) > 0)) return false;
  if (mt && mt.paid) return false;
  return true;
}

// Telst röðin í summum? Faldar raðir og „📨 Krafa send" (done) teljast ekki — sama og rollup í Kröfu yfirliti.
const iSummu = (mt) => !(mt && (mt.hidden || mt.done));

/* TVÍFARAR ÚR ÖÐRUM INNSOGUM (Agnar 03.11.2026, ÞG verktakar: „Taka tvítök"). Sami reikningur birtist tvisvar í „Kröfur sem við höfum
 * sent": Payday-röðin („310") og spegill hennar úr kröfuskrá Landsbankans (landsbankinn_krafnir, innsog 22.05.2026, „310.0", kt án
 * bandstriks). Mælt 03.11: 82 bankaraðir, allar 82 eiga Payday-tvífara með sömu kt + sama reikningsnúmeri + sama gjalddaga; 29 þeirra eru
 * hærri í bankanum (tilkynningar-/vanskilagjald), svo upphæðin er EKKI hluti af lyklinum. Payday-röðin ræður (hún ber núverandi stöðu —
 * bankaskráin er gömul mynd: „Ógreidd" 22.05 hjá Hrafnaskálanúpi þar sem Payday segir CANCELLED). Sama regla og krofur-yfirlit.js.
 * Handskráð röð úr Tekjur-skjalinu (tekjur_sheet_manual, án kt og reikningsnúmers) er tvífari þegar Payday-röð sama greiðanda ber sömu
 * upphæð OG sama greiðsludag (Reitir: „TEKJUR-NOV-GRIMSBAER" 8.772.244 greitt 19.12.2025 = R-227).
 * Ekkert er skrifað eða eytt — röðin dettur aðeins úr listum og summum. Skilar Set af invKey. */
const tnorm = (s) => String(s || '').trim().replace(/\.0+$/, '');
function tvifarar(invoices) {
  const pdNr = new Set(), pdGreitt = new Set();
  for (const r of invoices || []) {
    if (lc(r.source) !== 'payday') continue;
    if (digits(r.kt_greidanda) && tnorm(r.tilvisun)) pdNr.add(digits(r.kt_greidanda) + '|' + tnorm(r.tilvisun));
    if (r.greidsla_date) pdGreitt.add(lc(r.customer_name) + '|' + Math.round(+r.upphaed_total || 0) + '|' + r.greidsla_date);
  }
  const out = new Set();
  for (const r of invoices || []) {
    const s = lc(r.source);
    if (s === 'landsbankinn_krafnir' && pdNr.has(digits(r.kt_greidanda) + '|' + tnorm(r.tilvisun))) out.add(invKey(r));
    else if (s === 'tekjur_sheet_manual' && r.greidsla_date && pdGreitt.has(lc(r.customer_name) + '|' + Math.round(+r.upphaed_total || 0) + '|' + r.greidsla_date)) out.add(invKey(r));
  }
  return out;
}

/* KREDIT-PÖR: Payday ógildir reikning með kreditreikningi — reikningurinn fær CANCELLED, kreditreikningurinn CREDIT með mínus sömu
 * upphæð og SAMA gjalddaga (mælt 03.11 á öllum 45 pörum, t.d. ÞG 297/298 27.207.026). Í prófílnum voru það tvær „kredit"-línur sem
 * litu út eins og tvítak. Skilar Map: invKey ógilta reikningsins → kreditröðin (hver röð í mesta lagi í einu pari). */
function kreditPor(invoices) {
  const ogild = new Map();
  for (const r of invoices || []) {
    if (!/cancel/.test(lc(r.status)) || !((+r.upphaed_total || 0) > 0)) continue;
    const k = lc(r.customer_name) + '|' + Math.round(+r.upphaed_total) + '|' + (r.gjalddagi || '');
    (ogild.get(k) || ogild.set(k, []).get(k)).push(r);
  }
  const out = new Map();
  for (const c of invoices || []) {
    if (!((+c.upphaed_total || 0) < 0)) continue;
    const vid = (ogild.get(lc(c.customer_name) + '|' + Math.round(-c.upphaed_total) + '|' + (c.gjalddagi || '')) || []).find((r) => !out.has(invKey(r)));
    if (vid) out.set(invKey(vid), c);
  }
  return out;
}

module.exports = { digits, lc, PAID, CREDIT, DRAFT, EKKI_OSENT, invKey, draftKey, greidendur, sjalfvirkTenging, tvitekinPaydayDrog, flokkaReikning, erOsent, iSummu, tvifarar, kreditPor };
