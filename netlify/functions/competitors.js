// competitors.js — Full Icelandic market view: product prices, service prices,
// suppliers, alarm-system service competitors, and computed growth opportunities.
//
// Returns one JSON blob the page can render directly.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    const [comps, vorur, services, suppliers, alarmServices, meta] = await Promise.all([
      sb('competitor_prices?select=*&order=product_type.asc,size_kg.asc,size_l.asc,vendor.asc'),
      sb('vorur?select=id,nafn,verd_an_vsk,vsk_prosenta&order=id.asc'),
      sb('service_prices?select=*&order=service_kind.asc,product_type.asc,size_min.asc,vendor.asc'),
      sb('suppliers?select=*&order=vendor.asc'),
      sb('service_competitors?select=*&order=vendor.asc'),
      sb('competitor_meta?id=eq.1&select=*'),
    ]);

    const ours = vorur.map(v => ({
      id: v.id,
      name: v.nafn,
      price_incl_vat: Math.round(Number(v.verd_an_vsk || 0) * (1 + Number(v.vsk_prosenta || 24) / 100)),
    }));

    // ---------- PRODUCT GROUPS ----------
    const ourByType = {};
    for (const v of ours) {
      const cls = inferType(v.name);
      if (!cls) continue;
      const key = `${cls.type}|${cls.size}`;
      if (!ourByType[key]) ourByType[key] = v;
    }

    const groups = {};
    for (const c of comps) {
      const sizeLabel = c.size_kg ? `${c.size_kg} kg` : c.size_l ? `${c.size_l} l` : '—';
      const sizeKey   = c.size_kg ? `${c.size_kg}kg` : c.size_l ? `${c.size_l}l` : 'na';
      const groupKey  = `${c.product_type || 'annað'}|${sizeKey}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          type: c.product_type || 'annað',
          type_label: typeLabel(c.product_type),
          size_label: sizeLabel,
          size_key: sizeKey,
          our: null,
          competitors: [],
        };
      }
      groups[groupKey].competitors.push({
        vendor: c.vendor,
        name: c.product_name,
        url: c.product_url,
        price: Number(c.price_incl_vat),
        notes: c.notes,
        is_premium: (c.notes || '').toLowerCase().includes('hönnunarlit') || (c.notes || '').toLowerCase().includes('premium'),
      });
    }

    for (const key in groups) {
      const g = groups[key];
      const explicit = comps.find(c =>
        c.product_type === g.type &&
        ((c.size_kg && `${c.size_kg}kg` === g.size_key) || (c.size_l && `${c.size_l}l` === g.size_key)) &&
        c.our_match_id
      );
      let ourProduct = null;
      if (explicit) ourProduct = ours.find(v => v.id === explicit.our_match_id) || null;
      if (!ourProduct) ourProduct = ourByType[`${g.type}|${g.size_key}`] || null;
      if (ourProduct) {
        g.our = { id: ourProduct.id, name: ourProduct.name, price: ourProduct.price_incl_vat };
        for (const c of g.competitors) {
          c.diff_kr  = c.price - ourProduct.price_incl_vat;
          c.diff_pct = ourProduct.price_incl_vat ? Math.round((c.diff_kr / ourProduct.price_incl_vat) * 1000) / 10 : null;
        }
      }
      g.competitors.sort((a, b) => a.price - b.price);
    }

    const order = ['duft','lettvatn','vatn','abf','co2','annað'];
    const productGroups = Object.values(groups).sort((a, b) => {
      const oa = order.indexOf(a.type); const ob = order.indexOf(b.type);
      if (oa !== ob) return oa - ob;
      const sa = parseSize(a.size_label); const sb = parseSize(b.size_label);
      return sb - sa;
    });

    // ---------- SERVICE GROUPS ----------
    // Derive our service prices from vorur (rows containing "hleðsla" / "yfirferð")
    const ourServiceRows = [];
    for (const v of vorur) {
      const n = (v.nafn || '').toLowerCase();
      const kind = n.includes('hleðsla') ? 'hleðsla'
                : n.includes('hledsla') ? 'hleðsla'
                : n.includes('yfirferð') ? 'yfirferð'
                : n.includes('yfirferd') ? 'yfirferð'
                : null;
      if (!kind) continue;
      let type = null;
      if (/\bduft\b/.test(n)) type = 'duft';
      else if (/léttvatn|lettvatn|froða/.test(n)) type = 'lettvatn';
      else if (/\babf\b/.test(n)) type = 'abf';
      else if (/co2|co₂|kolsýru/.test(n)) type = 'co2';
      else if (/vatn/.test(n)) type = 'vatn';
      const sizeKg = (n.match(/(\d+(?:[.,]\d+)?)\s*kg/) || [])[1];
      const sizeL  = (n.match(/(\d+(?:[.,]\d+)?)\s*l\b/) || [])[1];
      const incl = Math.round(Number(v.verd_an_vsk || 0) * (1 + Number(v.vsk_prosenta || 24) / 100));
      ourServiceRows.push({
        vendor: 'Slökkvitæki ehf',
        service_kind: kind,
        product_type: type,
        size: sizeKg ? `${sizeKg}kg` : sizeL ? `${sizeL}l` : 'na',
        size_label: sizeKg ? `${sizeKg} kg` : sizeL ? `${sizeL} l` : '—',
        size_num: parseFloat(sizeKg || sizeL || 0),
        price: incl,
        name: v.nafn,
      });
    }

    // Group service rows by kind + type
    const serviceGroups = {};
    function addService(row) {
      const key = `${row.service_kind}|${row.product_type || 'misc'}`;
      if (!serviceGroups[key]) {
        serviceGroups[key] = {
          service_kind: row.service_kind,
          product_type: row.product_type,
          kind_label: serviceLabel(row.service_kind),
          type_label: typeLabel(row.product_type),
          rows: [],
        };
      }
      serviceGroups[key].rows.push(row);
    }
    for (const s of ourServiceRows) addService(s);
    for (const s of services) {
      const sizeLabel = s.size_label || (s.size_min == null ? '—'
        : (s.size_min === s.size_max ? `${s.size_min} ${s.size_unit}` : `${s.size_min}–${s.size_max} ${s.size_unit}`));
      addService({
        vendor: s.vendor,
        service_kind: s.service_kind,
        product_type: s.product_type,
        size: s.size_unit ? `${s.size_min ?? ''}-${s.size_max ?? ''}${s.size_unit}` : 'na',
        size_label: sizeLabel,
        size_num: parseFloat(s.size_min || 0),
        price: Number(s.price_incl_vat),
        notes: s.notes,
      });
    }
    // Sort each group's rows by size then price
    for (const k in serviceGroups) {
      serviceGroups[k].rows.sort((a, b) => (a.size_num - b.size_num) || (a.price - b.price));
    }
    const serviceGroupsArr = Object.values(serviceGroups).sort((a, b) => {
      const ko = ['yfirferð','hleðsla','hreinsun','förgun'];
      const ka = ko.indexOf(a.service_kind), kb = ko.indexOf(b.service_kind);
      if (ka !== kb) return ka - kb;
      return order.indexOf(a.product_type) - order.indexOf(b.product_type);
    });

    // ---------- VENDOR SUMMARY ----------
    const vendorMap = {};
    for (const c of comps) {
      const v = vendorMap[c.vendor] = vendorMap[c.vendor] || { vendor: c.vendor, url: c.vendor_url, count: 0, total: 0 };
      v.count += 1;
      v.total += Number(c.price_incl_vat) || 0;
    }
    const vendors = Object.values(vendorMap)
      .map(v => ({ ...v, avg: v.count ? Math.round(v.total / v.count) : 0 }))
      .sort((a, b) => b.count - a.count);

    // ---------- HEADLINE ----------
    let cheaper = 0, midrange = 0, dearer = 0, comparable = 0;
    for (const g of productGroups) {
      if (!g.our || !g.competitors.length) continue;
      const standardComps = g.competitors.filter(c => !c.is_premium);
      if (standardComps.length === 0) continue;
      comparable++;
      const minC = Math.min(...standardComps.map(c => c.price));
      const maxC = Math.max(...standardComps.map(c => c.price));
      if (g.our.price < minC) cheaper++;
      else if (g.our.price > maxC) dearer++;
      else midrange++;
    }

    // ---------- OPPORTUNITIES ----------
    const opportunities = computeOpportunities(productGroups, serviceGroupsArr, ours, alarmServices);

    return json(200, {
      generated_at: new Date().toISOString(),
      last_scrape: meta && meta[0] ? meta[0].last_scrape : null,
      summary: {
        comparable,
        we_cheapest: cheaper,
        we_midrange: midrange,
        we_dearest: dearer,
        total_competitor_rows: comps.length,
        total_service_rows: services.length,
        total_vendors: vendors.length,
        total_suppliers: suppliers.length,
        total_alarm_services: alarmServices.length,
      },
      product_groups: productGroups,
      service_groups: serviceGroupsArr,
      vendors,
      suppliers,
      alarm_services: alarmServices,
      opportunities,
      raw: comps,
    });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

function computeOpportunities(productGroups, serviceGroups, ours, alarmServices) {
  const ops = [];

  // 1. Where we're meaningfully dearer
  for (const g of productGroups) {
    if (!g.our) continue;
    const std = g.competitors.filter(c => !c.is_premium);
    if (!std.length) continue;
    const cheapest = std[0];
    if (cheapest.price < g.our.price && (g.our.price - cheapest.price) >= 1500) {
      const pct = Math.round(((g.our.price - cheapest.price) / g.our.price) * 100);
      ops.push({
        kind: 'risk',
        title: `Við erum ${pct}% dýrari en ${cheapest.vendor} á ${g.type_label} ${g.size_label}`,
        detail: `Þeirra verð: ${formatKr(cheapest.price)} · Okkar: ${formatKr(g.our.price)}. Munur: ${formatKr(g.our.price - cheapest.price)}.`,
        action: 'Endurskoða verð eða leggja áherslu á þjónustu/áreiðanleika í markaðssetningu.',
      });
    }
  }

  // 2. Product gaps — competitors sell this type/size but we don't
  for (const g of productGroups) {
    if (g.our || !g.competitors.length || g.type === 'annað') continue;
    const std = g.competitors.filter(c => !c.is_premium);
    if (!std.length) continue;
    const avg = Math.round(std.reduce((a, c) => a + c.price, 0) / std.length);
    ops.push({
      kind: 'gap',
      title: `Við seljum ekki ${g.type_label} ${g.size_label}`,
      detail: `${std.length} samkeppnisaðil${std.length === 1 ? 'i' : 'ar'} bjóða þessa vöru á meðalverði ${formatKr(avg)}.`,
      action: 'Bæta þessari vöru í vörulistann — gæti aukið endursölu samhliða hleðslum.',
    });
  }

  // 3. Premium / designer market presence
  const hasPremium = productGroups.some(g => g.competitors.some(c => c.is_premium));
  const oursInPremium = ours.some(v => /(svart|svört|hvít|gull|kopar|króm|krom|matt)/i.test(v.name));
  if (hasPremium && !oursInPremium) {
    ops.push({
      kind: 'opportunity',
      title: 'Hönnunarmarkaður (gull/kopar/króm) er virkur',
      detail: 'Eldvarnamiðstöðin selur premium-litir á 2x–4x grunnverði (12.900 – 39.871 kr). Markhópur: hótel, veitingahús, heimili sem leggja áherslu á útlit.',
      action: 'Prufa eitt premium SKU (svartur eða króm) hjá samstarfshóteli/veitingahúsi.',
    });
  }

  // 4. Service gaps vs Eldvarnamiðstöðin
  for (const sg of serviceGroups) {
    const ours = sg.rows.filter(r => r.vendor === 'Slökkvitæki ehf');
    const comp = sg.rows.filter(r => r.vendor !== 'Slökkvitæki ehf');
    if (!ours.length || !comp.length) continue;
    // Compare matching sizes
    for (const o of ours) {
      const matching = comp.find(c => c.product_type === o.product_type && (c.size_label === o.size_label || c.size_num === o.size_num));
      if (matching && o.price > matching.price * 1.3) {
        const pct = Math.round(((o.price - matching.price) / matching.price) * 100);
        ops.push({
          kind: 'risk',
          title: `${sg.kind_label} ${o.product_type || ''} ${o.size_label}: ${pct}% dýrari en ${matching.vendor}`,
          detail: `Okkar: ${formatKr(o.price)} · ${matching.vendor}: ${formatKr(matching.price)}.`,
          action: 'Endurskoða þjónustuverð eða útskýra þjónustubreyttingar í tilboðum.',
        });
      }
    }
  }

  // 5. Alarm system service market — opportunities
  const monitoringHas = alarmServices.filter(s => s.has_monitoring).length;
  if (monitoringHas > 0) {
    ops.push({
      kind: 'opportunity',
      title: `Brunakerfis-þjónusta: ${alarmServices.length} aðilar á markaði, ${monitoringHas} með 24/7 vakt`,
      detail: 'Securitas + Öryggismiðstöðin eru ráðandi með vaktstöð. Bakvakt er hlutlaus þjónustuaðili (multi-brand). Volt þjónustar Alþingi.',
      action: 'Slökkvitæki gæti vaxið brunakerfis-þjónustu — sérstaklega hjá smærri húsfélögum sem vilja staðbundna þjónustu og forðast stóra vaktstöð.',
    });
  }

  return ops;
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function inferType(nafn) {
  const n = (nafn || '').toLowerCase();
  // Skip service rows
  if (n.includes('hleðsla') || n.includes('yfirferð') || n.includes('hledsla') || n.includes('yfirferd')) return null;
  // Type detection — broader than just extinguishers now
  let type = null;
  if (/\bduft\b/.test(n) && n.includes('slökkvit')) type = 'duft';
  else if ((n.includes('léttvatn') || n.includes('lettvatn')) && n.includes('slökkvit')) type = 'lettvatn';
  else if (/\babf\b/.test(n) && (n.includes('slökkvit') || n.includes('eldhús'))) type = 'abf';
  else if (/co2|co₂|kolsýru/.test(n) && n.includes('slökkvit')) type = 'co2';
  else if (n.includes('reykskynjari')) type = 'reykskynjari';
  else if (n.includes('hitaskynjari')) type = 'hitaskynjari';
  else if (n.includes('gasskynjari')) type = 'gasskynjari';
  else if (n.includes('eldvarnateppi') || n.includes('eldvarnarteppi')) type = 'eldvarnateppi';
  else if (n.includes('skyndihjálp')) type = 'skyndihjalp';
  else if (n.includes('brunaslöng') || n.includes('brunaslang')) type = 'brunaslanga';
  else if (n.includes('neyðarútgang') || n.includes('neyðarljós')) type = 'neydar';
  // Only accept if a type was inferred
  if (!type) return null;
  const mKg = n.match(/(\d+(?:[.,]\d+)?)\s*kg/);
  const mL  = n.match(/(\d+(?:[.,]\d+)?)\s*(?:l|lt|ltr|lítra|litra)\b/);
  let size = 'na';
  if (mKg) size = `${mKg[1].replace(',', '.')}kg`;
  else if (mL) size = `${mL[1].replace(',', '.')}l`;
  return { type, size };
}

function typeLabel(t) {
  return ({
    duft: 'Duftslökkvitæki',
    lettvatn: 'Léttvatn / Froða',
    vatn: 'Vatn',
    abf: 'ABF (eldhús)',
    co2: 'CO₂ / Kolsýra',
    reykskynjari: 'Reykskynjari',
    hitaskynjari: 'Hitaskynjari',
    gasskynjari: 'Gasskynjari',
    eldvarnateppi: 'Eldvarnateppi',
    skyndihjalp: 'Skyndihjálp',
    brunaslanga: 'Brunaslanga',
    neydar: 'Neyðarljós / útg.skilti',
    annað: 'Annað',
  })[t] || t;
}
function serviceLabel(k) {
  return ({
    hleðsla: 'Hleðsla',
    yfirferð: 'Yfirferð',
    förgun: 'Förgun',
    hreinsun: 'Hreinsun / þrif',
  })[k] || k;
}
function parseSize(label) {
  const m = label.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
function formatKr(n) {
  if (n == null) return '—';
  return Math.round(Number(n)).toLocaleString('is-IS') + ' kr';
}
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
