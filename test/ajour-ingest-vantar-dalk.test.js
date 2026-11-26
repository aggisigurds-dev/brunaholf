// Innlestur Ajour-útflutnings: dálkur sem útflutningurinn ber ekki má aldrei skrifast sem NULL (26.11.2026).
// „AjourRegistrationData (31).csv" bar ekki ExecutionDateFrom og innlesturinn skrifaði NULL yfir execution_date í
// 27.321 röð. Prófið keyrir fallið sjálft með gervi-fetch (Drive-niðurhal, upsert, stöðuskrif) — ekkert fer á net.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

process.env.SUPABASE_URL = 'https://gervi.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'gervi';

const googlePath = require.resolve(path.join(__dirname, '..', 'netlify', 'functions', '_google.js'));
require.cache[googlePath] = { id: googlePath, filename: googlePath, loaded: true, exports: { freshAccessToken: async () => 'gervi' } };
const fall = require('../netlify/functions/ajour-ingest-drive-background.js');
const handler = fall._innra || fall.handler;

async function keyra(csv) {
  const upsert = [];
  const stada = [];
  global.fetch = async (url, opt = {}) => {
    if (String(url).startsWith('https://www.googleapis.com/drive/')) {
      const bytes = new TextEncoder().encode(csv);
      let sent = false;
      return { ok: true, body: { getReader: () => ({ read: async () => (sent ? { done: true } : (sent = true, { done: false, value: bytes })) }) } };
    }
    if (String(url).includes('/rest/v1/ajour_registrations')) { upsert.push(...JSON.parse(opt.body)); return { ok: true, text: async () => '' }; }
    if (String(url).includes('/rest/v1/app_kv')) { stada.push(JSON.parse(opt.body).value); return { ok: true, text: async () => '' }; }
    throw new Error('óvænt fetch: ' + url);
  };
  const svar = await handler({ queryStringParameters: { fileId: 'gervi' }, httpMethod: 'GET', headers: {} });
  return { svar, upsert, sidasta: stada[stada.length - 1] };
}

const HAUS_AN = 'SerialNumber;RegistrationType;RegistrationStatus;ProjectName;RegistrationDrawing;CategoryGroup;Category;Category1;CheckListItem;CheckListItemChecked;CheckListItemCheckedDate;CheckListItemCheckedByUser;Description;ReceiverCompany;RegistrationCreatedDate;Longitude;Latitude';
const LINA_AN = '590;QA;Done;Fjallaböðin Þjórsárdal;1. hæð svæði 2.pdf;Gat Ø 210-259;Starfsmaður 1;Brunaþéttingar;EI60;X;11/25/2026 15:44:41;Brunahólf ehf.;;Brunahólf ehf;25/11/2026;;';

test('vanti ExecutionDateFrom í útflutninginn er execution_date ekki sent (gildið í töflunni stendur)', async () => {
  const { svar, upsert, sidasta } = await keyra(HAUS_AN + '\n' + LINA_AN + '\n');
  assert.strictEqual(svar.statusCode, 200, svar.body);
  assert.strictEqual(upsert.length, 1);
  assert.ok(!('execution_date' in upsert[0]), 'execution_date má ekki fara með: ' + JSON.stringify(upsert[0]));
  assert.strictEqual(upsert[0].registration_status, 'Done');
  assert.strictEqual(upsert[0].category, 'Starfsmaður 1');
  assert.ok(String(upsert[0].registration_created_date).startsWith('2026-11-25'));
  assert.deepStrictEqual(sidasta.vantar_dalka, ['execution_date']);
});

test('beri útflutningurinn ExecutionDateFrom fer execution_date með eins og áður', async () => {
  const haus = HAUS_AN + ';ExecutionDateFrom';
  const { svar, upsert, sidasta } = await keyra(haus + '\n' + LINA_AN + ';25/11/2026\n');
  assert.strictEqual(svar.statusCode, 200, svar.body);
  assert.strictEqual(upsert[0].execution_date, '2026-11-25');
  assert.deepStrictEqual(sidasta.vantar_dalka, []);
});
