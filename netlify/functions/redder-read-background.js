// redder-read-background.js — Redder-lesarinn á áætlun (05.10.2026).
//
// Agnar: „the reader from redder seems to be down.. very few is readed". Ekkert var bilað — en línurnar
// og verkstaðurinn koma AÐEINS úr Drive-lesaranum (redder-read.js), og hann var bara keyrður með takka.
// Póstlesarinn (luna-bridge/redder.js) skráir hausinn um leið og reikningurinn kemur, redder-drive.js
// speglar PDF-ið í Drive-möppuna — og svo beið allt eftir að einhver ýtti. Enginn ýtti eftir 11.09.2026.
//
// Þessi tvíburi keyrir sama handler í nyir-ham (aðeins reikningar sem vantar eða eru póst-haus án lína),
// í umferðum þar til ekkert er eftir. Áætlunin situr hér en ekki á redder-read sjálfu: Netlify svarar
// HTTP-beiðnum á áætluð föll með 403, og vafrinn kallar á redder-read (sjá viðvörunina í netlify.toml).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const lesari = require('./redder-read');

exports.handler = async () => {
  const hafid = new Date().toISOString();
  const sam = { umferdir: 0, lesnir: 0, linur: 0, villur: 0, eftir: null, oskyrd_heiti: 0 };
  let villa = null;
  for (let i = 0; i < 20; i++) {
    const svar = await lesari.handler({ httpMethod: 'GET', queryStringParameters: { nyir: '1', limit: '12' } });
    let j = {};
    try { j = JSON.parse(svar.body || '{}'); } catch (_) {}
    if (svar.statusCode !== 200) { villa = j.error || ('HTTP ' + svar.statusCode); break; }
    sam.umferdir++;
    sam.lesnir += j.indexed || 0;
    sam.linur += j.linesWritten || 0;
    sam.villur += j.errors || 0;
    sam.oskyrd_heiti = j.oskyrd_heiti || 0;
    sam.eftir = (j.total || 0) - (j.processed || 0);
    // ekkert eftir, eða umferð sem las ekkert (skrá sem brotnar í hvert sinn má ekki snúa lykkjunni endalaust)
    if (j.nextOffset == null || !j.indexed) break;
  }
  console.log('[redder-read-background]', JSON.stringify(sam), villa || '');
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/automation_runs`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        job_name: 'redder-read', status: villa ? 'error' : 'ok', source: 'netlify', started_at: hafid,
        detail: villa ? villa : `${sam.lesnir} reikningar lesnir · ${sam.linur} línur · ${sam.villur} villur · ${sam.umferdir} umferðir`,
      }),
    });
  } catch (_) {}
  return { statusCode: villa ? 500 : 200, body: JSON.stringify({ ...sam, villa }) };
};
