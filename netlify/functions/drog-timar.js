// drog-timar.js — nýir Tímaveru-tímar fara SJÁLFIR inn í ósend drög mánaðarins (14.10.2026).
//
// Agnar 14.10.2026 (Skùlagata 26, okt '26 sýndi „＋ 16,1 klst nýir síðan vistað 12/10"): „Ég var að láta
// endurreikna en fór aftur í að vantaði tíma inn — ég vil bara að þetta fari sjálft inn innan þess mánaðar."
//
// Hvað gerist: fyrir hvert drag sem er (a) í vinnumánuði sem enn stendur (líka fyrri mánuður fyrstu 3 daga
// næsta mánaðar, því síðustu færslurnar koma á 2 tíma fresti), (b) ósent — status draft/overdue, ekkert
// payday_invoice_id, ekki samreiknað, (c) úr Tímaveru (source timavera) og (d) ekki á föstu verði — er gert
// NÁKVÆMLEGA það sem „📥 Fylla úr tímabók" + „💾 Vista" gera í Gerð Reikninga:
//   dagvinna/yfirvinna  = /api/timabok split (sama fall, sama regla: 8 klst/dag, helgar yfirvinna, hádegi Fjarðagötu)
//   smáhlutagjald       = taxti verðskrár (null → 137) × (dv+ev)  — aðeins ef dragið bar smáhlutagjald fyrir
//   akstur, staðfesting, efni, afsláttur = ÓBREYTT úr draginu
//   net / vsk / samtals = sama formúla og compute() í Gerð Reikninga
//   timavera_klst_vid_vistun = Tímaveru-klst mánaðarins NÚNA (svo Kröfu yfirlit telji nýja tíma frá þessu marki)
//
// Hvenær er EKKI snert: fast verð (fixed_total > 0), Ajour/gata-drög, send drög, samreiknuð drög, og drög með
// „🔒tímar" í notes (Agnar vill handstýra tímunum). Breytist ekkert í Tímaveru (|Δ| < 0,05 klst) er ekkert vistað.
// Lækki tímar í Tímaveru (leiðrétting, nætur-speglun) fylgir dragið líka niður — það speglar Tímaveru, hvora leið sem er.
//
//   GET  /api/drog-timar         → áætlunin, ekkert vistað (líka með eða án ?dry=1 — GET framkvæmir aldrei verk, 15.11.2026:
//                                  keyrslan stofnar nú drög, og fallið var opið hverjum sem kallaði)
//   POST /api/drog-timar         → keyrir (starfsmanna-hlið P.requireStaff; ?dry=1 = áætlun)
// Áætlunin situr á drog-timar-background (netlify.toml, 10 mín eftir timavera-pull) — ALDREI hér (403 á HTTP).

// ── STOFNUN (15.11.2026, Agnar: „Fjallaböðin tímar og uppsafnað er ekki að koma sjálfkrafa inn í kröfuyfirlit. Mátt laga það
// varanlega") ── Starfið að ofan UPPFÆRÐI aðeins drög sem voru til, svo í nóvember (engin drög á neinu verki) var það aðgerðalaust
// (dry-run: skoðuð 0) og tímarnir sátu aðeins sem áætlun í „Tími eftir" — án yfirvinnu, Tímaskýrslu og Efnislista. Nú STOFNAR það
// fyrst drög LÍÐANDI mánaðar (aldrei eldri mánaðar) fyrir verk sem uppfylla ÖLL skilyrðin í stofnaDrog() — í dag aðeins verk í
// Verðskrá með dagvinnutaxta (Fjallaböðin, Fjarðagata, Orkureitur). Verk utan Verðskrár (t.d. Tindasel, Síðumúli 21) fá ekki
// sjálfvirk drög: taxtinn er verðákvörðun (rukkarinn 15.11: 8 af 86 drögum voru á 10.951/10.300, ekki sjálfgefnum 9.951).
// Stofnuð drög eru munuð í app_kv['drog_timar_stofnud'] og ALDREI stofnuð aftur — drög sem er eytt í Reikningalistanum lifna ekki við.
// Uppfærsluáfanginn sleppir líka drögum sem eru „📤 Send í bókun"/„📨 Krafa send" (meta sent/done) eða tengd Payday-reikningi
// (K.sjalfvirkTenging) — sein færsla má ekki breyta upphæð eftir að skjölin fóru.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const timabok = require('./timabok');
const K = require('./_krofu-flokkun');
const P = require('./_portal');

const MINNI = 'drog_timar_stofnud';   // app_kv-lykill: ["<verkstaður>|<YYYY-MM>", …] — drög sem þetta starf hefur stofnað

const GR_KM = 186, GR_FERD = 4000, GR_SMA = 137;
const OSEND = new Set(['draft', 'overdue']);
const r2 = n => Math.round(n * 100) / 100;

// Mánuðir sem „standa": þessi mánuður, og sá fyrri fyrstu þrjá daga mánaðar (Ísland = UTC).
function manudirSemStanda(now) {
  const d = now || new Date();
  const ym = x => `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
  const ut = [ym(d)];
  if (d.getUTCDate() <= 3) { const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); ut.push(ym(f)); }
  return ut;
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
// Síðuskiptur lestur (PostgREST skilar mest 1000 röðum í einu).
async function sbAll(path) {
  const ut = [];
  for (let fra = 0; ; fra += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${fra}-${fra + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const sida = await r.json();
    ut.push(...sida);
    if (sida.length < 1000) return ut;
  }
}
// PostgREST in.(…) með gildum sem bera bil, | og íslenska stafi.
const inLista = (gildi) => encodeURIComponent(`(${gildi.map((g) => `"${String(g).replace(/"/g, '\\"')}"`).join(',')})`);
const ktSnid = (k) => { const d = K.digits(k); return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : null; };
const naestiManudur = (man) => { const [y, m] = man.split('-').map(Number); const d = new Date(Date.UTC(y, m, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

async function sbPatch(id, payload) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`invoice_drafts PATCH ${id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json())[0];
}

// Sama formúla og compute() í Gerð Reikninga (index.html) — dv/ev koma úr tímabókinni, hitt úr draginu.
function reikna(d, pg, dvH, evH) {
  const dvR = Number(d.rate_dagvinna) || (Number(pg.dagvinna_rate) || 9951);
  const evR = Number(d.rate_eftirvinna) || (Number(pg.eftirvinna_rate) || 14927);
  const kmR = Number(pg.akstur_km_rate) || GR_KM, ferdR = Number(pg.akstur_ferd_rate) || GR_FERD;
  const smaR = pg.smahlutagjald_per_h == null ? GR_SMA : Number(pg.smahlutagjald_per_h);
  const vskPct = Number(pg.vsk_pct) || 24;
  const km = Number(d.akstur_km) || 0, fr = Number(d.akstur_ferdir) || 0, gj = Math.round(Number(d.akstur_gjald) || 0);
  const stadf = Number(d.stadfesting) || 0;
  const sma = (Number(d.smahlutagjald) || 0) > 0 ? Math.round(smaR * (dvH + evH)) : 0;   // slökkt á draginu → áfram slökkt
  const mats = Array.isArray(d.materials_jsonb) ? d.materials_jsonb : [];
  const matSum = mats.length ? mats.reduce((a, m) => a + (Number(m.total) || Math.round((Number(m.price) || 0) * (Number(m.qty) || 0))), 0) : (Number(d.materials_total) || 0);
  const net0 = dvR * dvH + evR * evH + km * kmR + fr * ferdR + gj + sma + stadf + matSum;
  const discPct = Math.max(0, Math.min(100, Number(d.discount_pct) || 0));
  const disc = discPct > 0 ? Math.round(net0 * discPct / 100) : 0;
  // 15.11.2026: heilar krónur eins og compute() síðan 15.10.2026 („ISK ber enga aura" — 28 af 37 drögum báru aura í total_m_vsk).
  const net = Math.round(net0 - disc);
  const vsk = Math.round(net * vskPct / 100);
  return { dvH, evH, sma, net, vsk, total: net + vsk, matSum };
}

/* ÁFANGI 0 — stofna drög líðandi mánaðar. Verk fær drög AÐEINS ef ÖLL skilyrðin gilda (rukkarinn 15.11.2026):
 *   1. nafnið er nákvæmlega verkstaðurinn eins og /api/worksites reiknar hann (aliasMap[project] || project, eitt þrep) —
 *      annars teldist sami mánuður bæði í þrepi 2 (drögin) og þrepi 3 („Tími eftir") í Kröfu yfirliti;
 *   2. ≥ 1 klst í Tímaveru í mánuðinum;            3. ekki ó-rukkanlegt (K.ORUKKANLEGT);
 *   4. ekki gata/Ajour (K.GATA, Verðskrá source ajour);
 *   5. röð í Verðskrá með dagvinnutaxta (> 0) — taxti utan Verðskrár er verðákvörðun Agnars, ekki starfsins;
 *   6. ekki fast verð (Verðskrá fixed_amount, eða fixed_total á síðustu drögum verkstaðarins);
 *   7. engin invoice_drafts-röð fyrir verkstað+mánuð, í NEINNI stöðu (einkvæmur lykill gætir líka þess);
 *   8. engin krofur_yfirlit_meta-röð á draftinv|<ws>|<m>, og timavera|<ws>|<m> ekki falið (Agnar 06.08: falið = „á ekki að vera þarna");
 *   9. aldrei stofnað áður (app_kv MINNI) — eydd drög lifna ekki við;   10. greiðandi finnst;   11. samtala > 0
 *      (0 kr drög hverfa úr þrepi 2 OG 3 — sama gildra og Landsspítalinn í ágúst 2026).
 * Reitir eins og „📥 Fylla úr tímabók" + „💾 Vista" á nýjum drögum í Gerð reikninga: taxtar og heimilisfang úr Verðskrá, greiðandi
 * + kt + tilvísun eins og þrep 2 hópar (K.greidendur), smáhlutagjald á (taxti Verðskrár, 137 ef tómt — sjálfgefið á nýjum drögum),
 * staðfesting aðeins ef stadfesting_default, akstur 0, efni tómt (Efnislistinn forfyllir Redder og efni af lager við opnun),
 * tímar úr tímabók: með yfirvinnuþröskuld í Verðskrá (Fjallaböðin, samningsbundin yfirvinna) skipting tímabókar, annars allt í
 * dagvinnu (regla 15.10). Ekkert í notes — það prentast á Efnislistann. Skrifað með INSERT … ignore-duplicates, ALDREI um
 * /api/invoice-drafts (PATCH-fyrst + merge gæti yfirskrifað drög sem manneskja vistaði á sömu mínútu). */
async function stofnaDrog({ dry, man, PG, alltDrog, resolvePayer, ut }) {
  const nm = naestiManudur(man);
  const [faerslur, aliases, minniRod] = await Promise.all([
    sbAll(`timavera_entries?select=project,hours&date=gte.${man}-01&date=lt.${nm}-01`),
    sbGet('project_aliases?select=canonical_name,alias').catch(() => []),
    sbGet(`app_kv?select=value&key=eq.${MINNI}`),
  ]);
  const minni = new Set(Array.isArray(minniRod[0] && minniRod[0].value) ? minniRod[0].value : []);
  const aliasMap = {}; for (const a of aliases || []) if (a && a.alias) aliasMap[a.alias] = a.canonical_name;
  const klst = new Map();
  for (const r of faerslur) { const p = aliasMap[r.project] || r.project; if (p) klst.set(p, (klst.get(p) || 0) + (Number(r.hours) || 0)); }

  const tilDrog = new Set(), fastSidast = new Map();
  for (const d of [...alltDrog].sort((a, b) => String(a.work_month).localeCompare(String(b.work_month)))) {
    tilDrog.add(`${d.worksite_name}|${d.work_month}`);
    fastSidast.set(d.worksite_name, Number(d.fixed_total) > 0);   // síðustu drög verkstaðarins ráða
  }
  const verk = [...klst.entries()].filter(([, h]) => h >= 1).map(([p]) => p).sort((a, b) => a.localeCompare(b, 'is'));
  const metaLyklar = verk.flatMap((p) => [`draftinv|${p}|${man}`, `timavera|${p}|${man}`]);
  const meta = metaLyklar.length ? await sbGet(`krofur_yfirlit_meta?select=inv_key,hidden&inv_key=in.${inLista(metaLyklar)}`) : [];
  const metaBy = new Map(meta.map((m) => [m.inv_key, m]));

  const nyttMinni = [];
  for (const ws of verk) {
    if (tilDrog.has(`${ws}|${man}`)) continue;   // drögin eru til (í hvaða stöðu sem er) → uppfærsluáfanginn tekur við; ekki talið sem sleppt
    const lina = { ws, m: man, klst: Math.round(klst.get(ws) * 100) / 100 };
    const pg = PG[ws];
    let astaeda = null;
    if (K.ORUKKANLEGT.test(ws)) astaeda = 'ó-rukkanlegt';
    else if (K.GATA.test(ws)) astaeda = 'gata-/Ajour-verk';
    else if (!pg) astaeda = 'ekki í Verðskrá';
    else if (String(pg.source || '') === 'ajour') astaeda = 'Ajour-verk';
    else if (!(Number(pg.dagvinna_rate) > 0)) astaeda = 'enginn dagvinnutaxti í Verðskrá';
    else if (Number(pg.fixed_amount) > 0 || fastSidast.get(ws)) astaeda = 'fast verð';
    else if (metaBy.has(`draftinv|${ws}|${man}`)) astaeda = 'merkt í Kröfu yfirliti (draftinv)';
    else if ((metaBy.get(`timavera|${ws}|${man}`) || {}).hidden) astaeda = 'falið í Kröfu yfirliti';
    else if (minni.has(`${ws}|${man}`)) astaeda = 'stofnað áður (eytt síðan?) — ekki stofnað aftur';
    const payer = astaeda ? null : resolvePayer(ws);
    if (!astaeda && !payer) astaeda = 'enginn greiðandi';
    if (astaeda) { ut.stofnun.push({ ...lina, sleppt: astaeda }); continue; }

    try {
      const svar = await timabok.handler({ httpMethod: 'GET', queryStringParameters: { worksite: ws, month: man } });
      const tb = JSON.parse(svar.body || '{}');
      if (svar.statusCode !== 200) throw new Error('timabok: ' + (tb.error || svar.statusCode));
      const tvNu = r2(Number((tb.totals || {}).hours) || 0);
      const sp = tb.split || {};
      const spDv = Number(sp.hours_dagvinna) || 0, spEv = Number(sp.hours_eftirvinna) || 0;
      const medYfirvinnu = Number(pg.eftirvinna_threshold_per_day) > 0;
      const dvH = r2(medYfirvinnu ? spDv : spDv + spEv), evH = r2(medYfirvinnu ? spEv : 0);
      const stadf = pg.stadfesting_default === true ? (Number(pg.stadfesting_amount) || 0) : 0;
      const frae = { rate_dagvinna: Number(pg.dagvinna_rate), rate_eftirvinna: Number(pg.eftirvinna_rate) || null,
        akstur_km: 0, akstur_ferdir: 0, akstur_gjald: 0, smahlutagjald: 1, stadfesting: stadf, materials_jsonb: [], materials_total: 0, discount_pct: 0 };
      const c = reikna(frae, pg, dvH, evH);
      if (!(c.total > 0)) { ut.stofnun.push({ ...lina, sleppt: '0 kr' }); continue; }
      const kt = ktSnid(payer.kt) || ktSnid(pg.kennitala);
      const rod = {
        worksite_name: ws, work_month: man, source: 'timavera', status: 'draft',
        customer_name: payer.customer, kennitala: kt, heimilisfang: pg.heimilisfang || null, tilvisun: payer.tilvisun || null,
        hours_dagvinna: dvH, hours_eftirvinna: evH, rate_dagvinna: frae.rate_dagvinna, rate_eftirvinna: Number(pg.eftirvinna_rate) || 14927,
        akstur_km: 0, akstur_ferdir: 0, smahlutagjald: c.sma, stadfesting: stadf,
        materials_jsonb: [], materials_total: 0, discount_pct: 0,
        net_an_vsk: c.net, vsk_amount: c.vsk, total_m_vsk: c.total,
        timavera_klst_vid_vistun: tvNu,
        updated_at: new Date().toISOString(), updated_by: 'drog-timar (stofnað úr Tímaveru)',
      };
      Object.assign(lina, { stofnad: true, greidandi: payer.customer, kt, dv: dvH, ev: evH, total: c.total });
      if (!dry) {
        // Minnið FYRST: bregðist innsetningin er mánuðurinn lokaður sjálfvirkri stofnun (handvirk stofnun virkar áfram) —
        // betra en að eydd drög geti lifnað við. Einkvæmi lykillinn (worksite_name, work_month) ver gegn tvítöku.
        nyttMinni.push(`${ws}|${man}`);
        await sbUpsertKv(MINNI, [...minni, ...nyttMinni]);
        const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?on_conflict=worksite_name,work_month`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify(rod),
        });
        if (!r.ok) throw new Error(`invoice_drafts INSERT: ${r.status} ${(await r.text()).slice(0, 200)}`);
        const svarRod = await r.json();
        if (!Array.isArray(svarRod) || !svarRod.length) { delete lina.stofnad; lina.sleppt = 'drög urðu til á sama tíma — ekki snert'; ut.stofnun.push(lina); continue; }
        lina.id = svarRod[0].id;
      }
      ut.stofnud++; ut.stofnun.push(lina);
    } catch (e) {
      ut.villur++; ut.stofnun.push({ ...lina, villa: String(e.message || e) });
    }
  }
}

async function sbUpsertKv(key, value) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`app_kv ${key}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function keyra(opts) {
  const dry = !!(opts && opts.dry);
  const manudir = manudirSemStanda(opts && opts.now);   // `now` aðeins fyrir próf — keyrslan notar rauntíma
  const inMan = manudir.map(encodeURIComponent).join(',');
  // Sameiginleg gögn beggja áfanga: Verðskrá, greiðendakort og reikningar (greiðandi, sjálfvirk tenging við Payday), öll drög.
  const [pgRows, cwmap, reikningar, alltDrog] = await Promise.all([
    sbGet('pricing_guide?select=*').catch(() => []),
    sbGet('customer_worksite_map?select=customer_name,worksite_name,kt_greidanda,confidence,tilvisun,retention_pct'),
    sbAll('invoices?select=id,tilvisun,kt_greidanda,customer_name,gjalddagi,upphaed_total,status,source'),
    sbAll('invoice_drafts?select=worksite_name,work_month,total_m_vsk,customer_name,kennitala,status,payday_invoice_id,merged_into,fixed_total'),
  ]);
  const PG = {}; for (const p of pgRows) PG[p.worksite_name] = p;
  const resolvePayer = K.greidendur({ cwmap, pguide: pgRows, invoices: reikningar });
  const tenging = K.sjalfvirkTenging({ drafts: alltDrog, invoices: reikningar, resolvePayer });
  const ut = { manudir, stofnud: 0, stofnun: [], skodud: 0, uppfaerd: 0, obreytt: 0, sleppt: 0, villur: 0, linur: [], dry };

  // ÁFANGI 0 — stofna drög líðandi mánaðar (aldrei fyrri mánaðar, þótt hann standi fyrstu 3 dagana).
  try { await stofnaDrog({ dry, man: manudir[0], PG, alltDrog, resolvePayer, ut }); }
  catch (e) { ut.villur++; ut.stofnun.push({ m: manudir[0], villa: 'stofnun: ' + String(e.message || e) }); }

  // ÁFANGI 1 — uppfæra ósend Tímaveru-drög mánaðanna sem standa (líka þau sem voru stofnuð rétt í þessu).
  const drog = await sbGet(`invoice_drafts?select=*&work_month=in.(${inMan})&status=in.(draft,overdue)&payday_invoice_id=is.null&order=work_month.desc,worksite_name.asc`);
  ut.skodud = drog.length;
  const lyklar = drog.map((d) => K.draftKey(d));
  const meta = lyklar.length ? await sbGet(`krofur_yfirlit_meta?select=inv_key,sent,done&inv_key=in.${inLista(lyklar)}`) : [];
  const metaBy = new Map(meta.map((m) => [m.inv_key, m]));
  for (const d of drog) {
    const lina = { id: d.id, ws: d.worksite_name, m: d.work_month };
    try {
      let astaeda = null;
      const mt = metaBy.get(K.draftKey(d)) || {};
      if (String(d.source || '') !== 'timavera') astaeda = 'ekki Tímaveru-drag (' + d.source + ')';
      else if (Number(d.fixed_total) > 0) astaeda = 'fast verð';
      else if (d.merged_into || (Array.isArray(d.merged_from) && d.merged_from.length)) astaeda = 'samreiknað';
      else if (/🔒\s*t[ií]mar/i.test(String(d.notes || ''))) astaeda = '🔒tímar í notes';
      else if (mt.sent || mt.done) astaeda = mt.done ? '📨 krafa send' : '📤 sent í bókun';
      else if (tenging.has(K.draftKey(d))) astaeda = 'tengt Payday-reikningi';
      if (astaeda) { ut.sleppt++; ut.linur.push({ ...lina, sleppt: astaeda }); continue; }

      const svar = await timabok.handler({ httpMethod: 'GET', queryStringParameters: { worksite: d.worksite_name, month: d.work_month } });
      const tb = JSON.parse(svar.body || '{}');
      if (svar.statusCode !== 200) throw new Error('timabok: ' + (tb.error || svar.statusCode));
      const tvNu = r2(Number((tb.totals || {}).hours) || 0);
      const vid = (d.timavera_klst_vid_vistun == null || d.timavera_klst_vid_vistun === '')
        ? r2((Number(d.hours_dagvinna) || 0) + (Number(d.hours_eftirvinna) || 0))   // eldri drög án viðmiðs: gamla reglan (Kröfu yfirlit)
        : Number(d.timavera_klst_vid_vistun);
      const delta = r2(tvNu - vid);
      if (Math.abs(delta) < 0.05) { ut.obreytt++; ut.linur.push({ ...lina, tv: tvNu, obreytt: true }); continue; }

      const sp = tb.split || {};
      /* 15.10.2026 — Agnar: „svo oft eitthvað 0.1 klst í yfirvinnu og vesen",
       * „það á ekki að vera yfirvinna þarna".
       *
       * Þetta starf skrifaði yfirvinnuna úr /api/timabok (8 klst/dag, helgar
       * allar yfirvinna) beint í drögin — ÓHÁÐ hakinu „Reikna yfirvinnu af
       * tímabók" í Efnislistanum. Hakið er sjálfgefið AF, svo Agnar slökkti
       * aftur og aftur á einhverju sem hann hafði aldrei kveikt á.
       * MÆLT 15.10.2026: Skùlagata 26 sept. bar yfirvinnu 1,26 klst með hakið
       * AF, og átta drög síðan í júní báru yfirvinnu — þar af 0,02 klst (rúm
       * mínúta) á Hvaleyrarbraut og Stórhöfða, rukkuð á yfirvinnutaxta.
       *
       * Nú fer HEILDIN í dagvinnu. Summan er sú sama (frádrættir tímabókar
       * haldast, t.d. hádegi Fjarðagötu) — aðeins skiptingin breytist.
       *
       * Agnar vill samt geta kveikt á yfirvinnu þegar hún á við („en þá samt
       * kanski fínt að ég geti samt kveikt á yfirvinnu í kerfinu 8klst+").
       * Þjónninn sér ekki hakið sjálft (það býr í state.ui.timabok_edits hjá
       * vafranum) — en hann sér AFLEIÐINGU þess: beri drögin yfirvinnu er
       * búið að kveikja á henni þar. Hún er því notuð sem merkið:
       *
       *   ev > 0 á drögunum  → Agnar hefur kveikt; starfið heldur áfram að
       *                        skipta eftir reglu tímabókarinnar (8 klst/dag).
       *   ev = 0             → hrein drög; allt fer í dagvinnu, alltaf.
       *
       * Þannig ræður hakið í raun, án nýs dálks, og starfið getur hvorki
       * laumað yfirvinnu inn á hrein drög né þurrkað út þá sem hann valdi. */
      // 15.11.2026: yfirvinnuþröskuldur í Verðskrá (eftirvinna_threshold_per_day — í dag aðeins Fjallaböðin, samningsbundin
      // yfirvinna) gildir alltaf, svo drög sem voru stofnuð á degi án yfirvinnu (ev = 0) missi hana ekki seinna í mánuðinum.
      const yfirvinnaValin = (Number(d.hours_eftirvinna) || 0) > 0 || Number((PG[d.worksite_name] || {}).eftirvinna_threshold_per_day) > 0;
      const spDv = Number(sp.hours_dagvinna) || 0, spEv = Number(sp.hours_eftirvinna) || 0;
      const dvH = r2(yfirvinnaValin ? spDv : spDv + spEv);
      const evH = r2(yfirvinnaValin ? spEv : 0);
      const c = reikna(d, PG[d.worksite_name] || {}, dvH, evH);
      const payload = {
        hours_dagvinna: dvH, hours_eftirvinna: evH, smahlutagjald: c.sma,
        net_an_vsk: c.net, vsk_amount: c.vsk, total_m_vsk: c.total,
        timavera_klst_vid_vistun: tvNu,
        updated_at: new Date().toISOString(), updated_by: 'drog-timar (sjálfvirkt úr Tímaveru)',
      };
      Object.assign(lina, { tv_adur: vid, tv: tvNu, delta, dv: dvH, ev: evH, total_adur: Number(d.total_m_vsk) || 0, total: c.total });
      if (!dry) await sbPatch(d.id, payload);
      ut.uppfaerd++; ut.linur.push(lina);
    } catch (e) {
      ut.villur++; ut.linur.push({ ...lina, villa: String(e.message || e) });
    }
  }
  return ut;
}

exports.keyra = keyra;
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (event.httpMethod === 'POST') { const g = P.requireStaff(event); if (g) return g; }
  const q = event.queryStringParameters || {};
  const dry = event.httpMethod === 'GET' || q.dry === '1' || q.dry === 'true';   // GET = alltaf áætlun
  try { return json(200, await keyra({ dry })); }
  catch (e) { return json(500, { error: String(e.message || e) }); }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
