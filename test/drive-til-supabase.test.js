const test = require('node:test');
const assert = require('node:assert');

// _google.js les env við innhleðslu en kastar ekki — nóg að hlaða fallið.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'x';
const { _test, handler } = require('../netlify/functions/drive-til-supabase.js');

test('heiti hlutarins er dregið af id-um, aldrei Drive-heitinu (sem getur verið rangt)', () => {
  const p = _test.objectPath('uttektarskyrsla', 10359, '1-QDf5VUmmIl66amSbI2mgZu-J7nBG9KG', 'application/pdf', 'Rangt nafn á staðnum ð þ æ.pdf');
  assert.strictEqual(p, 'drive-afrit/uttektarskyrsla/10359_1-QDf5VUmmIl66amSbI2mgZu-J7nBG9KG.pdf');
  assert.ok(/^[\x20-\x7e]+$/.test(p), 'slóðin er hrein ASCII');
});

test('ending: Google-skjal flyst út sem pdf, þekktar tegundir, annars úr heiti, annars bin', () => {
  assert.strictEqual(_test.endingFor('application/vnd.google-apps.document', 'x'), 'pdf');
  assert.strictEqual(_test.endingFor('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a'), 'docx');
  assert.strictEqual(_test.endingFor('image/jpeg', 'a'), 'jpg');
  assert.strictEqual(_test.endingFor('application/octet-stream', 'Skjal.PDF'), 'pdf');
  assert.strictEqual(_test.endingFor('application/octet-stream', 'ekkert'), 'bin');
});

test('doc_type er hreinsað í slóð', () => {
  assert.strictEqual(_test.slug('Úttektar skýrsla/../x'), 'ttektar-sk-rsla-x');
  assert.strictEqual(_test.slug(null), 'annad');
});

test('GET keyrir ekkert (405) og POST án ids er hafnað', async () => {
  const g = await handler({ httpMethod: 'GET' });
  assert.strictEqual(g.statusCode, 405);
  const p = await handler({ httpMethod: 'POST', body: '{}' });
  assert.strictEqual(p.statusCode, 400);
  const many = await handler({ httpMethod: 'POST', body: JSON.stringify({ ids: [1, 2, 3, 4, 5, 6] }) });
  assert.strictEqual(many.statusCode, 400);
});
