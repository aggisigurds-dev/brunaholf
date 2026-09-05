// invoice-drafts.js — Prebuilt next-invoice drafts.
//
//   GET  /api/invoice-drafts                          → all rows
//   GET  /api/invoice-drafts?worksite=NAME            → for one worksite
//   GET  /api/invoice-drafts?status=overdue,draft     → filter by status (comma list)
//   POST /api/invoice-drafts                          body { worksite_name, work_month, status, ...} → upsert
//
// invoice_drafts schema (from migration in PR #5):
//   worksite_name, work_month, customer_name, source,
//   hours_dagvinna, hours_eftirvinna, rate_dagvinna, rate_eftirvinna,
//   akstur_km, akstur_ferdir, smahlutagjald, stadfesting,
//   materials_jsonb, materials_total,
//   net_an_vsk, vsk_amount, total_m_vsk,
//   status (draft|overdue|sent|skipped|invoiced),
//   payday_invoice_id, notes, created_at, updated_at, updated_by

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const params = ['select=*', 'order=total_m_vsk.desc.nullslast'];
    if (q.worksite) params.push(`worksite_name=eq.${encodeURIComponent(q.worksite)}`);
    if (q.status)   params.push(`status=in.(${q.status.split(',').map(encodeURIComponent).join(',')})`);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?${params.join('&')}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    // Quick summary by status
    const summary = { count: rows.length, by_status: {}, total_m_vsk: 0 };
    for (const r of rows) {
      summary.total_m_vsk += Number(r.total_m_vsk || 0);
      summary.by_status[r.status] = (summary.by_status[r.status] || 0) + Number(r.total_m_vsk || 0);
    }
    return json(200, { rows, summary });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }
    // Samreikningur milli mánaða (Agnar 03.09.2026) — reiknað SERVER-megin úr röðunum
    // sjálfum svo tvær vélar geti ekki sent ósamhljóða tölur.
    if (body.action === 'merge') return mergeMonths(body);
    if (body.action === 'unmerge') return unmergeMonths(body);
    if (!body.worksite_name || !body.work_month) return json(400, { error: 'worksite_name + work_month required' });

    const allowed = [
      'worksite_name', 'work_month', 'customer_name', 'source',
      'hours_dagvinna', 'hours_eftirvinna', 'rate_dagvinna', 'rate_eftirvinna',
      'akstur_km', 'akstur_ferdir', 'akstur_gjald', 'smahlutagjald', 'stadfesting',
      'materials_jsonb', 'materials_total',
      'net_an_vsk', 'vsk_amount', 'total_m_vsk',
      'status', 'payday_invoice_id', 'notes', 'updated_by',
      'kennitala', 'heimilisfang',
      // 2026-07-08 (afsláttar-úttekt): persist the Gerð Reikninga discount so
      // a saved draft reprints correctly on any device — it used to be
      // reconstructed from the CURRENT UI state (state.ui.gr_discount), so a
      // changed/unsyncced pct printed a sheet that didn't add up.
      'discount_pct',
      // 2026-08-08 (fast verð): samningaverð þegar verð er samið beint (t.d. 1.250.000 kr).
      // Yfirristir útreiknað verð í Efnislista — geymist og prentast rétt á öllum tækjum.
      'fixed_total',
      // 2026-08-08 (yfirferðar-flæði): skrifstofan flaggar drög til yfirferðar
      // hjá yfirmanni (yfirferd.html / The Big Boss app); hann vistar + staðfestir.
      'review_requested', 'review_requested_at', 'review_requested_by',
      'review_confirmed_at', 'review_confirmed_by',
      // 2026-09-03 (samreikningur milli mánaða): tímabil verksins þegar það spannar
      // mánaðamót; merged_from/merged_into/merge_snapshot eru sett af merge/unmerge.
      'period_from', 'period_to',
    ];
    const payload = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (body[k] !== undefined) payload[k] = body[k];

    // PATCH fyrst ef röðin er til: upsert-INSERT myndar heila nýja tuple-röð og
    // NOT NULL-tékkin keyra á henni ÁÐUR en conflict-uppfærslan tekur við — svo
    // hlutauppfærsla án `source` (👔 yfirferðar-togglinn, yfirferd.html vistun)
    // féll á 23502 þótt röðin ætti gilt source-gildi nú þegar.
    const filter = `worksite_name=eq.${encodeURIComponent(body.worksite_name)}&work_month=eq.${encodeURIComponent(body.work_month)}`;
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?${filter}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });
    if (!pr.ok) return json(pr.status, { error: (await pr.text()).slice(0, 300) });
    const patched = await pr.json();
    if (patched.length) return json(200, patched[0]);

    const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?on_conflict=worksite_name,work_month`, {
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
    const arr = await r.json();
    return json(200, arr[0] || { ok: true });
  }

  if (event.httpMethod === 'DELETE') {
    const q = event.queryStringParameters || {};
    if (!q.worksite || !q.work_month) return json(400, { error: 'worksite + work_month required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?worksite_name=eq.${encodeURIComponent(q.worksite)}&work_month=eq.${encodeURIComponent(q.work_month)}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { ok: true, deleted: { worksite_name: q.worksite, work_month: q.work_month } });
  }

  return json(405, { error: 'Method not allowed' });
};

/* ── Samreikningur milli mánaða (Agnar 03.09.2026) ───────────────────────────
 * Verk sem spannar mánaðamót (t.d. Skúlagata 26, 13.08.–03.09.2026) á að fara á
 * EINN reikning. Samreikningurinn er drög SEINNI mánaðarins (ákvörðun Agnars: „í
 * seinni mánuðinum") — engin ný röð og ekkert nýtt flæði gegnum PDF/kröfur.
 * Fyrri mánuðirnir fá status='merged' + merged_into og eru ALDREI eyddir.
 *
 * Upphæðir: net samreiknings = Σ net mánaðanna − staðfestingin sem var tvítalin.
 * Það er rétt óháð töxtum, því hvert `net_an_vsk` er þegar innbyrðis rétt (akstur,
 * efni, afsláttur talið með). Reitirnir sjálfir (klst, km, efni, gjöld) leggjast
 * saman svo Efnislista-ritillinn reikni sömu tölu þegar hann opnar drögin.
 */
const MERGE_SUM = ['hours_dagvinna', 'hours_eftirvinna', 'akstur_km', 'akstur_ferdir', 'akstur_gjald', 'smahlutagjald', 'materials_total'];
const MERGE_SNAP = MERGE_SUM.concat(['stadfesting', 'materials_jsonb', 'net_an_vsk', 'vsk_amount', 'total_m_vsk', 'notes', 'status']);

async function sbRows(qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${qs}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error((await r.text()).slice(0, 200));
  return r.json();
}
async function sbPatchRows(filter, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/invoice_drafts?${filter}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error((await r.text()).slice(0, 200));
  return r.json();
}
const nz = (v) => Number(v) || 0;
const inList = (arr) => arr.map((m) => `"${String(m).replace(/"/g, '')}"`).join(',');

async function mergeMonths(body) {
  const ws = String(body.worksite_name || '').trim();
  const months = [...new Set((body.months || []).map((m) => String(m).trim()).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  if (!ws || months.length < 2) return json(400, { error: 'worksite_name og a.m.k. tveir mánuðir (months) þarf' });
  const stadfOnce = body.stadf_once !== false;

  let rows;
  try { rows = await sbRows(`invoice_drafts?worksite_name=eq.${encodeURIComponent(ws)}&work_month=in.(${inList(months)})&select=*`); }
  catch (e) { return json(502, { error: e.message }); }
  if (rows.length !== months.length) return json(404, { error: 'Fann ekki drög fyrir alla mánuðina' });

  const locked = rows.filter((r) => ['invoiced', 'sent', 'merged'].includes(String(r.status || '')));
  if (locked.length) return json(409, { error: 'Þessir mánuðir eru læstir (reikningur gerður eða þegar sameinaðir): ' + locked.map((r) => r.work_month).join(', ') });
  const fixed = rows.filter((r) => r.fixed_total != null && Number(r.fixed_total) > 0);
  if (fixed.length) return json(409, { error: 'Fast verð er sett á ' + fixed.map((r) => r.work_month).join(', ') + ' — taktu það af áður en mánuðirnir eru sameinaðir.' });

  const target = rows.reduce((a, b) => (a.work_month > b.work_month ? a : b));   // seinni mánuðurinn
  const sources = rows.filter((r) => r.work_month !== target.work_month);

  const patch = { updated_at: new Date().toISOString(), updated_by: body.updated_by || 'samreikningur' };
  for (const f of MERGE_SUM) patch[f] = rows.reduce((s, r) => s + nz(r[f]), 0);
  patch.materials_jsonb = rows.flatMap((r) => (Array.isArray(r.materials_jsonb) ? r.materials_jsonb : []));
  const stadfSum = rows.reduce((s, r) => s + nz(r.stadfesting), 0);
  const stadfOne = Math.max(...rows.map((r) => nz(r.stadfesting)));
  patch.stadfesting = stadfOnce ? stadfOne : stadfSum;
  const netSum = rows.reduce((s, r) => s + nz(r.net_an_vsk), 0);
  patch.net_an_vsk = Math.round((netSum - (stadfOnce ? stadfSum - stadfOne : 0)) * 100) / 100;
  const vskFactor = nz(target.net_an_vsk) > 0 ? nz(target.vsk_amount) / nz(target.net_an_vsk) : 0.24;
  patch.vsk_amount = Math.round(patch.net_an_vsk * vskFactor);
  patch.total_m_vsk = Math.round((patch.net_an_vsk + patch.vsk_amount) * 100) / 100;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(body.period_from || ''))) patch.period_from = body.period_from;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(body.period_to || ''))) patch.period_to = body.period_to;
  patch.customer_name = target.customer_name || (sources.find((r) => r.customer_name) || {}).customer_name || null;
  patch.merge_snapshot = MERGE_SNAP.reduce((o, f) => { o[f] = target[f]; return o; }, { period_from: target.period_from, period_to: target.period_to });
  patch.merged_from = sources.map((r) => ({ work_month: r.work_month, hours: nz(r.hours_dagvinna) + nz(r.hours_eftirvinna), stadfesting: nz(r.stadfesting), net_an_vsk: nz(r.net_an_vsk), total_m_vsk: nz(r.total_m_vsk) }));
  patch.merged_into = null;
  const mLabel = months.join(' + ');
  const noteLine = 'Samreikningur ' + mLabel + (patch.period_from ? ' (' + patch.period_from + ' – ' + patch.period_to + ')' : '');
  patch.notes = [String(target.notes || '').trim(), noteLine].filter(Boolean).join('\n');

  try {
    const saved = await sbPatchRows(`worksite_name=eq.${encodeURIComponent(ws)}&work_month=eq.${encodeURIComponent(target.work_month)}`, patch);
    await sbPatchRows(`worksite_name=eq.${encodeURIComponent(ws)}&work_month=in.(${inList(sources.map((r) => r.work_month))})`,
      { status: 'merged', merged_into: target.work_month, updated_at: new Date().toISOString(), updated_by: body.updated_by || 'samreikningur' });
    return json(200, { ok: true, combined: saved[0] || null, target_month: target.work_month, merged: sources.map((r) => r.work_month), saved_stadfesting: stadfOnce ? stadfSum - stadfOne : 0 });
  } catch (e) { return json(502, { error: e.message }); }
}

async function unmergeMonths(body) {
  const ws = String(body.worksite_name || '').trim();
  const month = String(body.work_month || '').trim();          // mánuður samreikningsins
  if (!ws || !/^\d{4}-\d{2}$/.test(month)) return json(400, { error: 'worksite_name + work_month þarf' });
  let rows;
  try { rows = await sbRows(`invoice_drafts?worksite_name=eq.${encodeURIComponent(ws)}&work_month=eq.${encodeURIComponent(month)}&select=*`); }
  catch (e) { return json(502, { error: e.message }); }
  const t = rows[0];
  if (!t) return json(404, { error: 'Fann ekki drögin' });
  if (!t.merge_snapshot) return json(409, { error: 'Þessi drög eru ekki samreikningur' });

  const snap = t.merge_snapshot || {};
  const patch = { updated_at: new Date().toISOString(), updated_by: body.updated_by || 'samreikningur', merged_from: null, merge_snapshot: null, period_from: null, period_to: null };
  for (const f of MERGE_SNAP) patch[f] = snap[f] !== undefined ? snap[f] : null;
  if (snap.period_from !== undefined) patch.period_from = snap.period_from;
  if (snap.period_to !== undefined) patch.period_to = snap.period_to;
  if (!patch.status) patch.status = 'draft';
  try {
    const saved = await sbPatchRows(`worksite_name=eq.${encodeURIComponent(ws)}&work_month=eq.${encodeURIComponent(month)}`, patch);
    const back = await sbPatchRows(`worksite_name=eq.${encodeURIComponent(ws)}&merged_into=eq.${encodeURIComponent(month)}`,
      { status: 'draft', merged_into: null, updated_at: new Date().toISOString(), updated_by: body.updated_by || 'samreikningur' });
    return json(200, { ok: true, restored: saved[0] || null, months_back: (back || []).map((r) => r.work_month) });
  } catch (e) { return json(502, { error: e.message }); }
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
