// verkefnalisti.js — backend fyrir Brunahólf verkefnalista (Claude task board).
// GET  /api/verkefnalisti                 → { tasks:[…] }
// POST /api/verkefnalisti { action:'add', title, description?, request_image_b64? }
//                                            → adds a new beidni
// POST /api/verkefnalisti { action:'update', id, status?, claude_notes?,
//                            result_image_b64?, request_image_b64? }
//                                            → updates an existing row
// POST /api/verkefnalisti { action:'delete', id }
//
// Service-role only (writes RLS-protected rows). Screenshots upload to the
// public `verkefnalisti` bucket; URLs are saved on the row.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'verkefnalisti';
const MAX_IMG_BYTES = 8 * 1024 * 1024;   // 8 MB per screenshot — generous

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
  body: JSON.stringify(body),
});

async function sb(path, init = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

function decodeImageB64(b64) {
  if (!b64) return null;
  let s = String(b64);
  const m = s.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i);
  let mime = 'image/png';
  if (m) { mime = m[1].toLowerCase(); s = m[3]; }
  const buf = Buffer.from(s, 'base64');
  if (buf.length === 0) return null;
  if (buf.length > MAX_IMG_BYTES) throw new Error('Screenshot too large (max 8 MB)');
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  return { buf, mime, ext };
}

async function uploadImage(b64, prefix) {
  const dec = decodeImageB64(b64);
  if (!dec) return null;
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${dec.ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': dec.mime,
      'x-upsert': 'true',
    },
    body: dec.buf,
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Storage upload ${r.status}: ${err.slice(0, 160)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vars missing' });

  try {
    if (event.httpMethod === 'GET') {
      const r = await sb('verkefnalisti?select=*&order=status.asc,priority.desc,created_at.desc&limit=500');
      if (!r.ok) return json(r.status, { error: await r.text() });
      const tasks = await r.json();
      return json(200, { tasks });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = JSON.parse(event.body || '{}');
    const action = body.action;

    if (action === 'add') {
      const title = String(body.title || '').trim();
      if (!title) return json(400, { error: 'title vantar' });
      let reqUrl = null;
      if (body.request_image_b64) {
        try { reqUrl = await uploadImage(body.request_image_b64, 'request'); }
        catch (e) { return json(400, { error: e.message }); }
      }
      const row = {
        title,
        description: body.description ? String(body.description).trim() : null,
        request_image_url: reqUrl,
        status: 'beidni',
        priority: Number.isFinite(body.priority) ? body.priority : 1,
      };
      const r = await sb('verkefnalisti', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!r.ok) return json(r.status, { error: await r.text() });
      const [created] = await r.json();
      return json(200, { ok: true, task: created });
    }

    if (action === 'update') {
      const id = String(body.id || '').trim();
      if (!id) return json(400, { error: 'id vantar' });
      const patch = { updated_at: new Date().toISOString() };
      if (body.status) {
        const ok = ['beidni', 'i_vinnu', 'klarad', 'sleppt'];
        if (!ok.includes(body.status)) return json(400, { error: 'ógild staða' });
        patch.status = body.status;
        if (body.status === 'klarad') patch.completed_at = new Date().toISOString();
      }
      if (typeof body.title === 'string') patch.title = body.title.trim();
      if (typeof body.description === 'string') patch.description = body.description.trim();
      if (typeof body.claude_notes === 'string') patch.claude_notes = body.claude_notes.trim();
      if (typeof body.priority === 'number') patch.priority = body.priority;
      try {
        if (body.result_image_b64) {
          patch.result_image_url = await uploadImage(body.result_image_b64, 'result');
        }
        if (body.request_image_b64) {
          patch.request_image_url = await uploadImage(body.request_image_b64, 'request');
        }
      } catch (e) { return json(400, { error: e.message }); }
      const r = await sb(`verkefnalisti?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) return json(r.status, { error: await r.text() });
      const [updated] = await r.json();
      return json(200, { ok: true, task: updated });
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) return json(400, { error: 'id vantar' });
      const r = await sb(`verkefnalisti?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) return json(r.status, { error: await r.text() });
      return json(200, { ok: true });
    }

    if (action === 'reorder') {
      // Body: { ids: ["uuid1","uuid2",…] } in the new top-to-bottom order.
      // We rewrite priorities so the first id in the list ranks highest. Use
      // descending integers (N, N-1, …, 1) so a future insert with priority=1
      // lands at the bottom unless the user reorders it.
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (!ids.length) return json(400, { error: 'ids vantar' });
      const N = ids.length;
      const updates = ids.map((id, i) => ({ id, priority: N - i, updated_at: new Date().toISOString() }));
      // PostgREST batch-upsert via POST with merge-duplicates
      const r = await sb('verkefnalisti?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(updates),
      });
      if (!r.ok) return json(r.status, { error: await r.text() });
      return json(200, { ok: true, reordered: ids.length });
    }

    return json(400, { error: 'unknown action' });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
