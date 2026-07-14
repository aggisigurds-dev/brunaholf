// storage-backup-background.js — append-only backup of Supabase document PDFs
// into a Google Drive backup folder, so the úttektarskýrslur + reikningar (and
// Efnislisti/Tímaskýrsla PDFs) are never held in a single unbacked store.
//
// WHY: new úttekt reports/invoices are stored canonically in Supabase Storage
// (samningar bucket via slokkvitaeki patch 233; efnislisti-pdf via pdf-store).
// This mirrors each NEW object to Drive exactly once (never moves/renames — so
// no dead-link risk), giving a durable second copy the office can also browse.
//
// Trigger: scheduled daily (netlify.toml) OR manual GET
//   /.netlify/functions/storage-backup-background  (background → returns 202)
//   ?dry=1  → do NOT upload; just log to automation_runs how many are pending.
//
// Enumerates the AUTHORITATIVE doc paths from the DB (not a recursive storage
// walk): company_attachments (app_settings blob) for `samningar`, and
// efnislisti_documents.storage_path for `efnislisti-pdf`. Signature PNGs are
// intentionally NOT backed up (low value, live in the public bucket).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY + Google OAuth via _google.js.

const { freshAccessToken } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ROOT_FOLDER_NAME = 'Slökkvitæki – skjöl backup';
const BUCKETS = ['samningar', 'efnislisti-pdf'];
const MAX_PER_RUN = 600; // safety cap per invocation

const sb = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: {
    apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json', ...(opts.headers || {}),
  },
});

exports.handler = async (event) => {
  const qp = event.queryStringParameters || {};
  const dry = qp.dry === '1' || qp.dry === 'true';
  const started = new Date().toISOString();
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env vantar');

    // 1) Gather authoritative doc paths per bucket from the DB.
    const wanted = await gatherWantedPaths();               // [{bucket, path}]
    // 2) Subtract what's already backed up.
    const done = await loadBackedUpKeys();                  // Set('bucket\npath')
    const pending = wanted.filter(w => !done.has(w.bucket + '\n' + w.path));

    if (dry) {
      await logRun('success', `DRY: ${pending.length} pending af ${wanted.length} skjölum`, started);
      return { statusCode: 200, body: JSON.stringify({ ok: true, dry: true, wanted: wanted.length, pending: pending.length }) };
    }
    if (!pending.length) {
      await logRun('success', `Ekkert nýtt — ${wanted.length} skjöl þegar afrituð`, started);
      return { statusCode: 200, body: JSON.stringify({ ok: true, backed_up: 0, total: wanted.length }) };
    }

    // 3) Drive: ensure root + per-bucket subfolders.
    const token = await freshAccessToken();
    const rootId = await ensureFolder(token, ROOT_FOLDER_NAME, null);
    const folderFor = {};
    for (const b of BUCKETS) folderFor[b] = await ensureFolder(token, b, rootId);

    // 4) Copy each pending object: download from Supabase → upload to Drive → log.
    let ok = 0, fail = 0;
    for (const item of pending.slice(0, MAX_PER_RUN)) {
      try {
        const bytes = await downloadObject(item.bucket, item.path);
        if (!bytes) { fail++; continue; }
        const name = (item.path.split('/').pop() || 'skjal').replace(/^\d+_/, '');
        const driveId = await uploadToDrive(token, folderFor[item.bucket], name, bytes, item.path);
        await sb('storage_backup_log', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ bucket: item.bucket, path: item.path, drive_file_id: driveId, size_bytes: bytes.length, backed_up_at: new Date().toISOString() }),
        });
        ok++;
      } catch (e) { fail++; }
    }

    const remaining = pending.length - ok;
    await logRun(fail ? 'error' : 'success', `Afritað ${ok} skjöl í Drive (${fail} villur, ${remaining} eftir)`, started);
    return { statusCode: 200, body: JSON.stringify({ ok: true, backed_up: ok, failed: fail, remaining, total: wanted.length }) };
  } catch (e) {
    await logRun('error', String(e.message || e), started).catch(() => {});
    return { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};

// ── enumerate doc paths ─────────────────────────────────────────────────────
async function gatherWantedPaths() {
  const out = [];
  // samningar — company_attachments lives in the app_settings blob (id=1).
  try {
    const r = await sb('app_settings?id=eq.1&select=settings');
    const rows = await r.json();
    const ca = rows[0] && rows[0].settings && rows[0].settings.company_attachments;
    if (ca && typeof ca === 'object') {
      Object.values(ca).forEach(list => {
        if (Array.isArray(list)) list.forEach(a => {
          if (a && a.path && !/\.(png|jpg|jpeg)$/i.test(a.path)) out.push({ bucket: 'samningar', path: a.path });
        });
      });
    }
  } catch (_) {}
  // efnislisti-pdf — efnislisti_documents.storage_path (skip Drive-hosted rows).
  try {
    let from = 0; const page = 1000;
    while (true) {
      const r = await sb(`efnislisti_documents?storage_path=not.is.null&select=storage_path&limit=${page}&offset=${from}`);
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) break;
      rows.forEach(x => { if (x.storage_path) out.push({ bucket: 'efnislisti-pdf', path: x.storage_path }); });
      if (rows.length < page) break;
      from += page;
    }
  } catch (_) {}
  // de-dup within the wanted list
  const seen = new Set(); const uniq = [];
  for (const w of out) { const k = w.bucket + '\n' + w.path; if (!seen.has(k)) { seen.add(k); uniq.push(w); } }
  return uniq;
}

async function loadBackedUpKeys() {
  const set = new Set();
  let from = 0; const page = 1000;
  while (true) {
    const r = await sb(`storage_backup_log?select=bucket,path&limit=${page}&offset=${from}`);
    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) break;
    rows.forEach(x => set.add(x.bucket + '\n' + x.path));
    if (rows.length < page) break;
    from += page;
  }
  return set;
}

async function downloadObject(bucket, path) {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/` + path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

// ── Drive helpers (mirror efnislisti-pdf.js) ────────────────────────────────
async function ensureFolder(token, name, parentId) {
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${parentClause}`);
  const find = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } });
  const fj = await find.json();
  if (fj.files && fj.files[0]) return fj.files[0].id;
  const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];
  const mk = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  const mj = await mk.json();
  if (!mj.id) throw new Error('Drive folder create failed: ' + JSON.stringify(mj).slice(0, 200));
  return mj.id;
}

async function uploadToDrive(token, folderId, fileName, buf, path) {
  const mime = /\.png$/i.test(path) ? 'image/png' : /\.(jpg|jpeg)$/i.test(path) ? 'image/jpeg' : 'application/pdf';
  const boundary = 'bh_' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: mime });
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, 'utf8');
  const post = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const multipart = Buffer.concat([pre, buf, post]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(multipart.length) }, body: multipart });
  const j = await r.json();
  if (!j.id) throw new Error('Drive upload failed: ' + JSON.stringify(j).slice(0, 200));
  return j.id;
}

async function logRun(status, detail, started) {
  return sb('automation_runs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ job_name: 'storage-backup', status, detail, source: 'netlify', started_at: started }),
  }).catch(() => {});
}
