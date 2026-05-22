// timavera.js — Aggregated Tímavera report for the Brunahólf dashboard.
// Single endpoint that returns everything the page needs in one call so the
// "refresh" button is one fetch, not five.
//
// Query params:
//   year=2026   (default: current year)
//   weeks=12    (default: 12 weeks in the weekly trend)
//   topProjects=8  (default: 8 projects in stacked monthly chart)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET')   return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vars missing.' });

  const p = event.queryStringParameters || {};
  const year = parseInt(p.year || String(new Date().getFullYear()), 10);
  const weeksWindow = clamp(parseInt(p.weeks || '12', 10), 4, 26);
  const topN = clamp(parseInt(p.topProjects || '8', 10), 3, 20);

  try {
    const rows = await fetchAll(year);
    const meta = await fetchMeta();
    const report = build(rows, year, weeksWindow, topN, meta);
    return json(200, report);
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};

async function fetchAll(year) {
  const out = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/timavera_entries` +
      `?select=date,hours,employee,project` +
      `&date=gte.${year}-01-01&date=lte.${year}-12-31` +
      `&order=date.asc`;
    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Range': `${from}-${from + pageSize - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function fetchMeta() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/timavera_meta?id=eq.1&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr[0] || null;
  } catch { return null; }
}

function build(rows, year, weeksWindow, topN, meta) {
  // Latest date in the data — what we treat as "today"
  let latestDate = null;
  for (const r of rows) if (!latestDate || r.date > latestDate) latestDate = r.date;
  const today = latestDate;

  // Aggregates
  const byProject = new Map();          // project -> total hours
  const byProjectMonth = new Map();     // project -> { '01': h, '02': h, ... }
  const byProjectWeek = new Map();      // project -> { weekKey: h }
  const byStaff = new Map();            // staff -> { hours, days:Set }
  const todayStaff = new Map();         // staff -> hours (latest date)
  const todayProject = new Map();       // project -> hours (latest date)
  const monthsSet = new Set();
  const weeksSet = new Set();
  let total = 0;

  for (const r of rows) {
    const h = Number(r.hours) || 0;
    total += h;
    byProject.set(r.project, (byProject.get(r.project) || 0) + h);

    const d = new Date(r.date + 'T00:00:00Z');
    const mKey = String(d.getUTCMonth() + 1).padStart(2, '0');
    monthsSet.add(mKey);
    if (!byProjectMonth.has(r.project)) byProjectMonth.set(r.project, {});
    byProjectMonth.get(r.project)[mKey] = (byProjectMonth.get(r.project)[mKey] || 0) + h;

    const wKey = isoWeekKey(d);
    weeksSet.add(wKey);
    if (!byProjectWeek.has(r.project)) byProjectWeek.set(r.project, {});
    byProjectWeek.get(r.project)[wKey] = (byProjectWeek.get(r.project)[wKey] || 0) + h;

    const s = byStaff.get(r.employee) || { hours: 0, days: new Set() };
    s.hours += h;
    s.days.add(r.date);
    byStaff.set(r.employee, s);

    if (r.date === today) {
      todayStaff.set(r.employee, (todayStaff.get(r.employee) || 0) + h);
      todayProject.set(r.project, (todayProject.get(r.project) || 0) + h);
    }
  }

  // Ordered axes
  const months = [...monthsSet].sort();
  const weeksAll = [...weeksSet].sort();
  const weeks = weeksAll.slice(-weeksWindow);

  // Project totals + ranking
  const projectTotals = [...byProject.entries()]
    .map(([project, hours]) => ({
      project,
      hours: round1(hours),
      share: round1((hours / total) * 100),
    }))
    .sort((a, b) => b.hours - a.hours);

  const topProjectNames = projectTotals.slice(0, topN).map(p => p.project);

  // Monthly series for top projects + "Other"
  const monthly = {
    months,
    monthLabels: months.map(monthLabel),
    series: topProjectNames.map(project => ({
      project,
      data: months.map(m => round1(byProjectMonth.get(project)?.[m] || 0)),
    })),
    other: months.map(m => {
      let sum = 0;
      for (const [proj, mp] of byProjectMonth.entries()) {
        if (!topProjectNames.includes(proj)) sum += mp[m] || 0;
      }
      return round1(sum);
    }),
    totals: months.map(m => {
      let sum = 0;
      for (const mp of byProjectMonth.values()) sum += mp[m] || 0;
      return round1(sum);
    }),
  };

  // Weekly series for top projects
  const weekly = {
    weeks,
    weekLabels: weeks.map(weekLabel),
    series: topProjectNames.map(project => ({
      project,
      data: weeks.map(w => round1(byProjectWeek.get(project)?.[w] || 0)),
    })),
    other: weeks.map(w => {
      let sum = 0;
      for (const [proj, wp] of byProjectWeek.entries()) {
        if (!topProjectNames.includes(proj)) sum += wp[w] || 0;
      }
      return round1(sum);
    }),
    totals: weeks.map(w => {
      let sum = 0;
      for (const wp of byProjectWeek.values()) sum += wp[w] || 0;
      return round1(sum);
    }),
  };

  // Staff totals
  const staffTotals = [...byStaff.entries()]
    .map(([employee, s]) => ({
      employee,
      hours: round1(s.hours),
      days: s.days.size,
      avg: round1(s.hours / s.days.size),
    }))
    .sort((a, b) => b.hours - a.hours);

  // Today
  const todayData = {
    date: today,
    by_staff: [...todayStaff.entries()]
      .map(([employee, hours]) => ({ employee, hours: round1(hours) }))
      .sort((a, b) => b.hours - a.hours),
    by_project: [...todayProject.entries()]
      .map(([project, hours]) => ({ project, hours: round1(hours) }))
      .sort((a, b) => b.hours - a.hours),
  };

  return {
    year,
    generated_at: new Date().toISOString(),
    last_import: meta ? meta.last_import : null,
    source_file: meta ? meta.source_file : null,
    summary: {
      total_hours:       round1(total),
      active_projects:   byProject.size,
      active_staff:      byStaff.size,
      today_hours:       round1(todayData.by_staff.reduce((a, s) => a + s.hours, 0)),
      today_date:        today,
      months_count:      months.length,
    },
    today: todayData,
    monthly,
    weekly,
    staff_totals: staffTotals,
    project_totals: projectTotals,
  };
}

function isoWeekKey(d) {
  // ISO week — Monday start. Returns 'YYYY-Www'.
  const target = new Date(d.valueOf());
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 86400000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function weekLabel(key) {
  // Convert YYYY-Www to a short label like "V21" (week 21)
  const m = key.match(/W(\d+)$/);
  return m ? `V${m[1]}` : key;
}
function monthLabel(m) {
  return ['','Jan','Feb','Mar','Apr','Maí','Jún','Júl','Ágú','Sep','Okt','Nóv','Des'][parseInt(m, 10)] || m;
}
function round1(n) { return Math.round(n * 10) / 10; }
function clamp(n, lo, hi) { if (isNaN(n)) return lo; return Math.max(lo, Math.min(hi, n)); }
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
