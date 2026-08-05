// samningar-read.js — Bakendi "Samningalesari": reads the Þjónustusamningur PDFs
// in a Drive folder and extracts, per samningur:
//   Fyrirtækjanafn · Heimilisfang · Kennitala · Dagsetning
//
//   GET /api/samningar-read?folder=ID[&dry=1][&limit=8][&offset=N]
//     → { total, scanned, indexed, dupSkip, notSlokkvitaeki, notSamningur,
//         errors, offset, nextOffset, rows:[{ fileId, file, company, address,
//         kt, date, year, base_id, base_name }] }
//
// Parallel to reikningar-read.js. The samningur has explicit labels
// ("Nafn: … kt: …", "Heimilisfang: …", "Dags: 9.apríl 2026") so extraction is
// label-based and reliable. doc_type='samningur' (one-time — no amount/number).
// Batched by `offset`; non-dry upserts customer_documents (dedup drive_file_id).

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');
const { sitesForBase, resolveSite, siteWriteAllowed } = require('./_spine');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
// 2026-08-05 (Agnar confirmed): the old "Master" folder is empty — all 264
// real contracts live in the plain "Þjónustusamningar" folder, now canonical.
const DEFAULT_FOLDER = '1hu405fCw01mYtYSn4BqIPvhtPCPuzmwM'; // Þjónustusamningar

const MONTHS = { 'januar':1,'janúar':1,'jan':1,'februar':2,'febrúar':2,'feb':2,'mars':3,'mar':3,
  'april':4,'apríl':4,'apr':4,'mai':5,'maí':5,'juni':6,'júní':6,'jun':6,'jún':6,
  'juli':7,'júlí':7,'jul':7,'júl':7,'agust':8,'ágúst':8,'agu':8,'ágú':8,
  'september':9,'sep':9,'sept':9,'oktober':10,'október':10,'okt':10,
  'november':11,'nóvember':11,'nov':11,'nóv':11,'desember':12,'des':12 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const dry = p.dry === '1' || p.dry === 'true';
  const limit = Math.min(parseInt(p.limit || '8', 10) || 8, 16);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const stats = { folder, dry, scanned: 0, indexed: 0, dupSkip: 0, notSlokkvitaeki: 0, notSamningur: 0, errors: 0, rows: [] };

  try {
    const files = await listPdfs(folder, token);
    stats.total = files.length;
    stats.offset = offset;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        const text = await readPdfText(f.id, token);
        if (!text) { stats.errors++; continue; }
        const norm = text.replace(/\s+/g, ' ');
        if (norm.replace(/\D/g, '').indexOf(ISSUER_KT) === -1) { stats.notSlokkvitaeki++; continue; }
        if (!/þjónustusamning|þjonustusamning|þjónustusamningur/i.test(norm)) { stats.notSamningur++; continue; }

        const company = extractCompany(text, f.name);
        const address = extractAddress(text, f.name);
        let kt = extractKt(text) || customerKtFromName(f.name);
        const date = extractDate(text);                       // ISO yyyy-mm-dd
        const year = date ? parseInt(date.slice(0, 4), 10) : extractYear(norm);
        const base = kt ? await matchBase(kt) : null;
        // Tengireglan (_spine): staðurinn AÐEINS með sönnun (stimpill / einn staður /
        // heimilisfang úr skráarheiti EÐA samningstexta) — annars ósnert, aldrei giskað.
        let site = null;
        if (base) { try { site = resolveSite(f.name, await sitesForBase(base.id), address); } catch (_) {} }

        const row = {
          fileId: f.id, file: f.name,
          company, address, kt: kt ? dash(kt) : '', date, year,
          base_id: base ? base.id : null, base_name: base ? base.nafn : null,
          site_id: site ? site.id : null, site_name: site ? site.nafn : null,
        };
        stats.rows.push(row);

        if (!dry) {
          if (await alreadyIndexed(f.id)) { stats.dupSkip++; }
          const docRow = {
            customer_base_id: base ? base.id : null,
            doc_type: 'samningur', year, drive_file_id: f.id,
            source: 'gdrive', found_by: 'code',
            doc_date: date, customer_name: company,
            notes: 'Þjónustusamningur · ' + (company || f.name.replace(/\.pdf$/i, ''))
                 + (address ? ', ' + address : '') + (kt ? ' · kt ' + dash(kt) : '') + (base ? '' : ' · RESOLVE'),
          };
          if (site && await siteWriteAllowed(f.id, site)) docRow.fyrirtaeki_id = site.id;
          await upsertDoc(docRow);
          stats.indexed++;
        }
      } catch (e) { stats.errors++; }
    }
    stats.processed = slice.length;
    stats.nextOffset = (offset + slice.length < files.length) ? offset + slice.length : null;
  } catch (e) {
    return json(500, { error: e.message, stats });
  }
  return json(200, stats);
};

// ── Drive ────────────────────────────────────────────────────────────────────
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
    if (!r.ok) throw new Error('Drive list ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    for (const f of (d.files || [])) if (/pdf$/i.test(f.name) || f.mimeType === 'application/pdf') out.push(f);
    pageToken = d.nextPageToken;
  } while (pageToken);
  out.sort((a, b) => a.name.localeCompare(b.name, 'is'));
  return out;
}
async function readPdfText(id, token) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const d = await pdf(buf).catch(() => null);
  return d ? d.text : null;
}

// ── Extraction (label-based — the samningur prints "Nafn:/Heimilisfang:/kt:/Dags:") ──
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKtFromName(name) { for (const kt of allKts(String(name || ''))) if (kt !== ISSUER_KT) return kt; return null; }

// "Nafn: Thai Lindin ehf kt: 450424-1290" → "Thai Lindin ehf"
function extractCompany(text, fileName) {
  let m = text.match(/Nafn\s*:?\s*([^\n]*?)\s*\bkt\b\s*[:.]?/i);
  if (m && m[1].trim()) return m[1].replace(/\s+/g, ' ').trim();
  m = text.match(/Nafn\s*:?\s*([^\n]+)/i);
  if (m && m[1].trim()) return m[1].replace(/\bkt\b.*$/i, '').replace(/\s+/g, ' ').trim();
  // Fallback: filename first " - " segment.
  const seg = String(fileName || '').replace(/\.pdf$/i, '').split(' - ').map(s => s.trim());
  return (seg[0] && !/^\d/.test(seg[0])) ? seg[0] : '';
}
// "Heimilisfang: Háaleitisbraut 58 108 Reykjavík" → that line
function extractAddress(text, fileName) {
  const m = text.match(/Heimilisfang\s*:?\s*([^\n]+)/i);
  if (m && m[1].trim()) return m[1].replace(/\s+/g, ' ').trim();
  const seg = String(fileName || '').replace(/\.pdf$/i, '').split(' - ').map(s => s.trim());
  const ktIdx = seg.findIndex(p => /^\d{6}-?\d{4}$/.test(p));
  return ktIdx >= 2 ? seg[ktIdx - 1] : '';
}
// Customer kt — the one after "Nafn:" (issuer kt comes earlier, "Slökkvitæki ehf kt: …").
function extractKt(text) {
  const m = text.match(/Nafn\s*:?[\s\S]{0,90}?\bkt\b\s*[:.]?\s*(\d{6}-?\d{4})/i);
  if (m) { const kt = m[1].replace(/\D/g, ''); if (kt !== ISSUER_KT) return kt; }
  for (const kt of allKts(text)) if (kt !== ISSUER_KT) return kt;
  return null;
}
// "Dags: 9.apríl 2026" → "2026-04-09" (Icelandic month name)
function extractDate(text) {
  let m = text.match(/Dags\.?\s*:?\s*(\d{1,2})\.?\s*([A-Za-zÁÉÍÓÚÝÞÆÖÐáéíóúýþæöð]+)\.?\s*(\d{4})/i);
  if (m) {
    const mn = MONTHS[m[2].toLowerCase()];
    if (mn) return `${m[3]}-${String(mn).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
  return '';
}
function extractYear(s) { const m = s.match(/\b(20\d{2})\b/); return m ? parseInt(m[1], 10) : null; }
const dash = kt => kt.length === 10 ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;

// ── Supabase REST ────────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function alreadyIndexed(driveFileId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(driveFileId)}&select=id&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
async function matchBase(kt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
async function upsertDoc(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?on_conflict=drive_file_id`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('upsert ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
