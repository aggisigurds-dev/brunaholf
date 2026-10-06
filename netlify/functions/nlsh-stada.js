// nlsh-stada.js — NLSH: stafræn útgáfa mánaðarlokaskýrslunnar til Landsspítalans.
//
//   GET  /api/nlsh-stada?til=2026-08          (sjálfgefið: síðasti heili mánuður)
//     → { month, …, lines[] (valinn mánuður í smáatriðum: Ajour-flokkar, í mánuðinum,
//         lokatala, ekki_done), unmapped[], totals{}, ekki_done, vistad_at, vistadir_manudir[],
//         skyrsla: { verk:[{verk_nr,label,fjoldi,rate,full,metrar}],
//                    manudir:[{month, lines:[{verk_nr, ajour_cum, lokatala, stada, heilar,
//                              upphaed, delta, delta_heilar, upphaed_man}], totals{}}] } }
//   POST /api/nlsh-stada  { month, lines:[{verk_nr, lokatala|null}] }
//     → vistar lokatölur (null = eyða → Ajour gildir) og skilar sama og GET.
//
// Agnar 02.09.2026: „bara total stöðuna í lok mánaðar … setja það inní töfluna sem
// reiknar rest." · 03.09.2026: „enable me to put in new month and add the final
// month's end numbers or change it" · „just try to replicate the report into more
// digital form."
//
// Þrjú lög:
//   1. AJOUR-TILLAGA — stakir SerialNumber með registration_status = Done, fyrsta
//      Done-dagsetning (checked_date, annars execution_date) bucketuð per mánuð
//      (SQL nlsh_stada_manudir, EITT kall fyrir alla mánuði) og uppsöfnuð hér.
//      Sama tala og nlsh_stada gefur fyrir hvern mánuð fyrir sig.
//   2. LOKATALA — talan sem Agnar sendir, vistuð per mánuð+verklið í nlsh_manadarlok
//      (RLS, service_role). Auð = Ajour gildir. Metrar mega hafa aukastafi.
//   3. SKÝRSLAN — reiknuð eins og samningsblaðið: heilar, upphæð heild (heilar ×
//      verð/heild m. vsk), mánaðarmunur og upphæð í mánuði — per mánuð frá sept 2025.
//
// REGLUR BLAÐSINS — sannaðar úr Aðalskjali (júlí 2026, dálkar G/H): ALLT helmingað nema
// 2.2 og 1.2 (1 staka = 1 heild); 2.11 er í metrum (aukastafir) en helmingað samt; 3.1 og
// 1.3 helminguð. Reglur, verð, Fjöldi og kortlagning: VERK í nlsh-uppgjor.js (einn staður,
// samræmt 03.09.2026 — áður hafði hub-áætlunin full á 1.3 án rökstuðnings).

const { VERK, NLSH_NAMES, studull } = require('./nlsh-uppgjor.js');

// 2.11 „Frágangur raufa meðfram köntuðum stokkum" er EINI liðurinn í metrum (Agnar 06.10.2026):
// hver Ajour-skráning ber ummál stokksins í Description („860mm*430mm", „800mm-350mm",
// „1,3 m") og metrarnir eru ummálið: (L+L+B+B)/1000 — t.d. 34 skráningar → 102 m.
// Lesið úr ajour_registrations.subject (Description úr CSV); yfirskrift per skráningu í
// nlsh_raufar_metrar (handleiðrétt þegar textinn er óljós). Fjöldi skráninga skiptir engu.
function raufMetrar(desc) {
  const d = String(desc || '').replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\b\d{1,2}[-./]\d{1,2}[-./]\d{2,4}\b/g, ' ');   // dagsetningar („02-07-2026") eru ekki ummál
  const finna = (re) => { const out = []; let m; while ((m = re.exec(d))) out.push([+m[1], +m[2]]); return out; };
  // „860mm*430mm", „650 x 400", „850×400" ganga framar „800mm-350mm" / „240_250"
  let por = finna(/(\d{2,4})\s*(?:mm)?\s*[x×*X]\s*(\d{2,4})\s*(?:mm)?/g);
  if (!por.length) por = finna(/(\d{2,4})\s*(?:mm)?\s*[\-–_]\s*(\d{2,4})\s*(?:mm|m)?/g);
  por = por.filter(([a, b]) => a >= 20 && b >= 20);
  if (por.length) { const [a, b] = por[por.length - 1]; return { metrar: Math.round(2 * a + 2 * b) / 1000, lengd: a, breidd: b, adferd: 'ummál' }; }
  const mm = d.match(/(\d+(?:\.\d+)?)\s*(?:m\b|metr)/i);
  if (mm && +mm[1] > 0 && +mm[1] < 20) return { metrar: +mm[1], lengd: null, breidd: null, adferd: 'metrar' };
  return null;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' });
const FYRSTI_MANUDUR = '2025-09';   // verkið hófst sept 2025 — fyrsta dálkur blaðsins

// Reglur, verð og Fjöldi koma úr VERK í nlsh-uppgjor.js (reglur úr VERK — einn staður).
// Blaðið helmingar ALLT nema full-liðina (2.2, 1.2) — metrar (2.11) líka.
const RULE = Object.fromEntries(VERK.map(v => [v.verk_nr, v]));
const VERK_NR = new Set(VERK.map(v => v.verk_nr));
// Heilar safnast mánuð fyrir mánuð: Δ stakar × stuðull MÁNAÐARINS (gildisdagar í VERK —
// 2.2 heilt til júlí 2026, helmingað frá ágúst; gólf/hæðarskil 1=1).

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') {
    let p = {};
    try { p = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Ógilt JSON' }); }
    // 2.11 — handleiðrétting metra á einni skráningu (null = eyða → lesið úr Description)
    if (p.action === 'raufar') {
      const sn = String(p.serial_number || '').trim();
      if (!/^\d+$/.test(sn)) return json(400, { error: 'serial_number vantar' });
      try {
        if (p.metrar == null || p.metrar === '') {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_raufar_metrar?serial_number=eq.${sn}`, { method: 'DELETE', headers: H() });
          if (!r.ok) throw new Error(`eyða: ${r.status}`);
        } else {
          const n = Number(p.metrar);
          if (!Number.isFinite(n) || n < 0 || n > 50) return json(400, { error: 'ógildir metrar' });
          const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_raufar_metrar?on_conflict=serial_number`, {
            method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify([{ serial_number: sn, metrar: Math.round(n * 1000) / 1000, athugasemd: p.athugasemd ? String(p.athugasemd).slice(0, 200) : null, updated_at: new Date().toISOString() }]) });
          if (!r.ok) throw new Error(`vista: ${r.status} ${(await r.text()).slice(0, 200)}`);
        }
      } catch (e) { return json(502, { error: e.message }); }
      return stada(String(p.month || '').trim() || sidastiManudur());
    }
    const month = String(p.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return json(400, { error: 'month verður að vera YYYY-MM' });
    const lines = Array.isArray(p.lines) ? p.lines : (p.verk_nr ? [p] : []);
    const upserts = [], eyda = [];
    const now = new Date().toISOString();
    for (const l of lines) {
      const verk_nr = String(l.verk_nr || '').trim();
      if (!VERK_NR.has(verk_nr)) return json(400, { error: `óþekktur verkliður: ${verk_nr}` });
      if (l.lokatala == null || l.lokatala === '') { eyda.push(verk_nr); continue; }
      const n = Number(l.lokatala);
      if (!Number.isFinite(n) || n < 0) return json(400, { error: `ógild lokatala fyrir ${verk_nr}` });
      const metrar = !!(RULE[verk_nr] || {}).metrar;
      upserts.push({ month, verk_nr, lokatala: metrar ? Math.round(n * 100) / 100 : Math.round(n),
        athugasemd: l.athugasemd ? String(l.athugasemd).slice(0, 200) : null, updated_at: now });
    }
    try {
      if (eyda.length) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_manadarlok?month=eq.${month}&verk_nr=in.(${eyda.map(v => `"${v}"`).join(',')})`, { method: 'DELETE', headers: H() });
        if (!r.ok) throw new Error(`eyða: ${r.status} ${(await r.text()).slice(0, 200)}`);
      }
      if (upserts.length) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/nlsh_manadarlok?on_conflict=month,verk_nr`, {
          method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(upserts) });
        if (!r.ok) throw new Error(`vista: ${r.status} ${(await r.text()).slice(0, 200)}`);
      }
    } catch (e) { return json(502, { error: e.message }); }
    return stada(month);
  }

  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const qs = event.queryStringParameters || {};
  const month = String(qs.til || '').trim() || sidastiManudur();
  if (!/^\d{4}-\d{2}$/.test(month)) return json(400, { error: 'til verður að vera YYYY-MM' });
  return stada(month);
};

async function stada(month) {
  const [y, m] = month.split('-').map(Number);
  const fra = `${month}-01`;
  const til = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);   // fyrsti dagur næsta mánaðar

  let groups, manRows, lokRows, raufRows = [], raufYfir = [];
  try {
    const nofn = `project_name=in.(${NLSH_NAMES.map(n => `"${n}"`).join(',')})`;
    const [g, mr, lr, rr, ry] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/nlsh_stada`, { method: 'POST', headers: H(), body: JSON.stringify({ p_names: NLSH_NAMES, p_fra: fra, p_til: til }) }),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/nlsh_stada_manudir`, { method: 'POST', headers: H(), body: JSON.stringify({ p_names: NLSH_NAMES, p_til: til }) }),
      fetch(`${SUPABASE_URL}/rest/v1/nlsh_manadarlok?select=month,verk_nr,lokatala,athugasemd,updated_at&order=month`, { headers: H() }),
      fetch(`${SUPABASE_URL}/rest/v1/ajour_registrations?select=serial_number,registration_status,checked_date,execution_date,subject&${nofn}&category_group=ilike.Raufar*&limit=5000`, { headers: H() }),
      fetch(`${SUPABASE_URL}/rest/v1/nlsh_raufar_metrar?select=serial_number,metrar,athugasemd,updated_at&limit=5000`, { headers: H() }),
    ]);
    for (const [r, n] of [[g, 'nlsh_stada'], [mr, 'nlsh_stada_manudir'], [lr, 'lokatölur']]) {
      if (!r.ok) throw new Error(`${n}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    [groups, manRows, lokRows] = await Promise.all([g.json(), mr.json(), lr.json()]);
    if (rr.ok) raufRows = await rr.json();
    if (ry.ok) raufYfir = await ry.json();   // taflan getur vantað í eldra umhverfi — þá bara Description
  } catch (e) { return json(502, { error: e.message }); }

  // ── 2.11: metrar per skráningu og mánuð (fyrsta Done-dagsetning, sama og nlsh_stada_manudir) ──
  const yfir = new Map(raufYfir.map(r => [String(r.serial_number), r]));
  const raufBy = new Map();
  for (const r of raufRows) {
    const sn = String(r.serial_number);
    const e = raufBy.get(sn) || { serial_number: sn, done: false, dags: null, subject: null };
    if (r.registration_status === 'Done') e.done = true;
    const d = r.checked_date || r.execution_date;
    if (d && (!e.dags || d < e.dags)) e.dags = d;
    if (r.subject && !e.subject) e.subject = r.subject;
    raufBy.set(sn, e);
  }
  const raufar = [...raufBy.values()].map(e => {
    const lesid = raufMetrar(e.subject), y = yfir.get(e.serial_number);
    const metrar = y ? Number(y.metrar) : (lesid ? lesid.metrar : null);
    return { serial_number: e.serial_number, done: e.done, dags: e.dags, man: e.dags ? String(e.dags).slice(0, 7) : null,
      lysing: e.subject, lesid, yfirskrift: y ? Number(y.metrar) : null, athugasemd: y ? y.athugasemd : null, metrar };
  }).sort((a, b) => String(b.dags || '').localeCompare(String(a.dags || '')) || (+b.serial_number - +a.serial_number));
  const raufMan = new Map();   // month → metrar (Done)
  for (const r of raufar) if (r.done && r.man && r.metrar != null) raufMan.set(r.man, (raufMan.get(r.man) || 0) + r.metrar);

  const verkAf = (group) => { const i = VERK.findIndex(v => v.test.test(group)); return i < 0 ? null : VERK[i].verk_nr; };

  // ── Valinn mánuður í smáatriðum (eins og áður) ──────────────────────────
  const lines = VERK.map(v => ({ verk_nr: v.verk_nr, label: v.label, groups: [], stakar_alls: 0, stakar_manudur: 0, ekki_done: 0 }));
  const idx = new Map(VERK.map((v, i) => [v.verk_nr, i]));
  const unmapped = [];
  let ekkiDone = 0;
  for (const g of groups) {
    const alls = Number(g.stakar_alls) || 0, man = Number(g.stakar_manudur) || 0, ed = Number(g.ekki_done) || 0;
    ekkiDone += ed;
    const vn = verkAf(g.category_group);
    if (!vn) { if (alls || man || ed) unmapped.push({ category_group: g.category_group, stakar_alls: alls, stakar_manudur: man, ekki_done: ed }); continue; }
    const L = lines[idx.get(vn)];
    L.groups.push(g.category_group); L.stakar_alls += alls; L.stakar_manudur += man; L.ekki_done += ed;
  }

  // ── Lokatölur: month → verk_nr → {lokatala, updated_at} ────────────────
  const lok = new Map();
  for (const r of lokRows) { if (!lok.has(r.month)) lok.set(r.month, new Map()); lok.get(r.month).set(r.verk_nr, r); }
  const vistadir = [...lok.entries()].map(([mo, mp]) => ({ month: mo, n: mp.size, updated_at: [...mp.values()].reduce((a, r) => (!a || r.updated_at > a) ? r.updated_at : a, null) }));

  // ── Skýrslan: allir mánuðir frá sept 2025 til valins mánaðar ───────────
  const manudir = [];
  for (let d = new Date(Date.UTC(2025, 8, 1)); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const mo = d.toISOString().slice(0, 7); manudir.push(mo); if (mo === month) break;
    if (manudir.length > 240) break; // varnagli
  }
  const nyjar = new Map();   // month → verk_nr → nýjar lokanir
  for (const r of manRows) {
    const vn = verkAf(r.category_group); if (!vn) continue;
    if (!nyjar.has(r.manudur)) nyjar.set(r.manudur, new Map());
    const mp = nyjar.get(r.manudur); mp.set(vn, (mp.get(vn) || 0) + (Number(r.nyjar) || 0));
  }
  const cum = new Map(VERK.map(v => [v.verk_nr, 0]));
  const prevStada = new Map(VERK.map(v => [v.verk_nr, 0]));
  const prevHeilar = new Map(VERK.map(v => [v.verk_nr, 0]));
  const skyrslaMan = [];
  for (const mo of manudir) {
    const ny = nyjar.get(mo) || new Map();
    const lm = lok.get(mo) || new Map();
    const rows = VERK.map(v => {
      const vn = v.verk_nr;
      // nýjar lokanir í Ajour í mánuðinum (≥ 0) — 2.11 í METRUM úr ummálum, ekki fjöldi skráninga
      const nyMan = v.metrar ? Math.round((raufMan.get(mo) || 0) * 100) / 100 : (ny.get(vn) || 0);
      cum.set(vn, (cum.get(vn) || 0) + nyMan);
      const ajour_cum = cum.get(vn);
      const s = lm.get(vn);
      const lokatala = s ? Number(s.lokatala) : null;
      // TILLAGA (06.10.2026): staða í lok fyrri mánaðar + nýjar lokanir mánaðarins í Ajour.
      // Áður var heildartala Ajour notuð þegar lokatölu vantaði — en lokatölurnar (Aðalskjalið)
      // eru hærri en Ajour á 2.11 og 3.1, svo ágúst 2026 sýndi −131 og −24 (lokanir ganga ekki
      // til baka). Án nokkurra lokatalna er tillagan = heildartala Ajour, eins og áður.
      const tillaga = prevStada.get(vn) + nyMan;
      const st = lokatala != null ? lokatala : tillaga;
      const stud = studull(v, mo);
      const r3 = x => Math.round(x * 1000) / 1000;   // metrar (2.11) — engin fleytitöluslæða
      const delta = r3(st - prevStada.get(vn)), delta_heilar = r3(delta * stud);
      const heilar = r3(prevHeilar.get(vn) + delta_heilar);
      prevStada.set(vn, st); prevHeilar.set(vn, heilar);
      return { verk_nr: vn, ajour_cum: Math.round(ajour_cum * 100) / 100, ny_ajour: nyMan, tillaga: Math.round(tillaga * 100) / 100, lokatala, stada: st, studull: stud, heilar, upphaed: Math.round(heilar * v.rate),
        delta, delta_heilar, upphaed_man: Math.round(delta_heilar * v.rate) };
    });
    const t = rows.reduce((a, r) => { a.stakar += r.stada; a.heilar += r.heilar; a.upphaed += r.upphaed; a.delta += r.delta; a.upphaed_man += r.upphaed_man; return a; },
      { stakar: 0, heilar: 0, upphaed: 0, delta: 0, upphaed_man: 0 });
    skyrslaMan.push({ month: mo, lines: rows, totals: t, vistad: lm.size });
  }
  const valinn = skyrslaMan[skyrslaMan.length - 1];
  for (const L of lines) { const r = valinn.lines[idx.get(L.verk_nr)]; L.lokatala = r.lokatala; L.stada = r.stada; L.heilar = r.heilar; }

  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
  return json(200, {
    month, fra, til_exclusive: til,
    vistad_at: (lok.get(month) ? [...lok.get(month).values()] : []).reduce((a, r) => (!a || r.updated_at > a) ? r.updated_at : a, null),
    vistadir_manudir: vistadir,
    lines, unmapped,
    totals: { stakar_alls: sum(lines, 'stakar_alls'), stakar_manudur: sum(lines, 'stakar_manudur'), unmapped_alls: sum(unmapped, 'stakar_alls') },
    ekki_done: ekkiDone,
    skyrsla: {
      verk: VERK.map(v => ({ verk_nr: v.verk_nr, label: v.label, rate: v.rate, fjoldi: v.target || null, full: studull(v, month) === 1, studull: studull(v, month), metrar: !!v.metrar })),
      manudir: skyrslaMan,
      reglur: 'Heild = stakar/2 nema gólf/hæðarskil (1=1); 2.2 var 1=1 til og með júlí 2026. 2.11 í metrum (ummál úr Ajour). Verð per heild m. vsk. Án lokatölu: staða fyrri mánaðar + nýjar lokanir í Ajour.',
    },
    raufar: {
      rows: raufar,
      per_man: Object.fromEntries([...raufMan.entries()].sort().map(([k, v]) => [k, Math.round(v * 100) / 100])),
      olesin: raufar.filter(r => r.done && r.metrar == null).length,
    },
  });
}

function sidastiManudur() {
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}
function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
