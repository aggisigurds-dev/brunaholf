// spyrja-agent.js — „Spyrja <agent>“ á hverri síðu (Agentakerfið 2.0, fasi 6 G, 04.11.2026).
//
// Síðukortið segir hver á síðuna; sá agent svarar með sinni eigin agent-skrá sem system-prompt (netlify/functions/
// _agent-prompts-all.json, GENERATED af tools/agent-prompt.cjs — ekki birt, /netlify/* er lokað) auk samhengis
// síðunnar, kúnnaminnisins (charlize_yfirlit(kt)) og 10 nýjustu Charlize-staðreynda agentsins.
//
//   GET  /api/spyrja-agent?vefur=brunaholf&view=yfirlit[&path=/x.html][&kt=…][&agent=…]
//          → { agent, rodd, lysing, sida:{titill,leid,eigandi,undiragentar}, kt, kunni }
//   POST /api/spyrja-agent { action:'spyrja', vefur, view, path, kt, agent?, messages:[{role,content}] } → { reply, agent, usd }
//   POST /api/spyrja-agent { action:'skra', vefur, view, kt, agent, fact, detail? } → { ok, id }   (charlize_inbox, pending)
//
// Starfsmanna-session + Origin (sama regla og charlize-stada). Svör eru ráð, aldrei aðgerðir: fallið skrifar aðeins í
// charlize_inbox (kandídat sem Agnar samþykkir í biðstofunni) og agent_logs. Opus 5.5, adaptive thinking.

const P = require('./_portal');
let PROMPTS = { agents: {} };
try { PROMPTS = require('./_agent-prompts-all.json'); } catch (e) { console.warn('spyrja-agent: _agent-prompts-all.json vantar — keyrðu node tools/agent-prompt.cjs'); }

const ORIGIN_OK = /^https:\/\/([a-z0-9-]+--)?brunaholf\.netlify\.app$/;
const LOCAL_OK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const MODEL = process.env.SPYRJA_MODEL || 'claude-opus-5-5';
const FALLBACK = { brunaholf: 'framendi', slokkvitaeki: 'bord-flettur', kjarni: 'kjarni-vefur' };
const ID_RE = /^[\w.-]{1,40}$/;
const KT_RE = /^\d{6}-?\d{4}$/;

let kortCache = { t: 0, d: null };
async function sidukort() {
  if (kortCache.d && Date.now() - kortCache.t < 600000) return kortCache.d;
  try { const r = await fetch((process.env.URL || 'https://brunaholf.netlify.app') + '/data/sidukort.json'); kortCache = { t: Date.now(), d: r.ok ? await r.json() : { sidur: [] } }; }
  catch (_) { kortCache = { t: Date.now(), d: { sidur: [] } }; }
  return kortCache.d;
}
function finnaSidu(kort, vefur, view, path) {
  const s = (kort.sidur || []).filter(x => x.vefur === vefur && x.leid);
  const v = String(view || '').replace(/^#/, '');
  const p = String(path || '').replace(/\/index\.html$/, '/');
  const base = p.replace(/^\//, '').replace(/\.html$/, '');
  if (v) { const h = s.find(x => x.leid === p + '#' + v) || s.find(x => x.leid === '/#' + v || x.id === v) || s.find(x => x.leid.endsWith('#' + v)); if (h) return h; }   // nákvæm slóð+hash fyrst (jarvis.html#krofur ≠ /#krofur)
  return s.find(x => x.leid === p || x.leid === p.replace(/^\//, ''))          // stök síða: /verkkaupar.html
    || (base && s.find(x => x.id === base || x.leid === '/#' + base))             // síðan sjálf sem hash-sýn í hubbnum: /#jarvis
    || s.find(x => x.leid.startsWith(p + '#'))                                     // fyrsta spjald síðunnar
    || null;
}
async function samhengi(q) {
  const kort = await sidukort();
  const vefur = ['brunaholf', 'slokkvitaeki', 'kjarni'].includes(q.vefur) ? q.vefur : 'brunaholf';
  const sida = finnaSidu(kort, vefur, q.view, q.path);
  let agent = ID_RE.test(q.agent || '') ? q.agent : (sida && sida.eigandi_nafn) || (sida && sida.eigandi) || FALLBACK[vefur];
  agent = String(agent).replace(/^(sl|bh|kj|skill):/, '');
  if (!PROMPTS.agents[agent]) agent = PROMPTS.agents[FALLBACK[vefur]] ? FALLBACK[vefur] : Object.keys(PROMPTS.agents)[0];
  const kt = KT_RE.test(q.kt || '') ? q.kt.replace(/^(\d{6})(\d{4})$/, '$1-$2') : null;
  let kunni = '';
  if (kt) { try { const r = await P.sbPost('rpc/charlize_yfirlit', { kt }); if (r.ok) kunni = (await r.text()).replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"'); } catch (_) {} }
  let stadreyndir = [];
  try { const r = await P.sbGet(`charlize_knowledge?select=topic,fact,created_at&status=eq.active&topic=eq.${encodeURIComponent(agent)}&order=created_at.desc&limit=10`); if (r.ok) stadreyndir = await r.json(); } catch (_) {}
  return { vefur, sida, agent, kt, kunni, stadreyndir, meta: PROMPTS.agents[agent] || {} };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = P.requireStaff(event); if (g) return g;
  try {
    if (event.httpMethod === 'GET') {
      const c = await samhengi(event.queryStringParameters || {});
      return P.json(200, { agent: c.agent, rodd: c.meta.rodd || null, lysing: (c.meta.lysing || '').slice(0, 300), vefur: c.vefur,
        sida: c.sida ? { titill: c.sida.titill, leid: c.sida.leid, eigandi: c.sida.eigandi_nafn || c.sida.eigandi, undiragentar: c.sida.undiragentar || [], stada: c.sida.stada } : null,
        kt: c.kt, kunni: c.kunni ? c.kunni.slice(0, 400) : null, stadreyndir: c.stadreyndir.length });
    }
    if (event.httpMethod !== 'POST') return P.json(405, { error: 'Method not allowed' });
    const origin = String((event.headers && (event.headers.origin || event.headers.Origin)) || '');
    if (origin && !ORIGIN_OK.test(origin) && !LOCAL_OK.test(origin)) return P.json(403, { error: 'Aðeins frá brunaholf.netlify.app' });
    let b; try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
    const c = await samhengi(b);
    const t0 = Date.now();

    if (b.action === 'skra') {
      const fact = String(b.fact || '').trim().slice(0, 600);
      if (fact.length < 10) return P.json(400, { error: 'Staðreyndin er of stutt' });
      const crypto = require('crypto');
      const row = { scope: c.kt ? 'kunni' : (c.vefur === 'slokkvitaeki' ? 'slokkvitaeki' : 'kerfi'), topic: c.kt ? 'thjonusta' : c.agent, fact,
        detail: String(b.detail || '').trim().slice(0, 1500) || null, kennitala: c.kt, source_path: `spyrja:${c.vefur}/${(c.sida && c.sida.id) || b.view || b.path || '?'}`,
        confidence: 'unverified', agent: c.agent, status: 'pending', content_hash: crypto.createHash('sha1').update((c.kt || c.vefur) + '|' + fact).digest('hex') };
      const r = await P.sbPost('charlize_inbox', row);
      const txt = await r.text();
      if (!r.ok) return P.json(502, { error: 'charlize_inbox: ' + txt.slice(0, 200) });
      let id = null; try { id = (JSON.parse(txt)[0] || {}).id || null; } catch (_) {}
      await P.log({ agent: c.agent, action: 'spyrja_skra', target: row.source_path, output: { id, kt: c.kt }, duration_ms: Date.now() - t0, by_who: 'spyrja.html' });
      return P.json(200, { ok: true, id });
    }

    const messages = Array.isArray(b.messages) ? b.messages.slice(-20) : [];
    if (!messages.length || messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 6000)) return P.json(400, { error: 'messages vantar eða rangt snið' });
    const sida = c.sida;
    const SYSTEM = (c.meta.texti || `Þú ert sérfræðingur Slökkvitækja ehf og Brunahólfs ehf með nafnið ${c.agent}.`) +
      `\n\n## Þú ert nú „Spyrja ${c.agent}“ á síðu\n` +
      (sida ? `Síða: ${sida.titill} (${c.vefur}, ${sida.leid}). Eigandi: ${sida.eigandi_nafn || sida.eigandi}. Undiragentar: ${(sida.undiragentar || []).join(', ') || 'engir'}. Skilgreind í: ${(sida.skilgreind || []).join(', ') || '—'}. Kveikjuorð: ${(sida.kveikjuord || []).join(', ') || '—'}.\n` : `Síða: ${b.view || b.path || 'óþekkt'} á ${c.vefur}.\n`) +
      (c.kt ? `\nFYRIRTÆKIÐ Á SKJÁNUM (kt ${c.kt}) — kúnnaminnið úr Charlize:\n${c.kunni.slice(0, 5000) || '(ekkert skráð um þetta félag)'}\n` : '\nEkkert fyrirtæki er á skjánum.\n') +
      (c.stadreyndir.length ? `\nNÝJUSTU STAÐREYNDIR ÞÍNAR Í CHARLIZE (${c.agent}):\n` + c.stadreyndir.map(s => `· ${s.fact}`).join('\n') + '\n' : '') +
      `\nReglur hér: Agnar spyr úr vafranum, oft á síma; svaraðu á íslensku, stutt og áþreifanlegt, með næsta skrefi. Þú FRAMKVÆMIR ekkert og sendir ekkert — þú ráðleggur. Vilji hann skrá eitthvað í minnið á hann að nota „Skráðu þetta“ (fer í biðstofu Charlize). Segðu „ekkert skráð“ aðeins þegar kúnnaminnið er tómt, ekki þegar þú veist ekki. Engar persónukennitölur í svörum.`;
    const req = { model: MODEL, max_tokens: 2500, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], messages: messages.map(m => ({ role: m.role, content: m.content })) };
    const hdr = { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
    let r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: hdr, body: JSON.stringify(req) });
    if (r.status === 400) { delete req.fallbacks; r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: hdr, body: JSON.stringify(req) }); }
    if (!r.ok) { const t = await r.text(); await P.log({ agent: c.agent, action: 'spyrja', status: 'villa', output: t.slice(0, 300), by_who: 'spyrja.html' }); return P.json(502, { error: `Claude ${r.status}: ${t.slice(0, 200)}` }); }
    const data = await r.json();
    if (data.stop_reason === 'refusal') return P.json(422, { error: 'Claude hafnaði spurningunni' });
    const reply = (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
    const u = data.usage || {};
    const usd = ((u.input_tokens || 0) * 4 + (u.output_tokens || 0) * 20 + (u.cache_read_input_tokens || 0) * 0.2 + (u.cache_creation_input_tokens || 0) * 5) / 1e6;
    await P.log({ agent: c.agent, action: 'spyrja', target: `${c.vefur}/${b.view || b.path || '?'}`, output: { kt: c.kt, usd: +usd.toFixed(4), svar: reply.slice(0, 200) }, duration_ms: Date.now() - t0, by_who: 'spyrja.html' });
    return P.json(200, { reply: reply || '(ekkert svar)', agent: c.agent, rodd: c.meta.rodd || null, usd: +usd.toFixed(4) });
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
};
