// vefur-efni.js — efni nýja vefsins (vefur/): birt útgáfa, drög, saga og myndir ritilsins á síðunni.
//
// GET  /api/vefur-efni?utgafa=v2            → { nr, efni }            birt efni; opið öllum, þetta er það sem gestir sjá
// GET  /api/vefur-efni?utgafa=v2&drog=1     → { efni, grunnur, … }    drögin                     (innskráning)
// GET  /api/vefur-efni?utgafa=v2&saga=1     → { saga: [{id, nr, af, kl}] }                        (innskráning)
// GET  /api/vefur-efni?innranet=1           → { nafn, nn, ritstjori, hlekkir }   hver er skráður inn og leiðir starfsfólks
//                                             í innri kerfin (hvaða virkur starfsmaður sem er; 401 án innskráningar)
// POST { adgerd: 'vista', utgafa, efni, grunnur }       drög vistuð; 409 ef annað tæki vistaði á undan
// POST { adgerd: 'birta', utgafa }                      drögin verða birta útgáfan og fara í söguna
// POST { adgerd: 'henda', utgafa }                      drögin verða aftur eins og birta útgáfan
// POST { adgerd: 'endurheimta', utgafa, id }            útgáfa úr sögunni sett í drögin
// POST { adgerd: 'mynd', utgafa, gogn }                 mynd (data-URL: jpeg, png eða webp, mest 6 MB) → { url }
//
// AÐGANGUR. Innskráningin er notendaskrá starfsmanna (hub_adgangar), sú sama og í stjórnstöðinni og Slökkvitæki-appinu.
// /api/hub-adgangar skráir inn (notandanafn + lykilorð, telur rangar tilraunir og læsir) og setur cookie-ið hub_user.
// Þetta fall les sama cookie og sannreynir það á sama hátt og þar: undirskrift með session_secret, gildistími,
// lykilorðaskipti ógilda það, notandinn þarf að vera virkur. Aðeins notendur með hlutverkið Admin mega breyta vefnum.
// Án gilds cookie er öllu lokað nema lestri á birtu efni (401); notandi án heimildar fær 403.
// Skrif þurfa auk þess að koma frá síðunni sjálfri: hausinn x-ritill, og Origin (sé hann sendur) af listanum UPPRUNI.
// Efnið: t (textar), m (myndir), k (svæði), rod (röð svæða), utlit (þema), hetja, litir, myndasafn. Sniðið stendur efst í
// vefur/site/efni.js. Stílar eru tölur innan marka, litir og orð af lista: ekkert frjálst CSS er vistað.
// Texti er hreinsaður hér áður en hann er vistaður (hreinsaHtml) og aftur í vafranum áður en hann fer á síðuna
// (vefur/site/efni.js). Listarnir yfir leyfð merki, stíla og letur þurfa að vera þeir sömu á báðum stöðum.
// Töflurnar vefur_efni og vefur_efni_saga (sql/2026-11-14_vefur_efni.sql) eru með RLS og engar reglur: aðeins þetta fall
// (service role) kemst í þær. Myndir fara í bucketinn vefverslun undir vefur/.

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UTGAFUR = ['v1', 'v2', 'v3'];
const BUCKET = 'vefverslun';
const MAX_EFNI = 400 * 1024;            // drög sem JSON
const MAX_MYND = 4 * 1024 * 1024;       // ein mynd (beiðni til Netlify-falls rúmar ekki meira en um 4,4 MB af mynd)
const COOKIE = 'hub_user';              // sett af /api/hub-adgangar við innskráningu
const RITSTJORAR = ['Admin'];           // hlutverk í hub_adgangar sem mega breyta vefnum
// Leiðir starfsfólks úr innskráningunni á vefnum („Innranet“ í fætinum). Þær standa hér en ekki í skriftu síðunnar,
// svo þær berist aðeins þeim sem er skráður inn.
const INNRANET = [
  { heiti: 'Stjórnborð þjónustugáttar', lysing: 'Viðskiptavinavefir, aðgangar og skilaboð', slod: 'https://slokkvitaeki.netlify.app/gatt-admin/' },
  { heiti: 'Slökkvitæki-kerfið', lysing: 'Tæki, viðskiptavinir, verk og sala', slod: 'https://slokkvitaeki.netlify.app/' },
  { heiti: 'Stjórnstöð Brunahólfs', lysing: 'Reikningar, verkstaðir, póstur og aðgangar starfsfólks', slod: 'https://brunaholf.netlify.app/' },
];
// Síður sem mega kalla á fallið úr vafra. Sama lén þarf ekki að vera hér; lénið bætist við þegar vefurinn flytur.
const UPPRUNI = ['https://brunaholf.netlify.app', 'https://www.brunaholf.is', 'https://brunaholf.is'];

function hausar(event, auka) {
  const o = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-ritill',
    'Referrer-Policy': 'no-referrer',
    Vary: 'Origin',
  };
  if (UPPRUNI.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return Object.assign(h, auka || {});
}
const svar = (event, status, body, auka) => ({ statusCode: status, headers: hausar(event, Object.assign({ 'Cache-Control': 'no-store' }, auka || {})), body: JSON.stringify(body) });

async function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}
async function rod(utgafa, select) {
  const r = await sb(`vefur_efni?utgafa=eq.${utgafa}&select=${select}`);
  if (!r.ok) return { villa: r.status, engin: r.status === 404 };      // 404: taflan er ekki til (migration ókeyrð)
  const rows = await r.json();
  return { rod: rows[0] || null };
}

// ---- innskráning: cookie-ið hub_user úr /api/hub-adgangar, sannreynt eins og þar (sessionUser í hub-adgangar.js) ----
function kokur(event) {
  const hra = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const ut = {};
  String(hra).split(';').forEach((b) => {
    const i = b.indexOf('=');
    if (i < 1) return;
    const k = b.slice(0, i).trim();      // komi sama heiti tvisvar gildir það síðara, eins og í hub-adgangar
    try { ut[k] = decodeURIComponent(b.slice(i + 1).trim()); } catch (e) { ut[k] = ''; }
  });
  return ut;
}
// Skilar { nafn, nn, ritstjori } fyrir innskráðan ritstjóra, annars { villa: 401 | 403 | 502 | 503 }.
// allir = true: hvaða virkur starfsmaður sem er telst (innranetið); ritstjori segir þá hvort hann má breyta vefnum.
async function notandi(event, allir) {
  const tok = kokur(event)[COOKIE];
  if (typeof tok !== 'string' || tok.length < 20 || tok.length > 2000) return { villa: 401 };
  const i = tok.indexOf('.');
  if (i < 1) return { villa: 401 };
  // röðin kemur aðeins sé lykilorð sett (uppsetningu lokið); lykilorðs-hashið sjálft er ekki sótt hingað
  const r = await sb('hub_adgangar_stilling?id=eq.1&pw_hash=not.is.null&select=session_secret,pw_changed_at');
  if (!r.ok) return { villa: 502 };
  const st = (await r.json())[0];
  if (!st || !st.session_secret) return { villa: 503 };      // innskráning starfsmanna er ekki sett upp
  const gogn = tok.slice(0, i);
  const rett = crypto.createHmac('sha256', st.session_secret).update(gogn).digest();
  const gefid = Buffer.from(tok.slice(i + 1), 'base64url');
  if (gefid.length !== rett.length || !crypto.timingSafeEqual(gefid, rett)) return { villa: 401 };
  let p;
  try { p = JSON.parse(Buffer.from(gogn, 'base64url').toString('utf8')); } catch (e) { return { villa: 401 }; }
  if (!p || typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return { villa: 401 };
  if (String(p.v || '') !== String(st.pw_changed_at || '')) return { villa: 401 };      // lykilorði skipt: eldri innskráning ógild
  const uid = p.uid;      // tala, eins og innskráningin skrifar hana; annað (strengur, true) er ekki tekið gilt
  if (typeof uid !== 'number' || !Number.isInteger(uid) || uid < 1) return { villa: 401 };
  const u = await sb(`hub_adgangar?id=eq.${uid}&select=id,nafn,notandanafn,rola,virkur`);
  if (!u.ok) return { villa: 502 };
  const n = (await u.json())[0];
  if (!n || !n.virkur) return { villa: 401 };
  const ritstjori = RITSTJORAR.includes(n.rola);
  if (!ritstjori && !allir) return { villa: 403 };
  const nn = String(n.notandanafn || '').slice(0, 12);
  return { nafn: (String(n.nafn || '').trim().split(/\s+/)[0] || nn || 'Ónefndur').slice(0, 40), nn, ritstjori };
}
const hafnad = (event, hver) => (hver.villa === 403 ? svar(event, 403, { villa: 'heimild' })
  : hver.villa === 503 ? svar(event, 503, { villa: 'ovirkt' })
    : hver.villa === 502 ? svar(event, 502, { villa: 'Innskráning náðist ekki' })
      : svar(event, 401, { villa: 'innskraning' }));

// ---- hreinsun: sömu reglur og í vefur/site/efni.js. Úttakið er sett saman úr leyfðum bitum eingöngu ----
const MERKI = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'br', 'span', 'small', 'a', 'sup', 'sub']);
const LETUR = ['Poppins', 'Inter', 'Questrial', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Raleway', 'Work Sans', 'DM Sans', 'Source Sans 3', 'Playfair Display', 'Merriweather', 'Oswald'];
const MYNDIR = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/vefur/`;
// litur: #rgb eða #rrggbb. Gegnsæi (#rrggbbaa) er ekki tekið gilt: það gæti falið texta.
const litur = (v) => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v.toLowerCase() : null);
const lykillOk = (k) => typeof k === 'string' && /^[a-z0-9][a-z0-9._-]{0,80}$/.test(k);
function myndOk(src) {
  if (typeof src !== 'string' || src.length > 400 || src.includes('..')) return false;
  if (/^(img|myndir|vv)\/[A-Za-z0-9_\/.-]+\.(webp|jpe?g|png)$/.test(src)) return true;
  return src.startsWith(MYNDIR) && /^[A-Za-z0-9_\/.-]+\.(webp|jpe?g|png)$/.test(src.slice(MYNDIR.length));
}
const STADIR = ['left top', 'top', 'right top', 'left', 'center', 'right', 'left bottom', 'bottom', 'right bottom'];
const stadurOk = (v) => (typeof v === 'string' && (STADIR.includes(v) || /^(left|center|right|(?:100|\d{1,2})%) (top|center|bottom|(?:100|\d{1,2})%)$/.test(v)) ? v : null);
function slodOk(h) {
  h = String(h || '').trim();
  if (/^#[A-Za-z0-9_\/.=&%-]{0,120}$/.test(h) || /^tel:\+?[0-9 ()-]{3,24}$/.test(h) || /^mailto:[^\s<>"']{3,120}$/.test(h)) return h;
  // vefslóð: vélarheiti strax á eftir https:// (stafir, tölur, punktar, bandstrik), enginn notandahluti og ekkert öfugt skástrik
  return h.length <= 400 && /^https:\/\/[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d{1,5})?(?:[\/?#][^\s<>"'\\]*)?$/.test(h) ? h : null;
}
function stillOk(v) {
  const ut = [];
  for (const bit of String(v || '').split(';')) {
    const i = bit.indexOf(':');
    if (i < 0) continue;
    const p = bit.slice(0, i).trim().toLowerCase(), g = bit.slice(i + 1).trim().replace(/\s*!important$/i, '');
    let m;
    if (p === 'color' || p === 'background-color') {
      m = litur(g);
      if (!m && (m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(g))) m = '#' + [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('');
      if (m) ut.push(p + ':' + m);
    } else if (p === 'font-size') {
      if ((m = /^(\d+(?:\.\d+)?)(px|em|rem|%)$/.exec(g))) {
        const hi = { px: 200, em: 6, rem: 12, '%': 600 }[m[2]], lo = { px: 8, em: 0.4, rem: 0.5, '%': 40 }[m[2]];
        ut.push('font-size:' + Math.min(hi, Math.max(lo, Number(m[1]))) + m[2]);
      }
    } else if (p === 'font-family') {
      m = g.split(',')[0].replace(/["']|&quot;/g, '').trim();
      if (LETUR.includes(m)) ut.push("font-family:'" + m + "',sans-serif");
    } else if (p === 'font-weight') { if (/^(normal|bold|[1-9]00)$/.test(g)) ut.push('font-weight:' + g); }
    else if (p === 'font-style') { if (g === 'italic' || g === 'normal') ut.push('font-style:' + g); }
    else if (p === 'text-decoration' || p === 'text-decoration-line') { if (['underline', 'line-through', 'none'].includes(g)) ut.push('text-decoration:' + g); }
    else if (p === 'letter-spacing') { if ((m = /^(-?\d+(?:\.\d+)?)em$/.exec(g))) ut.push('letter-spacing:' + Math.min(0.5, Math.max(-0.1, Number(m[1]))) + 'em'); }
    else if (p === 'text-transform') { if (g === 'uppercase' || g === 'none') ut.push('text-transform:' + g); }
  }
  return ut.join(';');
}
const textiOk = (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
const afkoda = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function hreinsaHtml(html) {
  html = String(html).slice(0, 20000).replace(/<(script|style|iframe|object|embed|svg|math|template|noscript|title|form)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g, opin = [];
  let ut = '', i = 0, m;
  while ((m = re.exec(html))) {
    ut += textiOk(html.slice(i, m.index));
    i = re.lastIndex;
    const nafn = m[2].toLowerCase();
    if (!MERKI.has(nafn)) continue;                      // óþekkt merki fellur út, textinn innan úr því stendur
    if (m[1]) { const j = opin.lastIndexOf(nafn); if (j >= 0) { opin.splice(j, 1); ut += '</' + nafn + '>'; } continue; }
    const eig = {};
    m[3].replace(/([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, n, a, b) => { eig[n.toLowerCase()] = afkoda(a !== undefined ? a : b); return _; });
    let t = '<' + nafn;
    const kl = String(eig.class || '').split(/\s+/).filter((k) => /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(k) && !/^(brr|bsafn)/i.test(k)).join(' ');
    const st = stillOk(eig.style);
    if (kl) t += ' class="' + kl + '"';
    if (st) t += ' style="' + st + '"';
    if (nafn === 'a') {
      const h = slodOk(eig.href);
      if (h) t += ' href="' + h.replace(/&/g, '&amp;') + '"';
      if (eig.target === '_blank') t += ' target="_blank" rel="noopener"';
    }
    ut += t + '>';
    if (nafn !== 'br') opin.push(nafn);
  }
  ut += textiOk(html.slice(i));
  while (opin.length) ut += '</' + opin.pop() + '>';
  return ut;
}
// stílgildi: aðeins þekktir reitir með gildi innan marka fara í geymslu (sömu mörk og síðan notar)
const tala = (v, min, max) => {
  if (typeof v === 'string') v = v.trim() === '' ? NaN : Number(v);
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
};
const hlutur = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
// kassastílar (bil, horn, rammi, breidd …): [lágmark, hámark], sömu mörk og KASSI í vefur/site/efni.js
const KASSI = { pt: [0, 400], pb: [0, 400], pl: [0, 400], pr: [0, 400], mt: [-200, 400], mb: [-200, 400], mw: [120, 2400], h: [0, 2000], r: [0, 200], bw: [0, 20], gap: [0, 200], op: [0.05, 1], dal: [1, 6] };
function textaStillOk(o) {
  const n = {};
  let x;
  for (const k of Object.keys(KASSI)) if ((x = tala(o[k], KASSI[k][0], KASSI[k][1])) !== null) n[k] = x;
  if ((x = litur(o.bg))) n.bg = x;
  if ((x = litur(o.bc))) n.bc = x;
  if (o.sk === 'none' || o.sk === 's' || o.sk === 'm' || o.sk === 'l') n.sk = o.sk;
  if (o.jf === 'v' || o.jf === 'm' || o.jf === 'h') n.jf = o.jf;
  if (o.fal === true) n.fal = true;
  if (typeof o.ff === 'string' && LETUR.includes(o.ff)) n.ff = o.ff;
  if ((x = tala(o.fs, 8, 200)) !== null) n.fs = x;
  if ((x = tala(o.fw, 100, 900)) !== null) n.fw = x;
  if ((x = tala(o.lh, 0.8, 3)) !== null) n.lh = x;
  if ((x = tala(o.ls, -0.1, 0.5)) !== null) n.ls = x;
  if (o.ta === 'left' || o.ta === 'center' || o.ta === 'right') n.ta = o.ta;
  if (o.it === true) n.it = true;
  if (o.tt === 'uppercase' || o.tt === 'none') n.tt = o.tt;
  if ((x = litur(o.c))) n.c = x;
  return n;
}
function myndStillOk(o) {
  const n = {};
  let x;
  if (o.fit === 'cover' || o.fit === 'contain') n.fit = o.fit;
  if ((x = stadurOk(o.pos))) n.pos = x;
  if ((x = tala(o.z, 100, 300)) !== null) n.z = x;
  if ((x = tala(o.r, 0, 80)) !== null) n.r = x;
  if ((x = tala(o.h, 30, 1400)) !== null) n.h = x;
  if ((x = tala(o.w, 10, 100)) !== null) n.w = x;
  return n;
}
function hreinsaEfni(efni) {
  const ut = {};
  if (efni.t) {
    ut.t = {};
    for (const k of Object.keys(efni.t)) {
      const o = efni.t[k];
      if (!lykillOk(k) || !o || typeof o !== 'object' || Array.isArray(o)) continue;
      const n = {};
      if (typeof o.h === 'string') n.h = hreinsaHtml(o.h);
      if (typeof o.href === 'string' && slodOk(o.href)) n.href = slodOk(o.href);
      for (const b of ['s', 'sm']) if (hlutur(o[b])) n[b] = textaStillOk(o[b]);
      ut.t[k] = n;
    }
  }
  if (efni.k) {      // svæði: kaflar, spjöld, listar
    ut.k = {};
    for (const k of Object.keys(efni.k)) {
      const o = efni.k[k];
      if (!lykillOk(k) || !hlutur(o)) continue;
      const n = {};
      for (const b of ['s', 'sm']) if (hlutur(o[b])) n[b] = textaStillOk(o[b]);
      ut.k[k] = n;
    }
  }
  if (efni.rod) {      // röð barna innan svæðis
    ut.rod = {};
    for (const k of Object.keys(efni.rod)) {
      const l = efni.rod[k];
      if (!lykillOk(k) || !Array.isArray(l)) continue;
      ut.rod[k] = [...new Set(l.filter(lykillOk))].slice(0, 80);
    }
  }
  if (efni.utlit) {      // þema: tákn → litur, letur af lista eða tala
    ut.utlit = {};
    for (const k of Object.keys(efni.utlit).slice(0, 120)) {
      const v = efni.utlit[k];
      if (!/^--[a-z0-9-]{1,40}$/.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) ut.utlit[k] = Math.min(4000, Math.max(0, v));
      else if (litur(v)) ut.utlit[k] = litur(v);
      else if (typeof v === 'string' && LETUR.includes(v)) ut.utlit[k] = v;
    }
  }
  if (efni.m) {
    ut.m = {};
    for (const k of Object.keys(efni.m)) {
      const o = efni.m[k];
      if (!lykillOk(k) || !o || typeof o !== 'object' || Array.isArray(o)) continue;
      const n = myndStillOk(o);
      if (myndOk(o.src)) n.src = o.src;
      if (hlutur(o.sm)) n.sm = myndStillOk(o.sm);
      ut.m[k] = n;
    }
  }
  if (hlutur(efni.hetja) && typeof efni.hetja.id === 'string' && /^[a-z0-9-]{1,40}$/.test(efni.hetja.id)) {
    if (efni.hetja.id !== 'ser') ut.hetja = { id: efni.hetja.id };
    else if (myndOk(efni.hetja.mynd)) ut.hetja = { id: 'ser', mynd: efni.hetja.mynd, pos: stadurOk(efni.hetja.pos) || 'center', ljos: efni.hetja.ljos === true };
  }
  if (Array.isArray(efni.litir)) ut.litir = efni.litir.map(litur).filter(Boolean).slice(0, 15);
  if (Array.isArray(efni.myndasafn)) ut.myndasafn = efni.myndasafn.filter(myndOk).slice(0, 60);
  return ut;
}

function efniOk(efni) {
  if (!efni || typeof efni !== 'object' || Array.isArray(efni)) return 'efni vantar';
  for (const k of Object.keys(efni)) if (!['t', 'm', 'k', 'rod', 'utlit', 'hetja', 'litir', 'myndasafn'].includes(k)) return 'Óþekktur hluti í efni: ' + k.slice(0, 30);
  for (const k of ['t', 'm', 'k', 'rod', 'utlit']) if (efni[k] !== undefined && (typeof efni[k] !== 'object' || efni[k] === null || Array.isArray(efni[k]))) return 'Ógilt efni';
  if (efni.litir !== undefined && !Array.isArray(efni.litir)) return 'Ógilt litaval';
  if (efni.myndasafn !== undefined && !Array.isArray(efni.myndasafn)) return 'Ógilt myndasafn';
  if (Buffer.byteLength(JSON.stringify(efni)) > MAX_EFNI) return 'Drögin eru of stór';
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: hausar(event), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return svar(event, 500, { villa: 'Tenging við gagnagrunn vantar' });
  const q = event.queryStringParameters || {};

  try {
    if (event.httpMethod === 'GET') {
      if (q.innranet) {      // innskráning starfsfólks á vefnum: hver er skráður inn, og leiðirnar í innri kerfin
        const hver = await notandi(event, true);
        if (hver.villa) return hafnad(event, hver);
        return svar(event, 200, { nafn: hver.nafn, nn: hver.nn, ritstjori: hver.ritstjori, hlekkir: INNRANET });
      }
      const utgafa = q.utgafa;
      if (!UTGAFUR.includes(utgafa)) return svar(event, 400, { villa: 'Óþekkt útgáfa' });
      if (!q.drog && !q.saga) {
        // birt efni: opið, og geymt stutta stund á jaðrinum svo síðan þurfi ekki að bíða eftir fallinu
        const r = await rod(utgafa, 'birt,birt_nr');
        // villa má ekki geymast á jaðrinum sem „engar breytingar“: þá hyrfu breytingarnar af vefnum á meðan
        if (r.villa && !r.engin) return svar(event, 502, { villa: 'Efnið náðist ekki' }, { 'Access-Control-Allow-Origin': '*' });
        if (r.villa) return svar(event, 200, { nr: 0, efni: {} }, { 'Access-Control-Allow-Origin': '*' });      // geymslan ekki sett upp enn
        const body = r.rod ? { nr: r.rod.birt_nr, efni: r.rod.birt || {} } : { nr: 0, efni: {} };
        return svar(event, 200, body, {
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Netlify-CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
          'Access-Control-Allow-Origin': '*',
        });
      }
      const hver = await notandi(event);
      if (hver.villa) return hafnad(event, hver);
      if (q.saga) {
        const r = await sb(`vefur_efni_saga?utgafa=eq.${utgafa}&select=id,nr,af,created_at&order=nr.desc&limit=20`);
        if (!r.ok) return svar(event, 502, { villa: 'Sagan náðist ekki' });
        return svar(event, 200, { saga: (await r.json()).map((x) => ({ id: x.id, nr: x.nr, af: x.af, kl: x.created_at })) });
      }
      const r = await rod(utgafa, '*');
      if (!r.rod) return svar(event, r.villa ? 502 : 404, { villa: 'Geymslan er ekki tilbúin' });
      const x = r.rod;
      return svar(event, 200, { efni: x.drog || {}, grunnur: x.drog_uppfaert, drog_af: x.drog_af, birt_nr: x.birt_nr, birt_kl: x.birt_kl, birt_af: x.birt_af,
        obirt: JSON.stringify(x.drog || {}) !== JSON.stringify(x.birt || {}), nafn: hver.nafn, nn: hver.nn });
    }

    if (event.httpMethod !== 'POST') return svar(event, 405, { villa: 'Aðeins GET og POST' });
    if ((event.body || '').length > 9 * 1024 * 1024) return svar(event, 413, { villa: 'Of stórt' });
    let b;
    try { b = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body || '{}'); } catch (e) { return svar(event, 400, { villa: 'Ógilt JSON' }); }
    // skrif koma aðeins frá síðunni sjálfri: innskráningin er cookie, svo önnur síða má ekki geta sent beiðni í nafni notandans
    const h = event.headers || {};
    const uppruni = h.origin || h.Origin || '';
    if (!(h['x-ritill'] || h['X-Ritill']) || (uppruni && !UPPRUNI.includes(uppruni))) return svar(event, 403, { villa: 'Beiðnin kom ekki frá síðunni' });
    const hver = await notandi(event);
    if (hver.villa) return hafnad(event, hver);
    const utgafa = b.utgafa;
    if (!UTGAFUR.includes(utgafa)) return svar(event, 400, { villa: 'Óþekkt útgáfa' });
    const nu = new Date().toISOString();

    if (b.adgerd === 'vista') {
      const villa = efniOk(b.efni);
      if (villa) return svar(event, 400, { villa });
      b.efni = hreinsaEfni(b.efni);
      // grunnur er tímastimpill dráganna sem þetta tæki byrjaði á: passi hann ekki lengur vistaði annað tæki á meðan
      const sia = typeof b.grunnur === 'string' && b.grunnur ? `&drog_uppfaert=eq.${encodeURIComponent(b.grunnur)}` : '';
      const r = await sb(`vefur_efni?utgafa=eq.${utgafa}${sia}`, { method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ drog: b.efni, drog_uppfaert: nu, drog_af: hver.nafn }) });
      if (!r.ok) return svar(event, 502, { villa: 'Vistun mistókst' });
      const rows = await r.json();
      if (!rows.length) {
        const n = await rod(utgafa, 'drog,drog_uppfaert,drog_af');
        if (!n.rod) return svar(event, 404, { villa: 'Geymslan er ekki tilbúin' });
        return svar(event, 409, { villa: 'Annað tæki vistaði drögin á undan', efni: n.rod.drog, grunnur: n.rod.drog_uppfaert, drog_af: n.rod.drog_af });
      }
      return svar(event, 200, { ok: true, grunnur: rows[0].drog_uppfaert });
    }

    if (b.adgerd === 'birta') {
      const n = await rod(utgafa, 'drog,birt_nr');
      if (!n.rod) return svar(event, 404, { villa: 'Geymslan er ekki tilbúin' });
      const nr = (n.rod.birt_nr || 0) + 1;
      // sagan fyrst: útgáfa fer aldrei í loftið án þess að vera til í sögunni
      const s = await sb('vefur_efni_saga', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ utgafa, nr, efni: n.rod.drog, af: hver.nafn }) });
      if (!s.ok) return svar(event, 502, { villa: 'Birting mistókst: sagan vistaðist ekki' });
      const r = await sb(`vefur_efni?utgafa=eq.${utgafa}`, { method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ birt: n.rod.drog, birt_nr: nr, birt_kl: nu, birt_af: hver.nafn }) });
      if (!r.ok || !(await r.json()).length) {
        const sr = await s.json().catch(() => []);
        if (sr[0] && sr[0].id) await sb(`vefur_efni_saga?id=eq.${sr[0].id}`, { method: 'DELETE' });      // söguröðin sem átti við hana tekin aftur
        return svar(event, 502, { villa: 'Birting mistókst' });
      }
      return svar(event, 200, { ok: true, birt_nr: nr, birt_kl: nu, birt_af: hver.nafn });
    }

    if (b.adgerd === 'henda' || b.adgerd === 'endurheimta') {
      let efni;
      if (b.adgerd === 'henda') {
        const n = await rod(utgafa, 'birt');
        if (!n.rod) return svar(event, 404, { villa: 'Geymslan er ekki tilbúin' });
        efni = n.rod.birt || {};
      } else {
        const id = Number(b.id);
        if (!Number.isInteger(id) || id < 1) return svar(event, 400, { villa: 'Útgáfa fannst ekki' });
        const r = await sb(`vefur_efni_saga?id=eq.${id}&utgafa=eq.${utgafa}&select=efni`);
        const rows = r.ok ? await r.json() : [];
        if (!rows.length) return svar(event, 404, { villa: 'Útgáfa fannst ekki' });
        efni = rows[0].efni || {};
      }
      const r = await sb(`vefur_efni?utgafa=eq.${utgafa}`, { method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ drog: efni, drog_uppfaert: nu, drog_af: hver.nafn }) });
      if (!r.ok) return svar(event, 502, { villa: 'Mistókst' });
      return svar(event, 200, { ok: true, efni, grunnur: nu });
    }

    if (b.adgerd === 'mynd') {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.gogn || ''));
      if (!m) return svar(event, 400, { villa: 'Aðeins JPEG, PNG eða WebP' });
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length || buf.length > MAX_MYND) return svar(event, 413, { villa: 'Myndin er of stór (mest 4 MB)' });
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const slod = `vefur/${utgafa}/${nu.slice(0, 7)}/${crypto.randomBytes(9).toString('hex')}.${ext}`;
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${slod}`, { method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'image/' + m[1], 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000' },
        body: buf });
      if (!r.ok) return svar(event, 502, { villa: 'Upphleðsla mistókst' });
      return svar(event, 200, { url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${slod}` });
    }

    return svar(event, 400, { villa: 'Óþekkt aðgerð' });
  } catch (e) {
    return svar(event, 500, { villa: 'Villa á þjóni' });
  }
};
