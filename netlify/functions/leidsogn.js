// leidsogn.js — service-routing schedule for the Leiðsögn page.
//   GET /api/leidsogn → { companies: [ { nafn, kt, heim, postnr, svaedi, manudur, ar, forg } ] }
// forg = red (forgotten 2023-) | orange (2024) | yellow (2025) | green (2026).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/app_leidsogn`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) return json(502, { error: 'rpc ' + r.status, detail: (await r.text()).slice(0, 200) });
    const data = await r.json();
    return json(200, { companies: Array.isArray(data) ? data : [] });
  } catch (e) { return json(500, { error: String(e.message || e) }); }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(statusCode, payload) { return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors() }, body: JSON.stringify(payload) }; }
