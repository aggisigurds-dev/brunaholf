// pdf-split.js — split a big PDF that lives in Google Drive into single-page
// PDFs and write them BACK to Drive (into a „<nafn> - stakar" subfolder).
//
//   GET /api/pdf-split?file=<srcId|url>[&dest=<parentFolder>][&folder=<destSubfolder>]
//                      [&offset=N][&limit=M]
//
// TWO modes, auto-detected from the `file` id's mimeType:
//   • FILE   — `file` is one PDF → split it into single pages.
//   • FOLDER — `file` is a Drive FOLDER → split EVERY PDF in it, one file at a
//     time, each into its own „<nafn> - stakar" subfolder. Thread `fi` (file
//     index) + `offset` (page within that file) + `folder` (that file's output
//     subfolder) back on each call, just like the file-mode `offset`/`folder`.
//
// Batched + resumable (each call ≤ ~10s): the first call for a file (no `folder`)
// creates the output subfolder and returns its id; the UI then loops, passing back
// `fi`/`offset`/`folder`, uploading `limit` pages per call until `done`. Source is
// small/medium (a few MB) so re-reading it per batch is fine. Read + create +
// upload only — no DB write.
const { PDFDocument } = require('pdf-lib');
const { freshAccessToken, json, cors } = require('./_google');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
function fileId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }
function baseName(name) {
  return String(name || 'skjal').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 90) || 'skjal';
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Drive fetch with backoff on 403/429/5xx (rate limits / transient errors).
async function driveFetch(url, opts, tries = 5) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, opts);
    if (r.ok || (r.status !== 403 && r.status !== 429 && r.status < 500) || i >= tries - 1) return r;
    await sleep(400 * Math.pow(2, i));
  }
}

async function getMeta(token, id) {
  const r = await driveFetch('https://www.googleapis.com/drive/v3/files/' + id +
    '?fields=id,name,parents,mimeType&supportsAllDrives=true', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('meta ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r.json();
}
// List direct-child PDFs of a folder (sorted by name). Output „- stakar" subfolders
// are folders, so they are never returned — re-listing across batches is stable.
async function listPdfs(token, folderId) {
  const files = [];
  let pageToken = '';
  const q = `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`;
  do {
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) +
      '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType)') +
      '&pageSize=1000&orderBy=name_natural&supportsAllDrives=true&includeItemsFromAllDrives=true' +
      (pageToken ? '&pageToken=' + pageToken : '');
    const r = await driveFetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('list ' + r.status + ': ' + (await r.text()).slice(0, 160));
    const j = await r.json();
    for (const f of (j.files || [])) {
      if (f.mimeType === 'application/pdf' || /\.pdf$/i.test(f.name || '')) files.push(f);
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return files;
}
async function download(token, id) {
  const r = await driveFetch('https://www.googleapis.com/drive/v3/files/' + id +
    '?alt=media&supportsAllDrives=true', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('download ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return Buffer.from(await r.arrayBuffer());
}
async function createFolder(token, parent, name) {
  const body = { name, mimeType: FOLDER_MIME };
  if (parent) body.parents = [parent];
  const r = await driveFetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('mkdir ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r.json();
}
async function uploadPdf(token, parent, name, bytes) {
  const boundary = 'bh' + Math.random().toString(16).slice(2);
  const meta = JSON.stringify({ name, parents: [parent] });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
  const foot = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(bytes), Buffer.from(foot, 'utf8')]);
  const r = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  if (!r.ok) throw new Error('upload ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r.json();
}

// Split one file's pages [offset, offset+limit) → single-page PDFs in `folderIn`
// (created under `parent` if empty). Re-reads the source PDF per batch. Throws on
// an unreadable/encrypted PDF so the caller decides (abort in file mode / skip in
// folder mode).
async function splitBatch(token, id, name, offset, limit, folderIn, parent) {
  const base = baseName(name);
  const bytes = await download(token, id);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = doc.getPageCount();
  if (!total) return { total: 0, base, results: [], folder: folderIn || '', folderInfo: null, from: offset, to: offset };
  const pad = String(total).length;
  let folder = folderIn, folderInfo = null;
  if (!folder) { folderInfo = await createFolder(token, parent, base + ' - stakar'); folder = folderInfo.id; }
  const from = offset, to = Math.min(offset + limit, total);
  const results = [];
  for (let i = from; i < to; i++) {
    const out = await PDFDocument.create();
    const [pg] = await out.copyPages(doc, [i]);
    out.addPage(pg);
    const b = await out.save();
    const nm = base + ' - bls ' + String(i + 1).padStart(pad, '0') + '.pdf';
    const up = await uploadPdf(token, folder, nm, Buffer.from(b));
    results.push({ page: i + 1, name: nm, id: up.id });
  }
  return { total, base, results, folder, folderInfo, from, to };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  try {
    const p = event.queryStringParameters || {};
    const src = fileId(p.file);
    if (!src) return json(400, { error: 'file (Drive PDF- eða möppu-id/hlekkur) required' });
    const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(p.limit || '8', 10) || 8, 1), 25);
    const token = await freshAccessToken();

    const meta = await getMeta(token, src);

    // `inplace` = write the single pages straight into the same folder, NO new
    // „- stakar" subfolders (Agnar: „splitti ekki upp í aðrar möppur").
    const inplace = p.inplace === '1' || p.inplace === 'true';

    // ── FOLDER MODE — split every PDF in the folder, one file at a time. ──
    if (meta.mimeType === FOLDER_MIME) {
      const all = await listPdfs(token, src);
      // In-place mode dumps outputs back into THIS folder, so exclude our own
      // single-page products („… - bls NN.pdf") from the work list — otherwise a
      // later batch would try to re-split a 1-page output.
      const files = inplace ? all.filter(f => !/ - bls \d+\.pdf$/i.test(f.name || '')) : all;
      if (!files.length) return json(400, { error: 'Engar PDF-skrár í möppunni.' });
      const fi = Math.max(parseInt(p.fi || '0', 10) || 0, 0);
      if (fi >= files.length) {
        return json(200, { ok: true, mode: 'folder', inplace, fileCount: files.length, fi, nextFi: fi, nextOffset: null, nextFolder: '', done: true, processed: 0, results: [] });
      }
      const cur = files[fi];
      // in-place → target = the source folder itself (folderIn set ⇒ no subfolder created).
      const folderIn = inplace ? src : (p.folder ? fileId(p.folder) : '');
      const parent = p.dest ? fileId(p.dest) : src; // „- stakar" subfolders live inside the source folder (or dest)
      let b;
      try { b = await splitBatch(token, cur.id, cur.name, offset, limit, folderIn, parent); }
      catch (e) {
        // Unreadable PDF → skip this file, advance to the next one.
        const nextFi = fi + 1;
        return json(200, {
          ok: true, mode: 'folder', inplace, fileCount: files.length, fi, fileName: cur.name,
          total: 0, from: 0, to: 0, processed: 0, fileError: 'Ekki lesanleg PDF: ' + (e.message || e),
          nextFi, nextOffset: nextFi >= files.length ? null : 0, nextFolder: '', done: nextFi >= files.length, results: [],
        });
      }
      const fileMore = b.to < b.total;
      const nextFi = fileMore ? fi : fi + 1;
      return json(200, {
        ok: true, mode: 'folder', inplace, fileCount: files.length, fi, fileName: cur.name,
        total: b.total, from: b.from, to: b.to, processed: b.results.length,
        folder: b.folder,
        folderName: inplace ? (meta.name || 'sama mappa') : ((b.folderInfo && b.folderInfo.name) || (b.base + ' - stakar')),
        folderLink: b.folder ? 'https://drive.google.com/drive/folders/' + b.folder : '',
        nextFi, nextOffset: fileMore ? b.to : (nextFi >= files.length ? null : 0), nextFolder: fileMore ? b.folder : '',
        done: !fileMore && nextFi >= files.length, results: b.results,
      });
    }

    // ── Google Docs Editors file (Doc/Sheet/Slide) → NOT a binary PDF, can't split. ──
    if (/^application\/vnd\.google-apps\./.test(meta.mimeType || '')) {
      return json(400, { error: 'Þetta er Google Docs-skjal (' + meta.mimeType + '), ekki venjuleg PDF-skrá sem hægt er að splitta. Veldu upprunalegu PDF-skrána (eða heila möppu af PDF-um).' });
    }

    // ── SINGLE-FILE MODE (default: new „- stakar" subfolder; inplace: same folder). ──
    const srcParent = p.dest ? fileId(p.dest) : ((meta.parents && meta.parents[0]) || '');
    // in-place → target = the source's own folder (folderIn set ⇒ no subfolder created).
    const folderIn = inplace ? srcParent : (p.folder ? fileId(p.folder) : '');
    let b;
    try { b = await splitBatch(token, src, meta.name, offset, limit, folderIn, srcParent); }
    catch (e) { return json(400, { error: 'Ekki lesanleg PDF: ' + (e.message || e) }); }
    if (!b.total) return json(400, { error: 'Engar síður í skránni.' });
    const done = b.to >= b.total;
    return json(200, {
      ok: true, mode: 'file', inplace, fileCount: 1, fi: 0, fileName: meta.name,
      total: b.total, from: b.from, to: b.to, processed: b.results.length,
      nextFi: 0, nextOffset: done ? null : b.to, nextFolder: done ? '' : b.folder, done,
      folder: b.folder,
      folderName: inplace ? 'sama mappa' : ((b.folderInfo && b.folderInfo.name) || (b.base + ' - stakar')),
      folderLink: b.folder ? 'https://drive.google.com/drive/folders/' + b.folder : '',
      base: b.base, results: b.results,
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
