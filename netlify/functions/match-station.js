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
// Pure Supabase REST — no Google Drive, no PDF parsing. Safe + always-on.

const { json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
      if (body.action === 'save')     return json(200, await saveDoc(body));
      if (body.action === 'delete')   return json(200, await deleteDoc(body));
      if (body.action === 'add-site') return json(200, await addSite(body));
      return json(400, { error: 'unknown action' });
    }
    const p = event.queryStringParameters || {};
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
    docs.push(...await sbGet(`customer_documents?customer_base_id=in.${inList(baseIds.slice(i, i + 200))}&select=customer_base_id,fyrirtaeki_id,is_duplicate,reviewed,doc_type`));

  const agg = {};
  baseIds.forEach(id => { agg[id] = { base_id: id, nafn: (baseById[id] || {}).nafn || ('#' + id), kennitala: (baseById[id] || {}).kennitala || '', locations: 0, docs: 0, reviewed: 0, unmatched: 0, dups: 0 }; });
  locs.forEach(l => { if (agg[l.customer_base_id]) agg[l.customer_base_id].locations++; });
  docs.forEach(d => {
    const a = agg[d.customer_base_id]; if (!a) return;
    a.docs++;
    if (d.reviewed) a.reviewed++;
    if (d.is_duplicate) a.dups++;
    else if (d.fyrirtaeki_id == null) a.unmatched++;
  });
  // most work first: unconfirmed-but-present, then by name
  const companies = Object.values(agg).sort((x, y) =>
    (y.docs - y.reviewed) - (x.docs - x.reviewed) || x.nafn.localeCompare(y.nafn, 'is'));
  return { companies };
}

// ── One company: its sites + every report, with a (non-authoritative) suggestion ─
async function companyDetail(baseId) {
  baseId = parseInt(baseId, 10);
  const base = (await sbGet(`customers_base?id=eq.${baseId}&select=id,nafn,kennitala`))[0] || { id: baseId, nafn: '#' + baseId, kennitala: '' };
  const locations = await sbGet(`fyrirtaeki?customer_base_id=eq.${baseId}&select=id,nafn,heimilisfang,er_i_thjonustu&deleted_at=is.null&order=heimilisfang`);
  const raw = await sbGet(`customer_documents?customer_base_id=eq.${baseId}&select=id,drive_file_id,doc_type,year,fyrirtaeki_id,is_duplicate,reviewed,notes,doc_date,amount,invoice_number`);

  const docs = raw.map(d => {
    const filename = String(d.notes || '').split(' · ')[0] || '(óþekkt skrá)';
    const sug = suggestLoc(filename, locations);
    return {
      id: d.id,
      drive_file_id: d.drive_file_id || null,
      view_url: d.drive_file_id ? `https://drive.google.com/file/d/${d.drive_file_id}/view` : null,
      doc_type: d.doc_type, year: d.year, fyrirtaeki_id: d.fyrirtaeki_id,
      is_duplicate: !!d.is_duplicate, reviewed: !!d.reviewed,
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

  return { company: base, locations, docs };
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
  if ('fyrirtaeki_id' in body) patch.fyrirtaeki_id = body.fyrirtaeki_id === '' ? null : body.fyrirtaeki_id;
  if ('year' in body)         patch.year = body.year === '' ? null : parseInt(body.year, 10);
  if ('is_duplicate' in body) patch.is_duplicate = !!body.is_duplicate;
  if ('reviewed' in body)     { patch.reviewed = !!body.reviewed; patch.reviewed_at = body.reviewed ? new Date().toISOString() : null; }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${id}`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(patch),
  });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error('save ' + r.status + ' ' + JSON.stringify(rows).slice(0, 160));
  return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
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
