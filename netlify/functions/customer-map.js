// customer-map.js — manage the customer↔worksite mapping.
// POST /api/customer-map { customer_name, worksite_name, kt_greidanda?, notes? }
// GET  /api/customer-map → list all mappings
// DELETE /api/customer-map?id=N

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?select=*&order=added_at.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { rows: await r.json() });
  }

  if (event.httpMethod === 'DELETE') {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return json(400, { error: 'id required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    return json(r.ok ? 200 : r.status, { deleted: r.ok });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  if (!body.customer_name || !body.worksite_name) {
    return json(400, { error: 'customer_name and worksite_name are required' });
  }
  const payload = {
    customer_name: body.customer_name.trim(),
    worksite_name: body.worksite_name.trim(),
    kt_greidanda: body.kt_greidanda || null,
    notes: body.notes || null,
    confidence: body.confidence || 'manual',
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?on_conflict=customer_name,worksite_name`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
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
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
