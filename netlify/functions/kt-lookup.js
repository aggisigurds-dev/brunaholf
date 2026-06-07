// kt-lookup.js — resolve a kennitala to a customer, for the Skjalaheiti renamer
// so each report shows its guaranteed DB link as it's read.
//   GET /api/kt-lookup?kt=510486-3589 → { found, source, id, nafn }
// Supabase-only (no Google), so it works even when the Drive token is stale.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const kt = ((event.queryStringParameters || {}).kt || '').replace(/\D/g, '');
  if (kt.length !== 10) return json(400, { error: 'kt required (10 digits)' });
  const dash = kt.slice(0, 6) + '-' + kt.slice(6);

  for (const table of ['customers_base', 'fyrirtaeki']) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?kennitala=eq.${dash}&select=id,nafn&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) continue;
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) return json(200, { found: true, source: table, id: rows[0].id, nafn: rows[0].nafn });
  }
  return json(200, { found: false });
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}
