// krofur-yfirlit.js — Brunahólf krófur (invoices) overview, scoped to one year.
//
//   GET  /api/krofur-yfirlit?year=2026
//     → { year, generated_at, summary, byMonth[], byCustomer[], rows[] }
//   POST /api/krofur-yfirlit  { action:'save', inv_key, hidden?, amount_override?, note? }
//     → { ok, meta }
//
// Reads the `invoices` table (Payday + Landsbankinn kröfur + manual Tekjur rows),
// filtered by gjalddagi year, and applies per-invoice manual overrides from
// `krofur_yfirlit_meta` (hide a krófa that was actually paid by bank transfer,
// or correct its amount). Hidden krófur are dropped from every total; an
// amount_override replaces upphaed_total (m.vsk) in the totals + the row.
//
// Amounts are MEÐ VSK (`upphaed_total`) to match Skuldunautar / Hreyfingaryfirlit.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAID_HINT = ['greitt', 'greidd', 'paid'];
const digits = (s) => String(s || '').replace(/\D/g, '');
const keyOf = (r) => `${r.source || ''}|${r.tilvisun || r.id}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') return saveOverride(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const year = String((event.queryStringParameters || {}).year || '2026').slice(0, 4);
  const from = `${year}-01-01`, to = `${Number(year) + 1}-01-01`;

  let invoices, meta, bank, drafts;
  // Non-fatal read failures are recorded here and returned so the frontend can
  // warn the user that a total may be wrong (instead of silently dropping data).
  const warnings = [];
  try {
    invoices = await fetchAll('invoices',
      `select=id,tilvisun,kt_greidanda,customer_name,gjalddagi,eindagi,hofudstoll,upphaed_total,status,greidsla_date,source&gjalddagi=gte.${from}&gjalddagi=lt.${to}`);
    meta = await fetchAll('krofur_yfirlit_meta', 'select=inv_key,hidden,amount_override,note,flagged');
    // Bank cross-ref removes krófur that were paid straight to the bank from the
    // outstanding total — if it fails, those krófur wrongly stay "ógreitt".
    bank = await fetchAll('bank_transactions', 'select=kt_counterparty,amount,trans_date,text,description&amount=gt.0')
      .catch(() => { warnings.push('bank_transactions lestur mistókst — bankagreiðslur ekki krossaðar, greiddar kröfur gætu talist ógreiddar'); return []; });
    // What the office tracked in Vinnubók / Reikningagerð (saved efnislisti totals).
    drafts = await fetchAll('invoice_drafts', 'select=worksite_name,work_month,total_m_vsk,customer_name')
      .catch(() => { warnings.push('invoice_drafts lestur mistókst — Reikningagerðar-samanburður vantar'); return []; });
  } catch (e) { return json(502, { error: e.message }); }

  const metaBy = new Map(meta.map((m) => [m.inv_key, m]));
  const today = new Date().toISOString().slice(0, 10);

  // ── Bank cross-reference (the old CSV statement) ──────────────────────────
  // Index inflows by payer kt; a krófa is "likely paid by bank" when an inflow
  // matches its kt + amount (within max(5.000, 1%)) and lands on/after gjalddagi−15d.
  const inflowByKt = new Map();
  for (const b of bank) {
    const kt = digits(b.kt_counterparty); if (!kt) continue;
    (inflowByKt.get(kt) || inflowByKt.set(kt, []).get(kt)).push({ amount: +b.amount || 0, date: b.trans_date, text: b.text || b.description || '' });
  }
  function bankMatch(kt, amount, gjalddagi) {
    const list = inflowByKt.get(digits(kt)); if (!list || !amount) return null;
    const tol = Math.max(5000, Math.abs(amount) * 0.01);
    const floor = gjalddagi ? new Date(Date.parse(gjalddagi) - 15 * 864e5).toISOString().slice(0, 10) : null;
    for (const inf of list) {
      if (Math.abs(inf.amount - amount) <= tol && (!floor || inf.date >= floor)) return inf;
    }
    return null;
  }
  // Reikningagerð/Vinnubók amounts the office computed, indexed by month for a sanity cross-check.
  const draftByMonth = new Map();
  for (const d of drafts) {
    const mo = String(d.work_month || '').slice(0, 7); if (!mo) continue;
    (draftByMonth.get(mo) || draftByMonth.set(mo, []).get(mo)).push({ worksite: d.worksite_name, customer: d.customer_name, total: Number(d.total_m_vsk) || 0 });
  }

  // Dedup: every Landsbanki krafa mirrors a Payday invoice (same payer kt + invoice
  // number, e.g. payday "299" ↔ landsbankinn_krafnir "299.0"). Counting both doubles
  // the book. Keep the Payday row (it carries payment status); drop the Landsbanki twin.
  const ktd = (s) => String(s || '').replace(/\D/g, '');
  const tnorm = (s) => String(s || '').replace(/\.0+$/, '');
  const paydayKeys = new Set();
  for (const r of invoices) { if (r.source === 'payday' && ktd(r.kt_greidanda)) paydayKeys.add(ktd(r.kt_greidanda) + '|' + tnorm(r.tilvisun)); }

  const rows = invoices.map((r) => {
    const k = keyOf(r);
    const m = metaBy.get(k) || {};
    const base = Number(r.upphaed_total) || 0;
    const amount = m.amount_override != null ? Number(m.amount_override) : base;
    const st = String(r.status || '').toLowerCase();
    // Voided invoices (Payday "CANCELLED", afturkallað, felld) are NOT revenue and
    // NOT outstanding — exclude them from every total (their paired credit note nets out).
    const cancelled = /cancel|afturkoll|afturkall|felld|ógild|ogild|void/.test(st);
    const dup = r.source === 'landsbankinn_krafnir' && ktd(r.kt_greidanda) && paydayKeys.has(ktd(r.kt_greidanda) + '|' + tnorm(r.tilvisun));
    const paidStatus = !!r.greidsla_date || PAID_HINT.some((p) => st.includes(p));
    const credit = amount < 0 || st.includes('credit') || st.includes('kredit');
    const excluded = cancelled || credit || dup;
    // Bank hint only matters for krófur not already marked paid in Payday.
    const bm = (paidStatus || excluded) ? null : bankMatch(r.kt_greidanda, amount, r.gjalddagi);
    const paid = paidStatus || !!bm;
    const overdue = !paid && !excluded && r.gjalddagi && r.gjalddagi < today;
    // Cross-check: does a saved Reikningagerð/Vinnubók total for this month match this amount?
    const mo = (r.gjalddagi || '').slice(0, 7);
    const dl = draftByMonth.get(mo) || [];
    const draftHit = dl.find((d) => Math.abs(d.total - amount) <= Math.max(5000, amount * 0.02));
    return {
      inv_key: k, id: r.id, tilvisun: r.tilvisun, source: r.source,
      customer_name: r.customer_name, kt: r.kt_greidanda,
      gjalddagi: r.gjalddagi, eindagi: r.eindagi, greidsla_date: r.greidsla_date,
      status: r.status, amount, base_amount: base,
      amount_override: m.amount_override != null ? Number(m.amount_override) : null,
      hidden: !!m.hidden, flagged: !!m.flagged, note: m.note || null,
      paid, paid_status: paidStatus, credit, cancelled, dup, excluded, overdue,
      bank_paid: !!bm, bank_text: bm ? bm.text : null, bank_date: bm ? bm.date : null,
      draft_match: draftHit ? { worksite: draftHit.worksite, total: draftHit.total } : null,
      month: mo,
    };
  });

  // Totals ignore hidden + cancelled + credit-note krófur; only valid invoices count.
  const visible = rows.filter((r) => !r.hidden && !r.excluded);
  const summary = {
    count: visible.length, hidden_count: rows.filter((r) => r.hidden).length,
    cancelled_count: rows.filter((r) => r.cancelled && !r.hidden).length,
    dup_count: rows.filter((r) => r.dup && !r.hidden).length,
    invoiced: 0, paid: 0, outstanding: 0, overdue: 0, overdue_count: 0, paid_count: 0,
  };
  const byMonthMap = new Map(), byCustMap = new Map();
  const moEntry = (mo) => { let e = byMonthMap.get(mo); if (!e) { e = { month: mo, invoiced: 0, received: 0, paid: 0, outstanding: 0, count: 0 }; byMonthMap.set(mo, e); } return e; };
  for (const r of visible) {
    summary.invoiced += r.amount;
    if (r.paid) { summary.paid += r.amount; summary.paid_count++; }
    else { summary.outstanding += r.amount; }
    if (r.overdue) { summary.overdue += r.amount; summary.overdue_count++; }

    // Útgefið: bucket by gjalddagi month. Innkomið (cash in): bucket the payment by
    // its greidsla_date month — real money movement, which is what cashflow tracks.
    const mm = moEntry(r.month);
    mm.invoiced += r.amount; mm.count++;
    if (r.paid) mm.paid += r.amount; else mm.outstanding += r.amount;
    if (r.paid && r.greidsla_date) moEntry(String(r.greidsla_date).slice(0, 7)).received += r.amount;

    if (!r.paid) {
      const cn = r.customer_name || '—';
      const cc = byCustMap.get(cn) || { customer_name: cn, kt: r.kt, outstanding: 0, count: 0 };
      cc.outstanding += r.amount; cc.count++;
      byCustMap.set(cn, cc);
    }
  }

  const byMonth = [...byMonthMap.values()].filter((m) => m.month).sort((a, b) => a.month.localeCompare(b.month));
  const byCustomer = [...byCustMap.values()].sort((a, b) => b.outstanding - a.outstanding).slice(0, 20);

  rows.sort((a, b) => (b.gjalddagi || '').localeCompare(a.gjalddagi || ''));

  // ── Slökkvitæki side (POS sales, same Supabase) ───────────────────────────
  // "Krófur" = reikningur (on-account) sales; staðgreitt = paid at the counter.
  // Payment status of the reikningur krófur lives in dkPlus (not synced), so we
  // report what's tracked here: sent + how many reached dkPlus.
  let slokk = null;
  try {
    const solur = await fetchAll('solur',
      `select=id,num,customer_nafn,customer_kt,samtals,greitt_med,invoiced_at,created_at&status=eq.final&created_at=gte.${from}&created_at=lt.${to}`);
    const s = { reikningur_sent: 0, reikningur_count: 0, sent_to_dk: 0, stadgreitt: 0, stadgreitt_count: 0, greitt_sidar: 0, greitt_sidar_count: 0, sala_total: 0, byMonth: [], uncollected: [], sales: [], daily: [] };
    const mMap = new Map(), dMap = new Map();
    for (const r of solur) {
      const amt = Number(r.samtals) || 0; s.sala_total += amt;
      const gm = String(r.greitt_med || '').toLowerCase().replace(/\s+/g, '_');
      // Daily counter income: card (kort) vs cash (reiðufé/pening) vs reikningur.
      const day = (r.created_at || '').slice(0, 10);
      if (day) {
        const dd = dMap.get(day) || { date: day, card: 0, cash: 0, reikningur: 0, n: 0 };
        dd.n++;
        if (gm.includes('reikning')) dd.reikningur += amt;
        else if (gm.includes('kort')) dd.card += amt;
        else dd.cash += amt;   // reiðufé / pening / other counter payment
        dMap.set(day, dd);
      }
      let bucket = 'stadgreitt';
      if (gm.includes('reikning')) {
        s.reikningur_sent += amt; s.reikningur_count++; if (r.invoiced_at) s.sent_to_dk++; bucket = 'reikningur';
        const k = `sl-sala|${r.id}`, mt = metaBy.get(k) || {};
        if (!mt.hidden) s.uncollected.push({ inv_key: k, id: r.id, num: r.num, customer_name: r.customer_nafn || '—', kt: r.customer_kt || null,
          amount: mt.amount_override != null ? Number(mt.amount_override) : amt, base_amount: amt, amount_override: mt.amount_override != null ? Number(mt.amount_override) : null,
          created_at: (r.created_at || '').slice(0, 10), sent_to_dk: !!r.invoiced_at, flagged: !!mt.flagged, note: mt.note || null });
      } else if (gm.includes('sidar') || gm.includes('síðar')) { s.greitt_sidar += amt; s.greitt_sidar_count++; bucket = 'greitt_sidar'; }
      else { s.stadgreitt += amt; s.stadgreitt_count++; }
      const mo = String(r.created_at || '').slice(0, 7); if (!mo) continue;
      s.sales.push({ num: r.num, customer: r.customer_nafn || '—', amount: amt, method: bucket, date: (r.created_at || '').slice(0, 10), month: mo });
      const mm = mMap.get(mo) || { month: mo, revenue: 0, reikningur: 0, stadgreitt: 0, count: 0 };
      mm.revenue += amt; mm.count++; mm[bucket === 'reikningur' ? 'reikningur' : 'stadgreitt'] += amt;
      mMap.set(mo, mm);
    }
    s.byMonth = [...mMap.values()].sort((a, b) => a.month.localeCompare(b.month));
    s.daily = [...dMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
    s.uncollected.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    s.uncollected_total = s.uncollected.reduce((t, r) => t + r.amount, 0);

    // ── Ókláraðar ársskoðanir: equipment past due for annual inspection ──────
    const overdue = await fetchAll('uttaeki',
      `select=client,next_insp,last_insp,status&next_insp=not.is.null&next_insp=lte.${today}`).catch(() => []);
    const insMap = new Map();
    let overdueEquip = 0;
    for (const u of overdue) {
      const st = String(u.status || '').toLowerCase();
      if (['loaned', 'removed', 'archived', 'deleted'].includes(st)) continue;
      const c = (u.client || '').trim(); if (!c) continue;
      overdueEquip++;
      const g = insMap.get(c) || { client: c, overdue_equip: 0, elsta: null, sidasta: null };
      g.overdue_equip++;
      if (!g.elsta || u.next_insp < g.elsta) g.elsta = u.next_insp;
      if (u.last_insp && (!g.sidasta || u.last_insp > g.sidasta)) g.sidasta = u.last_insp;
      insMap.set(c, g);
    }
    const companies = [...insMap.values()].map((g) => {
      const k = `sl-ars|${g.client}`, mt = metaBy.get(k) || {};
      return Object.assign(g, { inv_key: k, hidden: !!mt.hidden, flagged: !!mt.flagged, note: mt.note || null });
    }).filter((g) => !g.hidden).sort((a, b) => b.overdue_equip - a.overdue_equip);
    s.inspections = { overdue_equip: overdueEquip, overdue_companies: companies.length, companies: companies.slice(0, 40) };

    slokk = s;
  } catch (_) { slokk = null; }

  // Worksite-billing overrides (inv_key='ws|<project>') — hide/edit-estimate/note
  // a worksite row in the „Brunahólf verkstaðir — reikningsstaða" section.
  const wsMeta = {};
  for (const m of meta) { if (String(m.inv_key || '').startsWith('ws|')) wsMeta[m.inv_key] = { hidden: !!m.hidden, amount_override: m.amount_override != null ? Number(m.amount_override) : null, note: m.note || null }; }

  return json(200, { year, generated_at: new Date().toISOString(), today, summary, byMonth, byCustomer, rows, slokk, wsMeta, warnings });
};

async function saveOverride(event) {
  let body; try { body = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'bad json' }); }
  const inv_key = String(body.inv_key || '').trim();
  if (!inv_key) return json(400, { error: 'inv_key required' });

  const patch = { inv_key, updated_at: new Date().toISOString() };
  if (typeof body.hidden === 'boolean') patch.hidden = body.hidden;
  if (typeof body.flagged === 'boolean') patch.flagged = body.flagged;
  // Kröfu yfirlit (þrepaskipt) — handvirk „merkt greitt" merking. paid=true → dettur
  // úr Ógreitt-þrepi; paid_at stimplað. Aðskilið frá Payday-stöðu (sem breytist ekki).
  if (typeof body.paid === 'boolean') { patch.paid = body.paid; patch.paid_at = body.paid ? new Date().toISOString() : null; }
  // Ósendar-vinnuflæði (Kröfu yfirlit): ⚪ → 🔵 staðfest → 🟢 sent á bókara → ✅ allt klárt.
  // `by` = hver gerði skrefið (t.d. „Aggi"/„Anni") svo hinn sér hver gerði hvað.
  const who = body.by ? String(body.by).slice(0, 40) : null;
  if (typeof body.confirmed === 'boolean') { patch.confirmed = body.confirmed; patch.confirmed_at = body.confirmed ? new Date().toISOString() : null; patch.confirmed_by = body.confirmed ? who : null; }
  if (typeof body.sent === 'boolean') { patch.sent = body.sent; patch.sent_at = body.sent ? new Date().toISOString() : null; patch.sent_by = body.sent ? who : null; }
  if (typeof body.done === 'boolean') { patch.done = body.done; patch.done_at = body.done ? new Date().toISOString() : null; patch.done_by = body.done ? who : null; }
  if ('amount_override' in body) patch.amount_override = body.amount_override === null || body.amount_override === '' ? null : Number(body.amount_override);
  if ('note' in body) patch.note = body.note ? String(body.note).slice(0, 500) : null;
  // Ósendar-vinnuflæði — reitastaða (Tímar/Redder/Efnislisti box states + tölur +
  // vistuð PDF). Client sendir ALLT wf_state objectið svo við geymum það eins og er.
  if (body.wf_state && typeof body.wf_state === 'object') patch.wf_state = body.wf_state;

  const r = await fetch(`${SUPABASE_URL}/rest/v1/krofur_yfirlit_meta?on_conflict=inv_key`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) return json(502, { error: `save: ${r.status} ${(await r.text()).slice(0, 200)}` });
  const out = await r.json();
  return json(200, { ok: true, meta: out[0] || patch });
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
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
