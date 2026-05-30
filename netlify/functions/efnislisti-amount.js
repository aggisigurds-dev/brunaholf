// efnislisti-amount.js — download one Drive file (Efnislisti / reikningur) and
// extract the "samtals m. vsk" total so the Vinnubók can SUGGEST it.
//
//   GET /api/efnislisti-amount?id=<driveFileId>
//     → { id, name, mime, amount, snippet, labeled_count, number_count }
//
// Heuristic: the grand total (m. vsk) is the largest currency figure in an
// Efnislisti, and usually sits on a line mentioning "m. vsk" / "með vsk" /
// "samtals". We prefer the max number on such a line, else the global max.
// The result is only a suggestion — the user confirms it with one click.

const { freshAccessToken, json, cors } = require('./_google');

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const id = (event.queryStringParameters || {}).id;
  if (!id) return json(400, { error: 'id required' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  // Metadata (name, mime, size)
  let meta;
  try {
    const mr = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,size&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!mr.ok) return json(mr.status, { error: `meta ${mr.status}: ${(await mr.text()).slice(0, 200)}` });
    meta = await mr.json();
  } catch (e) { return json(500, { error: e.message }); }

  const mime = meta.mimeType;
  if (meta.size && Number(meta.size) > MAX_BYTES) {
    return json(413, { error: `file too large (${meta.size} bytes)`, name: meta.name, mime });
  }

  // Fetch bytes (native Google Sheets must be exported to xlsx)
  let buf;
  try {
    let url;
    if (mime === 'application/vnd.google-apps.spreadsheet') {
      url = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`;
    } else {
      url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;
    }
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return json(r.status, { error: `download ${r.status}: ${(await r.text()).slice(0, 200)}` });
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) { return json(500, { error: e.message }); }

  try {
    let parsed;
    if (mime === 'application/pdf') {
      parsed = await fromPdf(buf);
    } else {
      parsed = fromXlsx(buf);
    }
    return json(200, { id, name: meta.name, mime, ...parsed });
  } catch (e) {
    return json(200, { id, name: meta.name, mime, amount: null, error: 'parse failed: ' + (e.message || String(e)) });
  }
};

async function fromPdf(buf) {
  // Require the inner lib directly to avoid pdf-parse/index.js debug-mode file read.
  const pdf = require('pdf-parse/lib/pdf-parse.js');
  const data = await pdf(buf);
  return extractAmount(data.text || '', null);
}

function fromXlsx(buf) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  let text = '';
  const nums = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
    for (const row of rows) {
      const cells = (row || []).map((c) => (c == null ? '' : String(c)));
      text += cells.join(' ') + '\n';
      for (const c of (row || [])) {
        if (typeof c === 'number' && isFinite(c)) nums.push(Math.round(c));
      }
    }
  }
  return extractAmount(text, nums);
}

// Parse an Icelandic-formatted number string → integer kr.
//   "4.295.185" → 4295185 ; "4.295.185,00" → 4295185 ; "4295185" → 4295185
function parseIskNumber(s) {
  let v = String(s).replace(/\s/g, '');
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.'); // decimal comma
  else v = v.replace(/\./g, '');
  const n = Number(v);
  return isFinite(n) ? Math.round(n) : null;
}

function extractAmount(text, xlsxNums) {
  const lines = String(text).split(/\r?\n/);
  // Icelandic currency: 4.295.185 (dot-grouped) optionally with ,decimals; or a bare 4+ digit int.
  const numRe = /\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\b\d{4,}\b/g;
  const VSK_RE = /(m\.?\s*vsk|með\s*vsk|m\/vsk|incl|samtals|total)/i;

  const labeled = [];
  const all = [];
  for (const ln of lines) {
    const found = ln.match(numRe) || [];
    for (const f of found) {
      const n = parseIskNumber(f);
      if (n != null && n >= 1000) {
        all.push(n);
        if (VSK_RE.test(ln)) labeled.push(n);
      }
    }
  }
  if (Array.isArray(xlsxNums)) for (const n of xlsxNums) if (n >= 1000) all.push(n);

  const pool = labeled.length ? labeled : all;
  const amount = pool.length ? Math.max(...pool) : null;

  let snippet = '';
  if (amount != null) {
    const onLine = (l) => (l.match(numRe) || []).some((f) => parseIskNumber(f) === amount);
    const ln = lines.find((l) => onLine(l) && VSK_RE.test(l)) || lines.find(onLine) || '';
    snippet = ln.replace(/\s+/g, ' ').trim().slice(0, 140);
  }

  return { amount, snippet, labeled_count: labeled.length, number_count: all.length };
}
