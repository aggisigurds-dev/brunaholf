// pdf-split.js — split a big PDF that lives in Google Drive into single-page
// PDFs and write them BACK to Drive (into a „<nafn> - stakar" subfolder).
//
//   GET /api/pdf-split?file=<srcId|url>[&dest=<parentFolder>][&folder=<destSubfolder>]
//                      [&offset=N][&limit=M]
//
// Batched + resumable like drive-sort/skjalavarsla (each call ≤ ~10s): the first
// call (no `folder`) creates the output subfolder and returns its id; the UI then
// loops, passing back `folder` + `nextOffset`, uploading `limit` pages per call
// until `done`. Source is small/medium (a few MB) so re-reading it per batch is
// fine. Read + create + upload only — no DB write.
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  try {
    const p = event.queryStringParameters || {};
    const src = fileId(p.file);
    if (!src) return json(400, { error: 'file (Drive PDF id/url) required' });
    const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(p.limit || '8', 10) || 8, 1), 25);
    const token = await freshAccessToken();

    // Source metadata + bytes (re-read each batch — small/medium file).
    const meta = await getMeta(token, src);
    const base = baseName(meta.name);
    const bytes = await download(token, src);
    let doc;
    try { doc = await PDFDocument.load(bytes, { ignoreEncryption: true }); }
    catch (e) { return json(400, { error: 'Ekki lesanleg PDF: ' + (e.message || e) }); }
    const total = doc.getPageCount();
    if (!total) return json(400, { error: 'Engar síður í skránni.' });
    const pad = String(total).length;

    // First call: create the output subfolder next to the source (or in `dest`).
    let folder = p.folder ? fileId(p.folder) : '';
    let folderInfo = null;
    if (!folder) {
      const parent = p.dest ? fileId(p.dest) : ((meta.parents && meta.parents[0]) || '');
      folderInfo = await createFolder(token, parent, base + ' - stakar');
      folder = folderInfo.id;
    }

    const from = offset;
    const to = Math.min(offset + limit, total);
    const results = [];
    for (let i = from; i < to; i++) {
      const out = await PDFDocument.create();
      const [pg] = await out.copyPages(doc, [i]);
      out.addPage(pg);
      const b = await out.save();
      const name = base + ' - bls ' + String(i + 1).padStart(pad, '0') + '.pdf';
      const up = await uploadPdf(token, folder, name, Buffer.from(b));
      results.push({ page: i + 1, name, id: up.id });
    }

    const nextOffset = to;
    const done = nextOffset >= total;
    return json(200, {
      ok: true, total, from, to, processed: results.length, nextOffset, done,
      folder, folderName: (folderInfo && folderInfo.name) || (base + ' - stakar'),
      folderLink: (folderInfo && folderInfo.webViewLink) || ('https://drive.google.com/drive/folders/' + folder),
      base, results,
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
