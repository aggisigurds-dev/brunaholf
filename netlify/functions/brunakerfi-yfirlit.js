// brunakerfi-yfirlit.js — STAÐA á brunakerfis-yfirliti, per STAÐUR.
//
//   GET /api/brunakerfi-yfirlit
//     → { year, generated_at, counts, months, rows, unplaced, leaks }
//
// Charlize: „Skoðað YYYY" er AÐEINS brunakerfi-PDF á þessum fyrirtaeki_id.
// Úttektarskýrsla (slökkvitæki), document_pairs, kennitala-systkini og
// arsskodun_customers.field_inspected_year mála EKKI grænt. Ein 2026-skýrsla
// á Center Hótel Grandi málar ekki Klöpp. Óstaðsett skjal (fyrirtaeki_id null)
// er skilað í `unplaced` — aldrei dreift á alla staði félagsins.
//
// Alheimur: staðir í app_settings.brunakerfi_customers EÐA með brunakerfi-skjal.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function yearBoxes(yearNow) {
  return [yearNow - 3, yearNow - 2, yearNow - 1, yearNow];
}
const MONTHS_IS = ['', 'jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(s, p) {
  return { statusCode: s, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(p) };
}

function digits(s) {
  return String(s == null ? '' : s).replace(/\D/g, '');
}
function docHasFile(d) {
  const p = String(d.storage_path || '');
  if (/^https?:\/\//i.test(p) && !/\.html(\?|#|$)/i.test(p)) return true;
  return !!(d.drive_file_id);
}
function docUrl(d) {
  const p = String(d.storage_path || '');
  if (/^https?:\/\//i.test(p) && !/\.html(\?|#|$)/i.test(p)) return p;
  if (d.drive_file_id) return 'https://brunaholf.netlify.app/api/skjal?id=' + encodeURIComponent(d.drive_file_id);
  return null;
}
function docYear(d) {
  const y = Number(d.year || 0);
  if (y >= 2000 && y <= 2100) return y;
  const m = /^(\d{4})/.exec(String(d.doc_date || ''));
  return m ? Number(m[1]) : 0;
}
function docMonth(d) {
  const m = /^\d{4}-(\d{2})/.exec(String(d.doc_date || ''));
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}

function pickLatest(docs) {
  let best = null, bestKey = '';
  for (const d of docs) {
    const ds = d.doc_date || (docYear(d) ? docYear(d) + '-01-01' : '');
    if (!ds) continue;
    if (ds > bestKey) { bestKey = ds; best = d; }
  }
  return best;
}

function stadaOf(years, yearNow, lastYear) {
  if (years[yearNow]) return { code: 'skodad', label: 'Skoðað ' + yearNow };
  if (lastYear) return { code: 'vantar', label: 'Vantar ' + yearNow };
  return { code: 'engin', label: 'Engin skýrsla' };
}

exports._test = { docHasFile, docUrl, docYear, docMonth, pickLatest, stadaOf, yearBoxes };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const yearNow = Number(p.year) || new Date().getUTCFullYear();
  const yearsWanted = yearBoxes(yearNow);

  let bruMap = {};
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=settings`, { headers: hdr() });
    const j = await r.json();
    bruMap = ((j[0] && j[0].settings) || {}).brunakerfi_customers || {};
  } catch (_) {}

  let fyr, docs;
  try {
    [fyr, docs] = await Promise.all([
      fetchAll('fyrirtaeki', 'select=id,nafn,kennitala,heimilisfang,customer_base_id,er_i_thjonustu,deleted_at&deleted_at=is.null'),
      fetchAll('customer_documents',
        'select=id,doc_type,year,doc_date,fyrirtaeki_id,customer_base_id,drive_file_id,storage_path,is_duplicate,customer_name' +
        '&or=(doc_type.eq.brunakerfi,doc_type.eq.uttektarskyrsla)&is_duplicate=eq.false'),
    ]);
  } catch (e) {
    return json(502, { error: e.message });
  }

  const byId = {};
  fyr.forEach((s) => { byId[s.id] = s; });

  const siteIds = new Set();
  Object.keys(bruMap).forEach((k) => {
    const id = Number(k);
    if (id && bruMap[k] && byId[id]) siteIds.add(id);
  });

  const unplaced = [];
  const bkBySite = {};
  const utBySite = {};
  docs.forEach((d) => {
    const sid = d.fyrirtaeki_id;
    if (d.doc_type === 'brunakerfi') {
      if (sid == null) {
        unplaced.push({
          id: d.id, year: docYear(d) || null, doc_date: d.doc_date || null,
          name: d.customer_name || '', has_file: docHasFile(d),
        });
        return;
      }
      if (!byId[sid]) return;
      siteIds.add(sid);
      (bkBySite[sid] = bkBySite[sid] || []).push(d);
    } else if (d.doc_type === 'uttektarskyrsla' && sid != null) {
      const y = docYear(d);
      if (y) {
        const cur = utBySite[sid] || 0;
        if (y > cur) utBySite[sid] = y;
      }
    }
  });

  // Systkini á sömu kennitölu — AÐEINS til að merkja lekann, aldrei til að mála grænt.
  const sitesByKt = {};
  siteIds.forEach((id) => {
    const kt = digits(byId[id] && byId[id].kennitala);
    if (kt.length === 10) (sitesByKt[kt] = sitesByKt[kt] || []).push(id);
  });

  const months = { 0: 0 };
  for (let m = 1; m <= 12; m++) months[m] = 0;
  const counts = { all: 0, skodad: 0, vantar: 0, engin: 0 };
  let leakUttekt = 0, leakKt = 0;

  const rows = [];
  [...siteIds].forEach((id) => {
    const s = byId[id];
    const bk = bkBySite[id] || [];
    const withFile = bk.filter(docHasFile);
    const years = {};
    yearsWanted.forEach((y) => { years[y] = null; });
    withFile.forEach((d) => {
      const y = docYear(d);
      if (!yearsWanted.includes(y)) return;
      if (!years[y]) years[y] = docUrl(d);
    });
    const latest = pickLatest(withFile);
    const lastYear = latest ? docYear(latest) : null;
    const lastMonth = latest ? docMonth(latest) : null;
    const st = stadaOf(years, yearNow, lastYear);
    const uttektYear = utBySite[id] || null;
    const falseIfUttekt = st.code !== 'skodad' && uttektYear === yearNow;
    const kt = digits(s.kennitala);
    const siblingHas = (sitesByKt[kt] || []).some((oid) => {
      if (oid === id) return false;
      return (bkBySite[oid] || []).some((d) => docHasFile(d) && docYear(d) === yearNow);
    });
    const falseIfKt = st.code !== 'skodad' && siblingHas;
    if (falseIfUttekt) leakUttekt++;
    if (falseIfKt) leakKt++;

    counts.all++;
    counts[st.code] = (counts[st.code] || 0) + 1;
    const monthKey = lastMonth || 0;
    months[monthKey] = (months[monthKey] || 0) + 1;

    rows.push({
      id,
      nafn: s.nafn || '',
      heimilisfang: s.heimilisfang || '',
      kennitala: s.kennitala || '',
      base_id: s.customer_base_id || null,
      i_thjonustu: s.er_i_thjonustu === true,
      years,
      last_year: lastYear,
      last_month: lastMonth,
      last_date: latest ? (latest.doc_date || null) : null,
      docs: withFile.length,
      stada: st.code,
      stada_label: st.label,
      uttekt_year: uttektYear,
      false_if_uttekt: falseIfUttekt,
      false_if_kt: falseIfKt,
    });
  });

  rows.sort((a, b) => {
    const g = String(a.nafn || '').localeCompare(String(b.nafn || ''), 'is');
    if (g) return g;
    return String(a.heimilisfang || '').localeCompare(String(b.heimilisfang || ''), 'is');
  });

  return json(200, {
    year: yearNow,
    generated_at: new Date().toISOString(),
    counts,
    months,
    month_labels: MONTHS_IS,
    rows,
    unplaced,
    leaks: {
      uttekt_would_paint: leakUttekt,
      kt_sibling_would_paint: leakKt,
      unplaced_brunakerfi: unplaced.length,
    },
    rule: 'Skoðað YYYY = brunakerfi-PDF á þessum fyrirtaeki_id. Slökkvitækja-úttekt og kt-systkini mála ekki.',
  });
};

function hdr() {
  return { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
}
async function fetchAll(table, qs) {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: Object.assign(hdr(), { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) throw new Error(table + ': ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
