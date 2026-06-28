// keepit-companies.js — unified company list for Keepit's 🏢 Fyrirtæki card.
//
//   GET /api/keepit-companies?q=<text>  → { companies: [{id,name,kt,source,heimilisfang,...}], total }
//
// Pulls from BOTH:
//   - customers_base  (brunaholf side, shared with slokk)
//   - fyrirtaeki      (slökkvitæki service companies)
// Deduped by kennitala when present (a single kt that appears in both is
// returned once with source='both'). Substring-search on q (name + kt).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const q = ((event.queryStringParameters && event.queryStringParameters.q) || '').trim();
  const limit = Math.min(parseInt((event.queryStringParameters && event.queryStringParameters.limit) || '200', 10), 1000);

  // Run both reads in parallel.
  const [bRows, fRows] = await Promise.all([
    sbGet(`customers_base?select=id,nafn,kennitala,heimilisfang,er_i_thjonustu&order=nafn&limit=${limit}` + (q ? `&or=(nafn.ilike.*${enc(q)}*,kennitala.ilike.*${enc(q)}*)` : '')),
    sbGet(`fyrirtaeki?select=id,nafn,kennitala,heimilisfang,netfang,simi&order=nafn&limit=${limit}&deleted_at=is.null` + (q ? `&or=(nafn.ilike.*${enc(q)}*,kennitala.ilike.*${enc(q)}*)` : '')),
  ]);

  // Dedupe by 10-digit kennitala.
  const byKt = new Map();
  const noKt = [];
  function add(row, source) {
    const kt = norm(row.kennitala);
    const key = kt || null;
    if (!key) {
      noKt.push({ id: source + ':' + row.id, name: row.nafn || '(án nafns)', kt: '', heimilisfang: row.heimilisfang || '', source, ref_id: row.id });
      return;
    }
    const existing = byKt.get(key);
    if (existing) {
      existing.source = existing.source === source ? source : 'both';
      // prefer non-empty fields
      existing.heimilisfang = existing.heimilisfang || row.heimilisfang || '';
      existing.netfang      = existing.netfang      || row.netfang      || '';
      existing.simi         = existing.simi         || row.simi         || '';
      existing.refs = existing.refs || {};
      existing.refs[source] = row.id;
    } else {
      byKt.set(key, {
        id:  source + ':' + row.id,
        name: row.nafn || '(án nafns)',
        kt:   formatKt(kt),
        heimilisfang: row.heimilisfang || '',
        netfang: row.netfang || '',
        simi:    row.simi    || '',
        source,
        ref_id: row.id,
        refs: { [source]: row.id },
        in_service: !!row.er_i_thjonustu,
      });
    }
  }
  (bRows || []).forEach(r => add(r, 'brunaholf'));
  (fRows || []).forEach(r => add(r, 'slokkvitaeki'));

  const out = [...byKt.values(), ...noKt].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'is'));
  return json(200, { companies: out, total: out.length });
};

// ── helpers ────────────────────────────────────────────────────────────────
async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return [];
  return await r.json();
}
function norm(kt) { return String(kt || '').replace(/[^\d]/g, '').padStart(10, '0').slice(-10); }
function formatKt(kt) { return kt.length === 10 ? `${kt.slice(0,6)}-${kt.slice(6)}` : kt; }
function enc(s) { return encodeURIComponent(s).replace(/[(),]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function resp(code, body, headers) { return { statusCode: code, headers: { ...cors(), ...headers }, body }; }
function json(code, obj) { return resp(code, JSON.stringify(obj), { 'Content-Type': 'application/json' }); }
