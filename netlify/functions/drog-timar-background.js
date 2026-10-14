// drog-timar-background.js — áætlaði tvíburinn (14.10.2026). Netlify svarar HTTP á áætluð föll með 403, svo
// áætlunin situr hér en ekki á drog-timar sjálfu (sjá viðvörunina í netlify.toml). Keyrir 10 mín eftir
// timavera-pull-background svo nýjustu færslurnar séu komnar inn áður en drögin eru fyllt.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { keyra } = require('./drog-timar');

exports.handler = async () => {
  const hafid = new Date().toISOString();
  let ut = null, villa = null;
  try { ut = await keyra({ dry: false }); }
  catch (e) { villa = String(e.message || e); }
  const breytt = ut ? ut.linur.filter(l => l.delta != null && !l.villa).map(l => `${l.ws} ${l.m} ${l.delta > 0 ? '+' : ''}${l.delta} klst → ${Math.round(l.total).toLocaleString('is-IS')} kr`) : [];
  console.log('[drog-timar-background]', villa || JSON.stringify({ skodud: ut.skodud, uppfaerd: ut.uppfaerd, obreytt: ut.obreytt, sleppt: ut.sleppt, villur: ut.villur, breytt }));
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/automation_runs`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        job_name: 'drog-timar', status: villa || (ut && ut.villur) ? 'error' : 'ok', source: 'netlify',
        started_at: hafid, finished_at: new Date().toISOString(),
        detail: villa ? villa : `${ut.uppfaerd} drög uppfærð · ${ut.obreytt} óbreytt · ${ut.sleppt} sleppt · ${ut.villur} villur` + (breytt.length ? ' — ' + breytt.join('; ') : ''),
      }),
    });
  } catch (_) {}
  return { statusCode: villa ? 500 : 200, body: JSON.stringify(ut || { villa }) };
};
