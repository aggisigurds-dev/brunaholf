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

module.exports = { digits, lc, PAID, CREDIT, DRAFT, EKKI_OSENT, invKey, draftKey, greidendur, sjalfvirkTenging, flokkaReikning, erOsent, iSummu };
