// kostnadur.js — hjálparfall fyrir síðuna „Kostnaður" í Slökkvitæki-appinu (27.09.2026).
//
//   GET  /api/kostnadur?skra=<id>          → { url }   undirrituð slóð (1 klst) á skjalið í lokaða bucketnum
//   GET  /api/kostnadur?stada=1            → { stada } síðasta söfnun (app_kv['kostnadur_sync'])
//   POST /api/kostnadur { action:'sync', days? } → ræsir kostnadur-sync-background (202)
//
// Taflan sjálf (`kostnadur`) er lesin og uppfærð beint úr appinu (RLS: anon select/update).
// Skjölin eru í LOKUÐUM bucket — reikningar birgja eru ekki opinberir — svo slóðin fer um þetta fall.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'kostnadur';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (code, body) => ({ statusCode: code, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify(body) });
const sbH = (extra) => Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, extra || {});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const p = event.queryStringParameters || {};
  try {
    if (event.httpMethod === 'GET' && p.skra) {
      const id = parseInt(p.skra, 10);
      if (!id) return json(400, { error: 'skra=<id> vantar' });
      const r = await fetch(SUPABASE_URL + '/rest/v1/kostnadur?select=storage_path,skra_nafn&id=eq.' + id, { headers: sbH() });
      const [row] = r.ok ? await r.json() : [];
      if (!row || !row.storage_path) return json(404, { error: 'Skjalið fannst ekki' });
      const s = await fetch(SUPABASE_URL + '/storage/v1/object/sign/' + BUCKET + '/' + row.storage_path, {
        method: 'POST', headers: sbH({ 'content-type': 'application/json' }), body: JSON.stringify({ expiresIn: 3600 }),
      });
      const sj = await s.json().catch(() => ({}));
      const slod = sj.signedURL || sj.signedUrl;
      if (!s.ok || !slod) return json(502, { error: 'Undirritun mistókst: ' + JSON.stringify(sj).slice(0, 200) });
      return json(200, { url: SUPABASE_URL + '/storage/v1' + slod, nafn: row.skra_nafn });
    }
    if (event.httpMethod === 'GET' && p.stada) {
      const r = await fetch(SUPABASE_URL + '/rest/v1/app_kv?select=value,updated_at&key=eq.kostnadur_sync', { headers: sbH() });
      const [row] = r.ok ? await r.json() : [];
      return json(200, { stada: row ? row.value : null, uppfaert: row ? row.updated_at : null });
    }
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) {}
      if (b.action !== 'sync') return json(400, { error: 'action óþekkt' });
      // Ein keyrsla í einu — önnur söfnun á meðan sú fyrri er á ferð myndi lesa sömu skjölin tvisvar.
      const r = await fetch(SUPABASE_URL + '/rest/v1/app_kv?select=value,updated_at&key=eq.kostnadur_sync', { headers: sbH() });
      const [row] = r.ok ? await r.json() : [];
      const aFerd = row && row.value && row.value.a_ferd && (Date.now() - new Date(row.updated_at).getTime() < 16 * 60 * 1000);
      if (aFerd) return json(409, { error: 'Söfnun er þegar í gangi', stada: row.value });
      const days = Math.min(Math.max(parseInt(b.days || '31', 10) || 31, 1), 400);
      const base = process.env.URL || 'https://brunaholf.netlify.app';
      const k = await fetch(base + '/.netlify/functions/kostnadur-sync-background?days=' + days, { method: 'POST' });
      return json(k.status === 202 || k.ok ? 202 : 502, { ok: k.status === 202 || k.ok, days });
    }
    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
