// Yfirlitið efst á Viðskiptavinum (_vk-nytt.js): reglurnar mældar án netkalla.
const test = require('node:test');
const assert = require('node:assert');
const N = require('../netlify/functions/_vk-nytt');

const IDAG = '2026-11-16';
const wsOwner = { 'Tindasel The farm': 'Deluxe Lodges ehf.', 'Landsspitalinn': 'ÞG verktakar ehf.', 'Áland 6': 'Landspítali' };

test('verk: nýtt verk efst, innri verk sleppt, klst og menn talin síðustu 14 daga', () => {
  const timar = [
    { date: '2026-11-16', hours: 8, employee: 'A', project: 'Sidumuli 21' },
    { date: '2026-11-10', hours: 7.5, employee: 'B', project: 'Sidumuli 21' },
    { date: '2026-11-14', hours: 8, employee: 'A', project: 'Landsspitalinn' },
    { date: '2026-10-20', hours: 8, employee: 'A', project: 'Landsspitalinn' },          // utan 14 daga
    { date: '2026-11-12', hours: 8, employee: 'C', project: '!!! Brunahólf Veikindi / Sick Leave' },
    { date: '2026-11-13', hours: 6, employee: 'C', project: 'Slökkvitæki ehf' },
    { date: '2026-10-13', hours: 26.7, employee: 'D', project: 'NESDEKK' },               // nýtt en engin vinna síðustu 14 daga
  ];
  const v = N.verkYfirlit({ timar, eldriVerk: ['Landsspitalinn'], wsOwner, verdskra: ['Landsspitalinn'], osentVerk: { 'Sidumuli 21': 1470729 }, idag: IDAG });
  assert.deepStrictEqual(v.map((x) => x.verkstadur), ['Sidumuli 21', 'NESDEKK', 'Landsspitalinn']);
  const s = v[0];
  assert.strictEqual(s.nytt, true); assert.strictEqual(s.klst_14, 15.5); assert.strictEqual(s.menn, 2);
  assert.strictEqual(s.greidandi, null); assert.strictEqual(s.osent, 1470729); assert.strictEqual(s.fyrst, '2026-11-10');
  assert.strictEqual(v[1].sidast, null); assert.strictEqual(v[1].klst_45, 26.7);
  const l = v[2];
  assert.strictEqual(l.nytt, false); assert.strictEqual(l.klst_14, 8); assert.strictEqual(l.greidandi, 'ÞG verktakar ehf.'); assert.strictEqual(l.verdskra, true);
});

test('verk: gamalt verk án vinnu síðustu 14 daga birtist ekki', () => {
  const v = N.verkYfirlit({ timar: [{ date: '2026-10-20', hours: 8, employee: 'A', project: 'Heklu reitur' }], eldriVerk: ['Heklu reitur'], wsOwner, idag: IDAG });
  assert.strictEqual(v.length, 0);
});

test('netfangaskrá: nákvæmt netfang, einkalén og sameiginlegt lén', () => {
  const s = N.netfangaskra([
    { netfang: 'reynir@javerk.is', nafn: 'JÁVERK ehf.' },
    { netfang: 'oskar@aos.is, kjartan@proark.is', nafn: 'Hótel Lóa ehf.' },
    { netfang: 'geir@aos.is', nafn: 'Krókur 77 ehf.' },
    { netfang: 'martimehf@gmail.com', nafn: 'Martim ehf.' },
  ]);
  assert.strictEqual(s.finna('Reynir@Javerk.is'), 'JÁVERK ehf.');
  assert.strictEqual(s.finna('bokhald@javerk.is'), 'JÁVERK ehf.');          // lén sem einn greiðandi á
  assert.strictEqual(s.finna('nyr@aos.is'), null);                           // lén sem tveir greiðendur nota — ekki giskað
  assert.strictEqual(s.finna('oskar@aos.is'), 'Hótel Lóa ehf.');            // nákvæmt netfang gildir áfram
  assert.strictEqual(s.finna('einhver@gmail.com'), null);                    // almennt lén segir ekkert
  assert.strictEqual(s.finna('martimehf@gmail.com'), 'Martim ehf.');
});

test('samskipti: aðeins póstur sem tengist skráðum greiðanda eða verkstað; sami þráður talinn einu sinni', () => {
  const skra = N.netfangaskra([{ netfang: 'einarvald@landspitali.is', nafn: 'Landspítali' }, { netfang: 'reynir@javerk.is', nafn: 'JÁVERK ehf.' }]);
  const postur = [
    { id: 1, folder: 'INBOX', account: 'Brunaholf@brunaholf.is', sender_name: 'Einar', sender_email: 'einarvald@landspitali.is', subject: 'Framhald FV', received_at: '2026-11-16T10:12:00+00:00' },
    { id: 2, folder: 'INBOX', sender_email: 'einarvald@landspitali.is', subject: 'RE: Framhald FV', received_at: '2026-11-15T09:00:00+00:00' },
    { id: 3, folder: 'INBOX', sender_name: 'Nova', sender_email: 'frettir@nova.is', subject: 'Græjaðu pakkana', received_at: '2026-11-15T09:00:00+00:00' },
    { id: 4, folder: 'SENT', sender_email: 'brunaholf@brunaholf.is', to_addresses: '"Reynir" <reynir@javerk.is>', subject: 'Efnislisti', received_at: '2026-11-14T09:00:00+00:00' },
    { id: 5, folder: 'INBOX', sender_email: 'logi@gmail.com', subject: 'Verkið á Tindasel The farm', received_at: '2026-11-13T09:00:00+00:00' },
    { id: 6, folder: 'INBOX', sender_email: 'einarvald@landspitali.is', subject: 'Gamalt', received_at: '2026-10-01T09:00:00+00:00' },
    { id: 7, folder: 'INBOX', sender_email: 'agnar@brunaholf.is', subject: 'Áframsent: Framhald', received_at: '2026-11-16T11:00:00+00:00' },
  ];
  const r = N.samskiptaYfirlit({ postur, skra, verkstadir: Object.keys(wsOwner), wsOwner, idag: IDAG });
  assert.deepStrictEqual(r.map((x) => x.id), [1, 4, 5]);
  assert.strictEqual(r[0].fjoldi, 2); assert.strictEqual(r[0].greidandi, 'Landspítali'); assert.strictEqual(r[0].att, 'inn'); assert.strictEqual(r[0].kl, '10:12');
  assert.strictEqual(r[1].att, 'ut'); assert.strictEqual(r[1].greidandi, 'JÁVERK ehf.'); assert.strictEqual(r[1].netfang, 'reynir@javerk.is');
  assert.strictEqual(r[2].verkstadur, 'Tindasel The farm'); assert.strictEqual(r[2].greidandi, 'Deluxe Lodges ehf.');
});

test('kröfur: greiðsla og send krafa síðustu 14 daga, nafn skráðs greiðanda eftir kennitölu', () => {
  const reikningar = [
    { tilvisun: '387', customer_name: 'Framkvæmdafélagið Laugavegur ehf.', kt_greidanda: '680921-2020', upphaed_total: 4798428, utgafudagur: '2026-10-31', gjalddagi: '2026-10-31', greidsla_date: '2026-11-16', flokkur: 'greitt' },
    { tilvisun: '390', customer_name: 'Payday-nafn', kt_greidanda: '701292-4809', upphaed_total: 500000, utgafudagur: '2026-11-09', gjalddagi: '2026-11-24', greidsla_date: null, flokkur: 'ogreitt' },
    { tilvisun: '300', customer_name: 'Gamall', kt_greidanda: '', upphaed_total: 100, utgafudagur: '2026-09-01', greidsla_date: '2026-09-20', flokkur: 'greitt' },
  ];
  const r = N.krofuYfirlit({ reikningar, nafnFyrirKt: (kt) => (kt === '701292-4809' ? 'JÁVERK ehf.' : null), idag: IDAG });
  assert.deepStrictEqual(r.map((x) => [x.teg, x.nr, x.greidandi]), [['greidd', '387', 'Framkvæmdafélagið Laugavegur ehf.'], ['send', '390', 'JÁVERK ehf.']]);
});

test('smida: talning stemmir við línurnar', () => {
  const ut = N.smida({
    idag: IDAG,
    timar: [{ date: '2026-11-16', hours: 8, employee: 'A', project: 'Sidumuli 21' }, { date: '2026-11-15', hours: 4, employee: 'A', project: 'Landsspitalinn' }],
    eldriVerk: ['Landsspitalinn'], wsOwner, verdskra: [], osentVerk: {},
    netfong: [{ netfang: 'einarvald@landspitali.is', nafn: 'Landspítali' }],
    postur: [{ id: 1, folder: 'INBOX', sender_email: 'einarvald@landspitali.is', subject: 'Framhald FV', received_at: '2026-11-16T10:00:00+00:00' }],
    reikningar: [{ tilvisun: '387', customer_name: 'X', upphaed_total: 1000, greidsla_date: '2026-11-16', utgafudagur: '2026-10-01', flokkur: 'greitt' }],
    faerslur: [{ id: 9, kind: 'beidni', worksite_name: 'Landsspitalinn', author: 'Andri', item_label: 'Teikningar', note: '3. hæð', status: 'new', created_at: '2026-11-15T08:00:00Z' },
      { id: 8, kind: 'verk', worksite_name: 'Nýtt hús', author: 'Hákon', note: 'gamalt', status: 'new', created_at: '2026-09-01T08:00:00Z' }],
  });
  assert.strictEqual(ut.talning.verk_i_gangi, 2); assert.strictEqual(ut.talning.klst_14, 12);
  assert.strictEqual(ut.talning.ny_verk, 1); assert.strictEqual(ut.talning.verk_an_greidanda, 1);
  assert.strictEqual(ut.talning.samskipti_7, 1); assert.strictEqual(ut.talning.greitt_14, 1000); assert.strictEqual(ut.talning.greitt_14_n, 1);
  assert.strictEqual(ut.talning.beidnir_opnar, 1); assert.strictEqual(ut.beidnir[0].greidandi, 'ÞG verktakar ehf.');
  assert.strictEqual(ut.beidnir[0].texti, 'Teikningar — 3. hæð');
});
