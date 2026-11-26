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
//                sites_in_service, sites_with_2026_uttekt,
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

const BASE_SELECT = 'id,kennitala,nafn,heimilisfang,rekstrarfelag,greidsluskilmali,payment_method,retention_pct,retention_notes,contact_email,contact_phone,simi,general_notes,last_payment_at,netfang';
const DOC_SELECT = 'id,doc_type,year,doc_date,drive_file_id,storage_path,invoice_number,amount,customer_name,fyrirtaeki_id,is_duplicate,dup_of,reviewed,reviewed_at,source,found_at,created_at';

const GENERIC_DOMAIN = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|icloud|me|simnet|internet|visir|mi|talnet|vortex|isl|centrum|torg|protonmail)\./i;
const cleanEmail = (v) => {
  if (!v) return '';
  let s = String(v).trim().toLowerCase();
  const m = s.match(/<([^>]+)>/); if (m) s = m[1].trim();
  return s.replace(/[),;]+$/, '');
};
const splitEmails = (v) => String(v || '').split(/[,;\s]+/).map(cleanEmail).filter(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e));

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
    // ── Bæta við byggingu (26.11.2026): tengja fyrirtaeki inn í rekstrarfélags-hópinn.
    // ÖRUGGT + AFTURKRÆFT: hópurinn er skilgreindur af customers_base.rekstrarfelag
    // (frítexta-merki), svo við setjum rekstrarfelag-merkið á BÖSU byggingarinnar —
    // ENGIN kt breytt, ekkert fyrirtaeki_id/customer_base_id null-að né bygging flutt
    // milli greiðenda, engir staðir sameinaðir (kunnaskra-reglur). Bygging án bösu er
    // tengd við aðalbösu hópsins (eina leiðin til að hún eigi greiðanda).
    if (action === 'add-building') {
      const fid = parseInt(body.fyrirtaeki_id, 10);
      const rekstrarfelag = (body.rekstrarfelag || '').trim();
      const primaryBaseId = parseInt(body.primary_base_id, 10);
      if (!fid) return json(400, { error: 'fyrirtaeki_id vantar' });
      if (!rekstrarfelag) return json(400, { error: 'rekstrarfelag (hópsheiti) vantar' });
      try {
        const frows = await sbGet(`fyrirtaeki?id=eq.${fid}&select=id,nafn,heimilisfang,customer_base_id,er_i_thjonustu,kennitala,netfang,simi,tengilidur,thjonusta_brunakerfi&limit=1`).then(r => r.json());
        if (!frows.length) return json(404, { error: `Engin fyrirtaeki.id=${fid}` });
        const f = frows[0];
        // 1) tryggja að bygging eigi bösu í hópnum
        if (f.customer_base_id) {
          // setja rekstrarfelag-merkið á bösuna (afturkræft) ef það er ekki þegar rétt
          const br = await sbGet(`customers_base?id=eq.${f.customer_base_id}&select=id,rekstrarfelag&limit=1`).then(r => r.json());
          if (br.length && (br[0].rekstrarfelag || '').trim() !== rekstrarfelag) {
            await sbPatch(`customers_base?id=eq.${f.customer_base_id}`, { rekstrarfelag });
          }
        } else if (primaryBaseId) {
          await sbPatch(`fyrirtaeki?id=eq.${fid}`, { customer_base_id: primaryBaseId });
          f.customer_base_id = primaryBaseId;
        } else {
          return json(400, { error: 'Byggingin á enga bösu og engin aðalbösa gefin' });
        }
        // 2) þjónusta
        const patch = { er_i_thjonustu: true };
        if (body.brunakerfi === true) patch.thjonusta_brunakerfi = true;
        const r = await sbPatch(`fyrirtaeki?id=eq.${fid}&select=id,nafn,heimilisfang,er_i_thjonustu,kennitala,netfang,simi,tengilidur,customer_base_id,thjonusta_brunakerfi`, patch);
        if (!r.ok) return json(r.status, { error: 'Supabase villa', detail: await r.text() });
        const row = (await r.json())[0] || f;
        return json(200, { ok: true, building: row });
      } catch (e) { return json(500, { error: String(e.message || e) }); }
    }

    // ── Bæta við / fjarlægja brunakerfisþjónustu (26.11.2026) — handvirkt merki
    // thjonusta_brunakerfi á byggingu/byggingum. Afturkræft (on:false hreinsar).
    if (action === 'add-service') {
      const svc = String(body.service || 'brunakerfi');
      if (svc !== 'brunakerfi') return json(400, { error: 'Aðeins brunakerfi er studd hér' });
      const on = body.on !== false;
      let ids = Array.isArray(body.building_ids) ? body.building_ids.map(x => parseInt(x, 10)).filter(Boolean) : [];
      try {
        if (!ids.length && body.rekstrarfelag) {
          // allar byggingar hópsins
          const gb = await sbGet(`customers_base?rekstrarfelag=eq.${encodeURIComponent(String(body.rekstrarfelag).trim())}&select=id`).then(r => r.json()).catch(() => []);
          const baseIds = gb.map(b => b.id);
          if (baseIds.length) { const fy = await sbGet(`fyrirtaeki?customer_base_id=in.(${baseIds.join(',')})&deleted_at=is.null&select=id`).then(r => r.json()).catch(() => []); ids = fy.map(x => x.id); }
        }
        if (!ids.length) return json(400, { error: 'engar byggingar' });
        const r = await sbPatch(`fyrirtaeki?id=in.(${ids.join(',')})&select=id,thjonusta_brunakerfi`, { thjonusta_brunakerfi: on ? true : null });
        if (!r.ok) return json(r.status, { error: 'Supabase villa', detail: await r.text() });
        return json(200, { ok: true, uppfaert: (await r.json()).length, on });
      } catch (e) { return json(500, { error: String(e.message || e) }); }
    }

    // ── Vista athugasemd (general_notes) á bösu — afturkræft reitur
    if (action === 'save-note') {
      const bid = parseInt(body.base_id, 10);
      if (!bid) return json(400, { error: 'base_id vantar' });
      try {
        const r = await sbPatch(`customers_base?id=eq.${bid}&select=id`, { general_notes: typeof body.general_notes === 'string' ? body.general_notes : null });
        if (!r.ok) return json(r.status, { error: 'Supabase villa', detail: await r.text() });
        return json(200, { ok: true });
      } catch (e) { return json(500, { error: String(e.message || e) }); }
    }

    return json(400, { error: 'Óþekkt aðgerð', action });
  }

  if (event.httpMethod !== 'GET') return json(405, { error: 'GET eða POST only' });

  const p = event.queryStringParameters || {};

  // Leit að byggingu fyrir „Bæta við byggingu" gluggann — heimilisfang EÐA kennitala
  // EÐA nafn. Skilar fyrirtaeki-röðum (lesið). Sleppir byggingum sem eru ÞEGAR í hópnum.
  if (p.leita_bygg != null) {
    const q = String(p.leita_bygg || '').trim();
    const exclude = String(p.exclude_bases || '').split(',').map(s => parseInt(s, 10)).filter(Boolean);
    if (q.length < 2) return json(200, { results: [] });
    try {
      const digits = q.replace(/\D/g, '');
      const ors = [`nafn.ilike.*${q}*`, `heimilisfang.ilike.*${q}*`];
      if (digits.length >= 4) ors.push(`kennitala.ilike.*${digits}*`, `kennitala.ilike.*${q}*`);
      const rows = await sbGet(
        `fyrirtaeki?deleted_at=is.null&or=(${ors.map(encodeURIComponent).join(',')})` +
        `&select=id,nafn,heimilisfang,kennitala,customer_base_id,er_i_thjonustu&order=nafn.asc&limit=25`
      ).then(r => r.ok ? r.json() : []);
      const results = (rows || []).map(r => ({ ...r, i_hopi: exclude.includes(r.customer_base_id) }));
      return json(200, { results });
    } catch (e) { return json(500, { error: String(e.message || e) }); }
  }

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

    // 1) Base
    const baseRows = await sbGet(`customers_base?id=eq.${baseId}&select=${BASE_SELECT}&limit=1`).then(r => r.json());
    if (!baseRows.length) return json(404, { error: `Engin customers_base.id=${baseId}` });
    const base = baseRows[0];

    // 1b) Rekstrarfélags-HÓPUR (26.11.2026, redesign): prófíllinn sýnir ALLAN hópinn,
    // ekki eina bösu. `rekstrarfelag` (frítexti) hópar margar customers_base-raðir
    // (Bílabúð Benna = 868 + Nesdekk 55 + Vagneignir 1260 = 5 byggingar). AÐEINS LESIÐ
    // og aggregerað — ekkert er sameinað, ekki breytt kt, ekki null-að fyrirtaeki_id.
    // Tóm rekstrarfelag → hópurinn er bara þessi eina bösa (bakveg-samhæfni).
    const rekstrarfelag = (base.rekstrarfelag || '').trim();
    let groupBases = [base];
    if (rekstrarfelag) {
      const gb = await sbGet(`customers_base?rekstrarfelag=eq.${encodeURIComponent(rekstrarfelag)}&select=${BASE_SELECT}&order=id.asc`).then(r => r.json()).catch(() => []);
      if (Array.isArray(gb) && gb.length) groupBases = gb;
    }
    const baseIds = [...new Set(groupBases.map(b => b.id))];
    const is_group = baseIds.length > 1;

    // 2) Sites for the whole group (fyrirtaeki.customer_base_id in group) — extra
    // dálkar (simi/tengilidur/thjonusta_brunakerfi) sem þétti prófíllinn þarf.
    const baseNafnById = new Map(groupBases.map(b => [b.id, b.nafn]));
    const sites = await sbGet(
      `fyrirtaeki?customer_base_id=in.(${baseIds.join(',')})&deleted_at=is.null` +
      `&select=id,nafn,heimilisfang,er_i_thjonustu,status,banner_note,review_flag,kennitala,netfang,simi,farsimi,tengilidur,customer_base_id,thjonusta_brunakerfi,created_at&order=id.asc&limit=400`
    ).then(r => r.json()).catch(() => []);
    for (const s of sites) s.base_nafn = baseNafnById.get(s.customer_base_id) || null;
    const siteIds = sites.map(s => s.id);
    base.er_i_thjonustu = sites.some(s => s.er_i_thjonustu === true);

    // 3) Docs — bæði tengslapör, allur hópurinn, svo union
    const directDocs = await sbGet(
      `customer_documents?customer_base_id=in.(${baseIds.join(',')})` +
      `&select=${DOC_SELECT}&limit=2000`
    ).then(r => r.json()).catch(() => []);
    let viaSiteDocs = [];
    if (siteIds.length) {
      viaSiteDocs = await sbGet(
        `customer_documents?fyrirtaeki_id=in.(${siteIds.join(',')})&customer_base_id=is.null` +
        `&select=${DOC_SELECT}&limit=2000`
      ).then(r => r.json()).catch(() => []);
    }
    const docs = [...directDocs, ...viaSiteDocs];
    const siteById = new Map(sites.map(s => [s.id, s]));
    for (const d of docs) {
      d.view_url = docViewUrl(d);
      d.link_source = d.storage_path ? 'storage' : (d.drive_file_id ? 'drive' : null);
      d.site_nafn = d.fyrirtaeki_id ? (siteById.get(d.fyrirtaeki_id)?.nafn || null) : null;
    }
    docs.sort((a, b) => {
      const ad = a.doc_date || (a.year ? `${a.year}-01-01` : a.created_at || '0');
      const bd = b.doc_date || (b.year ? `${b.year}-01-01` : b.created_at || '0');
      return bd.localeCompare(ad);
    });

    // 4) Invoices by kt (digits) fyrir allan hópinn
    let invoices = [];
    const ktOr = [];
    for (const b of groupBases) {
      const d = (b.kennitala || '').replace(/\D/g, '');
      if (d.length === 10) { ktOr.push(`kt_greidanda.eq.${d.slice(0, 6)}-${d.slice(6)}`, `kt_greidanda.eq.${d}`); }
    }
    if (ktOr.length) {
      const rIn = await sbGet(
        `invoices?or=(${ktOr.join(',')})` +
        `&select=tilvisun,source,customer_name,kt_greidanda,utgafudagur,gjalddagi,eindagi,hofudstoll,upphaed_total,status,greidsla_date,worksite_match,imported_at` +
        `&order=gjalddagi.desc.nullslast&limit=800`
      );
      if (rIn.ok) invoices = await rIn.json();
    }

    // 5) Tæki (uttaeki = slökkvitæki) og brunakerfis-skýrslur, talið per byggingu
    const taekiPerSite = {}, bkPerSite = {}, bkArPerSite = {};
    if (siteIds.length) {
      const ut = await sbGet(`uttaeki?fyrirtaeki_id=in.(${siteIds.join(',')})&select=fyrirtaeki_id&limit=20000`).then(r => r.json()).catch(() => []);
      for (const u of (ut || [])) taekiPerSite[u.fyrirtaeki_id] = (taekiPerSite[u.fyrirtaeki_id] || 0) + 1;
      const bk = await sbGet(`brunakerfi_skyrslur?fyrirtaeki_id=in.(${siteIds.join(',')})&select=fyrirtaeki_id,year&limit=2000`).then(r => r.json()).catch(() => []);
      for (const x of (bk || [])) { bkPerSite[x.fyrirtaeki_id] = (bkPerSite[x.fyrirtaeki_id] || 0) + 1; if (x.year) (bkArPerSite[x.fyrirtaeki_id] = bkArPerSite[x.fyrirtaeki_id] || []).push(x.year); }
    }
    const yearNow = new Date().getUTCFullYear();
    const uttektAr = {};   // nýjasta úttektarár per stað (slökkvitæki-skýrsla)
    for (const d of docs) {
      if (d.doc_type === 'uttektarskyrsla' && !d.is_duplicate && d.fyrirtaeki_id) {
        const y = d.year || (d.doc_date ? Number(d.doc_date.slice(0, 4)) : null);
        if (y && (!uttektAr[d.fyrirtaeki_id] || y > uttektAr[d.fyrirtaeki_id])) uttektAr[d.fyrirtaeki_id] = y;
      }
    }
    for (const s of sites) {
      s.slokkvitaeki_taeki = taekiPerSite[s.id] || 0;
      s.brunakerfi_skyrslur = bkPerSite[s.id] || 0;
      s.last_uttekt_year = uttektAr[s.id] || null;
      // þjónustulínur per byggingu — AFLEIDD staða (uttaeki/úttekt = slökkvitæki, brunakerfi_skyrslur/doc = brunakerfi),
      // + handvirka merkið thjonusta_brunakerfi (sett af prófílnum). Aldrei skrifað hér.
      s.svc_slokkvitaeki = (s.slokkvitaeki_taeki > 0) || !!s.last_uttekt_year;
      s.svc_brunakerfi = (s.brunakerfi_skyrslur > 0) || s.thjonusta_brunakerfi === true
        || docs.some(d => d.doc_type === 'brunakerfi' && d.fyrirtaeki_id === s.id);
    }

    // 6) Netföng — SAMEINUÐ úr öllum byggingum (kunnaskra: lénið er áreiðanlegasti
    // lykillinn). Toppsendandi fundinn með raunfærslum í email_digest (12 mán).
    const emailsAgg = aggregateEmails(groupBases, sites);
    const comms = await fetchComms(emailsAgg.list.map(e => e.addr), sites, siteIds);
    // Raða netföngum: toppsendandi fyrst
    if (comms.top_address) {
      const i = emailsAgg.list.findIndex(e => e.addr === comms.top_address);
      if (i > 0) { const [t] = emailsAgg.list.splice(i, 1); t.top = true; emailsAgg.list.unshift(t); }
      else if (i === 0) emailsAgg.list[0].top = true;
    }

    // 7) Samantekt (hópur)
    const summary = buildSummary(docs, invoices, sites);
    const slokkvitaeki_taeki_total = sites.reduce((a, s) => a + (s.slokkvitaeki_taeki || 0), 0);
    const brunakerfi_skyrslur_total = sites.reduce((a, s) => a + (s.brunakerfi_skyrslur || 0), 0);
    const bk_skyrslur_ar = sites.reduce((a, s) => a + (bkArPerSite[s.id] || []).filter(y => y === yearNow).length, 0);
    const slokk_skyrslur_ar = docs.filter(d => d.doc_type === 'uttektarskyrsla' && !d.is_duplicate && (d.year === yearNow || (d.doc_date || '').startsWith(String(yearNow)))).length;
    const reikn_ar = docs.filter(d => d.doc_type === 'reikningur' && (d.year === yearNow || (d.doc_date || '').startsWith(String(yearNow))));
    const ars_tekjur_m_vsk = reikn_ar.reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const services = {
      slokkvitaeki: sites.some(s => s.svc_slokkvitaeki),
      brunakerfi: sites.some(s => s.svc_brunakerfi),
    };
    const contact = {
      simi: (sites.find(s => s.simi) || {}).simi || (sites.find(s => s.farsimi) || {}).farsimi || base.simi || base.contact_phone || null,
      tengilidur: (sites.find(s => s.tengilidur) || {}).tengilidur || null,
    };
    Object.assign(summary, {
      byggingar: sites.length,
      sites_total: sites.length,
      slokkvitaeki_taeki_total, brunakerfi_skyrslur_total,
      slokk_skyrslur_ar, bk_skyrslur_ar,
      ars_tekjur_m_vsk: Math.round(ars_tekjur_m_vsk), ars_reikningar: reikn_ar.length,
    });

    const group = {
      rekstrarfelag: rekstrarfelag || null,
      is_group,
      name: rekstrarfelag || base.nafn || null,
      bases: groupBases.map(b => ({ id: b.id, nafn: b.nafn, kennitala: b.kennitala, general_notes: b.general_notes || null })),
      primary_base_id: base.id,
    };

    const last_contact = comms.last_contact;
    const ai_flags = computeFlags({ base, sites, docs, invoices, summary, last_contact });

    return json(200, {
      generated_at: new Date().toISOString(),
      base, group, sites, docs, invoices, summary, ai_flags, last_contact,
      emails: emailsAgg, comms, services, contact,
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
// Öll netföng rekstrarfélagsins, sameinuð úr byggingum (fyrirtaeki.netfang) og
// bösum (contact_email/netfang). Skilar einstökum lista — toppsendandinn er
// merktur síðar með raunfærslum úr email_digest.
function aggregateEmails(groupBases, sites) {
  const seen = new Set(), list = [];
  const push = (addr) => { const a = cleanEmail(addr); if (!a || seen.has(a) || /@(brunaholf|eldklar|slokkvitaeki)\./.test(a)) return; seen.add(a); list.push({ addr: a, top: false, faerslur: 0 }); };
  for (const s of sites) splitEmails(s.netfang).forEach(push);
  for (const b of groupBases) { splitEmails(b.netfang).forEach(push); splitEmails(b.contact_email).forEach(push); }
  return { list, count: list.length };
}

// Samskiptamælirinn — bundinn við toppsendanda (26.11.2026, í stað lénaleitar sem
// skilaði „engir póstar á @benni.is"). Telur raunfærslur úr email_digest fyrir
// hvert netfang (12 mán), finnur þann sem sendir mest, les nýjasta innpóst hans og
// hvort honum sé svarað. „Opnar beiðnir" = ósvaraðir innþræðir frá þessum netföngum.
async function fetchComms(addresses, sites, siteIds) {
  const addrs = [...new Set((addresses || []).map(cleanEmail).filter(Boolean))];
  const out = { top_address: null, faerslur_12man: 0, osvarad: 0, opnar_beidnir: 0, last_contact: null, per_address: {} };
  if (!addrs.length) return out;
  const fra = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const inList = addrs.map(e => `"${e}"`).join(',');
  let rows = [];
  try {
    rows = await sbGet(
      `email_digest?select=sender_email,to_addresses,subject,snippet,received_at,folder` +
      `&sender_email=in.(${inList})&received_at=gte.${fra}T00:00:00Z&order=received_at.desc&limit=400`
    ).then(r => r.ok ? r.json() : []);
  } catch (_) { rows = []; }
  // Teldu sendingar per netfang (ekki SENT)
  for (const m of rows) {
    if (String(m.folder || '').toUpperCase() === 'SENT') continue;
    const a = cleanEmail(m.sender_email); if (!addrs.includes(a)) continue;
    out.per_address[a] = (out.per_address[a] || 0) + 1; out.faerslur_12man++;
  }
  // Toppsendandi (flestar færslur); jafntefli → fyrsta netfangið í lista
  let top = null, best = -1;
  for (const a of addrs) { const n = out.per_address[a] || 0; if (n > best) { best = n; top = a; } }
  out.top_address = top;
  // Nýjasti innpóstur toppsendandans + hvort svarað
  const inbound = rows.find(m => String(m.folder || '').toUpperCase() !== 'SENT' && cleanEmail(m.sender_email) === top);
  if (inbound) {
    let replied = false;
    try {
      const sentRows = await sbGet(
        `email_digest?select=to_addresses,received_at&folder=eq.SENT&received_at=gte.${encodeURIComponent(inbound.received_at || '')}&order=received_at.desc&limit=200`
      ).then(r => r.ok ? r.json() : []);
      replied = sentRows.some(s => { const to = Array.isArray(s.to_addresses) ? s.to_addresses : String(s.to_addresses || '').split(/[,;]/); return to.some(t => cleanEmail(t) === top); });
    } catch (_) {}
    out.last_contact = { from: top, subject: inbound.subject || '', snippet: (inbound.snippet || '').slice(0, 280), received_at: inbound.received_at || null, unreplied: !replied };
  }
  // Ósvarað: fjöldi netfanga með innpóst sem enginn SENT-póstur svarar (gróf tala)
  // Opnar beiðnir: field_entries kind beidni án status closed/done fyrir þessar byggingar
  try {
    const wsNames = [...new Set((sites || []).map(s => s.nafn).filter(Boolean))];
    if (wsNames.length) {
      const orWs = wsNames.slice(0, 30).map(n => `worksite_name.ilike.${encodeURIComponent('*' + n.replace(/[*(),]/g, ' ').trim() + '*')}`).join(',');
      const be = await sbGet(`field_entries?select=id,status&kind=eq.beidni&or=(${orWs})&limit=200`).then(r => r.ok ? r.json() : []).catch(() => []);
      out.opnar_beidnir = (be || []).filter(b => !/clos|lokid|done|klarad|búi/i.test(String(b.status || ''))).length;
    }
  } catch (_) {}
  out.osvarad = out.last_contact && out.last_contact.unreplied ? 1 : 0;
  return out;
}

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

function buildSummary(docs, invoices, sites) {
  const by_type = { uttektarskyrsla: 0, reikningur: 0, samningur: 0, annad: 0 };
  const by_year_type = {};
  let dup_count = 0, unreviewed_count = 0, missing_doc_date = 0, missing_file = 0;
  let last_uttekt_year = null, last_reikningur_year = null;
  let reikningur_amount_total = 0;
  const yearNow = new Date().getUTCFullYear();
  const liveSites = (sites || []).filter(s => s.er_i_thjonustu === true);
  const covered = new Set();

  for (const d of docs) {
    const t = d.doc_type || 'annad';
    by_type[t] = (by_type[t] || 0) + 1;
    const y = d.year || (d.doc_date ? Number(d.doc_date.slice(0, 4)) : null);
    if (y) {
      by_year_type[y] = by_year_type[y] || { uttektarskyrsla: 0, reikningur: 0, samningur: 0 };
      by_year_type[y][t] = (by_year_type[y][t] || 0) + 1;
      if (t === 'uttektarskyrsla' && !d.is_duplicate) {
        if (!last_uttekt_year || y > last_uttekt_year) last_uttekt_year = y;
        if (y >= yearNow) {
          if (d.fyrirtaeki_id) covered.add(Number(d.fyrirtaeki_id));
          else if (liveSites.length === 1) covered.add(Number(liveSites[0].id));
        }
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

  const sites_in_service = liveSites.length;
  const sites_with_2026_uttekt = liveSites.filter(s => covered.has(Number(s.id))).length;
  // Charlize: grænt á félaginu aðeins ef ALLIR þjónustustaðir eiga skýrslu þessa árs
  // á sínu fyrirtaeki_id. Ein skýrsla á Grandi málar ekki Klöpp.
  const has_2026_uttekt = sites_in_service > 0 && sites_with_2026_uttekt === sites_in_service;

  return {
    docs_total: docs.length,
    by_type, by_year_type,
    dup_count, unreviewed_count, missing_doc_date, missing_file,
    has_2026_uttekt, last_uttekt_year, last_reikningur_year,
    sites_in_service, sites_with_2026_uttekt,
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

  // Missing yearly inspection — per STAÐUR, ekki per kennitala
  if (base.er_i_thjonustu) {
    const nLive = summary.sites_in_service || 0;
    const nOk = summary.sites_with_2026_uttekt || 0;
    if (nLive > 1 && nOk < nLive) {
      f.push({
        severity: 'warn',
        msg: `${nLive - nOk} af ${nLive} stöðum vantar úttektarskýrslu ${yearNow}`,
        hint: 'Þekja er per stað — skýrsla á einu húsi rekstrarfélags telst ekki á hinum.',
      });
    } else if (!summary.has_2026_uttekt && (summary.last_uttekt_year || 0) < yearNow) {
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

// ── Vörður (Powerplan lota 13, 17.11.2026): innskráning (hub_user) eða tóki (x-hub-toki / _hubtoki) — sjá _vord.js ──
{ const _V = require('./_vord'); exports._innra = exports.handler; exports.handler = _V.vafinn(exports.handler, { fall: 'customer' }); }
