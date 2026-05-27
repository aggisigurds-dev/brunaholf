// app-state.js — cross-device state persistence for the hub.
//
// Stores the user's tab/button/UI state in app_kv so it follows them
// across browsers/devices instead of living only in localStorage.
//
//   GET  /api/app-state?key=hub_state   → { value, updated_at } or 404
//   POST /api/app-state                 body { key, value }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_KEYS = new Set([
  'hub_state',         // tabs + buttons + ui
  'kvittanir_templates',
]);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const key = (event.queryStringParameters || {}).key || '';
    if (!ALLOWED_KEYS.has(key)) return json(400, { error: 'Unknown key' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.${encodeURIComponent(key)}&select=value,updated_at`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const arr = await r.json();
    if (!arr.length) return json(404, { error: 'Not found' });
    return json(200, arr[0]);
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }
    const { key, value } = body;
    if (!ALLOWED_KEYS.has(key)) return json(400, { error: 'Unknown key' });
    if (value === undefined) return json(400, { error: 'Missing value' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const arr = await r.json();
    return json(200, arr[0] || { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};

function cors(){
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload){ return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers){ return { statusCode, headers, body }; }
