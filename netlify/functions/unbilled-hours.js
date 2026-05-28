// unbilled-hours.js — Per-worksite Tímavera hours vs estimated hours charged on invoices.
//   GET /api/unbilled-hours → { rows: [{worksite, tv_hours, invoiced_an_vsk, materials_an_vsk, rate, est_billed_hours, unbilled_hours}], summary: {...} }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Gata verkefni — billed via Ajour stakar, NOT Tímavera hours.
// Hours logged for these projects are meaningless for the unbilled-hours
// calculation (work is invoiced by per-hole-size rates × stakar count).
// Excluded from the report entirely.
const GATA_VERKEFNI = new Set([
  'Landsspitalinn',
  'Heklu reitur',
  'Dalvegur 30',
]);

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
WHERE tv.worksite NOT IN ('Landsspitalinn','Heklu reitur','Dalvegur 30')
ORDER BY (tv.hours - GREATEST(COALESCE(inv.an_vsk, 0) - COALESCE(m.mat_an_vsk, 0), 0) / COALESCE(r.dagvinna_rate, 9951)::numeric) DESC
`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  // Always use the code-aggregation path so the per-month draft logic applies.
  return await aggregateInCode();
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

  // === PRIMARY SOURCE OF TRUTH: invoice_drafts (per-month unbilled) ===
  // Each row represents (worksite, month) hours that aren't yet invoiced.
  // status in ('overdue','draft') = unbilled. 'invoiced' / 'sent' / 'skipped' = handled.
  const drafts = await fetchAll('invoice_drafts',
    'select=worksite_name,work_month,status,hours_dagvinna,total_m_vsk,rate_dagvinna');

  // Per-worksite totals from drafts
  const byWs = {};
  for (const d of drafts) {
    if (!d.worksite_name) continue;
    if (GATA_VERKEFNI.has(d.worksite_name)) continue;
    if (!['overdue','draft'].includes(d.status)) continue;
    if (!byWs[d.worksite_name]) byWs[d.worksite_name] = {
      worksite: d.worksite_name,
      tv_hours: 0,          // we'll fill from timavera totals below
      unbilled_hours: 0,
      unbilled_kr_m_vsk: 0,
      rate: 9951,
      months: [],
    };
    byWs[d.worksite_name].unbilled_hours += Number(d.hours_dagvinna || 0);
    byWs[d.worksite_name].unbilled_kr_m_vsk += Number(d.total_m_vsk || 0);
    byWs[d.worksite_name].rate = Number(d.rate_dagvinna) || byWs[d.worksite_name].rate;
    byWs[d.worksite_name].months.push(d.work_month);
  }

  // Add total Tímavera hours per worksite (for the equation top of Vinnustofa)
  const [te, aliases] = await Promise.all([
    fetchAll('timavera_entries', 'select=project,hours,date&date=gte.2025-09-01'),
    fetchAll('project_aliases', 'select=alias,canonical_name'),
  ]);
  const aliasMap = new Map(aliases.map(a => [a.alias, a.canonical_name]));
  const tvByWs = {};
  for (const e of te) {
    if (/almennt|veikindi|sick|work at home|kaffi|fundir|slökkvitæki ehf|brunahólf verkstæði/i.test(e.project || '')) continue;
    const ws = aliasMap.get(e.project) || e.project;
    if (GATA_VERKEFNI.has(ws)) continue;
    tvByWs[ws] = (tvByWs[ws] || 0) + Number(e.hours || 0);
  }

  const rows = [];
  for (const ws in tvByWs) {
    const tv = tvByWs[ws];
    const draftInfo = byWs[ws] || { unbilled_hours: 0, unbilled_kr_m_vsk: 0, rate: 9951, months: [] };
    const billed = tv - draftInfo.unbilled_hours;
    rows.push({
      worksite: ws,
      tv_hours: Math.round(tv * 10) / 10,
      rate: draftInfo.rate,
      invoiced_an_vsk: 0,             // legacy field; not meaningful in per-month mode
      materials_an_vsk: 0,             // ditto
      est_billed_hours: Math.round(Math.max(billed, 0) * 10) / 10,
      unbilled_hours: Math.round(draftInfo.unbilled_hours * 10) / 10,
      unbilled_kr_m_vsk: Math.round(draftInfo.unbilled_kr_m_vsk),
      months: draftInfo.months.sort(),
    });
  }
  // Include worksites that have drafts but no TV entries (rare — manual drafts)
  for (const ws in byWs) {
    if (!tvByWs[ws]) {
      const d = byWs[ws];
      rows.push({
        worksite: ws,
        tv_hours: 0,
        rate: d.rate,
        invoiced_an_vsk: 0,
        materials_an_vsk: 0,
        est_billed_hours: 0,
        unbilled_hours: Math.round(d.unbilled_hours * 10) / 10,
        unbilled_kr_m_vsk: Math.round(d.unbilled_kr_m_vsk),
        months: d.months.sort(),
      });
    }
  }
  rows.sort((a, b) => b.unbilled_hours - a.unbilled_hours);
  return json(200, buildPayload(rows));
}

function buildPayload(rows){
  let total_tv_hours = 0;
  let total_est_billed_hours = 0;
  let total_unbilled_hours = 0;
  let n_unbilled = 0;
  let n_overbilled = 0;
  for (const r of rows) {
    total_tv_hours += Number(r.tv_hours || 0);
    total_est_billed_hours += Number(r.est_billed_hours || 0);
    if (r.unbilled_hours > 0) { total_unbilled_hours += r.unbilled_hours; n_unbilled++; }
    else if (r.unbilled_hours < 0) n_overbilled++;
  }
  return {
    rows,
    summary: {
      total_tv_hours: Math.round(total_tv_hours * 10) / 10,
      total_est_billed_hours: Math.round(total_est_billed_hours * 10) / 10,
      net_unbilled_hours: Math.round((total_tv_hours - total_est_billed_hours) * 10) / 10,
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
