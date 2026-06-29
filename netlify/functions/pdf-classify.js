// pdf-classify.js — kick-off + status poll for the bulk PDF classifier.
//
// Reads each PDF in a Drive folder, classifies it as one of
//   úttektarskýrsla | reikningur | annað
// and MOVES it to the matching target folder. Idempotent — files already in
// a target folder are skipped.
//
//   GET /api/pdf-classify
//     ?source=<folderId>             (folder of unsorted PDFs)
//     &uttekt=<folderId>             (target for úttektarskýrslur)
//     &reikningar=<folderId>         (target for invoices)
//     &annad=<folderId>              (target for everything else)
//     [&dry=1]                       (no actual moves, just dry classification)
//     [&since=YYYY-MM-DD]            (skip files modified before this)
//     → 202 { jobId, statusUrl }
//
//   GET /api/pdf-classify?status=<jobId>
//     → { state, processed, classified:{uttekt,reikningar,annad}, errors:[] }
//
// State lives in app_kv['pdf_classify:<jobId>'].

const pdfParse = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });

  const p = event.queryStringParameters || {};
  const statusJob = (p.status || '').trim();

  if (statusJob) {
    const s = await readState(statusJob);
    if (!s) return json(404, { error: `Engin job-rad fyrir ${statusJob}` });
    return json(200, { jobId: statusJob, ...s });
  }

  // Sample mode — analyse-first workflow: pick N random PDFs from source,
  // return the first 2000 chars of each + tentative classification. Lets us
  // refine heuristics before any files are moved. Synchronous (no background).
  if (p.sample) {
    const n = Math.max(1, Math.min(20, parseInt(p.sample, 10) || 5));
    const source = (p.source || '').trim();
    if (!source) return json(400, { error: 'source folder id vantar' });
    try {
      const out = await sampleFolder(source, n);
      return json(200, { ok: true, sampled: out.length, samples: out });
    } catch (e) {
      return json(500, { error: String(e.message || e) });
    }
  }

  const source = (p.source || '').trim();
  const uttekt = (p.uttekt || '').trim();
  const reikningar = (p.reikningar || '').trim();
  const annad = (p.annad || '').trim();
  const dups = (p.dups || '').trim();   // optional 4th folder for duplicates
  const dry = p.dry === '1' || p.dry === 'true';
  const since = (p.since || '').trim() || null;
  if (!source) return json(400, { error: 'source folder id vantar' });
  if (!dry && (!uttekt || !reikningar || !annad)) {
    return json(400, { error: 'uttekt + reikningar + annad target folder ids vantar (eða notaðu ?dry=1)' });
  }
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return json(400, { error: 'since á að vera YYYY-MM-DD' });

  const jobId = makeJobId();
  await writeState(jobId, {
    state: 'queued', source,
    targets: { uttekt: uttekt || null, reikningar: reikningar || null, annad: annad || null, dups: dups || null },
    dry, since,
    processed: 0,
    classified: { uttekt: 0, reikningar: 0, annad: 0 },
    dups_skipped: 0,
    errors: [],
    started_at: new Date().toISOString(),
  });

  const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://brunaholf.netlify.app';
  const kick = origin.replace(/\/+$/, '') + '/.netlify/functions/pdf-classify-background';
  fetch(kick, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  }).catch(() => {});

  return json(202, { jobId, statusUrl: `/api/pdf-classify?status=${jobId}` });
};

function makeJobId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`;
}

// ── Sample mode helpers ───────────────────────────────────────────────────
async function sampleFolder(folderId, n) {
  const token = await freshAccessToken();
  const q = `'${folderId}' in parents and (mimeType='application/pdf' or name contains '.pdf') and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,size)',
    pageSize: '200',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  });
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive list ${r.status}`);
  const { files = [] } = await r.json();
  if (!files.length) return [];

  // Sample n random files (or all if fewer than n exist)
  const pool = [...files];
  const picked = [];
  while (picked.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }

  const out = [];
  for (const f of picked) {
    try {
      const dl = await fetch(
        `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!dl.ok) { out.push({ name: f.name, error: `download ${dl.status}` }); continue; }
      const buf = Buffer.from(await dl.arrayBuffer());
      let text = '';
      try {
        const parsed = await pdfParse(buf, { max: 2 });
        text = parsed.text || '';
      } catch (e) {
        out.push({ name: f.name, size: f.size, parse_error: String(e.message || e).slice(0, 80) });
        continue;
      }
      out.push({
        name: f.name,
        size: f.size,
        text_first_2000: text.replace(/\s+/g, ' ').trim().slice(0, 2000),
        tentative: tentativeClassify(text, f.name),
      });
    } catch (e) {
      out.push({ name: f.name, error: String(e.message || e).slice(0, 80) });
    }
  }
  return out;
}

// Battle-tested patterns ported verbatim from uttekt-rename.js (line 94-95)
// and reikningar-read.js — these have been tuned over many iterations on real
// Slökkvitæki ehf documents and reject vendor invoices that also carry the
// issuer kt.
const IS_INVOICE_FN = /\bR[\s_-]?\d{5,7}\b/i;
const IS_INVOICE_TEXT = /til greiðslu|reikningsnr|gjalddagi\s*-?\s*eindagi|samtala reiknings|samtals fyrir vsk|reikningur\s*nr/i;
const IS_REPORT_TEXT = /skýrsla vegna úttektar|úttektarskýrsl|uttektarskyrsl|viðtökupróf|árleg prófun|brunaviðvörunarkerfi/i;
const ISSUER_KT = '6005080400';

function tentativeClassify(text, name) {
  const isInvoice = IS_INVOICE_FN.test(name || '') || IS_INVOICE_TEXT.test(text || '');
  const isReport = IS_REPORT_TEXT.test(text || '');
  // Document carries Slökkvitæki issuer kt? Required for either category to
  // count as "ours" (avoids classifying vendor invoices addressed TO us as
  // our own invoices). Defensive — score still records both signals.
  const isOurs = (text || '').replace(/\s+/g, '').includes(ISSUER_KT) || (text || '').includes('600508-0400');

  let label = 'annad';
  if (isReport && !isInvoice) label = 'uttekt';
  else if (isInvoice && !isReport) label = 'reikningar';

  return {
    label,
    is_report: isReport,
    is_invoice: isInvoice,
    issuer_kt_present: isOurs,
  };
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
