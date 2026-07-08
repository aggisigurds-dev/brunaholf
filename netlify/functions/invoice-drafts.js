// invoice-drafts.js — Prebuilt next-invoice drafts.
//
//   GET  /api/invoice-drafts                          → all rows
//   GET  /api/invoice-drafts?worksite=NAME            → for one worksite
//   GET  /api/invoice-drafts?status=overdue,draft     → filter by status (comma list)
//   POST /api/invoice-drafts                          body { worksite_name, work_month, status, ...} → upsert
//
// invoice_drafts schema (from migration in PR #5):
//   worksite_name, work_month, customer_name, source,
//   hours_dagvinna, hours_eftirvinna, rate_dagvinna, rate_eftirvinna,
//   akstur_km, akstur_ferdir, smahlutagjald, stadfesting,
//   materials_jsonb, materials_total,
//   net_an_vsk, vsk_amount, total_m_vsk,
//   status (draft|overdue|sent|skipped|invoiced),
//   payday_invoice_id, notes, created_at, updated_at, updated_by

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const params = ['select=*', 'order=total_m_vsk.desc.nullslast'];
    if (q.worksite) params.push(`worksite_name=eq.${encodeURIComponent(q.worksite)}`);
    if (q.status)   params.push(`status=in.(${q.status.split(',').map(encodeURIComponent).join(',')})`);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?${params.join('&')}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    // Quick summary by status
    const summary = { count: rows.length, by_status: {}, total_m_vsk: 0 };
    for (const r of rows) {
      summary.total_m_vsk += Number(r.total_m_vsk || 0);
      summary.by_status[r.status] = (summary.by_status[r.status] || 0) + Number(r.total_m_vsk || 0);
    }
    return json(200, { rows, summary });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body.worksite_name || !body.work_month) return json(400, { error: 'worksite_name + work_month required' });

    const allowed = [
      'worksite_name', 'work_month', 'customer_name', 'source',
      'hours_dagvinna', 'hours_eftirvinna', 'rate_dagvinna', 'rate_eftirvinna',
      'akstur_km', 'akstur_ferdir', 'smahlutagjald', 'stadfesting',
      'materials_jsonb', 'materials_total',
      'net_an_vsk', 'vsk_amount', 'total_m_vsk',
      'status', 'payday_invoice_id', 'notes', 'updated_by',
      'kennitala', 'heimilisfang',
      // 2026-07-08 (afsláttar-úttekt): persist the Gerð Reikninga discount so
      // a saved draft reprints correctly on any device — it used to be
      // reconstructed from the CURRENT UI state (state.ui.gr_discount), so a
      // changed/unsyncced pct printed a sheet that didn't add up.
      'discount_pct',
    ];
    const payload = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (body[k] !== undefined) payload[k] = body[k];

    const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?on_conflict=worksite_name,work_month`, {
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

  if (event.httpMethod === 'DELETE') {
    const q = event.queryStringParameters || {};
    if (!q.worksite || !q.work_month) return json(400, { error: 'worksite + work_month required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?worksite_name=eq.${encodeURIComponent(q.worksite)}&work_month=eq.${encodeURIComponent(q.work_month)}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { ok: true, deleted: { worksite_name: q.worksite, work_month: q.work_month } });
  }

  return json(405, { error: 'Method not allowed' });
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
