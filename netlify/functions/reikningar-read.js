// reikningar-read.js — Bakendi "Reikningalesari": reads the SENT Slökkvitæki
// invoice PDFs in a Drive folder and extracts, per invoice:
//   Fyrirtækjanafn · Heimilisfang · Kennitala · Reikningsnúmer (R-108285) ·
//   Dagsetning · Heildarupphæð
//
//   GET /api/reikningar-read?folder=ID[&dry=1][&limit=6][&offset=N]
//
// Filename-led: the renamer writes "Fyrirtæki - R NNNNNN - DD.MM.YY.pdf", which
// is the reliable source for company / invoice number / date (the dkPlus PDF
// text interleaves two columns, so content regexes grab the wrong number). PDF
// content gives the customer kt + heildarupphæð, and fills gaps for unrenamed
// "Nóta-…" exports. Kreditreikningar are detected and tagged (doc_type
// 'kreditreikningur' so they don't inflate the reikningur counter). Batched by
// `offset`; non-dry upserts customer_documents (dedup on drive_file_id).

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEFAULT_FOLDER = '1TDusB2NLhr-OMLnojSk3iw0oiuiuFMLM'; // slökkvitæki - Reikningar - Master

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const dry = p.dry === '1' || p.dry === 'true';
  const limit = Math.min(parseInt(p.limit || '6', 10) || 6, 12);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const stats = { folder, dry, scanned: 0, indexed: 0, dupSkip: 0, notInvoice: 0, errors: 0, rows: [] };

  try {
    const files = await listPdfs(folder, token);
    stats.total = files.length;
    stats.offset = offset;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        const text = await readPdfText(f.id, token);
        const norm = (text || '').replace(/\s+/g, ' ');

        const fn = parseFilename(f.name);                       // {company,number,date,kredit}
        const kredit = fn.kredit || /kredit\s*reikning|kreditreikning/i.test(norm);
        let kt = customerKt(norm) || customerKtFromName(f.name);
        const base = kt ? await matchBase(kt) : null;

        const invoice_number = fn.number || extractInvoiceNumberText(text);
        const date = fn.date || extractDate(text);
        const year = date ? parseInt(date.slice(0, 4), 10) : extractYear(norm);
        const total = extractTotal(text);
        // Company: the matched customer's canonical name first (so messy file
        // stems like "X_reikn_106883_05-2025" become the real name), then the
        // clean filename segment, then the PDF bill-to block.
        const company = (base && base.nafn) || fn.company || extractCompanyText(text) || '';
        const address = extractAddress(text, f.name, kt);

        // Need at least one real signal to count it as an invoice.
        if (!kt && !invoice_number && !total) { stats.notInvoice++; continue; }

        const row = {
          fileId: f.id, file: f.name,
          company, address, kt: kt ? dash(kt) : '', invoice_number,
          date, total, year, kredit,
          base_id: base ? base.id : null, base_name: base ? base.nafn : null,
        };
        stats.rows.push(row);

        if (!dry) {
          if (await alreadyIndexed(f.id)) { stats.dupSkip++; }
          await upsertDoc({
            customer_base_id: base ? base.id : null,
            doc_type: kredit ? 'kreditreikningur' : 'reikningur', year, drive_file_id: f.id,
            source: 'gdrive', found_by: 'code',
            amount: total, invoice_number, doc_date: date, customer_name: company,
            notes: (kredit ? 'KREDIT · ' : '') + (company || cleanStem(f.name)) + (address ? ', ' + address : '')
                 + (kt ? ' · kt ' + dash(kt) : '') + (invoice_number ? ' · ' + invoice_number : '') + (base ? '' : ' · RESOLVE'),
          });
          stats.indexed++;
        }
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
async function listPdfs(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType),nextPageToken',
      pageSize: '200', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    for (const f of (d.files || [])) if (/pdf$/i.test(f.name) || f.mimeType === 'application/pdf') out.push(f);
    pageToken = d.nextPageToken;
  } while (pageToken);
  out.sort((a, b) => a.name.localeCompare(b.name, 'is'));
  return out;
}
async function readPdfText(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return '';
  const buf = Buffer.from(await r.arrayBuffer());
  const d = await pdf(buf).catch(() => null);
  return d ? d.text : '';
}

// ── Filename (primary) ────────────────────────────────────────────────────────
// "Fyrirtæki - R 108285 - 05.05.26.pdf" → {company, number:'R-108285', date:'2026-05-05'}
function parseFilename(name) {
  const base = cleanStem(name);
  const out = { company: '', number: '', date: '', kredit: /kredit/i.test(base) };
  const segs = base.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
  for (const s of segs) {
    if (!out.number && /^R[\s\-_]?\d{4,7}$/i.test(s)) out.number = 'R-' + s.replace(/\D/g, '');
    else if (!out.date && /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(s)) out.date = isoDate(s);
  }
  // Company = first segment, unless it's a raw export stem (Nóta/Kredit/
  // Reikningur), an R-number, a date, or a pure number. Names may legitimately
  // start with a digit ("17.júní Torg", "17 sundlaug") so don't reject those.
  const first = segs[0] || '';
  if (first
      && !/^(nóta|nota|kredit|reikningur)\b/i.test(first)
      && !/^R[\s\-_]?\d{4,7}$/i.test(first)
      && !/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(first)
      && !/^\d{4,}$/.test(first)
      && !/^#/.test(first)) out.company = first;
  return out;
}
function cleanStem(name) { return String(name || '').replace(/\.pdf$/i, '').trim(); }
function isoDate(s) {
  const m = String(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return '';
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

// ── PDF content (fallback / kt + total) ───────────────────────────────────────
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
function customerKtFromName(name) { for (const kt of allKts(String(name || ''))) if (kt !== ISSUER_KT) return kt; return null; }

// dkPlus numbers are 6 digits (10xxxx). Exclude kt fragments ("531175-2719").
function extractInvoiceNumberText(text) {
  let m = text.match(/Reikningur\s*nr\.?\s*:?\s*(\d{4,7})\b/i);
  if (m) return 'R-' + m[1];
  const re = /\b(1\d{5})\b(?!-?\d{4})/g; let x;
  while ((x = re.exec(text))) { const before = text.slice(Math.max(0, x.index - 7), x.index); if (!/\d[-\s]?$/.test(before)) return 'R-' + x[1]; }
  return '';
}
function extractDate(text) {
  let m = text.match(/Dagsetning\s*:?\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/i);
  if (!m) m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (!m) return '';
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
function extractYear(s) {
  let m = s.match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m) return 2000 + parseInt(m[1], 10);
  m = s.match(/\b(20\d{2})\b/); if (m) return parseInt(m[1], 10);
  return null;
}
// Heildarupphæð m. vsk = the largest ISK-formatted figure (grand total ≥ every
// line amount and the VSK amount). Numbers without a thousands separator
// (invoice nr, raðnr, kt) are excluded by requiring "N.NNN".
function extractTotal(text) {
  const kw = text.match(/Til\s*greiðslu\s*:?\s*(?:kr\.?)?\s*([\d.]{4,})/i);
  let best = 0;
  if (kw) { const n = parseInt(kw[1].replace(/\./g, ''), 10); if (Number.isFinite(n)) best = n; }
  const re = /\b\d{1,3}(?:\.\d{3})+\b/g; let m;
  while ((m = re.exec(text))) { const n = parseInt(m[0].replace(/\./g, ''), 10); if (n > best) best = n; }
  return best || null;
}
// Bill-to company from the PDF: first letter-bearing line after the issuer block
// and before the customer kt, skipping labels. (Used only when the filename and
// the kt-match both come up empty.)
function extractCompanyText(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const isIssuer = l => /slökkvitæki|brunakerfi|helluhraun|vsk\s*nr|kt:\s*600508|600508-?0400/i.test(l);
  const isLabel = l => /^(reikningur|kreditreikningur|dagsetning|greiðsl|afh\.?skilm|starfsma|tilvísun|tilvisun|ra[ðd]nr|seljandi|greiðandi|kaupandi|vörunúmer|móttek|samtals|til\s*greiðslu|kt\.?|pósthólf|sími|netfang)/i.test(l);
  let started = false;
  for (const l of lines) {
    if (isIssuer(l)) { started = true; continue; }
    if (!started) continue;
    if (/^reikningur|kreditreikningur/i.test(l)) break;
    if (isLabel(l)) continue;
    if (!/[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]/.test(l)) continue;
    if (l.replace(/\D/g, '').length >= 7) continue;
    if (l.length > 60) continue;
    return l.replace(/\s+/g, ' ').trim();
  }
  return '';
}
// Customer address: the postcode/city line in the bill-to block + the street
// line above it. Issuer line identified by "Helluhraun" (NOT by "220
// Hafnarfj…", since customers in Hafnarfjörður share that postcode).
// Customer address. The dkPlus bill-to block reads top-down:
//   Fyrirtæki / Gata / Póstnúmer Bær / Kennitala
// so the most reliable anchor is the CUSTOMER kt line — the address is the
// 1-2 lines directly above it (the issuer's "220 Hafnarfjörður" sits ABOVE
// the issuer kt, never above the customer's). Falls back to a forward-scan
// past the issuer block ("Helluhraun"), then to the filename segment.
function extractAddress(text, fileName, custKt) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const cityRe = /\b\d{3}\s+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]/;
  const streetRe = /(pósthólf|postholf|p\.?o\.?\s*box|\d)/i;
  const isIssuerAddr = l => /helluhraun/i.test(l);
  const clean = l => l.replace(/\s+/g, ' ').replace(/,?\s*IS\.?$/i, '').trim();

  // 1) Anchor on the customer-kt line, read upwards.
  if (custKt) {
    const ktIdx = lines.findIndex(l => l.replace(/\D/g, '') === custKt);
    if (ktIdx > 0) {
      let city = '', street = '';
      for (let j = ktIdx - 1; j >= 0 && j >= ktIdx - 4; j--) {
        const l = lines[j];
        if (isIssuerAddr(l) || /^reikningur|kreditreikningur/i.test(l)) break;
        if (!city && cityRe.test(l) && l.replace(/\D/g, '').length < 7) { city = clean(l); continue; }
        if (city && streetRe.test(l) && l.replace(/\D/g, '').length < 7 && l.length < 50) { street = clean(l); break; }
        if (city) break; // line above the city that isn't a street → it's the name
      }
      if (city) return street ? street + ', ' + city : city;
    }
  }

  // 2) Forward-scan: only AFTER the issuer block ("Helluhraun") so the
  //    issuer's own postcode line is never picked up.
  let cityIdx = -1, pastIssuer = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^reikningur|kreditreikningur/i.test(lines[i])) break;
    if (isIssuerAddr(lines[i])) { pastIssuer = true; continue; }
    if (!pastIssuer) continue;
    if (cityRe.test(lines[i]) && lines[i].replace(/\D/g, '').length < 7) { cityIdx = i; break; }
  }
  if (cityIdx >= 0) {
    const city = clean(lines[cityIdx]);
    let street = '';
    for (let j = cityIdx - 1; j >= 0 && j >= cityIdx - 3; j--) {
      const l = lines[j];
      if (isIssuerAddr(l) || /^reikningur|kreditreikningur/i.test(l)) break;
      if (/^\d{6}-?\d{4}$/.test(l.replace(/\s/g, ''))) continue;
      if (streetRe.test(l) && l.replace(/\D/g, '').length < 7 && l.length < 50) { street = clean(l); break; }
    }
    return street ? street + ', ' + city : city;
  }

  // 3) Filename "Company - Address - kt - …"
  const seg = cleanStem(fileName).split(/\s+-\s+/).map(s => s.trim());
  const ktIdx2 = seg.findIndex(p => /^\d{6}-?\d{4}$/.test(p));
  return ktIdx2 >= 2 ? seg[ktIdx2 - 1] : '';
}
const dash = kt => kt.length === 10 ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;

// ── Supabase REST ────────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function alreadyIndexed(driveFileId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(driveFileId)}&select=id&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
async function matchBase(kt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
async function upsertDoc(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?on_conflict=drive_file_id`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('upsert ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
