// hreyfingar.js — Hreyfingaryfirlit (customer account-movements / statement).
//
//   GET /api/hreyfingar
//     → { generated_at, today, totals, customers[] }
//
// ONE running account statement per customer that matches the accounting ledger
// (Payday / Viðskiptakröfur). All amounts are MEÐ VSK (`upphaed_total`).
//
//   • DEBET  = invoices issued in Payday (+ manual rows). Positive = reikningur;
//              negative = kreditnóta (Kreditreikningur). A Kreditfærður is the
//              positive twin that the kreditnóta reverses (net 0).
//   • KREDIT = Payday-registered payments (status Greitt/Greidd) on greidsla_date.
//   • STAÐA  = Σdebet − Σkredit  ==  Σ ógreiddir reikningar (m.vsk). This equals
//              the customer's Lokastaða in the accounting system (verified: ÞG
//              verktakar 4.410.930 = reikn. 319; Eykt 22.799.337).
//
// Bank inflows (`bank_transactions`, matched by kt) are MIXED into the same list
// for visibility but are INFORMATIONAL — they do NOT change the staða (the AR
// balance is invoice-status based). A bank inflow whose Payday invoice is still
// "Ógreitt" is the signal that money arrived but Payday is stale — reconcile by
// hand.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const digits = (s) => String(s || '').replace(/\D/g, '');
const lc = (s) => String(s || '').trim().toLowerCase();
// Status vocabulary is MIXED: Payday-API rows are English UPPERCASE
// (PAID/SENT/CANCELLED/CREDIT/DRAFT); Landsbanki + manual rows are Icelandic
// (Greidd/Ógreidd/Greitt/Drög). Match by substring so BOTH are handled — an
// exact-string match silently broke this page (PAID → un-credited → staða blew
// up to gross invoiced). Keep these in sync with debtors.js + krofur-yfirlit.js.
const isDraft = (st) => /draft|dr[öo]g/i.test(st);
// NB the „ó/o" negation prefix: „ógreitt/ógreidd" = UNPAID, must NOT match paid.
const isPaid = (st) => !/[óo]grei/i.test(st) && /paid|greitt|greidd|greid/i.test(st);
const isCancelled = (st) => /cancel|afturk|felld|[óo]gild/i.test(st); // CANCELLED / afturkallað
const isCredit = (st, amt) => /credit|kredit/i.test(st) || amt < 0;  // CREDIT / kreditnóta
const INV_SOURCES = new Set(['payday', 'tekjur_sheet_manual']);
const amountOf = (r) => (+r.upphaed_total || +r.hofudstoll || 0); // m.vsk preferred

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  let invoices, bank;
  try {
    invoices = await fetchAll('invoices',
      'select=id,tilvisun,kt_greidanda,customer_name,gjalddagi,hofudstoll,upphaed_total,status,greidsla_date,source');
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

  // ---- invoices → debits + Payday-paid credits (m.vsk) ----
  // Skip Landsbanki kröfur as DEBITS (they are the bank-claim twin of a Payday
  // invoice — same money, would double-bill); their cash shows via bank inflows.
  for (const r of invoices) {
    if (!INV_SOURCES.has(lc(r.source))) continue;
    const st = lc(r.status);
    if (isDraft(st)) continue;
    const kt = digits(r.kt_greidanda); if (!kt) continue;
    const amt = amountOf(r); if (!amt) continue;
    const c = pick(kt, r.customer_name);
    // A CANCELLED invoice and its CREDIT note are equal-and-opposite twins that
    // net to 0 in the balance; we keep both as debit/credit rows (so staða stays
    // correct) but flag `cancelled` so it doesn't inflate gross_invoiced.
    const credit = isCredit(st, amt);
    const cancelled = isCancelled(st);
    const kind = credit ? (amt < 0 ? 'kreditnota' : 'kreditfaersla') : 'reikningur';
    c.mv.push({ date: r.gjalddagi || r.greidsla_date || null, kind, ref: refOf(r), delta: amt, via: null, text: null, cancelled });
    if (isPaid(st) && amt > 0) {
      c.mv.push({ date: r.greidsla_date || r.gjalddagi || null, kind: 'greidsla', ref: refOf(r), delta: -amt, via: 'payday', text: null });
    }
  }

  // ---- bank inflows → informational rows mixed into the ledger ----
  let unmatchedInflow = 0;
  for (const b of bank) {
    const kt = digits(b.kt_counterparty);
    const amt = +b.amount || 0; if (!amt) continue;
    if (!kt || !cust.has(kt)) { unmatchedInflow += amt; continue; }
    cust.get(kt).mv.push({ date: b.trans_date || null, kind: 'banki', ref: null, delta: -amt, via: 'banki', text: b.text || b.description || '' });
  }

  const ym = (d) => (d ? String(d).slice(0, 7) : null);
  const customers = [];
  for (const c of cust.values()) {
    let best = '', bestN = -1;
    for (const [n, k] of Object.entries(c.names)) if (k > bestN) { best = n; bestN = k; }
    const mv = c.mv.filter(m => m.date).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : (b.delta - a.delta));
    if (!mv.length) continue;

    // staða = Σinvoiced − Σpaid (Payday); bank rows are informational (no effect)
    let invCum = 0, payCum = 0, bankCum = 0, grossInv = 0, credited = 0;
    const monthsMap = {};
    for (const m of mv) {
      if (m.kind === 'banki') {
        bankCum += -m.delta;            // tally only — does not change staða
      } else if (m.kind === 'greidsla') {
        payCum += -m.delta;
      } else {
        invCum += m.delta;
        if (m.delta >= 0 && m.kind === 'reikningur' && !m.cancelled) grossInv += m.delta;
        if (m.delta < 0) credited += -m.delta;
      }
      m.balance = Math.round(invCum - payCum);
      const k = ym(m.date); const mo = monthsMap[k] || (monthsMap[k] = { ym: k });
      mo.cum_invoiced = Math.round(invCum);
      mo.cum_paid = Math.round(payCum);
    }
    const months = Object.values(monthsMap).sort((a, b) => a.ym < b.ym ? -1 : 1);

    customers.push({
      kt: c.kt, name: best || ('kt ' + c.kt),
      invoiced: Math.round(invCum), gross_invoiced: Math.round(grossInv),
      credited: Math.round(credited), paid: Math.round(payCum),
      bank_paid: Math.round(bankCum), balance: Math.round(invCum - payCum),
      n_invoices: mv.filter(m => m.kind === 'reikningur').length,
      n_payments: mv.filter(m => m.kind === 'greidsla').length,
      n_bank: mv.filter(m => m.kind === 'banki').length,
      first_date: mv[0].date, last_date: mv[mv.length - 1].date,
      months, movements: mv,
    });
  }

  customers.sort((a, b) => b.balance - a.balance || b.gross_invoiced - a.gross_invoiced);

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
    note: 'Staða = ógreiddir reikningar (m.vsk) — eins og bókhaldið/Payday. Bankainnborganir eru sýndar með í listanum til upplýsinga en breyta EKKI stöðu (séu þær ekki enn skráðar greiddar í Payday er það merki um að uppfæra þurfi stöðuna).',
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
