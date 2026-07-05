// drive-sort.js — resilient, SLOW-&-STEADY "deep-scan & sort" for a messy Drive
// folder of mixed PDFs. Reads ONE (or a couple) file(s) per call with the
// reliable OCR reader, classifies it, and MOVES it immediately — so a freeze or
// timeout never loses more than the file in hand; the rest stay put and the next
// call continues. Resumable by design (sorted files leave `src`).
//
// Content reader: pdf-parse first, then Google-Drive OCR (copy → Google Doc →
// export text → delete) for the dkPlus/scanned PDFs pdf-parse can't decode. This
// is the reader that worked reliably.
//
// Per file (only Slökkvitæki-ISSUED documents, issuer kt 600508-0400, are kept):
//   • reikningur (has an R-number)     → rename → MASTER  (+ link customer_documents)
//   • úttektarskýrsla (report, no R-nr) → rename → REPORTS (+ link, doc_type uttektarskyrsla)
//   • a copy of an already-recorded doc → DUPES (delete folder)
//   • anything else (vendor invoice, mbox, other)     → OTHER (óflokkað)
//
//   GET /api/drive-sort?src=&master=&reports=&dupes=&other=[&limit=2][&rename=1][&dry=1][&recurse=1]
//        → process up to `limit` files; call repeatedly until done:true.
//   recurse (default ON): walk subfolders too — files anywhere in the tree get
//   sorted (each keeps its own parent, so moveFile lifts it out of its subfolder).
//   recurse=0 restores flat, direct-children-only behaviour.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';

// ── Drive ─────────────────────────────────────────────────────────────────────
const FOLDER_MIME = 'application/vnd.google-apps.folder';
function folderId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }
// List ALL direct children of one folder (paged), files AND subfolders.
async function listChildren(token, folder) {
  const out = []; let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,parents),nextPageToken',
      pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    out.push(...(d.files || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return out;
}
// Direct-children-only listing (recurse OFF) — the original behaviour.
async function listSome(token, folder, limit) {
  const kids = await listChildren(token, folder);
  return kids.filter(f => f.mimeType !== FOLDER_MIME).slice(0, Math.min(Math.max(limit, 1), 20));
}
// Walk the folder tree (BFS) and collect up to `limit` actual FILES (never
// folders), descending into subfolders. Each file keeps its real `parents`, so
// moveFile lifts it straight out of whichever subfolder it lives in. We stop as
// soon as we have `limit` files — the next call re-walks from the root and finds
// the rest (moved files have left the tree), keeping every call slow-&-steady.
async function collectFiles(token, root, limit) {
  const files = []; const queue = [root]; const seen = new Set();
  while (queue.length && files.length < limit) {
    const folder = queue.shift();
    if (seen.has(folder)) continue; seen.add(folder);
    const kids = await listChildren(token, folder);
    for (const c of kids) {
      if (c.mimeType === FOLDER_MIME) queue.push(c.id);
      else { files.push(c); if (files.length >= limit) break; }
    }
  }
  return files;
}
// True if ANY file remains anywhere in the tree (folders alone don't count).
// Returns on the first file found, so the near-done case is cheap.
async function anyFileLeft(token, root) {
  const queue = [root]; const seen = new Set();
  while (queue.length) {
    const folder = queue.shift();
    if (seen.has(folder)) continue; seen.add(folder);
    let kids; try { kids = await listChildren(token, folder); } catch (_) { return null; }
    for (const c of kids) {
      if (c.mimeType === FOLDER_MIME) queue.push(c.id);
      else return true;
    }
  }
  return false;
}
// DEEP-READ every file via Drive OCR (Google-Doc extraction) as the PRIMARY path
// — pdf-parse is unreliable on dkPlus PDFs (it returns garbage or empty, so the
// real "Reikningur / Skýrsla" wording is missed). pdf-parse is only a fallback if
// OCR yields nothing.
async function readContent(id, token) {
  let text = await driveOcr(id, token).catch(() => '');
  if ((text || '').replace(/\s/g, '').length >= 25) return text;
  try {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { const d = await pdf(Buffer.from(await r.arrayBuffer())); text = d ? (d.text || '') : ''; }
  } catch (_) {}
  return text;
}
async function driveOcr(id, token) {
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
async function moveFile(token, id, destFolder, fromParents, newName) {
  const params = new URLSearchParams({ addParents: destFolder, supportsAllDrives: 'true', fields: 'id' });
  if (fromParents) params.set('removeParents', fromParents);
  const body = newName ? JSON.stringify({ name: newName }) : '{}';
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?' + params, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body });
  if (!r.ok) throw new Error('move ' + r.status + ': ' + (await r.text()).slice(0, 160));
}

// ── parsing ───────────────────────────────────────────────────────────────────
function cleanStem(name) { return String(name || '').replace(/\.pdf$/i, '').trim(); }
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
function isSlokkviDoc(text, name) { return /600508-?0400|slökkvitæki ehf|slökkvitæki/i.test((text || '') + ' ' + (name || '')); }
// Is Slökkvitæki the ISSUER (seller) of this document — not merely a party on it?
// A vendor invoice carries Slökkvitæki's kt as the BUYER and the generic e-invoice
// footer "reglugerð 505/2013" (which is NOT Slökkvitæki-specific), so neither is
// safe. The reliable seller-only signal is Slökkvitæki's own VSK number (98107) —
// a buyer's VSK is never printed on an invoice — plus the report sign-off lines.
// If none are present → treat as vendor/other (óflokkað).
function slokkviIssuer(text) {
  return /VSK\s*nr\.?\s*:?\s*98107|fyrir\s+h[öo]nd\s+sl[öo]kkvit[æa]ki|verktaki:?\s*sl[öo]kkvit[æa]ki|yfirfarin\s+af\s+sl[öo]kkvit[æa]ki/i.test(text || '');
}
// A Slökkvitæki-ISSUED inspection report (úttektarskýrsla or brunaviðvörunarkerfi
// viðtökupróf). Matches the real wording seen in the PDFs — both the extinguisher
// report ("Skýrsla vegna úttektar … Fyrir hönd Slökkvitæki ehf") and the alarm
// report ("Viðtökupróf/Árleg prófun … Verktaki: Slökkvitæki ehf"). These phrases
// mark Slökkvitæki as the ISSUER, so vendor invoices (Slökkvitæki only the buyer)
// do NOT match.
function isReport(text) {
  return /úttektarsk[ýy]rsla|sko[ðd]unarsk[ýy]rsla|sk[ýy]rsla\s+vegna\s+[úu]ttektar|[úu]ttekt\w*\s+á\s+(brunasl[öo]ng|sl[öo]kkvit|handsl[öo]kkvit)|yfirfarin\s+af\s+sl[öo]kkvit[æa]ki|fyrir\s+h[öo]nd\s+sl[öo]kkvit[æa]ki|verktaki:?\s*sl[öo]kkvit[æa]ki|vi[ðd]t[öo]kupr[óo]f|árleg\w*\s+pr[óo]fun|árssko[ðd]un|brunavi[ðd]v[öo]runarkerfi/i.test(text || '');
}
function invNum(text, name) {
  // An explicit R-number in the (renamed) file name.
  let m = String(name).match(/\bR[\s\-_]?(\d{5,7})\b/i); if (m) return 'R-' + m[1];
  // dkPlus header: "Reikningur\n\n107910 …" / "Kreditreikningur … 1xxxxx" — the
  // 6-digit invoice number (1xxxxx) right after the header word. Anchored to the
  // header so it never grabs Raðnr (9666) or VSK nr (98107); this is only reached
  // once slokkviIssuer() confirmed Slökkvitæki issued the doc, so a bare vendor
  // number can't slip in.
  m = String(text).match(/(?:kredit)?reikningur\s*(?:nr\.?\s*:?\s*)?(1\d{5})\b/i); if (m) return 'R-' + m[1];
  m = String(text).match(/Reikningur\s*nr\.?\s*:?\s*(\d{4,7})\b/i); if (m) return 'R-' + m[1];
  return '';
}
function yearFrom(s) {
  let m = String(s).match(/^(\d{4})-\d{2}-\d{2}/); if (m) return parseInt(m[1], 10);   // filename date prefix
  m = String(s).match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m) return 2000 + parseInt(m[1], 10);
  m = String(s).match(/\b(20\d{2})\b/); return m ? parseInt(m[1], 10) : null;
}
function totalFrom(text) {
  const kw = text.match(/Til\s*greiðslu\s*:?\s*(?:kr\.?)?\s*([\d.]{4,})/i); let best = 0;
  if (kw) { const n = parseInt(kw[1].replace(/\./g, ''), 10); if (Number.isFinite(n)) best = n; }
  const re = /\b\d{1,3}(?:\.\d{3})+\b/g; let m; while ((m = re.exec(text))) { const n = parseInt(m[0].replace(/\./g, ''), 10); if (n > best) best = n; }
  return best || null;
}
function companyFrom(text, name) {
  const segs = cleanStem(name).split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
  const first = segs.find(s => s && !/^\d{4}-\d{2}-\d{2}$/.test(s) && !/^(bokhald|nóta|nota|kredit|reikningur|invoice|creditnote)$/i.test(s) && !/^R[\s\-_]?\d{4,7}$/i.test(s) && !/^\d{6}-?\d{4}$/.test(s));
  if (first && /[A-Za-zÁÉÍÓÚÝÆÖÞÐ]/.test(first)) return first.replace(/_/g, ' ').trim();
  return '';
}
const dash = kt => (kt && kt.length === 10) ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;
function fmtIsk(n) { return n == null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function sanitize(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim(); }
function nameInvoice(co, ktd, inv, yr, tot) { return [sanitize(co) || 'Óþekkt', ktd || '', inv || '', yr || '', (tot != null ? fmtIsk(tot) + ' kr' : '')].filter(Boolean).join(' - ') + '.pdf'; }
function nameReport(co, ktd, yr) { return [sanitize(co) || 'Óþekkt', ktd || '', 'úttektarskýrsla', yr || ''].filter(Boolean).join(' - ') + '.pdf'; }

// ── Supabase ──────────────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function invoiceKnown(invNo) {
  if (!invNo) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&invoice_number=eq.${encodeURIComponent(invNo)}&drive_file_id=not.is.null&select=id&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []); return Array.isArray(rows) && rows.length > 0;
}
async function reportKnown(baseId, year) {
  if (!baseId || !year) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.uttektarskyrsla&customer_base_id=eq.${baseId}&year=eq.${year}&drive_file_id=not.is.null&select=id&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []); return Array.isArray(rows) && rows.length > 0;
}
async function matchBase(kt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
async function upsertDoc(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?on_conflict=drive_file_id`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('upsert ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

// ── classify + act ────────────────────────────────────────────────────────────
async function handleFile(token, f, dest, opts) {
  const from = (f.parents || []).join(',');
  const isPdf = /pdf/i.test(f.mimeType || '') || /\.pdf$/i.test(f.name || '');
  if (!isPdf) { if (!opts.dry) await moveFile(token, f.id, dest.other, from, null); return { name: f.name, action: 'other', reason: 'ekki PDF' }; }

  const text = await readContent(f.id, token);
  // Only docs ISSUED BY Slökkvitæki are ours. Filenames lie ("Nóta-…" is often a
  // real reikningur; a vendor "…slökkvitæki.pdf" is not ours) — so this is decided
  // purely from the OCR'd content. Vendor bókhald / Nóta / payslips (where
  // Slökkvitæki is only the buyer) → óflokkað.
  if (!slokkviIssuer(text)) { if (!opts.dry) await moveFile(token, f.id, dest.other, from, null); return { name: f.name, action: 'other', reason: 'ekki Slökkvitæki-útgefið' }; }

  const kt = customerKt(text) || customerKt(f.name);
  const ktd = kt ? dash(kt) : '';
  const inv = invNum(text, f.name);
  const year = yearFrom(f.name) || yearFrom(text);
  let base = null; if (kt) { try { base = await matchBase(kt); } catch (_) {} }
  const coName = (base && base.nafn) || companyFrom(text, f.name) || '';

  // úttektarskýrsla (report) — Slökkvitæki-issued, report wording, no R-number
  if (!inv && isReport(text)) {
    if (base && await reportKnown(base.id, year)) { if (!opts.dry) await moveFile(token, f.id, dest.dupes, from, null); return { name: f.name, action: 'dupes', reason: 'skýrsla þegar til', year }; }
    const nn = opts.rename ? nameReport(coName, ktd, year) : null;
    if (!opts.dry) {
      await moveFile(token, f.id, dest.reports, from, nn);
      try { await upsertDoc({ customer_base_id: base ? base.id : null, doc_type: 'uttektarskyrsla', year: year || null, drive_file_id: f.id, source: 'gdrive', found_by: 'drive-sort', invoice_number: null, doc_date: null, customer_name: coName || null, notes: (coName || '') + ' · úttektarskýrsla' + (year ? (' ' + year) : '') + (kt ? (' · kt ' + ktd) : '') + (base ? '' : ' · RESOLVE') }); } catch (_) {}
    }
    return { name: f.name, action: 'reports', newName: nn, year, base_id: base ? base.id : null, base_name: base ? base.nafn : null };
  }

  // reikningur
  if (inv) {
    if (await invoiceKnown(inv)) { if (!opts.dry) await moveFile(token, f.id, dest.dupes, from, null); return { name: f.name, action: 'dupes', reason: 'reikningur þegar til', invoice_number: inv }; }
    const tot = totalFrom(text);
    const nn = opts.rename ? nameInvoice(coName, ktd, inv, year, tot) : null;
    if (!opts.dry) {
      await moveFile(token, f.id, dest.master, from, nn);
      try { await upsertDoc({ customer_base_id: base ? base.id : null, doc_type: 'reikningur', year: year || null, drive_file_id: f.id, source: 'gdrive', found_by: 'drive-sort', amount: tot || null, invoice_number: inv, doc_date: null, customer_name: coName || null, notes: (coName || '') + ' · ' + inv + (kt ? (' · kt ' + ktd) : '') + (base ? '' : ' · RESOLVE') }); } catch (_) {}
    }
    return { name: f.name, action: 'master', newName: nn, invoice_number: inv, base_id: base ? base.id : null, base_name: base ? base.nafn : null };
  }

  // Slökkvitæki-ish but neither a clear invoice nor report → óflokkað for review
  if (!opts.dry) await moveFile(token, f.id, dest.other, from, null);
  return { name: f.name, action: 'other', reason: 'óviss (Slökkvitæki en hvorki reikn. né skýrsla)' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    const p = event.queryStringParameters || {};
    const src = folderId(p.src);
    const dest = { master: folderId(p.master), reports: folderId(p.reports), dupes: folderId(p.dupes), other: folderId(p.other) };
    if (!src) return json(400, { error: 'src required' });
    if (!dest.master || !dest.dupes || !dest.other) return json(400, { error: 'master, dupes and other folders required' });
    if (!dest.reports) dest.reports = dest.other;   // reports → óflokkað if no reports folder given
    const limit = Math.min(Math.max(parseInt(p.limit || '1', 10) || 1, 1), 5);
    const recurse = p.recurse !== '0' && p.recurse !== 'false';   // default ON — also read subfolders
    const opts = { rename: p.rename !== '0' && p.rename !== 'false', dry: p.dry === '1' || p.dry === 'true' };
    const token = await freshAccessToken();

    const files = recurse ? await collectFiles(token, src, limit) : await listSome(token, src, limit);
    const results = []; const tally = { master: 0, reports: 0, dupes: 0, other: 0, error: 0 };
    for (const f of files) {
      try { const r = await handleFile(token, f, dest, opts); results.push(r); tally[r.action] = (tally[r.action] || 0) + 1; }
      catch (e) { results.push({ name: f.name, action: 'error', error: String(e.message || e) }); tally.error++; }
    }
    // done = no files left to sort. In dry mode we don't move, so "done" just
    // means this scan found nothing. Live mode re-walks the tree (recurse) or the
    // root (flat) to see if anything remains.
    let left;
    if (opts.dry) left = files.length ? 1 : 0;
    else left = recurse ? (await anyFileLeft(token, src) ? 1 : 0) : (await listSome(token, src, 1)).length;
    return json(200, { processed: files.length, tally, results, done: (left === 0), recurse, dry: opts.dry });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
