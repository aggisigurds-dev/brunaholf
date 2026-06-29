// pdf-classify-background.js — Netlify background fn (15-min timeout).
//
// For each PDF in the source Drive folder:
//   1. Skip if already in one of the target folders (idempotency).
//   2. Read first ~3 pages of PDF text via pdf-parse.
//   3. Classify as úttektarskýrsla / reikningur / annað.
//   4. Move file to matching target folder (or just record in dry mode).
//   5. Persist progress to app_kv every 10 files.
//
// Heuristics tuned for Slökkvitæki ehf / brunaholf domain (Icelandic
// inspection reports + invoices). Multiple positive signals required for
// confident categorisation; falls through to "annað" when ambiguous.

const pdfParse = require('pdf-parse');
const { freshAccessToken } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATE_UPDATE_EVERY = 10;
const MAX_PDF_BYTES = 12 * 1024 * 1024; // 12 MB — skip anything huge to keep parser fast
const PAGE_HINT_BYTES = 60_000;         // first ~60 KB of text is enough to classify

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  let jobId;
  try { jobId = JSON.parse(event.body || '{}').jobId; }
  catch (_) { return { statusCode: 400, body: 'bad json' }; }
  if (!jobId) return { statusCode: 400, body: 'jobId vantar' };

  const state = await readState(jobId);
  if (!state) return { statusCode: 404, body: `no such job ${jobId}` };
  state.state = 'running';
  state.errors = state.errors || [];
  state.classified = state.classified || { uttekt: 0, reikningar: 0, annad: 0 };
  await writeState(jobId, state);

  try {
    const token = await freshAccessToken();
    await processFolder(token, jobId, state);
    state.state = 'done';
    state.ended_at = new Date().toISOString();
    await writeState(jobId, state);
  } catch (e) {
    state.state = 'error';
    state.errors.push(String(e.message || e).slice(0, 300));
    state.ended_at = new Date().toISOString();
    await writeState(jobId, state);
  }

  return { statusCode: 200, body: 'ok' };
};

async function processFolder(token, jobId, state) {
  const { source, targets, dry, since } = state;
  const sinceDate = since ? new Date(since + 'T00:00:00Z') : null;
  const targetIds = new Set([targets.uttekt, targets.reikningar, targets.annad].filter(Boolean));

  let pageToken = '';
  let processed = 0;
  for (;;) {
    const page = await listDrivePdfs(token, source, pageToken);
    for (const file of page.files) {
      // Skip already-sorted: if file's parents include any target, leave it.
      const parents = new Set(file.parents || []);
      let alreadySorted = false;
      for (const t of targetIds) if (parents.has(t)) { alreadySorted = true; break; }
      if (alreadySorted) continue;

      if (sinceDate && file.modifiedTime && new Date(file.modifiedTime) < sinceDate) continue;
      if (file.size && Number(file.size) > MAX_PDF_BYTES) {
        state.errors.push(`skip too-large ${file.name}: ${file.size}b`);
        if (state.errors.length > 50) state.errors.length = 50;
        continue;
      }

      try {
        const buf = await downloadDrive(token, file.id);
        const text = await extractText(buf);
        const cat = classify(text, file.name);

        let newName = null;
        if (cat === 'reikningar') {
          const parsed = parseInvoice(text, file.name);
          if (parsed.company || parsed.rNumber) newName = invoiceName(parsed);
        } else if (cat === 'uttekt') {
          const parsed = parseReport(text, file.name);
          if (parsed.company || parsed.kt) newName = reportName(parsed);
        }

        if (!dry) {
          const target = targets[cat];
          if (target) {
            await moveDriveFile(token, file.id, source, target);
          }
          if (newName && newName !== file.name) {
            try { await renameDriveFile(token, file.id, newName); }
            catch (e) {
              state.errors.push(`rename ${file.name}: ${String(e.message || e).slice(0, 80)}`);
            }
          }
        }
        state.classified[cat] = (state.classified[cat] || 0) + 1;
      } catch (e) {
        state.errors.push(`${file.name}: ${String(e.message || e).slice(0, 80)}`);
        if (state.errors.length > 50) state.errors.length = 50;
        state.classified.annad = (state.classified.annad || 0) + 1;
      }

      processed++;
      if (processed % STATE_UPDATE_EVERY === 0) {
        state.processed = processed;
        await writeState(jobId, state);
      }
    }
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  state.processed = processed;
  await writeState(jobId, state);
}

// ── Classification ─────────────────────────────────────────────────────────
// Returns one of: 'uttekt' | 'reikningar' | 'annad'.
// Patterns ported verbatim from uttekt-rename.js (line 94-95) and
// reikningar-read.js — battle-tested on real Slökkvitæki ehf documents.
const IS_INVOICE_FN = /\bR[\s_-]?\d{5,7}\b/i;
const IS_INVOICE_TEXT = /til greiðslu|reikningsnr|gjalddagi\s*-?\s*eindagi|samtala reiknings|samtals fyrir vsk|reikningur\s*nr/i;
const IS_REPORT_TEXT = /skýrsla vegna úttektar|úttektarskýrsl|uttektarskyrsl|viðtökupróf|árleg prófun|brunaviðvörunarkerfi/i;

function classify(text, name) {
  const isInvoice = IS_INVOICE_FN.test(name || '') || IS_INVOICE_TEXT.test(text || '');
  const isReport = IS_REPORT_TEXT.test(text || '');
  if (isReport && !isInvoice) return 'uttekt';
  if (isInvoice && !isReport) return 'reikningar';
  return 'annad';
}

// ── Drive helpers ──────────────────────────────────────────────────────────
async function listDrivePdfs(token, folderId, pageToken) {
  const q = `'${folderId}' in parents and (mimeType='application/pdf' or name contains '.pdf') and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: 'nextPageToken,files(id,name,parents,size,modifiedTime)',
    pageSize: '200',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive list ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function downloadDrive(token, fileId) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`Drive download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function moveDriveFile(token, fileId, fromParent, toParent) {
  const params = new URLSearchParams({
    addParents: toParent,
    removeParents: fromParent,
    supportsAllDrives: 'true',
    fields: 'id,parents',
  });
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive move ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function renameDriveFile(token, fileId, name) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(`Drive rename ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ── Parsers ────────────────────────────────────────────────────────────────
const ISSUER_KT = '6005080400';
function sanitize(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
}
function customerKt(text) {
  const re = /\b(\d{6})-?(\d{4})\b/g;
  let m;
  while ((m = re.exec(text))) {
    const kt = m[1] + m[2];
    if (kt !== ISSUER_KT) return m[1] + '-' + m[2];
  }
  return null;
}

// Reikningur:  Fyrirtæki - kt - R-NNNNNN - Ár - upphæð kr
function parseInvoice(text, name) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const out = { company: null, kt: customerKt(t), rNumber: null, year: null, total: null };

  // Company: first 30 chars before kt is usually company name
  // Pattern: "Mini Market ehf. 470214-1040 Drafnarfelli 14 111 Reykjavík …"
  const ktMatch = t.match(/^(.+?)\s+\d{6}-?\d{4}\b/);
  if (ktMatch) out.company = ktMatch[1].trim().replace(/[.,]$/, '');

  // R-number: prefer filename (R-NNNNNN), else "Reikningur nr"/"Raðnr"+number
  let m = (name || '').match(/\bR[\s_-]?(\d{5,7})\b/i);
  if (m) out.rNumber = 'R-' + m[1];
  if (!out.rNumber) {
    m = (name || '').match(/(?:Stolpi_Invoice_|invoice[_\s]?)(\d{5,7})/i);
    if (m) out.rNumber = 'R-' + m[1];
  }
  if (!out.rNumber) {
    m = t.match(/Reikningur\s*nr\.?\s*:?\s*(\d{4,7})/i);
    if (m) out.rNumber = 'R-' + m[1];
  }
  if (!out.rNumber) {
    // Raðnr field in Slökkvitæki invoices (line above "Skilmáli1")
    m = t.match(/Skilmáli\d+\s+(\d{5,7})\s+Slökkvitæki/i);
    if (m) out.rNumber = 'R-' + m[1];
  }

  // Year: prefer filename date (YYYY-MM-DD), else date in text "DD.MM.YY"
  m = (name || '').match(/(?:^|[^\d])(20\d{2})(?:[-_]\d{2}[-_]\d{2}|\b)/);
  if (m) out.year = m[1];
  if (!out.year) {
    m = t.match(/\b\d{1,2}\.\d{1,2}\.(\d{2,4})\b/);
    if (m) out.year = m[1].length === 2 ? '20' + m[1] : m[1];
  }

  // Total: "Til greiðslu : 48.067" or "Til greiðslu ISK: 24.371"
  m = t.match(/Til\s*greiðslu\s*(?:ISK)?\s*:?\s*([\d.]{4,})/i);
  if (m) out.total = m[1].replace(/\./g, '');
  // Fallback: largest comma/dot ISK figure
  if (!out.total) {
    const figs = (t.match(/\b\d{1,3}(?:\.\d{3})+\b/g) || []).map(s => parseInt(s.replace(/\./g, ''), 10));
    if (figs.length) out.total = String(Math.max(...figs));
  }
  return out;
}

function invoiceName({ company, kt, rNumber, year, total }) {
  const parts = [];
  parts.push(sanitize(company || 'Óþekkt'));
  if (kt) parts.push(kt);
  if (rNumber) parts.push(rNumber);
  if (year) parts.push(year);
  if (total) parts.push(formatKr(total) + ' kr');
  return parts.join(' - ').replace(/\s*-\s*$/, '') + '.pdf';
}

// Skýrsla:  Fyrirtæki - Heimilisfang - kt - Ár - Mánuður
const MONTHS_IS = ['janúar','febrúar','mars','apríl','maí','júní','júlí','ágúst','september','október','nóvember','desember'];
function parseReport(text, name) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const out = { company: null, address: null, kt: customerKt(t), year: null, month: null };

  // Pattern A — slökkvitæki úttektarskýrsla: "hjá fyrirtækinu X . Kt …"
  let m = t.match(/hj[áa]\s+fyrirt(?:æki|aeki)nu\s+(.+?)\.?\s*Kt\b/i);
  if (m) {
    const full = m[1].replace(/\s+/g, ' ').trim();
    const street = full.match(/^(.*?)\s*([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.-]*\s+\d{1,4}[a-dA-D]?)\s*$/);
    if (street) {
      out.company = street[1].trim();
      out.address = street[2].trim();
    } else {
      out.company = full;
    }
  }

  // Pattern B — brunaviðvörunarkerfi viðtökupróf: "Verkkaupi X Kennitala …"
  if (!out.company) {
    m = t.match(/Verkkaupi\s+(.+?)\s+Kennitala/i);
    if (m) out.company = m[1].trim();
  }
  if (!out.address) {
    m = t.match(/Heimilisf\.?\s*(.+?)\s*Póstnr\.?\s*(\d{3})/i);
    if (m) out.address = m[1].trim();
  }

  // Date: prefer "Dags: DD/MM/YY" then any DD.MM.YYYY not preceded by "Næsta"
  m = t.match(/\bdags\.?\s*:?\s*(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/i);
  if (!m) {
    const re = /(.{0,12})(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/g;
    let mm;
    while ((mm = re.exec(t))) {
      if (/næst|next/i.test(mm[1])) continue;
      m = [mm[0], mm[2], mm[3], mm[4]]; break;
    }
  }
  if (m) {
    const mo = parseInt(m[2], 10);
    const yr = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    if (mo >= 1 && mo <= 12) out.month = MONTHS_IS[mo - 1];
    if (yr > 2000 && yr < 2100) out.year = String(yr);
  }
  return out;
}
function reportName({ company, address, kt, year, month }) {
  const parts = [];
  parts.push(sanitize(company || 'Óþekkt'));
  if (address) parts.push(sanitize(address));
  if (kt) parts.push(kt);
  if (year) parts.push(year);
  if (month) parts.push(month);
  return parts.join(' - ') + '.pdf';
}

function formatKr(n) {
  const num = Number(String(n).replace(/[^\d]/g, ''));
  if (!num) return '';
  return num.toLocaleString('is-IS').replace(/,/g, '.');
}

async function extractText(buf) {
  try {
    const out = await pdfParse(buf, { max: 3 });
    return (out.text || '').slice(0, PAGE_HINT_BYTES);
  } catch (e) {
    // Some PDFs (scans without OCR, encrypted) can't be parsed — return empty.
    return '';
  }
}

async function readState(jobId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.pdf_classify:${jobId}&select=value`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0]?.value || null;
}
async function writeState(jobId, value) {
  return fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ key: `pdf_classify:${jobId}`, value, updated_at: new Date().toISOString() }),
  });
}
