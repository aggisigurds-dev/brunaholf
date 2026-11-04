// lotur.js — lotuminni Agentakerfisins 2.0 (fasi 5, 04.11.2026). Les charlize_sessions sem
// Stop-hookurinn (tools/lotu-lok.cjs) skrifar í úr hverri Claude Code-lotu á öllum vélum.
//
//   GET /api/lotur?days=7&limit=60&repo=<repo>
//     → { since, rows:[{session_id,cwd,repo,machine,started_at,last_at,turns,agents_called,kennitolur,
//                       kunni_skrifad,got,summary,facts_written,olokid}],
//         agentar:{ <nafn>:{ lotur, sidast } },            // hvaða agentar voru kallaðir og hve oft
//         got:[{ ord, lotur, sidast }],                     // göt: síða/kt nefnd en enginn eigandi
//         tolur:{ lotur, med_kt, olokid, kunni_skrifad } }
//
// „Ólokið minni“ = lotan snerti kennitölu en skráði ekkert kúnnaminni (kunni_skrifad = 0).
// Lesaðeins. Starfsmanna-session (P.requireStaff) eins og agent-logs.

const P = require('./_portal');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,OPTIONS' };

exports.handler = async (event) => {
  const r = await innri(event);
  if (r && typeof r === 'object') r.headers = Object.assign({}, r.headers || {}, CORS);
  return r;
};

async function innri(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return P.json(405, { error: 'Method not allowed' });
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = P.requireStaff(event); if (g) return g;
  try {
    const q = event.queryStringParameters || {};
    const days = Math.min(90, Math.max(0.1, parseFloat(q.days) || 7));
    const lim = Math.min(500, Math.max(1, parseInt(q.limit, 10) || 60));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const parts = [`last_at=gte.${since}`];
    if (q.repo && /^[\w.-]{1,40}$/.test(q.repo)) parts.push(`repo=eq.${encodeURIComponent(q.repo)}`);
    const r = await P.sbGet(`charlize_sessions?select=*&${parts.join('&')}&order=last_at.desc&limit=${lim}`);
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const rows = await r.json();

    const agentar = {}, gotBy = {};
    const tolur = { lotur: rows.length, med_kt: 0, olokid: 0, kunni_skrifad: 0 };
    for (const s of rows) {
      const kt = Array.isArray(s.kennitolur) ? s.kennitolur.length : 0;
      s.olokid = kt > 0 && !(s.kunni_skrifad > 0);
      if (kt) tolur.med_kt++;
      if (s.olokid) tolur.olokid++;
      tolur.kunni_skrifad += s.kunni_skrifad || 0;
      for (const a of (s.agents_called || [])) {
        const e = agentar[a] || (agentar[a] = { lotur: 0, sidast: null });
        e.lotur++; if (!e.sidast || s.last_at > e.sidast) e.sidast = s.last_at;
      }
      for (const gt of (Array.isArray(s.got) ? s.got : [])) {
        const ord = ((gt && gt.ord) || []).join(' ').trim(); if (!ord) continue;
        const e = gotBy[ord] || (gotBy[ord] = { ord, sidast: null, session_ids: new Set() });
        e.session_ids.add(s.session_id);
        const ts = (gt && gt.ts) || s.last_at; if (!e.sidast || ts > e.sidast) e.sidast = ts;
      }
    }
    const got = Object.values(gotBy).map(e => ({ ord: e.ord, lotur: e.session_ids.size, sidast: e.sidast }))
      .sort((a, b) => b.lotur - a.lotur || (b.sidast > a.sidast ? 1 : -1));
    return P.json(200, { since, rows, agentar, got, tolur });
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
}
