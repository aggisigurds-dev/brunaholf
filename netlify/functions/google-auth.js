// google-auth.js — kicks off the OAuth flow.
// GET /api/google-auth          → 302 to Google consent page
// GET /api/google-auth?json=1   → returns { url } so the page can navigate itself

const { buildAuthUrl, loadTokens, freshAccessToken, json, cors } = require('./_google');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};

  // Status check — verify the token actually WORKS, not just that one is stored.
  // (Google revokes refresh tokens periodically, esp. while the OAuth app is in
  // "Testing" mode, so a stored token can be present but dead.)
  if (p.status === '1') {
    const t = await loadTokens().catch(() => null);
    if (!t || !t.refresh_token) {
      return json(200, { connected: false, user_email: t ? t.user_email : null });
    }
    try {
      await freshAccessToken();           // actually refresh against Google
      return json(200, { connected: true, user_email: t.user_email, scope: t.scope });
    } catch (e) {
      // Token exists but Google rejected it → needs re-consent.
      return json(200, { connected: false, expired: true, user_email: t.user_email, error: e.message });
    }
  }

  const state = Math.random().toString(36).slice(2, 12);
  const url = buildAuthUrl(state);

  if (p.json === '1') return json(200, { url });

  return {
    statusCode: 302,
    headers: { Location: url, ...cors() },
    body: '',
  };
};
