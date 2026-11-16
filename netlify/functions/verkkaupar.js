// verkkaupar.js — allt um EINN verkkaupa (greiðanda) á einum stað, fyrir Viðskiptavini-flipann.
// Agnar 04.09.2026: „þetta sýnir rosa takmarkað — sýna helstu samskiptaatriði, hver staðan er,
// hvað var samið um, tölvupóst og kennitölu, og listun á kröfunum sem við höfum sent þeim".
//
//   GET  /api/verkkaupar                 → { rows:[{ name, kt, worksites, osent, ogreitt, gjaldfallid, greitt_ar,
//                                                    tekjur_alls, sidasta_krafa, sidasta_virkni, fyrsta_virkni, … }] }
//   GET  /api/verkkaupar?name=<nafn>     → { info, worksites, krofur, drog, samskipti, samtals }
//   GET  /api/verkkaupar?nytt=1          → { verk, samskipti, krofur, beidnir, talning } — „Yfirlit" efst á síðunni (_vk-nytt.js)
//   GET  /api/verkkaupar?samningar=1     → { samningar, punktar, tillogur } — „Verk í samningsviðræðum" (16.11.2026)
//   POST /api/verkkaupar  { customer_name, ...customer_info reitir }  → upsert (m.a. general_notes)
//   POST /api/verkkaupar  { action:'samningur'|'samningur_eyda'|'punktur'|'punktur_eyda', … }  → vk_samningar / vk_punktar
//
// Heimildir: pricing_guide (samningurinn — taxtar, þröskuldur, gjöld), customer_info (kennitala,
// netfang, sími, greiðsluskilmálar, minnispunktar), invoices (kröfur sem hafa verið sendar),
// invoice_drafts (ósent), email_digest (samskipti sem nefna verkstaðina eða greiðandann),
// customer_worksite_map (verkstaðir sem eru tengdir handvirkt).

const KV = require('./_ktvorn');
const P = require('./_portal');   // starfsmanna-hliðið (requireStaff) fyrir samningsviðræðurnar
// Ógreitt/ósent: SÖMU reglur og Kröfu yfirlit (krofu-yfirlit-bru.js) — búa í _krofu-flokkun.js.
const K = require('./_krofu-flokkun');
const N = require('./_vk-nytt');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INFO_FIELDS = ['kennitala', 'payment_method', 'payment_terms', 'retention_pct', 'retention_notes',
  'contact_email', 'contact_phone', 'general_notes',
  // 16.10.2026 — Viðskiptavinir-síðan: tengiliður, reikningspóstur, heimilisfang (sql/2026-10-16_customer_info_tengilidur.sql)
  'contact_name', 'invoice_email', 'heimilisfang'];
// Persónulega pósthólfið er ALDREI hluti af samskiptum hér (sama regla og postleit.js, Agnar 18.09.2026).
const PERSONULEGT = 'aggisigurds@gmail.com';
const ekkiPersonulegt = '&account=not.ilike.' + encodeURIComponent(PERSONULEGT);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '');
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'POST') return await save(event);
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
    const q = event.queryStringParameters || {};
    if (q.nytt) return await nytt();
    if (q.samningar) { const g = P.requireStaff(event); if (g) return g; return await samningar(); }
    return q.name ? await detail(String(q.name).trim()) : await list();
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

const kr = (n) => Math.round(Number(n) || 0);
// kennitala → dddddd-dddd (sama snið og trigger normalize_kennitala skrifar í customer_info / fyrirtaeki / customers_base)
const normKt = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : ''; };
/* 31.10.2026 (allsherjar úttekt): Viðskiptavinir sýndi 70,4 m.kr. „ógreitt" og 82,8 m.kr. „ósent" á meðan Kröfu yfirlit
 * sagði 6,2 m.kr. útistandandi. Þrjár ástæður, allar lagaðar með því að nota reglur Kröfu yfirlits (_krofu-flokkun.js):
 *   1. Payday-DRÖG (DRAFT/Drög) töldust ógreidd — þau eru ósend (eins og þrep 2 í Kröfu yfirliti).
 *   2. Handvirkar merkingar í krofur_yfirlit_meta voru hunsaðar: „merkt greitt" telst greitt, falið og „📨 Krafa send"
 *      teljast ekki í summum (röðin birtist áfram í smáatriðum, merkt falin).
 *   3. „Ósent" taldi drög sem eru þegar í Payday (payday_invoice_id eða sjálfvirk tenging á kt + upphæð) og
 *      reikningsfærð/ógild drög (invoiced/void/skipped/merged).
 * Kredit/afturköllun fyrst: kreditreikningur ber oft greiðsludag og reiknaðist annars sem NEIKVÆÐ greiðsla
 * („Greitt í ár −8,7 m.kr." hjá Eykt) — K.flokkaReikning tekur kredit fyrst. */
const stada = (v, mt) => {
  const f = K.flokkaReikning(v, mt);
  return (f === 'ogreitt' && v.greidsla_date) ? 'greitt' : f;   // greiðsludagur skráður = greitt
};
// Sama krafan getur komið úr báðum innsogum — teljum hverja (gjalddaga, upphæð) einu sinni.
function dedupe(list) {
  const seen = new Set();
  return list.filter((v) => { const k = (v.gjalddagi || '') + '|' + kr(v.upphaed_total) + '|' + (v.tilvisun || ''); if (seen.has(k)) return false; seen.add(k); return true; });
}

async function list() {
  const [pg, info, inv, drafts, map, meta] = await Promise.all([
    sb('pricing_guide?select=worksite_name,customer_name,kennitala'),
    sb('customer_info?select=customer_name,kennitala,contact_email,last_payment_at'),
    sbAll('invoices?select=id,source,customer_name,kt_greidanda,upphaed_total,hofudstoll,status,utgafudagur,gjalddagi,eindagi,greidsla_date,worksite_match,tilvisun'),
    sbAll('invoice_drafts?select=worksite_name,customer_name,kennitala,total_m_vsk,status,merged_into,work_month,payday_invoice_id'),
    sbAll('customer_worksite_map?select=customer_name,worksite_name,kt_greidanda,confidence,tilvisun,retention_pct'),
    sbAll('krofur_yfirlit_meta?select=inv_key,hidden,paid,done'),
  ]);
  const { metaBy, tenging, tvitekin } = flokkunarGrunnur({ pg, inv, drafts, map, meta });
  // verkstaður → greiðandi (verðskrá ræður, kortið fyllir í eyður)
  const wsOwner = {};
  for (const m of map) if (m.worksite_name && m.customer_name) wsOwner[m.worksite_name] = m.customer_name;
  for (const p of pg) if (p.worksite_name && p.customer_name) wsOwner[p.worksite_name] = p.customer_name;

  const acc = {};
  // krofur_n: sendar kröfur (án tvífara) — viðmótið getur sýnt greiðendur sem eru aðeins í Payday (03.11.2026)
  // 16.11.2026 (Agnar: „Sorter á Greiðendur, nýjustu, tekjuhæstu, nýjasta virknin, með ógreitt"): tekjur_alls (sent og
  // ekki kreditfært), sidasta_virkni / fyrsta_virkni (reikningar + ósend drög). `sidustu_samskipti` var aldrei fyllt — fjarlægt.
  const get = (name) => (acc[name] = acc[name] || { name, kt: null, worksites: 0, osent: 0, ogreitt: 0, gjaldfallid: 0, greitt_ar: 0, tekjur_alls: 0, sidasta_krafa: null, sidasta_virkni: null, fyrsta_virkni: null, skrad: false, stadir: 0, greining: false, krofur_n: 0 });
  const virkni = (a, d) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return; if (!a.sidasta_virkni || d > a.sidasta_virkni) a.sidasta_virkni = d; if (!a.fyrsta_virkni || d < a.fyrsta_virkni) a.fyrsta_virkni = d; };
  // skrad = greiðandinn er skráður viljandi (verðskrá eða customer_info) — ekki bara nefndur á reikningi; viðmótið sýnir aðeins þá
  const wsSet = {}; const addWs = (n, w) => { if (n && w) (wsSet[n] = wsSet[n] || new Set()).add(w); };
  for (const p of pg) if (p.customer_name) { const a = get(p.customer_name); a.worksites++; a.skrad = true; if (!a.kt && p.kennitala) a.kt = p.kennitala; addWs(p.customer_name, p.worksite_name); }
  // 16.11.2026: greiðandi sem Agnar skráði sjálfur með ✎ Greiðandi (confidence 'manual') er skráður viljandi — áður sást
  // hvorki Landspítali (Áland 6) né Istanbul Market (Grensásvegur 10) í listanum nema með Payday-rofanum, eða alls ekki.
  for (const m of map) if (m.customer_name) { const a = get(m.customer_name); if (!a.kt && m.kt_greidanda) a.kt = m.kt_greidanda; addWs(m.customer_name, m.worksite_name); if (m.confidence === 'manual') a.skrad = true; }
  for (const i of info) if (i.customer_name) { const a = get(i.customer_name); if (i.kennitala) a.kt = i.kennitala; a.skrad = true; }
  // 16.11.2026: nöfn verkstaðanna fylgja svo leitin í listanum finni greiðanda eftir verkstað („Grensásvegur" → Istanbul Market)
  for (const n of Object.keys(wsSet)) { acc[n].worksites = Math.max(acc[n].worksites, wsSet[n].size); acc[n].verkstadir = [...wsSet[n]].slice(0, 40); }

  // 03.11.2026: reikningur á kt skráðs greiðanda telst honum þótt nafnið á reikningnum sé annað (Payday „Tilraunastöð Háskóla Íslands í
  // meinafræði" ↔ verðskrá „… að Keldum") — annars stóð prófíllinn kröfulaus. Aðeins þegar kt á einn skráðan greiðanda.
  const ktSkrad = new Map();
  for (const a of Object.values(acc)) { const k = normKt(a.kt); if (a.skrad && k) ktSkrad.set(k, ktSkrad.has(k) ? null : a.name); }
  const tvi = K.tvifarar(inv);   // bankaspeglar Payday-reikninga („310.0") og handskráðar Tekjur-raðir — sjá _krofu-flokkun.js
  const ar = new Date().getFullYear();
  const idag = new Date().toISOString().slice(0, 10);
  for (const v of dedupe(inv.filter((x) => !tvi.has(K.invKey(x))))) {
    if (!v.customer_name) continue;
    const alt = !(acc[v.customer_name] && acc[v.customer_name].skrad) && ktSkrad.get(normKt(v.kt_greidanda));
    const a = get(alt || v.customer_name);
    if (!a.kt && v.source === 'payday' && normKt(v.kt_greidanda)) a.kt = normKt(v.kt_greidanda);   // kt úr Payday þegar skráin þegir
    const mt = metaBy.get(K.invKey(v));
    const s = stada(v, mt);
    const upp = kr(v.upphaed_total);
    if (s === 'greitt' && String(v.greidsla_date || v.gjalddagi || '').slice(0, 4) === String(ar)) a.greitt_ar += upp;
    if (s === 'ogreitt' && upp > 0 && K.iSummu(mt)) { a.ogreitt += upp; const ein = String(v.eindagi || v.gjalddagi || '').slice(0, 10); if (ein && ein < idag) a.gjaldfallid += upp; }   // komið fram yfir eindaga (16.11.2026, samantektin efst)
    if (s === 'drog' && upp > 0 && K.iSummu(mt) && !tvitekin.has(K.invKey(v))) a.osent += upp;   // Payday-drög = ósent (þrep 2 í Kröfu yfirliti) — nema afrit af ógreiddum reikningi
    if (s !== 'drog' && v.gjalddagi && (!a.sidasta_krafa || v.gjalddagi > a.sidasta_krafa)) a.sidasta_krafa = v.gjalddagi;
    if (s !== 'drog' && s !== 'kredit') a.krofur_n++;
    if ((s === 'greitt' || s === 'ogreitt') && upp > 0) a.tekjur_alls += upp;
    if (s !== 'kredit') virkni(a, String(v.utgafudagur || v.gjalddagi || '').slice(0, 10));
  }
  for (const d of drafts) {
    const mt = metaBy.get(K.draftKey(d));
    if (!K.erOsent(d, tenging, mt) || !K.iSummu(mt)) continue;
    // 16.11.2026: drög án greiðanda (hvorki á drögunum né í korti/verðskrá) sáust HVERGI í Viðskiptavinum — Sidumuli 21
    // (1.470.729 kr), NESDEKK og Gullslètta 18 stóðu aðeins í Kröfu yfirliti, svo ósent var 1,9 m.kr. lægra hér. Þau birtast nú
    // undir heiti verkstaðarins, merkt `an_greidanda`, eins og Kröfu yfirlit sýnir þau.
    const eigandi = d.customer_name || wsOwner[d.worksite_name];
    const name = eigandi || d.worksite_name;
    if (!name) continue;
    const a = get(name);
    a.osent += kr(d.total_m_vsk);
    if (/^\d{4}-\d{2}$/.test(String(d.work_month || ''))) virkni(a, d.work_month + '-15');
    if (!eigandi) a.an_greidanda = true;
  }
  // 16.11.2026: greiðandi með ógreitt eða ósent er ALLTAF í listanum (Rafís: 2.589.597 kr ógreitt sást aðeins með rofanum).
  for (const a of Object.values(acc)) if (a.osent + a.ogreitt > 0) a.skrad = true;
  // Staðir í Slökkvitæki (fyrirtaeki á sömu kennitölu) og hvort Búnaðargreining er vistuð — fyrir merkin í listanum (aukaatriði)
  try {
    // 16.11.2026: allir með kennitölu fá staðamerki, ekki aðeins `skrad` (22 greiðendur stóðu merkislausir þótt prófíllinn sýndi staðina)
    const kts = [...new Set(Object.values(acc).map((a) => normKt(a.kt)).filter(Boolean))];
    if (kts.length) {
      const fy = await sb('fyrirtaeki?select=id,kennitala&deleted_at=is.null&kennitala=in.(' + kts.join(',') + ')&limit=1000');
      const ids = fy.map((f) => f.id);
      const bg = ids.length ? await sb('bunadargreining?select=company_id&fjarlaegt_at=is.null&company_id=in.(' + ids.join(',') + ')').catch(() => []) : [];
      const medGr = new Set(bg.map((g) => g.company_id));
      for (const a of Object.values(acc)) { const k = normKt(a.kt); if (!k) continue; const mine = fy.filter((f) => f.kennitala === k); a.stadir = mine.length; a.greining = mine.some((f) => medGr.has(f.id)); }
    }
  } catch (_) { /* merkin eru aukaatriði */ }
  const rows = Object.values(acc).sort((a, b) => (b.osent + b.ogreitt) - (a.osent + a.ogreitt) || a.name.localeCompare(b.name, 'is'));
  return json(200, { rows, generated_at: new Date().toISOString() });
}

// „Yfirlit" efst á Viðskiptavinum (16.11.2026): verk í gangi og ný verk úr Tímaveru, póstur sem tengist skráðum greiðendum,
// kröfur sendar / greiðslur mótteknar í Payday og beiðnir af verkstað. Reglurnar búa í _vk-nytt.js (prófaðar þar); hér er aðeins sótt.
async function nytt() {
  const idag = new Date().toISOString().slice(0, 10);
  const fra45 = N.dagaFra(idag, 45), fra14 = N.dagaFra(idag, 14), fra30 = N.dagaFra(idag, 30);
  const [pg, info, map, drafts, meta, timar, postur, payday, pv, faerslur, invAll] = await Promise.all([
    sb('pricing_guide?select=worksite_name,customer_name,kennitala'),
    sb('customer_info?select=customer_name,kennitala,contact_email,invoice_email'),
    sbAll('customer_worksite_map?select=customer_name,worksite_name,kt_greidanda,confidence,netfang'),
    sbAll('invoice_drafts?select=worksite_name,customer_name,kennitala,total_m_vsk,status,merged_into,work_month,payday_invoice_id'),
    sbAll('krofur_yfirlit_meta?select=inv_key,hidden,paid,done'),
    sbAll('timavera_entries?select=date,hours,employee,project&date=gte.' + fra45 + '&order=date.desc'),
    sbAll('email_digest?select=id,account,folder,sender_name,sender_email,to_addresses,subject,snippet,received_at&received_at=gte.' + fra14 + 'T00:00:00Z' + ekkiPersonulegt + '&order=received_at.desc').catch(() => []),
    sb('invoices?select=id,source,tilvisun,customer_name,kt_greidanda,upphaed_total,status,utgafudagur,gjalddagi,greidsla_date&source=eq.payday&or=(utgafudagur.gte.' + fra14 + ',greidsla_date.gte.' + fra14 + ',gjalddagi.gte.' + fra14 + ')&limit=500').catch(() => []),
    sb('payday_vidskiptavinir?select=ssn,netfang&netfang=not.is.null&limit=2000').catch(() => []),
    sb('field_entries?select=id,kind,worksite_name,author,employee,item_label,note,status,category,created_at&kind=in.(beidni,verk)&created_at=gte.' + fra30 + 'T00:00:00Z&order=created_at.desc&limit=60').catch(() => []),
    sbAll('invoices?select=id,source,customer_name,kt_greidanda,upphaed_total,hofudstoll,status,gjalddagi,greidsla_date,worksite_match,tilvisun'),
  ]);
  const wsOwner = {};
  for (const m of map) if (m.worksite_name && m.customer_name) wsOwner[m.worksite_name] = m.customer_name;
  for (const p of pg) if (p.worksite_name && p.customer_name) wsOwner[p.worksite_name] = p.customer_name;
  // kt → skráður greiðandi (aðeins þegar kt á einn) — Payday-nafn og skráð nafn eru ekki alltaf eins
  const ktNafn = new Map();
  const setKt = (kt, nafn) => { const k = normKt(kt); if (!k || !nafn) return; ktNafn.set(k, ktNafn.has(k) && ktNafn.get(k) !== nafn ? null : nafn); };
  for (const i of info) setKt(i.kennitala, i.customer_name);
  for (const p of pg) setKt(p.kennitala, p.customer_name);
  for (const m of map) setKt(m.kt_greidanda, m.customer_name);
  const nafnFyrirKt = (kt) => ktNafn.get(normKt(kt)) || null;
  // netföng: customer_info, netfang á verkstað í kortinu og Payday-viðskiptavinur á sömu kennitölu
  const netfong = [];
  for (const i of info) netfong.push({ netfang: [i.contact_email, i.invoice_email].filter(Boolean).join(' '), nafn: i.customer_name });
  for (const m of map) if (m.netfang) netfong.push({ netfang: m.netfang, nafn: m.customer_name });
  for (const p of pv) { const n = nafnFyrirKt(p.ssn); if (n) netfong.push({ netfang: p.netfang, nafn: n }); }
  // ósend drög per verkstað — sömu reglur og listinn
  const { metaBy, tenging } = flokkunarGrunnur({ pg, inv: invAll, drafts, map, meta });
  const osentVerk = {};
  for (const d of drafts) { const mt = metaBy.get(K.draftKey(d)); if (K.erOsent(d, tenging, mt) && K.iSummu(mt) && d.worksite_name) osentVerk[d.worksite_name] = (osentVerk[d.worksite_name] || 0) + kr(d.total_m_vsk); }
  // nýtt verk = engin Tímaveru-færsla FYRIR 45 daga gluggann (ein smáfyrirspurn per verk í glugganum)
  const verkIGlugga = [...new Set(timar.map((t) => String(t.project || '').trim()).filter((p) => p && !N.INNRA.test(p)))];
  const eldri = await Promise.all(verkIGlugga.map((p) => sb('timavera_entries?select=id&project=eq.' + encodeURIComponent(p) + '&date=lt.' + fra45 + '&limit=1').then((r) => (r.length ? p : null)).catch(() => p)));
  const reikningar = payday.map((v) => Object.assign({}, v, { flokkur: stada(v, metaBy.get(K.invKey(v))) })).filter((v) => v.flokkur === 'greitt' || v.flokkur === 'ogreitt');
  const ut = N.smida({ idag, timar, eldriVerk: eldri.filter(Boolean), wsOwner, verdskra: pg.map((p) => p.worksite_name).filter(Boolean), osentVerk,
    netfong, postur, reikningar, nafnFyrirKt, faerslur });
  ut.generated_at = new Date().toISOString();
  return json(200, ut);
}

async function detail(name) {
  const enc = encodeURIComponent(name);
  const [infoRows, pg, map, inv, drafts, allPg, allMap, allInv, meta] = await Promise.all([
    sb(`customer_info?customer_name=eq.${enc}&select=*`),
    sb(`pricing_guide?customer_name=eq.${enc}&select=*`),
    sb(`customer_worksite_map?customer_name=eq.${enc}&select=*`),
    sb(`invoices?customer_name=eq.${enc}&select=*&order=gjalddagi.desc.nullslast&limit=200`),
    sbAll('invoice_drafts?select=*&order=work_month.desc'),
    // Sjálfvirka tengingin (drög ↔ Payday) þarf ALLT mengið, ekki bara þennan greiðanda: Payday-röð sem er frátekin
    // af öðrum drögum má ekki tengjast hér, og greiðandi verkstaðar getur heitið annað en `name`.
    sb('pricing_guide?select=worksite_name,customer_name'),
    sbAll('customer_worksite_map?select=customer_name,worksite_name,kt_greidanda,confidence,tilvisun,retention_pct'),
    sbAll('invoices?select=id,source,customer_name,kt_greidanda,upphaed_total,hofudstoll,status,gjalddagi,tilvisun'),
    sbAll('krofur_yfirlit_meta?select=inv_key,hidden,paid,done'),
  ]);
  const { metaBy, tenging, tvitekin } = flokkunarGrunnur({ pg: allPg, inv: allInv, drafts, map: allMap, meta });
  const info = infoRows[0] || { customer_name: name };
  // 16.10.2026 — kennitala greiðandans í sömu röð og Efnislistinn: customer_info → verðskrá → kort → drög;
  // 03.11.2026: → Payday-reikningar á sama nafni (29 af 41 prófíl stóðu kt-lausir þótt Payday vissi hana — Hreyfingar óvirkar, staðir fundust ekki)
  const kt = info.kennitala || (pg.find((p) => p.kennitala) || {}).kennitala || (map.find((m) => m.kt_greidanda) || {}).kt_greidanda
    || (drafts.find((d) => d.customer_name === name && d.kennitala) || {}).kennitala
    || normKt((inv.find((v) => v.source === 'payday' && v.kt_greidanda) || {}).kt_greidanda) || null;
  const ktN = normKt(kt);
  // Reikningar á sömu kt undir öðru nafni (Payday „Tilraunastöð Háskóla Íslands í meinafræði" ↔ verðskrá „… að Keldum") eiga heima hér líka
  let payday = null;   // greiðendaskrá Payday (payday_vidskiptavinir, payday-pull.js) — prófíllinn sýnir hana sem „Í Payday"
  if (ktN) {
    const [aKt, pdv] = await Promise.all([
      sb(`invoices?kt_greidanda=in.(${ktN},${ktN.replace('-', '')})&select=*&order=gjalddagi.desc.nullslast&limit=200`).catch(() => []),
      sb(`payday_vidskiptavinir?ssn=eq.${ktN.replace('-', '')}&select=*`).catch(() => []),
    ]);
    payday = pdv[0] || null;
    const ids = new Set(inv.map((v) => v.id));
    for (const v of aKt) if (!ids.has(v.id)) inv.push(v);
    inv.sort((a, b) => String(b.gjalddagi || '').localeCompare(String(a.gjalddagi || '')));
  }
  const wsNames = [...new Set([...pg.map((p) => p.worksite_name), ...map.map((m) => m.worksite_name)].filter(Boolean))];
  // 16.11.2026: prófíll „án greiðanda" heitir eftir verkstaðnum — drög hans án greiðanda eiga heima hér (sjá list()).
  const anGreidanda = (d) => !d.customer_name && String(d.worksite_name || '').trim().toLowerCase() === name.toLowerCase();
  const sami = (d) => String(d.customer_name || '').trim().toLowerCase() === name.toLowerCase() || (ktN && normKt(d.kennitala) === ktN) || anGreidanda(d);
  const drog = drafts.filter((d) => { const mt = metaBy.get(K.draftKey(d)); return K.erOsent(d, tenging, mt) && K.iSummu(mt) && (sami(d) || wsNames.includes(d.worksite_name)); })
    .map((d) => ({ worksite_name: d.worksite_name, work_month: d.work_month, total_m_vsk: kr(d.total_m_vsk), hours: Number(d.hours_dagvinna) || 0,
      notes: String(d.notes || '').trim().slice(0, 300),       // 16.11.2026: athugasemd draganna fer í „Um verkið"
      // 16.11.2026: hvað vantar á drögin SJÁLF til að senda (tools/osent-upplysingar.cjs les þetta). Aðeins heiti reita, engin gildi.
      heimilisfang: String(d.heimilisfang || '').trim(), vantar: N.vantarADrog(d) }));

  // Samskipti: póstar sem nefna verkstaðina eða greiðandann (email_digest = brunaholf-pósthólfið)
  const orParts = [];
  const like = (s) => `*${String(s).replace(/[*,()]/g, ' ').trim()}*`;
  // 11.11.2026: ilike þekkir ekki broddstafi (Sidumuli ≠ Síðumúli): sérhljóðar og d/ð/þ verða „_" (einn stafur) — nákvæmt nóg með götunúmerinu.
  const brodd = (s) => `*${String(s).replace(/[*,()%]/g, ' ').trim().replace(/[aeiouyádðþéíóúýæöàäâèêëìîïòôùüû]/gi, '_').replace(/\s+/g, ' ')}*`;
  // 16.11.2026 (Agnar: „ég sé ekkert í þessari bölvaðri samskiptasögu" — úttekt: 17 greiðendur fylltu 40-pósta þakið af
  // póstum ANNARRA): (1) aðeins sértæk verkstaðarheiti eru leitarorð — með tölustaf, tveimur orðum eða ≥ 10 stafa — því
  // „Mosó" varð `M_s_` og „Fjörður" greip allan Hafnarfjörð; almenna heitið „Brunaþéttingar" er aldrei leitarorð.
  // (2) Gata + húsnúmer leitar á stofni götunnar svo beygingin skipti ekki máli („Grensásvegur 10" finnur „Grensásvegi 10").
  // (3) Fyrsta orð nafnsins er ekki lengur leitarorð („Sigurður" greip alla Sigurða, „Auto" greip „Automatic reply") —
  // heila nafnið án félagsforms: í sendanda ef ≥ 4 stafir, í efnislínu aðeins ef ≥ 8.
  const sertaekt = (w) => { const s = String(w || '').trim(); return !/^brunaþéttingar?$/i.test(s) && (/\d/.test(s) || /\s/.test(s) || s.length >= 10); };
  // 16.11.2026 (mælt á Systur og makar / „Sidumuli 21"): mynstrið var `*S___m_* 21*` — stjarnan milli stofns og húsnúmers
  // hleypti HVERJU SEM ER á milli, svo „Co2 refill", Kringlan og Kassaborg fylltu 40-pósta þakið. Nú er endingin 0–2 stafir
  // (N.gotuMynstur): „Síðumúli 21" og „Síðumúla 21" finnast, texti með „21" einhvers staðar aftar ekki.
  for (const w of wsNames.filter(sertaekt).slice(0, 12)) { for (const p of (N.gotuMynstur(w) || [brodd(w)])) for (const f of ['subject', 'snippet', 'body_preview']) orParts.push(`${f}.ilike.${p}`); }
  const kjarni = name.replace(/[,.]?\s*\b(ehf|hf|slf|sf|ses|ohf)\b\.?\s*$/i, '').trim();
  if (kjarni.length >= 4) orParts.push(`sender_name.ilike.${like(kjarni)}`);
  if (kjarni.length >= 8) orParts.push(`subject.ilike.${like(kjarni)}`);
  // 16.11.2026 (Agnar: „tengingu við tölvupóstana" — Tindasel/Deluxe Lodges: raunveruleg samskipti við
  // sigurdur@deluxeiceland.is fundust ekki, því hvorki nafn né verkstaður birtast orðrétt í þræðinum, bara
  // netfangið. Þekkt netfang greiðandans (tengiliður eða reikningspóstur) er sterkari vísbending en texti-leit —
  // bætt við hér, ekki í staðinn fyrir hana. Dalbraut-16-dæmið (virkar vel) sýnir að verkstaða-nafnaleitin er
  // annars í lagi — þetta er viðbót fyrir þegar netfangið er þekkt en textinn ekki.
  // 16.11.2026: netföng úr ÖLLUM skrám sem þekkja greiðandann — customer_info, Payday-greiðendaskráin, netfang verkstaðar
  // (customer_worksite_map.netfang) og staðir í Slökkvitæki (fyrirtaeki.netfang) — áður aðeins customer_info (34 af 117).
  // Reitur með mörgum netföngum (komma, semikomma, bil) er klofinn; eigin pósthólf eru aldrei leitarorð.
  let stadaNetfong = [];
  if (ktN) stadaNetfong = (await sb(`fyrirtaeki?select=netfang&deleted_at=is.null&kennitala=eq.${ktN}&netfang=not.is.null&limit=20`).catch(() => [])).map((f) => f.netfang);
  const netfong = [...new Set([info.contact_email, info.invoice_email, payday && payday.netfang, ...map.map((m) => m.netfang), ...stadaNetfong]
    .filter(Boolean).flatMap((s) => String(s).split(/[,;\s]+/)).map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(s) && !/@(brunaholf|eldklar|slokkvitaeki)\./.test(s)))].slice(0, 8);
  for (const addr of netfong) {
    orParts.push(`sender_email.ilike.${like(addr)}`);
    orParts.push(`to_addresses.ilike.${like(addr)}`);
  }
  let samskipti = [];
  if (orParts.length) {
    // or-gildið VERÐUR að vera kóðað: „&" í verkstaðarheiti („Gjáhella 5 bil 107 & 110") klauf slóðina, PostgREST svaraði 400
    // og .catch gleypti villuna — síðan sagði „Engir póstar fundust" hjá Martim og Stálsmiðjunni.
    // 16.11.2026 (Agnar: „ég myndi vilja sjá allann póstinn, ekki bara hluta"): meginmálið (body_preview, allt að 4.000 stafir
    // í innsoginu), viðtakendur, viðhengi og pósthólf fylgja — prófíllinn opnar póstinn í heild. Persónulega hólfið síað út.
    samskipti = await sb(`email_digest?select=id,account,sender_name,sender_email,to_addresses,subject,snippet,body_preview,has_attachment,attachment_names,received_at,folder&or=${encodeURIComponent('(' + orParts.join(',') + ')')}${ekkiPersonulegt}&order=received_at.desc&limit=40`).catch(() => []);
  }

  // 03.11.2026 (Agnar: „Taka tvítök"): bankaspeglar Payday-reikninga og handskráðar Tekjur-raðir detta út; kredit-par (ógiltur
  // reikningur + kreditreikningurinn hans) verður EIN lína „ógilt" í stað tveggja „kredit"-lína. Sjá K.tvifarar / K.kreditPor.
  const tvi = K.tvifarar(inv), por = K.kreditPor(inv);
  const parad = new Set([...por.values()].map((c) => K.invKey(c)));
  const inv2 = dedupe(inv.filter((v) => !tvi.has(K.invKey(v)) && !parad.has(K.invKey(v))));
  for (const v of inv2) {
    const mt = metaBy.get(K.invKey(v));
    v.stada = stada(v, mt);
    if (!K.iSummu(mt)) v.falid = true;      // falið eða „📨 Krafa send" í Kröfu yfirliti — sést, en telst ekki í summu
    if (v.stada === 'drog' && tvitekin.has(K.invKey(v))) v.falid = true;   // Payday-drög sem afrita ógreiddan reikning — sést, telst ekki (01.11.2026)
    const c = por.get(K.invKey(v));
    if (c) { v.stada = 'ogilt'; v.kredit_tilvisun = c.tilvisun; v.kredit_dags = c.greidsla_date || c.gjalddagi || null; }
  }
  // 16.11.2026 (Agnar: „ég verð að fá að sjá eldri efnislista"): þegar drögin verða að raunverulegum reikningi (staða
  // 'invoiced') missir kröfuröðin hér tengslin við verkstað+mánuð — síðan hafði því engan Efnislista-takka á sendum
  // reikningum, aðeins á ósendum drögum (05). Parað eftir sama greiðanda + upphæð innan 2 kr, eitt drög per reikning —
  // sama vikmörk og teiknaSaga notar í Reikningagerð „06 Fyrri reikningar".
  const invoicedDrafts = drafts.filter((d) => d.status === 'invoiced' && (sami(d) || wsNames.includes(d.worksite_name)) && (+d.total_m_vsk || 0) > 0);
  const draftUsed = new Set();
  for (const v of inv2) {
    if (v.stada === 'drog' || v.stada === 'ogilt' || v.falid) continue;
    const amt = kr(v.upphaed_total);
    if (!(amt > 0)) continue;
    const hit = invoicedDrafts.find((d) => !draftUsed.has(d) && Math.abs(kr(d.total_m_vsk) - amt) <= 2);
    if (!hit) continue;
    draftUsed.add(hit);
    v.draft_match = { worksite_name: hit.worksite_name, work_month: hit.work_month };
  }
  // 16.11.2026 („Um verkið" + Agnar: „einhverjar upplýsingar eru hérna" — Vörubirgðir/Kostnaður): efni keypt í verkið.
  // Redder er eina áreiðanlega tengingin efnis við verkstaði Brunahólfs (sama og Efnislistinn): reikningar paraðir við
  // verkstaðinn + línur sem eru handfærðar á hann (worksite_override); lína handfærð á ANNAÐ verk telst ekki hér.
  // Kostnaður (kostnadur.tilvisun) er frjáls texti — ekki parað á hann, aðeins á fyrirtaeki_id (sjá neðar).
  let efni = null;
  const efnisVerk = [...new Set([...wsNames, ...drog.map((x) => x.worksite_name)].filter(Boolean))];
  if (efnisVerk.length) {
    try {
      const inList = encodeURIComponent(efnisVerk.map((w) => '"' + String(w).replace(/"/g, '') + '"').join(','));
      const [ri, handf] = await Promise.all([
        sb(`redder_invoices?select=id,dagsetning&worksite_match=in.(${inList})&limit=300`),
        sb(`redder_line_items?select=invoice_id,item_name,upphaed,excluded,worksite_override&worksite_override=in.(${inList})&limit=1000`),
      ]);
      const ids = ri.map((r) => r.id);
      const linur = ids.length ? await sb(`redder_line_items?select=invoice_id,item_name,upphaed,excluded,worksite_override&invoice_id=in.(${ids.join(',')})&limit=3000`) : [];
      const okkar = new Set(efnisVerk), idSet = new Set(ids);
      const gild = linur.filter((l) => !l.excluded && (!l.worksite_override || okkar.has(l.worksite_override)))
        .concat(handf.filter((l) => !l.excluded && !idSet.has(l.invoice_id)));
      if (gild.length) {
        const vorur = new Map(); let alls = 0;
        for (const l of gild) { const u = Number(l.upphaed) || 0; alls += u; const k = String(l.item_name || '').trim(); if (k) vorur.set(k, (vorur.get(k) || 0) + u); }
        const dags = ri.map((r) => String(r.dagsetning || '').slice(0, 10)).filter(Boolean).sort();
        efni = { reikningar: new Set(gild.map((l) => l.invoice_id)).size, an_vsk: kr(alls), fyrst: dags[0] || null, sidast: dags[dags.length - 1] || null,
          helstu: [...vorur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nafn, upp]) => ({ nafn, upp: kr(upp) })) };
      }
    } catch (_) { efni = null; }   // efnið er aukaatriði — prófíllinn opnast samt
  }
  const iSum = (v) => !v.falid && kr(v.upphaed_total) > 0;
  const samtals = {
    krofur: inv2.filter((v) => v.stada !== 'drog' && v.stada !== 'ogilt' && v.stada !== 'kredit').length,   // 16.11.2026: kreditreikningar teljast ekki (listinn sleppti þeim þegar)
    ogreitt: inv2.filter((v) => v.stada === 'ogreitt' && iSum(v)).reduce((a, v) => a + kr(v.upphaed_total), 0),
    greitt: inv2.filter((v) => v.stada === 'greitt').reduce((a, v) => a + kr(v.upphaed_total), 0),
    osent: drog.reduce((a, d) => a + d.total_m_vsk, 0)
      + inv2.filter((v) => v.stada === 'drog' && iSum(v)).reduce((a, v) => a + kr(v.upphaed_total), 0),
    verkstadir: wsNames.length,
  };
  // Staðir í Slökkvitæki: fyrirtaeki á sömu kennitölu eða sama customers_base — þar búa teikningar, Greining, skjöl og tæki
  let stadir = [];
  if (ktN) {
    try {
      const base = await sb('customers_base?select=id&kennitala=eq.' + ktN).catch(() => []);
      const or = ['kennitala.eq.' + ktN].concat(base.length ? ['customer_base_id.in.(' + base.map((b) => b.id).join(',') + ')'] : []);
      stadir = await sb('fyrirtaeki?select=id,nafn,heimilisfang,kennitala,er_i_thjonustu&deleted_at=is.null&or=(' + or.join(',') + ')&order=id.asc&limit=40');
      const sIds = stadir.map((s) => s.id);
      if (sIds.length) {
        const [tb, bg] = await Promise.all([
          sb('teikning_bord?select=company_id&company_id=in.(' + sIds.join(',') + ')').catch(() => []),
          sb('bunadargreining?select=company_id&fjarlaegt_at=is.null&company_id=in.(' + sIds.join(',') + ')').catch(() => []),
        ]);
        for (const s of stadir) { s.teikning = tb.some((x) => x.company_id === s.id); s.greining = bg.some((x) => x.company_id === s.id); }
      }
    } catch (_) { stadir = []; }
  }
  // Kostnaður (birgjareikningar) sem er skráður beint á stað greiðandans (kostnadur.fyrirtaeki_id) — 8 af 265 færslum 16.11.2026
  const kostnadur = stadir.length ? await sb('kostnadur?select=id,seljandi,reikningsnr,dags,upphaed,samantekt,fyrirtaeki_id&fyrirtaeki_id=in.('
    + stadir.map((s) => s.id).join(',') + ')&order=dags.desc.nullslast&limit=20').catch(() => []) : [];
  const verkstadir_heimili = map.filter((m) => m.worksite_name).map((m) => ({ worksite_name: m.worksite_name, heimilisfang: m.heimilisfang || null }));
  // 16.11.2026 (Agnar: „eyða tvítökum, drafts, þegar payday er orðið tengt"): Payday-drögin sem eru staðfest
  // tvítekning af ógreiddum reikningi (tvitekin, sjá línu 191) sátu áfram í listanum með „falið í Kröfu yfirliti" —
  // Agnar vill þau alveg burt úr „06 Kröfur sem við höfum sent", ekki bara merkt. Summurnar breytast ekki (þær
  // slepptu þeim nú þegar), aðeins það sem birtist. v.falid heldur áfram að geta þýtt annað (handvirkt falið í
  // Kröfu yfirliti) — þær raðir eiga að sjást áfram, svo skilyrðið hér er sértækt við tvitekin-drögin.
  const krofurOut = inv2.filter((v) => !(v.stada === 'drog' && tvitekin.has(K.invKey(v))));
  // 16.11.2026 (Agnar: „við erum búnir að senda reikninginn, svo auðvitað er það þá verðið"): taxtinn sem var síðast
  // rukkaður per verkstað (nýjustu send drög með dagvinnutaxta) — „＋ Skrá taxta" forfyllir hann í stað sjálfgefins 9.951.
  // `drafts` er raðað nýjast fyrst, svo fyrsta hitt per verkstað er nýjasti mánuðurinn.
  const sidasti_taxti = {};
  for (const d of drafts) {
    if (!d.worksite_name || sidasti_taxti[d.worksite_name]) continue;
    if (!['invoiced', 'sent'].includes(String(d.status || '')) || !(Number(d.rate_dagvinna) > 0)) continue;
    if (!(sami(d) || wsNames.includes(d.worksite_name))) continue;
    sidasti_taxti[d.worksite_name] = { dv: Number(d.rate_dagvinna), ev: Number(d.rate_eftirvinna) || null, work_month: d.work_month,
      yfirvinna: (Number(d.hours_eftirvinna) || 0) > 0, kennitala: d.kennitala || null, heimilisfang: d.heimilisfang || null };
  }
  // an_greidanda: prófíllinn er verkstaður sem á ósend drög en engan skráðan greiðanda — viðmótið segir hvað vantar.
  const an_greidanda = !infoRows.length && !pg.length && !map.length && drafts.some((d) => anGreidanda(d) && !K.EKKI_OSENT.has(String(d.status || '')));
  return json(200, { info, kt, worksites: pg, map, krofur: krofurOut, drog, samskipti, samtals, stadir, verkstadir_heimili, payday, sidasti_taxti, an_greidanda,
    efni, kostnadur, generated_at: new Date().toISOString() });
}

async function save(event) {
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  if (SAMNINGA_AKTIONIR.has(b.action)) { const g = P.requireStaff(event); if (g) return g; return await samningsAdgerd(b); }
  const name = String(b.customer_name || '').trim();
  if (!name) return json(400, { error: 'customer_name vantar' });
  if (b.action === 'stofna_stad') return await stofnaStad(b, name);
  const row = { customer_name: name, updated_at: new Date().toISOString() };
  for (const f of INFO_FIELDS) if (b[f] !== undefined) row[f] = b[f] === '' ? null : b[f];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_info?on_conflict=customer_name`, {
    method: 'POST',
    headers: Object.assign(hdrs(), { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  const rows = await r.json();
  return json(200, { ok: true, info: rows[0] || row });
}

// 20.10.2026 — „Stofna stað í Slökkvitæki" úr Viðskiptavinir-síðunni: ný röð í fyrirtaeki undir kennitölu greiðandans. Triggerar sjá um
// kennitölusnið, póstnúmer og tengingu við customers_base. Aldrei tvítekið: sama kt + sama heimilisfang skilar röðinni sem er til.
async function stofnaStad(b, customer) {
  const nafn = String(b.nafn || '').trim() || customer;
  const heimili = String(b.heimilisfang || '').trim();
  const ktN = normKt(b.kennitala);
  if (!/\d{3}/.test(heimili)) return json(400, { error: 'Heimilisfang með póstnúmeri vantar (t.d. „Sunnukriki 3, 270 Mosfellsbær")' });
  // 31.10.2026 (úttekt): tóm kt bjó til fyrirtaeki-röð án kennitölu sem detail() finnur ekki aftur (leitar eftir kt), svo takkinn
  // birtist á ný og hver smellur bætti við tvífara. Stofnum ekkert án kennitölu — viðmótið segir hvað vantar.
  if (!ktN) return json(400, { error: 'Kennitölu greiðandans vantar — skráðu hana fyrst svo staðurinn tengist réttu félagi.' });
  // 29.10.2026 (Krókur 77): sama regla og annars staðar (sjá _ktvorn.js). Áður var aðeins athugað nákvæmt heimilisfang
  // (lágstafir) á sömu kt — sama nafn með örlítið annað heimilisfang bjó til tvífara. Nú: sama NAFN eða sama heimilisfang
  // (gata+númer) á kt → röðin sem er til; annars nýr staður með næsta staðarnúmeri. Leitarvilla stofnar EKKERT.
  const row = { nafn, heimilisfang: heimili, er_i_thjonustu: false, athugasemdir: 'Stofnað úr Viðskiptavinir (Brunahólf) fyrir greiðandann ' + customer };
  const res = await KV.faTilStad({ sb: KV.makeSb((...a) => fetch(...a), SUPABASE_URL, SUPABASE_KEY), kt: ktN, thjonusta: false, row });
  if (!res.ok) return json(res.status || 502, { error: res.error });
  return json(200, { ok: true, id: (res.row || {}).id, existed: res.hvernig === 'reuse', astaeda: res.astaeda || null });
}

// ---------- Verk í samningsviðræðum (16.11.2026) ----------
// Agnar: „statusupdate með verk í samningsviðræðum, og að ég geti punktað eitthvað þarna inn líka".
// vk_samningar = verkin (staða, greiðandi, áætluð upphæð, næsta skref) · vk_punktar = punktar, tengdir verki eða almennir.
// Tillögur úr pósti: þræðir síðustu 45 daga með „tilboð" í efnislínu þar sem VIÐ sendum eða svöruðum (fréttabréf og tilboð
// birgja til okkar detta þá út), og sem eru ekki skráðir nú þegar (uppruni 'mail:<efni>' — líka hunsaðir og eyddir).
// Tillaga stofnar ekkert sjálf: Agnar velur „＋ Bæta við" (forfyllt form) eða „✕ Hunsa". Ekkert er eytt — deleted_at.
const STODUR = ['fyrirspurn', 'tilbod_sent', 'i_vidraedum', 'samthykkt', 'hafnad', 'hunsad'];
const SAMNINGA_AKTIONIR = new Set(['samningur', 'samningur_eyda', 'punktur', 'punktur_eyda']);
const OKKAR = /@(brunaholf|eldklar|slokkvitaeki)\.|^brunaholfehf@gmail\.com$/i;
const hreintEfni = (s) => String(s || '').replace(/^\s*((re|sv|aw|fw|fwd|fs|tr)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim();
const netfongIr = (s) => (String(s || '').match(/[^\s<>,;"'()]+@[^\s<>,;"'()]+\.[a-z]{2,}/gi) || []).map((x) => x.toLowerCase());

async function samningar() {
  const fra45 = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
  const [sam, uppr, pkt, post, info] = await Promise.all([
    sb('vk_samningar?select=id,heiti,greidandi,stada,upphaed,naesta_skref,uppruni,created_at,updated_at,updated_by&deleted_at=is.null&stada=neq.hunsad&order=updated_at.desc&limit=300'),
    sb('vk_samningar?select=uppruni&uppruni=not.is.null&limit=3000'),
    sb('vk_punktar?select=id,samningur_id,texti,hofundur,created_at&deleted_at=is.null&order=created_at.desc&limit=600'),
    sb('email_digest?select=id,account,sender_name,sender_email,to_addresses,subject,received_at&subject=ilike.*tilbo*' + ekkiPersonulegt
      + '&received_at=gte.' + fra45 + 'T00:00:00Z&order=received_at.desc&limit=250').catch(() => []),
    sb('customer_info?select=customer_name,contact_email,invoice_email').catch(() => []),
  ]);
  const kunniNetfangs = new Map();
  for (const i of info) for (const e of netfongIr([i.contact_email, i.invoice_email].join(' '))) if (!kunniNetfangs.has(e)) kunniNetfangs.set(e, i.customer_name);
  const skrad = new Set(uppr.map((r) => String(r.uppruni || '').toLowerCase()));
  // þræðir eftir hreinsaðri efnislínu; pósturinn kemur nýjastur fyrst, svo fyrsti póstur þráðar er sá nýjasti
  const thraedir = new Map();
  for (const m of post) {
    const efni = hreintEfni(m.subject);
    if (!efni) continue;
    const key = ('mail:' + efni.toLowerCase()).slice(0, 300);
    if (skrad.has(key)) continue;
    const fra = String(m.sender_email || '').toLowerCase();
    const fraOkkur = OKKAR.test(fra);
    let t = thraedir.get(key);
    if (!t) thraedir.set(key, t = { uppruni: key, efni, sidast: m.received_at, holf: m.account || '', fjoldi: 0, fraOkkur: false, nyjastFraOkkur: fraOkkur, motadili: null, tilAdila: null });
    t.fjoldi++;
    if (fraOkkur) { t.fraOkkur = true; if (!t.tilAdila) t.tilAdila = netfongIr(m.to_addresses).find((e) => !OKKAR.test(e)) || null; }
    else if (!t.motadili) t.motadili = { netfang: fra, nafn: m.sender_name || null };
  }
  const tillogur = [...thraedir.values()].filter((t) => t.fraOkkur).slice(0, 10).map((t) => {
    const md = t.motadili || (t.tilAdila ? { netfang: t.tilAdila, nafn: null } : null);
    return { uppruni: t.uppruni, efni: t.efni, sidast: t.sidast, holf: t.holf, fjoldi: t.fjoldi, motadili: md,
      greidandi: (md && kunniNetfangs.get(md.netfang)) || null, stada: t.nyjastFraOkkur ? 'tilbod_sent' : 'i_vidraedum' };
  });
  const perVerk = new Map();
  for (const p of pkt) if (p.samningur_id) { const l = perVerk.get(p.samningur_id) || []; if (l.length < 30) l.push(p); perVerk.set(p.samningur_id, l); }
  return json(200, {
    samningar: sam.map((s) => Object.assign({}, s, { punktar: perVerk.get(s.id) || [] })),
    punktar: pkt.filter((p) => !p.samningur_id).slice(0, 40),
    tillogur, generated_at: new Date().toISOString(),
  });
}

async function samningsAdgerd(b) {
  const hofundur = String(b.hofundur || '').trim().slice(0, 40) || null;
  const nu = new Date().toISOString();
  const id = Number(b.id) || 0;
  if (b.action === 'samningur_eyda' || b.action === 'punktur_eyda') {
    if (!id) return json(400, { error: 'id vantar' });
    await skrifa('PATCH', `${b.action === 'samningur_eyda' ? 'vk_samningar' : 'vk_punktar'}?id=eq.${id}`, { deleted_at: nu });
    return json(200, { ok: true });
  }
  if (b.action === 'punktur') {
    const texti = String(b.texti || '').trim().slice(0, 4000);
    if (!texti) return json(200, { ok: true, tomt: true });   // ALLTAF LEYFA VISTUN: tómur punktur er ekki villa — bara ekkert skráð
    const samningur_id = Number(b.samningur_id) || null;
    const [p] = await skrifa('POST', 'vk_punktar', { texti, hofundur, samningur_id });
    if (samningur_id) await skrifa('PATCH', `vk_samningar?id=eq.${samningur_id}`, { updated_at: nu, updated_by: hofundur });
    return json(200, { ok: true, punktur: p || null });
  }
  // 'samningur': stofna (án id) eða uppfæra (með id) — aðeins reitir sem eru sendir breytast
  const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n) || null;
  const row = { updated_at: nu, updated_by: hofundur };
  if (b.heiti !== undefined) row.heiti = txt(b.heiti, 200);
  if (b.greidandi !== undefined) row.greidandi = txt(b.greidandi, 200);
  if (b.naesta_skref !== undefined) row.naesta_skref = txt(b.naesta_skref, 400);
  if (b.uppruni !== undefined) { const u = txt(b.uppruni, 300); row.uppruni = u ? u.toLowerCase() : null; }
  if (b.upphaed !== undefined) { const d = String(b.upphaed == null ? '' : b.upphaed).replace(/[^\d]/g, ''); row.upphaed = d ? Number(d) : null; }
  if (b.stada !== undefined) row.stada = STODUR.includes(b.stada) ? b.stada : 'i_vidraedum';
  if (!id) {
    // ALLTAF LEYFA VISTUN: verk án heitis fær nafn greiðandans, upphaf punktsins eða „Nýtt verk" — vistunin stöðvast aldrei
    if (!row.heiti) row.heiti = row.greidandi || txt(b.punktur, 80) || 'Nýtt verk';
    if (!row.stada) row.stada = 'i_vidraedum';
    const [s] = await skrifa('POST', 'vk_samningar', row);
    const texti = String(b.punktur || '').trim();
    if (s && texti) await skrifa('POST', 'vk_punktar', { texti: texti.slice(0, 4000), hofundur, samningur_id: s.id });
    return json(200, { ok: true, samningur: s || null });
  }
  if ('heiti' in row && !row.heiti) delete row.heiti;   // tómt heiti skrifar ekki yfir það sem fyrir er
  const [s] = await skrifa('PATCH', `vk_samningar?id=eq.${id}`, row);
  return json(200, { ok: true, samningur: s || null });
}

async function skrifa(method, qs, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${qs}`, { method, headers: Object.assign(hdrs(), { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

// Sameiginlegur grunnur flokkunarinnar: meta eftir lykli + sjálfvirk tenging drög ↔ Payday (sama og Kröfu yfirlit).
function flokkunarGrunnur({ pg, inv, drafts, map, meta }) {
  const metaBy = new Map((meta || []).map((m) => [m.inv_key, m]));
  const resolvePayer = K.greidendur({ cwmap: map, pguide: pg, invoices: inv });
  const tenging = K.sjalfvirkTenging({ drafts, invoices: inv, resolvePayer });
  // Payday-drög sem afrita ógreiddan reikning (01.11.2026), sama drag tvísótt eða ósend gerð-drög okkar (16.11.2026) — telja ekki sem ósend.
  const tvitekin = K.tvitekinPaydayDrog({ invoices: inv, metaBy, drafts, resolvePayer, tenging });
  return { metaBy, tenging, tvitekin };
}

function hdrs() { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }; }
// Síðuskipt lestur (Range per 1000) — sama mynstur og fetchAll í krofu-yfirlit-bru.js.
async function sbAll(qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${qs}`, { headers: Object.assign(hdrs(), { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }) });
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
async function sb(qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${qs}`, { headers: hdrs() });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
function resp(code, body, extra) { return { statusCode: code, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra || {}), body }; }
function json(code, obj) { return resp(code, JSON.stringify(obj)); }
