// service-gaps.js — „Gleymt að skrá í þjónustu": tvær gloppur í þjónustu-skráningu.
// Öfug hlið á Skýrslu-vaktinni (sem vaktar staði Í þjónustu). LES LIFANDI (engin
// skyndiminni) svo listinn sé áreiðanlegur á meðan verið er að endurlesa/tengja.
//
//   GET /api/service-gaps
//     → { generated_at, counts, rows, unlinked }
//       rows      = FLOKKUR A: base á skrá, á þjónustu-skjöl, EN enginn lifandi
//                   staður merktur er_i_thjonustu (úr v_service_gaps). flokkur
//                   'med_stad' (bara vantar merkinguna) | 'an_stadar'.
//       unlinked  = FLOKKUR B: þjónustu-skjöl (uttektarskyrsla/brunakerfi/samningur)
//                   sem eru EKKI tengd við neinn base (kt ekki á skrá / ótengt) —
//                   svo ekkert falli á milli. {id, doc_type, year, customer_name,
//                   drive_file_id}.
//   GET /api/service-gaps?base=ID        (drill-down til að SANNREYNA eina röð)
//     → { base_id, docs:[...], sites:[...] }  (nákvæmlega hvaða skjöl + staðir)
//   POST { action:'mark-service', base_id }
//     → merkir ALLA lifandi staði base er_i_thjonustu=true. Afturkræft. { ok, updated }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SVC_DOCS = "('uttektarskyrsla','brunakerfi','samningur')";

// Opnanlegur tengill á skjal: Drive-view ef drive_file_id, annars Supabase public URL
// (storage_path byrjar á bucket-nafni, t.d. „samningar/…"; samningar-bucket er public).
function openUrl(d) {
  if (d.drive_file_id) return 'https://drive.google.com/file/d/' + d.drive_file_id + '/view';
  if (d.storage_path) return SUPABASE_URL + '/storage/v1/object/public/' + d.storage_path;
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') {
    let b; try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'bad json' }); }
    if (b.action !== 'mark-service') return json(400, { error: "action must be 'mark-service'" });
    if (b.base_id == null) return json(400, { error: 'base_id required' });
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?customer_base_id=eq.${encodeURIComponent(b.base_id)}&deleted_at=is.null`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ er_i_thjonustu: true }),
      });
      if (!r.ok) return json(502, { error: 'patch: ' + r.status + ' ' + (await r.text()).slice(0, 160) });
      return json(200, { ok: true, updated: (await r.json().catch(() => [])).length });
    } catch (e) { return json(500, { ok: false, error: String(e.message || e) }); }
  }

  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const p = event.queryStringParameters || {};

  // Drill-down: nákvæmlega hvaða skjöl + staðir liggja að baki einni röð (sannreyning).
  if (p.base) {
    try {
      const bid = encodeURIComponent(p.base);
      const [docsRaw, sites] = await Promise.all([
        fetchAll('customer_documents', `customer_base_id=eq.${bid}&doc_type=in.(uttektarskyrsla,brunakerfi,samningur,reikningur)&select=id,doc_type,year,invoice_number,drive_file_id,storage_path,customer_name,fyrirtaeki_id,is_duplicate&order=doc_type,year.desc.nullslast`),
        fetchAll('fyrirtaeki', `customer_base_id=eq.${bid}&deleted_at=is.null&select=id,nafn,heimilisfang,er_i_thjonustu`),
      ]);
      const docs = docsRaw.map(d => ({ ...d, open_url: openUrl(d) }));
      return json(200, { base_id: Number(p.base), docs, sites });
    } catch (e) { return json(502, { error: e.message }); }
  }

  // Listi: flokkur A (v_service_gaps) + flokkur B (ótengd þjónustu-skjöl).
  let all, unlinkedRaw;
  try {
    [all, unlinkedRaw] = await Promise.all([
      fetchAll('v_service_gaps', 'select=*'),
      fetchAll('customer_documents', `customer_base_id=is.null&doc_type=in.(uttektarskyrsla,brunakerfi,samningur)&select=id,doc_type,year,customer_name,drive_file_id,storage_path,is_duplicate`),
    ]);
  } catch (e) { return json(502, { error: e.message }); }

  const rows = all
    .map((r) => ({ ...r, flokkur: (r.lifandi_stadir || 0) > 0 ? 'med_stad' : 'an_stadar' }))
    .sort((a, b) => {
      if (a.flokkur !== b.flokkur) return a.flokkur === 'med_stad' ? -1 : 1;
      const s = (b.skyrslur || 0) - (a.skyrslur || 0); if (s) return s;
      const y = (b.nyjasta_ar || 0) - (a.nyjasta_ar || 0); if (y) return y;
      return String(a.nafn || '').localeCompare(String(b.nafn || ''), 'is');
    });

  const unlinked = unlinkedRaw
    .filter((d) => !d.is_duplicate)
    .map((d) => ({ ...d, open_url: openUrl(d) }))
    .sort((a, b) => (String(a.doc_type).localeCompare(String(b.doc_type))) || String(a.customer_name || '').localeCompare(String(b.customer_name || ''), 'is'));

  const counts = {
    linked_total: rows.length,
    med_stad: rows.filter((r) => r.flokkur === 'med_stad').length,
    an_stadar: rows.filter((r) => r.flokkur === 'an_stadar').length,
    unlinked: unlinked.length,
  };

  return json(200, { generated_at: new Date().toISOString(), counts, rows, unlinked });
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
