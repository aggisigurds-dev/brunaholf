// reikningspunktar.js — Drög-stöð: innhólf fyrir reikningspunkta sem safnast yfir tíma
// áður en reikningur er sendur (Agnar 04.09.2026). Tafla `reikningspunktar`
// (sql/2026-09-05_reikningspunktar.sql). Sama byggingarmynstur og field-app.js.
//
//   GET  /api/reikningspunktar[?status=nytt,flokkad][&worksite=..][&month=YYYY-MM][&limit=N]
//        → { rows }                                   punktar, nýjustu fyrst
//   GET  /api/reikningspunktar?op=stada
//        → { verk:[{ws, wm, total, fixed, hours, customer, kt, checks{…}, ready, punktar, …}] }
//          gátlistinn per drög — REIKNAÐUR úr því sem er til (invoice_drafts, efnislisti_documents,
//          pricing_guide + customer_worksite_map, krofur_yfirlit_meta, Redder, punktar), aldrei geymdur
//   POST { action:'add', raw, source?, author?, client_id?, attachments?, worksite_name?, work_month? }
//        → { row } · sami client_id aftur → eldri röðin með duplicate:true
//   POST { action:'set', id, worksite_name?, work_month?, status?, ai? }       handvirk röðun / staða
//   POST { action:'apply', id, tegund, klst?, ev_klst?, efni:{label,price,qty}?, upphaed?,
//          customer_name?, kennitala?, worksite_name?, work_month? }
//        → skrifar í invoice_drafts (hluta-PATCH, býr til röð ef vantar), bætir nótulínu,
//          endurreiknar upphæð, merkir punktinn 'notad' með applied-afriti. EINA skrifleiðin í drögin.
//   POST { action:'delete', id }
//
// Reglur (sjá plan): punktur tapast aldrei (raw skrifast fyrst, óbreytt); gervigreind leggur til
// en skrifar aldrei — aðeins 'apply' snertir invoice_drafts, og aðeins þegar Agnar ýtir á ✓.
// Aðgangur: P.requireStaff — virkur um leið og HUB_STAFF_PASSWORD er sett (fail-open þangað til,
// eins og hubbinn sjálfur).

const P = require('./_portal');

const SOURCES = ['hub', 'simi', 'postur', 'mynd', 'rodd'];
const STATUS = ['nytt', 'flokkad', 'notad', 'hafnad'];
const TEGUND = ['klst', 'efni', 'gjald', 'greidandi', 'upplysing', 'spurning'];
// Eitt sameiginlegt innhólf fyrir bæði félögin (Agnar 05.09.2026: „aðallega fyrir
// slokkvitaeki … en má alveg vera eitt sameiginlegt"). Fyrir Brunahólf er markið
// drög (verkstaður|mánuður) í invoice_drafts; fyrir Slökkvitæki er markið KÚNNI
// (fyrirtaeki.nafn í worksite_name, work_month valfrjálst) — reikningurinn sjálfur
// verður til í Slökkvitæki-appinu, svo 'apply' merkir punktinn aðeins notaðan þar.
const FELAG = ['brunaholf', 'slokkvitaeki'];

const isMonth = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
const lc = (s) => String(s || '').trim().toLowerCase();
const digits = (s) => String(s || '').replace(/\D/g, '');
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const r2 = (n) => Math.round(num(n) * 100) / 100;
function monthsAgo(n) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 7); }
function dmy(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; }

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
async function del(path) {
  return fetch(`${P.SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: { apikey: P.SUPABASE_KEY, Authorization: 'Bearer ' + P.SUPABASE_KEY } });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = P.requireStaff(event); if (g) return g;
  try {
    if (event.httpMethod === 'GET') return await handleGet(event);
    if (event.httpMethod === 'POST') return await handlePost(event);
    return P.json(405, { error: 'Method not allowed' });
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
};

// ── GET ────────────────────────────────────────────────────────────────────
async function handleGet(event) {
  const q = event.queryStringParameters || {};
  if (q.op === 'stada') return P.json(200, await stada());

  const parts = ['select=*', 'order=created_at.desc'];
  if (q.status) {
    const st = String(q.status).split(',').map((s) => s.trim()).filter((s) => STATUS.includes(s));
    if (st.length === 1) parts.push(`status=eq.${st[0]}`);
    else if (st.length > 1) parts.push(`status=in.(${st.join(',')})`);
  }
  if (q.worksite) parts.push(`worksite_name=eq.${encodeURIComponent(q.worksite)}`);
  if (isMonth(q.month)) parts.push(`work_month=eq.${q.month}`);
  if (FELAG.includes(q.felag)) parts.push(`felag=eq.${q.felag}`);
  const lim = Math.min(1000, Math.max(1, parseInt(q.limit, 10) || 500));
  const rows = await all(`reikningspunktar?${parts.join('&')}&limit=${lim}`);
  return P.json(200, { rows });
}

// Gátlistinn per drög. Sex atriði, öll reiknuð — sé eitthvað rautt sést nákvæmlega
// hvað vantar áður en „Senda í bókun" á við.
async function stada() {
  const cutoff = monthsAgo(4);
  const [drafts, docs, pg, cwmap, meta, notes, aliases, redder, felog] = await Promise.all([
    allPages(`invoice_drafts?select=worksite_name,work_month,status,source,total_m_vsk,fixed_total,customer_name,kennitala,hours_dagvinna,hours_eftirvinna,materials_total,notes,updated_at&work_month=gte.${cutoff}&order=work_month.desc`),
    allPages(`efnislisti_documents?select=worksite_name,work_month,doc_type,is_primary&work_month=gte.${cutoff}`).catch(() => []),
    all('pricing_guide?select=worksite_name,customer_name,kennitala').catch(() => []),
    all('customer_worksite_map?select=worksite_name,customer_name').catch(() => []),
    allPages('krofur_yfirlit_meta?select=inv_key,confirmed,sent,sent_at,paid,hidden').catch(() => []),
    allPages('reikningspunktar?select=id,felag,worksite_name,work_month,status,raw,ai,created_at,source&status=in.(nytt,flokkad)'),
    all('project_aliases?select=canonical_name,alias').catch(() => []),
    allPages(`redder_invoices?select=worksite_match,dagsetning,month_override,an_vsk&dagsetning=gte.${cutoff}-01`).catch(() => []),
    // Kúnnar Slökkvitækis — nöfn + kt fyrir SL-hlið stöðvarinnar (leitarlisti og auðkenning).
    allPages('fyrirtaeki?select=id,nafn,kennitala&deleted_at=is.null&order=nafn').catch(() => []),
  ]);

  // Greiðanda-keðjan — sama og krofu-yfirlit-bru.js: handvirk tenging → Verðskrá.
  const amap = {}; for (const a of aliases) if (a && a.alias) amap[a.alias] = a.canonical_name;
  const payer = new Map(), payerKt = new Map();
  for (const m of cwmap) { const w = lc(m.worksite_name), p = String(m.customer_name || '').trim(); if (w && p && !payer.has(w)) payer.set(w, p); }
  for (const g of pg) {
    const w = lc(g.worksite_name), p = String(g.customer_name || '').trim();
    if (w && p && !payer.has(w)) payer.set(w, p);
    if (w && digits(g.kennitala)) payerKt.set(w, digits(g.kennitala));
  }
  // Redder án vsk per (verkstaður|mánuður) — month_override ræður eins og annars staðar.
  const redderBy = {};
  for (const inv of redder) {
    const ws = amap[inv.worksite_match] || inv.worksite_match; if (!ws) continue;
    const m = isMonth(inv.month_override) ? inv.month_override : String(inv.dagsetning || '').slice(0, 7);
    const k = lc(ws) + '|' + m; redderBy[k] = (redderBy[k] || 0) + num(inv.an_vsk);
  }
  const docBy = {};
  for (const d of docs) {
    const k = lc(d.worksite_name) + '|' + d.work_month;
    if (d.is_primary || /^efnislisti(_timabok)?_pdf$/.test(String(d.doc_type || ''))) docBy[k] = true;
  }
  const notesBy = {}; let unfiled = 0;
  const kunnarBy = {};                                   // Slökkvitæki: punktar per kúnna
  for (const n of notes) {
    if (n.felag === 'slokkvitaeki') {
      if (n.worksite_name) { const k = lc(n.worksite_name); (kunnarBy[k] = kunnarBy[k] || { kunni: n.worksite_name, ids: [] }).ids.push(n.id); }
      else unfiled++;
      continue;
    }
    if (n.worksite_name && isMonth(n.work_month)) { const k = lc(n.worksite_name) + '|' + n.work_month; (notesBy[k] = notesBy[k] || []).push(n.id); }
    else unfiled++;
  }
  const felagBy = new Map(felog.map((f) => [lc(f.nafn), f]));
  const kunnar = Object.values(kunnarBy).map((k) => {
    const f = felagBy.get(lc(k.kunni)) || null;
    return { kunni: k.kunni, punktar: k.ids.length, punktar_ids: k.ids, id: f ? f.id : null, kt: f ? digits(f.kennitala) : '', thekktur: !!f };
  }).sort((a, b) => b.punktar - a.punktar || a.kunni.localeCompare(b.kunni, 'is'));
  const metaBy = new Map(meta.map((m) => [m.inv_key, m]));

  const verk = [];
  for (const d of drafts) {
    if (!['draft', 'overdue'].includes(String(d.status || 'draft'))) continue;   // sameinað/sleppt/rukkað er ekki „í smíðum"
    const ws = d.worksite_name, wm = d.work_month; if (!ws || !isMonth(wm)) continue;
    const k = lc(ws) + '|' + wm;
    const mt = metaBy.get(`draftinv|${ws}|${wm}`) || {};
    if (mt.paid) continue;
    const hours = r2(num(d.hours_dagvinna) + num(d.hours_eftirvinna));
    const fixed = num(d.fixed_total), total = num(d.total_m_vsk), red = Math.round(redderBy[k] || 0);
    const customer = String(d.customer_name || payer.get(lc(ws)) || '').trim();
    const kt = digits(d.kennitala) || payerKt.get(lc(ws)) || '';
    const open = notesBy[k] || [];
    const checks = {
      timar: hours > 0 || fixed > 0,
      efni: fixed > 0 || red === 0 || num(d.materials_total) > 0,
      greidandi: !!(customer && kt),
      upphaed: total > 0,
      skjol: !!docBy[k],
      punktar: open.length === 0,
    };
    verk.push({
      ws, wm, source: d.source, total, fixed, hours, hours_dv: r2(d.hours_dagvinna), hours_ev: r2(d.hours_eftirvinna),
      materials_total: Math.round(num(d.materials_total)), redder: red, customer, kt,
      checks, ready: Object.values(checks).every(Boolean), punktar: open.length, punktar_ids: open,
      confirmed: !!mt.confirmed, sent: !!mt.sent, sent_at: mt.sent_at || null, hidden: !!mt.hidden,
      notes: d.notes || '', updated_at: d.updated_at,
    });
  }
  // Tilbúin verk aftast (þau bíða bara sendingar), annars þau með flesta punkta fyrst, svo nýjast.
  verk.sort((a, b) => (a.ready - b.ready) || (b.punktar - a.punktar) || String(b.wm).localeCompare(String(a.wm)));
  return {
    generated_at: new Date().toISOString(), cutoff, verk, unfiled, alls: verk.length, tilbuin: verk.filter((v) => v.ready).length,
    kunnar, kunnalisti: felog.map((f) => f.nafn).filter(Boolean),
  };
}

// ── POST ───────────────────────────────────────────────────────────────────
async function handlePost(event) {
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
  const action = b.action || 'add';
  const now = new Date().toISOString();

  if (action === 'add') {
    const raw = String(b.raw || '').trim().slice(0, 4000);
    if (!raw && !(Array.isArray(b.attachments) && b.attachments.length)) return P.json(400, { error: 'Punkturinn er tómur' });
    if (b.client_id) {
      const ex = await all(`reikningspunktar?select=*&client_id=eq.${encodeURIComponent(String(b.client_id))}`);
      if (ex.length) return P.json(200, { row: ex[0], duplicate: true });
    }
    const row = {
      raw: raw || '(mynd)',
      felag: FELAG.includes(b.felag) ? b.felag : 'brunaholf',
      source: SOURCES.includes(b.source) ? b.source : 'hub',
      author: b.author ? String(b.author).trim().slice(0, 60) : null,
      client_id: b.client_id ? String(b.client_id).slice(0, 80) : null,
      attachments: Array.isArray(b.attachments) ? b.attachments.slice(0, 20) : [],
      status: 'nytt',
      worksite_name: b.worksite_name ? String(b.worksite_name).trim().slice(0, 200) : null,
      work_month: isMonth(b.work_month) ? b.work_month : null,
    };
    const r = await P.sbPost('reikningspunktar', row);
    if (!r.ok) return P.json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    return P.json(200, { row: rows[0] });
  }

  if (action === 'set') {
    const id = Number(b.id); if (!id) return P.json(400, { error: 'id vantar' });
    const patch = { updated_at: now };
    if (b.worksite_name !== undefined) patch.worksite_name = b.worksite_name ? String(b.worksite_name).trim().slice(0, 200) : null;
    if (b.work_month !== undefined) patch.work_month = isMonth(b.work_month) ? b.work_month : null;
    if (b.status !== undefined) { if (!STATUS.includes(b.status)) return P.json(400, { error: 'status ógilt' }); patch.status = b.status; }
    if (b.felag !== undefined) { if (!FELAG.includes(b.felag)) return P.json(400, { error: 'felag ógilt' }); patch.felag = b.felag; }
    if (b.ai !== undefined) patch.ai = b.ai;
    const r = await P.sbPatch(`reikningspunktar?id=eq.${id}`, patch);
    if (!r.ok) return P.json(r.status, { error: (await r.text()).slice(0, 300) });
    const rows = await r.json();
    return P.json(200, { row: rows[0] || null });
  }

  if (action === 'delete') {
    const id = Number(b.id); if (!id) return P.json(400, { error: 'id vantar' });
    const r = await del(`reikningspunktar?id=eq.${id}`);
    return r.ok ? P.json(200, { ok: true }) : P.json(r.status, { error: (await r.text()).slice(0, 300) });
  }

  if (action === 'apply') return apply(b, now);

  return P.json(400, { error: 'Óþekkt action' });
}

// Skrifar punktinn í drögin — eina leiðin héðan inn í invoice_drafts. Hluta-PATCH
// (invoice-drafts.js gerir það sama: PATCH fyrst, INSERT aðeins ef röð vantar).
async function apply(b, now) {
  const id = Number(b.id); if (!id) return P.json(400, { error: 'id vantar' });
  const tegund = TEGUND.includes(b.tegund) ? b.tegund : 'upplysing';
  const [note] = await all(`reikningspunktar?select=*&id=eq.${id}`);
  if (!note) return P.json(404, { error: 'Punktur fannst ekki' });
  const ws = String(b.worksite_name || note.worksite_name || '').trim();
  const wm = isMonth(b.work_month) ? b.work_month : note.work_month;

  // Slökkvitæki: reikningurinn verður til í Slökkvitæki-appinu — hér er punkturinn
  // aðeins festur við kúnnann og merktur notaður (Agnar setti hann inn þar).
  if (note.felag === 'slokkvitaeki') {
    if (!ws) return P.json(400, { error: 'Veldu kúnna fyrst' });
    const applied = { felag: 'slokkvitaeki', kunni: ws, tegund, athugasemd: b.athugasemd ? String(b.athugasemd).slice(0, 300) : null };
    const nr = await P.sbPatch(`reikningspunktar?id=eq.${id}`, { status: 'notad', worksite_name: ws, work_month: isMonth(wm) ? wm : null, applied, applied_at: now, updated_at: now });
    if (!nr.ok) return P.json(nr.status, { error: (await nr.text()).slice(0, 300) });
    return P.json(200, { ok: true, row: (await nr.json())[0] || null, applied });
  }
  if (!ws || !isMonth(wm)) return P.json(400, { error: 'Veldu verk og mánuð fyrst' });

  const filter = `worksite_name=eq.${encodeURIComponent(ws)}&work_month=eq.${encodeURIComponent(wm)}`;
  let [d] = await all(`invoice_drafts?select=*&${filter}`);
  if (!d) {
    // Ekkert drög enn → lágmarksröð svo punkturinn eigi heimili (source er NOT NULL).
    const r = await P.sbPost('invoice_drafts', { worksite_name: ws, work_month: wm, source: 'handvirkt', status: 'draft', updated_by: 'drog-stod' });
    if (!r.ok) return P.json(r.status, { error: 'Gat ekki stofnað drög: ' + (await r.text()).slice(0, 200) });
    d = (await r.json())[0];
  }
  const [pgRow] = await all(`pricing_guide?select=dagvinna_rate,eftirvinna_rate,vsk_pct&worksite_name=eq.${encodeURIComponent(ws)}`).catch(() => [null]);
  const pg = pgRow || {};

  const patch = { updated_by: 'drog-stod' };
  const applied = { tegund, ws, wm };
  let recompute = false;
  if (tegund === 'klst') {
    const dv = r2(b.klst), ev = r2(b.ev_klst);
    if (!dv && !ev) return P.json(400, { error: 'Klukkustundir vantar' });
    patch.hours_dagvinna = r2(num(d.hours_dagvinna) + dv);
    patch.hours_eftirvinna = r2(num(d.hours_eftirvinna) + ev);
    patch.rate_dagvinna = num(d.rate_dagvinna) || num(pg.dagvinna_rate) || 9951;
    patch.rate_eftirvinna = num(d.rate_eftirvinna) || num(pg.eftirvinna_rate) || 14927;
    applied.klst = dv; applied.ev_klst = ev; recompute = true;
  } else if (tegund === 'efni') {
    const e = b.efni || {};
    const label = String(e.label || note.raw).trim().slice(0, 120), price = Math.round(num(e.price)), qty = r2(e.qty) || 1;
    if (!label || !price) return P.json(400, { error: 'Efni þarf heiti og verð' });
    const line = { label, price, qty, total: Math.round(price * qty) };
    const mats = Array.isArray(d.materials_jsonb) ? d.materials_jsonb.slice() : [];
    mats.push(line);
    patch.materials_jsonb = mats;
    patch.materials_total = Math.round(mats.reduce((a, m) => a + num(m.total), 0));
    applied.efni = line; recompute = true;
  } else if (tegund === 'gjald') {
    const u = Math.round(num(b.upphaed));
    if (!u) return P.json(400, { error: 'Upphæð vantar' });
    patch.fixed_total = u; applied.fixed_total = u; recompute = true;
  } else if (tegund === 'greidandi') {
    if (b.customer_name) patch.customer_name = String(b.customer_name).trim().slice(0, 200);
    if (b.kennitala) patch.kennitala = digits(b.kennitala) || null;
    if (!patch.customer_name && !patch.kennitala) return P.json(400, { error: 'Greiðanda eða kennitölu vantar' });
    applied.customer_name = patch.customer_name || null; applied.kennitala = patch.kennitala || null;
  }
  if (recompute) {
    // Sama kjarna-reikningur og Efnislistinn: vinna + smáhlutagjald + staðfesting + efni,
    // afsláttur, vsk. Fast verð yfirríður og bakreiknar nettó.
    const dvH = patch.hours_dagvinna != null ? patch.hours_dagvinna : num(d.hours_dagvinna);
    const evH = patch.hours_eftirvinna != null ? patch.hours_eftirvinna : num(d.hours_eftirvinna);
    const dvR = patch.rate_dagvinna || num(d.rate_dagvinna) || num(pg.dagvinna_rate) || 9951;
    const evR = patch.rate_eftirvinna || num(d.rate_eftirvinna) || num(pg.eftirvinna_rate) || 14927;
    const mat = patch.materials_total != null ? patch.materials_total : num(d.materials_total);
    const fixed = patch.fixed_total != null ? patch.fixed_total : num(d.fixed_total);
    const vsk = num(d.vsk_pct) || num(pg.vsk_pct) || 24;
    let net = dvH * dvR + evH * evR + num(d.smahlutagjald) + num(d.stadfesting) + mat;
    const disc = num(d.discount_pct); if (disc > 0) net = net * (1 - disc / 100);
    const total = fixed > 0 ? fixed : Math.round(net * (1 + vsk / 100));
    const netAn = fixed > 0 ? Math.round(fixed / (1 + vsk / 100)) : Math.round(net);
    patch.net_an_vsk = netAn; patch.vsk_amount = total - netAn; patch.total_m_vsk = total;
    applied.total_m_vsk = total;
  }
  // Nótulína svo sagan sjáist í Efnislistanum (innri athugasemd, fer ekki á PDF).
  const lina = `• ${dmy(now)} punktur${note.author ? ' (' + note.author + ')' : ''}: ${String(note.raw).replace(/\s+/g, ' ').slice(0, 220)}`;
  patch.notes = (d.notes ? String(d.notes).trimEnd() + '\n' : '') + lina;

  const pr = await P.sbPatch(`invoice_drafts?${filter}`, patch);
  if (!pr.ok) return P.json(pr.status, { error: 'Vistun í drög mistókst: ' + (await pr.text()).slice(0, 200) });
  const draft = (await pr.json())[0] || null;

  const nr = await P.sbPatch(`reikningspunktar?id=eq.${id}`, { status: 'notad', worksite_name: ws, work_month: wm, applied, applied_at: now, updated_at: now });
  const row = nr.ok ? (await nr.json())[0] : null;
  return P.json(200, { ok: true, draft, row, applied });
}
