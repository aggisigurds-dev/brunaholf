// kt-samraeming.js — the "kt reconciliation" board.
//
// Closes the last gaps in the customer spine WITHOUT ever deleting or merging
// a location. customers_base is the clean kt-root; fyrirtaeki are its
// locations; vidskiptavinir the older customer table. The gaps we surface:
//   • kt-less live fyrirtaeki (have neither kennitala nor customer_base_id)
//   • multi-location kts (one kt across several live fyrirtaeki rows =
//     rekstrarfélög með marga staði — LABEL them, never merge)
//   • vidskiptavinir without a base link / without a kt in customers_base
//
//   GET  /api/kt-samraeming                         → { ktless, multiloc, vidsk, sum }
//   POST /api/kt-samraeming {action:'set-kt',   id, kennitala}   → set kt on fyrirtaeki + find/create base + link
//   POST /api/kt-samraeming {action:'link-base', table, id, customer_base_id}
//   POST /api/kt-samraeming {action:'create-base', kennitala, nafn, heimilisfang}
//   POST /api/kt-samraeming {action:'relabel',  id, nafn?, heimilisfang?}   → fix a mislabelled site
//   POST /api/kt-samraeming {action:'flag-note', id, note}                  → mark a site for review (banner_note)
//
// Pure Supabase REST (service role). Additive only — no deletes, no merges.

const { json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
      switch (body.action) {
        case 'set-kt':      return json(200, await setKt(body));
        case 'link-base':   return json(200, await linkBase(body));
        case 'create-base': return json(200, await createBase(body));
        case 'relabel':     return json(200, await relabel(body));
        case 'flag-note':   return json(200, await flagNote(body));
        default:            return json(400, { error: 'unknown action' });
      }
    }
    return json(200, await overview());
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

// ── Supabase REST helpers ─────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function sbGet(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders({ Range: `${from}-${from + 999}` }) });
    if (!r.ok) throw new Error('sbGet ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const rows = await r.json().catch(() => []);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function sbWrite(method, path, payload, prefer) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' }),
    body: payload == null ? undefined : JSON.stringify(payload),
  });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error(method + ' ' + path.split('?')[0] + ' ' + r.status + ' ' + JSON.stringify(rows).slice(0, 200));
  return rows;
}

// kennitala helpers — digits are the identity; dashed 6-4 is the stored form.
const ktDigits = k => String(k || '').replace(/\D/g, '');
const ktDashed = k => { const d = ktDigits(k); return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : String(k || '').trim(); };
const isKt = k => ktDigits(k).length === 10;

// ── GET: the three worklists ──────────────────────────────────────────────────
async function overview() {
  const [fyr, vsk, bases] = await Promise.all([
    sbGet('fyrirtaeki?deleted_at=is.null&select=id,nafn,heimilisfang,kennitala,customer_base_id,er_i_thjonustu,banner_note'),
    sbGet('vidskiptavinir?deleted_at=is.null&select=id,nafn,kennitala,customer_base_id'),
    sbGet('customers_base?select=id,nafn,kennitala'),
  ]);
  const baseByKt = {};
  bases.forEach(b => { const d = ktDigits(b.kennitala); if (d) baseByKt[d] = b; });

  // (1) kt-less live fyrirtaeki — no kt AND no base link (unlinkable as-is)
  const ktless = fyr
    .filter(f => !isKt(f.kennitala) && f.customer_base_id == null)
    .map(f => ({ id: f.id, nafn: f.nafn, heimilisfang: f.heimilisfang || '', er_i_thjonustu: !!f.er_i_thjonustu }))
    .sort((a, b) => String(a.nafn || '').localeCompare(String(b.nafn || ''), 'is'));

  // (2) multi-location kts — one kt across >1 live fyrirtaeki row
  const byKt = {};
  fyr.forEach(f => { const d = ktDigits(f.kennitala); if (!d) return; (byKt[d] = byKt[d] || []).push(f); });
  const multiloc = Object.keys(byKt).filter(d => byKt[d].length > 1).map(d => {
    const base = baseByKt[d] || {};
    const sites = byKt[d].map(f => ({
      id: f.id, nafn: f.nafn, heimilisfang: f.heimilisfang || '',
      er_i_thjonustu: !!f.er_i_thjonustu, customer_base_id: f.customer_base_id, banner_note: f.banner_note || '',
    })).sort((a, b) => String(a.heimilisfang || '').localeCompare(String(b.heimilisfang || ''), 'is'));
    const addrs = new Set(sites.map(s => (s.heimilisfang || '').trim().toLowerCase()).filter(Boolean));
    return {
      kt: ktDashed(d), base_id: base.id || null, base_nafn: base.nafn || sites[0].nafn,
      sites, site_count: sites.length,
      same_address: addrs.size < sites.length,  // ≥2 sites share one address → likely near-dup, review by eye
    };
  }).sort((a, b) => b.site_count - a.site_count);

  // (3) vidskiptavinir gaps
  const vLive = vsk;
  const vidsk = {
    unlinked: vLive.filter(v => v.customer_base_id == null && isKt(v.kennitala))
      .map(v => ({ id: v.id, nafn: v.nafn, kennitala: ktDashed(v.kennitala), in_base: !!baseByKt[ktDigits(v.kennitala)] })),
    no_kt: vLive.filter(v => !isKt(v.kennitala))
      .map(v => ({ id: v.id, nafn: v.nafn })),
    no_base_kt: vLive.filter(v => isKt(v.kennitala) && !baseByKt[ktDigits(v.kennitala)])
      .map(v => ({ id: v.id, nafn: v.nafn, kennitala: ktDashed(v.kennitala) })),
  };

  return {
    ktless, multiloc, vidsk,
    sum: {
      ktless: ktless.length,
      multiloc_groups: multiloc.length,
      multiloc_extra: multiloc.reduce((n, g) => n + (g.site_count - 1), 0),
      vidsk_unlinked: vidsk.unlinked.length,
      vidsk_no_kt: vidsk.no_kt.length,
      vidsk_no_base_kt: vidsk.no_base_kt.length,
      bases: bases.length, fyr_live: fyr.length,
    },
  };
}

// find-or-create a customers_base row for a kt; returns the base row.
async function findOrCreateBase(kt, nafn, heimilisfang) {
  const d = ktDigits(kt);
  const found = await sbGet(`customers_base?kennitala=eq.${ktDashed(kt)}&select=id,nafn,kennitala`);
  if (found[0]) return found[0];
  // also try digit-only stored form just in case
  const found2 = await sbGet(`customers_base?kennitala=eq.${d}&select=id,nafn,kennitala`);
  if (found2[0]) return found2[0];
  const rows = await sbWrite('POST', 'customers_base', [{ kennitala: ktDashed(kt), nafn: (nafn || '').trim() || ('kt ' + ktDashed(kt)), heimilisfang: (heimilisfang || '').trim() || null }]);
  return Array.isArray(rows) ? rows[0] : rows;
}

// ── POST: set kt on a fyrirtaeki, then find/create its base and link it ────────
async function setKt(body) {
  const id = parseInt(body.id, 10);
  if (!id) throw new Error('vantar id');
  if (!isKt(body.kennitala)) throw new Error('kennitala verður að vera 10 tölustafir');
  const cur = (await sbGet(`fyrirtaeki?id=eq.${id}&select=id,nafn,heimilisfang`))[0];
  if (!cur) throw new Error('fyrirtæki fannst ekki');
  const base = await findOrCreateBase(body.kennitala, cur.nafn, cur.heimilisfang);
  const rows = await sbWrite('PATCH', `fyrirtaeki?id=eq.${id}`, { kennitala: ktDashed(body.kennitala), customer_base_id: base.id });
  return { ok: true, base, fyrirtaeki: Array.isArray(rows) ? rows[0] : null };
}

async function linkBase(body) {
  const id = parseInt(body.id, 10);
  const baseId = parseInt(body.customer_base_id, 10);
  const table = body.table === 'vidskiptavinir' ? 'vidskiptavinir' : 'fyrirtaeki';
  if (!id || !baseId) throw new Error('vantar id / customer_base_id');
  const rows = await sbWrite('PATCH', `${table}?id=eq.${id}`, { customer_base_id: baseId });
  return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
}

async function createBase(body) {
  if (!isKt(body.kennitala)) throw new Error('kennitala verður að vera 10 tölustafir');
  const base = await findOrCreateBase(body.kennitala, body.nafn, body.heimilisfang);
  return { ok: true, base };
}

async function relabel(body) {
  const id = parseInt(body.id, 10);
  if (!id) throw new Error('vantar id');
  const patch = {};
  if (typeof body.nafn === 'string' && body.nafn.trim()) patch.nafn = body.nafn.trim();
  if (typeof body.heimilisfang === 'string') patch.heimilisfang = body.heimilisfang.trim() || null;
  if (!Object.keys(patch).length) throw new Error('ekkert að breyta');
  const rows = await sbWrite('PATCH', `fyrirtaeki?id=eq.${id}`, patch);
  return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
}

// Mark a site for human review — NEVER deletes/merges. Just a note.
async function flagNote(body) {
  const id = parseInt(body.id, 10);
  if (!id) throw new Error('vantar id');
  const rows = await sbWrite('PATCH', `fyrirtaeki?id=eq.${id}`, { banner_note: (body.note || '').trim() || null });
  return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
}
