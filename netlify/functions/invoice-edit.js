// invoice-edit.js — small per-invoice editor for our outgoing invoices.
//   POST /api/invoice-edit  body { id, payday_invoice_id?, worksite_match?, status?, notes? }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const id = Number(body.id);
  if (!id) return json(400, { error: 'id required' });

  const allowed = ['payday_invoice_id', 'worksite_match', 'status', 'notes'];
  const payload = {};
  for (const k of allowed) if (body[k] !== undefined) payload[k] = body[k];
  if (!Object.keys(payload).length) return json(400, { error: 'No editable fields supplied' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  const arr = await r.json();
  return json(200, arr[0] || { ok: true });
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
