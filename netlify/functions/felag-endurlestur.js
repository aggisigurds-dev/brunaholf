// felag-endurlestur.js — „Endurlesa öll skjöl eins rekstrarfélags" (Agnar 2026-07-15:
// „Hvernig get ég valið öll skjölin sem eru svona tengt við eitt rekstarfélag og
// látið lesa það almennilega og sett aftur inn").
//
// Fer yfir ÖLL customer_documents eins félags (base), les hvert PDF úr Drive
// (pdf-parse → Google-Doc OCR fallback, backoff-driveFetch eins og uttekt-rename),
// flokkar úr INNIHALDI (slökkvitæki-úttekt · brunakerfi-skýrsla · reikningur),
// les rétt ár+mánuð (Dags — EKKI „Næsta skoðun") og heimilisfangs-/nafna-sönnun,
// og með &apply=1 leiðréttir röðina: year · doc_type · fyrirtaeki_id (aðeins
// gegnum _spine.resolveSite + siteWriteAllowed — aldrei giskað, aldrei núllað).
// Nafna-sönnun (Agnar: „endurtengja á address … eða heiti"): ef NÁKVÆMLEGA EITT
// af nöfnum staða félagsins (sameiginlegt forskeyti klippt — „Center Hótel
// Plaza/Klöpp/…" → „Plaza") finnst í skráarheiti eða PDF-texta → via:'name'.
// Eftir lotuna: nýjasta SLÖKKVITÆKI-skýrsla hvers staðar → upsert í
// arsskodun_report_facts (búnaðar-talning, sama Fjöldi-lógík og skyrsla-bunadur).
//
//   GET /api/felag-endurlestur?base=<customers_base id>[&offset=0][&limit=2][&apply=1]
//   → { base, total, offset, nextOffset, rows:[{id,file,verdict,year,site,via,changed}], counts, facts_updated }
//
// Batched eins og doc-index: limit sjálfgefið 2 (max 6), ~8s tímavörn per kall;
// UI-ið lykkjar offset→nextOffset þar til nextOffset er null.

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');
const spine = require('./_spine');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const MONTHS = 'janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember';
const MNUM = { 'janúar':1,'febrúar':2,'mars':3,'apríl':4,'maí':5,'júní':6,'júlí':7,'ágúst':8,'september':9,'október':10,'nóvember':11,'desember':12 };

function sbHeaders(extra){ return Object.assign({ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }, extra||{}); }

// Backoff-retry á Drive (403/429/5xx) — sama og uttekt-rename.driveFetch.
async function driveFetch(url, opts, tries = 4){
  let last;
  for (let i = 0; i < tries; i++){
    try {
      const r = await fetch(url, opts);
      if (r.ok || (r.status !== 403 && r.status !== 429 && r.status < 500)) return r;
      last = r;
    } catch (e){ last = e; }
    if (i < tries - 1) await new Promise(res => setTimeout(res, 400 * Math.pow(2, i) + Math.floor(Math.random() * 300)));
  }
  if (last instanceof Error) throw last;
  return last;
}

// ── PDF-lestur: pdf-parse fyrst, Google-Doc OCR fallback ─────────────────────
async function driveExtractText(id, token){
  const cp = await driveFetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true&fields=id', {
    method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ name:'tmp-ocr-' + id, mimeType:'application/vnd.google-apps.document' }),
  });
  if (!cp.ok) return '';
  const doc = await cp.json().catch(() => null); if (!doc || !doc.id) return '';
  let text = '';
  try { const ex = await driveFetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers:{ Authorization:`Bearer ${token}` } }); if (ex.ok) text = await ex.text(); } catch (_) {}
  try { await driveFetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } }); } catch (_) {}
  return text;
}
async function readPdfText(id, token){
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers:{ Authorization:`Bearer ${token}` } });
  if (!r.ok) return '';
  const d = await pdf(Buffer.from(await r.arrayBuffer())).catch(() => null);
  let text = d ? d.text : '';
  if ((text || '').replace(/\s/g, '').length < 25){
    const viaG = await driveExtractText(id, token).catch(() => '');
    if (viaG && viaG.replace(/\s/g, '').length >= 25) text = viaG;
  }
  return text;
}
async function driveFileName(id, token){
  const r = await driveFetch('https://www.googleapis.com/drive/v3/files/' + id + '?supportsAllDrives=true&fields=name', { headers:{ Authorization:`Bearer ${token}` } });
  if (!r.ok) return '';
  const d = await r.json().catch(() => null);
  return (d && d.name) || '';
}

// ── Flokkun + útdráttur (sama lógík og uttekt-rename / skyrsla-bunadur) ──────
// Slökkvitæki-úttekt: per-tegund „Fjöldi:"-línur — SAMEIGINLEG lógík í
// _bunadur.js (líka notuð af skyrsla-bunadur). CO2-subscript-brot pdf-parse
// (Co\n2\n → merki og Fjöldi á sitthvorri línu) er normaliserað þar — það var
// rótin að co2_2/co2_5=0 í arsskodun_report_facts.
const { parseBunadur, toEquipment } = require('./_bunadur');
// Rétt dagsetning: „Dags dd.mm.yyyy" fyrst; annars fyrsta „{mánuður} 20yy" sem
// er EKKI „Næsta skoðun".
function dateInfo(text){
  const t = String(text||'');
  const m = t.match(/\bdags\.?\s*:?\s*(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/i);
  if (m){ const mo = parseInt(m[2],10); let y = m[3]; if (y.length === 2) y = '20'+y; if (mo>=1 && mo<=12) return { month: mo, year: parseInt(y,10) }; }
  const re = new RegExp('\\b(' + MONTHS + ')\\s+(20\\d{2})\\b','gi');
  let mm;
  while ((mm = re.exec(t))){
    if (/næst|next/i.test(t.slice(Math.max(0, mm.index-32), mm.index))) continue;
    return { month: MNUM[mm[1].toLowerCase()] || null, year: parseInt(mm[2],10) };
  }
  return { month: null, year: null };
}
// Heimilisfang úr innihaldi (sama nálgun og uttekt-rename: format A/B + almennt par).
function extractAddress(text){
  const t = String(text||'');
  let m = t.match(/hjá\s+fyrirt(?:æki|aeki)nu\s+(.+?)\.?\s*Kt\b/i);
  if (m) return m[1].replace(/\s+/g,' ').trim();
  m = t.match(/Heimilisf\.?\s*(.+?)\s*Póstnr\.?\s*(\d{3})/i);
  if (m) return m[1].replace(/^\s*vegna/i,'').replace(/\s+/g,' ').trim() + ' ' + m[2];
  const pairRe = /([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]*(?:[^\S\n]+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]+){0,3}[^\S\n]+\d{1,4}[a-dA-D]?)[,\s]+(\d{3}[^\S\n]+[A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð]+)/g;
  let p;
  while ((p = pairRe.exec(t))){
    const street = p[1].replace(/\s+/g,' ').trim();
    if (/helluhraun|slökkvitæki|brunakerfi|vsk\s*nr/i.test(street)) continue;
    return street + ', ' + p[2].replace(/\s+/g,' ').trim();
  }
  return '';
}

// ── Nafna-sönnun (via:'name') ─────────────────────────────────────────────────
// Nafnavenja staða (Agnar 2026-07-15): „Rekstrarfélag - Sérkenni" — það sem
// kemur á eftir „ - " á eftir félagsnafninu er AÐGREINIRINN (útibú/undirfang),
// t.d. „Aðalskoðun - Skeifan", „Center Hótel - Arnarhvoll". fold() þurrkar
// greinarmerki svo „Center Hótel Arnarhvoll" (án striks) og „… - Arnarhvoll"
// eru jafngild. Endandi „ehf."/„hf." = eins-staðar félag eða höfuðstöð
// rekstrarfélagsins sjálfs — EKKI útibú → ehf/hf-tóken klippt og staður án
// aðgreinis fær engan nafna-lykil (tengist aldrei á „ehf"). Sameiginlegt
// orða-forskeyti allra staða-nafna er klippt („Center Hótel Plaza" → „plaza")
// svo AÐGREINANDI hlutinn verði að finnast; nákvæmlega EITT nafn í
// skráarheiti/texta = sönnun.
function fold(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim(); }
function siteWords(nafn){
  const w = fold(nafn).split(' ').filter(Boolean);
  while (w.length && /^(ehf|hf|slf|sf)$/.test(w[w.length-1])) w.pop();   // ehf/hf = HQ-merki, ekki aðgreinir
  return w;
}
function distinctiveNames(sites){
  const words = sites.map(s => siteWords(s.nafn));
  let prefix = 0;
  if (sites.length > 1){
    while (words.every(w => w.length > prefix + 1 && w[prefix] === words[0][prefix])) prefix++;
  }
  const out = sites.map((s, i) => ({ site: s, key: words[i].slice(prefix).join(' ').trim() })).filter(x => x.key.length >= 3);
  // HQ-röð sem heitir bara félagsnafninu (lykill hennar er forskeyti að lykli
  // annars staðar) myndi passa við ÖLL skjöl félagsins → hún fær engan lykil.
  return out.filter(x => !out.some(y => y !== x && y.key.startsWith(x.key + ' ')));
}
function resolveByName(fileName, text, sites){
  if (!Array.isArray(sites) || sites.length < 2) return null;   // 1 staður → 'single' sér um það
  const hay = ' ' + fold(fileName) + ' ' + fold(String(text||'').slice(0, 4000)) + ' ';
  const hits = [];
  for (const c of distinctiveNames(sites)) if (hay.indexOf(' ' + c.key + ' ') !== -1 || hay.indexOf(c.key) !== -1) hits.push(c.site);
  const uniq = [...new Set(hits.map(s => s.id))];
  if (uniq.length !== 1) return null;   // 0 eða 2+ nöfn → ekki sönnun
  const hit = sites.find(s => s.id === uniq[0]);
  return { id: hit.id, nafn: hit.nafn, via: 'name' };
}

async function sbGet(path){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0,120));
  return r.json();
}

// Idempotent Sjálfvirkni-skráning (merge-duplicates — yfirskrifar aldrei með null).
async function registerAutomation(){
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/automation_jobs?on_conflict=name`, {
      method:'POST', headers: sbHeaders({ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{ name:'felag-endurlestur', label:'Endurlestur skjala per félag', command:'/api/felag-endurlestur?base=<id>&apply=1', schedule:'Handvirkt', enabled:true }]),
    });
  } catch (_) {}
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  const p = event.queryStringParameters || {};
  const baseId = parseInt(p.base, 10);
  if (!baseId) return json(400, { error:'base (customers_base id) krafist' });
  const limit = Math.min(parseInt(p.limit || '2', 10) || 2, 6);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);
  const apply = p.apply === '1';

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    const sites = await spine.sitesForBase(baseId);
    // Full heimilisföng staðanna fyrir addrKey-samanburð er þegar inni í sites (addrkey).
    const docs = await sbGet(`customer_documents?customer_base_id=eq.${baseId}&is_duplicate=is.false&drive_file_id=not.is.null&select=id,drive_file_id,doc_type,year,fyrirtaeki_id,notes&order=id.asc`);
    const total = docs.length;

    const rows = [];
    const counts = { uttekt:0, brunakerfi:0, reikningur:0, oviss:0, updated:0, errors:0 };
    const bestReport = {};   // fyrirtaeki_id → { year, month, equipment, total_devices, drive_file_id, doc_id }
    const T0 = Date.now();
    let idx = offset;
    for (; idx < docs.length; idx++){
      if ((idx - offset) >= limit || (Date.now() - T0) > 8000) break;
      const d = docs[idx];
      try {
        const fileName = await driveFileName(d.drive_file_id, token);
        const text = await readPdfText(d.drive_file_id, token);
        const readable = (text||'').replace(/\s/g,'').length >= 30;

        // Flokkun úr INNIHALDI
        const bun = parseBunadur(text);
        const isInvoice = /\bR[\s_-]?\d{5,7}\b/i.test(fileName) || /til greiðslu|reikningsnr|gjalddagi\s*-?\s*eindagi|samtala reiknings|samtals fyrir vsk/i.test(text);
        const isBrunakerfi = !isInvoice && bun.slk === 0 && /brunaviðvörunarkerfi|viðtökupróf|árleg prófun/i.test(text);
        const isUttekt = !isInvoice && !isBrunakerfi && (bun.slk > 0 || bun.matched > 0 || /skýrsla vegna úttektar|úttektarskýrsl|uttektarskyrsl/i.test(text));
        const verdict = isInvoice ? 'reikningur' : isBrunakerfi ? 'brunakerfi' : isUttekt ? 'uttekt' : 'óviss';
        counts[verdict === 'óviss' ? 'oviss' : verdict]++;

        const di = dateInfo(text);
        const contentAddr = extractAddress(text);
        // Staðurinn: Tengireglan (stamp/single/addr) → annars nafna-sönnun.
        let site = spine.resolveSite(fileName, sites, contentAddr);
        if (!site) site = resolveByName(fileName, text, sites);

        const changed = {};
        if (apply && readable && verdict !== 'óviss'){
          const patch = {};
          // year: 2026-08-11 — samningur MÁ nú bera ár (year_shape rýmkuð, sjá
          // migration allow_year_on_samningur). Undanþágan hér var eina ástæðan
          // fyrir því að endurlestur gat ekki leiðrétt ártal á samningi.
          if (di.year && di.year !== d.year){ patch.year = di.year; changed.year = { from: d.year, to: di.year }; }
          // doc_type: aðeins leiðrétt þegar innihaldið stangast á við skráninguna.
          const wantType = verdict === 'reikningur' ? 'reikningur' : verdict === 'brunakerfi' ? 'brunakerfi' : 'uttektarskyrsla';
          const yearAfter = patch.year != null ? patch.year : d.year;
          if (wantType !== d.doc_type && (d.doc_type === 'uttektarskyrsla' || d.doc_type === 'brunakerfi' || d.doc_type == null)
              && (wantType === 'brunakerfi' || yearAfter != null)){   // year_shape: uttekt/reikningur krefjast árs
            patch.doc_type = wantType; changed.doc_type = { from: d.doc_type, to: wantType };
          }
          if (site && site.id !== d.fyrirtaeki_id && await spine.siteWriteAllowed(d.drive_file_id, site)){
            patch.fyrirtaeki_id = site.id; changed.fyrirtaeki_id = { from: d.fyrirtaeki_id, to: site.id, via: site.via };
          }
          if (Object.keys(patch).length){
            const up = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${d.id}`, {
              method:'PATCH', headers: sbHeaders({ 'Content-Type':'application/json', Prefer:'return=minimal' }),
              body: JSON.stringify(patch),
            });
            if (!up.ok) throw new Error('doc PATCH ' + up.status);
            counts.updated++;
          }
        }

        // Nýjasta slökkvitæki-skýrsla per stað (fyrir arsskodun_report_facts)
        const effSite = (changed.fyrirtaeki_id && changed.fyrirtaeki_id.to) || (site && site.id) || d.fyrirtaeki_id;
        const effYear = di.year || d.year;
        if (verdict === 'uttekt' && effSite && bun.slk + bun.rs + bun.bsl + bun.teppi > 0){
          const cur = bestReport[effSite];
          if (!cur || (effYear||0) > (cur.year||0)){
            const eq = toEquipment(bun);
            bestReport[effSite] = { year: effYear, month: di.month, equipment: eq,
              total_devices: Object.values(eq).reduce((a,b)=>a+b,0), drive_file_id: d.drive_file_id, doc_id: d.id };
          }
        }

        rows.push({ id: d.id, file: fileName, verdict, readable,
          year: di.year || d.year || null, month: di.month || null,
          site: site ? site.nafn : null, via: site ? site.via : null, changed });
      } catch (e){
        counts.errors++;
        rows.push({ id: d.id, file: d.drive_file_id, verdict: 'villa', error: String(e.message || e) });
      }
    }

    // Facts-upsert: aðeins þegar batchið fann nýjustu (eða jafngamla+nýrri) skýrslu
    // en það sem þegar er skráð fyrir staðinn.
    let factsUpdated = 0;
    if (apply && Object.keys(bestReport).length){
      const ids = Object.keys(bestReport).join(',');
      const existing = await sbGet(`arsskodun_report_facts?fyrirtaeki_id=in.(${ids})&select=fyrirtaeki_id,report_year`);
      const exMap = {}; existing.forEach(r => { exMap[r.fyrirtaeki_id] = r.report_year; });
      const payload = [];
      for (const [fid, b] of Object.entries(bestReport)){
        if (exMap[fid] != null && (b.year||0) < exMap[fid]) continue;   // eldri en skráð → ósnert
        payload.push({ fyrirtaeki_id: +fid, source_doc_id: b.doc_id, drive_file_id: b.drive_file_id,
          report_year: b.year || null, inspect_month: b.month || null, equipment: b.equipment,
          total_devices: b.total_devices, parse_ok: true, parsed_at: new Date().toISOString() });
      }
      if (payload.length){
        const up = await fetch(`${SUPABASE_URL}/rest/v1/arsskodun_report_facts?on_conflict=fyrirtaeki_id`, {
          method:'POST', headers: sbHeaders({ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(payload),
        });
        if (up.ok) factsUpdated = payload.length;
      }
    }

    const nextOffset = idx < docs.length ? idx : null;
    if (apply && nextOffset === null) await registerAutomation();   // einu sinni í lok yfirferðar
    return json(200, { base: baseId, total, offset, nextOffset, rows, counts, facts_updated: factsUpdated, apply });
  } catch (e){
    return json(500, { error: String(e.message || e) });
  }
};
