// uttekt-rename.js — Bakendi "Endurnefna úttektarskýrslur": DEEP-SCANS each
// inspection-report PDF in a Drive folder by its CONTENT and proposes / applies
// the canonical name  "Fyrirtæki - Heimilisfang - Kennitala - Mánuður - Ár.pdf"
// (the same scheme as the Allt folder + Skjalaheiti). Overrides whatever the file
// is currently called. Mirrors reikningar-rename.js (incl. the Google-Drive clean
// text fallback for PDFs pdf-parse can't decode) + a "Finna tvítök" dedup.
//   GET  /api/uttekt-rename?folder=ID[&limit=4][&offset=N]   → propose
//   GET  /api/uttekt-rename?dedup=1&folder=ID                 → find duplicates
//   POST /api/uttekt-rename  { items:[{fileId,newName}] }      → rename
//   POST /api/uttekt-rename  { action:'trash', ids:[...] }     → trash (reversible)

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEFAULT_FOLDER = '11Gf4yUeR6tQ2HcFxWk-50IFQl2xBUQOg'; // "Allt" (úttektarskýrslur)
const MONTHS = 'janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  if (event.httpMethod === 'POST') {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
    if (body.action === 'trash') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      let trashed = 0, errors = 0;
      for (const id of ids) {
        try {
          const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?supportsAllDrives=true&fields=id', {
            method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),
          });
          if (r.ok) trashed++; else errors++;
        } catch (e) { errors++; }
      }
      return json(200, { trashed, errors });
    }
    const items = Array.isArray(body.items) ? body.items : [];
    let renamed = 0, errors = 0; const results = [];
    for (const it of items) {
      if (!it || !it.fileId || !it.newName) continue;
      try {
        const r = await fetch('https://www.googleapis.com/drive/v3/files/' + it.fileId + '?supportsAllDrives=true&fields=id', {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: it.newName }),
        });
        if (r.ok) { renamed++; results.push({ fileId: it.fileId, ok: true }); }
        else { errors++; results.push({ fileId: it.fileId, ok: false, error: (await r.text()).slice(0, 120) }); }
      } catch (e) { errors++; results.push({ fileId: it.fileId, ok: false, error: String(e.message || e) }); }
    }
    return json(200, { renamed, errors, results });
  }

  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const limit = Math.min(parseInt(p.limit || '4', 10) || 4, 8);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  if (p.dedup === '1') {
    const files = await listPdfsMeta(folder, token);
    const byMd5 = {}, byName = {};
    files.forEach(f => { if (f.md5Checksum) (byMd5[f.md5Checksum] = byMd5[f.md5Checksum] || []).push(f); (byName[f.name] = byName[f.name] || []).push(f); });
    const exactGroups = [], trashIds = [];
    Object.values(byMd5).forEach(g => { if (g.length > 1) { const trash = g.slice(1); exactGroups.push({ name: g[0].name, trash: trash.map(x => x.id), count: g.length }); trash.forEach(x => trashIds.push(x.id)); } });
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
        let kt = customerKt(text);
        if (!kt || !/[a-záéíóúýþæöð]/i.test(text)) {
          const clean = await driveExtractText(f.id, token).catch(() => '');
          if (clean && clean.replace(/\s/g, '').length >= 25) { text = clean; kt = customerKt(text); }
        }
        // The folder mixes report types + stray invoices. Accept ONLY real reports —
        // (A) slökkvitæki úttektarskýrsla, (B) brunaviðvörunarkerfi viðtökupróf/árleg
        // prófun — and reject reikningar (they also carry the issuer kt).
        const isInvoice = /til greiðslu|reikningsnr|gjalddagi\s*-?\s*eindagi|samtala reiknings|samtals fyrir vsk/i.test(text);
        const isReport = /skýrsla vegna úttektar|úttektarskýrsl|uttektarskyrsl|viðtökupróf|árleg prófun|brunaviðvörunarkerfi/i.test(text);
        const ok = isReport && !isInvoice;
        const base = kt ? await matchBase(kt) : null;
        const party = parseParty(text, base && base.nafn);
        const company = party.company || (base && base.nafn) || '';
        const address = party.address || extractAddress(text);
        const di = dateInfo(text);
        let newName = '', status = 'manual';
        if (ok && company && kt && di.month && di.year) {
          // Skip the address — it's noisy/inconsistent in the source PDFs (abbreviated
          // cities, company name bleeding into the street, missing on some) and the app
          // links reports by kennitala + year, not by the address text.
          newName = sanitize(company) + ' - ' + dash(kt) + ' - ' + di.month + ' - ' + di.year + '.pdf';
          status = 'ready';
        }
        if (status === 'ready') stats.ready++; else stats.manual++;
        stats.rows.push({
          fileId: f.id, oldName: f.name, newName, status, isInvoice, company, kt: kt ? dash(kt) : '', address, month: di.month || '', year: di.year || '',
          missing: !ok ? (isInvoice ? 'reikningur – röng mappa' : 'ekki úttektarskýrsla') : [!company ? 'fyrirtæki' : null, !kt ? 'kt' : null, !(di.month && di.year) ? 'dags' : null].filter(Boolean).join(', '),
        });
      } catch (e) { stats.errors++; stats.rows.push({ fileId: f.id, oldName: f.name, status: 'error', error: String(e.message || e) }); }
    }
    stats.nextOffset = (offset + slice.length < files.length) ? offset + slice.length : null;
  } catch (e) {
    return json(500, { error: e.message, stats });
  }
  return json(200, stats);
};

// ── Drive ─────────────────────────────────────────────────────────────────────
async function listPdfs(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({ q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`, fields: 'files(id,name,mimeType),nextPageToken', pageSize: '300', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives' });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status);
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
    const params = new URLSearchParams({ q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`, fields: 'files(id,name,mimeType,md5Checksum),nextPageToken', pageSize: '300', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives' });
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
  try { const ex = await fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: `Bearer ${token}` } }); if (ex.ok) text = await ex.text(); } catch (_) {}
  fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  return text;
}

// ── Extraction ────────────────────────────────────────────────────────────────
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
const MNAME = { 1: 'janúar', 2: 'febrúar', 3: 'mars', 4: 'apríl', 5: 'maí', 6: 'júní', 7: 'júlí', 8: 'ágúst', 9: 'september', 10: 'október', 11: 'nóvember', 12: 'desember' };
// Prefer the report's own date ("Dags 28.11.2024"); else the first "{mánuður} {ár}"
// that is NOT a "Næsta skoðun …" (next-inspection) date.
function dateInfo(text) {
  const t = String(text || '');
  const m = t.match(/\bdags\.?\s*:?\s*(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/i);
  if (m) { const mo = parseInt(m[2], 10); let y = m[3]; if (y.length === 2) y = '20' + y; if (mo >= 1 && mo <= 12) return { month: MNAME[mo], year: y }; }
  const re = new RegExp('\\b(' + MONTHS + ')\\s+(20\\d{2})\\b', 'gi');
  let mm;
  while ((mm = re.exec(t))) {
    const before = t.slice(Math.max(0, mm.index - 32), mm.index);
    if (/næst|next/i.test(before)) continue;
    return { month: mm[1].toLowerCase(), year: mm[2] };
  }
  return { month: '', year: '' };
}
// Two report layouts share the folder:
//  A) slökkvitæki úttektarskýrsla: "…hjá fyrirtækinu Steypustöðin Malarhöfða 38 110
//     Reykjavík. Kt 660707-0420"  → company 'Steypustöðin', addr 'Malarhöfða 38, 110 Reykjavík'
//  B) brunaviðvörunarkerfi viðtökupróf: "Verkkaupi Center Hótel Klöpp Kennitala
//     450905-1430 … Heimilisf. vegnaKlapparstígur 26 Póstnr. 101 Rvk." → company
//     'Center Hótel Klöpp', addr 'Klapparstígur 26, 101 Reykjavík'
// Prefers the company the report itself names (it reflects the actual site, which one
// kt can have several of); the street is the word+number before the postcode.
function parseParty(text, baseName) {
  const t = String(text || '');
  const m = t.match(/hjá\s+fyrirt(?:æki|aeki)nu\s+(.+?)\.?\s*Kt\b/i);                 // format A
  if (m) {
    const full = m[1].replace(/\s+/g, ' ').trim();
    const pc = full.match(/^(.*?)[,\s]+(\d{3})\s+([A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð]+(?:\s*\([^)]*\))?)\s*$/);
    if (!pc) return { company: baseName || full, address: '' };
    const head = pc[1].trim();
    const st = head.match(/^(.*?)\s*([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]*\s+\d{1,4}[a-dA-D]?)\s*$/);
    let company = '', street = head;
    if (st) { street = st[2].trim(); company = (st[1] || '').trim(); }
    return { company: company || baseName || '', address: street + ', ' + pc[2] + ' ' + pc[3] };
  }
  let company = '', address = '';                                                     // format B
  const cm = t.match(/Verkkaupi\s+(.+?)\s+Kennitala/i);
  if (cm) company = cm[1].replace(/\s+/g, ' ').trim();
  const am = t.match(/Heimilisf\.?\s*(.+?)\s*Póstnr\.?\s*(\d{3})\s+([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.]*)/i);
  if (am) {
    const street = am[1].replace(/^\s*vegna/i, '').replace(/\s+/g, ' ').trim();
    const city = am[3].replace(/\.$/, '').replace(/^Rvk$/i, 'Reykjavík').replace(/^Hfj$/i, 'Hafnarfjörður').replace(/^Kóp$/i, 'Kópavogur');
    address = street + ', ' + am[2] + ' ' + city;
  }
  return { company: company || baseName || '', address };
}
function extractAddress(text) {
  const t = String(text || '');
  const pairRe = /([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]*(?:[^\S\n]+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]+){0,3}[^\S\n]+\d{1,4}(?:[^\S\n]*[-–][^\S\n]*\d{1,4})?[a-dA-D]?)[,\s]+(\d{3}[^\S\n]+[A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð]+(?:bær|borg)?)/g;
  let m;
  while ((m = pairRe.exec(t))) {
    const street = m[1].replace(/\s+/g, ' ').trim(), city = m[2].replace(/\s+/g, ' ').trim();
    if (/helluhraun|slökkvitæki|brunakerfi|vsk\s*nr/i.test(street)) continue;   // issuer
    return street + ', ' + city;
  }
  return '';
}
const dash = kt => (kt && kt.length === 10) ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;
function sanitize(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 70); }

async function matchBase(kt) {
  if (!kt) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
