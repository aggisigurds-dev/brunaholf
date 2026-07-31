// kerfisheilsa.js — ERU TENGINGARNAR LIFANDI? Eitt ljósaborð yfir alla lykla
// og aðganga sem kerfið stendur á.
//
//   GET /api/kerfisheilsa            → ÓDÝRT: staða úr grunni + geymdum prófunum.
//                                      ENGIN köll út úr húsi, svarar á ~200ms.
//   GET /api/kerfisheilsa?test=1     → PRÓFAR í alvöru (Google/Payday/dkPlus/
//                                      Tímavera) og geymir niðurstöðuna.
//   GET /api/kerfisheilsa?test=<id>  → prófar EINA tengingu.
//
// AF HVERJU ÞETTA ER TIL (2026-07-31, ósk Agnars)
// Tengi-takkarnir voru dreifðir um allt: Gmail í Bakendanum, Tímavera-lykillinn
// í öðru korti, Payday/dkPlus hvergi sýnileg. Þegar tenging dettur út (lykill
// rennur út, aðgangur afturkallaður) sást það ekki fyrr en gögn hættu að berast
// — oft dögum seinna. Hér er EITT borð: grænt = prófað og virkar, gult = tengt
// en eitthvað að athuga, rautt = ótengt eða prófun féll.
//
// ÖRYGGI: skilar ALDREI lyklum — aðeins hvort þeir séu til (`true/false`),
// hvenær þeir voru síðast notaðir og hvort prófun tókst. Prófanirnar eru
// les-aðgerðir (auth-handaband / probe) og skrifa aldrei í ytri kerfi.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KV_PROBES = 'kerfisheilsa_probes';

const GREEN = 'graent', AMBER = 'gult', RED = 'raudt', GREY = 'graat';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const test = (p.test || '').trim();

  try {
    const [accounts, kv, mailFresh, runs] = await Promise.all([
      googleAccounts(), kvAll(), newestMailPerAccount(), latestRuns(),
    ]);
    let probes = (kv[KV_PROBES] && typeof kv[KV_PROBES] === 'object') ? kv[KV_PROBES] : {};

    if (test) {
      const fresh = await runProbes(test, accounts, kv);
      probes = Object.assign({}, probes, fresh);
      await kvSet(KV_PROBES, probes);
    }

    const services = build(accounts, kv, mailFresh, runs, probes);
    const counts = services.reduce((a, s) => (a[s.status] = (a[s.status] || 0) + 1, a), {});
    return json(200, {
      ok: true,
      tested: test || null,
      checked_at: new Date().toISOString(),
      counts,
      services,
    });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

/* ───────────────────────── heimildir (ódýrt) ───────────────────────── */

async function googleAccounts() {
  const r = await sb('google_oauth?select=id,user_email,scope,refresh_token,updated_at&order=id');
  return (r || []).map(x => ({
    id: x.id, email: x.user_email, scope: x.scope || '',
    has_refresh: !!x.refresh_token, updated_at: x.updated_at,
  }));
}

async function kvAll() {
  const r = await sb('app_kv?select=key,value,updated_at');
  const out = {};
  (r || []).forEach(x => { out[x.key] = x.value; out['_ts_' + x.key] = x.updated_at; });
  return out;
}

// Nýjasti póstur per pósthólf — segir hvort innsogið sé raunverulega að skila
// sér, ekki bara hvort tengingin sé til.
async function newestMailPerAccount() {
  const r = await sb('email_digest?select=account,received_at&order=received_at.desc&limit=400');
  const out = {};
  (r || []).forEach(x => {
    const a = (x.account || '').toLowerCase();
    if (a && !out[a]) out[a] = x.received_at;
  });
  return out;
}

async function latestRuns() {
  const r = await sb('automation_runs?select=job_name,status,detail,finished_at&order=finished_at.desc&limit=200');
  const out = {};
  (r || []).forEach(x => { if (!out[x.job_name]) out[x.job_name] = x; });
  return out;
}

/* ───────────────────────── prófanir (kalla út) ───────────────────────── */

async function runProbes(which, accounts, kv) {
  const all = which === '1' || which === 'true' || which === 'all';
  const jobs = [];
  const add = (id, fn) => { if (all || which === id) jobs.push(wrap(id, fn)); };

  accounts.forEach(a => add('google:' + a.email, () => probeGoogle(a)));
  add('payday', () => probePayday());
  add('dkplus', () => probeDkPlus());
  add('timavera', () => probeTimavera(kv));

  const res = await Promise.all(jobs);
  const out = {};
  res.forEach(r => { out[r.id] = { ok: r.ok, detail: r.detail, at: new Date().toISOString() }; });
  return out;
}

async function wrap(id, fn) {
  try {
    const detail = await withTimeout(fn(), 9000);
    return { id, ok: true, detail: detail || 'í lagi' };
  } catch (e) {
    return { id, ok: false, detail: String((e && e.message) || e).slice(0, 200) };
  }
}

// Google: skiptum refresh-token fyrir aðgangslykil. Það er RAUNPRÓFIÐ — ef
// aðgangur var afturkallaður eða lykilorði breytt fellur þetta strax.
async function probeGoogle(a) {
  if (!a.has_refresh) throw new Error('enginn refresh-lykill — tengja þarf aftur');
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID, secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error('GOOGLE_OAUTH_CLIENT_ID/SECRET vantar í umhverfið');
  const row = await sb(`google_oauth?id=eq.${a.id}&select=refresh_token`);
  const rt = row && row[0] && row[0].refresh_token;
  if (!rt) throw new Error('enginn refresh-lykill');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || ('HTTP ' + r.status));
  const s = (a.scope || '');
  const vantar = ['gmail.readonly', 'drive'].filter(x => s && s.indexOf(x) < 0);
  return 'aðgangslykill fékkst' + (vantar.length ? ' · NB heimildir vantar: ' + vantar.join(', ') : '');
}

async function probePayday() {
  const id = process.env.PAYDAY_CLIENT_ID, secret = process.env.PAYDAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PAYDAY_CLIENT_ID/SECRET vantar í umhverfið');
  const base = process.env.PAYDAY_API_BASE || 'https://api.payday.is';
  const path = process.env.PAYDAY_TOKEN_PATH || '/api/v1/oauth/token';
  const r = await fetch(base + path, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: id, clientSecret: secret, grantType: 'client_credentials' }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120));
  let j = {}; try { j = JSON.parse(t); } catch (_) {}
  if (!(j.access_token || j.accessToken || j.token)) throw new Error('svar án aðgangslykils');
  return 'aðgangslykill fékkst';
}

async function probeDkPlus() {
  const key = process.env.DKPLUS_API_KEY, company = process.env.DKPLUS_COMPANY;
  if (!key) throw new Error('DKPLUS_API_KEY vantar í umhverfið');
  if (!company) return 'lykill til staðar (DKPLUS_COMPANY ekki sett — beinn lykill notaður)';
  const base = process.env.DKPLUS_BASE || 'https://api.dkplus.is/api/v1';
  const r = await fetch(base + '/Token', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: JSON.stringify({ Company: company, Description: 'kerfisheilsa' }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120));
  let j = {}; try { j = JSON.parse(t); } catch (_) {}
  if (!j.Token) throw new Error('svar án Token');
  return 'lotu-lykill fékkst';
}

async function probeTimavera(kv) {
  const key = process.env.TIMAVERA_API_KEY || kv['timavera_api_key'] ||
    (kv['timavera_api_key'] && kv['timavera_api_key'].key) || '';
  const k = typeof key === 'string' ? key : (key && key.key) || '';
  if (!k) throw new Error('enginn API-lykill — límdu hann inn í Bakendi „🕒 Tímavera API"');
  const base = process.env.TIMAVERA_API_BASE || 'https://api.timavera.is/api/v1';
  const r = await fetch(base + '/employees', { headers: { authorization: 'Bearer ' + k } });
  if (r.status === 401 || r.status === 403) throw new Error('lykill hafnað (' + r.status + ') — líklega útrunninn');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return 'lykill gildur';
}

/* ───────────────────────── ljósin ───────────────────────── */

function build(accounts, kv, mailFresh, runs, probes) {
  const S = [];
  const pr = id => probes[id] || null;
  const now = Date.now();
  const days = iso => (!iso ? null : Math.floor((now - new Date(iso).getTime()) / 86400000));
  const env = n => !!process.env[n];

  // ── Pósthólf ─────────────────────────────────────────────
  const VAENT = ['eldklar@eldklar.is', 'bokhald@eldklar.is'];
  accounts.forEach(a => {
    const id = 'google:' + a.email, t = pr(id);
    const fersk = mailFresh[(a.email || '').toLowerCase()];
    const aldur = days(fersk);
    let status = t ? (t.ok ? GREEN : RED) : AMBER;
    let detail = t ? t.detail : 'aldrei prófuð héðan';
    if (status === GREEN && aldur != null && aldur > 7) {
      status = AMBER; detail += ' · nýjasti póstur ' + aldur + ' daga gamall';
    }
    if (!a.has_refresh) { status = RED; detail = 'enginn refresh-lykill — tengja þarf aftur'; }
    S.push({
      id, hopur: 'Pósthólf', heiti: a.email,
      undir: a.id === 1 ? 'Aðal-aðgangur · Drive + Sheets + Gmail' : 'Gmail-innsog',
      status, detail,
      talning: fersk ? { label: 'nýjasti póstur', dagar: aldur } : null,
      profad: t ? t.at : null,
      adgerdir: [
        { label: '⏱ Prófa', test: id },
        { label: '🔌 Tengja aftur', url: '/api/google-auth?account=' + encodeURIComponent(a.email) },
      ],
    });
  });
  VAENT.filter(e => !accounts.some(a => (a.email || '').toLowerCase() === e)).forEach(e => {
    S.push({
      id: 'google:' + e, hopur: 'Pósthólf', heiti: e, undir: 'Gmail-innsog',
      status: RED, detail: 'ekki tengt',
      adgerdir: [{ label: '🔌 Tengja', url: '/api/google-auth?account=' + encodeURIComponent(e) }],
    });
  });
  S.push({
    id: 'graph', hopur: 'Pósthólf', heiti: '@brunaholf.is (Office 365)',
    undir: 'Microsoft Graph', status: GREY,
    detail: 'ekki útfært enn — þessi pósthólf berast gegnum luna-bridge tölvuna',
  });

  // ── Greiðslur & bókhald ──────────────────────────────────
  const pdTok = kv['payday_oauth'] || {};
  const pdExp = pdTok && (pdTok.expires_at || pdTok.expiresAt);
  S.push(svc('payday', 'Greiðslur & bókhald', 'Payday — Brunahólf', 'Reikningar og kröfur',
    pr('payday'), env('PAYDAY_CLIENT_ID') && env('PAYDAY_CLIENT_SECRET'),
    'PAYDAY_CLIENT_ID/SECRET vantar', runs['payday-pull'], pdExp));
  S.push(svc('payday-slokk', 'Greiðslur & bókhald', 'Payday — Slökkvitæki', 'Sami aðgangur, eigin lyklaskyndiminni',
    pr('payday'), env('PAYDAY_CLIENT_ID') && env('PAYDAY_CLIENT_SECRET'),
    'PAYDAY_CLIENT_ID/SECRET vantar', runs['payday-pull-slokk'],
    (kv['payday_oauth_slokk'] || {}).expires_at));
  S.push(svc('dkplus', 'Greiðslur & bókhald', 'dkPlus', 'Bókhaldskerfi Slökkvitækja',
    pr('dkplus'), env('DKPLUS_API_KEY'), 'DKPLUS_API_KEY vantar', null, null));

  // ── Gagnaleiðslur ────────────────────────────────────────
  S.push(svc('timavera', 'Gagnaleiðslur', 'Tímavera API', 'Vinnufærslur beint úr Tímaveru',
    pr('timavera'), env('TIMAVERA_API_KEY') || !!kv['timavera_api_key'],
    'enginn API-lykill', runs['timavera-pull'], null));

  // ── Lyklar (bara til/ekki til — aldrei gildin) ────────────
  [['ANTHROPIC_API_KEY', 'Claude (AI-svör og samantektir)'],
   ['RESEND_API_KEY', 'Resend (útsendur póstur)'],
   ['EXTENSION_INGEST_TOKEN', 'Mail Pulse vafra-viðbót'],
   ['GOOGLE_OAUTH_CLIENT_ID', 'Google OAuth-auðkenni']].forEach(([n, heiti]) => {
    S.push({
      id: 'env:' + n, hopur: 'Lyklar', heiti, undir: n,
      status: env(n) ? GREEN : RED,
      detail: env(n) ? 'lykill til staðar' : 'vantar í umhverfið (Netlify → Environment variables)',
    });
  });

  return S;
}

function svc(id, hopur, heiti, undir, t, hasKey, vantarTexti, run, expiresAt) {
  let status, detail;
  if (!hasKey) { status = RED; detail = vantarTexti; }
  else if (!t) { status = AMBER; detail = 'lykill til staðar — aldrei prófaður héðan'; }
  else { status = t.ok ? GREEN : RED; detail = t.detail; }
  if (status === GREEN && run && run.status === 'error') {
    status = AMBER; detail += ' · síðasta keyrsla féll: ' + String(run.detail || '').slice(0, 80);
  }
  let talning = null;
  if (expiresAt) {
    const min = Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
    talning = { label: 'lykill rennur út', minutur: min };
    if (status === GREEN && min <= 0) { status = AMBER; detail += ' · lyklaskyndiminni útrunnið (endurnýjast sjálft)'; }
  }
  return {
    id, hopur, heiti, undir, status, detail, talning,
    profad: t ? t.at : null,
    sidasta_keyrsla: run ? { status: run.status, detail: run.detail, at: run.finished_at } : null,
    adgerdir: [{ label: '⏱ Prófa', test: id }],
  };
}

/* ───────────────────────── verkfæri ───────────────────────── */

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return [];
  return r.json().catch(() => []);
}
async function kvSet(key, value) {
  return fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json', prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  }).catch(() => null);
}
function withTimeout(pr, ms) {
  return Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('svaraði ekki innan ' + (ms / 1000) + 's')), ms))]);
}
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,OPTIONS',
  };
}
function resp(code, body, headers) { return { statusCode: code, headers: headers || {}, body }; }
function json(code, obj) {
  return resp(code, JSON.stringify(obj), Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()));
}
