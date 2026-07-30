// data-sources-status.js — when was each source last imported?
//   GET /api/data-sources-status →
//     { sources: [{key, label, last_import, newest_real, age_days, status, count, ...}],
//       recent_emails: [{subject, from, received_at, account}] }
//
// Returns a freshness report so the dashboard can tell the user
// "Tímavera is 3 days old — re-export from timavera.is" etc.
//
// `last_import`  = when the source was last SYNCED (file import / sync stamp).
// `newest_real`  = the newest REAL data date in the source (e.g. newest workday,
//                  newest Ajour execution date). Freshness/age is based on this
//                  for time-data sources so a re-imported-today file with old
//                  rows is not reported as "fresh".

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

  // helper: newest REAL data date for a source (the freshest actual record,
  // not the file-import stamp). Returns the first value of `col`.
  const newest = async (table, col) => {
    const r = await get(`${table}?select=${col}&order=${col}.desc.nullslast&limit=1`);
    return r?.[0]?.[col] ?? null;
  };

  // ----- Tímavera (meta has the file-import stamp; real freshness = newest workday) -----
  const tvMeta = await get('timavera_meta?id=eq.1&select=last_import,row_count,source_file');
  const tvTs = tvMeta?.[0]?.last_import;                 // last sync (file import)
  const tvReal = await newest('timavera_entries', 'date'); // newest actual workday
  const tvCount = await head('timavera_entries');

  // ----- Ajour registrations -----
  const ajLatest = await get('ajour_registrations?select=registration_created_date&order=registration_created_date.desc.nullslast&limit=1');
  const ajTs = ajLatest?.[0]?.registration_created_date;
  const ajReal = await newest('ajour_registrations', 'execution_date');
  const ajCount = await head('ajour_registrations');

  // ----- Landsbankinn bank ledger -----
  const bankLatest = await get('bank_transactions?select=imported_at&order=imported_at.desc.nullslast&limit=1');
  const bankTs = bankLatest?.[0]?.imported_at;
  const bankReal = await newest('bank_transactions', 'trans_date');
  const bankCount = await head('bank_transactions');

  // ----- Invoices (Payday + Landsbankinn krafnir, most recent imported_at) -----
  const invLatest = await get('invoices?select=imported_at&order=imported_at.desc.nullslast&limit=1');
  const invTs = invLatest?.[0]?.imported_at;
  const invReal = await newest('invoices', 'greidsla_date'); // newest payment seen
  const invCount = await head('invoices');

  // ----- Redder (material) invoices -----
  const rdLatest = await get('redder_invoices?select=imported_at&order=imported_at.desc.nullslast&limit=1');
  const rdTs = rdLatest?.[0]?.imported_at;
  const rdReal = await newest('redder_invoices', 'dagsetning');
  const rdCount = await head('redder_invoices');

  // ----- Email digest (luna-bridge scrape) -----
  // folder=neq.SENT everywhere below: sent-mail rows (SENT ingest, 2026-07-10)
  // must not skew inbox freshness or show up under "newest emails".
  const edLatest = await get('email_digest?select=received_at&folder=neq.SENT&order=received_at.desc.nullslast&limit=1');
  const edTs = edLatest?.[0]?.received_at;
  const edReal = edTs; // for email the received_at IS the real data date
  const edCount = await head('email_digest');

  // ----- 5 newest emails (defensive; never breaks the report) -----
  let recent_emails = [];
  try {
    const rows = await get('email_digest?select=subject,sender_name,sender_email,received_at,account&folder=neq.SENT&order=received_at.desc.nullslast&limit=5');
    if (Array.isArray(rows)) {
      recent_emails = rows.map(r => ({
        subject: r.subject || '(án efnis)',
        from: r.sender_name || r.sender_email || '',
        sender_email: r.sender_email || null,
        received_at: r.received_at || null,
        account: r.account || null,
      }));
    }
  } catch (_) { recent_emails = []; }

  // ----- Per-mailbox connection status (reminder of which accounts to connect) -----
  // One entry per EXPECTED business mailbox; status from the newest received_at.
  let email_accounts = [];
  try {
    const EXPECTED = [
      'eldklar@eldklar.is', 'Brunaholf@brunaholf.is', 'bokhald@brunaholf.is',
      'brunaholfehf@gmail.com', 'bokhald@eldklar.is', 'aggi@brunaholf.is',
    ];
    email_accounts = await Promise.all(EXPECTED.map(async (acct) => {
      const rows = await get(
        'email_digest?account=eq.' + encodeURIComponent(acct) +
        '&folder=neq.SENT&select=received_at&order=received_at.desc.nullslast&limit=1'
      );
      const newest = rows?.[0]?.received_at ?? null;
      const age_days = ageDays(newest);
      let status;
      if (newest == null) status = 'not_connected';
      else if (age_days <= 2) status = 'fresh';
      else if (age_days <= 14) status = 'aging';
      else status = 'stale';
      return { account: acct, newest, age_days, status };
    }));
  } catch (_) { email_accounts = []; }

  const sources = [
    {
      key: 'timavera', label: 'Tímavera klst',
      file_hint: 'Tímavera API beintenging (timavera-pull)',
      icon: '⏱',
      // Freshness is based on the newest REAL workday, not the file-import stamp
      // (the file can be re-imported "today" while the newest entry is older).
      last_import: tvTs, newest_real: tvReal,
      age_days: ageDays(tvReal), status: statusFor(ageDays(tvReal)),
      count: tvCount,
      details: tvMeta?.[0]?.source_file ? `Síðasta skrá: ${tvMeta[0].source_file}` : null,
    },
    {
      key: 'ajour', label: 'Ajour skráningar',
      file_hint: 'AjourRegistrationData*.csv',
      icon: '🏗',
      last_import: ajTs, newest_real: ajReal,
      age_days: ageDays(ajReal), status: statusFor(ageDays(ajReal)),
      count: ajCount, details: null,
    },
    {
      key: 'bank', label: 'Landsbankinn ledger',
      file_hint: 'LandsbankinnExcel(DD_MM_YYYY).xlsx',
      icon: '🏦',
      last_import: bankTs, newest_real: bankReal,
      age_days: ageDays(bankReal), status: statusFor(ageDays(bankReal)),
      count: bankCount, details: null,
    },
    {
      key: 'invoices', label: 'Payday + krafnir',
      file_hint: 'Sjálfvirk samstilling',
      icon: '💳',
      // status reflects sync freshness (imported_at); newest_real = last payment seen
      last_import: invTs, newest_real: invReal,
      age_days: ageDays(invTs), status: statusFor(ageDays(invTs)),
      count: invCount, details: null,
    },
    {
      key: 'redder', label: 'Redder efnisreikningar',
      file_hint: 'Reikningur-NNNNNN.PDF (Drive)',
      icon: '📦',
      last_import: rdTs, newest_real: rdReal,
      age_days: ageDays(rdReal), status: statusFor(ageDays(rdReal)),
      count: rdCount, details: null,
    },
    {
      key: 'email', label: 'Email digest',
      file_hint: 'Gmail úr skýi (gmail-ingest) + luna-bridge fyrir @brunaholf.is',
      icon: '📧',
      last_import: edTs, newest_real: edReal,
      age_days: ageDays(edReal), status: statusFor(ageDays(edReal)),
      count: edCount, details: null,
    },
  ];

  return json(200, {
    sources,
    recent_emails,
    email_accounts,
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
