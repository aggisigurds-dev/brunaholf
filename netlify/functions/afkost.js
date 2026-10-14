// afkost.js — Afköst (performance) metrics for the "Afköst" tab.
// Verkefnalisti: add5560a / ea76fd48 (fyrsta útgáfa) · endursmíðað 14.10.2026 (Agnar:
// „það hefur aldrei virkað" — síðan mældi vitlausa hluti, sjá athugasemdir neðar).
//
//   GET /api/afkost[?months=6]
//     → {
//         generated_at, months,
//         daily14:   [{ date, verkbeidnir_in, verkbeidnir_done, yfirfarin, hladin, co2_hylki, uttektir, uttekt_taeki }],
//         saga14:    [{ date, skodad, hladid, thjonustad }],  saga_live_since,
//         weekly:    [{ week_start, verslun_n, verslun_kr, uttekt_n, uttekt_kr, brunakerfi_n, brunakerfi_kr, kredit_n }],
//         monthly:   [{ ym, kr, n, ras:{…kr}, thjonusta:{…kr}, voruflokkur:{…kr}, tegund:{…kr}, taeki:{yfirferd,hledsla,nytt} }],
//         skodunarmanudir: [{ ym, skyrslur, taeki, eq:{…}, reikn_skyrslur, reikn_taeki }],
//         stolpi:    [{ ar, reikningar, taeki:{yfirferd,hledsla,nytt}, kr:{yfirferd,hledsla,nytt,annad} }],
//         macro3m:   { verkbeidnir_in, verkbeidnir_done, yfirfarin, hladin, co2_hylki, uttektir, uttekt_taeki, sala_kr,
//                      prev_period:{…}, prev_period_coverage_days, prev_period_insufficient },
//         flokkar:   { thjonusta:[{key,label}], voruflokkur:[…], tegund:[…], ras:[…] }
//       }
//
// HEIMILDIR og af hverju (14.10.2026):
//   • verkbeidnir: „innkomið" = dropoff-dagur, en AÐEINS verk sem eru ekki eytt/afturkölluð
//     (107 eydd verk töldust áður með). „Klárað" = AÐEINS status 'collected' á pickup-degi —
//     121 setur pickup=í dag þegar verk er sótt; á received/ready verkum er pickup ÁÆTLAÐUR
//     dagur (dropoff + 7) og taldist áður sem klárað.
//   • verklidur: tækjalínur verkbeiðna (service-textinn segir „… hleðsla" / „… yfirferð" /
//     „CO₂ 100 gr. × N (samtals)"). Tæki teljast yfirfarin/hlaðin á sóknardegi verksins
//     (collected). CO₂-hylkin eru sér-teljari (magnið í „× N").
//   • taeki_saga: lifandi viðburðaskrá (skodad/hladid/thjonustad) — bakfyllt 12.10.2026 og
//     Slökkvitæki-appið skrifar í hana við Sótt frá og með 14.10.2026. Sýnd sem samanburður.
//   • solur: sölurás = source (pos/null → verslun, uttekt, brunakerfi). Kreditreikningar
//     (is_credit) telja EKKI sem sölur en lækka krónurnar. Línurnar (linur jsonb) flokkast í
//     þjónustuflokk, vöruflokk (vorur.flokkur gegnum product_id, annars úr textanum) og
//     tækjategund — tekjugreiningin. Línuupphæðir eru skalaðar að upphaed_an_vsk sölunnar
//     svo summan stemmi við söluna.
//   • arsskodun_report_facts / uttekt_reikningur_facts: tæki í úttektarskýrslum eftir
//     SKOÐUNARMÁNUÐI (report_year + inspect_month) — ónákvæmara en sölulínur, en segir hvenær
//     skoðað var. uttaeki.last_insp var áður notað: það er bunku-uppfært og aðeins ár-nákvæmt.
//   • reikningslestur + reikningslinur: Stólpi-reikningar 2020–2026 (þjónusta/tegund þegar
//     flokkuð) — sagan eftir árum, aðskilin frá app-sölunum (skarast maí–júlí 2026).
//
// Allar Supabase-lesningar eru síðuskiptar með Range (db-max-rows = 1000 — eldri útgáfa
// treysti á limit=5000 og fékk aldrei meira en 1000 raðir).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders },
  body: JSON.stringify(body),
});

async function sbPage(path, from, to) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${from}-${to}`, 'Range-Unit': 'items' },
  });
  if (!r.ok && r.status !== 206) throw new Error(`Supabase ${path.split('?')[0]} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function sbAll(path, pageSize = 1000, max = 20000) {
  const out = [];
  for (let from = 0; from < max; from += pageSize) {
    const rows = await sbPage(path, from, from + pageSize - 1);
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

const isoDay = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const mondayOf = d => { const x = new Date(d); const dow = (x.getUTCDay() + 6) % 7; return addDays(x, -dow); };
const ymOf = s => String(s || '').slice(0, 7);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round = n => Math.round(n);

// ── Flokkun sölulína ────────────────────────────────────────────────────────────
const THJONUSTA = [
  ['yfirferd',   'Yfirferð tækja'],
  ['hledsla',    'Hleðsla tækja'],
  ['co2',        'CO₂ áfylling'],
  ['nytt',       'Ný slökkvitæki'],
  ['brunakerfi', 'Brunakerfi'],
  ['akstur',     'Akstur og skýrslugerð'],
  ['vinna',      'Vinna og uppsetning'],
  ['leiga',      'Leiga'],
  ['vorur',      'Vörur og varahlutir'],
  ['annad',      'Annað'],
];
const VORUFLOKKUR = [
  ['Slökkvitæki', 'Slökkvitæki'],
  ['Þjónusta', 'Þjónusta'],
  ['Brunakerfi', 'Brunakerfi'],
  ['Brunaslöngurhjól', 'Brunaslöngur'],
  ['Skynjarar og rafhlöður', 'Skynjarar og rafhlöður'],
  ['Skilti, ljós og miðar', 'Skilti, ljós og miðar'],
  ['Varahlutir', 'Varahlutir'],
  ['Slökkvitækjafestingar', 'Festingar og skápar'],
  ['Eldvarnir', 'Eldvarnir'],
  ['Sjúkratöskur', 'Sjúkratöskur'],
  ['Vinna og akstur', 'Vinna og akstur'],
  ['Leiga', 'Leiga'],
  ['Ýmsar vörur', 'Ýmsar vörur'],
  ['Annað', 'Annað'],
];
const TEGUND = [
  ['lettvatn', 'Léttvatn'], ['duft6', 'Duft 6 kg'], ['duft2', 'Duft 2 kg'], ['duft12', 'Duft 9–12 kg'],
  ['co2_5', 'CO₂ 5 kg'], ['co2_2', 'CO₂ 2 kg'], ['co2_kg', 'CO₂ kg/hylki'], ['abf', 'Froða ABF'],
  ['slanga', 'Brunaslöngur'], ['reyk', 'Reyk-/hitaskynjarar'], ['annad', 'Annað'],
];
const RAS = [['verslun', 'Í verslun'], ['uttekt', 'Í þjónustuferðum'], ['brunakerfi', 'Brunakerfi']];

const RX = {
  hledsla: /hle[ðd]sl|[áa]fylling/i,
  co2hylki: /co[₂2]\s*100\s*gr|co[₂2]\s*byrjunargjald/i,
  yfirferd: /yfirfer|sko[ðd]un|sko[ðd]a/i,
  nytt: /^n[ýy]tt\s*·|slökkvitæki$|slokkvitaeki$|^slökkvitæki\s/i,
  akstur: /^akstur|sk[ýy]rslu|vottun|samantekt/i,
  vinna: /^vinna|uppsetning|t[íi]mavinna|r[áa]ðgj[öo]f|forritun|tenging|skipta um|b[æae]ta vi[ðd]/i,
  leiga: /^leiga/i,
  brunakerfi: /brunakerfi|brunavi[ðd]v|a[ðd]alst[öo]ð|bj[öo]llu|s[íi]renu|skynjur|hur[ðd]asegul|brunast[öo]ð|handbo[ðd]/i,
  afsl: /[−-]\s*(\d+)\s*%\s*afsl/i,
  magn: /×\s*(\d+)/,
};
function tegundAf(desc) {
  const d = String(desc || '');
  if (/l[ée]ttvatn/i.test(d)) return 'lettvatn';
  if (/duft\s*(9|12)/i.test(d)) return 'duft12';
  if (/duft\s*2\s*kg|2\s*kg\.?\s*duft/i.test(d)) return 'duft2';
  if (/duft/i.test(d)) return 'duft6';
  if (/co[₂2]\s*5\s*kg|5\s*kg\s*co[₂2]|kols[ýy]ru.*5/i.test(d)) return 'co2_5';
  if (/co[₂2]\s*2\s*kg|2\s*kg\s*co[₂2]|kols[ýy]ru.*2\s*kg/i.test(d)) return 'co2_2';
  if (/co[₂2]|kols[ýy]r/i.test(d)) return 'co2_kg';
  if (/abf|fro[ðd]/i.test(d)) return 'abf';
  if (/slang|slöng|slong/i.test(d)) return 'slanga';
  if (/reyk|hitaskynj|skynjar/i.test(d)) return 'reyk';
  return 'annad';
}
function thjonustaAf(desc, type, vflokkur, saleSource) {
  const d = String(desc || '');
  if (saleSource === 'brunakerfi' && !RX.hledsla.test(d) && !RX.yfirferd.test(d)) return 'brunakerfi';
  if (RX.co2hylki.test(d)) return 'co2';
  if (RX.hledsla.test(d)) return 'hledsla';
  if (RX.yfirferd.test(d) && !RX.brunakerfi.test(d)) return 'yfirferd';
  if (RX.yfirferd.test(d)) return 'brunakerfi';
  if (RX.brunakerfi.test(d) || vflokkur === 'Brunakerfi') return 'brunakerfi';
  if (RX.leiga.test(d) || vflokkur === 'Leiga') return 'leiga';
  if (RX.akstur.test(d)) return 'akstur';
  if (RX.vinna.test(d) || vflokkur === 'Vinna og akstur') return 'vinna';
  if (RX.nytt.test(d) || vflokkur === 'Slökkvitæki') return 'nytt';
  if (vflokkur && vflokkur !== 'Þjónusta' && vflokkur !== 'Annað') return 'vorur';
  if (type === 'product') return 'vorur';
  return 'annad';
}
function voruflokkurAf(desc, vflokkur, thj) {
  if (vflokkur) return vflokkur;
  const d = String(desc || '');
  if (thj === 'yfirferd' || thj === 'hledsla' || thj === 'co2') return 'Þjónusta';
  if (thj === 'nytt') return 'Slökkvitæki';
  if (thj === 'brunakerfi') return 'Brunakerfi';
  if (thj === 'akstur' || thj === 'vinna') return 'Vinna og akstur';
  if (thj === 'leiga') return 'Leiga';
  if (/skilti|mi[ðd]i|l[íi]mmi[ðd]|v-merki/i.test(d)) return 'Skilti, ljós og miðar';
  if (/skynjar|rafhl/i.test(d)) return 'Skynjarar og rafhlöður';
  if (/slöng|slong|st[úu]t/i.test(d)) return 'Brunaslöngurhjól';
  if (/festing|sk[áa]p/i.test(d)) return 'Slökkvitækjafestingar';
  if (/teppi/i.test(d)) return 'Eldvarnir';
  if (/sj[úu]kra/i.test(d)) return 'Sjúkratöskur';
  return 'Annað';
}
// Þjónustutexti verkliðar → hvað var gert við tækið (sama orðaforði og taeki_saga).
function verklidurFlokkun(service) {
  const s = String(service || '');
  const out = { yfirfarin: 0, hladin: 0, co2_hylki: 0 };
  if (RX.co2hylki.test(s)) { const m = RX.magn.exec(s); out.co2_hylki = m ? num(m[1]) : 1; return out; }
  if (RX.hledsla.test(s)) out.hladin = 1;
  if (RX.yfirferd.test(s)) out.yfirfarin = 1;
  return out;
}

exports.handler = async (event) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vars missing' });
  try {
    const qs = (event && event.queryStringParameters) || {};
    const months = Math.min(24, Math.max(3, parseInt(qs.months, 10) || 6));
    const now = new Date();
    const day0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const since14 = addDays(day0, -13);
    const since3m = addDays(day0, -90);
    const sincePrev3m = addDays(day0, -180);
    const monthsStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const sinceAll = monthsStart < sincePrev3m ? monthsStart : sincePrev3m;

    const [verkbeidnir, solur, vorur, saga, arsFacts, reiknFacts, stolpiHaus, stolpiLinur] = await Promise.all([
      sbAll(`verkbeidnir?select=id,num,status,dropoff,pickup,created_at&or=(dropoff.gte.${isoDay(sinceAll)},pickup.gte.${isoDay(sinceAll)})&order=id`),
      sbAll(`solur?select=id,source,samtals,upphaed_an_vsk,status,is_credit,created_at,linur&status=eq.final&created_at=gte.${sinceAll.toISOString()}&order=id`),
      sbAll(`vorur?select=id,flokkur&order=id`),
      sbAll(`taeki_saga?select=dags,vidburdur,created_by,heimild&dags=gte.${isoDay(sinceAll)}&order=id`),
      sbAll(`arsskodun_report_facts?select=report_year,inspect_month,total_devices,equipment&parse_ok=eq.true&report_year=gte.${now.getUTCFullYear() - 2}&order=report_year`),
      sbAll(`uttekt_reikningur_facts?select=invoice_year,inspect_month,total_devices&invoice_year=gte.${now.getUTCFullYear() - 2}&order=id`),
      sbAll(`reikningslestur?select=reikningur_nr,dags,ar,kredit&order=reikningur_nr`),
      sbAll(`reikningslinur?select=reikningur_nr,magn,upphaed,thjonusta,tegund&order=id`),
    ]);
    const jobIds = verkbeidnir.map(v => v.id);
    const verklidur = jobIds.length
      ? await sbAll(`verklidur?select=id,job_id,service,status&job_id=gte.${Math.min(...jobIds)}&order=id`)
      : [];

    // ── Verkbeiðnir: hreinsun + afleidd gildi ───────────────────────────────
    const DEAD = new Set(['eytt', 'cancelled', 'deleted']);
    const jobs = verkbeidnir.filter(v => !DEAD.has(String(v.status || '').toLowerCase()));
    const jobById = new Map(jobs.map(j => [j.id, j]));
    const inDay = {}, doneDay = {}, devDay = {};
    jobs.forEach(j => {
      if (j.dropoff) inDay[j.dropoff] = (inDay[j.dropoff] || 0) + 1;
      if (j.status === 'collected' && j.pickup) doneDay[j.pickup] = (doneDay[j.pickup] || 0) + 1;
    });
    verklidur.forEach(l => {
      const j = jobById.get(l.job_id);
      if (!j || j.status !== 'collected' || !j.pickup) return;
      if (['broken', 'eytt'].includes(String(l.status || ''))) return;
      const f = verklidurFlokkun(l.service);
      const d = devDay[j.pickup] || (devDay[j.pickup] = { yfirfarin: 0, hladin: 0, co2_hylki: 0 });
      d.yfirfarin += f.yfirfarin; d.hladin += f.hladin; d.co2_hylki += f.co2_hylki;
    });

    // ── taeki_saga: lifandi viðburðaskrá ────────────────────────────────────
    const sagaDay = {};
    let sagaLiveSince = null;
    saga.forEach(r => {
      const d = sagaDay[r.dags] || (sagaDay[r.dags] = { skodad: 0, hladid: 0, thjonustad: 0 });
      if (d[r.vidburdur] != null) d[r.vidburdur] += 1;
      const live = r.created_by !== 'claude' && !/^bakfylling/i.test(String(r.heimild || ''));
      if (live && (!sagaLiveSince || r.dags < sagaLiveSince)) sagaLiveSince = r.dags;
    });

    // ── Sölur: línur flokkaðar ──────────────────────────────────────────────
    const vFlokkur = new Map(vorur.map(v => [String(v.id), v.flokkur || null]));
    const sales = solur.map(s => {
      const src = s.source === 'uttekt' || s.source === 'brunakerfi' ? s.source : 'verslun';
      const lines = Array.isArray(s.linur) ? s.linur : [];
      let parsed = lines.map(e => {
        const desc = e && e.desc != null ? String(e.desc) : '';
        const qty = num(e && e.qty);
        const up = num(e && e.unit_price_ex_vat);
        let disc = num(e && e.discount_pct);
        if (!disc) { const m = RX.afsl.exec(desc); if (m) disc = num(m[1]); }
        const vflokkur = vFlokkur.get(String(e && e.product_id != null ? e.product_id : '')) || null;
        const thj = thjonustaAf(desc, e && e.type, vflokkur, s.source);
        return { desc, qty, kr: qty * up * (1 - disc / 100), thj, vfl: voruflokkurAf(desc, vflokkur, thj), teg: tegundAf(desc) };
      });
      // Skala línurnar að upphaed_an_vsk svo summan stemmi við söluna.
      const sumLines = parsed.reduce((a, l) => a + l.kr, 0);
      const target = s.upphaed_an_vsk != null ? num(s.upphaed_an_vsk) : sumLines;
      if (sumLines && target && Math.abs(sumLines - target) > 1) {
        const k = target / sumLines; parsed = parsed.map(l => ({ ...l, kr: l.kr * k }));
      } else if (!sumLines && target) {
        parsed = [{ desc: '(engar línur)', qty: 0, kr: target, thj: src === 'brunakerfi' ? 'brunakerfi' : 'annad', vfl: 'Annað', teg: 'annad' }];
      }
      return { id: s.id, src, t: new Date(s.created_at), day: String(s.created_at).slice(0, 10), ym: ymOf(s.created_at),
        credit: !!s.is_credit || num(s.samtals) < 0, samtals: num(s.samtals), exvat: target, lines: parsed };
    });

    // ── 14 daga ────────────────────────────────────────────────────────────
    const daily14 = [], saga14 = [];
    for (let i = 0; i < 14; i++) {
      const dISO = isoDay(addDays(since14, i));
      const dev = devDay[dISO] || { yfirfarin: 0, hladin: 0, co2_hylki: 0 };
      const utt = sales.filter(s => s.day === dISO && s.src !== 'verslun' && !s.credit);
      const uttTaeki = utt.reduce((a, s) => a + s.lines.filter(l => ['yfirferd', 'hledsla', 'nytt'].includes(l.thj)).reduce((b, l) => b + Math.max(0, l.qty), 0), 0);
      daily14.push({ date: dISO, verkbeidnir_in: inDay[dISO] || 0, verkbeidnir_done: doneDay[dISO] || 0,
        yfirfarin: dev.yfirfarin, hladin: dev.hladin, co2_hylki: dev.co2_hylki, uttektir: utt.length, uttekt_taeki: round(uttTaeki) });
      const sg = sagaDay[dISO] || { skodad: 0, hladid: 0, thjonustad: 0 };
      saga14.push({ date: dISO, ...sg });
    }

    // ── Vikur (síðustu ~13) ─────────────────────────────────────────────────
    const weekStart0 = mondayOf(since3m);
    const weekly = [];
    for (let w = 0; w < 14; w++) {
      const ws = addDays(weekStart0, w * 7), we = addDays(ws, 7);
      if (ws > day0) break;
      const rows = sales.filter(s => s.t >= ws && s.t < we);
      const agg = { week_start: isoDay(ws), verslun_n: 0, verslun_kr: 0, uttekt_n: 0, uttekt_kr: 0, brunakerfi_n: 0, brunakerfi_kr: 0, kredit_n: 0 };
      rows.forEach(s => { if (s.credit) agg.kredit_n++; else agg[s.src + '_n']++; agg[s.src + '_kr'] += s.samtals; });
      ['verslun_kr', 'uttekt_kr', 'brunakerfi_kr'].forEach(k => { agg[k] = round(agg[k]); });
      weekly.push(agg);
    }

    // ── Mánuðir: tekjugreining ─────────────────────────────────────────────
    const monthly = [];
    for (let m = 0; m < months; m++) {
      const d = new Date(Date.UTC(monthsStart.getUTCFullYear(), monthsStart.getUTCMonth() + m, 1));
      const ym = d.toISOString().slice(0, 7);
      const rows = sales.filter(s => s.ym === ym);
      const M = { ym, n: 0, kredit_n: 0, kr: 0, kr_exvat: 0, ras: {}, thjonusta: {}, voruflokkur: {}, tegund: {}, taeki: { yfirferd: 0, hledsla: 0, nytt: 0, co2_hylki: 0 } };
      rows.forEach(s => {
        if (s.credit) M.kredit_n++; else M.n++;
        M.kr += s.samtals; M.kr_exvat += s.exvat;
        M.ras[s.src] = (M.ras[s.src] || 0) + s.exvat;
        s.lines.forEach(l => {
          M.thjonusta[l.thj] = (M.thjonusta[l.thj] || 0) + l.kr;
          M.voruflokkur[l.vfl] = (M.voruflokkur[l.vfl] || 0) + l.kr;
          if (['yfirferd', 'hledsla', 'co2', 'nytt'].includes(l.thj)) M.tegund[l.teg] = (M.tegund[l.teg] || 0) + l.kr;
          if (l.thj === 'co2') M.taeki.co2_hylki += Math.max(0, l.qty);
          else if (M.taeki[l.thj] != null) M.taeki[l.thj] += Math.max(0, l.qty);
        });
      });
      ['kr', 'kr_exvat'].forEach(k => { M[k] = round(M[k]); });
      ['ras', 'thjonusta', 'voruflokkur', 'tegund'].forEach(k => Object.keys(M[k]).forEach(x => { M[k][x] = round(M[k][x]); }));
      Object.keys(M.taeki).forEach(k => { M.taeki[k] = round(M.taeki[k]); });
      monthly.push(M);
    }

    // ── Úttektarskýrslur eftir skoðunarmánuði ──────────────────────────────
    const skMap = {};
    const skGet = ym => skMap[ym] || (skMap[ym] = { ym, skyrslur: 0, taeki: 0, eq: {}, reikn_skyrslur: 0, reikn_taeki: 0 });
    arsFacts.forEach(f => {
      if (!f.inspect_month || !f.report_year) return;
      const ym = `${f.report_year}-${String(f.inspect_month).padStart(2, '0')}`;
      const s = skGet(ym); s.skyrslur++; s.taeki += num(f.total_devices);
      if (f.equipment && typeof f.equipment === 'object') Object.entries(f.equipment).forEach(([k, v]) => { s.eq[k] = (s.eq[k] || 0) + num(v); });
    });
    reiknFacts.forEach(f => {
      if (!f.inspect_month || !f.invoice_year) return;
      const s = skGet(`${f.invoice_year}-${String(f.inspect_month).padStart(2, '0')}`);
      s.reikn_skyrslur++; s.reikn_taeki += num(f.total_devices);
    });
    const skFrom = `${now.getUTCFullYear() - 1}-01`, skTo = now.toISOString().slice(0, 7);
    const skodunarmanudir = Object.values(skMap).filter(s => s.ym >= skFrom && s.ym <= skTo).sort((a, b) => a.ym.localeCompare(b.ym));

    // ── Stólpi-sagan eftir árum ────────────────────────────────────────────
    const stHaus = new Map(stolpiHaus.map(h => [h.reikningur_nr, h]));
    const stMap = {};
    stolpiLinur.forEach(l => {
      const h = stHaus.get(l.reikningur_nr); if (!h || h.kredit) return;
      const ar = h.ar || (h.dags ? Number(String(h.dags).slice(0, 4)) : null); if (!ar) return;
      const y = stMap[ar] || (stMap[ar] = { ar, reikningar: new Set(), taeki: { yfirferd: 0, hledsla: 0, nytt: 0 }, kr: { yfirferd: 0, hledsla: 0, nytt: 0, annad: 0 } });
      y.reikningar.add(l.reikningur_nr);
      const t = ['yfirferd', 'hledsla', 'nytt'].includes(l.thjonusta) ? l.thjonusta : 'annad';
      if (t !== 'annad') y.taeki[t] += num(l.magn);
      y.kr[t] += num(l.upphaed);
    });
    const stolpi = Object.values(stMap).sort((a, b) => a.ar - b.ar).map(y => ({ ar: y.ar, reikningar: y.reikningar.size,
      taeki: Object.fromEntries(Object.entries(y.taeki).map(([k, v]) => [k, round(v)])), kr: Object.fromEntries(Object.entries(y.kr).map(([k, v]) => [k, round(v)])) }));

    // ── 3 mánaða spjöld + fyrra tímabil ────────────────────────────────────
    function periodSummary(from, to) {
      const f = isoDay(from), t = isoDay(to);
      const inJobs = jobs.filter(v => v.dropoff && v.dropoff >= f && v.dropoff < t).length;
      const doneJobs = jobs.filter(v => v.status === 'collected' && v.pickup && v.pickup >= f && v.pickup < t).length;
      const dev = { yfirfarin: 0, hladin: 0, co2_hylki: 0 };
      Object.entries(devDay).forEach(([d, v]) => { if (d >= f && d < t) { dev.yfirfarin += v.yfirfarin; dev.hladin += v.hladin; dev.co2_hylki += v.co2_hylki; } });
      const rows = sales.filter(s => s.t >= from && s.t < to);
      const utt = rows.filter(s => s.src !== 'verslun' && !s.credit);
      const uttTaeki = utt.reduce((a, s) => a + s.lines.filter(l => ['yfirferd', 'hledsla', 'nytt'].includes(l.thj)).reduce((b, l) => b + Math.max(0, l.qty), 0), 0);
      return { verkbeidnir_in: inJobs, verkbeidnir_done: doneJobs, ...dev, uttektir: utt.length, uttekt_taeki: round(uttTaeki),
        solur_n: rows.filter(s => !s.credit).length, sala_kr: round(rows.reduce((a, s) => a + s.samtals, 0)) };
    }
    const macro3m = periodSummary(since3m, day0);
    macro3m.prev_period = periodSummary(sincePrev3m, since3m);
    let earliest = null;
    jobs.forEach(v => { const d = v.dropoff || v.pickup; if (d && (!earliest || d < earliest)) earliest = d; });
    sales.forEach(s => { if (!earliest || s.day < earliest) earliest = s.day; });
    const earliestD = earliest ? new Date(earliest + 'T00:00:00Z') : sincePrev3m;
    const prevStart = earliestD > sincePrev3m ? earliestD : sincePrev3m;
    macro3m.prev_period_coverage_days = Math.max(0, Math.round((since3m - prevStart) / 86400000));
    macro3m.prev_period_insufficient = macro3m.prev_period_coverage_days < 45;

    return json(200, {
      generated_at: now.toISOString(), months,
      daily14, saga14, saga_live_since: sagaLiveSince,
      weekly, monthly, skodunarmanudir, stolpi, macro3m,
      flokkar: {
        thjonusta: THJONUSTA.map(([key, label]) => ({ key, label })),
        voruflokkur: VORUFLOKKUR.map(([key, label]) => ({ key, label })),
        tegund: TEGUND.map(([key, label]) => ({ key, label })),
        ras: RAS.map(([key, label]) => ({ key, label })),
      },
      counts: { verkbeidnir: jobs.length, verklidur: verklidur.length, solur: sales.length, taeki_saga: saga.length, stolpi_reikningar: stolpiHaus.length },
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
