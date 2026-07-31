// villur.js — VILLUVÖKTUN. Ein leiðsla fyrir JS-villur úr BÁÐUM öppunum.
//
//   POST { uppruni, tegund, skilabod, slod, skra, stafli, vafri, notandi }
//        → skráir villu (samsafnað á fingrafari — endurtekning hækkar teljara)
//   GET  [?dagar=7][&allt=1]  → nýjustu villur (sjálfgefið aðeins ÓLEYSTAR)
//   POST { action:'leysa', id }   → merkja leysta
//   POST { action:'opna',  id }   → taka merkinguna af
//
// AF HVERJU ÞETTA OG EKKI SENTRY STRAX (Agnar 2026-07-31, „villuvöktun —
// stærsta gatið"): Sentry þarf aðgang + DSN sem ekki er til enn. Þetta virkar
// SAMSTUNDIS, notar innviðina sem eru þegar til (Supabase + Kerfisheilsa) og
// útilokar ekki Sentry — sama `villuvakt.js` sendir í hvort tveggja um leið og
// DSN er kominn (sjá `SENTRY_DSN` þar).
//
// ÖRYGGI: `villur` er RLS-varin ÁN anon-reglna. Villuboð bera slóðir,
// notendanöfn og stafla; þau mega ekki fara gegnum anon-lykilinn. Aðeins
// þessi fall (service role) skrifar og les.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UPPRUNAR = ['brunaholf', 'slokkvitaeki'];
const MAX = { skilabod: 500, slod: 300, skra: 300, stafli: 4000, vafri: 300, notandi: 120 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      const dagar = Math.min(90, Math.max(1, +p.dagar || 7));
      const fra = new Date(Date.now() - dagar * 864e5).toISOString();
      let q = `villur?select=*&sidast_at=gte.${fra}&order=sidast_at.desc&limit=${Math.min(200, +p.limit || 60)}`;
      if (p.allt !== '1') q += '&leyst_at=is.null';
      const rows = await sbGet(q);
      const opnar = rows.filter(r => !r.leyst_at);
      return json(200, {
        ok: true,
        counts: {
          opnar: opnar.length,
          atvik: opnar.reduce((s, r) => s + (r.fjoldi || 1), 0),
          // „Nýtt" = villa sem sást fyrst á síðasta sólarhring. Það er þetta sem
          // á að vekja mann, ekki gömul þekkt villa sem tifar áfram.
          nytt: opnar.filter(r => Date.parse(r.fyrst_at) > Date.now() - 864e5).length,
        },
        villur: rows,
      });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    let b = {};
    try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Ógilt JSON' }); }

    if (b.action === 'leysa' || b.action === 'opna') {
      if (!b.id) return json(400, { error: 'id vantar' });
      await sbPatch(`villur?id=eq.${+b.id}`, { leyst_at: b.action === 'leysa' ? new Date().toISOString() : null });
      return json(200, { ok: true });
    }

    // ── skrá villu ────────────────────────────────────────────────────────
    const uppruni = UPPRUNAR.includes(String(b.uppruni)) ? b.uppruni : 'brunaholf';
    const skilabod = klippa(b.skilabod, MAX.skilabod);
    if (!skilabod) return json(400, { error: 'skilabod vantar' });

    const skra = klippa(b.skra, MAX.skra);
    // Fingrafarið ræður samsöfnun. Skilaboð + skrá (EKKI slóð eða tími) — sama
    // villa á tveimur síðum er sama villan og á að telja saman, ekki tvöfaldast.
    const fingrafar = `${uppruni}|${skilabod}|${skra}`.slice(0, 900);

    const nuna = new Date().toISOString();
    const rod = {
      uppruni, tegund: klippa(b.tegund, 40) || 'onerror', skilabod,
      slod: klippa(b.slod, MAX.slod), skra, stafli: klippa(b.stafli, MAX.stafli),
      vafri: klippa(b.vafri, MAX.vafri), notandi: klippa(b.notandi, MAX.notandi),
      fingrafar, fjoldi: 1, fyrst_at: nuna, sidast_at: nuna,
    };

    // Ný villa → insert. Þekkt villa → hækka teljara (og OPNA hana aftur ef hún
    // var merkt leyst: hún er greinilega ekki leyst).
    const r = await sbPost('villur', rod);
    if (r.status === 409) {
      const [til] = await sbGet(`villur?select=id,fjoldi&fingrafar=eq.${encodeURIComponent(fingrafar)}&limit=1`);
      if (til) {
        await sbPatch(`villur?id=eq.${til.id}`, {
          fjoldi: (til.fjoldi || 1) + 1, sidast_at: nuna, leyst_at: null,
          slod: rod.slod, stafli: rod.stafli,
        });
        return json(200, { ok: true, endurtekin: true });
      }
    }
    if (!r.ok && r.status !== 409) return json(500, { error: 'Vistun féll (' + r.status + ')' });
    return json(200, { ok: true, ny: true });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

function klippa(v, n) { return v == null ? null : String(v).slice(0, n); }

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json().catch(() => []) : [];
}
function sbPost(table, row) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
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
function json(code, obj) {
  return {
    statusCode: code,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()),
    body: JSON.stringify(obj),
  };
}
