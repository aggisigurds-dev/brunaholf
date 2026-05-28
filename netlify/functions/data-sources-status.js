// data-sources-status.js — when was each source last imported?
//   GET /api/data-sources-status → { sources: [{key, label, last_import, age_days, status, count}] }
//
// Returns a freshness report so the dashboard can tell the user
// "Tímavera is 3 days old — re-export from timavera.is" etc.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const get = async (path) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return null;
    return await r.json();
  };
  const head = async (path) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact',
      },
    });
    return parseInt(r.headers.get('content-range')?.split('/')[1] || '0', 10) || 0;
  };

  const now = Date.now();
  const ageDays = (ts) => ts ? Math.floor((now - new Date(ts).getTime()) / 86400000) : null;
  const statusFor = (age) => age == null ? 'unknown' : age <= 1 ? 'fresh' : age <= 7 ? 'aging' : 'stale';

  // ----- Tímavera (meta table has explicit last_import) -----
  const tvMeta = await get('timavera_meta?id=eq.1&select=last_import,row_count,source_file');
  const tvTs = tvMeta?.[0]?.last_import;
  const tvCount = await head('timavera_entries');

  // ----- Ajour registrations (use most recent imported_at row) -----
  const ajLatest = await get('ajour_registrations?select=registration_created_date&order=registration_created_date.desc.nullslast&limit=1');
  const ajTs = ajLatest?.[0]?.registration_created_date;
  const ajCount = await head('ajour_registrations');

  // ----- Landsbankinn bank ledger (most recent imported_at) -----
  const bankLatest = await get('bank_transactions?select=imported_at&order=imported_at.desc.nullslast&limit=1');
  const bankTs = bankLatest?.[0]?.imported_at;
  const bankCount = await head('bank_transactions');

  // ----- Invoices (Payday + Landsbankinn krafnir, most recent imported_at) -----
  const invLatest = await get('invoices?select=imported_at&order=imported_at.desc.nullslast&limit=1');
  const invTs = invLatest?.[0]?.imported_at;
  const invCount = await head('invoices');

  // ----- Redder (material) invoices -----
  const rdLatest = await get('redder_invoices?select=imported_at&order=imported_at.desc.nullslast&limit=1');
  const rdTs = rdLatest?.[0]?.imported_at;
  const rdCount = await head('redder_invoices');

  // ----- Email digest (luna-bridge scrape) -----
  const edLatest = await get('email_digest?select=received_at&order=received_at.desc.nullslast&limit=1');
  const edTs = edLatest?.[0]?.received_at;
  const edCount = await head('email_digest');

  const sources = [
    {
      key: 'timavera', label: 'Tímavera klst',
      file_hint: 'Tímaveru vinnufærslur*.xlsx',
      icon: '⏱',
      last_import: tvTs, age_days: ageDays(tvTs), status: statusFor(ageDays(tvTs)),
      count: tvCount,
      details: tvMeta?.[0]?.source_file ? `Síðasta skrá: ${tvMeta[0].source_file}` : null,
    },
    {
      key: 'ajour', label: 'Ajour skráningar',
      file_hint: 'AjourRegistrationData*.csv',
      icon: '🏗',
      last_import: ajTs, age_days: ageDays(ajTs), status: statusFor(ageDays(ajTs)),
      count: ajCount, details: null,
    },
    {
      key: 'bank', label: 'Landsbankinn ledger',
      file_hint: 'LandsbankinnExcel(DD_MM_YYYY).xlsx',
      icon: '🏦',
      last_import: bankTs, age_days: ageDays(bankTs), status: statusFor(ageDays(bankTs)),
      count: bankCount, details: null,
    },
    {
      key: 'invoices', label: 'Payday + krafnir',
      file_hint: 'Sjálfvirk samstilling',
      icon: '💳',
      last_import: invTs, age_days: ageDays(invTs), status: statusFor(ageDays(invTs)),
      count: invCount, details: null,
    },
    {
      key: 'redder', label: 'Redder efnisreikningar',
      file_hint: 'Reikningur-NNNNNN.PDF (Drive)',
      icon: '📦',
      last_import: rdTs, age_days: ageDays(rdTs), status: statusFor(ageDays(rdTs)),
      count: rdCount, details: null,
    },
    {
      key: 'email', label: 'Email digest',
      file_hint: 'luna-bridge (Thunderbird mbox sync)',
      icon: '📧',
      last_import: edTs, age_days: ageDays(edTs), status: statusFor(ageDays(edTs)),
      count: edCount, details: null,
    },
  ];

  return json(200, {
    sources,
    fetched_at: new Date().toISOString(),
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
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
