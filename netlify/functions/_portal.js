// _portal.js — öryggiskjarni Þjónustuvefsins (kúndavefur /gatt/).
//
// Sameiginleg hjálparföll fyrir gatt-login / gatt / gatt-doc:
//   • JWT (HS256) undirritað með node:crypto — engir aukapakkar.
//   • Lykilorð hashað með scrypt (salt per notanda), timing-safe samanburður.
//   • Session í HttpOnly + Secure + SameSite=Lax cookie (ekki localStorage).
//   • base_id kemur ALLTAF úr tokeninu — ALDREI úr slóð/beiðni (IDOR-vörn).
//
// Env sem þarf (Netlify): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// PORTAL_JWT_SECRET (langur tilviljanakenndur strengur — sett í Netlify, ALDREI
// committað). Ef PORTAL_JWT_SECRET vantar hafna föllin öllu (fail-closed).

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET   = process.env.PORTAL_JWT_SECRET || '';

const COOKIE = 'gatt_session';
const TTL_SECONDS = 60 * 60 * 8; // 8 klst session

// ── base64url ────────────────────────────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj) { return b64url(JSON.stringify(obj)); }
function fromB64url(str) {
  str = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// ── JWT (HS256) ──────────────────────────────────────────────────────────────
function signToken(payload, ttl = TTL_SECONDS) {
  if (!JWT_SECRET) throw new Error('PORTAL_JWT_SECRET vantar');
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttl };
  const head = { alg: 'HS256', typ: 'JWT' };
  const data = b64urlJson(head) + '.' + b64urlJson(body);
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return data + '.' + sig;
}
function verifyToken(token) {
  if (!JWT_SECRET || !token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest();
  let given;
  try { given = fromB64url(parts[2]); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(parts[1]).toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ── Lykilorð (scrypt) ────────────────────────────────────────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 32);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(pw, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  let salt, expected;
  try { salt = Buffer.from(parts[1], 'hex'); expected = Buffer.from(parts[2], 'hex'); } catch { return false; }
  let got;
  try { got = crypto.scryptSync(String(pw), salt, expected.length); } catch { return false; }
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

// ── Cookies ──────────────────────────────────────────────────────────────────
function parseCookies(event) {
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const out = {};
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function sessionCookie(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_SECONDS}`;
}
function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// Les session úr beiðni → { base_id, email, theme, name } eða null.
function getSession(event) {
  const token = parseCookies(event)[COOKIE];
  const p = verifyToken(token);
  if (!p || !p.base_id) return null;
  return { base_id: p.base_id, email: p.email, theme: p.theme || 'steel', name: p.name || '' };
}

// ── Supabase (service-role — aðeins server-megin) ────────────────────────────
function sbGet(qs) {
  return fetch(`${SUPABASE_URL}/rest/v1/${qs}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
}
function sbPatch(qs, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${qs}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
}
function sbPost(table, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
}

// ── HTTP svör ────────────────────────────────────────────────────────────────
// Kúndavefurinn og /api/* eru SAMA uppruni (brunaholf.netlify.app) svo við
// þurfum EKKI opið CORS. Referrer-Policy:no-referrer ver signed-URL leka.
function secHeaders(extra) {
  return { 'Content-Type': 'application/json', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', ...(extra || {}) };
}
function json(code, body, extraHeaders) {
  return { statusCode: code, headers: secHeaders(extraHeaders), body: JSON.stringify(body) };
}

function envReady() { return !!(SUPABASE_URL && SUPABASE_KEY && JWT_SECRET); } // login/session (þarf JWT)
function dbReady() { return !!(SUPABASE_URL && SUPABASE_KEY); }                 // stjórnsíða/status (aðeins DB)

// ── Starfsmanna-hlið (hub) — EIN sameiginleg innskráning fyrir innri tólin ────
// Virkjast AÐEINS þegar HUB_STAFF_PASSWORD er sett í Netlify-env. Meðan hún er
// ekki sett skilar requireStaff null (hleypir öllu í gegn) svo EKKERT brotni —
// staðuppsetning fyrir áfanga-útrás (Agnar 02.09.2026: „viðbótar auth á öllum
// stöðum"). Cookie-lykillinn ER lykilorðið sjálft: að skipta um
// HUB_STAFF_PASSWORD ógildir öll starfsmanna-session sjálfkrafa.
const HUB_PW = process.env.HUB_STAFF_PASSWORD || '';
const STAFF_COOKIE = 'hub_session';
const STAFF_TTL = 60 * 60 * 10; // 10 klst

function hubConfigured() { return !!HUB_PW; }
function signStaff(ttl = STAFF_TTL) {
  const now = Math.floor(Date.now() / 1000);
  const data = b64urlJson({ alg: 'HS256', typ: 'JWT' }) + '.' + b64urlJson({ role: 'staff', iat: now, exp: now + ttl });
  const sig = b64url(crypto.createHmac('sha256', HUB_PW).update(data).digest());
  return data + '.' + sig;
}
function verifyStaff(token) {
  if (!HUB_PW || !token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const expected = crypto.createHmac('sha256', HUB_PW).update(data).digest();
  let given;
  try { given = fromB64url(parts[2]); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let p;
  try { p = JSON.parse(fromB64url(parts[1]).toString('utf8')); } catch { return null; }
  if (!p || p.role !== 'staff' || typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return null;
  return p;
}
function staffFromEvent(event) { return verifyStaff(parseCookies(event)[STAFF_COOKIE]); }
function staffCookie(token) {
  return `${STAFF_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${STAFF_TTL}`;
}
function clearStaffCookie() {
  return `${STAFF_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
function checkStaffPassword(pw) {
  if (!HUB_PW) return false;
  const a = crypto.createHash('sha256').update(String(pw)).digest();
  const b = crypto.createHash('sha256').update(HUB_PW).digest();
  return crypto.timingSafeEqual(a, b);
}
// Setjið FREMST í handler (á eftir OPTIONS): const g = P.requireStaff(event); if (g) return g;
function requireStaff(event) {
  if (!HUB_PW) return null;                 // óvirkt þar til lykilorð er sett — brýtur ekkert
  if (staffFromEvent(event)) return null;   // gilt starfsmanna-session
  return json(401, { error: 'Innskráning starfsmanns vantar', need_login: true });
}

module.exports = {
  hubConfigured, signStaff, verifyStaff, staffFromEvent, staffCookie, clearStaffCookie, checkStaffPassword, requireStaff, STAFF_COOKIE,
  COOKIE, TTL_SECONDS,
  signToken, verifyToken, hashPassword, verifyPassword,
  parseCookies, sessionCookie, clearCookie, getSession,
  sbGet, sbPatch, sbPost, json, secHeaders, envReady, dbReady,
  SUPABASE_URL, SUPABASE_KEY,
};
