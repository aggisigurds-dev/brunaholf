// bookmark-preview.js — fetch og:image + title + favicon for a URL,
// plus an optional headless-rendered screenshot of the page.
//
//   GET /api/bookmark-preview?url=<url>                 → { ok, url, title, image, favicon, cached }
//   GET /api/bookmark-preview?url=<url>&screenshot=1    → ...same fields + { screenshot }
//
// Screenshot path: fans out to api.microlink.io which renders the page
// in a headless browser and returns a hosted PNG URL. No auth needed
// (free tier ~50 req/day per IP — fine for a few people clicking
// "📸 Skjáskot" on the rare bookmark whose og:image isn't good enough).
//
// Caches the og result in app_kv keyed by the URL so repeated requests
// for the same bookmark don't re-fetch the destination. Screenshot
// results are cached separately (key suffix ":shot") since they're
// orders of magnitude more expensive.
//
// Best-effort:
//  - Reads <meta property="og:image">, <meta name="twitter:image">,
//    <link rel="image_src">, falls back to first <img src=…> in the page,
//    finally to Google's favicon service (always available).
//  - Title: <meta property="og:title"> | <title> | hostname.
//  - Favicon: <link rel="icon"> | <link rel="apple-touch-icon"> | /favicon.ico
//    | Google s2/favicons.
// All URLs are resolved to absolute.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const qp = event.queryStringParameters || {};
  let url = String(qp.url || '').trim();
  if (!url) return json(400, { error: 'url required' });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const wantShot = qp.screenshot === '1' || qp.screenshot === 'true';

  // ── Screenshot-only path: thum.io renders + hosts the image; the
  //    browser hotlinks it directly, no external fetch from our function
  //    (so no timeout / rate-limit issues — Microlink's free tier was
  //    blocking screenshots and returning HTML error pages, which broke
  //    JSON parsing client-side). ────────────────────────────────────────
  if (wantShot) {
    const shotUrl = 'https://image.thum.io/get/width/1200/noanimate/' + url;
    return json(200, { ok: true, url, screenshot: shotUrl, cached: false });
  }

  const cacheKey = 'bookmark-preview:' + url;
  if (SUPABASE_URL && SUPABASE_KEY) {
    const cached = await kvGet(cacheKey);
    if (cached) return json(200, { ...cached, cached: true });
  }

  let html = '', finalUrl = url;
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrunaholfBookmarkBot/1.0; +https://brunaholf.netlify.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    finalUrl = r.url || url;
    if (r.ok) html = (await r.text()).slice(0, 200_000);
  } catch (e) {
    // Network/timeout/etc. — fall back to favicon-only response below.
  }

  const result = parse(html, finalUrl);
  if (SUPABASE_URL && SUPABASE_KEY) {
    try { await kvSet(cacheKey, result); } catch (_) {}
  }
  return json(200, { ...result, cached: false });
};

// ── parsing ─────────────────────────────────────────────────────────────────
function parse(html, url) {
  const u = new URL(url);
  const meta = (re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
  const titleTag = (html.match(/<title[^>]*>([\s\S]{0,400}?)<\/title>/i) || [, ''])[1]
    .replace(/\s+/g, ' ').trim();
  const title =
       meta(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']{1,300})["']/i)
    || meta(/<meta\s+content=["']([^"']{1,300})["']\s+(?:property|name)=["']og:title["']/i)
    || titleTag
    || u.hostname;

  const imgCandidates = [
    meta(/<meta\s+(?:property|name)=["']og:image(?::secure_url|:url)?["']\s+content=["']([^"']+)["']/i),
    meta(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i),
    meta(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i),
    meta(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i),
    (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [, ''])[1],
  ].filter(Boolean).map(s => abs(s, u));

  const faviconCandidates = [
    meta(/<link\s+rel=["'](?:shortcut )?icon["']\s+[^>]*href=["']([^"']+)["']/i),
    meta(/<link\s+[^>]*href=["']([^"']+)["']\s+rel=["'](?:shortcut )?icon["']/i),
    meta(/<link\s+rel=["']apple-touch-icon["']\s+[^>]*href=["']([^"']+)["']/i),
  ].filter(Boolean).map(s => abs(s, u));

  return {
    ok: true,
    url,
    title,
    image: imgCandidates[0] || '',
    favicon: faviconCandidates[0] || (u.origin + '/favicon.ico'),
    // Fallback that's always there if our parsed favicon 404s — UI can use this.
    google_favicon: 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(u.hostname),
  };
}

function abs(src, base) {
  try { return new URL(src, base.origin + base.pathname).href; } catch (_) { return ''; }
}

// ── app_kv cache ────────────────────────────────────────────────────────────
async function kvGet(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.${encodeURIComponent(key)}&select=value`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows && rows[0] ? rows[0].value : null;
}
async function kvSet(key, value) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_kv`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ key, value }),
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function resp(code, body, headers) { return { statusCode: code, headers: { ...cors(), ...headers }, body }; }
function json(code, obj) { return resp(code, JSON.stringify(obj), { 'Content-Type': 'application/json' }); }
