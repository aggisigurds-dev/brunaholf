// agent-notes.js — athugasemdir Agnars við agenta/skills (Jarvis → Sérfræðingar).
//
//   GET  /api/agent-notes?agent=rukkari   → { notes: [{id, agent, note, author, status, created_at, taken_at}] }
//   GET  /api/agent-notes?counts=1        → { counts: { rukkari: 2, ... } }   (aðeins status = 'nytt')
//   POST /api/agent-notes { agent, note, author }          → bætir við, skilar lista agentsins
//   POST /api/agent-notes { action:'delete', id }          → eyðir athugasemd sem er enn 'nytt'
//
// Taflan agent_notes (sql/2026-10-28_agent_notes.sql). Lota les 'nytt' og merkir 'tekid_inn'.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENT_RE = /^[a-z0-9_-]{2,48}$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  try {
    const q = event.queryStringParameters || {};
    let agent = q.agent;

    if (event.httpMethod === 'POST') {
      let p = {};
      try { p = JSON.parse(event.body || '{}'); } catch (_) {}

      if (p.action === 'delete') {
        const id = Number(p.id);
        if (!Number.isInteger(id)) return json(400, { error: 'id vantar' });
        const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_notes?id=eq.${id}&status=eq.nytt`, {
          method: 'DELETE', headers: { ...H, Prefer: 'return=representation' },
        });
        if (!r.ok) return json(502, { error: `delete: ${r.status} ${(await r.text()).slice(0, 200)}` });
        const gone = await r.json();
        agent = gone[0] && gone[0].agent;
      } else {
        agent = String(p.agent || '').trim();
        const note = String(p.note || '').trim();
        const author = String(p.author || '').trim().slice(0, 60) || null;
        if (!AGENT_RE.test(agent)) return json(400, { error: 'Óþekkt heiti á agent' });
        if (!note) return json(400, { error: 'Tóm athugasemd' });
        if (note.length > 4000) return json(400, { error: 'Of langt (hámark 4000 stafir)' });
        const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_notes`, {
          method: 'POST',
          headers: { ...H, 'content-type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ agent, note, author }),
        });
        if (!r.ok) return json(502, { error: `insert: ${r.status} ${(await r.text()).slice(0, 200)}` });
      }
    } else if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method not allowed' });
    }

    if (event.httpMethod === 'GET' && q.counts) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_notes?select=agent&status=eq.nytt&limit=5000`, { headers: H });
      if (!r.ok) return json(502, { error: `counts: ${r.status} ${(await r.text()).slice(0, 200)}` });
      const counts = {};
      for (const row of await r.json()) counts[row.agent] = (counts[row.agent] || 0) + 1;
      return json(200, { counts });
    }

    if (!agent || !AGENT_RE.test(agent)) return json(400, { error: 'agent vantar' });
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_notes?select=id,agent,note,author,status,created_at,taken_at&agent=eq.${encodeURIComponent(agent)}&order=created_at.desc&limit=100`,
      { headers: H });
    if (!r.ok) return json(502, { error: `read: ${r.status} ${(await r.text()).slice(0, 200)}` });
    return json(200, { notes: await r.json() });
  } catch (e) {
    return json(502, { error: e.message });
  }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
