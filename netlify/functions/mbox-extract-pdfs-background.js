// mbox-extract-pdfs-background.js — Netlify background function (15-min
// timeout). Streams an mbox file out of Drive, splits it on the `From ` line
// delimiter, parses each message with mailparser, and uploads every PDF
// attachment into the target Drive folder.
//
// Triggered by mbox-extract-pdfs.js via POST { jobId }. State lives in
// app_kv['mbox_extract:<jobId>'] and is updated every few messages so the
// status endpoint can poll progress.
//
// File-naming convention for uploads:
//   <YYYY-MM-DD>-<sender-localpart>-<original-filename>.pdf
// This way the existing reikningar-rename / uttekt-rename pass can scan the
// folder and rename to the canonical "<Fyrirtæki> - <kt> - <R> - <dags> -
// <upphæð>.pdf" / "<Fyrirtæki> - <Heimilisfang> - <kt> - <Mánuður> - <Ár>.pdf"
// shapes by reading the PDF contents.

const { simpleParser } = require('mailparser');
const { freshAccessToken } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATE_UPDATE_EVERY = 25;     // messages between Supabase state writes
const MAX_ERRORS_RECORDED = 50;
const MBOX_DELIMITER = /\r?\nFrom /; // mbox message boundary

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  let jobId;
  try { jobId = JSON.parse(event.body || '{}').jobId; }
  catch (_) { return { statusCode: 400, body: 'bad json' }; }
  if (!jobId) return { statusCode: 400, body: 'jobId vantar' };

  const state = await readState(jobId);
  if (!state) return { statusCode: 404, body: `no such job ${jobId}` };

  // Mark running. Background fn return value isn't visible to the caller.
  state.state = 'running';
  state.errors = state.errors || [];
  await writeState(jobId, state);

  try {
    const token = await freshAccessToken();
    await processMbox(token, jobId, state);
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

async function processMbox(token, jobId, state) {
  const { fileId, targetFolder, since, dry } = state;
  const sinceDate = since ? new Date(since + 'T00:00:00Z') : null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Drive download ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  if (!res.body) throw new Error('Drive download did not return a stream');

  let buffer = '';
  let processed = 0, found = 0, uploaded = 0;
  let firstMessage = true; // first chunk doesn't start with `From ` per mbox spec
  const decoder = new TextDecoder('utf-8', { fatal: false });

  const reader = res.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split off complete messages by the delimiter, keep trailing partial in buffer
    const parts = buffer.split(MBOX_DELIMITER);
    buffer = parts.pop() ?? '';
    for (let i = 0; i < parts.length; i++) {
      const raw = (firstMessage && i === 0) ? parts[i] : ('From ' + parts[i]);
      firstMessage = false;
      const res = await handleMessage(raw, { token, targetFolder, sinceDate, dry });
      processed++;
      found += res.found;
      uploaded += res.uploaded;
      if (res.error) {
        state.errors.push(res.error);
        if (state.errors.length > MAX_ERRORS_RECORDED) state.errors.length = MAX_ERRORS_RECORDED;
      }
      if (processed % STATE_UPDATE_EVERY === 0) {
        state.processed = processed;
        state.found_pdfs = found;
        state.uploaded = uploaded;
        await writeState(jobId, state);
      }
    }
  }

  // Drain trailing decoder bytes + the last buffered message
  buffer += decoder.decode();
  if (buffer.trim()) {
    const raw = firstMessage ? buffer : ('From ' + buffer);
    const res = await handleMessage(raw, { token, targetFolder, sinceDate, dry });
    processed++;
    found += res.found;
    uploaded += res.uploaded;
    if (res.error) state.errors.push(res.error);
  }

  state.processed = processed;
  state.found_pdfs = found;
  state.uploaded = uploaded;
  await writeState(jobId, state);
}

async function handleMessage(raw, { token, targetFolder, sinceDate, dry }) {
  let parsed;
  try { parsed = await simpleParser(raw); }
  catch (e) { return { found: 0, uploaded: 0, error: 'parse:' + String(e.message || e).slice(0, 80) }; }

  const date = parsed.date instanceof Date ? parsed.date : (parsed.date ? new Date(parsed.date) : null);
  if (sinceDate && date && date < sinceDate) return { found: 0, uploaded: 0 };

  const pdfs = (parsed.attachments || []).filter(isPdf);
  if (!pdfs.length) return { found: 0, uploaded: 0 };

  if (dry) return { found: pdfs.length, uploaded: 0 };

  const sender = senderLocalpart(parsed.from);
  const dateStr = date ? toIsoDate(date) : 'undated';

  let uploaded = 0;
  for (const att of pdfs) {
    const name = buildName(dateStr, sender, att.filename || 'attachment.pdf');
    try {
      await uploadToDrive(token, targetFolder, name, att.content);
      uploaded++;
    } catch (e) {
      // record but keep going on the next attachment
      return { found: pdfs.length, uploaded, error: `upload:${name}:${String(e.message || e).slice(0, 80)}` };
    }
  }
  return { found: pdfs.length, uploaded };
}

function isPdf(att) {
  if (!att) return false;
  const ct = (att.contentType || '').toLowerCase();
  if (ct.includes('pdf')) return true;
  const fn = (att.filename || '').toLowerCase();
  return fn.endsWith('.pdf');
}

function senderLocalpart(from) {
  const addr = from?.value?.[0]?.address || '';
  if (!addr) return 'unknown';
  return addr.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30) || 'unknown';
}
function toIsoDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function buildName(dateStr, sender, original) {
  // safe Drive filename — Drive allows most chars but keep it sane
  const cleanOrig = original.replace(/[\\/]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
  return `${dateStr}-${sender}-${cleanOrig}`;
}

async function uploadToDrive(token, folderId, name, content) {
  const boundary = 'brunaholf' + Math.random().toString(36).slice(2);
  const meta = { name, parents: [folderId] };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) +
      `\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    ),
    content instanceof Buffer ? content : Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const r = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    }
  );
  if (!r.ok) throw new Error(`Drive upload ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
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
