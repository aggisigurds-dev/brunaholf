// debtors.js — Skuldunautar / hreyfingalisti.
//
//   GET /api/debtors
//     → { generated_at, today, totals, vintages[], aging[], debtors[] }
//
// An accounts-receivable ledger built from the `invoices` table (jobs posted in
// Payday + Landsbankinn kröfur + manual Tekjur-sheet rows), reconciled against
// `bank_transactions` inflows so direct-to-bank payments (which leave a stale
// "Ógreitt") are surfaced rather than silently counted as outstanding.
//
// Per open invoice we compute a bank-match hint:
//   • 'bank' (strong)  — same kt + amount within max(5.000, 1%) + paid on/after
//                        gjalddagi−15d  → almost certainly already paid to bank.
//   • 'maybe' (weak)   — an amount-only collision from a DIFFERENT/blank kt
//                        (e.g. Reykjavíkurborg greiðir fyrir skóla) → shown with
//                        the bank text so the user makes the call.
//   • 'open'           — no candidate; genuinely outstanding.
// Invoices with an exact offsetting credit note (Kreditreikningur) are flagged
// 'credited' and dropped from the outstanding total.
//
// "Útistandandi" (the headline) = open invoices that are NEITHER credited NOR
// strong-bank-matched. Drafts (Drög) and credit notes are excluded entirely.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Status vocabulary is MIXED: Payday-API rows are English UPPERCASE
// (PAID/SENT/CANCELLED/CREDIT/DRAFT); Landsbanki/manual rows are Icelandic
// (Greitt/Greidd/Ógreidd/Drög). Match by SUBSTRING, and define "open" as the
// COMPLEMENT (not paid/credited/cancelled/draft) so a new status word never
// silently drops real AR — an exact-string OPEN set had dropped all 41 SENT
// invoices (~130M). Keep in sync with hreyfingar.js + krofur-yfirlit.js.
// NB the „ó/o" negation prefix: „ógreitt/ógreidd" = UNPAID, must NOT match paid.
const isPaid = (st) => !/[óo]grei/i.test(st) && /paid|greitt|greidd|greid/i.test(st);
const isCancelled = (st) => /cancel|afturk|felld|[óo]gild/i.test(st);
const isDraft = (st) => /draft|dr[öo]g/i.test(st);
const isCreditWord = (st) => /credit|kredit/i.test(st);

const digits = (s) => String(s || '').replace(/\D/g, '');
const lc = (s) => String(s || '').trim().toLowerCase();

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  let invoices, bank;
  try {
    invoices = await fetchAll('invoices',
      'select=id,tilvisun,kt_greidanda,customer_name,gjalddagi,eindagi,hofudstoll,upphaed_total,status,greidsla_date,source');
    bank = await fetchAll('bank_transactions',
      'select=kt_counterparty,amount,trans_date,text,description&amount=gt.0');
  } catch (e) { return json(502, { error: e.message }); }

  const today = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(today);

  // ---- index bank inflows by kt + keep a flat list for amount-only fallback ----
  const inflowByKt = new Map();   // kt -> [{amount,date,text}]
  for (const b of bank) {
    const kt = digits(b.kt_counterparty);
    const rec = { amount: +b.amount || 0, date: b.trans_date, text: b.text || b.description || '', kt };
    if (kt) { (inflowByKt.get(kt) || inflowByKt.set(kt, []).get(kt)).push(rec); }
  }

  // ---- split invoices ----
  const open = [], credits = [];
  for (const r of invoices) {
    const st = lc(r.status);
    const amt = +r.upphaed_total || +r.hofudstoll || 0;
    if (isCreditWord(st) && amt < 0) { credits.push(r); continue; }  // credit note (negative leg)
    if (isDraft(st) || isCancelled(st) || isPaid(st)) continue;      // not outstanding
    if (amt <= 0) continue;
    open.push(r);   // SENT / Ógreidd / OPEN / OVERDUE = genuinely unpaid AR
  }

  // ---- offsetting credit notes: same kt, |open + credit| within tolerance ----
  const creditByKt = new Map();
  for (const c of credits) {
    const kt = digits(c.kt_greidanda);
    if (!kt) continue;
    (creditByKt.get(kt) || creditByKt.set(kt, []).get(kt)).push({ amount: +c.upphaed_total || +c.hofudstoll || 0, used: false });
  }
  const isCredited = (inv) => {
    const kt = digits(inv.kt_greidanda);
    const amt = +inv.upphaed_total || +inv.hofudstoll || 0;
    const pool = creditByKt.get(kt);
    if (!pool) return false;
    const tol = Math.max(5000, amt * 0.005);
    const hit = pool.find(c => !c.used && Math.abs(amt + c.amount) <= tol);
    if (hit) { hit.used = true; return true; }
    return false;
  };

  // ---- per-invoice bank reconciliation ----
  function bankMatch(inv) {
    const kt = digits(inv.kt_greidanda);
    const amt = +inv.upphaed_total || +inv.hofudstoll || 0;
    const dueMs = inv.gjalddagi ? Date.parse(inv.gjalddagi) : null;
    // strong: same kt, amount within max(5000,1%), paid on/after gjalddagi-15d
    if (kt && inflowByKt.has(kt)) {
      const tol = Math.max(5000, amt * 0.01);
      for (const b of inflowByKt.get(kt)) {
        if (Math.abs(b.amount - amt) <= tol &&
            (!dueMs || (Date.parse(b.date) >= dueMs - 15 * 864e5))) {
          return { type: 'bank', amount: b.amount, date: b.date, text: b.text };
        }
      }
    }
    // weak: amount-only collision from a different/blank kt → flag, don't trust
    const tol2 = 2000;
    for (const b of bank) {
      if (Math.abs((+b.amount || 0) - amt) <= tol2 && digits(b.kt_counterparty) !== kt) {
        return { type: 'maybe', amount: +b.amount || 0, date: b.trans_date, text: b.text || b.description || '' };
      }
    }
    return { type: 'open' };
  }

  // ---- build rows ----
  const rows = open.map(inv => {
    const credited = isCredited(inv);
    const m = credited ? { type: 'credited' } : bankMatch(inv);
    const amt = +inv.upphaed_total || +inv.hofudstoll || 0;
    const dueMs = inv.gjalddagi ? Date.parse(inv.gjalddagi) : null;
    const days_overdue = dueMs != null ? Math.round((todayMs - dueMs) / 864e5) : null;
    return {
      id: inv.id, tilvisun: inv.tilvisun, source: inv.source,
      kt: digits(inv.kt_greidanda), customer: inv.customer_name || '(óþekkt)',
      gjalddagi: inv.gjalddagi, days_overdue, amount: amt,
      status: m.type,            // open | bank | maybe | credited
      bank: m.type === 'bank' || m.type === 'maybe'
        ? { amount: m.amount, date: m.date, text: m.text } : null,
      // counts toward outstanding only if genuinely open or weak-maybe
      outstanding: (m.type === 'open' || m.type === 'maybe') ? amt : 0,
    };
  });

  // ---- per-debtor rollup ----
  const byDebtor = new Map();
  for (const r of rows) {
    const key = r.kt || lc(r.customer);
    let d = byDebtor.get(key);
    if (!d) byDebtor.set(key, d = {
      kt: r.kt, customer: r.customer, invoices: [],
      open_kr: 0, outstanding_kr: 0, bank_paid_kr: 0, credited_kr: 0, maybe_kr: 0,
      bank_inflow_kr: 0, last_inflow: null, oldest_due: null,
    });
    d.invoices.push(r);
    d.open_kr += r.amount;
    d.outstanding_kr += r.outstanding;
    if (r.status === 'bank') d.bank_paid_kr += r.amount;
    if (r.status === 'credited') d.credited_kr += r.amount;
    if (r.status === 'maybe') d.maybe_kr += r.amount;
    if (r.gjalddagi && (!d.oldest_due || r.gjalddagi < d.oldest_due)) d.oldest_due = r.gjalddagi;
  }
  for (const [, d] of byDebtor) {
    const inf = inflowByKt.get(d.kt) || [];
    d.bank_inflow_kr = inf.reduce((a, b) => a + b.amount, 0);
    d.last_inflow = inf.reduce((mx, b) => (!mx || b.date > mx ? b.date : mx), null);
    d.invoices.sort((a, b) => (b.amount - a.amount));
  }
  const debtors = [...byDebtor.values()]
    .filter(d => d.outstanding_kr > 0 || d.bank_paid_kr > 0 || d.credited_kr > 0)
    .sort((a, b) => b.outstanding_kr - a.outstanding_kr);

  // ---- totals + aging + vintage (outstanding only) ----
  const out = rows.filter(r => r.outstanding > 0);
  const sum = (arr) => arr.reduce((a, r) => a + r.outstanding, 0);
  const aging = [
    { bucket: 'Ógjaldfallið', test: r => r.days_overdue != null && r.days_overdue < 0 },
    { bucket: '0–30 dagar', test: r => r.days_overdue != null && r.days_overdue >= 0 && r.days_overdue <= 30 },
    { bucket: '31–90 dagar', test: r => r.days_overdue > 30 && r.days_overdue <= 90 },
    { bucket: '91–365 dagar', test: r => r.days_overdue > 90 && r.days_overdue <= 365 },
    { bucket: 'Eldri en ár', test: r => r.days_overdue > 365 },
  ].map(b => { const xs = out.filter(b.test); return { bucket: b.bucket, n: xs.length, kr: sum(xs) }; });
  const vy = (r) => (r.gjalddagi || '').slice(0, 4) || '?';
  const vmap = {};
  for (const r of out) { (vmap[vy(r)] || (vmap[vy(r)] = { n: 0, kr: 0 })); vmap[vy(r)].n++; vmap[vy(r)].kr += r.outstanding; }
  const vintages = Object.keys(vmap).sort().reverse().map(y => ({ year: y, n: vmap[y].n, kr: vmap[y].kr }));

  const totals = {
    outstanding_kr: sum(out),
    outstanding_n: out.length,
    bank_paid_kr: rows.filter(r => r.status === 'bank').reduce((a, r) => a + r.amount, 0),
    bank_paid_n: rows.filter(r => r.status === 'bank').length,
    maybe_kr: rows.filter(r => r.status === 'maybe').reduce((a, r) => a + r.amount, 0),
    credited_kr: rows.filter(r => r.status === 'credited').reduce((a, r) => a + r.amount, 0),
    credited_n: rows.filter(r => r.status === 'credited').length,
    debtor_count: debtors.filter(d => d.outstanding_kr > 0).length,
  };

  return json(200, {
    generated_at: new Date().toISOString(), today,
    totals, vintages, aging, debtors,
    note: 'Útistandandi = ógreiddir reikningar sem hvorki eru kreditfærðir né fundust greiddir beint í banka. „Kannski í banka“ = upphæð fannst í banka frá öðrum greiðanda (t.d. Reykjavíkurborg fyrir skóla) — staðfestu handvirkt.',
  });
};

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
