// rekstrarskyrsla.js — Rekstrarskýrsla dagsins fyrir Slökkvitæki og Brunahólf (Agnar 18.11.2026).
//
//   GET /api/rekstrarskyrsla?dagur=YYYY-MM-DD   (sjálfgefið: í dag, UTC = Ísland)
//     → { dagur, timabil[7], sl{…}, bh{…}, badir{tekjur, inn}, rod[30], samanburdur{dag,vika,svika}, ferskleiki{…} }
//
// AÐEINS LESTUR. Reiknireglurnar búa í _rekstur.js (prófaðar í test/rekstrarskyrsla.test.js); hér er aðeins sótt.
// Aðgangur: innskráður stjórnandi (hub_user-kakan, rola Admin) — tekjur beggja félaga, sama og Tekjur í beinni.
// Ekki innskráður → 401, starfsmaður sem er ekki Admin → 403. Lokað föll mæld með curl eftir birtingu.

const crypto = require('crypto');
const R = require('./_rekstur.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE = 'hub_user';
const STJORNENDUR = ['Admin'];

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

// Síðuskipt sókn. `qs` VERÐUR að bera order= sem gefur fasta röð (annars getur síðuskipting tvítalið eða sleppt).
async function allt(tafla, qs) {
  const ut = [];
  for (let fra = 0; ; fra += 1000) {
    const r = await sb(`${tafla}?${qs}`, { headers: { Range: `${fra}-${fra + 999}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(`${tafla}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    const sida = await r.json();
    ut.push(...sida);
    if (sida.length < 1000) return ut;
  }
}
async function eitt(tafla, qs) {
  const r = await sb(`${tafla}?${qs}&limit=1`);
  if (!r.ok) return null;
  const j = await r.json();
  return j[0] || null;
}

// ---- innskráning (sama og postmoppur.js / odin.js) ----
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
    : v === 403 ? svar(403, { villa: 'Aðeins stjórnandi sér rekstrarskýrsluna' })
      : svar(401, { villa: 'innskraning' }));

// opts.fra: sækja frá öðrum degi (rekstur-manudir.js: sex mánuðir aftur) · opts.bhAdeins: sleppa töflum Slökkvitækis (aðeins Brunahólf þarf)
async function saekja(d, opts = {}) {
  const fra = opts.fra || R.fyrstiDagur(d);
  const bhAdeins = !!opts.bhAdeins;
  const sl = (f) => (bhAdeins ? Promise.resolve([]) : f());          // LAT: aðeins kallað þegar SL-taflan er sótt (annars ræst sókn sem enginn hlustar á)
  const fraTs = `${fra}T00:00:00Z`;
  const ajourSia = `registration_status=eq.Done&project_name=neq.${encodeURIComponent(R.NLSH_AFRIT)}`
    + `&or=(execution_date.gte.${fra},checked_date.gte.${fra})`;
  const [solur, voidRadir, vorur, verkbeidnir, verklidur, uttektir, paydaySl, timavera, pricing, ajour, holeRates, sentMeta, drog, paydayBh,
    tvNyjast, tvInnlestur, ajNyjast, ajInnlestur, pdSlNyjast] = await Promise.all([
    sl(() => allt('solur', `select=id,status,is_credit,credit_of,greitt_med,upphaed_an_vsk,created_at,paid_at,krafa_sent_at,linur&or=(created_at.gte.${fraTs},paid_at.gte.${fraTs},krafa_sent_at.gte.${fraTs})&order=id.asc`)),
    sl(() => allt('solur', 'select=id&status=eq.void&order=id.asc')),
    sl(() => allt('vorur', 'select=id,nafn,flokkur,virkt&order=id.asc')),
    sl(() => allt('verkbeidnir', 'select=id,status,created_at,pickup,eytt_at&eytt_at=is.null&order=id.asc')),
    sl(() => allt('verklidur', 'select=job_id,status,eytt_at&eytt_at=is.null&order=id.asc')),
    sl(() => allt('customer_documents', `select=doc_date,is_duplicate&doc_type=eq.uttektarskyrsla&source=eq.app&doc_date=gte.${fra}&order=id.asc`)),
    sl(() => allt('payday_invoices_slokk', `select=status,paid_date,amount_ex&status=eq.PAID&paid_date=gte.${fra}&order=id.asc`)),
    allt('timavera_entries', `select=date,hours,project&date=gte.${fra}&date=lte.${d}&order=id.asc`),
    allt('pricing_guide', 'select=worksite_name,dagvinna_rate,effective_from&order=worksite_name.asc,effective_from.asc.nullsfirst,dagvinna_rate.asc'),
    // sýnin hefur engan einkvæman lykil: raðað eftir ÖLLUM völdum dálkum svo síðurnar gefi alltaf sama mengi
    allt('skr_hub_skraningar', `select=project_name,serial_number,category_group,execution_date,checked_date,registration_status&${ajourSia}`
      + '&order=project_name.asc,serial_number.asc,category_group.asc.nullsfirst,execution_date.asc.nullsfirst,checked_date.asc.nullsfirst'),
    allt('hole_size_rates', 'select=scope,size_min_mm,size_max_mm,rate_an_vsk&category=eq.hole&scope=in.(generic,heklureitur)&order=id.asc'),
    sl(() => allt('krofur_yfirlit_meta', `select=inv_key,sent,sent_at&sent=eq.true&sent_at=gte.${fraTs}&order=inv_key.asc`)),
    sl(() => allt('invoice_drafts', 'select=worksite_name,work_month,total_m_vsk&order=id.asc')),
    allt('invoices', `select=status,greidsla_date,hofudstoll&source=eq.payday&status=eq.PAID&greidsla_date=gte.${fra}&order=id.asc`),
    eitt('timavera_entries', 'select=date&order=date.desc'),
    eitt('timavera_entries', 'select=imported_at&imported_at=not.is.null&order=imported_at.desc'),
    eitt('skr_hub_skraningar', 'select=execution_date&execution_date=not.is.null&order=execution_date.desc'),
    eitt('skr_hub_skraningar', 'select=imported_at&imported_at=not.is.null&order=imported_at.desc'),
    bhAdeins ? Promise.resolve(null) : eitt('payday_invoices_slokk', 'select=updated_at&order=updated_at.desc.nullslast'),
  ]);
  // Kreditnóta miðast við dagsetningu FRUMSÖLUNNAR (Agnar 22.11.2026). Nótan getur verið í glugganum en frumsalan fyrir hann, svo frumsölur
  // sem vantar í lesturinn eru sóttar sér. Bregðist það heldur nótan eigin degi og er talin í kreditAnFrumsolu (aldrei þögult).
  let frumsolur = [], frumsolurBrast = false;
  if (!bhAdeins) {
    try {
      const hef = new Set(solur.map((r) => Number(r.id)));
      const vantar = [...new Set(solur.filter((r) => r.credit_of != null).map((r) => Number(r.credit_of)).filter((id) => Number.isInteger(id) && id > 0 && !hef.has(id)))];
      for (let i = 0; i < vantar.length; i += 150) frumsolur.push(...await allt('solur', `select=id,created_at,paid_at,greitt_med&id=in.(${vantar.slice(i, i + 150).join(',')})&order=id.asc`));
    } catch (e) { frumsolurBrast = true; frumsolur = []; }
  }
  const gogn = { solur, voidIds: voidRadir.map((r) => r.id), frumsolur, vorur, verkbeidnir, verklidur, uttektir, paydaySl, timavera, pricing, ajour,
    holeRates, sentMeta, drog, paydayBh };
  const nyjastGreitt = paydayBh.reduce((a, r) => (r.greidsla_date && r.greidsla_date > a ? r.greidsla_date : a), '');
  // 21.11.2026 — BH-reikningar sem eru MERKTIR GREIDDIR í Kröfu yfirliti (krofur_yfirlit_meta.paid, t.d. millifærsla
  // framhjá Payday) en Payday telur ekki greidda töldust hvergi í „Greitt til okkar" — október vantaði R-378 Landspítala
  // og R-372 Mosfellsbæ (3,32 m án vsk; yfirferð Agnars á yfirsýnarröndinni 21.11). Þeir bætast nú við á paid_at, með
  // höfuðstól eins og Payday-greiðslurnar. Payday-PAID reikningar eru ekki taldir aftur. Viðbót: bili sóknin stendur
  // Payday-talan óbreytt. `nyjastGreitt` (ferskleiki Payday) er reiknað á undan, svo það lýsir áfram Payday einu.
  try {
    const merkt = await allt('krofur_yfirlit_meta', `select=inv_key,paid_at&paid=eq.true&paid_at=gte.${fraTs}&order=inv_key.asc`);
    const tilvAf = (m) => (/^payday\|(\d{1,12})$/.exec((m && m.inv_key) || '') || [])[1];
    const tilv = [...new Set(merkt.map(tilvAf).filter(Boolean))];
    if (tilv.length) {
      const inv = await allt('invoices', `select=id,tilvisun,hofudstoll,status,utgafudagur&source=eq.payday&tilvisun=in.(${tilv.join(',')})&order=id.asc`);
      const eftirTilv = new Map(inv.map((i) => [String(i.tilvisun), i]));
      // Rýni 21.11: aðeins SENT (ógreiddur í Payday — CANCELLED/CREDIT voru aldrei greiðsla) og merktur innan 120 daga frá
      // útgáfu. 06.07.2026 voru 7 reikningar frá 2022–25 merktir greiddir í einni tiltekt (30,5 m, 235–1.313 dögum eftir
      // útgáfu); paid_at þar er smellurinn, ekki greiðsludagurinn, og ætti ekki að teljast innborgun þann dag.
      const DAGUR_MS = 86400000;
      for (const m of merkt) {
        const i = eftirTilv.get(String(tilvAf(m) || ''));
        if (!i || i.status !== 'SENT' || !m.paid_at || !i.utgafudagur || !(Number(i.hofudstoll) > 0)) continue;
        const dagar = (Date.parse(String(m.paid_at).slice(0, 10)) - Date.parse(String(i.utgafudagur).slice(0, 10))) / DAGUR_MS;
        if (dagar >= 0 && dagar <= 120) paydayBh.push({ status: 'PAID', greidsla_date: String(m.paid_at).slice(0, 10), hofudstoll: i.hofudstoll });
      }
    }
  } catch (e) { /* sjá að ofan */ }
  return {
    gogn,
    ferskleiki: {
      timavera: { nyjast: tvNyjast && tvNyjast.date, innlestur: tvInnlestur && tvInnlestur.imported_at },
      ajour: { nyjast: ajNyjast && ajNyjast.execution_date, innlestur: ajInnlestur && ajInnlestur.imported_at },
      payday_sl: pdSlNyjast ? { samstillt: pdSlNyjast.updated_at } : null,
      payday_bh: { nyjasta_greidsla: nyjastGreitt || null },
      frumsolur_brast: frumsolurBrast,
    },
  };
}

exports._saekja = saekja; // fyrir staðbundna sannprófun gegn SQL (netlify dev:exec, engin innskráning þarf)
exports._notandi = notandi; exports._hafnad = hafnad; exports._svar = svar; exports._allt = allt; // rekstur-manudir.js notar sömu innskráningu og lestur

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return svar(405, { villa: 'Aðeins GET' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return svar(500, { villa: 'Supabase vantar' });
  let n;
  try { n = await notandi(event); } catch (e) { return hafnad(502); }
  if (n.villa) return hafnad(n.villa);
  if (!n.stjornandi) return hafnad(403);

  const qs = event.queryStringParameters || {};
  const idag = new Date().toISOString().slice(0, 10);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(qs.dagur || '')) ? qs.dagur : idag;
  // ómögulegur dagur (t.d. 2026-06-31) fær ekki að reikna bull-tímabil
  const t = new Date(d + 'T00:00:00Z');
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) return svar(400, { villa: 'Ógild dagsetning' });
  if (d > idag || d < '2026-05-01') return svar(400, { villa: 'Dagur utan bils (01.05.2026 til dagsins í dag)' });

  try {
    const { gogn, ferskleiki } = await saekja(d);
    const s = R.skyrsla(d, gogn);
    return svar(200, { ...s, idag, sott: new Date().toISOString(), ferskleiki, notandi: n.nafn });
  } catch (e) {
    return svar(502, { villa: 'Gögn náðust ekki: ' + String(e.message || e).slice(0, 200) });
  }
};
