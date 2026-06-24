// dkplus-invoice.js — DK Plus PHASE 2: create sales invoices (write path).
//
// SAFE BY DEFAULT. This endpoint never sends anything to a customer, and it does
// not create an invoice unless you explicitly ask it to:
//   • mode:"calculate" (default) → PATCH sales/invoice/calculate. dkPlus returns
//     the priced invoice as it WOULD be — but creates nothing. Use this to prove
//     a payload before ever writing.
//   • mode:"create" + confirm:true → POST sales/invoice. Only then is an invoice
//     created. We pass the payload through as given; a draft/unsent flag can be
//     set in the payload once the dkPlus create schema is confirmed.
//
//   POST /api/dkplus-invoice
//   { "mode":"calculate", "invoice": { ...dkPlus sales-invoice payload... } }
//   { "mode":"create", "confirm":true, "draft":true, "invoice": { ... } }
//
// Auth + secret handling are identical to the read proxy (netlify/functions/
// dkplus.js): the API key is sent directly as the Bearer (it is itself a dkPlus
// token), with the POST /Token company-scoped exchange as a 401 fallback. The
// key lives only in the Netlify env var DKPLUS_API_KEY.

const DK_BASE = (process.env.DKPLUS_BASE || 'https://api.dkplus.is/api/v1').replace(/\/+$/, '');
const DK_KEY = process.env.DKPLUS_API_KEY;
const DK_COMPANY = process.env.DKPLUS_COMPANY || '';

let _tok = null, _tokAt = 0;
const TOKEN_TTL_MS = 45 * 60 * 1000;

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

// dkFetch: call dkPlus with the API key directly, falling back to a minted
// session token on 401. Returns { res, data, mode }.
async function dkFetch(path, { method = 'GET', body } = {}) {
  const url = `${DK_BASE}/${path.replace(/^\/+/, '')}`;
  const call = (tok) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${tok}`, 'content-type': 'application/json', Accept: 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let mode = 'direct-key';
  let res = await call(DK_KEY);
  if (res.status === 401 && DK_COMPANY) {
    try { res = await call(await mintToken()); mode = 'token-exchange'; } catch (e) { /* keep original 401 */ }
  }
  const t = await res.text();
  let data; try { data = JSON.parse(t); } catch { data = t; }
  return { res, data, mode, url };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'POST a dkPlus invoice payload: { mode:"calculate"|"create", invoice:{…} }' });
  }
  if (!DK_KEY) {
    return json(500, { error: 'DKPLUS_API_KEY not set in the Netlify site environment variables.' });
  }

  let req;
  try { req = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body.' }); }

  // --- email: send a posted invoice as email (HTML body + PDF attachment) ---
  // POST sales/invoice/{number}/email with a MailInfo body (recipient, subject, …).
  // Pass the dkPlus MailInfo object straight through as `mail` so the exact field
  // names can be tuned without redeploying. Real send → confirm-gated.
  if (req.mode === 'email') {
    if (!req.number) return json(400, { error: 'email mode needs { number } (the invoice number, e.g. "6").' });
    if (req.confirm !== true) return json(412, { error: 'Refusing to send. Use { mode:"email", confirm:true, number, mail:{…MailInfo…} }.' });
    const q = req.background === true ? '?background=true' : '';
    const { res, data, mode: auth, url } = await dkFetch(`sales/invoice/${encodeURIComponent(req.number)}/email${q}`, { method: 'POST', body: req.mail || {} });
    return json(res.ok ? 200 : res.status, { ok: res.ok, dk_status: res.status, mode: 'email', sent: res.ok, auth_mode: auth, url, data });
  }

  const invoice = req.invoice;
  if (!invoice || typeof invoice !== 'object') {
    return json(400, { error: 'Missing "invoice" payload object (the dkPlus sales-invoice body).' });
  }
  const mode = req.mode === 'create' ? 'create' : 'calculate';

  // --- calculate: priced preview, creates nothing ---
  if (mode === 'calculate') {
    const { res, data, mode: auth, url } = await dkFetch('sales/invoice/calculate', { method: 'PATCH', body: invoice });
    return json(res.ok ? 200 : res.status, {
      ok: res.ok, dk_status: res.status, mode: 'calculate', created: false, auth_mode: auth, url, data,
    });
  }

  // --- create: writes a real invoice — double-gated ---
  if (req.confirm !== true) {
    return json(412, {
      error: 'Refusing to create. To actually write an invoice send { mode:"create", confirm:true }.',
      hint: 'Run mode:"calculate" first to verify the payload; nothing is created by calculate.',
    });
  }
  const payload = { ...invoice };
  // dkPlus: draft vs posted is the query flag ?post=false|true (NOT a body field).
  // Default false → unposted draft. A bankakrafa is issued only on posting,
  // driven by Head.Term — so drafts touch no bank.
  const post = req.post === true;
  const { res, data, mode: auth, url } = await dkFetch(`sales/invoice?post=${post}`, { method: 'POST', body: payload });
  return json(res.ok ? 200 : res.status, {
    ok: res.ok, dk_status: res.status, mode: 'create', created: res.ok, posted: post,
    auth_mode: auth, url, data,
  });
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload, null, 2), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
