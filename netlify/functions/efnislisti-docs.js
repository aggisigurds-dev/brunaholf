// efnislisti-docs.js — Drive links per (worksite, month).
//   GET  /api/efnislisti-docs                          → all rows
//   GET  /api/efnislisti-docs?worksite=X&month=YYYY-MM → filter
//   POST /api/efnislisti-docs   body { worksite_name, work_month, drive_file_id, title }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const params = ['select=*', 'order=added_at.desc.nullslast'];
    if (q.worksite) params.push(`worksite_name=eq.${encodeURIComponent(q.worksite)}`);
    if (q.month)    params.push(`work_month=eq.${encodeURIComponent(q.month)}`);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?${params.join('&')}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { rows: await r.json() });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body.worksite_name || !body.work_month || !body.drive_file_id) {
      return json(400, { error: 'worksite_name + work_month + drive_file_id required' });
    }
    const payload = {
      worksite_name: body.worksite_name,
      work_month:    body.work_month,
      drive_file_id: body.drive_file_id,
      title:         body.title || null,
    };
    // Upsert: PK is (worksite_name, work_month, drive_file_id). Re-linking the
    // same file must succeed (idempotent) instead of throwing 409 Conflict.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?on_conflict=worksite_name,work_month,drive_file_id`, {
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
    return json(200, (await r.json())[0] || { ok: true });
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
