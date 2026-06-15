// hreyfingar.js — Hreyfingaryfirlit (customer account-movements / statement).
//
//   GET /api/hreyfingar
//     → { generated_at, today, totals, customers[] }
//
// A running account statement per customer. Two parallel truths, shown side by
// side so the user can reconcile without the server guessing:
//
//   • MOVEMENTS + STAÐA follow Payday (the accounting system):
//       DEBITS  = invoices issued in Payday (+ manual Tekjur-sheet rows). Positive
//                 hofudstoll = reikningur; negative = kreditnóta. Landsbanki kröfur
//                 are NOT separate invoices (they are the bank-claim mechanism for
//                 a Payday invoice — counting them would double-bill).
//       CREDITS = invoices Payday marks paid (greidsla_date).
//       Staða   = net reikningað − greitt (Payday).
//
//   • BANK INFLOWS are listed separately per customer (matched by kt). A direct
//     millifærsla / paid krafa lands here; when bank inflows exceed what Payday
//     registered as paid, the customer is flagged `bank_over` — i.e. they likely
//     paid straight to the bank and the Payday status is stale (e.g. Eykt, Dalvegur).
//     This is the "look in the bank to match" signal; balance is NOT auto-adjusted.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const digits = (s) => String(s || '').replace(/\D/g, '');
const lc = (s) => String(s || '').trim().toLowerCase();
const DRAFT = new Set(['drög', 'drog']);
const PAID = new Set(['greitt', 'greidd', 'greiddur']);
const INV_SOURCES = new Set(['payday', 'tekjur_sheet_manual']);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  let invoices, bank;
  try {
    invoices = await fetchAll('invoices',
      'select=id,tilvisun,kt_greidanda,customer_name,gjalddagi,hofudstoll,status,greidsla_date,source');
    bank = await fetchAll('bank_transactions',
      'select=kt_counterparty,amount,trans_date,text,description&amount=gt.0');
  } catch (e) { return json(502, { error: e.message }); }

  const today = new Date().toISOString().slice(0, 10);
  const cust = new Map(); // kt -> { kt, names{}, mv:[], bank:[] }
  const pick = (kt, name) => {
    let c = cust.get(kt);
    if (!c) cust.set(kt, c = { kt, names: {}, mv: [], bank: [] });
    const n = (name || '').trim();
    if (n) c.names[n] = (c.names[n] || 0) + 1;
    return c;
  };
  const refOf = (r) => (r.tilvisun ? String(r.tilvisun).replace(/\.0$/, '') : ('#' + r.id));

  // ---- invoices → debits + Payday-paid credits ----
  for (const r of invoices) {
    if (!INV_SOURCES.has(lc(r.source))) continue;
    if (DRAFT.has(lc(r.status))) continue;
    const kt = digits(r.kt_greidanda); if (!kt) continue;
    const amt = +r.hofudstoll || 0; if (!amt) continue;
    const st = lc(r.status);
    const c = pick(kt, r.customer_name);
    const kind = st.startsWith('kredit') ? (amt < 0 ? 'kreditnota' : 'kreditfaersla') : 'reikningur';
    // debit (signed)
    c.mv.push({ date: r.gjalddagi || r.greidsla_date || null, kind, ref: refOf(r), delta: amt, source: r.source, status: r.status, text: null });
    // Payday-registered payment → credit
    if (PAID.has(st) && amt > 0) {
      c.mv.push({ date: r.greidsla_date || r.gjalddagi || null, kind: 'greidsla', ref: refOf(r), delta: -amt, source: 'payday', status: r.status, text: 'Greitt (Payday)' });
    }
  }

  // ---- bank inflows → separate per-customer stream (matched by kt) ----
  let unmatchedInflow = 0;
  for (const b of bank) {
    const kt = digits(b.kt_counterparty);
    const amt = +b.amount || 0; if (!amt) continue;
    if (!kt || !cust.has(kt)) { unmatchedInflow += amt; continue; }
    cust.get(kt).bank.push({ date: b.trans_date || null, amount: amt, text: b.text || b.description || '' });
  }

  const ym = (d) => (d ? String(d).slice(0, 7) : null);
  const customers = [];
  for (const c of cust.values()) {
    let best = '', bestN = -1;
    for (const [n, k] of Object.entries(c.names)) if (k > bestN) { best = n; bestN = k; }
    const mv = c.mv.filter(m => m.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (b.delta - a.delta));
    const bankList = c.bank.filter(b => b.date).sort((a, b) => a.date < b.date ? -1 : 1);
    if (!mv.length && !bankList.length) continue;

    let bal = 0, netBilled = 0, grossInv = 0, credited = 0, paid = 0;
    const monthsMap = {};
    for (const m of mv) {
      bal += m.delta; m.balance = Math.round(bal);
      const k = ym(m.date); const mo = monthsMap[k] || (monthsMap[k] = { ym: k, invoiced: 0, paid: 0 });
      if (m.kind === 'greidsla') { paid += -m.delta; mo.paid += -m.delta; }
      else { netBilled += m.delta; mo.invoiced += m.delta; if (m.delta >= 0 && m.kind === 'reikningur') grossInv += m.delta; if (m.delta < 0) credited += -m.delta; }
    }
    const months = Object.values(monthsMap).sort((a, b) => a.ym < b.ym ? -1 : 1);
    let ci = 0, cp = 0;
    for (const mo of months) { ci += mo.invoiced; cp += mo.paid; mo.cum_invoiced = Math.round(ci); mo.cum_paid = Math.round(cp); mo.invoiced = Math.round(mo.invoiced); mo.paid = Math.round(mo.paid); }
    const bank_in = Math.round(bankList.reduce((s, b) => s + b.amount, 0));
    const balance = Math.round(bal);

    customers.push({
      kt: c.kt, name: best || ('kt ' + c.kt),
      invoiced: Math.round(netBilled), gross_invoiced: Math.round(grossInv),
      credited: Math.round(credited), paid: Math.round(paid), balance,
      bank_in, bank_count: bankList.length,
      // flagged when bank receipts clearly exceed Payday-registered payments
      // AND there is still an open balance → likely paid to bank, Payday stale
      bank_over: (bank_in - paid > 100000 && balance > 100000),
      n_invoices: mv.filter(m => m.kind === 'reikningur').length,
      n_payments: mv.filter(m => m.kind === 'greidsla').length,
      first_date: (mv[0] && mv[0].date) || (bankList[0] && bankList[0].date) || null,
      last_date: (mv.length && mv[mv.length - 1].date) || null,
      months, movements: mv, bank: bankList,
    });
  }

  customers.sort((a, b) => b.gross_invoiced - a.gross_invoiced);

  const totals = {
    customer_count: customers.length,
    invoiced: customers.reduce((s, c) => s + c.invoiced, 0),
    paid: customers.reduce((s, c) => s + c.paid, 0),
    balance: customers.reduce((s, c) => s + c.balance, 0),
    bank_in: customers.reduce((s, c) => s + c.bank_in, 0),
    unmatched_inflow: Math.round(unmatchedInflow),
    bank_over_count: customers.filter(c => c.bank_over).length,
  };

  return json(200, {
    generated_at: new Date().toISOString(), today, totals, customers,
    note: 'Staða fylgir Payday (reikningað − greitt). Bankainnborganir eru sýndar sér; „⚠ banki > Payday“ þýðir að greitt hefur verið í banka umfram það sem Payday skráir — staðfestu handvirkt.',
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
