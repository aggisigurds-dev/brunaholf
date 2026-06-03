// solur.js — recent Slökkvitæki POS sales (read-only) from the shared Supabase,
// so the reikningur generator can load an existing sale instead of re-typing it.
//   GET /api/solur?limit=200 → recent sales with their line items (linur)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const q = event.queryStringParameters || {};
  const limit = Math.min(500, Math.max(1, parseInt(q.limit, 10) || 200));
  try {
    const rows = await sb(`solur?select=id,num,customer_nafn,customer_id,upphaed_an_vsk,` +
      `vsk_upphaed,samtals,greitt_med,athugasemdir,created_at,linur` +
      `&order=created_at.desc&limit=${limit}`);
    const sales = rows.map((s) => ({
      id: s.id,
      num: s.num || '',
      customer: s.customer_nafn || '',
      customer_id: s.customer_id || null,
      ex_vsk: Number(s.upphaed_an_vsk) || 0,
      vsk: Number(s.vsk_upphaed) || 0,
      total: Number(s.samtals) || 0,
      paid_with: s.greitt_med || '',
      date: (s.created_at || '').slice(0, 10),
      lines: Array.isArray(s.linur) ? s.linur.map((l) => ({
        id: l.product_id != null ? l.product_id : '',
        desc: l.desc || '',
        qty: Number(l.qty) || 0,
        price: Number(l.unit_price_ex_vat) || 0,
      })) : [],
    }));
    return json(200, { count: sales.length, sales });
  } catch (e) {
    return json(502, { error: e.message });
  }
};

async function sb(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
