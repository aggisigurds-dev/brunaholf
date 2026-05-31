// timabok.js — staff time book for one worksite + month, for sending with the invoice.
//   GET /api/timabok?worksite=Fjarðagata&month=2026-02
//     → { worksite, month, rows:[{date,time_in,time_out,hours,lunch,employee}],
//         by_employee:[{employee,hours,days}], totals:{hours,lunch,net,days,entries} }
//
// Source: timavera_entries (date, time_in, time_out, hours, employee, project).
// Uses project_aliases so e.g. "NLSH 5-6. hæð" rolls up to its canonical name.
// Billable net = Σ hours − Σ lunch (hádegismatur 0.5/day), matching the Efnislisti
// dagvinna calc. Aliases are resolved both ways so the worksite name as typed in
// Vinnubók still finds Tímavera rows recorded under a variant spelling.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LUNCH_HOURS = 0.5; // hádegismatur deduction per qualifying day

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const q = event.queryStringParameters || {};
  const worksite = (q.worksite || '').trim();
  const month = (q.month || '').trim(); // YYYY-MM
  if (!worksite || !/^\d{4}-\d{2}$/.test(month)) {
    return json(400, { error: 'worksite and month=YYYY-MM required' });
  }

  const start = `${month}-01`;
  const [yr, mo] = month.split('-').map(Number);
  const endD = new Date(yr, mo, 1);
  const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-01`;

  // Resolve aliases → the set of project_name spellings that map to this worksite.
  let names = new Set([worksite]);
  try {
    const aliases = await sb('project_aliases?select=canonical_name,alias');
    const canonical = (aliases.find(a => a.alias === worksite) || {}).canonical_name || worksite;
    names.add(canonical);
    for (const a of aliases) if (a.canonical_name === canonical) names.add(a.alias);
  } catch { /* aliases optional — fall back to exact name */ }

  const inList = [...names].map(n => `"${n.replace(/"/g, '\\"')}"`).join(',');
  let rows;
  try {
    rows = await sb(`timavera_entries?select=date,time_in,time_out,hours,employee,project` +
      `&project=in.(${inList})&date=gte.${start}&date=lt.${end}` +
      `&order=date.asc,employee.asc`);
  } catch (e) { return json(502, { error: e.message }); }

  const out = [];
  const byEmp = {};
  const days = new Set();
  let totalHours = 0, totalLunch = 0;
  for (const r of rows) {
    const hours = Number(r.hours) || 0;
    if (hours <= 0) continue;
    // Lunch applies to a full-ish day (matches the export's 0.5 column on ~8h days).
    const lunch = hours >= 6 ? LUNCH_HOURS : 0;
    totalHours += hours;
    totalLunch += lunch;
    days.add(r.date);
    out.push({
      date: r.date, time_in: r.time_in || '', time_out: r.time_out || '',
      hours: Math.round(hours * 100) / 100, lunch, employee: r.employee || '',
    });
    const e = (byEmp[r.employee] = byEmp[r.employee] || { employee: r.employee || '', hours: 0, days: new Set() });
    e.hours += hours; e.days.add(r.date);
  }

  const by_employee = Object.values(byEmp)
    .map(e => ({ employee: e.employee, hours: Math.round(e.hours * 100) / 100, days: e.days.size }))
    .sort((a, b) => b.hours - a.hours);

  return json(200, {
    worksite, month,
    matched_names: [...names],
    rows: out,
    by_employee,
    totals: {
      hours: Math.round(totalHours * 100) / 100,
      lunch: Math.round(totalLunch * 100) / 100,
      net: Math.round((totalHours - totalLunch) * 100) / 100,
      days: days.size,
      entries: out.length,
    },
  });
};

async function sb(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
