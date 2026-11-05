// test/postur-vidhengi.test.js — hreinu föllin í _postur-vidhengi.js (ekkert net).
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../netlify/functions/_postur-vidhengi.js');

const payload = {
  mimeType: 'multipart/mixed',
  parts: [
    { mimeType: 'text/plain', filename: '', body: { size: 120 } },
    { mimeType: 'image/gif', filename: 'image001.gif', body: { size: 4334, attachmentId: 'a1' },
      headers: [{ name: 'Content-Disposition', value: 'inline; filename="image001.gif"' }, { name: 'Content-ID', value: '<x>' }] },
    { mimeType: 'application/pdf', filename: 'Tilboð - Krókháls 9.pdf', body: { size: 184000, attachmentId: 'a2' },
      headers: [{ name: 'Content-Disposition', value: 'attachment; filename="Tilboð - Krókháls 9.pdf"' }] },
    { mimeType: 'multipart/alternative', parts: [
      { mimeType: 'image/jpeg', filename: 'Krókháls brunastöð.jpg', body: { size: 2_400_000, attachmentId: 'a3' } },
      { mimeType: 'application/zip', filename: 'stort.zip', body: { size: 25 * 1024 * 1024, attachmentId: 'a4' } },
    ] },
  ],
};

test('finnaVidhengi gengur allt tréð og tekur aðeins hluta með nafni', () => {
  const v = V.finnaVidhengi(payload);
  assert.deepEqual(v.map(x => x.filename), ['image001.gif', 'Tilboð - Krókháls 9.pdf', 'Krókháls brunastöð.jpg', 'stort.zip']);
  assert.equal(v[0].inline, true);
  assert.equal(v[1].inline, false);
});

test('sleppa: inline-myndir og >20 MB sleppt, PDF og stór mynd tekin', () => {
  const v = V.finnaVidhengi(payload);
  assert.equal(V.sleppa(v[0]), 'inline-mynd');
  assert.equal(V.sleppa(v[1]), null);
  assert.equal(V.sleppa(v[2]), null);
  assert.equal(V.sleppa(v[3]), 'stærri en 20 MB');
  assert.equal(V.sleppa({ filename: 'x.pdf', mime: 'application/pdf', size: 10, attachmentId: null }), 'ekkert attachmentId');
  assert.equal(V.sleppa({ filename: 'Outlook-abc123.gif', mime: 'image/gif', size: 90_000, attachmentId: 'z' }), 'inline-mynd');
});

test('slod: ASCII-slug (Supabase Storage hafnar íslenskum stöfum og @), rétta nafnið lifir í töflunni', () => {
  assert.equal(V.slod('Eldklar@eldklar.is', '2026-06-15T21:04:18.000Z', '18f3abc', 'Tilboð: Krókháls 9 / 41.pdf'),
    'eldklar_eldklar.is/2026/18f3abc/Tilbod_Krokhals_9_41.pdf');
  assert.equal(V.slod('a@b.is', null, 'id1', ''), 'a_b.is/ar/id1/vidhengi');
  assert.equal(V.oruggtNafn('Bílabúð benna-Krókhálsi 9- 2026.pdf'), 'Bilabud_benna-Krokhalsi_9-_2026.pdf');
  assert.equal(V.oruggtNafn('Nesdekk, Dekkjalager - Breiðhöfða 13 - #219.pdf'), 'Nesdekk_Dekkjalager_-_Breidhofda_13_-_219.pdf');
  assert.equal(V.oruggtNafn('þjónustusamningur ÆÐI 50%.pdf'), 'thjonustusamningur_AeDI_50_.pdf');
});
