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
// "Vegna <verkstaður> umb <tengiliður>" · Upphæð án vsk / Vsk / Samtals m. vsk —
// and since 2026-07-09 also the EFNIS-VÖRULÍNUR (vörunr/heiti/magn/ein.verð/
// afsl%/upphæð) → `redder_line_items`, so Gerð Reikninga can match each line to
// the Verðskrá (matchVerdskra) and prefill the Efnislisti. Verified against all
// 65 PDFs in the folder: Σ line upphæð === Upphæð án vsk on every one.

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
  await loadAliasesFromDb();

  const stats = { folder, dry, scanned: 0, indexed: 0, dupSkip: 0, notInvoice: 0, errors: 0, rows: [] };

  try {
    let files = await listPdfs(folder, token);
    // ?only=<reikningsnr eða hluti úr skráarnafni> — endurlesa EINN reikning eftir
    // lagfæringu á lesaranum án þess að skrifa yfir alla möppuna (03.09.2026).
    const only = (p.only || '').trim();
    if (only) files = files.filter((f) => String(f.name || '').toLowerCase().includes(only.toLowerCase()));
    stats.total = files.length;
    if (only) stats.only = only;
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
        const li = extractLines(text);                    // { lines:[…], refs:{ub,v,umb,sott} }
        let vegna = extractVegna(norm);                   // { worksite, contact, raw }
        // Newer PDFs reference the site as "V: <staður>" / "V/ <staður> umb: <nafn>" /
        // "Vegna: <staður> - Sótt: <nafn>" instead of the old "Vegna X umb Y" — the
        // line scanner picks those up.
        if (!vegna.worksite && (li.refs.v || li.refs.umb || li.refs.sott || li.refs.ub)) {
          const ws = li.refs.v || '';
          const contact = li.refs.umb || li.refs.sott || li.refs.ub || '';
          vegna = { worksite: ws, contact, raw: (ws + (contact ? ' umb ' + contact : '')).trim() || null };
        }
        // Kredit invoices print amounts with a TRAILING minus ("41.458-") — keep the sign.
        let an_vsk = parseIsk(matchNum(norm, /án\s*vsk\.?\s*:?\s*([\d.,]{2,}-?)/i));
        const vsk = parseIsk(matchNum(norm, /[Vv]sk\.?\s*upph[æa]\S*\s*:?\s*([\d.,]{2,}-?)/i));
        let m_vsk = parseIsk(matchNum(norm, /[Ss]amtals[^\d]*?með\s*vsk\.?\s*:?\s*(?:ISK)?\s*([\d.,]{2,}-?)/i));
        // sanity fill-ins (án vsk + vsk = m. vsk)
        if (m_vsk == null && an_vsk != null && vsk != null) m_vsk = an_vsk + vsk;
        if (an_vsk == null && m_vsk != null && vsk != null) an_vsk = m_vsk - vsk;
        if (m_vsk == null) m_vsk = parseIsk(matchNum(norm, /[Ss]amtals\s*(?:ISK)?\s*:?\s*([\d.,]{4,}-?)/i));

        const worksite_match = normWorksite(vegna.worksite);

        const row = {
          invoice_nr, dagsetning, eindagi, salesperson,
          worksite_match, worksite_raw: vegna.raw || null,
          contact_person: vegna.contact || null,
          an_vsk, vsk, m_vsk,
          drive_file_id: f.id, source: 'gdrive',
          file: f.name,
          lines: li.lines,
        };
        stats.rows.push(row);

        if (!dry) {
          if (await invoiceExists(invoice_nr)) stats.dupSkip++;   // stat only — upsert still refreshes it
          const inv = await upsertInvoice({
            invoice_nr, dagsetning, eindagi, salesperson,
            worksite_match, worksite_raw: vegna.raw || null,
            contact_person: vegna.contact || null,
            an_vsk, vsk, m_vsk,
            drive_file_id: f.id, source: 'gdrive',
            notes: 'Lesið úr Drive (redder-read)',
          });
          // Replace the invoice's line items ONLY when the parse found some —
          // a parse miss must never wipe good existing lines.
          if (inv && inv.id && li.lines.length) {
            await replaceLineItems(inv.id, li.lines);
            stats.linesWritten = (stats.linesWritten || 0) + li.lines.length;
          }
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
//
// 03.09.2026: varaleiðin var ólæst — `norm` er hvítbils-þjappaður svo `\s{2,}`
// small aldrei, og fyndist hvorugt stopporðið hljóp `.+?` alla leið í enda
// skjalsins. Reikningur 0142980 (01.09.2026, 419.021 kr) fékk þannig 285 stafa
// slitur úr vörulínunum í verkstaðarreitinn og lenti hvergi. Nú stoppar lesturinn
// á fyrsta vörunúmeri (t.d. „FSI FS310HPE", „PIC 150/40", „POL PRO059") eða
// hausorði, og of langt gildi er hent (verkstaðarnöfn eru stutt).
const VEGNA_STOP = 'Vörunr|Vöruheiti|Sölumaður|Dagsetning|Eindagi|Gjalddagi|Reikningur|Pöntun|Tilvísun|Kt\\.|Sími|Netfang|Heimilisfang|Upphæð|Vsk|Samtals|Afgreiðsl|Móttakandi|Sótt';
const VEGNA_CODE = '[A-ZÁÉÍÓÚÝÆÖÞÐ]{2,4}\\s?[A-Z0-9]*\\d{2,}';   // vörunúmer Redder
function cleanVegna(s) {
  let v = String(s || '').replace(/\s+/g, ' ').trim();
  v = v.split(new RegExp('\\s+(?:' + VEGNA_STOP + ')', 'i'))[0];
  v = v.split(new RegExp('\\s+(?=' + VEGNA_CODE + ')'))[0];
  v = v.replace(/[\s:;,.-]+$/, '').trim();
  if (v.length > 60) v = '';                    // lengra en verkstaðarnafn → ónothæft
  if (/\d[.,]\d{2}\b/.test(v)) v = '';          // upphæð/magn slæddist með → ónothæft
  return v;
}
function extractVegna(norm) {
  let m = norm.match(/Vegna\s+(.+?)\s+umb\.?\s+([A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð .'-]{2,40})/i);
  if (m) {
    const worksite = cleanVegna(m[1]);
    const contact = m[2].replace(/\s+(Sölumaður|Dagsetning|Reikningur|Kt|Upphæð|Vsk|Samtals).*$/i, '').replace(/\s+/g, ' ').trim();
    if (worksite) return { worksite, contact, raw: (worksite + (contact ? ' umb ' + contact : '')).trim() };
  }
  // Taka rúman bút og láta cleanVegna klippa — að krefjast stopporðs í regexinu
  // sjálfu felldi lesturinn þegar ekkert þeirra fylgdi (0142980).
  m = norm.match(/Vegna\s*:?\s+(.{2,200})/i);
  if (m) { const worksite = cleanVegna(m[1]); if (worksite) return { worksite, contact: '', raw: worksite }; }
  return { worksite: '', contact: '', raw: '' };
}
function matchNum(norm, re) { const m = norm.match(re); return m ? m[1] : null; }
// Icelandic money: "1.234.567" thousands, optional ",00" decimals → integer ISK.
// A TRAILING minus ("41.458-", kredit invoices) makes it negative.
function parseIsk(s) {
  if (s == null) return null;
  let x = String(s).replace(/\s/g, '');
  const neg = /-$/.test(x);
  x = x.replace(/-/g, '').replace(/,\d{1,2}$/, '').replace(/\./g, '');
  const n = parseInt(x.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
// "1.547,58" → 1547.58 (Icelandic decimals).
function parseDec(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ── Efnis-vörulínur ───────────────────────────────────────────────────────────
// Extract the item lines + reference hints from the RAW pdf text (line-based,
// NOT the whitespace-collapsed norm). Layout (dkPlus-style Redder invoice):
//   Vörunr.VöruheitiMagnEin.verðAfsl%Upphæð          ← header (concatenated)
//   UB: Lukas / V: Kársnesbraut 96 / Vegna: X - Sótt: Y   ← optional ref rows
//   POL PRO059                                       ← item code row
//   Eldv. Málning 8L  ISO14001 Hvítt1,00Stk19.846,77           50,00 9.923
//   Upphæð án vsk.9.923                              ← end marker
// The item row concatenates desc+magn+unit+ein.verð+afsl%+upphæð. Because the
// description can END in a digit ("(12)", hanska-stærðir "M-st8"), the magn
// split is ambiguous — every trailing "N,NN" candidate is tried and verified
// against round(magn × ein.verð × (1−afsl/100)) === upphæð.
function extractLines(rawText) {
  const out = { lines: [], refs: {} };
  const rows = String(rawText || '').split(/\r?\n/).map(s => s.replace(/\s+$/, '')).filter(s => s.trim());
  const isHeader = s => /Vörunr\.?\s*Vöruheiti/i.test(s.replace(/\s+/g, ' '));
  const start = rows.findIndex(isHeader);
  if (start < 0) return out;

  let pendingCode = null;
  for (let i = start + 1; i < rows.length; i++) {
    const line = rows[i].trim();
    if (/^Upphæð án vsk/i.test(line)) break;
    if (isHeader(line)) { pendingCode = null; continue; }     // repeated page header
    // Reference rows — seen forms: "UB: Lukas" · "V: Kársnesbraut 96" ·
    // "V/ landsspitali umb: Tommi" · "Vegna: Landsspítali - Sótt: Lena" ·
    // "Vegna Heklureitur umb Tommi" · "v Heklureitur umb Elí".
    let m;
    if ((m = line.match(/^UB[:\/]\s*(.+)$/i))) { out.refs.ub = m[1].trim(); continue; }
    if ((m = line.match(/^(?:V|Vegna)[:\/.]?\s+(.+)$/i))) {
      let rest = m[1].trim();
      const sm = rest.match(/^(.*?)\s*[-–]\s*Sótt:?\s*(.+)$/i);
      if (sm) { rest = sm[1].trim(); out.refs.sott = sm[2].trim(); }
      const um = rest.match(/^(.*?)\s+umb\.?:?\s+(.+)$/i);
      if (um) { rest = um[1].trim(); out.refs.umb = um[2].trim(); }
      if (rest) out.refs.v = rest;
      continue;
    }
    if ((m = line.match(/^Sótt:?\s*(.+)$/i))) { out.refs.sott = m[1].trim(); continue; }

    const item = parseItemLine(line);
    if (item) {
      if (pendingCode) { item.item_code = pendingCode; pendingCode = null; }
      out.lines.push(item);
      continue;
    }
    // Item-code row: short, uppercase/digits ("POL PRO059", "STA S-093110111").
    if (/^[A-ZÐÞÆÖÁÉÍÓÚÝ0-9][A-ZÐÞÆÖÁÉÍÓÚÝ0-9 ._\/-]{1,29}$/.test(line) && /\d/.test(line)) {
      pendingCode = line;
      continue;
    }
    pendingCode = null;
  }
  return out;
}

// One concatenated item row → {item_name, magn, unit, ein_verd, afsl_pct, upphaed}.
// Kredit lines carry a TRAILING minus on magn + upphæð ("30,00-Stk … 41.458-").
function parseItemLine(line) {
  // Fixed tail, form A: unit + ein.verð + afsl% + upphæð. Unit letters sit right
  // against the ein.verð number ("Stk1.547,58"); afsl and upphæð space-separated.
  let tail = line.match(/([A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö]{1,8})\s*((?:\d{1,3}\.)*\d{1,3},\d{2})\s+((?:\d{1,3}\.)*\d{1,3}(?:,\d{1,2})?)\s+((?:\d{1,3}\.)*\d{1,3})(-?)\s*$/);
  let afsl_pct;
  if (tail) { afsl_pct = parseDec(tail[3]) || 0; }
  else {
    // Form B: NO Afsl%-column — ein.verð and upphæð run together with no space
    // ("stk2.217,7417.742"; the ,dd decimals delimit them). Whole invoices can
    // lack the column (header "…MagnEin.verðUpphæð") or single 0%-lines within
    // a discounted invoice.
    const b = line.match(/([A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö]{1,8})\s*((?:\d{1,3}\.)*\d{1,3},\d{2})\s*((?:\d{1,3}\.)*\d{1,3})(-?)\s*$/);
    if (!b) return null;
    tail = [b[0], b[1], b[2], null, b[3], b[4]];
    afsl_pct = 0;
  }
  const unit = tail[1], ein_verd = parseDec(tail[2]);
  const negAmt = tail[5] === '-';
  let upphaed = parseIsk(tail[4]);
  const head = line.slice(0, line.length - tail[0].length);   // desc + magn (+ '-')
  const mg = head.match(/((?:\d{1,3}\.)*\d{1,4},\d{2})(-?)\s*$/);
  if (!mg || ein_verd == null || upphaed == null) return null;
  const full = mg[1], negQty = mg[2] === '-';
  if (negAmt) upphaed = -upphaed;
  const descBase = head.slice(0, head.length - mg[0].length);
  const sign = negQty || negAmt ? -1 : 1;
  const candidates = [];
  for (let cut = 0; cut < full.length; cut++) {
    const cand = full.slice(cut);
    if (/^(?:\d{1,3}\.)*\d{1,4},\d{2}$/.test(cand)) candidates.push(cand);
  }
  let magnStr = full;
  for (const cand of candidates) {
    const q = parseDec(cand);
    if (q == null || q <= 0) continue;
    const calc = Math.round(sign * q * ein_verd * (1 - afsl_pct / 100));
    if (Math.abs(calc - upphaed) <= Math.max(2, Math.abs(upphaed) * 0.005)) { magnStr = cand; break; }
  }
  const magn = parseDec(magnStr);
  const item_name = (descBase + full.slice(0, full.length - magnStr.length)).replace(/\s+/g, ' ').trim();
  if (!item_name || magn == null || magn <= 0) return null;
  return { item_name, magn: sign * magn, unit, ein_verd, afsl_pct, upphaed };
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
  // PDF-in skrifa spítalann á alla vegu: Landspítalinn/Landsspítali/landsspitali/
  // Nýi Landspítali … — stofn-lyklarnir grípa þau öll (substring-match að neðan).
  'landspítal': 'Landsspítalinn', 'landsspítal': 'Landsspítalinn', 'landspital': 'Landsspítalinn',
  'landsspital': 'Landsspítalinn',
  'nlsh': 'Landsspítalinn', 'nlsh 5-6. hæð': 'Landsspítalinn', 'nlsh 5-6': 'Landsspítalinn',
  'orkureitur': 'Orkureitur', 'fjallaböðin': 'Fjallaböðin Þjórsárdal', 'fjallaböð': 'Fjallaböðin Þjórsárdal',
};
// DB-backed aliases (verkefnalisti a12d429a): manual worksite renames made in
// the Efniskostnaður tab write into `project_aliases` (POST /api/redder-invoices
// {action:'rename_worksite', learn_alias:true}) — loaded once per invocation so
// future PDF reads normalise straight to the canonical name without a code
// change. DB aliases win over the hardcoded ALIAS map (they're user-curated).
let ALIAS_DB = {};
async function loadAliasesFromDb() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/project_aliases?select=alias,canonical_name`, { headers: sbHeaders() });
    if (!r.ok) return;
    const rows = await r.json();
    for (const row of rows) if (row.alias && row.canonical_name) ALIAS_DB[String(row.alias).toLowerCase().trim()] = row.canonical_name;
  } catch (_) {}
}
function normWorksite(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  // Öryggisventill (03.09.2026): rusl úr lesaranum má ALDREI lenda sem verkstaður —
  // slík röð hverfur úr Efniskostnaði og efnið ratar hvergi. Betra að skila null
  // (birtist sem „óparað" og er hægt að tengja handvirkt).
  if (n.length > 60 || /\d[.,]\d{2}\b/.test(n)) return null;
  const key = n.toLowerCase().replace(/\s+/g, ' ').trim();
  if (ALIAS_DB[key]) return ALIAS_DB[key];
  if (ALIAS[key]) return ALIAS[key];
  for (const a in ALIAS_DB) if (key.indexOf(a) >= 0) return ALIAS_DB[a];
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
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('upsert ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const arr = await r.json().catch(() => []);
  return Array.isArray(arr) ? arr[0] : null;
}
// Wipe + re-insert the invoice's line items (same semantics as the
// /api/redder-invoices POST). Called ONLY when the parse found lines.
async function replaceLineItems(invoice_id, lines) {
  await fetch(`${SUPABASE_URL}/rest/v1/redder_line_items?invoice_id=eq.${invoice_id}`, {
    method: 'DELETE', headers: sbHeaders(),
  });
  const rows = lines.map((li, i) => ({
    invoice_id, line_no: i + 1,
    item_code: li.item_code || null, item_name: li.item_name || null,
    magn: li.magn, unit: li.unit || null, ein_verd: li.ein_verd,
    afsl_pct: li.afsl_pct, upphaed: li.upphaed,
  }));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/redder_line_items`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error('lines ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
