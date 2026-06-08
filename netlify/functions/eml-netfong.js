// eml-netfong.js — backfill fyrirtaeki.netfang from bokhald@eldklar.is SENT
// invoices (.eml) stored in Drive. The synced email_digest only has inbox, so
// these sent messages must be read directly server-side.
//
//   GET /api/eml-netfong?folder=FOLDER_ID[&dry=1][&limit=10][&offset=N]
//
// For each .eml: read the To: header (= the customer's email), identify the
// customer from the kt in the headers or the name/address in the filename,
// match a single fyrirtaeki row, and — only where netfang is blank — fill it,
// writing a reversible row into netfang_backfill_log first. Generic/own
// addresses (bokhald@/eldklar/noreply/korta/brunaholf/…) are never used.
// Batched by offset/limit; the UI pages through. dry=1 reports without writing.

const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const GENERIC = /(bokhald|no-?reply|donotreply|postmaster|mailer-daemon|korta|eldklar|brunaholf|slokkvit|aggisigurds|payday|kreditkort|valitor|teya)/i;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const folder = (p.folder || '').trim();
  if (!folder) return json(400, { error: 'folder required' });
  const dry = p.dry === '1' || p.dry === 'true';
  const limit = Math.min(parseInt(p.limit || '10', 10) || 10, 30);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const stats = {
    folder, dry, total: 0, offset, scanned: 0, filled: 0, already: 0,
    generic: 0, noMatch: 0, ambiguous: 0, errors: 0, rows: [],
  };

  try {
    const cos = await loadFyrirtaeki();
    const idx = buildIndex(cos);
    const files = await listEml(folder, token);
    stats.total = files.length;
    const slice = files.slice(offset, offset + limit);
    for (const f of slice) {
      stats.scanned++;
      try {
        const headers = await fetchHeaders(f.id, token);
        const to = pickCustomerEmail(headers);
        if (!to) { stats.generic++; stats.rows.push({ file: f.title, action: 'engin gild To-netfang' }); continue; }
        const m = matchCompany(f.title, headers, idx);
        if (!m) { stats.noMatch++; stats.rows.push({ file: f.title, to, action: 'fann ekki kúnna' }); continue; }
        if (m.ambiguous) { stats.ambiguous++; stats.rows.push({ file: f.title, to, action: `margir mögulegir (${m.n})`, by: m.matchedBy }); continue; }
        const co = m.co;
        if (co.netfang && co.netfang.trim()) { stats.already++; stats.rows.push({ file: f.title, to, co: co.nafn, action: 'hefur þegar netfang' }); continue; }
        if (!dry) await backupAndFill(co, to, m.matchedBy, f);
        co.netfang = to; // reflect locally so a 2nd .eml for same co counts as "already"
        stats.filled++;
        stats.rows.push({ file: f.title, to, co: co.nafn, kt: co.kennitala, by: m.matchedBy, action: dry ? 'mun fylla' : 'fyllt' });
      } catch (e) { stats.errors++; stats.rows.push({ file: f.title, action: 'villa: ' + e.message }); }
    }
    stats.nextOffset = offset + slice.length < files.length ? offset + slice.length : null;
  } catch (e) {
    return json(500, { error: e.message, stats });
  }
  return json(200, stats);
};

// ── Matching ─────────────────────────────────────────────────────────────────
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFC')
    .replace(/[.,'"()/]/g, ' ').replace(/\b(ehf|hf|slf|sf|inc|ltd)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function buildIndex(cos) {
  const byKt = new Map(), byNafn = new Map(), byHeim = new Map();
  for (const c of cos) {
    if (c.kennitala) { const k = String(c.kennitala).replace(/\D/g, ''); if (k) (byKt.get(k) || byKt.set(k, []).get(k)).push(c); }
    const n = norm(c.nafn); if (n) (byNafn.get(n) || byNafn.set(n, []).get(n)).push(c);
    const h = norm(c.heimilisfang); if (h) (byHeim.get(h) || byHeim.set(h, []).get(h)).push(c);
  }
  return { cos, byKt, byNafn, byHeim };
}
function uniq(arr) { return arr && arr.length === 1 ? { co: arr[0] } : (arr && arr.length > 1 ? { ambiguous: true, n: arr.length } : null); }

function matchCompany(title, headers, idx) {
  // 1) kt in the .eml headers (rare but exact) — take the non-issuer kt
  const re = /\b(\d{6})-?(\d{4})\b/g; let mm;
  while ((mm = re.exec(headers))) {
    const kt = mm[1] + mm[2]; if (kt === ISSUER_KT) continue;
    const hit = uniq(idx.byKt.get(kt)); if (hit) return Object.assign({ matchedBy: 'kt-exact' }, hit);
  }
  // 2) customer name/address from the filename
  const cand = custFromTitle(title);
  if (!cand) return null;
  const nc = norm(cand);
  let hit = uniq(idx.byNafn.get(nc)); if (hit) return Object.assign({ matchedBy: 'nafn-exact' }, hit);
  hit = uniq(idx.byHeim.get(nc)); if (hit) return Object.assign({ matchedBy: 'heimilisfang-exact' }, hit);
  // 3) conservative contains — only if it resolves to exactly one row
  if (nc.length >= 5) {
    const m = idx.cos.filter(c => { const n = norm(c.nafn), h = norm(c.heimilisfang); return (n && (n === nc || n.includes(nc) || nc.includes(n))) || (h && (h === nc || h.includes(nc) || nc.includes(h))); });
    const u = uniq(m); if (u) return Object.assign({ matchedBy: 'nafn-contains' }, u);
  }
  return null;
}
function custFromTitle(title) {
  let t = String(title).replace(/\.eml$/i, '');
  t = t.replace(/\(bokhald@eldklar\.is\)/ig, ' ').replace(/'/g, ' ');
  t = t.replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s+\d{3,4}\s*$/, ''); // trailing " - YYYY-MM-DD HHMM"
  const seg = t.split(/\s+-\s+/)[0].trim();
  if (!seg || /^(slökkvitæki|slokkvitaeki|reikningur|kreditreikningur|kvittun|fwd|re|áminning|aminning)\b/i.test(seg)) return null;
  return seg;
}

// ── Email header parsing ─────────────────────────────────────────────────────
function unfold(headers) { return headers.replace(/\r?\n[ \t]+/g, ' '); }
function headerVal(headers, name) {
  const m = unfold(headers).match(new RegExp('^' + name + ':\\s*(.*)$', 'im'));
  return m ? m[1].trim() : '';
}
function pickCustomerEmail(headers) {
  const to = headerVal(headers, 'To') + ' ' + headerVal(headers, 'Cc');
  const emails = (to.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/ig) || []);
  for (const e of emails) if (!GENERIC.test(e)) return e.toLowerCase();
  return null;
}

// ── Drive ────────────────────────────────────────────────────────────────────
async function listEml(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and mimeType='message/rfc822' and trashed=false`,
      fields: 'files(id,name),nextPageToken', pageSize: '300',
      includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const d = await r.json();
    for (const f of (d.files || [])) out.push({ id: f.id, title: f.name });
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}
async function fetchHeaders(id, token) {
  // Only the first 16 KB — enough for the headers, cheap even for huge .eml.
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}`, Range: 'bytes=0-16383' },
  });
  if (!r.ok && r.status !== 206) return '';
  const buf = Buffer.from(await r.arrayBuffer());
  const text = buf.toString('utf8');
  const end = text.indexOf('\r\n\r\n'); const end2 = text.indexOf('\n\n');
  const cut = end >= 0 ? end : (end2 >= 0 ? end2 : text.length);
  return text.slice(0, cut);
}

// ── Supabase ─────────────────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function loadFyrirtaeki() {
  const out = []; let from = 0; const page = 1000;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?select=id,nafn,kennitala,netfang,heimilisfang&deleted_at=is.null`, {
      headers: sbHeaders({ Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) throw new Error('fyrirtaeki ' + r.status);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < page) break; from += page;
  }
  return out;
}
async function backupAndFill(co, to, matchedBy, file) {
  const log = await fetch(`${SUPABASE_URL}/rest/v1/netfang_backfill_log`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ fyrirtaeki_id: co.id, kennitala: co.kennitala, nafn: co.nafn, old_netfang: co.netfang || null, new_netfang: to, to_addr: to, matched_by: matchedBy, source_file: file.title, source_file_id: file.id }),
  });
  if (!log.ok) throw new Error('backup ' + log.status + ' ' + (await log.text()).slice(0, 120));
  // Guard: only fill where still blank (never overwrite).
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?id=eq.${co.id}&or=(netfang.is.null,netfang.eq.)`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ netfang: to }),
  });
  if (!r.ok) throw new Error('update ' + r.status + ' ' + (await r.text()).slice(0, 120));
}
