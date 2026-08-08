// fjarmal-yfirlit.js — sameinuð fjármála-yfirsýn þvert á Slökkvitæki + Brunahólf.
// Ein síða (fjarmalyfirlit.html + Fjármál-appið) sem safnar saman „peningapípunni":
//
//   A) Slökkvitæki-kröfur (úr `solur`, greitt_med='reikningur', óuppgert) —
//      sama skilgreining og Kröfu yfirlit (patch 166):
//        · Þessi mánuður · Eldri ógreitt · Heildarkröfur (millisamtala)
//        · Ógreiddar í Payday (dk_invoice_id sett) · Ósendar kröfur (aldrei sendar)
//   B) Raun-ógreitt í Payday hjá Brunahólf (úr `invoices`, óborgaðir, sama tier-1
//      regla og krofu-yfirlit-bru: non-credit, ekki greitt, ekki falið).
//   C) Óinnheimt eldra:
//        · Eldri Tímavera-mánuðir (áunnið: klst fyrri mánaða × dagvinnutaxti m/vsk)
//        · Ósendir reikningar hjá Brunahólf (invoice_drafts, síðustu 3 mán, ósend)
//   D) Áunnið Tímavera-tímagjald ÞESSA mánaðar (klst × dagvinnutaxti m/vsk).
//
//   grand_total = A.heildar + B + C(osendar) + D
//   (A.heildar inniheldur nú þegar payday+osendar undirmengin — ekki tvítalið.)
//   C(timavera_eldri) er reiknað og skilað í svarinu til upplýsinga en EKKI
//   summað inn — brúttó tala sem dregur ekki frá þegar rukkað, gaf ranga
//   (of háa) heildar-pípu (sjá verkefnalisti 2026-08-08).
//
// GET /api/fjarmal-yfirlit[?month=YYYY-MM]  → JSON (service role, read-only).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Dagvinnutaxti (sjálfgefinn) — 9.951 kr án vsk × 1,24 = m/vsk. Sama grunntala og
// „Áætlað unnið · mánuður" í Gerð Reikninga. Hægt að yfirskrifa með ?taxti=.
const DAGVINNA_MVSK_DEFAULT = Math.round(9951 * 1.24); // 12.339
// Tímar/reikningar sem EKKI eru rukkanlegir sem TÍMAGJALD:
//  · Slökkvitæki-innri + „Brunahólf almennt"/„work at home" (innri yfirbygging)
//  · Gata-verkefni sem eru rukkuð gegnum AJOUR (hola × taxti), EKKI tímagjald:
//    Landsspítalinn/NLSH, Dalvegur 30 og Heklureitur — annars tvítalið á móti
//    Ajour-tekjum / drögum.
//  · frí/orlof/veikindi.
const NON_BILLABLE = /sl[oö]kkvit|landssp[ií]|nlsh|hringbraut|dalveg|heklu|almennt|work.?at.?home|heiman|fr[ií]\b|orlof|veik|p[aá]ska|jó?l|innr[ií]/i;

function sbHeaders() { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }; }
const digits = (s) => String(s || '').replace(/\D/g, '');
const lc = (s) => String(s || '').trim().toLowerCase();

// Sótt allt með Range-blaðsíðun (PostgREST hámark 1000 per kall).
async function sbAll(table, qs) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { ...sbHeaders(), Range: `${from}-${from + 999}`, 'Range-Unit': 'items', Prefer: 'count=exact' },
    });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
    if (from > 60000) break;
  }
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const qp = event.queryStringParameters || {};
  const now = new Date();
  const month = /^\d{4}-\d{2}$/.test(qp.month || '') ? qp.month : ymOf(now);
  const taxti = +qp.taxti > 0 ? Math.round(+qp.taxti) : DAGVINNA_MVSK_DEFAULT;
  const mStart = month + '-01';
  const mEnd = ymOf(addMonths(new Date(month + '-01T00:00:00Z'), 1)) + '-01';

  const warnings = [];
  let solur = [], invoices = [], drafts = [], meta = [], tv = [], verk = [], fjLive = [];
  try {
    solur = await sbAll('solur', 'select=samtals,greitt_med,paid_at,krafa_sent_at,invoiced_at,dk_invoice_id,is_credit,created_at,status,num,customer_nafn&greitt_med=eq.reikningur');
  } catch (e) { warnings.push('solur lestur mistókst — Slökkvitæki-kröfur gætu vantað: ' + e.message); }
  try {
    invoices = await sbAll('invoices', 'select=upphaed_total,hofudstoll,status,source,tilvisun,id,kt_greidanda,customer_name');
  } catch (e) { warnings.push('invoices lestur mistókst — Brunahólf Payday-ógreitt gæti vantað: ' + e.message); }
  try {
    drafts = await sbAll('invoice_drafts', 'select=worksite_name,work_month,total_m_vsk');
  } catch (e) { warnings.push('invoice_drafts lestur mistókst — ósendir reikningar gætu vantað'); }
  try {
    meta = await sbAll('krofur_yfirlit_meta', 'select=inv_key,hidden,paid');
  } catch (e) { /* meta valfrjálst */ }
  try {
    // Tímavera: núverandi mánuður + 4 mánuðir á undan (nóg fyrir „eldra"-áunnið).
    const from = ymOf(addMonths(new Date(month + '-01T00:00:00Z'), -4)) + '-01';
    tv = await sbAll('timavera_entries', `select=date,hours,project&date=gte.${from}&date=lt.${mEnd}`);
  } catch (e) { warnings.push('timavera_entries lestur mistókst — áunnið tímagjald gæti vantað'); }
  try {
    // Verkstæðið + Afgreiðslan (ósk Agnars 8.8.): opin verk beint úr verkbeidnir.
    verk = await sbAll('verkbeidnir', 'select=id,num,status,customer,verd&status=in.(received,inprogress,ready)');
  } catch (e) { warnings.push('verkbeidnir lestur mistókst — verkstæði/afgreiðsla gæti vantað: ' + e.message); }
  try {
    // Skýrslur í vinnslu: reiknað CLIENT-megin í slokkvitaeki-appinu (patch 304 —
    // verðvélin (153) býr þar; endursmíði hér væri drift-gildra) og gefið út í
    // fjarmal_live. Hér er talan aðeins LESIN.
    fjLive = await sbAll('fjarmal_live', 'select=key,kr,n,n2,list,updated_at');
  } catch (e) { warnings.push('fjarmal_live lestur mistókst — skýrslur í vinnslu gæti vantað'); }

  // ── A) Slökkvitæki-kröfur ────────────────────────────────────────────────
  const A = { thessi_manudur: n0(), eldri: n0(), heildar: n0(), ogreitt_payday: n0(), osendar: n0() };
  for (const s of solur) {
    if (s.paid_at) continue;
    if (s.is_credit) continue;
    if (s.status && !['final', 'sent'].includes(lc(s.status)) && lc(s.status) !== '') continue; // sleppa void/draft
    const amt = +s.samtals || 0;
    if (amt <= 0) continue;
    const inMonth = (s.created_at || '') >= mStart && (s.created_at || '') < mEnd;
    const num = s.num != null ? String(s.num) : '';
    const item = { label: s.customer_nafn || num || '—', sub: num, kr: Math.round(amt) };
    add(A.heildar, amt, item);
    add(inMonth ? A.thessi_manudur : A.eldri, amt, item);
    if (s.dk_invoice_id) add(A.ogreitt_payday, amt, item);
    if (!s.krafa_sent_at && !s.invoiced_at && !s.dk_invoice_id) add(A.osendar, amt, item);
  }

  // ── B) Brunahólf Payday-ógreitt (tier-1) ─────────────────────────────────
  const metaBy = new Map(meta.map((m) => [m.inv_key, m]));
  const PAID = new Set(['greitt', 'paid', 'greiddur', 'greidd']);
  const CREDIT = new Set(['kredit', 'kreditfært', 'credit', 'cancelled', 'ógilt']);
  const B = n0();
  for (const r of invoices) {
    const st = lc(r.status);
    const amt = +r.upphaed_total || +r.hofudstoll || 0;
    if (amt <= 0 || CREDIT.has(st)) continue;
    const mt = metaBy.get(`${r.source || 'x'}|${r.tilvisun || r.id}`) || {};
    if (PAID.has(st) || mt.paid) continue;
    if (mt.hidden) continue;
    add(B, amt, { label: r.customer_name || '—', sub: r.tilvisun != null ? String(r.tilvisun) : '', kr: Math.round(amt) });
  }

  // ── C1) Ósendir reikningar hjá Brunahólf (invoice_drafts, síðustu 3 mán) ──
  const cutoff = ymOf(addMonths(now, -3));
  const C_osendar = n0();
  for (const d of drafts) {
    const wm = String(d.work_month || '');
    const amt = +d.total_m_vsk || 0;
    if (amt <= 0 || wm < cutoff) continue;
    if (NON_BILLABLE.test(d.worksite_name || '')) continue; // sleppa innri + Ajour-verkefnum (annars tvítalið)
    if ((metaBy.get(`draftinv|${d.worksite_name}|${wm}`) || {}).paid) continue;
    add(C_osendar, amt, { label: d.worksite_name || '—', sub: wm, kr: Math.round(amt) });
  }

  // ── C2/D) Tímavera-áunnið (klst × taxti) — rukkanlegir verkstaðir ─────────
  const tvByMonth = {}; // 'YYYY-MM' → klst
  const tvByMonthProj = {}; // 'YYYY-MM' → { project → klst }
  for (const e of tv) {
    if (NON_BILLABLE.test(e.project || '')) continue;
    const ym = String(e.date || '').slice(0, 7);
    if (!ym) continue;
    const h = +e.hours || 0;
    tvByMonth[ym] = (tvByMonth[ym] || 0) + h;
    const proj = String(e.project || '—').trim() || '—';
    (tvByMonthProj[ym] || (tvByMonthProj[ym] = {}))[proj] = (tvByMonthProj[ym][proj] || 0) + h;
  }
  // Per-project listi mánaðar (klst × taxti), raðað eftir kr, cap 300.
  const projList = (ym) => {
    const m = tvByMonthProj[ym] || {};
    const list = Object.keys(m).map((p) => ({ label: p, sub: (Math.round(m[p] * 100) / 100) + ' klst', kr: Math.round(m[p] * taxti) }));
    list.sort((a, b) => b.kr - a.kr);
    return list.length > 300 ? list.slice(0, 300) : list;
  };
  const D = { klst: Math.round((tvByMonth[month] || 0) * 100) / 100, kr: Math.round((tvByMonth[month] || 0) * taxti), list: projList(month) };
  const tvEldriMonths = Object.keys(tvByMonth).filter((m) => m < month).sort();
  const timavera_eldri = {
    klst: Math.round(tvEldriMonths.reduce((s, m) => s + tvByMonth[m], 0) * 100) / 100,
    kr: Math.round(tvEldriMonths.reduce((s, m) => s + tvByMonth[m] * taxti, 0)),
    per_month: tvEldriMonths.map((m) => ({ month: m, klst: Math.round(tvByMonth[m] * 100) / 100, kr: Math.round(tvByMonth[m] * taxti), list: projList(m) })),
  };

  // ── A3) Verkstæðið (Verkröð) + Afgreiðslan (tilbúið ósótt) ────────────────
  // Verk = verkbeidnir; tæki = lifandi verklidur (status≠'eytt' — sama regla og
  // Verkröðin telur, patch 78). Virði per verk: samtals á tengdu sölunni
  // (num án -V-viðskeytis, sama parent-regla og pickup-checkout patch 121),
  // annars verkbeidnir.verd. AÐEINS til sýnis — fer EKKI í grand_total (ósótt
  // reikningssala er þegar inni í A.heildar, annað væri tvítalið).
  const VERKST = { kr: 0, n: 0, n2: 0, list: [] };
  const AFGR = { kr: 0, n: 0, n2: 0, list: [] };
  if (verk.length) {
    const ids = verk.map((j) => j.id).filter((x) => x != null);
    const liveUnits = {}; // job_id → n
    for (let i = 0; i < ids.length; i += 80) {
      try {
        const chunk = await sbAll('verklidur', `select=job_id,status&job_id=in.(${ids.slice(i, i + 80).join(',')})`);
        for (const u of chunk) { if (lc(u.status) !== 'eytt') liveUnits[u.job_id] = (liveUnits[u.job_id] || 0) + 1; }
      } catch (e) { warnings.push('verklidur lestur mistókst — tækjafjöldi gæti vantað'); break; }
    }
    const parentNum = (n) => String(n || '').replace(/-V\d+$/, '');
    const nums = [...new Set(verk.map((j) => parentNum(j.num)).filter(Boolean))];
    const saleByNum = new Map();
    for (let i = 0; i < nums.length; i += 60) {
      try {
        // encodeURIComponent á hvert gildi — verk-númer geta borið '#' sem
        // myndi annars klippa query-strenginn í sundur.
        const chunk = await sbAll('solur', `select=num,samtals&num=in.(${nums.slice(i, i + 60).map((n) => encodeURIComponent('"' + n + '"')).join(',')})`);
        for (const s of chunk) saleByNum.set(String(s.num), +s.samtals || 0);
      } catch (e) { /* verd-fallback dugar */ }
    }
    // verd = HLUTUR þessa verks (sannreynt 8.8.: R-000663-V1+V2 verd 8410+5200
    // = samtals 13610 á foreldrasölunni). Salan sjálf (samtals) er heild allra
    // systkiniverkanna — hún er aðeins notuð sem fallback, deilt jafnt, þegar
    // verd vantar. Annars tvíteldist salan á hverju verki.
    const sibs = {}; // parent → fjöldi verka
    for (const j of verk) { const p = parentNum(j.num); sibs[p] = (sibs[p] || 0) + 1; }
    for (const j of verk) {
      const target = lc(j.status) === 'ready' ? AFGR : VERKST;
      const taeki = liveUnits[j.id] || 0;
      if (lc(j.status) !== 'ready' && taeki === 0) continue; // öll tæki eydd → dettur af borðinu (regla Verkraðar)
      const p = parentNum(j.num);
      const kr = +j.verd > 0 ? +j.verd : (saleByNum.get(p) || 0) / (sibs[p] || 1);
      target.n += 1; target.n2 += taeki; target.kr += Math.round(kr);
      target.list.push({ label: j.customer || j.num || '—', sub: taeki + ' tæki', kr: Math.round(kr) });
    }
  }

  // ── A4) Skýrslur í vinnslu (úr fjarmal_live, gefið út af patch 304) ───────
  const fjRow = fjLive.find((r) => r.key === 'skyrslur_i_vinnslu');
  const SKYRSLUR = fjRow
    ? { kr: Math.round(+fjRow.kr || 0), n: +fjRow.n || 0, list: Array.isArray(fjRow.list) ? fjRow.list : [], updated_at: fjRow.updated_at || null }
    : null;

  // Raða + cap-a alla bucket-lista (kr desc, max 300).
  [A.thessi_manudur, A.eldri, A.heildar, A.ogreitt_payday, A.osendar, B, C_osendar, VERKST, AFGR].forEach(finalize);

  // timavera_eldri er brúttó (klst × taxti) og dregur ekki frá það sem þegar er
  // rukkað/sent — gaf ranga (of háa) mynd í Heildar-pípunni, því tekið út 2026-08-08.
  // Áfram skilað í svarinu til upplýsinga, bara ekki summað inn í grand_total.
  const grand_total = A.heildar.kr + B.kr + C_osendar.kr + D.kr;

  return json(200, {
    generated_at: new Date().toISOString(),
    month, taxti_mvsk: taxti,
    slokk: A,
    slokk_verkstaedi: VERKST,
    slokk_afgreidsla_osott: AFGR,
    skyrslur_i_vinnslu: SKYRSLUR,
    bru_payday_ogreitt: B,
    bru_osendar: C_osendar,
    timavera_eldri,
    timavera_manudur: D,
    grand_total,
    warnings,
  });
};

function n0() { return { kr: 0, n: 0, list: [] }; }
function add(o, amt, item) { o.kr += Math.round(amt); o.n += 1; if (item) o.list.push(item); }
function finalize(o) { if (o && Array.isArray(o.list)) { o.list.sort((a, b) => b.kr - a.kr); if (o.list.length > 300) o.list = o.list.slice(0, 300); } return o; }
function ymOf(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function addMonths(d, k) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + k); return x; }
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
