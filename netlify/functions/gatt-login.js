// gatt-login.js — innskráning viðskiptavinar á Þjónustuvefinn (/gatt/).
//
//   POST /api/gatt-login { email, password }   → setur session-cookie
//   POST /api/gatt-login { action:'logout' }    → hreinsar cookie
//
// Netfang + lykilorð (stofnað af starfsfólki á stjórnsíðunni). base_id úr
// portal_users fer í undirritað JWT → einangrun. Læsing eftir of margar
// tilraunir. Almenn villuskilaboð (ljóstra ekki upp hvort netfang er til).

const P = require('./_portal');

const MAX_FAILS = 8;
const LOCK_MINUTES = 15;
// dummy-hash svo timing sé svipað þegar netfang finnst EKKI (enumeration-vörn)
const DUMMY = 'scrypt$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: P.secHeaders(), body: '' };
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });
  if (!P.envReady()) return P.json(503, { error: 'Þjónustuvefur ekki uppsettur (env vantar)' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return P.json(400, { error: 'Ógilt JSON' }); }

  // ── Útskráning ──
  if (body.action === 'logout') {
    return P.json(200, { ok: true }, { 'Set-Cookie': P.clearCookie() });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return P.json(400, { error: 'Netfang og lykilorð vantar' });

  try {
    const r = await P.sbGet(`portal_users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
    const rows = r.ok ? await r.json() : [];
    const user = rows[0] || null;

    // Læst? (raunverulegur notandi þarf að vita það)
    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
      return P.json(429, { error: 'Of margar tilraunir. Reyndu aftur eftir smá stund.' });
    }

    // Staðfesta lykilorð (keyrum líka dummy þegar notandi finnst ekki → svipað timing)
    const ok = user && user.active && user.pass_hash
      ? P.verifyPassword(password, user.pass_hash)
      : (P.verifyPassword(password, DUMMY) && false);

    if (!ok) {
      if (user) {
        const fails = (user.failed_attempts || 0) + 1;
        const patch = { failed_attempts: fails };
        if (fails >= MAX_FAILS) patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
        try { await P.sbPatch(`portal_users?id=eq.${user.id}`, patch); } catch (_) {}
      }
      return P.json(401, { error: 'Rangt netfang eða lykilorð' });
    }

    // Tókst → núllstilla teljara, stimpla innskráningu, mint token
    try {
      await P.sbPatch(`portal_users?id=eq.${user.id}`, {
        failed_attempts: 0, locked_until: null, last_login: new Date().toISOString(),
      });
    } catch (_) {}

    const token = P.signToken({
      base_id: user.base_id, email: user.email, theme: user.theme || 'steel', name: user.display_name || '',
    });
    return P.json(200, { ok: true, name: user.display_name || '', theme: user.theme || 'steel' },
      { 'Set-Cookie': P.sessionCookie(token) });
  } catch (e) {
    return P.json(500, { error: String((e && e.message) || e) });
  }
};
