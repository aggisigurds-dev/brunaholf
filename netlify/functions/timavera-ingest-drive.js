// timavera-ingest-drive.js — ingest a "Tímaveru vinnufærslur*.xlsx" export
// straight from Google Drive into timavera_entries. The web-runnable twin of
// luna-bridge/timavera-bridge.js — SAME column matching, SAME entry_key, SAME
// dedupe — so Drive uploads and the desktop script are interchangeable.
//
//   GET /api/timavera-ingest-drive[?fileId=ID]
//     (no fileId → newest file whose name contains "vinnufærslur")
//     → { ok, file, parsed, upserted, skipped }

const XLSX = require('xlsx');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH = 500;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  const p = event.queryStringParameters || {};

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    let fileId = (p.fileId || '').trim(), fileName = '';
    if (!fileId) {
      const found = await newestByName(token, 'vinnufærslur', p.folder);
      if (!found) return json(404, { error: 'Engin "Tímaveru vinnufærslur" skrá fannst í Drive.' });
      fileId = found.id; fileName = found.name;
    }
    const buf = await download(fileId, token);
    if (!fileName) fileName = fileId;

    const rows = loadRows(buf);
    if (!rows.length) return json(200, { ok: true, file: fileName, parsed: 0, upserted: 0, note: 'Engar gildar línur.' });

    // Dedupe by entry_key (duplicate rows in the export trip Supabase upsert).
    const seen = new Map();
    for (const r of rows) seen.set(r.entry_key, r);
    const uniq = [...seen.values()];

    let upserted = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < uniq.length; i += BATCH) {
      const slice = uniq.slice(i, i + BATCH).map(r => ({ ...r, source_file: fileName, imported_at: now }));
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

    // Stamp timavera_meta like the desktop bridge does.
    await fetch(`${SUPABASE_URL}/rest/v1/timavera_meta?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ id: 1, last_import: now, source_file: fileName + ' (drive)' }),
    }).catch(() => {});

    return json(200, { ok: true, file: fileName, parsed: rows.length, upserted, skipped: rows.length - uniq.length });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function newestByName(token, needle, folder) {
  const qParts = [`name contains '${needle}'`, 'trashed=false'];
  if (folder) qParts.unshift(`'${folder.replace(/'/g, "\\'")}' in parents`);
  const params = new URLSearchParams({
    q: qParts.join(' and '), orderBy: 'modifiedTime desc',
    fields: 'files(id,name)', pageSize: '1',
    includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
  });
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Drive search ' + r.status);
  const d = await r.json();
  return (d.files || [])[0] || null;
}
async function download(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Drive download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// ── Parsing — mirrors luna-bridge/timavera-bridge.js exactly ─────────────────
function excelDateToIso(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}
function pickColumn(headers, candidates) {
  for (const cand of candidates) {
    const idx = headers.findIndex(h => (h || '').toString().toLowerCase().includes(cand.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}
function loadRows(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (data.length < 2) return [];
  const headers = data[0].map(h => h == null ? '' : String(h));
  const dateCol  = pickColumn(headers, ['dagsetning', 'date']);
  const inCol    = pickColumn(headers, ['inn']);
  const outCol   = pickColumn(headers, ['út', 'ut', 'out']);
  const hoursCol = pickColumn(headers, ['tímar', 'timar', 'hours']);
  const empCol   = pickColumn(headers, ['starfsma', 'employee', 'staff']);
  const projCol  = pickColumn(headers, ['verkefn', 'project', 'workplace']);
  const missing = [];
  if (dateCol === -1) missing.push('date');
  if (hoursCol === -1) missing.push('hours');
  if (empCol === -1) missing.push('employee');
  if (projCol === -1) missing.push('project');
  if (missing.length) throw new Error(`Fann ekki dálka: ${missing.join(', ')}. Hausar: ${headers.join(' | ')}`);

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const isoDate = excelDateToIso(r[dateCol]);
    if (!isoDate) continue;
    const employee = (r[empCol] || '').toString().trim();
    const project  = (r[projCol] || '').toString().trim();
    if (!employee || !project) continue;
    const hours = Number(r[hoursCol]) || 0;
    if (hours <= 0) continue;
    const timeIn  = r[inCol]  != null ? String(r[inCol]).trim()  : null;
    const timeOut = r[outCol] != null ? String(r[outCol]).trim() : null;
    rows.push({
      entry_key: `${isoDate}|${employee.toLowerCase()}|${project.toLowerCase()}|${timeIn || ''}`,
      date: isoDate, time_in: timeIn, time_out: timeOut,
      hours: Math.round(hours * 1000) / 1000,
      employee, project,
    });
  }
  return rows;
}
