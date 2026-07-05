// kunnagrunnur.js — live snapshot of the customer data model for the Bakendi
// „🗃️ Kúnnagagnagrunnur" page. Read-only. Returns every service company with its
// tags + every customer_documents row with its link status, so the office can see
// „hvað er tengt og hvað ekki" in one place and drive the cleanup.
//
//   GET /api/kunnagrunnur → { C:[companies], D:[docs], sum:{…}, generated:isoish }
//
// Tags per company: þjónusta (er_i_thjonustu OR ars-subscribed/equipment), brunakerfi
// (app_settings.brunakerfi_customers), ferða, banki (is_bank_only), fjölstaður
// (kt on >1 live row), án kt, án base. Doc flags: munaðarl./án staðar/tvítak/ruglað
// nafn/ekkert drive. Nothing is written.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    // app_settings blob → service maps keyed by fyrirtaeki id
    let ars = {}, bru = {}, fer = {};
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=settings&id=eq.1`, { headers: hdr() });
      const j = await r.json(); const s = (j[0] && j[0].settings) || {};
      ars = s.arsskodun_customers || {}; bru = s.brunakerfi_customers || {}; fer = s.ferdathjonusta_customers || {};
    } catch (_) {}

    const [fyr, base, docs] = await Promise.all([
      fetchAll('fyrirtaeki', 'select=id,nafn,kennitala,heimilisfang,er_i_thjonustu,status,is_bank_only,customer_base_id,deleted_at'),
      fetchAll('customers_base', 'select=id,nafn,kennitala'),
      fetchAll('customer_documents', 'select=id,doc_type,year,customer_base_id,fyrirtaeki_id,drive_file_id,reviewed,is_duplicate,customer_name,notes,found_by'),
    ]);

    const ktCount = {};
    fyr.forEach(f => { if (f.deleted_at) return; const k = digits(f.kennitala); if (k.length === 10) ktCount[k] = (ktCount[k] || 0) + 1; });
    const docByFyr = {}, docByBase = {};
    docs.forEach(d => { if (d.fyrirtaeki_id) docByFyr[d.fyrirtaeki_id] = (docByFyr[d.fyrirtaeki_id] || 0) + 1;
      if (d.customer_base_id) docByBase[d.customer_base_id] = (docByBase[d.customer_base_id] || 0) + 1; });
    const baseName = {}; base.forEach(b => baseName[b.id] = b.nafn);
    const fyrName = {}; fyr.forEach(f => fyrName[f.id] = f.nafn);

    const C = fyr.filter(f => !f.deleted_at).map(f => {
      const id = f.id, k = digits(f.kennitala); const t = [];
      const inServ = f.er_i_thjonustu === true || (ars[id] && (ars[id].subscribed || (ars[id].equipment && Object.values(ars[id].equipment).some(v => +v > 0))));
      if (inServ) t.push('þjónusta');
      if (bru[id]) t.push('brunakerfi');
      if (fer[id]) t.push('ferða');
      if (f.is_bank_only) t.push('banki');
      if (k.length === 10 && ktCount[k] > 1) t.push('fjölstaður');
      if (!k || k.length !== 10) t.push('án kt');
      if (!f.customer_base_id) t.push('án base');
      const docN = (docByFyr[id] || 0) || (f.customer_base_id ? (docByBase[f.customer_base_id] || 0) : 0);
      return { id, n: f.nafn || '', k: f.kennitala || '', a: f.heimilisfang || '', t,
        b: f.customer_base_id || null, sites: (k.length === 10 ? (ktCount[k] || 1) : 1), docs: docN };
    });

    const TYS = { uttektarskyrsla: 'skýrsla', reikningur: 'reikn.', samningur: 'samn.' };
    const D = docs.map(d => {
      const nm = (d.customer_name || (d.notes ? String(d.notes).split(' · ')[0] : '') || '').slice(0, 80);
      const lk = d.fyrirtaeki_id ? (fyrName[d.fyrirtaeki_id] || ('#' + d.fyrirtaeki_id))
        : d.customer_base_id ? (baseName[d.customer_base_id] || ('base#' + d.customer_base_id)) : null;
      const fl = [];
      if (!d.customer_base_id && !d.fyrirtaeki_id) fl.push('munaðarl.');
      else if (!d.fyrirtaeki_id) fl.push('án staðar');
      if (d.is_duplicate) fl.push('tvítak');
      if (/uttekt-master|MATCH\s*\d|handvirkt/i.test(nm)) fl.push('ruglað nafn');
      if (!d.drive_file_id) fl.push('ekkert drive');
      return { id: d.id, ty: TYS[d.doc_type] || d.doc_type, y: d.year || null, lk,
        site: !!d.fyrirtaeki_id, dr: !!d.drive_file_id, rv: d.reviewed === true, nm, fl };
    });

    const sum = {
      companies: C.length, thjonusta: C.filter(c => c.t.includes('þjónusta')).length,
      brunakerfi: C.filter(c => c.t.includes('brunakerfi')).length, fjolstadur: C.filter(c => c.t.includes('fjölstaður')).length,
      docs: D.length, linked: D.filter(d => d.site).length, unlinked: D.filter(d => !d.lk).length,
      nosite: D.filter(d => d.lk && !d.site).length, reviewed: D.filter(d => d.rv).length,
      mangled: D.filter(d => d.fl.includes('ruglað nafn')).length, dup: D.filter(d => d.fl.includes('tvítak')).length,
    };
    return json(200, { C, D, sum });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { ...hdr(), Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    const page = await r.json(); out.push(...page);
    if (page.length < 1000) break; from += 1000;
  }
  return out;
}
function hdr() { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }; }
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
