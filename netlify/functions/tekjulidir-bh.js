// tekjulidir-bh.js — TEKJULIÐIR BRUNAHÓLFS (fasi 4, Agnar 22.11.2026: unnið eftir verkstað × mánuður).
//
//   GET /api/tekjulidir-bh
//     → { idag, manudir[3]{man,fra,til,heiti}, verkstadir[{verk, unnid{}, klst{}, got{}, hlutir{tima{},got{}}, taxti, an_taxta,
//                                                          reikningsfaert{}, greitt{}, ogreitt{}}],
//         an_verkstadar{reikningsfaert{}, greitt{}, ogreitt{}, n_reikningar}, samtals{unnid{}, reikningsfaert{}, greitt{}, ogreitt{}, ogefid{}},
//         eldra_ogreitt_kr, klst{}, got{}, onnur_got{}, krossathugun{…}, ferskleiki, sott }
//
// AÐEINS ÞRÍR MÁNUÐIR (ákvörðun Agnars 22.11.2026): tveir heilir á undan + líðandi mánuður til dags (nú sept, okt, nóv til dags).
//   UNNIÐ         = _rekstur.js verkstadir() — SÖMU reglur og brunaholf() í Rekstrarskýrslunni (engin ný regla; Σ raða = brunaholf().virdi, prófað og
//                   mælt á hverju kalli í `krossathugun`): rukkanlegir Tímaveru-tímar × dagvinnutaxti verkstaðar (9.951 ef verkstað vantar í Verðskrá,
//                   merkt „án taxta“) + kláruð göt (Landspítalinn eftir checked_date, Heklureitur eftir execution_date × hole_size_rates).
//                   ÁÆTLUN: yfirvinna, efni og akstur eru ekki með. Verkstaðir eru bornir saman án tillits til stafastærðar (eins og Verðskráin).
//   REIKNINGSFÆRT = Payday-reikningar (invoices, PAID/SENT, höfuðstóll án vsk) eftir ÚTGÁFUDEGI (annars gjalddaga, eins og T.brunaholfManudir á
//                   Yfirsýnarrönd/Fjármála-yfirliti); CANCELLED/CREDIT jafnast út og eru utan.
//   VERKSTAÐUR REIKNINGS = invoices.worksite_match, EKKI GISKAÐ: reikningur án þess fer í „án verkstaðar“ (kr.).
//   GREITT        = Payday PAID eftir greidsla_date + reikningar merktir greiddir í Kröfu yfirliti (SENT, 0–120 d frá útgáfu, ekki í framtíð), eftir
//                   greiðslumánuði. 120 daga reglan ræður AÐEINS hvenær peningarnir teljast komnir inn.
//   ÓGREITT       = SENT, ekki greiddur, EKKI merktur greiddur í Kröfu yfirliti (hvenær sem er — eins og Kröfu yfirlit sjálft) og ekki faldinn/kláraður,
//                   flokkað eftir ÚTGÁFUMÁNUÐI; `eldra_ogreitt_kr` = ógreitt útgefið fyrir fyrsta mánuð, svo heildin stemmi við Kröfu yfirlit.
// Aðgangur: eins og rekstrarskyrsla.js — innskráður stjórnandi (hub_user, rola Admin). AÐEINS LESTUR. Tómur lestur = 502 með ástæðu (aldrei 0).
const R = require('./_rekstur.js');
const RS = require('./rekstrarskyrsla.js');

const DAGUR_MS = 86400000;
const AN = '__an_verkstadar__';
const dagur = (v) => (v ? String(v).slice(0, 10) : null);
const tala = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const kr = (x) => Math.round(x || 0);
const tilvAf = (k) => (/^payday\|(\d{1,12})$/.exec(k || '') || [])[1];

// síðustu þrjú tímabil manudir(): m2, m1 og líðandi mánuður til dags
const timabilThrju = (d) => R.manudir(d).slice(4);

// invoices → Map(verkstaðarlykill | AN → {rf{}, gr{}, ogr{}}), allt án vsk. Lykill = R.verkKey (án stafastærðar); disp geymir sýnisnafnið.
function reikningar(per, radir, hand, idag) {
  const mans = per.map((p) => p.fra.slice(0, 7));
  const m = new Map(), disp = new Map();
  const fa = (k) => { if (!m.has(k)) m.set(k, { rf: {}, gr: {}, ogr: {} }); return m.get(k); };
  const lykill = (r) => {
    const w = String(r.worksite_match || '').trim();
    if (!w) return AN;
    const k = R.verkKey(w);
    if (!disp.has(k)) disp.set(k, R.verkLykill(w));
    return k;
  };
  const manudur = (dg) => { const x = dagur(dg); return x ? (mans.find((_, i) => x >= per[i].fra && x <= per[i].til) || null) : null; };
  const add = (o, mm, v) => { o[mm] = (o[mm] || 0) + v; };

  const handAf = new Map(), handGreitt = new Set(), falid = new Set();
  for (const h of hand || []) {
    const t = tilvAf(h && h.inv_key);
    if (!t) continue;
    if (h.paid_at && h.paid !== false) handAf.set(String(t), dagur(h.paid_at));
    if (h.paid === true) handGreitt.add(String(t));                 // merkt greitt = ekki útistandandi, hvenær sem það var gert (Kröfu yfirlit)
    if (h.hidden === true || h.done === true) falid.add(String(t));
  }
  let eldra = 0, eldraN = 0, anN = 0;
  for (const r of radir || []) {
    const upph = tala(r.hofudstoll), utg = dagur(r.utgafudagur), utgR = utg || dagur(r.gjalddagi), tilv = String(r.tilvisun), k = lykill(r);
    // reikningsfært: útgáfudagur (annars gjalddagi) innan mánaðanna — sama regla og T.brunaholfManudir
    if ((r.status === 'PAID' || r.status === 'SENT') && manudur(utgR)) { add(fa(k).rf, manudur(utgR), upph); if (k === AN) anN++; }
    // greitt: PAID eftir greidsla_date, SENT eftir handmerkingu (0–120 d frá útgáfu, ekki í framtíð) — sama regla og saekja()/innheimta()
    let greiddur = null;
    if (r.status === 'PAID' && r.greidsla_date) greiddur = dagur(r.greidsla_date);
    else if (r.status === 'SENT' && handAf.has(tilv) && utg && upph > 0) {
      const pd = handAf.get(tilv), dm = (Date.parse(pd) - Date.parse(utg)) / DAGUR_MS;
      if (dm >= 0 && dm <= 120 && pd <= idag) greiddur = pd;
    }
    if (greiddur) { if (manudur(greiddur)) add(fa(k).gr, manudur(greiddur), upph); continue; }
    // ógreitt núna: SENT, ekki greitt, ekki merkt greitt og ekki falið/klárað (sama mengi og Kröfu yfirlit)
    if (r.status !== 'SENT' || handGreitt.has(tilv) || falid.has(tilv) || !(upph > 0)) continue;
    if (manudur(utgR)) add(fa(k).ogr, manudur(utgR), upph);
    else if (utgR && utgR < per[0].fra) { eldra += upph; eldraN++; }
  }
  return { m, disp, mans, eldra, eldraN, anN };
}

async function sotta(idag) {
  const per = timabilThrju(idag);
  const fra = per[0].fra;
  const { gogn, ferskleiki } = await RS._saekja(idag, { fra, bhAdeins: true });
  // Tómur lestur er EKKI 0 (sama regla og rekstur-manudir.js): án Verðskrár/göta-verðskrár fær hver verkstaður sjálfgefinn taxta og Heklureitsgöt hverfa
  if (!(gogn.timavera || []).length) throw new Error('Tímaveru-lesturinn skilaði engu');
  if (!(gogn.ajour || []).length) throw new Error('Ajour-lesturinn skilaði engu');
  if (!(gogn.paydayBh || []).length) throw new Error('Greiðslulesturinn skilaði engu');
  if (!(gogn.pricing || []).length) throw new Error('Verðskrárlesturinn skilaði engu');
  if (!(gogn.holeRates || []).length) throw new Error('Gatataxtalesturinn skilaði engu');
  const [radir, hand] = await Promise.all([
    // allar SENT (ógreitt núna, líka eldri en fra) + PAID/SENT útgefnir frá fra (eða án útgáfudags með gjalddaga frá fra); PAID greiddir frá fra fylgja
    RS._allt('invoices', `select=tilvisun,status,utgafudagur,gjalddagi,greidsla_date,hofudstoll,worksite_match&source=eq.payday&status=in.(PAID,SENT)&or=(utgafudagur.gte.${fra},greidsla_date.gte.${fra},status.eq.SENT,and(utgafudagur.is.null,gjalddagi.gte.${fra}))&order=id.asc`),
    RS._allt('krofur_yfirlit_meta', 'select=inv_key,paid,paid_at,hidden,done&or=(paid.eq.true,hidden.eq.true,done.eq.true)&order=inv_key.asc'),
  ]);
  if (!radir.length) throw new Error('reikningalesturinn skilaði engu');
  return { per, gogn, ferskleiki, radir, hand };
}

function reikna(d, idag) {
  const { per, gogn, radir, hand } = d;
  const mans = per.map((p) => p.fra.slice(0, 7));
  const v = R.verkstadir(per, gogn);
  const bh = R.brunaholf(per, gogn);                                // sama fall og Rekstrarskýrslan — til krossathugunar, ekki til útreiknings
  const rk = reikningar(per, radir, hand, idag);
  const arr = (a, f) => Object.fromEntries(mans.map((mm, i) => [mm, f ? f(a[i]) : kr(a[i])]));
  const lit = (o) => Object.fromEntries(mans.map((mm) => [mm, kr(o[mm])]));
  const einn = (k) => { const e = rk.m.get(k) || { rf: {}, gr: {}, ogr: {} }; return { reikningsfaert: lit(e.rf), greitt: lit(e.gr), ogreitt: lit(e.ogr) }; };
  const summa = (o) => Object.values(o).reduce((a, x) => a + x, 0);

  const lyklar = new Set([...v.rows.map((r) => r.key), ...[...rk.m.keys()].filter((k) => k !== AN)]);
  const tom = { klst: [0, 0, 0], tima_kr: [0, 0, 0], got: [0, 0, 0], got_kr: [0, 0, 0], unnid: [0, 0, 0], taxti: null, an_taxta: false };
  const verkstadir = [...lyklar].map((k) => {
    const r = v.rows.find((x) => x.key === k) || tom;
    return { verk: r.verk || rk.disp.get(k) || k, unnid: arr(r.unnid), klst: arr(r.klst, (x) => Math.round(x * 10) / 10), got: arr(r.got, Math.round),
      hlutir: { tima: arr(r.tima_kr), got: arr(r.got_kr) }, taxti: r.taxti, an_taxta: !!r.an_taxta, ...einn(k) };
  }).sort((a, b) => summa(b.unnid) - summa(a.unnid) || summa(b.reikningsfaert) - summa(a.reikningsfaert));

  const an = einn(AN);
  // Samtölur = summa raðanna eins og þær eru sýndar (hver röð rúnnuð), svo dálkarnir leggist alltaf í „Samtals“; krossathugunin ber ÓRÚNNAÐA summu saman.
  const lagt = (f) => Object.fromEntries(mans.map((mm) => [mm, verkstadir.reduce((a, x) => a + x[f][mm], 0) + (f === 'unnid' ? 0 : an[f][mm])]));
  const samtals = { unnid: lagt('unnid'), reikningsfaert: lagt('reikningsfaert'), greitt: lagt('greitt'), ogreitt: lagt('ogreitt') };
  samtals.ogefid = Object.fromEntries(mans.map((mm) => [mm, samtals.unnid[mm] - samtals.reikningsfaert[mm]]));

  // sama niðurstaða og Rekstrarskýrslan? unnið: ónúnnuð summa raða = brunaholf().virdi; greitt: á ±1 kr per mánuð
  const krossathugun = { unnid_stemmir: v.samtals.every((x, i) => Math.abs(x - bh.virdi[i]) < 0.01),
    greitt_stemmir: mans.every((mm, i) => Math.abs(samtals.greitt[mm] - kr(bh.greitt[i])) <= 1),
    unnid_rekstrarskyrsla: arr(bh.virdi), greitt_rekstrarskyrsla: arr(bh.greitt) };
  return {
    manudir: per.map((p) => ({ man: p.fra.slice(0, 7), fra: p.fra, til: p.til, heiti: p.heiti })),
    verkstadir,
    an_verkstadar: { ...an, n_reikningar: rk.anN },
    samtals, eldra_ogreitt_kr: kr(rk.eldra), eldra_ogreitt_n: rk.eldraN,
    klst: arr(v.klst, (x) => Math.round(x * 10) / 10), got: arr(v.got, Math.round), onnur_got: arr(v.onnur_got, Math.round),
    krossathugun,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return RS._svar(405, { villa: 'Aðeins GET' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return RS._svar(500, { villa: 'Supabase vantar' });
  let n;
  try { n = await RS._notandi(event); } catch (e) { return RS._hafnad(502); }
  if (n.villa) return RS._hafnad(n.villa);
  if (!n.stjornandi) return RS._hafnad(403);
  const idag = new Date().toISOString().slice(0, 10);
  try {
    const d = await sotta(idag);
    return RS._svar(200, { idag, ...reikna(d, idag), ferskleiki: d.ferskleiki, sott: new Date().toISOString() });
  } catch (e) {
    return RS._svar(502, { villa: 'Tekjuliðir Brunahólfs ómældir — ' + String(e.message || e).slice(0, 200) });
  }
};
exports._reikna = reikna; exports._reikningar = reikningar; exports._timabil = timabilThrju;
