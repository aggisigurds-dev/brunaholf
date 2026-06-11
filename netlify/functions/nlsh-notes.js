// nlsh-notes.js — shared notes / messages between the manager and the staff
// member on the NLSH page (the `nlsh` tab and the standalone nlsh.html).
//
//   GET  /api/nlsh-notes            → { notes: [{id, author, body, created_at}] }
//   POST /api/nlsh-notes  { author, body }   → appends, returns updated list
//
// Backed by the `nlsh_notes` table. Newest last (chat order).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'POST') {
      let payload = {};
      try { payload = JSON.parse(event.body || '{}'); } catch (_) {}
      const body = String(payload.body || '').trim();
      const author = String(payload.author || 'Starfsmaður').trim().slice(0, 60) || 'Starfsmaður';
      if (!body) return json(400, { error: 'Tómt skilaboð' });
      if (body.length > 4000) return json(400, { error: 'Of langt (hámark 4000 stafir)' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_notes`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ author, body }),
      });
      if (!r.ok) return json(502, { error: `insert: ${r.status} ${(await r.text()).slice(0, 200)}` });
    } else if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method not allowed' });
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_notes?select=id,author,body,created_at&order=created_at.asc&limit=500`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(502, { error: `read: ${r.status} ${(await r.text()).slice(0, 200)}` });
    const notes = await r.json();
    return json(200, { notes });
  } catch (e) {
    return json(502, { error: e.message });
  }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
