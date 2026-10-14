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
//   GET  /api/drog-timar?dry=1   → áætlunin, ekkert vistað
//   GET  /api/drog-timar         → keyrir (sama og POST)
//   POST /api/drog-timar         → keyrir
// Áætlunin situr á drog-timar-background (netlify.toml, 10 mín eftir timavera-pull) — ALDREI hér (403 á HTTP).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const timabok = require('./timabok');

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
  const net = net0 - disc;
  const vsk = Math.round(net * vskPct / 100);
  return { dvH, evH, sma, net, vsk, total: net + vsk, matSum };
}

async function keyra(opts) {
  const dry = !!(opts && opts.dry);
  const manudir = manudirSemStanda();
  const inMan = manudir.map(encodeURIComponent).join(',');
  const drog = await sbGet(`invoice_drafts?select=*&work_month=in.(${inMan})&status=in.(draft,overdue)&payday_invoice_id=is.null&order=work_month.desc,worksite_name.asc`);
  const pgRows = await sbGet('pricing_guide?select=*').catch(() => []);
  const PG = {}; for (const p of pgRows) PG[p.worksite_name] = p;
  const ut = { manudir, skodud: drog.length, uppfaerd: 0, obreytt: 0, sleppt: 0, villur: 0, linur: [], dry };
  for (const d of drog) {
    const lina = { id: d.id, ws: d.worksite_name, m: d.work_month };
    try {
      let astaeda = null;
      if (String(d.source || '') !== 'timavera') astaeda = 'ekki Tímaveru-drag (' + d.source + ')';
      else if (Number(d.fixed_total) > 0) astaeda = 'fast verð';
      else if (d.merged_into || (Array.isArray(d.merged_from) && d.merged_from.length)) astaeda = 'samreiknað';
      else if (/🔒\s*t[ií]mar/i.test(String(d.notes || ''))) astaeda = '🔒tímar í notes';
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
      const dvH = r2(Number(sp.hours_dagvinna) || 0), evH = r2(Number(sp.hours_eftirvinna) || 0);
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
  const q = event.queryStringParameters || {};
  try { return json(200, await keyra({ dry: q.dry === '1' || q.dry === 'true' })); }
  catch (e) { return json(500, { error: String(e.message || e) }); }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
