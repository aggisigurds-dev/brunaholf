// hub-login.js — EIN sameiginleg starfsmanna-innskráning fyrir innri tólin.
//
//   GET  /api/hub-login                    → { configured, authed }
//   POST /api/hub-login { password }        → setur hub_session cookie (ef rétt)
//   POST /api/hub-login { action:'logout' } → hreinsar cookie
//
// Virk AÐEINS þegar HUB_STAFF_PASSWORD er sett í Netlify-env (annars 503). Sami
// lykill og cookie-undirritun; sjá _portal.js (requireStaff). Ein lykilorðs-hlið
// fyrir allt starfsfólk — ekki notendaskrá. Örlítil töf á röngu lykilorði til að
// hægja á brute-force; harðari throttling er seinni tíma verk.

const P = require('./_portal');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: P.secHeaders(), body: '' };
  if (event.httpMethod === 'GET') return P.json(200, { configured: P.hubConfigured(), authed: !!P.staffFromEvent(event) });
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Ógilt JSON' }); }

  if (body.action === 'logout') return P.json(200, { ok: true }, { 'Set-Cookie': P.clearStaffCookie() });

  if (!P.hubConfigured()) return P.json(503, { error: 'Starfsmanna-innskráning er ekki uppsett (HUB_STAFF_PASSWORD vantar í Netlify)' });

  const pw = String(body.password || '');
  if (!pw || !P.checkStaffPassword(pw)) {
    await sleep(400 + Math.floor(Math.random() * 300));
    return P.json(401, { error: 'Rangt lykilorð' });
  }
  return P.json(200, { ok: true }, { 'Set-Cookie': P.staffCookie(P.signStaff()) });
};
