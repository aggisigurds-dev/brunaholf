// customer-map.js — manage the customer↔worksite mapping.
// POST /api/customer-map { customer_name, worksite_name, kt_greidanda?, notes? }
// GET  /api/customer-map → list all mappings
// DELETE /api/customer-map?id=N

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?select=*&order=added_at.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { rows: await r.json() });
  }

  if (event.httpMethod === 'DELETE') {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return json(400, { error: 'id required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    return json(r.ok ? 200 : r.status, { deleted: r.ok });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  if (body.action === 'greidandi') return setjaGreidanda(body);
  if (!body.customer_name || !body.worksite_name) {
    return json(400, { error: 'customer_name and worksite_name are required' });
  }
  const payload = {
    customer_name: body.customer_name.trim(),
    worksite_name: body.worksite_name.trim(),
    kt_greidanda: body.kt_greidanda || null,
    notes: body.notes || null,
    confidence: body.confidence || 'manual',
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?on_conflict=customer_name,worksite_name`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  return json(200, { ok: true, row: (await r.json())[0] });
};

// ✎ Greiðandi verkstaðar úr Kröfu yfirliti (Agnar 12.10.2026: Áland 6 → Landspítali, kt 500300-2130,
// tilvísun 21727 — „geturðu leyft mér að breyta þessu þarna, vill skrá kennitöluna").
// POST { action:'greidandi', worksite_name, customer_name, kennitala, tilvisun, by }
// Skrifar tvennt og eyðir engu:
//  1) customer_worksite_map: röð með sama greiðanda uppfærð; annars sú EINA sem verkstaðurinn á;
//     annars ný röð. confidence='manual' → gengur fyrir í krofu-yfirlit-bru og worksites.
//     Aðrar raðir verkstaðarins standa (Reitir o.fl. eiga marga greiðendur).
//  2) ÓSEND drög verkstaðarins (ekki invoiced/void/skipped/merged, enginn Payday-reikningur) fá
//     sömu gildi — það sem er farið í Payday er aldrei snert.
// ALLTAF LEYFA VISTUN: röng lengd kennitölu stöðvar ekki vistun; 10 tölustafir fá bandstrik.
async function setjaGreidanda(body) {
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
  const lc = (s) => String(s || '').trim().toLowerCase();
  const ws = String(body.worksite_name || '').trim();
  if (!ws) return json(400, { error: 'worksite_name vantar' });
  const nafn = String(body.customer_name || '').trim();
  const ktRaw = body.kennitala == null ? undefined : String(body.kennitala).trim();
  const ktT = ktRaw == null ? '' : ktRaw.replace(/\D/g, '');
  const kt = ktRaw === undefined ? undefined : (ktT.length === 10 ? ktT.slice(0, 6) + '-' + ktT.slice(6) : (ktRaw || null));
  const tilv = body.tilvisun === undefined ? undefined : (String(body.tilvisun || '').trim() || null);
  const merki = 'Kröfu yfirlit ✎ ' + (String(body.by || '').trim() || 'Agnar') + ' ' + new Date().toISOString().slice(0, 10);

  // 1) verkstaðurinn → greiðandi
  const lr = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?select=*`, { headers: H });
  if (!lr.ok) return json(lr.status, { error: (await lr.text()).slice(0, 300) });
  const radir = (await lr.json()).filter((r) => lc(r.worksite_name) === lc(ws));
  const sami = nafn ? radir.find((r) => lc(r.customer_name) === lc(nafn)) : (radir.length === 1 ? radir[0] : null);
  const breyting = { confidence: 'manual' };
  if (kt !== undefined) breyting.kt_greidanda = kt;
  if (tilv !== undefined) breyting.tilvisun = tilv;
  let mapRod = null;
  if (sami || radir.length === 1) {
    const rod = sami || radir[0];
    if (nafn) breyting.customer_name = nafn;
    breyting.notes = [rod.notes, merki].filter(Boolean).join(' · ').slice(0, 500);
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map?id=eq.${rod.id}`, { method: 'PATCH', headers: { ...H, 'Prefer': 'return=representation' }, body: JSON.stringify(breyting) });
    if (!pr.ok) return json(pr.status, { error: (await pr.text()).slice(0, 300) });
    mapRod = (await pr.json())[0] || null;
  } else if (nafn) {
    const ir = await fetch(`${SUPABASE_URL}/rest/v1/customer_worksite_map`, { method: 'POST', headers: { ...H, 'Prefer': 'return=representation' }, body: JSON.stringify({ ...breyting, customer_name: nafn, worksite_name: ws, notes: merki }) });
    if (!ir.ok) return json(ir.status, { error: (await ir.text()).slice(0, 300) });
    mapRod = (await ir.json())[0] || null;
  }

  // 2) ósend drög verkstaðarins
  const dP = { updated_at: new Date().toISOString(), updated_by: 'krofuyfirlit-greidandi' };
  if (nafn) dP.customer_name = nafn;
  if (kt !== undefined) dP.kennitala = kt;
  if (tilv !== undefined) dP.tilvisun = tilv;
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?worksite_name=eq.${encodeURIComponent(ws)}&payday_invoice_id=is.null&or=(status.is.null,status.not.in.(invoiced,void,skipped,merged))`, {
    method: 'PATCH', headers: { ...H, 'Prefer': 'return=representation' }, body: JSON.stringify(dP),
  });
  if (!dr.ok) return json(dr.status, { error: (await dr.text()).slice(0, 300), map: mapRod });
  const drog = await dr.json();
  return json(200, { ok: true, map: mapRod, drog: drog.map((d) => ({ id: d.id, work_month: d.work_month })) });
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
