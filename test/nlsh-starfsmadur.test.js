// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js
// for why (a *.test.js in that folder becomes a function name with a period
// and Netlify rejects the deploy).
//
// Prófar nlsh-starfsmadur.js með tilbúnum gögnum, engin Supabase-tenging.
// Fullyrðingarnar eru þær sem skipta Agnar máli 10.09.2026:
//   • klárað og ólokið teljast SITT Í HVORU LAGI (það var beiðnin: „filter á
//     byrjuðum verkum tala og kláruðum verkum tala")
//   • sama serial á tveimur gátlista-röðum er EITT gat, ekki tvö — og telst
//     klárað ef EINHVER röð þess er Done
//   • allir dagar glugganns koma með, líka tómir (eyða er svar, ekki gat)
//   • dagur með tíma en engin göt dettur ekki út
//
// Keyrsla: node --test test/nlsh-starfsmadur.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://x.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';

const nu = new Date();
const dagur = (n) => new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate() - n))
  .toISOString().slice(0, 10);

const AJOUR = [
  { serial_number: 'A1', category: 'Starfsmaður 20', execution_date: dagur(1), registration_status: 'Done' },
  { serial_number: 'A2', category: 'Starfsmaður 20', execution_date: dagur(1), registration_status: 'Done' },
  { serial_number: 'A3', category: 'Starfsmaður 20', execution_date: dagur(1), registration_status: 'Done' },
  { serial_number: 'A4', category: 'Starfsmaður 20', execution_date: dagur(1), registration_status: 'InProgress' },
  { serial_number: 'A5', category: 'Starfsmaður 20', execution_date: dagur(3), registration_status: 'Done' },
  { serial_number: 'A6', category: 'Starfsmaður 20', execution_date: dagur(3), registration_status: 'Done' },
  // sama serial tvisvar, annað Done → EITT klárað gat
  { serial_number: 'A7', category: 'Starfsmaður 20', execution_date: dagur(2), registration_status: 'InProgress' },
  { serial_number: 'A7', category: 'Starfsmaður 20', execution_date: dagur(2), registration_status: 'Done' },
  { serial_number: 'B1', category: 'Starfsmaður 29', execution_date: dagur(1), registration_status: 'Done' },
  { serial_number: 'C1', category: 'Starfsmaður 20', execution_date: dagur(90), registration_status: 'Done' }, // utan glugga
];
const TIMAR = [
  { date: dagur(1), hours: 8, employee: 'Hamza', project: 'Landsspítalinn' },
  { date: dagur(3), hours: 6.5, employee: 'hamza ali', project: 'Landsspitalinn' },
  { date: dagur(5), hours: 4, employee: 'Hamza', project: 'Landsspítalinn' }, // tímar, engin göt
];

global.fetch = async (url) => ({
  ok: true,
  json: async () => (String(url).includes('ajour_registrations') ? AJOUR : TIMAR),
  text: async () => '',
});

const fn = require('../netlify/functions/nlsh-starfsmadur.js');
const kalla = async (q) => JSON.parse((await fn.handler({ httpMethod: 'GET', queryStringParameters: q })).body);

test('einn starfsmaður: klárað og ólokið teljast í sundur', async () => {
  const d = await kalla({ nr: '20', dagar: '7' });
  assert.equal(d.nr, 20);
  assert.equal(d.nafn, 'Hamza Ali ehmed');
  assert.equal(d.samtals.klarad, 6);
  assert.equal(d.samtals.olokid, 1);
  assert.equal(d.samtals.klst, 18.5);

  const iGaer = d.dagar_lina.find(x => x.dags === dagur(1));
  assert.equal(iGaer.klarad, 3);
  assert.equal(iGaer.olokid, 1);
  assert.equal(iGaer.klst, 8);
});

test('sama serial á tveimur röðum er EITT gat og telst klárað', async () => {
  const d = await kalla({ nr: '20', dagar: '7' });
  const x = d.dagar_lina.find(y => y.dags === dagur(2));
  assert.equal(x.klarad, 1);
  assert.equal(x.olokid, 0);
});

test('allir dagar glugganns koma með, líka tómir', async () => {
  const d = await kalla({ nr: '20', dagar: '7' });
  assert.equal(d.dagar_lina.length, 7);
  assert.ok(d.dagar_lina.some(x => !x.klarad && !x.olokid && !x.klst));
});

test('göt utan gluggans teljast ekki með', async () => {
  const d = await kalla({ nr: '20', dagar: '7' });
  assert.ok(!d.dagar_lina.some(x => x.dags === dagur(90)));
  assert.equal(d.samtals.klarad, 6); // C1 (dagur 90) er ekki með
});

test('án nr: allir starfsmenn og allir dagar þeirra', async () => {
  const d = await kalla({ dagar: '7' });
  assert.equal(d.nr, null);
  const hamza = d.starfsmenn.find(s => s.nr === 20);
  assert.equal(hamza.klarad, 6);
  assert.equal(hamza.olokid, 1);
  // dagur með tíma en engin göt má ekki detta út
  const medTima = d.dagar_allir.find(x => x.nr === 20 && x.dags === dagur(5));
  assert.equal(medTima.klst, 4);
  assert.equal(medTima.klarad, 0);
});
