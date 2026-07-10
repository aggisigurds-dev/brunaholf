// timavera-pull.js — pull work logs STRAIGHT from the Tímavera Customer API
// (api.timavera.is/api/v1, read-only Bearer key) and upsert them into
// `timavera_entries` — the CLOUD replacement for the desktop scraper +
// xlsx-from-Drive paths. Same dedupe key as luna-bridge/timavera-bridge.js
// (`date|employee.toLowerCase()|project.toLowerCase()|time_in`), so all three
// ingest paths are interchangeable with no duplicate rows.
//
//   GET /api/timavera-pull?probe=1
//     → auth check only: GET /employees + /projects, returns counts + names,
//       NO DB write. Run this first after setting the key.
//
//   GET /api/timavera-pull?dry=1[&days=N]
//     → fetch + map worklogs (default 14 days back), return rows, NO upsert.
//
//   GET /api/timavera-pull[?days=N|&from=YYYY-MM-DD&to=YYYY-MM-DD]
//     → real run: fetch → map → upsert on_conflict=entry_key, stamp
//       timavera_meta, log automation_runs(job_name='timavera-pull').
//
//   POST /api/timavera-pull {action:'set-key', key:'tv_live_…'}
//     → store the API key server-side in app_kv['timavera_api_key'] (the
//       Bakendi card posts this — Agnar opens the 1Password share link and
//       pastes the key once). {action:'clear-key'} removes it.
//       Key resolution order: TIMAVERA_API_KEY env var → app_kv.
//
// API (confirmed from api.timavera.com/docs/tv-docs-2026/openapi.yaml):
//   GET {base}/worklogs?from=ISO&to=ISO  → [{ id, start_time, end_time,
//     total_time (sec, null while open), employee:{name}, project:{name}, … }]
//   Auth: `Authorization: Bearer tv_live_…`. No pagination (range-limited).
//   Iceland is UTC year-round, so UTC clock time == local wall time.
//
// Open (still running) entries are SKIPPED — they have no end_time/total_time
// yet; the next run picks them up once closed (same as the xlsx export).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = (process.env.TIMAVERA_API_BASE || 'https://api.timavera.is/api/v1').replace(/\/+$/, '');

const JOB_NAME = 'timavera-pull';
const KV_KEY = 'timavera_api_key';
const BATCH = 400;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar.' });

  if (event.httpMethod === 'POST') return handlePost(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET/POST only' });

  const p = event.queryStringParameters || {};
  const isProbe = p.probe === '1' || p.probe === 'true';
  const isDry = p.dry === '1' || p.dry === 'true';

  const apiKey = process.env.TIMAVERA_API_KEY || (await readKvKey());
  if (!apiKey) {
    return json(409, {
      error: 'Enginn Tímavera API-lykill. Límdu lykilinn (tv_live_…) inn í Bakendi „🕒 Tímavera API" kortið — hann geymist í app_kv.',
      need_key: true,
    });
  }

  // Date range: ?from/?to override, else ?days back from now (default 14, max 366).
  const days = clampInt(p.days, 14, 1, 366);
  const now = new Date();
  const from = isoOrNull(p.from) || new Date(now.getTime() - days * 86400e3).toISOString();
  const to = isoOrNull(p.to) || now.toISOString();

  try {
    if (isProbe) {
      const [emps, projs] = await Promise.all([tvGet(apiKey, '/employees'), tvGet(apiKey, '/projects')]);
      return json(200, {
        ok: true, probe: true,
        employees: emps.length,
        employee_names: emps.slice(0, 30).map(e => e.name),
        projects: projs.length,
        project_names: projs.slice(0, 30).map(pr => pr.name),
      });
    }

    const started = new Date().toISOString();
    const logs = await tvGet(apiKey, '/worklogs?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));

    let openSkipped = 0, badSkipped = 0;
    const byKey = new Map();
    for (const w of logs) {
      const row = mapWorkLog(w);
      if (row === 'open') { openSkipped++; continue; }
      if (!row) { badSkipped++; continue; }
      byKey.set(row.entry_key, row); // in-batch dedupe, last wins (same as bridge)
    }
    const rows = Array.from(byKey.values());

    if (isDry) {
      return json(200, {
        ok: true, dry: true, from, to,
        fetched: logs.length, mapped: rows.length,
        open_skipped: openSkipped, bad_skipped: badSkipped,
        sample: rows.slice(0, 12),
      });
    }

    let upserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const u = await fetch(`${SUPABASE_URL}/rest/v1/timavera_entries?on_conflict=entry_key`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(slice),
      });
      if (!u.ok) throw new Error('Upsert ' + u.status + ': ' + (await u.text()).slice(0, 200));
      upserted += slice.length;
    }

    // Stamp timavera_meta like the desktop bridge + Drive path do.
    await fetch(`${SUPABASE_URL}/rest/v1/timavera_meta?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ id: 1, last_import: new Date().toISOString(), source_file: 'timavera-api' }),
    }).catch(() => {});

    await logRun({ status: 'success', detail: upserted + ' færslur (' + from.slice(0, 10) + '→' + to.slice(0, 10) + ')', started_at: started });
    return json(200, { ok: true, from, to, fetched: logs.length, upserted, open_skipped: openSkipped, bad_skipped: badSkipped });
  } catch (e) {
    const msg = String(e.message || e);
    if (!isProbe && !isDry) await logRun({ status: 'error', detail: msg.slice(0, 300), started_at: new Date().toISOString() }).catch(() => {});
    const code = /(^|\s)401\b/.test(msg) ? 401 : 500;
    return json(code, { error: msg, hint: code === 401 ? 'Lykillinn er rangur, útrunninn eða afturkallaður — límdu nýjan inn í Bakendi.' : undefined });
  }
};

// ---- POST: key management ----------------------------------------------------

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Ógilt JSON í body' }); }
  const action = body.action || '';

  if (action === 'set-key') {
    const key = String(body.key || '').trim();
    if (!/^tv_[A-Za-z0-9_\-]{8,}$/.test(key)) {
      return json(400, { error: 'Lykillinn á að byrja á „tv_" (t.d. tv_live_…) — athugaðu afritunina.' });
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key: KV_KEY, value: { key }, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return json(500, { error: 'Gat ekki vistað lykilinn: ' + r.status });
    return json(200, { ok: true, saved: true });
  }

  if (action === 'clear-key') {
    await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.${KV_KEY}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    return json(200, { ok: true, cleared: true });
  }

  if (action === 'has-key') {
    const k = process.env.TIMAVERA_API_KEY || (await readKvKey());
    return json(200, { ok: true, has_key: !!k, source: process.env.TIMAVERA_API_KEY ? 'env' : (k ? 'app_kv' : null) });
  }

  return json(400, { error: 'Óþekkt action' });
}

async function readKvKey() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.${KV_KEY}&select=value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows.length && rows[0].value && rows[0].value.key) || null;
  } catch (_) { return null; }
}

// ---- Tímavera API -------------------------------------------------------------

async function tvGet(apiKey, path) {
  const r = await fetch(API_BASE + path, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 200);
    throw new Error(`Tímavera ${r.status} á ${path.split('?')[0]}: ${txt}`);
  }
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error('Óvænt svar frá Tímaveru (ekki fylki) á ' + path.split('?')[0]);
  return data;
}

// Map one API work log → a timavera_entries row (bridge-compatible).
// Returns 'open' for still-running entries, null for unusable ones.
function mapWorkLog(w) {
  if (!w || typeof w !== 'object') return null;
  if (!w.end_time || w.total_time == null) return 'open';
  const employee = String((w.employee && w.employee.name) || '').trim();
  const project = String((w.project && w.project.name) || '').trim();
  if (!employee || !project) return null;
  const hours = Number(w.total_time) / 3600;
  if (!(hours > 0)) return null;
  const start = new Date(w.start_time);
  const end = new Date(w.end_time);
  if (isNaN(start.getTime())) return null;
  // Iceland = UTC year-round → UTC clock time is the local wall time,
  // matching the times in the Tímavera xlsx export (bridge path).
  const date = utcDate(start);
  const timeIn = utcHm(start);
  const timeOut = isNaN(end.getTime()) ? null : utcHm(end);
  return {
    entry_key: `${date}|${employee.toLowerCase()}|${project.toLowerCase()}|${timeIn}`,
    date,
    time_in: timeIn,
    time_out: timeOut,
    hours: Math.round(hours * 1000) / 1000,
    employee,
    project,
    source_file: 'timavera-api',
  };
}

function utcDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
function utcHm(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// ---- Automation logging --------------------------------------------------------

async function logRun({ status, detail, started_at }) {
  await fetch(`${SUPABASE_URL}/rest/v1/automation_runs`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      job_name: JOB_NAME, status, detail: detail || null,
      source: 'netlify', started_at, finished_at: new Date().toISOString(),
    }]),
  }).catch(() => {});
}

// ---- Helpers -------------------------------------------------------------------

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
function json(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
function clampInt(v, def, lo, hi) {
  const n = parseInt(v, 10); if (!isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
function isoOrNull(v) {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
