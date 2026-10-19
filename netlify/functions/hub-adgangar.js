// hub-adgangar.js — notendaskrá, innskráning og aðgangsstjórn (admin) fyrir stjórnstöðina.
//
//   GET  /api/hub-adgangar              → { setupNeeded, authed, user }            (opið — ber engin leyndarmál)
//   GET  /api/hub-adgangar?listi=1      → starfsmannalisti + stilling              (aðeins Admin)
//   POST /api/hub-adgangar { action }
//        opið:    login {nn,password} · logout · setup {code,password} · gleymt {postfang}
//        Admin:   vista {…notandi} · eyda {id} · opna {id} · breyta_lykilord {nytt} · senda {id}
//
// Agnar 19.10.2026: „geturðu opnað að ég geti stofnað notendur, lykilorð, heimildir". Notandanafn er
// skammstöfun (AS), EITT sameiginlegt lykilorð fyrir alla, Agnar er admin. „Gleymt lykilorð" sendir
// notandanafn + lykilorð á skráð póstfang.
//
// ÁFANGI 1 — hliðar EKKI önnur föll: þetta skrifar aðeins notendaskrána og setur cookie `hub_user`.
// Önnur hub-föll eru enn varin af requireStaff (HUB_STAFF_PASSWORD, fail-open) — að tengja þau við þessa
// innskráningu er sér-ákvörðun Agnars (sjá minni: project-hub-auth-gate).
//
// Töflur (sql/2026-10-19_hub_adgangar.sql): hub_adgangar (notendur) + hub_adgangar_stilling (ein röð:
// lykilorðs-hash, dulritað lykilorð til útsendingar, session-lykill, setup-kóði). RLS á, engar policies →
// aðeins þjónustulykillinn (þetta fall) kemst í þær.
//
// Lykilorðið er geymt tvisvar: scrypt-hash (innskráning) og AES-256-GCM dulritað (aðeins til að geta SENT
// það í „gleymt lykilorð"/„senda aðgang" — það er krafan). Dulritunarlykill = sha256 af þjónustulyklinum
// sem býr aðeins í Netlify-env, ekki í gagnagrunninum. Session-token er undirritað með session_secret
// sem breytist þegar lykilorði er skipt → öll önnur session ógildast.

const crypto = require('crypto');
const P = require('./_portal');

const COOKIE = 'hub_user';
const TTL = 60 * 60 * 10;               // sjálfgefið: 10 klst
const TTL_ALLTAF = 60 * 60 * 24 * 365;  // „haldast alltaf innskráður": eitt ár (ógildist samt við lykilorðaskipti)
const ttlFor = (st) => (st && st.session_alltaf ? TTL_ALLTAF : TTL);
const ROLUR = ['Admin', 'Starfsmaður', 'Afgreiðsla'];
const FELOG = ['Brunahólf', 'Slökkvitæki'];
// Síðurnar sem hægt er að veita aðgang að. Orðin eru geymd eins og þau birtast í valmyndinni.
const SIDUR = ['Fjármála-yfirlit', 'Kröfu yfirlit', 'Mæting · verkstaðir', 'Efniskostnaður', 'Ajour', 'Vinnubók',
  'Gerð reikninga', 'Viðskiptavinir', 'Skjöl', 'Póstleit', 'TurboPaint', 'J.A.R.V.I.S.'];
const MAX_MISTOK = 8;
const LAS_MIN = 15;
const SENDA_BIL_MIN = 5;
const MAIL_ACCOUNT = process.env.HUB_MAIL_ACCOUNT || 'eldklar@eldklar.is';
const MAIL_FROM = process.env.HUB_MAIL_FROM || 'Brunahólf <eldklar@eldklar.is>';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const sameHex = (a, b) => { try { const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); } catch (_) { return false; } };

// ── dulritun lykilorðs (aðeins svo hægt sé að senda það) ─────────────────────────────────────────────────────────
function encKey() { return crypto.createHash('sha256').update('hub-adgangar-pw|' + (P.SUPABASE_KEY || '')).digest(); }
function encPw(pw) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([c.update(String(pw), 'utf8'), c.final()]);
  return 'gcm$' + iv.toString('hex') + '$' + c.getAuthTag().toString('hex') + '$' + ct.toString('hex');
}
function decPw(stored) {
  try {
    const [t, iv, tag, ct] = String(stored || '').split('$');
    if (t !== 'gcm') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'hex'));
    d.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([d.update(Buffer.from(ct, 'hex')), d.final()]).toString('utf8');
  } catch (_) { return null; }
}

// ── gagnagrunnur ─────────────────────────────────────────────────────────────────────────────────────────────────
const enq = encodeURIComponent;
async function jsonOf(r) { try { return await r.json(); } catch (_) { return null; } }
async function getStilling() { const r = await P.sbGet('hub_adgangar_stilling?id=eq.1&select=*&limit=1'); const j = r.ok ? await jsonOf(r) : null; return (j && j[0]) || null; }
async function getUserBy(col, val) { const r = await P.sbGet('hub_adgangar?' + col + '=eq.' + enq(val) + '&select=*&limit=1'); const j = r.ok ? await jsonOf(r) : null; return (j && j[0]) || null; }
async function listUsers() { const r = await P.sbGet('hub_adgangar?select=*&order=id.asc'); return r.ok ? ((await jsonOf(r)) || []) : []; }
async function patchUser(id, body) { const r = await P.sbPatch('hub_adgangar?id=eq.' + Number(id), Object.assign({ updated_at: new Date().toISOString() }, body)); return r.ok ? ((await jsonOf(r)) || [])[0] || null : null; }
async function patchStilling(body) { const r = await P.sbPatch('hub_adgangar_stilling?id=eq.1', Object.assign({ updated_at: new Date().toISOString() }, body)); return r.ok; }
async function delUser(id) {
  const r = await fetch(P.SUPABASE_URL + '/rest/v1/hub_adgangar?id=eq.' + Number(id), { method: 'DELETE', headers: { apikey: P.SUPABASE_KEY, Authorization: 'Bearer ' + P.SUPABASE_KEY } });
  return r.ok;
}

// ── session ──────────────────────────────────────────────────────────────────────────────────────────────────────
function signSession(stilling, user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({ uid: user.id, nn: user.notandanafn, v: stilling.pw_changed_at || '', iat: now, exp: now + ttlFor(stilling) }));
  const sig = b64(crypto.createHmac('sha256', stilling.session_secret).update(payload).digest());
  return payload + '.' + sig;
}
function cookieFor(token, stilling) { return COOKIE + '=' + enq(token) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + ttlFor(stilling); }
const clearCookie = () => COOKIE + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
async function sessionUser(event, stillingGefin) {
  const token = P.parseCookies(event)[COOKIE];
  if (!token || token.indexOf('.') < 0) return null;
  const stilling = stillingGefin || await getStilling(); // stillingin er sótt einu sinni á beiðni (sparar Supabase-köll)
  if (!stilling || !stilling.pw_hash || !stilling.session_secret) return null;
  const [payload, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', stilling.session_secret).update(payload).digest();
  let given; try { given = unb64(sig); } catch (_) { return null; }
  if (given.length !== expect.length || !crypto.timingSafeEqual(given, expect)) return null;
  let p; try { p = JSON.parse(unb64(payload).toString('utf8')); } catch (_) { return null; }
  if (!p || typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return null;
  if (String(p.v || '') !== String(stilling.pw_changed_at || '')) return null; // lykilorði skipt → session ógilt
  const user = await getUserBy('id', p.uid);
  if (!user || !user.virkur) return null;
  return { user, stilling };
}
const publicUser = (u) => u && { id: u.id, nafn: u.nafn, nn: u.notandanafn, rola: u.rola, felog: u.felog || [], sidur: u.rola === 'Admin' ? SIDUR : (u.sidur || []) };

// ── hjálp ────────────────────────────────────────────────────────────────────────────────────────────────────────
const normNn = (s) => String(s || '').trim().toUpperCase().replace(/[^A-ZÁÐÉÍÓÚÝÞÆÖ0-9]/g, '').slice(0, 6);
const okMail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '')) && String(s).length <= 120;
function normKt(s) { const d = String(s || '').replace(/\D/g, ''); return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : String(s || '').trim().slice(0, 20); }
function normSimi(s) { const d = String(s || '').replace(/\D/g, ''); return d.length === 7 ? d.slice(0, 3) + ' ' + d.slice(3) : String(s || '').trim().slice(0, 20); }
const strong = (pw) => typeof pw === 'string' && pw.length >= 8 && pw.length <= 72;
function origin(event) { return 'https://' + ((event.headers && (event.headers.host || event.headers.Host)) || 'brunaholf.netlify.app'); }
async function logA(by, action, target, extra) { try { await P.log({ agent: 'hub-adgangar', action, target, by_who: by, input: extra || null }); } catch (_) { /* aldrei hindra */ } }

async function sendCredentials(event, user, stilling) {
  const pw = decPw(stilling.pw_enc);
  if (!pw) return { ok: false, error: 'Lykilorðið er ekki vistað til útsendingar — settu það aftur undir „Breyta lykilorði".' };
  if (!okMail(user.postfang)) return { ok: false, error: 'Póstfang vantar eða er ógilt.' };
  if (!user.notandanafn) return { ok: false, error: 'Notandanafn vantar.' };
  const url = origin(event) + '/adgangar.html';
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1714;line-height:1.55">'
    + '<p>Hæ ' + esc((user.nafn || '').split(' ')[0]) + ',</p>'
    + '<p>Hér eru aðgangsupplýsingarnar þínar að Brunahólfi:</p>'
    + '<table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:6px 14px 6px 0;color:#6b655a">Notandanafn</td><td style="padding:6px 0;font-family:Consolas,monospace;font-size:17px"><b>' + esc(user.notandanafn) + '</b></td></tr>'
    + '<tr><td style="padding:6px 14px 6px 0;color:#6b655a">Lykilorð</td><td style="padding:6px 0;font-family:Consolas,monospace;font-size:17px"><b>' + esc(pw) + '</b></td></tr></table>'
    + '<p>Skráðu þig inn á <a href="' + esc(url) + '">' + esc(url.replace('https://', '')) + '</a>.</p>'
    + '<p style="color:#6b655a;font-size:13px">Ekki áframsenda þennan póst. Lykilorðið er sameiginlegt fyrir starfsfólk.</p></div>';
  try {
    const r = await fetch(origin(event) + '/api/gmail-send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: MAIL_ACCOUNT, from: MAIL_FROM, to: [user.postfang], subject: 'Aðgangur að Brunahólfi', html }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); return { ok: false, error: 'Póstsending mistókst (' + r.status + ').', detail: t.slice(0, 200) }; }
  } catch (e) { return { ok: false, error: 'Póstsending mistókst: ' + String((e && e.message) || e) }; }
  await patchUser(user.id, { sent_at: new Date().toISOString() });
  return { ok: true };
}

// ── handler ──────────────────────────────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: P.secHeaders(), body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env vantar' });
  const qs = event.queryStringParameters || {};

  // GET — staða (opið) eða listi (Admin)
  if (event.httpMethod === 'GET') {
    const st0 = await getStilling();
    const s = await sessionUser(event, st0);
    if (qs.listi === '1') {
      if (!s) return P.json(401, { error: 'Innskráning vantar', need_login: true });
      if (s.user.rola !== 'Admin') return P.json(403, { error: 'Aðeins admin' });
      const users = (await listUsers()).map((u) => ({
        id: u.id, nafn: u.nafn, nn: u.notandanafn || '', nr: u.starfsmannanumer || '', kt: u.kennitala || '', pf: u.postfang || '', sm: u.simi || '',
        felog: u.felog || [], rola: u.rola, sidur: u.sidur || [], virkur: !!u.virkur, sent_at: u.sent_at, last_login_at: u.last_login_at,
        laest: !!(u.laest_til && new Date(u.laest_til) > new Date()),
      }));
      return P.json(200, { users, rolur: ROLUR, felog: FELOG, sidurAll: SIDUR, pw_changed_at: s.stilling.pw_changed_at, krefjast: !!s.stilling.krefjast, alltaf: !!s.stilling.session_alltaf, me: publicUser(s.user) });
    }
    const st = st0;
    // gate = rofinn „krefjast innskráningar" er kveikt OG uppsetningu er lokið; stjórnstöðin (index.html) sendir þá óinnskráða á adgangar.html
    return P.json(200, { setupNeeded: !!(st && !st.pw_hash && st.setup_hash), configured: !!(st && st.pw_hash), gate: !!(st && st.pw_hash && st.krefjast), authed: !!s, user: publicUser(s && s.user) });
  }
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'GET eða POST' });

  let body; try { body = JSON.parse(event.body || '{}'); } catch (_) { return P.json(400, { error: 'Ógilt JSON' }); }
  const action = String(body.action || '');

  if (action === 'logout') return P.json(200, { ok: true }, { 'Set-Cookie': clearCookie() });

  // ── opið: innskráning ──
  if (action === 'login') {
    const st = await getStilling();
    if (!st || !st.pw_hash) return P.json(503, { error: 'Innskráning er ekki sett upp enn — admin þarf að ljúka uppsetningu.', setupNeeded: true });
    const nn = normNn(body.nn), pw = String(body.password || '');
    const user = nn ? await getUserBy('notandanafn', nn) : null;
    const lasid = user && user.laest_til && new Date(user.laest_til) > new Date();
    if (lasid) { await sleep(500); return P.json(429, { error: 'Of margar rangar tilraunir. Reyndu aftur eftir nokkrar mínútur.' }); }
    const rett = P.verifyPassword(pw, st.pw_hash); // alltaf keyrt, líka án notanda — jafnar svartíma
    if (!user || !user.virkur || !rett) {
      if (user && user.virkur) {
        const n = (user.mistok || 0) + 1;
        await patchUser(user.id, n >= MAX_MISTOK ? { mistok: 0, laest_til: new Date(Date.now() + LAS_MIN * 60000).toISOString() } : { mistok: n });
      }
      await sleep(400 + Math.floor(Math.random() * 300));
      return P.json(401, { error: 'Rangt notandanafn eða lykilorð.' });
    }
    await patchUser(user.id, { mistok: 0, laest_til: null, last_login_at: new Date().toISOString() });
    return P.json(200, { ok: true, user: publicUser(user) }, { 'Set-Cookie': cookieFor(signSession(st, user), st) });
  }

  // ── opið: fyrsta uppsetning (einnota kóði) ──
  if (action === 'setup') {
    const st = await getStilling();
    if (!st || st.pw_hash || !st.setup_hash) return P.json(409, { error: 'Uppsetningu er þegar lokið.' });
    const ok = sameHex(sha(String(body.code || '').trim().toUpperCase()), st.setup_hash);
    if (!ok) { await sleep(700); return P.json(401, { error: 'Rangur uppsetningarkóði.' }); }
    if (!strong(body.password)) return P.json(400, { error: 'Lykilorðið þarf að vera 8–72 stafir.' });
    const now = new Date().toISOString();
    if (!(await patchStilling({ pw_hash: P.hashPassword(body.password), pw_enc: encPw(body.password), pw_changed_at: now, setup_hash: null }))) return P.json(500, { error: 'Tókst ekki að vista lykilorðið.' });
    const st2 = await getStilling();
    const admin = (await getUserBy('notandanafn', 'AS')) || (await listUsers()).find((u) => u.rola === 'Admin' && u.virkur);
    if (!admin) return P.json(500, { error: 'Enginn admin á skrá.' });
    await logA('setup', 'setup', admin.notandanafn);
    return P.json(200, { ok: true, user: publicUser(admin) }, { 'Set-Cookie': cookieFor(signSession(st2, admin), st2) });
  }

  // ── opið: gleymt lykilorð — svarar ALLTAF eins, hvort sem póstfangið er skráð eða ekki ──
  if (action === 'gleymt') {
    await sleep(500 + Math.floor(Math.random() * 400));
    const pf = String(body.postfang || '').trim().toLowerCase();
    const svar = P.json(200, { ok: true, skilabod: 'Ef póstfangið er skráð sendum við notandanafn og lykilorð þangað.' });
    if (!okMail(pf)) return svar;
    const st = await getStilling();
    if (!st || !st.pw_enc) return svar;
    // eq (ekki ilike): ilike túlkar % og _ sem jókera og leyfði að „l%" fyndi lena@… — póstföng eru geymd í lágstöfum
    const r = await P.sbGet('hub_adgangar?postfang=eq.' + enq(pf) + '&virkur=eq.true&select=*&limit=1');
    const user = r.ok ? ((await jsonOf(r)) || [])[0] : null;
    if (!user || !user.notandanafn) return svar;
    if (user.sent_at && Date.now() - new Date(user.sent_at).getTime() < SENDA_BIL_MIN * 60000) return svar; // ekki oftar en á 5 mín fresti
    await sendCredentials(event, user, st);
    await logA(user.notandanafn, 'gleymt', user.notandanafn);
    return svar;
  }

  // ── héðan: aðeins Admin ──
  const s = await sessionUser(event);
  if (!s) return P.json(401, { error: 'Innskráning vantar', need_login: true });
  if (s.user.rola !== 'Admin') return P.json(403, { error: 'Aðeins admin' });
  const me = s.user.notandanafn || ('#' + s.user.id);

  if (action === 'vista') {
    const nafn = String(body.nafn || '').trim().slice(0, 80);
    if (!nafn) return P.json(400, { error: 'Nafn vantar.' });
    const nn = normNn(body.nn);
    const rola = ROLUR.includes(body.rola) ? body.rola : 'Starfsmaður';
    const pf = String(body.pf || '').trim().toLowerCase();
    if (pf && !okMail(pf)) return P.json(400, { error: 'Póstfangið er ógilt.' });
    const row = {
      nafn, notandanafn: nn || null, starfsmannanumer: String(body.nr || '').trim().slice(0, 12) || null, kennitala: normKt(body.kt) || null,
      postfang: pf || null, simi: normSimi(body.sm) || null,
      felog: (Array.isArray(body.felog) ? body.felog : []).filter((f) => FELOG.includes(f)),
      rola, sidur: rola === 'Admin' ? SIDUR.slice() : (Array.isArray(body.sidur) ? body.sidur : []).filter((p) => SIDUR.includes(p)),
      virkur: body.virkur !== false,
    };
    const all = await listUsers();
    if (nn && all.some((u) => u.notandanafn === nn && u.id !== Number(body.id))) return P.json(409, { error: 'Notandanafnið ' + nn + ' er þegar í notkun.' });
    const gamall = body.id ? all.find((u) => u.id === Number(body.id)) : null;
    if (body.id && !gamall) return P.json(404, { error: 'Notandi fannst ekki.' });
    // aldrei án admins: síðasti virki admin má hvorki missa hlutverkið né vera gerður óvirkur
    const adminar = all.filter((u) => u.rola === 'Admin' && u.virkur && u.notandanafn);
    if (gamall && gamall.rola === 'Admin' && gamall.virkur && adminar.length === 1 && (row.rola !== 'Admin' || !row.virkur || !row.notandanafn))
      return P.json(409, { error: 'Þetta er síðasti virki admin — gerðu annan admin fyrst.' });
    if (gamall) { const u = await patchUser(gamall.id, row); if (!u) return P.json(500, { error: 'Vistun mistókst.' }); await logA(me, 'uppfaera', row.notandanafn || nafn); return P.json(200, { ok: true, id: u.id }); }
    const r = await P.sbPost('hub_adgangar', row);
    if (!r.ok) return P.json(r.status === 409 ? 409 : 500, { error: r.status === 409 ? 'Notandanafnið er þegar í notkun.' : 'Vistun mistókst.' });
    const nyr = ((await jsonOf(r)) || [])[0];
    await logA(me, 'stofna', row.notandanafn || nafn);
    return P.json(200, { ok: true, id: nyr && nyr.id });
  }

  if (action === 'eyda') {
    const id = Number(body.id);
    if (id === s.user.id) return P.json(409, { error: 'Þú getur ekki eytt eigin aðgangi.' });
    const all = await listUsers(), u = all.find((x) => x.id === id);
    if (!u) return P.json(404, { error: 'Notandi fannst ekki.' });
    if (u.rola === 'Admin' && u.virkur && all.filter((x) => x.rola === 'Admin' && x.virkur).length === 1) return P.json(409, { error: 'Þetta er síðasti virki admin.' });
    if (!(await delUser(id))) return P.json(500, { error: 'Eyðing mistókst.' });
    await logA(me, 'eyda', u.notandanafn || u.nafn);
    return P.json(200, { ok: true });
  }

  if (action === 'krefjast') { // rofinn: krefjast innskráningar þegar stjórnstöðin er opnuð (slökkt sjálfgefið)
    const on = body.on === true;
    if (on && !s.stilling.pw_hash) return P.json(409, { error: 'Lykilorð er ekki sett — ljúktu uppsetningu fyrst.' });
    if (!(await patchStilling({ krefjast: on }))) return P.json(500, { error: 'Vistun mistókst.' });
    await logA(me, on ? 'krefjast_kveikt' : 'krefjast_slokkt', null);
    return P.json(200, { ok: true, krefjast: on });
  }

  if (action === 'session') { // hversu lengi innskráning varir: alltaf=true → eitt ár, annars 10 klst. Gildir um NÝJAR innskráningar.
    const alltaf = body.alltaf === true;
    if (!(await patchStilling({ session_alltaf: alltaf }))) return P.json(500, { error: 'Vistun mistókst.' });
    await logA(me, alltaf ? 'session_alltaf' : 'session_10klst', null);
    return P.json(200, { ok: true, alltaf });
  }

  if (action === 'opna') { // afléttir lás eftir rangar tilraunir
    const u = await patchUser(Number(body.id), { mistok: 0, laest_til: null });
    return u ? P.json(200, { ok: true }) : P.json(404, { error: 'Notandi fannst ekki.' });
  }

  if (action === 'breyta_lykilord') {
    if (!strong(body.nytt)) return P.json(400, { error: 'Lykilorðið þarf að vera 8–72 stafir.' });
    const now = new Date().toISOString();
    // nýr session-lykill: öll önnur session ógildast um leið
    const nySecret = crypto.randomBytes(32).toString('hex');
    if (!(await patchStilling({ pw_hash: P.hashPassword(body.nytt), pw_enc: encPw(body.nytt), pw_changed_at: now, session_secret: nySecret }))) return P.json(500, { error: 'Vistun mistókst.' });
    const st2 = await getStilling();
    await logA(me, 'breyta_lykilord', null);
    return P.json(200, { ok: true, pw_changed_at: now }, { 'Set-Cookie': cookieFor(signSession(st2, s.user), st2) });
  }

  if (action === 'senda') {
    const u = await getUserBy('id', Number(body.id));
    if (!u) return P.json(404, { error: 'Notandi fannst ekki.' });
    const r = await sendCredentials(event, u, s.stilling);
    if (!r.ok) return P.json(502, { error: r.error });
    await logA(me, 'senda', u.notandanafn || u.nafn);
    return P.json(200, { ok: true });
  }

  return P.json(400, { error: 'Óþekkt aðgerð' });
};

exports._test = { normNn, normKt, normSimi, encPw, decPw, SIDUR };
