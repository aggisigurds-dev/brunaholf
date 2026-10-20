// Próf á sjálfvirkri tengingu ósendra draga við Payday-reikning í netlify/functions/krofu-yfirlit-bru.js (20.10.2026).
//   node tools/test-krofu-sjalfvirk-tenging.cjs
// Gögn eru föst (Supabase-líkan í minni, ekkert net, engin raunveruleg gögn snert). Raunveruleg tilvik: Rafís/Skúlagata 26 sept
// (2.586.543 kr) ↔ R-379 og Landspítali/Áland 6 sept (3.959.247 kr) ↔ R-378 töldust bæði sem Ógreitt og Ósent (tvítalið).
process.env.SUPABASE_URL = 'http://mock.local';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';

const KT_RAFIS = '690506-2030', KT_LSH = '500300-2130', KT_REITIR = '530117-0300', KT_X = '111111-1110';
const inv = (id, tilv, kt, nafn, upph, gjalddagi, status) => ({ id, tilvisun: String(tilv), kt_greidanda: kt, customer_name: nafn, gjalddagi, eindagi: gjalddagi, hofudstoll: upph, upphaed_total: upph, status, source: 'payday' });
const drog = (ws, wm, nafn, kt, total, extra) => Object.assign({ worksite_name: ws, work_month: wm, total_m_vsk: total, customer_name: nafn, kennitala: kt, status: 'draft', payday_invoice_id: null, tilvisun: null }, extra || {});

const T = {
  invoices: [
    inv(78315, 379, KT_RAFIS, 'Rafís ehf.', 2586543, '2026-10-19', 'SENT'),
    inv(78316, 378, KT_LSH, 'Landspítali', 3959247, '2026-10-19', 'SENT'),
    inv(100, 301, KT_REITIR, 'Reitir atvinnuhúsnæði ehf.', 45107, '2026-09-15', 'PAID'),          // gamall — á ekki að sogast að nóvember-drögum
    inv(200, 401, KT_X, 'Tvítekið ehf.', 100000, '2026-10-20', 'SENT'),                              // ein röð, tvö drög sömu upphæðar
    inv(900, 410, KT_X, 'Frátekið ehf.', 50000, '2026-10-20', 'SENT'),                               // hangir á drögum (payday_invoice_id)
    inv(950, 411, KT_X, 'Aflýst ehf.', 70000, '2026-10-20', 'CANCELLED'),                            // aflýst — engin tenging
  ],
  invoice_drafts: [
    drog('Skùlagata 26', '2026-09', 'Rafís ehf.', KT_RAFIS, 2586543),                                // A — á að tengjast R-379
    drog('Áland 6', '2026-09', 'Landspítali', KT_LSH, 3959247),                                      // B — á að tengjast R-378
    drog('Skùlagata 26', '2026-10', 'Rafís ehf.', KT_RAFIS, 1345544.52),                             // C — enginn reikningur enn
    drog('Hrafnista Nesvellir 4', '2026-11', 'Reitir atvinnuhúsnæði ehf.', KT_REITIR, 45107),        // D — gamli reikningurinn er fyrir upphaf mánaðarins
    drog('Tvíverk', '2026-09', 'Tvítekið ehf.', KT_X, 100000),                                       // E1 — eldra, fær röðina
    drog('Tvíverk', '2026-10', 'Tvítekið ehf.', KT_X, 100000),                                       // E2 — á að standa eftir
    drog('Frátekið A', '2026-10', 'Frátekið ehf.', KT_X, 50000, { payday_invoice_id: 900 }),         // F1 — bein tenging (fyrir á við)
    drog('Frátekið B', '2026-10', 'Frátekið ehf.', KT_X, 50000),                                     // F2 — röð 900 er frátekin → stendur eftir
    drog('Aflýst verk', '2026-10', 'Aflýst ehf.', KT_X, 70000),                                      // G — aflýst reikningur → stendur eftir
    drog('Kt-laust verk', '2026-09', 'Rafís ehf.', null, 2586543.4, { /* sama upphæð og R-379 en R-379 fer til A */ }),   // H — kt úr korti; R-379 þegar frátekin → stendur eftir
  ],
  krofur_yfirlit_meta: [], bank_transactions: [], pricing_guide: [],
  customer_worksite_map: [{ customer_name: 'Rafís ehf.', worksite_name: 'Kt-laust verk', kt_greidanda: KT_RAFIS, confidence: 'manual', tilvisun: null }],
  timavera_entries: [{ date: '2026-10-19' }],
};
global.fetch = async (url) => {
  const m = /\/rest\/v1\/([a-z_]+)/.exec(String(url));
  const rows = m && T[m[1]] ? T[m[1]] : [];
  return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
};
const H = require('../netlify/functions/krofu-yfirlit-bru.js');

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };

(async () => {
  const r = await H.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {} });
  const j = JSON.parse(r.body);
  const t2 = [].concat(...j.tier2.debtors.map((d) => d.invoices));
  const t1 = [].concat(...j.tier1.debtors.map((d) => d.invoices));
  const eru = (ws, wm) => t2.some((x) => x.worksite === ws && x.work_month === wm);
  const tengt = (ws, wm) => (j.sjalfvirk_tenging || []).find((x) => x.draft === 'draftinv|' + ws + '|' + wm);
  ok(r.statusCode === 200, 'svar 200');

  console.log('Tvítalning sem Agnar sá');
  ok(!eru('Skùlagata 26', '2026-09') && tengt('Skùlagata 26', '2026-09') && tengt('Skùlagata 26', '2026-09').tilvisun === '379', 'Rafís sept-drög tengd R-379 og farin úr Ósent');
  ok(!eru('Áland 6', '2026-09') && tengt('Áland 6', '2026-09') && tengt('Áland 6', '2026-09').tilvisun === '378', 'Landspítali sept-drög tengd R-378 og farin úr Ósent');
  ok(t1.some((x) => x.tilvisun === '379') && t1.some((x) => x.tilvisun === '378'), 'Payday-kröfurnar R-379 og R-378 standa áfram í Ógreitt');
  const r379 = t1.find((x) => x.tilvisun === '379');
  ok(r379 && r379.worksite === 'Skùlagata 26', 'R-379 fær verkstaðinn úr tengdu drögunum');

  console.log('Ströng regla — rangt tengt má aldrei fela drög');
  ok(eru('Skùlagata 26', '2026-10'), 'C: drög án reiknings standa eftir');
  ok(eru('Hrafnista Nesvellir 4', '2026-11'), 'D: eldri reikningur sömu upphæðar (gjalddagi fyrir upphaf mánaðar) tengist ekki');
  ok(!eru('Tvíverk', '2026-09') && eru('Tvíverk', '2026-10'), 'E: ein Payday-röð tengist EINUM drögum — eldri drögin fá hana, hin standa eftir');
  ok(eru('Frátekið B', '2026-10'), 'F: röð sem hangir á drögum (payday_invoice_id) er frátekin');
  ok(eru('Aflýst verk', '2026-10'), 'G: aflýstur reikningur tengist ekki');
  ok(eru('Kt-laust verk', '2026-09'), 'H: röðin er þegar tekin af eldri drögum (einn-á-einn) → kt úr korti tengist ekki aftur');

  console.log('Samtölur');
  const t2Summa = t2.filter((x) => !x.hidden && !x.done).reduce((a, x) => a + x.amount, 0);
  ok(Math.abs(t2Summa - (1345544.52 + 45107 + 100000 + 50000 + 70000 + 2586543.4)) < 1, 'Ósent-summan er ekki lengur með 2.586.543 + 3.959.247 tvítaldar (' + Math.round(t2Summa) + ')');
  ok((j.draftKeys || []).includes('Skùlagata 26|2026-09'), 'tengd drög eru enn í draftKeys (þrep 3 áætlar ekki tímana aftur)');

  console.log('\n' + pass + ' í lagi, ' + fail + ' féllu');
  process.exit(fail ? 1 : 0);
})();
