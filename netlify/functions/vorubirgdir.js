// vorubirgdir.js — 🏷️ Vörubirgðir: EIN vörulisti þvert á Slökkvitæki + Brunakerfi.
//
// Les/skrifar SÖMU `vorur`-töflu og Slökkvitæki Sala-síðan (deildur Supabase),
// svo hér er hægt að skrá inn- og söluverð fyrir allar vörur sem við SELJUM
// (allt sem er á Sölu-síðunni) OG bæta við brunakerfis-búnaði (skynjarar, tæki,
// o.fl.). `flokkur` er tengipunkturinn — brunakerfis-verk geta síðar sótt vörur
// eftir flokki.
//
//   GET  /api/vorubirgdir
//     → { products:[…vorur…], categories:[str], generated_at }
//        Hver vara: id, nafn, flokkur, birgi, kostnadarverd (kaupverð án vsk),
//        verd_an_vsk (söluverð án vsk), vsk_prosenta, birgdir (lager),
//        virkt, lysing, dk_vorunr, created_at.
//
//   POST /api/vorubirgdir  { action, … }
//     • action:'save'  { product:{ id?, nafn, flokkur, birgi, kostnadarverd,
//                        verd_an_vsk, vsk_prosenta, birgdir, virkt, lysing } }
//         → INSERT (ekkert id) eða PATCH (id). Skilar vistuðu röðinni.
//         ALLTAF LEYFA VISTUN — engin skyldu-svið nema nafn (annars nafnlaus vara).
//     • action:'delete' { id }
//         → eyðir röð. NB varan hverfur þá líka af Sölu-síðunni — notaðu heldur
//           virkt=false til að fela hana. Skilar { ok:true }.
//
// Mirrors the automations.js REST pattern (SUPABASE_URL + SERVICE_ROLE_KEY,
// cors/json/sbFetch helpers). Rides the generic /api/* → functions redirect.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COLS = 'id,nafn,flokkur,birgi,kostnadarverd,verd_an_vsk,vsk_prosenta,birgdir,virkt,lysing,dk_vorunr,created_at';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod === 'GET') return handleGet();
  if (event.httpMethod === 'POST') return handlePost(event);
  return json(405, { error: 'Method not allowed' });
};

async function handleGet() {
  let products;
  try {
    products = await fetchAll('vorur', `select=${COLS}&order=flokkur.asc.nullslast,nafn.asc`);
  } catch (e) { return json(502, { error: e.message }); }
  const cats = Array.from(new Set(products.map(p => (p.flokkur || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'is'));
  return json(200, { generated_at: new Date().toISOString(), products, categories: cats });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { error: 'Invalid JSON' }); }
  const action = body.action;

  if (action === 'save') {
    const p = body.product || {};
    // Byggja hreina röð — aðeins þekkt svið, tölur normaliseraðar. ALLTAF LEYFA VISTUN.
    const row = {
      nafn: (p.nafn == null ? '' : String(p.nafn)).trim(),
      flokkur: p.flokkur == null || String(p.flokkur).trim() === '' ? null : String(p.flokkur).trim(),
      birgi: p.birgi == null || String(p.birgi).trim() === '' ? null : String(p.birgi).trim(),
      lysing: p.lysing == null || String(p.lysing).trim() === '' ? null : String(p.lysing).trim(),
      kostnadarverd: numOrNull(p.kostnadarverd),
      verd_an_vsk: numOr(p.verd_an_vsk, 0),
      vsk_prosenta: numOr(p.vsk_prosenta, 24),
      birgdir: intOrNull(p.birgdir),
      virkt: p.virkt === false ? false : true,
    };
    try {
      const id = p.id != null && String(p.id).trim() !== '' ? String(p.id) : null;
      let r;
      if (id) {
        r = await sbFetch(`vorur?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(row),
        });
      } else {
        r = await sbFetch('vorur', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(row),
        });
      }
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      const out = await r.json();
      return json(200, { ok: true, product: Array.isArray(out) ? out[0] : out });
    } catch (e) { return json(502, { error: e.message }); }
  }

  if (action === 'delete') {
    const id = body.id;
    if (id == null || String(id).trim() === '') return json(400, { error: 'id required' });
    try {
      const r = await sbFetch(`vorur?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      return json(200, { ok: true });
    } catch (e) { return json(502, { error: e.message }); }
  }

  return json(400, { error: 'Unknown action' });
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function numOr(v, dflt) { const n = numOrNull(v); return n == null ? dflt : n; }
function intOrNull(v) { const n = numOrNull(v); return n == null ? null : Math.round(n); }

function sbFetch(qs, opts = {}) {
  const headers = Object.assign(
    { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    opts.headers || {},
  );
  return fetch(`${SUPABASE_URL}/rest/v1/${qs}`, { ...opts, headers });
}
async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await sbFetch(`${table}?${qs}`, {
      headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
