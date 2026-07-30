// payday-pull.js — pull invoices from Payday's REST API (api.payday.is) using
// OAuth2 client_credentials, and upsert them into the `invoices` table
// alongside the existing xlsx-from-Drive path (payday-ingest-drive.js).
//
// Same upsert key as the xlsx path: `(tilvisun, source='payday')` — so the
// two are interchangeable and re-running is idempotent. NEVER writes
// `worksite_match` (curated by hand in the hub).
//
//   GET /api/payday-pull
//     → real run: token → fetch all pages → map → upsert; logs to
//       automation_runs(job_name='payday-pull').
//
//   GET /api/payday-pull?probe=1
//     → only verifies auth and fetches page 1 raw, no upsert, no DB write.
//       Use this first to confirm credentials + inspect field names.
//
//   GET /api/payday-pull?dry=1
//     → fetches + maps to invoice rows, returns the rows, NO upsert.
//
//   Optional query: ?since=YYYY-MM-DD&until=YYYY-MM-DD&pageSize=N
//     since/until → applied as a date filter on the Payday list endpoint
//                   (sent as ISO strings; Payday accepts a date range).
//
// Env vars (set in Netlify, NOT committed):
//   PAYDAY_CLIENT_ID        — Payday API ClientID  (from Stillingar → Samþættingar → PaydayAPI)
//   PAYDAY_CLIENT_SECRET    — Payday API ClientSecret
//   PAYDAY_API_BASE         — default 'https://api.payday.is'
//   PAYDAY_TOKEN_PATH       — default '/api/v1/oauth/token'
//   PAYDAY_INVOICES_PATH    — default '/api/v1/invoices'
//   SUPABASE_URL            — already set
//   SUPABASE_SERVICE_ROLE_KEY — already set
//
// Token caching: the access_token is cached in `app_kv` under
// key='payday_oauth' so warm starts skip the auth roundtrip until expiry.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_ID = process.env.PAYDAY_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYDAY_CLIENT_SECRET;
const API_BASE = (process.env.PAYDAY_API_BASE || 'https://api.payday.is').replace(/\/+$/, '');
const TOKEN_PATH = process.env.PAYDAY_TOKEN_PATH || '/auth/token';
const INVOICES_PATH = process.env.PAYDAY_INVOICES_PATH || '/invoices';
const API_VERSION = process.env.PAYDAY_API_VERSION || 'alpha';

const JOB_NAME = 'payday-pull';
const BATCH = 200;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  // POST er LEYFT af því að þetta er nú ÁÆTLAÐA (scheduled) útgáfan — Netlify
  // ræsir áætlaðar föllur með POST. Áður stóð hér `!== 'GET'`, svo hefði
  // áætlunin verið sett á þetta fall hefði hún fengið 405 og aldrei keyrt.
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'GET/POST only' });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json(500, { error: 'PAYDAY_CLIENT_ID / PAYDAY_CLIENT_SECRET vantar í Netlify env vars.' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json(500, { error: 'Supabase env vantar.' });
  }

  const p = event.queryStringParameters || {};
  const isProbe = p.probe === '1' || p.probe === 'true';
  const isDry = p.dry === '1' || p.dry === 'true';
  const pageSize = clampInt(p.pageSize, 100, 1, 500);
  const since = isoDate(p.since);
  const until = isoDate(p.until);

  const startedAt = new Date().toISOString();
  try {
    const token = await getAccessToken();
    if (isProbe) {
      const firstPage = await fetchInvoicesPage(token, 1, pageSize, since, until);
      return json(200, {
        ok: true, probe: true, token_obtained: true,
        token_base: API_BASE, token_path: TOKEN_PATH, invoices_path: INVOICES_PATH,
        first_page: firstPage,
        note: 'Skoðaðu data-strúktúrinn í `first_page` til að staðfesta field-nöfn áður en raunkeyrt er.',
      });
    }

    // Fetch all pages
    const allRaw = [];
    let page = 1, totalPages = 1;
    while (page <= totalPages) {
      const r = await fetchInvoicesPage(token, page, pageSize, since, until);
      const items = extractItems(r);
      allRaw.push(...items);
      const meta = extractPagingMeta(r, page, pageSize, items.length);
      totalPages = meta.totalPages;
      page++;
      if (page > 200) break; // safety
    }

    const invoices = allRaw.map(mapInvoice).filter(x => x && x.tilvisun);

    if (isDry) {
      return json(200, {
        ok: true, dry: true,
        fetched_raw: allRaw.length, mapped: invoices.length,
        sample: invoices.slice(0, 3),
        all: invoices,
      });
    }

    let upserted = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < invoices.length; i += BATCH) {
      const slice = invoices.slice(i, i + BATCH).map(r => ({ ...r, source: 'payday', imported_at: now }));
      const u = await fetch(`${SUPABASE_URL}/rest/v1/invoices?on_conflict=tilvisun,source`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(slice),
      });
      if (!u.ok) throw new Error('Upsert ' + u.status + ': ' + (await u.text()).slice(0, 240));
      upserted += slice.length;
    }

    await logRun({
      status: 'success',
      detail: `${invoices.length} reikningar · ${upserted} upsert`,
      started_at: startedAt,
    }).catch(()=>{});

    return json(200, {
      ok: true,
      api_base: API_BASE,
      fetched_raw: allRaw.length, invoices: invoices.length, upserted,
      since: since || null, until: until || null,
    });
  } catch (e) {
    const msg = String(e.message || e).slice(0, 500);
    await logRun({
      status: 'error', detail: msg, started_at: startedAt,
    }).catch(()=>{});
    return json(500, { error: msg });
  }
};

// ---- OAuth2 client_credentials ----------------------------------------------

async function getAccessToken() {
  const cached = await readCachedToken();
  if (cached && cached.access_token && cached.exp_ts && cached.exp_ts > Date.now() + 30_000) {
    return cached.access_token;
  }
  // Payday API auth: POST /auth/token  JSON body { clientId, clientSecret }
  // Headers MUST include Api-Version (verified from apidoc.payday.is collection).
  const tokenUrl = API_BASE + TOKEN_PATH;
  const r = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Api-Version': API_VERSION,
    },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 300);
    throw new Error(`Payday token ${r.status} ${tokenUrl}: ${txt}`);
  }
  const tok = await r.json();
  const access = tok.accessToken || tok.access_token || tok.token;
  if (!access) throw new Error('Payday token vantar í svar: ' + JSON.stringify(tok).slice(0, 200));
  const expSec = Number(tok.expiresIn || tok.expires_in || 86400);
  const exp_ts = Date.now() + (expSec * 1000) - 60_000;
  await writeCachedToken({ access_token: access, exp_ts }).catch(()=>{});
  return access;
}

async function readCachedToken() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.payday_oauth&select=value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!rows.length) return null;
    return rows[0].value || null;
  } catch (_) { return null; }
}
async function writeCachedToken(value) {
  return fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ key: 'payday_oauth', value, updated_at: new Date().toISOString() }),
  });
}

// ---- Fetch + map ------------------------------------------------------------

async function fetchInvoicesPage(token, page, pageSize, since, until) {
  const params = new URLSearchParams();
  // Payday uses perpage + page (verified from apidoc collection).
  params.set('perpage', String(pageSize));
  params.set('page', String(page));
  if (since) params.set('dateFrom', since);
  if (until) params.set('dateTo', until);
  const url = API_BASE + INVOICES_PATH + '?' + params.toString();
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Api-Version': API_VERSION,
    },
  });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 300);
    throw new Error(`Payday invoices ${r.status}: ${txt}`);
  }
  return r.json();
}

function extractItems(resp) {
  if (Array.isArray(resp)) return resp;
  return resp.data || resp.items || resp.invoices || resp.results || resp.records || [];
}
function extractPagingMeta(resp, page, pageSize, gotCount) {
  // Try several shapes; fall back to "stop when page returns < pageSize".
  const total = Number(
    resp.total ?? resp.totalCount ?? resp.totalItems ?? resp.count
    ?? (resp.meta && (resp.meta.total ?? resp.meta.totalCount))
    ?? NaN
  );
  if (isFinite(total) && total > 0) {
    return { totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  const tp = Number(resp.totalPages ?? resp.pageCount ?? (resp.meta && resp.meta.totalPages) ?? NaN);
  if (isFinite(tp) && tp > 0) return { totalPages: tp };
  // Heuristic: if we got fewer than a full page, we're done.
  if (gotCount < pageSize) return { totalPages: page };
  return { totalPages: page + 1 }; // keep paging until we run out
}

function mapInvoice(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Try a wide range of field names — Payday's exact shape varies and we want
  // this to work without per-deploy tweaks. Inspect raw via ?probe=1 first.
  const number = pickStr(raw, 'number', 'invoiceNumber', 'invoice_number', 'no', 'nr', 'reference', 'tilvisun');
  if (!number) return null;

  const customer = raw.customer || raw.client || raw.recipient || {};
  const name = pickStr(customer, 'name', 'fullName', 'companyName')
            || pickStr(raw, 'customerName', 'clientName', 'customer_name', 'recipientName');
  const kt = pickStr(customer, 'kennitala', 'ssn', 'nationalId', 'idNumber')
          || pickStr(raw, 'kennitala', 'ssn', 'customerSsn');

  // Payday real shape: amountExcludingVat / amountIncludingVat / paidDate / invoiceDate.
  const exVat = num(pickRaw(raw, 'amountExcludingVat', 'amount', 'subtotal', 'amountExVat', 'amount_ex_vat', 'totalExcludingTax', 'totalExVat', 'netAmount'));
  const incVat = num(pickRaw(raw, 'amountIncludingVat', 'amountWithTax', 'amount_with_tax', 'total', 'totalIncludingTax', 'totalAmount', 'grossAmount'));

  const dueDate = isoDate(pickRaw(raw, 'dueDate', 'due_date', 'gjalddagi'));
  const finalDue = isoDate(pickRaw(raw, 'finalDueDate', 'final_due_date', 'eindagi', 'claimFinalDueDate'));
  const paidAt = isoDate(pickRaw(raw, 'paidDate', 'paidAt', 'paid_at', 'paymentDate', 'payment_date', 'greidsla', 'greidsla_date'));

  const status = pickStr(raw, 'status', 'state', 'paymentStatus', 'staða');

  return {
    tilvisun: String(number).trim(),
    customer_name: name || null,
    kt_greidanda: fmtKt(kt),
    hofudstoll: Math.round(exVat || 0),
    upphaed_total: Math.round(incVat || (exVat ? exVat * 1.24 : 0)),
    gjalddagi: dueDate,
    eindagi: finalDue,
    greidsla_date: paidAt,
    status: status ? String(status).trim() : null,
  };
}

// ---- Automation logging -----------------------------------------------------

async function logRun({ status, detail, started_at }) {
  await fetch(`${SUPABASE_URL}/rest/v1/automation_runs`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      job_name: JOB_NAME, status, detail: detail || null,
      source: 'netlify', started_at, finished_at: new Date().toISOString(),
    }]),
  });
}

// ---- Helpers ----------------------------------------------------------------

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
function json(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
function clampInt(v, def, lo, hi) {
  const n = parseInt(v, 10); if (!isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
function pickStr(o, ...keys) {
  if (!o) return null;
  for (const k of keys) {
    const v = o[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}
function pickRaw(o, ...keys) {
  if (!o) return null;
  for (const k of keys) if (o[k] != null && o[k] !== '') return o[k];
  return null;
}
function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[\s.]/g, '').replace(/,/g, '.'));
  return isFinite(n) ? n : 0;
}
function fmtKt(v) {
  if (v == null) return null;
  const d = String(v).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(0, 6) + '-' + d.slice(6, 10) : (d || null);
}
function isoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return null;
}
