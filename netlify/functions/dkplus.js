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
// AUTH MODEL (per dkPlus swagger /Token): POST /api/v1/Token — authenticated by
// the API key as `Authorization: Bearer <DKPLUS_API_KEY>`, body { Company, Description }
// — returns a company-scoped session { Token }. That Token is then the Bearer for
// data calls. We mint + cache the token when DKPLUS_COMPANY is set; otherwise we
// send the API key directly (it may itself be a usable "General" token).
// Env (set in Netlify, never in the repo):
//   DKPLUS_API_KEY      the auðkennislykill (secret) — required
//   DKPLUS_COMPANY      the dkPlus company GUID (Auðkenni) — enables token exchange
//   DKPLUS_AUTH_HEADER  (default "Authorization")
//   DKPLUS_AUTH_PREFIX  (default "Bearer "; set to "" to send the bare token)
//   DKPLUS_BASE         (default "https://api.dkplus.is/api/v1")

const DK_BASE = (process.env.DKPLUS_BASE || 'https://api.dkplus.is/api/v1').replace(/\/+$/, '');
const DK_KEY = process.env.DKPLUS_API_KEY;
const DK_AUTH_HEADER = process.env.DKPLUS_AUTH_HEADER || 'Authorization';
const DK_AUTH_PREFIX = process.env.DKPLUS_AUTH_PREFIX != null ? process.env.DKPLUS_AUTH_PREFIX : 'Bearer ';
const DK_COMPANY = process.env.DKPLUS_COMPANY || ''; // dkPlus company GUID (Auðkenni)

// Session-token cache (module scope; survives while the function stays warm).
let _tok = null, _tokAt = 0;
const TOKEN_TTL_MS = 45 * 60 * 1000;

// Fallback only: mint + cache a company-scoped session token via POST /Token
// (authenticated by the API key). Used if the API key is not accepted directly.
async function mintToken() {
  if (_tok && Date.now() - _tokAt < TOKEN_TTL_MS) return _tok;
  const r = await fetch(`${DK_BASE}/Token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DK_KEY}`, 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Company: DK_COMPANY, Description: 'brunaholf dkplus proxy' }),
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = {}; }
  if (!r.ok || !j.Token) throw new Error(`POST /Token → dk_status ${r.status} ${t.slice(0, 120)}`);
  _tok = j.Token; _tokAt = Date.now();
  return _tok;
}

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
  const path = (q.path || 'sales/invoice/page/1/1').replace(/^\/+/, '').trim();
  if (!ALLOW.some((re) => re.test(path))) {
    return json(400, {
      error: `Path not allowed in read-only phase: "${path}".`,
      allowed: ['sales/invoice/page/1/3', 'sales/invoice/{number}', 'customer/page/1/3', 'product/page/1/3', 'Company'],
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

  const fetchWith = (tok) =>
    fetch(url, { headers: { [DK_AUTH_HEADER]: `${DK_AUTH_PREFIX}${tok}`, Accept: 'application/json' } });

  let r, text, body, mode = 'direct-key', exchangeErr = null;
  try {
    // 1) The API key is itself a dkPlus token — try it directly first.
    r = await fetchWith(DK_KEY);
    // 2) If unauthorized and a company is configured, fall back to a company-
    //    scoped session token from POST /Token, then retry the call once.
    if (r.status === 401 && DK_COMPANY) {
      try {
        const tok = await mintToken();
        r = await fetchWith(tok);
        mode = 'token-exchange';
      } catch (e) { exchangeErr = String(e); }
    }
    text = await r.text();
    try { body = JSON.parse(text); } catch { body = text; }
  } catch (e) {
    return json(502, { error: 'dkPlus request failed', detail: String(e), url, auth_mode: mode });
  }

  // Echo url / auth mode (NOT the key) to keep the connection test self-explanatory.
  const out = { ok: r.ok, dk_status: r.status, path, url, auth_mode: mode, auth_header: DK_AUTH_HEADER, data: body };
  if (exchangeErr) out.exchange_error = exchangeErr;
  return json(r.ok ? 200 : r.status, out);
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
