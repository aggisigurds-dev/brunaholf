// drive-multitool.js — Fasi 1 (AÐEINS forskoðun / READ-ONLY) af sameinaða
// „Skjala-multitool". Les Drive-möppu (og undirmöppur), OCR-flokkar hvert PDF og
// skilar TILLÖGU um hvað ætti að gera við það — EN FÆRIR EKKERT og SKRIFAR
// EKKERT (hvorki Drive né Supabase). Þetta er öryggis-ábyrgðin: allur þessi
// endapunktur er les-eingöngu. (Fasi 2 bætir við eyðileggjandi „keyra".)
//
// Byggt á drive-sort.js — endurnýtir SAMA innihalds-lesara (pdf-parse → Google-Doc
// OCR fallback), sömu issuer-kt lógík (Slökkvitæki útgefandi kt 600508-0400),
// kt-/R-númer-/árs-útdrátt og _spine tengiregluna (sitesForBase / resolveSite).
// Hjálparföllin eru AFRITUÐ hingað (sjálf-innihaldið, Fasi-1 hagkvæmni) — seinni
// hreinsun væri sameiginlegt `_docread.js` sem drive-sort + reikningar-read +
// þessi deildu (NÓTA: refactor síðar).
//
//   GET /api/drive-multitool?src=<folderId>[&recurse=1][&limit=3][&offset=N]
//        → les `limit` skjöl (sjálfgefið 3, ~10s hámark per kall), skilar
//          forskoðunar-röðum; UI lykkjar offset þar til nextOffset==null.
//
// ENGIN files.update / move, ENGIN Supabase-skrif — les eingöngu.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');
const { sitesForBase, resolveSite } = require('./_spine');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

// ── Drive (les eingöngu) ────────────────────────────────────────────────────
function folderId(raw) { const s = String(raw || '').trim(); const m = s.match(/[-\w]{25,}/); return m ? m[0] : s; }

// List ALL direct children of one folder (paged), files AND subfolders.
async function listChildren(token, folder) {
  const out = []; let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,parents),nextPageToken',
      pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    out.push(...(d.files || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return out;
}
// List every PDF in the folder — the whole tree when `recurse`, else direct
// children only. Read-only walk (never moves anything), so — unlike drive-sort —
// we list the FULL set every call and slice by offset (files stay put). Sorted by
// name for stable paging across calls.
async function listPdfs(token, root, recurse) {
  const out = [], queue = [root], seen = new Set();
  while (queue.length) {
    const folder = queue.shift();
    if (seen.has(folder)) continue; seen.add(folder);
    let kids; try { kids = await listChildren(token, folder); } catch (e) { throw e; }
    for (const c of kids) {
      if (c.mimeType === FOLDER_MIME) { if (recurse) queue.push(c.id); continue; }
      if (/pdf$/i.test(c.name || '') || /pdf/i.test(c.mimeType || '')) out.push(c);
    }
  }
  out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'is'));
  return out;
}
// DEEP-READ a file via Drive OCR (Google-Doc extraction) as PRIMARY path, with
// pdf-parse as fallback — the reliable reader for dkPlus PDFs (copied verbatim
// from drive-sort). This is the only per-file cost (OCR copy→export→delete).
async function readContent(id, token) {
  let text = await driveOcr(id, token).catch(() => '');
  if ((text || '').replace(/\s/g, '').length >= 25) return text;
  try {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { const d = await pdf(Buffer.from(await r.arrayBuffer())); text = d ? (d.text || '') : ''; }
  } catch (_) {}
  return text;
}
async function driveOcr(id, token) {
  const cp = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-ocr-' + id, mimeType: 'application/vnd.google-apps.document' }),
  });
  if (!cp.ok) return '';
  const doc = await cp.json(); if (!doc || !doc.id) return '';
  let text = '';
  try { const ex = await fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: `Bearer ${token}` } }); if (ex.ok) text = await ex.text(); } catch (_) {}
  // Best-effort cleanup of the temp Google Doc — this is the ONLY Drive write the
  // function makes, and it only ever DELETES our own throwaway OCR copy (never a
  // real document). Fire-and-forget so the response isn't blocked on it.
  fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  return text;
}

// ── parsing (afritað úr drive-sort / reikningar-read) ───────────────────────
function cleanStem(name) { return String(name || '').replace(/\.pdf$/i, '').trim(); }
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
// Er Slökkvitæki ÚTGEFANDI (seljandi) skjalsins — ekki bara aðili á því? Eina
// örugga seljanda-merkið er VSK-númer Slökkvitæki (98107) — kaupanda-VSK er aldrei
// prentað — auk undirskriftar-lína skýrslu. Ekkert af þessu → vendor/other.
function slokkviIssuer(text) {
  return /VSK\s*nr\.?\s*:?\s*98107|fyrir\s+h[öo]nd\s+sl[öo]kkvit[æa]ki|verktaki:?\s*sl[öo]kkvit[æa]ki|yfirfarin\s+af\s+sl[öo]kkvit[æa]ki/i.test(text || '');
}
// Slökkvitæki-útgefin úttektarskýrsla EÐA brunaviðvörunarkerfis-skýrsla (bæði
// layoutin). Sömu orðalags-merkin og drive-sort.isReport.
function isReport(text) {
  return /úttektarsk[ýy]rsla|sko[ðd]unarsk[ýy]rsla|sk[ýy]rsla\s+vegna\s+[úu]ttektar|[úu]ttekt\w*\s+á\s+(brunasl[öo]ng|sl[öo]kkvit|handsl[öo]kkvit)|yfirfarin\s+af\s+sl[öo]kkvit[æa]ki|fyrir\s+h[öo]nd\s+sl[öo]kkvit[æa]ki|verktaki:?\s*sl[öo]kkvit[æa]ki|vi[ðd]t[öo]kupr[óo]f|árleg\w*\s+pr[óo]fun|árssko[ðd]un|brunavi[ðd]v[öo]runarkerfi/i.test(text || '');
}
// Fire-ALARM-system report wording (brunaviðvörunarkerfi — viðtökupróf / árleg
// prófun). Aðgreint frá slökkvitækja-úttekt (sem ber Fjöldi:-línur / búnaðar-talningar).
function isAlarmReport(text) {
  return /vi[ðd]t[öo]kupr[óo]f|árleg\w*\s+pr[óo]fun|brunavi[ðd]v[öo]runarkerfi/i.test(text || '');
}
// Slökkvitækja-búnaðar talningar (Fjöldi: … / duft / kolsýru / léttvatn / handslökkvitæki)
// — ef þær eru til er þetta slökkvitækja-úttekt, EKKI hrein brunakerfis-skýrsla.
function hasExtinguisherCounts(text) {
  return /Fjöldi\s*:|handsl[öo]kkvit|dufttæki|kols[ýy]ru|l[ée]ttvatn|CO2|slökkvit[æa]ki\s+\d/i.test(text || '');
}
// Þjónustusamningur.
function isSamningur(text) {
  return /þj[óo]nustusamning|samningur\s+um\s+þj[óo]nustu/i.test(text || '');
}
function invNum(text, name) {
  let m = String(name).match(/\bR[\s\-_]?(\d{5,7})\b/i); if (m) return 'R-' + m[1];
  m = String(text).match(/(?:kredit)?reikningur\s*(?:nr\.?\s*:?\s*)?(1\d{5})\b/i); if (m) return 'R-' + m[1];
  m = String(text).match(/Reikningur\s*nr\.?\s*:?\s*(\d{4,7})\b/i); if (m) return 'R-' + m[1];
  return '';
}
function yearFrom(s) {
  let m = String(s).match(/^(\d{4})-\d{2}-\d{2}/); if (m) return parseInt(m[1], 10);
  m = String(s).match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m) return 2000 + parseInt(m[1], 10);
  m = String(s).match(/\b(20\d{2})\b/); return m ? parseInt(m[1], 10) : null;
}
function totalFrom(text) {
  const kw = String(text).match(/Til\s*greiðslu\s*:?\s*(?:kr\.?)?\s*([\d.]{4,})/i); let best = 0;
  if (kw) { const n = parseInt(kw[1].replace(/\./g, ''), 10); if (Number.isFinite(n)) best = n; }
  const re = /\b\d{1,3}(?:\.\d{3})+\b/g; let m; while ((m = re.exec(String(text)))) { const n = parseInt(m[0].replace(/\./g, ''), 10); if (n > best) best = n; }
  return best || null;
}
function companyFrom(text, name) {
  const segs = cleanStem(name).split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
  const first = segs.find(s => s && !/^\d{4}-\d{2}-\d{2}$/.test(s) && !/^(bokhald|nóta|nota|kredit|reikningur|invoice|creditnote)$/i.test(s) && !/^R[\s\-_]?\d{4,7}$/i.test(s) && !/^\d{6}-?\d{4}$/.test(s));
  if (first && /[A-Za-zÁÉÍÓÚÝÆÖÞÐ]/.test(first)) return first.replace(/_/g, ' ').trim();
  return '';
}
// Site descriptor out of a report body (drive-sort.siteFrom).
function siteFrom(text) {
  const m = String(text || '').match(/hj[áa]\s+fyrirt[æa]kinu\s+(.+?)\s*[.,]?\s*(?:\bkt\b|\bKt\b|\d{6}-?\d{4})/i);
  let s = m ? m[1].replace(/\s+/g, ' ').trim().replace(/[.,]+$/, '') : '';
  return (s.length >= 4 && s.length <= 80) ? s : '';
}
// Customer address out of the PDF content (afritað úr reikningar-read.extractAddress)
// — auka-sönnun fyrir resolveSite (heimilisfang → nákvæmlega EINN stað).
function addrFromContent(text) {
  const t = String(text || '');
  const pairRe = /([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]*(?:[^\S\n]+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]+){0,3}[^\S\n]+\d{1,4}(?:[^\S\n]*[-–][^\S\n]*\d{1,4})?[a-dA-D]?)[,\s]+(\d{3}[^\S\n]+[A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð]+(?:bær|borg)?)/g;
  let m;
  while ((m = pairRe.exec(t))) {
    const street = m[1].replace(/\s+/g, ' ').trim();
    const city = m[2].replace(/\s+/g, ' ').trim();
    if (/helluhraun|slökkvitæki|brunakerfi|vsk\s*nr/i.test(street)) continue;
    if (/^(reikningur|kreditreikningur|dagsetning|krafa|skilmáli|raðnr|radnr)/i.test(street)) continue;
    return street + ', ' + city;
  }
  return '';
}
const dash = kt => (kt && kt.length === 10) ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;
function fmtIsk(n) { return n == null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function sanitize(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim(); }
function nameInvoice(co, ktd, inv, yr, tot) { return [sanitize(co) || 'Óþekkt', ktd || '', inv || '', yr || '', (tot != null ? fmtIsk(tot) + ' kr' : '')].filter(Boolean).join(' - ') + '.pdf'; }
function nameReport(co, ktd, yr, site) { return [sanitize(co) || 'Óþekkt', site ? sanitize(site) : '', ktd || '', 'úttektarskýrsla', yr || ''].filter(Boolean).join(' - ') + '.pdf'; }

// ── Supabase (les eingöngu) ─────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function matchBase(kt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
// Er skjalið ÞEGAR tengt í customer_documents?
//   reikningur          → eftir invoice_number (R-nr er einkvæmur)
//   uttektarskyrsla/     → eftir (customer_base_id, year, doc_type); fyrir
//   brunakerfi              rekstrarfélag með >1 lifandi stað BÆTIST fyrirtaeki_id
//                           við (annars gæti önnur starfsstöð litið út sem tvítak).
// Skilar existing_doc_id eða null.
async function existingDocId({ cls, inv, baseId, year, siteId, multiSite }) {
  try {
    if (cls === 'reikningur') {
      if (!inv) return null;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&invoice_number=eq.${encodeURIComponent(inv)}&drive_file_id=not.is.null&select=id&limit=1`, { headers: sbHeaders() });
      const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0].id : null;
    }
    if (cls === 'uttektarskyrsla' || cls === 'brunakerfi') {
      if (!baseId || !year) return null;
      // Multi-site án staðar-sönnunar → of óvíst til að fullyrða tvítak.
      if (multiSite && !siteId) return null;
      let url = `${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.${cls}&customer_base_id=eq.${baseId}&year=eq.${year}&drive_file_id=not.is.null&select=id&limit=1`;
      if (multiSite && siteId) url += `&fyrirtaeki_id=eq.${siteId}`;
      const r = await fetch(url, { headers: sbHeaders() });
      const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0].id : null;
    }
  } catch (_) {}
  return null;
}

// ── flokkun ─────────────────────────────────────────────────────────────────
// Skilar { doc_type, sub_hint, target }. Röð skiptir máli.
// ORÐALAG RÆÐUR (ekki OCR-viðkvæma útgefanda-merkið): skjöl sem VIÐ gerum
// (þjónustusamningar + skoðunar-/úttektarskýrslur) eru ALLTAF okkar — OCR-villa
// á útgefanda á ekki að henda þeim í vendor/other. issuer_ours er aðeins notað
// til að greina OKKAR reikning frá reikningi frá öðrum (báðir bera „reikningur").
function classify(text, name, inv, total, issuerOurs, invInName) {
  const t = text || '';
  const nm = name || '';
  // 1) Þjónustusamningur — sérkennandi orðalag, ekkert R-númer.
  if ((isSamningur(t) || /þj[óo]nustusamning/i.test(nm)) && !inv) {
    const sub = /brunakerfi|brunavi[ðd]v[öo]run/i.test(t + ' ' + nm) ? 'brunakerfi' : 'slökkvitæki';
    return { doc_type: 'samningur', sub_hint: sub, target: 'samningar' };
  }
  // 2) Reikningur — R-nr + „okkar"-merki (útgefanda-merki EÐA okkar nafna-venja).
  //    R-nr vinnur á undan skýrslu-orðalagi (sama röð og drive-sort).
  if (inv && (issuerOurs || invInName)) {
    // sub_hint AÐEINS af orðalagi — hrein upphæð (≥6000) er of gróft merki og
    // flaggaði venjulega slökkvitækja-reikninga ranglega sem brunakerfi.
    let sub = '';
    if (/[áa]rssko[ðd]un\s+brunakerfis|sk[ýy]rsluger[ðd]/i.test(t) ||
        (/brunakerfi|brunavi[ðd]v[öo]run/i.test(t) && !hasExtinguisherCounts(t))) sub = 'brunakerfi-reikningur';
    else if (total && total < 5000) sub = 'úttektar-reikningur';
    return { doc_type: 'reikningur', sub_hint: sub, target: 'reikningar-master' };
  }
  // 3) Hrein brunakerfis-skýrsla: brunaviðvörunar-orðalag OG engar slökkvitækja-talningar.
  if (isAlarmReport(t) && !hasExtinguisherCounts(t)) {
    const sub = /vi[ðd]t[öo]kupr[óo]f/i.test(t) ? 'viðtökupróf' : (/árleg/i.test(t) ? 'árleg prófun' : '');
    return { doc_type: 'brunakerfi', sub_hint: sub, target: 'brunakerfi' };
  }
  // 4) Slökkvitækja-úttektarskýrsla.
  if (isReport(t)) return { doc_type: 'uttektarskyrsla', sub_hint: '', target: 'skýrslur-reports' };
  // 5) Ekki okkar útgáfa (eða óviss): reikningslegt orðalag → vendor, annars other.
  const looksInvoice = !!inv || /reikningur|kreditreikning/i.test(t);
  return { doc_type: looksInvoice ? 'vendor' : 'other', sub_hint: '', target: 'óflokkað' };
}

// Forskoðun EINS skjals — les innihald, flokkar, byggir tengi-tillögu. ENGIN skrif.
async function previewFile(token, f) {
  const text = await readContent(f.id, token);
  const issuerOurs = slokkviIssuer(text);
  const kt = customerKt(text) || customerKt(f.name);
  const ktd = kt ? dash(kt) : '';
  const inv = invNum(text, f.name);
  // Ber skráarheitið OKKAR R-númera-venju („ - R NNNNNN - ")? Sterkt „okkar"-merki
  // óháð OCR (endurnefndir reikningar bera hana; vendor-skrár eins og Redder ekki).
  const invInName = /\bR[\s\-_]?\d{5,7}\b/i.test(f.name || '');
  const year = yearFrom(f.name) || yearFrom(text);
  const total = totalFrom(text);

  const cls = classify(text, f.name, inv, total, issuerOurs, invInName);

  // Hryggur: base úr kt; staður AÐEINS með sönnun (_spine.resolveSite).
  let base = null, sites = [], site = null, multiSite = false;
  if (kt) { try { base = await matchBase(kt); } catch (_) {} }
  if (base) {
    try { sites = await sitesForBase(base.id); } catch (_) { sites = []; }
    multiSite = sites.length > 1;
    const addr = addrFromContent(text) || (siteFrom(text) || null);
    try { site = resolveSite(f.name, sites, addr); } catch (_) { site = null; }
  }

  const coName = (base && base.nafn) || companyFrom(text, f.name) || '';

  // proposed_name — kanóníska endurnefningin (aðeins fyrir reikninga + skýrslur;
  // Fasi 1 NEFNIR bara, færir/endurnefnir ekki).
  let proposed_name = null;
  if (cls.doc_type === 'reikningur') proposed_name = nameInvoice(coName, ktd, inv, year, total);
  else if (cls.doc_type === 'uttektarskyrsla' || cls.doc_type === 'brunakerfi') proposed_name = nameReport(coName, ktd, year, site ? site.nafn : (multiSite ? siteFrom(text) : ''));

  // Þegar tengt?
  let existing_doc_id = null;
  if (cls.doc_type === 'reikningur' || cls.doc_type === 'uttektarskyrsla' || cls.doc_type === 'brunakerfi') {
    existing_doc_id = await existingDocId({ cls: cls.doc_type, inv, baseId: base ? base.id : null, year, siteId: site ? site.id : null, multiSite });
  }

  return {
    id: f.id,
    name: f.name,
    parents: f.parents || [],
    doc_type: cls.doc_type,
    sub_hint: cls.sub_hint || '',
    issuer_ours: !!issuerOurs,
    kt: ktd || '',
    base_id: base ? base.id : null,
    base_nafn: base ? base.nafn : (coName || null),
    site_id: site ? site.id : null,
    site_nafn: site ? site.nafn : null,
    site_via: site ? site.via : null,
    year: year || null,
    invoice_number: inv || '',
    proposed_name,
    target: cls.target,
    already_linked: !!existing_doc_id,
    existing_doc_id,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  // Les-eingöngu: hafnar öllu sem er ekki GET (engin skrif nokkurs staðar).
  if (event.httpMethod !== 'GET') return json(405, { error: 'read-only (GET aðeins)' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    const p = event.queryStringParameters || {};
    const src = folderId(p.src);
    if (!src) return json(400, { error: 'src required' });
    const recurse = p.recurse !== '0' && p.recurse !== 'false';   // sjálfgefið ON
    const limit = Math.min(Math.max(parseInt(p.limit || '3', 10) || 3, 1), 5);
    const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

    let token;
    try { token = await freshAccessToken(); }
    catch (e) { return json(401, { error: e.message }); }

    const files = await listPdfs(token, src, recurse);
    const total = files.length;
    const slice = files.slice(offset, offset + limit);

    const rows = [];
    const counts = {};
    for (const f of slice) {
      try {
        const row = await previewFile(token, f);
        rows.push(row);
        counts[row.doc_type] = (counts[row.doc_type] || 0) + 1;
      } catch (e) {
        rows.push({ id: f.id, name: f.name, parents: f.parents || [], doc_type: 'error', sub_hint: '', issuer_ours: false, kt: '', base_id: null, base_nafn: null, site_id: null, site_nafn: null, site_via: null, year: null, invoice_number: '', proposed_name: null, target: 'villa', already_linked: false, existing_doc_id: null, error: String(e.message || e) });
        counts.error = (counts.error || 0) + 1;
      }
    }

    const nextOffset = (offset + slice.length < total) ? offset + slice.length : null;
    return json(200, { ok: true, src, total, offset, nextOffset, recurse, processed: slice.length, rows, counts });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
