// gmail-ingest-background.js — SCHEDULED (netlify.toml, á 2 tíma fresti):
// sækir eldklar INBOX + SENT (og INBOX bokhald@eldklar.is) sjálfvirkt inn í email_digest svo svarstaðan á
// „Þjónustuver póstum" (slokkvitaeki patch 309) og company-mail helst fersk án
// þess að nokkur smelli á „📥 Sækja póst".
//
// ⚠️ ENGIN gervigreind, ENGIN Claude-tókn — þetta er hrein Gmail API → Supabase
// upsert (dedupe á message_id). Kostar aðeins Netlify-keyrslu + Gmail-kvóta.
//
// Áætlunin situr á ÞESSUM -background tvíbura, EKKI á gmail-ingest sjálfu: Netlify
// svarar HTTP-beiðni á áætlað fall með 403, og gmail-ingest verður að vera áfram
// HTTP-kallanlegt (Kerfisheilsu „Sækja póst"-hnappur + handvirk bakfylling). Sama
// mynstur og timavera-pull-background / payday-pull-background.
//
// Endurnýtir gmail-ingest sitt eigið handler BEINT (require, ekkert HTTP-hopp og
// engin tvítekin rökfræði). gmail-ingest hafnar öðru en GET, svo við sendum GET.
const { handler: ingest } = require('./gmail-ingest');

// Bæta netfangi hér til að sópa fleiri skýja-pósthólf inn sjálfvirkt. (@brunaholf.is
// kemur um luna-bridge af tölvu — ekki hér.)
const JOBS = [
  { account: 'eldklar@eldklar.is', folder: 'inbox' },
  { account: 'eldklar@eldklar.is', folder: 'sent' },
  // 10.09.2026: bokhald@eldklar.is kom áður AÐEINS um Thunderbird-brúna á tölvunni „Notandi",
  // sem hætti að skila 02.09 (12 póstar í grunninum, frá 25.08). Google-tengingin virkar:
  // INBOX var bakfyllt sama dag (119 póstar, 0 villur). SENT er VILJANDI ekki sótt — þar eru
  // 4 póstar, m.a. launaseðlar starfsmanna, og ekkert af því er samskipti við viðskiptavini.
  { account: 'bokhald@eldklar.is', folder: 'inbox' },
  // 19.09.2026: SENT bætt við. Var viljandi sleppt 10.09 því þar liggja 4
  // launaseðlar og engin svör fóru þaðan. Nú fer svar úr því hólfi sem tók við
  // póstinum, svo bokhald@ sendir raunveruleg svör — og án þeirra stóð Árskógar
  // 6-8 „ÓSVARAÐ" þótt svarið hefði farið 18:58. RLS hleypir aðeins bokhald@
  // INBOX til appsins, svo SENT-raðir eru þjónsmegin og sjást ekki á borðinu.
  { account: 'bokhald@eldklar.is', folder: 'sent' },
];
const DAYS = 3; // lítill gluggi per keyrslu; upsert á message_id gerir skörun skaðlausa

async function logRun(status, detail) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const now = new Date().toISOString();
  try {
    await fetch(`${url}/rest/v1/automation_runs`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ job_name: 'gmail-ingest', status, detail: String(detail || '').slice(0, 500), source: 'schedule', started_at: now, finished_at: now }),
    });
  } catch (_) { /* best-effort — logging má aldrei fella innsogið */ }
}

exports.handler = async () => {
  const ran = [];
  for (const j of JOBS) {
    const qs = { account: j.account, days: String(DAYS) };
    if (j.folder === 'sent') qs.folder = 'sent';
    try {
      const res = await ingest({ httpMethod: 'GET', queryStringParameters: qs }, {});
      let body = {};
      try { body = JSON.parse((res && res.body) || '{}'); } catch (_) {}
      ran.push({ account: j.account, folder: j.folder.toUpperCase(), ok: body.ok !== false, upserted: body.upserted || 0, nyir: body.nyir, errors: body.errors || 0 });
    } catch (e) {
      ran.push({ account: j.account, folder: j.folder.toUpperCase(), ok: false, error: String((e && e.message) || e) });
    }
  }
  const bad = ran.filter((r) => !r.ok).length;
  const total = ran.reduce((n, r) => n + (r.upserted || 0), 0);
  // 19.09.2026 — SKRÁ ÞAÐ SEM BARST, EKKI ÞAÐ SEM VAR SENT.
  // Hér stóð áður `total + " upserted"`, sem er fjöldi raða sem voru SENDAR í
  // gagnagrunninn. Glugginn er 3 dagar, svo sömu póstarnir fóru inn tólf sinnum
  // á dag og línan sagði „16 upserted" þótt enginn nýr póstur hefði borist.
  // Sú tala lítur út eins og vinna og faldi þögnina. Nú stendur „0 nýir · 16
  // óbreyttir" þegar ekkert berst — og þögn lítur út eins og þögn.
  // `nyir` er null ef talningin brást; þá stendur „?" fremur en tala sem laug.
  const oviss = ran.some((r) => r.ok && (r.nyir === null || r.nyir === undefined));
  const nyirAlls = ran.reduce((n, r) => n + (r.nyir || 0), 0);
  const sundurlidun = ran.map((r) => r.folder + ':' + (!r.ok ? 'villa'
    : (r.nyir === null || r.nyir === undefined) ? '?' : r.nyir)).join(' ');
  await logRun(bad ? 'error' : 'ok',
    (oviss ? '?' : nyirAlls) + ' nýir · ' + total + ' óbreyttir · ' + sundurlidun);
  return { statusCode: 200, body: JSON.stringify({ ok: bad === 0, ran }) };
};
