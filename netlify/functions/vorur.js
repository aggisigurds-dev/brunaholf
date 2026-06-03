// vorur.js — serve the Slökkvitæki Sala price list (read-only) from the shared
// Supabase project, for the reikningur generator (slokkvitaeki-reikningur.html).
// Same Supabase as the rest of brunaholf; `vorur` is the POS product table.
//   GET /api/vorur            → active products
//   GET /api/vorur?all=1      → include inactive (virkt=false) too

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const all = (event.queryStringParameters || {}).all;
  const filter = all ? '' : '&virkt=eq.true';
  try {
    const rows = await sb(`vorur?select=id,nafn,flokkur,verd_an_vsk,vsk_prosenta,virkt${filter}` +
      `&order=flokkur.asc,nafn.asc`);
    const products = rows.map((r) => ({
      id: r.id,
      nafn: r.nafn,
      flokkur: r.flokkur || 'Annað',
      verd_an_vsk: Number(r.verd_an_vsk) || 0,
      vsk_prosenta: Number(r.vsk_prosenta) || 24,
      virkt: r.virkt !== false,
    }));
    return json(200, { count: products.length, products });
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
