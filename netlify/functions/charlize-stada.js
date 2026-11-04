// charlize-stada.js — staða Charlize-minnisins fyrir Jarvis „Minnið“-spjaldið og biðstofuna (fasi 5, 04.11.2026).
//
//   GET  /api/charlize-stada                     → { knowledge:{active,superseded,wrong,per_scope,per_agent},
//                                                    inbox:{pending,per_scope,per_agent}, kunni:{faerslur,felog,af}, generated }
//   GET  /api/charlize-stada?op=inbox&limit=40&scope=kunni&agent=postur
//                                                → { rows:[{id,scope,topic,fact,detail,kennitala,agent,confidence,source_path,created_at}], pending }
//   POST /api/charlize-stada { action:'samthykkja', id }        → rpc charlize_approve(id) → { ok, knowledge_id }
//   POST /api/charlize-stada { action:'hafna', id, note? }      → charlize_inbox.status='rejected' (+review_note) → { ok }
//
// Skrif aðeins með starfsmanna-session OG frá sama vef (Origin), sama regla og agent-notes. Hvert skrif er
// skráð í agent_logs (agent 'jarvis'). Aldrei skrifað beint í charlize_knowledge héðan — aðeins um
// charlize_approve, sem er sama leið og SQL-samþykktin í skillinu charlize.

const P = require('./_portal');

const ORIGIN_OK = /^https:\/\/([a-z0-9-]+--)?brunaholf\.netlify\.app$/;
const LOCAL_OK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ID_RE = /^[\w.-]{1,40}$/;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = P.requireStaff(event); if (g) return g;
  try {
    if (event.httpMethod === 'POST') return await skrifa(event);
    if (event.httpMethod !== 'GET') return P.json(405, { error: 'Method not allowed' });
    const q = event.queryStringParameters || {};
    if (q.op === 'inbox') return await inbox(q);
    if (q.op === 'kunni') return await kunniListi(q);   // 04.11.2026: Agentanetið → „Kúnnaminni“ opnar lista félaga
    return await stada();
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
};

/* Félög með kúnnaminni: kt → fjöldi staðreynda, efni, síðast. Nöfn fær vafrinn úr data/felog.json (stöðuskrá). */
async function kunniListi(q) {
  const rows = await all('charlize_knowledge?select=kennitala,topic,updated_at&scope=eq.kunni&status=eq.active&kennitala=not.is.null&limit=10000');
  const m = new Map();
  for (const r of rows) {
    const e = m.get(r.kennitala) || { kt: r.kennitala, n: 0, efni: {}, sidast: null };
    e.n++; if (r.topic) e.efni[r.topic] = (e.efni[r.topic] || 0) + 1; if (!e.sidast || r.updated_at > e.sidast) e.sidast = r.updated_at;
    m.set(r.kennitala, e);
  }
  // Nöfn og „án minnis“ úr customers_base (lögaðilar: kt byrjar á 4–7 — einstaklingar aldrei í listanum, sbr. Charlize-regluna).
  const logadili = kt => /^[4-7]/.test(String(kt || ''));
  const nafn = new Map();
  try {
    for (let fra = 0; fra < 5000; fra += 1000) {
      const cb = await all(`customers_base?select=kennitala,nafn&kennitala=not.is.null&order=id.asc&limit=1000&offset=${fra}`);
      for (const r of cb) if (r.kennitala && logadili(r.kennitala) && !nafn.has(r.kennitala)) nafn.set(r.kennitala, r.nafn);
      if (cb.length < 1000) break;
    }
  } catch (_) {}
  const felog = [...m.values()].filter(e => logadili(e.kt)).map(e => Object.assign(e, { nafn: nafn.get(e.kt) || null }))
    .sort((a, b) => (b.sidast || '').localeCompare(a.sidast || '')).slice(0, Math.min(2000, parseInt(q.limit, 10) || 500));
  const an = [...nafn.entries()].filter(([kt]) => !m.has(kt)).map(([kt, n]) => ({ kt, nafn: n })).sort((a, b) => String(a.nafn || '').localeCompare(String(b.nafn || ''), 'is'));
  return P.json(200, { ok: true, felog, alls: felog.length, an, vidskiptavinir: nafn.size });
}
async function all(qs) { const r = await P.sbGet(qs); if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200)); return r.json(); }
async function count(table, filter) {
  const r = await fetch(`${P.SUPABASE_URL}/rest/v1/${table}?select=id${filter ? '&' + filter : ''}&limit=1`, {
    headers: { apikey: P.SUPABASE_KEY, Authorization: 'Bearer ' + P.SUPABASE_KEY, Prefer: 'count=exact' } });
  const cr = r.headers.get('content-range') || ''; const m = /\/(\d+)$/.exec(cr); return m ? parseInt(m[1], 10) : null;
}
function tally(rows, key) { const o = {}; for (const r of rows) { const k = r[key] || '—'; o[k] = (o[k] || 0) + 1; } return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); }

async function stada() {
  const [kn, ib, felog] = await Promise.all([
    all('charlize_knowledge?select=scope,status,agent,kennitala&limit=10000'),
    all('charlize_inbox?select=scope,agent&status=eq.pending&limit=10000'),
    count('customers_base'),
  ]);
  const active = kn.filter(r => r.status === 'active');
  const kunni = active.filter(r => r.scope === 'kunni');
  return P.json(200, {
    generated: new Date().toISOString(),
    knowledge: { active: active.length, superseded: kn.filter(r => r.status === 'superseded').length, wrong: kn.filter(r => r.status === 'wrong').length,
      per_scope: tally(active, 'scope'), per_agent: tally(active, 'agent') },
    inbox: { pending: ib.length, per_scope: tally(ib, 'scope'), per_agent: tally(ib, 'agent') },
    kunni: { faerslur: kunni.length, felog: new Set(kunni.map(r => r.kennitala).filter(Boolean)).size, af: felog },
  });
}

async function inbox(q) {
  const lim = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 40));
  const parts = ['status=eq.pending'];
  if (q.scope && ID_RE.test(q.scope)) parts.push(`scope=eq.${encodeURIComponent(q.scope)}`);
  if (q.agent && ID_RE.test(q.agent)) parts.push(`agent=eq.${encodeURIComponent(q.agent)}`);
  const [rows, pending] = await Promise.all([
    all(`charlize_inbox?select=id,scope,topic,fact,detail,kennitala,agent,confidence,source_path,created_at,review_note&${parts.join('&')}&order=review_note.desc.nullslast,created_at.desc,id.desc&limit=${lim}`),
    count('charlize_inbox', parts.join('&')),
  ]);
  return P.json(200, { rows, pending });
}

async function skrifa(event) {
  const origin = String((event.headers && (event.headers.origin || event.headers.Origin)) || '');
  if (origin && !ORIGIN_OK.test(origin) && !LOCAL_OK.test(origin)) return P.json(403, { error: 'Skrif aðeins leyfð frá brunaholf.netlify.app' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) return P.json(400, { error: 'id vantar' });
  const by = String(b.by_who || 'jarvis.html').slice(0, 60);
  const t0 = Date.now();
  if (b.action === 'samthykkja') {
    const r = await P.sbPost('rpc/charlize_approve', { inbox_id: id });
    const txt = await r.text();
    if (!r.ok) {
      await P.log({ agent: 'jarvis', action: 'charlize_samthykkja', target: String(id), status: 'villa', output: txt.slice(0, 300), by_who: by });
      return P.json(409, { error: 'charlize_approve: ' + txt.slice(0, 200) });
    }
    const kid = Number(txt) || null;
    await P.log({ agent: 'jarvis', action: 'charlize_samthykkja', target: String(id), output: { knowledge_id: kid }, duration_ms: Date.now() - t0, by_who: by });
    return P.json(200, { ok: true, knowledge_id: kid });
  }
  if (b.action === 'hafna') {
    const note = b.note ? String(b.note).slice(0, 500) : null;
    const r = await P.sbPatch(`charlize_inbox?id=eq.${id}&status=eq.pending`, { status: 'rejected', review_note: note });
    if (!r.ok) return P.json(502, { error: 'hafna: ' + r.status + ' ' + (await r.text()).slice(0, 200) });
    const rows = await r.json().catch(() => []);
    if (!rows.length) return P.json(409, { error: 'Færslan er ekki til eða ekki pending' });
    await P.log({ agent: 'jarvis', action: 'charlize_hafna', target: String(id), output: { note }, duration_ms: Date.now() - t0, by_who: by, status: 'hafnad' });
    return P.json(200, { ok: true });
  }
  return P.json(400, { error: 'Óþekkt aðgerð (samthykkja | hafna)' });
}
