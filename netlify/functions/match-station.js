// match-station.js — the report-matching "station".
//
// A human-in-the-loop board for assigning Slökkvitæki úttektarskýrslur /
// reikningar to the RIGHT service-customer location + year. Built because a
// previous auto-renamer mangled ~1/3 of the filenames (the "uttekt-master /
// MATCH 90" rows): the filename can no longer be trusted, so this never
// auto-writes from a name — it surfaces the actual PDF (Drive view link) and a
// *suggested* site, and only writes what the user confirms (reviewed=true).
//
//   GET  /api/match-station                  → { companies:[…] } (service cos + counts)
//   GET  /api/match-station?base=ID          → { company, locations:[…], docs:[…] }
//   POST /api/match-station {action:'save',   id, fyrirtaeki_id, year, is_duplicate, reviewed}
//   POST /api/match-station {action:'add-site', base_id, nafn, heimilisfang}
//
// Pure Supabase REST + EIN létt Drive-aðgerð (2026-08-07): files.get á NAFNI
// skjals. Engin PDF-þáttun, ekkert fært, ekkert endurnefnt í Drive.

const { json, cors, freshAccessToken } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
      if (body.action === 'save')        return json(200, await saveDoc(body));
      if (body.action === 'delete')      return json(200, await deleteDoc(body));
      if (body.action === 'add-site')    return json(200, await addSite(body));
      if (body.action === 'consolidate') return json(200, await consolidate(body.base_id, true, !!body.overwrite));
      return json(400, { error: 'unknown action' });
    }
    const p = event.queryStringParameters || {};
    if (p.scope === 'unmatched' || p.scope === 'dups') return json(200, await globalList(p.scope));
    if (p.base && p.consolidate) return json(200, await consolidate(p.base, false, p.overwrite === '1' || p.overwrite === 'true'));
    if (p.base) return json(200, await companyDetail(p.base));
    return json(200, await listCompanies());
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

// ── Supabase REST helpers ─────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function sbGet(path) {           // paged read — pulls every row in 1000-row pages
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders({ Range: `${from}-${from + 999}` }) });
    if (!r.ok) throw new Error('sbGet ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const rows = await r.json().catch(() => []);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
function inList(ids) { return '(' + ids.map(x => String(x).replace(/[(),]/g, '')).join(',') + ')'; }

// ── List service companies (the picker) ───────────────────────────────────────
async function listCompanies() {
  const locs = await sbGet('fyrirtaeki?er_i_thjonustu=eq.true&select=id,nafn,heimilisfang,customer_base_id&deleted_at=is.null');
  const baseIds = [...new Set(locs.map(l => l.customer_base_id).filter(x => x != null))];
  if (!baseIds.length) return { companies: [] };

  const bases = [];
  for (let i = 0; i < baseIds.length; i += 200)
    bases.push(...await sbGet(`customers_base?id=in.${inList(baseIds.slice(i, i + 200))}&select=id,nafn,kennitala`));
  const baseById = {}; bases.forEach(b => { baseById[b.id] = b; });

  const docs = [];
  for (let i = 0; i < baseIds.length; i += 200)
    docs.push(...await sbGet(`customer_documents?customer_base_id=in.${inList(baseIds.slice(i, i + 200))}&select=customer_base_id,fyrirtaeki_id,is_duplicate,reviewed,doc_type,needs_site`));

  const agg = {};
  baseIds.forEach(id => { agg[id] = { base_id: id, nafn: (baseById[id] || {}).nafn || ('#' + id), kennitala: (baseById[id] || {}).kennitala || '', locations: 0, docs: 0, reviewed: 0, unmatched: 0, dups: 0, needs_site: 0 }; });
  locs.forEach(l => { if (agg[l.customer_base_id]) agg[l.customer_base_id].locations++; });
  docs.forEach(d => {
    const a = agg[d.customer_base_id]; if (!a) return;
    a.docs++;
    if (d.reviewed) a.reviewed++;
    if (d.is_duplicate) a.dups++;
    else if (d.fyrirtaeki_id == null) a.unmatched++;
    // 🏷 multitool merkti: fjölstaða-kt án staðar-sönnunar — yfirferðarlistinn.
    if (d.needs_site === true && !d.is_duplicate) a.needs_site++;
  });
  // most work first: unconfirmed-but-present, then by name
  const companies = Object.values(agg).sort((x, y) =>
    (y.docs - y.reviewed) - (x.docs - x.reviewed) || x.nafn.localeCompare(y.nafn, 'is'));
  return { companies };
}

// ── One company: its sites + every report, with a (non-authoritative) suggestion ─
// ── Raunnöfn í stað innsogs-stimpla (2026-08-07, ósk Agnars) ──────────────────
// Fjöldi raða ber UPPRUNA-STIMPIL í notes („drive-multitool · 2024", „Sjálfvirkt
// úr appi 2026-08-03") í stað skráarheitis — stöðin sýndi þá stimpilinn og
// notandinn varð að opna hvert einasta PDF til að vita hvað það var. Hér eru
// alvöru Drive-nöfnin sótt í hóp (files.get, AÐEINS nafnið — ekkert fært né
// endurnefnt) og VISTUÐ yfir hreina stimpla í notes. Þar með lagast dálkurinn
// hér, chip-in í Slökkvitæki (patch 199 les sömu notes) — og þetta þarf aldrei
// að sækjast aftur. Notes með raunverulegu innihaldi (skráarheiti, dauða-hlekks
// skýringar) eru ALDREI snert. Þak per hleðslu svo fallið tímist ekki út;
// endurtekin „Sækja" klárar afganginn.
const STAMP_RE = /^\s*(drive-multitool|doc-index|relink(-docs)?|skjalavarsla|uttekt-upload|fasi0|sj[áa]lfvirkt\s+[úu]r\s+appi)\b/i;
function isStampOnly(notes) { const s = String(notes || '').trim(); return !s || (STAMP_RE.test(s) && !/\.pdf/i.test(s)); }
async function enrichNames(rows, cap) {
  const cand = rows.filter(d => d.drive_file_id && isStampOnly(d.notes)).slice(0, cap || 60);
  if (!cand.length) return 0;
  let token; try { token = await freshAccessToken(); } catch { return 0; }
  let fixed = 0;
  for (let i = 0; i < cand.length; i += 8) {
    await Promise.all(cand.slice(i, i + 8).map(async d => {
      try {
        const r = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(d.drive_file_id) + '?fields=name&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return;
        const name = String(((await r.json()) || {}).name || '').trim();
        if (!name) return;
        await patchDoc(d.id, { notes: name });
        d.notes = name; fixed++;
      } catch {}
    }));
  }
  return fixed;
}
// Storage-raðir eiga ekkert Drive-nafn — basename slóðarinnar (án tímastimpils,
// `_` sem bil) er skásta raunnafnið sem til er.
function storageName(p) { return String(p || '').split('/').pop().replace(/^\d{10,}_/, '').replace(/_/g, ' ').trim(); }

async function companyDetail(baseId) {
  baseId = parseInt(baseId, 10);
  const base = (await sbGet(`customers_base?id=eq.${baseId}&select=id,nafn,kennitala`))[0] || { id: baseId, nafn: '#' + baseId, kennitala: '' };
  const locations = await sbGet(`fyrirtaeki?customer_base_id=eq.${baseId}&select=id,nafn,heimilisfang,er_i_thjonustu&deleted_at=is.null&order=heimilisfang`);
  const raw = await sbGet(`customer_documents?customer_base_id=eq.${baseId}&select=id,drive_file_id,storage_path,doc_type,year,fyrirtaeki_id,is_duplicate,reviewed,notes,doc_date,amount,invoice_number,needs_site`);
  const names_fixed = await enrichNames(raw, 60);

  const docs = raw.map(d => {
    const seg = String(d.notes || '').split(' · ');
    // drive-sort now writes "<company> · <site address> · úttektarskýrsla <yr> · kt …"
    // for multi-site rekstrarfélög — show the site so the human can tell branches
    // apart, and feed the WHOLE notes to the suggester so its address match works.
    const site = (seg[1] && !/^(úttektarsk|reikningur|kt\b|R-|RESOLVE)/i.test(seg[1])) ? seg[1] : '';
    let filename = (seg[0] || '(óþekkt skrá)') + (site ? ' — ' + site : '');
    if (isStampOnly(d.notes) && d.storage_path) filename = storageName(d.storage_path);
    const sug = suggestLoc(d.notes || filename, locations);
    return {
      id: d.id,
      drive_file_id: d.drive_file_id || null,
      view_url: d.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/${d.storage_path}`
              : (d.drive_file_id && !String(d.drive_file_id).startsWith('sb:')) ? `/api/skjal?id=${encodeURIComponent(d.drive_file_id)}` : null,
      doc_type: d.doc_type, year: d.year, fyrirtaeki_id: d.fyrirtaeki_id,
      is_duplicate: !!d.is_duplicate, reviewed: !!d.reviewed,
      needs_site: d.needs_site === true,
      invoice_number: d.invoice_number || null, amount: d.amount || null,
      filename,
      suggest_loc_id: sug ? sug.id : null,
      suggest_conf: sug ? sug.conf : null,
      mangled: /uttekt-master|MATCH\s*\d/i.test(filename),
    };
  }).sort((a, b) =>
    Number(a.reviewed) - Number(b.reviewed) ||                       // unconfirmed first
    Number(a.fyrirtaeki_id != null) - Number(b.fyrirtaeki_id != null) || // unmatched first
    (a.year || 0) - (b.year || 0));

  return { company: base, locations, docs, names_fixed };
}

// ── Global worklists: ALL unconnected docs / ALL flagged duplicates ────────────
// One flat list across every service company so the human can see everything in
// one place (instead of clicking company by company). Each row carries its base
// (nafn + kt), its sites, and a suggested site — same shape the per-company board
// uses, so the existing save/assign UI works unchanged.
async function globalList(scope) {
  const locs = await sbGet('fyrirtaeki?er_i_thjonustu=eq.true&select=id,nafn,heimilisfang,customer_base_id&deleted_at=is.null');
  const baseIds = [...new Set(locs.map(l => l.customer_base_id).filter(x => x != null))];
  if (!baseIds.length) return { scope, count: 0, docs: [] };

  const bases = {};
  const sitesByBase = {};
  locs.forEach(l => { (sitesByBase[l.customer_base_id] = sitesByBase[l.customer_base_id] || []).push({ id: l.id, nafn: l.nafn, heimilisfang: l.heimilisfang }); });
  for (let i = 0; i < baseIds.length; i += 200) {
    (await sbGet(`customers_base?id=in.${inList(baseIds.slice(i, i + 200))}&select=id,nafn,kennitala`)).forEach(b => { bases[b.id] = b; });
  }

  const filt = scope === 'dups' ? 'is_duplicate=eq.true' : 'fyrirtaeki_id=is.null&is_duplicate=eq.false';
  const raw = [];
  for (let i = 0; i < baseIds.length; i += 200) {
    raw.push(...await sbGet(`customer_documents?customer_base_id=in.${inList(baseIds.slice(i, i + 200))}&${filt}&select=id,customer_base_id,drive_file_id,storage_path,doc_type,year,fyrirtaeki_id,is_duplicate,reviewed,notes,doc_date,amount,invoice_number,needs_site`));
  }
  await enrichNames(raw, 60);

  const docs = raw.map(d => {
    const seg = String(d.notes || '').split(' · ');
    const site = (seg[1] && !/^(úttektarsk|reikningur|kt\b|R-|RESOLVE)/i.test(seg[1])) ? seg[1] : '';
    let filename = (seg[0] || '(óþekkt skrá)') + (site ? ' — ' + site : '');
    if (isStampOnly(d.notes) && d.storage_path) filename = storageName(d.storage_path);
    const b = bases[d.customer_base_id] || {};
    const sites = sitesByBase[d.customer_base_id] || [];
    const sug = suggestLoc(d.notes || filename, sites);
    return {
      id: d.id, base_id: d.customer_base_id, base_nafn: b.nafn || ('#' + d.customer_base_id), kennitala: b.kennitala || '',
      multi_site: sites.length > 1, sites,
      drive_file_id: d.drive_file_id || null,
      view_url: d.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/${d.storage_path}`
              : (d.drive_file_id && !String(d.drive_file_id).startsWith('sb:')) ? `/api/skjal?id=${encodeURIComponent(d.drive_file_id)}` : null,
      doc_type: d.doc_type, year: d.year, fyrirtaeki_id: d.fyrirtaeki_id,
      is_duplicate: !!d.is_duplicate, reviewed: !!d.reviewed,
      needs_site: d.needs_site === true,
      invoice_number: d.invoice_number || null, amount: d.amount || null,
      filename,
      suggest_loc_id: sug ? sug.id : null, suggest_conf: sug ? sug.conf : null,
    };
  }).sort((a, b) =>
    String(a.base_nafn).localeCompare(String(b.base_nafn), 'is') ||
    String(a.doc_type).localeCompare(String(b.doc_type)) ||
    (a.year || 0) - (b.year || 0));

  return { scope, count: docs.length, docs };
}

// ── Address suggestion ─────────────────────────────────────────────────────────
// Single-location company → that site is the unambiguous answer for every doc.
// Multi-site → only suggest on a strong match (street stem + postcode/number), so
// mangled "uttekt-master" rows with no real address stay manual.
function normAddr(s) {
  return String(s || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')          // drop parentheticals like "(V Hringbrautar)"
    .replace(/\b\d{6}-?\d{4}\b/g, ' ')    // drop kennitala
    .replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}
function siteKey(addr) {
  const n = normAddr(addr);
  const street = (n.match(/([a-záéíóúýðþæö]{4,})/) || ['', ''])[1];
  const num = (n.match(/[a-záéíóúýðþæö]\s+(\d{1,3})(?:\D|$)/) || ['', ''])[1];
  const post = (n.match(/\b(\d{3})\b/) || ['', ''])[1];
  return { stem: street.slice(0, 6), num, post };
}
// Returns { id, conf:'high'|'low' } or null. 'high' = trustworthy (single site or
// a real street+postcode address) → bulk-connectable; 'low' = a hint from a
// mangled/ambiguous name → pre-filled but must be eyeballed, never auto-connected.
function suggestLoc(filename, locations) {
  if (!locations.length) return null;
  if (locations.length === 1) return { id: locations[0].id, conf: 'high' };   // single site → certain
  const raw = String(filename);
  // (1) A parenthetical names the real site ("… (V Hringbrautar)") even though the
  //     main address is wrong — suggest that site, but flagged low (the row is mangled).
  const parens = (raw.match(/\(([^)]*)\)/g) || []).join(' ').toLowerCase();
  if (parens) {
    let pb = null, pl = 0;
    for (const loc of locations) { const t = siteKey(loc.heimilisfang).stem; if (t && t.length >= 4 && parens.indexOf(t) !== -1 && t.length > pl) { pl = t.length; pb = loc; } }
    if (pb) return { id: pb.id, conf: 'low' };
  }
  const f = normAddr(raw);
  const fpost = (f.match(/\b(\d{3})\b/) || ['', ''])[1];
  let best = null, bestScore = 0;
  for (const loc of locations) {
    const k = siteKey(loc.heimilisfang);
    if (!k.stem || k.stem.length < 4) continue;
    let score = 0;
    if (f.indexOf(k.stem) !== -1) score += 3;                    // site street stem in filename
    if (k.post && fpost && k.post === fpost) score += 2;
    if (k.num && new RegExp('(?:^|\\D)' + k.num + '(?:\\D|$)').test(f)) score += 1;
    if (score > bestScore) { bestScore = score; best = loc; }
  }
  if (bestScore >= 4) return { id: best.id, conf: 'high' };      // street + postcode/number → trust
  if (bestScore >= 3) return { id: best.id, conf: 'low' };       // branch/street token only → verify
  return null;
}

// ── Writes ────────────────────────────────────────────────────────────────────
async function saveDoc(body) {
  const id = parseInt(body.id, 10);
  if (!id) throw new Error('vantar id');
  const patch = { found_by: 'manual' };
  if ('fyrirtaeki_id' in body) {
    patch.fyrirtaeki_id = body.fyrirtaeki_id === '' ? null : body.fyrirtaeki_id;
    // Staður valinn af manneskju → yfirferðarmerkið (needs_site, sett af
    // drive-multitool á fjölstaða-kt án sönnunar) hreinsast. Hreinsun á vali
    // (null) lætur merkið standa — skjalið er þá aftur staðar-laust.
    if (patch.fyrirtaeki_id != null) patch.needs_site = false;
  }
  if ('year' in body)         patch.year = body.year === '' ? null : parseInt(body.year, 10);
  if ('is_duplicate' in body) patch.is_duplicate = !!body.is_duplicate;
  // 2026-08-07 (Agnar): BRUNA-hakið á stöðinni — víxlar úttektarskýrslu ⇄
  // brunakerfi á skýrslu-röð. Hvítlisti því doc_type ber CHECK-reglu í grunni.
  if ('doc_type' in body && ['uttektarskyrsla', 'brunakerfi', 'reikningur', 'samningur'].includes(body.doc_type)) patch.doc_type = body.doc_type;
  if ('reviewed' in body)     { patch.reviewed = !!body.reviewed; patch.reviewed_at = body.reviewed ? new Date().toISOString() : null; }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${id}`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(patch),
  });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error('save ' + r.status + ' ' + JSON.stringify(rows).slice(0, 160));
  return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
}
async function patchDoc(id, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${id}`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('patch ' + r.status + ' ' + (await r.text()).slice(0, 120));
}

// ── Consolidate one rekstrarfélag: one report + one invoice per (site, year) ────
// Preview-first + reversible. Two steps, computed the SAME way for preview & apply:
//   1) RELINK — assign a site to docs where a HIGH-confidence address suggestion
//      exists (single-site company, or street+postcode match). Only fills null
//      links unless `overwrite` is set; a human-confirmed (reviewed) link is NEVER
//      overwritten. Distinct sites are kept apart — never merged.
//   2) DEDUP — within one resolved (site, year, doc_type) keep the best copy and
//      flag the rest `is_duplicate=true` (NOT deleted — undo = untick the box).
//      Grouping is per SITE, so a rekstrarfélag's different branches for the same
//      year are never collapsed — only true copies of the SAME branch/year.
async function consolidate(baseId, apply, overwrite) {
  baseId = parseInt(baseId, 10);
  if (!baseId) throw new Error('vantar base_id');
  const locations = await sbGet(`fyrirtaeki?customer_base_id=eq.${baseId}&select=id,nafn,heimilisfang&deleted_at=is.null`);
  const raw = await sbGet(`customer_documents?customer_base_id=eq.${baseId}&select=id,drive_file_id,doc_type,year,fyrirtaeki_id,is_duplicate,reviewed,notes,invoice_number`);

  const resolved = raw.map(d => {
    const sug = (locations.length === 1) ? { id: locations[0].id, conf: 'high' } : suggestLoc(d.notes || '', locations);
    let target = d.fyrirtaeki_id;
    const canWrite = sug && sug.conf === 'high';
    if (d.fyrirtaeki_id == null && canWrite) target = sug.id;                 // fill a gap
    else if (overwrite && !d.reviewed && canWrite) target = sug.id;          // overwrite an old (unconfirmed) link
    return { d, target };
  });

  const relink = resolved
    .filter(x => x.target != null && String(x.target) !== String(x.d.fyrirtaeki_id))
    .map(x => ({ id: x.d.id, from: x.d.fyrirtaeki_id, to: x.target }));

  // Dedup key differs by doc kind — this is the crux of "one per year":
  //   • úttektarskýrsla / samningur → ONE per (site, year). A site has a single
  //     annual inspection report per year, so 2+ are true copies.
  //   • reikningur → a company legitimately has MANY invoices per year (each a
  //     distinct R-number), so year is NOT a dup signal. The only real duplicate
  //     is the SAME invoice_number; invoices without an R-number are never grouped.
  const groups = {};
  resolved.forEach(x => {
    if (x.target == null || x.d.is_duplicate) return;
    let k;
    if (x.d.doc_type === 'reikningur') {
      if (!x.d.invoice_number) return;
      k = x.target + '|R|' + String(x.d.invoice_number).trim().toUpperCase();
    } else {
      if (x.d.year == null) return;
      k = x.target + '|' + x.d.year + '|' + x.d.doc_type;
    }
    (groups[k] = groups[k] || []).push(x.d);
  });
  const dups = [];
  for (const k in groups) {
    const arr = groups[k];
    if (arr.length < 2) continue;
    arr.sort((a, b) =>
      Number(!!b.reviewed) - Number(!!a.reviewed) ||                          // keep a confirmed one
      Number(!!b.drive_file_id) - Number(!!a.drive_file_id) ||                // keep one with a real file
      String(b.notes || '').length - String(a.notes || '').length ||          // keep the most complete name
      a.id - b.id);
    for (let i = 1; i < arr.length; i++) dups.push(arr[i].id);
  }

  if (!apply) return { sites: locations.length, relink_count: relink.length, dup_count: dups.length, relink, dups };

  for (const r of relink) await patchDoc(r.id, { fyrirtaeki_id: r.to, found_by: 'match-station-auto', needs_site: false });
  for (const id of dups) await patchDoc(id, { is_duplicate: true });
  return { ok: true, sites: locations.length, relinked: relink.length, duped: dups.length };
}

// Remove ONE customer_documents tracking row (e.g. a confirmed duplicate). The
// Drive file itself is untouched — re-indexing would bring the row back.
async function deleteDoc(body) {
  const id = parseInt(body.id, 10);
  if (!id) throw new Error('vantar id');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${id}`, {
    method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }),
  });
  if (!r.ok) throw new Error('delete ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return { ok: true };
}
async function addSite(body) {
  const baseId = parseInt(body.base_id, 10);
  if (!baseId) throw new Error('vantar base_id');
  const nafn = (body.nafn || '').trim(); if (!nafn) throw new Error('vantar nafn');
  const base = (await sbGet(`customers_base?id=eq.${baseId}&select=kennitala`))[0] || {};
  const row = { nafn, heimilisfang: (body.heimilisfang || '').trim() || null, customer_base_id: baseId, kennitala: base.kennitala || null, er_i_thjonustu: true };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify([row]),
  });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error('add-site ' + r.status + ' ' + JSON.stringify(rows).slice(0, 160));
  return { ok: true, site: Array.isArray(rows) ? rows[0] : null };
}
