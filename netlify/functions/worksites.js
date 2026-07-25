// worksites.js — Worksite billing audit for Brunahólf.
// For each project that appears in Tímavera data (per year), aggregate:
//   - hours, days, staff_count, first/last entry, monthly hours
//   - email mentions from email_digest (Brunaholf@brunaholf.is + others)
//   - manual billing status (from worksite_status table)
//
// Supports:
//   GET  /api/worksites?year=2026
//   POST /api/worksites  body { project_name, year, billing_status?, notes?, drive_folder_url?, payday_url? }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') return updateStatus(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const yearParam = (p.year || String(new Date().getFullYear())).trim();
  // Range can be a single year or "combined" (current + previous)
  const now = new Date().getFullYear();
  let dateFrom, dateTo, statusYears, labelYear;
  if (yearParam === 'combined') {
    dateFrom = `${now - 1}-01-01`; dateTo = `${now}-12-31`;
    statusYears = [now - 1, now]; labelYear = `${now-1}+${now}`;
  } else {
    const y = parseInt(yearParam, 10) || now;
    dateFrom = `${y}-01-01`; dateTo = `${y}-12-31`;
    statusYears = [y]; labelYear = y;
  }

  try {
    const [entries, emails, statuses, invoices, ajourCounts, mappings, bankIn, customerInfos] = await Promise.all([
      fetchAllPages(`timavera_entries?select=project,hours,date,employee&date=gte.${dateFrom}&date=lte.${dateTo}&order=date.asc`),
      // folder=neq.SENT — our own sent replies must not count as email mentions
      // Scope email mentions to the same year window as timavera/ajour (was: whole
      // ~30k-row table on every call → ~23s). received_at≥dateFrom cuts it to the
      // current 1–2 year window; email→worksite matching only needs in-window mail.
      fetchAllPages(`email_digest?select=id,account,sender_email,sender_name,subject,snippet,received_at&folder=neq.SENT&received_at=gte.${dateFrom}`),
      sb(`worksite_status?year=in.(${statusYears.join(',')})&select=*`),
      fetchAllPages(`invoices?select=*&or=(gjalddagi.is.null,and(gjalddagi.gte.${dateFrom},gjalddagi.lte.${dateTo}))&order=gjalddagi.desc.nullslast`),
      fetchAjourCountsRange(dateFrom, dateTo),
      sb(`customer_worksite_map?select=*`),
      fetchAllPages(`bank_transactions?select=trans_date,amount,text,kt_counterparty&amount=gt.0`),
      sb(`customer_info?select=*`),
    ]);
    const customerInfoByName = {};
    for (const ci of customerInfos) customerInfoByName[ci.customer_name] = ci;

    // Build customer → total bank inflow index. Match by kt_counterparty if present,
    // else by first word of customer_name in `text`.
    const bankByKt = {};
    const bankByText = []; // [{text_lower, amount}]
    for (const t of bankIn) {
      if (t.kt_counterparty) {
        const kt = String(t.kt_counterparty).replace(/-/g, '');
        bankByKt[kt] = (bankByKt[kt] || 0) + Number(t.amount || 0);
      }
      if (t.text) bankByText.push({ text: t.text.toLowerCase(), amount: Number(t.amount || 0) });
    }
    function bankInflowForCustomer(customerName, kt) {
      let total = 0;
      if (kt) {
        const cleanKt = String(kt).replace(/-/g, '');
        if (bankByKt[cleanKt]) total += bankByKt[cleanKt];
      }
      // also fuzzy text match — first 1-2 distinctive words
      const words = (customerName || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.length) {
        const needle = words[0]; // e.g. "þg" or "krókur" or "dalvegur"
        for (const t of bankByText) {
          if (t.text.includes(needle)) total += t.amount;
        }
      }
      return total;
    }

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
      // Find invoices for this worksite + retention metadata per customer.
      const invMatches = new Map();
      const customerRet = {}; // customer -> retention_pct
      for (const inv of (invByMatch[p.project] || [])) invMatches.set(inv.id, inv);
      for (const m of (mapByWorksite[p.project] || [])) {
        const c = (m.customer_name || '').toLowerCase();
        customerRet[c] = Number(m.retention_pct || 0);
        for (const inv of (invByCustomer[c] || [])) invMatches.set(inv.id, inv);
      }
      const linkedInvoices = [...invMatches.values()];
      const invSum = linkedInvoices.reduce((a, i) => a + Number(i.hofudstoll || 0), 0);
      // Unpaid = complement (not paid/draft/cancelled/credit) so English Payday
      // statuses (SENT) count, not just Icelandic ógreidd/ógreitt. „ó/o"-prefix
      // guards against ógreidd matching the paid word.
      const rawUnpaid = linkedInvoices
        .filter(i => {
          const s = i.status || '';
          if (i.greidsla_date) return false;
          if (!/[óo]grei/i.test(s) && /paid|greitt|greidd/i.test(s)) return false;
          if (/draft|dr[öo]g|cancel|afturk|felld|[óo]gild|credit|kredit/i.test(s)) return false;
          return true;
        })
        .reduce((a, i) => a + Number(i.hofudstoll || 0), 0);
      const expectedRetention = linkedInvoices
        .filter(i => Number(i.hofudstoll || 0) > 0)
        .reduce((a, i) => {
          const c = (i.customer_name || '').toLowerCase();
          const pct = customerRet[c] || 0;
          return a + Number(i.hofudstoll || 0) * (pct / 100);
        }, 0);
      // Per-customer bank inflows for the invoices' customers — extra "paid via bank but not in Payday"
      const customers = [...new Set(linkedInvoices.map(i => (i.customer_name||'')).filter(Boolean))];
      let bankPaid = 0;
      for (const c of customers) {
        const ktInv = linkedInvoices.find(i => i.customer_name === c && i.kt_greidanda)?.kt_greidanda;
        bankPaid += bankInflowForCustomer(c, ktInv);
      }
      // Don't credit MORE than the customer was invoiced (avoid over-counting)
      bankPaid = Math.min(bankPaid, invSum);
      // Real overdue = raw unpaid − retention held − bank payments not yet reflected
      const overpaidVsPayday = Math.max(0, bankPaid - (invSum - rawUnpaid));
      const unpaid = Math.max(0, rawUnpaid - expectedRetention - overpaidVsPayday);
      const retentionHeld = Math.min(rawUnpaid, expectedRetention);
      const bankCoveredHidden = Math.min(rawUnpaid - retentionHeld, overpaidVsPayday);
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
        invoice_unpaid_raw: Math.round(rawUnpaid),
        retention_held: Math.round(retentionHeld),
        bank_covered_hidden: Math.round(bankCoveredHidden),
        bank_inflow_total: Math.round(bankPaid),
        retention_pct: customerRet[(mapByWorksite[p.project]||[])[0]?.customer_name?.toLowerCase()] || 0,
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
        mapped_customer_info: (mapByWorksite[p.project] || []).map(m => ({
          customer_name: m.customer_name,
          ...(customerInfoByName[m.customer_name] || {}),
        })),
        status: statusByProject[p.project] || {
          billing_status: 'unreviewed', notes: null, drive_folder_url: null,
          contract_url: null, payday_url: null, invoice_amount: null, invoice_date: null,
        },
      };
    }).sort((a, b) => b.hours - a.hours);

    const summary = {
      year: labelYear,
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

  const allowed = ['billing_status','notes','drive_folder_url','contract_url','payday_url','invoice_amount','invoice_date','updated_by'];
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

// Pull Ajour registration counts per project for a date range. Uses
// project_aliases so e.g. "NLSH 5-6. hæð" rolls up under "Landsspitalinn".
async function fetchAjourCountsRange(dateFrom, dateTo) {
  const [aliases, rows] = await Promise.all([
    sb('project_aliases?select=canonical_name,alias'),
    fetchAllPages(`ajour_registrations?select=project_name,execution_date&execution_date=gte.${dateFrom}&execution_date=lte.${dateTo}`),
  ]);
  const aliasMap = {};
  for (const a of aliases) aliasMap[a.alias] = a.canonical_name;
  const out = {};
  for (const r of rows) {
    const canonical = aliasMap[r.project_name] || r.project_name;
    out[canonical] = (out[canonical] || 0) + 1;
  }
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
