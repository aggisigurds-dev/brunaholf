// payday-pull-background.js — ÁÆTLAÐA (scheduled) útgáfan af payday-pull.
//
// AF HVERJU ÞETTA ER TIL (2026-07-30, sama ástæða og timavera-pull-background):
// Netlify svarar HVERRI HTTP-beiðni á áætlaða föllu með 403, svo áætlunin má
// ekki sitja á `payday-pull` sjálfu — þá deyja takkarnir sem vafrinn kallar á
// („↻ Samstilla Payday", fjórir staðir gegnum js/hub-sync-buttons.js). Áætlunin
// situr HÉR og `payday-pull` er hreinn HTTP-endapunktur fyrir vafrann.
//
// AF HVERJU ÞETTA VAR ENDURSKRIFAÐ 30.09.2026
// Þetta var EKKI umgjörð heldur 354 lína AFRIT af payday-pull.js — og afritið
// staðnaði. Tímavera-tvíburarnir gera það rétt (`require('./timavera-pull.js')`,
// 35 línur, engin tvöföldun); Payday-tvíburinn var afrit frá 30.07 meðan
// payday-pull.js hélt áfram að batna. Mælt 30.09.2026, þrennt sem afritið hafði
// ekki:
//
//   1. Númera-keðjan. payday-pull.js:249 ber viðvörunina „⚠️ 'reference'/
//      'tilvisun' MEGA EKKI vera í þessari keðju" — af því að frjáls texti
//      viðskiptavinar lendir þá í reikningsnúmerinu. Afritið hafði ENN
//      `'reference', 'tilvisun'` inni í keðjunni, á sömu línu 249.
//   2. `PD-<id>` varaleiðin (payday-pull.js:260) þegar Payday gefur ekkert
//      númer — afritið hafði hana ekki, svo númerið varð tómt.
//   3. `payday_invoice_id`-stimpillinn (2 tilvik í payday-pull.js, 0 í afritinu).
//
// HEIÐARLEG TAKMÖRKUN, MÆLD SAMDÆGURS: þetta hafði ekki skemmt gögn. `invoices`
// er TÓM (0 raðir, 200-svar með count=0 — ekki RLS-þögn), svo röngu númerin höfðu
// ekkert til að skrifa. Þetta er því varnarviðgerð á peningaleið sem keyrir
// tvisvar á dag (netlify.toml: `0 7,15 * * *`), ekki viðbragð við tapi.
// Til samanburðar: `automation_runs` sýnir 147 heppnaðar `payday-pull`-keyrslur,
// síðast 29.09 15:00 — leiðin GENGUR, hún fær bara enga reikninga.
//
// Ekkert af rökfræðinni er afritað lengur. Ein leið, eitt viðhald: hver framtíðar-
// lagfæring á payday-pull.js gildir hér samstundis.

const base = require('./payday-pull.js');

exports.handler = async (event) => {
  // Netlify ræsir áætlaðar föllur með POST; payday-pull tekur aðeins GET
  // (`:50 if (event.httpMethod !== 'GET') return json(405)`). Umgjörðin umbreytir,
  // nákvæmlega eins og timavera-pull-background gerir.
  const p = (event && event.queryStringParameters) || {};
  return base.handler({
    ...(event || {}),
    httpMethod: 'GET',
    body: null,
    // Sömu sjálfgefnu gildi og vafrinn notar: enginn `since`/`until` = allt sem
    // Payday skilar, og upsertið á (tilvisun, source) er idempotent.
    queryStringParameters: { pageSize: String(p.pageSize || 100) },
  });
};
