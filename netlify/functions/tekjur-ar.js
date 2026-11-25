// tekjur-ar.js — Reikningaðar tekjur eftir ári, bæði félög (Brunahólf + Slökkvitæki).
//
// Heimildir (reikningaðar fjárhæðir, ekki ársreikningur):
//   • Brunahólf: `invoices` source='payday' (án landsbankinn_krafnir-spegilsins).
//       m.vsk = sum(upphaed_total); án vsk = sum(hofudstoll) — raun-nettó (24% staðfest).
//       Payday-sagan er stopul fyrir 2024 (fá/kreditþung ár) → merkt `ofullkomid`.
//   • Slökkvitæki fyrir skiptidag (SWITCH) : `stolpi_reikningar` (Stólpi, fyrir yfirtöku).
//       m.vsk = sum(upphaed) m.t.t. kredit-raða (neikvæðar). Engin geymd án-vsk tala
//       → án vsk = m.vsk / 1,24 (ÁÆTLAÐ, merkt `an_vsk_aaetlad`).
//   • Slökkvitæki frá SWITCH: `solur` (nýja kerfið). m.vsk = sum(samtals); án vsk =
//       sum(upphaed_an_vsk); kredit/falið ekki talið.
//   SWITCH = fyrsti dagur í `solur` (2026-05-04) svo Stólpi og solur skarist ekki.
//
// GET /api/tekjur-ar  → JSON (service role, read-only).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VSK = 1.24;

function sbHeaders() { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }; }
async function sbAll(table, qs) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { ...sbHeaders(), Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
    if (from > 80000) break;
  }
  return out;
}
const yrOf = (s) => (s ? Number(String(s).slice(0, 4)) : null);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const warnings = [];
  let invoices = [], stolpi = [], solur = [];
  try { invoices = await sbAll('invoices', "select=utgafudagur,upphaed_total,hofudstoll,source&source=eq.payday"); }
  catch (e) { warnings.push('invoices (Brunahólf Payday) lestur mistókst: ' + e.message); }
  try { stolpi = await sbAll('stolpi_reikningar', 'select=dags,upphaed,tegund'); }
  catch (e) { warnings.push('stolpi_reikningar (Slökkvitæki Stólpi) lestur mistókst: ' + e.message); }
  try { solur = await sbAll('solur', 'select=created_at,samtals,upphaed_an_vsk,is_credit,hidden'); }
  catch (e) { warnings.push('solur (Slökkvitæki) lestur mistókst: ' + e.message); }

  // Skiptidagur Stólpi→solur = fyrsti dagur í solur (annars myndi 2026 skarast).
  const solurDates = solur.filter(s => !s.is_credit && s.created_at).map(s => String(s.created_at).slice(0, 10)).sort();
  const SWITCH = solurDates[0] || '2026-05-04';

  const years = {};
  const Y = (ar) => (years[ar] || (years[ar] = {
    bru_mvsk: 0, bru_anvsk: 0, bru_n: 0,
    stolpi_mvsk: 0, stolpi_n: 0,        // Stólpi: aðeins m.vsk til (kredit-raðir neikvæðar)
    solur_mvsk: 0, solur_anvsk: 0, solur_n: 0,
  }));

  // Brunahólf (Payday)
  for (const r of invoices) {
    const ar = yrOf(r.utgafudagur); if (!ar) continue;
    const y = Y(ar);
    y.bru_mvsk += Number(r.upphaed_total) || 0;
    y.bru_anvsk += Number(r.hofudstoll) || 0;
    y.bru_n += 1;
  }
  // Slökkvitæki — Stólpi (fyrir SWITCH). upphaed inniheldur kredit-raðir (neikvæðar).
  for (const r of stolpi) {
    const d = r.dags ? String(r.dags).slice(0, 10) : null;
    if (!d || d >= SWITCH) continue;
    const ar = yrOf(d); if (!ar) continue;
    const y = Y(ar);
    y.stolpi_mvsk += Number(r.upphaed) || 0;
    if (r.tegund !== 'kredit') y.stolpi_n += 1;
  }
  // Slökkvitæki — solur (frá SWITCH). Raun-nettó til.
  for (const r of solur) {
    if (r.is_credit || r.hidden || !r.created_at) continue;
    const d = String(r.created_at).slice(0, 10);
    if (d < SWITCH) continue;
    const ar = yrOf(d); if (!ar) continue;
    const y = Y(ar);
    y.solur_mvsk += Number(r.samtals) || 0;
    y.solur_anvsk += Number(r.upphaed_an_vsk) || 0;
    y.solur_n += 1;
  }

  // Lokaframsetning per ár
  const out = Object.keys(years).map(Number).sort((a, b) => b - a).map((ar) => {
    const y = years[ar];
    const bru = {
      m_vsk: Math.round(y.bru_mvsk), an_vsk: Math.round(y.bru_anvsk), n: y.bru_n,
      ofullkomid: y.bru_n > 0 && y.bru_n < 20,  // stopul Payday-saga fyrir 2024
    };
    // Slökkvitæki: Stólpi-hlutinn (án-vsk ÁÆTLAÐ ÷1,24) + solur-hlutinn (raun án-vsk).
    const slokkMvsk = Math.round(y.stolpi_mvsk + y.solur_mvsk);
    const slokkAnVsk = Math.round(y.stolpi_mvsk / VSK + y.solur_anvsk);
    const slokk = {
      m_vsk: slokkMvsk, an_vsk: slokkAnVsk, n: y.stolpi_n + y.solur_n,
      an_vsk_aaetlad: y.stolpi_mvsk !== 0,   // satt ef Stólpi-hluti er með (áætlað nettó)
    };
    return {
      ar, bru, slokk,
      samtals: { m_vsk: bru.m_vsk + slokk.m_vsk, an_vsk: bru.an_vsk + slokk.an_vsk },
    };
  });

  const nuAr = new Date().getUTCFullYear();
  return json(200, {
    generated_at: new Date().toISOString(),
    switch_date: SWITCH,
    current_year: nuAr,
    years: out,
    skyring: 'Reikningaðar fjárhæðir (útgefnir reikningar/sölur), ekki ársreikningur. Brunahólf=Payday (hofudstoll=raun án vsk); Slökkvitæki fyrir ' + SWITCH + '=Stólpi (án vsk ÁÆTLAÐ ÷1,24), frá þeim degi=solur (raun án vsk). ' + nuAr + ' er líðandi ár (hálft). Fyrir 2026 voru félögin aðskilin.',
    warnings,
  });
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }

// ── Vörður (Powerplan lota 13, 17.11.2026): innskráning (hub_user) eða tóki — sjá _vord.js ──
{ const _V = require('./_vord'); exports._innra = exports.handler; exports.handler = _V.vafinn(exports.handler, { fall: 'tekjur-ar' }); }
