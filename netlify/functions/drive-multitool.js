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
const { sitesForBase, resolveSite, siteWriteAllowed, siteStampFromName, vegnaFrom, matchSiteByVegna, vidskiptategundSkjals } = require('./_spine');

// project_aliases (stytt nöfn → kanónísk: „Plaza" → „Center Hótel Plaza") —
// notað í vegna-línu staðargreiningunni. Skyndiminni per lambda-instance.
let _aliasCache = null;
async function loadAliases() {
  if (_aliasCache) return _aliasCache;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/project_aliases?select=canonical_name,alias`, { headers: sbHeaders() });
    _aliasCache = await r.json().catch(() => []);
    if (!Array.isArray(_aliasCache)) _aliasCache = [];
  } catch (_) { _aliasCache = []; }
  return _aliasCache;
}

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
// Skilar { files, folderNames } — `folderNames` er id→nafn kort yfir möppurnar sem
// gengið var um, svo forskoðunin geti þekkt möppuheiti sem lauma sér inn í skráarnöfn
// (lotu-skönnun: „<möppuheiti> - bls NNN.pdf"). Sjá `sameAsFolder`.
async function listPdfs(token, root, recurse, order) {
  const out = [], queue = [root], seen = new Set(), folderNames = {};
  while (queue.length) {
    const folder = queue.shift();
    if (seen.has(folder)) continue; seen.add(folder);
    let kids; try { kids = await listChildren(token, folder); } catch (e) { throw e; }
    for (const c of kids) {
      if (c.mimeType === FOLDER_MIME) { folderNames[c.id] = c.name || ''; if (recurse) queue.push(c.id); continue; }
      if (/pdf$/i.test(c.name || '') || /pdf/i.test(c.mimeType || '')) out.push(c);
    }
  }
  if (order === 'new') out.sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')));
  else if (order === 'name-desc') out.sort((a, b) => String(b.name).localeCompare(String(a.name), 'is'));
  else out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'is'));
  return { files: out, folderNames };
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
// ── Staðgreitt: búðarsala yfir borðið, ekki úttektarreikningur ──────────────
// Agnar 2026-08-12 (leiðréttingaskrá): „ef greiðsl.skilm. er staðgreiðsla þá er
// þetta ekki reikningur fyrir úttektir" + „Staðgreitt - 999999-9999 - ef staðgreitt
// eða 999999-9999". Tvö merki, sama niðurstaða: skjalið á hvorki heima í
// reikningar-master né í customer_documents — kt 999999-9999 er walk-in
// staðgengillinn (customers_base 870 „Staðgreitt"), ekki alvöru viðskiptavinur.
const WALKIN_KT = '9999999999';
function stadgreittSignal(text, kt) {
  if (String(kt || '').replace(/\D/g, '') === WALKIN_KT) return 'kt 999999-9999';
  // OCR ruglar dálkunum á dkPlus-reikningi — merkimiðinn („Greiðsl.skilm.:") og
  // gildið („Staðgreiðsla") lenda á sitt hvorri línunni, svo það er EKKI hægt að
  // festa regluna við merkimiðann. Leitum að orðinu sjálfu: „Staðgreiðsla" stendur
  // aldrei á reikningi sem er gefinn út með greiðslufresti.
  if (/sta[ðd]grei[ðd]sl|sta[ðd]greitt/i.test(text || '')) return 'staðgreiðsla';
  return '';
}
// YFIRSKRIFT (Agnar 2026-08-12, með skjáskoti af R-108017 — Álfaskeið 104, húsfélag,
// Greiðsl.skilm. Staðgreiðsla): „ef það les Akstur og skýrslugerð og vottun í
// einhverjum reikningi og líka staðgreiðsla — þá yfirskrifa Akstur og skýrslugerð
// og vottun staðgreiðsluna og hann telst reikningur fyrir úttektarskýrslu."
// Rökin: þessar tvær vörulínur (200 Akstur + 060 Skýrslugerð og vottun) þýða að við
// keyrðum á staðinn og skrifuðum skýrslu — það er úttekt, hvernig sem hún var greidd.
// Búðarsala yfir borðið ber hvoruga (sbr. R-107962: bara „Hleðsla Léttvatn").
// „og vottun" er hluti af sama vöruheiti og því ekki krafist — OCR sleppir því stundum.
function uttektServiceLines(text) {
  const t = text || '';
  return /\bakstur\b/i.test(t) && /sk[ýy]rslu\s*-?\s*g?j?er[ðd]/i.test(t);
}
// Þjónustusamningur.
function isSamningur(text) {
  return /þj[óo]nustusamning|samningur\s+um\s+þj[óo]nustu/i.test(text || '');
}
function invNum(text, name) {
  let m = String(name).match(/\bR[\s\-_]?(\d{5,7})\b/i); if (m) return 'R-' + m[1];
  // 2026-08-13 (rukkunarkeðju-rannsókn, liður 0): reglan sem greip HVAÐA
  // 1-byrjandi sextölustaf sem er í grennd við orðið „reikningur" — án nr.-
  // akkeris — er FJARLÆGÐ. Hún bjó til R-114922/24/25/26 árekstrana þar sem
  // fjögur ÓLÍK félög deildu sama númeri (stakur tölustafur úr dagsetningu/
  // símanúmeri o.þ.h. varð að „reikningsnúmeri") og rangt PDF gat farið á
  // rangan kúnna. Rangt númer er verra en ekkert: NULL þegar lesarinn er
  // ekki viss — aðeins skýrt akkeri („Reikningur nr. …" eða R-nr í skráarnafni).
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
  // 2026-08-07: `_` telst líka sem bil (sjá drive-count.js), og árið verður að
  // vera á viti bornu bili — án þaksins gat stök tala í nafni skilað t.d. 2099.
  const noKt = s.replace(/(?<!\d)\d{6}\s?-?\s?\d{4}(?!\d)/g, ' ').replace(/_/g, ' ');
  m = noKt.match(/\b(20\d{2})\b/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return (y >= 2008 && y <= new Date().getFullYear() + 1) ? y : null;
}
function totalFrom(text) {
  const kw = String(text).match(/Til\s*greiðslu\s*:?\s*(?:kr\.?)?\s*([\d.]{4,})/i); let best = 0;
  if (kw) { const n = parseInt(kw[1].replace(/\./g, ''), 10); if (Number.isFinite(n)) best = n; }
  const re = /\b\d{1,3}(?:\.\d{3})+\b/g; let m; while ((m = re.exec(String(text)))) { const n = parseInt(m[0].replace(/\./g, ''), 10); if (n > best) best = n; }
  return best || null;
}
// Kaupanda-félag úr INNIHALDI: „Nafn: <félag>  kt: …"-blokkin (samningur/reikningur).
// Nafnið endar við kt/kennitala/Heimilisfang/línulok. Sleppir útgefandanum sjálfum
// (Slökkvitæki). Notað fyrir hráskönnuð skjöl þar sem skráarheitið er „Scan…".
function companyFromContent(text) {
  const t = String(text || '');
  const m = t.match(/\bNafn\s*:?\s*([^\n]+?)\s*(?:\bkt\b|\bkennitala\b|\bheimilisf|\d{6}\s*-?\s*\d{4}|$)/im);
  if (!m) return '';
  const c = m[1].replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '').trim();
  if (c.length < 2 || c.length > 60) return '';
  if (!/[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]/.test(c)) return '';
  if (/sl[öo]kkvit[æa]ki/i.test(c)) return '';   // útgefandinn, ekki kaupandinn
  return c;
}
// Kaupanda-félag úr HAUSNUM á reikningi, þar sem það stendur BERT (engin „Nafn:"
// merking): dkPlus/Stolpi prentar kaupandann efst og kennitöluna beint undir —
//   „Live production ehf. / 500920-1650 / Reikningur …"
// og bréfsefnis-útgáfan skýtur heimilisfangi á milli —
//   „Álfaskeið 104,húsfélag / Álfaskeiði 104 / 220 Hafnarfjörður / 430680-0139".
// Þess vegna er tekin FYRSTA línan í blokkinni á undan kennitölunni, ekki sú síðasta
// (sú síðasta er póstnúmerið). Útgefanda-blokkin efst (Slökkvitæki/Brunakerfi með
// kt 600508-0400) er síuð burt svo VIÐ verðum ekki lesin sem kaupandinn.
//
// Notað EINGÖNGU sem varaskeifa fyrir `base_nafn` (þ.e. „🆕 stofna fyrirtæki"-
// tillöguna) — ALDREI í `proposed_name`. Nafngiftin sjálf stendur óbreytt eins og
// Agnar leiðrétti hana (heimilisfangið leiðir þegar félag vantar); þetta er hér til
// að þurfa ekki að slá inn nafnið í höndunum á hverju óþekktu fyrirtæki.
function companyFromHeader(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let ktAt = -1;
  for (let i = 0; i < lines.length && i < 40; i++) {
    const kts = allKts(lines[i]);
    if (kts.length && !kts.includes(ISSUER_KT)) { ktAt = i; break; }
  }
  if (ktAt <= 0) return '';
  for (const raw of lines.slice(0, ktAt)) {
    const c = raw.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '').trim();
    if (c.length < 2 || c.length > 60) continue;
    if (!/[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð]/.test(c)) continue;
    if (/sl[öo]kkvit[æa]ki|brunakerfi|helluhraun|vsk\s*nr|^kt\.?\s*:/i.test(c)) continue;  // útgefandinn
    if (/^(reikningur|kreditreikningur|dagsetning|grei[ðd]sl|afh\.?skilm|ra[ðd]nr|starfsma[ðd]ur|tilv[íi]sun|v[öo]run[úu]mer)/i.test(c)) continue;
    if (/^\d{3}\s/.test(c)) continue;                       // póstnúmer + staður
    return c;
  }
  return '';
}
// Lotu-skönnun: „<möppuheiti> - bls NNN.pdf" (t.d. „mars-mai stolpi 2026 - bls 037").
// Slíkt heiti ber ENGA kaupanda-vísbendingu — það er blaðsíðunúmer í bunka — svo það
// á að hegða sér eins og „Scan…"-heiti og víkja fyrir innihaldinu.
function isBatchPageName(name) {
  return /[\s\-_]\s*(?:bls|bl|s[íi][ðd]a|page|pg)\.?\s*\d{1,4}$/i.test(cleanStem(name));
}
// Er nafn-tillagan bara MÖPPUHEITIÐ? (Agnar 2026-08-12: „take out of the name
// mars-mai stolpi that comes in front of the renaming, but that is the name of the
// folder".) Lotu-skönnun skrifar möppuheitið fremst í hverja síðu, svo companyFromStem
// las möppuna sem kaupandann á HVERJUM einasta reikningi í bunkanum.
// Aðeins hafnað þegar frambjóðandinn er FORSKEYTI möppuheitisins (eða jafn því) —
// mappa sem heitir eftir fyrirtækinu sínu heldur því áfram.
function sameAsFolder(cand, folderNames) {
  const c = foldWord(String(cand || '').replace(/\s+(?:19|20)\d{2}$/, ''));
  if (!c) return false;
  return (folderNames || []).some(fn => {
    const f = foldWord(String(fn || '').replace(/\s+(?:19|20)\d{2}$/, ''));
    return !!f && f.indexOf(c) === 0;
  });
}
// Kaupanda-félag: hráskannað skráarheiti („Scan2026-…", „IMG_…", „… - bls 037") →
// nota „Nafn:" úr innihaldi; annars endurnefnt/alvöru skráarheiti fyrst, svo innihaldið.
// `opts.folderNames` (mappan sem skráin liggur í + lesmappan) hafnar möppuheiti sem
// félagsnafni þegar `opts.stripFolder` er á.
function companyFrom(text, name, opts) {
  opts = opts || {};
  const fromContent = companyFromContent(text);
  const fromName = companyFromStem(name);
  const nameIsScan = /^(?:scan|img|image|document|dokument|skjal|photo|mynd)[\s_\-]?\d/i.test(cleanStem(name)) || isBatchPageName(name);
  const nameIsFolder = !!(opts.stripFolder !== false && fromName && sameAsFolder(fromName, opts.folderNames));
  if (fromName && !nameIsScan && !nameIsFolder) return fromName;  // endurnefnt/alvöru heiti ræður
  // hráskann/möppuheiti/tómt → „Nafn:" úr innihaldi. Möppuheitið er ALDREI notað sem
  // varaskeifa (þá væri það aftur komið fremst í nafnið) — betra að skila engu félagi
  // og láta heimilisfangið leiða nafnið (sjá nameInvoice).
  return fromContent || (nameIsFolder ? '' : fromName) || '';
}
// Kaupanda-félag úr SKRÁARHEITI (endurnefnd skjöl bera „Fyrirtæki - kt - …").
function companyFromStem(name) {
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
  const c = sanitize(co);
  let a = addr ? sanitize(addr).replace(/\s+-\s+/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '') : '';
  if (a) { a = siteMinusCo(a, c); a = addrMinusCoTail(a, c); if (a && c && foldWord(c).indexOf(foldWord(a)) !== -1) a = ''; }
  // Ekkert félagsnafn EN heimilisfang til → láta heimilisfangið leiða í stað þess að
  // stimpla „Óþekkt" fremst (Agnar 2026-08-12: „Skeiðarvogi 159, 104 Reykjavík -
  // 500920-1650 - R-107973 - …"). „Óþekkt" er aðeins fyrir raðir sem hafa hvorugt.
  const head = c || (a ? '' : 'Óþekkt');
  return [head, a, ktd || '', inv || '', yr || '', (tot != null ? fmtIsk(tot) + ' kr' : '')].filter(Boolean).join(' - ') + '.pdf';
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
// Samningur: Fyrirtæki - [Heimilisfang] - kt - (þjónustusamningur|brunakerfissamningur)
// - ár. Heimilisfangið bætt við (Agnar 2026-07-28) — samningurinn ber „Heimilisfang:"
// línu; deduppað gegn félagsnafni eins og í reikningum/skýrslum.
function nameSamningur(co, ktd, yr, kind, addr) {
  const label = kind === 'brunakerfi' ? 'brunakerfissamningur' : 'þjónustusamningur';
  const c = sanitize(co) || 'Óþekkt';
  let a = addr ? sanitize(addr).replace(/\s+-\s+/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '') : '';
  if (a) { a = siteMinusCo(a, c); a = addrMinusCoTail(a, c); if (a && foldWord(c).indexOf(foldWord(a)) !== -1) a = ''; }
  return [c, a, ktd || '', label, yr || ''].filter(Boolean).join(' - ') + '.pdf';
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
async function existingDocId({ cls, inv, baseId, year, siteId, multiSite, total }) {
  try {
    if (cls === 'reikningur') {
      // 2026-08-13 (liður 0): invoice_number EITT er EKKI einkvæmt — mislesin
      // númer (R-114922/24/25/26) lágu á fjórum ÓLÍKUM kennitölum og uppfletting
      // án kúnna-krossins gat parað skjal ANNARS félags. Krossum ALLTAF á
      // customer_base_id; án baseId er engin örugg samsvörun til.
      if (!baseId) return null;
      if (inv) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&invoice_number=eq.${encodeURIComponent(inv)}&customer_base_id=eq.${encodeURIComponent(baseId)}&drive_file_id=not.is.null&select=id&limit=1`, { headers: sbHeaders() });
        const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0].id : null;
      }
      // Pakki 8 varaleið: Stólpa-skann án lesanlegs númers → samsetti lykillinn
      // kt(base)+upphæð+ár — nánast einkvæmur á þessu safni. Án upphæðar+árs
      // er engin örugg samsvörun (null = ekkert fullyrt).
      if (total && year) {
        const r2 = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&customer_base_id=eq.${encodeURIComponent(baseId)}&amount=eq.${encodeURIComponent(total)}&year=eq.${encodeURIComponent(year)}&invoice_number=is.null&drive_file_id=not.is.null&select=id&limit=1`, { headers: sbHeaders() });
        const rows2 = await r2.json().catch(() => []); return (Array.isArray(rows2) && rows2[0]) ? rows2[0].id : null;
      }
      return null;
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
function classify(text, name, inv, total, issuerOurs, invInName, opts) {
  const t = text || '';
  const nm = name || '';
  opts = opts || {};
  // Reikningur → hvaða reikningur? Staðgreitt-vaktin situr hér svo BÁÐAR
  // reikninga-leiðirnar (með og án lesanlegs R-númers) fari í gegnum hana.
  const asInvoice = (sub) => {
    if (opts.stadgreitt !== false) {
      const sig = stadgreittSignal(t, opts.kt);
      // Akstur + Skýrslugerð yfirskrifa staðgreiðsluna → venjulegur úttektarreikningur.
      if (sig && !uttektServiceLines(t)) return { doc_type: 'stadgreitt', sub_hint: sig, target: 'staðgreitt' };
    }
    // brunakerfis-reikningur fær sína eigin markmöppu-merkingu (aðskilin frá
    // almenna reikningar-master) svo UI geti beint honum í brunakerfi-reikninga.
    return { doc_type: 'reikningur', sub_hint: sub, target: sub === 'brunakerfi-reikningur' ? 'brunakerfi-reikningar' : 'reikningar-master' };
  };
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
    return asInvoice(sub);
  }
  // 2b) OKKAR reikningur án lesanlegs númers: issuerOurs (seljanda-merki/þjónustulínur)
  //     + „reikningur"-orðalag EN R-nr misfórst í OCR (gamlir Stolpi-reikningar með
  //     númerið fjarri hausnum). Flokkast samt sem reikningur (invoice_number null) svo
  //     hann lendi í reikningar-master + tengist — ekki vendor/óflokkað. ÖRUGGT því
  //     issuerOurs er seljanda-eingöngu (birgja-reikningur til okkar fellur ekki hér).
  if (!inv && issuerOurs && /(?:kredit)?reikningur/i.test(t) && !isReport(t)) {
    const sub = /brunavi[ðd]v[öo]runarkerfi|[áa]rssko[ðd]un\s+brunakerfis|brunakerfis(?:reikning|samning|sk[oó][ðd]un|þj[óo]nust)/i.test(t) ? 'brunakerfi-reikningur'
      : (total && total < 5000 ? 'úttektar-reikningur' : '');
    return asInvoice(sub);
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
async function previewFile(token, f, opts) {
  opts = opts || {};
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

  const cls = classify(text, f.name, inv, total, issuerOurs, invInName, { kt, stadgreitt: opts.stadgreitt });
  // Rökstuðningur staðgreitt-vaktarinnar, sendur með í viðmótið svo Agnar sjái BEINT
  // í listanum af hverju hver nóta lenti sínum megin (ósk 2026-08-12) — í stað þess
  // að þurfa að opna PDF-ið til að giska á hvað tólið las.
  const stad_signal = stadgreittSignal(text, kt);
  const stad_override = !!(stad_signal && uttektServiceLines(text));

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
  // Vegna-/Tilvísunar-línan (2026-08-13): staðurinn í frítexta neðst á
  // reikningum rekstrarfélaga („Vegna Plaza", „Tilvísun: … Klapparstíg 26").
  // Fjórða sönnunartegundin — reynd þegar stamp/single/addr skiluðu engu.
  // Greiningin sjálf (vegna[0]) fer með í svarið svo hún sjáist í töflunni
  // ÁÐUR en ýtt er á Keyra. Klikki hún vistast skjalið samt (ALLTAF LEYFA
  // VISTUN) — bara ótengt við stað og merkt needs_site í apply.
  let vegna = [];
  try { vegna = vegnaFrom(text); } catch (_) { vegna = []; }
  if (!site && multiSite && vegna.length) {
    try { site = matchSiteByVegna(vegna, sites, await loadAliases()); } catch (_) {}
  }

  const coName = cleanCompany((base && base.nafn) || companyFrom(text, f.name, { stripFolder: opts.stripFolder, folderNames: opts.folderNames }) || '');

  // proposed_name — kanóníska endurnefningin (aðeins fyrir reikninga + skýrslur;
  // Fasi 1 NEFNIR bara, færir/endurnefnir ekki). Staðgreitt fær SAMA reiknings-nafn
  // (Agnar samþykkti „Staðgreitt - 999999-9999 - R-107962 - 2026 - 7.569 kr.pdf"
  // óbreytt í leiðréttingaskránni) — það er flokkunin og tengingin sem er önnur.
  let proposed_name = null;
  if (cls.doc_type === 'reikningur' || cls.doc_type === 'stadgreitt') {
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
  else if (cls.doc_type === 'samningur') {
    // Heimilisfang úr „Heimilisfang:" línu samningsins fyrst (reportAddr strýkur
    // „Vegna"-forskeytið), svo skráarheiti / haus; annars leystur staður.
    const samAddr = cleanAddr(reportAddr(text) || addrFromName(f.name) || addrFromReportHeader(text, coName)) || (site ? site.nafn : '');
    proposed_name = nameSamningur(coName, ktd, year, cls.sub_hint, samAddr);
  }

  // Þegar tengt?
  let existing_doc_id = null;
  if (cls.doc_type === 'reikningur' || cls.doc_type === 'uttektarskyrsla' || cls.doc_type === 'brunakerfi') {
    existing_doc_id = await existingDocId({ cls: cls.doc_type, inv, baseId: base ? base.id : null, year, siteId: site ? site.id : null, multiSite, total });
  }

  // vidskiptategund (Pakki 8): reiknuð í forskoðun (sala → línur → búðarmappa
  // → ovisst) og send með í apply svo hún stimplist á skjalaröðina.
  let vidskiptategund = null;
  if (cls.doc_type === 'reikningur' || cls.doc_type === 'stadgreitt') {
    try { vidskiptategund = await vidskiptategundSkjals({ inv, text, folderIds: f.parents || [] }); } catch (_) { vidskiptategund = 'ovisst'; }
  }

  return {
    id: f.id,
    name: f.name,
    parents: f.parents || [],
    vidskiptategund,
    total: total || null,
    doc_type: cls.doc_type,
    sub_hint: cls.sub_hint || '',
    issuer_ours: !!issuerOurs,
    kt: ktd || '',
    base_id: base ? base.id : null,
    // Óþekkt kt → besta nafn-tillagan fyrir „🆕 stofna fyrirtæki" (haus-nafnið er
    // varaskeifa; það fer ALDREI í proposed_name).
    base_nafn: base ? base.nafn : (coName || cleanCompany(companyFromHeader(text)) || null),
    site_id: site ? site.id : null,
    site_nafn: site ? site.nafn : null,
    site_via: site ? site.via : null,
    // Greining: vegna-/tilvísunar-línan eins og hún las úr skjalinu (sýnd í
    // töflunni), og needs_site-tillagan: fjölstaða-kt án nokkurrar sönnunar.
    vegna: vegna[0] || '',
    needs_site: !!(multiSite && !site),
    year: year || null,
    invoice_number: inv || '',
    stad_signal,
    stad_override,
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
// ── Sóttkví: undirmöppur INNI Í lesmöppunni ─────────────────────────────────
// Agnar 2026-08-12: „I want the ability so it output for skýrslur will be in extra
// folder inside the folder I am scanning, and staðgreitt will go to its own folder
// inside reading folder and rest uncertain will go to annad folder inside reading
// folder … so I can overview before I connect it to the main multitool function."
// Sóttkví = endurnefna + færa í undirmöppu lesmöppunnar og TENGJA EKKERT
// (`noLink`) — millistopp til yfirferðar áður en skjölin fara í meistaramöppurnar
// og í customer_documents. Ekkert er eytt og allt er afturkræft (skrárnar eru enn
// í sama tré). Þetta er EINA staðurinn í Fasa 1-flæðinu sem býr til möppu.
const QUARANTINE_FOLDERS = [
  { key: 'tf-skyr',       name: '📄 Úttektarskýrslur' },
  { key: 'tf-bruna',      name: '🔔 Brunakerfisskýrslur' },
  { key: 'tf-reik',       name: '🧾 Reikningar' },
  { key: 'tf-bruna-reik', name: '🔔 Brunakerfis reikningar' },
  { key: 'tf-samn',       name: '📝 Samningar' },
  { key: 'tf-stad',       name: '💵 Staðgreitt' },
  { key: 'tf-annad',      name: '📦 Annað — óvíst' },
];
// Reikninga-forflokkun (Agnar 2026-08-12: „betra að gera annan valhnapp ef um
// reikninga-forflokkun sé að ræða, svo hann reyni frekar að flokka staðgreiðslu-
// nótur frá úttektarnótum"). Heill bunki af nótum → AÐEINS tvær hrúgur (+ afgangur),
// svo hægt sé að renna yfir skiptinguna sjálfa í stað sjö mappa.
const PRESORT_FOLDERS = [
  { key: 'tf-stad',  name: '💵 Staðgreiðslunótur' },
  { key: 'tf-reik',  name: '📄 Úttektarnótur' },
  { key: 'tf-annad', name: '📦 Annað — óvíst' },
];
// Finnur möppu með þessu nafni undir `parent`, býr hana til ef hún vantar.
// Idempotent: endurkeyrsla skilar sömu möppu, býr aldrei til tvítak.
async function ensureFolder(token, parent, name) {
  const q = `'${parent.replace(/'/g, "\\'")}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const params = new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '10', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives' });
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
  if (r.ok) { const d = await r.json().catch(() => ({})); if (d.files && d.files[0]) return { id: d.files[0].id, name, created: false }; }
  const cr = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  });
  if (!cr.ok) throw new Error('mkdir ' + cr.status + ': ' + (await cr.text()).slice(0, 160));
  const d = await cr.json();
  return { id: d.id, name, created: true };
}
// ── Pakki 7 (Verk 5, 2026-08-14): SANNAÐIR búðarreikningar úr reikninga-
// masternum í undirmöppuna „Búðarreikningar" INNI í masternum (þá telur
// /api/drive-count þá áfram með, recurse:true). Sönnun = tengd sala með
// solur.vidskiptategund='bud' (invoice_number ↔ num). Sannaðar úttektir
// (uttekt_reikningur_facts.doc_id) hreyfast ALDREI — mótsögn (sala segir búð
// EN facts segja úttekt) telst árekstur og skjalið stendur kyrrt. ovisst og
// sölulausir án sönnunar sitja líka kyrrir — ATH frávik frá brief-i: engin
// lína-tafla er til fyrir sölulausu PDF-in (greiningin á 522 reikningum býr
// ekki í grunninum), svo „línu-reglan fyrir skrár án sölu" bíður þess.
// FÆRSLA, ekki afritun (addParents/removeParents) — drive_file_id helst
// óbreytt svo öll customer_documents-gildi virka áfram. EKKERT eyðist.
// Sjálfgefið DRY (b.dry !== false) — skilar talningu án þess að hreyfa neitt.
async function budFlutningur(token, b) {
  const MASTER = folderId(b.master || '1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p');
  const dry = b.dry !== false;
  const sbqAll = async (path) => {
    let out = [], off = 0;
    for (;;) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}&offset=${off}&limit=1000`, { headers: sbHeaders() });
      if (!r.ok) throw new Error('sb ' + path.split('?')[0] + ' ' + r.status);
      const rows = await r.json();
      out = out.concat(rows);
      if (!Array.isArray(rows) || rows.length < 1000) break;
      off += 1000;
    }
    return out;
  };
  // ── Cowork-hamur (framhald 14.08): 177 sölulausir gamlir reikningar sem
  // Cowork línulas úr PDF-unum sjálfum — flokkunin býr í töflunni
  // cowork_reikn_flokkun_20260814 (bud=129/ovisst=48). Sama færslu-vél,
  // önnur sönnunar-uppspretta. ovisst fer HVERGI. Eftir live-færslu er
  // hver flutt skrá sannprófuð með files.get (link_ok) — færslan breytir
  // engu id-i en það er ódýrt að SANNA það.
  if (b.src === 'cowork') {
    // verify_only: files.get á cowork-bud ids í skömmtum (offset/limit) —
    // sannar að drive_file_id svari enn eftir færslu, innan tímamarka fallsins.
    if (b.verify_only) {
      const ids = (await sbqAll('cowork_reikn_flokkun_20260814?select=drive_file_id&tegund=eq.bud&drive_file_id=not.is.null&order=drive_file_id'))
        .map(r => String(r.drive_file_id));
      const off = Math.max(0, parseInt(b.offset || '0', 10) || 0);
      const lim = Math.min(70, Math.max(1, parseInt(b.limit || '70', 10) || 70));
      const slice = ids.slice(off, off + lim);
      const out = { verify_only: true, total: ids.length, offset: off, checked: slice.length, link_ok: 0, link_fail: [] };
      for (const id of slice) {
        try { await getFile(token, id); out.link_ok++; }
        catch (e) { out.link_fail.push(id); }
      }
      return out;
    }
    const cw = await sbqAll('cowork_reikn_flokkun_20260814?select=drive_file_id,tegund,invoice_number&tegund=eq.bud&drive_file_id=not.is.null');
    const budIds = new Set(cw.map(r => String(r.drive_file_id)));
    const facts2 = await sbqAll('uttekt_reikningur_facts?select=doc_id&doc_id=not.is.null');
    const cwDocs = await sbqAll('cowork_reikn_flokkun_20260814?select=doc_id,drive_file_id&tegund=eq.bud');
    const factsDocIds = new Set(facts2.map(f => String(f.doc_id)));
    const conflictIds = new Set(cwDocs.filter(d => factsDocIds.has(String(d.doc_id))).map(d => String(d.drive_file_id)));
    const children2 = await listChildren(token, MASTER);
    const files2 = children2.filter(c => c.mimeType !== FOLDER_MIME);
    let target2 = children2.find(c => c.mimeType === FOLDER_MIME && c.name === 'Búðarreikningar') || null;
    const toMove2 = files2.filter(f => budIds.has(String(f.id)) && !conflictIds.has(String(f.id)));
    const out = {
      dry, src: 'cowork', cowork_bud: budIds.size,
      i_master: toMove2.length,
      ekki_i_master: budIds.size - toMove2.length - [...conflictIds].filter(id => files2.some(f => String(f.id) === id)).length,
      arekstur_facts: conflictIds.size,
      moved: 0, link_ok: 0, link_fail: [], errors: [],
      to_move_daemi: toMove2.slice(0, 10).map(f => f.name),
    };
    if (!dry && toMove2.length) {
      if (!target2) target2 = await ensureFolder(token, MASTER, 'Búðarreikningar');
      for (const f of toMove2) {
        try {
          await movePatch(token, f.id, { addParents: target2.id, removeParents: MASTER });
          out.moved++;
          await logApply({ base_id: null, base_nafn: null, origName: f.name, proposed_name: null, doc_type: 'búðarreikningur', targetFolder: 'Búðarreikningar', linkAction: 'bud-flutningur-cowork', conflict: false });
        } catch (e) { out.errors.push(f.name + ': ' + String(e.message || e)); }
      }
      // link_ok: hver flutt skrá svarar enn á SAMA drive_file_id
      for (const f of toMove2) {
        try { await getFile(token, f.id); out.link_ok++; }
        catch (e) { out.link_fail.push(f.id); }
      }
    }
    out.target = target2 ? target2.id : null;
    return out;
  }

  const sales = await sbqAll('solur?select=num,vidskiptategund&num=not.is.null');
  const tegByNum = {};
  sales.forEach(s => { const n = String(s.num || '').trim().toUpperCase(); if (n) tegByNum[n] = s.vidskiptategund || 'ovisst'; });
  const facts = await sbqAll('uttekt_reikningur_facts?select=doc_id&doc_id=not.is.null');
  const uttektDocIds = new Set(facts.map(f => String(f.doc_id)));
  const docs = await sbqAll('customer_documents?doc_type=eq.reikningur&drive_file_id=not.is.null&select=id,drive_file_id,invoice_number');
  const byFileId = {};
  docs.forEach(d => { byFileId[String(d.drive_file_id)] = d; });

  const children = await listChildren(token, MASTER);
  const files = children.filter(c => c.mimeType !== FOLDER_MIME);
  let target = children.find(c => c.mimeType === FOLDER_MIME && c.name === 'Búðarreikningar') || null;
  const counts = { dry, master_files: files.length, bud: 0, uttekt_stadfest: 0, ovisst: 0, engin_sonnun: 0, arekstur: 0, moved: 0, errors: [] };
  const toMove = [];
  for (const f of files) {
    const doc = byFileId[String(f.id)];
    if (!doc) { counts.engin_sonnun++; continue; }
    const teg = tegByNum[String(doc.invoice_number || '').trim().toUpperCase()];
    const erUttektDoc = uttektDocIds.has(String(doc.id));
    if (teg === 'bud' && erUttektDoc) { counts.arekstur++; continue; }
    if (erUttektDoc || teg === 'uttekt') { counts.uttekt_stadfest++; continue; }
    if (teg === 'bud') { counts.bud++; toMove.push(f); continue; }
    if (teg === 'ovisst') { counts.ovisst++; continue; }
    counts.engin_sonnun++;
  }
  if (!dry && toMove.length) {
    if (!target) target = await ensureFolder(token, MASTER, 'Búðarreikningar');
    for (const f of toMove) {
      try {
        await movePatch(token, f.id, { addParents: target.id, removeParents: MASTER });
        counts.moved++;
        await logApply({ base_id: null, base_nafn: null, origName: f.name, proposed_name: null, doc_type: 'búðarreikningur', targetFolder: 'Búðarreikningar', linkAction: 'bud-flutningur', conflict: false });
      } catch (e) { counts.errors.push(f.name + ': ' + String(e.message || e)); }
    }
  }
  counts.target = target ? target.id : null;
  counts.to_move_daemi = toMove.slice(0, 12).map(f => f.name);
  return counts;
}

async function quarantineFolders(token, src, mode) {
  if (!src) return { ok: false, error: 'src required' };
  const set = mode === 'presort' ? PRESORT_FOLDERS : QUARANTINE_FOLDERS;
  const res = await Promise.all(set.map(f => ensureFolder(token, src, f.name)
    .then(r => ({ key: f.key, id: r.id, name: r.name, created: r.created }))
    .catch(e => ({ key: f.key, name: f.name, error: String(e.message || e) }))));
  const folders = {}, created = [], errors = [];
  for (const r of res) {
    if (r.error) { errors.push(r.name + ': ' + r.error); continue; }
    folders[r.key] = r.id;
    if (r.created) created.push(r.name);
  }
  return { ok: !errors.length, src, mode: mode === 'presort' ? 'presort' : 'full', folders, created, errors };
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
async function findExistingLink({ doc_type, invoice_number, base_id, year, site_id, multiSite, amount }) {
  try {
    if (doc_type === 'reikningur') {
      if (invoice_number) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&invoice_number=eq.${encodeURIComponent(invoice_number)}&drive_file_id=not.is.null&select=id,drive_file_id&limit=1`, { headers: sbHeaders() });
        const rows = await r.json().catch(() => []); return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
      }
      // Pakki 8 varaleið: án númers → kt(base)+upphæð+ár samsetti lykillinn.
      if (base_id && amount && year) {
        const r2 = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&customer_base_id=eq.${encodeURIComponent(base_id)}&amount=eq.${encodeURIComponent(amount)}&year=eq.${encodeURIComponent(year)}&invoice_number=is.null&drive_file_id=not.is.null&select=id,drive_file_id&limit=1`, { headers: sbHeaders() });
        const rows2 = await r2.json().catch(() => []); return (Array.isArray(rows2) && rows2[0]) ? rows2[0] : null;
      }
      return null;
    }
    if (!base_id) return null;
    if ((doc_type === 'uttektarskyrsla' || doc_type === 'brunakerfi') && !year) return null;
    if (multiSite && !site_id) return null;   // of óvíst til að fullyrða tvítak
    let url = `${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.${encodeURIComponent(doc_type)}&customer_base_id=eq.${base_id}&drive_file_id=not.is.null&select=id,drive_file_id&limit=1`;
    // 2026-08-11: samningar sem voru skráðir FYRIR `allow_year_on_samningur` eiga
    // year=NULL (reglan bannaði ár). Hrein `year=eq.<ár>`-sía sæi þá ekki og
    // multitoolið byggi til NÝJA röð — það var einmitt uppspretta tvítakanna.
    // Fyrir samninga leyfum við því BÆÐI rétt ár og eldri NULL-röð.
    if (year) {
      url += (doc_type === 'samningur')
        ? `&or=(year.eq.${year},year.is.null)`
        : `&year=eq.${year}`;
    }
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
  const noLink = !!body.noLink;              // sóttkví — færa/endurnefna en ekki tengja
  const isOurs = LINKABLE.has(doc_type);

  // vendor/other: sjálfgefið EKKERT gert; aðeins fært ef UI sendir markmöppu; aldrei tengt.
  // 2026-08-13: „↩︎ Endurnefna á staðnum" (body.inplace) er undantekningin —
  // þar á að ENDURNEFNA allt sem á sér tillögunafn, líka vendor/other/staðgreitt,
  // án markmöppu og án tengingar. Fellur áfram á sleppt-hegðun í öllum öðrum hömum.
  if (!isOurs && !targetFolder && !body.inplace) return { ok: true, id, skipped: 'not-ours', renamed: false, moved: false, linked: false, linkAction: 'not-ours' };

  // 2026-08-05 (Agnar: „ég spenti huga tíma í að endurnefna... en multitool og
  // cowork tóku út nafnið"): þessi skrá er ÞEGAR tengd customer_documents
  // (drive_file_id) frá fyrra sweep — endurnefna/notes-stimpla hana AFTUR
  // þýðir að handvirkt nafn sem Agnar/Cowork setti EFTIR fyrstu tengingu tapast
  // þegjandi í næsta sweep. Sleppa endurnefningu+notes alveg fyrir þegar-tengd
  // skjöl nema kallandinn biðji BEINT um það (body.force) — engu er breytt í
  // tengingunni sjálfri (hvaða kúnna/byggingu/ári skjalið tilheyrir), aðeins
  // nafn+notes-stimplun sleppt.
  let alreadyLinked = null;
  if (isOurs) {
    try {
      const exr = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${id}&select=id,fyrirtaeki_id,vidskiptategund&limit=1`, { headers: sbHeaders() });
      const exRows = await exr.json().catch(() => []);
      alreadyLinked = (Array.isArray(exRows) && exRows[0]) ? exRows[0] : null;
    } catch (_) {}
  }
  const skipRename = !!(alreadyLinked && !body.force);

  // ── Drive: endurnefna + færa (idempotent) ──
  let cur;
  try { cur = await getFile(token, id); } catch (e) { return { ok: false, id, error: 'get: ' + (e.message || e) }; }
  const origName = cur.name || '';
  const parents = cur.parents || [];
  const needRename = !!(proposed_name && proposed_name !== origName) && !skipRename;
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

  // vendor/other/staðgreitt MEÐ markmöppu: fært (relocate) en ALDREI tengt í
  // customer_documents. Staðgreitt á hér heima af ásettu ráði — kt 999999-9999 er
  // walk-in staðgengill, ekki viðskiptavinur sem á að fá skjal í skrána sína.
  if (!isOurs) {
    await logApply({ base_id, base_nafn, origName, proposed_name, doc_type, targetFolder, linkAction: 'not-ours', conflict: false });
    return { ok: true, id, renamed, moved, linked: false, linkAction: 'not-ours', doc_id: null, moveSkipped };
  }

  // Sóttkví: endurnefnt + fært, en EKKERT skrifað í customer_documents. Skjalið bíður
  // yfirferðar í undirmöppunni; næsta keyrsla (á sóttkvíar-möppuna, með meistara-
  // möppum) tengir það. Vörnin er í því að GERA EKKERT í gagnagrunninum hér.
  if (noLink) {
    await logApply({ base_id, base_nafn, origName, proposed_name, doc_type, targetFolder, linkAction: 'sóttkví (ótengt)', conflict: false });
    return { ok: true, id, renamed, moved, linked: false, linkAction: 'quarantined', doc_id: null, moveSkipped };
  }

  // ── Tengja customer_documents eftir linkMode ──
  let sites = []; try { if (base_id) sites = await sitesForBase(base_id); } catch (_) {}
  const multiSite = sites.length > 1;
  let existing = null;
  try { existing = await findExistingLink({ doc_type, invoice_number, base_id, year, site_id, multiSite, amount: body.amount != null && body.amount !== '' ? Number(body.amount) : null }); } catch (_) {}
  const conflictRow = !!(existing && existing.drive_file_id !== id);   // önnur skrá heldur lyklinum

  // Staðar-heimild: #id-stimpill í nafni er einа sönnunin sem má yfirskrifa
  // fyrirliggjandi fyrirtaeki_id (via 'stamp'); annars via 'addr' (siteWriteAllowed
  // leyfir þá aðeins þegar fyrirliggjandi er null eða sami staður).
  let site = null;
  if (site_id) {
    const viaStamp = (siteStampFromName(proposed_name) === site_id) || (siteStampFromName(origName) === site_id);
    site = { id: site_id, via: viaStamp ? 'stamp' : 'addr' };
  }
  // 2026-08-11: samningur MÁ nú bera ár (CHECK-reglan `customer_documents_year_shape`
  // rýmkuð — sjá migration `allow_year_on_samningur`). Áður VARÐ hann að hafa
  // year=NULL, svo árið sem lesið var úr heitinu („… - þjónustusamningur - 2026.pdf")
  // var hent í notes og glataðist sem gagn. Þrennt bilaði af því:
  //   • `findExistingLink` síar á year → fann ALDREI geymdan samning (allir NULL)
  //     → tvítök hlóðust upp (Thai Lindin 5 raðir, Center Hótel 4, Prikið 3).
  //   • `samningar-read.js` sendir year á samning → 23514 → skráðist ekki.
  //   • match-station deduppar samninga á (staður, ár) — með ár alltaf NULL
  //     féllu ALLIR samningar staðarins í einn hóp.
  // Árið er endurnýjunarár samningsins og er nú geymt þar sem það á heima.
  const rowYear = year || null;
  const docRow = {
    customer_base_id: base_id, doc_type, year: rowYear, drive_file_id: id,
    source: 'gdrive', found_by: 'drive-multitool',
    invoice_number: doc_type === 'reikningur' ? invoice_number : null,
    customer_name: base_nafn || null,
    notes: 'drive-multitool' + (invoice_number ? (' · ' + invoice_number) : '') + (year ? (' · ' + year) : '') + (base_id ? '' : ' · RESOLVE'),
  };
  // vidskiptategund (Pakki 8): úr forskoðuninni (body) þegar hún fylgir, annars
  // reiknuð hér (sala-erfð + búðarmöppur; enginn texti á apply-stigi). Sett
  // gildi á fyrirliggjandi röð er ALDREI yfirskrifað.
  let vt = ['uttekt', 'bud', 'ovisst'].includes(body.vidskiptategund) ? body.vidskiptategund : null;
  if (!vt && doc_type === 'reikningur') {
    try { vt = await vidskiptategundSkjals({ inv: invoice_number, folderIds: parents }); } catch (_) { vt = 'ovisst'; }
  }
  if (vt && !(alreadyLinked && alreadyLinked.vidskiptategund)) docRow.vidskiptategund = vt;
  // Upphæðin fylgir (samsetti tvítakalykillinn kt+upphæð+ár þarf hana) — aldrei núlluð.
  if (body.amount != null && body.amount !== '') docRow.amount = Number(body.amount) || null;
  if (docRow.amount == null) delete docRow.amount;

  // „Aldrei núllað"-vörnin (2026-07-30): merge-duplicates SKRIFAR hvern dálk sem
  // er í body-inu — apply án base_id/base_nafn/year núllaði því fyrirliggjandi
  // customer_base_id/customer_name/year á tengdri röð (gerðist live á doc 1497).
  // Óþekkt gildi (null) eru því FELLD ÚR upsert-inu svo fyrirliggjandi tenging
  // stendur. 2026-08-11: undantekningin fyrir samning fjarlægð — hann ber nú ár
  // eins og aðrar tegundir, svo óþekkt ár (null) á að víkja fyrir því sem er
  // þegar skráð í stað þess að núlla það.
  if (docRow.customer_base_id == null) delete docRow.customer_base_id;
  if (docRow.customer_name == null) delete docRow.customer_name;
  if (docRow.year == null) delete docRow.year;
  // Sama vörn og needRename hér að ofan: þegar-tengt skjal heldur núverandi
  // notes-gildi sínu (t.d. handvirkt breytt heiti) í stað þess að fá aftur
  // sjálfvirka „drive-multitool · …" stimpilinn á hverju sweep-i.
  if (skipRename) delete docRow.notes;
  if (site && await siteWriteAllowed(id, site)) docRow.fyrirtaeki_id = site.id;
  // needs_site (2026-08-13): fjölstaða-kt án staðar-sönnunar → skjalið vistast
  // SAMT (ALLTAF LEYFA VISTUN), tengt base-inu einu, en merkt í yfirferð.
  // Aldrei giskað á stað (R-105528 lexían). Fái röðin stað (nú eða var þegar
  // með) hreinsast merkið; annars ósnert svo fyrirliggjandi staða standi.
  const hasSiteAlready = !!(alreadyLinked && alreadyLinked.fyrirtaeki_id != null);
  if (docRow.fyrirtaeki_id != null || hasSiteAlready) docRow.needs_site = false;
  else if (multiSite && !site_id) docRow.needs_site = true;

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
    // quarantine-folders: býr til (eða finnur) sóttkvíar-undirmöppurnar í lesmöppunni.
    // Eina skrifið er möppu-stofnun — engin skrá hreyfð, ekkert tengt.
    // Pakki 7 verk 5: búðarreikningar úr masternum (sjálfgefið DRY).
    if (b.action === 'bud-flutningur') {
      let tk5; try { tk5 = await freshAccessToken(); } catch (e) { return json(401, { error: e.message }); }
      try { return json(200, await budFlutningur(tk5, b)); }
      catch (e) { return json(500, { error: String(e.message || e) }); }
    }
    if (b.action === 'quarantine-folders') {
      let tk; try { tk = await freshAccessToken(); } catch (e) { return json(401, { error: e.message }); }
      try { return json(200, await quarantineFolders(tk, folderId(b.src), b.mode)); }
      catch (e) { return json(200, { ok: false, error: String(e.message || e) }); }
    }
    if (b.action !== 'apply' && b.action !== 'move-dupe' && b.action !== 'move-annad' && b.action !== 'trash') return json(400, { error: "action must be 'apply', 'move-dupe', 'move-annad', 'trash', 'quarantine-folders' or 'log-correction'" });
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
    // Stillingar (⚙️ Stillingar í viðmótinu) — báðar sjálfgefið ON.
    const optStad = p.stadgreitt !== '0' && p.stadgreitt !== 'false';       // staðgreitt-flokkun
    const optStripFolder = p.folderprefix !== '0' && p.folderprefix !== 'false'; // möppuheiti burt úr nafni

    let token;
    try { token = await freshAccessToken(); }
    catch (e) { return json(401, { error: e.message }); }

    const { files, folderNames } = await listPdfs(token, src, recurse, order);
    const total = files.length;
    const slice = files.slice(offset, offset + limit);
    // Lesmappan sjálf ber oft heitið sem lekur í skráarnöfnin („mars-mai stolpi 2026
    // - stakar" → „mars-mai stolpi 2026 - bls 037.pdf"), svo hún fylgir alltaf með.
    let srcName = '';
    if (optStripFolder) { try { srcName = (await getFile(token, src)).name || ''; } catch (_) {} }

    const rows = [];
    const counts = {};
    for (const f of slice) {
      try {
        const row = await previewFile(token, f, {
          stadgreitt: optStad,
          stripFolder: optStripFolder,
          folderNames: [folderNames[(f.parents || [])[0]] || '', srcName].filter(Boolean),
        });
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
