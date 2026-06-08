// name-lookup.js — find a customer's kennitala by company NAME, for Skjalaheiti reports
// that printed only the name (older reports, no kt on the page).
//   GET /api/name-lookup?name=Aðalskoðun
//   → { found:true, exact:true, kennitala, nafn, id, heimilisfang }        (one confident match)
//     { found:true, exact:false, count, candidates:[{kennitala,nafn,heimilisfang}] }  (ambiguous)
//     { found:false }
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/\b(ehf|hf|slf|sf|ses|ohf|bs|svf)\b\.?/g, '')   // drop company-type suffix
  .replace(/[^\p{L}\p{N} ]/gu, ' ')                         // punctuation → space
  .replace(/\s+/g, ' ')
  .trim();

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const raw = ((event.queryStringParameters || {}).name || '').trim();
  if (norm(raw).length < 3) return json(400, { error: 'name too short' });

  const q = norm(raw);
  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const like = encodeURIComponent('%' + raw.replace(/[%_*]/g, ' ').trim() + '%');

  async function search(table) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?nafn=ilike.${like}&select=id,nafn,kennitala,heimilisfang&limit=30`, { headers: H });
      if (!r.ok) return [];
      return (await r.json().catch(() => [])) || [];
    } catch (e) { return []; }
  }

  // Prefer the curated customers_base; fall back to the wider fyrirtaeki list.
  let rows = await search('customers_base');
  if (!rows.length) rows = await search('fyrirtaeki');

  // Dedupe by kennitala (same company can appear more than once).
  const byKt = {};
  rows.forEach((r) => { if (r && r.kennitala) byKt[r.kennitala] = r; });
  const uniq = Object.values(byKt);
  if (!uniq.length) return json(200, { found: false });

  // One exact normalized name match → confident.
  const exact = uniq.filter((r) => norm(r.nafn) === q);
  const pick = exact.length === 1 ? exact[0] : (uniq.length === 1 ? uniq[0] : null);
  if (pick) {
    return json(200, { found: true, exact: true, kennitala: pick.kennitala, nafn: pick.nafn, id: pick.id, heimilisfang: pick.heimilisfang || null });
  }

  // Otherwise hand back the candidates so the user picks — never guess a kennitala.
  return json(200, {
    found: true, exact: false, count: uniq.length,
    candidates: uniq.slice(0, 8).map((r) => ({ kennitala: r.kennitala, nafn: r.nafn, heimilisfang: r.heimilisfang || null })),
  });
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}
