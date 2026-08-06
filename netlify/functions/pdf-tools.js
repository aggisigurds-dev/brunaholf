// pdf-tools.js — shared PDF utility endpoint for the "📄 PDF verkfæri" tab.
//
// Grew out of the 2026-08-06 blank-PDF investigation on slokkvitaeki (a client-
// side html2canvas re-render was producing an empty attachment). That fix
// surfaced a related question: why does the invoice-send flow re-render a
// fresh PDF from live data on every send, instead of just attaching the
// canonical copy patch 233 (slokkvitaeki) already auto-saves at invoice-
// creation time? `invoice-lookup` below is that same "find the saved copy"
// logic, exposed as a standalone tool so Agnar can look one up directly
// without hunting through Sala/Kröfuyfirlit.
//
// Deliberately does NOT re-implement invoice/report rendering here — a second
// independent PDF renderer for financial documents would drift from the
// client-side one (patch 233) over time and nobody would notice until a
// customer got two different-looking invoices for the same sale. `merge` and
// `extract` are genuinely new, safe capabilities; `invoice-lookup` reuses
// existing saved files rather than generating new ones.
//
//   POST /api/pdf-tools  { action:'merge',   files:[{url,name?}, …] }
//     → { ok, base64, filename }                 merges PDFs (pdf-lib) in order given
//   POST /api/pdf-tools  { action:'split',   url }
//     → { ok, pageCount, pages:[{page,base64}] }  every page as its own single-page PDF
//   POST /api/pdf-tools  { action:'compose', images:[{url|base64,name?}] }
//     → { ok, base64, filename, pageCount }       one page per image, fit to A4
//   POST /api/pdf-tools  { action:'extract', url }
//     → { ok, text, pages }                       pdf-parse text extraction
//   GET  /api/pdf-tools  ?action=invoice-lookup&num=R-000697
//     → { ok, found, sale, attachment:{name,url,size,uploaded_at} | null, message? }
//
// (High-quality page→image cropping lives client-side in pdftools.html via
// pdf.js — rasterizing a PDF page needs a real renderer, which means either a
// browser or a native-canvas dependency; the browser the user already has
// open is the simpler, more reliable choice for a low-volume admin tool.)
//
// Reads the SAME Supabase project slokkvitaeki writes to (osfdzskyvisifcwyjkuk)
// via SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY — already configured for this
// site. The `samningar` storage bucket (where CompanyAttachments/patch 111
// saves invoices/reports) is public, so no signed-URL round trip is needed.
const { PDFDocument } = require('pdf-lib');
const pdf = require('pdf-parse');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'samningar';
const MAX_MERGE_FILES = 20;
const MAX_FETCH_MB = 25;
const MAX_SPLIT_PAGES = 60;
const MAX_COMPOSE_IMAGES = 40;

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
function publicUrl(path) { return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`; }

async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('sækja ' + url + ': HTTP ' + r.status);
  const len = r.headers.get('content-length');
  if (len && Number(len) > MAX_FETCH_MB * 1024 * 1024) throw new Error(url + ' er stærri en ' + MAX_FETCH_MB + ' MB');
  return Buffer.from(await r.arrayBuffer());
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });

  try {
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      if (p.action === 'invoice-lookup') return await invoiceLookup(p.num);
      return json(400, { error: 'Óþekkt action (GET styður aðeins invoice-lookup)' });
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch (_) { return json(400, { error: 'Invalid JSON body' }); }

    if (body.action === 'merge') return await mergePdfs(body.files);
    if (body.action === 'split') return await splitPdf(body.url);
    if (body.action === 'compose') return await composePdf(body.images);
    if (body.action === 'extract') return await extractText(body.url);
    return json(400, { error: 'Óþekkt action — merge | split | compose | extract' });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

// ── invoice-lookup ───────────────────────────────────────────────────────────
async function invoiceLookup(numRaw) {
  const num = String(numRaw || '').trim();
  if (!num) return json(400, { error: 'num (t.d. R-000697) required' });

  const sr = await fetch(
    `${SUPABASE_URL}/rest/v1/solur?num=eq.${encodeURIComponent(num)}&select=id,num,customer_id,customer_nafn,customer_base_id,samtals,created_at&limit=1`,
    { headers: sbHeaders() });
  const sales = await sr.json().catch(() => []);
  const sale = Array.isArray(sales) ? sales[0] : null;
  if (!sale) return json(200, { ok: true, found: false, sale: null, attachment: null, message: 'Engin sala með þessu númeri fannst.' });

  let attachment = null;
  if (sale.customer_id != null) {
    const ar = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=settings`,
      { headers: sbHeaders() });
    const rows = await ar.json().catch(() => []);
    const settings = (Array.isArray(rows) && rows[0] && rows[0].settings) || {};
    const list = (settings.company_attachments && settings.company_attachments[String(sale.customer_id)]) || [];
    const found = Array.isArray(list)
      ? list.find(a => a && a.kind === 'reikningur' && a.name && a.name.indexOf(num) >= 0)
      : null;
    if (found && found.path) {
      attachment = {
        name: found.name, path: found.path, url: publicUrl(found.path),
        size: found.size || null, uploaded_at: found.uploaded_at || null,
      };
    }
  }

  return json(200, {
    ok: true, found: !!attachment, sale, attachment,
    message: attachment ? null
      : 'Enginn vistaður reikningur fannst fyrir ' + num + ' — hann var annaðhvort stofnaður fyrir sjálfvirku vistunina eða hún brást þegjandi. Nota "⬇ Sækja PDF" beint á sölunni í Sölu/Kröfu yfirliti til að endursmíða hann.',
  });
}

// ── merge ─────────────────────────────────────────────────────────────────────
async function mergePdfs(files) {
  if (!Array.isArray(files) || !files.length) return json(400, { error: 'files (fylki af {url}) required' });
  if (files.length > MAX_MERGE_FILES) return json(400, { error: 'Mest ' + MAX_MERGE_FILES + ' skrár í einu' });

  const out = await PDFDocument.create();
  const errors = [];
  for (const f of files) {
    const url = f && f.url;
    if (!url) { errors.push('vantar url'); continue; }
    try {
      const bytes = await fetchBytes(url);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach(pg => out.addPage(pg));
    } catch (e) { errors.push((f.name || url) + ': ' + (e.message || e)); }
  }
  if (!out.getPageCount()) return json(400, { error: 'Engin síða tókst að sameina.', errors });

  const bytes = await out.save();
  return json(200, {
    ok: true, base64: Buffer.from(bytes).toString('base64'),
    filename: 'sameinad-' + Date.now() + '.pdf', pageCount: out.getPageCount(),
    errors: errors.length ? errors : undefined,
  });
}

// ── split ─────────────────────────────────────────────────────────────────────
async function splitPdf(url) {
  if (!url) return json(400, { error: 'url required' });
  const bytes = await fetchBytes(url);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true }).catch(e => { throw new Error('Ekki lesanleg PDF: ' + (e.message || e)); });
  const total = src.getPageCount();
  if (!total) return json(400, { error: 'Engar síður í skránni.' });
  if (total > MAX_SPLIT_PAGES) return json(400, { error: 'Skjalið er með ' + total + ' síður — mest ' + MAX_SPLIT_PAGES + ' í einu í þessu tóli.' });

  const pages = [];
  for (let i = 0; i < total; i++) {
    const out = await PDFDocument.create();
    const [pg] = await out.copyPages(src, [i]);
    out.addPage(pg);
    const b = await out.save();
    pages.push({ page: i + 1, base64: Buffer.from(b).toString('base64') });
  }
  return json(200, { ok: true, pageCount: total, pages });
}

// ── compose (images → one multi-page PDF, one image per A4 page) ─────────────
async function composePdf(images) {
  if (!Array.isArray(images) || !images.length) return json(400, { error: 'images (fylki af {url} eða {base64}) required' });
  if (images.length > MAX_COMPOSE_IMAGES) return json(400, { error: 'Mest ' + MAX_COMPOSE_IMAGES + ' myndir í einu' });

  const out = await PDFDocument.create();
  const errors = [];
  const A4W = 595.28, A4H = 841.89, MARGIN = 24; // pt
  for (const img of images) {
    try {
      const bytes = img.base64 ? Buffer.from(String(img.base64).replace(/^data:[^;]+;base64,/, ''), 'base64')
        : await fetchBytes(img.url);
      const type = (img.type || sniffImageType(bytes) || '').toLowerCase();
      let embedded;
      if (type.includes('png')) embedded = await out.embedPng(bytes);
      else embedded = await out.embedJpg(bytes); // JPEG default — covers the common photo/scan case
      const page = out.addPage([A4W, A4H]);
      const maxW = A4W - MARGIN * 2, maxH = A4H - MARGIN * 2;
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
      const w = embedded.width * scale, h = embedded.height * scale;
      page.drawImage(embedded, { x: (A4W - w) / 2, y: (A4H - h) / 2, width: w, height: h });
    } catch (e) { errors.push((img.name || img.url || 'mynd') + ': ' + (e.message || e)); }
  }
  if (!out.getPageCount()) return json(400, { error: 'Engin mynd tókst að setja inn.', errors });

  const bytes = await out.save();
  return json(200, {
    ok: true, base64: Buffer.from(bytes).toString('base64'),
    filename: 'myndir-' + Date.now() + '.pdf', pageCount: out.getPageCount(),
    errors: errors.length ? errors : undefined,
  });
}
function sniffImageType(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  return null;
}

// ── extract ───────────────────────────────────────────────────────────────────
async function extractText(url) {
  if (!url) return json(400, { error: 'url required' });
  const bytes = await fetchBytes(url);
  const d = await pdf(bytes).catch(e => { throw new Error('pdf-parse: ' + (e.message || e)); });
  return json(200, { ok: true, text: d.text || '', pages: d.numpages || null });
}
