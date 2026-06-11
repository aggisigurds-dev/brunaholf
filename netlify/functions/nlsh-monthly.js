// nlsh-monthly.js — NLSH month-end cumulative snapshots (snapshot-delta billing).
//
//   GET  /api/nlsh-monthly                       → { snapshots: [{month, cumulative_m_vsk, note, captured_at}] }
//   POST /api/nlsh-monthly  { month, cumulative_m_vsk, note }   → upsert one month, returns list
//
// The monthly charge = this month's cumulative − previous month's cumulative
// (computed on the client). Matches how NLSH is actually invoiced: each
// month-end the cumulative total Done is recorded and the change is billed,
// which self-corrects retroactive size re-classifications.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'POST') {
      let p = {};
      try { p = JSON.parse(event.body || '{}'); } catch (_) {}
      const month = String(p.month || '').trim();
      const cum = Math.round(Number(p.cumulative_m_vsk));
      if (!/^\d{4}-\d{2}$/.test(month)) return json(400, { error: 'month verður að vera YYYY-MM' });
      if (!Number.isFinite(cum)) return json(400, { error: 'cumulative_m_vsk vantar' });
      const note = (p.note != null ? String(p.note).slice(0, 200) : null);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_month_snapshot?on_conflict=month`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ month, cumulative_m_vsk: cum, note, captured_at: new Date().toISOString() }),
      });
      if (!r.ok) return json(502, { error: `save: ${r.status} ${(await r.text()).slice(0, 200)}` });
    } else if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method not allowed' });
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_month_snapshot?select=month,cumulative_m_vsk,note,captured_at&order=month.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(502, { error: `read: ${r.status} ${(await r.text()).slice(0, 200)}` });
    return json(200, { snapshots: await r.json() });
  } catch (e) {
    return json(502, { error: e.message });
  }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
