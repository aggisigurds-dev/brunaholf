// solur-mark.js — write back which POS sales have been pushed to dk (so they
// drop off the "Reikningar í bið" list). Idempotent: only marks sales not
// already invoiced; supports unmark to undo.
//   POST /api/solur-mark { ids:[..], dk_invoice_id?, batch_id? }
//   POST /api/solur-mark { ids:[..], unmark:true }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST { ids:[..] }' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  let req;
  try { req = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body.' }); }

  const ids = (req.ids || []).map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n));
  if (!ids.length) return json(400, { error: 'No valid sale ids.' });
  const inList = ids.join(',');

  let patch, q;
  if (req.unmark === true) {
    patch = { invoiced_at: null, dk_invoice_id: null, invoice_batch_id: null };
    q = `solur?id=in.(${inList})`;
  } else {
    patch = {
      invoiced_at: new Date().toISOString(),
      dk_invoice_id: req.dk_invoice_id || null,
      invoice_batch_id: req.batch_id || null,
    };
    // idempotent — never re-mark an already-invoiced sale
    q = `solur?id=in.(${inList})&invoiced_at=is.null`;
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'content-type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    const text = await r.text();
    if (!r.ok) return json(502, { error: `solur PATCH ${r.status}: ${text.slice(0, 200)}` });
    let rows; try { rows = JSON.parse(text); } catch { rows = []; }
    return json(200, { updated: rows.length, ids: rows.map((x) => x.id) });
  } catch (e) {
    return json(502, { error: e.message });
  }
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
