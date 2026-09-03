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
    // Undanskildar línur (redder_line_items.excluded): raunveruleg endurkrafa per reikning
    // = recharge_amount ef sett, annars m_vsk mínus undanskildar línur (upphaed er án vsk).
    for (const inv of rows) {
      const an = Number(inv.an_vsk) || 0, mv = Number(inv.m_vsk) || 0;
      const factor = an > 0 ? mv / an : 1.24;
      const exAn = (inv.redder_line_items || []).filter(li => li.excluded).reduce((a, li) => a + (Number(li.upphaed) || 0), 0);
      inv.excluded_an_vsk = Math.round(exAn);
      inv.excluded_m_vsk = Math.round(exAn * factor);
      inv.effective_m_vsk = inv.recharge_amount != null ? Number(inv.recharge_amount) : Math.max(0, mv - inv.excluded_m_vsk);
      inv.effective_an_vsk = Math.round(inv.effective_m_vsk / factor);
    }
    // Build summary by (worksite, month) — á RAUNVERULEGRI endurkröfu
    const byWorksiteMonth = {};
    let grandTotal = 0;
    for (const inv of rows) {
      grandTotal += Number(inv.effective_m_vsk || 0);
      if (!inv.dagsetning) continue;
      const month = String(inv.dagsetning).slice(0,7);
      const ws = inv.worksite_match || '(óþekkt)';
      const k = `${ws}|${month}`;
      if (!byWorksiteMonth[k]) byWorksiteMonth[k] = { worksite: ws, month, invoice_count: 0, total_an_vsk: 0, total_m_vsk: 0 };
      byWorksiteMonth[k].invoice_count++;
      byWorksiteMonth[k].total_an_vsk += Number(inv.effective_an_vsk || 0);
      byWorksiteMonth[k].total_m_vsk  += Number(inv.effective_m_vsk || 0);
    }
    return json(200, { rows, summary: { count: rows.length, grand_total_m_vsk: grandTotal, by_worksite_month: Object.values(byWorksiteMonth) } });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }

    // Bulk rename (verkefnalisti a12d429a — misspelled worksite variants that
    // never grouped together, e.g. "Fjörður" vs "Fjarðagata"): retag every
    // Redder invoice currently under `from` to `to` in one PATCH, and optionally
    // teach the alias so future PDF reads normalise straight to `to`.
    if (body.action === 'rename_worksite') {
      const from = String(body.from || '').trim();
      const to = String(body.to || '').trim();
      if (!from || !to) return json(400, { error: 'from og to vantar' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/redder_invoices?worksite_match=eq.${encodeURIComponent(from)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', 'Prefer': 'return=representation',
        },
        body: JSON.stringify({ worksite_match: to }),
      });
      if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
      const updated = await r.json();
      if (body.learn_alias && from !== to) {
        await fetch(`${SUPABASE_URL}/rest/v1/project_aliases?on_conflict=alias`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ alias: from, canonical_name: to, source: 'manual-redder-link' }),
        }).catch(() => {});
      }
      return json(200, { ok: true, updated: updated.length });
    }

    // Lína af/á tengingunni (Agnar 03.09.2026) — vistast strax úr Efniskostnaðar-glugganum.
    if (body.action === 'exclude_line') {
      const id = parseInt(body.line_id, 10);
      if (!Number.isFinite(id)) return json(400, { error: 'line_id vantar' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/redder_line_items?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ excluded: !!body.excluded }),
      });
      if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
      const rows = await r.json();
      if (!rows.length) return json(404, { error: 'lína fannst ekki' });
      return json(200, { ok: true, line: rows[0] });
    }

    if (!body.invoice_nr) return json(400, { error: 'invoice_nr required' });

    const { line_items, redder_line_items: _unused, ...invFields } = body;
    // Whitelist allowed columns to avoid Postgres errors from extra fields
    const allowed = ['invoice_nr','dagsetning','eindagi','worksite_match','worksite_raw',
      'contact_person','salesperson','an_vsk','vsk','m_vsk','recharge_amount',
      'drive_file_id','source','notes'];
    const cleaned = {};
    for (const k of allowed) if (invFields[k] !== undefined) cleaned[k] = invFields[k];
    Object.assign(invFields, cleaned);
    // Replace invFields with cleaned to be safe
    for (const k of Object.keys(invFields)) if (!allowed.includes(k)) delete invFields[k];
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
