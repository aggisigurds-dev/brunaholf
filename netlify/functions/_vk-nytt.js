// _vk-nytt.js — „Yfirlit" efst á Viðskiptavinum: hvað er nýtt hjá greiðendum Brunahólfs (Agnar 16.11.2026:
// „settu samantekt efst, updates á verkum og samskiptum, nýtt um ný verk eða beiðnir").
//
// HREIN föll (engin net-köll) svo prófin geti mælt reglurnar; verkkaupar.js sækir gögnin og kallar smida().
//   verk       — Tímavera síðustu 14 daga per verkstað (klst, menn, síðast unnið), „nýtt" ef fyrsta færsla er innan 45 daga
//   samskipti  — póstur inn/út síðustu 14 daga sem tengist skráðum greiðanda (netfang, lén eða heiti verkstaðar í efnislínu)
//   krofur     — Payday: kröfur sendar og greiðslur mótteknar síðustu 14 daga
//   beidnir    — beiðnir og ný verk úr vettvangsappinu (field_entries kind beidni / verk)
// Engu er giskað: póstur sem tengist engum skráðum greiðanda birtist ekki, verk án greiðanda er merkt þannig.

const INNRA = /almennt|veikindi|sick|work at home|kaffi|fundir|slökkvitæki ehf|brunahólf verkstæði/i;
// Almenn póstlén — lén segir ekkert um hver á netfangið, aðeins nákvæmt netfang telst.
const ALMENN_LEN = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
  'simnet.is', 'internet.is', 'mi.is', 'visir.is', 'centrum.is', 'islandia.is', 'talnet.is', 'proton.me', 'protonmail.com', 'vortex.is']);
const EIGIN_LEN = /(^|\.)(brunaholf\.is|eldklar\.is|slokkvitaeki\.is)$/i;

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const kr = (n) => Math.round(Number(n) || 0);
const dagur = (s) => String(s || '').slice(0, 10);
const netfongUr = (s) => (String(s || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(lc);
const len = (e) => lc(e).split('@')[1] || '';
const dagaFra = (idag, n) => { const d = new Date(idag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const efniKjarni = (s) => lc(s).replace(/^((re|fw|fwd|sv|vs)\s*:\s*)+/i, '').trim();

/** Netfang/lén → greiðandi. pör: [{ netfang, nafn }] (netfang má vera listi aðskilinn með kommu/semíkommu/bili). */
function netfangaskra(por) {
  const netf = new Map(); const lenTil = new Map();
  for (const p of por || []) {
    if (!p || !p.nafn) continue;
    for (const e of netfongUr(p.netfang)) {
      if (!netf.has(e)) netf.set(e, p.nafn);
      const l = len(e);
      if (!l || ALMENN_LEN.has(l) || EIGIN_LEN.test(l)) continue;
      // lén sem fleiri en einn greiðandi notar (bókhaldsstofa, eignaumsjón) segir ekki hver á í hlut
      if (!lenTil.has(l)) lenTil.set(l, p.nafn); else if (lenTil.get(l) !== p.nafn) lenTil.set(l, null);
    }
  }
  return { finna: (e) => netf.get(lc(e)) || lenTil.get(len(e)) || null };
}

function verkYfirlit({ timar, eldriVerk, wsOwner, verdskra, osentVerk, idag }) {
  const fra14 = dagaFra(idag, 14), fra7 = dagaFra(idag, 7);
  const eig = new Map(Object.entries(wsOwner || {}).map(([k, v]) => [lc(k), v]));
  const vs = new Set([...(verdskra || [])].map(lc));
  const os = new Map(Object.entries(osentVerk || {}).map(([k, v]) => [lc(k), v]));
  const acc = new Map();
  for (const t of timar || []) {
    const p = String(t.project || '').trim(); if (!p || INNRA.test(p)) continue;
    const d = dagur(t.date); if (!d || d > idag) continue;
    const a = acc.get(p) || { verkstadur: p, klst_14: 0, klst_7: 0, klst_45: 0, sidast: '', fyrst: d, menn: new Set(), menn45: new Set() };
    a.klst_45 += Number(t.hours) || 0; if (t.employee) a.menn45.add(t.employee);
    if (d < a.fyrst) a.fyrst = d;
    if (d >= fra14) { a.klst_14 += Number(t.hours) || 0; if (t.employee) a.menn.add(t.employee); if (d > a.sidast) a.sidast = d; }
    if (d >= fra7) a.klst_7 += Number(t.hours) || 0;
    acc.set(p, a);
  }
  const eldri = new Set([...(eldriVerk || [])].map(lc));
  const out = [];
  for (const a of acc.values()) {
    const nytt = !eldri.has(lc(a.verkstadur));
    if (!a.sidast && !nytt) continue;                       // engin vinna síðustu 14 daga og ekki nýtt verk
    out.push({ verkstadur: a.verkstadur, greidandi: eig.get(lc(a.verkstadur)) || null, klst_14: r1(a.klst_14), klst_7: r1(a.klst_7),
      klst_45: r1(a.klst_45), menn: (a.sidast ? a.menn : a.menn45).size, sidast: a.sidast || null, nytt, fyrst: nytt ? a.fyrst : null,
      verdskra: vs.has(lc(a.verkstadur)), osent: kr(os.get(lc(a.verkstadur))) });
  }
  // ný verk efst, svo mest unnið
  return out.sort((x, y) => (y.nytt - x.nytt) || (y.klst_14 - x.klst_14) || x.verkstadur.localeCompare(y.verkstadur, 'is'));
}

function samskiptaYfirlit({ postur, skra, verkstadir, wsOwner, idag }) {
  const fra = dagaFra(idag, 14);
  const vsNofn = [...new Set((verkstadir || []).map((v) => String(v || '').trim()).filter((v) => v.length >= 6 && !INNRA.test(v)))]
    .sort((a, b) => b.length - a.length);
  const eig = new Map(Object.entries(wsOwner || {}).map(([k, v]) => [lc(k), v]));
  const out = []; const sed = new Map();
  for (const m of (postur || []).slice().sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))) {
    const d = dagur(m.received_at); if (!d || d < fra) continue;
    const ut = /sent/i.test(m.folder || '');
    const motadilar = ut ? netfongUr(m.to_addresses) : [lc(m.sender_email)];
    if (!ut && EIGIN_LEN.test(len(m.sender_email))) continue;            // okkar eigin póstur í innhólfi
    let greidandi = null, netfang = null;
    for (const e of motadilar) { const g = skra.finna(e); if (g) { greidandi = g; netfang = e; break; } }
    let verkstadur = null;
    const efni = lc(m.subject);
    for (const v of vsNofn) if (efni.includes(lc(v))) { verkstadur = v; break; }
    if (!greidandi && verkstadur) greidandi = eig.get(lc(verkstadur)) || null;
    if (!greidandi && !verkstadur) continue;                              // tengist engum skráðum — sýnum ekki
    const lykill = (greidandi || verkstadur) + '|' + efniKjarni(m.subject);
    const fyrri = sed.get(lykill);
    if (fyrri) { fyrri.fjoldi++; continue; }                              // sami þráður: nýjasta línan + fjöldi
    const lina = { id: m.id, dags: d, kl: String(m.received_at || '').slice(11, 16), att: ut ? 'ut' : 'inn',
      fra: ut ? null : (m.sender_name || m.sender_email || ''), netfang: netfang || motadilar[0] || '',
      efni: String(m.subject || '').trim() || '(ekkert efni)', brot: String(m.snippet || '').trim().slice(0, 140),
      greidandi, verkstadur, holf: m.account || '', fjoldi: 1 };
    sed.set(lykill, lina); out.push(lina);
  }
  return out;
}

/** krofur: Payday-raðir þegar flokkaðar af kallanda ({ flokkur:'greitt'|'ogreitt'|… }) — kredit og drög koma ekki hingað. */
function krofuYfirlit({ reikningar, nafnFyrirKt, idag }) {
  const fra = dagaFra(idag, 14);
  const out = [];
  for (const v of reikningar || []) {
    const nafn = (nafnFyrirKt && nafnFyrirKt(v.kt_greidanda)) || v.customer_name || '';
    const upp = kr(v.upphaed_total); if (upp <= 0) continue;
    const gr = dagur(v.greidsla_date);
    if (v.flokkur === 'greitt' && gr && gr >= fra && gr <= idag) out.push({ teg: 'greidd', dags: gr, greidandi: nafn, upphaed: upp, nr: v.tilvisun || '' });
    const ut = dagur(v.utgafudagur) || (dagur(v.gjalddagi) <= idag ? dagur(v.gjalddagi) : '');
    if (ut && ut >= fra && ut <= idag) out.push({ teg: 'send', dags: ut, greidandi: nafn, upphaed: upp, nr: v.tilvisun || '' });
  }
  return out.sort((a, b) => b.dags.localeCompare(a.dags) || (a.teg === 'greidd' ? -1 : 1));
}

function beidnaYfirlit({ faerslur, wsOwner, idag }) {
  const fra = dagaFra(idag, 30);
  const eig = new Map(Object.entries(wsOwner || {}).map(([k, v]) => [lc(k), v]));
  return (faerslur || []).filter((f) => dagur(f.created_at) >= fra)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((f) => ({ id: f.id, teg: f.kind === 'verk' ? 'verk' : 'beidni', dags: dagur(f.created_at), verkstadur: f.worksite_name || '',
      greidandi: eig.get(lc(f.worksite_name)) || null, hofundur: f.author || f.employee || '',
      texti: [f.item_label, f.note].filter(Boolean).join(' — ').slice(0, 160), stada: f.status || '', flokkur: f.category || '' }));
}

function smida(g) {
  const idag = g.idag || new Date().toISOString().slice(0, 10);
  const verk = verkYfirlit({ timar: g.timar, eldriVerk: g.eldriVerk, wsOwner: g.wsOwner, verdskra: g.verdskra, osentVerk: g.osentVerk, idag });
  const skra = netfangaskra(g.netfong);
  const verkstadir = [...new Set([...Object.keys(g.wsOwner || {}), ...verk.map((v) => v.verkstadur)])];
  const samskipti = samskiptaYfirlit({ postur: g.postur, skra, verkstadir, wsOwner: g.wsOwner, idag });
  const krofur = krofuYfirlit({ reikningar: g.reikningar, nafnFyrirKt: g.nafnFyrirKt, idag });
  const beidnir = beidnaYfirlit({ faerslur: g.faerslur, wsOwner: g.wsOwner, idag });
  const fra7 = dagaFra(idag, 7);
  const greidd = krofur.filter((k) => k.teg === 'greidd'), send = krofur.filter((k) => k.teg === 'send');
  const iGangi = verk.filter((v) => v.sidast);
  return {
    verk, samskipti, krofur, beidnir,
    talning: {
      verk_i_gangi: iGangi.length, klst_14: r1(iGangi.reduce((s, v) => s + v.klst_14, 0)),
      ny_verk: verk.filter((v) => v.nytt).length, verk_an_greidanda: verk.filter((v) => !v.greidandi).length,
      samskipti_7: samskipti.filter((s) => s.dags >= fra7).reduce((s, x) => s + x.fjoldi, 0),
      greitt_14: greidd.reduce((s, k) => s + k.upphaed, 0), greitt_14_n: greidd.length,
      sent_14: send.reduce((s, k) => s + k.upphaed, 0), sent_14_n: send.length,
      beidnir_opnar: beidnir.filter((b) => !b.stada || b.stada === 'new').length,
    },
    timabil: { fra_14: dagaFra(idag, 14), fra_45: dagaFra(idag, 45), til: idag },
  };
}

module.exports = { INNRA, ALMENN_LEN, netfangaskra, verkYfirlit, samskiptaYfirlit, krofuYfirlit, beidnaYfirlit, smida, dagaFra };
