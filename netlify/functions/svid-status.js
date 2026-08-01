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
    still: 'Skipulögð, hlý og hnitmiðuð. Þú raðar hlutum og segir hvað stendur út af. Engin dramatík.',
    safna: safnaPor,
  },
  tengingar: {
    name: 'Samuel L. Jackson', emoji: '😤', agent: 'tengingar',
    rodd: 'sam',                                        // lykill í js/jarvis-voice.js
    voice_id: 'ce67291306284add89ad9e3db6249ad9',
    still: 'Beinskeyttur og ákveðinn, engin uppfylling. Segir hvað er í lagi og hvað þarf að laga NÚNA. Ekki dónalegur.',
    safna: safnaTengingar,
  },
};

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

  let tolur;
  try { tolur = await withTimeout(s.safna(), 12000); }
  catch (e) { return json(200, {
    ok: true, svid: lykill, name: s.name, emoji: s.emoji, rodd: s.rodd, voice_id: s.voice_id,
    text: 'Ég næ ekki í tölurnar núna — gagnagrunnurinn svarar ekki.',
    villa: String(e.message || e), tolur: null,
  }); }

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 220,
        system:
          `Þú ert ${s.name}, sérfræðingur í rekstrarkerfi Brunahólfs/Slökkvitækja. ` +
          `Stíll: ${s.still}\n\n` +
          'Skrifaðu 2–3 stuttar setningar á ÍSLENSKU sem verða LESNAR UPPHÁTT. ' +
          'Nefndu mikilvægustu tölurnar. Engin fyrirsögn, engin upptalning, engin ' +
          'greinarmerkja-skraut — bara talað mál. Ávarpaðu Agnar ef við á. ' +
          'Ef eitthvað krefst aðgerðar, segðu það skýrt í lokin.',
        messages: [{ role: 'user', content: 'Tölur dagsins:\n' + JSON.stringify(tolur, null, 1) }],
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
    return `Þekja ${t.ar}: ${t.klarad} pör kláruð. ${t.vantar_reikning} staði vantar reikning ` +
           `og ${t.vantar_skyrslu} vantar skýrslu.`;
  }
  if (lykill === 'tengingar') {
    return `${t.graent} tengingar í lagi af ${t.alls}. ` +
           (t.raudt ? `${t.raudt} eru rauðar: ${t.raud_heiti.join(', ')}.` : 'Engin rauð.');
  }
  return 'Engin samantekt í boði.';
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
