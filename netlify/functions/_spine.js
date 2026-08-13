// _spine.js — SAMEIGINLEGA tengireglan fyrir skjal → viðskiptavina-hrygg.
//
// Rótin að „milljóna-tjóninu": tól tengdu skjöl á kennitöluna EINA (customer_base_id)
// og giskuðu svo — eða slepptu — staðnum (fyrirtaeki_id). Fyrir rekstrarfélög
// (Center Hótel: 10 staðir á einni kt) þýðir það að ÖLL skjöl lentu á sama/röngum
// stað. Hér er EIN regla, notuð af öllum lesurum/flokkurum:
//
//   customer_base_id  ← kennitalan (ótvírætt).
//   fyrirtaeki_id     ← AÐEINS með sönnun, í þessari röð:
//     1) „ - #<fyrirtaeki.id>" stimpill í skráarheiti  (beini lykillinn)
//     2) félagið á nákvæmlega EINN lifandi stað        → sá staður
//     3) heimilisfang (skráarheiti eða PDF-innihald) passar við nákvæmlega
//        EINN lifandi stað félagsins (addrKeyLoose: gata-forskeyti + húsnúmer)
//     4) annars: fyrirtaeki_id er EKKI snert — aldrei giskað, aldrei núllað.
//
//   Yfirskrift: fyrirliggjandi fyrirtaeki_id (≠ null) má AÐEINS breytast þegar
//   sönnunin er #id-stimpillinn (flokkur 1) — sjá siteWriteAllowed().
//
// CommonJS, env eins og _google.js: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }

// „ - #123" / " #123.pdf" aftast í skráarheiti → fyrirtaeki.id
function siteStampFromName(name) {
  const m = String(name || '').match(/[-\s]#(\d{1,7})\s*(\.pdf)?$/i);
  return m ? parseInt(m[1], 10) : null;
}

// Laus heimilisfangs-lykill: fyrstu 6 stafir götunnar (án broddstafa) + húsnúmer.
// „Laugavegur 26, 101 Rvk" → „laugav|26". Tómt ('') þegar hvorugt finnst.
function addrKeyLoose(s) {
  const t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const num = (t.match(/(\d+)/) || [])[1] || '';
  const street = (t.replace(/\d.*/, '').match(/[a-z]+/g) || []).join('').slice(0, 6);
  return street && num ? street + '|' + num : '';
}

// Lifandi staðir margra félaga í einu: { '<base_id>': [{id,nafn,addrkey}, …] }
async function sitesByBases(baseIds) {
  const map = {};
  const ids = [...new Set((baseIds || []).filter(x => x != null).map(String))];
  for (let i = 0; i < ids.length; i += 100) {
    const inList = ids.slice(i, i + 100).join(',');
    if (!inList) continue;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?customer_base_id=in.(${encodeURIComponent(inList)})&deleted_at=is.null&select=id,nafn,heimilisfang,customer_base_id`, { headers: sbHeaders() });
    (await r.json().catch(() => [])).forEach(s => {
      const k = String(s.customer_base_id);
      (map[k] = map[k] || []).push({ id: s.id, nafn: s.nafn, addrkey: addrKeyLoose(s.heimilisfang) });
    });
  }
  return map;
}

// Lifandi staðir EINS félags (þægindaform af sitesByBases).
async function sitesForBase(baseId) {
  if (baseId == null) return [];
  const map = await sitesByBases([baseId]);
  return map[String(baseId)] || [];
}

// Reglan sjálf. extraAddr = valfrjálst heimilisfang lesið úr PDF-INNIHALDI
// (notað í flokk 3 þegar skráarheitið ber ekki heimilisfang).
// Skilar { id, nafn, via:'stamp'|'single'|'addr' } eða null (aldrei giskað).
function resolveSite(fileName, sites, extraAddr) {
  if (!Array.isArray(sites) || !sites.length) return null;
  const stamp = siteStampFromName(fileName);
  if (stamp != null) {
    const hit = sites.find(s => s.id === stamp);
    if (hit) return { id: hit.id, nafn: hit.nafn, via: 'stamp' };
  }
  if (sites.length === 1) return { id: sites[0].id, nafn: sites[0].nafn, via: 'single' };
  // Heimilisfangs-sönnun: skráarheitið er prófað BÆÐI í heild og per „ - " bút
  // (kanónísk nöfn eru „Fyrirtæki - Heimilisfang - kt - ár" — heildar-lykillinn
  // myndi maukast með fyrirtækjanafninu), svo PDF-heimilisfangið (extraAddr).
  const segs = String(fileName || '').replace(/\.pdf$/i, '').split(/\s+-\s+/);
  const cands = [...new Set([addrKeyLoose(fileName), ...segs.map(addrKeyLoose), addrKeyLoose(extraAddr)].filter(Boolean))];
  const matched = new Map();   // site.id → site; sönnunin verður að benda á EINN stað
  for (const cand of cands) {
    const hits = sites.filter(s => s.addrkey && s.addrkey === cand);
    if (hits.length === 1) matched.set(hits[0].id, hits[0]);
    else if (hits.length > 1) return null;   // tveir staðir á sama heimilisfangi → óvíst
  }
  if (matched.size === 1) { const hit = [...matched.values()][0]; return { id: hit.id, nafn: hit.nafn, via: 'addr' }; }
  return null;   // margir staðir, engin (einkvæm) sönnun → EKKI snert
}

// ── Vegna-/Tilvísunar-línan (2026-08-13, Agnar) ─────────────────────────────
// Reikningar til rekstrarfélaga nefna staðinn EKKI í hausnum — hann stendur í
// frítexta neðst: „Vegna Plaza", „vegna Center Hótel Grandi / ný álma",
// „Tilvísun: brunakerfi Centerhotels Klapparstíg 26". Þessi lína er fjórða
// sönnunartegundin (via 'vegna') á eftir stamp/single/addr — og eins og hinar
// verður hún að benda á nákvæmlega EINN stað, annars ekkert (aldrei giskað;
// það var ágiskunin sem tengdi R-105528 við rangt hótel).

// Dregur vegna-/tilvísunar-línur úr PDF-texta. Skilar lista strengja (0-2).
function vegnaFrom(text) {
  const t = String(text || '');
  const out = [];
  const v = t.match(/\bvegna:?[ \t]+(.+)$/im);
  if (v) out.push(v[1]);
  const tv = t.match(/\btilv[íi]sun:?[ \t]*(.+)$/im);
  if (tv) out.push(tv[1]);
  return out.map(s => s.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, ''))
    .filter(s => s.length >= 3 && s.length <= 120);
}

function foldText(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

// Sameiginlegt forskeyti tveggja orða — þolir íslenskar beygingar
// („grandi"/„granda", „arnarhvoll"/„arnarhvoli") án þess að opna fyrir
// almennt substring-suð.
function _pfxHit(a, b) {
  let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n >= Math.max(4, Math.min(a.length, b.length) - 1);
}

// Staðar-samsvörun úr vegna-línum: borin saman við NÖFN og HEIMILISFÖNG allra
// staða undir sama base + project_aliases fyrir stytt nöfn („Plaza" →
// „Center Hótel Plaza"). Skilar { id, nafn, via:'vegna', hint } eða null.
// AÐEINS þegar nákvæmlega einn staður passar — annars null.
function matchSiteByVegna(vegnaLines, sites, aliases) {
  if (!Array.isArray(sites) || sites.length < 2) return null;
  const lines = (vegnaLines || []).filter(Boolean);
  if (!lines.length) return null;
  // Aðgreinandi nafn-orð hvers staðar: orð (≥4 stafir) sem koma EKKI fyrir í
  // nafni neins systur-staðar („center"/„hotel" detta út, „plaza" stendur).
  const wordsOf = s => (foldText(s).match(/[a-z0-9]{4,}/g) || []);
  const siteWords = sites.map(s => wordsOf(s.nafn));
  const distinct = sites.map((s, i) => siteWords[i].filter(w =>
    siteWords.every((ws, j) => j === i || !ws.some(o => _pfxHit(w, o)))));
  const matched = new Map();   // site.id → site
  for (const line of lines) {
    let lw = wordsOf(line);
    // project_aliases: alias í línunni → orð kanóníska nafnsins bætast við.
    for (const a of (aliases || [])) {
      const al = foldText(a.alias || '');
      if (al.length >= 3 && foldText(line).includes(al)) lw = lw.concat(wordsOf(a.canonical_name));
    }
    // 1) nafn-sönnun: aðgreinandi orð staðar finnst í línunni
    sites.forEach((s, i) => {
      if (distinct[i].some(tok => lw.some(w => _pfxHit(w, tok)))) matched.set(s.id, s);
    });
    // 2) heimilisfangs-sönnun: „gata + númer" pör í línunni → addrkey staðar
    const fl = foldText(line);
    let pm; const pairRe = /([a-z]{3,})[ \t]+(\d{1,4})/g;
    while ((pm = pairRe.exec(fl))) {
      const key = pm[1].slice(0, 6) + '|' + pm[2];
      const hits = sites.filter(s => s.addrkey && s.addrkey === key);
      if (hits.length === 1) matched.set(hits[0].id, hits[0]);
    }
  }
  if (matched.size === 1) {
    const hit = [...matched.values()][0];
    return { id: hit.id, nafn: hit.nafn, via: 'vegna', hint: lines[0] };
  }
  return null;   // enginn eða fleiri en einn → ekkert giskað
}

// Má skrifa site.id á skjalið með þessu drive_file_id? Fyrirliggjandi ≠ null
// fyrirtaeki_id má aðeins víkja fyrir #id-stimplinum (via 'stamp').
async function siteWriteAllowed(driveFileId, site) {
  if (!site) return false;
  if (site.via === 'stamp') return true;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(driveFileId)}&select=fyrirtaeki_id&limit=1`, { headers: sbHeaders() });
    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || !rows[0]) return true;                    // nýtt skjal
    return rows[0].fyrirtaeki_id == null || rows[0].fyrirtaeki_id === site.id;
  } catch (_) { return false; }                                           // óvissa → ekki skrifa
}

module.exports = { siteStampFromName, addrKeyLoose, sitesByBases, sitesForBase, resolveSite, siteWriteAllowed, vegnaFrom, matchSiteByVegna };
