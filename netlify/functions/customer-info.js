// customer-info.js — per-customer payment behavior profile.
//
// GET    /api/customer-info?name=...   → fetch one
// GET    /api/customer-info            → list all
// POST   /api/customer-info            → upsert one (body: {customer_name, ...patch})

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const name = (event.queryStringParameters || {}).name;
    let path = 'customer_info?select=*&order=customer_name.asc';
    if (name) path = `customer_info?customer_name=eq.${encodeURIComponent(name)}&select=*`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { rows: await r.json() });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  if (!body.customer_name) return json(400, { error: 'customer_name is required' });

  const allowed = ['kennitala','payment_method','payment_terms','retention_pct','retention_notes',
                   'contact_email','contact_phone','general_notes','last_payment_at'];
  const payload = { customer_name: body.customer_name.trim(), updated_at: new Date().toISOString() };
  for (const k of allowed) if (body[k] !== undefined) payload[k] = body[k];

  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_info?on_conflict=customer_name`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  return json(200, { ok: true, row: (await r.json())[0] });
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
