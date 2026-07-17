// oauth-callback.js — Google redirects here after consent.
// Exchanges the code for tokens, fetches the user's email, stores in Supabase,
// then redirects the user back to the main app with a success flag.

const { exchangeCodeForTokens, getUserInfo, saveTokensFor, cors } = require('./_google');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors(), body: 'Method not allowed' };
  }
  const p = event.queryStringParameters || {};

  if (p.error) {
    return html(400, `<h1>Google höfnun</h1><p>${escapeHtml(p.error)}</p><p>${escapeHtml(p.error_description || '')}</p><p><a href="/">Til baka</a></p>`);
  }
  if (!p.code) return html(400, '<h1>Vantar kóða</h1><p>Engin code færibreyta í slóðinni.</p>');

  try {
    const tokens = await exchangeCodeForTokens(p.code);
    const info   = await getUserInfo(tokens.access_token);
    // 2026-07-17 fjölreikningar: innskráning sem ANNAÐ netfang en aðal-reikningurinn
    // (id=1, Drive/Sheets) fer í SÍNA eigin röð — yfirskrifar aldrei aðal-tenginguna.
    await saveTokensFor(info.email, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in:   tokens.expires_in,
      scope:        tokens.scope,
    });
    // Redirect back to brunaholf with success flag
    return {
      statusCode: 302,
      headers: { Location: `/?google=ok&email=${encodeURIComponent(info.email || '')}`, ...cors() },
      body: '',
    };
  } catch (e) {
    return html(500, `<h1>Villa við að klára tengingu</h1><pre>${escapeHtml(e.message)}</pre><p><a href="/">Til baka</a></p>`);
  }
};

function html(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'text/html; charset=utf-8', ...cors() }, body: `<!doctype html><html lang="is"><head><meta charset="utf-8"><title>Google tenging</title><style>body{font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:20px;color:#0B0E14}h1{color:#C93C1D;font-size:20px}pre{background:#F4F5F7;padding:12px;border-radius:8px;overflow:auto;font-size:12px}a{color:#2563EB}</style></head><body>${body}</body></html>` };
}
function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
