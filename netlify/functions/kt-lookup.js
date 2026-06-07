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

  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  async function one(table, sel) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?kennitala=eq.${dash}&select=${sel}&limit=1`, { headers: H });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
  }
  // Name preferred from customers_base; address comes from fyrirtaeki (where heimilisfang lives).
  const cb = await one('customers_base', 'id,nafn');
  const fy = await one('fyrirtaeki', 'id,nafn,heimilisfang');
  if (cb || fy) {
    return json(200, {
      found: true,
      source: cb ? 'customers_base' : 'fyrirtaeki',
      id: (cb || fy).id,
      nafn: (cb && cb.nafn) || (fy && fy.nafn) || null,
      heimilisfang: (fy && fy.heimilisfang) || null,
    });
  }
  return json(200, { found: false });
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}
