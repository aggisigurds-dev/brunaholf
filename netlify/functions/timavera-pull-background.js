// timavera-pull-background.js — ÁÆTLAÐA (scheduled) útgáfan af timavera-pull.
//
// AF HVERJU ÞETTA ER TIL (2026-07-30)
// `netlify.toml` setti áætlun BEINT á `timavera-pull` (og `payday-pull`).
// Netlify svarar HVERRI HTTP-beiðni á áætlaða föllu með 403 — svo um leið og
// áætlunin var sett (2026-07-24) dóu ALLIR takkarnir sem kalla á hana:
// „🔄 Samstilla" á Mæting-flipanum og öll fjögur stýringarnar í Bakendi-spjaldinu
// „🕒 Tímavera API" (þar á meðal „💾 Vista lykil", svo ekki var einu sinni hægt
// að setja API-lykilinn inn aftur).
//
// Á HINN BÓGINN keyrði áætlunin aldrei heldur: Netlify ræsir áætlaðar föllur með
// **POST**, og `timavera-pull` beinir POST í `handlePost()` sem krefst
// `body.action` — ræsibeiðnin hefur enga, svo hún fékk 400 „Óþekkt action".
// Niðurstaðan var að Tímavera hafði hvorki sjálfvirka né handvirka leið inn.
//
// Lausnin er þessi þunna umgjörð: áætlunin situr HÉR, `timavera-pull` er aftur
// hreinn HTTP-endapunktur fyrir vafrann. Ekkert af rökfræðinni er afritað —
// við köllum sama handler með tilbúnum GET-atburði, svo `entry_key`-dedupe,
// `timavera_meta`-stimplarnir og `automation_runs`-skráningin haldast eins.
//
// `days=3` gefur góða skörun: keyrslan er á tveggja tíma fresti og upsertið er
// idempotent, svo endurtekinn lestur á sömu dögum er skaðlaus og lokaðar
// færslur sem bárust seint ná samt inn.

const base = require('./timavera-pull.js');

exports.handler = async (event) => {
  const days = ((event && event.queryStringParameters) || {}).days || '3';
  return base.handler({
    ...(event || {}),
    httpMethod: 'GET',
    body: null,
    queryStringParameters: { days: String(days) },
  });
};
