// automations.js — ⚙️ Sjálfvirkni control board.
//
//   GET  /api/automations
//     → { jobs: [ {…automation_jobs fields…, last_run:{status,detail,source,finished_at}|null } ] }
//        Only enabled jobs; each carries its single most-recent automation_runs row.
//
//   POST /api/automations  { action, ... }
//     • action:'register' { name,label,description,command,url,schedule,runner }
//         → upsert automation_jobs ON CONFLICT (name) (merge-duplicates).
//     • action:'run'      { job_name, status, detail, source, started_at?, finished_at? }
//         → insert one automation_runs row (DB default fills finished_at when omitted).
//     • action:'toggle'   { name, enabled }
//         → PATCH automation_jobs.enabled.
//
// A registry of the hub's scheduled/triggered automations (e.g. the Ajour→NLSH
// Drive ingest) plus a run-status log, so the board can show a traffic light +
// "síðast keyrt" per job and hand out copy-paste run commands / share links.
//
// Tables ALREADY EXIST (do not create here):
//   automation_jobs (name UNIQUE, label, description, command, url, schedule,
//                    runner, enabled, created_at, updated_at)
//   automation_runs (job_name, status[running|success|error], detail, source,
//                    started_at, finished_at)  — index (job_name, finished_at desc)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'GET') return handleGet();
  if (event.httpMethod === 'POST') return handlePost(event);
  return json(405, { error: 'Method not allowed' });
};

async function handleGet() {
  let jobs;
  try {
    jobs = await fetchAll('automation_jobs',
      'select=id,name,label,description,command,url,schedule,runner,enabled,created_at,updated_at'
      + '&enabled=eq.true&order=label.asc.nullslast,name.asc');
  } catch (e) { return json(502, { error: e.message }); }

  // Attach the latest run per job (one tiny query each — the job list is small).
  for (const j of jobs) {
    try {
      j.last_run = await latestRun(j.name);
    } catch (_) { j.last_run = null; }
  }
  return json(200, { generated_at: new Date().toISOString(), jobs });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { error: 'Invalid JSON' }); }
  const action = body.action;

  if (action === 'register') {
    const j = body.job || body;
    const name = String(j.name || '').trim();
    if (!name) return json(400, { error: 'name required' });
    const rowRaw = {
      name,
      label: j.label != null ? String(j.label) : name,
      description: j.description != null ? String(j.description) : null,
      command: j.command != null ? String(j.command) : null,
      url: j.url != null ? String(j.url) : null,
      schedule: j.schedule != null ? String(j.schedule) : null,
      runner: j.runner != null ? String(j.runner) : null,
      updated_at: new Date().toISOString(),
    };
    // Don't overwrite existing columns with nulls on conflict.
    const row = {};
    for (const k of Object.keys(rowRaw)) if (rowRaw[k] !== null) row[k] = rowRaw[k];
    try {
      const r = await sbFetch('automation_jobs?on_conflict=name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      const out = await r.json();
      return json(200, { ok: true, job: out[0] || row });
    } catch (e) { return json(502, { error: e.message }); }
  }

  if (action === 'run') {
    const jobName = String(body.job_name || body.name || '').trim();
    if (!jobName) return json(400, { error: 'job_name required' });
    const status = String(body.status || 'success').trim();
    const row = { job_name: jobName, status };
    if (body.detail != null) row.detail = String(body.detail);
    if (body.source != null) row.source = String(body.source);
    if (body.started_at) row.started_at = body.started_at;
    if (body.finished_at) row.finished_at = body.finished_at; // else DB default = now()
    try {
      const r = await sbFetch('automation_runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      const out = await r.json();
      return json(200, { ok: true, run: out[0] || row });
    } catch (e) { return json(502, { error: e.message }); }
  }

  if (action === 'toggle') {
    const name = String(body.name || '').trim();
    if (!name) return json(400, { error: 'name required' });
    const enabled = !!body.enabled;
    try {
      const r = await sbFetch(`automation_jobs?name=eq.${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ enabled, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      const out = await r.json();
      return json(200, { ok: true, job: out[0] || { name, enabled } });
    } catch (e) { return json(502, { error: e.message }); }
  }

  return json(400, { error: 'Unknown action' });
}

async function latestRun(jobName) {
  const qs = `automation_runs?job_name=eq.${encodeURIComponent(jobName)}`
    + '&select=status,detail,source,finished_at&order=finished_at.desc.nullslast&limit=1';
  const r = await sbFetch(qs, { headers: { Range: '0-0', 'Range-Unit': 'items' } });
  if (!r.ok) throw new Error(`automation_runs: ${r.status}`);
  const page = await r.json();
  return page.length ? page[0] : null;
}

function sbFetch(qs, opts = {}) {
  const headers = Object.assign(
    { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    opts.headers || {},
  );
  return fetch(`${SUPABASE_URL}/rest/v1/${qs}`, { ...opts, headers });
}

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await sbFetch(`${table}?${qs}`, {
      headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
