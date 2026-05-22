// _google.js — shared helper used by oauth + drive + gmail functions.
// Not exposed as a Netlify endpoint (underscore prefix isn't a convention
// Netlify cares about, but we never set up a redirect for it).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT = process.env.GOOGLE_OAUTH_REDIRECT;

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

function buildAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',                  // forces refresh_token on every grant
    include_granted_scopes: 'true',
    state: state || '',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT,
    grant_type: 'authorization_code',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`Token exchange ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function refreshAccessToken(refresh_token) {
  const body = new URLSearchParams({
    refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`Refresh ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function getUserInfo(access_token) {
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!r.ok) return { email: null };
  return r.json();
}

async function saveTokens({ user_email, access_token, refresh_token, expires_in, scope }) {
  const expires_at = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();
  const payload = {
    id: 1,
    user_email,
    access_token,
    expires_at,
    scope,
    updated_at: new Date().toISOString(),
  };
  // Only overwrite refresh_token if we got a new one (Google omits it on refresh)
  if (refresh_token) payload.refresh_token = refresh_token;

  const r = await fetch(`${SUPABASE_URL}/rest/v1/google_oauth?on_conflict=id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Save tokens ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function loadTokens() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/google_oauth?id=eq.1&select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Load tokens ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}

// Returns a fresh access_token (refreshing if needed). Throws if not connected.
async function freshAccessToken() {
  const t = await loadTokens();
  if (!t || !t.refresh_token) throw new Error('Not connected — visit /api/google-auth first.');
  const now = Date.now();
  const expiresAt = t.expires_at ? new Date(t.expires_at).getTime() : 0;
  if (t.access_token && expiresAt > now + 30 * 1000) return t.access_token;
  // Need refresh
  const fresh = await refreshAccessToken(t.refresh_token);
  await saveTokens({
    user_email: t.user_email,
    access_token: fresh.access_token,
    refresh_token: null,                // keep existing
    expires_in: fresh.expires_in,
    scope: fresh.scope || t.scope,
  });
  return fresh.access_token;
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}

module.exports = {
  CLIENT_ID, CLIENT_SECRET, REDIRECT, SCOPES,
  buildAuthUrl, exchangeCodeForTokens, refreshAccessToken,
  getUserInfo, saveTokens, loadTokens, freshAccessToken,
  cors, json,
};
