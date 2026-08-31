// svid-status.js — „ýttu á svið, fáðu samantekt frá þeirri rödd".
//
//   GET /api/svid-status?svid=<lykill>     (sjá SVID-skrána fyrir sviðin í boði)
//     → { ok, svid, name, emoji, voice_id, text, tolur }
//
// Hvert svið á sér SÉRFRÆÐING í .claude/agents/ (þekkingin) og RÖDD í
// js/jarvis-voice.js (útrásin). Þetta fall er brúin: það sækir LIFANDI tölur úr
// gagnagrunninum og lætur Claude umorða þær í 2–3 setningar í stíl sviðsins.
// Framendinn (jarvis.html) sendir svo `text` í /api/jarvis-tts með `voice_id`.
//
// Kostnaður er lítill með vilja: Haiku + max_tokens 220, og aðeins TÖLUR fara til
// Claude — aldrei heilar töflur. TTS-svörin cache-ast í /api/jarvis-tts svo sama
// setning er aldrei rukkuð tvisvar.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC    = process.env.ANTHROPIC_API_KEY;
const SELF         = process.env.URL || 'https://brunaholf.netlify.app';

/* ── sviðin ───────────────────────────────────────────────────────────────── */
const SVID = {
  por: {
    name: 'Sara', emoji: '🗂️', agent: 'sara-organizer',
    rodd: 'sara',                                       // lykill í js/jarvis-voice.js
    voice_id: '4575dfa5b64148ad8b48542a5ebd0749',      // Margot Robbie
    kyn: 'kvk',                                         // kvenrödd → ávarpar Anni sem "Annthor"
    still_en: 'Organised, warm and to the point. You tidy things up and say what is still outstanding. No drama.',
    safna: safnaPor,
  },
  tengingar: {
    name: 'Samuel L. Jackson', emoji: '😤', agent: 'tengingar',
    rodd: 'sam',                                        // lykill í js/jarvis-voice.js
    voice_id: 'ce67291306284add89ad9e3db6249ad9',
    kyn: 'kk',                                          // karlrödd → ávarpar Anni sem "Big Boss Anni"
    still_en: 'Direct and emphatic, no filler. States what is fine and what needs fixing NOW. Never rude.',
    safna: safnaTengingar,
  },
  fjarmal: {
    name: 'Samantha', emoji: '💰', agent: 'bokari',
    rodd: 'scarlett', voice_id: '474887f7949b4d1ab3e626cddf82613a', kyn: 'kvk',
    still_en: 'Warm, calm and precise about money — what is outstanding and what is ready to invoice. No drama.',
    safna: safnaFjarmal,
  },
  kunnar: {
    name: 'Charlize Theron', emoji: '👥', agent: 'kunnaskra',
    rodd: 'charlize', voice_id: '97f77cf6e657419ab543e9d94dcf10a0', kyn: 'kvk',
    still_en: 'Cool, composed and factual about the customer base.',
    safna: safnaKunnar,
  },
  gogn: {
    name: 'Jason Statham', emoji: '🔌', agent: 'gagnaleidslur',
    rodd: 'statham', voice_id: '656b4b83522644d9b1d11e31afb90cfd', kyn: 'kk',
    still_en: 'Direct, no nonsense about whether the data pipelines are flowing or stalled.',
    safna: safnaGogn,
  },
  skjol: {
    name: 'Morgan Freeman', emoji: '📄', agent: 'skjol',
    rodd: 'freeman', voice_id: '76bb6ae7b26c41fbbd484514fdb014c2', kyn: 'kk',
    still_en: "Measured, with a narrator's gravitas, about documents and how they are filed.",
    safna: safnaSkjol,
  },
  hradi: {
    name: 'Bruce Willis', emoji: '💥', agent: 'hradi',
    rodd: 'willis', voice_id: '87efb8f2ec4f4b3b8ed9f3fd64a3ab4b', kyn: 'kk',
    still_en: 'Blunt, action-hero calm about system speed — what is fast and what is dragging.',
    safna: safnaHradi,
  },
  jarvis: {
    name: 'Jarvis', emoji: '🎩', agent: 'jarvis',
    rodd: 'jarvis', voice_id: '612b878b113047d9a770c069c8b4fdfe', kyn: 'kk',
    still_en: 'Impeccably composed English butler — a crisp, courteous morning briefing of the whole operation, with a touch of dry wit. End with the single most useful thing to do first.',
    safna: safnaJarvis,
  },
  oryggi: {
    name: 'Arnold', emoji: '🔒', agent: 'oryggi',
    rodd: 'arnold', voice_id: '2270085c19e14054b63e0e451593e0f0', kyn: 'kk',
    still_en: 'The security guardian. Terse, protective, no-nonsense — state what is exposed and what is locked down, then order the next fix. Never alarmist.',
    safna: safnaOryggi,
  },
  prentun: {
    name: 'Danny DeVito', emoji: '🏷️', agent: 'prentun',
    rodd: 'devito', voice_id: '17b88cf496b9495298a10f1b7eada19a', kyn: 'kk',
    still_en: 'Fast-talking, wisecracking shop-floor energy about labels and QR codes — what is tagged and what is still missing a serial. Funny but factual.',
    safna: safnaPrentun,
  },
  kort: {
    name: 'Gordon Ramsay', emoji: '🗺️', agent: 'kort',
    rodd: 'ramsay', voice_id: 'e605a2a42b0a44ccb7af2e42e1676c92', kyn: 'kk',
    still_en: 'Fiery chef energy about the map — praise what is geocoded, roast the messy addresses that will not resolve. Sharp, never crude.',
    safna: safnaKort,
  },
  yfirlit: {
    name: 'Trump', emoji: '🇺🇸', agent: 'hype',
    rodd: 'trump', voice_id: '5dcaea7bfca74256bdbafc77593a8770', kyn: 'kk',
    still_en: 'Big, confident hype-man energy — superlatives, short punchy sentences. Celebrate the wins, call out what still needs doing. Never crude.',
    safna: safnaYfirlit,
  },
};

// Hvernig á að ávarpa notandann UPPHÁTT.
//   Agnar → alltaf "Agnar".
//   Annþór → fer eftir KYNI raddarinnar (ósk Agnars 2026-08-01):
//     karlraddir kalla hann "Big Boss Anni", kvenraddir "Annthor"
//     (stafað hljóðrétt svo ensk TTS-rödd beri það rétt fram).
function avarp(notandi, kyn) {
  if (notandi === 'anni') return kyn === 'kk' ? 'Big Boss Anni' : 'Annthor';
  return 'Agnar';
}

/* ── gagnasöfnun (aðeins tölur — aldrei heilar töflur til Claude) ─────────── */

async function safnaPor() {
  const ar = new Date().getFullYear();
  const raðir = await sb(`v_bundle_coverage?yr=eq.${ar}&select=kind,stada`);
  const t = {};
  (raðir || []).forEach(r => {
    const k = `${r.kind}/${r.stada}`;
    t[k] = (t[k] || 0) + 1;
  });
  const summa = (s) => Object.keys(t).filter(k => k.endsWith('/' + s)).reduce((a, k) => a + t[k], 0);
  return {
    ar,
    klarad:          summa('klarad'),
    vantar_reikning: summa('vantar_reikning'),
    vantar_skyrslu:  summa('vantar_skyrslu'),
    reikn_payday:    summa('reikn_payday'),
    sundurlidad: t,
  };
}

async function safnaTengingar() {
  const r = await fetch(`${SELF}/api/kerfisheilsa`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('kerfisheilsa svaraði ' + r.status);
  const j = await r.json();
  const c = j.counts || {};
  const raud = (j.services || []).filter(s => s.status === 'raudt').map(s => s.heiti);
  const gul  = (j.services || []).filter(s => s.status === 'gult').map(s => s.heiti);
  return {
    graent: c.graent || 0, gult: c.gult || 0, raudt: c.raudt || 0, graat: c.graat || 0,
    alls: (j.services || []).length,
    raud_heiti: raud.slice(0, 5),
    gul_heiti:  gul.slice(0, 5),
  };
}

// ── létt hjálpartól ────────────────────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(`${SELF}${path}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(path + ' svaraði ' + r.status);
  return r.json();
}
async function sbCount(path) {
  // select=* svo talningin virki á töflur OG view án tillits til dálkaheita —
  // select=id skilaði 400 (og þar með ÞÖGLU 0-i) á geocode_cache og
  // v_bundle_coverage, sem eiga engan id-dálk (beit 2026-08-20).
  const sep = path.indexOf('?') >= 0 ? '&' : '?';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}select=*`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) throw new Error(path.split('?')[0] + ' taldi ekki: ' + r.status);
  const cr = r.headers.get('content-range') || '';   // t.d. "0-0/1082"
  return parseInt((cr.split('/')[1] || '0'), 10) || 0;
}

// ── 💰 Fjármál (Samantha) — útistandandi / til að rukka ────────────────────
async function safnaFjarmal() {
  const j = await apiGet('/api/debtors');
  const t = j.totals || {};
  return {
    utistandandi_kr: Math.round(t.outstanding_kr || 0),
    fjoldi_reikninga: t.outstanding_n || 0,
    skuldunautar: t.debtor_count || 0,
    greitt_i_banka_kr: Math.round(t.bank_paid_kr || 0),
  };
}
// ── 👥 Kúnnar (Charlize) — stærð viðskiptamannagrunns ─────────────────────
async function safnaKunnar() {
  const [base, thjon] = await Promise.all([
    sbCount('customers_base'),
    sbCount('fyrirtaeki?er_i_thjonustu=eq.true&deleted_at=is.null'),
  ]);
  return { vidskiptavinir_alls: base, fyrirtaeki_i_thjonustu: thjon };
}
// ── 🔌 Gagnaleiðslur (Statham) — ferskleiki linda ─────────────────────────
async function safnaGogn() {
  const j = await apiGet('/api/data-sources-status');
  const arr = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      const nafn = o.name || o.heiti || o.key || o.id;
      if (nafn && o.status) arr.push({ nafn, status: String(o.status) });
      Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v); });
    }
  })(j);
  const ferskar = arr.filter(x => /fersk|fresh|ok/i.test(x.status)).length;
  const eldast  = arr.filter(x => !/fersk|fresh|ok/i.test(x.status));
  return { lindir_alls: arr.length, ferskar, ad_eldast: eldast.length,
    ekki_ferskar_heiti: eldast.map(x => x.nafn).slice(0, 6) };
}
// ── 📄 Skjöl (Freeman) — tengd vs ótengd ──────────────────────────────────
async function safnaSkjol() {
  const j = await apiGet('/api/service-gaps');
  const c = j.counts || {};
  return { tengd_skjol: c.linked_total || 0, med_stad: c.med_stad || 0,
    an_stadar: c.an_stadar || 0, otengd: c.unlinked || 0 };
}
// ── 💥 Hraði (Willis) — mælir 2 lykil-endapunkta raðbundið (engin sprengja) ─
async function safnaHradi() {
  async function ms(path) {
    const t0 = Date.now();
    try { const r = await fetch(`${SELF}${path}`); await r.arrayBuffer(); return Date.now() - t0; }
    catch (e) { return -1; }
  }
  const kerfisheilsa_ms = await ms('/api/kerfisheilsa');
  const verkstadir_ms = await ms('/api/worksites');
  return { kerfisheilsa_ms, verkstadir_ms };
}
// ── 🇺🇸 Yfirlit (Trump) — heildarmynd rekstursins til að hæpa ──────────────
async function safnaYfirlit() {
  const [deb, base, thjon] = await Promise.all([
    apiGet('/api/debtors').catch(() => ({ totals: {} })),
    sbCount('customers_base'),
    sbCount('fyrirtaeki?er_i_thjonustu=eq.true&deleted_at=is.null'),
  ]);
  const t = (deb && deb.totals) || {};
  return {
    vidskiptavinir_alls: base,
    fyrirtaeki_i_thjonustu: thjon,
    utistandandi_kr: Math.round(t.outstanding_kr || 0),
    skuldunautar: t.debtor_count || 0,
  };
}

// ── 🎩 Jarvis — dagleg yfirsýn þvert á sviðin (aðeins lykiltölurnar) ────────
async function safnaJarvis() {
  const ar = new Date().getFullYear();
  // 4s þak PER undirkall (ekki bara 12s heild): kerfisheilsa/debtors spike-a
  // stundum og Netlify drepur fallið á 10s — betri ein tala sem vantar en
  // ekkert svar (beit á preview 2026-08-20: annað hvert kall dó á 11s).
  const q = (p, fb) => withTimeout(p, 4000).catch(() => fb);
  const [beidni, i_vinnu, heilsa, deb, vantar_reikning, huntTolur] = await Promise.all([
    q(sbCount('verkefnalisti?status=eq.beidni'), null),
    q(sbCount('verkefnalisti?status=eq.i_vinnu'), null),
    q(apiGet('/api/kerfisheilsa'), { counts: {}, services: [] }),
    q(apiGet('/api/debtors'), { totals: {} }),
    q(sbCount(`v_bundle_coverage?yr=eq.${ar}&stada=eq.vantar_reikning`), null),
    q(sb('v_veidin_hunt_tolur?select=*').then(r => (r && r[0]) || {}), {}),
  ]);
  const hc = heilsa.counts || {};
  const t = (deb && deb.totals) || {};
  const hunt = huntTolur || {};
  return {
    opin_verk_beidni: beidni,
    verk_i_vinnu: i_vinnu,
    kerfi_raud: hc.raudt || 0,
    kerfi_gul: hc.gult || 0,
    utistandandi_kr: Math.round(t.outstanding_kr || 0),
    vantar_reikning_i_ar: vantar_reikning,
    systkini_kt: hunt.systkini_kt,
    blob_graen_an_skyrslu: hunt.blob_graen_an_skyrslu,
    hud_buid_vs_skyrsla: hunt.hud_buid_vs_skyrsla,
    grunnlinan: '2026-07-30 er upphaf Agnars, ekki í dag',
  };
}
// ── 🔒 Öryggi (Arnold) — RLS-staða + buckets gegnum oryggi_counts() RPC ─────
//    (SECURITY DEFINER fall, aðeins service_role má keyra — sjá
//     sql/2026-08-20_oryggi_counts.sql og oryggi-sérfræðinginn)
async function safnaOryggi() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/oryggi_counts`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error('oryggi_counts svaraði ' + r.status);
  return r.json();
}
// ── 🏷️ Prentun (DeVito) — merkt tæki og raðnúmeralaus ──────────────────────
async function safnaPrentun() {
  const [taeki, radnr_vantar, lanstaeki] = await Promise.all([
    sbCount('uttaeki'),
    sbCount('uttaeki?serial=is.null'),
    sbCount('lanstaeki'),
  ]);
  return { taeki_alls: taeki, radnr_vantar, lanstaeki_alls: lanstaeki };
}
// ── 🗺️ Kort (Ramsay) — geocode-þekjan ──────────────────────────────────────
async function safnaKort() {
  const [adressur, i_cache] = await Promise.all([
    sbCount('fyrirtaeki?heimilisfang=not.is.null&deleted_at=is.null'),
    sbCount('geocode_cache'),
  ]);
  return { adressur_alls: adressur, i_geocode_cache: i_cache };
}

/* ── skyndiminni (app_kv, ein færsla per sviði) ───────────────────────────── */
const cacheKey = (svid, notandi) => `svid_cache_${svid}_${notandi}`;
async function readCache(svid, notandi) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.${cacheKey(svid, notandi)}&select=value`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return null;
  const rows = await r.json();
  return (rows[0] && rows[0].value) || null;
}
async function writeCache(svid, notandi, entry) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_kv`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: cacheKey(svid, notandi), value: entry, updated_at: new Date().toISOString() }),
  });
}

/* ── handler ──────────────────────────────────────────────────────────────── */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });

  const p = event.queryStringParameters || {};
  const lykill = String(p.svid || '').trim();
  const s = SVID[lykill];
  if (!s) return json(400, { error: 'Óþekkt svið', i_bodi: Object.keys(SVID) });
  const notandi = String(p.notandi || 'agnar').trim().toLowerCase();
  const nafn = avarp(notandi, s.kyn);

  // ── tölu-hamur (HUD-spjöld): lifandi tölur, ekkert Claude/skyndiminni ──────
  if (String(p.tolur || '') === '1') {
    let tolur;
    try { tolur = await withTimeout(s.safna(), 12000); }
    catch (e) { return json(200, { ok: true, svid: lykill, name: s.name, emoji: s.emoji, tolur: null, villa: String(e.message || e) }); }
    return json(200, { ok: true, svid: lykill, name: s.name, emoji: s.emoji, tolur });
  }

  const ferskt = String(p.fresh || '') === '1';

  // ── SKYNDIMINNI: sjálfgefið skilar GEYMDRI samantekt STRAX (engin safna/Claude
  //    → hröð hleðsla, engin hik). ?fresh=1 endurreiknar. Geymt í app_kv per sviði.
  if (!ferskt) {
    const c = await readCache(lykill, notandi).catch(() => null);
    if (c && c.text) {
      return json(200, { ok: true, svid: lykill, name: s.name, emoji: s.emoji, rodd: s.rodd,
        voice_id: s.voice_id, text: c.text, tolur: c.tolur || null, generated_at: c.generated_at, cached: true });
    }
  }

  // ── FERSKT: sæki tölur (+ Claude) og geymi í skyndiminni ──────────────────
  let tolur;
  try { tolur = await withTimeout(s.safna(), 12000); }
  catch (e) { return json(200, {
    ok: true, svid: lykill, name: s.name, emoji: s.emoji, rodd: s.rodd, voice_id: s.voice_id,
    text: 'I cannot reach the numbers right now. The database is not responding.',
    villa: String(e.message || e), tolur: null,
  }); }

  let text;
  if (ANTHROPIC) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 220,
          system:
            `You are ${s.name}, a specialist in a fire-safety business system ` +
            `(Brunahólf ehf / Slökkvitæki ehf, Iceland).\n` +
            `Style: ${s.still_en}\n\n` +
            `The person you are talking to is "${nafn}". Address them by that exact name ` +
            'if you address them at all — do not change or translate it.\n' +
            'Write 2-3 short sentences in ENGLISH that will be READ ALOUD by a voice. ' +
            'Lead with the number that matters most. No headings, no bullet points, no ' +
            'markdown, no emoji — just natural spoken English. If something needs action, ' +
            'say so plainly in the last sentence. Keep Icelandic place and company names as they are.',
          messages: [{ role: 'user', content: "Today's numbers:\n" + JSON.stringify(tolur, null, 1) }],
        }),
      });
      const j = await r.json();
      text = (j && j.content && j.content[0] && j.content[0].text || '').trim();
    } catch (_) { /* fellur á einföldu útgáfuna */ }
  }
  text = text || einfold(lykill, tolur);
  const generated_at = new Date().toISOString();
  await writeCache(lykill, notandi, { text, tolur, generated_at }).catch(() => {});

  return json(200, { ok: true, svid: lykill, name: s.name, emoji: s.emoji, rodd: s.rodd,
    voice_id: s.voice_id, agent: s.agent, text, tolur, generated_at, cached: false });
};

/* ── varaleið án Claude ───────────────────────────────────────────────────── */
function einfold(lykill, t) {
  if (lykill === 'por') {
    return `Coverage ${t.ar}: ${t.klarad} bundles complete. ${t.vantar_reikning} sites need an ` +
           `invoice and ${t.vantar_skyrslu} need a report.`;
  }
  if (lykill === 'tengingar') {
    return `${t.graent} of ${t.alls} connections are healthy. ` +
           (t.raudt ? `${t.raudt} are red: ${t.raud_heiti.join(', ')}.` : 'None are red.');
  }
  if (lykill === 'jarvis') {
    return `Good morning. ${t.opin_verk_beidni} tasks are waiting and ${t.verk_i_vinnu} are in progress. ` +
           `${t.kerfi_raud} systems are red. ${t.systkini_kt || 0} sibling-kt sites still lack their own 2026 report. ` +
           `The July 30 line is when Agnar started, not today.`;
  }
  if (lykill === 'oryggi') {
    return `${t.rls_af} of ${t.toflur_alls} tables have row level security off, and ` +
           `${t.buckets_public} of ${t.buckets_alls} storage buckets are public. Lock down the backups first.`;
  }
  if (lykill === 'prentun') {
    return `${t.taeki_alls} units are registered and ${t.radnr_vantar} are missing a serial number. ` +
           `${t.lanstaeki_alls} loaner units on file.`;
  }
  if (lykill === 'kort') {
    return `${t.i_geocode_cache} addresses are in the geocode cache, out of ${t.adressur_alls} on file.`;
  }
  if (lykill === 'yfirlit') {
    return `${t.fyrirtaeki_i_thjonustu} companies in service, ${t.vidskiptavinir_alls} customers total. ` +
           `${Math.round((t.utistandandi_kr || 0) / 1000)} thousand krónur outstanding from ${t.skuldunautar} debtors.`;
  }
  return 'No summary available.';
}

/* ── verkfæri ─────────────────────────────────────────────────────────────── */
async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return r.json();
}
function withTimeout(pr, ms) {
  return Promise.race([pr, new Promise((_, rej) =>
    setTimeout(() => rej(new Error('svaraði ekki innan ' + ms / 1000 + 's')), ms))]);
}
function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type',
           'access-control-allow-methods': 'GET,OPTIONS' };
}
function json(code, obj) {
  return { statusCode: code,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()),
    body: JSON.stringify(obj) };
}
