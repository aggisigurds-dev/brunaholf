// branding.js — serve the shared company branding (logo) from app_settings.
// The Slökkvitæki app stores the uploaded logo as a data URL under
// settings.branding.logo_url (same Supabase project as brunaholf), so the
// reikningur generator can show the exact same logo, in sync.
//   GET /api/branding → { logo_url }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    const rows = await sb('app_settings?select=settings&id=eq.1');
    const branding = (rows[0] && rows[0].settings && rows[0].settings.branding) || {};
    return json(200, { logo_url: branding.logo_url || null });
  } catch (e) {
    return json(502, { error: e.message });
  }
};

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
