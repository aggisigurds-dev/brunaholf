// punktur-greining.js — Drög-stöð, áfangi 2: flokkar reikningspunkt með skema-þvinguðu
// JSON (output_config.format json_schema — ekkert regex-gisk eins og raddminni.js).
// Skilar TILLÖGU inn á punktinn (reikningspunktar.ai); skrifar ALDREI í invoice_drafts —
// það gerist aðeins þegar Agnar ýtir á ✓ (reikningspunktar.js action:'apply').
//
//   POST /api/punktur-greining { id, force? }  → { ok, ai, cached, locked? }
//
// ÖRYGGI — fail-CLOSED: gervigreind kostar. Fallið neitar (503, locked:true) þar til
// HUB_STAFF_PASSWORD er sett í Netlify og krefst þá gilds starfsmanna-session. Þetta er
// viljandi öfugt við luna.js sem er opið. Auk þess: hámark 60 köll/klst (app_kv) og
// skyndiminni á sha256(raw + samhengi) svo sami punktur er aldrei greiddur tvisvar.

const crypto = require('crypto');
const P = require('./_portal');

const ANTHROPIC = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.PUNKTUR_MODEL || 'claude-sonnet-5';
const HAMARK_KLST = 60;

const isMonth = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
const lc = (s) => String(s || '').trim().toLowerCase();
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
async function all(qs) { const r = await P.sbGet(qs); if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); }
function monthsAgo(n) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 7); }

// Skemað sem Claude VERÐUR að fylgja. Engin talna-/lengdarmörk (ekki stutt í json_schema),
// null gegnum anyOf, additionalProperties:false alls staðar.
const nullable = (t) => ({ anyOf: [{ type: t }, { type: 'null' }] });
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    verkstadur: nullable('string'),
    manudur: nullable('string'),
    vissa: { type: 'number' },
    tegund: { type: 'string', enum: ['klst', 'efni', 'gjald', 'greidandi', 'upplysing', 'spurning'] },
    tolur: {
      type: 'object', additionalProperties: false,
      properties: { klst: nullable('number'), ev_klst: nullable('number'), upphaed: nullable('number'), magn: nullable('number'), eining: nullable('string'), efni_heiti: nullable('string'), greidandi: nullable('string'), kennitala: nullable('string') },
      required: ['klst', 'ev_klst', 'upphaed', 'magn', 'eining', 'efni_heiti', 'greidandi', 'kennitala'],
    },
    samantekt: { type: 'string' },
    spurningar: { type: 'array', items: { type: 'string' } },
  },
  required: ['verkstadur', 'manudur', 'vissa', 'tegund', 'tolur', 'samantekt', 'spurningar'],
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  if (!P.hubConfigured()) return P.json(503, { locked: true, error: 'Flokkunin er læst þar til starfsmanna-innskráning er virk (HUB_STAFF_PASSWORD í Netlify). Þangað til: veldu verkið handvirkt.' });
  const g = P.requireStaff(event); if (g) return g;
  if (!ANTHROPIC) return P.json(503, { locked: true, error: 'ANTHROPIC_API_KEY vantar í Netlify' });

  let b; try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
  const id = Number(b.id); if (!id) return P.json(400, { error: 'id vantar' });
  try {
    const [note] = await all(`reikningspunktar?select=*&id=eq.${id}`);
    if (!note) return P.json(404, { error: 'Punktur fannst ekki' });
    if (note.ai && !b.force) return P.json(200, { ok: true, ai: note.ai, cached: true });

    // Lítið samhengi — aldrei heilar töflur. Brunahólf: opin drög + verkstaðaheiti.
    // Slökkvitæki: kúnnalistinn (fyrirtaeki.nafn) — markið er kúnni, ekki verkstaður|mánuður.
    const SL = note.felag === 'slokkvitaeki';
    const cutoff = monthsAgo(4);
    const [drafts, pg, aliases, felog] = await Promise.all([
      SL ? [] : all(`invoice_drafts?select=worksite_name,work_month,total_m_vsk,customer_name&work_month=gte.${cutoff}&status=eq.draft&order=work_month.desc&limit=200`),
      SL ? [] : all('pricing_guide?select=worksite_name,customer_name&limit=300').catch(() => []),
      SL ? [] : all('project_aliases?select=canonical_name,alias&limit=500').catch(() => []),
      SL ? all('fyrirtaeki?select=nafn&deleted_at=is.null&order=nafn&limit=1500').catch(() => []) : [],
    ]);
    const verk = drafts.map((d) => `${d.worksite_name} | ${d.work_month} | ${Math.round(Number(d.total_m_vsk) || 0)} kr${d.customer_name ? ' | greiðandi: ' + d.customer_name : ''}`);
    const nofn = SL
      ? [...new Set(felog.map((f) => f.nafn).filter(Boolean))]
      : [...new Set([...drafts.map((d) => d.worksite_name), ...pg.map((p) => p.worksite_name), ...aliases.map((a) => a.canonical_name)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'is'));
    const alias = aliases.filter((a) => a.alias && a.canonical_name && lc(a.alias) !== lc(a.canonical_name)).map((a) => `${a.alias} → ${a.canonical_name}`).slice(0, 120);
    const ctxVer = sha(nofn.join('|') + verk.join('|')).slice(0, 12);
    const cacheKey = 'punktur_greining:' + sha(String(note.raw) + '|' + ctxVer).slice(0, 40);

    // Skyndiminni: sami punktur + sama samhengi → sama svar, ekkert kall.
    const cached = await all(`app_kv?select=value&key=eq.${encodeURIComponent(cacheKey)}`).catch(() => []);
    let ai = cached[0] && cached[0].value && cached[0].value.ai ? cached[0].value.ai : null;
    let hit = !!ai;

    if (!ai) {
      const rl = await rateLimit(); if (rl) return rl;
      const idag = new Date().toISOString().slice(0, 10);
      const system =
        (SL
          ? 'Þú raðar stuttum reikningspunkti frá eiganda Slökkvitækis ehf (þjónusta og sala slökkvitækja, brunavarnaúttektir á Íslandi) á réttan KÚNNA. verkstadur = nafn kúnnans NÁKVÆMLEGA eins og það stendur í listanum. '
          : 'Þú raðar stuttum reikningspunkti frá eiganda Brunahólfs ehf (brunaþéttingar/brunavarnir á Íslandi) á rétt verk. Verkstaðir eru heimilisföng eða heiti verkefna. ') +
        'Punkturinn er skrifaður í flýti — lestu í gegnum styttingar og villur. ' +
        'Dagsetning í dag: ' + idag + '. Veldu manudur (YYYY-MM) út frá því hvenær vinnan var unnin (t.d. „í gær", „í síðustu viku"), annars líðandi mánuð; ' +
        (SL ? '' : 'ef opin drög eru til fyrir verkstaðinn í nálægum mánuði, veldu þann mánuð. ') +
        'tegund: klst = vinnustundir sem á að bæta við; efni = efni/vara sem á að rukka; gjald = samið/fast verð eða heildarupphæð; ' +
        'greidandi = hver borgar (fyrirtæki/kt); upplysing = staðreynd sem á að fylgja verkinu; spurning = eitthvað sem þarf að afgreiða áður en sent er. ' +
        'vissa er 0–1 um að verkstaðurinn OG mánuðurinn séu rétt; undir 0,6 ef þig vantar upplýsingar. ' +
        'samantekt er ein setning á íslensku. spurningar = það sem Agnar þarf að svara áður en punkturinn fer í drögin (tómur listi ef ekkert). ' +
        'Skrifaðu verkstaðaheitið NÁKVÆMLEGA eins og það stendur í listanum, eða null ef ekkert passar.';
      const user =
        (SL ? 'KÚNNAR:\n' : 'ÞEKKT VERKSTAÐAHEITI:\n') + nofn.join('\n') +
        (alias.length ? '\n\nSAMHEITI:\n' + alias.join('\n') : '') +
        (SL ? '' : '\n\nOPIN DRÖG (verkstaður | mánuður | upphæð):\n' + (verk.join('\n') || '(engin)')) +
        '\n\nPUNKTUR:\n' + String(note.raw).slice(0, 3000) +
        (note.created_at ? '\n\n(skráður ' + String(note.created_at).slice(0, 16).replace('T', ' ') + ')' : '');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 700, system,
          messages: [{ role: 'user', content: user }],
          output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return P.json(502, { error: 'Claude ' + r.status + ': ' + JSON.stringify(j).slice(0, 300) });
      const text = (j.content || []).map((c) => c.text || '').join('');
      try { ai = JSON.parse(text); } catch { return P.json(502, { error: 'Svarið var ekki gilt JSON', raw: text.slice(0, 300) }); }
      ai.model = MODEL; ai.greint = new Date().toISOString();
      await P.sbPost('app_kv?on_conflict=key', { key: cacheKey, value: { ai, note_id: id }, updated_at: new Date().toISOString() }, { Prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => {});
    }
    // Verkstaðaheitið verður að vera eitt af þekktu heitunum — annars engin röðun.
    if (ai.verkstadur && !nofn.some((n) => lc(n) === lc(ai.verkstadur))) { ai.spurningar = [...(ai.spurningar || []), 'Verkstaðurinn „' + ai.verkstadur + '" fannst ekki — veldu hann handvirkt']; ai.verkstadur = null; ai.vissa = Math.min(Number(ai.vissa) || 0, 0.5); }
    if (ai.manudur && !isMonth(ai.manudur)) ai.manudur = null;

    const patch = { ai, updated_at: new Date().toISOString() };
    if (note.status === 'nytt') patch.status = 'flokkad';
    // Röðun á punktinum sjálfum (ekki drögunum) þegar vissan er nóg — apply er eftir sem áður ✓ Agnars.
    if (!note.worksite_name && ai.verkstadur && Number(ai.vissa) >= 0.6) patch.worksite_name = nofn.find((n) => lc(n) === lc(ai.verkstadur)) || ai.verkstadur;
    if (!note.work_month && ai.manudur && Number(ai.vissa) >= 0.6) patch.work_month = ai.manudur;
    await P.sbPatch(`reikningspunktar?id=eq.${id}`, patch);
    return P.json(200, { ok: true, ai, cached: hit, filed: !!(patch.worksite_name || patch.work_month) });
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
};

// 60 köll/klst — talið í app_kv (sama geymsla og svid-status notar). Nóg fyrir einn mann,
// stoppar hlaup ef eitthvað fer í lykkju.
async function rateLimit() {
  const key = 'punktur_greining_rl:' + new Date().toISOString().slice(0, 13);
  const cur = await all(`app_kv?select=value&key=eq.${encodeURIComponent(key)}`).catch(() => []);
  const n = Number(cur[0] && cur[0].value && cur[0].value.n) || 0;
  if (n >= HAMARK_KLST) return P.json(429, { error: 'Hámark ' + HAMARK_KLST + ' flokkanir á klukkustund — reyndu aftur síðar' });
  await P.sbPost('app_kv?on_conflict=key', { key, value: { n: n + 1 }, updated_at: new Date().toISOString() }, { Prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => {});
  return null;
}
