// efnislisti-docs.js — Drive links per (worksite, month).
//   GET  /api/efnislisti-docs                          → all rows
//   GET  /api/efnislisti-docs?worksite=X&month=YYYY-MM → filter
//   GET  /api/efnislisti-docs?doc_type=invoice         → only invoice links
//   POST /api/efnislisti-docs   body { worksite_name, work_month, drive_file_id, title, doc_type? }
//        doc_type: 'efnislisti' (default, work doc) | 'invoice' (reikningur)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const params = ['select=*', 'order=added_at.desc.nullslast'];
    if (q.worksite) params.push(`worksite_name=eq.${encodeURIComponent(q.worksite)}`);
    if (q.month)    params.push(`work_month=eq.${encodeURIComponent(q.month)}`);
    if (q.doc_type) params.push(`doc_type=eq.${encodeURIComponent(q.doc_type)}`);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?${params.join('&')}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { rows: await r.json() });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }
    // ⭐ Aðalskjal mánaðarins (Agnar 04.09.2026): merkja EITT skjal sem það sem birtist
    // á 📄-hlekknum og fer efst/hakað í „Senda í bókun" — t.d. Landsspítala-uppgjörið
    // sem ER reikningurinn. Hin skjöl mánaðarins missa merkinguna sjálfkrafa.
    if (body.action === 'set_primary') {
      const ws = String(body.worksite_name || '').trim(), wm = String(body.work_month || '').trim();
      const fid = String(body.drive_file_id || '').trim();
      if (!ws || !wm) return json(400, { error: 'worksite_name + work_month vantar' });
      const base = `${SUPABASE_URL}/rest/v1/efnislisti_documents?worksite_name=eq.${encodeURIComponent(ws)}&work_month=eq.${encodeURIComponent(wm)}`;
      const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
      const clear = await fetch(`${base}&is_primary=is.true`, { method: 'PATCH', headers: h, body: JSON.stringify({ is_primary: false }) });
      if (!clear.ok) return json(clear.status, { error: (await clear.text()).slice(0, 300) });
      if (!fid) return json(200, { ok: true, primary: null });   // tómt fid = taka merkinguna af
      const set = await fetch(`${base}&drive_file_id=eq.${encodeURIComponent(fid)}`, { method: 'PATCH', headers: h, body: JSON.stringify({ is_primary: true }) });
      if (!set.ok) return json(set.status, { error: (await set.text()).slice(0, 300) });
      const rows = await set.json();
      return json(200, { ok: true, primary: rows[0] || null });
    }
    if (!body.worksite_name || !body.work_month || !body.drive_file_id) {
      return json(400, { error: 'worksite_name + work_month + drive_file_id required' });
    }
    const payload = {
      worksite_name: body.worksite_name,
      work_month:    body.work_month,
      drive_file_id: body.drive_file_id,
      title:         body.title || null,
      doc_type:      body.doc_type === 'invoice' ? 'invoice' : 'efnislisti',
    };
    // Upsert: PK is (worksite_name, work_month, drive_file_id). Re-linking the
    // same file must succeed (idempotent) instead of throwing 409 Conflict.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?on_conflict=worksite_name,work_month,drive_file_id`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, (await r.json())[0] || { ok: true });
  }

  // DELETE /api/efnislisti-docs   body { drive_file_id }  (eða ?drive_file_id=)
  //   Eyðir tengil-röðinni OG hendir Drive-skránni í ruslið (endurheimtanlegt).
  if (event.httpMethod === 'DELETE') {
    const q = event.queryStringParameters || {};
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
    const fid = q.drive_file_id || body.drive_file_id;
    if (!fid) return json(400, { error: 'drive_file_id required' });
    // 1) eyða tengil-röð(um) fyrir þessa skrá
    const r = await fetch(`${SUPABASE_URL}/rest/v1/efnislisti_documents?drive_file_id=eq.${encodeURIComponent(fid)}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=representation' },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const removed = (await r.json().catch(() => [])) || [];
    // 2a) Supabase-hýst skjöl (drive_file_id = 'sb:<path>') → eyða úr Storage-bucket.
    let storage = 'n/a';
    const sbPaths = removed.map(x => x && (x.storage_path || (String(x.drive_file_id||'').startsWith('sb:') ? String(x.drive_file_id).slice(3) : null))).filter(Boolean);
    if (sbPaths.length) {
      try {
        const sr = await fetch(`${SUPABASE_URL}/storage/v1/object/efnislisti-pdf`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: sbPaths }),
        });
        storage = sr.ok ? 'deleted' : ('storage ' + sr.status);
      } catch (_) { storage = 'storage-error'; }
      return json(200, { ok: true, removed: removed.length, storage });
    }
    // 2) besta-tilraun: henda Drive-skránni í ruslið (endurheimtanlegt í 30 daga).
    //    Ef Google-tenging vantar eða PATCH bregst → tengill er samt farinn af listanum.
    let drive = 'skipped';
    try {
      const g = require('./_google');
      const tok = g && g.freshAccessToken ? await g.freshAccessToken() : null;
      if (tok) {
        const dr = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fid)}?supportsAllDrives=true`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        });
        drive = dr.ok ? 'trashed' : ('drive ' + dr.status);
      }
    } catch (_) { drive = 'drive-error'; }
    return json(200, { ok: true, removed: removed.length, drive });
  }

  return json(405, { error: 'Method not allowed' });
};

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
