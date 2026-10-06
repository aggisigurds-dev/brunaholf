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
//
// 05.10.2026 (Agnar: „ég var að sækja Ajour og setja inn á google drive. en ég næ ekki
// að láta kerfið lesa það inn"): Ajour flytur út dagsetningar eftir tungumáli
// innskráningarinnar — '24-10-2025' eða '24/10/2025'. Þessi lesari gerði ráð fyrir mm/dd
// við skástrik, svo fyrsta röð með degi > 12 varð '2025-24-10' og new Date(…).toISOString()
// kastaði „Invalid time value" (mælt 05.10 09:46: parsed 1, upserted 0). Sama villa og
// luna-bridge lagaði 29.09 (0cf0f7b) — nú sama regla hér: röðin er ákvörðuð PER DÁLK úr
// skránni sjálfri í fyrri umferð (ekkert skrifað), og EKKERT er skrifað ef dálkur blandar
// dd/mm og mm/dd eða >1% af ExecutionDateFrom lesast ekki. Seinni umferð les inn.
// CheckListItemCheckedDate er bandarískur tímastimpill ('10/24/2025 13:52:25') — sjálfgefið mm/dd.

const { freshAccessToken } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH = 500;
const DATE_COLS = ['ExecutionDateFrom', 'RegistrationCreatedDate', 'CheckListItemCheckedDate'];
// sjálfgefið ef dálkur sker ekki úr (allir dagar ≤ 12): það sem sést hefur í öllum skrám hingað til
const DAY_FIRST_SJALFGEFID = { ExecutionDateFrom: true, RegistrationCreatedDate: true, CheckListItemCheckedDate: false };

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const fileId = (p.fileId || '').trim();
  const since = (p.since || '').trim() || null;   // YYYY-MM-DD or null
  if (!fileId) return { statusCode: 400, body: 'fileId required' };

  const status = { state: 'running', stage: 'greining', file_id: fileId, since, parsed: 0, upserted: 0, started_at: new Date().toISOString(), error: null };
  await writeStatus(status);

  try {
    const token = await freshAccessToken();
    const DRAWING_ALIASES = ['DrawingName', 'Drawing/drawingname', 'drawingname', 'Drawing', 'DrawingFileName', 'RegistrationDrawing', 'Tegning'];
    const SUBJECT_ALIASES = ['Subject', 'RegistrationSubject', 'Emne', 'Description'];   // Description: ummál raufa NLSH 2.11 (06.10.2026)

    // ── Umferð 1: dagsetningaröð per dálk + prófun — EKKERT skrifað ──────────────
    let header = null, idx = {};
    const cnt = {}; DATE_COLS.forEach((k) => { cnt[k] = { dd: 0, mm: 0 }; });
    const execVals = new Map();   // ExecutionDateFrom-gildi → fjöldi (fá einstök gildi)
    await lesaLinur(fileId, token, (line) => {
      if (header === null) { header = parseCsvLine(line); header.forEach((h, i) => { idx[h.trim()] = i; }); return; }
      if (!line.trim()) return;
      const c = parseCsvLine(line);
      for (const k of DATE_COLS) {
        const i = idx[k]; if (i == null) continue;
        const m = String(c[i] || '').match(/^\s*(\d{1,2})\/(\d{1,2})\/\d{4}/);
        if (!m) continue;
        const a = +m[1], b = +m[2];
        if (a > 12) cnt[k].dd++; else if (b > 12) cnt[k].mm++;
      }
      const iE = idx.ExecutionDateFrom;
      const v = iE == null ? '' : String(c[iE] || '').trim();
      if (v) execVals.set(v, (execVals.get(v) || 0) + 1);
    });
    if (!header) throw new Error('Skráin er tóm — enginn haus fannst.');
    const dayFirst = Object.assign({}, DAY_FIRST_SJALFGEFID);
    for (const k of DATE_COLS) {
      const { dd, mm } = cnt[k];
      if (dd && mm) throw new Error(`Dálkurinn ${k} blandar dd/mm (${dd}) og mm/dd (${mm}) — ekkert skrifað.`);
      if (dd || mm) dayFirst[k] = mm === 0;
    }
    let alls = 0, bilud = 0; const daemi = [];
    for (const [v, n] of execVals) {
      alls += n;
      if (parseDate(v, dayFirst.ExecutionDateFrom) == null) { bilud += n; if (daemi.length < 3) daemi.push(v); }
    }
    status.date_order = Object.fromEntries(DATE_COLS.map((k) => [k, dayFirst[k] ? 'dd/mm' : 'mm/dd']));
    status.date_check = { alls, bilud };
    if (alls && bilud / alls > 0.01) throw new Error(`${bilud} af ${alls} dagsetningum (ExecutionDateFrom) lesast ekki, t.d. ${daemi.join(', ')} — ekkert skrifað.`);

    // ── Umferð 2: innlestur ─────────────────────────────────────────────────────
    status.stage = 'innlestur';
    await writeStatus(status);
    header = null; idx = {};
    let batch = [];

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

    await lesaLinur(fileId, token, async (line) => {
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
      const execution_date = parseDate(get('ExecutionDateFrom'), dayFirst.ExecutionDateFrom);
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
        checked_date: parseDate(get('CheckListItemCheckedDate'), dayFirst.CheckListItemCheckedDate),
        checked_by_user: get('CheckListItemCheckedByUser').trim() || null,
        execution_date,
        receiver_company: get('ReceiverCompany').trim() || null,
        longitude: numOrNull(get('Longitude')),
        latitude: numOrNull(get('Latitude')),
        registration_created_date: parseTs(get('RegistrationCreatedDate'), dayFirst.RegistrationCreatedDate),
        drawing_name: getAlias(DRAWING_ALIASES).trim() || null,
        subject: getAlias(SUBJECT_ALIASES).trim() || null,
      });
      if (batch.length >= BATCH) await flush();
    });
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

// Sækir skrána af Drive og kallar á onLine(lína) fyrir hverja línu (straumur — 69 MB passar ekki í eitt bil).
async function lesaLinur(fileId, token, onLine) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive download ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '', first = true;
  const ein = async (line) => {
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (first) { first = false; if (line.charCodeAt(0) === 0xFEFF) line = line.slice(1); }   // BOM
    await onLine(line);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      await ein(line);
    }
  }
  buf += decoder.decode();
  if (buf.trim()) await ein(buf);
}

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

// Dagsetning → 'YYYY-MM-DD' eða null. dayFirst ræður skástriki (per dálk, úr umferð 1); tími aftan við er hunsaður.
// Ógild dagsetning (mánuður 24, 31. feb) skilar null — kastar aldrei.
function parseDate(s, dayFirst) {
  if (!s) return null;
  s = String(s).trim().split(' ')[0];
  let m, y, mo, d;
  if ((m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }            // dd-mm-yyyy
  else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }       // yyyy-mm-dd
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {                                         // dd/mm eða mm/dd
    if (dayFirst) { d = +m[1]; mo = +m[2]; } else { mo = +m[1]; d = +m[2]; }
    y = +m[3];
  }
  else if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }     // dd.mm.yyyy
  else return null;
  if (mo < 1 || mo > 12 || d < 1) return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseTs(s, dayFirst) {
  const d = parseDate(s, dayFirst);
  return d ? d + 'T00:00:00.000Z' : null;
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
