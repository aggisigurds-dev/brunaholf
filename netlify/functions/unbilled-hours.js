// unbilled-hours.js — Per-worksite Tímavera hours vs estimated hours charged on invoices.
//   GET /api/unbilled-hours → { rows: [{worksite, tv_hours, invoiced_an_vsk, materials_an_vsk, rate, est_billed_hours, unbilled_hours}], summary: {...} }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SQL = `
WITH tv AS (
  SELECT COALESCE(pa.canonical_name, te.project) AS worksite,
         SUM(te.hours) AS hours
  FROM timavera_entries te
  LEFT JOIN project_aliases pa ON pa.alias = te.project
  WHERE te.date >= '2025-09-01'
    AND te.project !~* 'almennt|veikindi|sick|work at home|kaffi|fundir|slökkvitæki ehf|brunahólf verkstæði'
  GROUP BY 1
  HAVING SUM(te.hours) > 5
),
per_tilvisun AS (
  SELECT worksite_match,
         REGEXP_REPLACE(COALESCE(tilvisun,''), '\\.0$', '') AS tnum,
         MAX(CASE WHEN source = 'payday' THEN hofudstoll END)              AS payday_an,
         MAX(CASE WHEN source = 'landsbankinn_krafnir' THEN hofudstoll END) AS krafa_m
  FROM invoices
  WHERE worksite_match IS NOT NULL AND worksite_match <> ''
  GROUP BY worksite_match, tnum
),
inv AS (
  SELECT worksite_match AS worksite,
         SUM(COALESCE(payday_an, krafa_m / 1.24))::numeric AS an_vsk
  FROM per_tilvisun
  GROUP BY worksite_match
),
materials AS (
  SELECT worksite_match AS worksite,
         SUM(COALESCE(recharge_amount, m_vsk)) / 1.24 AS mat_an_vsk
  FROM redder_invoices WHERE worksite_match IS NOT NULL
  GROUP BY worksite_match
),
rates AS (
  SELECT DISTINCT worksite_name AS worksite, dagvinna_rate
  FROM pricing_guide WHERE dagvinna_rate IS NOT NULL
)
SELECT
  tv.worksite,
  ROUND(tv.hours::numeric, 1)                    AS tv_hours,
  COALESCE(r.dagvinna_rate, 9951)                AS rate,
  ROUND(COALESCE(inv.an_vsk, 0))::bigint         AS invoiced_an_vsk,
  ROUND(COALESCE(m.mat_an_vsk, 0))::bigint       AS materials_an_vsk,
  ROUND(GREATEST(COALESCE(inv.an_vsk, 0) - COALESCE(m.mat_an_vsk, 0), 0) / COALESCE(r.dagvinna_rate, 9951)::numeric, 1) AS est_billed_hours,
  ROUND(tv.hours - GREATEST(COALESCE(inv.an_vsk, 0) - COALESCE(m.mat_an_vsk, 0), 0) / COALESCE(r.dagvinna_rate, 9951)::numeric, 1) AS unbilled_hours
FROM tv
LEFT JOIN inv      ON inv.worksite = tv.worksite
LEFT JOIN materials m ON m.worksite = tv.worksite
LEFT JOIN rates r    ON r.worksite = tv.worksite
ORDER BY (tv.hours - GREATEST(COALESCE(inv.an_vsk, 0) - COALESCE(m.mat_an_vsk, 0), 0) / COALESCE(r.dagvinna_rate, 9951)::numeric) DESC
`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  }).catch(() => null);

  // exec_sql RPC may not exist — fall back to PostgREST function via raw SQL through a view
  // For maximum portability, run via the standard rest endpoint if we have a view; otherwise
  // we mirror the logic in pure REST by aggregating from existing tables in code.
  if (!r || !r.ok) {
    // Fallback: aggregate in code
    return await aggregateInCode();
  }
  const rows = await r.json();
  return json(200, buildPayload(rows));
};

async function aggregateInCode(){
  const fetchAll = async (table, qs = '') => {
    const out = [];
    let from = 0;
    while (true) {
      const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
      const r = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${from + 999}`,
          'Range-Unit': 'items',
        },
      });
      if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0,200)}`);
      const page = await r.json();
      out.push(...page);
      if (page.length < 1000) break;
      from += 1000;
    }
    return out;
  };

  const [te, aliases, invoices, redder, pricing] = await Promise.all([
    fetchAll('timavera_entries', 'select=project,hours,date&date=gte.2025-09-01'),
    fetchAll('project_aliases', 'select=alias,canonical_name'),
    fetchAll('invoices', 'select=worksite_match,tilvisun,source,hofudstoll'),
    fetchAll('redder_invoices', 'select=worksite_match,m_vsk,recharge_amount'),
    fetchAll('pricing_guide', 'select=worksite_name,dagvinna_rate'),
  ]);

  const aliasMap = new Map(aliases.map(a => [a.alias, a.canonical_name]));
  const rateMap  = new Map(pricing.filter(p => p.dagvinna_rate != null).map(p => [p.worksite_name, Number(p.dagvinna_rate)]));

  const tvByWorksite = {};
  for (const e of te) {
    if (/almennt|veikindi|sick|work at home|kaffi|fundir|slökkvitæki ehf|brunahólf verkstæði/i.test(e.project || '')) continue;
    const ws = aliasMap.get(e.project) || e.project;
    tvByWorksite[ws] = (tvByWorksite[ws] || 0) + Number(e.hours || 0);
  }

  // dedupe invoices by (worksite, tilvisun-no-trailing-.0)
  const dedup = {};
  for (const i of invoices) {
    if (!i.worksite_match) continue;
    const tnum = String(i.tilvisun || '').replace(/\.0$/, '');
    const k = `${i.worksite_match}|${tnum}`;
    if (!dedup[k]) dedup[k] = { worksite: i.worksite_match };
    if (i.source === 'payday') dedup[k].payday_an = Number(i.hofudstoll || 0);
    else if (i.source === 'landsbankinn_krafnir') dedup[k].krafa_m = Number(i.hofudstoll || 0);
  }
  const invByWorksite = {};
  for (const k in dedup) {
    const x = dedup[k];
    const an = x.payday_an != null ? x.payday_an : (x.krafa_m ? x.krafa_m / 1.24 : 0);
    invByWorksite[x.worksite] = (invByWorksite[x.worksite] || 0) + an;
  }

  const matByWorksite = {};
  for (const m of redder) {
    if (!m.worksite_match) continue;
    const an = (Number(m.recharge_amount != null ? m.recharge_amount : m.m_vsk) || 0) / 1.24;
    matByWorksite[m.worksite_match] = (matByWorksite[m.worksite_match] || 0) + an;
  }

  const rows = [];
  for (const ws in tvByWorksite) {
    const hours = tvByWorksite[ws];
    if (hours <= 5) continue;
    const rate = rateMap.get(ws) || 9951;
    const inv  = invByWorksite[ws] || 0;
    const mat  = matByWorksite[ws] || 0;
    const billable = Math.max(inv - mat, 0);
    const est_billed = billable / rate;
    rows.push({
      worksite: ws,
      tv_hours: Math.round(hours * 10) / 10,
      rate,
      invoiced_an_vsk: Math.round(inv),
      materials_an_vsk: Math.round(mat),
      est_billed_hours: Math.round(est_billed * 10) / 10,
      unbilled_hours:  Math.round((hours - est_billed) * 10) / 10,
    });
  }
  rows.sort((a, b) => b.unbilled_hours - a.unbilled_hours);
  return json(200, buildPayload(rows));
}

function buildPayload(rows){
  let total_unbilled_hours = 0;
  let n_unbilled = 0;
  let n_overbilled = 0;
  for (const r of rows) {
    if (r.unbilled_hours > 0) { total_unbilled_hours += r.unbilled_hours; n_unbilled++; }
    else if (r.unbilled_hours < 0) n_overbilled++;
  }
  return {
    rows,
    summary: {
      total_unbilled_hours: Math.round(total_unbilled_hours * 10) / 10,
      n_unbilled_worksites: n_unbilled,
      n_overbilled_worksites: n_overbilled,
      // rough kr estimate at default rate (excludes per-worksite overrides; UI can recompute)
      estimated_unbilled_kr_an_vsk: Math.round(total_unbilled_hours * 9951),
    },
  };
}

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
