// nlsh-uppgjor.js — NLSH (Landsspítalinn 5-6 hæð) monthly contract calc.
//
//   GET /api/nlsh-uppgjor?month=2026-05
//     → { month, lines:[{verk_nr, label, category_group, stakar, heilar, rate_m_vsk, amount_m_vsk}],
//         unmapped:[{category_group, stakar}],
//         totals:{ stakar, heilar, total_m_vsk } }
//
// Billing model (per the ÞG-verk contract, see CLAUDE.md):
//  - 1 "heild" = 2 "stakar"; a staka = one distinct Ajour SerialNumber.
//  - Each Ajour category_group maps to a contract verkliður with a fixed
//    price PER HEILD (m. vsk).
//  - Work is billed in the month it was FINISHED → we key on checked_date
//    (the CheckListItemCheckedDate), falling back to execution_date.
//  - amount_m_vsk = (distinct serials / 2) * rate_per_heild.
//
// NOTE: this is an ESTIMATE the user reviews/adjusts in Gerð Reikninga before
// saving — it is not auto-invoiced. It lands within a few % of the contract
// sheet; the user confirms the final number.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ajour project_name variants for NLSH.
const NLSH_NAMES = ['NLSH 5-6. hæð', 'NLSH 5-6 hæð', 'Landsspítalinn', 'Landsspitalinn'];

// Contract verkliðir (m. vsk per heild). matcher tested against category_group (case/space-insensitive).
const VERK = [
  { verk_nr: '2.1',  label: 'Ø20-34 plaströr',                rate: 7166,  test: /plast.*20-34/i },
  { verk_nr: '2.2',  label: '(35-50) plaströr m eldv. kraga', rate: 19532, test: /plast.*35-50/i },
  { verk_nr: '2.3',  label: 'Ø75-100 plaströr',               rate: 23720, test: /plast.*75-100/i },
  { verk_nr: '2.4',  label: 'Ø15-35 stálrör',                 rate: 7166,  test: /st[áa]l.*15-35/i },
  { verk_nr: '2.5',  label: 'Ø40-50 stálrör',                 rate: 7366,  test: /st[áa]l.*40-50/i },
  { verk_nr: '2.6',  label: 'Ø75-110 stálrör',                rate: 7566,  test: /st[áa]l.*75-110/i },
  { verk_nr: '2.7',  label: 'Ø110-160 stálrör',               rate: 8066,  test: /st[áa]l.*110-160/i },
  { verk_nr: '2.8',  label: 'Ø125-160 loftstokkar',           rate: 11532, test: /loft.*125-160/i },
  { verk_nr: '2.9',  label: 'Ø200-315 loftstokkar',           rate: 23064, test: /loft.*200-315/i },
  { verk_nr: '2.10', label: 'Ø400-630 loftstokkar',           rate: 46128, test: /loft.*400-630/i },
  { verk_nr: '2.11', label: 'Frágangur raufa m. stokkum (m)', rate: 11532, test: /^raufar/i },
  { verk_nr: '1.1',  label: 'Ø100-150 Gólf/Hæðarskil',        rate: 38806, test: /g[óo]lf.*100-150/i },
  { verk_nr: '1.2',  label: 'Ø160-200 Gólf/Hæðarskil',        rate: 56224, test: /g[óo]lf.*160-200/i, full: true },
  { verk_nr: '1.3',  label: 'Ø210-300 Gólf/Hæðarskil',        rate: 65116, test: /g[óo]lf.*210-300/i, full: true },
  { verk_nr: '3.1',  label: 'Rafmagnsraufar',                 rate: 9766,  test: /^raf/i },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const qs = event.queryStringParameters || {};
  const month = qs.month || new Date().toISOString().slice(0, 7);
  const onlyDone = qs.include_published !== '1';   // default: only finished/Done registrations

  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const endD = new Date(y, m, 1);
  const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-01`;

  const projFilter = `project_name=in.(${NLSH_NAMES.map(n => `"${n}"`).join(',')})`;
  // Bill by the month work was finished → checked_date; rows with no checked_date
  // fall back to execution_date so nothing is dropped.
  const dateFilter = `or=(and(checked_date.gte.${start},checked_date.lt.${end}),and(checked_date.is.null,execution_date.gte.${start},execution_date.lt.${end}))`;
  let q = `select=serial_number,category_group,registration_status&${projFilter}&${dateFilter}`;
  if (onlyDone) q += `&registration_status=eq.Done`;

  let rows;
  try { rows = await fetchAll('ajour_registrations', q); }
  catch (e) { return json(502, { error: e.message }); }

  // distinct serials per category_group (a serial repeats across ~13 checklist rows)
  const serialsByGroup = new Map();
  for (const r of rows) {
    const g = (r.category_group || '').trim();
    if (!g || !r.serial_number) continue;
    if (!serialsByGroup.has(g)) serialsByGroup.set(g, new Set());
    serialsByGroup.get(g).add(r.serial_number);
  }

  const lines = [];
  const unmapped = [];
  let totalStakar = 0, totalMvsk = 0, totalHeilar = 0;
  for (const [group, set] of serialsByGroup) {
    const stakar = set.size;
    totalStakar += stakar;
    const verk = VERK.find(v => v.test.test(group));
    if (!verk) { unmapped.push({ category_group: group, stakar }); continue; }
    // Most verkliðir: 1 heild = 2 stakar. Verk 1.2 (Ø160-200 Gólf/Hæðarskil)
    // is the exception — each staka is billed at full price (1 staka = 1 heild).
    const heilar = verk.full ? stakar : stakar / 2;
    const amount = Math.round(heilar * verk.rate);
    totalMvsk += amount;
    totalHeilar += heilar;
    lines.push({ verk_nr: verk.verk_nr, label: verk.label, category_group: group,
      stakar, heilar, rate_m_vsk: verk.rate, amount_m_vsk: amount });
  }
  lines.sort((a, b) => b.amount_m_vsk - a.amount_m_vsk);

  return json(200, {
    month,
    only_done: onlyDone,
    lines,
    unmapped,
    totals: { stakar: totalStakar, heilar: totalHeilar, total_m_vsk: totalMvsk },
    note: 'Áætlun byggð á Ajour (stakir SerialNumber / 2 × samningstaxti per heild, kláraðir í mánuðinum). Yfirfarðu og leiðréttu fyrir vistun.',
  });
};

async function fetchAll(table, qs) {
  const out = [];
  let from = 0;
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

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
