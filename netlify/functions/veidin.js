// veidin.js — 🎯 Veiðin: lifandi mælaborð endurheimtar-aðgerðarinnar.
// Backs veidin.html + hunt-kortin á jarvis.html.
//
//   GET /api/veidin  →  { baseline, nuna, delta, listar:{ amber, engin_skyrsla,
//                          rukkud_an_skyrslu, bundle_gloppur,
//                          systkini_kt, blob_graen, hud_buid_gloppa,
//                          drive_tvitok, skjol_an_ars } }
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  try {
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
