// hreyfingar.js — Hreyfingaryfirlit (customer account-movements / statement).
//
//   GET /api/hreyfingar
//     → { generated_at, today, totals, customers[] }
//
// ONE running account statement per customer — Payday invoices and bank inflows
// mixed into a single chronological ledger:
//   • DEBITS  = invoices issued in Payday (+ manual Tekjur-sheet rows). Positive
//               hofudstoll = reikningur; negative = kreditnóta. Landsbanki kröfur
//               are NOT separate invoices (bank-claim mechanism for a Payday
//               invoice — counting them would double-bill).
//   • CREDITS = payments shown from BOTH sources, mixed in by date:
//       – Payday-registered payments (status Greitt/Greidd) — via 'payday'.
//       – Bank inflows (`bank_transactions`, matched by kt)        — via 'banki'.
//
// The two payment sources OVERLAP (a payment can be both registered in Payday
// AND visible in the bank), so naively summing both double-counts. Instead the
// running balance uses paid = max(Payday-recorded, bank-total) accumulated over
// time: balance = Σinvoiced − max(ΣpaydayPaid, ΣbankIn). This is correct at the
// extremes — a Payday-tracked bank transfer counts once (max), while a payment
// Payday MISSED (bankIn > paydayPaid, e.g. a direct millifærsla) still lowers the
// balance. Bank rows that don't move the balance (already covered by Payday) are
// flagged `covered` so the UI can mute them.

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
  const cust = new Map(); // kt -> { kt, names{}, mv:[] }
  const pick = (kt, name) => {
    let c = cust.get(kt);
    if (!c) cust.set(kt, c = { kt, names: {}, mv: [] });
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
    c.mv.push({ date: r.gjalddagi || r.greidsla_date || null, kind, ref: refOf(r), delta: amt, via: null, text: null });
    if (PAID.has(st) && amt > 0) {
      c.mv.push({ date: r.greidsla_date || r.gjalddagi || null, kind: 'greidsla', ref: refOf(r), delta: -amt, via: 'payday', text: null });
    }
  }

  // ---- bank inflows → credits, mixed into the same ledger ----
  let unmatchedInflow = 0;
  for (const b of bank) {
    const kt = digits(b.kt_counterparty);
    const amt = +b.amount || 0; if (!amt) continue;
    if (!kt || !cust.has(kt)) { unmatchedInflow += amt; continue; }
    cust.get(kt).mv.push({ date: b.trans_date || null, kind: 'greidsla', ref: null, delta: -amt, via: 'banki', text: b.text || b.description || '' });
  }

  const ym = (d) => (d ? String(d).slice(0, 7) : null);
  const customers = [];
  for (const c of cust.values()) {
    let best = '', bestN = -1;
    for (const [n, k] of Object.entries(c.names)) if (k > bestN) { best = n; bestN = k; }
    const mv = c.mv.filter(m => m.date).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : (b.delta - a.delta));
    if (!mv.length) continue;

    // running balance = Σinvoiced − max(ΣpaydayPaid, ΣbankIn)
    let invCum = 0, payCum = 0, bankCum = 0, grossInv = 0, credited = 0;
    const monthsMap = {};
    for (const m of mv) {
      if (m.kind === 'greidsla') {
        const prevMax = Math.max(payCum, bankCum);
        if (m.via === 'banki') bankCum += -m.delta; else payCum += -m.delta;
        const newMax = Math.max(payCum, bankCum);
        // a bank row "covered" by Payday doesn't lower the balance
        m.covered = (m.via === 'banki') && ((newMax - prevMax) < (-m.delta) * 0.5);
      } else {
        invCum += m.delta;
        if (m.delta >= 0 && m.kind === 'reikningur') grossInv += m.delta;
        if (m.delta < 0) credited += -m.delta;
      }
      m.balance = Math.round(invCum - Math.max(payCum, bankCum));
      const k = ym(m.date); const mo = monthsMap[k] || (monthsMap[k] = { ym: k });
      mo.cum_invoiced = Math.round(invCum);
      mo.cum_paid = Math.round(Math.max(payCum, bankCum));
    }
    const months = Object.values(monthsMap).sort((a, b) => a.ym < b.ym ? -1 : 1);
    const paid = Math.round(Math.max(payCum, bankCum));

    customers.push({
      kt: c.kt, name: best || ('kt ' + c.kt),
      invoiced: Math.round(invCum), gross_invoiced: Math.round(grossInv),
      credited: Math.round(credited), paid,
      payday_paid: Math.round(payCum), bank_paid: Math.round(bankCum),
      balance: Math.round(invCum - Math.max(payCum, bankCum)),
      n_invoices: mv.filter(m => m.kind === 'reikningur').length,
      n_payments: mv.filter(m => m.kind === 'greidsla').length,
      first_date: mv[0].date, last_date: mv[mv.length - 1].date,
      months, movements: mv,
    });
  }

  customers.sort((a, b) => b.gross_invoiced - a.gross_invoiced);

  const totals = {
    customer_count: customers.length,
    invoiced: customers.reduce((s, c) => s + c.invoiced, 0),
    paid: customers.reduce((s, c) => s + c.paid, 0),
    bank_paid: customers.reduce((s, c) => s + c.bank_paid, 0),
    balance: customers.reduce((s, c) => s + c.balance, 0),
    unmatched_inflow: Math.round(unmatchedInflow),
  };

  return json(200, {
    generated_at: new Date().toISOString(), today, totals, customers,
    note: 'Einn hreyfingalisti per fyrirtæki: reikningar (debet) + greiðslur (kredit) úr Payday OG banka, blandað eftir dagsetningu. Greitt = max(Payday, banki) því heimildirnar skarast; bankafærsla sem þegar er í Payday breytir ekki stöðu (dauf). Staða = reikningað − greitt.',
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
