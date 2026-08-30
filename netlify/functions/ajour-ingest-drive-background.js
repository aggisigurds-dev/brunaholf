// ajour-ingest-drive-background.js — Background function: download a (large)
// AjourRegistrationData CSV straight from Google Drive and upsert it into
// ajour_registrations. Mirrors luna-bridge/ajour-ingest.py exactly.
//
//   GET /.netlify/functions/ajour-ingest-drive-background?fileId=<driveFileId>
//        [&since=YYYY-MM-DD]   (optional: only rows with execution_date >= since)
//
// Background functions return 202 immediately and may run up to 15 min, so this
// can stream a 69 MB export, parse it semicolon-delimited, dedupe per
// (serial_number, project_name, execution_date), and upsert in batches of 500.
// The ~53-col AjourRegistrationData CSV includes DrawingName / Subject (UI:
// "Drawing/drawingname"). Older ingest dropped them. drawing_name is required
// for leftover-per-section; subject is stored when the header exists.

const { freshAccessToken } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH = 500;

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const fileId = (p.fileId || '').trim();
  const since = (p.since || '').trim() || null;   // YYYY-MM-DD or null
  if (!fileId) return { statusCode: 400, body: 'fileId required' };

  const status = { state: 'running', file_id: fileId, since, parsed: 0, upserted: 0, started_at: new Date().toISOString(), error: null };
  await writeStatus(status);

  try {
    const token = await freshAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive download ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    let header = null;
    let idx = {};
    let batch = [];
    const DRAWING_ALIASES = ['DrawingName', 'Drawing/drawingname', 'drawingname', 'Drawing', 'DrawingFileName', 'RegistrationDrawing', 'Tegning'];
    const SUBJECT_ALIASES = ['Subject', 'RegistrationSubject', 'Emne'];

    const flush = async () => {
      if (!batch.length) return;
      const seen = new Map();
      for (const r of batch) {
        const k = `${r.serial_number}|${r.project_name}|${r.execution_date}`;
        if (!seen.has(k)) seen.set(k, r);
      }
      const rows = [...seen.values()];
      await upsert(rows);
      status.upserted += rows.length;
      batch = [];
      await writeStatus(status);
    };

    const handleLine = async (line) => {
      if (header === null) {
        header = parseCsvLine(line);
        header.forEach((h, i) => { idx[h.trim()] = i; });
        status.csv_headers = header.map((h) => h.trim()).filter(Boolean);
        status.drawing_header = detectHeader(idx, DRAWING_ALIASES);
        status.subject_header = detectHeader(idx, SUBJECT_ALIASES);
        return;
      }
      if (!line.trim()) return;
      const c = parseCsvLine(line);
      const get = (name) => { const i = idx[name]; return i == null ? '' : (c[i] || ''); };
      const getAlias = (aliases) => {
        const i = aliasIndex(idx, aliases);
        return i == null ? '' : (c[i] || '');
      };
      const project_name = get('ProjectName').trim();
      if (!project_name) return;
      const execution_date = parseDate(get('ExecutionDateFrom'));
      if (since && (!execution_date || execution_date < since)) return;
      status.parsed++;
      batch.push({
        serial_number: get('SerialNumber').trim() || null,
        registration_type: get('RegistrationType').trim() || null,
        registration_status: get('RegistrationStatus').trim() || null,
        project_name,
        category_group: get('CategoryGroup').trim() || null,
        category: get('Category').trim() || null,
        category1: get('Category1').trim() || null,
        checklist_item: get('CheckListItem').trim() || null,
        checked_date: parseDate((get('CheckListItemCheckedDate') || '').split(' ')[0]),
        checked_by_user: get('CheckListItemCheckedByUser').trim() || null,
        execution_date,
        receiver_company: get('ReceiverCompany').trim() || null,
        longitude: numOrNull(get('Longitude')),
        latitude: numOrNull(get('Latitude')),
        registration_created_date: parseTs(get('RegistrationCreatedDate')),
        drawing_name: getAlias(DRAWING_ALIASES).trim() || null,
        subject: getAlias(SUBJECT_ALIASES).trim() || null,
      });
      if (batch.length >= BATCH) await flush();
    };

    // Stream + line-split
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.charCodeAt(0) === 0xFEFF) line = line.slice(1); // BOM on first line
        await handleLine(line);
      }
    }
    if (buf.trim()) await handleLine(buf.replace(/^﻿/, ''));
    await flush();

    status.state = 'done';
    status.finished_at = new Date().toISOString();
    await writeStatus(status);
    return { statusCode: 200, body: JSON.stringify(status) };
  } catch (e) {
    status.state = 'error';
    status.error = e.message || String(e);
    status.finished_at = new Date().toISOString();
    await writeStatus(status);
    return { statusCode: 500, body: status.error };
  }
};

// Minimal RFC-4180-ish parser for a single semicolon-delimited line (handles "" quotes).
function parseCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ';') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let m;
  if ((m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/))) return `${m[3]}-${m[2]}-${m[1]}`;            // dd-mm-yyyy
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return `${m[1]}-${m[2]}-${m[3]}`;            // yyyy-mm-dd
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)))  return `${m[3]}-${m[1]}-${m[2]}`;          // mm/dd/yyyy[ time]
  return null;
}
function parseTs(s) {
  if (!s) return null;
  const d = parseDate(String(s).split(' ')[0]);
  return d ? new Date(d + 'T00:00:00Z').toISOString() : null;
}
function numOrNull(s) {
  if (!s) return null;
  const n = Number(String(s).replace(',', '.'));
  return isFinite(n) ? n : null;
}
function normHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[\s/_-]+/g, '');
}
function aliasIndex(idx, aliases) {
  const byNorm = {};
  for (const k of Object.keys(idx)) byNorm[normHeader(k)] = idx[k];
  for (const a of aliases) {
    if (idx[a] != null) return idx[a];
    const n = byNorm[normHeader(a)];
    if (n != null) return n;
  }
  return null;
}
function detectHeader(idx, aliases) {
  const i = aliasIndex(idx, aliases);
  if (i == null) return null;
  return Object.keys(idx).find((k) => idx[k] === i) || null;
}

async function upsert(rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ajour_registrations?on_conflict=serial_number,project_name,execution_date`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Upsert ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function writeStatus(status) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key: 'ajour_ingest_status', value: status }),
    });
  } catch { /* best-effort */ }
}
