// kt-create.js — create a missing customer in customers_base, from the Skjalaheiti renamer.
//   POST /api/kt-create  body: { kt, nafn, heimilisfang, simi?, netfang? }
//   → { created:true, id, nafn, kennitala }   (or existed:true if the kt was already there)
// Idempotent on kennitala: if the kt already exists it returns the existing row, never a duplicate.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad json' }); }

  const digits = String(body.kt || '').replace(/\D/g, '');
  if (digits.length !== 10) return json(400, { error: 'kt required (10 digits)' });
  const dash = digits.slice(0, 6) + '-' + digits.slice(6);
  const nafn = (body.nafn || '').trim() || null;
  const heimilisfang = (body.heimilisfang || '').trim() || null;
  const simi = (body.simi || '').trim() || null;
  const netfang = (body.netfang || '').trim() || null;

  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' };

  // Already there? Return it — never create a duplicate kennitala.
  try {
    const ex = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${dash}&select=id,nafn&limit=1`, { headers: H });
    const exRows = ex.ok ? await ex.json().catch(() => []) : [];
    if (Array.isArray(exRows) && exRows[0]) {
      return json(200, { created: false, existed: true, id: exRows[0].id, nafn: exRows[0].nafn, kennitala: dash });
    }
  } catch (e) { /* fall through to insert attempt */ }

  // Insert.
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/customers_base`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify([{ kennitala: dash, nafn, heimilisfang, simi, netfang, general_notes: 'Stofnað úr Skjalaheiti (úttektarskýrsla)' }]),
  });
  if (!ins.ok) {
    const t = await ins.text().catch(() => '');
    return json(500, { error: 'insert failed', detail: t.slice(0, 300) });
  }
  const rows = await ins.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return json(201, { created: true, id: row && row.id, nafn: (row && row.nafn) || nafn, kennitala: dash });
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}
