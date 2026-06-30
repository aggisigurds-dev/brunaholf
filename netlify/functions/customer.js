// customer.js — unified per-customer view composer.
//
//   GET /api/customer?base=<id>
//   GET /api/customer?kt=<formatted-or-digits>
//
// Returns ONE round-trip with everything needed to render customer.html:
//   {
//     base:    { id, kennitala, nafn, heimilisfang, ... },
//     sites:   [ { id, nafn, heimilisfang, er_i_thjonustu, ... } ],
//     docs:    [ { id, doc_type, year, doc_date, drive_file_id, view_url,
//                  invoice_number, amount, customer_name, fyrirtaeki_id,
//                  site_nafn, is_duplicate, dup_of, reviewed, reviewed_at,
//                  source, found_at } ],
//     invoices:[ { tilvisun, gjalddagi, hofudstoll, upphaed_total, status,
//                  greidsla_date, customer_name, ... } ],
//     summary: { docs_total, by_type, by_year_type, dup_count,
//                unreviewed_count, missing_doc_date, missing_drive_file_id,
//                has_2026_uttekt, last_uttekt_year, last_reikningur_year,
//                reikningur_amount_total, ar_open_kr, ar_oldest_due },
//     ai_flags: [ { severity:'warn'|'info'|'error', msg, hint? } ]
//   }
//
// Docs UNION = customer_documents directly tied to base_id + rows tied via
// fyrirtaeki_id (where fyrirtaeki.customer_base_id = base.id). NEVER LEFT
// JOIN through fyrirtaeki — that multiplies for multi-site customers like
// Center Hótel (9 sites).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });

  const p = event.queryStringParameters || {};
  let baseId = parseInt(p.base, 10);
  const kt = (p.kt || '').toString().replace(/[^\d]/g, '');

  try {
    // Resolve base by kt if id not given
    if (!baseId && kt) {
      const dash = kt.length === 10 ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;
      const r = await sbGet(`customers_base?kennitala=eq.${encodeURIComponent(dash)}&select=id&limit=1`);
      const j = await r.json();
      if (j.length) baseId = j[0].id;
    }
    if (!baseId) return json(400, { error: 'base id eða kt vantar (eða finnst ekki)' });

    // 1) Base + sites in parallel
    const [baseRes, sitesRes] = await Promise.all([
      sbGet(`customers_base?id=eq.${baseId}&select=id,kennitala,nafn,heimilisfang,rekstrarfelag,greidsluskilmali,payment_method,retention_pct,retention_notes,contact_email,contact_phone,general_notes,last_payment_at&limit=1`),
      sbGet(`fyrirtaeki?customer_base_id=eq.${baseId}&deleted_at=is.null&select=id,nafn,heimilisfang,er_i_thjonustu,status,banner_note,review_flag,kennitala`),
    ]);
    const baseRows = await baseRes.json();
    if (!baseRows.length) return json(404, { error: `Engin customers_base.id=${baseId}` });
    const base = baseRows[0];
    const sites = await sitesRes.json();
    const siteIds = sites.map(s => s.id);
    base.er_i_thjonustu = sites.some(s => s.er_i_thjonustu === true);

    // 2) Docs in parallel — both link paths, then union
    const directDocs = await sbGet(
      `customer_documents?customer_base_id=eq.${baseId}` +
      `&select=id,doc_type,year,doc_date,drive_file_id,storage_path,invoice_number,amount,customer_name,fyrirtaeki_id,is_duplicate,dup_of,reviewed,reviewed_at,source,found_at,created_at`
    ).then(r => r.json());

    let viaSiteDocs = [];
    if (siteIds.length) {
      const idsStr = siteIds.join(',');
      viaSiteDocs = await sbGet(
        `customer_documents?fyrirtaeki_id=in.(${idsStr})&customer_base_id=is.null` +
        `&select=id,doc_type,year,doc_date,drive_file_id,storage_path,invoice_number,amount,customer_name,fyrirtaeki_id,is_duplicate,dup_of,reviewed,reviewed_at,source,found_at,created_at`
      ).then(r => r.json());
    }
    const docs = [...directDocs, ...viaSiteDocs];

    // Decorate docs with view_url + site nafn
    const siteById = new Map(sites.map(s => [s.id, s]));
    for (const d of docs) {
      d.view_url = d.drive_file_id ? `https://drive.google.com/file/d/${d.drive_file_id}/view` : null;
      d.site_nafn = d.fyrirtaeki_id ? (siteById.get(d.fyrirtaeki_id)?.nafn || null) : null;
    }
    // Sort: newest first (doc_date → year-jan → created_at)
    docs.sort((a, b) => {
      const ad = a.doc_date || (a.year ? `${a.year}-01-01` : a.created_at || '0');
      const bd = b.doc_date || (b.year ? `${b.year}-01-01` : b.created_at || '0');
      return bd.localeCompare(ad);
    });

    // 3) Invoices by kt (digits) — only if kt available
    let invoices = [];
    const baseKtDigits = (base.kennitala || '').replace(/\D/g, '');
    if (baseKtDigits.length === 10) {
      const dashed = baseKtDigits.slice(0, 6) + '-' + baseKtDigits.slice(6);
      const rIn = await sbGet(
        `invoices?or=(kt_greidanda.eq.${encodeURIComponent(dashed)},kt_greidanda.eq.${baseKtDigits})` +
        `&select=tilvisun,source,customer_name,kt_greidanda,gjalddagi,eindagi,hofudstoll,upphaed_total,status,greidsla_date,worksite_match,imported_at` +
        `&order=gjalddagi.desc.nullslast&limit=500`
      );
      if (rIn.ok) invoices = await rIn.json();
    }

    // 4) Summary aggregates
    const summary = buildSummary(docs, invoices);

    // 5) AI flags (heuristic — no AI call)
    const ai_flags = computeFlags({ base, sites, docs, invoices, summary });

    return json(200, {
      generated_at: new Date().toISOString(),
      base, sites, docs, invoices, summary, ai_flags,
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

function buildSummary(docs, invoices) {
  const by_type = { uttektarskyrsla: 0, reikningur: 0, samningur: 0, annad: 0 };
  const by_year_type = {};
  let dup_count = 0, unreviewed_count = 0, missing_doc_date = 0, missing_drive_file_id = 0;
  let last_uttekt_year = null, last_reikningur_year = null;
  let reikningur_amount_total = 0;
  let has_2026_uttekt = false;

  for (const d of docs) {
    const t = d.doc_type || 'annad';
    by_type[t] = (by_type[t] || 0) + 1;
    const y = d.year || (d.doc_date ? Number(d.doc_date.slice(0, 4)) : null);
    if (y) {
      by_year_type[y] = by_year_type[y] || { uttektarskyrsla: 0, reikningur: 0, samningur: 0 };
      by_year_type[y][t] = (by_year_type[y][t] || 0) + 1;
      if (t === 'uttektarskyrsla') {
        if (y >= 2026) has_2026_uttekt = true;
        if (!last_uttekt_year || y > last_uttekt_year) last_uttekt_year = y;
      } else if (t === 'reikningur') {
        if (!last_reikningur_year || y > last_reikningur_year) last_reikningur_year = y;
      }
    }
    if (d.is_duplicate) dup_count++;
    if (!d.reviewed) unreviewed_count++;
    if (!d.doc_date) missing_doc_date++;
    if (!d.drive_file_id) missing_drive_file_id++;
    if (t === 'reikningur' && d.amount) reikningur_amount_total += Number(d.amount) || 0;
  }

  const ar_open = invoices.filter(i =>
    (i.status || '').toLowerCase() !== 'paid' &&
    (i.status || '').toLowerCase() !== 'greidd' &&
    !i.greidsla_date
  );
  const ar_open_kr = ar_open.reduce((sum, i) => sum + (Number(i.upphaed_total || i.hofudstoll) || 0), 0);
  const ar_oldest_due = ar_open.length
    ? ar_open.map(i => i.gjalddagi).filter(Boolean).sort()[0] || null
    : null;

  return {
    docs_total: docs.length,
    by_type, by_year_type,
    dup_count, unreviewed_count, missing_doc_date, missing_drive_file_id,
    has_2026_uttekt, last_uttekt_year, last_reikningur_year,
    reikningur_amount_total,
    invoices_total: invoices.length,
    ar_open_count: ar_open.length,
    ar_open_kr: Math.round(ar_open_kr),
    ar_oldest_due,
  };
}

function computeFlags({ base, sites, docs, invoices, summary }) {
  const f = [];
  const yearNow = new Date().getUTCFullYear();

  // Missing yearly inspection
  if (base.er_i_thjonustu) {
    if (!summary.has_2026_uttekt && (summary.last_uttekt_year || 0) < yearNow) {
      f.push({
        severity: 'warn',
        msg: `Vantar úttektarskýrslu ${yearNow}`,
        hint: summary.last_uttekt_year
          ? `Síðasta skýrsla er ${summary.last_uttekt_year} — komin er tími á árlegt eftirlit.`
          : 'Engin skýrsla skráð fyrir þennan kúnna enn.',
      });
    }
  }

  // Duplicates
  if (summary.dup_count > 0) {
    f.push({
      severity: 'info',
      msg: `${summary.dup_count} skjöl flagged sem tvítak`,
      hint: 'Skoðaðu hvort þetta eru raunveruleg tvítök eða mismunandi staðsettningar — sjá staðar-merki.',
    });
  }

  // Missing metadata
  if (summary.missing_drive_file_id > 0) {
    f.push({
      severity: 'warn',
      msg: `${summary.missing_drive_file_id} skjöl án Drive-tengingar`,
      hint: 'Skjölin eru í gagnagrunninum en án drive_file_id — líklega tapast við index-keyrslu.',
    });
  }
  if (summary.missing_doc_date > docs.length * 0.5 && docs.length > 5) {
    f.push({
      severity: 'info',
      msg: `${summary.missing_doc_date} af ${docs.length} skjöl án dagsetningar`,
      hint: 'Endurskanna með nýja parser-num ætti að fylla doc_date.',
    });
  }
  if (summary.unreviewed_count === docs.length && docs.length > 0) {
    f.push({
      severity: 'info',
      msg: `Engin skjöl staðfest enn (${docs.length} óstaðfest)`,
      hint: 'Skoðaðu hverja röð og smelltu Staðfesta þegar passar.',
    });
  }

  // AR open
  if (summary.ar_open_kr > 0) {
    f.push({
      severity: summary.ar_open_kr > 200_000 ? 'warn' : 'info',
      msg: `${formatKr(summary.ar_open_kr)} kr óinnheimt (${summary.ar_open_count} reikningar)`,
      hint: summary.ar_oldest_due
        ? `Elsti gjalddagi: ${summary.ar_oldest_due}.`
        : null,
    });
  }

  // No service-customer flag mismatch with doc presence
  if (!base.er_i_thjonustu && docs.length > 0) {
    f.push({
      severity: 'info',
      msg: 'Ekki merktur „í þjónustu" en hefur skjöl',
      hint: 'Skoðaðu hvort eigi að merkja kúnnann sem virkan þjónustukúnna.',
    });
  }

  // Multi-site warning for dup interpretation
  if (sites.length > 1 && summary.dup_count > 0) {
    f.push({
      severity: 'info',
      msg: `${sites.length} staðsettningar — sum „tvítök" eru líklega mismunandi staðsettningar`,
      hint: 'Notaðu Skýrslu-stöð (match-station) til að assign-a docs á réttar staðsettningar.',
    });
  }

  return f;
}

function formatKr(n) {
  return Math.round(Number(n) || 0).toLocaleString('is-IS').replace(/,/g, '.');
}

function sbGet(qs) {
  return fetch(`${SUPABASE_URL}/rest/v1/${qs}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
