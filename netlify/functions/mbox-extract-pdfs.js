// mbox-extract-pdfs.js — kicks off the background mbox extractor and serves
// status polling. The actual work happens in
// mbox-extract-pdfs-background.js (Netlify's "-background" suffix → 15-min
// timeout, async invocation).
//
//   GET /api/mbox-extract-pdfs?fileId=<DriveMboxFileId>&targetFolder=<DriveFolderId>[&since=YYYY-MM-DD][&dry=1]
//     → { jobId, statusUrl }   (returns immediately, background fn runs)
//
//   GET /api/mbox-extract-pdfs?status=<jobId>
//     → { jobId, state, processed, found_pdfs, uploaded, errors:[], started_at, ended_at? }
//
// Notes
//  - Expects an UNCOMPRESSED .mbox file in Drive (Takeout zips download as
//    zips — extract locally first, drop the .mbox into the same Drive folder).
//  - Filters by Date: header ≥ `since` if given (defaults to no filter).
//  - PDFs upload into `targetFolder` with name
//      <YYYY-MM-DD>-<sender>-<original-filename>.pdf
//    so the existing reikningar-rename / uttekt-rename can scan and rename.
//  - State lives in `app_kv['mbox_extract:<jobId>']`.

const { json, cors } = require('./_google');

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

  const fileId = (p.fileId || '').trim();
  const targetFolder = (p.targetFolder || '').trim();
  const since = (p.since || '').trim() || null;
  const dry = p.dry === '1' || p.dry === 'true';
  if (!fileId) return json(400, { error: 'fileId vantar (Drive file id á .mbox)' });
  if (!targetFolder && !dry) return json(400, { error: 'targetFolder vantar (Drive folder id)' });
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return json(400, { error: 'since á að vera YYYY-MM-DD' });

  const jobId = makeJobId();
  const startedAt = new Date().toISOString();
  await writeState(jobId, {
    state: 'queued', fileId, targetFolder: targetFolder || null,
    since, dry, processed: 0, found_pdfs: 0, uploaded: 0, errors: [],
    started_at: startedAt,
  });

  // Fire-and-forget invoke the -background sibling. Netlify routes invokes
  // through the public function URL; we use the function-name-only path that
  // Netlify supports from one function to another via its functions:invoke
  // semantics. Simplest portable approach: HTTP POST to ourselves.
  const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://brunaholf.netlify.app';
  const kick = origin.replace(/\/+$/, '') + '/.netlify/functions/mbox-extract-pdfs-background';
  fetch(kick, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  }).catch(() => {}); // don't block on the response

  return json(202, {
    jobId,
    statusUrl: `/api/mbox-extract-pdfs?status=${jobId}`,
  });
};

function makeJobId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`;
}

async function readState(jobId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.mbox_extract:${jobId}&select=value`, {
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
    body: JSON.stringify({ key: `mbox_extract:${jobId}`, value, updated_at: new Date().toISOString() }),
  });
}
