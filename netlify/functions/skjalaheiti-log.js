// skjalaheiti-log.js — memory for the Skjalaheiti renamer (what it has processed).
//   GET  /api/skjalaheiti-log?hashes=h1,h2   → rows already logged (dedup check)
//   GET  /api/skjalaheiti-log?limit=500      → recent history (Saga view)
//   POST /api/skjalaheiti-log { entries:[…] } → record processed reports
//                                               (deduped on content_hash)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  if (event.httpMethod === 'GET') {
    const p = event.queryStringParameters || {};
    if (p.hashes) {
      const list = p.hashes.split(',').map(s => s.trim().replace(/[^a-f0-9]/gi, '')).filter(Boolean).slice(0, 500);
      if (!list.length) return json(200, { rows: [] });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/skjalaheiti_log?content_hash=in.(${list.join(',')})&select=content_hash,new_name,kennitala,created_at`, { headers: H });
      return json(r.status, { rows: r.ok ? await r.json() : [] });
    }
    const limit = Math.min(parseInt(p.limit || '300', 10) || 300, 2000);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/skjalaheiti_log?select=*&order=created_at.desc&limit=${limit}`, { headers: H });
    return json(r.status, { rows: r.ok ? await r.json() : [], error: r.ok ? undefined : (await r.text()).slice(0, 200) });
  }

  if (event.httpMethod === 'POST') {
    let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const payload = entries.filter(e => e && e.content_hash).map(e => ({
      content_hash: String(e.content_hash).replace(/[^a-f0-9]/gi, ''),
      kennitala: e.kennitala || null, nafn: e.nafn || null, heimilisfang: e.heimilisfang || null,
      manudur: e.manudur || null, ar: e.ar || null, doc_type: e.doc_type || 'uttektarskyrsla',
      original_name: e.original_name || null, new_name: e.new_name || null,
    })).filter(e => e.content_hash.length === 64);
    if (!payload.length) return json(400, { error: 'no valid entries' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/skjalaheiti_log?on_conflict=content_hash`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 200) });
    return json(200, { ok: true, received: payload.length });
  }

  return json(405, { error: 'Method not allowed' });
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}
