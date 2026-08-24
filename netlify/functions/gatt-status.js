// gatt-status.js — opinber staða félags-URL (fyrir /gatt/?c=<slug>).
//
//   GET /api/gatt-status?c=<slug> → { exists, active, name, theme }
//
// „active" = aðgangur til, virkur OG lykilorð sett → þá (og aðeins þá) á
// innskráningarglugginn að opnast. Annars sýnir vefurinn „ekki virkur enn".
// Skilar EKKERT viðkvæmu (aðeins nafn + þema fyrir útlit fyrir innskráningu).

const P = require('./_portal');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: P.secHeaders(), body: '' };
  if (event.httpMethod !== 'GET') return P.json(405, { error: 'GET only' });
  if (!P.dbReady()) return P.json(200, { exists: false, active: false });

  const slug = String((event.queryStringParameters || {}).c || '').trim();
  if (!slug) return P.json(200, { exists: false, active: false });

  try {
    const r = await P.sbGet(`portal_users?slug=eq.${encodeURIComponent(slug)}&select=slug,active,pass_hash,display_name,theme&limit=1`);
    const u = (r.ok ? await r.json() : [])[0];
    if (!u) return P.json(200, { exists: false, active: false });
    return P.json(200, {
      exists: true,
      active: !!(u.active && u.pass_hash),   // login opnast aðeins þegar lykilorð er virkt
      name: u.display_name || '',
      theme: u.theme || 'steel',
    });
  } catch (e) {
    return P.json(200, { exists: false, active: false });
  }
};
