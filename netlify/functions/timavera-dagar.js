// timavera-dagar.js — mætingar- og verkstaða-yfirlit síðustu daga úr Tímaveru.
//   GET /api/timavera-dagar?days=N   (default 8, max 31)
//     → { generated_at, days_back, days:[{ date, total_hours, staff:[
//           { employee, in, out, hours, projects:[{project, hours, in, out}] }
//         ]}] }
//
// Source: timavera_entries (date, time_in, time_out, hours, employee, project) —
// sama tafla og /api/timabok. Per starfsmaður per dag: mætti = fyrsta time_in,
// hætti = síðasta time_out, klst = summa, verkstaðir = allar project-línur
// dagsins (hver með eigin inn/út/klst). HH:MM strengir raðast rétt sem strengir.
// NB ólíkt timavera-maeting.js (dagurinn-í-dag úr Mæting-sheetinu) les þetta
// SÖGULEGU færslurnar beint úr gagnagrunninum.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });

  const q = event.queryStringParameters || {};
  const days = Math.min(31, Math.max(1, parseInt(q.days, 10) || 8));
  const floor = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

  let rows;
  try {
    rows = await fetchAll('timavera_entries',
      `select=date,time_in,time_out,hours,employee,project&date=gte.${floor}&order=date.desc`);
  } catch (e) { return json(502, { error: e.message }); }

  const hhmm = (s) => { const m = String(s || '').match(/\d{1,2}:\d{2}/); return m ? m[0].padStart(5, '0') : ''; };
  const r2 = (n) => Math.round(n * 100) / 100;

  // date → employee → { in, out, hours, projects: project → {hours,in,out} }
  const byDate = new Map();
  for (const r of rows) {
    const d = String(r.date || '').slice(0, 10); if (!d) continue;
    const emp = String(r.employee || '').trim() || '—';
    const hrs = Number(r.hours) || 0;
    const tin = hhmm(r.time_in), tout = hhmm(r.time_out);
    let dd = byDate.get(d); if (!dd) byDate.set(d, dd = new Map());
    let e = dd.get(emp.toLowerCase());
    if (!e) dd.set(emp.toLowerCase(), e = { employee: emp, in: '', out: '', hours: 0, projects: new Map() });
    e.hours += hrs;
    if (tin && (!e.in || tin < e.in)) e.in = tin;
    if (tout && (!e.out || tout > e.out)) e.out = tout;
    const pn = String(r.project || '').trim() || '—';
    let p = e.projects.get(pn.toLowerCase());
    if (!p) e.projects.set(pn.toLowerCase(), p = { project: pn, hours: 0, in: '', out: '' });
    p.hours += hrs;
    if (tin && (!p.in || tin < p.in)) p.in = tin;
    if (tout && (!p.out || tout > p.out)) p.out = tout;
  }

  const out = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dd]) => {
      const staff = [...dd.values()]
        .map((e) => ({ employee: e.employee, in: e.in, out: e.out, hours: r2(e.hours),
          projects: [...e.projects.values()].map((p) => ({ project: p.project, hours: r2(p.hours), in: p.in, out: p.out }))
            .sort((a, b) => b.hours - a.hours) }))
        .sort((a, b) => ((a.in || '99') < (b.in || '99') ? -1 : 1));   // fyrstir mættu efst
      return { date, total_hours: r2(staff.reduce((s, e) => s + e.hours, 0)), staff };
    });

  // Ferskleiki (2026-07-09, verkefnalisti c9fbea70): „sækir ekki nýjustu" var í
  // raun GÖMUL útflutningsskrá (t.d. „1 til 6 Jul") — samstillingin keyrði en
  // gögnin ná bara að skrá-lokum. Skila nýjustu dagsetningu + skráarheiti svo
  // síðan geti sagt það hreint út í stað þess að þegja.
  let newest_entry = null, source_file = null, last_import = null;
  try {
    const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const [nr, mr] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/timavera_entries?select=date&order=date.desc&limit=1`, { headers: hdrs }),
      fetch(`${SUPABASE_URL}/rest/v1/timavera_meta?select=last_import,source_file&order=last_import.desc&limit=1`, { headers: hdrs }),
    ]);
    const [n0] = nr.ok ? await nr.json() : [];
    const [m0] = mr.ok ? await mr.json() : [];
    newest_entry = (n0 && n0.date) || null;
    source_file = (m0 && m0.source_file) || null;
    last_import = (m0 && m0.last_import) || null;
  } catch (_) {}

  return json(200, { generated_at: new Date().toISOString(), days_back: days, newest_entry, source_file, last_import, days: out });
};

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
