// pricing-guide.js — Per-worksite billing rules CRUD.
//
//   GET  /api/pricing-guide                 → all rows
//   GET  /api/pricing-guide?worksite=NAME   → single row (404 if missing)
//   POST /api/pricing-guide                 body { worksite_name, ... } → upsert

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const worksite = (q.worksite || '').trim();
    const path = worksite
      ? `pricing_guide?worksite_name=eq.${encodeURIComponent(worksite)}&select=*`
      : `pricing_guide?select=*&order=worksite_name.asc`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const data = await r.json();
    if (worksite) {
      if (!data.length) return json(404, { error: 'Not found', worksite_name: worksite });
      return json(200, data[0]);
    }
    return json(200, { rows: data });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body.worksite_name) return json(400, { error: 'worksite_name required' });

    const allowed = [
      'worksite_name', 'customer_name', 'dagvinna_rate', 'eftirvinna_rate',
      'akstur_km_rate', 'akstur_ferd_rate', 'smahlutagjald_per_h',
      'stadfesting_default', 'stadfesting_amount', 'vsk_pct',
      'source', 'fixed_amount', 'retention_pct', 'payment_terms_days',
      'notes', 'effective_from', 'updated_by',
    ];
    const payload = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (body[k] !== undefined) payload[k] = body[k];

    const r = await fetch(`${SUPABASE_URL}/rest/v1/pricing_guide?on_conflict=worksite_name`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const arr = await r.json();
    return json(200, arr[0] || { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
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
