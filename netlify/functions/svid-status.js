// svid-status.js — „ýttu á svið, fáðu samantekt frá þeirri rödd".
//
//   GET /api/svid-status?svid=por|tengingar
//     → { ok, svid, name, emoji, voice_id, text, tolur }
//
// Hvert svið á sér SÉRFRÆÐING í .claude/agents/ (þekkingin) og RÖDD í
// js/jarvis-voice.js (útrásin). Þetta fall er brúin: það sækir LIFANDI tölur úr
// gagnagrunninum og lætur Claude umorða þær í 2–3 setningar í stíl sviðsins.
// Framendinn (jarvis.html) sendir svo `text` í /api/jarvis-tts með `voice_id`.
//
// Kostnaður er lítill með vilja: Haiku + max_tokens 220, og aðeins TÖLUR fara til
// Claude — aldrei heilar töflur. TTS-svörin cache-ast í /api/jarvis-tts svo sama
// setning er aldrei rukkuð tvisvar.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC    = process.env.ANTHROPIC_API_KEY;
const SELF         = process.env.URL || 'https://brunaholf.netlify.app';

/* ── sviðin ───────────────────────────────────────────────────────────────── */
const SVID = {
  por: {
    name: 'Sara', emoji: '🗂️', agent: 'sara-organizer',
    rodd: 'sara',                                       // lykill í js/jarvis-voice.js
    voice_id: '4575dfa5b64148ad8b48542a5ebd0749',      // Margot Robbie
    kyn: 'kvk',                                         // kvenrödd → ávarpar Anni sem "Annthor"
    still_en: 'Organised, warm and to the point. You tidy things up and say what is still outstanding. No drama.',
    safna: safnaPor,
  },
  tengingar: {
    name: 'Samuel L. Jackson', emoji: '😤', agent: 'tengingar',
    rodd: 'sam',                                        // lykill í js/jarvis-voice.js
    voice_id: 'ce67291306284add89ad9e3db6249ad9',
    kyn: 'kk',                                          // karlrödd → ávarpar Anni sem "Big Boss Anni"
    still_en: 'Direct and emphatic, no filler. States what is fine and what needs fixing NOW. Never rude.',
    safna: safnaTengingar,
  },
};

// Hvernig á að ávarpa notandann UPPHÁTT.
//   Agnar → alltaf "Agnar".
//   Annþór → fer eftir KYNI raddarinnar (ósk Agnars 2026-08-01):
//     karlraddir kalla hann "Big Boss Anni", kvenraddir "Annthor"
//     (stafað hljóðrétt svo ensk TTS-rödd beri það rétt fram).
function avarp(notandi, kyn) {
  if (notandi === 'anni') return kyn === 'kk' ? 'Big Boss Anni' : 'Annthor';
  return 'Agnar';
}

/* ── gagnasöfnun (aðeins tölur — aldrei heilar töflur til Claude) ─────────── */

async function safnaPor() {
  const ar = new Date().getFullYear();
  const raðir = await sb(`v_bundle_coverage?yr=eq.${ar}&select=kind,stada`);
  const t = {};
  (raðir || []).forEach(r => {
    const k = `${r.kind}/${r.stada}`;
    t[k] = (t[k] || 0) + 1;
  });
  const summa = (s) => Object.keys(t).filter(k => k.endsWith('/' + s)).reduce((a, k) => a + t[k], 0);
  return {
    ar,
    klarad:          summa('klarad'),
    vantar_reikning: summa('vantar_reikning'),
    vantar_skyrslu:  summa('vantar_skyrslu'),
    reikn_payday:    summa('reikn_payday'),
    sundurlidad: t,
  };
}

async function safnaTengingar() {
  const r = await fetch(`${SELF}/api/kerfisheilsa`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('kerfisheilsa svaraði ' + r.status);
  const j = await r.json();
  const c = j.counts || {};
  const raud = (j.services || []).filter(s => s.status === 'raudt').map(s => s.heiti);
  const gul  = (j.services || []).filter(s => s.status === 'gult').map(s => s.heiti);
  return {
    graent: c.graent || 0, gult: c.gult || 0, raudt: c.raudt || 0, graat: c.graat || 0,
    alls: (j.services || []).length,
    raud_heiti: raud.slice(0, 5),
    gul_heiti:  gul.slice(0, 5),
  };
}

/* ── handler ──────────────────────────────────────────────────────────────── */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });

  const p = event.queryStringParameters || {};
  const lykill = String(p.svid || '').trim();
  const s = SVID[lykill];
  if (!s) return json(400, { error: 'Óþekkt svið', i_bodi: Object.keys(SVID) });
  const notandi = String(p.notandi || 'agnar').trim().toLowerCase();
  const nafn = avarp(notandi, s.kyn);

  let tolur;
  try { tolur = await withTimeout(s.safna(), 12000); }
  catch (e) { return json(200, {
    ok: true, svid: lykill, name: s.name, emoji: s.emoji, rodd: s.rodd, voice_id: s.voice_id,
    text: 'I cannot reach the numbers right now. The database is not responding.',
    villa: String(e.message || e), tolur: null,
  }); }

  // ?tolur=1 → AÐEINS tölur, ekkert Claude-kall. Notað af HUD-spjöldum sem
  // uppfærast reglulega; þau mega ALDREI kosta pening.
  if (String(p.tolur || '') === '1') {
    return json(200, { ok: true, svid: lykill, name: s.name, emoji: s.emoji, tolur });
  }

  // Engin Claude-lykill → skilaðu samt tölunum með einfaldri setningu.
  if (!ANTHROPIC) {
    return json(200, { ok: true, svid: lykill, name: s.name, emoji: s.emoji, rodd: s.rodd,
      voice_id: s.voice_id, text: einfold(lykill, tolur), tolur });
  }

  let text;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        // Sonnet en ekki Haiku, og ENSKA en ekki íslenska (ósk Agnars 2026-08-01):
        // Haiku bjó til orð sem eru ekki til í íslensku („blikra fyrir reikninga"),
        // og raddirnar eru enskar stjörnuraddir — enskur texti hljómar eðlilega í
        // þeim, íslenskur ekki. Textinn er stuttur svo kostnaðarmunurinn er hverfandi.
        model: 'claude-sonnet-5',
        max_tokens: 220,
        system:
          `You are ${s.name}, a specialist in a fire-safety business system ` +
          `(Brunahólf ehf / Slökkvitæki ehf, Iceland).\n` +
          `Style: ${s.still_en}\n\n` +
          `The person you are talking to is "${nafn}". Address them by that exact name ` +
          'if you address them at all — do not change or translate it.\n' +
          'Write 2-3 short sentences in ENGLISH that will be READ ALOUD by a voice. ' +
          'Lead with the number that matters most. No headings, no bullet points, no ' +
          'markdown, no emoji — just natural spoken English. If something needs action, ' +
          'say so plainly in the last sentence. Keep Icelandic place and company names as they are.',
        messages: [{ role: 'user', content: "Today's numbers:\n" + JSON.stringify(tolur, null, 1) }],
      }),
    });
    const j = await r.json();
    text = (j && j.content && j.content[0] && j.content[0].text || '').trim();
  } catch (_) { /* fellur á einföldu útgáfuna */ }

  return json(200, { ok: true, svid: lykill, name: s.name, emoji: s.emoji, rodd: s.rodd,
    voice_id: s.voice_id, agent: s.agent, text: text || einfold(lykill, tolur), tolur });
};

/* ── varaleið án Claude ───────────────────────────────────────────────────── */
function einfold(lykill, t) {
  if (lykill === 'por') {
    return `Coverage ${t.ar}: ${t.klarad} bundles complete. ${t.vantar_reikning} sites need an ` +
           `invoice and ${t.vantar_skyrslu} need a report.`;
  }
  if (lykill === 'tengingar') {
    return `${t.graent} of ${t.alls} connections are healthy. ` +
           (t.raudt ? `${t.raudt} are red: ${t.raud_heiti.join(', ')}.` : 'None are red.');
  }
  return 'No summary available.';
}

/* ── verkfæri ─────────────────────────────────────────────────────────────── */
async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return r.json();
}
function withTimeout(pr, ms) {
  return Promise.race([pr, new Promise((_, rej) =>
    setTimeout(() => rej(new Error('svaraði ekki innan ' + ms / 1000 + 's')), ms))]);
}
function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type',
           'access-control-allow-methods': 'GET,OPTIONS' };
}
function json(code, obj) {
  return { statusCode: code,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()),
    body: JSON.stringify(obj) };
}
