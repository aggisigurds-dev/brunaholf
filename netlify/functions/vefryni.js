// vefryni.js — backend for the Bakendi "Vefrýni" visual-review tool.
//
// Pages = screenshots of slokkvitæki; pins = the dots Agnar drops on them.
// Stored in public.vefryni_pages / public.vefryni_pins (RLS on — only this
// service-role function can reach them) + the public 'vefryni' storage bucket.
//
//   GET  /api/vefryni?what=deck    → { pages:[…], pins:[…] }
//   GET  /api/vefryni?what=queue   → { pins:[…] }   (submitted & still open — Claude's worklist)
//   POST /api/vefryni  { action, … }
//     add-page      { title, slug?, source?, image(dataURL), width?, height?, sort_order? }
//     update-page   { id, title?, sort_order?, active?, slug? }
//     delete-page   { id }
//     reorder-pages { order:[id,…] }
//     add-pin       { page_id, x, y, comment?, image(dataURL)? }
//     update-pin    { id, comment?, x?, y?, status?, claude_note?, image(dataURL)?, removeImage? }
//     delete-pin    { id }
//     submit        {}   → marks all unsubmitted pins as sent (one batch)

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'vefryni';
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    if (event.httpMethod === 'GET') return await handleGet(event);
    if (event.httpMethod === 'POST') return await handlePost(event);
    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

async function handleGet(event) {
  const q = event.queryStringParameters || {};
  const what = q.what || 'deck';
  if (what === 'deck') {
    const [pages, pins] = await Promise.all([
      rest('vefryni_pages?select=*&order=sort_order.asc,id.asc'),
      rest('vefryni_pins?select=*&order=page_id.asc,sort_order.asc,id.asc'),
    ]);
    return json(200, { pages, pins });
  }
  if (what === 'queue') {
    const pins = await rest('vefryni_pins?select=*&submitted=eq.true&status=in.(nytt,lagfaera)&order=page_id.asc,id.asc');
    return json(200, { pins });
  }
  return json(400, { error: 'Unknown what' });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  const action = body.action;

  switch (action) {
    case 'add-page': {
      if (!body.title) return json(400, { error: 'title required' });
      let image_url = null, storage_path = null;
      if (body.image) { const up = await uploadDataUrl(body.image, 'pages'); image_url = up.url; storage_path = up.path; }
      const row = await restInsert('vefryni_pages', {
        title: body.title, slug: body.slug || null, source: body.source || 'upload',
        image_url, storage_path, width: body.width || null, height: body.height || null,
        sort_order: body.sort_order != null ? body.sort_order : 9999,
      });
      return json(200, { page: row });
    }
    case 'capture-page': {
      // Idempotent upsert by (slug, source='auto') used by the snapshot script.
      // Updates the image IN PLACE so pins attached to the page survive a refresh.
      if (!body.slug) return json(400, { error: 'slug required' });
      if (!body.image) return json(400, { error: 'image required' });
      const up = await uploadDataUrl(body.image, 'pages');
      const existing = await rest(`vefryni_pages?select=id,storage_path&slug=eq.${encodeURIComponent(body.slug)}&source=eq.auto&limit=1`);
      if (existing[0]) {
        const patch = { image_url: up.url, storage_path: up.path, width: body.width || null, height: body.height || null };
        if (body.title) patch.title = body.title;
        if (body.sort_order != null) patch.sort_order = body.sort_order;
        const row = await restPatch('vefryni_pages', existing[0].id, patch);
        if (existing[0].storage_path && existing[0].storage_path !== up.path) await delObject(existing[0].storage_path).catch(() => {});
        return json(200, { page: row, updated: true });
      }
      const row = await restInsert('vefryni_pages', {
        title: body.title || body.slug, slug: body.slug, source: 'auto',
        image_url: up.url, storage_path: up.path, width: body.width || null, height: body.height || null,
        sort_order: body.sort_order != null ? body.sort_order : 9999,
      });
      return json(200, { page: row, created: true });
    }
    case 'update-page': {
      if (!body.id) return json(400, { error: 'id required' });
      const patch = {};
      ['title', 'sort_order', 'active', 'slug'].forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
      const row = await restPatch('vefryni_pages', body.id, patch);
      return json(200, { page: row });
    }
    case 'delete-page': {
      if (!body.id) return json(400, { error: 'id required' });
      const pageArr = await rest(`vefryni_pages?select=storage_path&id=eq.${body.id}`);
      const pinArr = await rest(`vefryni_pins?select=storage_path&page_id=eq.${body.id}`);
      await restDelete('vefryni_pages', body.id);
      const paths = [...pageArr, ...pinArr].map(r => r.storage_path).filter(Boolean);
      await Promise.all(paths.map(p => delObject(p).catch(() => {})));
      return json(200, { ok: true });
    }
    case 'reorder-pages': {
      const order = body.order || [];
      await Promise.all(order.map((id, i) => restPatch('vefryni_pages', id, { sort_order: i })));
      return json(200, { ok: true });
    }
    case 'add-pin': {
      if (!body.page_id) return json(400, { error: 'page_id required' });
      let image_url = null, storage_path = null;
      if (body.image) { const up = await uploadDataUrl(body.image, 'pins'); image_url = up.url; storage_path = up.path; }
      const row = await restInsert('vefryni_pins', {
        page_id: body.page_id, x: body.x, y: body.y, comment: body.comment || null,
        image_url, storage_path, status: 'nytt',
      });
      return json(200, { pin: row });
    }
    case 'update-pin': {
      if (!body.id) return json(400, { error: 'id required' });
      const patch = {};
      ['comment', 'x', 'y', 'status', 'claude_note', 'sort_order'].forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
      if (body.image) { const up = await uploadDataUrl(body.image, 'pins'); patch.image_url = up.url; patch.storage_path = up.path; }
      if (body.removeImage) { patch.image_url = null; patch.storage_path = null; }
      const row = await restPatch('vefryni_pins', body.id, patch);
      return json(200, { pin: row });
    }
    case 'delete-pin': {
      if (!body.id) return json(400, { error: 'id required' });
      const arr = await rest(`vefryni_pins?select=storage_path&id=eq.${body.id}`);
      await restDelete('vefryni_pins', body.id);
      if (arr[0] && arr[0].storage_path) await delObject(arr[0].storage_path).catch(() => {});
      return json(200, { ok: true });
    }
    case 'submit': {
      const batch_id = crypto.randomUUID();
      const r = await fetch(`${SUPABASE_URL}/rest/v1/vefryni_pins?submitted=eq.false`, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ submitted: true, submitted_at: new Date().toISOString(), batch_id }),
      });
      if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
      const rows = await r.json();
      return json(200, { ok: true, batch_id, count: rows.length });
    }
    default:
      return json(400, { error: 'Unknown action' });
  }
}

// ── Supabase REST helpers ──────────────────────────────────────────────────
async function rest(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function restInsert(table, obj) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error(`INSERT ${table} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json())[0];
}
async function restPatch(table, id, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`PATCH ${table} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json())[0];
}
async function restDelete(table, id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: H });
  if (!r.ok) throw new Error(`DELETE ${table} → ${r.status} ${(await r.text()).slice(0, 200)}`);
}

// ── Storage helpers ─────────────────────────────────────────────────────────
async function uploadDataUrl(dataUrl, prefix) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
  if (!m) throw new Error('Bad image data URL');
  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  const ext = (mime.split('/')[1] || 'png').replace('+xml', '').slice(0, 5);
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST', headers: { ...H, 'Content-Type': mime, 'x-upsert': 'true' }, body: buf,
  });
  if (!r.ok) throw new Error(`UPLOAD → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return { path, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` };
}
async function delObject(path) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: H });
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
