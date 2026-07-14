// tekjastada-read.js — Bakendi „🧯 Lesa tækjastöðu úr skýrslum".
// Reads úttektarskýrslu PDFs that are ALREADY connected to a site (customer_documents
// doc_type=uttektarskyrsla, fyrirtaeki_id NOT NULL), extracts the equipment counts
// (SLT slökkvitæki / BSL brunaslöngur / RS reykskynjarar + other) and the inspection
// MONTH, and writes them into the shared `app_settings` blob so Slökkvitæki's
// „Fyrirtæki í þjónustu" page (arsskodun_customers[fyrirtaeki_id].equipment +
// .inspect_month) fills the „Tæki" + „Skoðun" columns for the newest year.
//
//   GET /api/tekjastada-read?sample=1            → a few connected reports (to probe)
//   GET /api/tekjastada-read?probe=<driveFileId> → raw text of one PDF (tuning)
//   GET /api/tekjastada-read?dry=1[&limit=6&offset=N] → parse preview (no write)
//   GET /api/tekjastada-read?limit=6&offset=N    → parse + WRITE app_settings
//
// Newest-report-wins: for each fyrirtaeki_id we keep the highest-year report's counts.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MONTHS = 'janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember';
const MNUM = { 'janúar':1,'febrúar':2,'mars':3,'apríl':4,'maí':5,'júní':6,'júlí':7,'ágúst':8,'september':9,'október':10,'nóvember':11,'desember':12 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  let token;
  try { token = await freshAccessToken(); } catch (e) { return json(401, { error: e.message }); }

  try {
    const p = event.queryStringParameters || {};
    if (p.probe) {
      const text = await readPdfText(p.probe, token);
      return json(200, { fileId: p.probe, len: text.length, text: text.slice(0, 6000) });
    }
    if (p.sample) {
      const rows = await sbGet('customer_documents?doc_type=eq.uttektarskyrsla&fyrirtaeki_id=not.is.null&drive_file_id=not.is.null&select=id,drive_file_id,fyrirtaeki_id,year,notes&limit=8');
      return json(200, { sample: rows });
    }
    const limit = Math.min(parseInt(p.limit, 10) || 6, 12);
    const offset = parseInt(p.offset, 10) || 0;
    const dry = p.dry === '1' || p.dry === 'true';
    return json(200, await run({ limit, offset, dry, token }));
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

// ── Supabase helpers ───────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function sbGet(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders({ Range: `${from}-${from + 999}` }) });
    if (!r.ok) throw new Error('sbGet ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const rows = await r.json().catch(() => []);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ── PDF text (pdf-parse → Google-Doc OCR fallback) ─────────────────────────────
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

// ── Extraction (tuned after probing a real report — see PARSE below) ───────────
function extractMonth(text) {
  let m = /Dags[^\d]{0,6}(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/i.exec(text);
  if (m) return parseInt(m[2], 10);
  m = new RegExp('(' + MONTHS + ')\\s+20\\d\\d', 'i').exec(text);
  if (m) return MNUM[m[1].toLowerCase()] || null;
  return null;
}
// Equipment counts — filled in once the report format is confirmed via ?probe.
function extractEquipment(text) {
  const t = text || '';
  const count = (re) => { let n = 0, m; const r = new RegExp(re, 'gi'); while ((m = r.exec(t))) n++; return n; };
  // Placeholder heuristic: count device lines by type keyword. REFINED after probe.
  const slt = count('\\b(duft|léttvatn|lettvatn|co2|co₂|kolsýr|kolsyr)\\b');
  const bsl = count('\\b(brunaslang|brunaslöng|slöngu)\\b');
  const rs  = count('\\b(reykskynjar)\\b');
  return { slt, bsl, rs, total: slt + bsl + rs };
}

async function run({ limit, offset, dry, token }) {
  const docs = await sbGet(`customer_documents?doc_type=eq.uttektarskyrsla&fyrirtaeki_id=not.is.null&drive_file_id=not.is.null&select=id,drive_file_id,fyrirtaeki_id,year,notes&order=year.desc&limit=${limit}&offset=${offset}`);
  const results = [];
  for (const d of docs) {
    const text = await readPdfText(d.drive_file_id, token).catch(() => '');
    const eq = extractEquipment(text);
    const month = extractMonth(text);
    results.push({ doc_id: d.id, fyrirtaeki_id: d.fyrirtaeki_id, year: d.year, month, equipment: eq, text_len: text.length });
  }
  let wrote = 0;
  if (!dry) wrote = await writeSettings(results);
  return { count: docs.length, offset, next_offset: offset + docs.length, done: docs.length < limit, wrote, results, dry: !!dry };
}

// ── Write into the shared app_settings blob (read-modify-write, newest-year-wins) ─
async function writeSettings(results) {
  const good = results.filter(r => r.equipment && r.equipment.total > 0);
  if (!good.length) return 0;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=settings`, { headers: sbHeaders() });
  const row = (await r.json().catch(() => []))[0] || {};
  const settings = row.settings || {};
  const ars = settings.arsskodun_customers = settings.arsskodun_customers || {};
  let wrote = 0;
  for (const g of good) {
    const key = String(g.fyrirtaeki_id);
    const cur = ars[key] = ars[key] || {};
    const prevYr = +cur._equip_year || 0;
    if ((g.year || 0) < prevYr) continue;                 // newest report wins
    cur.equipment = { slt: g.equipment.slt, bsl: g.equipment.bsl, rs: g.equipment.rs };
    if (g.month) cur.inspect_month = g.month;
    cur._equip_year = g.year || prevYr;
    wrote++;
  }
  const up = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ settings }),
  });
  if (!up.ok) throw new Error('app_settings PATCH ' + up.status + ' ' + (await up.text()).slice(0, 160));
  return wrote;
}
