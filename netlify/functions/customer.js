// customer.js — unified per-customer view composer.
//
//   GET /api/customer?base=<id>
//   GET /api/customer?kt=<formatted-or-digits>
//
// Returns ONE round-trip with everything needed to render customer.html:
//   {
//     base:    { id, kennitala, nafn, heimilisfang, ... },
//     sites:   [ { id, nafn, heimilisfang, er_i_thjonustu, ... } ],
//     docs:    [ { id, doc_type, year, doc_date, drive_file_id, storage_path,
//                  view_url, link_source, invoice_number, amount, customer_name,
//                  fyrirtaeki_id, site_nafn, is_duplicate, dup_of, reviewed,
//                  reviewed_at, source, found_at } ],
//     invoices:[ { tilvisun, gjalddagi, hofudstoll, upphaed_total, status,
//                  greidsla_date, customer_name, ... } ],
//     summary: { docs_total, by_type, by_year_type, dup_count,
//                unreviewed_count, missing_doc_date, missing_file,
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

const EDITABLE_DOC_FIELDS = ['doc_type', 'amount', 'invoice_number', 'doc_date', 'customer_name', 'notes'];

// Opnanlegur tengill á skjal — SAMA rökfræði og /api/service-gaps `openUrl`,
// með einni breytingu: Supabase gengur FYRIR Drive.
//
// Af hverju sú röð: Drive-hlekkur er skráarauðkenni sem rofnar við endurnefningu/
// færslu (sjá docs/SKJALA-FLUTNINGUR.md — 793 mældir dauðir hlekkir), og í símum
// með marga Google-reikninga birtir hann „Select an account" í hvert sinn.
// `storage_path` er stöðug slóð í public `samningar`-fatinu — hún getur ekki
// rofnað og krefst engrar innskráningar. 287 raðir eiga BÁÐA; þær opnast núna á
// eintakinu sem er öruggt. Drive-skránum er ALDREI eytt — `drive_file_id` stendur
// áfram í svarinu sem aukatilvísun.
//
// ⚠️ Slóðin ber bucket-nafnið sjálf („samningar/…"), svo hún má ALDREI fá bucket
// forskeyti hér — sannreynt: allar 528 storage_path-raðir byrja á `samningar/`.
function docViewUrl(d) {
  if (d.storage_path) return `${SUPABASE_URL}/storage/v1/object/public/${d.storage_path}`;
  if (d.drive_file_id && !String(d.drive_file_id).startsWith('sb:')) return `/api/skjal?id=${encodeURIComponent(d.drive_file_id)}`;
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Ógilt JSON í líkama' }); }
    const action = body.action;
    if (action === 'update-doc') {
      const id = parseInt(body.id, 10);
      if (!id) return json(400, { error: 'id vantar' });
      const fields = body.fields || {};
      const patch = {};
      for (const k of EDITABLE_DOC_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(fields, k)) {
          let v = fields[k];
          if (k === 'amount') {
            if (v === '' || v === null || v === undefined) v = null;
            else { const n = Number(v); v = Number.isFinite(n) ? n : null; }
          } else if (k === 'doc_date') {
            if (!v) v = null;
          } else if (typeof v === 'string') {
            v = v.trim();
            if (v === '') v = null;
          }
          patch[k] = v;
        }
      }
      if (!Object.keys(patch).length) return json(400, { error: 'Engin reitir til að uppfæra' });
      try {
        const r = await sbPatch(`customer_documents?id=eq.${id}&select=*`, patch);
        if (!r.ok) {
          const txt = await r.text();
          return json(r.status, { error: 'Supabase villa', detail: txt });
        }
        const rows = await r.json();
        return json(200, { ok: true, row: rows[0] || null });
      } catch (e) {
        return json(500, { error: String(e.message || e) });
      }
    }
    return json(400, { error: 'Óþekkt aðgerð', action });
  }

  if (event.httpMethod !== 'GET') return json(405, { error: 'GET eða POST only' });

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
      sbGet(`customers_base?id=eq.${baseId}&select=id,kennitala,nafn,heimilisfang,rekstrarfelag,greidsluskilmali,payment_method,retention_pct,retention_notes,contact_email,contact_phone,general_notes,last_payment_at,netfang&limit=1`),
      sbGet(`fyrirtaeki?customer_base_id=eq.${baseId}&deleted_at=is.null&select=id,nafn,heimilisfang,er_i_thjonustu,status,banner_note,review_flag,kennitala,netfang`),
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
      d.view_url = docViewUrl(d);
      d.link_source = d.storage_path ? 'storage' : (d.drive_file_id ? 'drive' : null);
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

    // 4b) Last email contact (verkefnalisti aaaa0cb6 — "síðasti samskipti" per
    // kúnna). Matches the SAME conservative exact-address logic as
    // /api/company-mail (Slökkvitæki's envelope badge) — newest inbound email
    // from base.contact_email or any live site's netfang, plus whether it's
    // been replied to (a SENT email addressed to it since).
    const last_contact = await fetchLastContact(base, sites);

    // 5) AI flags (heuristic — no AI call)
    const ai_flags = computeFlags({ base, sites, docs, invoices, summary, last_contact });

    return json(200, {
      generated_at: new Date().toISOString(),
      base, sites, docs, invoices, summary, ai_flags, last_contact,
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

// Newest inbound email from this customer (base.contact_email or any live
// site's netfang) + whether it's been replied to. Exact-address match only —
// same conservative approach as /api/company-mail (which does this across ALL
// companies for Slökkvitæki's "Fyrirtæki í þjónustu" list); here it's scoped
// to one customer so no cross-customer ambiguity tracking is needed.
async function fetchLastContact(base, sites) {
  const clean = (v) => {
    if (!v) return '';
    let s = String(v).trim().toLowerCase();
    const m = s.match(/<([^>]+)>/); if (m) s = m[1].trim();
    return s.replace(/[),;]+$/, '');
  };
  const emails = [...new Set([base.contact_email, base.netfang, ...sites.map(s => s.netfang)]
    .map(clean).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
  if (!emails.length) return null;
  try {
    const inList = emails.map(e => `"${e}"`).join(',');
    const rows = await sbGet(
      `email_digest?select=sender_email,to_addresses,subject,snippet,received_at,folder` +
      `&sender_email=in.(${inList})&order=received_at.desc&limit=200`
    ).then(r => r.ok ? r.json() : []);
    let inbound = null;
    for (const m of rows) {
      if (String(m.folder || '').toUpperCase() === 'SENT') continue;
      if (!emails.includes(clean(m.sender_email))) continue;
      inbound = m; break; // rows are received_at desc → first match is newest
    }
    if (!inbound) return null;
    // Was there a SENT reply addressed to that same sender, at/after the inbound?
    const sentRows = await sbGet(
      `email_digest?select=to_addresses,received_at&folder=eq.SENT` +
      `&received_at=gte.${encodeURIComponent(inbound.received_at || '')}&order=received_at.desc&limit=200`
    ).then(r => r.ok ? r.json() : []);
    const from = clean(inbound.sender_email);
    const replied = sentRows.some(s => {
      const to = Array.isArray(s.to_addresses) ? s.to_addresses : String(s.to_addresses || '').split(/[,;]/);
      return to.some(t => clean(t) === from);
    });
    return {
      from, subject: inbound.subject || '', snippet: (inbound.snippet || '').slice(0, 240),
      received_at: inbound.received_at || null, unreplied: !replied,
    };
  } catch (_) { return null; }
}

function buildSummary(docs, invoices) {
  const by_type = { uttektarskyrsla: 0, reikningur: 0, samningur: 0, annad: 0 };
  const by_year_type = {};
  let dup_count = 0, unreviewed_count = 0, missing_doc_date = 0, missing_file = 0;
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
    // Draugaröð = HVORKI Drive né Storage. Áður taldist `!drive_file_id` sem
    // gloppa, sem gaf falskt viðvörunarflagg á þau 241 skjöl sem eiga fína
    // Supabase-skrá en engan Drive-hlekk.
    if (!d.drive_file_id && !d.storage_path) missing_file++;
    if (t === 'reikningur' && d.amount) reikningur_amount_total += Number(d.amount) || 0;
  }

  // Open AR = unpaid, non-draft, non-cancelled, non-credit invoices with no
  // payment date. Status vocabulary is mixed (English PAID/SENT/CANCELLED/CREDIT
  // vs Icelandic Greitt/Ógreitt); the „ó/o"-prefix guard stops ógreitt/ógreidd
  // (UNPAID) from matching the paid word.
  const ar_open = invoices.filter(i => {
    if (i.greidsla_date) return false;
    const s = (i.status || '');
    const amt = Number(i.upphaed_total || i.hofudstoll) || 0;
    if (!/[óo]grei/i.test(s) && /paid|greitt|greidd/i.test(s)) return false;
    if (/draft|dr[öo]g|cancel|afturk|felld|[óo]gild|credit|kredit/i.test(s)) return false;
    return amt > 0;
  });
  const ar_open_kr = ar_open.reduce((sum, i) => sum + (Number(i.upphaed_total || i.hofudstoll) || 0), 0);
  const ar_oldest_due = ar_open.length
    ? ar_open.map(i => i.gjalddagi).filter(Boolean).sort()[0] || null
    : null;

  return {
    docs_total: docs.length,
    by_type, by_year_type,
    dup_count, unreviewed_count, missing_doc_date, missing_file,
    has_2026_uttekt, last_uttekt_year, last_reikningur_year,
    reikningur_amount_total,
    invoices_total: invoices.length,
    ar_open_count: ar_open.length,
    ar_open_kr: Math.round(ar_open_kr),
    ar_oldest_due,
  };
}

function computeFlags({ base, sites, docs, invoices, summary, last_contact }) {
  const f = [];
  const yearNow = new Date().getUTCFullYear();

  // Email — unreplied inbound message (verkefnalisti aaaa0cb6: "flagar 'enginn
  // svarað í 3 daga'"). Shown as soon as it's unreplied (a fresh unread message
  // is still worth surfacing), escalated to warn once it's been 3+ days.
  if (last_contact && last_contact.unreplied) {
    const days = last_contact.received_at ? Math.floor((Date.now() - new Date(last_contact.received_at).getTime()) / 86400000) : null;
    f.push({
      severity: (days != null && days >= 3) ? 'warn' : 'info',
      msg: `✉️ Ósvarað póstsamskipti${days != null ? ` (${days} ${days === 1 ? 'dagur' : 'dagar'} síðan)` : ''}`,
      hint: `${last_contact.from}${last_contact.subject ? ' — "' + last_contact.subject + '"' : ''}`,
    });
  }

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
  if (summary.missing_file > 0) {
    f.push({
      severity: 'warn',
      msg: `${summary.missing_file} skjöl án skráar`,
      hint: 'Raðirnar segjast þekja árið en eiga hvorki drive_file_id né storage_path — engin skrá er að baki þeim.',
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

function sbPatch(qs, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${qs}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
