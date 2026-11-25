// payday-reikningur-spegla-background.js — „SJÁLFKRAFA VIÐ PÖRUN" (Agnar 25.11.2026).
//
// Finnur Payday-reikninga sem Kröfu yfirlit hefur parað við verk og speglar PDF-ið inn í okkar kerfi
// (payday-reikningur-vista → efnislisti_documents doc_type='payday_reikningur') svo efnislisti og
// reikningur haldast saman og hverfa aldrei. Keyrt á áætlun (netlify.toml, 20 mín eftir payday-pull).
//
// PÖRUNIN er NÁKVÆMLEGA sama regla og vafrinn (`vinnuDrog` í index.html) svo það nái yfir ÖLL verk sem
// sýna efnislista í Kröfu yfirliti, ekki bara sjálfvirku tenginguna:
//   (1) Bein pörun — drög með payday_invoice_id === invoices.id  → verkstaður|mánuður drags.
//   (2) Upphæða-pörun — verkstaður reiknings + upphæð ±2 kr, þegar NÁKVÆMLEGA ein drög passa.
//   (3) Sjálfvirk tenging (ósend drög ↔ Payday) úr svari krofu-yfirlit-bru — nær líka GREIDDUM (t.d. R-388).
// Verkstaður hvers reiknings kemur úr krofu-yfirlit-bru (sama finnaVerkstad og Kröfu yfirlit sýnir).
//
// LES AÐEINS. Skrifar aðeins í OKKAR Storage + efnislisti_documents (afturkræft). Áætluð föll fá 403 á
// HTTP, svo áætlunin situr á -background tvíburanum (sama mynstur og payday-pull-background o.fl.).

const vistaMod = require('./payday-reikningur-vista.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = (process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://brunaholf.netlify.app').replace(/\/+$/, '');
const sbH = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const MAX = 60; // hámark reikninga sem speglast per keyrslu; afgangurinn tekst næst.

async function sbAll(table, select) {
  let out = [], from = 0; const step = 1000;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${select}`, { headers: { ...sbH, Range: `${from}-${from + step - 1}` } });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const rows = await r.json();
    out = out.concat(rows);
    if (rows.length < step) break;
    from += step;
  }
  return out;
}

async function logRun(status, detail, started_at) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/automation_runs`, {
      method: 'POST',
      headers: { ...sbH, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ job_name: 'payday-reikningur-spegla', status, detail: String(detail || '').slice(0, 1000), source: 'schedule', started_at, finished_at: new Date().toISOString() }),
    });
  } catch (_) { /* log má aldrei fella keyrsluna */ }
}

exports.handler = async () => {
  const started_at = new Date().toISOString();
  if (!SUPABASE_URL || !SUPABASE_KEY) return { statusCode: 500, body: 'env vantar' };
  try {
    const [ky, drafts, docs] = await Promise.all([
      fetch(`${BASE}/api/krofu-yfirlit-bru`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      sbAll('invoice_drafts', 'select=worksite_name,work_month,total_m_vsk,payday_invoice_id,status'),
      sbAll('efnislisti_documents', 'select=worksite_name,work_month&doc_type=eq.payday_reikningur'),
    ]);
    const mirrored = new Set(docs.map((d) => `${d.worksite_name}|${d.work_month}`));

    // vinnuDrog(inv) → vinnumánuður: bein pörun (payday_invoice_id===id), annars ein upphæða-pörun (±2 kr).
    const vinnuDrogMonth = (inv) => {
      if (inv.id != null) {
        const b = drafts.find((d) => d.payday_invoice_id != null && String(d.payday_invoice_id) === String(inv.id));
        if (b && /^\d{4}-\d{2}$/.test(String(b.work_month || ''))) return b.work_month;
      }
      const ws = inv.worksite; if (!ws) return null;
      const amt = Math.round(Number(inv.amount) || 0); if (!(amt > 0)) return null;
      const hits = drafts.filter((d) => d.worksite_name === ws && /^\d{4}-\d{2}$/.test(String(d.work_month || '')) && Math.abs(Math.round(Number(d.total_m_vsk) || 0) - amt) <= 2);
      return hits.length === 1 ? hits[0].work_month : null;
    };

    const verk = new Map(); // ws|month → { tilvisun }
    if (ky && ky.tier1) {
      for (const d of (ky.tier1.debtors || [])) for (const iv of (d.invoices || [])) {
        if (String(iv.source || '').toLowerCase() !== 'payday' || !iv.tilvisun) continue;
        const m = vinnuDrogMonth(iv);
        if (m && iv.worksite) verk.set(`${iv.worksite}|${m}`, { tilvisun: iv.tilvisun });
      }
      for (const t of (ky.sjalfvirk_tenging || [])) {
        const p = String(t.draft).split('|'); const m = p[p.length - 1]; const ws = p.slice(1, -1).join('|');
        if (ws && /^\d{4}-\d{2}$/.test(m) && t.tilvisun && !verk.has(`${ws}|${m}`)) verk.set(`${ws}|${m}`, { tilvisun: t.tilvisun });
      }
    } else {
      // Fallback ef krofu-yfirlit-bru náðist ekki: bein pörun gegnum invoices.id.
      const invoices = await sbAll('invoices', 'select=id,tilvisun,source');
      const invById = new Map(invoices.map((i) => [String(i.id), i]));
      for (const d of drafts) {
        if (d.payday_invoice_id == null || !d.worksite_name || !/^\d{4}-\d{2}$/.test(String(d.work_month || ''))) continue;
        const inv = invById.get(String(d.payday_invoice_id));
        if (inv && inv.tilvisun && String(inv.source || '').toLowerCase() === 'payday') verk.set(`${d.worksite_name}|${d.work_month}`, { tilvisun: inv.tilvisun });
      }
    }

    let reynt = 0, vistad = 0, villur = 0; const skil = [];
    for (const [key, ref] of verk) {
      if (mirrored.has(key)) continue;
      if (reynt >= MAX) { skil.push('hámarki náð — afgangur tekst næst'); break; }
      reynt++;
      const i = key.lastIndexOf('|');
      const ws = key.slice(0, i), month = key.slice(i + 1);
      try {
        const out = await vistaMod.vista({ tilvisun: ref.tilvisun, worksite_name: ws, work_month: month });
        if (out && out.ok && !out.skipped) vistad++;
        else if (out && !out.ok) { villur++; skil.push(`${key}: ${out.error || '?'}`); }
      } catch (e) { villur++; skil.push(`${key}: ${((e && e.message) || e)}`.slice(0, 140)); }
    }

    const detail = `verk ${verk.size}, reynt ${reynt}, vistað ${vistad}, villur ${villur}, ky:${ky && ky.tier1 ? 'ok' : 'fallback'}${skil.length ? ' · ' + skil.slice(0, 6).join(' | ') : ''}`;
    await logRun(villur ? 'warn' : 'ok', detail, started_at);
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, verk: verk.size, reynt, vistad, villur, skil: skil.slice(0, 12) }) };
  } catch (e) {
    await logRun('error', String((e && e.message) || e), started_at);
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: String((e && e.message) || e) }) };
  }
};
