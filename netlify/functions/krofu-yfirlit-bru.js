// krofu-yfirlit-bru.js — Kröfu yfirlit (þrepaskipt) fyrir Brunahólf.
//
//   GET /api/krofu-yfirlit-bru
//     → { generated_at, newest_timavera, tier1, tier2, draftKeys }
//
// Þrepaskipt kröfu-yfirlit í Slökkvitæki-stíl. Þessi endapunktur skilar tveimur
// efstu þrepunum (þriðja þrepið — óinnvoiceaðir Tímavera-tímar — er reiknað í
// vafranum úr /api/worksites):
//   • tier1  🔴 Ógreiddar kröfur  = allir reikningar sem eru ÓBORGAÐIR
//     (Payday `SENT` + Landsbanki `Ógreidd` + handvirkar) — EKKI greitt/kreditfært/
//     cancelled/draft. NB: gamla /api/debtors mátaði bara íslenska `ógreitt/ógreidd`
//     og sleppti þar með ÖLLUM Payday `SENT` (54 kröfur / ~159M) — það er lagað hér.
//   • tier2  🟡 Ósendar kröfur   = Payday `DRAFT`/`Drög` reikningar + vistuð
//     `invoice_drafts` úr Gerð Reikninga (síðustu mánuði) sem ekki eru enn send.
//
// Handvirkar merkingar (merkt greitt / fela) lifa í `krofur_yfirlit_meta`
// (inv_key = `<source>|<tilvisun>`), skrifað gegnum /api/krofur-yfirlit POST.
// paid=true eða hidden=true → dettur úr þrepi 1 (og úr summum).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const digits = (s) => String(s || '').replace(/\D/g, '');
const lc = (s) => String(s || '').trim().toLowerCase();

// Status-flokkun (case-insensitive). Allt sem er hvorki greitt, kreditfært/
// cancelled né draft telst ÓGREITT (þ.m.t. Payday `SENT`).
const PAID = new Set(['greitt', 'greidd', 'greiddur', 'paid']);
const CREDIT = new Set(['kreditreikningur', 'kreditfærður', 'kreditfaerdur', 'credit', 'cancelled', 'cancel', 'reversed']);
const DRAFT = new Set(['drög', 'drog', 'draft']);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only (skrifað gegnum /api/krofur-yfirlit)' });

  let invoices, drafts, meta, bank, cwmap;
  // Non-fatal read failures are recorded here and returned so the frontend can
  // warn the user that a total may be wrong (instead of silently dropping data).
  const warnings = [];
  try {
    invoices = await fetchAll('invoices',
      'select=id,tilvisun,kt_greidanda,customer_name,gjalddagi,eindagi,hofudstoll,upphaed_total,status,source');
    // invoice_drafts feed the „Ósendar kröfur" (tier2) totals — a failure hides real drafts.
    drafts = await fetchAll('invoice_drafts',
      'select=worksite_name,work_month,total_m_vsk,customer_name,kennitala')
      .catch(() => { warnings.push('invoice_drafts lestur mistókst — ósendar drög gætu vantað í þrep 2'); return []; });
    // meta carries the manual greitt/falið/staðfest flags — without it, hidden or
    // paid krófur reappear and the outstanding totals are wrong.
    meta = await fetchAll('krofur_yfirlit_meta', 'select=inv_key,hidden,paid,note,confirmed,sent,done,sent_at,confirmed_at,done_at,confirmed_by,sent_by,done_by,wf_state')
      .catch(() => { warnings.push('krofur_yfirlit_meta lestur mistókst — handvirkar merkingar (greitt/falið) vantar, tölur gætu verið rangar'); return []; });
    // Bank cross-ref only flags likely-paid krófur (does not change the total) — still surface a failure.
    bank = await fetchAll('bank_transactions',
      'select=kt_counterparty,amount,trans_date,text,description&amount=gt.0')
      .catch(() => { warnings.push('bank_transactions lestur mistókst — „líklega greitt" bankamátun vantar'); return []; });
    // Worksite→payer map only affects grouping (optional) — record but stay resilient.
    cwmap = await fetchAll('customer_worksite_map',
      'select=customer_name,worksite_name')
      .catch(() => { warnings.push('customer_worksite_map lestur mistókst — greiðanda-hópun gæti verið ónákvæm'); return []; });
  } catch (e) { return json(502, { error: e.message }); }

  // ---- worksite → payer resolution (rekstrarfélög / verkstaðir) -------------
  // Sami verkstaður (t.d. „Landsspitalinn") er rukkaður af einum greiðanda
  // („ÞG verktakar ehf."). invoice_drafts-raðir bera stundum verkstaðar-nafnið
  // og stundum greiðandann → þær tvístrast í tvo hópa. Hér er verkstaður leystur
  // í greiðanda svo öll drögin lendi undir sama greiðanda. kt greiðandans er
  // sótt úr `invoices` (customer_name → kt_greidanda) svo drögin geti sameinast
  // Payday-hópi greiðandans þegar við á.
  const worksiteToPayer = new Map();  // lc(worksite) -> payer customer_name
  for (const m of (cwmap || [])) {
    const w = lc(m.worksite_name), p = String(m.customer_name || '').trim();
    if (w && p && !worksiteToPayer.has(w)) worksiteToPayer.set(w, p);
  }
  const payerKt = new Map();           // lc(customer_name) -> kt (digits)
  for (const inv of invoices) {
    const nm = lc(inv.customer_name), kt = digits(inv.kt_greidanda);
    if (nm && kt && !payerKt.has(nm)) payerKt.set(nm, kt);
  }
  // Resolve a draft's {customer,kt} to its payer when the label is a worksite.
  function resolvePayer(name) {
    const payer = worksiteToPayer.get(lc(name));
    if (!payer) return null;
    return { customer: payer, kt: payerKt.get(lc(payer)) || '' };
  }

  const metaBy = new Map(meta.map((m) => [m.inv_key, m]));
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(today);

  // ---- bank cross-reference (sama og Skuldunautar/debtors.js) ---------------
  // Vísbending: reikningur sem enn er „ógreiddur" í Payday en fannst greiddur
  // beint í banka → líklega þegar greitt (skrifstofan gleymdi að merkja í Payday).
  const inflowByKt = new Map();
  for (const b of bank) {
    const kt = digits(b.kt_counterparty);
    if (!kt) continue;
    (inflowByKt.get(kt) || inflowByKt.set(kt, []).get(kt))
      .push({ amount: +b.amount || 0, date: b.trans_date, text: b.text || b.description || '' });
  }
  // Banka-mátun er gerð SÍÐAR í einni heildar-yfirferð (matchBank) — EKKI per röð —
  // svo ein bankafærsla sé aldrei eignuð tveimur reikningum (nákvæm match fyrst).

  // ---- classify invoices ----
  const t1 = [], t2 = [];
  for (const r of invoices) {
    const st = lc(r.status);
    const amt = +r.upphaed_total || +r.hofudstoll || 0;
    if (amt === 0) continue;
    if (CREDIT.has(st) || amt < 0) continue;                 // kreditfært/cancelled/negative leg
    const key = `${r.source || 'x'}|${r.tilvisun || r.id}`;
    const mt = metaBy.get(key) || {};
    const isDraft = DRAFT.has(st);
    const isPaid = PAID.has(st) || !!mt.paid;                 // Payday-greitt eða handvirkt merkt
    if (isPaid) continue;                                     // ekki útistandandi lengur
    // Falið (handvirkt) er EKKI sleppt lengur — við sendum röðina með `hidden:true`
    // svo framendinn geti (a) haldið henni falinni þvert á tæki og (b) sýnt hana
    // aftur með „👁 Sýna falin" hnappnum. Faldar raðir teljast ekki í summur.
    const dueMs = r.gjalddagi ? Date.parse(r.gjalddagi) : null;
    const row = {
      inv_key: key, id: r.id, tilvisun: r.tilvisun, source: r.source,
      kt: digits(r.kt_greidanda), customer: r.customer_name || '(óþekkt)',
      gjalddagi: r.gjalddagi, eindagi: r.eindagi, dueMs, days_overdue: dueMs != null ? Math.round((todayMs - dueMs) / 864e5) : null,
      amount: amt, note: mt.note || null, hidden: !!mt.hidden,
      confirmed: !!mt.confirmed, sent: !!mt.sent, done: !!mt.done, sent_at: mt.sent_at || null,
      confirmed_at: mt.confirmed_at || null, done_at: mt.done_at || null,
      confirmed_by: mt.confirmed_by || null, sent_by: mt.sent_by || null, done_by: mt.done_by || null,
      wf: mt.wf_state || null,
      likely_paid: false, bank: null,        // fyllt í matchBank() hér að neðan
    };
    (isDraft ? t2 : t1).push(row);
  }

  // ---- invoice_drafts (Gerð Reikninga) → tier2, only recent unsent cycle ----
  // Bundið við síðustu 3 mánuði svo gamlar (þegar sendar) drög-raðir dredgist ekki upp.
  const cutoff = monthsAgo(3);
  const draftKeys = [];
  for (const d of drafts) {
    const wm = String(d.work_month || '');
    if (d.worksite_name && wm) draftKeys.push(`${d.worksite_name}|${wm}`);
    const amt = +d.total_m_vsk || 0;
    if (amt <= 0 || wm < cutoff) continue;
    const key = `draftinv|${d.worksite_name}|${wm}`;
    const mt = metaBy.get(key) || {};
    if (mt.paid) continue;   // falið er sent áfram (hidden:true), bara greitt er sleppt
    // Leysa verkstaðar-nafn í greiðanda svo öll drögin lendi undir sama greiðanda
    // (t.d. Landsspítalinn-drög → ÞG verktakar). Fellur til baka á upprunalega
    // nafnið ef enginn greiðandi finnst í customer_worksite_map.
    const payer = resolvePayer(d.worksite_name) || resolvePayer(d.customer_name);
    t2.push({
      inv_key: key, id: null, tilvisun: null, source: 'gerd-drög',
      kt: (payer && payer.kt) || digits(d.kennitala),
      customer: (payer && payer.customer) || d.customer_name || d.worksite_name || '(verkstaður)',
      gjalddagi: null, days_overdue: null, amount: amt, note: mt.note || null, hidden: !!mt.hidden,
      confirmed: !!mt.confirmed, sent: !!mt.sent, done: !!mt.done, sent_at: mt.sent_at || null,
      confirmed_at: mt.confirmed_at || null, done_at: mt.done_at || null,
      confirmed_by: mt.confirmed_by || null, sent_by: mt.sent_by || null, done_by: mt.done_by || null,
      wf: mt.wf_state || null,
      worksite: d.worksite_name, work_month: wm,
    });
  }

  // ---- banka-mátun (ein heildar-yfirferð) ----------------------------------
  // Nákvæm match fyrst; leyfi bankaupphæð allt að +8% hærri (dráttarvextir gera
  // greiðsluna oft aðeins hærri) en neðri mörk þétt. HVER bankafærsla notuð í
  // mesta lagi EINU SINNI — annars myndi ein greiðsla ranglega merkja tvo
  // reikninga (t.d. R-296 2.166.740 greip greiðslu R-306 2.268.025). Nákvæma
  // parið vinnur (cost 0), svo R-296 stendur réttilega eftir ómerkt.
  const pairs = [];
  for (const row of t1) {
    if (row.hidden) continue;                  // falin röð grípur ekki bankagreiðslu
    const kt = row.kt;
    if (!kt || !inflowByKt.has(kt)) continue;
    const tolLow = Math.max(5000, row.amount * 0.01);
    const tolHigh = Math.max(10000, row.amount * 0.08);
    inflowByKt.get(kt).forEach((b, bi) => {
      if (b.amount >= row.amount - tolLow && b.amount <= row.amount + tolHigh &&
          (row.dueMs == null || Date.parse(b.date) >= row.dueMs - 15 * 864e5)) {
        pairs.push({ row, ref: kt + '#' + bi, b, cost: Math.abs(b.amount - row.amount) });
      }
    });
  }
  pairs.sort((a, b) => a.cost - b.cost);
  const usedInflow = new Set();
  for (const p of pairs) {
    if (p.row.likely_paid || usedInflow.has(p.ref)) continue;
    p.row.likely_paid = true;
    p.row.bank = { amount: p.b.amount, date: p.b.date, text: p.b.text, extra: Math.max(0, Math.round(p.b.amount - p.row.amount)) };
    usedInflow.add(p.ref);
  }
  for (const row of t1) delete row.dueMs;   // innra hjálparfelt — ekki í svari

  const likely = t1.filter((r) => r.likely_paid && !r.hidden);
  return json(200, {
    generated_at: new Date().toISOString(),
    newest_timavera: await newestTimavera().catch(() => { warnings.push('timavera_entries lestur mistókst — nýjasta Tímavera-dagsetning óþekkt'); return null; }),
    tier1: rollup(t1),
    tier2: rollup(t2),
    warnings,
    // Öll faldar inv_keys (öll þrep, líka þrep-3 sem er reiknað í vafra) svo
    // framendinn haldi þeim falinni þvert á tæki/vafra — ekki bara í localStorage.
    hidden_keys: meta.filter((m) => m.hidden).map((m) => m.inv_key),
    draftKeys,
    likely_paid: { n: likely.length, kr: likely.reduce((a, r) => a + r.amount, 0) },
    note: 'Ógreitt = allir reikningar sem eru hvorki greiddir, kreditfærðir né drög. Payday SENT telst ógreitt (útistandandi). likely_paid = fannst greitt í banka en enn ógreitt í Payday.',
  });
};

// Group rows by debtor (kt else name), sort debtors + rows by amount desc.
function rollup(rows) {
  const by = new Map();
  for (const r of rows) {
    const gk = r.kt || lc(r.customer);
    let g = by.get(gk);
    if (!g) by.set(gk, g = { kt: r.kt, customer: r.customer, invoices: [], outstanding_kr: 0, oldest_due: null });
    g.invoices.push(r);
    if (r.hidden) continue;                    // faldar raðir teljast ekki í summur
    g.outstanding_kr += r.amount;
    if (r.gjalddagi && (!g.oldest_due || r.gjalddagi < g.oldest_due)) g.oldest_due = r.gjalddagi;
  }
  const debtors = [...by.values()].sort((a, b) => b.outstanding_kr - a.outstanding_kr);
  debtors.forEach((d) => d.invoices.sort((a, b) => b.amount - a.amount));
  const visibleRows = rows.filter((r) => !r.hidden);
  return {
    debtors,
    total: debtors.reduce((a, d) => a + d.outstanding_kr, 0),
    n: visibleRows.length,
    debtor_count: debtors.filter((d) => d.outstanding_kr > 0).length,
  };
}

function monthsAgo(n) {
  // ISO YYYY-MM cutoff n months before today (no Date.now()-free needed; server ok).
  const d = new Date(); d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
async function newestTimavera() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/timavera_entries?select=date&order=date.desc&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] ? rows[0].date : null;
}
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
