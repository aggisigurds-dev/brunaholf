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
//   grand_total = A.heildar + B + C(osendar) + C(timavera_eldri) + D
//   (A.heildar inniheldur nú þegar payday+osendar undirmengin — ekki tvítalið.)
//
// GET /api/fjarmal-yfirlit[?month=YYYY-MM]  → JSON (service role, read-only).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Dagvinnutaxti (sjálfgefinn) — 9.951 kr án vsk × 1,24 = m/vsk. Sama grunntala og
// „Áætlað unnið · mánuður" í Gerð Reikninga. Hægt að yfirskrifa með ?taxti=.
const DAGVINNA_MVSK_DEFAULT = Math.round(9951 * 1.24); // 12.339
// Tímar sem EKKI eru rukkanlegir sem tímagjald: Slökkvitæki-innri + Landsspítalinn
// (rukkað gegnum Ajour, ekki Tímaveru) + frí/orlof/veikindi.
const NON_BILLABLE = /sl[oö]kkvit|landssp[ií]|nlsh|hringbraut|fr[ií]\b|orlof|veik|p[aá]ska|jó?l|innr[ií]/i;

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
  let solur = [], invoices = [], drafts = [], meta = [], tv = [];
  try {
    solur = await sbAll('solur', 'select=samtals,greitt_med,paid_at,krafa_sent_at,invoiced_at,dk_invoice_id,is_credit,created_at,status&greitt_med=eq.reikningur');
  } catch (e) { warnings.push('solur lestur mistókst — Slökkvitæki-kröfur gætu vantað: ' + e.message); }
  try {
    invoices = await sbAll('invoices', 'select=upphaed_total,hofudstoll,status,source,tilvisun,id,kt_greidanda');
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

  // ── A) Slökkvitæki-kröfur ────────────────────────────────────────────────
  const A = { thessi_manudur: n0(), eldri: n0(), heildar: n0(), ogreitt_payday: n0(), osendar: n0() };
  for (const s of solur) {
    if (s.paid_at) continue;
    if (s.is_credit) continue;
    if (s.status && !['final', 'sent'].includes(lc(s.status)) && lc(s.status) !== '') continue; // sleppa void/draft
    const amt = +s.samtals || 0;
    if (amt <= 0) continue;
    const inMonth = (s.created_at || '') >= mStart && (s.created_at || '') < mEnd;
    add(A.heildar, amt);
    add(inMonth ? A.thessi_manudur : A.eldri, amt);
    if (s.dk_invoice_id) add(A.ogreitt_payday, amt);
    if (!s.krafa_sent_at && !s.invoiced_at && !s.dk_invoice_id) add(A.osendar, amt);
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
    add(B, amt);
  }

  // ── C1) Ósendir reikningar hjá Brunahólf (invoice_drafts, síðustu 3 mán) ──
  const cutoff = ymOf(addMonths(now, -3));
  const C_osendar = n0();
  for (const d of drafts) {
    const wm = String(d.work_month || '');
    const amt = +d.total_m_vsk || 0;
    if (amt <= 0 || wm < cutoff) continue;
    if ((metaBy.get(`draftinv|${d.worksite_name}|${wm}`) || {}).paid) continue;
    add(C_osendar, amt);
  }

  // ── C2/D) Tímavera-áunnið (klst × taxti) — rukkanlegir verkstaðir ─────────
  const tvByMonth = {}; // 'YYYY-MM' → klst
  for (const e of tv) {
    if (NON_BILLABLE.test(e.project || '')) continue;
    const ym = String(e.date || '').slice(0, 7);
    if (!ym) continue;
    tvByMonth[ym] = (tvByMonth[ym] || 0) + (+e.hours || 0);
  }
  const D = { klst: Math.round((tvByMonth[month] || 0) * 100) / 100, kr: Math.round((tvByMonth[month] || 0) * taxti) };
  const tvEldriMonths = Object.keys(tvByMonth).filter((m) => m < month).sort();
  const timavera_eldri = {
    klst: Math.round(tvEldriMonths.reduce((s, m) => s + tvByMonth[m], 0) * 100) / 100,
    kr: Math.round(tvEldriMonths.reduce((s, m) => s + tvByMonth[m] * taxti, 0)),
    per_month: tvEldriMonths.map((m) => ({ month: m, klst: Math.round(tvByMonth[m] * 100) / 100, kr: Math.round(tvByMonth[m] * taxti) })),
  };

  const grand_total = A.heildar.kr + B.kr + C_osendar.kr + timavera_eldri.kr + D.kr;

  return json(200, {
    generated_at: new Date().toISOString(),
    month, taxti_mvsk: taxti,
    slokk: A,
    bru_payday_ogreitt: B,
    bru_osendar: C_osendar,
    timavera_eldri,
    timavera_manudur: D,
    grand_total,
    warnings,
  });
};

function n0() { return { kr: 0, n: 0 }; }
function add(o, amt) { o.kr += Math.round(amt); o.n += 1; }
function ymOf(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function addMonths(d, k) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + k); return x; }
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
