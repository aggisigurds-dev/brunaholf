// dkplus-product.js — DK Plus product (Vörur) importer.
//
// Creates the slökkvitæki product catalog in dk so invoice lines can carry a
// real ItemCode (dk rejects description-only lines). Source of truth is the
// `vorur` table (dk_vorunr filled for every product). SAFE BY DEFAULT:
//   mode:"dry-run" (default) → build the payloads from vorur, create nothing.
//   mode:"create" + confirm:true → POST /api/v1/Product for the requested slice.
//
//   POST /api/dkplus-product { mode:"dry-run" }                       // preview all
//   POST /api/dkplus-product { mode:"create", confirm:true, only:["060"] }  // canary
//   POST /api/dkplus-product { mode:"create", confirm:true, offset:0, limit:20 } // chunk
//
// dk ProductModel (confirmed via Swagger): only ItemCode is required. We map net
// prices (UnitPrice1 + TaxPercent) to match the net invoice lines.

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

// vorur → dk ProductModel (net pricing to match the invoice lines).
function toProduct(v) {
  return {
    ItemCode: String(v.dk_vorunr),
    Description: v.nafn || '',
    UnitPrice1: Number(v.verd_an_vsk) || 0,
    TaxPercent: Number(v.vsk_prosenta) || 24,
    UnitCode: 'STK',
    Inactive: v.virkt === false,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'POST { mode:"dry-run"|"create", confirm, only:[], offset, limit }' });
  }
  if (!DK_KEY) return json(500, { error: 'DKPLUS_API_KEY not set.' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing.' });

  let req; try { req = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body.' }); }
  const mode = req.mode === 'create' ? 'create' : 'dry-run';

  let vorur;
  try {
    vorur = await sb('vorur?select=id,nafn,verd_an_vsk,vsk_prosenta,dk_vorunr,virkt&dk_vorunr=not.is.null&order=dk_vorunr.asc');
  } catch (e) { return json(502, { error: e.message }); }

  let products = vorur.map(toProduct);
  if (Array.isArray(req.only) && req.only.length) {
    const set = new Set(req.only.map(String));
    products = products.filter((p) => set.has(p.ItemCode));
  } else if (req.offset != null || req.limit != null) {
    const off = Math.max(0, parseInt(req.offset, 10) || 0);
    const lim = Math.max(1, Math.min(50, parseInt(req.limit, 10) || 25));
    products = products.slice(off, off + lim);
  }

  if (mode === 'dry-run') {
    return json(200, { mode: 'dry-run', total: vorur.length, count: products.length, created: false, products });
  }

  // --- create: writes to dk — gated ---
  if (req.confirm !== true) {
    return json(412, { error: 'Refusing to create. Send { mode:"create", confirm:true }.', would_create: products.length });
  }
  const results = [];
  for (const p of products) {
    try {
      const { res, data } = await dkFetch('Product', { method: 'POST', body: p });
      results.push({ ItemCode: p.ItemCode, ok: res.ok, dk_status: res.status,
        message: res.ok ? 'ok' : (data && (data.Message || data.message)) || (typeof data === 'string' ? data.slice(0, 160) : '') });
    } catch (e) {
      results.push({ ItemCode: p.ItemCode, ok: false, dk_status: 0, message: String(e) });
    }
  }
  const okN = results.filter((r) => r.ok).length;
  return json(200, { mode: 'create', total: vorur.length, attempted: results.length, created: okN, failed: results.length - okN, results });
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
