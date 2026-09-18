// ajour-yfirlit.js — yfirlit yfir ÖLL Ajour-verkefni: punktar per verkstað, þessi + síðasti mánuður.
//   GET /api/ajour-yfirlit → { generated_at, vel, months:[{month,total,projects:[{id,name,total,done,
//        created,completed,rejected,notApproved,newest,sample[]}]}], age_hours, stale }
//
// Ajour á ekkert opinbert API; talningin er sótt af brúartölvu (luna-bridge/ajour-yfirlit.js,
// vistuð innskráning, aðeins lestur) og geymd í app_kv['ajour_yfirlit']. Þetta fall les hana
// aðeins. Til að ENDURNÝJA: POST /api/ajour-yfirlit → setur beiðni í automation_triggers
// (workflow 'ajour-yfirlit') sem watcher á brúartölvu tekur innan mínútu.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_triggers`, {
      method: 'POST', headers: { ...H(), Prefer: 'return=representation' },
      body: JSON.stringify({ workflow: 'ajour-yfirlit', requested_by: 'hub-ajour' }),
    });
    if (!r.ok) return json(502, { error: 'Gat ekki sent beiðni á brúna: ' + r.status });
    const row = (await r.json())[0] || {};
    return json(200, { ok: true, trigger_id: row.id });
  }
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET/POST only' });

  const q = event.queryStringParameters || {};
  if (q.trigger) {   // staða beiðni: pending | running | done | error
    const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_triggers?id=eq.${encodeURIComponent(q.trigger)}&select=status,result`, { headers: H() });
    const row = r.ok ? (await r.json())[0] : null;
    return json(200, row || { status: 'unknown' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.ajour_yfirlit&select=value`, { headers: H() });
    if (!r.ok) throw new Error('app_kv: ' + r.status);
    const row = (await r.json())[0];
    if (!row || !row.value) return json(200, { empty: true, months: [] });
    const v = row.value;
    const ageH = v.generated_at ? (Date.now() - Date.parse(v.generated_at)) / 3600e3 : null;
    // Afköst per dag (Agnar 18.09.2026: „hvað þeir eru að ná mörgum punktum á dag þeir sem eru
    // þarna"): tengjum dagatalningu Ajour við Tímaveru sama dag á sama verkstað.
    v.tv = await timaveraPerDay(v).catch(() => ({}));
    return json(200, { ...v, age_hours: ageH != null ? Math.round(ageH * 10) / 10 : null, stale: ageH == null || ageH > 80 });
  } catch (e) { return json(502, { error: e.message }); }
};

// Ajour-verkefni ↔ Tímavera-verkstaður. Nöfnin eru skrifuð sitt á hvað (Skúlagata/Skùlagata,
// Stórhöfði 29/Stórhöfða29, Stangarhylur/Stangarhyl…) → berum saman fyrsta orðið án
// brodda: sameiginlegt forskeyti ≥6 stafir (eða allt orðið ef styttra). Tvö handvirk pör
// þar sem nöfnin eiga ekkert sameiginlegt. Svarið ber Tímaveru-nafnið svo pörunin SJÁIST.
const HANDPOR = { nlsh: 'landsspitalinn', borgarspitalinn: 'aland' };   // Borgarspítalinn = Áland 6 (staðfest af Agnari 18.09.2026)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae');
const firstWord = (s) => (norm(s).match(/[a-z]{3,}/) || [''])[0];
function samaStadur(ajourName, tvName) {
  const a = firstWord(ajourName);
  const bs = norm(tvName).match(/[a-z]{3,}/g) || [];   // hvaða orð sem er í Tímaveru-nafninu („Hrafnista Nesvellir 4")
  if (!a || !bs.length) return false;
  if (HANDPOR[a]) return bs[0].startsWith(HANDPOR[a]);
  return bs.some((b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i >= 5 && i >= Math.min(6, a.length, b.length); });
}
async function timaveraPerDay(v) {
  const days = Object.keys(v.daily || {}).sort();
  if (!days.length) return {};
  const names = new Map();
  for (const m of (v.months || [])) for (const p of (m.projects || [])) names.set(p.id, p.name);
  const rows = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/timavera_entries?select=date,project,employee,hours&date=gte.${days[0]}&order=date.asc`, {
      headers: { ...H(), Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error('timavera_entries ' + r.status);
    const page = await r.json(); rows.push(...page);
    if (page.length < 1000) break; from += 1000;
  }
  const tvProjects = [...new Set(rows.map((r) => String(r.project || '').trim()).filter(Boolean))]
    .filter((p) => !/veikindi|sick|slökkvit|slokkvit|almennt/i.test(p));
  const out = {};
  for (const [id, name] of names) {
    const match = tvProjects.filter((p) => samaStadur(name, p));
    if (!match.length) continue;
    const set = new Set(match), byDay = {};
    for (const r of rows) {
      if (!set.has(String(r.project || '').trim())) continue;
      const d = String(r.date).slice(0, 10);
      const o = byDay[d] || (byDay[d] = { klst: 0, menn: new Set() });
      o.klst += Number(r.hours) || 0; if (r.employee) o.menn.add(String(r.employee).trim());
    }
    out[id] = { timavera: match, days: Object.fromEntries(Object.entries(byDay).map(([d, o]) => [d, { klst: Math.round(o.klst * 100) / 100, menn: [...o.menn] }])) };
  }
  return out;
}

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
