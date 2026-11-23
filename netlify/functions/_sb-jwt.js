// _sb-jwt.js — starfsmannatákn fyrir PostgREST. AFRIT af slokkvitaeki/netlify/functions/_sb-jwt.cjs (23.11.2026);
// breytist annað skal hitt fylgja.
//
// Undirritað með SUPABASE_JWT_SECRET úr umhverfi (sama leyndarmál og JWT Secret í Supabase). Aldrei skrifað í skrá eða
// log. Hlutverkið í tákninu er authenticated, og claimið `rola` er eitt af Admin / Starfsmaður / Afgreiðsla.
// RLS-reglurnar (starfsfolk_all o.fl.) lesa það claim.
//
// Staðan 23.11.2026: leyndarmálið er AÐEINS í Netlify-umhverfi Slökkvitækis. Þar til það er sett hér skilar staffJwt()
// null og /api/sb-toki sækir táknið til Slökkvitækis (sjá sb-toki.js).
'use strict';
const crypto = require('crypto');

const ROLUR = ['Admin', 'Starfsmaður', 'Afgreiðsla'];
const LIFIR_SEK = 10 * 60 * 60;

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function staffJwt(user) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || !user || user.id == null) return null;
  if (ROLUR.indexOf(user.rola) < 0) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    aud: 'authenticated',
    role: 'authenticated',
    sub: 'hub:' + String(user.id),
    iat: now,
    exp: now + LIFIR_SEK,
    rola: user.rola,
  }));
  const data = header + '.' + payload;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return data + '.' + b64url(sig);
}

function verifyStaffJwt(token) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || !token || String(token).split('.').length !== 3) return null;
  const [h, p, sig] = String(token).split('.');
  const expect = b64url(crypto.createHmac('sha256', secret).update(h + '.' + p).digest());
  const a = Buffer.from(expect);
  const b = Buffer.from(String(sig));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(unb64url(p).toString('utf8')); } catch (_) { return null; }
  if (!payload || payload.role !== 'authenticated') return null;
  if (ROLUR.indexOf(payload.rola) < 0) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Les payload án undirritunarprófunar (aðeins til að bera saman sub/rola/exp á tákni sem Slökkvitæki gaf).
function lesaPayload(token) {
  const hlutar = String(token || '').split('.');
  if (hlutar.length !== 3) return null;
  try { return JSON.parse(unb64url(hlutar[1]).toString('utf8')); } catch (_) { return null; }
}

module.exports = { ROLUR, staffJwt, verifyStaffJwt, lesaPayload };
