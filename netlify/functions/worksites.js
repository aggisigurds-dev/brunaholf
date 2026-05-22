// worksites.js — Worksite billing audit for Brunahólf.
// For each project that appears in Tímavera data (per year), aggregate:
//   - hours, days, staff_count, first/last entry, monthly hours
//   - email mentions from email_digest (Brunaholf@brunaholf.is + others)
//   - manual billing status (from worksite_status table)
//
// Supports:
//   GET  /api/worksites?year=2026
//   POST /api/worksites  body { project_name, year, billing_status?, notes?, drive_folder_url? }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') return updateStatus(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const year = parseInt(p.year || String(new Date().getFullYear()), 10);

  try {
    const [entries, emails, statuses, invoices, ajourCounts, mappings] = await Promise.all([
      fetchAllPages(`timavera_entries?select=project,hours,date,employee&date=gte.${year}-01-01&date=lte.${year}-12-31&order=date.asc`),
      fetchAllPages(`email_digest?select=id,account,sender_email,sender_name,subject,snippet,received_at`),
      sb(`worksite_status?year=eq.${year}&select=*`),
      fetchAllPages(`invoices?select=*&gjalddagi=gte.${year}-01-01&gjalddagi=lte.${year}-12-31&order=gjalddagi.desc`),
      fetchAjourCounts(year),
      sb(`customer_worksite_map?select=*`),
    ]);

    const byProject = new Map();
    for (const r of entries) {
      const p = r.project;
      if (!byProject.has(p)) byProject.set(p, {
        project: p,
        hours: 0, days: new Set(), staff: new Set(),
        first: null, last: null,
        monthly: {},
      });
      const a = byProject.get(p);
      const h = Number(r.hours) || 0;
      a.hours += h;
      a.days.add(r.date);
      a.staff.add(r.employee);
      if (!a.first || r.date < a.first) a.first = r.date;
      if (!a.last  || r.date > a.last)  a.last  = r.date;
      const ym = r.date.slice(0, 7);
      a.monthly[ym] = (a.monthly[ym] || 0) + h;
    }

    // Email match — substring on subject + snippet (case-insensitive, drop short words)
    const projectsArr = [...byProject.values()].map(p => ({
      ...p,
      project_lc: p.project.toLowerCase(),
      core: extractCore(p.project),
    }));

    const emailsByProject = {};
    for (const e of emails) {
      const hay = ((e.subject || '') + ' ' + (e.snippet || '')).toLowerCase();
      if (!hay.trim()) continue;
      for (const p of projectsArr) {
        if (!p.core || p.core.length < 4) continue;
        if (hay.includes(p.core)) {
          (emailsByProject[p.project] = emailsByProject[p.project] || []).push({
            id: e.id,
            account: e.account,
            sender: e.sender_name || e.sender_email || '?',
            subject: e.subject || '(engin efnislína)',
            received_at: e.received_at,
            snippet: (e.snippet || '').slice(0, 200),
          });
        }
      }
    }

    const statusByProject = {};
    for (const s of statuses) statusByProject[s.project_name] = s;

    // Build customer↔worksite mapping
    const mapByWorksite = {};
    for (const m of mappings) {
      (mapByWorksite[m.worksite_name] = mapByWorksite[m.worksite_name] || []).push(m);
    }
    // Index invoices by customer + worksite_match
    const invByCustomer = {};
    const invByMatch = {};
    for (const inv of invoices) {
      const c = (inv.customer_name || '').toLowerCase();
      if (c) (invByCustomer[c] = invByCustomer[c] || []).push(inv);
      const m = inv.worksite_match;
      if (m) (invByMatch[m] = invByMatch[m] || []).push(inv);
    }

    const worksites = projectsArr.map(p => {
      // Find invoices for this worksite — explicit match wins, then via customer map
      const invMatches = new Map();
      for (const inv of (invByMatch[p.project] || [])) invMatches.set(inv.id, inv);
      for (const m of (mapByWorksite[p.project] || [])) {
        const c = (m.customer_name || '').toLowerCase();
        for (const inv of (invByCustomer[c] || [])) invMatches.set(inv.id, inv);
      }
      const linkedInvoices = [...invMatches.values()];
      const invSum = linkedInvoices.reduce((a, i) => a + Number(i.hofudstoll || 0), 0);
      const unpaid = linkedInvoices
        .filter(i => /ógreidd|vanskil/i.test(i.status || ''))
        .reduce((a, i) => a + Number(i.hofudstoll || 0), 0);
      const ajour = ajourCounts[p.project] || 0;

      return {
        project: p.project,
        hours: round1(p.hours),
        days: p.days.size,
        staff_count: p.staff.size,
        first: p.first,
        last: p.last,
        monthly: p.monthly,
        email_count: (emailsByProject[p.project] || []).length,
        emails: (emailsByProject[p.project] || []).slice(0, 8),
        ajour_registrations: ajour,
        invoice_count:  linkedInvoices.length,
        invoice_total:  Math.round(invSum),
        invoice_unpaid: Math.round(unpaid),
        invoices: linkedInvoices.map(i => ({
          id: i.id,
          tilvisun: i.tilvisun,
          customer: i.customer_name,
          gjalddagi: i.gjalddagi,
          amount: Number(i.hofudstoll || 0),
          status: i.status,
          greidsla_date: i.greidsla_date,
        })),
        mapped_customers: (mapByWorksite[p.project] || []).map(m => m.customer_name),
        status: statusByProject[p.project] || {
          billing_status: 'unreviewed', notes: null, drive_folder_url: null,
          contract_url: null, invoice_amount: null, invoice_date: null,
        },
      };
    }).sort((a, b) => b.hours - a.hours);

    const summary = {
      year,
      total_worksites: worksites.length,
      total_hours: round1(worksites.reduce((a, w) => a + w.hours, 0)),
      total_days: new Set(entries.map(r => r.date)).size,
      total_invoiced: worksites.reduce((a, w) => a + (w.invoice_total || 0), 0),
      total_unpaid:   worksites.reduce((a, w) => a + (w.invoice_unpaid || 0), 0),
      total_ajour_registrations: worksites.reduce((a, w) => a + (w.ajour_registrations || 0), 0),
      worksites_with_no_invoice: worksites.filter(w => w.invoice_count === 0 && w.hours > 0 && !/almennt|veikindi|sick|work at home/i.test(w.project)).length,
      by_status: {
        unreviewed:           worksites.filter(w => w.status.billing_status === 'unreviewed').length,
        review:               worksites.filter(w => w.status.billing_status === 'review').length,
        billing_in_progress:  worksites.filter(w => w.status.billing_status === 'billing_in_progress').length,
        invoiced:             worksites.filter(w => w.status.billing_status === 'invoiced').length,
        not_billable:         worksites.filter(w => w.status.billing_status === 'not_billable').length,
      },
    };

    return json(200, { generated_at: new Date().toISOString(), summary, worksites });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

async function updateStatus(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const { project_name, year } = body;
  if (!project_name || !year) return json(400, { error: 'project_name and year are required' });

  const allowed = ['billing_status','notes','drive_folder_url','contract_url','invoice_amount','invoice_date','updated_by'];
  const payload = { project_name, year, updated_at: new Date().toISOString() };
  for (const k of allowed) if (body[k] !== undefined) payload[k] = body[k];

  const r = await fetch(`${SUPABASE_URL}/rest/v1/worksite_status?on_conflict=project_name,year`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  const out = await r.json();
  return json(200, { ok: true, row: out[0] });
}

// Pull Ajour registration counts per project for a given year. Returns
// { 'Project Name': 12345, ... }
async function fetchAjourCounts(year) {
  // PostgREST aggregate via head=true + count, per project
  const rows = await fetchAllPages(`ajour_registrations?select=project_name,execution_date&execution_date=gte.${year}-01-01&execution_date=lte.${year}-12-31`);
  const out = {};
  for (const r of rows) out[r.project_name] = (out[r.project_name] || 0) + 1;
  return out;
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function fetchAllPages(path) {
  const out = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Range': `${from}-${from + pageSize - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// Pull the "core" identifying token from a project name — drop common prefixes
// and noise so substring matching against emails is more accurate.
function extractCore(name) {
  if (!name) return '';
  let n = name.toLowerCase();
  // Drop sick-leave / "almennt" buckets — won't match real emails
  if (n.includes('veikindi') || n.includes('sick') || n.includes('almennt') || n.includes('work at home')) return '';
  // Strip leading "!!!", trailing /numbers
  n = n.replace(/^[!\s]+/, '').trim();
  // Take the most distinctive 2–3 words
  const parts = n.split(/[\s,\-]+/).filter(p => p && p.length > 2);
  return parts.slice(0, 2).join(' ');
}

function round1(n) { return Math.round(n * 10) / 10; }
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
