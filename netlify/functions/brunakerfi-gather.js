// brunakerfi-gather.js — safnar BRUNAKERFI-skýrslum (viðtökupróf / árleg prófun á
// brunaviðvörunarkerfi) sem liggja DREIFÐAR um Drive, endurnefnir þær á kanónískt
// snið, FÆRIR þær í „Brunakerfisúttektir"-möppuna og skráir í customer_documents
// (doc_type='brunakerfi'). Byggt á uttekt-rename.js — sömu battle-tested þáttun.
//
//   GET /api/brunakerfi-gather?status=1              → talning (frambjóðendur, eftir)
//   GET /api/brunakerfi-gather?dry=1[&limit=8]       → skoða (ENGIN færsla/skráning)
//   GET /api/brunakerfi-gather[&limit=6]             → FÆRA + skrá (batchað, resumable)
//
// ÖRYGGI: aðeins skrár sem sannreynast (efnislega) sem brunakerfi-skýrsla eru
// færðar. Reikningar, slökkvitækja-úttektir og ólæsileg skjöl eru SLEPPT (ekki
// færð). Færsla er afturkræf (skrá er ekki eytt, bara flutt milli mappa).

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEST = '1OtsCTzM6FEQbaKBrQ7SqEU6xFKGBWICu';   // „Brunakerfisúttektir" (mappan sem Agnar bjó til)
const MONTHS = 'janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember';

function sbHeaders(extra) {
  return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, extra || {});
}

// ── Drive með backoff (afrit úr uttekt-rename) ─────────────────────────────────
async function driveFetch(url, opts, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.ok || (r.status !== 403 && r.status !== 429 && r.status < 500)) return r;
      last = r;
    } catch (e) { last = e; }
    if (i < tries - 1) await new Promise(res => setTimeout(res, 400 * Math.pow(2, i) + Math.floor(Math.random() * 300)));
  }
  if (last instanceof Error) throw last;
  return last;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const p = event.queryStringParameters || {};
  const dry = p.dry === '1';
  const limit = Math.min(parseInt(p.limit || (dry ? '8' : '6'), 10) || 6, 12);

  // Frambjóðendur: PDF með brunakerfi-vísandi nafni, hvar sem er á Drive-inu.
  // (Nafna-forsía; INNIHALD sker svo úr — sjá isBrunakerfi.)
  let candidates;
  try { candidates = await findCandidates(token); }
  catch (e) { return json(500, { error: 'Drive leit mistókst: ' + e.message }); }

  // Sleppa þeim sem eru ÞEGAR í áfangamöppunni (resumable) og tvítökum.
  const pending = candidates.filter(f => !(f.parents || []).includes(DEST));

  if (p.status === '1') {
    return json(200, { total_candidates: candidates.length, already_in_dest: candidates.length - pending.length, pending: pending.length });
  }

  const stats = { dest: DEST, total_candidates: candidates.length, pending: pending.length,
                  scanned: 0, moved: 0, indexed: 0, skipped: 0, errors: 0, rows: [] };
  const T0 = Date.now();
  let work = 0;
  for (const f of pending) {
    if (work >= limit || (Date.now() - T0) > 9000) break;
    work++; stats.scanned++;
    try {
      const text = await readPdfText(f.id, token);
      const isInvoice = /\bR[\s_-]?\d{5,7}\b/i.test(f.name) || /til greiðslu|reikningsnr|gjalddagi\s*-?\s*eindagi|samtals fyrir vsk/i.test(text);
      // Efnisleg staðfesting: brunaviðvörunarkerfi viðtökupróf/árleg prófun.
      // Aðgreint frá slökkvitækja-úttekt (sem hefur „Fjöldi:"-búnaðartöflu).
      const brunaHit = /brunaviðvörunarkerfi|viðtökupróf|árleg prófun/i.test(text);
      const brunaBody = /stjórnstöð|jaðarbúnað|boðsendir|reykskynjur|handboð/i.test(text);
      const hasIssuer = text.replace(/\D/g, '').includes(ISSUER_KT);
      const isBruna = !isInvoice && brunaHit && (brunaBody || hasIssuer);
      if (!isBruna) {
        stats.skipped++;
        stats.rows.push({ fileId: f.id, name: f.name, action: 'skip',
          reason: isInvoice ? 'reikningur' : !brunaHit ? 'ekki brunakerfi-skýrsla (innihald)' : 'óviss' });
        continue;
      }

      // Þáttun (sömu reglur og uttekt-rename)
      let kt = customerKt(text);
      const old = fieldsFromOldName(f.name);
      kt = kt || old.kt || null;
      let base = kt ? await matchBase(kt) : null;
      const party = parseParty(text, base && base.nafn);
      const realish = c => { const t = String(c || '').normalize('NFD').replace(/[^a-z]/gi, ''); return t.length >= 3 && !/^kt[\s\d-]*$/i.test(String(c || '').trim()); };
      let company = (base && realish(base.nafn)) ? String(base.nafn).trim()
                  : realish(party.company) ? String(party.company).trim()
                  : (party.company || (base && base.nafn) || old.company || '').trim();
      const address = expandCity(stripCompanyPrefix(old.address || party.address || extractAddress(text), company));
      const di = dateInfo(text);
      const nameYear = (f.name.match(/\b(20[0-3]\d)\b/) || [])[1] || '';
      const month = di.month || old.month || '';
      const year = di.year || old.year || nameYear || '';
      // Öfug kt-uppfletting eftir nafni ef kt vantar
      if (!kt && realish(company)) { const fk = await ktByCompanyName(company, address); if (fk) { kt = fk.replace(/\D/g, ''); base = await matchBase(kt); } }
      const siteId = base ? await matchSite(base.id, address) : null;

      // Kanónískt nafn ef nóg er vitað; annars halda upphaflegu nafni.
      let newName = f.name;
      if (realish(company) && kt && year) {
        newName = sanitize(company) + (address ? ' - ' + sanitize(address) : '') + ' - ' + dash(kt) + ' - ' + year + (month ? ' - ' + month : '') + ' - brunakerfi' + (siteId ? ' - #' + siteId : '') + '.pdf';
      }

      const row = { fileId: f.id, oldName: f.name, newName, company, kt: kt ? dash(kt) : '', address, year: year || '', site_id: siteId || null };

      if (dry) { row.action = 'would-move'; stats.rows.push(row); continue; }

      // 1) FÆRA (+ endurnefna) í áfangamöppuna — addParents/removeParents.
      const removeParents = (f.parents || []).join(',');
      const upd = await driveFetch(
        'https://www.googleapis.com/drive/v3/files/' + f.id + '?supportsAllDrives=true&addParents=' + DEST +
          (removeParents ? '&removeParents=' + encodeURIComponent(removeParents) : '') + '&fields=id,parents',
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(newName !== f.name ? { name: newName } : {}) });
      if (!upd.ok) { stats.errors++; row.action = 'error'; row.error = 'move ' + upd.status + ': ' + (await upd.text().catch(() => '')).slice(0, 120); stats.rows.push(row); continue; }
      stats.moved++; row.action = 'moved';

      // 2) SKRÁ í customer_documents (doc_type='brunakerfi'), idempotent á drive_file_id.
      try {
        const ex = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(f.id)}&select=id&limit=1`, { headers: sbHeaders() });
        const exRows = await ex.json().catch(() => []);
        if (Array.isArray(exRows) && exRows[0]) {
          await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${exRows[0].id}`, {
            method: 'PATCH', headers: sbHeaders(),
            body: JSON.stringify(Object.assign({ doc_type: 'brunakerfi', year: year ? +year : null, customer_name: company },
              base ? { customer_base_id: base.id } : {}, siteId ? { fyrirtaeki_id: siteId } : {})) });
          row.indexed = 'updated';
        } else {
          await fetch(`${SUPABASE_URL}/rest/v1/customer_documents`, {
            method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }),
            body: JSON.stringify({ drive_file_id: f.id, doc_type: 'brunakerfi', year: year ? +year : null,
              customer_base_id: base ? base.id : null, fyrirtaeki_id: siteId || null, customer_name: company,
              notes: 'brunakerfi-gather ' + new Date().toISOString().slice(0, 10) }) });
          row.indexed = 'inserted';
        }
        stats.indexed++;
      } catch (e) { row.index_error = String(e.message || e); }
      stats.rows.push(row);
    } catch (e) { stats.errors++; stats.rows.push({ fileId: f.id, name: f.name, action: 'error', error: String(e.message || e) }); }
  }
  stats.done = stats.scanned < 1 || (stats.moved + stats.skipped + stats.errors) >= pending.length || work < limit;
  stats.remaining = Math.max(0, pending.length - stats.moved - stats.skipped);
  return json(200, stats);
};

// ── Frambjóðenda-leit: brunakerfi-vísandi nöfn hvar sem er á Drive ─────────────
async function findCandidates(token) {
  // Drive `contains` er hástafa-ónæmt; nota mörg brot (broddstafir brenglast í
  // skráarheitum) OR-að. INNIHALD sker svo úr — þetta er bara forsía.
  const tokens = ['brunakerf', 'runaker', 'brunaviðvörun', 'runavi', 'viðtökupr', 'i_t_kupr', 'vidtokupr', 'árleg prófun', 'rleg pr'];
  const seen = {};
  for (const tk of tokens) {
    let pageToken = null;
    do {
      const params = new URLSearchParams({
        q: `name contains '${tk.replace(/'/g, "\\'")}' and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id,name,parents),nextPageToken', pageSize: '300',
        includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const r = await driveFetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('list ' + r.status);
      const d = await r.json();
      for (const f of (d.files || [])) seen[f.id] = f;
      pageToken = d.nextPageToken;
    } while (pageToken);
  }
  return Object.values(seen);
}
async function readPdfText(id, token) {
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
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
  const cp = await driveFetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-ocr-' + id, mimeType: 'application/vnd.google-apps.document' }) });
  if (!cp.ok) return '';
  const doc = await cp.json(); if (!doc || !doc.id) return '';
  let text = '';
  try { const ex = await driveFetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: `Bearer ${token}` } }); if (ex.ok) text = await ex.text(); } catch (_) {}
  try { await driveFetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch (_) {}
  return text;
}

// ── Þáttun (afrit úr uttekt-rename.js) ─────────────────────────────────────────
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
const MNAME = { 1: 'janúar', 2: 'febrúar', 3: 'mars', 4: 'apríl', 5: 'maí', 6: 'júní', 7: 'júlí', 8: 'ágúst', 9: 'september', 10: 'október', 11: 'nóvember', 12: 'desember' };
function dateInfo(text) {
  const t = String(text || '');
  const m = t.match(/\bdags\.?\s*:?\s*(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/i);
  if (m) { const mo = parseInt(m[2], 10); let y = m[3]; if (y.length === 2) y = '20' + y; if (mo >= 1 && mo <= 12) return { month: MNAME[mo], year: y }; }
  const re = new RegExp('\\b(' + MONTHS + ')\\s+(20\\d{2})\\b', 'gi');
  let mm;
  while ((mm = re.exec(t))) { const before = t.slice(Math.max(0, mm.index - 32), mm.index); if (/næst|next/i.test(before)) continue; return { month: mm[1].toLowerCase(), year: mm[2] }; }
  return { month: '', year: '' };
}
function parseParty(text, baseName) {
  const t = String(text || '');
  const m = t.match(/hjá\s+fyrirt(?:æki|aeki)nu\s+(.+?)\.?\s*Kt\b/i);
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
  let company = '', address = '';
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
    if (/helluhraun|slökkvitæki|brunakerfi|vsk\s*nr/i.test(street)) continue;
    return street + ', ' + city;
  }
  return '';
}
function fieldsFromOldName(name) {
  const parts = String(name || '').replace(/\.pdf$/i, '').split(' - ').map(s => s.trim());
  const out = { company: '', address: '', kt: '', month: '', year: '' };
  const ktIdx = parts.findIndex(s => /^\d{6}-?\d{4}$/.test(s.replace(/\s/g, '')));
  out.company = (ktIdx === 0) ? '' : (parts[0] || '');
  if (ktIdx >= 0) {
    out.kt = parts[ktIdx].replace(/\D/g, '');
    if (ktIdx > 1) out.address = parts.slice(1, ktIdx).join(', ').replace(/\s+/g, ' ').trim();
    parts.slice(ktIdx + 1).forEach(p => {
      if (new RegExp('^(' + MONTHS + ')$', 'i').test(p)) out.month = p.toLowerCase();
      else if (/^20\d{2}$/.test(p)) out.year = p;
    });
  }
  return out;
}
function stripCompanyPrefix(addr, company) {
  let a = String(addr || '').replace(/\s+/g, ' ').trim();
  const c = String(company || '').trim();
  if (c && a.toLowerCase().indexOf(c.toLowerCase()) === 0) a = a.slice(c.length).replace(/^[\s,;:.\-]+/, '').trim();
  return a;
}
function expandCity(a) {
  return String(a || '')
    .replace(/\b(\d{3})\s+Rvk\.?\b/i, '$1 Reykjavík').replace(/\b(\d{3})\s+Hfj\.?\b/i, '$1 Hafnarfjörður')
    .replace(/\b(\d{3})\s+Kóp\.?\b/i, '$1 Kópavogur').replace(/\b(\d{3})\s+Grb\.?\b/i, '$1 Garðabær')
    .replace(/\b(\d{3})\s+Mos\.?\b/i, '$1 Mosfellsbær').replace(/\s+/g, ' ').trim();
}
const dash = kt => (kt && kt.length === 10) ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;
function sanitize(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 70); }
function foldNm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(ehf|hf|slf|sf)\.?\b/g, '').replace(/[^a-z0-9]+/g, ''); }
let _ktByNameCache = null;
async function ktByCompanyName(company, address) {
  const key = foldNm(company);
  if (!key || key.length < 4) return null;
  if (!_ktByNameCache) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?deleted_at=is.null&kennitala=not.is.null&select=nafn,kennitala,heimilisfang&limit=5000`, { headers: sbHeaders() });
    const rows = await r.json().catch(() => []);
    _ktByNameCache = Array.isArray(rows) ? rows : [];
  }
  const hits = _ktByNameCache.filter(x => foldNm(x.nafn) === key && String(x.kennitala || '').replace(/\D/g, '').length === 10);
  if (!hits.length) return null;
  const kts = [...new Set(hits.map(h => String(h.kennitala).replace(/\D/g, '')))];
  if (kts.length === 1) return hits[0].kennitala;
  if (address) {
    const ak = siteAddrKey(address);
    const byAddr = hits.filter(h => siteAddrKey(h.heimilisfang) === ak);
    const akts = [...new Set(byAddr.map(h => String(h.kennitala).replace(/\D/g, '')))];
    if (akts.length === 1) return byAddr[0].kennitala;
  }
  return null;
}
async function matchBase(kt) {
  if (!kt) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
function siteAddrKey(s) {
  const t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const num = (t.match(/(\d+)/) || [])[1] || '';
  const street = (t.replace(/\d.*/, '').match(/[a-z]+/g) || []).join('').slice(0, 6);
  return street + '|' + num;
}
async function matchSite(baseId, address) {
  if (!baseId) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?customer_base_id=eq.${baseId}&deleted_at=is.null&select=id,heimilisfang`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return null;
  if (rows.length === 1) return rows[0].id;
  const ak = siteAddrKey(address);
  if (!ak || ak === '|') return null;
  const m = rows.filter(s => siteAddrKey(s.heimilisfang) === ak);
  return m.length === 1 ? m[0].id : null;
}
