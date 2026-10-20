// krofu-greidslur.js — síðustu greiðslur úr Payday fyrir Kröfu yfirlit (lítill dálkur til hægri).
//
//   GET /api/krofu-greidslur?n=6
//     → { rows: [{ tilvisun, customer_name, upphaed_total, greidsla_date }], n, generated_at }
//
// Agnar 20.10.2026: „bæta við svo við sjáum síðustu payday greiðslur, dagsetningu og upphæð í frekar litlum dálk til hægri".
// Heimild: `invoices` með source='payday' OG status='PAID' (Payday-API skilar enskum hástöfum) — nýjasta greiðsludagsetning fyrst.
// Kreditreikningar (CREDIT) eru EKKI greiðslur (sjá minni: kreditreikningur ≠ greiðsla) og Landsbanka-kröfur ekki heldur —
// þetta eru greiðslur sem Payday sjálft skráir. Lesið eingöngu; engin skrif.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors() }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const qs = event.queryStringParameters || {};
  const n = Math.min(20, Math.max(1, parseInt(qs.n, 10) || 6));
  const url = SUPABASE_URL + '/rest/v1/invoices'
    + '?select=tilvisun,customer_name,upphaed_total,greidsla_date'
    + '&source=eq.payday&status=eq.PAID&greidsla_date=not.is.null&upphaed_total=not.is.null'
    + '&order=greidsla_date.desc,tilvisun.desc&limit=' + n;
  try {
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
    if (!r.ok) return json(502, { error: 'Supabase ' + r.status });
    const rows = (await r.json()).map((x) => ({
      tilvisun: x.tilvisun == null ? null : String(x.tilvisun),
      customer_name: x.customer_name || '',
      upphaed_total: Number(x.upphaed_total) || 0,
      greidsla_date: x.greidsla_date,
    }));
    return json(200, { rows, n, generated_at: new Date().toISOString() });
  } catch (e) {
    return json(502, { error: String((e && e.message) || e) });
  }
};
