// svardrog.js — B. Svarhjálp með samhengi (Agentakerfið 2.0, fasi 6, 04.11.2026)
//
//   POST /api/svardrog { email_id, rough?, lang?: 'is'|'en', tone?: string, vista?: boolean (sjálfgefið true) }
//     → { drog, samhengi: { kt, fyrirtaeki, kunni, thradur, greining, stilldaemi }, postsvor_id, usage }
//
// Semur drög að svari við EINUM pósti úr email_digest með öllu sem kerfið veit: greiningin úr postur_ai_yfirlit (A),
// charlize_yfirlit(kt) (kúnnaminni + tengiliðir), þráðurinn (sama thread_id eða sama efni við sama sendanda, ≤ 6),
// fyrri svör OKKAR til sama sendanda sem stíldæmi (≤ 3, lykilorð síuð út), og agent-skrá postur (+ rukkari ef krafa/
// reikningur) úr data/agent-prompts.json sem system-prompt. Claude Opus 5.5, adaptive thinking, prompt-cache á
// agent-prompt. Drögin VISTAST í cowork_postsvor (status 'drog') — Agnar sendir sjálfur. Aldrei sendur póstur héðan.
// Starfsmanna-session (P.requireStaff) + sama Origin-vörn og agent-notes.

const P = require('./_portal');

const ORIGIN_OK = /^https:\/\/([a-z0-9-]+--)?brunaholf\.netlify\.app$/;
const LOCAL_OK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MODEL = 'claude-opus-5-5';
const SITE = process.env.URL || 'https://brunaholf.netlify.app';
const LEYNDARMAL = /lykilor[ðd]|password|passw|notandanafn|aðgangsor[ðd]|pin-?kó[ðd]i|kóði:/i;

let promptsCache = null, promptsTs = 0;
async function agentPrompts() {
  if (promptsCache && Date.now() - promptsTs < 10 * 60 * 1000) return promptsCache;
  try { const r = await fetch(`${SITE}/data/agent-prompts.json`, { cache: 'no-store' }); if (r.ok) { promptsCache = await r.json(); promptsTs = Date.now(); } } catch (_) {}
  return promptsCache || { agents: {} };
}
async function all(qs) { const r = await P.sbGet(qs); if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200)); return r.json(); }
const esc = s => String(s == null ? '' : s);
const ktSnid = s => { const d = String(s || '').replace(/\D/g, ''); return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : null; };
const dags = iso => { const d = new Date(iso || ''); return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
function hreinsaTexta(t, max) { return String(t || '').split(/\r?\n/).filter(l => !LEYNDARMAL.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').slice(0, max); }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'Method not allowed' });
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  if (!process.env.ANTHROPIC_API_KEY) return P.json(500, { error: 'ANTHROPIC_API_KEY vantar í Netlify-umhverfi' });
  const g = P.requireStaff(event); if (g) return g;
  const origin = String((event.headers && (event.headers.origin || event.headers.Origin)) || '');
  if (origin && !ORIGIN_OK.test(origin) && !LOCAL_OK.test(origin)) return P.json(403, { error: 'Aðeins frá brunaholf.netlify.app' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
  const id = Number(b.email_id); if (!Number.isInteger(id) || id <= 0) return P.json(400, { error: 'email_id vantar' });
  const rough = String(b.rough || '').slice(0, 2000), lang = b.lang === 'en' ? 'en' : 'is', tone = String(b.tone || 'vinalegur og hnitmiðaður').slice(0, 60);
  const t0 = Date.now();
  try {
    const [e] = await all(`email_digest?select=id,account,folder,sender_name,sender_email,to_addresses,subject,body_preview,snippet,received_at,thread_id,has_attachment,attachment_names&id=eq.${id}`);
    if (!e) return P.json(404, { error: 'Póstur fannst ekki' });
    const [yf] = await all(`postur_ai_yfirlit?select=yfirlit&mail_id=eq.${id}`);
    const y = (yf && yf.yfirlit) || {};
    const kt = ktSnid(y._kt) || ktSnid(y.kennitala);

    // þráðurinn: sama thread_id, annars sama efni (án Re:/Fw:) við sama sendanda síðustu 180 daga
    const efni = String(e.subject || '').replace(/^\s*((re|fw|fwd|sv|vs)\s*:\s*)+/i, '').trim();
    let thradur = [];
    if (e.thread_id) thradur = await all(`email_digest?select=id,sender_email,subject,body_preview,received_at,folder&thread_id=eq.${encodeURIComponent(e.thread_id)}&id=neq.${id}&order=received_at.desc&limit=6`);
    if (!thradur.length && efni && e.sender_email) thradur = await all(`email_digest?select=id,sender_email,subject,body_preview,received_at,folder&or=(sender_email.eq.${encodeURIComponent(e.sender_email)},to_addresses.ilike.*${encodeURIComponent(e.sender_email)}*)&subject=ilike.*${encodeURIComponent(efni.slice(0, 60))}*&id=neq.${id}&received_at=gte.${new Date(Date.now() - 180 * 864e5).toISOString()}&order=received_at.desc&limit=6`);
    // fyrri svör okkar til sama sendanda (stíldæmi), lykilorð síuð
    const stil = e.sender_email ? await all(`email_digest?select=subject,body_preview,received_at&folder=eq.SENT&to_addresses=ilike.*${encodeURIComponent(e.sender_email)}*&order=received_at.desc&limit=3`) : [];
    // kúnnaminni
    let kunni = '';
    if (kt) { try { const r = await P.sbPost('rpc/charlize_yfirlit', { kt }); if (r.ok) kunni = (await r.text()).replace(/^"|"$/g, '').replace(/\\n/g, '\n'); } catch (_) {} }
    // agent-prompt
    const ap = await agentPrompts();
    const erKrafa = /reikningur|greidsla|krafa|kvortun/.test(String(y.tegund || '')) || /reikning|krafa|greiðsl|vanskil/i.test(efni + ' ' + rough);
    const agentTexti = [ap.agents && ap.agents.postur && ap.agents.postur.texti, erKrafa && ap.agents && ap.agents.rukkari && ap.agents.rukkari.texti].filter(Boolean).join('\n\n---\n\n');

    const erBH = /brunaholf/i.test(e.account || '');
    const SYSTEM = `Þú semur drög að svari við tölvupósti fyrir Agnar Sigurðsson, eiganda Slökkvitækis ehf (slökkvitæki, slöngukefli, brunakerfi, ársskoðanir; Helluhrauni 10, 220 Hafnarfirði, s. 565 4080, eldklar@eldklar.is) og Brunahólfs ehf (brunaþéttingar og eldvarnir í byggingum, brunaholf@brunaholf.is). Pósturinn barst í hólfið ${e.account}, svo svarið er frá ${erBH ? 'Brunahólfi' : 'Slökkvitæki'}.

TÓNN AGNARS: stutt, hlýlegt, beint að efninu; íslenska; ávarp „Sæll [nafn],“ / „Sæl [nafn],“ (eða „Góðan dag,“ ef nafn vantar); eitt til þrjú stutt málsgrein; lokað með „Kveðja,\nAgnar\n${erBH ? 'Brunahólf ehf' : 'Slökkvitæki ehf'}“. Engin uppfyllingarorð, engin upptalning á því sem kúnninn veit þegar. Tónn sem Agnar bað um núna: ${tone}.

REGLUR: Aldrei finna upp verð, dagsetningar, tækjafjölda eða loforð — notaðu aðeins það sem stendur í póstinum, þræðinum, kúnnaminninu eða minnispunktum Agnars; vanti upplýsingar skaltu spyrja kúnnann EINNAR skýrrar spurningar eða skilja eftir [hornklofa] fyrir Agnar að fylla í. Aldrei nefna innri kerfi, verð úr kúnnaminni eða athugasemdir um kúnnann sjálfan. Ekki lofa viðhengi nema minnispunktar nefni það. Skilaðu AÐEINS svartextanum, án efnislínu og án skýringa.${lang === 'en' ? ' Write the reply in English (same tone and rules).' : ''}

${agentTexti ? 'ÞEKKING PÓSTVARÐARINS (agent-skrá, til samhengis — fylgdu reglum hennar um hvað má og má ekki segja):\n' + agentTexti.slice(0, 9000) : ''}`;

    const user = [
      `PÓSTURINN SEM Á AÐ SVARA (id ${e.id}, ${dags(e.received_at)}):`,
      `Frá: ${e.sender_name ? e.sender_name + ' <' + e.sender_email + '>' : e.sender_email}`, `Efni: ${e.subject || ''}`, e.has_attachment && e.attachment_names ? `Viðhengi: ${[].concat(e.attachment_names).join(', ')}` : null, '', hreinsaTexta(e.body_preview || e.snippet, 6000),
      '', y.samantekt ? `GREINING KERFISINS: ${y.tegund || ''} · áríðandi ${y.aridandi ?? '?'} · ${y.samantekt}${y.adgerd ? ' · Aðgerð: ' + y.adgerd : ''}` : 'GREINING KERFISINS: (engin)',
      kt ? `\nKÚNNAMINNI (charlize_yfirlit ${kt}):\n${hreinsaTexta(kunni, 3500) || '(ekkert skráð)'}` : '\nKÚNNAMINNI: (engin kennitala tengd þessum pósti)',
      thradur.length ? `\nÞRÁÐURINN (${thradur.length} fyrri póstar, nýjastir fyrst):\n` + thradur.map(t => `--- ${dags(t.received_at)} ${t.folder === 'SENT' ? 'VIÐ' : t.sender_email} · ${t.subject || ''}\n${hreinsaTexta(t.body_preview, 1200)}`).join('\n') : '',
      stil.length ? `\nFYRRI SVÖR OKKAR TIL ÞESSA SENDANDA (stíldæmi, ekki endurtaka efnið):\n` + stil.map(s => `--- ${dags(s.received_at)} · ${s.subject || ''}\n${hreinsaTexta(s.body_preview, 700)}`).join('\n') : '',
      `\nMINNISPUNKTAR AGNARS UM ÞETTA SVAR: ${rough || '(engir — svaraðu út frá póstinum og samhenginu; vanti ákvörðun sem er hans, spurðu kúnnann hvað hann þarf eða settu [hornklofa])'}`,
      '\nSkrifaðu drögin.'
    ].filter(x => x !== null).join('\n');

    const req = { model: MODEL, max_tokens: 4000, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] };
    let r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' }, body: JSON.stringify(req) });
    if (r.status === 400) { delete req.fallbacks; r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(req) }); }
    if (!r.ok) { const t = await r.text(); await P.log({ agent: 'postur', action: 'svardrog', target: String(id), status: 'villa', output: t.slice(0, 300) }); return P.json(502, { error: `Claude ${r.status}: ${t.slice(0, 300)}` }); }
    const data = await r.json();
    if (data.stop_reason === 'refusal') return P.json(422, { error: 'Claude hafnaði þessari beiðni (' + ((data.stop_details || {}).category || '?') + ')' });
    const drog = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    const usage = data.usage || {};
    const usd = ((usage.input_tokens || 0) * 4 + (usage.output_tokens || 0) * 20 + (usage.cache_read_input_tokens || 0) * 0.2 + (usage.cache_creation_input_tokens || 0) * 5) / 1e6;

    let postsvor_id = null;
    if (b.vista !== false && drog) {
      const row = { forgangur: y.aridandi != null ? Number(y.aridandi) : null, vidskiptavinur: y.fyrirtaeki || e.sender_name || null, netfang: e.sender_email || null, efni: e.subject || null,
        beidni: y.samantekt || hreinsaTexta(e.snippet, 400) || null, uppl: `email_digest ${e.id} · ${e.account} · ${kt ? 'kt ' + kt : 'engin kt'} · þráður ${thradur.length} · ${MODEL}${rough ? ' · minnispunktar: ' + rough.slice(0, 300) : ''}`,
        drog, status: 'drog', flokkur: y.tegund || null, dags: e.received_at || null };
      const ins = await P.sbPost('cowork_postsvor', row);
      if (ins.ok) { const j = await ins.json().catch(() => []); postsvor_id = j[0] && j[0].id; }
    }
    await P.log({ agent: 'postur', action: 'svardrog', target: String(id), felag: kt || null, output: { postsvor_id, usd: +usd.toFixed(3), tokn: { inn: usage.input_tokens, ut: usage.output_tokens, cache: usage.cache_read_input_tokens || 0 }, model: data.model || MODEL }, duration_ms: Date.now() - t0, by_who: 'email-helper' });
    return P.json(200, { drog, samhengi: { kt, fyrirtaeki: y.fyrirtaeki || null, tegund: y.tegund || null, kunni: kunni ? kunni.split('\n').filter(l => /^\s{2}\[/.test(l)).length : 0, thradur: thradur.length, stilldaemi: stil.length, agent: agentTexti ? (erKrafa ? 'postur + rukkari' : 'postur') : '(agent-prompts.json vantar)' }, postsvor_id, usage: { usd: +usd.toFixed(3), inn: usage.input_tokens, ut: usage.output_tokens, cache: usage.cache_read_input_tokens || 0 } });
  } catch (err) {
    return P.json(500, { error: err.message || String(err) });
  }
};
