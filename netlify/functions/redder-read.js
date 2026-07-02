// redder-read.js — Bakendi/Efniskostnaður "Redder-lesari": reads the Redder
// supplier-invoice PDFs sitting in the Drive "Reikningar — Redder" folder,
// parses each one, and upserts into `redder_invoices`. This is the cloud twin
// of luna-bridge/redder.js (which reads the same invoices out of the
// bokhald@brunaholf.is Thunderbird mbox) — same table, same `invoice_nr` dedup,
// so the two paths are interchangeable.
//
//   GET /api/redder-read?folder=ID[&dry=1][&limit=6][&offset=N]
//     dry=1  → parse + return the rows, write nothing (verify first)
//     no dry → upsert new/changed invoices into redder_invoices
//
// Batched by `offset` (each call ≤ ~10s); the UI pages through via `nextOffset`.
// Per PDF it extracts: Reikningur nr. · Dagsetning · Eindagi · Sölumaður ·
// "Vegna <verkstaður> umb <tengiliður>" · Upphæð án vsk / Vsk / Samtals m. vsk.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// My Drive › Brunaholf › Reikningar — Redder
const DEFAULT_FOLDER = '1GXs9fVXfl_nU2L8xBy_aDIKdiev8lgIt';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const folder = (p.folder || DEFAULT_FOLDER).trim();
  const dry = p.dry === '1' || p.dry === 'true';
  const limit = Math.min(parseInt(p.limit || '6', 10) || 6, 12);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const stats = { folder, dry, scanned: 0, indexed: 0, dupSkip: 0, notInvoice: 0, errors: 0, rows: [] };

  try {
    const files = await listPdfs(folder, token);
    stats.total = files.length;
    stats.offset = offset;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        const text = await readPdfText(f.id, token);
        const norm = (text || '').replace(/\s+/g, ' ');

        const invoice_nr = invoiceNr(f.name, norm);
        if (!invoice_nr) { stats.notInvoice++; continue; }

        const dagsetning = extractDate(norm, /Dagsetning/i);
        const eindagi = extractDate(norm, /Eindagi/i);
        const salesperson = extractSalesperson(norm);
        const vegna = extractVegna(norm);                 // { worksite, contact, raw }
        let an_vsk = parseIsk(matchNum(norm, /án\s*vsk\.?\s*:?\s*([\d.,]{2,})/i));
        const vsk = parseIsk(matchNum(norm, /[Vv]sk\.?\s*upph[æa]\S*\s*:?\s*([\d.,]{2,})/i));
        let m_vsk = parseIsk(matchNum(norm, /[Ss]amtals[^\d]*?með\s*vsk\.?\s*:?\s*(?:ISK)?\s*([\d.,]{2,})/i));
        // sanity fill-ins (án vsk + vsk = m. vsk)
        if (m_vsk == null && an_vsk != null && vsk != null) m_vsk = an_vsk + vsk;
        if (an_vsk == null && m_vsk != null && vsk != null) an_vsk = m_vsk - vsk;
        if (m_vsk == null) m_vsk = parseIsk(matchNum(norm, /[Ss]amtals\s*(?:ISK)?\s*:?\s*([\d.,]{4,})/i));

        const worksite_match = normWorksite(vegna.worksite);

        const row = {
          invoice_nr, dagsetning, eindagi, salesperson,
          worksite_match, worksite_raw: vegna.raw || null,
          contact_person: vegna.contact || null,
          an_vsk, vsk, m_vsk,
          drive_file_id: f.id, source: 'gdrive',
          file: f.name,
        };
        stats.rows.push(row);

        if (!dry) {
          if (await invoiceExists(invoice_nr)) stats.dupSkip++;   // stat only — upsert still refreshes it
          await upsertInvoice({
            invoice_nr, dagsetning, eindagi, salesperson,
            worksite_match, worksite_raw: vegna.raw || null,
            contact_person: vegna.contact || null,
            an_vsk, vsk, m_vsk,
            drive_file_id: f.id, source: 'gdrive',
            notes: 'Lesið úr Drive (redder-read)',
          });
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

// ── Drive (same helpers as reikningar-read) ───────────────────────────────────
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
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-ocr-' + id, mimeType: 'application/vnd.google-apps.document' }),
  });
  if (!cp.ok) return '';
  const doc = await cp.json();
  if (!doc || !doc.id) return '';
  let text = '';
  try {
    const ex = await fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: `Bearer ${token}` } });
    if (ex.ok) text = await ex.text();
  } catch (_) {}
  fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  return text;
}

// ── Redder PDF field extraction ───────────────────────────────────────────────
// invoice_nr — filename "Reikningur-134737.PDF" first (reliable), else content.
// Zero-padded to 7 to match the existing rows (e.g. 0129467), so the Drive path
// and the luna-bridge mbox path dedup to the same key.
function invoiceNr(name, norm) {
  let m = String(name || '').match(/Reikningur[-_ ]?0*(\d{4,7})/i);
  if (!m) m = norm.match(/Reikningur\s*nr\.?\s*:?\s*0*(\d{4,7})/i);
  if (!m) return '';
  return m[1].replace(/\D/g, '').padStart(7, '0');
}
function extractDate(norm, labelRe) {
  const re = new RegExp(labelRe.source + '\\s*:?\\s*(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})', 'i');
  const m = norm.match(re);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
function extractSalesperson(norm) {
  const m = norm.match(/Sölumaður\s*:?\s*([A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð .'-]{1,38})/i);
  if (!m) return null;
  return m[1].replace(/\s+(Dagsetning|Eindagi|Kt|Vegna|Reikningur).*$/i, '').replace(/\s+/g, ' ').trim() || null;
}
// "Vegna <verkstaður> umb <tengiliður>" — the green-box reference line.
function extractVegna(norm) {
  let m = norm.match(/Vegna\s+(.+?)\s+umb\.?\s+([A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð .'-]{2,40})/i);
  if (m) {
    const worksite = m[1].replace(/\s+/g, ' ').trim();
    const contact = m[2].replace(/\s+(Sölumaður|Dagsetning|Reikningur|Kt|Upphæð|Vsk|Samtals).*$/i, '').replace(/\s+/g, ' ').trim();
    return { worksite, contact, raw: (worksite + (contact ? ' umb ' + contact : '')).trim() };
  }
  m = norm.match(/Vegna\s+(.+?)(?:\s{2,}|Sölumaður|Dagsetning|Reikningur|$)/i);
  if (m) { const worksite = m[1].replace(/\s+/g, ' ').trim(); return { worksite, contact: '', raw: worksite }; }
  return { worksite: '', contact: '', raw: '' };
}
function matchNum(norm, re) { const m = norm.match(re); return m ? m[1] : null; }
// Icelandic money: "1.234.567" thousands, optional ",00" decimals → integer ISK.
function parseIsk(s) {
  if (s == null) return null;
  let x = String(s).replace(/\s/g, '').replace(/,\d{1,2}$/, '').replace(/\./g, '');
  const n = parseInt(x.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// Small worksite alias map (canonical worksite names). Unknown → null so the
// Efniskostnaður tab flags it under "Án verkstaðs" for manual tie-up. Keep this
// in sync with luna-bridge/redder.js + the hub's project_aliases.
const ALIAS = {
  'strandgata': 'Fjarðagata', 'fjörður': 'Fjarðagata', 'fjordur': 'Fjarðagata',
  'fjörðurinn': 'Fjarðagata', 'fjarðargata': 'Fjarðagata', 'fjarðagata': 'Fjarðagata',
  'dalvegur': 'Dalvegur 30', 'dalvegur 30': 'Dalvegur 30', 'dalvegur 18b': 'Dalvegur 30',
  'dalvegur 26': 'Dalvegur 30', 'dalvegur 30a': 'Dalvegur 30',
  'heklureitur': 'Heklureitur', 'landsspítalinn': 'Landsspítalinn', 'landspitalinn': 'Landsspítalinn',
  'nlsh': 'Landsspítalinn', 'nlsh 5-6. hæð': 'Landsspítalinn', 'nlsh 5-6': 'Landsspítalinn',
  'orkureitur': 'Orkureitur', 'fjallaböðin': 'Fjallaböðin Þjórsárdal',
};
function normWorksite(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  const key = n.toLowerCase().replace(/\s+/g, ' ').trim();
  if (ALIAS[key]) return ALIAS[key];
  for (const a in ALIAS) if (key.indexOf(a) >= 0) return ALIAS[a];
  return n;   // keep the cleaned raw name so it still groups; user can retie later
}

// ── Supabase ──────────────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function invoiceExists(invoice_nr) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/redder_invoices?invoice_nr=eq.${encodeURIComponent(invoice_nr)}&select=invoice_nr&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
async function upsertInvoice(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/redder_invoices?on_conflict=invoice_nr`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('upsert ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
