// google-auth.js — kicks off the OAuth flow.
// GET /api/google-auth          → 302 to Google consent page
// GET /api/google-auth?json=1   → returns { url } so the page can navigate itself

const { buildAuthUrl, loadTokens, json, cors } = require('./_google');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};

  // Status check
  if (p.status === '1') {
    const t = await loadTokens().catch(() => null);
    return json(200, {
      connected: !!(t && t.refresh_token),
      user_email: t ? t.user_email : null,
      granted_at: t ? t.granted_at : null,
      scope: t ? t.scope : null,
    });
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
