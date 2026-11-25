// payday-reikningur-spegla-background.js — „SJÁLFKRAFA VIÐ PÖRUN" (Agnar 25.11.2026).
//
// Finnur Payday-reikninga sem kerfið hefur parað við drög/verkstað og speglar PDF-ið inn í okkar
// kerfi (payday-reikningur-vista → efnislisti_documents doc_type='payday_reikningur') svo efnislisti
// og reikningur haldast saman og hverfa aldrei. Keyrt á áætlun (netlify.toml, 20 mín eftir payday-pull).
//
// Pörunin notar NÁKVÆMLEGA sömu reglu og Kröfu yfirlit:
//   (1) K.sjalfvirkTenging — ósend drög ↔ Payday-reikningur á sömu kt/upphæð (bókarinn bjó hann til).
//   (2) Bein tenging — invoice_drafts.payday_invoice_id → invoices (reikningur sendur úr Gerð reikninga).
//
// LES AÐEINS. Skrifar aðeins í OKKAR Storage + efnislisti_documents (afturkræft). Áætluð föll fá 403 á
// HTTP, svo áætlunin situr á -background tvíburanum (sama mynstur og payday-pull-background o.fl.).

const K = require('./_krofu-flokkun.js');
const vistaMod = require('./payday-reikningur-vista.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbH = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const MAX = 40; // hámark reikninga sem speglast per keyrslu (tími + Payday-álag); afgangurinn tekst næst.

async function sbAll(table, select) {
  let out = [], from = 0; const step = 1000;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${select}`, {
      headers: { ...sbH, Range: `${from}-${from + step - 1}` },
    });
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
    const [invoices, drafts, cwmap, pguide, docs] = await Promise.all([
      sbAll('invoices', 'select=id,tilvisun,kt_greidanda,customer_name,gjalddagi,upphaed_total,status,source,payday_invoice_id,payday_uuid'),
      sbAll('invoice_drafts', 'select=worksite_name,work_month,total_m_vsk,customer_name,kennitala,status,payday_invoice_id'),
      sbAll('customer_worksite_map', 'select=customer_name,worksite_name,kt_greidanda,confidence,tilvisun,retention_pct'),
      sbAll('pricing_guide', 'select=customer_name,worksite_name'),
      sbAll('efnislisti_documents', 'select=worksite_name,work_month&doc_type=eq.payday_reikningur'),
    ]);
    const mirrored = new Set(docs.map((d) => `${d.worksite_name}|${d.work_month}`));

    // verk: ws|month → { tilvisun, uuid } fyrir þau sem þarf að spegla.
    const verk = new Map();

    // (1) Sjálfvirk tenging (amount/kt) — sama resolvePayer og Kröfu yfirlit.
    const resolvePayer = K.greidendur({ cwmap, pguide, invoices });
    const teng = K.sjalfvirkTenging({ drafts, invoices, resolvePayer }); // draftKey → invoice row
    for (const [dk, inv] of teng) {
      const parts = String(dk).split('|');          // draftinv|<verkstaður>|<mánuður>
      const month = parts[parts.length - 1];
      const ws = parts.slice(1, -1).join('|');
      if (ws && /^\d{4}-\d{2}$/.test(month) && inv && (inv.tilvisun || inv.payday_uuid)) {
        verk.set(`${ws}|${month}`, { tilvisun: inv.tilvisun, uuid: inv.payday_uuid });
      }
    }

    // (2) Bein tenging — drög sem þegar bera payday_invoice_id. NB: það vísar í invoices.id (röð-id),
    // EKKI invoices.payday_invoice_id — sama og wsEftirPayday í krofu-yfirlit-bru (r.id uppflettingin).
    const invById = new Map(invoices.map((i) => [String(i.id), i]));
    for (const d of drafts) {
      if (d.payday_invoice_id == null || !d.worksite_name || !/^\d{4}-\d{2}$/.test(String(d.work_month || ''))) continue;
      const inv = invById.get(String(d.payday_invoice_id));
      if (!inv || !(inv.tilvisun || inv.payday_uuid)) continue;
      const key = `${d.worksite_name}|${d.work_month}`;
      if (!verk.has(key)) verk.set(key, { tilvisun: inv.tilvisun, uuid: inv.payday_uuid });
    }

    let reynt = 0, vistad = 0, villur = 0; const skil = [];
    for (const [key, ref] of verk) {
      if (mirrored.has(key)) continue;
      if (reynt >= MAX) { skil.push('hámarki náð — afgangur tekst næst'); break; }
      reynt++;
      const i = key.lastIndexOf('|');
      const ws = key.slice(0, i), month = key.slice(i + 1);
      try {
        const out = await vistaMod.vista({ tilvisun: ref.tilvisun, uuid: ref.uuid, worksite_name: ws, work_month: month });
        if (out && out.ok && !out.skipped) vistad++;
        else if (out && !out.ok) { villur++; skil.push(`${key}: ${out.error || '?'}`); }
      } catch (e) { villur++; skil.push(`${key}: ${((e && e.message) || e)}`.slice(0, 140)); }
    }

    const detail = `paranir ${verk.size}, reynt ${reynt}, vistað ${vistad}, villur ${villur}${skil.length ? ' · ' + skil.slice(0, 6).join(' | ') : ''}`;
    await logRun(villur ? 'warn' : 'ok', detail, started_at);
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, paranir: verk.size, reynt, vistad, villur, skil: skil.slice(0, 12) }) };
  } catch (e) {
    await logRun('error', String((e && e.message) || e), started_at);
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: String((e && e.message) || e) }) };
  }
};
