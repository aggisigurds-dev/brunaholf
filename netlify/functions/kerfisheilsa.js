// kerfisheilsa.js — ERU TENGINGARNAR LIFANDI? Eitt ljósaborð yfir alla lykla
// og aðganga sem kerfið stendur á.
//
//   GET /api/kerfisheilsa            → ÓDÝRT: staða úr grunni + geymdum prófunum.
//                                      ENGIN köll út úr húsi, svarar á ~200ms.
//   GET /api/kerfisheilsa?test=1     → PRÓFAR í alvöru (Google/Payday/Tímavera)
//                                      og geymir niðurstöðuna.
//   GET /api/kerfisheilsa?test=<id>  → prófar EINA tengingu.
//
// AF HVERJU ÞETTA ER TIL (2026-07-31, ósk Agnars)
// Tengi-takkarnir voru dreifðir um allt: Gmail í Bakendanum, Tímavera-lykillinn
// í öðru korti, Payday hvergi sýnilegt. Þegar tenging dettur út (lykill
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
const KV_LYKLAR = 'kerfisheilsa_lyklar';

const GREEN = 'graent', AMBER = 'gult', RED = 'raudt', GREY = 'graat';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  // POST {action:'rotated', id, note} — skrá að lykill hafi verið endurnýjaður.
  // Geymir EKKERT nema tímastimpil + minnispunkt; aldrei lykilinn sjálfan.
  if (event.httpMethod === 'POST') {
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) {}
    if (b.action !== 'rotated' || !b.id) return json(400, { error: "Vantar {action:'rotated', id}" });
    const kv = await kvAll();
    const skra = (kv[KV_LYKLAR] && typeof kv[KV_LYKLAR] === 'object') ? kv[KV_LYKLAR] : {};
    skra[b.id] = { at: new Date().toISOString(), note: (b.note || '').slice(0, 200), baseline: !!b.baseline };
    await kvSet(KV_LYKLAR, skra);
    return json(200, { ok: true, id: b.id, at: skra[b.id].at });
  }
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

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

    const services = build(accounts, kv, mailFresh, runs, probes)
      .concat(lyklaskra(kv));
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

// NB: NÁKVÆMLEGA sama handaband og payday-pull.js gerir — POST /auth/token með
// `Api-Version` haus. (Fyrsta útgáfa notaði slóðina úr gamalli athugasemd og
// gleymdi hausnum → 404 sem leit út eins og Payday væri niðri. Prófunin verður
// að spegla raunverulegu leiðina, annars mælir hún sjálfa sig.)
async function probePayday() {
  const id = process.env.PAYDAY_CLIENT_ID, secret = process.env.PAYDAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PAYDAY_CLIENT_ID/SECRET vantar í umhverfið');
  const base = (process.env.PAYDAY_API_BASE || 'https://api.payday.is').replace(/\/+$/, '');
  const path = process.env.PAYDAY_TOKEN_PATH || '/auth/token';
  const r = await fetch(base + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
      'Api-Version': process.env.PAYDAY_API_VERSION || 'alpha',
    },
    body: JSON.stringify({ clientId: id, clientSecret: secret }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120));
  let j = {}; try { j = JSON.parse(t); } catch (_) {}
  if (!(j.accessToken || j.access_token || j.token)) throw new Error('svar án aðgangslykils');
  return 'aðgangslykill fékkst';
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
      hvernig: a.id === 1
        ? 'Þessi aðgangur keyrir ALLT Drive- og Sheets-dótið (skjalalestur, möppuflokkun, Sheet-smíði) auk Gmail. Í skýinu — engin tölva þarf að vera í gangi.'
        : 'Gmail API úr skýi (`/api/gmail-ingest?account=…`) sækir póstinn beint frá Google inn í email_digest. Engin tölva þarf að vera í gangi.',
      talning: fersk ? { label: 'nýjasti póstur', dagar: aldur } : null,
      profad: t ? t.at : null,
      adgerdir: [
        { label: '⏱ Prófa', test: id },
        { label: '🔌 Tengja aftur', url: '/api/google-auth?account=' + encodeURIComponent(a.email) },
        { label: '📥 Sækja póst núna', url: '/api/gmail-ingest?account=' + encodeURIComponent(a.email) + '&days=10' },
      ],
      tenglar: [{ label: 'Google · aðgangsheimildir ↗', url: 'https://myaccount.google.com/permissions' }],
    });
  });
  VAENT.filter(e => !accounts.some(a => (a.email || '').toLowerCase() === e)).forEach(e => {
    S.push({
      id: 'google:' + e, hopur: 'Pósthólf', heiti: e, undir: 'Gmail-innsog',
      status: RED, detail: 'ekki tengt',
      hvernig: 'Smelltu á Tengja og skráðu þig inn SEM ÞETTA netfang (Google forvelur það). Eftir það sækir skýið póstinn sjálft.',
      adgerdir: [{ label: '🔌 Tengja', url: '/api/google-auth?account=' + encodeURIComponent(e) }],
    });
  });
  S.push({
    id: 'graph', hopur: 'Pósthólf', heiti: '@brunaholf.is (Office 365)',
    undir: 'Microsoft Graph', status: GREY,
    detail: 'ekki útfært enn',
    hvernig: 'Þessi pósthólf koma EKKI úr skýinu heldur gegnum Thunderbird á luna-bridge-tölvunni (bridge.js les mbox-skrárnar á 15 mín fresti). Ef sú tölva er slökkt hættir póstur að berast. Microsoft Graph-tenging myndi leysa það.',
  });

  // ── Greiðslur & bókhald ──────────────────────────────────
  const pdTok = kv['payday_oauth'] || {};
  const pdExp = pdTok && (pdTok.expires_at || pdTok.expiresAt);
  S.push(svc('payday', 'Greiðslur & bókhald', 'Payday — Brunahólf', 'Reikningar og kröfur',
    pr('payday'), env('PAYDAY_CLIENT_ID') && env('PAYDAY_CLIENT_SECRET'),
    'PAYDAY_CLIENT_ID/SECRET vantar', runs['payday-pull'], pdExp, {
      hvernig: 'Í SKÝINU. `/api/payday-pull` skráir sig inn með client-lyklum (Netlify env) og sækir reikninga → `invoices`. Engin tölva, engin xlsx-skrá. Vara-leið ef API dettur: flytja út „Reikningar" xlsx í Drive og keyra „Payday úr Drive" í Bakenda.',
      adgerdir: [{ label: '📥 Sækja núna', url: '/api/payday-pull' }],
      tenglar: [{ label: 'Payday ↗', url: 'https://app.payday.is' }],
    }));
  S.push(svc('payday-slokk', 'Greiðslur & bókhald', 'Payday — Slökkvitæki', 'Sami aðgangur, eigin spegill',
    pr('payday'), env('PAYDAY_CLIENT_ID') && env('PAYDAY_CLIENT_SECRET'),
    'PAYDAY_CLIENT_ID/SECRET vantar', runs['payday-pull-slokk'],
    (kv['payday_oauth_slokk'] || {}).expires_at, {
      hvernig: 'Í SKÝINU. `/api/payday-pull-slokk` speglar ALLA Payday-reikninga Slökkvitækja í `payday_invoices_slokk` (aðskilið frá Brunahólfs-tölunum). Keyrir sjálfkrafa kl. 10 og 15 gegnum payday-sync-cron.',
      adgerdir: [{ label: '📥 Sækja núna', url: '/api/payday-pull-slokk' }],
    }));
  // ── Gagnaleiðslur ────────────────────────────────────────
  S.push(svc('timavera', 'Gagnaleiðslur', 'Tímavera API', 'Vinnufærslur beint úr Tímaveru',
    pr('timavera'), env('TIMAVERA_API_KEY') || !!kv['timavera_api_key'],
    'enginn API-lykill', runs['timavera-pull'], null, {
      hvernig: 'Í SKÝINU. `/api/timavera-pull` sækir vinnufærslur beint úr Tímaveru-API. Lykillinn (tv_live_…) er límdur inn í Bakendi-kortið „🕒 Tímavera API" og geymist í gagnagrunni — ekki í vafranum. Þetta leysti af hólmi skrap-forritið á borðtölvunni.',
      adgerdir: [{ label: '📥 Sækja núna', url: '/api/timavera-pull?days=14' }],
    }));

  // NB gamli „Lyklar"-hópurinn (bara til/ekki til) var hér — hann er felldur
  // inn í LYKLASKRÁNA að neðan, sem segir það sama PLÚS hvar lykillinn býr,
  // hvað hann opnar og hvernig honum er skipt. Tveir hópar um sömu lyklana
  // hefðu bara verið tvær útgáfur af sannleikanum.

  return S;
}

/* ─────────────────── 🔑 LYKLASKRÁIN ───────────────────
   „Gríðarlega mikið af alls kyns tokens, auth og öðru sem ég veit ekki af …
   alltaf eitthvað token-vesen" (Agnar 2026-07-31). Vandinn er ekki að lyklarnir
   klikki heldur að enginn man HVAR þeir búa, HVAÐ þeir opna og HVERNIG þeir eru
   endurnýjaðir. Hér er ein skrá yfir hvert einasta auðkenni sem kerfið stendur
   á — líka þau sem ekki er hægt að prófa héðan (þau eru þá heiðarlega merkt
   „handvirkt", ekki gefið grænt ljós að ástæðulausu).
   Geymir ALDREI lykil — aðeins hvar hann er og hvenær hann var endurnýjaður. */
const SKRA = [
  { id: 'l:google', heiti: 'Google OAuth', hvar: 'Netlify env — GOOGLE_OAUTH_CLIENT_ID/SECRET',
    opnar: 'Drive, Sheets, Gmail — bæði póst-innsogið OG alla útsenda pósta (gmail-send). Resend var lagt af 2026-07-20 því eldklar.is fékkst aldrei staðfest þar.',
    endurnyja: 'Google Cloud Console → Credentials → OAuth client. Eftir skipti þarf að TENGJA hvert pósthólf upp á nýtt.',
    slod: 'https://console.cloud.google.com/apis/credentials', env: 'GOOGLE_OAUTH_CLIENT_SECRET', bil_dagar: 730 },
  { id: 'l:supabase', heiti: 'Supabase service role', hvar: 'Netlify env — SUPABASE_SERVICE_ROLE_KEY',
    opnar: 'ALLT í gagnagrunninum, framhjá RLS. Hættulegasti lykillinn.',
    endurnyja: 'Supabase → Project Settings → API → rotate. Uppfæra svo í Netlify env og keyra deploy.',
    slod: 'https://supabase.com/dashboard/project/osfdzskyvisifcwyjkuk/settings/api', env: 'SUPABASE_SERVICE_ROLE_KEY', bil_dagar: 730 },
  { id: 'l:netlify', heiti: 'Netlify aðgangslykill (PAT)', hvar: 'GitHub Actions secret — NETLIFY_TOKEN (slokkvitaeki)',
    opnar: 'Útgáfur á slokkvitaeki.netlify.app',
    endurnyja: 'Netlify → User settings → Applications → Personal access tokens: búa til nýjan, eyða þeim gamla, uppfæra GitHub secret.',
    slod: 'https://app.netlify.com/user/applications#personal-access-tokens', bil_dagar: 365,
    vidvorun: 'Þessi lykill LAK opinberlega (var í CLAUDE.md sem vefurinn birti) og hefur EKKI verið endurnýjaður. Gera það sem fyrst.' },
  { id: 'l:github', heiti: 'GitHub', hvar: 'GitHub App / Actions secrets í hverju repo',
    opnar: 'Útgáfur, PR-ar og sjálfvirkni á öllum þremur repo-unum',
    endurnyja: 'GitHub → Settings → Developer settings (PAT) eða repo → Settings → Secrets.',
    slod: 'https://github.com/settings/tokens', bil_dagar: 365 },
  { id: 'l:payday', heiti: 'Payday client secret', hvar: 'Netlify env — PAYDAY_CLIENT_ID/SECRET',
    opnar: 'Reikninga og kröfur beggja félaga', endurnyja: 'Payday → stillingar → API-aðgangur.',
    slod: 'https://app.payday.is', env: 'PAYDAY_CLIENT_SECRET', bil_dagar: 365 },
  { id: 'l:dkplus', heiti: 'dkPlus (bókhald/reikningar)', hvar: 'Netlify env — DKPLUS_API_KEY + DKPLUS_COMPANY',
    opnar: 'Reikningagerð Slökkvitækja í dkPlus — token-skipti (POST /api/v1/Token) og sölureikningar/kröfur gegnum /api/dkplus*.',
    endurnyja: 'dkPlus → API-aðgangur → nýr auðkennislykill; uppfæra DKPLUS_API_KEY í Netlify env og keyra deploy.',
    slod: 'https://api.dkplus.is/swagger', env: 'DKPLUS_API_KEY', bil_dagar: 365 },
  { id: 'l:timavera', heiti: 'Tímavera API-lykill', hvar: 'Gagnagrunnur (app_kv) — límdur inn í Bakendi',
    opnar: 'Vinnufærslur', endurnyja: 'Tímavera sendir nýjan lykil í tölvupósti (1Password-hlekkur). Líma inn í Bakendi-kortið „🕒 Tímavera API".',
    slod: '/#bakendi', bil_dagar: 365 },
  { id: 'l:anthropic', heiti: 'Claude (Anthropic)', hvar: 'Netlify env — ANTHROPIC_API_KEY',
    opnar: 'Svar-uppköst og samantektir', endurnyja: 'console.anthropic.com → API keys.',
    slod: 'https://console.anthropic.com/settings/keys', env: 'ANTHROPIC_API_KEY', bil_dagar: 365 },
  { id: 'l:365', heiti: 'Microsoft 365 (Entra)', hvar: 'HVERGI — ekki sett upp',
    opnar: 'Myndi opna @brunaholf.is pósthólfin úr skýinu í stað Thunderbird-tölvunnar',
    endurnyja: 'Óunnið verk: skrá app í Entra ID, veita Mail.Read og geyma client-secret í Netlify env.',
    slod: 'https://entra.microsoft.com', vantar: true },
  { id: 'l:extension', heiti: 'Mail Pulse tákn', hvar: 'Netlify env — EXTENSION_INGEST_TOKEN',
    opnar: 'Póst-innsog úr Chrome-viðbótinni', endurnyja: 'Velja nýtt gildi í Netlify env og setja sama gildi í viðbótina.',
    env: 'EXTENSION_INGEST_TOKEN', bil_dagar: 365 },
  { id: 'l:vel', heiti: 'Lífsmarks-tákn véla', hvar: 'Netlify env — VEL_HEARTBEAT_TOKEN (valfrjálst)',
    opnar: 'Hver má senda lífsmark inn á Kerfisheilsu', endurnyja: 'Setja gildi í Netlify env og sama gildi á vélarnar (VEL_HEARTBEAT_TOKEN).',
    env: 'VEL_HEARTBEAT_TOKEN', bil_dagar: 730, valfrjalst: true,
    an_texti: 'ekki sett — hver sem er getur sent lífsmark. Í lagi meðan aðeins okkar vélar vita af slóðinni; setja tákn ef það á að herða.' },
];

function lyklaskra(kv) {
  const skradar = (kv[KV_LYKLAR] && typeof kv[KV_LYKLAR] === 'object') ? kv[KV_LYKLAR] : {};
  const nu = Date.now();
  return SKRA.map(l => {
    const r = skradar[l.id] || null;
    const dagar = r ? Math.floor((nu - new Date(r.at).getTime()) / 86400000) : null;
    const til = l.env ? !!process.env[l.env] : null;

    let status, detail;
    if (l.vantar) { status = GREY; detail = 'ekki sett upp'; }
    else if (til === false && l.valfrjalst) { status = AMBER; detail = l.an_texti || 'valfrjálst — ekki sett'; }
    else if (til === false) { status = RED; detail = 'lykill vantar í umhverfið'; }
    else if (l.vidvorun && !r) { status = RED; detail = l.vidvorun; }
    else if (!r) { status = AMBER; detail = til ? 'lykill til staðar — endurnýjun aldrei skráð' : 'endurnýjun aldrei skráð'; }
    else if (l.bil_dagar && dagar > l.bil_dagar) { status = AMBER; detail = (r.baseline ? 'grunnlína skráð fyrir ' : 'endurnýjaður fyrir ') + dagar + ' dögum — kominn tími á nýjan'; }
    else { status = GREEN; detail = (r.baseline ? 'grunnlína staðfest fyrir ' : 'endurnýjaður fyrir ') + dagar + ' dögum' + (r.note ? ' · ' + r.note : ''); }

    // Sérstakt: Supabase-lykillinn er JWT með útrunatíma — hann er lesinn beint
    // úr lyklinum sjálfum (aðeins hausinn afkóðaður, gildið fer hvergi).
    let talning = null;
    if (l.id === 'l:supabase') {
      const exp = jwtExp(process.env.SUPABASE_SERVICE_ROLE_KEY);
      if (exp) talning = { label: 'lykillinn rennur út', dagar: Math.round((exp - nu) / 86400000) };
      else detail += ' · lykillinn ber engan útrunatíma (nýja sb_-sniðið) — rennur ekki út af sjálfu sér';
    }

    return {
      id: l.id, hopur: '🔑 Auðkenni & lyklar', heiti: l.heiti, undir: l.hvar,
      status, detail, talning,
      hvernig: '<b>Opnar:</b> ' + l.opnar + '<br><b>Endurnýjun:</b> ' + l.endurnyja,
      adgerdir: l.vantar ? [] : [{ label: '✅ Merkja endurnýjað', rotate: l.id }],
      tenglar: l.slod ? [{ label: 'Opna ↗', url: l.slod }] : null,
    };
  });
}

// Les `exp` úr JWT ÁN þess að staðfesta undirskrift — við erum ekki að treysta
// honum, aðeins að lesa hvenær hann rennur út. Skilar ms eða null.
function jwtExp(t) {
  try {
    const p = String(t || '').split('.')[1];
    if (!p) return null;
    const j = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return j && j.exp ? j.exp * 1000 : null;
  } catch (_) { return null; }
}

function svc(id, hopur, heiti, undir, t, hasKey, vantarTexti, run, expiresAt, auka) {
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
  const a = auka || {};
  return {
    id, hopur, heiti, undir, status, detail, talning,
    hvernig: a.hvernig || null,
    profad: t ? t.at : null,
    sidasta_keyrsla: run ? { status: run.status, detail: run.detail, at: run.finished_at } : null,
    adgerdir: [{ label: '⏱ Prófa', test: id }].concat(a.adgerdir || []),
    tenglar: a.tenglar || null,
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
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
}
function resp(code, body, headers) { return { statusCode: code, headers: headers || {}, body }; }
function json(code, obj) {
  return resp(code, JSON.stringify(obj), Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors()));
}
