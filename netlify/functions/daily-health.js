// daily-health.js — dagleg heilsu-samantekt á gagnaleiðslum (pipeline health).
//
// Segir eiganda (Agnari) þegar gagnaleiðsla verður gömul eða samstilling klikkar,
// svo hann þurfi ekki að opna 🌅 Dagurinn til að sjá það. Reiknar ábendingar
// og — AÐEINS þegar sérstaklega beðið um — sendir þær í tölvupósti.
//
//   GET /api/daily-health            → reikna + skila JSON. SENDIR ENGAN póst.
//   GET /api/daily-health?dry=1       → sama (skýrt þurr-keyrsla).
//   GET /api/daily-health?send=1      → reikna + SENDA póst (ef ábendingar > 0).
//   GET /api/daily-health?send=1&force=1 → senda ALLTAF (líka „allt í lagi").
//
// ÖRYGGI: fallið er sofandi (dormant). Án ?send=1 sendir það ALDREI póst — svo
// óvart-innslag á endapunktinn getur ekki sent tölvupóst. Enginn tímaáætlun er
// skráð í netlify.toml; Agnar skoðar með ?dry og ákveður svo hvort á að tímasetja.
//
// Heimildir:
//   • /api/data-sources-status  — ferskleiki per gagnaból (last_import/newest_real/
//     age_days/status). Reiknað server-hlið; sótt hér yfir HTTP.
//   • automation_runs / automation_jobs — nýjasta keyrsla per starf: villa eða
//     ekkert í >24 klst = flöggun.
//   • /api/email-send  — Resend proxy (POST from/to/subject/html) fyrir ?send=1.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Móttakandi + sendandi eru env-stýrðir; sjálfgildi eru ekki leyndarmál.
const ALERT_TO = process.env.HEALTH_ALERT_TO || 'brunaholf@brunaholf.is';
// Sendandi VERÐUR að vera á staðfestu Resend-léni (eldklar.is).
const ALERT_FROM = process.env.HEALTH_ALERT_FROM || 'Brunahólf <reikningar@eldklar.is>';

// Starf telst „gamalt" ef nýjasta keyrsla er eldri en þetta (klst).
const STALE_JOB_HOURS = 24;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const qs = event.queryStringParameters || {};
  const wantSend = qs.send === '1' || qs.send === 'true';
  const force = qs.force === '1' || qs.force === 'true';

  const origin = `https://${(event.headers && (event.headers.host || event.headers.Host)) || 'brunaholf.netlify.app'}`;
  const checked_at = new Date().toISOString();
  const alerts = [];

  // ---- (a) gagnaból: ferskleiki úr /api/data-sources-status -----------------
  let sources = [];
  try {
    const r = await fetch(`${origin}/api/data-sources-status`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    sources = Array.isArray(data.sources) ? data.sources : [];
    for (const s of sources) {
      const label = s.label || s.key || 'gagnaból';
      const age = s.age_days;
      if (s.status === 'stale') {
        alerts.push(`🔴 ${label} ${ageTxt(age)} — uppfæra${hint(s)}`);
      } else if (s.status === 'aging') {
        alerts.push(`🟠 ${label} ${ageTxt(age)}`);
      } else if (s.status === 'unknown') {
        alerts.push(`🟠 ${label} — engin gögn / óþekkt staða`);
      }
    }
  } catch (e) {
    alerts.push(`🔴 gat ekki lesið gagna-ferskleika: ${errTxt(e)}`);
  }

  // ---- (b) sjálfvirkni: nýjasta keyrsla per starf ---------------------------
  let jobs = [];
  try {
    jobs = await enabledJobsWithLatestRun();
    const nowMs = Date.now();
    for (const j of jobs) {
      const label = j.label || j.name;
      const run = j.last_run;
      if (!run) {
        alerts.push(`🟠 ${label} — aldrei keyrt`);
        continue;
      }
      if (String(run.status).toLowerCase() === 'error') {
        alerts.push(`🔴 ${label} villa${run.detail ? ': ' + trim(run.detail, 120) : ''}`);
        continue;
      }
      const fin = run.finished_at ? Date.parse(run.finished_at) : NaN;
      const ageH = isNaN(fin) ? null : Math.floor((nowMs - fin) / 3600000);
      if (ageH != null && ageH > STALE_JOB_HOURS) {
        alerts.push(`🟠 ${label} — engin keyrsla í ${Math.floor(ageH / 24) >= 1 ? Math.floor(ageH / 24) + ' daga' : ageH + ' klst'}`);
      }
    }
  } catch (e) {
    alerts.push(`🔴 gat ekki lesið sjálfvirkni-keyrslur: ${errTxt(e)}`);
  }

  const ok = alerts.length === 0;
  const summary = ok ? '✅ Allt í lagi' : `${alerts.length} ${alerts.length === 1 ? 'ábending' : 'ábendingar'}`;

  // ---- þurr-keyrsla (sjálfgefið): skila JSON, SENDA ENGAN póst ---------------
  if (!wantSend) {
    return json(200, {
      ok, checked_at, summary,
      alerts: ok ? ['✅ Allt í lagi'] : alerts,
      sources, jobs: jobs.map(slimJob),
      would_email: !ok || force,   // hvað ?send=1 myndi gera núna
    });
  }

  // ---- ?send=1: senda póst ---------------------------------------------------
  // Sjálfgefið sendum við AÐEINS þegar ábendingar eru til staðar (engin
  // dagleg „allt í lagi" spamma). ?force=1 sendir alltaf.
  if (ok && !force) {
    return json(200, {
      ok: true, sent: false, skipped: 'engar ábendingar (notaðu &force=1 til að senda samt)',
      checked_at, alerts: ['✅ Allt í lagi'],
    });
  }

  const subject = ok
    ? 'Brunahólf — dagleg heilsa: ✅ allt í lagi'
    : `Brunahólf — dagleg heilsa: ${alerts.length} ${alerts.length === 1 ? 'ábending' : 'ábendingar'}`;
  const html = buildHtml({ ok, alerts, sources, checked_at });

  try {
    const r = await fetch(`${origin}/api/email-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ALERT_FROM, to: ALERT_TO, subject, html }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) {
      return json(502, { ok: false, sent: false, error: 'EMAIL_FAILED', detail: data, alerts });
    }
    return json(200, { ok: true, sent: true, to: ALERT_TO, id: data.id || null, alerts });
  } catch (e) {
    return json(502, { ok: false, sent: false, error: 'EMAIL_FAILED', message: errTxt(e), alerts });
  }
};

// ---- sjálfvirkni-lestur (speglar automations.js) ----------------------------
async function enabledJobsWithLatestRun() {
  const jobs = await fetchAll('automation_jobs',
    'select=name,label,schedule,enabled&enabled=eq.true&order=label.asc.nullslast,name.asc');
  for (const j of jobs) {
    try { j.last_run = await latestRun(j.name); }
    catch (_) { j.last_run = null; }
  }
  return jobs;
}

async function latestRun(jobName) {
  const q = `automation_runs?job_name=eq.${encodeURIComponent(jobName)}`
    + '&select=status,detail,finished_at&order=finished_at.desc.nullslast&limit=1';
  const r = await sbFetch(q, { headers: { Range: '0-0', 'Range-Unit': 'items' } });
  if (!r.ok) throw new Error(`automation_runs: ${r.status}`);
  const page = await r.json();
  return page.length ? page[0] : null;
}

// ---- HTML-póstur ------------------------------------------------------------
function buildHtml({ ok, alerts, sources, checked_at }) {
  const when = new Date(checked_at).toLocaleString('is-IS');
  const rows = ok
    ? '<li style="margin:4px 0">✅ Allt í lagi — engin ábending.</li>'
    : alerts.map(a => `<li style="margin:4px 0">${esc(a)}</li>`).join('');
  const srcRows = (sources || []).map(s => {
    const dot = s.status === 'fresh' ? '🟢' : s.status === 'aging' ? '🟠' : s.status === 'stale' ? '🔴' : '⚪';
    return `<tr>
      <td style="padding:3px 10px 3px 0">${dot} ${esc(s.label || s.key || '')}</td>
      <td style="padding:3px 0;color:#555">${s.age_days == null ? '—' : esc(ageTxt(s.age_days))}</td>
    </tr>`;
  }).join('');
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;max-width:560px">
    <h2 style="margin:0 0 4px">Brunahólf — dagleg heilsa</h2>
    <div style="color:#666;font-size:13px;margin-bottom:14px">${esc(when)}</div>
    <ul style="padding-left:18px;margin:0 0 18px">${rows}</ul>
    ${srcRows ? `<h3 style="margin:0 0 6px;font-size:14px">Gagnaból</h3>
    <table style="border-collapse:collapse;font-size:14px">${srcRows}</table>` : ''}
    <p style="color:#999;font-size:12px;margin-top:20px">Sjálfvirk samantekt úr Brunahólf-hubinu.</p>
  </div>`;
}

// ---- hjálparar --------------------------------------------------------------
function ageTxt(age) {
  if (age == null) return 'óþekkt aldur';
  if (age <= 0) return 'í dag';
  return `${age} ${age === 1 ? 'dags gömul' : 'daga gömul'}`;
}
function hint(s) { return s && s.file_hint ? ` (${s.file_hint})` : ''; }
function slimJob(j) {
  return { name: j.name, label: j.label || j.name, schedule: j.schedule || null, last_run: j.last_run || null };
}
function trim(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
function errTxt(e) { return String((e && e.message) || e); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
