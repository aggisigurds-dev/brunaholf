// timabok.js — staff time book for one worksite + month, for sending with the invoice.
//   GET /api/timabok?worksite=Fjarðagata&month=2026-02
//     → { worksite, month, rows:[{date,time_in,time_out,hours,lunch,employee}],
//         by_employee:[{employee,hours,days}], totals:{hours,lunch,net,days,entries} }
//
// Source: timavera_entries (date, time_in, time_out, hours, employee, project).
// Uses project_aliases so e.g. "NLSH 5-6. hæð" rolls up to its canonical name.
// Billable net = Σ hours − Σ lunch. The hádegismatur (0.5 h/day) is deducted ONLY
// for Fjarðagata (a.k.a. Fjörður / Fjörðurinn / Strandgata) and only on a full
// straight 8 h workday; every other worksite (e.g. Fjallaböðin) bills gross hours.
// Aliases are resolved both ways so the worksite name as typed in Vinnubók still
// finds Tímavera rows recorded under a variant spelling.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LUNCH_HOURS = 0.5; // hádegismatur deduction per qualifying full day (Fjarðagata only)
const FULL_DAY = 8;      // gross hours that count as a full straight workday

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const q = event.queryStringParameters || {};
  const worksite = (q.worksite || '').trim();
  const month = (q.month || '').trim(); // YYYY-MM
  // Samreikningur milli mánaða (03.09.2026): from/to spanna fleiri en einn mánuð svo
  // tímaskýrslan nái yfir allt tímabilið — t.d. Skúlagata 26, 13.08.–03.09.2026.
  const from = (q.from || '').trim(), to = (q.to || '').trim();
  const isRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
  if (!worksite || (!isRange && !/^\d{4}-\d{2}$/.test(month))) {
    return json(400, { error: 'worksite and month=YYYY-MM (eða from/to=YYYY-MM-DD) required' });
  }

  let start, end;
  if (isRange) {
    start = from;
    const t = new Date(to + 'T00:00:00'); t.setDate(t.getDate() + 1);   // `end` er útilokað (lt.)
    end = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  } else {
    start = `${month}-01`;
    const [yr, mo] = month.split('-').map(Number);
    const endD = new Date(yr, mo, 1);
    end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-01`;
  }

  // Resolve aliases → the set of project_name spellings that map to this worksite.
  let names = new Set([worksite]);
  try {
    const aliases = await sb('project_aliases?select=canonical_name,alias');
    const canonical = (aliases.find(a => a.alias === worksite) || {}).canonical_name || worksite;
    names.add(canonical);
    for (const a of aliases) if (a.canonical_name === canonical) names.add(a.alias);
  } catch { /* aliases optional — fall back to exact name */ }

  // Hádegismatur is a Fjarðagata-only deduction. Fjörður / Fjörðurinn /
  // Strandgata are alias spellings, already folded into `names` above.
  const lunchApplies = [...names].some(n => n.trim().toLowerCase() === 'fjarðagata');

  const inList = [...names].map(n => `"${n.replace(/"/g, '\\"')}"`).join(',');
  let rows;
  try {
    rows = await sb(`timavera_entries?select=date,time_in,time_out,hours,employee,project` +
      `&project=in.(${inList})&date=gte.${start}&date=lt.${end}` +
      `&order=date.asc,employee.asc`);
  } catch (e) { return json(502, { error: e.message }); }

  // Per person-day gross hours — basis for both the lunch deduction and the
  // dagvinna/eftirvinna split (split shifts on the same day count as one day).
  const pd = {}; // `${employee}|${date}` → { gross, dow }
  for (const r of rows) {
    const hours = Number(r.hours) || 0;
    if (hours <= 0) continue;
    const k = `${r.employee}|${r.date}`;
    if (!pd[k]) pd[k] = { gross: 0, dow: new Date(r.date + 'T00:00:00Z').getUTCDay(), employee: r.employee || '' };
    pd[k].gross += hours;
  }

  // Lunch per qualifying person-day: only Fjarðagata, only a full 8 h day.
  const dayLunch = {}; // `${employee}|${date}` → 0 or 0.5
  let totalLunch = 0;
  for (const k in pd) {
    const lunch = (lunchApplies && pd[k].gross >= FULL_DAY) ? LUNCH_HOURS : 0;
    dayLunch[k] = lunch;
    totalLunch += lunch;
  }

  // Rows + per-employee totals. The day's single lunch is shown on its first row.
  const out = [];
  const byEmp = {};
  const days = new Set();
  const lunchShown = {};
  let totalHours = 0;
  for (const r of rows) {
    const hours = Number(r.hours) || 0;
    if (hours <= 0) continue;
    const k = `${r.employee}|${r.date}`;
    let lunch = 0;
    if (dayLunch[k] && !lunchShown[k]) { lunch = dayLunch[k]; lunchShown[k] = true; }
    totalHours += hours;
    days.add(r.date);
    out.push({
      date: r.date, time_in: r.time_in || '', time_out: r.time_out || '',
      hours: Math.round(hours * 100) / 100, lunch, employee: r.employee || '',
    });
    const e = (byEmp[r.employee] = byEmp[r.employee] || { employee: r.employee || '', hours: 0, days: new Set() });
    e.hours += hours; e.days.add(r.date);
  }

  // Dagvinna / yfirvinna split, per person per day:
  //  - Weekends (Sat/Sun): all net hours → yfirvinna.
  //  - Weekdays: gross hours over the daily threshold → yfirvinna; the rest → dagvinna.
  //    Threshold is 8,5 for Fjarðagata (the 0,5 h hádegismatur sits inside the day),
  //    8 for every other worksite (e.g. Fjallaböðin).
  const dayThreshold = lunchApplies ? 8.5 : 8;
  const r2 = n => Math.round(n * 100) / 100;
  let dagvinna = 0, yfirvinna = 0;
  const empSplit = {}; // employee → { dv, ev }
  for (const k in pd) {
    const p = pd[k];
    const net = p.gross - (dayLunch[k] || 0);
    const isWeekend = p.dow === 0 || p.dow === 6;
    const ev = isWeekend ? net : Math.max(p.gross - dayThreshold, 0);
    const dv = isWeekend ? 0 : net - ev;
    dagvinna += dv; yfirvinna += ev;
    const es = (empSplit[p.employee] = empSplit[p.employee] || { dv: 0, ev: 0 });
    es.dv += dv; es.ev += ev;
  }

  const by_employee = Object.values(byEmp)
    .map(e => {
      const s = empSplit[e.employee] || { dv: 0, ev: 0 };
      return { employee: e.employee, hours: r2(e.hours), days: e.days.size,
               hours_dagvinna: r2(s.dv), hours_yfirvinna: r2(s.ev) };
    })
    .sort((a, b) => b.hours - a.hours);

  return json(200, {
    worksite, month, period: isRange ? { from, to } : null,
    matched_names: [...names],
    rows: out,
    by_employee,
    split: {
      hours_dagvinna: r2(dagvinna),
      hours_yfirvinna: r2(yfirvinna),
      hours_eftirvinna: r2(yfirvinna), // back-compat alias for the "Fylla úr tímabók" button
      rule: lunchApplies
        ? 'yfirvinna eftir 8,5 klst/dag á mann; helgar (lau/sun) allar yfirvinna'
        : 'yfirvinna eftir 8 klst/dag á mann; helgar (lau/sun) allar yfirvinna',
    },
    totals: {
      hours: r2(totalHours),
      lunch: r2(totalLunch),
      net: r2(totalHours - totalLunch),
      dagvinna: r2(dagvinna),
      yfirvinna: r2(yfirvinna),
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
