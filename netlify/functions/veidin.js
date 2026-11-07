// veidin.js — 🎯 Veiðin: lifandi mælaborð endurheimtar-aðgerðarinnar.
// Backs veidin.html + hunt-kortin á jarvis.html.
//
//   GET /api/veidin  →  { baseline, nuna, delta, listar:{ amber, engin_skyrsla,
//                          rukkud_an_skyrslu, bundle_gloppur,
//                          systkini_kt, blob_graen, hud_buid_gloppa,
//                          drive_tvitok, skjol_an_ars } }        ~113 KB
//   GET /api/veidin?tolur=1 → { baseline, nuna, delta, tolur:true }  ~1,3 KB
//     Talningin er reiknuð Í SQL (count=exact + HEAD), engar raðir sóttar.
//     Notað af Jarvis og hubbinum, sem sýna FJÖLDA en aldrei listana sjálfa.
//
// „nuna" les lifandi úr v_veidin_tolur · amber · engin_skyrsla · rukkud +
// hunt-sýnunum (sql/2026-08-31_v_veidin_hunt.sql). „baseline" er FÖST
// veiði-grunnlínan 2026-07-30 — staða um mánuði síðan, EKKI dagsins tala.
// Hunt-tölur eiga ENGA grunnlínu (nýtt skotmark). Read-only, service role.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Veiði-grunnlínan, tekin 2026-07-30 fyrir veiðina (STAÐREYNDIR §2).
// FAST — staða um mánuði síðan. Aldrei færa dags yfir á í dag; ný kort bætast við, grunnlínan stendur.
const BASELINE = {
  dags: '2026-07-30',
  stadir_i_thjonustu: 655,
  felog_i_thjonustu: 601,
  stadir_med_2026_skyrslu: 243,
  stadir_med_2025_skyrslu: 274,
  engin_skyrsla_25_26: 250,
  amber_felog: 28,
  rukkud_an_skyrslu: 45,          // þjónustustaðir með 2026-reikning en enga 2026-skýrslu
  stadir_med_samning: 144,
  felog_med_netfang: 409,
  skjol_an_ars: 336,
  skyrslur_2026: 294,
  skyrslur_2026_reviewed: 14,
  gleymd_felog: 56,
  // 📦 Bundle-pör (skýrsla + reikningur per ári) — grunnlína tekin 2026-07-31 við
  // stofnun skotmarksins úr v_bundle_coverage (yr=2026). Reglan sjálf-matchar áfram
  // eftir því sem skýrslur (customer_documents) og reikningar (solur.source) verða til.
  bundle_por: 69,               // 2026 pör KLÁRUÐ (skýrsla + app-reikningur bæði til)
  bundle_reikn_vantar: 153,     // 2026 skýrslur með ENGAN reikning (hvorki app né Payday)
  bundle_skyrsla_vantar: 7,     // 2026 app-reikningar með enga skýrslu á skrá
};

function cors(){ return { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,OPTIONS' }; }
function json(code, body){ return { statusCode:code, headers:Object.assign({'Content-Type':'application/json'},cors()), body:JSON.stringify(body) }; }
function sbHeaders(extra){ return Object.assign({ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }, extra||{}); }
async function sbGet(path){
  const out=[];
  for(let from=0;;from+=1000){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{ headers:sbHeaders({ Range:`${from}-${from+999}` }) });
    if(!r.ok) throw new Error('sbGet '+r.status+' '+(await r.text()).slice(0,140));
    const rows=await r.json().catch(()=>[]); out.push(...rows);
    if(rows.length<1000) break;
  }
  return out;
}

// Talning REIKNUÐ Í SQL — `Prefer: count=exact` + HEAD skilar aðeins hausnum
// („Content-Range: */213"), engum röðum. Þetta er munurinn á 34 KB og 0 bætum
// fyrir sömu töluna. Skilar null ef sýnin er ekki til, svo kallandinn geti
// fallið aftur á eldri leið í stað þess að birta 0 sem staðreynd.
async function sbCount(path){
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method:'HEAD', headers: sbHeaders({ Prefer:'count=exact' }),
    });
    if(!r.ok) return null;
    const n = parseInt(String(r.headers.get('content-range')||'').split('/')[1], 10);
    return Number.isFinite(n) ? n : null;
  }catch(_){ return null; }
}

// 💰 PENINGASÝNIRNAR (07.11.2026). Rannsóknarlotur fundu um 1,5 m.kr. sem lá úti og 133 staði
// sem bíða skoðunar. Sú leit var handvirk; mælingarnar eru nú sýnir sem endurreiknast og hanga
// hér, á sama stað og veiðin sem fyrir er — Agnar á ekki að þurfa að greina sama hlutinn tvisvar.
// Hver sýn ber `comment on view` með sínum gildrum (select obj_description('<sýn>'::regclass)).
// EKKERT þeirra hefur grunnlínu: ný skotmörk, og talan sjálf er markmiðið (niður í núll).
const PENINGASYNIR = [
  ['krafa_ekki_send',     'v_krafa_ekki_send'],       // reikningur til, krafan aldrei send
  ['kredit_an_endurgerdar','v_kredit_an_endurgerdar'],// kreditfært og aldrei endurgert
  ['verk_an_reiknings',   'v_verk_an_reiknings'],     // skýrsla til, enginn reikningur
  ['skodun_gleymd',       'v_skodun_gleymd'],         // lifandi tæki, skoðun gleymd
  ['taekjatolur_misraemi','v_taekjatolur_misraemi'],  // skýrsla og tækjaskrá stangast á
  ['skeytamidlun_vantar', 'v_skeytamidlun_vantar'],   // ógreitt og tóm skeytamiðlun
  ['erindi_osvarad',      'v_erindi_osvarad'],        // SÍA, ekki fundur — sjá comment
];
async function peningaTolur(){
  const out = {};
  await Promise.all(PENINGASYNIR.map(async ([lykill, syn]) => {
    out[lykill] = await sbCount(syn + '?select=*');   // null ef sýnin er ekki til
  }));
  return out;
}

// Aðeins tölurnar — enginn listi. Jarvis og hubburinn sýna FJÖLDA (spjöld,
// þrýstimæla, skotmörk); þeir lásu samt öll 113 KB af röðum til að fá þær.
// 09.09.2026: 95 KB af því voru fjórir listar sem Jarvis snertir aldrei
// (amber, engin_skyrsla, rukkud_an_skyrslu, bundle_gloppur). Fullur listi
// tilheyrir veidin.html — síðunni sem notandinn opnar sjálfur.
async function tolurHamur(){
  const curYear = new Date().getFullYear();
  // ⚠️ ALLTAF `select=*` í talningunni. `select=<dálkur>` skilar 400 ef dálkurinn
  //    heitir öðru nafni í sýninni (v_veidin_amber á `nafn`, ekki `felag`) — og
  //    sbCount kyngir því sem null. HEAD sækir engar raðir hvort eð er, svo `*`
  //    kostar ekkert og getur ekki brotnað á dálkanafni.
  const bundleN = (stada) => sbCount('v_bundle_coverage?yr=eq.' + curYear + '&stada=eq.' + stada + '&select=*');
  const [tolur, huntRows, amberN, enginSkN, rukkudN, porN, reiknN, skyrslaN,
         systkiniN, blobN, hudN, driveN] = await Promise.all([
    sbGet('v_veidin_tolur?select=*'),
    sbGet('v_veidin_hunt_tolur?select=*').catch(() => []),
    sbCount('v_veidin_amber?select=*'),
    sbCount('v_veidin_engin_skyrsla?select=*'),
    sbCount('v_veidin_rukkud_an_skyrslu?select=*'),
    bundleN('klarad'), bundleN('vantar_reikning'), bundleN('vantar_skyrslu'),
    sbCount('v_veidin_systkini_kt?select=*'),
    sbCount('v_veidin_blob_graen?select=*'),
    sbCount('v_veidin_hud_buid_gloppa?select=*'),
    sbCount('v_veidin_drive_tvitok?select=*'),
  ]);
  // 💰 Peningasýnirnar (07.11.2026) — mælingar úr rannsóknarlotunum sem fundu um 1,5 m.kr.
  // Þær eru EINANGRAÐAR: `Promise.all` að ofan má ekki brotna þótt sýn vanti, og sbCount
  // skilar null í stað þess að birta 0 sem staðreynd. Engin grunnlína — nýtt skotmark.
  const pen = await peningaTolur();
  const t = tolur[0] || {};
  const hunt = huntRows[0] || {};
  const nuna = {
    dags: new Date().toISOString().slice(0, 10),
    stadir_i_thjonustu: t.stadir_i_thjonustu,
    felog_i_thjonustu: t.felog_i_thjonustu,
    stadir_med_2026_skyrslu: t.stadir_med_2026_skyrslu,
    stadir_med_2025_skyrslu: t.stadir_med_2025_skyrslu,
    engin_skyrsla_25_26: enginSkN,
    amber_felog: amberN,
    rukkud_an_skyrslu: rukkudN,
    stadir_med_samning: t.stadir_med_samning,
    felog_med_netfang: t.felog_med_netfang,
    skjol_an_ars: t.skjol_an_ars,
    skyrslur_2026: t.skyrslur_2026,
    skyrslur_2026_reviewed: t.skyrslur_2026_reviewed,
    gleymd_felog: t.gleymd_felog,
    bundle_por: porN,
    bundle_reikn_vantar: reiknN,
    bundle_skyrsla_vantar: skyrslaN,
    systkini_kt: hunt.systkini_kt != null ? hunt.systkini_kt : systkiniN,
    blob_graen_an_skyrslu: hunt.blob_graen_an_skyrslu != null ? hunt.blob_graen_an_skyrslu : blobN,
    hud_buid_2026: hunt.hud_buid_2026,
    hud_buid_vs_skyrsla: hunt.hud_buid_vs_skyrsla != null ? hunt.hud_buid_vs_skyrsla : hudN,
    drive_2026_radir: hunt.drive_2026_radir,
    drive_2026_distinct: hunt.drive_2026_distinct,
    drive_tvitok: hunt.drive_tvitok != null ? hunt.drive_tvitok : driveN,
    ...pen,
  };
  const delta = {};
  for (const k of Object.keys(BASELINE)) {
    if (k === 'dags') continue;
    if (typeof nuna[k] === 'number') delta[k] = nuna[k] - BASELINE[k];
  }
  return json(200, { baseline: BASELINE, nuna, delta, tolur: true });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  try {
    if ((event.queryStringParameters || {}).tolur) return await tolurHamur();
    const curYear = new Date().getFullYear();
    const [tolur, amber, enginSk, rukkud, bundle] = await Promise.all([
      sbGet('v_veidin_tolur?select=*'),
      sbGet('v_veidin_amber?select=*&order=taeki_skodud.desc'),
      sbGet('v_veidin_engin_skyrsla?select=*&order=felag.asc.nullslast'),
      sbGet('v_veidin_rukkud_an_skyrslu?select=*&order=felag.asc.nullslast'),
      sbGet('v_bundle_coverage?yr=eq.' + curYear + '&select=*'),
    ]);
    const t = tolur[0] || {};
    // Hunt-listar: einangrað svo gamla veiðin brotni ekki ef sýn vantar.
    let hunt = {};
    let systkini = [], blobGraen = [], hudGloppa = [], driveTv = [], skjolAnArs = [];
    try {
      const [huntRows, sy, bl, hg, dt, sa] = await Promise.all([
        sbGet('v_veidin_hunt_tolur?select=*'),
        sbGet('v_veidin_systkini_kt?select=*&order=kennitala.asc,nafn.asc'),
        sbGet('v_veidin_blob_graen?select=*&order=nafn.asc'),
        sbGet('v_veidin_hud_buid_gloppa?select=*&order=nafn.asc'),
        sbGet('v_veidin_drive_tvitok?select=*&order=felag.asc.nullslast'),
        sbGet('v_veidin_skjol_an_ars?select=*&order=doc_id.asc'),
      ]);
      hunt = huntRows[0] || {};
      systkini = sy; blobGraen = bl; hudGloppa = hg; driveTv = dt; skjolAnArs = sa;
    } catch (_) { /* hunt er viðbót — eldri lyklar standa */ }
    // 💰 Peningasýnirnar (07.11.2026) — sérkall svo þær brotni ekki með hunt-blokkinni að ofan.
    const peningar = await peningaTolur();
    // 📦 Bundle-pör þessa árs — sjá v_bundle_coverage. „gloppur" = ókláruð pör
    // (vantar reikning fyrst, svo vantar skýrslu, svo billed-via-Payday).
    const gOrder = { vantar_reikning: 0, vantar_skyrslu: 1, reikn_payday: 2 };
    const bundleGloppur = bundle.filter(b => b.stada !== 'klarad')
      .sort((a, b) => (gOrder[a.stada] - gOrder[b.stada])
        || String(a.felag || '').localeCompare(String(b.felag || ''), 'is'));
    const nuna = {
      dags: new Date().toISOString().slice(0, 10),
      stadir_i_thjonustu: t.stadir_i_thjonustu,
      felog_i_thjonustu: t.felog_i_thjonustu,
      stadir_med_2026_skyrslu: t.stadir_med_2026_skyrslu,
      stadir_med_2025_skyrslu: t.stadir_med_2025_skyrslu,
      engin_skyrsla_25_26: enginSk.length,
      amber_felog: amber.length,
      rukkud_an_skyrslu: rukkud.length,
      stadir_med_samning: t.stadir_med_samning,
      felog_med_netfang: t.felog_med_netfang,
      skjol_an_ars: t.skjol_an_ars,
      skyrslur_2026: t.skyrslur_2026,
      skyrslur_2026_reviewed: t.skyrslur_2026_reviewed,
      gleymd_felog: t.gleymd_felog,
      bundle_por: bundle.filter(b => b.stada === 'klarad').length,
      bundle_reikn_vantar: bundle.filter(b => b.stada === 'vantar_reikning').length,
      bundle_skyrsla_vantar: bundle.filter(b => b.stada === 'vantar_skyrslu').length,
      systkini_kt: hunt.systkini_kt != null ? hunt.systkini_kt : systkini.length,
      blob_graen_an_skyrslu: hunt.blob_graen_an_skyrslu != null ? hunt.blob_graen_an_skyrslu : blobGraen.length,
      hud_buid_2026: hunt.hud_buid_2026,
      hud_buid_vs_skyrsla: hunt.hud_buid_vs_skyrsla != null ? hunt.hud_buid_vs_skyrsla : hudGloppa.length,
      drive_2026_radir: hunt.drive_2026_radir,
      drive_2026_distinct: hunt.drive_2026_distinct,
      drive_tvitok: hunt.drive_tvitok != null ? hunt.drive_tvitok : driveTv.length,
      ...peningar,
    };
    const delta = {};
    for (const k of Object.keys(BASELINE)) {
      if (k === 'dags') continue;
      if (typeof nuna[k] === 'number') delta[k] = nuna[k] - BASELINE[k];
    }
    return json(200, { baseline: BASELINE, nuna, delta,
      listar: {
        amber, engin_skyrsla: enginSk, rukkud_an_skyrslu: rukkud, bundle_gloppur: bundleGloppur,
        systkini_kt: systkini, blob_graen: blobGraen, hud_buid_gloppa: hudGloppa,
        drive_tvitok: driveTv, skjol_an_ars: skjolAnArs,
      } });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
