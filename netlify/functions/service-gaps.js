// service-gaps.js — „Gleymt að skrá í þjónustu": fyrirtæki sem eiga úttektarskýrslu /
// brunakerfi / þjónustusamning EN enginn lifandi staður þeirra er merktur
// `er_i_thjonustu`. Öfug hlið á Skýrslu-vaktinni (sem vaktar staði Í þjónustu).
//
//   GET  /api/service-gaps
//        → { generated_at, counts:{total, med_stad, an_stadar}, rows:[...] }
//          rows úr `v_service_gaps` (base_id, nafn, kennitala, rekstrarfelag,
//          skyrslur, samningar, nyjasta_ar, lifandi_stadir) + flokkur
//          ('med_stad' = á lifandi stað, bara vantar merkinguna | 'an_stadar').
//   POST { action:'mark-service', base_id }
//        → merkir ALLA lifandi staði base sem er_i_thjonustu=true (fljót lagfæring
//          fyrir þá sem eiga stað). Afturkræft (hægt að af-merkja í fyrirtækja-UI).
//          Skilar { ok, updated }.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') {
    let b; try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'bad json' }); }
    if (b.action !== 'mark-service') return json(400, { error: "action must be 'mark-service'" });
    const baseId = b.base_id;
    if (baseId == null) return json(400, { error: 'base_id required' });
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?customer_base_id=eq.${encodeURIComponent(baseId)}&deleted_at=is.null`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ er_i_thjonustu: true }),
      });
      if (!r.ok) return json(502, { error: 'patch: ' + r.status + ' ' + (await r.text()).slice(0, 160) });
      const updated = (await r.json().catch(() => [])).length;
      return json(200, { ok: true, updated });
    } catch (e) { return json(500, { ok: false, error: String(e.message || e) }); }
  }

  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  let all;
  try { all = await fetchAll('v_service_gaps', 'select=*'); } catch (e) { return json(502, { error: e.message }); }

  const counts = { total: all.length, med_stad: 0, an_stadar: 0 };
  for (const r of all) { if ((r.lifandi_stadir || 0) > 0) counts.med_stad++; else counts.an_stadar++; }

  const rows = all
    .map((r) => ({ ...r, flokkur: (r.lifandi_stadir || 0) > 0 ? 'med_stad' : 'an_stadar' }))
    .sort((a, b) => {
      // með-stað fyrst (fljót-lagfæranleg), svo flest skýrslur, svo nýjasta ár.
      if (a.flokkur !== b.flokkur) return a.flokkur === 'med_stad' ? -1 : 1;
      const s = (b.skyrslur || 0) - (a.skyrslur || 0); if (s) return s;
      const y = (b.nyjasta_ar || 0) - (a.nyjasta_ar || 0); if (y) return y;
      return String(a.nafn || '').localeCompare(String(b.nafn || ''), 'is');
    });

  return json(200, { generated_at: new Date().toISOString(), counts, rows });
};

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
