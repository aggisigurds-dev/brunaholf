// sb-toki.js — starfsmannatákn fyrir bein köll Brunahólfs-síðna í Supabase (PostgREST), 23.11.2026.
//
//   GET /api/sb-toki → 200 { sb_jwt, exp, uppruni: 'brunaholf' | 'slokkvitaeki' }
//                      401 { villa: 'innskraning' }   engin, fölsuð eða útrunnin kaka, óvirkur notandi
//                      503                            innskráning ekki uppsett, eða ekkert tákn í boði
//                      502                            gagnagrunnur eða Slökkvitæki svarar ekki
//
// TILEFNI: Frá 09:36 23.11.2026 (Supabase-migration rls_starfsfolk_20261123) hefur anon ekkert GRANT á 127 töflum.
// Síður sem lesa grunninn beint með opinbera lyklinum fengu 401: hledsluaaetlun.html (app_settings, customer_documents,
// v_reikningslestur_stada, v_reikningar_olesnir), Supabase-mælirinn í jarvis.html og kerfisheilsan á forsíðunni.
// Innskráður starfsmaður á að lesa sem `authenticated` með claimið `rola` (RLS-reglan starfsfolk_all les það).
// Vafrinn fær táknið gegnum js/sb-starfstok.js.
//
// INNSKRÁNING: kakan hub_user, sannreynd HÉR FYRST (sama sannprófun og postmoppur.js / odin.js / _vord.js). P.requireStaff
// er óvirkt í loftinu og er ekki notað. Óinnskráður fær 401 og ekkert kall fer út af vélinni.
//
// TÁKNIÐ:
//   1. SUPABASE_JWT_SECRET er sett í Netlify-umhverfi Brunahólfs → táknið er myntað hér (_sb-jwt.js, afrit af slokkvitaeki).
//   2. Annars (staðan 23.11.2026: leyndarmálið er aðeins á Slökkvitæki) er það sótt til
//      slokkvitaeki.netlify.app/api/hub-adgangar með sömu köku. session_secret er sameiginlegur, svo sama kaka gildir á
//      báðum vefjum. Aðeins kakan fer yfir, og aðeins eftir að hún stóðst hér. Svarið er tekið gilt ef sub = 'hub:'+uid,
//      rola er sú sama og hér var staðfest, role = authenticated og exp er minnst mínútu fram í tímann.
// Táknið fer aldrei í log. Cache-Control: no-store.
'use strict';
const crypto = require('crypto');
const SBJWT = require('./_sb-jwt');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE = 'hub_user';
const SLOKK = 'https://slokkvitaeki.netlify.app';
const FRESTUR_MS = 4000;

const svar = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
  body: JSON.stringify(body),
});

async function medFresti(url, init) {
  const ac = new AbortController();
  let teljari;
  const tima = new Promise((_, hafna) => { teljari = setTimeout(() => { try { ac.abort(); } catch (_) {} hafna(new Error('tímafall')); }, FRESTUR_MS); });
  try { return await Promise.race([fetch(url, Object.assign({}, init, { signal: ac.signal })), tima]); }
  finally { clearTimeout(teljari); }
}
const sb = (path) => medFresti(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });

function kokur(event) {
  const hra = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const ut = {};
  String(hra).split(';').forEach((b) => {
    const i = b.indexOf('=');
    if (i < 1) return;
    try { ut[b.slice(0, i).trim()] = decodeURIComponent(b.slice(i + 1).trim()); } catch (e) { ut[b.slice(0, i).trim()] = ''; }
  });
  return ut;
}

// Sama sannprófun og postmoppur.js notandi(): undirrituð kaka, gildistími, lykilorðsútgáfa, virkur notandi.
async function notandi(event) {
  const tok = kokur(event)[COOKIE];
  if (typeof tok !== 'string' || tok.length < 20 || tok.length > 2000) return { villa: 401 };
  const i = tok.indexOf('.');
  if (i < 1) return { villa: 401 };
  if (!SUPABASE_URL || !SUPABASE_KEY) return { villa: 503 };
  const r = await sb('hub_adgangar_stilling?id=eq.1&pw_hash=not.is.null&select=session_secret,pw_changed_at');
  if (!r.ok) return { villa: 502 };
  const st = (await r.json())[0];
  if (!st || !st.session_secret) return { villa: 503 };
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
  const u = await sb(`hub_adgangar?id=eq.${uid}&select=id,rola,virkur`);
  if (!u.ok) return { villa: 502 };
  const n = (await u.json())[0];
  if (!n || !n.virkur) return { villa: 401 };
  return { id: n.id, rola: n.rola, kaka: tok };
}

// Tákn frá Slökkvitæki: aðeins tekið gilt ef það á við SAMA notanda og SAMA hlutverk og hér var staðfest.
function stenstTakn(tok, hver) {
  const p = SBJWT.lesaPayload(tok);
  if (!p || p.role !== 'authenticated') return null;
  if (p.sub !== 'hub:' + String(hver.id) || p.rola !== hver.rola) return null;
  if (SBJWT.ROLUR.indexOf(p.rola) < 0) return null;
  if (typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000) + 60) return null;
  return p;
}

async function fraSlokk(hver) {
  const r = await medFresti(SLOKK + '/api/hub-adgangar', {
    headers: { cookie: COOKIE + '=' + encodeURIComponent(hver.kaka), accept: 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) return { villa: 502 };
  let j; try { j = await r.json(); } catch (_) { return { villa: 502 }; }
  if (!j || !j.authed) return { villa: 401 };
  if (!j.sb_jwt) return { villa: 503 };
  const p = stenstTakn(j.sb_jwt, hver);
  if (!p) return { villa: 502 };
  return { sb_jwt: j.sb_jwt, exp: p.exp, uppruni: 'slokkvitaeki' };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return svar(405, { villa: 'Aðeins GET' });
  let hver;
  try { hver = await notandi(event); } catch (e) { return svar(502, { villa: 'Innskráning náðist ekki' }); }
  if (hver.villa === 401) return svar(401, { villa: 'innskraning' });
  if (hver.villa === 503) return svar(503, { villa: 'Innskráning starfsmanna er ekki sett upp' });
  if (hver.villa) return svar(502, { villa: 'Innskráning náðist ekki' });
  if (SBJWT.ROLUR.indexOf(hver.rola) < 0) return svar(403, { villa: 'Hlutverk án aðgangs að gögnum' });

  const stadbundid = SBJWT.staffJwt(hver);
  if (stadbundid) return svar(200, { sb_jwt: stadbundid, exp: SBJWT.lesaPayload(stadbundid).exp, uppruni: 'brunaholf' });

  let ut;
  try { ut = await fraSlokk(hver); } catch (e) { return svar(502, { villa: 'Slökkvitæki svaraði ekki' }); }
  if (ut.villa === 401) return svar(401, { villa: 'innskraning' });
  if (ut.villa === 503) return svar(503, { villa: 'Tákn ekki í boði' });
  if (ut.villa) return svar(502, { villa: 'Tákn frá Slökkvitæki stóðst ekki' });
  return svar(200, ut);
};
