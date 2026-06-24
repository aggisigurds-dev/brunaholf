// dkplus-customer.js — DK Plus customer (viðskiptavinir) sync.
//
// Creates customers in dk so sales invoices can reference an existing Customer.
// dk rejects an invoice whose Customer is not already on file with the misleading
// error "Value cannot be null. Parameter name: user" (the direct-key API context
// cannot create a customer on the fly). Source of truth: the `customers_base` table.
//
// SAFE BY DEFAULT:
//   mode:"dry-run" (default) → build payloads from customers_base, create nothing.
//   mode:"create" + confirm:true → POST /api/v1/Customer for each candidate that is
//     NOT already in dk (matched by kennitala digits → SSNumber). Existing customers
//     are skipped so re-runs are idempotent and we don't create kt-format duplicates.
//
//   POST /api/dkplus-customer { mode:"dry-run", base_ids:[52,399] }
//   POST /api/dkplus-customer { mode:"create", confirm:true, base_ids:[505] }   // canary
//   POST /api/dkplus-customer { mode:"create", confirm:true, base_ids:[…] }
//
// Number is the kennitala in dashed form (e.g. 551021-0680) to match the existing dk
// customers; SSNumber is the 10-digit form. Auth + secret handling are identical to
// the other dkPlus functions (API key direct, POST /Token exchange as a 401 fallback).

const DK_BASE = (process.env.DKPLUS_BASE || 'https://api.dkplus.is/api/v1').replace(/\/+$/, '');
const DK_KEY = process.env.DKPLUS_API_KEY;
const DK_COMPANY = process.env.DKPLUS_COMPANY || '';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
async function dkFetch(path, { method = 'GET', body } = {}) {
  const url = `${DK_BASE}/${path.replace(/^\/+/, '')}`;
  const call = (tok) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${tok}`, 'content-type': 'application/json', Accept: 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let res = await call(DK_KEY);
  if (res.status === 401 && DK_COMPANY) { try { res = await call(await mintToken()); } catch (e) { /* keep 401 */ } }
  const t = await res.text();
  let data; try { data = JSON.parse(t); } catch { data = t; }
  return { res, data };
}

const digits = (s) => (s || '').replace(/\D/g, '');

// customers_base row → dk CustomerModel (kt dashed in Number, 10-digit in SSNumber).
function toCustomer(b) {
  return {
    Number: b.kennitala,
    Name: b.nafn || '',
    SSNumber: digits(b.kennitala),
    CountryCode: 'IS',
    Address1: b.heimilisfang || '',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'POST { mode:"dry-run"|"create", confirm, base_ids:[…] }' });
  }
  if (!DK_KEY) return json(500, { error: 'DKPLUS_API_KEY not set in the Netlify site environment variables.' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing.' });

  let req; try { req = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body.' }); }

  // --- update-sendto: flip a customer's delivery flags (SendTo) SAFELY ---
  // Reads the full CustomerModel, changes ONLY the requested SendTo keys on that
  // exact object, PUTs the same object back (round-trip → nothing else shifts),
  // then re-reads to prove exactly which keys changed. Confirm-gated (live write).
  //   POST { mode:"update-sendto", number:"150486-2389", set:{ PublishingSystem:true } }   // preview
  //   POST { mode:"update-sendto", confirm:true, number, set }                              // write
  if (req.mode === 'update-sendto') {
    const number = (req.number || '').trim();
    if (!number) return json(400, { error: 'update-sendto needs { number } (kt, dashed e.g. "150486-2389").' });
    const set = req.set && typeof req.set === 'object' && !Array.isArray(req.set) ? req.set : null;
    if (!set || !Object.keys(set).length) return json(400, { error: 'update-sendto needs { set:{…SendTo keys…} } e.g. { PublishingSystem:true }.' });
    const ALLOWED = ['Printer', 'ClaimToPrinter', 'Email', 'EDIInvoice', 'PublishingSystem'];
    const bad = Object.keys(set).filter((k) => !ALLOWED.includes(k));
    if (bad.length) return json(400, { error: `Unknown SendTo key(s): ${bad.join(', ')}. Allowed: ${ALLOWED.join(', ')}.` });

    // 1) read the full customer object
    const got = await dkFetch(`Customer/${encodeURIComponent(number)}`);
    if (!got.res.ok || !got.data || typeof got.data !== 'object') {
      return json(got.res.status || 502, { error: `Could not read customer ${number}.`, dk_status: got.res.status, data: got.data });
    }
    const before = { ...(got.data.SendTo || {}) };
    if (req.confirm !== true) {
      return json(412, { error: 'Refusing to write. Send { mode:"update-sendto", confirm:true, number, set }.', number, current_SendTo: before, would_set: set });
    }
    // 2) flip ONLY the requested keys on the full object, PUT the same object back
    const updated = { ...got.data, SendTo: { ...before, ...set } };
    const put = await dkFetch(`Customer/${encodeURIComponent(number)}`, { method: 'PUT', body: updated });
    // 3) re-read to prove what actually changed (and that nothing else did)
    let after = null;
    try { const re = await dkFetch(`Customer/${encodeURIComponent(number)}`); if (re.res.ok && re.data && typeof re.data === 'object') after = re.data.SendTo || null; } catch (e) { /* report PUT result anyway */ }
    const changed = after ? Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k]) : null;
    return json(put.res.ok ? 200 : put.res.status, {
      mode: 'update-sendto', number, ok: put.res.ok, dk_status: put.res.status,
      before_SendTo: before, requested: set, after_SendTo: after, changed_keys: changed,
      put_response: typeof put.data === 'string' ? put.data.slice(0, 300) : put.data,
    });
  }

  const mode = req.mode === 'create' ? 'create' : 'dry-run';

  // Candidates from customers_base (by base_ids if given, else everyone with a kt).
  let filter = 'kennitala=not.is.null';
  if (Array.isArray(req.base_ids) && req.base_ids.length) {
    const ids = req.base_ids.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n));
    if (!ids.length) return json(400, { error: 'base_ids must be integers.' });
    filter = `id=in.(${ids.join(',')})`;
  }
  let base;
  try { base = await sb(`customers_base?select=id,kennitala,nafn,heimilisfang,netfang&${filter}`); }
  catch (e) { return json(502, { error: e.message }); }

  // Existing dk customers → skip (idempotent, avoids kt-format duplicates).
  let existing = new Set();
  let listed = false;
  try {
    const { res, data } = await dkFetch('customer/page/1/2000');
    if (res.ok && Array.isArray(data)) { existing = new Set(data.map((c) => digits(c.SSNumber || c.Number))); listed = true; }
  } catch (e) { /* fall through: if we can't list, dk will reject true duplicates */ }

  const candidates = base
    .filter((b) => digits(b.kennitala).length >= 8) // sane kennitala only
    .map((b) => ({ base_id: b.id, customer: toCustomer(b), already: existing.has(digits(b.kennitala)) }));
  const toCreate = candidates.filter((c) => !c.already);
  const skipped = candidates.filter((c) => c.already)
    .map((c) => ({ base_id: c.base_id, Number: c.customer.Number, Name: c.customer.Name, reason: 'already in dk' }));

  if (mode === 'dry-run') {
    return json(200, { mode: 'dry-run', created: false, dk_listed: listed,
      candidates: candidates.length, would_create: toCreate.length, skipped, payloads: toCreate });
  }
  if (req.confirm !== true) {
    return json(412, { error: 'Refusing to create. Send { mode:"create", confirm:true }.', would_create: toCreate.length });
  }

  const results = [];
  for (const c of toCreate) {
    try {
      const { res, data } = await dkFetch('Customer', { method: 'POST', body: c.customer });
      results.push({ base_id: c.base_id, Number: c.customer.Number, Name: c.customer.Name,
        ok: res.ok, dk_status: res.status,
        message: res.ok ? 'ok' : (data && (data.Message || data.message)) || (typeof data === 'string' ? data.slice(0, 200) : '') });
    } catch (e) {
      results.push({ base_id: c.base_id, Number: c.customer.Number, ok: false, dk_status: 0, message: String(e) });
    }
  }
  const okN = results.filter((r) => r.ok).length;
  return json(200, { mode: 'create', attempted: results.length, created: okN, failed: results.length - okN, skipped, results });
};

async function sb(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload, null, 2), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
