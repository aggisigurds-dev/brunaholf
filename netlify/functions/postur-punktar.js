// postur-punktar.js — Póstvörður Eldklárs: les AÐEINS eldklar@eldklar.is úr email_digest,
// finnur pósta sem varða reikninga/kröfur/úttektir/tilboð/kennitölur og skráir þá sem punkta
// í Drög-stöðina (reikningspunktar, felag slokkvitaeki, source postur). Agnar 05.09.2026:
// „kanski special agent — bara eldklar@eldklar.is". Ekkert AI: lykilorð + síur + kt-mátun.
//
//   POST /api/postur-punktar { action:'forskoda', days?:14 }  → { candidates[], skipped, since }
//   POST /api/postur-punktar { action:'skra',     days?:14 }  → { created[], already, candidates }
//   GET  /api/postur-punktar?days=14                           = forskoda
//
// Tvítökuvörn: client_id = 'mail:' + message_id er UNIQUE í reikningspunktar — má keyra
// aftur og aftur. Kúnnamátun: kennitala í texta → fyrirtaeki.kennitala; annars sendanda-
// netfang/lén → fyrirtaeki.netfang. Passi ekkert er worksite_name tómt (Agnar velur).
// Aðeins INBOX: það sem VIÐ sendum (reikningar, Efnislistar til bókara) er ekki punktur.

const P = require('./_portal');

const ACCOUNT = 'eldklar@eldklar.is';
const THRESH = 2;
// Jákvæð merki — kúnni biður um reikning/þjónustu, sendir kt, staðfestir verk, deilir um kröfu.
const POS = [
  /send[a-zð]*\s+(mér\s+)?reikning/i, /reikninginn/i, /kennitala|\bkt\.?\s*\d{6}-?\d{4}/i, /invoice\s+to|invoice/i,
  /l[öo]ginnheimt|kröfu|krafa/i, /greiðsla\s+frá|greitt|payment/i, /úttekt|uttekt|eftirlit|skoðun/i,
  /áfylling|refill|hylki|cylinder/i, /tilboð|quotation|\bRFQ\b|price/i, /pöntun|panta|order/i,
  /slökkvitæk|reykskynjar|brunakerfi|brunaslang|brunavarn/i, /verk(ið|inu)\s+(er\s+)?(lokið|búið|klárað)/i,
];
// Neikvæð merki — birgjareikningar, fréttabréf, sjálfvirkar tilkynningar.
const NEG = [
  /sölureikningur|reikningsyfirlit|reikningur\s+nr\.?\s*\d|\bSR-\d|innheimtuseðill/i,
  /afsláttur\s+af|tilboðsdag|newsletter|unsubscribe|afskrá/i,
  /security alert|new sign-in|verify your|password/i, /móttekið rafrænt skjal|færsla þjónustuaðila/i,
];
const BLOCK_DOMAINS = /(^|\.)(husa\.is|alfred\.is|google\.com|microsoft\.com|engagement\.microsoft\.com|unimaze\.com|veldix\.is|barki\.is|pitstop\.is|facebookmail\.com|linkedin\.com|apple\.com|payday\.is|netlify\.com|github\.com)$/i;
const NOREPLY = /^(no-?reply|noreply|donotreply|notification|notifications|mailer-daemon|postmaster)@/i;
const KT = /\b(\d{6})-?(\d{4})\b/g;
// Eigin félög: kt Slökkvitækis stendur í hverjum reikningspósti sem VIÐ sendum — mátun á þau væri alltaf röng.
const OWN = /^(brunah[óo]lf|sl[öo]kkvit[æa]ki|eldkl[áa]r)/i;

const lc = (s) => String(s || '').trim().toLowerCase();
const digits = (s) => String(s || '').replace(/\D/g, '');
const domain = (e) => { const m = lc(e).match(/@([^>\s]+)/); return m ? m[1] : ''; };
function dmy(iso) { const d = new Date(iso); return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0'); }
async function all(qs) { const r = await P.sbGet(qs); if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200)); return r.json(); }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = P.requireStaff(event); if (g) return g;
  let b = {};
  if (event.httpMethod === 'POST') { try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); } }
  else b = Object.assign({ action: 'forskoda' }, event.queryStringParameters || {});
  const action = b.action || 'forskoda';
  const days = Math.min(60, Math.max(1, parseInt(b.days, 10) || 14));
  try {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const [mails, felog, already] = await Promise.all([
      all(`email_digest?select=id,message_id,folder,sender_name,sender_email,subject,snippet,body_preview,is_question,has_attachment,attachment_names,received_at&account=eq.${encodeURIComponent(ACCOUNT)}&folder=eq.INBOX&received_at=gte.${since}&order=received_at.desc&limit=400`),
      all('fyrirtaeki?select=id,nafn,kennitala,netfang&deleted_at=is.null&limit=3000').catch(() => []),
      all('reikningspunktar?select=client_id,status&client_id=like.mail%3A*&limit=5000').catch(() => []),
    ]);
    const byKt = new Map(), byMail = new Map(), byDom = new Map();
    for (const f of felog) {
      const kt = digits(f.kennitala); if (kt.length === 10 && !byKt.has(kt)) byKt.set(kt, f);
      const m = lc(f.netfang); if (m && !byMail.has(m)) byMail.set(m, f);
      const d = domain(f.netfang); if (d && !/gmail|hotmail|simnet|outlook|yahoo|icloud|live\.com/.test(d) && !byDom.has(d)) byDom.set(d, f);
    }
    const doneSet = new Map(already.map((r) => [r.client_id, r.status]));

    const candidates = []; let skipped = 0;
    for (const m of mails) {
      const from = lc(m.sender_email), dom = domain(from);
      const text = [m.subject, m.snippet, m.body_preview].filter(Boolean).join(' \n ');
      let score = 0; const hits = [];
      if (NOREPLY.test(from) || BLOCK_DOMAINS.test(dom)) score -= 10;
      for (const re of NEG) if (re.test(text)) { score -= 5; break; }
      for (const re of POS) if (re.test(text)) { score += 2; hits.push(String(re).replace(/^\/|\/i$/g, '').split('|')[0]); if (hits.length >= 4) break; }
      if (m.is_question) score += 2;
      if (score < THRESH) { skipped++; continue; }
      // Kúnnamátun: kt í texta gengur fyrir, svo netfang, svo lén.
      let kunni = null, how = null;
      const kts = [...text.matchAll(KT)].map((x) => x[1] + x[2]);
      for (const kt of kts) { const f = byKt.get(kt); if (f && !OWN.test(f.nafn || '')) { kunni = f; how = 'kt ' + kt.slice(0, 6) + '-' + kt.slice(6); break; } }
      if (!kunni && byMail.has(from) && !OWN.test(byMail.get(from).nafn || '')) { kunni = byMail.get(from); how = 'netfang'; }
      if (!kunni && byDom.has(dom) && !OWN.test(byDom.get(dom).nafn || '')) { kunni = byDom.get(dom); how = 'lén'; }
      const cid = 'mail:' + (m.message_id || ('id' + m.id));
      const snip = String(m.snippet || m.body_preview || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const att = Array.isArray(m.attachment_names) && m.attachment_names.length ? '\n📎 ' + m.attachment_names.slice(0, 3).join(', ') : '';
      candidates.push({
        id: m.id, message_id: m.message_id, client_id: cid, received_at: m.received_at, score, hits,
        sender: m.sender_name || m.sender_email, sender_email: m.sender_email, subject: m.subject,
        kunni: kunni ? kunni.nafn : null, kunni_id: kunni ? kunni.id : null, kunni_hvernig: how,
        already: doneSet.has(cid) ? doneSet.get(cid) : null,
        raw: '✉ ' + (m.sender_name || m.sender_email) + ' · ' + (m.subject || '(ekkert efni)') + ' (' + dmy(m.received_at) + ')\n' + snip + att,
      });
    }
    // Þræðir: sama efni (Re:/FW: strípað) frá sama léni = EINN punktur með nýjasta póstinum, hinir taldir.
    const groups = new Map();
    for (const c of candidates) {
      const key = lc(String(c.subject || '').replace(/^\s*((re|fw|fwd|sv|vs)\s*:\s*)+/i, '')) + '|' + domain(c.sender_email);
      const g = groups.get(key);
      if (!g) groups.set(key, c);
      else if (String(c.received_at) > String(g.received_at)) { c.eldri = (g.eldri || 0) + 1; c.eldri_ids = [...(g.eldri_ids || []), g.client_id]; groups.set(key, c); }
      else { g.eldri = (g.eldri || 0) + 1; g.eldri_ids = [...(g.eldri_ids || []), c.client_id]; }
    }
    const threads = [...groups.values()].map((c) => Object.assign(c, {
      raw: c.raw + (c.eldri ? '\n(+' + c.eldri + ' eldri póst' + (c.eldri === 1 ? 'ur' : 'ar') + ' í sama þræði)' : ''),
      already: c.already || (c.eldri_ids || []).map((id) => doneSet.get(id)).find(Boolean) || null,
    }));
    threads.sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)));
    if (action !== 'skra') return P.json(200, { ok: true, account: ACCOUNT, since, days, candidates: threads, threads: threads.length, raw_candidates: candidates.length, skipped, alls: mails.length });

    const created = []; let dup = 0;
    for (const c of threads) {
      if (c.already) { dup++; continue; }
      const r = await P.sbPost('reikningspunktar', { raw: c.raw, felag: 'slokkvitaeki', source: 'postur', author: 'Póstvörður · ' + ACCOUNT, client_id: c.client_id, status: 'nytt', worksite_name: c.kunni, attachments: [] });
      if (r.ok) { const rows = await r.json(); created.push({ id: rows[0] && rows[0].id, sender: c.sender, subject: c.subject, kunni: c.kunni }); }
      else if (r.status === 409) dup++;
    }
    return P.json(200, { ok: true, account: ACCOUNT, since, days, created, already: dup, candidates: threads.length, skipped });
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
};
