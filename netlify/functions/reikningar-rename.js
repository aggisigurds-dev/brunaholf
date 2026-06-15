// reikningar-rename.js — Bakendi "Endurnefna reikninga": DEEP-SCANS each invoice
// PDF in a Drive folder by its CONTENT (the filenames are useless — "Nóta_7",
// "Stolpi_Invoice_107128", email exports) and proposes / applies the standard
// name  "Fyrirtæki - R NNNNNN - DD.MM.YY.pdf"  ("Kreditreikningur" for credit
// notes). Reuses the same content reader as reikningar-read.js, incl. the
// Google-Drive text fallback for PDFs pdf-parse can't decode.
//
//   GET  /api/reikningar-rename?folder=ID[&limit=4][&offset=N]   → propose names
//   POST /api/reikningar-rename  { items:[{fileId,newName}] }     → rename in Drive
//
// GET never writes. POST only renames the exact files+names the UI sends.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEFAULT_FOLDER = '1TDusB2NLhr-OMLnojSk3iw0oiuiuFMLM'; // slökkvitæki - Reikningar - Master

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  // ── APPLY: rename the exact files the UI confirmed ──────────────────────────
  if (event.httpMethod === 'POST') {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
    if (body.action === 'trash') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      let trashed = 0, errors = 0;
      for (const id of ids) {
        try {
          const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?supportsAllDrives=true&fields=id', {
            method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),   // reversible — goes to Drive trash, not permanent delete
          });
          if (r.ok) trashed++; else errors++;
        } catch (e) { errors++; }
      }
      return json(200, { trashed, errors });
    }
    const items = Array.isArray(body.items) ? body.items : [];
    let renamed = 0, errors = 0; const results = [];
    for (const it of items) {
      if (!it || !it.fileId || !it.newName) { continue; }
      try {
        const r = await fetch('https://www.googleapis.com/drive/v3/files/' + it.fileId + '?supportsAllDrives=true&fields=id,name', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: it.newName }),
        });
        if (r.ok) { renamed++; results.push({ fileId: it.fileId, ok: true }); }
        else { errors++; results.push({ fileId: it.fileId, ok: false, error: (await r.text()).slice(0, 120) }); }
      } catch (e) { errors++; results.push({ fileId: it.fileId, ok: false, error: String(e.message || e) }); }
    }
    return json(200, { renamed, errors, results });
  }

  // ── PROPOSE (dry): deep-scan + build the new names ──────────────────────────
  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const limit = Math.min(parseInt(p.limit || '4', 10) || 4, 8);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  // Find duplicates: byte-identical (same md5) = safe to auto-trash all-but-one;
  // same filename but different content = flagged for manual review only.
  if (p.dedup === '1') {
    const files = await listPdfsMeta(folder, token);
    const byMd5 = {}, byName = {};
    files.forEach(f => {
      if (f.md5Checksum) (byMd5[f.md5Checksum] = byMd5[f.md5Checksum] || []).push(f);
      (byName[f.name] = byName[f.name] || []).push(f);
    });
    const exactGroups = [], trashIds = [];
    Object.values(byMd5).forEach(g => {
      if (g.length > 1) { const trash = g.slice(1); exactGroups.push({ name: g[0].name, keepId: g[0].id, trash: trash.map(x => x.id), count: g.length }); trash.forEach(x => trashIds.push(x.id)); }
    });
    const reviewGroups = [];
    Object.keys(byName).forEach(nm => { const g = byName[nm]; if (g.length > 1 && new Set(g.map(x => x.md5Checksum || 'none')).size > 1) reviewGroups.push({ name: nm, count: g.length }); });
    return json(200, { totalFiles: files.length, exactGroups, trashCount: trashIds.length, trashIds, reviewGroups });
  }

  const stats = { folder, scanned: 0, ready: 0, manual: 0, errors: 0, rows: [] };
  try {
    const files = await listPdfs(folder, token);
    stats.total = files.length;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        let text = await readPdfText(f.id, token);
        const kredit = /kredit|creditnote/i.test(f.name) || /kreditreikning|kredit\s*nóta/i.test(text);
        let kt = customerKt(text);
        let number = extractInvoiceNumberText(text) || numberFromName(f.name);
        let iso = extractDate(text) || dateFromName(f.name);
        let total = extractTotal(text);
        let companyTxt = extractCompanyText(text);
        // pdf-parse mangles some Stólpi/Nóta/InExchange layouts (the number comes out
        // wrong even though there IS text). If the number is still missing, re-read
        // with Google Drive's clean extractor and re-pull the fields from that.
        if (!number) {
          const clean = await driveExtractText(f.id, token).catch(() => '');
          if (clean && clean.replace(/\s/g, '').length >= 25) {
            number = extractInvoiceNumberText(clean) || numberFromName(f.name);
            kt = kt || customerKt(clean);
            iso = iso || extractDate(clean);
            total = total || extractTotal(clean);
            companyTxt = companyTxt || extractCompanyText(clean);
          }
        }
        const base = kt ? await matchBase(kt) : null;
        const company = (base && base.nafn) || companyTxt || '';
        const ddmmyy = iso ? toDdmmyy(iso) : '';
        const totalStr = total ? fmtKr(total) : '';

        let newName = '', status = 'manual';
        if (company && number && ddmmyy) {
          // Fyrirtæki - kennitala - R NNNNNN - DD.MM.YY - upphæð kr
          const parts = [sanitize(company)];
          if (kt) parts.push(dash(kt));
          parts.push((kredit ? 'Kreditreikningur ' : 'R ') + number);
          parts.push(ddmmyy);
          if (totalStr) parts.push(totalStr + ' kr');
          newName = parts.join(' - ') + '.pdf';
          status = 'ready';
        }
        if (status === 'ready') stats.ready++; else stats.manual++;
        stats.rows.push({
          fileId: f.id, oldName: f.name, newName, status,
          company, number: number ? ('R-' + number) : '', date: ddmmyy,
          kt: kt ? dash(kt) : '', total: totalStr ? (totalStr + ' kr') : '', kredit,
          missing: [!company ? 'fyrirtæki' : null, !number ? 'reikningsnr' : null, !ddmmyy ? 'dags' : null].filter(Boolean).join(', '),
        });
      } catch (e) { stats.errors++; stats.rows.push({ fileId: f.id, oldName: f.name, status: 'error', error: String(e.message || e) }); }
    }
    stats.nextOffset = (offset + slice.length < files.length) ? offset + slice.length : null;
  } catch (e) {
    return json(500, { error: e.message, stats });
  }
  return json(200, stats);
};

// ── Drive listing + content reader (mirrors reikningar-read.js) ────────────────
async function listPdfs(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType),nextPageToken',
      pageSize: '200', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ' ' + (await r.text()).slice(0, 150));
    const d = await r.json();
    for (const f of (d.files || [])) if (/pdf$/i.test(f.name) || f.mimeType === 'application/pdf') out.push(f);
    pageToken = d.nextPageToken;
  } while (pageToken);
  out.sort((a, b) => a.name.localeCompare(b.name, 'is'));
  return out;
}
async function listPdfsMeta(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,md5Checksum),nextPageToken',
      pageSize: '300', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status);
    const d = await r.json();
    for (const f of (d.files || [])) if (/pdf$/i.test(f.name) || f.mimeType === 'application/pdf') out.push(f);
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}
async function readPdfText(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return '';
  const buf = Buffer.from(await r.arrayBuffer());
  const d = await pdf(buf).catch(() => null);
  let text = d ? d.text : '';
  if ((text || '').replace(/\s/g, '').length < 25) {
    const viaG = await driveExtractText(id, token).catch(() => '');
    if (viaG && viaG.replace(/\s/g, '').length >= 25) text = viaG;
  }
  return text;
}
async function driveExtractText(id, token) {
  const cp = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-ocr-' + id, mimeType: 'application/vnd.google-apps.document' }),
  });
  if (!cp.ok) return '';
  const doc = await cp.json(); if (!doc || !doc.id) return '';
  let text = '';
  try {
    const ex = await fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: `Bearer ${token}` } });
    if (ex.ok) text = await ex.text();
  } catch (_) {}
  fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  return text;
}

// ── Field extraction ──────────────────────────────────────────────────────────
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
function extractInvoiceNumberText(text) {
  let m = text.match(/Reikningur\s*nr\.?\s*:?\s*(\d{4,7})\b/i);
  if (m) return m[1];
  const re = /\b(1\d{5})\b(?!-?\d{4})/g; let x;
  while ((x = re.exec(text))) { const before = text.slice(Math.max(0, x.index - 7), x.index); if (!/\d[-\s]?$/.test(before)) return x[1]; }
  return '';
}
function extractDate(text) {
  let m = text.match(/Dagsetning\s*:?\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/i);
  if (!m) m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (!m) return '';
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
function extractCompanyText(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const l of lines) {
    if (/slökkvitæki|brunakerfi|helluhraun|vsk\s*nr|600508/i.test(l)) continue;
    if (/^(reikningur|kreditreikningur|dagsetning|gjalddagi|greiðsl|afh\.?skilm|starfsma|tilvísun|tilvisun|ra[ðd]nr|skilmáli|sími|vörunúmer|samtals|til\s*greiðslu|móttek)/i.test(l)) continue;
    if (!/[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]/.test(l)) continue;
    if (l.replace(/\D/g, '').length >= 7) continue;   // skip kt / number lines
    if (l.length > 60) continue;
    return l.replace(/\s+/g, ' ').trim();
  }
  return '';
}
// Heildarupphæð m. vsk = the largest ISK figure (grand total ≥ every line + vsk).
// Handles "Til greiðslu ISK: 46.184" (Stólpi) and "Til greiðslu : 200.404" (Nóta).
function extractTotal(text) {
  const kw = String(text || '').match(/Til\s*greiðslu\s*(?:ISK)?\s*:?\s*(?:kr\.?)?\s*([\d.]{4,})/i);
  let best = 0;
  if (kw) { const n = parseInt(kw[1].replace(/\./g, ''), 10); if (Number.isFinite(n)) best = n; }
  const re = /\b\d{1,3}(?:\.\d{3})+\b/g; let m;
  while ((m = re.exec(text))) { const n = parseInt(m[0].replace(/\./g, ''), 10); if (n > best) best = n; }
  return best || null;
}
function fmtKr(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
const dash = kt => (kt && kt.length === 10) ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;

async function matchBase(kt) {
  if (!kt) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}

// ── Filename helpers ──────────────────────────────────────────────────────────
function toDdmmyy(iso) { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (m[3] + '.' + m[2] + '.' + m[1].slice(2)) : ''; }
function dateFromName(name) { const m = String(name || '').match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; }
// Invoice number straight from the filename when the content can't give it:
// "X_reikn_106883", "Stolpi_Invoice_107128", "Stolpi_CreditNote_107073", "#108285", "R 108250".
function numberFromName(name) {
  const s = String(name || '');
  let m = s.match(/(?:reikn|invoice|creditnote|kreditnota)[_\s-]*(\d{4,7})/i); if (m) return m[1];
  m = s.match(/\bR[\s_-]?(\d{5,7})\b/i); if (m) return m[1];
  m = s.match(/#\s*(\d{5,7})\b/); if (m) return m[1];
  m = s.match(/\b(1\d{5})\b/); if (m) return m[1];
  return '';
}
function sanitize(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90); }
