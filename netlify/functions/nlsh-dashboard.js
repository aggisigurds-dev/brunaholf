// nlsh-dashboard.js — NLSH (Landsspítalinn 5-6 hæð) dashboard data.
//
//   GET /api/nlsh-dashboard
//     → { totals, byMonth[], byWeek[], byStaff[], byVerk[], note }
//
// Combines two sources for the dedicated NLSH page:
//   1. ajour_registrations (project_name='NLSH 5-6. hæð') — fire-stop holes.
//      • revenue: 1 heild = 2 stakar (distinct SerialNumber); amount per heild
//        = contract rate (m. vsk) for the verkliður the category_group maps to.
//      • holes are attributed PER STAFF via the `category` field, which Ajour
//        stores as "Starfsmaður N" (N = the company staff number).
//      • billed/counted in the month+week the work was FINISHED → checked_date
//        (fallback execution_date).
//   2. timavera_entries (project ~ Landsspítalinn) — work hours per staff.
//      The Tímavera `employee` first-name is mapped to the staff number so
//      hours line up with the per-staff holes.
//
// All figures are ESTIMATES off Ajour/Tímavera for management overview — the
// invoice number is still confirmed in Gerð Reikninga.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NLSH_AJOUR = 'NLSH 5-6. hæð';
const NLSH_TIMAVERA = ['Landsspitalinn', 'Landsspítalinn', 'NLSH 5-6. hæð', 'NLSH 5-6 hæð'];

// Contract verkliðir: rate per heild (m. vsk) + target Fjöldi (budgeted stakar).
const VERK = [
  { verk_nr: '2.1',  label: 'Ø20-34 plaströr',                rate: 7166,  target: 600,  test: /plast.*20-34/i },
  { verk_nr: '2.2',  label: '(35-50) plaströr m eldv. kraga', rate: 19532, target: 600,  test: /plast.*35-50/i },
  { verk_nr: '2.3',  label: 'Ø75-100 plaströr',               rate: 23720, target: 100,  test: /plast.*75-100/i },
  { verk_nr: '2.4',  label: 'Ø15-35 stálrör',                 rate: 7166,  target: 800,  test: /st[áa]l.*15-35/i },
  { verk_nr: '2.5',  label: 'Ø40-50 stálrör',                 rate: 7366,  target: 1100, test: /st[áa]l.*40-50/i },
  { verk_nr: '2.6',  label: 'Ø75-110 stálrör',                rate: 7566,  target: 350,  test: /st[áa]l.*75-110/i },
  { verk_nr: '2.7',  label: 'Ø110-160 stálrör',               rate: 8066,  target: 100,  test: /st[áa]l.*110-160/i },
  { verk_nr: '2.8',  label: 'Ø125-160 loftstokkar',           rate: 11532, target: 600,  test: /loft.*125-160/i },
  { verk_nr: '2.9',  label: 'Ø200-315 loftstokkar',           rate: 23064, target: 600,  test: /loft.*200-315/i },
  { verk_nr: '2.10', label: 'Ø400-630 loftstokkar',           rate: 46128, target: 109,  test: /loft.*400-630/i },
  { verk_nr: '2.11', label: 'Frágangur raufa m. stokkum (m)', rate: 11532, target: 102,  test: /^raufar/i },
  { verk_nr: '1.1',  label: 'Ø100-150 Gólf/Hæðarskil',        rate: 38806, target: 50,   test: /g[óo]lf.*100-150/i },
  { verk_nr: '1.2',  label: 'Ø160-200 Gólf/Hæðarskil',        rate: 56224, target: 100,  test: /g[óo]lf.*160-200/i, full: true },
  { verk_nr: '1.3',  label: 'Ø210-300 Gólf/Hæðarskil',        rate: 65116, target: 25,   test: /g[óo]lf.*210-300/i, full: true },
  { verk_nr: '3.1',  label: 'Rafmagnsraufar',                 rate: 9766,  target: 768,  test: /^raf/i },
];

// Staff number → display name. Tímavera first-name(s) → number for joining hours.
const STAFF = {
  1:  { name: 'Lukasz Pawel Wojcik',        tv: ['lukasz'] },
  3:  { name: 'Lena Huld Sigurðardóttir',   tv: ['lena'] },
  4:  { name: 'Stefán Máni Hjartarson',     tv: ['stebbi', 'stefán', 'stefan'] },
  5:  { name: 'Michal Mucus',               tv: ['michal'] },
  6:  { name: 'Agnar Sigurðsson',           tv: ['agnar'] },
  7:  { name: 'Leon Augustus Baptiste',     tv: ['leon'] },
  8:  { name: 'Elí Ólsen Valgarðsson',      tv: ['elí ó', 'eli o'] },
  9:  { name: 'Tryggvi Steinar Smárason',   tv: ['tryggvi'] },
  11: { name: 'Marcin Surowik',             tv: ['marcin surowik', 'marcin s'] },
  12: { name: 'Amro Qash',                  tv: ['amro'] },
  13: { name: 'Atli Már Heiðarsson',        tv: ['atli'] },
  14: { name: 'Carlos J. A. Guevara M.',    tv: ['carlos'] },
  15: { name: 'George Kasozi',              tv: ['george'] },
  16: { name: 'Elías Karl Elíasson',        tv: ['elías', 'elias'] },
  17: { name: 'Panagiotis Drolapas',        tv: ['panagiotis', 'panos'] },
  18: { name: 'Óðinn Elíasson',             tv: ['óðinn', 'odinn'] },
  19: { name: 'Sindri Ivan Kjartansson',    tv: ['sindri'] },
  20: { name: 'Hamza Ali ehmed',            tv: ['hamza'] },
  21: { name: 'Patryk B. Paszkowski',       tv: ['patrik b', 'patryk', 'patrik'] },
  22: { name: 'Alfred Amoah',               tv: ['alfred'] },
  23: { name: 'Nouraldin Attaallah',        tv: ['nour'] },
  24: { name: 'Prosper Kojo Akoensi',       tv: ['prosper'] },
  25: { name: 'Naji B. A. Asar',            tv: ['asar', 'naji'] },
  26: { name: 'Jón G. Jónsson',             tv: ['jón g', 'jon g'] },
  27: { name: 'Marcin Kołtoński',           tv: ['marcin k', 'marcin kol'] },
  28: { name: 'Vareika Andrius',            tv: ['andrius', 'vareika'] },
  29: { name: 'Hamdja Kamara',              tv: ['kamara', 'hamdja'] },
  30: { name: 'Marius',                     tv: ['marius'] },
  31: { name: 'Hákon Baldvinsson',          tv: ['hákon', 'hakon'] },
};
function nrForEmployee(emp) {
  const e = String(emp || '').trim().toLowerCase();
  if (!e) return null;
  for (const [nr, s] of Object.entries(STAFF)) {
    if (s.tv.some(t => e === t || e.startsWith(t + ' ') || e.startsWith(t))) return +nr;
  }
  return null;
}
function nrFromCategory(cat) {
  const m = String(cat || '').match(/(\d+)/);
  return m ? +m[1] : null;
}

// ISO week key, e.g. 2026-W07, + a sortable monday date.
function isoWeek(d) {
  const dt = new Date(d + 'T00:00:00Z');
  const day = (dt.getUTCDay() + 6) % 7;           // Mon=0
  dt.setUTCDate(dt.getUTCDate() - day + 3);        // Thursday of this week
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const qs = event.queryStringParameters || {};
  const onlyDone = qs.include_open !== '1'; // default: only finished (Done) holes

  let ajour, hours;
  try {
    let q = `select=serial_number,category_group,category,checked_date,execution_date,registration_status&project_name=eq.${encodeURIComponent(NLSH_AJOUR)}`;
    if (onlyDone) q += `&registration_status=eq.Done`;
    ajour = await fetchAll('ajour_registrations', q);
    const tvIn = NLSH_TIMAVERA.map(n => `"${n}"`).join(',');
    hours = await fetchAll('timavera_entries', `select=date,hours,employee,project&project=in.(${tvIn})`);
  } catch (e) { return json(502, { error: e.message }); }

  // ---- holes: dedupe by serial (a serial may appear on multiple checklist rows) ----
  // keep, per serial, its category_group + staff nr + effective date.
  const serialInfo = new Map();
  for (const r of ajour) {
    const sn = r.serial_number; if (!sn) continue;
    // Contract tracks by when the hole was MADE (execution date) — checked_date
    // bulk-clusters on QA days (e.g. a March re-check), which misattributes the
    // month. Prefer execution_date; fall back to checked_date only if missing.
    const eff = r.execution_date || r.checked_date || null;
    const prev = serialInfo.get(sn);
    if (!prev) serialInfo.set(sn, { group: r.category_group || '', nr: nrFromCategory(r.category), date: eff });
    else { if (!prev.date && eff) prev.date = eff; if (prev.nr == null) prev.nr = nrFromCategory(r.category); }
  }

  const verkOf = (group) => VERK.find(v => v.test.test(group || ''));
  const monthOf = (d) => (d ? String(d).slice(0, 7) : null);

  // ---- byVerk (cumulative contract status) ----
  const verkAgg = new Map(); // verk_nr -> stakar
  let unmappedStakar = 0;
  for (const { group } of serialInfo.values()) {
    const v = verkOf(group);
    if (!v) { unmappedStakar++; continue; }
    verkAgg.set(v.verk_nr, (verkAgg.get(v.verk_nr) || 0) + 1);
  }
  const byVerk = VERK.map(v => {
    const stakar = verkAgg.get(v.verk_nr) || 0;
    const heilar = v.full ? stakar : stakar / 2;
    return { verk_nr: v.verk_nr, label: v.label, target: v.target, stakar, heilar,
      rate_m_vsk: v.rate, amount_m_vsk: Math.round(heilar * v.rate),
      pct: v.target ? Math.round(stakar / v.target * 100) : null };
  });
  const totalRevenue = byVerk.reduce((a, x) => a + x.amount_m_vsk, 0);
  const totalHeilar = byVerk.reduce((a, x) => a + x.heilar, 0);
  const totalHoles = serialInfo.size;

  // ---- amount for a single serial (its share of revenue) ----
  function serialAmount(group) {
    const v = verkOf(group); if (!v) return 0;
    return (v.full ? 1 : 0.5) * v.rate; // 1 staka = (full?1:0.5) heild × rate
  }

  // ---- byMonth (holes + revenue + hours) ----
  const months = {}; // ym -> { holes, revenue }
  for (const { group, date } of serialInfo.values()) {
    const ym = monthOf(date); if (!ym) continue;
    (months[ym] || (months[ym] = { holes: 0, revenue: 0 }));
    months[ym].holes++; months[ym].revenue += serialAmount(group);
  }
  const hoursByMonth = {}, hoursByWeek = {}, hoursByNr = {};
  for (const h of hours) {
    const hrs = +h.hours || 0; if (!hrs || !h.date) continue;
    const ym = monthOf(h.date);
    hoursByMonth[ym] = (hoursByMonth[ym] || 0) + hrs;
    const wk = isoWeek(h.date); hoursByWeek[wk] = (hoursByWeek[wk] || 0) + hrs;
    const nr = nrForEmployee(h.employee);
    if (nr) hoursByNr[nr] = (hoursByNr[nr] || 0) + hrs;
  }
  let cum = 0;
  const byMonth = Object.keys(months).sort().map(ym => {
    const rev = Math.round(months[ym].revenue); cum += rev;
    return { month: ym, holes: months[ym].holes, revenue_m_vsk: rev,
      cum_revenue_m_vsk: cum, hours: Math.round((hoursByMonth[ym] || 0) * 10) / 10 };
  });

  // ---- byWeek (holes + revenue + hours, cumulative) ----
  const weeks = {};
  for (const { group, date } of serialInfo.values()) {
    if (!date) continue; const wk = isoWeek(date);
    (weeks[wk] || (weeks[wk] = { holes: 0, revenue: 0 }));
    weeks[wk].holes++; weeks[wk].revenue += serialAmount(group);
  }
  const allWeeks = [...new Set([...Object.keys(weeks), ...Object.keys(hoursByWeek)])].sort();
  let cumH = 0, cumR = 0;
  const byWeek = allWeeks.map(wk => {
    const w = weeks[wk] || { holes: 0, revenue: 0 };
    const rev = Math.round(w.revenue);
    cumH += w.holes; cumR += rev;
    return { week: wk, holes: w.holes, cum_holes: cumH, revenue_m_vsk: rev,
      cum_revenue_m_vsk: cumR, hours: Math.round((hoursByWeek[wk] || 0) * 10) / 10 };
  });

  // ---- byStaff (holes from Ajour category + hours from Tímavera) ----
  const holesByNr = {};
  for (const { nr } of serialInfo.values()) if (nr) holesByNr[nr] = (holesByNr[nr] || 0) + 1;
  const staffNrs = [...new Set([...Object.keys(holesByNr), ...Object.keys(hoursByNr)].map(Number))];
  const byStaff = staffNrs.map(nr => {
    const holes = holesByNr[nr] || 0;
    const hrs = Math.round((hoursByNr[nr] || 0) * 10) / 10;
    return { nr, name: (STAFF[nr] && STAFF[nr].name) || ('Starfsmaður ' + nr),
      holes, hours: hrs, holes_per_hour: hrs ? Math.round(holes / hrs * 100) / 100 : null };
  }).sort((a, b) => b.holes - a.holes);

  // ---- byStaffWeek (holes + hours per staff per ISO week) — feeds the
  // weekly performance matrix (frontend windows it to the chosen months).
  const staffWeek = {}; // nr -> wk -> {holes, hours}
  const swCell = (nr, wk) => {
    const a = staffWeek[nr] || (staffWeek[nr] = {});
    return a[wk] || (a[wk] = { holes: 0, hours: 0 });
  };
  for (const { nr, date } of serialInfo.values()) {
    if (!nr || !date) continue;
    swCell(nr, isoWeek(date)).holes++;
  }
  for (const h of hours) {
    const hrs = +h.hours || 0; if (!hrs || !h.date) continue;
    const nr = nrForEmployee(h.employee); if (!nr) continue;
    swCell(nr, isoWeek(h.date)).hours += hrs;
  }
  const byStaffWeek = [];
  for (const [nr, wks] of Object.entries(staffWeek)) {
    for (const [wk, v] of Object.entries(wks)) {
      byStaffWeek.push({ nr: +nr, week: wk, holes: v.holes, hours: Math.round(v.hours * 10) / 10 });
    }
  }

  // ---- byStaffDay (holes + hours per staff per calendar day) — drill-down ----
  const staffDay = {}; // nr -> 'YYYY-MM-DD' -> {holes, hours}
  const sdCell = (nr, day) => {
    const a = staffDay[nr] || (staffDay[nr] = {});
    return a[day] || (a[day] = { holes: 0, hours: 0 });
  };
  for (const { nr, date } of serialInfo.values()) {
    if (!nr || !date) continue;
    sdCell(nr, String(date).slice(0, 10)).holes++;
  }
  for (const h of hours) {
    const hrs = +h.hours || 0; if (!hrs || !h.date) continue;
    const nr = nrForEmployee(h.employee); if (!nr) continue;
    sdCell(nr, String(h.date).slice(0, 10)).hours += hrs;
  }
  const byStaffDay = [];
  for (const [nr, days] of Object.entries(staffDay)) {
    for (const [day, v] of Object.entries(days)) {
      byStaffDay.push({ nr: +nr, date: day, holes: v.holes, hours: Math.round(v.hours * 10) / 10 });
    }
  }

  const totalHours = Math.round(Object.values(hoursByNr).reduce((a, b) => a + b, 0) +
    // include hours whose employee didn't map to a staff nr, so the total is honest
    hours.reduce((a, h) => a + ((+h.hours || 0) && !nrForEmployee(h.employee) ? (+h.hours || 0) : 0), 0));

  return json(200, {
    only_done: onlyDone,
    totals: {
      holes: totalHoles, heilar: totalHeilar, revenue_m_vsk: totalRevenue,
      hours: totalHours, holes_per_hour: totalHours ? Math.round(totalHoles / totalHours * 100) / 100 : null,
      unmapped_stakar: unmappedStakar,
    },
    byMonth, byWeek, byStaff, byStaffWeek, byStaffDay, byVerk,
    note: 'Áætlun byggð á Ajour (stakir SerialNumber, kláraðir) + Tímavera. Göt á starfsmann koma úr Ajour „category“ = Starfsmaður N.',
  });
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
