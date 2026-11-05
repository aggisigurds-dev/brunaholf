// postur-vidhengi.js — viðhengi póstsins: listi + undirrituð slóð (staff-hlið).
//
//   GET /api/postur-vidhengi?message_id=<email_digest.message_id>      viðhengi eins skeytis
//   GET /api/postur-vidhengi?email_id=<email_digest.id>                 sama, um id
//   GET /api/postur-vidhengi?id=<postur_vidhengi.id>                    ein skrá
//   GET /api/postur-vidhengi?leit=<orð>&fra=YYYY-MM-DD&til=YYYY-MM-DD    leit í skráarnöfnum (hámark 200)
//
// Skilar { ok, vidhengi: [{ id, filename, mime, size, received_at, account, folder, message_id, url }] }
// þar sem url er undirrituð slóð í bucket postur-vidhengi, gildir 1 klst. Lesaðeins; GET framkvæmir ekki verk.
'use strict';
const P = require('./_portal');
const { undirritudSlod } = require('./_postur-vidhengi');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` });
const json = (s, b) => ({ statusCode: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,authorization' }, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  const g = P.requireStaff(event); if (g) return g;
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const p = event.queryStringParameters || {};
  try {
    const u = new URL(`${SUPABASE_URL}/rest/v1/postur_vidhengi`);
    u.searchParams.set('select', 'id,filename,mime,size,received_at,account,folder,message_id,storage_path');
    u.searchParams.set('order', 'received_at.desc');
    if (p.id) u.searchParams.set('id', `eq.${parseInt(p.id, 10) || 0}`);
    else if (p.message_id) u.searchParams.set('message_id', `eq.${p.message_id}`);
    else if (p.email_id) {
      const e = await fetch(`${SUPABASE_URL}/rest/v1/email_digest?id=eq.${parseInt(p.email_id, 10) || 0}&select=message_id`, { headers: H() });
      const rows = e.ok ? await e.json() : [];
      if (!rows.length) return json(404, { error: 'skeyti finnst ekki' });
      u.searchParams.set('message_id', `eq.${rows[0].message_id}`);
    } else if (p.leit) {
      u.searchParams.set('filename', `ilike.*${String(p.leit).replace(/[%*,()]/g, ' ').trim().slice(0, 80)}*`);
      if (p.fra) u.searchParams.set('received_at', `gte.${p.fra}`);
      if (p.til) u.searchParams.append('received_at', `lte.${p.til}`);
      u.searchParams.set('limit', '200');
    } else return json(400, { error: 'vantar message_id, email_id, id eða leit' });
    const r = await fetch(u, { headers: H() });
    if (!r.ok) return json(r.status, { error: `postur_vidhengi ${r.status}` });
    const rows = await r.json();
    const vidhengi = await Promise.all(rows.map(async (x) => {
      let url = null;
      try { url = await undirritudSlod(x.storage_path, 3600); } catch (_) { url = null; }
      const { storage_path, ...rest } = x;
      return { ...rest, url };
    }));
    return json(200, { ok: true, fjoldi: vidhengi.length, vidhengi });
  } catch (e) {
    return json(500, { error: 'villa' });
  }
};
