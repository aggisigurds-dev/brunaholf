// gata-uppgjor.js — per-month invoice calc for generic-Verðskrá Gata verkefni
//   (Dalvegur 30 / Heklureitur — NOT NLSH which has its own contract).
//
// GET /api/gata-uppgjor?worksite=Dalvegur+30&month=2026-05
//   → { worksite, month, holes:[{size_label, stakar, rate_an_vsk, an_vsk, m_vsk}],
//       totals:{ holes_an_vsk, holes_m_vsk, bands_m_vsk_manual, total_m_vsk } }
//
// Uses Ajour `category_group` (format "Gat Ø NNN-NNN") joined to `hole_size_rates`
// (scope='generic'). Bönd/Kragar are NOT in Ajour for these worksites — they are
// entered manually on the per-month Excel sheet, so this endpoint returns them as
// optional override (`bands_m_vsk` query param) and otherwise omits them.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Which Ajour project_name strings map to which worksite.
// Dalvegur 30 in our reporting = several Ajour projects (the building is split in Ajour).
const WORKSITE_AJOUR_NAMES = {
  'Dalvegur 30':  ['Dalvegur 18B','Dalvegur 26','Dalvegur 30A'],
  'Heklureitur':  ['Heklureitur','Heklu reitur'],
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const qs = event.queryStringParameters || {};
  const worksite = qs.worksite || 'Dalvegur 30';
  const month = qs.month || new Date().toISOString().slice(0,7);  // YYYY-MM
  const bandsOverride = qs.bands_m_vsk ? Number(qs.bands_m_vsk) : null;

  // Tolerant lookup so "Heklureitur" / "Heklu reitur" / different casing all resolve.
  let ajourNames = WORKSITE_AJOUR_NAMES[worksite];
  if (!ajourNames) {
    const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
    const key = Object.keys(WORKSITE_AJOUR_NAMES).find((k) => norm(k) === norm(worksite));
    if (key) ajourNames = WORKSITE_AJOUR_NAMES[key];
  }
  if (!ajourNames) return json(400, { error: `Unknown worksite "${worksite}". Supported: ${Object.keys(WORKSITE_AJOUR_NAMES).join(', ')}` });

  const monthStart = `${month}-01`;
  const [year, mm] = month.split('-').map(Number);
  const monthEndDate = new Date(year, mm, 1);
  const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth()+1).padStart(2,'0')}-01`;

  // Fetch Ajour rows + rate table in parallel
  const fetchAll = async (table, qs) => {
    const out = [];
    let from = 0;
    while (true) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
                   Range: `${from}-${from+999}`, 'Range-Unit': 'items' },
      });
      if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0,200)}`);
      const page = await r.json();
      out.push(...page);
      if (page.length < 1000) break;
      from += 1000;
    }
    return out;
  };

  const ajourFilter = `project_name=in.(${ajourNames.map(n => `"${n}"`).join(',')})`;
  const [ajour, rates, bandRates] = await Promise.all([
    fetchAll('ajour_registrations',
      `select=category_group&${ajourFilter}&execution_date=gte.${monthStart}&execution_date=lt.${monthEnd}&category_group=ilike.Gat*`),
    fetchAll('hole_size_rates', `select=size_min_mm,size_max_mm,size_label,rate_an_vsk&scope=eq.generic&category=eq.hole`),
    fetchAll('hole_size_rates', `select=category,size_min_mm,size_label,rate_an_vsk&scope=eq.generic&category=in.(kragi,bordi)&order=category.asc,size_min_mm.asc`),
  ]);

  // Build size → rate lookup
  const rateBySize = new Map();
  for (const r of rates) rateBySize.set(`${r.size_min_mm}-${r.size_max_mm}`, r);

  // Count stakar per category_group, then map to hole-size bucket via regex
  const groupCounts = {};
  for (const row of ajour) {
    const g = row.category_group || '';
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  }

  const holes = [];
  let holes_an_vsk = 0;
  const unmapped = [];
  for (const [group, stakar] of Object.entries(groupCounts)) {
    const m = group.match(/(\d{3,4})-(\d{3,4})/);
    if (!m) { unmapped.push({ group, stakar }); continue; }
    const key = `${parseInt(m[1],10)}-${parseInt(m[2],10)}`;
    const rate = rateBySize.get(key);
    if (!rate) { unmapped.push({ group, stakar, parsed_size: key }); continue; }
    const an_vsk = stakar * Number(rate.rate_an_vsk);
    holes_an_vsk += an_vsk;
    holes.push({
      group,
      size_label: rate.size_label,
      stakar,
      rate_an_vsk: Number(rate.rate_an_vsk),
      an_vsk,
      m_vsk: Math.round(an_vsk * 1.24),
    });
  }
  holes.sort((a,b) => b.an_vsk - a.an_vsk);

  const holes_m_vsk = Math.round(holes_an_vsk * 1.24);
  const bands_m_vsk = bandsOverride != null ? bandsOverride : 0;
  const total_m_vsk = holes_m_vsk + bands_m_vsk;

  // Bönd/Kragar rate tables (kragi = Eldvarnarkragi, bordi = Eldvarnar borði/band).
  // Quantities are entered manually in the form (not in Ajour); these are the
  // unit prices the form multiplies against the entered magn.
  const kragar = bandRates.filter(r => r.category === 'kragi')
    .map(r => ({ size_label: r.size_label, size_mm: r.size_min_mm, rate_an_vsk: Number(r.rate_an_vsk) }));
  const bordar = bandRates.filter(r => r.category === 'bordi')
    .map(r => ({ size_label: r.size_label, size_mm: r.size_min_mm, rate_an_vsk: Number(r.rate_an_vsk) }));

  return json(200, {
    worksite,
    month,
    ajour_projects: ajourNames,
    holes,
    unmapped,
    band_rates: { kragi: kragar, bordi: bordar },
    totals: {
      holes_an_vsk,
      holes_m_vsk,
      bands_m_vsk,
      bands_source: bandsOverride != null ? 'override' : 'not_provided',
      total_m_vsk,
    },
    note: 'Bönd/Kragar are not in Ajour for these worksites — quantities are entered manually in the form against band_rates. Pass ?bands_m_vsk=NNN to include a manual total.',
  });
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
