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

        if (!dry) {
          const target = targets[cat];
          if (target) {
            await moveDriveFile(token, file.id, source, target);
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
