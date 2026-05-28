// redder-invoices.js — Material cost invoices from Redder ehf., recharged to worksites.
//   GET  /api/redder-invoices                          → all with line items
//   GET  /api/redder-invoices?worksite=NAME            → filter
//   GET  /api/redder-invoices?month=YYYY-MM            → filter
//   POST /api/redder-invoices   body { invoice_nr, ... , line_items: [...] }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const params = ['select=*,redder_line_items(*)', 'order=dagsetning.desc.nullslast'];
    if (q.worksite) params.push(`worksite_match=eq.${encodeURIComponent(q.worksite)}`);
    if (q.month) {
      // month=YYYY-MM → filter by dagsetning month
      params.push(`dagsetning=gte.${q.month}-01`);
      const [yr, mo] = q.month.split('-').map(Number);
      const last = new Date(yr, mo, 0).getDate();
      params.push(`dagsetning=lte.${q.month}-${String(last).padStart(2,'0')}`);
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/redder_invoices?${params.join('&')}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    // Build summary by (worksite, month)
    const byWorksiteMonth = {};
    let grandTotal = 0;
    for (const inv of rows) {
      grandTotal += Number(inv.m_vsk || 0);
      if (!inv.dagsetning) continue;
      const month = String(inv.dagsetning).slice(0,7);
      const ws = inv.worksite_match || '(óþekkt)';
      const k = `${ws}|${month}`;
      if (!byWorksiteMonth[k]) byWorksiteMonth[k] = { worksite: ws, month, invoice_count: 0, total_an_vsk: 0, total_m_vsk: 0 };
      byWorksiteMonth[k].invoice_count++;
      byWorksiteMonth[k].total_an_vsk += Number(inv.an_vsk || 0);
      byWorksiteMonth[k].total_m_vsk  += Number(inv.m_vsk || 0);
    }
    return json(200, { rows, summary: { count: rows.length, grand_total_m_vsk: grandTotal, by_worksite_month: Object.values(byWorksiteMonth) } });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body.invoice_nr) return json(400, { error: 'invoice_nr required' });

    const { line_items, ...invFields } = body;
    const invR = await fetch(`${SUPABASE_URL}/rest/v1/redder_invoices?on_conflict=invoice_nr`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(invFields),
    });
    if (!invR.ok) return json(invR.status, { error: (await invR.text()).slice(0, 300) });
    const inv = (await invR.json())[0];

    if (Array.isArray(line_items) && line_items.length && inv?.id) {
      // wipe existing line items for this invoice, then re-insert
      await fetch(`${SUPABASE_URL}/rest/v1/redder_line_items?invoice_id=eq.${inv.id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      });
      const lines = line_items.map((li, i) => ({ ...li, invoice_id: inv.id, line_no: i + 1 }));
      const lR = await fetch(`${SUPABASE_URL}/rest/v1/redder_line_items`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(lines),
      });
      if (!lR.ok) return json(lR.status, { error: (await lR.text()).slice(0, 300) });
    }
    return json(200, inv);
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
