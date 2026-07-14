// relink-docs.js — finna DAUÐA/úrelta skjala-linka og endurtengja við réttu
// skrána sem nú býr í master-möppunum tveim (2026-07-13, ósk Agnars: „skjala-
// linkur virkaði ekki … búnir að færa mest í master … kanski á eftir að
// endurtengja").
//
// Rök: þegar skrár voru FÆRÐAR í master-möppuna hélst drive_file_id óbreytt →
// þeir linkar virka enn. En þegar AFRIT var eytt í tiltekt situr customer_
// documents.drive_file_id eftir á eydda afritinu → dauður linkur. Þessi endapunktur:
//   1. Listar báðar master-möppurnar (reikningar + úttektarskýrslur).
//   2. Byggir uppflettingu: R-númer → skrá (reikningar) og kt|ár(+heimilisfang)
//      → skrá (skýrslur).
//   3. Fyrir hvert customer_documents með drive_file_id sem er EKKI í master-
//      möppunum: reynir að finna réttu master-skrána og endurtengir drive_file_id.
//
//   GET /api/relink-docs?dry=1   → greinir + skýrsla, EKKERT skrifað
//   GET /api/relink-docs?apply=1 → endurtengir (uppfærir drive_file_id)
//   Valkv.: &reikningar=<id>&skyrslur=<id> (sjálfgefnar master-möppur).
//
// FJÖLSTAÐA-VÖRN (rekstrarfélög: Pizzan 11 staðir, Colas 3 …): reikningar
// matchast á EINKVÆMU R-númeri (rétt skrá óháð stað). Úttektarskýrslur matchast
// á kt+ári — EN ef kt á fleiri en einn lifandi stað verður skýrslan að passa
// líka við HEIMILISFANG staðarins (fyrirtaeki_id → site). Passi ekki → „óviss",
// ALDREI tengt á rangan stað. Þannig víxlast staðir rekstrarfélags aldrei.

const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULTS = {
  reikningar: '1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p',
  skyrslur:   '1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg',
};
const FOLDER_MIME = 'application/vnd.google-apps.folder';

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
async function patchDoc(id, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${id}`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('patch ' + r.status + ' ' + (await r.text()).slice(0, 120));
}

async function listFolder(token, folder) {
  const out = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType),nextPageToken',
      pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
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

// Drive-víð leit að skrá eftir heiti (utan master-mappa). „name contains"
// gerir orð-prefix match hjá Drive; við síum svo nákvæmar client-megin.
async function driveSearchName(token, tok) {
  const q = `name contains '${String(tok).replace(/'/g, "\\'")}' and mimeType='application/pdf' and trashed=false`;
  const params = new URLSearchParams({
    q, fields: 'files(id,name,parents)', pageSize: '80',
    supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives',
  });
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return [];
  const d = await r.json();
  return d.files || [];
}

// ── parsing helpers ──────────────────────────────────────────────────────────
function digits(s) { return String(s || '').replace(/\D/g, ''); }
// Fold diacritics + lowercase (fyrir samanburð heita).
function fold(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
// Aðgreinandi orð fyrir Drive-leit. Sleppir viðskeytum (ehf/hf/húsfélagið …) OG
// borgar-/póstnúmera-orðum (reykjavik/kopavogur …) sem matcha allt-of-margt.
// Tekur bæði fyrirtækjanafn OG götuheiti úr heimilisfangi (aðgreinandi fyrir húsfélög).
const SEARCH_STOP = new Set([
  'ehf', 'hf', 'slf', 'sf', 'ohf', 'the', 'og', 'husfelag', 'husfelagid', 'husfelagi', 'husfelog',
  'reykjavik', 'reykjavikur', 'kopavogur', 'kopavogi', 'kopavogs', 'hafnarfjordur', 'hafnarfirdi',
  'gardabaer', 'gardabae', 'gardabar', 'akureyri', 'mosfellsbaer', 'mosfellsbae', 'keflavik',
  'reykjanesbaer', 'selfoss', 'seltjarnarnes', 'grindavik', 'hveragerdi', 'sudurnes', 'iceland', 'island',
]);
// Skilar aðgreinandi RÁ-orðum (með broddstöfum) → sem STOFN (6 stafir) fyrir Drive
// prefix-leit. Stofn nær beygingum (Hlíðasmára→Hlíðasmári) og Drive er hástafa-óháð.
function tokWords(s) {
  const out = [];
  const words = String(s || '').replace(/[()]/g, ' ').split(/[^a-zA-ZÀ-ÿæðþöáéíóúýÆÐÞÖ0-9]+/);
  for (const w of words) {
    const raw = w.trim();
    if (!raw) continue;
    const f = fold(raw);
    if (f.length < 4 || SEARCH_STOP.has(f) || /^\d+$/.test(f)) continue;
    out.push(raw.length > 7 ? raw.slice(0, 6) : raw);   // stofn fyrir löng orð
  }
  return out;
}
function searchTokens(nafn, addr) {
  // Götuheiti úr heimilisfangi = fyrsti bókstafa-hlutinn á undan húsnúmeri.
  const streetRaw = String(addr || '').replace(/,.*$/, '').replace(/\d.*$/, '');
  const street = tokWords(streetRaw);
  const nameWords = tokWords(nafn);
  const all = [...street, ...nameWords];           // götuheiti fyrst (aðgreinandi)
  const uniq = [...new Set(all)];
  uniq.sort((a, b) => b.length - a.length);
  return uniq.slice(0, 2);
}
function ktFromName(name) {
  const m = String(name || '').match(/\b(\d{6}-\d{4})\b/) || String(name || '').match(/\b(\d{10})\b/);
  return m ? digits(m[1]) : '';
}
function yearFromName(name) {
  const ys = String(name || '').match(/\b(20\d\d)\b/g);
  return ys ? Math.max(...ys.map(Number)) : null;
}
// R-númer → tölugildi (einkvæmt, sleppir forkúlu-núllum). „R-000523" → 523.
function rNumFromName(name) {
  const m = String(name || '').match(/\bR[-\s]?0*(\d{3,6})\b/i);
  return m ? parseInt(m[1], 10) : null;
}
function rNumFromDoc(inv) {
  const m = String(inv || '').match(/0*(\d{3,6})/);
  return m ? parseInt(m[1], 10) : null;
}
// Heimilisfangs-lykill til að greina milli staða rekstrarfélags (sama kt+ár).
function addrKey(s) {
  const t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const num = (t.match(/(\d+)/) || [])[1] || '';
  const street = (t.replace(/\d.*/, '').match(/[a-z]+/g) || []).join('').slice(0, 6);
  return street + '|' + num;
}
function isJunk(f) {
  // tmp-ocr-* Google-Docs (leifar frá OCR-lesurum) — ekki alvöru skjöl.
  return f.mimeType !== FOLDER_MIME && f.mimeType !== 'application/pdf' && /^tmp-ocr-/i.test(f.name || '');
}
// STAÐA-id (fyrirtaeki.id) stimplað í skráarheiti af slökkvitæki-generatornum, t.d.
// „… - 2026 - júlí - #1612.pdf". Nákvæmur tengilykill → réttur staður án ágiskunar.
function subIdFromName(name) {
  const m = String(name || '').match(/#(\d{1,9})\b/);
  return m ? parseInt(m[1], 10) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  // POST {action:'set', id, drive_file_id} — handvirkt val á réttri master-skrá
  // fyrir eitt „óviss"/„fannst ekki" skjal (úr listanum í Bakendi).
  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (_) {}
    if (body.action !== 'set' || !body.id || !body.drive_file_id) return json(400, { error: 'set: vantar id + drive_file_id' });
    try {
      await patchDoc(body.id, { drive_file_id: body.drive_file_id, is_duplicate: false });
      return json(200, { ok: true, id: body.id, drive_file_id: body.drive_file_id });
    } catch (e) {
      const msg = String(e.message || e);
      // UNIQUE-þvingun: skráin er þegar tengd öðru skjali → láta vita í stað 500.
      if (/duplicate key|unique/i.test(msg)) return json(409, { error: 'Þessi skrá er þegar tengd öðru skjali (tvítak).' });
      return json(500, { error: msg });
    }
  }

  const p = event.queryStringParameters || {};
  const apply = p.apply === '1' || p.apply === 'true';
  const flagdups = p.flagdups === '1' || p.flagdups === 'true';   // merkja árekstra-doc sem is_duplicate
  const reikFolder = p.reikningar || DEFAULTS.reikningar;
  const skyrFolder = p.skyrslur || DEFAULTS.skyrslur;

  try {
    const token = await freshAccessToken();
    const reikFiles = (await listFolder(token, reikFolder)).filter(f => f.mimeType === 'application/pdf');
    const skyrFiles = (await listFolder(token, skyrFolder)).filter(f => f.mimeType === 'application/pdf');
    const junkCount = 0; // (junk excluded above by pdf-only filter)

    const masterIds = new Set([...reikFiles, ...skyrFiles].map(f => f.id));
    // fileId → STAÐA-id (#id úr skráarheiti) fyrir báðar master-möppur.
    const subIdByFile = new Map();
    [...reikFiles, ...skyrFiles].forEach(f => { const s = subIdFromName(f.name); if (s != null) subIdByFile.set(f.id, s); });

    // Uppflettingar
    const byR = new Map();                 // rNum → [{id, name}]
    reikFiles.forEach(f => { const n = rNumFromName(f.name); if (n != null) { const a = byR.get(n) || []; a.push({ id: f.id, name: f.name }); byR.set(n, a); } });
    const bySkyr = new Map();              // kt|ár → [{id, addrkey, name}]
    skyrFiles.forEach(f => {
      const kt = ktFromName(f.name), yr = yearFromName(f.name);
      if (!kt || !yr) return;
      const k = kt + '|' + yr;
      const a = bySkyr.get(k) || []; a.push({ id: f.id, addrkey: addrKey(f.name), name: f.name }); bySkyr.set(k, a);
    });

    // Skjöl + kt (úr customers_base) + heimilisfang staðar (úr fyrirtaeki)
    const docs = await sbGet('customer_documents?drive_file_id=not.is.null&select=id,doc_type,drive_file_id,invoice_number,year,customer_base_id,fyrirtaeki_id,reviewed');
    const bases = await sbGet('customers_base?select=id,kennitala,nafn');
    const ktByBase = new Map(bases.map(b => [b.id, digits(b.kennitala)]));
    const nameByBase = new Map(bases.map(b => [b.id, b.nafn || ('kt ' + (b.kennitala || '?'))]));
    const sites = await sbGet('fyrirtaeki?select=id,nafn,heimilisfang,customer_base_id,deleted_at');
    const addrBySite = new Map(sites.map(s => [s.id, addrKey(s.heimilisfang)]));
    const siteById = new Map(sites.map(s => [s.id, s]));
    // Fjöldi LIFANDI staða per base → rekstrarfélög (Pizzan 11, Colas 3) fá
    // strangara match: skýrsla verður að passa við HEIMILISFANG staðarins
    // (site-id), aldrei bara kt+ár — annars gæti hún víxlast milli staða.
    const liveSitesByBase = new Map();
    sites.forEach(s => { if (s.deleted_at == null && s.customer_base_id != null) liveSitesByBase.set(s.customer_base_id, (liveSitesByBase.get(s.customer_base_id) || 0) + 1); });

    const relink = [], unmatched = [], ambiguous = [];
    let okInMaster = 0;

    // Auðgun fyrir handvirkan lista: fyrirtæki · staður · ár · núverandi (dauð)
    // skrá · möguleg master-skjöl (svo hægt sé að velja rétt í UI).
    const meta = (d, cands) => {
      const st = siteById.get(d.fyrirtaeki_id);
      return {
        base_nafn: nameByBase.get(d.customer_base_id) || '(óþekkt)',
        site_nafn: st ? (st.nafn || null) : null,
        site_addr: st ? (st.heimilisfang || null) : null,
        year: d.year || null,
        dead_fid: d.drive_file_id,
        candidates: (cands || []).map(c => ({ id: c.id, name: c.name })),
      };
    };

    for (const d of docs) {
      if (masterIds.has(d.drive_file_id)) { okInMaster++; continue; }   // linkur bendir þegar á master → í lagi
      // Ekki í master → dauður eða úrelt afrit. Reyna að finna réttu skrána.
      if (d.doc_type === 'reikningur') {
        const rn = rNumFromDoc(d.invoice_number);
        const hits = rn != null ? (byR.get(rn) || []) : [];
        if (hits.length === 1) relink.push({ id: d.id, doc_type: d.doc_type, key: 'R-' + rn, to: hits[0].id, from: d.drive_file_id });
        else if (hits.length > 1) ambiguous.push(Object.assign({ id: d.id, doc_type: d.doc_type, key: 'R-' + rn, n: hits.length }, meta(d, hits)));
        else unmatched.push(Object.assign({ id: d.id, doc_type: d.doc_type, key: d.invoice_number || '(ekkert R-nr)' }, meta(d, [])));
      } else if (d.doc_type === 'uttektarskyrsla') {
        const kt = ktByBase.get(d.customer_base_id) || '';
        const yr = d.year;
        const hits = (kt && yr) ? (bySkyr.get(kt + '|' + yr) || []) : [];
        const multiSite = (liveSitesByBase.get(d.customer_base_id) || 0) > 1;   // rekstrarfélag með marga staði
        if (hits.length === 1 && !multiSite) {
          // Einn staður undir þessu kt → einkvæmt, óhætt að tengja beint.
          relink.push({ id: d.id, doc_type: d.doc_type, key: kt + '|' + yr, to: hits[0].id, from: d.drive_file_id });
        } else if (hits.length >= 1) {
          // Fjölstaða-kt (Pizzan/Colas …) EÐA margar skrár sama kt+ár →
          // verður að passa við heimilisfang staðarins (site-id). Aldrei víxla.
          const ak = addrBySite.get(d.fyrirtaeki_id);
          const m = ak ? hits.filter(h => h.addrkey === ak) : [];
          if (m.length === 1) relink.push({ id: d.id, doc_type: d.doc_type, key: kt + '|' + yr + '|' + ak, to: m[0].id, from: d.drive_file_id });
          else ambiguous.push(Object.assign({ id: d.id, doc_type: d.doc_type, key: kt + '|' + yr + (multiSite ? '|fjölstaður' : ''), n: hits.length }, meta(d, hits)));
        } else unmatched.push(Object.assign({ id: d.id, doc_type: d.doc_type, key: (kt || '?') + '|' + (yr || '?') }, meta(d, [])));
      } else {
        // samningur o.fl. — önnur mappa, ekki snert hér
        unmatched.push(Object.assign({ id: d.id, doc_type: d.doc_type, key: '(önnur mappa)' }, meta(d, [])));
      }
    }

    // ── WIDE: Drive-víð endurheimt (2026-07-14, ósk Agnars: „perhaps there is
    // still a missing folder somewhere that are not in the master … profadu tad").
    // Fyrir „fannst ekki" úttektarskýrslur (skráin er hvergi í master) — leitum
    // Drive-vítt eftir fyrirtækjanafni, skorum eftir kt/ári/heimilisfangi og
    // (apply) endurtengjum HÁ-öruggar einkvæmar samsvaranir. Fjölstaða-öruggt:
    // rekstrarfélög (>1 lifandi staður) krefjast heimilisfangs-match.
    if (p.wide === '1' || p.wide === 'true') {
      const limit = Math.max(1, Math.min(30, parseInt(p.limit || '12', 10)));
      const offset = Math.max(0, parseInt(p.offset || '0', 10));
      const docsBaseById = new Map(docs.map(d => [d.id, d.customer_base_id]));
      const claimedFids = new Set(docs.map(d => d.drive_file_id).filter(Boolean));
      const ownerHas = (fid) => claimedFids.has(fid);
      // aðeins úttektarskýrslur (reikningar eiga R-nr → önnur leið); röðum eftir id
      const pool = unmatched.filter(u => u.doc_type === 'uttektarskyrsla');
      pool.sort((a, b) => a.id - b.id);
      const slice = pool.slice(offset, offset + limit);
      const results = [];
      for (const u of slice) {
        const kt = (u.key.split('|')[0] || '').replace(/\D/g, '');
        const yr = u.year || (parseInt((u.key.split('|')[1] || ''), 10) || null);
        const toks = searchTokens(u.base_nafn, u.site_addr);
        let files = [];
        // 1) kt-leit (áreiðanlegust — vel-nefndar skrár bera kt með striki)
        const ktDash = kt.length === 10 ? kt.slice(0, 6) + '-' + kt.slice(6) : '';
        if (ktDash) files = files.concat(await driveSearchName(token, ktDash));
        // 2) nafn/götu-token
        for (const t of toks) { if (files.length >= 60) break; files = files.concat(await driveSearchName(token, t)); }
        // víxl-fjarlægja tvítök + sleppa master-skrám sem eru ÞEGAR í eigu annars doc
        const seen = new Set();
        const cand = [];
        for (const f of files) {
          if (seen.has(f.id)) continue; seen.add(f.id);
          if (ownerHas(f.id)) continue;             // skráin er þegar tengd öðru skjali
          if (rNumFromName(f.name) != null) continue; // R-númer í heiti → reikningur, EKKI skýrsla
          const fk = ktFromName(f.name), fy = yearFromName(f.name);
          const ak = addrKey(f.name);
          const siteAk = u.site_addr ? addrKey(u.site_addr) : '';
          let score = 0; const why = [];
          if (fk && kt && fk === kt) { score += 3; why.push('kt'); }
          if (fy && yr && fy === yr) { score += 2; why.push('ár'); }
          if (siteAk && ak === siteAk && ak !== '|') { score += 2; why.push('heimilisfang'); }
          // nafn-token í heiti (bæði folduð svo broddstafir/hástafir trufli ekki)
          const fn = fold(f.name);
          if (toks.some(t => fn.includes(fold(t)))) { score += 1; why.push('nafn'); }
          const inMaster = masterIds.has(f.id);
          cand.push({ id: f.id, name: f.name, score, why, inMaster });
        }
        cand.sort((a, b) => b.score - a.score);
        results.push({ id: u.id, base_nafn: u.base_nafn, site_addr: u.site_addr, kt, year: yr,
          multiSite: (liveSitesByBase.get(docsBaseById.get(u.id)) || 0) > 1,
          dead_fid: u.dead_fid, candidates: cand.slice(0, 6) });
      }

      let applied = 0, applyErrors = [];
      if (apply) {
        for (const r of results) {
          const best = r.candidates[0];
          if (!best) continue;
          // HÁ-öryggis regla: kt+ár (score≥5) OG einkvæmt (næsti frambjóðandi lægri).
          // Fjölstaða-kt krefst þess að heimilisfang sé með í skorinu.
          const second = r.candidates[1];
          const unique = !second || second.score < best.score;
          const strong = best.score >= 5 && best.why.includes('kt') && best.why.includes('ár');
          const multiOk = !r.multiSite || best.why.includes('heimilisfang');
          if (strong && unique && multiOk) {
            try { await patchDoc(r.id, { drive_file_id: best.id, is_duplicate: false }); applied++; r.applied = best.id; }
            catch (e) { const m = String(e.message || e); if (/duplicate key|unique/i.test(m)) r.skip = 'tvítak'; else applyErrors.push({ id: r.id, err: m.slice(0, 100) }); }
          }
        }
      }
      return json(200, { ok: true, wide: true, pool_total: pool.length, offset, limit,
        returned: results.length, applied, applyErrors, results });
    }

    // Árekstra-sía: drive_file_id hefur UNIQUE-þvingun. Ef master-skráin sem á
    // að tengja á er ÞEGAR eign annars skjals (eða tvö skjöl stefna á sömu skrá
    // í þessari lotu) → það skjal er tvítak, ekki bara dauður linkur. Slík eru
    // EKKI endurtengd (myndi brjóta þvingun) heldur skýrð til handvirkrar yfirferðar.
    const ownerOf = new Map();
    for (const d of docs) if (d.drive_file_id) ownerOf.set(d.drive_file_id, d.id);
    const claimed = new Set();
    const safe = [], collision = [];
    for (const r of relink) {
      const owner = ownerOf.get(r.to);
      if ((owner && owner !== r.id) || claimed.has(r.to)) collision.push({ id: r.id, doc_type: r.doc_type, key: r.key, to: r.to, owned_by: owner || '(annar í lotu)' });
      else { claimed.add(r.to); safe.push(r); }
    }
    relink.length = 0; relink.push(...safe);

    // ── STAÐA-id (#id) → fyrirtaeki_id ──────────────────────────────────────────
    // Þegar master-skráin ber „#<id>" í skráarheiti (slökkvitæki-generatorinn
    // stimplar það) tengjum við skjalið BEINT á réttan stað — nákvæmt, engin
    // adressu-ágiskun. Þetta er „lesarinn les #id" hlutinn. Aðeins þegar staðurinn
    // er LIFANDI og tilheyrir SAMA kúnna (base) og skjalið (fjölstaða-öruggt).
    const relinkTo = new Map(relink.map(r => [r.id, r.to]));
    const siteFix = [];
    for (const d of docs) {
      if (d.reviewed) continue;                         // virða handvirka staðfestingu (Skýrslu-stöð) — aldrei skrifa yfir
      const fid = masterIds.has(d.drive_file_id) ? d.drive_file_id : relinkTo.get(d.id);
      if (!fid) continue;
      const sub = subIdByFile.get(fid);
      if (sub == null || d.fyrirtaeki_id === sub) continue;
      const st = siteById.get(sub);
      if (!st || st.deleted_at != null) continue;
      // Krefjast JÁKVÆÐS base-match: bæði kúnna-id þekkt OG EINS. Aldrei festa skjal
      // á stað annars kúnna (né skjal án base) — engin gögn styðja það.
      if (d.customer_base_id == null || st.customer_base_id == null || st.customer_base_id !== d.customer_base_id) continue;
      siteFix.push({ id: d.id, to: sub, doc_type: d.doc_type });
    }

    const byType = (arr) => arr.reduce((m, x) => { m[x.doc_type] = (m[x.doc_type] || 0) + 1; return m; }, {});
    const summary = {
      master_files: { reikningar: reikFiles.length, skyrslur: skyrFiles.length },
      docs_with_fileid: docs.length,
      ok_already_in_master: okInMaster,
      relink_count: relink.length,
      collision_count: collision.length,
      ambiguous_count: ambiguous.length,
      unmatched_count: unmatched.length,
      site_fix_count: siteFix.length,   // skjöl sem #id festir á réttan stað
      unmatched_by_type: byType(unmatched),
      collision_by_type: byType(collision),
      ambiguous_by_type: byType(ambiguous),
    };

    if (!apply) {
      const CAP = 800;   // full listi fyrir handvirkan yfirlestur (en með þak svo svarið sé ekki risavaxið)
      return json(200, { ok: true, dry: true, summary,
        sample_relink: relink.slice(0, 25), sample_collision: collision.slice(0, 30),
        ambiguous: ambiguous.slice(0, CAP), unmatched: unmatched.slice(0, CAP) });
    }

    // Samhliða í lotum (chunks) svo PATCH klárist innan Netlify-timeout.
    let done = 0;
    for (let i = 0; i < relink.length; i += 40) {
      const chunk = relink.slice(i, i + 40);
      await Promise.all(chunk.map(r => patchDoc(r.id, { drive_file_id: r.to }).then(() => { done++; })));
    }
    // Valkvætt: merkja árekstra-doc (tvítök — canonical skrá þegar í eigu annars)
    // sem is_duplicate. Öruggt + afturkræft; „eigandinn" heldur virka linknum.
    let flaggedDups = 0;
    if (flagdups) {
      for (let i = 0; i < collision.length; i += 40) {
        const chunk = collision.slice(i, i + 40);
        await Promise.all(chunk.map(c => patchDoc(c.id, { is_duplicate: true }).then(() => { flaggedDups++; })));
      }
    }
    // #id → fyrirtaeki_id: nákvæm stað-tenging (reviewed=true því #id er áreiðanlegt).
    let siteFixed = 0;
    for (let i = 0; i < siteFix.length; i += 40) {
      const chunk = siteFix.slice(i, i + 40);
      await Promise.all(chunk.map(s => patchDoc(s.id, { fyrirtaeki_id: s.to, reviewed: true }).then(() => { siteFixed++; })));
    }
    return json(200, { ok: true, applied: true, summary, relinked: done, flagged_dups: flaggedDups, site_fixed: siteFixed, collision_count: collision.length, sample_collision: collision.slice(0, 30) });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
