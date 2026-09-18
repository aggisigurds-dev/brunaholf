// postsaga.js — póstsaga fyrirtækis eftir FJÓRUM lyklum + listi yfir ótengd fyrirtæki.
//   GET /api/postsaga?kt=711292-2929   → { kt, fyrirtaeki:[{id,nafn,heimilisfang,tengt}], rows:[…lyklar[]] }
//        Leitar að kennitölu með bandstriki, án bandstriks, fyrirtækjanafni og heimilisfangi
//        (allra staða á kennitölunni) í pósti eldklar@eldklar.is og bokhald@eldklar.is.
//   GET /api/postsaga?otengd=1 → fyrirtæki Í ÞJÓNUSTU án tengdrar póstsögu sem finnast samt í pósti
//        (tafla postsaga_otengd, reiknuð á nóttunni kl. 05:40 af pg_cron — keyrslan tekur ~35 sek).
//   POST /api/postsaga {action:'reikna'} → endurreikna listann núna (bakgrunnur er óþarfi; ~35 sek).
// 18.09.2026 (Agnar). Aðeins lestur á pósti; EKKERT er tengt sjálfkrafa. Persónulega hólfið er aldrei með.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' });
const tolur = (s) => String(s || '').replace(/\D/g, '');

async function sb(path, init) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...(init || {}), headers: { ...H(), ...((init && init.headers) || {}) } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (b.action !== 'reikna') return json(400, { error: 'Óþekkt action' });
      const n = await sb('rpc/postsaga_otengd_reikna', { method: 'POST', body: '{}' });
      return json(200, { ok: true, radir: n });
    }
    if (event.httpMethod !== 'GET') return json(405, { error: 'GET/POST only' });
    const p = event.queryStringParameters || {};

    if (p.otengd) {
      const rows = await sb('postsaga_otengd?select=*&order=kt_hit.desc,nafn_hit.desc,postar.desc&limit=1000');
      const ids = rows.map((r) => r.fyrirtaeki_id);
      const fyr = new Map();
      for (let i = 0; i < ids.length; i += 200) {
        const part = await sb(`fyrirtaeki?select=id,nafn,kennitala,heimilisfang,er_i_thjonustu,netfang&id=in.(${ids.slice(i, i + 200).join(',')})`);
        for (const f of part) fyr.set(f.id, f);
      }
      let out = rows.map((r) => ({ ...r, ...(fyr.get(r.fyrirtaeki_id) || {}) })).filter((r) => r.nafn);
      if (p.thjonusta === '1') out = out.filter((r) => r.er_i_thjonustu);
      return json(200, { reiknad: rows[0] ? rows[0].reiknad : null, count: out.length, rows: out });
    }

    const kt = tolur(p.kt);
    if (kt.length !== 10) return json(400, { error: 'Kennitala þarf að vera 10 tölustafir (með eða án bandstriks).' });
    if (kt === '9999999999') return json(400, { error: 'Þetta er staðgreiðslu-kennitalan — hún á enga póstsögu.' });
    const dashed = kt.slice(0, 6) + '-' + kt.slice(6);
    const [rows, fyr] = await Promise.all([
      sb('rpc/postsaga_leit', { method: 'POST', body: JSON.stringify({ p_kt: kt }) }),
      sb(`fyrirtaeki?select=id,nafn,kennitala,heimilisfang,er_i_thjonustu,netfang&deleted_at=is.null&or=(kennitala.eq.${kt},kennitala.eq.${dashed})`),
    ]);
    let tengd = [];
    if (fyr.length) tengd = await sb(`postsaga_otengd?select=fyrirtaeki_id&fyrirtaeki_id=in.(${fyr.map((f) => f.id).join(',')})`).catch(() => []);
    const otengdSet = new Set(tengd.map((t) => t.fyrirtaeki_id));
    return json(200, { kt: dashed, leitad_ad: [dashed, kt].concat(fyr.map((f) => f.nafn)).concat(fyr.map((f) => String(f.heimilisfang || '').split(',')[0].trim()).filter(Boolean)),
      fyrirtaeki: fyr.map((f) => ({ ...f, otengt_med_post: otengdSet.has(f.id) })), count: rows.length, rows });
  } catch (e) { return json(502, { error: e.message }); }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, b) { return resp(s, JSON.stringify(b), { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
