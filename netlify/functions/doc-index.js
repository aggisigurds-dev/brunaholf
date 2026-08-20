// doc-index.js — server-side Google Drive → customer_documents indexer.
// The web-runnable form of the luna-bridge doc-indexer: a button in the
// brunahólf Verkfæri panel calls this to connect Slökkvitæki invoices /
// úttektarskýrslur to customers without any desktop script.
//
//   GET /api/doc-index?folder=FOLDER_ID[&dry=1][&limit=N]
//     → { scanned, indexed, dupSkip, notSlokkvitaeki, noKt, errors,
//         unmatched:[{file,kt,doc_type,year}], added:[…] }
//
// For each PDF in the folder it: reads the text, REQUIRES the Slökkvitæki
// issuer kt (600508-0400) so vendor invoices are skipped, takes the customer
// kt (the non-issuer kt), classifies, matches kt→customers_base, and upserts
// customer_documents (deduped on drive_file_id). dry=1 reports without writing.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');
const { sitesByBases, sitesForBase, resolveSite, siteWriteAllowed, vidskiptategundSkjals } = require('./_spine');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEFAULT_FOLDER = '1ApVH4kzbZ4SmwXsLtFqUOn3hotSNECTk';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  // ── Editable match: relink / unlink a doc, or create the missing customer ────
  if (event.httpMethod === 'POST') {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
    try {
      if (body.action === 'set-link') {
        if (!body.drive_file_id) return json(400, { error: 'vantar drive_file_id' });
        await updateDocLink(body.drive_file_id, body.base_id || null, body);
        return json(200, { ok: true, base_id: body.base_id || null });
      }
      if (body.action === 'create') {
        if (!body.kt) return json(400, { error: 'vantar kennitölu' });
        const baseId = await createCompany(body);
        if (body.drive_file_id) await updateDocLink(body.drive_file_id, baseId, body);
        return json(200, { ok: true, base_id: baseId, nafn: body.customer_name || '' });
      }
      if (body.action === 'relink') {   // bulk: re-link many docs to the company matching the filename kt
        const items = Array.isArray(body.items) ? body.items : [];
        let done = 0, errors = 0;
        for (const it of items) {
          if (!it || !it.drive_file_id || !it.base_id) continue;
          try { await updateDocLink(it.drive_file_id, it.base_id, { doc_type: it.doc_type, year: it.year, customer_name: it.toName, site_id: it.site_id }); done++; }
          catch (e) { errors++; }
        }
        return json(200, { done, errors });
      }
    } catch (e) { return json(500, { error: String(e.message || e) }); }
    return json(400, { error: 'unknown action' });
  }

  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const dry = p.dry === '1' || p.dry === 'true';
  // Process one bounded batch per call (each PDF download+parse takes time, and
  // a function invocation has ~10s). The caller pages through with `offset`.
  const limit = Math.min(parseInt(p.limit || '8', 10) || 8, 50);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  // ── Audit: which docs are linked to the WRONG company (by filename kt) ────────
  if (p.audit === '1') {
    try { return json(200, await auditLinks(folder, token)); }
    catch (e) { return json(500, { error: String(e.message || e) }); }
  }

  const stats = {
    folder, dry, scanned: 0, indexed: 0, dupSkip: 0,
    notSlokkvitaeki: 0, noKt: 0, errors: 0, unmatched: [], added: [],
  };

  try {
    const files = await listPdfs(folder, token);
    stats.total = files.length;
    stats.offset = offset;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        const existing = await existingDoc(f.id);
        if (existing && existing.customer_base_id) { stats.dupSkip++; continue; }   // already linked → leave it
        const text = await readPdfText(f.id, token);
        const norm = (text || '').replace(/\s+/g, ' ');
        const ktName = customerKtFromName(f.name);
        const hasIssuer = norm.replace(/\D/g, '').indexOf(ISSUER_KT) !== -1;
        // Trust a canonical Slökkvitæki filename when the PDF text can't be read (scanned
        // reports): a customer kt in the name + a report/invoice signature in the name.
        const nameVouches = !!ktName && (nameIsReport(f.name) || nameIsInvoice(f.name));
        if (!hasIssuer && !nameVouches) { stats.notSlokkvitaeki++; continue; }
        const kt = customerKt(norm) || ktName;
        if (!kt) { stats.noKt++; continue; }
        const doc_type = classifyDoc(norm, f.name);
        const year = extractYear(norm) || yearFromName(f.name);
        const amount = doc_type === 'reikningur' ? extractAmount(norm) : null;
        const base = await matchBase(kt);
        const company = companyName(f.name, norm);
        // Tengireglan (_spine): staðurinn AÐEINS með sönnun (stimpill/einn staður/
        // heimilisfang í skráarheiti) — annars fyrirtaeki_id ósnert, aldrei giskað.
        let site = null;
        if (base) { try { site = resolveSite(f.name, await sitesForBase(base.id)); } catch (_) {} }
        const rec = { file: f.name, drive_file_id: f.id, kt: dash(kt), company, doc_type, year, base_id: base ? base.id : null, base_name: base ? base.nafn : null, site_id: site ? site.id : null, site_name: site ? site.nafn : null };
        if (!base) stats.unmatched.push(rec);
        if (!dry) {
          const siteOk = site && await siteWriteAllowed(f.id, site);
          if (existing) { if (base) await updateDocLink(f.id, base.id, { doc_type, year, customer_name: company, site_id: siteOk ? site.id : null }); }  // backlog row now resolvable
          else await insertDoc({
            customer_base_id: base ? base.id : null,
            fyrirtaeki_id: siteOk ? site.id : null,
            doc_type, year, drive_file_id: f.id, source: 'gdrive', found_by: 'code', amount,
            // vidskiptategund (Pakki 8): stimpluð við innlestur — sala → línur
            // (PDF-textinn) → búðarmappa (mappan sem verið er að skanna) → ovisst.
            vidskiptategund: doc_type === 'reikningur'
              ? await vidskiptategundSkjals({ text: norm, folderIds: [folder] }).catch(() => 'ovisst')
              : undefined,
            notes: f.name.replace(/\.pdf$/i, '') + ' · kt ' + dash(kt) + (base ? '' : ' · RESOLVE'),
          });
        }
        stats.indexed++;
        stats.added.push(rec);
      } catch (e) { stats.errors++; }
    }
    stats.processed = slice.length;
    stats.nextOffset = (offset + slice.length < files.length) ? offset + slice.length : null;
  } catch (e) {
    return json(500, { error: e.message, stats });
  }
  return json(200, stats);
};

// ── Drive ────────────────────────────────────────────────────────────────────
// Walk the folder TREE (BFS) — the master folders are now organised into <ár>/
// subfolders, so a direct-children-only listing would find nothing to index.
async function listPdfs(folder, token) {
  const out = [], queue = [folder], seen = new Set();
  while (queue.length) {
    const fid = queue.shift();
    if (seen.has(fid)) continue; seen.add(fid);
    let pageToken = null;
    do {
      const params = new URLSearchParams({
        q: `'${fid.replace(/'/g, "\\'")}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType),nextPageToken',
        pageSize: '200', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Drive list ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const d = await r.json();
      for (const f of (d.files || [])) {
        if (f.mimeType === 'application/vnd.google-apps.folder') { queue.push(f.id); continue; }
        if (/pdf$/i.test(f.name) || f.mimeType === 'application/pdf') out.push(f);
      }
      pageToken = d.nextPageToken;
    } while (pageToken);
  }
  return out;
}
async function readPdfText(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const d = await pdf(buf).catch(() => null);
  let text = d ? d.text : '';
  // pdf-parse returns empty on some scanned/dkPlus layouts — fall back to a clean
  // Google-Docs text extraction (copy → export text/plain → delete) like the renamers.
  if ((text || '').replace(/\s/g, '').length < 25) {
    const viaG = await driveExtractText(id, token).catch(() => '');
    if (viaG && viaG.replace(/\s/g, '').length >= 25) text = viaG;
  }
  return text || null;
}
async function driveExtractText(id, token) {
  const cp = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-ocr-' + id, mimeType: 'application/vnd.google-apps.document' }),
  });
  if (!cp.ok) return '';
  const doc = await cp.json(); if (!doc || !doc.id) return '';
  let text = '';
  try { const ex = await fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: `Bearer ${token}` } }); if (ex.ok) text = await ex.text(); } catch (_) {}
  fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  return text;
}

// ── Extraction ───────────────────────────────────────────────────────────────
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
// Fallback: older reports carry no customer kt in the text — but the Skjalaheiti renamer
// wrote it into the filename ("… - 540994-2269 - febrúar - 2023.pdf"). Use that.
function customerKtFromName(name) { for (const kt of allKts(String(name || ''))) if (kt !== ISSUER_KT) return kt; return null; }
function classify(s) {
  if (/skýrsla\s+vegna\s+úttektar|úttektarskýrsl|uttektarskyrsl/i.test(s)) return 'uttektarskyrsla';
  if (/þjónustusamning|þjonustusamning/i.test(s)) return 'samningur';
  return 'reikningur';
}
// Filename signatures — used to trust + classify scanned PDFs whose text won't read.
function nameIsInvoice(name) { const n = String(name || ''); return /\bR[\s_-]?\d{5,7}\b/i.test(n) || /kredit/i.test(n); }
function nameIsReport(name) { const n = String(name || ''); return (/\b(janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember)\b/i.test(n) && /\b20\d{2}\b/.test(n)) || /úttekt|skýrsl|viðtökupróf|árleg prófun/i.test(n); }
function classifyDoc(s, name) {
  if (s && s.replace(/\s/g, '').length > 30) return classify(s);   // content readable → trust it
  if (nameIsInvoice(name)) return 'reikningur';                    // else fall back to the filename
  if (/samning/i.test(String(name || ''))) return 'samningur';
  return 'uttektarskyrsla';
}
// 2026-08-07: kennitala burt ÁÐUR en ártal er lesið, og þak á árið — sama og
// drive-sort/drive-multitool fengu. Alvarlegast hér af öllum fimm stöðunum því
// `year` héðan er SKRIFAÐ beint í customer_documents (sjá :299), svo röng lesning
// býr til röð undir röngu ári sem þekjan telur svo með. Kt endar oft á gildu
// ártali — Tor ehf er 471195-2009 og hefði lesist sem árið 2009.
// `_` telst sem bil, sbr. drive-count.js.
const stripKt = (s) => String(s || '').replace(/(?<!\d)\d{6}\s?-?\s?\d{4}(?!\d)/g, ' ').replace(/_/g, ' ');
const sane = (y) => (y >= 2008 && y <= new Date().getFullYear() + 1) ? y : null;
function yearFromName(name) { const m = stripKt(name).match(/\b(20\d{2})\b/); return m ? sane(parseInt(m[1], 10)) : null; }
function extractYear(s) {
  let m = String(s).match(/\b\d{2}\.\d{2}\.(\d{2})\b/); if (m) return sane(2000 + parseInt(m[1], 10));
  m = stripKt(s).match(/\b(20\d{2})\b/); if (m) return sane(parseInt(m[1], 10));
  return null;
}
function extractAmount(s) {
  const m = s.match(/til\s+greiðslu\s*:?\s*([\d.]+)/i); if (!m) return null;
  const n = parseInt(m[1].replace(/\./g, ''), 10); return Number.isFinite(n) ? n : null;
}
const dash = kt => kt.length === 10 ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;

// ── Supabase REST ────────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function existingDoc(driveFileId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(driveFileId)}&select=id,customer_base_id&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
// Company name for display / "+ stofna": prefer the name the renamer put in the file
// ("Fyrirtæki - kt - …"), else pull it from the report content (both report layouts).
function companyName(name, text) {
  const fn = String(name || '').replace(/\.pdf$/i, '');
  let m = fn.match(/^(.+?)\s+-\s+\d{6}-?\d{4}\b/);
  if (m && !/^\d/.test(m[1].trim())) return m[1].trim();
  m = String(text || '').match(/Verkkaupi\s+(.+?)\s+Kennitala/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  m = String(text || '').match(/hjá\s+fyrirt(?:æki|aeki)nu\s+(.+?)\s+[A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð.\-]*\s+\d/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  return '';
}
async function updateDocLink(fid, baseId, meta) {
  // site_id (fyrirtaeki_id) fylgir með þegar staðurinn er ÓTVÍRÆÐUR (stimpill/
  // heimilisfang/einn staður) — annars er hann EKKI snertur (aldrei giskað,
  // aldrei skrifað yfir rétta stað-tengingu með engu).
  const patch = { customer_base_id: baseId, found_by: 'manual' };
  if (meta && meta.site_id != null) patch.fyrirtaeki_id = meta.site_id;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(fid)}`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error('update ' + r.status + ' ' + JSON.stringify(rows).slice(0, 160));
  if (Array.isArray(rows) && rows.length) return;            // existing row updated
  if (meta && meta.doc_type) {                               // only dry-read so far → insert one
    await insertDoc({ customer_base_id: baseId, fyrirtaeki_id: (meta.site_id != null ? meta.site_id : null), doc_type: meta.doc_type, year: meta.year || null, drive_file_id: fid, source: 'gdrive', found_by: 'manual', notes: (meta.customer_name || '') + ' · handvirkt' });
  }
}
async function createCompany(body) {
  const ktDash = dash(String(body.kt).replace(/\D/g, ''));
  const nafn = (body.customer_name || '').trim() || ktDash;
  let baseId = null;
  const ex = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(ktDash)}&select=id&limit=1`, { headers: sbHeaders() });
  const exRows = await ex.json().catch(() => []);
  if (Array.isArray(exRows) && exRows[0]) baseId = exRows[0].id;
  if (!baseId) {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/customers_base`, { method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify([{ nafn, kennitala: ktDash }]) });
    const insRows = await ins.json().catch(() => []);
    if (!ins.ok) throw new Error('customers_base ' + ins.status + ' ' + JSON.stringify(insRows).slice(0, 160));
    baseId = (Array.isArray(insRows) && insRows[0]) ? insRows[0].id : null;
  }
  try {   // service-branch row in fyrirtaeki, idempotent on kt
    const fx = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?kennitala=eq.${encodeURIComponent(ktDash)}&select=id&limit=1`, { headers: sbHeaders() });
    const fxRows = await fx.json().catch(() => []);
    if (!(Array.isArray(fxRows) && fxRows[0])) {
      await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki`, { method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify([{ nafn, kennitala: ktDash, customer_base_id: baseId, heimilisfang: body.address || null }]) });
    }
  } catch (e) {}
  return baseId;
}
async function matchBase(kt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}

// ── Audit: compare each file's filename-kt to the company it's actually linked to ──
// Staðar-upplausn (2026-07-15): kt ein dugar EKKI fyrir rekstrarfélög — tengireglan
// (stimpill → einn staður → heimilisfang → annars ekkert) lifir nú í ./_spine.js
// og er notuð af öllum tengjurum (doc-index, reikningar-read, samningar-read,
// drive-sort). Aldrei giskað.

async function auditLinks(folder, token) {
  const files = await listPdfs(folder, token);
  const rows = files.map(f => { const k = customerKtFromName(f.name); return { fid: f.id, name: f.name, kt: k ? dash(k) : null }; });
  const ktToBase = await basesByKts([...new Set(rows.map(r => r.kt).filter(Boolean))]);
  const sitesMap = await sitesByBases(Object.values(ktToBase).map(b => b.id));
  const fidToDoc = await docsByFids(rows.map(r => r.fid));
  const idToName = await namesByIds([...new Set(Object.values(fidToDoc).map(d => d.customer_base_id).filter(x => x != null).map(String))]);
  const out = { total: files.length, correct: 0, noKt: 0, mismatched: [], toLink: [], noBase: [], list: [] };
  for (const r of rows) {
    const meta = { doc_type: classifyDoc('', r.name), year: yearFromName(r.name) };
    const doc = fidToDoc[r.fid];
    const curName = (doc && doc.customer_base_id != null) ? (idToName[String(doc.customer_base_id)] || ('#' + doc.customer_base_id)) : null;
    const base = { file: r.name, drive_file_id: r.fid, kt: r.kt, company: companyName(r.name, ''), doc_type: meta.doc_type, year: meta.year, base_id: (doc ? doc.customer_base_id : null), base_name: curName };
    if (!r.kt) { out.noKt++; out.list.push(Object.assign(base, { status: 'nokt' })); continue; }
    const correct = ktToBase[r.kt];
    if (!correct) { out.noBase.push({ file: r.name, kt: r.kt }); out.list.push(Object.assign(base, { status: 'nobase' })); continue; }
    const site = resolveSite(r.name, sitesMap[String(correct.id)]);
    const siteMeta = site ? { site_id: site.id, site_name: site.nafn } : {};
    if (!doc) { out.toLink.push(Object.assign({ file: r.name, drive_file_id: r.fid, toName: correct.nafn, base_id: correct.id }, meta, siteMeta)); out.list.push(Object.assign(base, { status: 'unlinked', correctBaseId: correct.id, correctName: correct.nafn }, siteMeta)); continue; }
    if (String(doc.customer_base_id) === String(correct.id)) { out.correct++; out.list.push(Object.assign(base, { status: 'correct', correctBaseId: correct.id, correctName: correct.nafn }, siteMeta)); continue; }
    out.mismatched.push(Object.assign({ file: r.name, drive_file_id: r.fid, fromName: curName || '(ótengt)', toName: correct.nafn, base_id: correct.id }, meta, siteMeta));
    out.list.push(Object.assign(base, { status: 'wrong', correctBaseId: correct.id, correctName: correct.nafn }));
  }
  return out;
}
async function basesByKts(kts) {
  const map = {};
  for (let i = 0; i < kts.length; i += 150) {
    const inList = kts.slice(i, i + 150).map(k => '"' + k + '"').join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=in.(${encodeURIComponent(inList)})&select=id,nafn,kennitala`, { headers: sbHeaders() });
    (await r.json().catch(() => [])).forEach(b => { if (!map[b.kennitala]) map[b.kennitala] = { id: b.id, nafn: b.nafn }; });
  }
  return map;
}
async function docsByFids(fids) {
  const map = {};
  for (let i = 0; i < fids.length; i += 150) {
    const inList = fids.slice(i, i + 150).map(k => '"' + k + '"').join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=in.(${encodeURIComponent(inList)})&select=drive_file_id,customer_base_id`, { headers: sbHeaders() });
    (await r.json().catch(() => [])).forEach(d => { map[d.drive_file_id] = { customer_base_id: d.customer_base_id }; });
  }
  return map;
}
async function namesByIds(ids) {
  const map = {};
  for (let i = 0; i < ids.length; i += 150) {
    const inList = ids.slice(i, i + 150).join(',');
    if (!inList) continue;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?id=in.(${encodeURIComponent(inList)})&select=id,nafn`, { headers: sbHeaders() });
    (await r.json().catch(() => [])).forEach(b => { map[String(b.id)] = b.nafn; });
  }
  return map;
}
async function insertDoc(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('insert ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
