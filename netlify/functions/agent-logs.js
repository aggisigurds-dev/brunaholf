// agent-logs.js — aðgerðaskrá agenta (06.09.2026, úr „Enterprise Agent Architecture"-blueprinti
// Agnars: það sem var nothæft). Hver gerði hvað, inntak/úttak, staða — ein tafla fyrir öll föll
// og agenta (punktur-greining, postvordur, reikningspunktar/karfa, svid-status, rukkari …).
//
//   GET  /api/agent-logs?since=<ISO>&agent=<nafn>&felag=<felag>&status=<ok|villa|hafnad|tillaga>&limit=200
//        → { rows:[{id,ts,agent,action,felag,target,input,output,status,duration_ms,by_who,session_id}], since }
//   GET  /api/agent-logs?op=yfirlit&days=1   → { per_agent:[{agent,n,villur,sidast}], alls, since }
//   POST /api/agent-logs { agent, action, felag?, target?, input?, output?, status?, duration_ms?, by_who?, session_id? }
//        (fyrir agenta sem keyra utan Netlify — Claude Code / Cowork — svo þeir skrái sig líka)
//
// Föllin sjálf skrifa með P.log(...) í _portal.js. Sjálfgefið 24 klst aftur í tímann.

const P = require('./_portal');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const STATUS = ['ok', 'villa', 'hafnad', 'tillaga'];

exports.handler = async (event) => {
  const r = await innri(event);
  if (r && typeof r === 'object') r.headers = Object.assign({}, r.headers || {}, CORS);
  return r;
};

async function innri(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = P.requireStaff(event); if (g) return g;
  try {
    if (event.httpMethod === 'POST') {
      let b; try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
      if (!b.agent || !b.action) return P.json(400, { error: 'agent og action vantar' });
      const row = await P.log(b);
      return P.json(200, { ok: !!row, row });
    }
    if (event.httpMethod !== 'GET') return P.json(405, { error: 'Method not allowed' });
    const q = event.queryStringParameters || {};
    const days = Math.min(90, Math.max(0.01, parseFloat(q.days) || 1));
    const since = q.since && !isNaN(Date.parse(q.since)) ? new Date(q.since).toISOString() : new Date(Date.now() - days * 864e5).toISOString();
    const parts = [`ts=gte.${since}`];
    if (q.agent) parts.push(`agent=eq.${encodeURIComponent(String(q.agent))}`);
    if (q.felag) parts.push(`felag=eq.${encodeURIComponent(String(q.felag))}`);
    if (q.status && STATUS.includes(q.status)) parts.push(`status=eq.${q.status}`);
    if (q.op === 'yfirlit') {
      const rows = await all(`agent_logs?select=agent,status,ts&${parts.join('&')}&order=ts.desc&limit=5000`);
      const by = {};
      for (const r of rows) { const e = by[r.agent] || (by[r.agent] = { agent: r.agent, n: 0, villur: 0, sidast: null }); e.n++; if (r.status === 'villa') e.villur++; if (!e.sidast || r.ts > e.sidast) e.sidast = r.ts; }
      return P.json(200, { since, alls: rows.length, per_agent: Object.values(by).sort((a, b) => b.n - a.n) });
    }
    const lim = Math.min(1000, Math.max(1, parseInt(q.limit, 10) || 200));
    const rows = await all(`agent_logs?select=*&${parts.join('&')}&order=ts.desc&limit=${lim}`);
    return P.json(200, { since, rows });
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
}

async function all(qs) { const r = await P.sbGet(qs); if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200)); return r.json(); }
