// nlsh-update.js — one-click "Uppfæra NLSH gögn úr Drive".
//   GET /api/nlsh-update            → finds the NEWEST "AjourRegistrationData*.csv"
//                                     in Drive and triggers the background ingester
//                                     (ajour-ingest-drive-background) with its fileId.
//                                     Optional &folder=ID limits the search, &since=YYYY-MM-DD
//                                     passes through (delta ingest).
//   GET /api/nlsh-update?status=1   → returns the app_kv 'ajour_ingest_status' blob
//                                     so the UI can poll progress.
// The NLSH dashboard reads ajour_registrations live, so once the ingest finishes
// the page just needs a data refresh — no deploy.

const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  const p = event.queryStringParameters || {};

  if (p.status === '1') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.ajour_ingest_status&select=value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const rows = await r.json().catch(() => []);
    return json(200, (rows[0] && rows[0].value) || { state: 'unknown' });
  }

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    // Newest Ajour export, anywhere in Drive (or inside &folder=ID).
    const qParts = ["name contains 'AjourRegistrationData'", 'trashed=false'];
    if (p.folder) qParts.unshift(`'${p.folder.replace(/'/g, "\\'")}' in parents`);
    const params = new URLSearchParams({
      q: qParts.join(' and '),
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,modifiedTime,size)',
      pageSize: '1', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
    });
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return json(r.status, { error: 'Drive search: ' + (await r.text()).slice(0, 200) });
    const d = await r.json();
    const f = (d.files || [])[0];
    if (!f) return json(404, { error: 'Engin AjourRegistrationData skrá fannst í Drive.' });

    // Fire the background ingester on our own site (it returns 202 immediately
    // and streams the CSV → ajour_registrations for up to 15 min).
    const site = process.env.URL || 'https://brunaholf.netlify.app';
    const qs = new URLSearchParams({ fileId: f.id });
    if (p.since) qs.set('since', p.since);
    const trig = await fetch(`${site}/.netlify/functions/ajour-ingest-drive-background?${qs}`);

    return json(200, {
      ok: trig.status === 200 || trig.status === 202,
      triggered: trig.status,
      file: f.name, fileId: f.id, modified: f.modifiedTime, size: f.size,
      since: p.since || null,
      hint: 'Pollaðu ?status=1 — state verður "done" þegar innlestri er lokið.',
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
