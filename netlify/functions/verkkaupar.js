// verkkaupar.js — allt um EINN verkkaupa (greiðanda) á einum stað, fyrir Viðskiptavini-flipann.
// Agnar 04.09.2026: „þetta sýnir rosa takmarkað — sýna helstu samskiptaatriði, hver staðan er,
// hvað var samið um, tölvupóst og kennitölu, og listun á kröfunum sem við höfum sent þeim".
//
//   GET  /api/verkkaupar                 → { rows:[{ name, kt, worksites, osent, ogreitt, greitt_ar,
//                                                    sidasta_krafa, sidustu_samskipti }] }
//   GET  /api/verkkaupar?name=<nafn>     → { info, worksites, krofur, drog, samskipti, samtals }
//   POST /api/verkkaupar  { customer_name, ...customer_info reitir }  → upsert (m.a. general_notes)
//
// Heimildir: pricing_guide (samningurinn — taxtar, þröskuldur, gjöld), customer_info (kennitala,
// netfang, sími, greiðsluskilmálar, minnispunktar), invoices (kröfur sem hafa verið sendar),
// invoice_drafts (ósent), email_digest (samskipti sem nefna verkstaðina eða greiðandann),
// customer_worksite_map (verkstaðir sem eru tengdir handvirkt).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INFO_FIELDS = ['kennitala', 'payment_method', 'payment_terms', 'retention_pct', 'retention_notes',
  'contact_email', 'contact_phone', 'general_notes'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '');
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  try {
    if (event.httpMethod === 'POST') return await save(event);
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
    const q = event.queryStringParameters || {};
    return q.name ? await detail(String(q.name).trim()) : await list();
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

const kr = (n) => Math.round(Number(n) || 0);
const OSENT = (d) => (d.status || 'draft') === 'draft' && !d.merged_into && Number(d.total_m_vsk) > 0;
// invoices-staðan kemur úr tveimur innsogum og er ýmist á ensku eða íslensku
// ("PAID" og "Greidd" hlið við hlið) — normalísera svo greitt teljist ekki ógreitt.
const stada = (v) => {
  const s = String(v.status || '').trim().toUpperCase();
  // Kredit/afturköllun fyrst: kreditreikningur ber oft greiðsludag og reiknaðist
  // annars sem NEIKVÆÐ greiðsla („Greitt í ár −8,7 m.kr." hjá Eykt).
  if (/^(CREDIT|KREDIT|CANCELL|ANNULL)/.test(s) || Number(v.upphaed_total) < 0) return 'kredit';
  if (/^(PAID|GREIDD|GREITT)/.test(s) || v.greidsla_date) return 'greitt';
  return 'ogreitt';
};
// Sama krafan getur komið úr báðum innsogum — teljum hverja (gjalddaga, upphæð) einu sinni.
function dedupe(list) {
  const seen = new Set();
  return list.filter((v) => { const k = (v.gjalddagi || '') + '|' + kr(v.upphaed_total) + '|' + (v.tilvisun || ''); if (seen.has(k)) return false; seen.add(k); return true; });
}

async function list() {
  const [pg, info, inv, drafts, map] = await Promise.all([
    sb('pricing_guide?select=worksite_name,customer_name'),
    sb('customer_info?select=customer_name,kennitala,contact_email,last_payment_at'),
    sb('invoices?select=customer_name,upphaed_total,status,gjalddagi,greidsla_date,worksite_match,tilvisun'),
    sb('invoice_drafts?select=worksite_name,customer_name,total_m_vsk,status,merged_into,work_month'),
    sb('customer_worksite_map?select=customer_name,worksite_name,kt_greidanda'),
  ]);
  // verkstaður → greiðandi (verðskrá ræður, kortið fyllir í eyður)
  const wsOwner = {};
  for (const m of map) if (m.worksite_name && m.customer_name) wsOwner[m.worksite_name] = m.customer_name;
  for (const p of pg) if (p.worksite_name && p.customer_name) wsOwner[p.worksite_name] = p.customer_name;

  const acc = {};
  const get = (name) => (acc[name] = acc[name] || { name, kt: null, worksites: 0, osent: 0, ogreitt: 0, greitt_ar: 0, sidasta_krafa: null, sidustu_samskipti: null });
  for (const p of pg) if (p.customer_name) get(p.customer_name).worksites++;
  for (const m of map) if (m.customer_name) { const a = get(m.customer_name); if (!a.kt && m.kt_greidanda) a.kt = m.kt_greidanda; }
  for (const i of info) if (i.customer_name) { const a = get(i.customer_name); if (i.kennitala) a.kt = i.kennitala; }

  const ar = new Date().getFullYear();
  for (const v of dedupe(inv)) {
    if (!v.customer_name) continue;
    const a = get(v.customer_name);
    const s = stada(v);
    const upp = kr(v.upphaed_total);
    if (s === 'greitt' && String(v.greidsla_date || v.gjalddagi || '').slice(0, 4) === String(ar)) a.greitt_ar += upp;
    if (s === 'ogreitt' && upp > 0) a.ogreitt += upp;
    if (v.gjalddagi && (!a.sidasta_krafa || v.gjalddagi > a.sidasta_krafa)) a.sidasta_krafa = v.gjalddagi;
  }
  for (const d of drafts) {
    if (!OSENT(d)) continue;
    const name = d.customer_name || wsOwner[d.worksite_name];
    if (!name) continue;
    get(name).osent += kr(d.total_m_vsk);
  }
  const rows = Object.values(acc).sort((a, b) => (b.osent + b.ogreitt) - (a.osent + a.ogreitt) || a.name.localeCompare(b.name, 'is'));
  return json(200, { rows, generated_at: new Date().toISOString() });
}

async function detail(name) {
  const enc = encodeURIComponent(name);
  const [infoRows, pg, map, inv, drafts] = await Promise.all([
    sb(`customer_info?customer_name=eq.${enc}&select=*`),
    sb(`pricing_guide?customer_name=eq.${enc}&select=*`),
    sb(`customer_worksite_map?customer_name=eq.${enc}&select=*`),
    sb(`invoices?customer_name=eq.${enc}&select=*&order=gjalddagi.desc.nullslast&limit=200`),
    sb('invoice_drafts?select=*&order=work_month.desc'),
  ]);
  const info = infoRows[0] || { customer_name: name };
  const wsNames = [...new Set([...pg.map((p) => p.worksite_name), ...map.map((m) => m.worksite_name)].filter(Boolean))];
  const drog = drafts.filter((d) => OSENT(d) && (d.customer_name === name || wsNames.includes(d.worksite_name)))
    .map((d) => ({ worksite_name: d.worksite_name, work_month: d.work_month, total_m_vsk: kr(d.total_m_vsk), hours: Number(d.hours_dagvinna) || 0 }));

  // Samskipti: póstar sem nefna verkstaðina eða greiðandann (email_digest = brunaholf-pósthólfið)
  const orParts = [];
  const like = (s) => `*${String(s).replace(/[*,()]/g, ' ').trim()}*`;
  for (const w of wsNames.slice(0, 12)) { orParts.push(`subject.ilike.${like(w)}`); orParts.push(`snippet.ilike.${like(w)}`); }
  const first = name.split(/\s+/)[0];
  if (first && first.length > 3) { orParts.push(`sender_name.ilike.${like(first)}`); orParts.push(`subject.ilike.${like(first)}`); }
  let samskipti = [];
  if (orParts.length) {
    samskipti = await sb(`email_digest?select=id,sender_name,sender_email,subject,snippet,received_at,folder&or=(${orParts.join(',')})&order=received_at.desc&limit=25`).catch(() => []);
  }

  const inv2 = dedupe(inv);
  for (const v of inv2) v.stada = stada(v);
  const samtals = {
    krofur: inv2.length,
    ogreitt: inv2.filter((v) => v.stada === 'ogreitt').reduce((a, v) => a + kr(v.upphaed_total), 0),
    greitt: inv2.filter((v) => v.stada === 'greitt').reduce((a, v) => a + kr(v.upphaed_total), 0),
    osent: drog.reduce((a, d) => a + d.total_m_vsk, 0),
    verkstadir: wsNames.length,
  };
  return json(200, { info, worksites: pg, map, krofur: inv2, drog, samskipti, samtals, generated_at: new Date().toISOString() });
}

async function save(event) {
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const name = String(b.customer_name || '').trim();
  if (!name) return json(400, { error: 'customer_name vantar' });
  const row = { customer_name: name, updated_at: new Date().toISOString() };
  for (const f of INFO_FIELDS) if (b[f] !== undefined) row[f] = b[f] === '' ? null : b[f];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_info?on_conflict=customer_name`, {
    method: 'POST',
    headers: Object.assign(hdrs(), { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  const rows = await r.json();
  return json(200, { ok: true, info: rows[0] || row });
}

function hdrs() { return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }; }
async function sb(qs) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${qs}`, { headers: hdrs() });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
function resp(code, body, extra) { return { statusCode: code, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra || {}), body }; }
function json(code, obj) { return resp(code, JSON.stringify(obj)); }
