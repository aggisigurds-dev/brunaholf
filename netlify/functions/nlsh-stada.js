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
// REGLUR BLAÐSINS (úr júlí-xlsx Agnars, 02.09.2026): flestir liðir 2 stakar = 1 heild;
// 2.2 (kragi) og 1.2 eru 1 = 1; 2.11 og 3.1 eru METRAR (handslegin tala). ATH: þetta
// víkur frá nlsh-uppgjor.js/nlsh-dashboard.js sem hafa `full` á 1.2 OG 1.3 en ekki 2.2
// — það er ÁÆTLUNIN í hub-inum, þetta er SKÝRSLAN; misræmið er skráð, Agnar sker úr.
// Verð og kortlagning flokkur→verkliður koma úr VERK í nlsh-uppgjor.js (einn staður).

const { VERK, NLSH_NAMES } = require('./nlsh-uppgjor.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' });
const FYRSTI_MANUDUR = '2025-09';   // verkið hófst sept 2025 — fyrsta dálkur blaðsins

// Fjöldi í samningi (sami og nlsh-dashboard.js target) + reglur blaðsins.
const SKYRSLA = {
  '2.1': { fjoldi: 600 }, '2.2': { fjoldi: 600, full: true }, '2.3': { fjoldi: 100 },
  '2.4': { fjoldi: 800 }, '2.5': { fjoldi: 1100 }, '2.6': { fjoldi: 350 }, '2.7': { fjoldi: 100 },
  '2.8': { fjoldi: 600 }, '2.9': { fjoldi: 600 }, '2.10': { fjoldi: 109 },
  '2.11': { fjoldi: 102, metrar: true },
  '1.1': { fjoldi: 50 }, '1.2': { fjoldi: 100, full: true }, '1.3': { fjoldi: 25 },
  '3.1': { fjoldi: 768, metrar: true },
};
const VERK_NR = new Set(VERK.map(v => v.verk_nr));
const heilarAf = (verk_nr, stada) => { const r = SKYRSLA[verk_nr] || {}; return (r.metrar || r.full) ? stada : stada / 2; };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') {
    let p = {};
    try { p = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Ógilt JSON' }); }
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
      const metrar = !!(SKYRSLA[verk_nr] || {}).metrar;
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

  let groups, manRows, lokRows;
  try {
    const [g, mr, lr] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/nlsh_stada`, { method: 'POST', headers: H(), body: JSON.stringify({ p_names: NLSH_NAMES, p_fra: fra, p_til: til }) }),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/nlsh_stada_manudir`, { method: 'POST', headers: H(), body: JSON.stringify({ p_names: NLSH_NAMES, p_til: til }) }),
      fetch(`${SUPABASE_URL}/rest/v1/nlsh_manadarlok?select=month,verk_nr,lokatala,athugasemd,updated_at&order=month`, { headers: H() }),
    ]);
    for (const [r, n] of [[g, 'nlsh_stada'], [mr, 'nlsh_stada_manudir'], [lr, 'lokatölur']]) {
      if (!r.ok) throw new Error(`${n}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    [groups, manRows, lokRows] = await Promise.all([g.json(), mr.json(), lr.json()]);
  } catch (e) { return json(502, { error: e.message }); }

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
      cum.set(vn, (cum.get(vn) || 0) + (ny.get(vn) || 0));
      const ajour_cum = cum.get(vn);
      const s = lm.get(vn);
      const lokatala = s ? Number(s.lokatala) : null;
      const st = lokatala != null ? lokatala : ajour_cum;
      const heilar = heilarAf(vn, st);
      const delta = st - prevStada.get(vn), delta_heilar = heilar - prevHeilar.get(vn);
      prevStada.set(vn, st); prevHeilar.set(vn, heilar);
      return { verk_nr: vn, ajour_cum, lokatala, stada: st, heilar, upphaed: Math.round(heilar * v.rate),
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
      verk: VERK.map(v => ({ verk_nr: v.verk_nr, label: v.label, rate: v.rate, fjoldi: (SKYRSLA[v.verk_nr] || {}).fjoldi || null,
        full: !!(SKYRSLA[v.verk_nr] || {}).full, metrar: !!(SKYRSLA[v.verk_nr] || {}).metrar })),
      manudir: skyrslaMan,
      reglur: 'Heild = stakar/2 nema 2.2 og 1.2 (1=1); 2.11 og 3.1 eru metrar. Verð per heild m. vsk (VERK í nlsh-uppgjor.js).',
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
