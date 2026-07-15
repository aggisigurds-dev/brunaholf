// skyrslu-vakt.js — Skýrslu-vakt: staðir án gildrar úttektarskýrslu.
//
//   GET /api/skyrslu-vakt
//     → { generated_at, counts: {engin_skyrsla, olesanleg, gomul, ok}, rows: [...] }
//
// Les Postgres-sýnina `v_stadir_skyrslu_stada` (ein röð per lifandi stað í
// þjónustu): base_id, felag, kennitala, site_id, site_nafn, heimilisfang,
// sites_i_felagi, report_year, inspect_month, parse_ok, total_devices, stada.
// stada ∈ ('engin_skyrsla','olesanleg','gomul','ok').
//
// rows = allar EKKI-ok raðir, raðaðar: engin_skyrsla → olesanleg → gomul;
// innan hvers flokks rekstrarfélög (sites_i_felagi > 1) FYRST — stærstu
// kúnnarnir — svo eftir félags-nafni.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ORDER = { engin_skyrsla: 0, olesanleg: 1, gomul: 2 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  let all;
  try {
    all = await fetchAll('v_stadir_skyrslu_stada', 'select=*');
  } catch (e) { return json(502, { error: e.message }); }

  const counts = { engin_skyrsla: 0, olesanleg: 0, gomul: 0, ok: 0 };
  for (const r of all) if (counts[r.stada] != null) counts[r.stada]++;

  const rows = all
    .filter((r) => r.stada !== 'ok')
    .sort((a, b) => {
      const s = (ORDER[a.stada] ?? 9) - (ORDER[b.stada] ?? 9);
      if (s) return s;
      const ma = (a.sites_i_felagi || 0) > 1 ? 0 : 1;
      const mb = (b.sites_i_felagi || 0) > 1 ? 0 : 1;
      if (ma !== mb) return ma - mb;
      return String(a.felag || '').localeCompare(String(b.felag || ''), 'is');
    });

  return json(200, { generated_at: new Date().toISOString(), counts, rows });
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
