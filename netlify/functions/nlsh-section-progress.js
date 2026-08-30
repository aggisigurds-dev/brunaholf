// GET  /api/nlsh-section-progress
//   → { project, drawing_backfilled, dual_policy, note, sections[], unmapped[] }
//
// POST /api/nlsh-section-progress  { planned: { "4h-s1": 120, ... } }
//   saves Áætlað per section in app_kv (always-allow-save).
//
// done = distinct Ajour serials with registration_status='Done', mapped
// drawing_name → 8 sections. Not per-room. Until drawing_name is backfilled
// (re-ingest after ALTER), done is null on every cell.

const {
  SECTIONS,
  DUAL_POLICY,
  tallyBySection,
  sectionStatus,
  crewCopy,
} = require('./nlsh-section-map');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NLSH_AJOUR = 'NLSH 5-6. hæð';
const PLANNED_KEY = 'nlsh_section_planned';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod === 'POST') return savePlanned(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  let planned = {};
  try { planned = await readPlanned(); } catch (_) { planned = {}; }

  let rows;
  let drawingColumn = true;
  try {
    rows = await fetchAll(
      'ajour_registrations',
      `select=serial_number,registration_status,drawing_name&project_name=eq.${encodeURIComponent(NLSH_AJOUR)}`
    );
  } catch (e) {
    const msg = String(e.message || e);
    if (/drawing_name/i.test(msg) && /does not exist|schema cache|42703/i.test(msg)) {
      drawingColumn = false;
      try {
        rows = await fetchAll(
          'ajour_registrations',
          `select=serial_number,registration_status&project_name=eq.${encodeURIComponent(NLSH_AJOUR)}`
        );
      } catch (e2) {
        return json(502, { error: e2.message });
      }
    } else {
      return json(502, { error: msg });
    }
  }

  const tally = tallyBySection(drawingColumn ? rows : rows.map((r) => ({ ...r, drawing_name: null })));
  const backfilled = drawingColumn && tally.drawingBackfilled;

  const sections = SECTIONS.map((s) => {
    const plannedN = Math.max(0, Math.round(Number(planned[s.id]) || 0));
    const bucket = tally.byId[s.id];
    const done = backfilled ? bucket.doneSerials.size : null;
    const open = backfilled ? bucket.openSerials.size : null;
    const left = done == null ? null : Math.max(0, plannedN - done);
    const drawings = Object.entries(bucket.drawings).map(([name, c]) => ({
      name, done: c.done, open: c.open,
    }));
    const sharedFrom = bucket.sharedFrom
      ? (SECTIONS.find((x) => x.id === bucket.sharedFrom) || {}).label || bucket.sharedFrom
      : null;
    return {
      id: s.id,
      label: s.label,
      floor: s.floor,
      planned: plannedN,
      done,
      open,
      left,
      status: sectionStatus(plannedN, done),
      drawings,
      shared_from: sharedFrom,
      copy: crewCopy(s.label, plannedN, done, left),
    };
  });

  const unmapped = Object.entries(tally.unmapped)
    .map(([drawing, n]) => ({ drawing, serials: n }))
    .sort((a, b) => b.serials - a.serials);

  return json(200, {
    project: NLSH_AJOUR,
    drawing_backfilled: backfilled,
    drawing_column: drawingColumn,
    dual_policy: DUAL_POLICY,
    serials: tally.serials,
    note: backfilled
      ? 'Lokið = distinct Ajour-serial á teikningu, kortlagt á 8 svæði. Tvíteikning (S4+S5, 51-52) telst einu sinni á fyrra vængnum. Ekki herbergi.'
      : 'Teikningarnöfn eru ekki komin inn í ajour_registrations enn — keyrðu Ajour-innsog aftur eftir ALTER. Áætlað má samt vista.',
    sections,
    unmapped: backfilled ? unmapped.filter((u) => u.drawing !== '(engin teikning)') : [],
  });
};

async function readPlanned() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.${PLANNED_KEY}&select=value`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return {};
  const rows = await r.json().catch(() => []);
  const v = rows[0] && rows[0].value;
  return v && typeof v === 'object' ? v : {};
}

async function savePlanned(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Ógilt JSON' }); }
  const incoming = body.planned && typeof body.planned === 'object' ? body.planned : {};
  const current = await readPlanned();
  const next = { ...current };
  for (const s of SECTIONS) {
    if (incoming[s.id] === undefined || incoming[s.id] === null || incoming[s.id] === '') continue;
    const n = Number(incoming[s.id]);
    next[s.id] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json', Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ key: PLANNED_KEY, value: next }),
  });
  if (!r.ok) return json(502, { error: (await r.text()).slice(0, 200) });
  return json(200, { ok: true, planned: next });
}

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items',
      },
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
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
