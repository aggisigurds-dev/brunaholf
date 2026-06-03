// dkplus.js — read-only proxy to the dkPlus accounting API (Slökkvitæki ehf).
//
// PHASE 1: connection test + read only (customers / invoices / products / company).
// NO writes — POST/PUT/DELETE are rejected. Writing invoices into dk+ is a
// deliberate later phase once the read path is proven against the live API.
//
//   GET /api/dkplus?path=Customers
//   GET /api/dkplus?path=Sales/Invoices&top=5
//   GET /api/dkplus?path=Company           (good "is the key valid?" probe)
//
// Why server-side: api.dkplus.is is not reachable from the browser (CORS) nor
// from the build sandbox, and the API key must never reach client code. This
// function runs on Netlify where outbound is open and the secret stays server-side.
//
// SECRET: the dkPlus key (auðkennislykill) lives ONLY in the Netlify env var
// DKPLUS_API_KEY. It is never committed and never returned to the client.
//
// AUTH HEADER: the exact scheme dkPlus expects must be confirmed against
// https://api.dkplus.is/swagger. Default here is `Authorization: Bearer <key>`,
// but it is overridable via env without a code change, so the connection test
// can be tuned in the Netlify dashboard:
//   DKPLUS_AUTH_HEADER  (default "Authorization")
//   DKPLUS_AUTH_PREFIX  (default "Bearer "; set to "" to send the bare key)
//   DKPLUS_BASE         (default "https://api.dkplus.is/api/v1")

const DK_BASE = (process.env.DKPLUS_BASE || 'https://api.dkplus.is/api/v1').replace(/\/+$/, '');
const DK_KEY = process.env.DKPLUS_API_KEY;
const DK_AUTH_HEADER = process.env.DKPLUS_AUTH_HEADER || 'Authorization';
const DK_AUTH_PREFIX = process.env.DKPLUS_AUTH_PREFIX != null ? process.env.DKPLUS_AUTH_PREFIX : 'Bearer ';

// Read-only allowlist of dkPlus resource path prefixes for phase 1.
const ALLOW = [
  /^customers?(\/|$|\?)/i,
  /^sales(\/|$|\?)/i,
  /^invoices?(\/|$|\?)/i,
  /^products?(\/|$|\?)/i,
  /^company(\/|$|\?)/i,
  /^companies(\/|$|\?)/i,
  /^accounts?(\/|$|\?)/i,
  /^employees?(\/|$|\?)/i,
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Phase 1 is read-only. Writing to dk+ is not enabled yet.' });
  }
  if (!DK_KEY) {
    return json(500, { error: 'DKPLUS_API_KEY not set. Add it to the Netlify site environment variables.' });
  }

  const q = event.queryStringParameters || {};
  const path = (q.path || 'Company').replace(/^\/+/, '').trim();
  if (!ALLOW.some((re) => re.test(path))) {
    return json(400, {
      error: `Path not allowed in read-only phase: "${path}".`,
      allowed: ['Company', 'Customers', 'Sales/Invoices', 'Products', 'Accounts', 'Employees'],
    });
  }

  // Pass through a couple of common OData-style params used by dkPlus.
  const params = new URLSearchParams();
  if (q.top) params.set('$top', q.top);
  if (q.skip) params.set('$skip', q.skip);
  if (q.filter) params.set('$filter', q.filter);
  const extra = params.toString();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${DK_BASE}/${path}${extra ? sep + extra : ''}`;

  let r, text, body;
  try {
    r = await fetch(url, {
      headers: { [DK_AUTH_HEADER]: `${DK_AUTH_PREFIX}${DK_KEY}`, Accept: 'application/json' },
    });
    text = await r.text();
    try { body = JSON.parse(text); } catch { body = text; }
  } catch (e) {
    return json(502, { error: 'dkPlus request failed', detail: String(e), url });
  }

  // Echo which header/url were used (NOT the key) to make the connection test
  // self-explanatory while tuning the auth scheme.
  return json(r.ok ? 200 : r.status, {
    ok: r.ok,
    dk_status: r.status,
    path,
    url,
    auth_header: DK_AUTH_HEADER,
    auth_prefix: DK_AUTH_PREFIX,
    data: body,
  });
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload, null, 2), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
