// veidin.js — 🎯 Veiðin: lifandi mælaborð endurheimtar-aðgerðarinnar.
// Backs veidin.html.
//
//   GET /api/veidin  →  { baseline, nuna, delta, listar:{ amber, engin_skyrsla,
//                          rukkud_an_skyrslu } }
//
// „nuna" les lifandi úr fjórum Postgres-sýnum (v_veidin_tolur · v_veidin_amber ·
// v_veidin_engin_skyrsla · v_veidin_rukkud_an_skyrslu — sjá migration
// veidin_views 2026-07-30). „baseline" er FÖST veiði-grunnlínan 2026-07-30 úr
// docs/STADREYNDIR.md §2 — framvinda veiðarinnar = nuna − baseline.
// Read-only, service role.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Veiði-grunnlínan, tekin 2026-07-30 fyrir veiðina (STAÐREYNDIR §2). FAST — ekki uppfæra.
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
    const [tolur, amber, enginSk, rukkud] = await Promise.all([
      sbGet('v_veidin_tolur?select=*'),
      sbGet('v_veidin_amber?select=*&order=taeki_skodud.desc'),
      sbGet('v_veidin_engin_skyrsla?select=*&order=felag.asc.nullslast'),
      sbGet('v_veidin_rukkud_an_skyrslu?select=*&order=felag.asc.nullslast'),
    ]);
    const t = tolur[0] || {};
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
    };
    const delta = {};
    for (const k of Object.keys(BASELINE)) {
      if (k === 'dags') continue;
      if (typeof nuna[k] === 'number') delta[k] = nuna[k] - BASELINE[k];
    }
    return json(200, { baseline: BASELINE, nuna, delta,
      listar: { amber, engin_skyrsla: enginSk, rukkud_an_skyrslu: rukkud } });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
