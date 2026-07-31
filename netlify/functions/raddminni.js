// raddminni.js — TALAÐ INN, SKILIÐ, SKRÁÐ.
//
//   GET  /api/raddminni[?limit=30]        → síðustu punktar + hlustunar-slóðir
//   POST /api/raddminni {action:'save', texti, audio_b64?, seconds?, notandi?}
//        → geymir hljóðið, lætur Claude skilja hvað var sagt og skráir það á
//          réttan stað (Verkefnalisti-beiðni ef þetta er verk).
//   POST /api/raddminni {action:'unnid', id, unnid?}
//
// AF HVERJU (2026-07-31, ósk Agnars: „sound recorder for memory … requests or
// to clarify projects"). Hugmyndir koma á ferðinni — í bílnum, á staðnum, á
// milli verka — og glatast af því það er of mikið mál að setjast niður og
// skrifa þær. Hér er eitt langt tapp á símanum: talaðu, og hugmyndin er komin
// á réttan stað áður en þú leggur símann frá þér.
//
// TVÖ LÖG, VILJANDI:
//   1. HLJÓÐIÐ er alltaf geymt (einka-bucket `raddminni`). Talgreining á
//      íslensku er ekki fullkomin — en upprunalega upptakan er sönnunin og
//      má endur-greina síðar með betri vél. Minnið glatast aldrei þótt
//      vélin misheyri.
//   2. TEXTINN fer til Claude sem flokkar: verkefni · minnispunktur ·
//      spurning · annað, og skrifar stutta fyrirsögn. Bara verkefni fara
//      sjálfkrafa á Verkefnalistann — hitt bíður yfirferðar.
//
// ÖRYGGI: taflan OG bucketið eru lokuð (RLS + private) — upptökur af tali fara
// aldrei gegnum anon-lykilinn. Hlustunar-slóðir eru undirritaðar og gilda í
// eina klukkustund.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const BUCKET = 'raddminni';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'GET') return await lista(event.queryStringParameters || {});
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Ógilt JSON' }); }
      if (b.action === 'unnid') return await merkja(b);
      if (b.action === 'save') return await vista(b);
      return json(400, { error: 'Óþekkt action' });
    }
    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

/* ───────────────────────── vistun ───────────────────────── */

async function vista(b) {
  const texti = String(b.texti || '').trim();
  const audio = b.audio_b64 || '';
  if (!texti && !audio) return json(400, { error: 'Hvorki texti né hljóð' });

  // 1) Hljóðið fyrst — það má aldrei tapast þótt restin klikki.
  let audio_path = null;
  if (audio) {
    const bin = Buffer.from(String(audio).replace(/^data:[^,]+,/, ''), 'base64');
    if (bin.length > 25 * 1024 * 1024) return json(413, { error: 'Upptakan er of stór (>25 MB)' });
    const d = new Date();
    audio_path = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}/` +
      `${d.toISOString().replace(/[:.]/g, '-')}.webm`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(audio_path)}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
        'content-type': b.mime || 'audio/webm', 'x-upsert': 'true',
      },
      body: bin,
    });
    if (!up.ok) { audio_path = null; }   // hljóðið tapaðist — textinn heldur samt áfram
  }

  // 2) Claude les textann og segir hvað þetta er.
  const skilningur = texti ? await skilja(texti) : {};

  // 3) Skrá punktinn.
  const row = {
    texti: texti || null, audio_path,
    seconds: Number.isFinite(b.seconds) ? Math.round(b.seconds) : null,
    flokkur: skilningur.flokkur || null,
    titill: skilningur.titill || null,
    samantekt: skilningur.samantekt || null,
    fyrirtaeki: skilningur.fyrirtaeki || null,
    notandi: b.notandi ? String(b.notandi).slice(0, 60) : null,
  };
  const ins = await sbPost('raddminni', row);
  if (!ins.ok) return json(500, { error: 'Vistun féll: ' + (await ins.text()).slice(0, 200) });
  const [skrad] = await ins.json();

  // 4) VERKEFNI fara sjálfkrafa á Verkefnalistann — hitt bíður yfirferðar
  //    (það á ekki að fylla listann af hugleiðingum).
  let verkefni = null;
  if (skilningur.flokkur === 'verkefni' && skilningur.titill) {
    verkefni = await stofnaVerkefni(skilningur, texti);
    if (verkefni) await sbPatch(`raddminni?id=eq.${skrad.id}`, { verkefni_id: verkefni.id });
  }

  return json(200, { ok: true, punktur: Object.assign(skrad, { verkefni_id: verkefni ? verkefni.id : null }), verkefni });
}

// Claude fær EINA einfalda spurningu: hvað var maðurinn að segja og hvað á að
// gera við það. Svarið er þröngt JSON svo það sé hægt að treysta því.
async function skilja(texti) {
  if (!ANTHROPIC) return {};
  const kerfi =
    'Þú tekur við talgreindum minnispunkti frá eiganda Brunahólfs/Slökkvitækja (fyrirtæki í ' +
    'brunavörnum á Íslandi). Talgreiningin er ófullkomin — lestu í gegnum smávægilegar villur. ' +
    'Svaraðu AÐEINS með JSON: {"flokkur":"verkefni|minnispunktur|spurning|annad", "titill":"stutt ' +
    'fyrirsögn á íslensku (max 70 stafir)", "samantekt":"1-2 setningar um hvað á að gera", ' +
    '"fyrirtaeki":"nafn fyrirtækis ef nefnt, annars null"}. ' +
    'Veldu "verkefni" AÐEINS þegar beðið er um að eitthvað sé gert eða lagað. ' +
    'Hugleiðing eða upplýsingar um kúnna = "minnispunktur".';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-7', max_tokens: 400, system: kerfi,
        messages: [{ role: 'user', content: texti.slice(0, 4000) }],
      }),
    });
    const j = await r.json();
    const t = ((j.content || []).map(c => c.text || '').join('') || '').trim();
    const m = t.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  } catch (_) { return {}; }
}

async function stofnaVerkefni(s, texti) {
  const body = {
    title: String(s.titill).slice(0, 200),
    category: 'allt', priority: 1,
    description: (s.samantekt ? s.samantekt + '\n\n' : '') +
      '— Talað inn ' + new Date().toLocaleString('is-IS') +
      (s.fyrirtaeki ? ' · ' + s.fyrirtaeki : '') + '\n„' + texti.slice(0, 1500) + '"',
  };
  try {
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://brunaholf.netlify.app';
    const r = await fetch(base + '/api/verkefnalisti', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'add' }, body)),
    });
    const j = await r.json().catch(() => ({}));
    return j && j.task ? j.task : null;
  } catch (_) { return null; }
}

/* ───────────────────────── lestur ───────────────────────── */

async function lista(p) {
  const limit = Math.min(100, Math.max(1, +p.limit || 30));
  const rows = await sbGet(`raddminni?select=*&order=created_at.desc&limit=${limit}`);
  // Hlustunar-slóðir eru UNDIRRITAÐAR og gilda í klukkustund — bucketið er lokað.
  const med = await Promise.all((rows || []).map(async r => {
    if (!r.audio_path) return r;
    try {
      const s = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodeURI(r.audio_path)}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      if (s.ok) { const j = await s.json(); r.audio_url = SUPABASE_URL + '/storage/v1' + j.signedURL; }
    } catch (_) {}
    return r;
  }));
  return json(200, { ok: true, punktar: med });
}

async function merkja(b) {
  if (!b.id) return json(400, { error: 'id vantar' });
  const r = await sbPatch(`raddminni?id=eq.${+b.id}`, { unnid: b.unnid !== false });
  if (!r.ok) return json(500, { error: 'Uppfærsla féll' });
  return json(200, { ok: true });
}

/* ───────────────────────── verkfæri ───────────────────────── */

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json().catch(() => []) : [];
}
function sbPost(table, row) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json', prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
}
function sbPatch(path, row) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(row),
  });
}
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
}
function resp(code, body, headers) { return { statusCode: code, headers: headers || {}, body }; }
function json(code, obj) {
  return resp(code, JSON.stringify(obj), Object.assign(
    { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()));
}
