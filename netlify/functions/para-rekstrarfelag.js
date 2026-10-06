// para-rekstrarfelag.js — pörun skýrslna, reikninga og staða EFTIR TÆKJAFJÖLDA, fyrir rekstrarfélög
// með marga staði á einni kennitölu (Steypustöðin 8, Center Hotels 11, Pizzan 11 …).
//
// Agnar 06.10.2026: „útbúa auka tól … lesið yfir svona rekstrarfélög og skráð niður úr skýrslu og invoicum
// tækjafjölda eftir tegundum, hve mörg ný, hlaðin og yfirfarin. Para þau síðan saman burtséð frá heitum /
// heimilisföngum." · „Invoice = skýrsla = tækjalisti." · „Ekki alltaf að marka eldri skjöl."
// Dæmið sem kenndi þetta: öll skýrslublöð Steypustöðvarinnar bera „Malarhöfða 38" (aðalskrifstofa) — nafnið
// segir ekki staðinn, en 17 léttvatn + 20 duft + 1 CO₂ + 2 slöngur eru Borgarnes hvað sem blaðið heitir.
//
// Þrjár heimildir, ein eining = tæki eftir tegund (lettvatn · duft6 · duft2 · co2_2 · co2_5 · slanga · teppi;
// reykskynjarar eru taldir í skýrslu en aldrei rukkaðir og eru því utan samanburðar):
//   STAÐUR      uttaeki (virk tæki á fyrirtaeki_id)
//   SKÝRSLA     arsskodun_report_facts (nýjasta) + app_settings.arsskodun_customers[fid].history (ár fyrir ár)
//   REIKNINGUR  reikningslinur (Yfirferð + Hleðsla = skoðuð · „Slökkvitæki …" = ný) OG solur.linur (R-000xxx frá 06/2026)
//
//   GET  /api/para-rekstrarfelag?listi=1       → { felog:[{kt, nafn, stadir}] }  kennitölur með ≥ 2 staði í þjónustu
//   GET  /api/para-rekstrarfelag?kt=660707-0420 → { stadir, skyrslur, reikningar_an_skyrslu, olesnar, hledsla }
//        hver skýrsla: besti reikningur innan −1..+4 mán (frávik = Σ|mismunur| ± ný, +0,5 per mán), besti staður
//        eftir tækjaskrá, og hvort document_pairs sé sammála. `oruggt` = frávik ≤ max(2, 10 % af tækjum).
//   POST {action:'para', par_id|null, fid, base, year, report_doc_id, invoice_doc_id|solur_id, reikn, fravik}
//        → document_pairs: fyllir par sem vantar reikning eða nýskráir; HREYFIR ALDREI við manual/manual_unlink
//          eða pari sem er klárað við annan reikning (skilar {ok:false, reason}). `dry:true` sýnir án þess að skrifa.
//   POST {action:'lesa', doc_id} → les PDF skýrslunnar (Drive + pdf-parse, sama þáttun og skyrsla-bunadur) og
//        bætir árinu í arsskodun_customers[fid].history (app_settings_merge — aðeins sá lykill snertur).
//
// Les með SUPABASE_SERVICE_ROLE_KEY. Systurtól án viðmóts: slokkvitaeki/tools/para-rekstrarfelag.cjs.

const { json, cors, freshAccessToken } = require('./_google');
const { parseBunadur, toEquipment } = require('./_bunadur');
// pdf-parse er aðeins hlaðið þegar 'lesa' er kallað — GET-greiningin á að virka án þess (líka í staðbundinni prófun)
let _pdf = null; const pdf = (buf) => { if (!_pdf) _pdf = require('pdf-parse'); return _pdf(buf); };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbHeaders = (extra) => Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {});
async function sbGet(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders({ Range: `${from}-${from + 999}` }) });
    if (!r.ok) throw new Error(path.slice(0, 60) + ' → ' + r.status + ' ' + (await r.text()).slice(0, 140));
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const TEG = ['lettvatn', 'duft6', 'duft2', 'co2_2', 'co2_5', 'slanga', 'teppi'];
const MAN = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
const MNUM = {};
MAN.forEach((m, i) => { MNUM[m] = i + 1; });
const tom = () => { const o = {}; TEG.forEach(t => { o[t] = 0; }); return o; };
const sum = v => TEG.reduce((s, t) => s + (v[t] || 0), 0);
const fjarl = (a, b) => TEG.reduce((s, t) => s + Math.abs((a[t] || 0) - (b[t] || 0)), 0);
const manTala = s => { const m = String(s || '').toLowerCase(); const i = MAN.findIndex(x => m.indexOf(x) >= 0); return i >= 0 ? i + 1 : (m.indexOf('oktober') >= 0 ? 10 : 0); };
const manIdx = (ar, man) => (+ar) * 12 + (+man || 6) - 1;

function urSkyrslu(e) { e = e || {}; const v = tom(); v.lettvatn = +e.lettvatn || 0; v.duft6 = +e.duft6_12 || 0; v.duft2 = +e.duft2 || 0; v.co2_2 = +e.co2_2 || 0; v.co2_5 = +e.co2_5 || 0; v.slanga = +e.brunaslongur || 0; v.teppi = +e.eldvarnarteppi || 0; return v; }
function urTaeki(rows) {
  const v = tom();
  rows.forEach(r => {
    const t = String(r.type || ''), s = String(r.size || '');
    if (/léttvatn/i.test(t)) v.lettvatn++;
    else if (/duft/i.test(t)) { if (/(^|[^0-9])2([^0-9]|$)/.test(s)) v.duft2++; else v.duft6++; }
    else if (/co2|co₂/i.test(t)) { if (/5/.test(s)) v.co2_5++; else v.co2_2++; }
    else if (/slang|slöngu/i.test(t)) v.slanga++;
    else if (/teppi/i.test(t)) v.teppi++;
  });
  return v;
}
function tegUrTexta(d) {
  d = String(d || '').toLowerCase();
  if (/léttvatn|lettvatn/.test(d)) return 'lettvatn';
  if (/duft/.test(d)) return /(^|[^0-9])2 ?kg/.test(d) ? 'duft2' : 'duft6';
  if (/co2|co₂|kolsýr/.test(d)) return /5 ?kg/.test(d) ? 'co2_5' : 'co2_2';
  if (/brunaslang|slöngu/.test(d)) return 'slanga';
  if (/teppi/.test(d)) return 'teppi';
  return null;
}
function urLinum(linur) {
  const yf = tom(), hl = tom(), ny = tom();
  linur.forEach(l => {
    const t = l.tegund === 'co2_kg' ? null : (l.tegund || tegUrTexta(l.lysing));
    if (!t || !TEG.includes(t)) return;
    const m = +l.magn || 0, d = String(l.lysing || '');
    if (/^Yfirferð/i.test(d)) yf[t] += m; else if (/^Hleðsla/i.test(d)) hl[t] += m; else if (/^Slökkvitæki/i.test(d)) ny[t] += m;
  });
  const skodud = tom(); TEG.forEach(t => { skodud[t] = yf[t] + hl[t]; });
  return { yf, hl, ny, skodud };
}
const vstr = v => TEG.filter(t => v[t]).map(t => v[t] + ' ' + t).join(', ') || '—';

// Hvaða staðir í hópnum eru nefndir í texta („vegna húsnæðis Hjallahraun 4", „hjá fyrirtækinu Miðgarður (Center Hótel) …")?
// Sameiginlega forskeytið („Center Hótel - ") fer af heitunum svo eigin orð hvers staðar standi eftir; borið saman á stofni
// (fyrstu 6 stafir: Hjallahraun/Hjallahrauni, Grjótháls/Grjóthálsi). Skilar fylki — tómt þegar enginn staður er nefndur,
// fleiri en einn þegar textinn greinir ekki á milli (Þingholt / Þingholt Apartments).
const hreinsa = s => String(s || '').toLowerCase().replace(/[^a-z0-9áéíóúýðþæö]+/g, ' ').trim();
function stadirUrTexta(stadir, txt) {
  const t = hreinsa(txt); if (!t || !stadir.length) return [];
  const nofn = stadir.map(s => hreinsa(s.nafn));
  let forsk = nofn[0]; nofn.forEach(n => { let i = 0; while (i < forsk.length && i < n.length && forsk[i] === n[i]) i++; forsk = forsk.slice(0, i); });
  const ordin = t.split(' ').filter(o => o.length >= 4);
  return stadir.filter((s, i) => nofn[i].slice(forsk.length).split(' ').filter(w => w.length >= 4).some(w => { const st = w.slice(0, 6); return ordin.some(o => o.slice(0, st.length) === st); })).map(s => s.id);
}

// ── listi rekstrarfélaga ─────────────────────────────────────────────────────
async function listi() {
  const f = await sbGet('fyrirtaeki?er_i_thjonustu=eq.true&deleted_at=is.null&kennitala=not.is.null&select=id,nafn,kennitala&order=id');
  const h = {};
  f.forEach(x => { if (x.kennitala === '999999-9999') return; (h[x.kennitala] = h[x.kennitala] || []).push(x); });
  const felog = Object.keys(h).filter(k => h[k].length >= 2).map(k => ({ kt: k, stadir: h[k].length, nafn: h[k][0].nafn.replace(/[-–].*$/, '').trim() }));
  felog.sort((a, b) => b.stadir - a.stadir || a.nafn.localeCompare(b.nafn, 'is'));
  return { felog };
}

// ── greining fyrir eina kennitölu ───────────────────────────────────────────
async function greining(kt) {
  const stadir = await sbGet('fyrirtaeki?kennitala=eq.' + encodeURIComponent(kt) + '&deleted_at=is.null&select=id,nafn,heimilisfang,er_i_thjonustu,customer_base_id&order=id');
  if (!stadir.length) return { kt, stadir: [], skyrslur: [], reikningar_an_skyrslu: [], olesnar: [], hledsla: [] };
  const ids = stadir.map(s => s.id), inn = 'in.(' + ids.join(',') + ')';
  const [taeki, skjol, facts, lestur, por, asRow, reiknSkjol, solur] = await Promise.all([
    // Í NOTKUN = allt NEMA 'urelt' (sama regla og Ársskoðun 153 síðan 01.09.2026): status ber active/„Í lagi"/ok/loaned — 'active' eitt
    // og sér faldi 11 félög alveg (Heimaleiga Dalbrekka 4-6: 48 tæki „Í lagi", Bríetartún 9-11: 48) og tólið sagði þau tækjalaus
    sbGet('uttaeki?fyrirtaeki_id=' + inn + '&status=neq.urelt&select=fyrirtaeki_id,type,size'),
    sbGet('customer_documents?fyrirtaeki_id=' + inn + '&doc_type=eq.uttektarskyrsla&is_duplicate=is.false&select=id,fyrirtaeki_id,year,doc_date,file_name,drive_file_id&order=year.desc'),
    sbGet('arsskodun_report_facts?fyrirtaeki_id=' + inn + '&select=fyrirtaeki_id,report_year,inspect_month,equipment,total_devices,source_doc_id'),
    sbGet('reikningslestur?or=(fyrirtaeki_id.' + inn + ',kennitala.eq.' + encodeURIComponent(kt) + ')&select=reikningur_nr,fyrirtaeki_id,dags,ar,doc_id,vegna&order=dags.desc'),
    sbGet('document_pairs?fyrirtaeki_id=' + inn + '&select=id,fyrirtaeki_id,year,service_type,report_doc_id,invoice_doc_id,solur_id,status,matched_by'),
    sbGet('app_settings?id=eq.1&select=a:settings->arsskodun_customers'),
    sbGet('customer_documents?fyrirtaeki_id=' + inn + '&doc_type=eq.reikningur&select=id,invoice_number'),
    sbGet('solur?customer_kt=eq.' + encodeURIComponent(kt) + '&is_credit=is.false&select=id,num,customer_id,created_at,linur,status&order=created_at.desc')
  ]);
  const nrs = lestur.map(l => l.reikningur_nr);
  const linur = nrs.length ? await sbGet('reikningslinur?reikningur_nr=in.(' + nrs.map(n => '"' + n + '"').join(',') + ')&magn=gt.0&select=reikningur_nr,lysing,magn,tegund') : [];
  const ars = (asRow[0] && asRow[0].a) || {};
  const nafn = {}; stadir.forEach(s => { nafn[s.id] = s.nafn; });
  const docEftirNr = {}; reiknSkjol.forEach(d => { if (d.invoice_number) docEftirNr[d.invoice_number] = d.id; });

  const stadV = {}; stadir.forEach(s => { stadV[s.id] = urTaeki(taeki.filter(t => t.fyrirtaeki_id === s.id)); });

  // skýrslur: ein færsla per (staður, ár)
  const sk = [];
  // TVÆR GEYMSLUR, OG BÁÐAR GETA LOGIÐ (mælt 06.10.2026): sagan undir Grjóthálsi (261) geymdi skýrslur ALLRA fimm Aðalskoðunar-staða
  // — fjórar færslur fyrir 2026, sjö fyrir 2025 — og facts-röðin bar tölur Hjallahrauns með 2025-skjali sem heimild. 119 (félag, ár)
  // eiga fleiri en eina færslu í sögunni (111 félög, mest 15). Því: (1) færsla sem lesa skrifaði úr PDF (doc_id) vinnur; (2) facts-röð
  // þar sem heimildarskjalið er af öðru ári en report_year er ekki treyst sé saga til; (3) séu fleiri færslur sama ár er sú valin sem
  // nefnir þennan stað (hja/skra) og hinar taldar í ath — aldrei „fyrsta sem fannst".
  const skjalAr = {}; skjol.forEach(d => { skjalAr[d.id] = +d.year; });
  const sogur = {}; ids.forEach(i => { (((ars[String(i)] || {}).history) || []).forEach(h => { const ar = +h.year; if (!ar) return; (sogur[i + ':' + ar] = sogur[i + ':' + ar] || []).push(h); }); });
  const veljaSogu = (i, ar) => {
    const l = sogur[i + ':' + ar] || []; if (!l.length) return null;
    const stig = h => (h.doc_id ? 4 : 0) + (() => { const n = stadirUrTexta(stadir, (h.hja || '') + ' ' + (h.skra || '')); return n.includes(i) ? 2 : (n.length ? 0 : 1); })();
    const rod = l.slice().sort((a, b) => stig(b) - stig(a));
    const h = rod[0], adrar = l.filter(x => x !== h && fjarl(urSkyrslu(x.equipment), urSkyrslu(h.equipment)) > 0);
    return { h, fleiri: adrar.length ? 'sagan geymir ' + l.length + ' færslur fyrir ' + ar + ' — valin „' + (h.skra || h.hja || 'án heitis') + '“, hinar: ' + adrar.map(x => vstr(urSkyrslu(x.equipment))).join(' · ') : null };
  };
  facts.forEach(f => {
    const ar = +f.report_year, saga = veljaSogu(f.fyrirtaeki_id, ar);
    const skjalRangt = f.source_doc_id && skjalAr[f.source_doc_id] && skjalAr[f.source_doc_id] !== ar;
    if (saga && (saga.h.doc_id || skjalRangt)) return;   // sagan vinnur — bætt við í history-lykkjunni að neðan
    sk.push({ fid: f.fyrirtaeki_id, ar, man: f.inspect_month, v: urSkyrslu(f.equipment), doc: f.source_doc_id, heimild: 'facts', ath0: [skjalRangt ? 'facts-röðin vísar á skjal ' + f.source_doc_id + ' frá ' + skjalAr[f.source_doc_id] : null, saga && fjarl(urSkyrslu(saga.h.equipment), urSkyrslu(f.equipment)) > 0 ? 'sagan segir ' + vstr(urSkyrslu(saga.h.equipment)) + ' fyrir ' + ar + ' — facts-röðin notuð' : null, saga ? saga.fleiri : null].filter(Boolean) });
  });
  Object.keys(sogur).forEach(k => {
    const [i, ar] = k.split(':').map(Number); if (sk.some(x => x.fid === i && x.ar === ar)) return;
    const saga = veljaSogu(i, ar), h = saga.h, f = facts.find(x => x.fyrirtaeki_id === i && +x.report_year === ar);
    sk.push({ fid: i, ar, man: manTala(h.skodun), v: urSkyrslu(h.equipment), doc: h.doc_id || null, heimild: 'history' + (h.skra ? ' · ' + h.skra : ''), hja: h.hja || null, ath0: [saga.fleiri, f && fjarl(urSkyrslu(f.equipment), urSkyrslu(h.equipment)) > 0 ? 'facts-röðin segir ' + vstr(urSkyrslu(f.equipment)) + (f.source_doc_id ? ' (skjal ' + f.source_doc_id + (skjalAr[f.source_doc_id] ? ' frá ' + skjalAr[f.source_doc_id] : '') + ')' : '') + ' — sagan úr PDF notuð' : null].filter(Boolean) });
  });
  const olesin = skjol.filter(d => !sk.some(x => x.fid === d.fyrirtaeki_id && +x.ar === +d.year));

  // reikningar: reikningslestur + solur (salan ræður sé sami reikningur í báðum)
  const rk = lestur.map(l => { const u = urLinum(linur.filter(x => x.reikningur_nr === l.reikningur_nr)); const d = l.dags ? new Date(l.dags) : null; return Object.assign({ nr: l.reikningur_nr, vegna: l.vegna || null, fid: l.fyrirtaeki_id, dags: l.dags, ar: d ? d.getFullYear() : +l.ar, man: d ? d.getMonth() + 1 : 0, doc: l.doc_id || docEftirNr[l.reikningur_nr] || null, solurId: null }, u); }).filter(r => sum(r.skodud) + sum(r.ny) > 0);
  solur.filter(s => s.status !== 'void' && s.status !== 'cancelled').forEach(s => {
    const ls = (Array.isArray(s.linur) ? s.linur : []).map(l => ({ lysing: String(l.desc || l.lysing || ''), magn: +(l.qty || l.magn || 0), tegund: null }));
    const u = urLinum(ls); if (sum(u.skodud) + sum(u.ny) === 0) return;
    const fyrri = rk.findIndex(r => r.nr === s.num); if (fyrri >= 0) rk.splice(fyrri, 1);
    const d = new Date(s.created_at);
    rk.push(Object.assign({ nr: s.num, vegna: null, fid: s.customer_id, dags: String(s.created_at).slice(0, 10), ar: d.getFullYear(), man: d.getMonth() + 1, doc: docEftirNr[s.num] || null, solurId: s.id }, u));
  });

  const iAr = new Date().getFullYear();
  const lykill = r => r.doc ? 'd' + r.doc : (r.solurId ? 's' + r.solurId : 'n' + r.nr);
  // EINN REIKNINGUR, EIN SKÝRSLA (06.10.2026): R-107896 „vegna húsnæðis Hjallahraun 4" var paraður við þrjá staði Aðalskoðunar af því
  // að Grjótháls og Hjallahraun áttu nákvæmlega sömu tölur. Nú: reikningur sem er bundinn í pari tilheyrir ÞEIRRI skýrslu; vegna-línan
  // útilokar aðra staði; skýrslur með lægsta frávik velja fyrst; tvíræðar tölur (tveir staðir sömu tölur sama ár) eru sýndar en ekki
  // paraðar sjálfkrafa nema vegna-línan skeri úr.
  const tekid = {};
  por.filter(p => p.service_type === 'uttekt').forEach(p => { if (p.invoice_doc_id) tekid['d' + p.invoice_doc_id] = { fid: p.fyrirtaeki_id, ar: +p.year, par: p.id }; if (p.solur_id) tekid['s' + p.solur_id] = { fid: p.fyrirtaeki_id, ar: +p.year, par: p.id }; });
  const kand = sk.map(s => {
    const mi = manIdx(s.ar, s.man), listi = [], utilokad = [];
    rk.forEach(r => {
      const dm = manIdx(r.ar, r.man) - mi; if (dm < -1 || dm > 4) return;
      const vegnaFid = r.vegna ? stadirUrTexta(stadir, r.vegna) : [];
      const medNy = tom(); TEG.forEach(t => { medNy[t] = r.skodud[t] + r.ny[t]; });
      const d = Math.min(fjarl(s.v, r.skodud), fjarl(s.v, medNy)) + Math.abs(dm) * 0.5;
      if (vegnaFid.length && !vegnaFid.includes(s.fid)) { if (d <= 2) utilokad.push({ nr: r.nr, d, vegna: r.vegna, fid: vegnaFid }); return; }
      listi.push({ r, d, vegnaFid });
    });
    listi.sort((a, b) => a.d - b.d);
    return { s, listi, utilokad };
  });
  const rod = kand.slice().sort((a, b) => (a.listi.length ? a.listi[0].d : 99) - (b.listi.length ? b.listi[0].d : 99) || b.s.ar - a.s.ar);
  rod.forEach(k => {
    const s = k.s; let best = null, upptekinn = null;
    for (const c of k.listi) {
      const t = tekid[lykill(c.r)];
      if (t && !(t.fid === s.fid && t.ar === +s.ar)) { if (!upptekinn) upptekinn = { nr: c.r.nr, fravik: Math.round(c.d * 10) / 10, fid: t.fid, ar: t.ar, par: t.par || null }; continue; }
      best = c; break;
    }
    const oruggt = !!(best && best.d <= Math.max(2, sum(s.v) * 0.1));
    if (oruggt && !tekid[lykill(best.r)]) tekid[lykill(best.r)] = { fid: s.fid, ar: +s.ar };
    k.best = best; k.upptekinn = upptekinn; k.oruggt = oruggt;
  });
  const skyrslur = [];
  kand.sort((a, b) => b.s.ar - a.s.ar || a.s.fid - b.s.fid).forEach(k => {
    const s = k.s, best = k.best, ath = (s.ath0 || []).slice();
    let bs = null; ids.forEach(i => { const d = fjarl(s.v, stadV[i]); if (!bs || d < bs.d) bs = { fid: i, d }; });
    const sv = sum(s.v);
    const skDoc = (skjol.find(d => d.fyrirtaeki_id === s.fid && +d.year === +s.ar) || {}).id || s.doc;
    const par = por.find(p => p.fyrirtaeki_id === s.fid && +p.year === +s.ar && p.service_type === 'uttekt') || por.find(p => p.report_doc_id === skDoc);
    const parInv = par && (par.invoice_doc_id || par.solur_id);
    const samiReikn = !!(best && par && ((par.invoice_doc_id && par.invoice_doc_id === best.r.doc) || (par.solur_id && par.solur_id === best.r.solurId)));
    const handvirkt = !!(par && /manual/.test(par.matched_by || ''));
    const parStada = best ? (parInv ? (samiReikn ? 'sammala' : 'annar') : 'vantar') : (parInv ? 'par_an_talningar' : 'ekkert');
    // tvíræðni: annar staður í hópnum með NÁKVÆMLEGA sömu tölur sama ár — reikningur án vegna-línu getur átt hvorn sem er
    const tviraed = sk.filter(o => o !== s && +o.ar === +s.ar && o.fid !== s.fid && fjarl(o.v, s.v) === 0).map(o => nafn[o.fid]);
    const vegnaSker = !!(best && best.vegnaFid.length === 1 && best.vegnaFid[0] === s.fid);
    if (best && best.r.vegna) ath.push('vegna: „' + best.r.vegna + '“' + (vegnaSker ? ' → þessi staður' : ''));
    if (best && best.r.fid && best.r.fid !== s.fid) ath.push('reikningurinn er skráður á ' + (nafn[best.r.fid] || best.r.fid));
    if (k.upptekinn) ath.push(k.upptekinn.nr + ' (frávik ' + k.upptekinn.fravik + ') er þegar paraður við ' + (nafn[k.upptekinn.fid] || k.upptekinn.fid) + ' ' + k.upptekinn.ar + (best ? ' — næsti: ' + best.r.nr : ' — enginn annar'));
    k.utilokad.forEach(u => ath.push(u.nr + ' (frávik ' + Math.round(u.d * 10) / 10 + ') útilokaður: vegna „' + u.vegna + '“ = ' + u.fid.map(i => nafn[i]).join('/')));
    if (tviraed.length) ath.push('tvíræð: ' + tviraed.join(', ') + ' með sömu tölur ' + s.ar + (vegnaSker ? ' — vegna-línan sker úr' : ''));
    const maPara = k.oruggt && !!skDoc && !!(best.r.doc || best.r.solurId) && (!par || (par.status === 'vantar_reikning' && !handvirkt)) && (!tviraed.length || vegnaSker);
    const eiginFravik = fjarl(s.v, stadV[s.fid]);
    skyrslur.push({
      fid: s.fid, nafn: nafn[s.fid], ar: s.ar, man: s.man, heimild: s.heimild, hja: s.hja || null, eldri: (iAr - s.ar) >= 2, doc: skDoc, taeki: sv, skyrsla: s.v, skyrsla_txt: vstr(s.v),
      reikningur: best ? { nr: best.r.nr, dags: best.r.dags, fid: best.r.fid, doc: best.r.doc, solur_id: best.r.solurId, vegna: best.r.vegna || null, skodud: best.r.skodud, ny: best.r.ny, skodud_txt: vstr(best.r.skodud), ny_txt: vstr(best.r.ny), fravik: Math.round(best.d * 10) / 10, oruggt: k.oruggt } : null,
      stadur: bs ? { fid: bs.fid, nafn: nafn[bs.fid], fravik: bs.d, eigin_fravik: eiginFravik, sammala: bs.fid === s.fid } : null,
      par: par ? { id: par.id, status: par.status, matched_by: par.matched_by, invoice_doc_id: par.invoice_doc_id, solur_id: par.solur_id, sammala: samiReikn, handvirkt } : null,
      par_stada: parStada, ma_para: maPara, ath, tviraed, base: (stadir.find(x => x.id === s.fid) || {}).customer_base_id || null
    });
  });
  const teknir = new Set(skyrslur.map(x => x.reikningur && x.reikningur.nr).filter(Boolean));
  const reikningar_an_skyrslu = rk.filter(r => !teknir.has(r.nr)).map(r => { let bs = null; ids.forEach(i => { const d = fjarl(r.skodud, stadV[i]); if (!bs || d < bs.d) bs = { fid: i, d }; }); return { nr: r.nr, dags: r.dags, fid: r.fid, nafn: nafn[r.fid] || null, vegna: r.vegna || null, skodud_txt: vstr(r.skodud), ny_txt: vstr(r.ny), stadur: bs ? { fid: bs.fid, nafn: nafn[bs.fid], fravik: bs.d } : null }; });

  // hleðslusaga per staður (Agnar: „spá fyrir hvað maður þarf að sækja mörg tæki til hleðslu")
  const hledsla = stadir.map(st => {
    const ar = {};
    rk.filter(r => r.fid === st.id).forEach(r => { const y = r.ar; ar[y] = ar[y] || { hl: tom(), ny: tom() }; TEG.forEach(t => { ar[y].hl[t] += r.hl[t]; ar[y].ny[t] += r.ny[t]; }); });
    const h = (((ars[String(st.id)] || {}).history) || []).slice().sort((a, b) => (+b.year) - (+a.year)).find(x => x.annad);
    return { fid: st.id, nafn: st.nafn, taeki: sum(stadV[st.id]), saga: Object.keys(ar).map(Number).sort().map(y => ({ ar: y, hladin: vstr(ar[y].hl), ny: vstr(ar[y].ny) })), texti: h ? { ar: h.year, annad: String(h.annad).slice(0, 400) } : null };
  });

  return {
    kt, stadir: stadir.map(s => ({ id: s.id, nafn: s.nafn, heimilisfang: s.heimilisfang, thjonusta: s.er_i_thjonustu, taeki: sum(stadV[s.id]), vigur: vstr(stadV[s.id]) })),
    skyrslur, reikningar_an_skyrslu,
    olesnar: olesin.map(d => ({ doc: d.id, fid: d.fyrirtaeki_id, nafn: nafn[d.fyrirtaeki_id], ar: d.year, skra: d.file_name, drive: d.drive_file_id })),
    hledsla
  };
}

// ── POST para ───────────────────────────────────────────────────────────────
async function para(b) {
  const fid = parseInt(b.fid, 10), year = parseInt(b.year, 10), rep = parseInt(b.report_doc_id, 10);
  const inv = b.invoice_doc_id ? parseInt(b.invoice_doc_id, 10) : null, sol = b.solur_id ? parseInt(b.solur_id, 10) : null;
  if (!fid || !year || !rep || (!inv && !sol)) return { ok: false, reason: 'vantar fid/year/report_doc_id/reikning' };
  const nota = '06.10.2026+: parað eftir tækjafjölda per tegund (para-rekstrarfelag) · ' + (b.reikn || '') + ' · frávik ' + (b.fravik != null ? b.fravik : '?');
  const til = await sbGet('document_pairs?fyrirtaeki_id=eq.' + fid + '&year=eq.' + year + '&service_type=eq.uttekt&select=id,status,matched_by,invoice_doc_id,solur_id,notes');
  const par = til[0];
  // einn reikningur, ein skýrsla: sé reikningurinn þegar í pari við aðra skýrslu er hann ekki laus (nema force:true)
  const bund = await sbGet('document_pairs?' + (inv ? 'invoice_doc_id=eq.' + inv : 'solur_id=eq.' + sol) + '&select=id,fyrirtaeki_id,year,status,matched_by');
  const annar = bund.find(p => !(p.fyrirtaeki_id === fid && +p.year === year));
  if (annar && !b.force) return { ok: false, reason: 'reikningurinn er þegar í pari ' + annar.id + ' (staður ' + annar.fyrirtaeki_id + ' · ' + annar.year + ', ' + (annar.matched_by || '') + ') — einn reikningur, ein skýrsla' };
  if (par) {
    if (/manual/.test(par.matched_by || '')) return { ok: false, reason: 'parið er handvirkt (' + par.matched_by + ') — ekki hreyft' };
    if (par.invoice_doc_id || par.solur_id) return { ok: false, reason: 'parið er þegar klárað við ' + (par.invoice_doc_id ? 'skjal ' + par.invoice_doc_id : 'sölu ' + par.solur_id) + ' — ekki hreyft' };
    if (b.dry) return { ok: true, dry: true, adgerd: 'uppfaera', par_id: par.id };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/document_pairs?id=eq.${par.id}`, { method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ invoice_doc_id: inv, solur_id: sol, report_doc_id: rep, status: 'klarad', matched_by: 'magn_station', notes: ((par.notes || '') + ' | ' + nota).slice(-900), updated_at: new Date().toISOString() }) });
    if (!r.ok) throw new Error('PATCH ' + r.status + ' ' + (await r.text()).slice(0, 160));
    return { ok: true, adgerd: 'uppfaera', par_id: par.id };
  }
  if (b.dry) return { ok: true, dry: true, adgerd: 'nyskra' };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/document_pairs`, { method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ customer_base_id: b.base || null, fyrirtaeki_id: fid, year, service_type: 'uttekt', report_doc_id: rep, invoice_doc_id: inv, solur_id: sol, status: 'klarad', matched_by: 'magn_station', notes: nota }) });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error('POST ' + r.status + ' ' + JSON.stringify(rows).slice(0, 160));
  return { ok: true, adgerd: 'nyskra', par_id: rows[0] && rows[0].id };
}

// ── POST lesa ───────────────────────────────────────────────────────────────
function parseMonth(text) {
  const t = String(text || '');
  let m = /Dags[^0-9]{0,6}[0-9]{1,2}[./]([0-9]{1,2})[./][0-9]{2,4}/i.exec(t);
  if (m) return parseInt(m[1], 10);
  m = /(janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember|oktober)[ \t]+20[0-9][0-9]/i.exec(t);
  if (m) return MNUM[m[1].toLowerCase()] || (m[1].toLowerCase() === 'oktober' ? 10 : null);
  return null;
}
async function lesa(b) {
  const docId = parseInt(b.doc_id, 10); if (!docId) return { ok: false, reason: 'vantar doc_id' };
  const d = (await sbGet('customer_documents?id=eq.' + docId + '&select=id,fyrirtaeki_id,year,drive_file_id,storage_path,file_name'))[0];
  if (!d || !(d.drive_file_id || d.storage_path)) return { ok: false, reason: 'skjalið finnst ekki eða á hvorki Drive-skrá né geymsluslóð' };
  let r;
  if (d.drive_file_id) {
    const token = await freshAccessToken();
    r = await fetch(`https://www.googleapis.com/drive/v3/files/${d.drive_file_id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return { ok: false, reason: 'Drive ' + r.status };
  } else {
    // skýrslur úr appinu sjálfu búa í Supabase-geymslunni: storage_path = "<bucket>/<slóð>" (t.d. samningar/company_attachments/608/…pdf)
    const sp = String(d.storage_path).replace(/^[/]+/, ''), bucket = sp.split('/')[0], slod = sp.slice(bucket.length + 1);
    r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${slod.split('/').map(encodeURIComponent).join('/')}`, { headers: sbHeaders() });
    if (!r.ok) return { ok: false, reason: 'geymsla ' + r.status + ' (' + sp.slice(0, 60) + ')' };
  }
  const parsed = await pdf(Buffer.from(await r.arrayBuffer())).catch(() => null);
  const text = (parsed && parsed.text) || '';
  if (text.replace(/[ \t\r\n]/g, '').length < 30) return { ok: false, reason: 'gat ekki lesið PDF-texta (skannað blað?)' };
  const bun = parseBunadur(text), man = parseMonth(text);
  if (!(bun.matched > 0)) return { ok: false, reason: 'engin „Fjöldi"-lína fannst í textanum' };
  const equipment = toEquipment(bun);
  // „hjá fyrirtækinu …" + „yfirfarin í <mánuður ár>" — línurnar sem segja staðinn og mánuðinn
  // pdf-parse skilar „hjá \nfyrirtækinu Steypustöðin Borgarnesi kt:660707-0420 \n" — línuskil á undan OG eftir „fyrirtækinu"
  const hja = ((/hjá[ \t\r\n]+(?:fyrirtækinu|húsfélaginu|félaginu|stofnuninni|hótelinu|skólanum|leikskólanum)[ \t\r\n]+([^\n]{3,90})/i.exec(text) || [])[1] || '').replace(/[ \t]*kt[.:]?[ \t]*[0-9-]*[ \t]*$/i, '').trim() || null;
  const annad = (/Annað:[ \t]*([^]*?)(Athugasemdir:|Fyrir hönd|$)/i.exec(text) || [])[1];
  const ar = d.year || (/(20[0-9][0-9])/.exec(text) || [])[1];
  const faersla = { year: String(ar), skodun: ar + '-' + (man ? MAN[man - 1] : ''), equipment, hja, doc_id: docId, annad: annad ? annad.replace(/[ \t\r\n]+/g, ' ').trim().slice(0, 600) : '', skra: d.file_name || '', stada: '', lesid: 'para-rekstrarfelag ' + new Date().toISOString().slice(0, 10) };
  // Segir skýrslan sjálf annan stað í hópnum en hún er skráð á? (06.10.2026: 9906 „Miðgarður“ lá undir Skjaldbreið og lesturinn
  // yfirskrifaði 3-tækja söguna hennar með 33 tækjum Miðgarðs.) Og á árið þegar færslu úr öðru skjali með öðrum tölum?
  // Hvort tveggja stöðvar skrifin nema force:true fylgi — svarið ber tölurnar svo sá sem les geti dæmt.
  const eigandi = (await sbGet('fyrirtaeki?id=eq.' + d.fyrirtaeki_id + '&select=id,nafn,kennitala'))[0] || {};
  const systkin = eigandi.kennitala && eigandi.kennitala !== '999999-9999' ? await sbGet('fyrirtaeki?kennitala=eq.' + encodeURIComponent(eigandi.kennitala) + '&deleted_at=is.null&select=id,nafn') : [];
  const nefndir = hja ? stadirUrTexta(systkin, hja) : [];
  const annarStadur = nefndir.length && !nefndir.includes(d.fyrirtaeki_id) ? nefndir.map(i => (systkin.find(x => x.id === i) || {}).nafn).join(' / ') : null;
  const row = (await sbGet('app_settings?id=eq.1&select=a:settings->arsskodun_customers'))[0] || {};
  const cur = ((row.a || {})[String(d.fyrirtaeki_id)] || {});
  const fyrri = (Array.isArray(cur.history) ? cur.history : []).find(h => String(h.year) === String(ar));
  const odruvisi = !!(fyrri && fyrri.doc_id !== docId && fjarl(urSkyrslu(fyrri.equipment), urSkyrslu(equipment)) > 0);
  const vidvorun = (annarStadur ? 'skýrslan segir „' + hja + '“ = ' + annarStadur + ', ekki ' + (eigandi.nafn || d.fyrirtaeki_id) + ' — færðu skjalið á réttan stað fyrst' : '')
    + (annarStadur && odruvisi ? '; ' : '')
    + (odruvisi ? ar + ' á þegar færslu' + (fyrri.doc_id ? ' úr skjali ' + fyrri.doc_id : '') + ' með öðrum tölum (' + vstr(urSkyrslu(fyrri.equipment)) + ')' : '');
  if (!b.force && !b.dry && vidvorun) return { ok: false, tharf_force: true, doc_id: docId, fid: d.fyrirtaeki_id, ar, man, hja, vigur: vstr(urSkyrslu(equipment)), reason: vidvorun + ' · force:true yfirskrifar' };
  if (!b.dry) {
    const history = Array.isArray(cur.history) ? cur.history.filter(h => String(h.year) !== String(ar)) : [];
    history.push(faersla);
    const patch = { arsskodun_customers: {} }; patch.arsskodun_customers[String(d.fyrirtaeki_id)] = { history };
    const m = await fetch(`${SUPABASE_URL}/rest/v1/rpc/app_settings_merge`, { method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ p_patch: patch }) });
    if (!m.ok) throw new Error('app_settings_merge ' + m.status + ' ' + (await m.text()).slice(0, 160));
    // Hin geymslan líka (fact-check: „þær fara úr takt"): facts-röðin er ein per félag = nýjasta skýrslan. Uppfærð þegar þetta ár er
    // jafn nýtt eða nýrra en það sem röðin ber — eldra skjal lækkar hana aldrei. Fyrir 261 bar hún tölur Hjallahrauns með 2025-skjali.
    const fr = (await sbGet('arsskodun_report_facts?fyrirtaeki_id=eq.' + d.fyrirtaeki_id + '&select=report_year,source_doc_id'))[0];
    if (!fr || !fr.report_year || +ar >= +fr.report_year) {
      const alls = Object.keys(equipment || {}).reduce((t, k) => t + (+equipment[k] || 0), 0);
      const fu = await fetch(`${SUPABASE_URL}/rest/v1/arsskodun_report_facts?on_conflict=fyrirtaeki_id`, { method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ fyrirtaeki_id: d.fyrirtaeki_id, source_doc_id: docId, drive_file_id: d.drive_file_id || null, report_year: +ar, inspect_month: man || null, equipment, total_devices: alls, parse_ok: true, parsed_at: new Date().toISOString(), raw_month_txt: man ? MAN[man - 1] + ' ' + ar : null }) });
      if (!fu.ok) throw new Error('report_facts ' + fu.status + ' ' + (await fu.text()).slice(0, 160));
      faersla._facts = 'uppfærð';
    }
  }
  return { ok: true, doc_id: docId, fid: d.fyrirtaeki_id, ar, man, hja, equipment, vigur: vstr(urSkyrslu(equipment)), annad: faersla.annad, annar_stadur: annarStadur || null, vidvorun: vidvorun || null, dry: !!b.dry };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (_) {}
      if (body.action === 'para') return json(200, await para(body));
      if (body.action === 'lesa') return json(200, await lesa(body));
      return json(400, { error: 'unknown action' });
    }
    const p = event.queryStringParameters || {};
    if (p.listi) return json(200, await listi());
    if (p.kt && /^[0-9]{6}-?[0-9]{4}$/.test(p.kt)) return json(200, await greining(p.kt));
    return json(400, { error: 'vantar ?kt=660707-0420 eða ?listi=1' });
  } catch (e) {
    return json(500, { error: String(e && e.message || e).slice(0, 300) });
  }
};
