// gmail-ingest-background.js — SCHEDULED (netlify.toml, á 2 tíma fresti):
// sækir eldklar INBOX + SENT sjálfvirkt inn í email_digest svo svarstaðan á
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
      ran.push({ account: j.account, folder: j.folder.toUpperCase(), ok: body.ok !== false, upserted: body.upserted || 0, errors: body.errors || 0 });
    } catch (e) {
      ran.push({ account: j.account, folder: j.folder.toUpperCase(), ok: false, error: String((e && e.message) || e) });
    }
  }
  const bad = ran.filter((r) => !r.ok).length;
  const total = ran.reduce((n, r) => n + (r.upserted || 0), 0);
  await logRun(bad ? 'error' : 'ok', total + ' upserted · ' + ran.map((r) => r.folder + ':' + (r.ok ? r.upserted : 'villa')).join(' '));
  return { statusCode: 200, body: JSON.stringify({ ok: bad === 0, ran }) };
};
