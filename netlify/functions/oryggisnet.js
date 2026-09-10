// oryggisnet.js — staða öryggisnetsins (tools/audit-*.cjs í slokkvitaeki).
//
//   GET /api/oryggisnet            → nýjasta staða hvers varðar + samantekt
//   GET /api/oryggisnet?saga=1     → auk þess síðustu 20 keyrslur (tímalína)
//   GET /api/oryggisnet?audit=X    → saga EINS varðar (40 síðustu)
//
// Af hverju (09.09.2026): 33 verðir voru skrifaðir yfir marga mánuði og enginn
// þeirra keyrði sjálfkrafa — hvorki í CI, git-hook né npm-skripti. Þess vegna
// komu sömu villurnar aftur. Nú keyra þeir við hverja ýtingu og skrifa í
// `oryggisnet_keyrslur`; þetta fall gerir Jarvis kleift að sýna það.
//
// Hver röð ber `skilabod` frá verðinum sjálfum. Þau innihalda oft skráarvísun
// (t.d. "js/pos.js:1477") — framendinn breytir þeim í tengil á GitHub svo hægt
// sé að fara beint í kóðann sem á að laga.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const q = event.queryStringParameters || {};

  const get = async (path) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return null;
    return r.json();
  };

  // Saga eins varðar — notað þegar smellt er á hann í Jarvis.
  if (q.audit) {
    const saga = await get(
      `oryggisnet_keyrslur?select=timi,stada,skilabod,ms,uppruni,commit_sha,vel` +
      `&audit=eq.${encodeURIComponent(q.audit)}&order=timi.desc&limit=40`
    );
    return json(200, { audit: q.audit, saga: saga || [] });
  }

  const stada = await get('v_oryggisnet_stada?select=*&order=stada.asc,audit.asc');
  if (!stada) return json(502, { error: 'Náði ekki í oryggisnet_keyrslur' });

  // ÞAGGAÐIR VERÐIR (10.09.2026). Sjö verðir voru „grænir" aðeins af því slæma
  // talan var fryst sem grunnlína — t.d. „40 blank sales (<= baseline 40)". Á
  // Jarvis litu þeir nákvæmlega eins út og heilir verðir og fengu aðeins nafnið
  // sitt í „Í lagi"-línunni. Múlbundinn hundur sem sést sem heill er fölsk
  // staðreynd — nákvæmlega það sem Agnar kvartaði yfir.
  // oryggisnet_keyrslur á engan grunnlínu-dálk; talan býr aðeins í skilaboðatexta
  // varðarins og er því lesin þaðan: „baseline N" eða „grunnlína N". Grunnlína 0
  // er heilbrigð („BASELINE 0", „<= baseline 0") og telst EKKI þögguð.
  // Takmörk: aðeins síðasta lína varðarins er vistuð í skilabod, svo vörður sem
  // prentar grunnlínuna ofar (t.d. audit-t-s-i) greinist ekki hér.
  const lesaGrunnlinu = (s) => {
    const texti = String(s || '');
    const re = /(?:baseline|grunnl[ií]na)\s*:?\s*(\d+)/gi;
    let m, mest = 0;
    while ((m = re.exec(texti)) !== null) mest = Math.max(mest, Number(m[1]));
    return mest;
  };

  const talning = { graent: 0, rautt: 0, villa: 0, thaggadir: 0 };
  for (const v of stada) {
    if (talning[v.stada] != null) talning[v.stada]++;
    if (v.stada === 'graent' && lesaGrunnlinu(v.skilabod) > 0) talning.thaggadir++;
  }

  // Síðasta keyrsla: hvenær, hvaðan, og hversu gömul hún er. Gömul keyrsla er
  // sjálfstæð aðvörun — net sem keyrir ekki er jafn gagnslaust og ekkert net.
  const nyjast = stada.reduce((a, v) => (!a || v.timi > a ? v.timi : a), null);
  const aldurMin = nyjast ? Math.floor((Date.now() - new Date(nyjast).getTime()) / 60000) : null;

  const svar = {
    talning,
    alls: stada.length,
    heldur: talning.rautt === 0 && talning.villa === 0,
    sidasta_keyrsla: nyjast,
    aldur_min: aldurMin,
    // Yfir sólarhrings gömul keyrsla telst stöðnuð: netið er þá ekki að verja neitt.
    stodnad: aldurMin != null && aldurMin > 1440,
    verdir: stada.map((v) => ({
      audit: v.audit,
      nafn: v.audit.replace(/^audit-/, '').replace(/\.cjs$/, ''),
      stada: v.stada,
      skilabod: v.skilabod,
      // Grunnlína lesin úr skilaboðunum (sjá lesaGrunnlinu). > 0 á grænum verði = þaggaður.
      grunnlina: lesaGrunnlinu(v.skilabod),
      thaggadur: v.stada === 'graent' && lesaGrunnlinu(v.skilabod) > 0,
      ms: v.ms,
      timi: v.timi,
      uppruni: v.uppruni,
      commit_sha: v.commit_sha,
    })),
    fetched_at: new Date().toISOString(),
  };

  if (q.saga) {
    const keyrslur = await get(
      'oryggisnet_keyrslur?select=keyrsla_id,timi,stada,uppruni,commit_sha&order=timi.desc&limit=400'
    );
    const eftirKeyrslu = new Map();
    for (const r of keyrslur || []) {
      let k = eftirKeyrslu.get(r.keyrsla_id);
      if (!k) {
        k = { keyrsla_id: r.keyrsla_id, timi: r.timi, uppruni: r.uppruni,
              commit_sha: r.commit_sha, graent: 0, rautt: 0, villa: 0 };
        eftirKeyrslu.set(r.keyrsla_id, k);
      }
      if (k[r.stada] != null) k[r.stada]++;
      if (r.timi > k.timi) k.timi = r.timi;
    }
    svar.saga = [...eftirKeyrslu.values()].sort((a, b) => (a.timi < b.timi ? 1 : -1)).slice(0, 20);
  }

  return json(200, svar);
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
