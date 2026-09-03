// field-app.js — Brunaþéttingar: bakendi verkstaða-appsins (brunathettingar.html) og
// hub-flipans „Frá verkstað" (index.html). Starfsmenn á verkstað skrá efni af lager,
// punkta úr verkinu, mætingar-athugasemdir (veikur/seint/fjarverandi) og beiðnir;
// Agnar sér allt í hubnum og fær efnið beint inn í Efnislistann. Töflur: field_entries,
// field_shares (sjá sql/2026-09-03_field_entries.sql). Ósk Agnars 03.09.2026.
//
//   GET  /api/field-app?op=bootstrap&month=YYYY-MM
//        → { month, names[], worksites[{name,hours,days,last_date,employees[]}],
//            redder{ws:{an_vsk,lines[]}}, materials[], entries[], shares[] }
//   GET  /api/field-app?op=entries[&month=YYYY-MM|&days=N][&kind=..][&worksite=..][&status=..]
//        → { rows, shares }
//   GET  /api/field-app?op=materials → { materials }
//   POST /api/field-app  { action:'add', kind, worksite_name?, work_month?, entry_date?, employee?,
//                          author?, item_label?, qty?, unit?, unit_price?, category?, note?, client_id? }
//        { action:'update', id, status?|note?|qty?… } · { action:'delete', id }
//        { action:'share_add', title, url, kind?, note? } · { action:'share_delete', id }
//
// Aðgangur: FIELD_APP_TOKEN (Netlify env). Sé hann settur þarf ?t=<token> eða
// x-field-token haus (appið geymir hann úr slóðinni). Ósettur = opið, eins og
// hubbinn sjálfur er í áfanga 1 (Agnar: innskráning „í næstu viku"). Þegar
// HUB_STAFF_PASSWORD fer á, á FIELD_APP_TOKEN að fara á um leið.
//
// client_id (uuid frá appinu) er UNIQUE: biðröð appsins (net datt út) má senda
// sömu færslu aftur án þess að tvítaka — þá skilar 'add' eldri röðinni (duplicate:true).

const P = require('./_portal');
const MATERIALS = require('../../js/gr-materials.js');

const KINDS = ['efni', 'punktur', 'maeting', 'beidni'];
const FIELDS = ['kind', 'worksite_name', 'work_month', 'entry_date', 'employee', 'author', 'item_label', 'qty', 'unit', 'unit_price', 'category', 'note', 'status', 'client_id'];
const TOKEN = process.env.FIELD_APP_TOKEN || '';

function gate(event) {
  if (!TOKEN) return null;
  const q = event.queryStringParameters || {};
  const h = event.headers || {};
  const t = q.t || h['x-field-token'] || h['X-Field-Token'] || '';
  if (t && t === TOKEN) return null;
  return P.json(401, { error: 'Aðgangslykil vantar — opnaðu appið með slóðinni sem þú fékkst', need_token: true });
}
function monthRange(m) {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
}
function isMonth(s) { return /^\d{4}-\d{2}$/.test(String(s || '')); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
async function all(qs) {
  const r = await P.sbGet(qs);
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function allPages(qs) {
  const out = []; const lim = 1000;
  for (let off = 0; ; off += lim) {
    const rows = await all(`${qs}&limit=${lim}&offset=${off}`);
    out.push(...rows);
    if (rows.length < lim) break;
  }
  return out;
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-field-token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = gate(event); if (g) return g;
  try {
    if (event.httpMethod === 'GET') return await handleGet(event);
    if (event.httpMethod === 'POST') return await handlePost(event);
    return P.json(405, { error: 'Method not allowed' });
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
};

async function handleGet(event) {
  const q = event.queryStringParameters || {};
  const op = q.op || 'entries';
  if (op === 'materials') return P.json(200, { materials: MATERIALS });

  if (op === 'bootstrap') {
    const month = isMonth(q.month) ? q.month : todayIso().slice(0, 7);
    const { from, to } = monthRange(month);
    const since = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const [tv, aliases, redder, entries, shares, recent] = await Promise.all([
      allPages(`timavera_entries?select=project,hours,date,employee&date=gte.${from}&date=lte.${to}&order=date.asc`),
      all('project_aliases?select=canonical_name,alias').catch(() => []),
      all(`redder_invoices?select=worksite_match,dagsetning,month_override,an_vsk,redder_line_items(item_name,magn,upphaed,ein_verd,excluded,worksite_override)&dagsetning=gte.${from}&dagsetning=lte.${to}`).catch(() => []),
      allPages(`field_entries?select=*&work_month=eq.${month}&order=created_at.desc`),
      all('field_shares?select=*&active=is.true&order=created_at.desc').catch(() => []),
      allPages(`timavera_entries?select=employee&date=gte.${since}`).catch(() => []),
    ]);
    const amap = {};
    for (const a of aliases) if (a && a.alias) amap[a.alias] = a.canonical_name;
    // Verkstaðir mánaðarins úr Tímaveru — sama alias-samruni og Kröfuyfirlit/worksites.js
    // Gervi-verkefni Tímaveru (veikindi, frí, eigin vinna Slökkvitækis) eru ekki verkstaðir
    const SKIP = /veikindi|sick|orlof|\bfr[ií]\b|^slökkvitæki|^slokkvitaeki|^brunahólf$|^brunaholf$/i;
    const ws = new Map();
    for (const r of tv) {
      const p = amap[r.project] || r.project; if (!p || SKIP.test(p)) continue;
      let w = ws.get(p); if (!w) ws.set(p, w = { name: p, hours: 0, days: new Set(), employees: {}, last_date: '' });
      const h = Number(r.hours) || 0; w.hours += h; w.days.add(r.date);
      const e = String(r.employee || '').trim(); if (e) w.employees[e] = (w.employees[e] || 0) + h;
      if (r.date > w.last_date) w.last_date = r.date;
    }
    const worksites = [...ws.values()].map((w) => ({
      name: w.name, hours: r2(w.hours), days: w.days.size, last_date: w.last_date,
      employees: Object.entries(w.employees).sort((a, b) => b[1] - a[1]).map(([name, hours]) => ({ name, hours: r2(hours) })),
    })).sort((a, b) => b.hours - a.hours);
    // Redder-innkaup per verkstað (sömu línur og Efniskostnaður; undanskildar línur merktar)
    const rd = {};
    for (const inv of redder) {
      const base = amap[inv.worksite_match] || inv.worksite_match;
      const lines = inv.redder_line_items || [];
      const hasOv = lines.some((l) => String(l.worksite_override || '').trim());
      const bucket = (w) => (rd[w] = rd[w] || { an_vsk: 0, lines: [] });
      if (base && !hasOv) bucket(base).an_vsk += Number(inv.an_vsk) || 0;
      for (const li of lines) {
        const amt = Number(li.upphaed) || 0;
        const raw = String(li.worksite_override || '').trim();
        const w = (raw && (amap[raw] || raw)) || base; if (!w) continue;
        const qty = Number(li.magn) || 0;
        const cost = qty > 0 && li.upphaed != null ? Math.round(amt / qty) : (Number(li.ein_verd) || 0);
        const b = bucket(w);
        b.lines.push({ label: li.item_name || 'Efni', qty, cost, excluded: !!li.excluded, date: inv.dagsetning });
        if (hasOv && !li.excluded) b.an_vsk += amt;
      }
    }
    for (const k of Object.keys(rd)) rd[k].an_vsk = Math.round(rd[k].an_vsk);
    const names = [...new Set(recent.map((r) => String(r.employee || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'is'));
    return P.json(200, { month, names, worksites, redder: rd, materials: MATERIALS, entries, shares, generated_at: new Date().toISOString() });
  }

  // op=entries
  const parts = ['select=*', 'order=created_at.desc'];
  if (isMonth(q.month)) parts.push(`work_month=eq.${q.month}`);
  else if (q.days) {
    const d = Math.min(400, Math.max(1, parseInt(q.days, 10) || 8));
    parts.push(`entry_date=gte.${new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)}`);
  }
  if (q.kind && KINDS.includes(q.kind)) parts.push(`kind=eq.${q.kind}`);
  if (q.worksite) parts.push(`worksite_name=eq.${encodeURIComponent(q.worksite)}`);
  if (q.status) parts.push(`status=eq.${encodeURIComponent(q.status)}`);
  const [rows, shares] = await Promise.all([
    allPages('field_entries?' + parts.join('&')),
    q.shares === '0' ? [] : all('field_shares?select=*&active=is.true&order=created_at.desc').catch(() => []),
  ]);
  return P.json(200, { rows, shares });
}

async function handlePost(event) {
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
  const action = b.action || 'add';

  if (action === 'add') {
    if (!KINDS.includes(b.kind)) return P.json(400, { error: 'kind vantar eða er ógilt' });
    const row = {};
    for (const k of FIELDS) if (b[k] !== undefined && b[k] !== null && b[k] !== '') row[k] = b[k];
    row.entry_date = /^\d{4}-\d{2}-\d{2}$/.test(String(row.entry_date || '')) ? row.entry_date : todayIso();
    row.work_month = isMonth(row.work_month) ? row.work_month : row.entry_date.slice(0, 7);
    if (row.qty != null) row.qty = Number(row.qty) || 0;
    if (row.unit_price != null) row.unit_price = Number(row.unit_price) || 0;
    for (const k of ['note', 'item_label', 'worksite_name', 'employee', 'author', 'category', 'unit']) if (row[k] != null) row[k] = String(row[k]).trim().slice(0, 2000);
    row.status = 'new';
    if (row.client_id) {
      const ex = await all(`field_entries?select=*&client_id=eq.${encodeURIComponent(String(row.client_id))}`);
      if (ex.length) return P.json(200, { row: ex[0], duplicate: true });
    }
    const r = await P.sbPost('field_entries', row);
    if (!r.ok) return P.json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    return P.json(200, { row: rows[0] });
  }

  if (action === 'update') {
    const id = Number(b.id); if (!id) return P.json(400, { error: 'id vantar' });
    const patch = { updated_at: new Date().toISOString() };
    for (const k of FIELDS) if (k !== 'client_id' && k !== 'kind' && b[k] !== undefined) patch[k] = b[k];
    if (patch.status && !['new', 'seen', 'done'].includes(patch.status)) return P.json(400, { error: 'status ógilt' });
    const r = await P.sbPatch(`field_entries?id=eq.${id}`, patch);
    if (!r.ok) return P.json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    return P.json(200, { row: rows[0] || null });
  }

  if (action === 'delete') {
    const id = Number(b.id); if (!id) return P.json(400, { error: 'id vantar' });
    const r = await fetch(`${P.SUPABASE_URL}/rest/v1/field_entries?id=eq.${id}`, { method: 'DELETE', headers: { apikey: P.SUPABASE_KEY, Authorization: 'Bearer ' + P.SUPABASE_KEY } });
    return r.ok ? P.json(200, { ok: true }) : P.json(r.status, { error: (await r.text()).slice(0, 300) });
  }

  if (action === 'share_add') {
    if (!b.title || !b.url) return P.json(400, { error: 'title og url vantar' });
    const r = await P.sbPost('field_shares', { kind: String(b.kind || 'link').slice(0, 40), title: String(b.title).trim().slice(0, 200), url: String(b.url).trim().slice(0, 2000), note: b.note ? String(b.note).slice(0, 1000) : null });
    if (!r.ok) return P.json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    return P.json(200, { share: rows[0] });
  }

  if (action === 'share_delete') {
    const id = Number(b.id); if (!id) return P.json(400, { error: 'id vantar' });
    const r = await P.sbPatch(`field_shares?id=eq.${id}`, { active: false });
    return r.ok ? P.json(200, { ok: true }) : P.json(r.status, { error: (await r.text()).slice(0, 300) });
  }

  return P.json(400, { error: 'Óþekkt action' });
}
