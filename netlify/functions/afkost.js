// afkost.js — Afköst (performance) metrics for the new "Afköst" tab.
// Verkefnalisti: add5560a / ea76fd48 — duplicate asks for the same dashboard.
//
//   GET /api/afkost
//     → { generated_at,
//         daily14: [{ date, verkbeidnir_in, verkbeidnir_done, uttektir, taeki_i_uttektum }],
//         weekly_sales: [{ week_start, i_verslun_count, i_verslun_kr, i_thjonustuferdum_count, i_thjonustuferdum_kr }],
//         macro3m: { verkbeidnir_in, verkbeidnir_done, uttektir, sala_kr, prev_period: {...} } }
//
// All counts are grouped straight off created_at/dropoff/pickup/last_insp —
// no new tables, just aggregation over solur/verkbeidnir/uttaeki (the tables
// that already exist for this data). "í verslun" = solur.source='pos',
// "í þjónustuferðum" = solur.source in ('uttekt','brunakerfi') — the same
// vocabulary v_bundle_coverage and the sale-editor already use.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
  body: JSON.stringify(body),
});

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${path} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function isoDay(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function mondayOf(d) { const x = new Date(d); const dow = (x.getUTCDay() + 6) % 7; return addDays(x, -dow); }

exports.handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vars missing' });
  try {
    const now = new Date();
    const day0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const since14 = addDays(day0, -13);
    const since3m = addDays(day0, -90);
    const sincePrev3m = addDays(day0, -180);

    const [verkbeidnir, uttaeki, solur3m] = await Promise.all([
      sb(`verkbeidnir?select=id,dropoff,pickup,created_at&or=(dropoff.gte.${isoDay(sincePrev3m)},pickup.gte.${isoDay(sincePrev3m)})&limit=5000`),
      sb(`uttaeki?select=id,last_insp&last_insp=gte.${isoDay(since14)}&limit=5000`),
      sb(`solur?select=id,source,samtals,status,created_at&created_at=gte.${sincePrev3m.toISOString()}&limit=5000`),
    ]);

    // ── 14-day daily series ──────────────────────────────────────────────────
    const daily14 = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(since14, i);
      const dISO = isoDay(d);
      const inCount = verkbeidnir.filter(v => v.dropoff === dISO).length;
      const doneCount = verkbeidnir.filter(v => v.pickup === dISO).length;
      const uttektRows = solur3m.filter(s => (s.source === 'uttekt' || s.source === 'brunakerfi') && s.status === 'final' && String(s.created_at).slice(0, 10) === dISO);
      const taekiCount = uttaeki.filter(u => u.last_insp === dISO).length;
      daily14.push({ date: dISO, verkbeidnir_in: inCount, verkbeidnir_done: doneCount, uttektir: uttektRows.length, taeki_i_uttektum: taekiCount });
    }

    // ── weekly sales by channel, last ~13 weeks (~3 months) ─────────────────
    const weekStart0 = mondayOf(since3m);
    const weeks = [];
    for (let w = 0; w < 14; w++) weeks.push(addDays(weekStart0, w * 7));
    const weekly_sales = weeks.map(ws => {
      const we = addDays(ws, 7);
      const rows = solur3m.filter(s => {
        if (s.status !== 'final') return false;
        const t = new Date(s.created_at);
        return t >= ws && t < we;
      });
      const store = rows.filter(s => s.source === 'pos' || !s.source);
      const field = rows.filter(s => s.source === 'uttekt' || s.source === 'brunakerfi');
      return {
        week_start: isoDay(ws),
        i_verslun_count: store.length,
        i_verslun_kr: Math.round(store.reduce((a, s) => a + (+s.samtals || 0), 0)),
        i_thjonustuferdum_count: field.length,
        i_thjonustuferdum_kr: Math.round(field.reduce((a, s) => a + (+s.samtals || 0), 0)),
      };
    });

    // ── 3-month macro summary + prior 3-month period for comparison ─────────
    function periodSummary(from, to) {
      const vb = verkbeidnir.filter(v => v.dropoff && v.dropoff >= isoDay(from) && v.dropoff < isoDay(to));
      const vbDone = verkbeidnir.filter(v => v.pickup && v.pickup >= isoDay(from) && v.pickup < isoDay(to));
      const sales = solur3m.filter(s => { const t = new Date(s.created_at); return s.status === 'final' && t >= from && t < to; });
      const uttektir = sales.filter(s => s.source === 'uttekt' || s.source === 'brunakerfi');
      return {
        verkbeidnir_in: vb.length,
        verkbeidnir_done: vbDone.length,
        uttektir: uttektir.length,
        sala_kr: Math.round(sales.reduce((a, s) => a + (+s.samtals || 0), 0)),
      };
    }
    const macro3m = periodSummary(since3m, day0);
    macro3m.prev_period = periodSummary(sincePrev3m, since3m);

    // 2026-08-06 (Agnar: "thought it was done" — the % vs. prior-3-months
    // comparison was showing nonsense like +∞% / a ~106.000 kr prior period
    // against a ~13m kr current one). Root cause: verkbeidnir/solur only go
    // back to 2026-04-20/2026-05-04 — the "prior 3 months" window (180→90
    // days ago) mostly predates BOTH tables, so it's comparing real data
    // against a near-empty sliver, not measuring real growth. Rather than
    // fix the date math (there's nothing wrong with it — the data just isn't
    // there yet), flag it so the UI can say so instead of showing a bogus %.
    // earliestDataDate = earliest real row already in memory from the two
    // fetches above — no extra query needed.
    let earliestDataDate = null;
    verkbeidnir.forEach(v => { const d = v.dropoff || v.pickup; if (d && (!earliestDataDate || d < earliestDataDate)) earliestDataDate = d; });
    solur3m.forEach(s => { const d = String(s.created_at).slice(0, 10); if (!earliestDataDate || d < earliestDataDate) earliestDataDate = d; });
    const earliest = earliestDataDate ? new Date(earliestDataDate + 'T00:00:00Z') : sincePrev3m;
    const prevPeriodStart = earliest > sincePrev3m ? earliest : sincePrev3m;
    const prevPeriodCoverageDays = Math.max(0, Math.round((since3m - prevPeriodStart) / 86400000));
    macro3m.prev_period_coverage_days = prevPeriodCoverageDays;
    // Prior period is 90 days wide — under half real coverage means the
    // comparison isn't meaningful yet.
    macro3m.prev_period_insufficient = prevPeriodCoverageDays < 45;

    return json(200, { generated_at: now.toISOString(), daily14, weekly_sales, macro3m });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
