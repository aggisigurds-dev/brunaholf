// drive-multitool.js — sameinaða „Skjala-multitool". TVEIR endapunktar:
//
//   Fasi 1 — GET (AÐEINS forskoðun / READ-ONLY): les Drive-möppu (og undirmöppur),
//   OCR-flokkar hvert PDF og skilar TILLÖGU um hvað ætti að gera við það — EN
//   FÆRIR EKKERT og SKRIFAR EKKERT (hvorki Drive né Supabase). GET er alltaf
//   les-eingöngu.
//
//   Fasi 2 — POST {action:'apply', …} (EYÐILEGGJANDI „keyra"): tekur EITT skjal
//   sem notandinn hefur yfirfarið í forskoðuninni og (1) endurnefnir það í
//   `proposed_name`, (2) FÆRIR (relocate) það í `targetFolder` gegnum
//   files.update addParents/removeParents, (3) tengir `customer_documents` eftir
//   `linkMode` (warn / if_empty / overwrite). Öryggis-ábyrgðin: EKKERT gerist án
//   `action:'apply'` + skýrs `id`; ALDREI files.delete (tvítök eru FÆRÐ í ruslmöppu,
//   aldrei eytt); idempotent (endurkeyrsla → sama útkoma); vendor/other eru hvorki
//   færð né tengd nema UI sendi þeim markmöppu vísvitandi; hver skref er skráð í
//   `override_log` (field 'multitool_apply').
//
// Byggt á drive-sort.js — endurnýtir SÖMU sönnuðu frumaðgerðir (move/rename via
// files.update, upsert customer_documents, dedup-uppfletting) + _spine
// tengiregluna (sitesForBase / resolveSite / siteWriteAllowed). Hjálparföllin eru
// AFRITUÐ hingað (sjálf-innihaldið) — seinni hreinsun væri sameiginlegt
// `_docread.js` (NÓTA: refactor síðar).
//
//   GET  /api/drive-multitool?src=<folderId>[&recurse=1][&limit=3][&offset=N]
//        → les `limit` skjöl (sjálfgefið 3, ~10s hámark per kall), skilar
//          forskoðunar-röðum; UI lykkjar offset þar til nextOffset==null.
//   POST /api/drive-multitool  {action:'apply', id, doc_type, base_id, year,
//          invoice_number, site_id, proposed_name, targetFolder, linkMode}
//        → beitir EINU skjali; skilar {ok, id, renamed, moved, linked, linkAction,
//          conflict, doc_id}. UI keyrir valdar raðir í röð (samhliðni ≤2).

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');
const { sitesForBase, resolveSite, siteWriteAllowed, siteStampFromName } = require('./_spine');

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
      fields: 'files(id,name,mimeType,parents,createdTime),nextPageToken',
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
// we list the FULL set every call and slice by offset (files stay put). Röðun
// (`order`) svo hægt sé að lesa AÐEINS nýbættar skrár í stað þess að endur-OCR-a allt:
//   'name' (sjálfgefið) = stafrófsröð A→Ö (stöðug paging) ·
//   'name-desc'         = öfug stafrófsröð (síðustu nöfn fyrst) ·
//   'new'               = nýjast BÆTT við fyrst (createdTime desc) — best til að
//                         lesa bara „100 nýju" án þess að fara aftur í gegnum 1000.
async function listPdfs(token, root, recurse, order) {
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
  if (order === 'new') out.sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')));
  else if (order === 'name-desc') out.sort((a, b) => String(b.name).localeCompare(String(a.name), 'is'));
  else out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'is'));
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
// kt-lestur þolir bil við bandstrikið („510809 - 0170") OG þegar „Kt"/„kt." er límt
// beint framan á tölurnar („Kt540119-0660") — `\b` brást því 't5' er ekki orðamörk.
// `(?<!\d)`/`(?!\d)` verja gegn því að grípa mitt í lengri talnarunu.
function allKts(s) { const out = []; const re = /(?<!\d)(\d{6})\s?-?\s?(\d{4})(?!\d)/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
// Finna kt sem stendur skammt á eftir tilteknu kjölfestu-orðalagi (t.d. „Nafn:" eða
// „fyrir hönd Slökkvitæki") — notað til að greina kaupanda-kt frá undirritara-kt.
function ktNear(s, anchorRe) {
  const m = String(s || '').match(anchorRe);
  if (!m) return null;
  const seg = String(s).slice(m.index, m.index + 130);
  const k = seg.match(/kt\.?\s*:?\s*(\d{6})\s?-?\s?(\d{4})\b/i);
  return k ? (k[1] + k[2]) : null;
}
// Kaupanda-kt. ALDREI kt Slökkvitæki-útgefanda NÉ kt undirritaðs Slökkvitæki-fulltrúa
// („Fyrir hönd Slökkvitækja ehf … Frank Höybye kt: 080379-5019" er ekki kúnninn).
// Kjósum kt í kaupanda-blokkinni („Nafn: <félag> … kt: …"); annars fyrsta gilda kt.
function customerKt(s) {
  s = String(s || '');
  const repKt = ktNear(s, /fyrir\s+h[öo]nd\s+sl[öo]kkvit[æa]k/i);
  const bad = new Set([ISSUER_KT]); if (repKt) bad.add(repKt);
  const named = ktNear(s, /\bnafn\s*:/i);
  if (named && !bad.has(named)) return named;
  for (const kt of allKts(s)) if (!bad.has(kt)) return kt;
  return null;
}
// Er Slökkvitæki ÚTGEFANDI (seljandi) skjalsins — ekki bara aðili á því? Eina
// örugga seljanda-merkið er VSK-númer Slökkvitæki (98107) — kaupanda-VSK er aldrei
// prentað — auk undirskriftar-lína skýrslu. Ekkert af þessu → vendor/other.
function slokkviIssuer(text) {
  const t = text || '';
  // Seljanda-VSK 98107 er sterkasta merkið; leyfum bæði „VSK nr. 98107" OG bert
  // 98107 (OCR sleppir stundum „VSK nr."-forskeytinu). Kaupanda-VSK er ALDREI prentað
  // svo 98107 birtist eingöngu á reikningum sem VIÐ gefum út — óhætt.
  if (/VSK\s*nr\.?\s*:?\s*98107|\b98107\b|fyrir\s+h[öo]nd\s+sl[öo]kkvit[æa]ki|verktaki:?\s*sl[öo]kkvit[æa]ki|yfirfarin\s+af\s+sl[öo]kkvit[æa]ki/i.test(t)) return true;
  // Bakvörn þegar hausinn/98107 les illa (gamlir „Stolpi"-reikningar): Slökkvitæki-
  // þjónustulínur. Þessi orð eru á reikningi SEM VIÐ GEFUM ÚT (okkar vörulisti) — birgja-
  // reikningur til okkar ber þau aldrei. Krefjumst ≥2 aðgreinandi OG að Akstur EÐA
  // Skýrslugerð sé á reikningnum (Agnar 2026-07-26): þessar tvær línur eru á NÆR ÖLLUM
  // okkar þjónustureikningum en aldrei á birgja-reikningi til okkar → herðir fallbackið.
  return slokkviServiceLines(t) >= 2 && hasAksturOrSkyrsla(t);
}
// Akstur eða Skýrslugerð — einkennislínur á okkar þjónustureikningi. Krafa fyrir
// veika þjónustulínu-fallbackið (98107-seljanda-merkið stendur eitt sér, óháð þessu).
function hasAksturOrSkyrsla(text) {
  return /\bakstur\b/i.test(text || '') || /sk[ýy]rslu(?:g?jer[ðd]|ger[ðd])/i.test(text || '');
}
// Fjöldi aðgreinandi Slökkvitæki-þjónustulína í texta (okkar vörulisti).
function slokkviServiceLines(text) {
  const t = text || '';
  let n = 0;
  if (/l[ée]ttvatn/i.test(t)) n++;                                   // Léttvatnstæki
  if (/sk[ýy]rslugjer[ðd]|sk[ýy]rsluger[ðd]\s+og\s+vottun/i.test(t)) n++;   // Skýrslugerð og vottun
  if (/yfirfer[ðd]\s+(?:l[ée]ttvatn|co2|duft|kols[ýy]r)/i.test(t)) n++;
  if (/hle[ðd]sla\s+(?:l[ée]ttvatn|co2|duft|kols[ýy]r)/i.test(t)) n++;
  if (/kols[ýy]rut[æa]k|\bco2\b\s*\d/i.test(t)) n++;                  // Kolsýra / Co2 N kg
  if (/handsl[öo]kkvit[æa]k/i.test(t)) n++;
  return n;
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
  s = String(s);
  let m = s.match(/^(\d{4})-\d{2}-\d{2}/); if (m) return parseInt(m[1], 10);
  m = s.match(/\b\d{1,2}\.\d{1,2}\.(\d{2})\b/); if (m) return 2000 + parseInt(m[1], 10);
  // MIKILVÆGT: fjarlægja kennitölur fyrst — kt endar oft á „20xx" (500993-2009,
  // 481205-2040) og var ranglega lesið sem árið. Póstnúmer eru 3 stafir (101/201)
  // svo þau rugla ekki „20\d\d".
  const noKt = s.replace(/(?<!\d)\d{6}\s?-?\s?\d{4}(?!\d)/g, ' ');
  m = noKt.match(/\b(20\d{2})\b/); return m ? parseInt(m[1], 10) : null;
}
function totalFrom(text) {
  const kw = String(text).match(/Til\s*greiðslu\s*:?\s*(?:kr\.?)?\s*([\d.]{4,})/i); let best = 0;
  if (kw) { const n = parseInt(kw[1].replace(/\./g, ''), 10); if (Number.isFinite(n)) best = n; }
  const re = /\b\d{1,3}(?:\.\d{3})+\b/g; let m; while ((m = re.exec(String(text)))) { const n = parseInt(m[0].replace(/\./g, ''), 10); if (n > best) best = n; }
  return best || null;
}
function companyFrom(text, name) {
  // Strjúka dkPlus/bókhalds-forskeyti sem lauma sér fremst í nafnið þegar kt
  // leysist EKKI í base („2024-03-22-bokhald-Ölfusborgir 2024", „bokhald-Nóta",
  // „Stolpi_Invoice_104702"): leiðandi ISO-dagsetning, „bokhald", Stolpi/Nóta-tákn.
  let stem = cleanStem(name)
    .replace(/^\d{4}-\d{2}-\d{2}[-_\s]*/, '')                          // leiðandi ISO-dagsetning
    .replace(/^bokhald[-_\s]*/i, '')                                   // leiðandi „bokhald-"
    .replace(/\bStolpi[_\-\s]?(?:Invoice|CreditNote)[_\-\s]?\d*/ig, ' ')
    .replace(/\bbokhald\b/ig, ' ')
    .replace(/\bN[óo]ta\b/ig, ' ')
    .replace(/\s+/g, ' ').trim();
  const segs = stem.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
  const first = segs.find(s => s && !/^\d{4}-\d{2}-\d{2}$/.test(s) && !/^(bokhald|nóta|nota|kredit|reikningur|invoice|creditnote)$/i.test(s) && !/^R[\s\-_]?\d{4,7}$/i.test(s) && !/^\d{6}-?\d{4}$/.test(s));
  // Strjúka aftasta stakt ártal („Ölfusborgir 2024" → „Ölfusborgir", „Bæjarlind 12 2025"
  // → „Bæjarlind 12"). Aðeins þegar eitthvað stendur eftir (verndar „…12" húsnúmer).
  if (first && /[A-Za-zÁÉÍÓÚÝÆÖÞÐ]/.test(first)) {
    const c = first.replace(/_/g, ' ').replace(/\s+(?:19|20)\d{2}$/, '').replace(/\s+/g, ' ').trim();
    if (c && /[A-Za-zÁÉÍÓÚÝÆÖÞÐ]/.test(c)) return c;
  }
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
// Hreinsa félagsnafn úr customers_base sem ber rusl („Lautasmári 45,húsfélag",
// „Húsfélagið Austurgötu 26,", leiðandi „- "): forskeyta-strik, aftasta komma og
// límt „,húsfélag(ið/inu)"-viðskeyti burt.
function cleanCompany(s) {
  return sanitize(s)
    .replace(/^[-–\s]+/, '')
    .replace(/\s*,\s*h[úu]sf[ée]lag(?:i[ðn]u?|ið|i)?\.?\s*$/i, '')
    .replace(/\s+(?:vegna|v\/|v:)\s*$/i, '')   // „Heimaleiga ehf. vegna" → „Heimaleiga ehf."
    .replace(/[\s,]+$/, '')
    .trim();
}
// Reikningur: Fyrirtæki - [Heimilisfang] - kt - R-nr - ár - upphæð. Heimilisfangið
// bætt við (Agnar 2026-07-27 — var handvirkt bætt á nær hvern reikning). Deduppað
// gegn félagsnafni eins og í skýrslum (rekstrarfélag-forskeyti / húsfélags-gata).
function nameInvoice(co, addr, ktd, inv, yr, tot) {
  const c = sanitize(co) || 'Óþekkt';
  let a = addr ? sanitize(addr).replace(/\s+-\s+/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '') : '';
  if (a) { a = siteMinusCo(a, c); a = addrMinusCoTail(a, c); if (a && foldWord(c).indexOf(foldWord(a)) !== -1) a = ''; }
  return [c, a, ktd || '', inv || '', yr || '', (tot != null ? fmtIsk(tot) + ' kr' : '')].filter(Boolean).join(' - ') + '.pdf';
}
// Fold-a orð til samanburðar (án broddstafa/hástafa/greinarmerkja).
function foldWord(w) { return String(w || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
// Klippa félagsnafns-forskeyti framan af staðar-nafni: eins-staðar húsfélög hafa
// stað == félag („Húsfélagið Hamraborg 20") → skila '' ; rekstrarfélög hafa stað
// sem BYRJAR á félaginu („Steypustöðin Malarhöfða 38") → skila aðgreininum einum.
function siteMinusCo(site, co) {
  const sw = String(site || '').trim().split(/\s+/), cw = String(co || '').trim().split(/\s+/);
  let i = 0; while (i < cw.length && i < sw.length && foldWord(sw[i]) === foldWord(cw[i])) i++;
  return sw.slice(i).join(' ').trim();
}
// Klippa af staðar-strengnum þau BYRJUNAR-orð sem eru ENDA-orð félagsnafns —
// „Húsfélagið Álfabakki 12" + „Álfabakki 12, 109 Reykjavík" → „109 Reykjavík"
// (svo gatan tvítakist ekki en póstnr/borg haldist). Center Hótel + „Þingholts-
// stræti 2-4" hafa enga skörun → heimilisfangið helst óskert.
function addrMinusCoTail(addr, co) {
  const aw = String(addr || '').trim().split(/\s+/).filter(Boolean);
  const cw = String(co || '').trim().split(/\s+/).filter(Boolean);
  let best = 0;
  for (let k = 1; k <= Math.min(aw.length, cw.length); k++) {
    let ok = true;
    for (let j = 0; j < k; j++) { if (foldWord(cw[cw.length - k + j]) !== foldWord(aw[j])) { ok = false; break; } }
    if (ok) best = k;
  }
  return aw.slice(best).join(' ').replace(/^[\s,]+/, '').trim();
}
// Götuheiti (án húsnúmers) úr heimilisfangi: „Aðalstræti 6, 101 Reykjavík" → „Aðalstræti".
function streetName(addr) {
  const m = String(addr || '').match(/^([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.]+(?:\s+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.]+){0,1})\s+\d/);
  return m ? m[1].trim() : '';
}
// ehf/hf-viðskeyti: strjúka (fyrir útibú) eða tryggja (fyrir höfuðstöð).
function stripEhf(s) { return String(s || '').replace(/[\s,]*\b(?:ehf|hf)\.?\s*$/i, '').trim(); }
function ensureEhf(s) { s = String(s || '').trim(); return /\b(?:ehf|hf)\.?\s*$/i.test(s) ? s : (s + ' ehf'); }
// Er STAÐUR (fyrirtaeki-nafn) höfuðstöð rekstrarfélagsins? Merki: nafnið endar á
// ehf/hf (= grunn-nafnið sjálft, ekki „- <gata>" útibú) EÐA ber HQ/skrifstofu-merki.
function isHqSite(nafn) {
  const n = String(nafn || '');
  if (/\((?:[^)]*)(?:hq|skrifstofa|h[öo]fu[ðd]st[öo])/i.test(n)) return true;
  if (/\b(?:skrifstofa|h[öo]fu[ðd]st[öo]var?)\b/i.test(n)) return true;
  return /\b(?:ehf|hf)\.?\s*$/i.test(n) && !/\s-\s/.test(n); // „Bílabúð Benna ehf" en ekki „Colas - X ehf"
}
function nameReport(co, ktd, yr, site, kind, multiSite, hq) {
  const c = sanitize(co) || 'Óþekkt';
  // Normalisera stað: „ - " inni í staðar-nafni („Center Hótel - Plaza") → bil.
  let s = site ? sanitize(site).replace(/\s+-\s+/g, ' ').replace(/,+/g, ',').replace(/\s*,\s*/g, ', ').replace(/^[\s,-]+|[\s,-]+$/g, '') : '';
  // Rekstrarfélag (>1 lifandi staður). Höfuðstöð → „<Félag> ehf" (engin gata).
  // Útibú → „<Félag án ehf> <Gata> - <heimilisfang>" („Center Hótel Aðalstræti -
  // Aðalstræti 6, 101 Reykjavík"; „Colas Ísland Gullhella - …").
  if (multiSite && hq) {
    return [ensureEhf(c), ktd || '', kind || 'úttektarskýrsla', yr || ''].filter(Boolean).join(' - ') + '.pdf';
  }
  if (multiSite && s) {
    const st = streetName(s), base = stripEhf(c);
    const cb = (st && foldWord(base).indexOf(foldWord(st)) === -1) ? (base + ' ' + st) : base;
    return [cb, s, ktd || '', kind || 'úttektarskýrsla', yr || ''].filter(Boolean).join(' - ') + '.pdf';
  }
  // Eins-staðar félög/húsfélög: strjúka götuna úr lýsingu ef hún er þegar í nafni.
  if (s) {
    s = siteMinusCo(s, c);       // rekstrarfélag-forskeyti (Steypustöðin)
    s = addrMinusCoTail(s, c);   // húsfélag: gata sem er þegar í félagsnafni
    if (s && foldWord(c).indexOf(foldWord(s)) !== -1) s = '';
  }
  return [c, s, ktd || '', kind || 'úttektarskýrsla', yr || ''].filter(Boolean).join(' - ') + '.pdf';
}
// Heimilisfang úr SKRÁARHEITI — bútur með húsnúmeri + 3-stafa póstnúmeri + borg
// („Álftamýri 36, 108 Reykjavík"). Áreiðanlegasta heimildin fyrir þessi vel-nefndu skjöl.
function addrFromName(name) {
  const segs = cleanStem(name).split(/\s+-\s+/);
  for (const raw of segs) {
    const t = raw.trim().replace(/,\s*$/, '');
    if (/^\d{6}\s?-?\s?\d{4}$/.test(t)) continue;               // kt
    if (/^(?:19|20)\d{2}$/.test(t)) continue;                   // ár
    // AÐEINS póstnúmer + borg (engin gata á undan) → SLEPPA: „200 Kópavogi" /
    // „110 Reykjavík" er of rýrt (missir götuna Skemmuvegi/Grjótháls). Falla þá á
    // innihaldið sem ber fulla götu. Krafa: eitthvað (gata) á undan póstnúmerinu.
    if (/^\d{3}\s+[A-ZÁÉÍÓÚÝÆÖÞÐ]/.test(t)) continue;
    // Póstnúmer (3 tölust.) + borg = heimilisfang — MEÐ eða ÁN húsnúmers
    // („Skeifan, 108 Reykjavík" hefur bara póstnúmer; áður krafðist húsnúmers og
    // datt út → lenti á OCR-innihaldi sem tvítók félagsnafnið).
    if (/\b\d{3}\s+[A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð]/.test(t)) return t.replace(/\s+/g, ' ').trim();
  }
  return '';
}
// Heimilisfang úr „…hjá fyrirtækinu <Félag> <heimilisfang>. Kt…" hausnum. Félags-
// nafnið er LÍMT framan á heimilisfangið án skiltákns, svo við strjúkum þekkta
// félagsnafnið (fold-samanburður orð fyrir orð) af forskeytinu og skilum afganginum.
// Aðeins treyst þegar félagsnafnið fannst raunverulega fremst (i>0) og afgangur ber
// tölu (húsnúmer/póstnr) — annars '' (fellur á reportAddr). OCR-afbökuð félagsnöfn
// (t.d. „Aðalsoðun") fold-passa ekki → skilar '', og skráarheitið sér um þau tilvik.
function addrFromReportHeader(text, co) {
  const chunk = siteFrom(text); if (!chunk || !co) return '';
  const cw = stripEhf(String(co)).split(/\s+/).filter(Boolean);
  const sw = chunk.split(/\s+/).filter(Boolean);
  let i = 0; while (i < cw.length && i < sw.length && foldWord(sw[i]) === foldWord(cw[i])) i++;
  if (i === 0) return '';                                       // félagsnafn fannst ekki fremst → ekki treysta
  let rest = sw.slice(i).join(' ').trim();
  // Strjúka ehf/hf-hala sem hangir eftir í hausnum (co var ehf-strípað) + leiðandi komma.
  rest = rest.replace(/^(?:ehf|hf)\.?[\s,]*/i, '').replace(/^[\s,]+/, '').trim();
  if (!rest || !/\d/.test(rest)) return '';
  // Komma á undan póstnúmeri: „Skipholti 50 B 105 Reykjavík" → „Skipholti 50 B, 105 Reykjavík".
  rest = rest.replace(/\s+(\d{3}\s+[A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]+(?:b[æa]r|borg)?)\s*$/, ', $1');
  return rest;
}
// Strjúka lýsingar-orð sem lauma sér framan á heimilisfang („vegna íbúðir Þingholts-
// stræti 2-4" → „Þingholtsstræti 2-4"). Bæði brýtur nafnið og fellir staðar-tenginguna.
function cleanAddr(a) {
  a = String(a || '').trim();
  let prev;
  do { prev = a; a = a.replace(/^(?:vegna|[íi]b[úu][ðd]a?(?:ir|inni?)?|h[úu]sn[æa][ðd]is?|atvinnuh[úu]sn[æa][ðd]is?|fyrir|um)\s+/i, '').trim(); } while (a !== prev);
  return streetOnly(a);
}
// Halda AÐEINS raunverulegu götuheiti + húsnúmeri (+ póstnr/borg) — sleppa félags-/
// útibúa-orðum sem standa á undan („hótel Arnarhvoll Íngólfsstræti 1" → „Íngólfsstræti
// 1"). Tekur SÍÐASTA „<Hástafaorð> <húsnúmer>" í strengnum og heldur þaðan.
function streetOnly(a) {
  a = String(a || '').trim();
  const L = 'A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð';
  const re = new RegExp('[' + L + ']{2,}\\s+\\d{1,4}(?:\\s*[-–]\\s*\\d{1,4})?[a-dA-D]?(?:\\s*,?\\s*\\d{3}\\s+[' + L + ']{2,}(?:bær|borg)?)?\\s*$');
  const m = a.match(re);
  return m ? m[0].replace(/\s+/g, ' ').trim() : a;
}
// Heimilisfang KAUPANDA úr skýrslu-innihaldi (báðar útfærslur — slökkvitæki-úttekt +
// brunakerfi-viðtökupróf). Sleppir verktaka-heimilisfangi Slökkvitæki (Helluhraun 10).
function reportAddr(text) {
  const t = String(text || '');
  // Sleppa AÐEINS þekktum lýsingar-orðum (vegna/íbúðir/húsnæðis…) — EKKI hverju sem
  // er: gamla „vegna \S+ \S+"-skiptingin gleypti götuna („vegna Seljavegur 2") og
  // greip svo póstnúmer-merkið („Póstnr. 101") sem heimilisfang.
  const re = /Heimilisf(?:ang)?\.?\s*:?\s*(?:(?:vegna|[íi]b[úu][ðd]a?(?:ir|inni?)?|h[úu]sn[æa][ðd]is?|atvinnuh[úu]sn[æa][ðd]is?|fyrir|um)\s+)*([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.]+(?:\s+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.]+){0,2}\s+\d{1,4}(?:\s*[-–]\s*\d{1,4})?[A-Da-d]?)/g;
  let m;
  while ((m = re.exec(t))) {
    const a = m[1].replace(/\s+/g, ' ').trim();
    if (a.length < 4 || a.length > 48) continue;
    if (/helluhraun|sl[öo]kkvit/i.test(a)) continue;                 // Slökkvitæki-verktaki, ekki kúnninn
    if (/^(?:p[óo]stnr|s[íi]mi|kt|kennitala|tegund|verktaki|verkkaupi|tengili[ðd]ur)\b/i.test(a)) continue; // merki, ekki heimilisfang
    return a;
  }
  return addrFromContent(t);
}
// Samningur: Fyrirtæki - kt - (þjónustusamningur|brunakerfissamningur) - ár gerður.
function nameSamningur(co, ktd, yr, kind) {
  const label = kind === 'brunakerfi' ? 'brunakerfissamningur' : 'þjónustusamningur';
  return [sanitize(co) || 'Óþekkt', ktd || '', label, yr || ''].filter(Boolean).join(' - ') + '.pdf';
}

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
    // brunakerfis-reikningur AÐEINS á STERKU, sértæku brunakerfis-þjónustu-orðalagi
    // (fire-alarm-system). Gamla „/brunakerfi/ && !hasExtinguisherCounts" merkið
    // flaggaði NÆR ALLA reikninga ranglega: reikningar bera aldrei „Fjöldi:"-
    // talningar svo !hasExtinguisherCounts var nær alltaf satt → hvert stakt
    // „brunakerfi"-orð (líka í hausum/línum) beindi öllu í brunakerfi-möppuna.
    if (/brunavi[ðd]v[öo]runarkerfi|[áa]rssko[ðd]un\s+brunakerfis|brunakerfis(?:reikning|samning|sk[oó][ðd]un|þj[óo]nust)/i.test(t)) sub = 'brunakerfi-reikningur';
    else if (total && total < 5000) sub = 'úttektar-reikningur';
    // brunakerfis-reikningur fær sína eigin markmöppu-merkingu (aðskilin frá
    // almenna reikningar-master) svo UI geti beint honum í brunakerfi-reikninga.
    return { doc_type: 'reikningur', sub_hint: sub, target: sub === 'brunakerfi-reikningur' ? 'brunakerfi-reikningar' : 'reikningar-master' };
  }
  // 2b) OKKAR reikningur án lesanlegs númers: issuerOurs (seljanda-merki/þjónustulínur)
  //     + „reikningur"-orðalag EN R-nr misfórst í OCR (gamlir Stolpi-reikningar með
  //     númerið fjarri hausnum). Flokkast samt sem reikningur (invoice_number null) svo
  //     hann lendi í reikningar-master + tengist — ekki vendor/óflokkað. ÖRUGGT því
  //     issuerOurs er seljanda-eingöngu (birgja-reikningur til okkar fellur ekki hér).
  if (!inv && issuerOurs && /(?:kredit)?reikningur/i.test(t) && !isReport(t)) {
    const sub = /brunavi[ðd]v[öo]runarkerfi|[áa]rssko[ðd]un\s+brunakerfis|brunakerfis(?:reikning|samning|sk[oó][ðd]un|þj[óo]nust)/i.test(t) ? 'brunakerfi-reikningur'
      : (total && total < 5000 ? 'úttektar-reikningur' : '');
    return { doc_type: 'reikningur', sub_hint: sub, target: sub === 'brunakerfi-reikningur' ? 'brunakerfi-reikningar' : 'reikningar-master' };
  }
  // 3) Hrein brunakerfis-skýrsla: brunaviðvörunar-orðalag OG engar slökkvitækja-talningar.
  if (isAlarmReport(t) && !hasExtinguisherCounts(t)) {
    const sub = /vi[ðd]t[öo]kupr[óo]f/i.test(t) ? 'viðtökupróf' : (/árleg/i.test(t) ? 'árleg prófun' : '');
    return { doc_type: 'brunakerfi', sub_hint: sub, target: 'brunakerfi-skýrslur' };
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
    // Heimilisfang sem auka-sönnun fyrir staðar-tengingu (rekstrarfélög eins og
    // Center Hótel) — reportAddr nær „Seljavegur 2"/„Þingholtsstræti 2-4" úr
    // brunakerfi-/úttektar-hausnum sem addrFromContent missti af.
    const addr = cleanAddr(reportAddr(text) || addrFromContent(text) || siteFrom(text) || '') || null;
    try { site = resolveSite(f.name, sites, addr); } catch (_) { site = null; }
  }

  const coName = cleanCompany((base && base.nafn) || companyFrom(text, f.name) || '');

  // proposed_name — kanóníska endurnefningin (aðeins fyrir reikninga + skýrslur;
  // Fasi 1 NEFNIR bara, færir/endurnefnir ekki).
  let proposed_name = null;
  if (cls.doc_type === 'reikningur') {
    // Heimilisfang kúnnans: hreint skráarheiti > innihald > staðar-aðgreinir
    // (rekstrarfélag). Sama regla og skýrslu-nöfnin nota.
    const invAddr = cleanAddr(addrFromName(f.name) || addrFromReportHeader(text, coName) || reportAddr(text)) || (site ? site.nafn : '');
    proposed_name = nameInvoice(coName, invAddr, ktd, inv, year, total);
  }
  else if (cls.doc_type === 'uttektarskyrsla' || cls.doc_type === 'brunakerfi') {
    // Aðgreinandi staður/heimilisfang: heimilisfang úr innihaldi > úr skráarheiti >
    // leyst stöð > „hjá fyrirtækinu"-bútur. (Heimilisfang er það sem Agnar vill sjá.)
    // Heimilisfang: hreint skráarheiti > félags-strípaður haus („hjá fyrirtækinu …") >
    // gamla innihalds-leitin. Röðin sett svo OCR-límt félagsnafn tvítakist ekki.
    const siteDesc = cleanAddr(addrFromName(f.name) || addrFromReportHeader(text, coName) || reportAddr(text)) || (site ? site.nafn : '') || (multiSite ? siteFrom(text) : '');
    const siteIsHq = !!(site && isHqSite(site.nafn));
    proposed_name = nameReport(coName, ktd, year, siteDesc, cls.doc_type === 'brunakerfi' ? 'brunakerfi' : 'úttektarskýrsla', multiSite, siteIsHq);
  }
  else if (cls.doc_type === 'samningur') proposed_name = nameSamningur(coName, ktd, year, cls.sub_hint);

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

// ── Fasi 2: APPLY (eyðileggjandi) ───────────────────────────────────────────
// ENGIN files.delete NOKKURS STAÐAR — tvítök eru FÆRÐ (relocate) í ruslmöppu.

// Drive files.get — sækir núverandi nafn + foreldra (til að ákveða hvort þarf að
// endurnefna/færa; grunnurinn að idempotency).
async function getFile(token, id) {
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,name,parents&supportsAllDrives=true', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('get ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r.json();
}
// EIN files.update PATCH sem endurnefnir OG/EÐA færir (relocate) — sama frumaðgerð
// og drive-sort.moveFile en sameinuð svo endurnefna-eingöngu (án markmöppu) gangi
// líka. addParents/removeParents = relocate; body.name = endurnefna. ENGIN eyðing.
async function movePatch(token, id, { addParents, removeParents, name }) {
  const params = new URLSearchParams({ supportsAllDrives: 'true', fields: 'id,name,parents' });
  if (addParents) params.set('addParents', addParents);
  if (removeParents) params.set('removeParents', removeParents);
  const body = name ? JSON.stringify({ name }) : '{}';
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?' + params, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body });
  if (!r.ok) throw new Error('move ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r.json();
}
// Upsert customer_documents á drive_file_id (sama og drive-sort.upsertDoc) —
// idempotent: sama skrá → sama röð uppfærð, aldrei tvítekin.
async function upsertDoc(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?on_conflict=drive_file_id`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('upsert ' + r.status + ' ' + (await r.text()).slice(0, 160));
}
// PATCH einnar fyrirliggjandi tengiraðar (overwrite: beina henni á ÞESSA skrá).
async function patchDocById(docId, row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${docId}`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('patch ' + r.status + ' ' + (await r.text()).slice(0, 160));
}
// Fyrirliggjandi tengi-röð fyrir LYKILINN (ekki fyrir þessa drive_file_id):
//   reikningur              → invoice_number (R-nr er einkvæmur)
//   uttektarskyrsla/        → (customer_base_id, doc_type, year) [+ fyrirtaeki_id
//   brunakerfi/samningur       fyrir rekstrarfélag með >1 lifandi stað]
// Skilar {id, drive_file_id} eða null. Fyrir report-family án árs (nema samningur)
// → null (of óvíst til að fullyrða tvítak). Multi-site án staðar-sönnunar → null.
async function findExistingLink({ doc_type, invoice_number, base_id, year, site_id, multiSite }) {
  try {
    if (doc_type === 'reikningur') {
      if (!invoice_number) return null;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&invoice_number=eq.${encodeURIComponent(invoice_number)}&drive_file_id=not.is.null&select=id,drive_file_id&limit=1`, { headers: sbHeaders() });
      const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
    }
    if (!base_id) return null;
    if ((doc_type === 'uttektarskyrsla' || doc_type === 'brunakerfi') && !year) return null;
    if (multiSite && !site_id) return null;   // of óvíst til að fullyrða tvítak
    let url = `${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.${encodeURIComponent(doc_type)}&customer_base_id=eq.${base_id}&drive_file_id=not.is.null&select=id,drive_file_id&limit=1`;
    if (year) url += `&year=eq.${year}`;
    if (multiSite && site_id) url += `&fyrirtaeki_id=eq.${site_id}`;
    const r = await fetch(url, { headers: sbHeaders() });
    const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
  } catch (_) { return null; }
}
// Rekjanleiki: hvert apply skráð í override_log (best-effort, aldrei kastar).
async function logApply({ base_id, base_nafn, origName, proposed_name, doc_type, targetFolder, linkAction, conflict }) {
  try {
    const newVal = [(proposed_name || origName || ''), '→ ' + (doc_type || '') + (targetFolder ? (' @' + targetFolder) : ''), (linkAction || '')].filter(Boolean).join(' · ');
    await fetch(`${SUPABASE_URL}/rest/v1/override_log`, {
      method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ field: 'multitool_apply', old_value: origName || null, new_value: newVal, page: 'drive-multitool', co_nafn: base_nafn || null, note: conflict ? 'árekstur — ekki tengt' : null, resolved: true }),
    });
  } catch (_) {}
}

// Villuskýrsla: notandinn leiðréttir tillögu (nafn/tegund/ár) → skráð í
// multitool_corrections svo hægt sé að yfirfara og stilla flokkarann. Best-effort.
function intOrNull(v) { return (v != null && v !== '') ? (Number(v) || null) : null; }
async function logCorrection(body) {
  const id = String(body.id || '').trim();
  const row = {
    drive_file_id: id || null,
    orig_name: body.orig_name ? String(body.orig_name) : null,
    proposed_doc_type: body.proposed_doc_type ? String(body.proposed_doc_type) : null,
    proposed_name: body.proposed_name_orig ? String(body.proposed_name_orig) : null,
    proposed_base_id: intOrNull(body.proposed_base_id),
    proposed_site_id: intOrNull(body.proposed_site_id),
    proposed_year: intOrNull(body.proposed_year),
    corrected_doc_type: body.corrected_doc_type ? String(body.corrected_doc_type) : null,
    corrected_name: body.corrected_name ? String(body.corrected_name) : null,
    corrected_year: intOrNull(body.corrected_year),
    corrected_target: body.corrected_target ? String(body.corrected_target) : null,
    note: body.note ? String(body.note) : null,
    applied: !!body.applied,
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/multitool_corrections`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) return { ok: false, error: 'log: ' + r.status + ' ' + (await r.text()).slice(0, 160) };
  const d = await r.json().catch(() => [null]);
  return { ok: true, correction_id: (Array.isArray(d) && d[0]) ? d[0].id : null };
}
// Lesa villuskýrsluna (nýjast fyrst) fyrir yfirferð.
async function listCorrections(limit) {
  const lim = Math.min(Math.max(parseInt(limit || '100', 10) || 100, 1), 500);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/multitool_corrections?select=*&order=created_at.desc&limit=${lim}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error('corrections ' + r.status);
  return await r.json().catch(() => []);
}

const LINKABLE = new Set(['reikningur', 'uttektarskyrsla', 'brunakerfi', 'samningur']);

// Beitir EINU skjali. Öryggis-samningur að fullu í þessu falli:
//   • ekkert án id (haus tryggir action:'apply'); GET er les-eingöngu.
//   • vendor/other → hvorki fært né tengt NEMA UI sendi þeim markmöppu; aldrei tengt.
//   • markmöppu vantar → færsla sleppt (endurnefna+tengja samt), sagt frá.
//   • idempotent: rétt nafn → engin endurnefning; þegar í markmöppu → engin færsla;
//     upsert á drive_file_id.
//   • best-effort: hver villa skilar {ok:false,error} fyrir ÞETTA skjal (kastar
//     aldrei hálf-kláruðu í hljóði).
async function applyFile(token, body) {
  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'id required' };
  const doc_type = String(body.doc_type || '').trim();
  const base_id = (body.base_id != null && body.base_id !== '') ? Number(body.base_id) : null;
  const base_nafn = body.base_nafn ? String(body.base_nafn) : null;
  const year = (body.year != null && body.year !== '') ? Number(body.year) : null;
  const invoice_number = String(body.invoice_number || '').trim() || null;
  const site_id = (body.site_id != null && body.site_id !== '') ? Number(body.site_id) : null;
  const proposed_name = body.proposed_name ? String(body.proposed_name).trim() : null;
  const targetFolder = folderId(body.targetFolder);
  const linkMode = ['overwrite', 'if_empty', 'warn'].includes(body.linkMode) ? body.linkMode : 'warn';
  const isOurs = LINKABLE.has(doc_type);

  // vendor/other: sjálfgefið EKKERT gert; aðeins fært ef UI sendir markmöppu; aldrei tengt.
  if (!isOurs && !targetFolder) return { ok: true, id, skipped: 'not-ours', renamed: false, moved: false, linked: false, linkAction: 'not-ours' };

  // ── Drive: endurnefna + færa (idempotent) ──
  let cur;
  try { cur = await getFile(token, id); } catch (e) { return { ok: false, id, error: 'get: ' + (e.message || e) }; }
  const origName = cur.name || '';
  const parents = cur.parents || [];
  const needRename = !!(proposed_name && proposed_name !== origName);
  const inTarget = targetFolder ? parents.includes(targetFolder) : true;
  const needMove = !!(targetFolder && !inTarget);
  let renamed = false, moved = false;
  try {
    if (needRename || needMove) {
      await movePatch(token, id, {
        addParents: needMove ? targetFolder : undefined,
        removeParents: needMove ? parents.join(',') : undefined,
        name: needRename ? proposed_name : undefined,
      });
      renamed = needRename; moved = needMove;
    }
  } catch (e) { return { ok: false, id, renamed: false, moved: false, error: 'move/rename: ' + (e.message || e) }; }
  const moveSkipped = (isOurs && !targetFolder) ? 'no-target' : null;

  // vendor/other MEÐ markmöppu: fært (relocate) en ALDREI tengt í customer_documents.
  if (!isOurs) {
    await logApply({ base_id, base_nafn, origName, proposed_name, doc_type, targetFolder, linkAction: 'not-ours', conflict: false });
    return { ok: true, id, renamed, moved, linked: false, linkAction: 'not-ours', doc_id: null, moveSkipped };
  }

  // ── Tengja customer_documents eftir linkMode ──
  let sites = []; try { if (base_id) sites = await sitesForBase(base_id); } catch (_) {}
  const multiSite = sites.length > 1;
  let existing = null;
  try { existing = await findExistingLink({ doc_type, invoice_number, base_id, year, site_id, multiSite }); } catch (_) {}
  const conflictRow = !!(existing && existing.drive_file_id !== id);   // önnur skrá heldur lyklinum

  // Staðar-heimild: #id-stimpill í nafni er einа sönnunin sem má yfirskrifa
  // fyrirliggjandi fyrirtaeki_id (via 'stamp'); annars via 'addr' (siteWriteAllowed
  // leyfir þá aðeins þegar fyrirliggjandi er null eða sami staður).
  let site = null;
  if (site_id) {
    const viaStamp = (siteStampFromName(proposed_name) === site_id) || (siteStampFromName(origName) === site_id);
    site = { id: site_id, via: viaStamp ? 'stamp' : 'addr' };
  }
  const docRow = {
    customer_base_id: base_id, doc_type, year: year || null, drive_file_id: id,
    source: 'gdrive', found_by: 'drive-multitool',
    invoice_number: doc_type === 'reikningur' ? invoice_number : null,
    customer_name: base_nafn || null,
    notes: 'drive-multitool' + (invoice_number ? (' · ' + invoice_number) : '') + (year ? (' · ' + year) : '') + (base_id ? '' : ' · RESOLVE'),
  };
  if (site && await siteWriteAllowed(id, site)) docRow.fyrirtaeki_id = site.id;

  let linked = false, linkAction = '', conflict = false, doc_id = null;
  try {
    if (conflictRow && linkMode === 'warn') {
      // warn: aldrei skrifa í hljóði — skila árekstri, EKKI tengja.
      conflict = true; linkAction = 'conflict'; linked = false;
    } else if (conflictRow && linkMode === 'if_empty') {
      // if_empty: tengill er þegar til → snerta EKKERT.
      linkAction = 'skipped_exists'; linked = false;
    } else if (conflictRow && linkMode === 'overwrite') {
      // overwrite: beina fyrirliggjandi lykil-röð á ÞESSA skrá; falli það á
      // einkvæmnisárekstri (þessi skrá á þegar sína röð) → upsert á drive_file_id.
      try { await patchDocById(existing.id, docRow); linked = true; linkAction = 'overwritten'; doc_id = existing.id; }
      catch (_) { await upsertDoc(docRow); linked = true; linkAction = 'overwritten'; }
    } else {
      // enginn árekstur (enginn tengill, eða tengillinn ER þessi skrá) → upsert.
      await upsertDoc(docRow); linked = true; linkAction = existing ? 'updated' : 'linked';
    }
  } catch (e) { return { ok: false, id, renamed, moved, error: 'link: ' + (e.message || e) }; }

  await logApply({ base_id, base_nafn, origName, proposed_name, doc_type, targetFolder, linkAction, conflict });
  return { ok: true, id, renamed, moved, linked, linkAction, conflict, doc_id, moveSkipped };
}

// Hrein færsla EINS skjals í markmöppu — ENGIN endurnefning, ENGIN DB-tenging,
// ENGIN eyðing (afturkræft). Notað bæði fyrir „🗑 Færa aukaeintök í rusl" (tvítök)
// og „✕ Fjarlægja → Annað" (fjarlægja ranga forskoðunar-röð í Annað-möppuna).
// `opts.docType`/`opts.linkAction` stýra einungis override_log-merkinu.
async function moveDupe(token, body, opts = {}) {
  const id = String(body.id || '').trim();
  const targetFolder = folderId(body.targetFolder);
  const already = opts.alreadyNote || 'þegar í rusli';
  if (!id) return { ok: false, error: 'id required' };
  if (!targetFolder) return { ok: false, id, error: 'targetFolder required' };
  let cur; try { cur = await getFile(token, id); } catch (e) { return { ok: false, id, error: 'get: ' + (e.message || e) }; }
  const parents = cur.parents || [];
  if (parents.includes(targetFolder)) return { ok: true, id, moved: false, note: already };
  try { await movePatch(token, id, { addParents: targetFolder, removeParents: parents.join(',') }); }
  catch (e) { return { ok: false, id, error: 'move: ' + (e.message || e) }; }
  await logApply({ base_id: null, base_nafn: body.base_nafn || null, origName: cur.name || '', proposed_name: null, doc_type: opts.docType || 'tvítak', targetFolder, linkAction: opts.linkAction || 'moved-to-bin', conflict: false });
  return { ok: true, id, moved: true };
}

// Eyða skrá — í RUSLAFÖTU Drive (trashed=true), EKKI varanleg eyðing (files.delete).
// Afturkræft: skráin er endurheimtanleg úr Drive-rusli í ~30 daga. Þarf enga
// markmöppu (þess vegna „delete-hnappurinn" sem virkar strax). Skráð í override_log.
async function trashFile(token, body) {
  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'id required' };
  let cur; try { cur = await getFile(token, id); } catch (e) { return { ok: false, id, error: 'get: ' + (e.message || e) }; }
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?supportsAllDrives=true&fields=id,trashed', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
  });
  if (!r.ok) return { ok: false, id, error: 'trash ' + r.status + ': ' + (await r.text()).slice(0, 160) };
  await logApply({ base_id: null, base_nafn: body.base_nafn || null, origName: cur.name || '', proposed_name: null, doc_type: 'eytt', targetFolder: null, linkAction: 'trashed', conflict: false });
  return { ok: true, id, trashed: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  // POST — leiðréttingaskrá (Supabase-eingöngu, engin Drive-aðgerð) EÐA
  // Fasi 2 {action:'apply'|'move-dupe'} (eyðileggjandi, EITT skjal). Ekkert gerist án þess.
  if (event.httpMethod === 'POST') {
    let b; try { b = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'bad json' }); }
    // log-correction: ekkert snert í Drive — bara skrá í villuskýrsluna.
    if (b.action === 'log-correction') {
      try { return json(200, await logCorrection(b)); }
      catch (e) { return json(200, { ok: false, error: String(e.message || e) }); }
    }
    if (b.action !== 'apply' && b.action !== 'move-dupe' && b.action !== 'move-annad' && b.action !== 'trash') return json(400, { error: "action must be 'apply', 'move-dupe', 'move-annad', 'trash' or 'log-correction'" });
    if (!b.id) return json(400, { error: 'id required' });
    let token; try { token = await freshAccessToken(); } catch (e) { return json(401, { error: e.message }); }
    try {
      if (b.action === 'move-dupe') return json(200, await moveDupe(token, b));
      if (b.action === 'move-annad') return json(200, await moveDupe(token, b, { docType: 'annað', linkAction: 'moved-to-annad', alreadyNote: 'þegar í Annað' }));
      if (b.action === 'trash') return json(200, await trashFile(token, b));
      return json(200, await applyFile(token, b));
    } catch (e) { return json(200, { ok: false, id: b.id, error: String(e.message || e) }); }
  }

  // Fasi 1 — GET er alltaf les-eingöngu.
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET (forskoðun) eða POST {action:apply}' });

  try {
    const p = event.queryStringParameters || {};
    // Villuskýrslan (les-eingöngu) — engin Drive-aðgerð.
    if (p.corrections === '1' || p.corrections === 'true') {
      return json(200, { ok: true, corrections: await listCorrections(p.limit) });
    }
    const src = folderId(p.src);
    if (!src) return json(400, { error: 'src required' });
    const recurse = p.recurse !== '0' && p.recurse !== 'false';   // sjálfgefið ON
    const limit = Math.min(Math.max(parseInt(p.limit || '3', 10) || 3, 1), 5);
    const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);
    const order = (p.order === 'new' || p.order === 'name-desc') ? p.order : 'name';

    let token;
    try { token = await freshAccessToken(); }
    catch (e) { return json(401, { error: e.message }); }

    const files = await listPdfs(token, src, recurse, order);
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
