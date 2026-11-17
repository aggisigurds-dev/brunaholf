// _vord.js — sameiginlegt hlið fyrir föll Brunahólfs (Powerplan lota 13, 17.11.2026).
//
// TILEFNI: /api/krofu-yfirlit-bru svaraði ÓINNSKRÁÐUM með skuldunautalista (nöfn, kennitölur, upphæðir). Orsök:
// P.requireStaff (_portal.js) hleypir öllu í gegn þegar HUB_STAFF_PASSWORD er ekki sett — og það er ekki sett í
// loftinu. Repóin eru opin, svo slóðirnar eru öllum sýnilegar. Þetta hlið treystir ALDREI á HUB_STAFF_PASSWORD.
//
// NOTKUN (neðst í falli, vefur exports.handler án þess að breyta meginmáli hans):
//   { const _V = require('./_vord'); exports.handler = _V.vafinn(exports.handler, { fall: 'krofu-yfirlit-bru' }); }
//
// INN KEMST (OPTIONS fer alltaf í gegn — CORS-forspurn):
//   1. tóki: haus `x-hub-toki` EÐA færibreyta `_hubtoki` = <mínúta>.<HMAC-SHA256(session_secret, 'hub-api|'+mínúta)>,
//      gildir 10 mín. session_secret er úr hub_adgangar_stilling — SAMEIGINLEGUR báðum vefjum (eins og póst-tókinn í
//      hub-adgangar.js). ALDREI SUPABASE_SERVICE_ROLE_KEY: hann er ÓLÍKUR á vefjunum (lokun gmail-send afturkölluð
//      16.11.2026 af þeim sökum). Mynta: myntaToki(). Kallendur:
//        · önnur föll Brunahólfs — sjálfkrafa: fetch á eigin /api/ eða /.netlify/functions/ fær hausinn (sjá neðst);
//        · Slökkvitæki: /api/bh-toki (innskráning appsins krafin) → vafrinn bætir _hubtoki við köll hingað;
//        · innfelldar Brunahólfs-síður í appinu (iframe, kakan fylgir ekki) biðja appið um tóka (js/hub-bru.js).
//   2. innskráður starfsmaður: undirrituð kaka `hub_user` (sama sannprófun og postmoppur.js / odin.js / vefur-efni.js,
//      virkur notandi í hub_adgangar). Afrit af sannprófuninni, ekki require á hub-adgangar.js: _portal-hringtenging
//      gaf sama digest á Netlify og braut innskráningu (sjá audit-fall-mengi í slokkvitaeki).
//   Skrif: sjálfgefið nægir virkur starfsmaður (6 af 9 virkum notendum eru ekki Admin og vinna í þessum föllum);
//   föll sem eiga aðeins að vera fyrir stjórnanda fá { stjornandi: true } → 403 fyrir aðra.
//
// HAMUR (app_kv 'hub_vord') — FAIL-OPEN (endurhannað 17.11.2026 kvöld eftir að vörðurinn lamaði lotur):
//   { "hamur": "af" | "skraning" | "lokad", "lokud": [föll], "opin": [föll] }
//   af       = vörðurinn gerir EKKERT (engin athugun, engin skráning) — rofi án birtingar.
//   skraning = hleypir öllu í gegn STRAX; athugun og skráning (agent 'vord', action 'myndi_hafna') í bakgrunni.
//   lokad    = 401 / 403 — en AÐEINS þegar hamurinn hefur SANNARLEGA verið lesinn sem 'lokad' (eða fallið er á „lokud“).
//   „opin“ yfirtekur (hleypt strax), „lokud“ lokar einstöku falli þótt hamurinn sé skraning.
//   NÁIST HAMURINN EKKI (Supabase niðri, tímafall, röð vantar, rusl, óþekkt gildi) → hleypt í gegn og viðvörun skráð
//   (action 'hamur_olesanlegur' / 'hamur_ogildur'); ALDREI 401 af því stillingin náðist ekki. Síðasti gildi lestur
//   helst í minni tilviksins: eftir 60 s er hann notaður áfram og lesið aftur í bakgrunni (beðið aldrei). Milli
//   kaldræsinga er ekkert minni (/tmp og minni lifa aðeins í sama tilviki) — þá bíður fyrsta beiðnin mest
//   HAMUR_FRESTUR_MS (1,2 s) og hleypir svo í gegn meðan lesturinn klárast.
//
// BILAR (aðeins í lokuðum ham): innskráningarstillingar ólesanlegar → 503; gagnagrunnur svarar ekki → 502.
'use strict';
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE = 'hub_user';
const STJORNENDUR = ['Admin'];
const TOKI_HAUS = 'x-hub-toki';
const TOKI_QS = '_hubtoki';
const TOKI_GILDIR_MIN = 10;
const HAMUR_KV = 'hub_vord';
const APP_ORIGIN = 'https://slokkvitaeki.netlify.app';
const EIGIN_HOST = new Set(['brunaholf.netlify.app']);
try { if (process.env.URL) EIGIN_HOST.add(new URL(process.env.URL).host); } catch (_) {}
try { if (process.env.DEPLOY_PRIME_URL) EIGIN_HOST.add(new URL(process.env.DEPLOY_PRIME_URL).host); } catch (_) {}

const fetchUpphaflegt = globalThis.fetch;

// TÍMAÞAK (óháð rýni 17.11.2026): hangi Supabase má vörðurinn ekki halda kallinu þar til Netlify drepur það (10 s) —
// föll sem notuðu Supabase ekki áður eru nú háð honum. Hvert kall varðarins (svar OG meginmál) fær FRESTUR_MS; kapphlaup
// við teljara, svo hangandi fetch sem hunsar signal sleppur líka. Skráningarhamur: tímafall → beint í gegn (sjá hlid).
const FRESTUR_MS = Math.max(50, Number(process.env.HUB_VORD_FRESTUR_MS) || 2000);
async function sb(path, init = {}) {
  const ac = new AbortController();
  let teljari;
  const tima = new Promise((_, hafna) => {
    teljari = setTimeout(() => { try { ac.abort(); } catch (_) {} hafna(Object.assign(new Error('vord: Supabase svaraði ekki innan ' + FRESTUR_MS + ' ms'), { villa: 502 })); }, FRESTUR_MS);
  });
  try {
    const r = await Promise.race([fetchUpphaflegt(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init, signal: init.signal || ac.signal,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    }), tima]);
    const texti = await Promise.race([r.text(), tima]);
    return { ok: r.ok, status: r.status, text: async () => texti, json: async () => (texti ? JSON.parse(texti) : null) };
  } finally { clearTimeout(teljari); }
}
// Kapphlaup við heildarþak (innskráningarathugun í skráningarham) → { villa: 502, timi: true } ef of seint
function medThaki(loforð, ms) {
  let t;
  return Promise.race([loforð, new Promise((res) => { t = setTimeout(() => res({ villa: 502, timi: true }), ms); })]).finally(() => clearTimeout(t));
}

// ── stillingar innskráningar (session_secret) — 5 mín skyndiminni ──────────────────────────────────────────────
let _st = null, _stT = 0;
async function stilling() {
  if (_st && Date.now() - _stT < 300000) return _st;
  const r = await sb('hub_adgangar_stilling?id=eq.1&pw_hash=not.is.null&select=session_secret,pw_changed_at');
  if (!r.ok) throw Object.assign(new Error('stilling ' + r.status), { villa: 502 });
  const st = (await r.json())[0];
  if (!st || !st.session_secret) throw Object.assign(new Error('engin stilling'), { villa: 503 });
  _st = st; _stT = Date.now();
  return st;
}

// ── tóki ──────────────────────────────────────────────────────────────────────────────────────────────────────
const tokiSig = (secret, m) => crypto.createHmac('sha256', String(secret)).update('hub-api|' + m).digest('hex');
async function myntaToki(stillingGefin) {
  const st = stillingGefin || await stilling().catch(() => null);
  if (!st || !st.session_secret) return '';
  const m = Math.floor(Date.now() / 60000);
  return m + '.' + tokiSig(st.session_secret, m);
}
function tokiUrBeidni(event) {
  const h = (event && event.headers) || {};
  const qs = (event && event.queryStringParameters) || {};
  return String(h[TOKI_HAUS] || h[TOKI_HAUS.toUpperCase()] || qs[TOKI_QS] || '');
}
// Skjal-tóki (lota 13, 17.11.2026): kúnnagátt Slökkvitækis (gatt-doc.cjs) vísar kúnna á /api/skjal?id=… — kúnninn á
// hvorki köku né almennan tóka. gatt-doc hefur þegar sannreynt eignarhald skjalsins og myntar
//   st = <útrennsla-sek>.<HMAC-SHA256(session_secret, 'skjal|' + id + '|' + útrennsla)>   (hub-adgangar.cjs skjalToki)
// sem gildir aðeins fyrir ÞETTA skjal og í mest 15 mín. Opnar ekkert annað fall.
async function erGildurSkjalToki(id, st) {
  const [expStr, sig] = String(st || '').split('.');
  const exp = Number(expStr), nu = Math.floor(Date.now() / 1000);
  if (!id || !Number.isInteger(exp) || exp < nu || exp > nu + 900 || !/^[0-9a-f]{64}$/.test(sig || '')) return false;
  const s2 = await stilling();
  const rett = Buffer.from(crypto.createHmac('sha256', String(s2.session_secret)).update('skjal|' + String(id) + '|' + exp).digest('hex'), 'hex');
  const gefid = Buffer.from(sig, 'hex');
  return gefid.length === rett.length && crypto.timingSafeEqual(gefid, rett);
}
async function erGildurToki(t) {
  const [mStr, sig] = String(t || '').split('.');
  const m = Number(mStr), nu = Math.floor(Date.now() / 60000);
  if (!Number.isInteger(m) || m < nu - TOKI_GILDIR_MIN || m > nu + 1 || !/^[0-9a-f]{64}$/.test(sig || '')) return false;
  const st = await stilling();
  const rett = Buffer.from(tokiSig(st.session_secret, m), 'hex'), gefid = Buffer.from(sig, 'hex');
  return gefid.length === rett.length && crypto.timingSafeEqual(gefid, rett);
}

// ── kakan hub_user (sama og postmoppur.js notandi()) ─────────────────────────────────────────────────────────────
function kokur(event) {
  const hra = (event && event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const ut = {};
  String(hra).split(';').forEach((b) => {
    const i = b.indexOf('=');
    if (i < 1) return;
    try { ut[b.slice(0, i).trim()] = decodeURIComponent(b.slice(i + 1).trim()); } catch (e) { ut[b.slice(0, i).trim()] = ''; }
  });
  return ut;
}
// Notandaleit í hub_adgangar: 60 s skyndiminni per tilvik (óvirkjaður notandi missir aðgang innan mínútu)
const _notendur = new Map();
async function notandi(event) {
  const tok = kokur(event)[COOKIE];
  if (typeof tok !== 'string' || tok.length < 20 || tok.length > 2000) return { villa: 401 };
  const i = tok.indexOf('.');
  if (i < 1) return { villa: 401 };
  const st = await stilling();
  const gogn = tok.slice(0, i);
  const rett = crypto.createHmac('sha256', st.session_secret).update(gogn).digest();
  const gefid = Buffer.from(tok.slice(i + 1), 'base64url');
  if (gefid.length !== rett.length || !crypto.timingSafeEqual(gefid, rett)) return { villa: 401 };
  let p;
  try { p = JSON.parse(Buffer.from(gogn, 'base64url').toString('utf8')); } catch (e) { return { villa: 401 }; }
  if (!p || typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return { villa: 401 };
  if (String(p.v || '') !== String(st.pw_changed_at || '')) return { villa: 401 };
  const uid = p.uid;
  if (typeof uid !== 'number' || !Number.isInteger(uid) || uid < 1) return { villa: 401 };
  let n;
  const geymt = _notendur.get(uid);
  if (geymt && Date.now() - geymt.t < 60000) n = geymt.n;
  else {
    const u = await sb(`hub_adgangar?id=eq.${uid}&select=id,nafn,notandanafn,rola,virkur`);
    if (!u.ok) return { villa: 502 };
    n = (await u.json())[0] || null;
    _notendur.set(uid, { n, t: Date.now() });
  }
  if (!n || !n.virkur) return { villa: 401 };
  return { via: 'kaka', nafn: (String(n.nafn || '').trim().split(/\s+/)[0] || String(n.notandanafn || '') || 'Ónefndur').slice(0, 40), stjornandi: STJORNENDUR.includes(n.rola) };
}

// Hver spyr? → { via:'toki'|'kaka', nafn, stjornandi } eða { villa: 401|502|503 }
async function hver(event) {
  try {
    const t = tokiUrBeidni(event);
    if (t && await erGildurToki(t)) return { via: 'toki', nafn: 'þjónn', stjornandi: false }; // tóki = starfsmaður; stjórnandaföll krefjast Admin-köku
    return await notandi(event);
  } catch (e) {
    return { villa: e && e.villa ? e.villa : 502 };
  }
}

// ── hamur (FAIL-OPEN) ─────────────────────────────────────────────────────────────────────────────────────────────
// Skilar: 'af' | 'opid' (á opin-lista) | 'ovist' (hamur náðist ekki — hleypt) | 'skraning' | 'lokad' (sannarlega lesið).
const HAMUR_FRESTUR_MS = Math.max(50, Number(process.env.HUB_VORD_HAMUR_FRESTUR_MS) || 1200);
const HAMIR = new Set(['af', 'skraning', 'lokad']);
let _ham = null, _hamT = 0, _lestur = null, _lesturT = 0, _villaT = 0;
const gildurHamur = (v) => (v && typeof v === 'object' && !Array.isArray(v) && HAMIR.has(v.hamur) ? v : null);
function lesaHam() {
  if (_lestur) return _lestur;
  _lesturT = Date.now();
  _lestur = (async () => {
    let v, lesid = false;
    try {
      const r = await sb(`app_kv?key=eq.${HAMUR_KV}&select=value`);
      if (r.ok) { const j = await r.json(); v = Array.isArray(j) && j[0] ? j[0].value : null; lesid = true; }
    } catch (_) { lesid = false; }
    const g = gildurHamur(v);
    if (g) { _ham = g; _hamT = Date.now(); _villaT = 0; return _ham; }
    _villaT = Date.now();   // næsta tilraun eftir 10 s (sjá hamurFyrir) — síðasti gildi hamur, ef einhver, helst
    vidvorun(lesid ? 'hamur_ogildur' : 'hamur_olesanlegur', { gildi: !lesid ? 'lestur brást' : v === null ? 'röð vantar' : (v && typeof v === 'object' && !Array.isArray(v)) ? 'óþekktur hamur: ' + String(v.hamur).slice(0, 20) : typeof v, sidasti: _ham ? _ham.hamur : null });
    return _ham;
  })().catch(() => _ham).finally(() => { _lestur = null; });
  return _lestur;
}
async function hamurFyrir(fall) {
  const nu = Date.now();
  const maReyna = !_villaT || nu - _villaT > 10000;
  if (!_ham) {
    // kaldræsing: bíða mest HAMUR_FRESTUR_MS eftir lestri; annars hleypa (lesturinn heldur áfram fyrir næstu beiðni)
    // Lestur sem þegar er á leiðinni telur: önnur beiðni bíður aðeins það sem eftir er af þakinu, aldrei aftur heilt þak.
    const eftir = _lestur ? HAMUR_FRESTUR_MS - (nu - _lesturT) : HAMUR_FRESTUR_MS;
    if (maReyna && eftir > 0) {
      let t;
      await Promise.race([lesaHam(), new Promise((res) => { t = setTimeout(res, eftir); })]).finally(() => clearTimeout(t));
    }
    if (!_ham) return 'ovist';
  } else if (nu - _hamT > 60000 && maReyna) {
    lesaHam();   // endurnýja í bakgrunni; gamla gildið gildir á meðan
  }
  if (_ham.hamur === 'af') return 'af';
  const listi = (k) => (Array.isArray(_ham[k]) ? _ham[k] : []);
  if (listi('opin').includes(fall)) return 'opid';
  if (listi('lokud').includes(fall)) return 'lokad';
  return _ham.hamur === 'lokad' ? 'lokad' : 'skraning';
}

// ── skráning (mest ein lína per fall+uppruna+niðurstöðu á 10 mín hjá hverju tilviki) ──────────────────────────
const _skrad = new Map();
async function skra(fall, event, action, utkoma) {
  try {
    const h = (event && event.headers) || {};
    const origin = String(h.origin || h.Origin || '').slice(0, 80);
    let ref = String(h.referer || h.Referer || '');
    try { const u = new URL(ref); ref = u.host + u.pathname; } catch (_) { ref = ref.slice(0, 80); }
    const lykill = [fall, action, origin, ref].join('|');
    const t = _skrad.get(lykill);
    if (t && Date.now() - t < 600000) return;
    _skrad.set(lykill, Date.now());
    await sb('agent_logs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ agent: 'vord', action, target: fall, status: action === 'inn' ? 'ok' : 'hafnad', session_id: 'powerplan-lota13',
        input: { method: event.httpMethod, origin, ref, ua: String(h['user-agent'] || '').slice(0, 60) }, output: utkoma || null }),
    });
  } catch (_) { /* skráning má aldrei fella beiðni */ }
}

let _vidvT = {};
function vidvorun(action, output) {
  if (_vidvT[action] && Date.now() - _vidvT[action] < 600000) return;
  _vidvT[action] = Date.now();
  sb('agent_logs', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ agent: 'vord', action, target: HAMUR_KV, status: 'villa', session_id: 'powerplan-lota13', output }) }).catch(() => {});
}
function svar(status, body, event) {
  const h = (event && event.headers) || {};
  const origin = String(h.origin || h.Origin || '');
  const hausar = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (origin === APP_ORIGIN) { hausar['Access-Control-Allow-Origin'] = APP_ORIGIN; hausar.Vary = 'Origin'; }
  return { statusCode: status, headers: hausar, body: JSON.stringify(body) };
}
function hafnad(v, event) {
  if (v === 503) return svar(503, { error: 'AUTH_UNAVAILABLE', villa: 'Innskráning starfsmanna er ekki sett upp' }, event);
  if (v === 502) return svar(502, { error: 'AUTH_UNAVAILABLE', villa: 'Innskráning náðist ekki — reyndu aftur' }, event);
  if (v === 403) return svar(403, { error: 'FORBIDDEN', villa: 'Aðeins stjórnandi' }, event);
  return svar(401, { error: 'LOGIN_REQUIRED', need_login: true, login: '/adgangar.html', villa: 'innskraning' }, event);
}

// Hliðið sjálft → null (inn) eða svar. opidEf(event) → true = þessi beiðni er opin af ásetningi (t.d. kúnnaslóð með tóka).
// Forspurn frá Slökkvitækis-appinu sem vill senda x-hub-toki (haus í stað slóðar, svo tókinn lendi ekki í annálum):
// vörðurinn svarar henni sjálfur, því flest föll leyfa aðeins content-type í eigin forspurn.
function forspurnApps(event) {
  const h = (event && event.headers) || {};
  const origin = String(h.origin || h.Origin || '');
  const bed = String(h['access-control-request-headers'] || h['Access-Control-Request-Headers'] || '').toLowerCase();
  if (event.httpMethod !== 'OPTIONS' || origin !== APP_ORIGIN || !bed.split(',').map((x) => x.trim()).includes(TOKI_HAUS)) return null;
  return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': APP_ORIGIN, Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': bed.slice(0, 300), 'Access-Control-Max-Age': '600' }, body: '' };
}
async function hlid(event, { fall, stjornandi = false, opidEf = null } = {}) {
  if (!event) return null;
  if (event.httpMethod === 'OPTIONS') return forspurnApps(event);
  const hamur = await hamurFyrir(fall);
  if (hamur === 'af') return null;
  if (hamur !== 'lokad') {
    // FAIL-OPEN: skraning / opið / hamur óviss → fallið keyrir STRAX. Athugun og skráning í bakgrunni — tefja aldrei og
    // geta ekki fellt beiðnina. Óviss hamur (Supabase líklega niðri) er ekki athugaður frekar, svo álagið aukist ekki.
    if (hamur !== 'ovist') bakgrunnsathugun(fall, event, hamur, stjornandi, opidEf);
    return null;
  }
  // LOKAÐ (hamurinn lesinn sem slíkur). opidEf (t.d. skjal-tóki kúnnagáttar) fyrst.
  if (typeof opidEf === 'function') { try { if (await opidEf(event)) return null; } catch (_) {} }
  const h = await hver(event);   // hvert Supabase-kall hefur sitt þak (FRESTUR_MS); tímafall → 502
  let villa = h.villa || 0;
  if (!villa && stjornandi && !h.stjornandi) villa = 403;
  if (!villa) {
    if (h.via === 'toki') skra(fall, event, 'inn', { via: 'toki' });
    return null;
  }
  skra(fall, event, 'hafnad', { villa });   // bíður ekki
  return hafnad(villa, event);
}
function bakgrunnsathugun(fall, event, hamur, stjornandi, opidEf) {
  Promise.resolve().then(async () => {
    if (typeof opidEf === 'function') { try { if (await opidEf(event)) return; } catch (_) {} }
    const h = await medThaki(hver(event), FRESTUR_MS);
    let villa = h.villa || 0;
    if (!villa && stjornandi && !h.stjornandi) villa = 403;
    if (!villa) { if (h.via === 'toki') await skra(fall, event, 'inn', { via: 'toki' }); return; }
    await skra(fall, event, 'myndi_hafna', { villa, timi: !!h.timi, hamur });
  }).catch(() => { /* bakgrunnsathugun má aldrei fella neitt */ });
}

// Fjarlægir _hubtoki svo fallið sjálft sjái hann ekki (sum föll ítra yfir allar færibreytur)
function hreinsa(event) {
  if (!event) return event;
  const qs = event.queryStringParameters;
  if (qs && Object.prototype.hasOwnProperty.call(qs, TOKI_QS)) {
    const q2 = { ...qs }; delete q2[TOKI_QS];
    const m2 = event.multiValueQueryStringParameters ? { ...event.multiValueQueryStringParameters } : event.multiValueQueryStringParameters;
    if (m2) delete m2[TOKI_QS];
    let raw = event.rawQuery;
    if (typeof raw === 'string') raw = raw.split('&').filter((p) => p.split('=')[0] !== TOKI_QS).join('&');
    return { ...event, queryStringParameters: q2, multiValueQueryStringParameters: m2, rawQuery: raw };
  }
  return event;
}

function vafinn(handler, stillingar = {}) {
  if (typeof handler !== 'function') throw new Error('_vord.vafinn: handler vantar (' + stillingar.fall + ')');
  const vafid = async function (event, context, callback) {
    const g = await hlid(event, stillingar);
    if (g) return g;
    return handler(hreinsa(event), context, callback);
  };
  vafid._vord = stillingar.fall || true;
  return vafid;
}

// ── innri köll: fetch á eigin föll fær tókann sjálfkrafa ─────────────────────────────────────────────────────────
// (svid-status → worksites, krofu-yfirlit-bru → debtors, kostnadur → kostnadur-sync-background o.s.frv.)
function eiginFall(url) {
  try {
    const u = new URL(String(url));
    return EIGIN_HOST.has(u.host) && /^\/(api|\.netlify\/functions)\//.test(u.pathname);
  } catch (_) { return false; }
}
if (typeof fetchUpphaflegt === 'function' && !globalThis.__vordFetch) {
  globalThis.__vordFetch = true;
  globalThis.fetch = async function (input, init) {
    try {
      const url = typeof input === 'string' || input instanceof URL ? String(input) : (input && input.url);
      if (eiginFall(url)) {
        const t = await myntaToki();
        if (t) {
          // Venjulegur haus-hlutur helst venjulegur hlutur (kallendur og prófbúnaður lesa hann sem slíkan — CI 17.11.2026);
          // Headers / fylki → Headers.
          const h0 = (init && init.headers) || (input && typeof input === 'object' && !(input instanceof URL) && input.headers) || {};
          let hausar;
          if (h0 && typeof h0 === 'object' && !Array.isArray(h0) && !(typeof Headers === 'function' && h0 instanceof Headers)) {
            hausar = Object.keys(h0).some((k) => k.toLowerCase() === TOKI_HAUS) ? h0 : { ...h0, [TOKI_HAUS]: t };
          } else {
            hausar = new Headers(h0);
            if (!hausar.has(TOKI_HAUS)) hausar.set(TOKI_HAUS, t);
          }
          return fetchUpphaflegt(input, { ...(init || {}), headers: hausar });
        }
      }
    } catch (_) { /* fellur aftur á venjulegt kall */ }
    return fetchUpphaflegt(input, init);
  };
}

module.exports = { vafinn, hlid, hver, myntaToki, erGildurToki, erGildurSkjalToki, hamurFyrir, eiginFall, TOKI_HAUS, TOKI_QS, HAMUR_KV,
  _endurstilla() { _st = null; _stT = 0; _ham = null; _hamT = 0; _villaT = 0; _lestur = null; _lesturT = 0; _skrad.clear(); _notendur.clear(); _vidvT = {}; },
  _rennaUt() { _hamT = 0; _villaT = 0; }, _gleymaStillingu() { _st = null; _stT = 0; }, _bidaLestur() { return _lestur || Promise.resolve(_ham); },
  FRESTUR_MS, HAMUR_FRESTUR_MS };
