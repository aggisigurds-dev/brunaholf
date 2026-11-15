// postmoppur.js — rofinn fyrir Thunderbird-möppur póst-brúarinnar (luna-bridge/moppur.js) og viðhengi eftir beiðni.
//
// Agnar 15.11.2026: „Get ég kveikt á innsoginu einhvers staðar?" — brúin las aðeins INBOX + Sent. Nú sendir hún
// möppulista hvers hólfs á app_kv `bru_moppur:<vél>`, og hér er kveikt/slökkt per möppu (app_kv `bru_moppur_kveikt`).
// Allt er slökkt þar til kveikt er hér. Kveikt mappa er lesin frá byrjun í næstu keyrslum brúarinnar (á 15 mín. fresti).
//
//   GET  /api/postmoppur                                  → { velar, kveikt, beidnir, nidurstada, stjornandi }
//   POST /api/postmoppur { action:'kveikja', account, mappa, kveikt:true|false }
//   POST /api/postmoppur { action:'saekja_vidhengi', email_id }   → brúin sækir viðhengi skeytisins úr mbox-skránni
//
// Innskráning: cookie-ið hub_user úr /api/hub-adgangar (sama sannprófun og vefur-efni.js). Starfsmaður sér listann;
// aðeins Admin breytir. Engin möppuheiti eða hólf eru tekin gild nema brúin hafi sjálf sent þau (engin frjáls slóð).
// app_kv er með RLS; fallið les og skrifar með service-lykli.

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE = 'hub_user';
const STJORNENDUR = ['Admin'];
const KV_KVEIKT = 'bru_moppur_kveikt';
const KV_BID = 'bru_vidhengi_bid';
const KV_NID = 'bru_vidhengi_nidurstada';
const MAX_BEIDNIR = 50;

const svar = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  body: JSON.stringify(body),
});

async function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}
async function lesaKv(key) {
  const r = await sb(`app_kv?key=eq.${encodeURIComponent(key)}&select=value,updated_at`);
  if (!r.ok) throw new Error('app_kv ' + r.status);
  const j = await r.json();
  return j[0] ? j[0].value : null;
}
async function skrifaKv(key, value) {
  const r = await sb('app_kv?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('app_kv skrif ' + r.status);
}

// ---- innskráning (sama og vefur-efni.js / hub-adgangar.js) ----
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
async function notandi(event) {
  const tok = kokur(event)[COOKIE];
  if (typeof tok !== 'string' || tok.length < 20 || tok.length > 2000) return { villa: 401 };
  const i = tok.indexOf('.');
  if (i < 1) return { villa: 401 };
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
  const u = await sb(`hub_adgangar?id=eq.${uid}&select=id,nafn,notandanafn,rola,virkur`);
  if (!u.ok) return { villa: 502 };
  const n = (await u.json())[0];
  if (!n || !n.virkur) return { villa: 401 };
  return { nafn: (String(n.nafn || '').trim().split(/\s+/)[0] || String(n.notandanafn || '') || 'Ónefndur').slice(0, 40), stjornandi: STJORNENDUR.includes(n.rola) };
}
const hafnad = (v) => (v === 503 ? svar(503, { villa: 'Innskráning starfsmanna er ekki sett upp' })
  : v === 502 ? svar(502, { villa: 'Innskráning náðist ekki' })
    : v === 403 ? svar(403, { villa: 'Aðeins stjórnandi getur breytt þessu' })
      : svar(401, { villa: 'innskraning' }));

async function velar() {
  const r = await sb('app_kv?key=like.bru_moppur:*&select=key,value,updated_at');
  if (!r.ok) throw new Error('app_kv ' + r.status);
  return (await r.json()).map((x) => ({ vel: (x.value && x.value.vel) || x.key.slice('bru_moppur:'.length), uppfaert: (x.value && x.value.uppfaert) || x.updated_at, holf: (x.value && x.value.holf) || {}, utilokad: (x.value && x.value.utilokad) || [] }));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return svar(500, { villa: 'Supabase vantar' });
  let hver;
  try { hver = await notandi(event); } catch (e) { return svar(502, { villa: 'Innskráning náðist ekki' }); }
  if (hver.villa) return hafnad(hver.villa);

  try {
    if (event.httpMethod === 'GET') {
      const [v, kveikt, bid, nid] = await Promise.all([velar(), lesaKv(KV_KVEIKT), lesaKv(KV_BID), lesaKv(KV_NID)]);
      return svar(200, { ok: true, velar: v, kveikt: kveikt || {}, beidnir: (bid && bid.beidnir) || [], nidurstada: nid || {}, stjornandi: hver.stjornandi, nafn: hver.nafn });
    }
    if (event.httpMethod !== 'POST') return svar(405, { villa: 'Aðeins GET og POST' });
    if (!hver.stjornandi) return hafnad(403);
    let b;
    try { b = JSON.parse(event.body || '{}'); } catch (e) { return svar(400, { villa: 'Ógilt JSON' }); }

    if (b.action === 'kveikja') {
      const account = String(b.account || ''), mappa = String(b.mappa || '');
      const v = await velar();
      const til = v.some((x) => Object.keys(x.holf).some((a) => a.toLowerCase() === account.toLowerCase()
        && (x.holf[a] || []).some((m) => m && m.mappa === mappa)));
      if (!til) return svar(400, { villa: 'Brúin hefur ekki sent þessa möppu' });
      const kveikt = (await lesaKv(KV_KVEIKT)) || {};
      const lykill = Object.keys(kveikt).find((k) => !k.startsWith('_') && k.toLowerCase() === account.toLowerCase()) || account;
      const listi = new Set(Array.isArray(kveikt[lykill]) ? kveikt[lykill] : []);
      if (b.kveikt === false) listi.delete(mappa); else listi.add(mappa);
      kveikt[lykill] = [...listi].sort();
      if (!kveikt[lykill].length) delete kveikt[lykill];
      kveikt._breytt = { af: hver.nafn, at: new Date().toISOString(), mappa: `${account}/${mappa}`, kveikt: b.kveikt !== false };
      await skrifaKv(KV_KVEIKT, kveikt);
      return svar(200, { ok: true, kveikt });
    }

    if (b.action === 'saekja_vidhengi') {
      const id = Number(b.email_id);
      if (!Number.isInteger(id) || id < 1) return svar(400, { villa: 'Ógilt númer pósts' });
      const r = await sb(`email_digest?id=eq.${id}&select=id,account,subject,received_at,source_path,has_attachment`);
      if (!r.ok) return svar(502, { villa: 'email_digest ' + r.status });
      const row = (await r.json())[0];
      if (!row) return svar(404, { villa: 'Pósturinn finnst ekki' });
      if (!row.source_path) return svar(400, { villa: 'Þessi póstur kom ekki úr Thunderbird; viðhengi hans eru sótt annars staðar' });
      const bid = (await lesaKv(KV_BID)) || {};
      const beidnir = (Array.isArray(bid.beidnir) ? bid.beidnir : []).filter((x) => x && x.email_id !== id);
      beidnir.push({ email_id: id, efni: String(row.subject || '').slice(0, 120), af: hver.nafn, at: new Date().toISOString() });
      await skrifaKv(KV_BID, { beidnir: beidnir.slice(-MAX_BEIDNIR) });
      return svar(200, { ok: true, beidni: beidnir[beidnir.length - 1] });
    }

    return svar(400, { villa: 'Óþekkt aðgerð' });
  } catch (e) {
    return svar(500, { villa: 'Villa í postmoppur' });
  }
};
