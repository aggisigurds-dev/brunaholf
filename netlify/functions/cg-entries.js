// cg-entries.js — shared CG (Calculation Group) capture store.
//
// Lets a number captured on slokkvitaeki.netlify.app (a different origin,
// different app, same Supabase project) show up in brunaholf's Skýrslur tab
// — the client-side CG_REGISTRY/CG_VALUES localStorage only ever synced
// *within* brunaholf itself, so numbers captured on Slökkvitæki had no way
// back. This table + endpoint is the shared home for those entries.
//
// GET  /api/cg-entries                         → { entries:[…] }
// POST /api/cg-entries { action:'record',       → create/update an entry +
//        id?, label, value, source_app,            its latest value. id is
//        tab?, url?, formula?, manual? }           optional — omit to get a
//                                                   fresh CG-Sxx id.
// POST /api/cg-entries { action:'delete', id }
//
// Service-role only (writes RLS-free row). CORS open (same pattern as
// verkefnalisti.js) since this is called cross-origin from slokkvitaeki.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function nextId() {
  // Own namespace (CG-Sxx) so it never collides with a browser's local
  // cg_user counter (which mints plain CG-05, CG-06, … per-device).
  const r = await sb('cg_entries?select=id&id=like.CG-S*&order=id.desc&limit=1');
  const rows = r.ok ? await r.json() : [];
  const last = rows[0] && rows[0].id;
  const n = last ? (parseInt(String(last).replace('CG-S', ''), 10) || 0) + 1 : 1;
  return 'CG-S' + String(n).padStart(2, '0');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vars missing' });

  try {
    if (event.httpMethod === 'GET') {
      const r = await sb('cg_entries?select=*&order=updated_at.desc&limit=200');
      if (!r.ok) return json(r.status, { error: await r.text() });
      const entries = await r.json();
      return json(200, { entries });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch (_) { return json(400, { error: 'Ógilt JSON í body' }); }
    const action = body.action;

    if (action === 'record') {
      const label = String(body.label || '').trim();
      if (!label) return json(400, { error: 'label vantar' });
      const value = Math.round(Number(body.value) || 0);
      const now = new Date().toISOString();
      let id = body.id ? String(body.id).trim() : '';
      const patch = {
        label,
        source_app: String(body.source_app || 'brunaholf').trim(),
        tab: body.tab ? String(body.tab).trim() : null,
        url: body.url ? String(body.url).trim() : null,
        formula: body.formula ? String(body.formula).trim() : null,
        value,
        manual: !!body.manual,
        updated_at: now,
      };
      if (id) {
        const r = await sb(`cg_entries?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(patch),
        });
        if (!r.ok) return json(r.status, { error: await r.text() });
        const [updated] = await r.json();
        if (updated) return json(200, { ok: true, entry: updated });
        // id given but no existing row — fall through to insert with that id.
      }
      if (!id) id = await nextId();
      const row = Object.assign({ id, captured_at: now }, patch);
      const r = await sb('cg_entries', {
        method: 'POST',
        headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
        body: JSON.stringify(row),
      });
      if (!r.ok) return json(r.status, { error: await r.text() });
      const [created] = await r.json();
      return json(200, { ok: true, entry: created });
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) return json(400, { error: 'id vantar' });
      const r = await sb(`cg_entries?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) return json(r.status, { error: await r.text() });
      return json(200, { ok: true });
    }

    return json(400, { error: 'unknown action' });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
