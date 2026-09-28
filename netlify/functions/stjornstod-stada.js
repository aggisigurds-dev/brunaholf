// stjornstod-stada.js — lesfall fyrir morgunyfirlitið á Stjórnstöð í Slökkvitæki-appinu (patch 420, 28.09.2026).
//
//   GET /api/stjornstod-stada  →  { keyrslur: { <job_name>: { sidast, stada } }, postholf: [{ netfang, tengt, uppfaert }] }
//
// Appið les með anon-lykli og kemst hvorki í automation_runs (RLS án reglna) né google_oauth (geymir lykla).
// Hér er lesið með þjónustulykli og AÐEINS skilað því sem má sjást: hvenær hvert verk keyrði síðast og hvaða
// pósthólf eru tengd — aldrei tokenin sjálf. Ekkert skrifað.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (code, body) => ({ statusCode: code, headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, cors), body: JSON.stringify(body) });
const sb = async (qs) => {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + qs, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return r.json();
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    const since = new Date(Date.now() - 45 * 864e5).toISOString();
    const [runs, oauth] = await Promise.all([
      // Nýjasta fyrst; fyrsta röð hvers verks er síðasta keyrslan. 1000 raðir ná yfir allar tegundir (mest ~120/dag).
      sb('automation_runs?select=job_name,status,started_at&started_at=gte.' + encodeURIComponent(since) + '&order=started_at.desc&limit=1000'),
      sb('google_oauth?select=user_email,updated_at,refresh_token&order=id'),
    ]);
    const keyrslur = {};
    for (const r of runs || []) if (r.job_name && !keyrslur[r.job_name]) keyrslur[r.job_name] = { sidast: r.started_at, stada: r.status };
    const postholf = (oauth || []).map((o) => ({ netfang: o.user_email, tengt: !!o.refresh_token, uppfaert: o.updated_at }));
    return json(200, { keyrslur, postholf });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
