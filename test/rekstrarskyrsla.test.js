// Próf: Rekstrarskýrslan (netlify/functions/_rekstur.js + rekstrarskyrsla.js), 18.11.2026.
// Reiknireglurnar eru prófaðar á tilbúnum röðum; fallið sjálft á gervi-PostgREST. Ekkert fer í lifandi grunn.
// Raunmæling 18.11.2026: allar 22 talnaraðir fyrir 17.11.2026 stemmdu við SQL á sömu gögnum (sjá commit-skilaboð).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.SUPABASE_URL = 'https://gervi.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'gervilykill';
const R = require('../netlify/functions/_rekstur.js');

const per = (d) => R.timabil(d).map((p) => `${p.k}:${p.fra}..${p.til}`);

test('tímabilin sjö: þriðjudagur í miðjum mánuði', () => {
  assert.deepEqual(per('2026-11-17'), [
    'dag:2026-11-17..2026-11-17', 'vika:2026-11-16..2026-11-17', 'svika:2026-11-09..2026-11-15', 'man:2026-11-01..2026-11-17',
    'm1:2026-10-01..2026-10-31', 'm2:2026-09-01..2026-09-30', 'm3:2026-08-01..2026-08-31']);
  const h = R.timabil('2026-11-17').map((p) => p.heiti.n);
  assert.deepEqual(h, ['17.11', 'VIKAN', 'SÍÐASTA VIKA', 'NÓVEMBER', 'OKTÓBER', 'SEPTEMBER', 'ÁGÚST']);
});

test('tímabilin: mánudagur, sunnudagur og áramót', () => {
  assert.equal(per('2026-11-16')[1], 'vika:2026-11-16..2026-11-16');
  assert.equal(per('2026-11-22')[1], 'vika:2026-11-16..2026-11-22');
  assert.equal(per('2026-11-22')[2], 'svika:2026-11-09..2026-11-15');
  assert.deepEqual(per('2027-01-05').slice(3), ['man:2027-01-01..2027-01-05', 'm1:2026-12-01..2026-12-31', 'm2:2026-11-01..2026-11-30', 'm3:2026-10-01..2026-10-31']);
  assert.equal(per('2028-03-10')[5], 'm2:2028-01-01..2028-01-31');
  assert.equal(per('2028-03-10')[4], 'm1:2028-02-01..2028-02-29'); // hlaupár
  assert.equal(R.fyrstiDagur('2026-11-17'), '2026-08-01');
});

test('sölulína → vara: product_id, nafn úr úttektarlínu, rusl', () => {
  const kort = R.vorurKort([{ id: 5, nafn: 'Léttvatn 6 kg. AB Slökkvitæki', flokkur: 'Slökkvitæki', virkt: true }, { id: 9, nafn: 'Eldvarnateppi', flokkur: 'Teppi', virkt: true }]);
  assert.equal(R.solulinaVara({ product_id: 5 }, kort).id, 5);
  assert.equal(R.solulinaVara({ product_id: '', desc: 'Nýtt · Léttvatn 6 kg. AB Slökkvitæki · −20% afsl.' }, kort).id, 5);
  assert.equal(R.solulinaVara({ desc: 'Vara · Eldvarnateppi' }, kort).id, 9);
  assert.equal(R.solulinaVara({ product_id: 'x1', desc: 'Eldvarnateppi' }, kort), null);
  assert.equal(R.solulinaVara({ desc: 'Yfirferð · Léttvatn 6 kg. AB Slökkvitæki' }, kort), null);
  assert.equal(R.solulinaMagn({ qty: '3' }), 3);
  assert.equal(R.solulinaMagn({ qty: -2 }), -2);
  assert.equal(R.solulinaMagn({ qty: 'tvö' }), 0);
});

test('Slökkvitæki: tekjuregla, verslun eftir greiðsludegi, krafa, ný tæki, verkstæði', () => {
  const p = R.timabil('2026-11-17');
  const s = R.slokkvitaeki(p, {
    voidIds: [100],
    vorur: [{ id: 5, nafn: 'CO₂ 5 kg. Slökkvitæki', flokkur: 'Slökkvitæki', virkt: true }],
    solur: [
      { id: 1, status: 'final', greitt_med: 'kort', upphaed_an_vsk: 1000, created_at: '2026-11-16T10:00:00Z', paid_at: '2026-11-17T09:00:00Z', linur: [{ product_id: 5, qty: 2 }] },
      { id: 2, status: 'final', greitt_med: 'reikningur', upphaed_an_vsk: 5000, created_at: '2026-11-17T11:00:00Z', krafa_sent_at: '2026-11-17T12:00:00Z', linur: [] },
      { id: 3, status: 'final', is_credit: true, credit_of: 100, greitt_med: 'reikningur', upphaed_an_vsk: -700, created_at: '2026-11-17T12:00:00Z' },
      { id: 4, status: 'final', is_credit: true, credit_of: 2, greitt_med: 'reikningur', upphaed_an_vsk: -500, created_at: '2026-11-17T13:00:00Z' },
      { id: 5, status: 'void', greitt_med: 'kort', upphaed_an_vsk: 9999, created_at: '2026-11-17T10:00:00Z', krafa_sent_at: '2026-11-17T10:00:00Z' },
      { id: 6, status: 'drog', greitt_med: 'reikningur', upphaed_an_vsk: 400, created_at: '2026-11-17T10:00:00Z' },
    ],
    verkbeidnir: [
      { id: 10, status: 'received', created_at: '2026-11-17T08:00:00Z' },
      { id: 11, status: 'ready', created_at: '2026-11-10T08:00:00Z' },
      { id: 12, status: 'collected', created_at: '2026-11-03T08:00:00Z', pickup: '2026-11-17' },
      { id: 13, status: 'eytt', created_at: '2026-11-17T08:00:00Z' },
    ],
    verklidur: [{ job_id: 10 }, { job_id: 10 }, { job_id: 11 }, { job_id: 12 }, { job_id: 12, status: 'eytt' }, { job_id: 13 }],
    uttektir: [{ doc_date: '2026-11-17' }, { doc_date: '2026-11-17', is_duplicate: true }],
    paydaySl: [{ status: 'PAID', paid_date: '2026-11-17', amount_ex: 8000 }, { status: 'CREDIT', paid_date: '2026-11-17', amount_ex: 99 }],
  });
  assert.equal(s.tekjur[0], 5000 - 500, 'kredit á ógilda sölu (id 3) úti, kredit á lifandi sölu dregið frá');
  assert.equal(s.tekjur[1], 1000 + 4500);
  assert.equal(s.verslun[0], 1000, 'kortasala stofnuð 16.11 en greidd 17.11 telst 17.11');
  assert.equal(s.krafa[0], 5000);
  assert.equal(s.reikn[0], 1, 'kreditnóta er ekki reikningur');
  assert.equal(s.sent[0], 5000, 'ógild sala telst ekki send');
  assert.equal(s.ny[1], 2);
  assert.deepEqual(s.verkstaedi, { nu: 2, bida: 1 });
  assert.equal(s.inn[0], 2, 'eydd verkbeiðni telst ekki');
  assert.equal(s.ut[0], 1, 'eytt tæki telst ekki');
  assert.equal(s.uttekt[0], 1);
  assert.equal(s.greitt[0], 8000);
  assert.equal(s.greittN[0], 1);
});

test('Brunahólf: rukkanlegir tímar, taxti, NLSH-afrit, studull, Heklureitur, bókun, greitt', () => {
  const p = R.timabil('2026-11-17');
  const done = (project_name, serial_number, category_group, execution_date) => ({ project_name, serial_number, category_group, execution_date, registration_status: 'Done' });
  const b = R.brunaholf(p, {
    pricing: [{ worksite_name: 'Orkureitur', dagvinna_rate: 10500, effective_from: '2026-01-01' }, { worksite_name: 'orkureitur ', dagvinna_rate: 9000, effective_from: '2025-01-01' }],
    timavera: [
      { date: '2026-11-17', hours: 8, project: 'Orkureitur' },
      { date: '2026-11-17', hours: 2, project: 'Tindasel' },
      { date: '2026-11-17', hours: 5, project: 'Brunahólf almennt' },
      { date: '2026-11-17', hours: 6, project: 'Landsspitalinn' },
      { date: '2026-11-17', hours: 4, project: 'Veikindi' },
    ],
    ajour: [
      done('NLSH 5-6. hæð', 'A1', 'Plast Ø20-34', '2026-11-17'),
      done('NLSH 5-6. hæð', 'A2', 'Plast Ø20-34', '2026-11-17'),
      done('NLSH 5-6. hæð', 'A2', 'Plast Ø20-34', '2026-11-17'), // sama gat, önnur gátlistalína
      done('NLSH 5-6. hæð', 'G1', 'Gólf Ø160-200', '2026-11-17'),
      done('NLSH 5-6. hæð · gatakort', 'A1', 'Plast Ø20-34', '2026-11-17'), // afrit, sleppt
      done('Heklureitur', 'H1', 'Gat Ø1210-1300', '2026-11-17'),
      { ...done('Heklureitur', 'H2', 'Gat Ø0-31', null), checked_date: '2026-11-17' }, // engin execution_date → ekki í Heklu-uppgjöri
      { ...done('Skúlagata 26', 'S1', 'Gat Ø0-31', '2026-11-17'), registration_status: 'Published' },
    ],
    holeRates: [
      { scope: 'generic', size_min_mm: 1210, size_max_mm: 1259, rate_an_vsk: 50000 },
      { scope: 'heklureitur', size_min_mm: 1210, size_max_mm: 1259, rate_an_vsk: 60000 },
      { scope: 'generic', size_min_mm: 0, size_max_mm: 31, rate_an_vsk: 2900 },
    ],
    drog: [{ worksite_name: 'Orkureitur', work_month: '2026-10', total_m_vsk: 124000 }],
    sentMeta: [{ inv_key: 'draftinv|Orkureitur|2026-10', sent: true, sent_at: '2026-11-17T10:00:00Z' }, { inv_key: 'timavera|X|2026-10', sent: true, sent_at: '2026-11-17T10:00:00Z' }],
    paydayBh: [{ status: 'PAID', greidsla_date: '2026-11-17', hofudstoll: 100000 }],
  });
  assert.equal(b.klst[0], 10, 'almennt, veikindi og gata-verk (Landspítalinn) eru ekki rukkanlegir tímar');
  assert.equal(b.tima[0], 8 * 10500 + 2 * 9951, 'nýjasti taxti verkstaðar, annars 9.951');
  assert.equal(b.got[0], 5, 'stök göt: A1, A2, G1 (NLSH), H1, H2 — afritið og óklárað úti');
  assert.equal(b.lshG[0], 3);
  // plast: 2 stakar × 0,5 × 7.166 ; gólf 1.2: 1 × 56.224 (heilt) → án vsk
  assert.equal(Math.round(b.lshV[0]), Math.round((2 * 0.5 * 7166 + 56224) / 1.24));
  assert.equal(b.hekG[0], 1, 'aðeins Gat*-raðir með execution_date');
  assert.equal(b.hekV[0], 60000, 'eigin verðskrá Heklureits gengur fyrir generic');
  assert.equal(b.bokun[0], 100000, 'drög m. vsk ÷ 1,24; aðrir lyklar en draftinv ekki taldir');
  assert.equal(b.bokunN[0], 1);
  assert.equal(b.greitt[0], 100000);
  assert.equal(b.virdi[0], b.tima[0] + b.lshV[0] + b.hekV[0]);
});

test('skýrslan: dagleg röð 30 daga og samanburður vikudaga', () => {
  const s = R.skyrsla('2026-11-17', {
    solur: [{ id: 1, status: 'final', greitt_med: 'kort', upphaed_an_vsk: 300, created_at: '2026-11-17T10:00:00Z' },
      { id: 2, status: 'final', greitt_med: 'kort', upphaed_an_vsk: 200, created_at: '2026-11-10T10:00:00Z' }],
    timavera: [{ date: '2026-11-16', hours: 1, project: 'Tindasel' }],
  });
  assert.equal(s.rod.length, 30);
  assert.equal(s.rod[29].d, '2026-11-17');
  assert.equal(s.rod[0].d, '2026-10-19');
  assert.deepEqual(s.samanburdur.dag.nu, { sl: 300, bh: 0 });
  assert.deepEqual(s.samanburdur.dag.fyrr, { sl: 200, bh: 0 });
  assert.equal(s.samanburdur.dag.merki, 'þri. 10.11');
  assert.deepEqual(s.samanburdur.vika.nu, { sl: 300, bh: 9951 });
  assert.equal(s.badir.tekjur[0], 300);
});

test('ajourNyjast: sami dagur og talan — afrit og hrátt execution_date ráða ekki', () => {
  assert.equal(R.ajourDags({ project_name: 'NLSH 5-6. hæð', registration_status: 'Done', execution_date: '2026-10-30', checked_date: '2026-11-23' }), '2026-11-23');
  assert.equal(R.ajourDags({ project_name: 'Heklureitur', registration_status: 'Done', execution_date: '2026-11-12', checked_date: '2026-11-20' }), '2026-11-12');
  assert.equal(R.ajourDags({ project_name: 'NLSH 5-6. hæð · gatakort', registration_status: 'Done', execution_date: '2026-11-30' }), null);
  assert.equal(R.ajourDags({ project_name: 'NLSH 5-6. hæð', registration_status: 'Published', checked_date: '2026-11-24' }), null);
  assert.equal(R.ajourNyjast([
    { project_name: 'NLSH 5-6. hæð · gatakort', registration_status: 'Done', execution_date: '2026-11-30', checked_date: '2026-11-30' },
    { project_name: 'NLSH 5-6. hæð', registration_status: 'Done', execution_date: null, checked_date: '2026-11-23' },
    { project_name: 'Heklureitur', registration_status: 'Done', execution_date: '2026-11-12', checked_date: '2026-11-20' },
  ]), '2026-11-23');
  assert.equal(R.ajourNyjast([]), null);
});

// ---- fallið: aðgangur ----
const LEYND = 'leynd-session-lykill';
const PW = '2026-10-19T12:00:00Z';
function toki(uid, leynd = LEYND) {
  const gogn = Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + 3600, v: PW })).toString('base64url');
  return gogn + '.' + crypto.createHmac('sha256', leynd).update(gogn).digest('base64url');
}
function gervi() {
  const notendur = { 1: { id: 1, nafn: 'Agnar S', rola: 'Admin', virkur: true }, 2: { id: 2, nafn: 'Starfs M', rola: 'Starfsmaður', virkur: true } };
  return async (url) => {
    const u = new URL(url);
    const t = u.pathname.replace('/rest/v1/', '');
    const svar = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (t === 'hub_adgangar_stilling') return svar([{ session_secret: LEYND, pw_changed_at: PW }]);
    if (t === 'hub_adgangar') { const id = (u.searchParams.get('id') || '').replace('eq.', ''); return svar(notendur[id] ? [notendur[id]] : []); }
    if (t === 'solur' && (u.searchParams.get('status') || '') === '') return svar([{ id: 1, status: 'final', greitt_med: 'kort', upphaed_an_vsk: 1234, created_at: '2026-11-17T10:00:00Z' }]);
    return svar([]);
  };
}
async function kalla(ev) {
  const fyrri = global.fetch;
  global.fetch = gervi();
  try { const r = await require('../netlify/functions/rekstrarskyrsla.js').handler(ev); return { status: r.statusCode, body: JSON.parse(r.body) }; }
  finally { global.fetch = fyrri; }
}
const ev = (t, qs) => ({ httpMethod: 'GET', headers: t ? { cookie: 'hub_user=' + encodeURIComponent(t) } : {}, queryStringParameters: qs || {} });

test('fallið: óinnskráður og fölsuð undirritun fá 401, starfsmaður 403, stjórnandi 200', async () => {
  assert.equal((await kalla(ev())).status, 401);
  assert.equal((await kalla(ev(toki(1, 'röng')))).status, 401);
  assert.equal((await kalla(ev(toki(2)))).status, 403);
  const ok = await kalla(ev(toki(1), { dagur: '2026-11-17' }));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.dagur, '2026-11-17');
  assert.equal(ok.body.sl.tekjur[0], 1234);
  assert.equal(ok.body.timabil.length, 7);
});

test('fallið: aðeins GET og dagur innan bils', async () => {
  const r = await require('../netlify/functions/rekstrarskyrsla.js').handler({ httpMethod: 'POST', headers: {} });
  assert.equal(r.statusCode, 405);
  assert.equal((await kalla(ev(toki(1), { dagur: '2099-01-01' }))).status, 400);
  assert.equal((await kalla(ev(toki(1), { dagur: '2026-04-30' }))).status, 400);
  assert.equal((await kalla(ev(toki(1), { dagur: '2026-06-31' }))).status, 400, 'ómögulegur dagur');
  assert.equal((await kalla(ev(toki(1), { dagur: '2026-13-01' }))).status, 400, 'ómögulegur mánuður');
});

test('rýni 18.11: kredit án is_credit á ógilda sölu, NLSH eftir checked_date, tóm serial', () => {
  const p = R.timabil('2026-11-17');
  const s = R.slokkvitaeki(p, {
    voidIds: [100],
    solur: [
      { id: 1, status: 'final', greitt_med: 'reikningur', upphaed_an_vsk: 5000, created_at: '2026-11-17T11:00:00Z' },
      { id: 2, status: 'final', credit_of: 100, greitt_med: 'reikningur', upphaed_an_vsk: -700, created_at: '2026-11-17T12:00:00Z' },
    ],
  });
  assert.equal(s.tekjur[0], 5000, 'röð sem vísar á ógilda sölu er úti þótt is_credit vanti (_tekjur.cjs)');
  const nl = (serial_number, category_group, execution_date, checked_date) =>
    ({ project_name: 'NLSH 5-6. hæð', serial_number, category_group, execution_date, checked_date, registration_status: 'Done' });
  const b = R.brunaholf(p, {
    ajour: [
      nl('A1', 'Plast Ø20-34', '2026-10-30', '2026-11-03'), // framkvæmt í okt., yfirfarið í nóv. → nóvember
      nl('A2', ' Plast Ø20-34 ', '2026-11-03', null),        // ekkert checked_date → execution_date; flokkur snyrtur
      nl('', 'Plast Ø20-34', '2026-11-03', null),            // tómt serial → ekki talið
    ],
  });
  assert.equal(b.lshG[3], 2, 'nóvember: A1 (eftir checked_date) og A2');
  assert.equal(b.lshG[4], 0, 'október: ekkert');
  assert.equal(Math.round(b.lshV[3]), Math.round(2 * 0.5 * 7166 / 1.24));
});

// ---- 22.11.2026: kreditnótur miðast við dagsetningu FRUMSÖLUNNAR (Agnar: „0 fellur bara út“) ----
test('kredit í öðrum mánuði en frumsala: nettó 0 í mánuði frumsölunnar og 0 í mánuði nótunnar (tekjur, ný tæki, verslun)', () => {
  const p = R.timabil('2026-11-17');   // m1 = október, man = nóvember
  const vorur = [{ id: 5, nafn: 'CO₂ 5 kg. Slökkvitæki', flokkur: 'Slökkvitæki', virkt: true }];
  const s = R.slokkvitaeki(p, {
    vorur,
    solur: [
      { id: 1, status: 'final', greitt_med: 'kort', upphaed_an_vsk: 1000, created_at: '2026-10-20T10:00:00Z', paid_at: '2026-10-21T10:00:00Z', linur: [{ product_id: 5, qty: 2 }] },
      { id: 2, status: 'final', is_credit: true, credit_of: 1, greitt_med: 'kort', upphaed_an_vsk: -1000, created_at: '2026-11-05T10:00:00Z', paid_at: '2026-11-05T10:00:00Z', linur: [{ product_id: 5, qty: -2 }] },
    ],
  });
  assert.equal(s.tekjur[4], 0, 'október (frumsalan): salan og nótan jafnast út');
  assert.equal(s.tekjur[3], 0, 'nóvember (nótan): ekkert');
  assert.equal(s.ny[4], 0); assert.equal(s.ny[3], 0, 'ný tæki fylgja frumsölunni líka');
  assert.equal(s.verslun[4], 0); assert.equal(s.verslun[3], 0, 'verslun: nótan á greiðsludag frumsölunnar');
  assert.equal(s.kreditAnFrumsolu, 0);
});

test('hluta-kredit: mismunurinn er eftir í mánuði frumsölunnar; frumsala sótt sér (g.frumsolur) þegar hún er fyrir gluggann', () => {
  const p = R.timabil('2026-11-17');
  const a = R.slokkvitaeki(p, {
    solur: [
      { id: 1, status: 'final', greitt_med: 'reikningur', upphaed_an_vsk: 1000, created_at: '2026-10-20T10:00:00Z' },
      { id: 2, status: 'final', credit_of: 1, greitt_med: 'reikningur', upphaed_an_vsk: -300, created_at: '2026-11-05T10:00:00Z' },
    ],
  });
  assert.equal(a.tekjur[4], 700, 'október: 1000 − 300'); assert.equal(a.tekjur[3], 0);
  // frumsalan er ekki í lestrinum (fyrir gluggann) en kemur úr g.frumsolur → nótan fer samt á mánuð frumsölunnar (ágúst = m3)
  const b = R.slokkvitaeki(p, {
    solur: [{ id: 2, status: 'final', credit_of: 99, greitt_med: 'reikningur', upphaed_an_vsk: -300, created_at: '2026-11-05T10:00:00Z' }],
    frumsolur: [{ id: 99, created_at: '2026-08-14T10:00:00Z', paid_at: null }],
  });
  assert.equal(b.tekjur[6], -300, 'ágúst'); assert.equal(b.tekjur[3], 0, 'ekki í mánuði nótunnar'); assert.equal(b.kreditAnFrumsolu, 0);
});

test('kredit án frumsölu: eigin dagur og talin í kreditAnFrumsolu (aldrei þögult); kredit á bakfærða sölu er úti og ekki talin', () => {
  const p = R.timabil('2026-11-17');
  const s = R.slokkvitaeki(p, {
    voidIds: [50],
    solur: [
      { id: 2, status: 'final', is_credit: true, greitt_med: 'reikningur', upphaed_an_vsk: -200, created_at: '2026-11-05T10:00:00Z' },      // is_credit án credit_of
      { id: 3, status: 'final', credit_of: 777, greitt_med: 'reikningur', upphaed_an_vsk: -100, created_at: '2026-11-06T10:00:00Z' },          // frumsala finnst ekki
      { id: 4, status: 'final', credit_of: 50, greitt_med: 'reikningur', upphaed_an_vsk: -900, created_at: '2026-11-07T10:00:00Z' },           // bakfærð frumsala
    ],
  });
  assert.equal(s.tekjur[3], -300, 'eigin dagur: −200 −100; −900 (bakfært) úti');
  assert.equal(s.kreditAnFrumsolu, 2);
});

// ---- „Hvernig gengur reksturinn?“: sjö tímabil og innheimta ----
test('manudir: sex heilir mánuðir á undan + líðandi mánuður til dags, líka yfir áramót og hlaupár', () => {
  const t = R.manudir('2026-11-22').map((p) => `${p.fra}..${p.til}`);
  assert.deepEqual(t, ['2026-05-01..2026-05-31', '2026-06-01..2026-06-30', '2026-07-01..2026-07-31', '2026-08-01..2026-08-31', '2026-09-01..2026-09-30', '2026-10-01..2026-10-31', '2026-11-01..2026-11-22']);
  assert.equal(R.manudir('2028-03-10')[5].til, '2028-02-29');
  assert.equal(R.manudir('2027-01-05')[0].fra, '2026-07-01');
  assert.equal(R.manudir('2026-11-22').length, 7);
});

test('innheimta: hlutfall = greitt ÷ (greitt + gjaldfallið), handmerkt greitt innan 120 d telst, miðgildi greiðsludaga síðustu 90 d', () => {
  const idag = '2026-11-22';
  const inv = (tilv, status, utg, gj, gr, kr) => ({ tilvisun: tilv, status, utgafudagur: utg, gjalddagi: gj, greidsla_date: gr, hofudstoll: kr });
  const radir = [
    inv('1', 'PAID', '2026-10-01', '2026-10-15', '2026-10-11', 800),     // 10 d
    inv('2', 'PAID', '2026-10-05', '2026-10-19', '2026-10-25', 100),     // 20 d
    inv('3', 'PAID', '2026-10-06', '2026-10-20', '2026-10-09', 100),     // 3 d
    inv('4', 'SENT', '2026-10-10', '2026-10-24', null, 100),             // gjaldfallinn, 29 d → ekki yfir 45
    inv('5', 'SENT', '2026-08-01', '2026-08-15', null, 50),              // gjaldfallinn, yfir 45 d
    inv('6', 'SENT', '2026-11-18', '2026-12-02', null, 700),             // ekki fallinn
    inv('7', 'SENT', '2026-10-02', '2026-10-16', null, 300),             // handmerktur greiddur 13.10 → greiddur
    inv('8', 'CANCELLED', '2026-10-02', '2026-10-16', null, 9999),       // telst hvorki
    inv('9', 'PAID', '2026-05-01', '2026-05-15', '2026-05-20', 5000),    // fyrir gluggann (frá 30.06)
  ];
  const hand = [{ inv_key: 'payday|7', paid: true, paid_at: '2026-10-13T08:00:00Z' }, { inv_key: 'payday|4', paid_at: '2027-01-01T00:00:00Z' }, { inv_key: 'payday|5', paid: false, hidden: true }];
  const i = R.innheimta(radir, hand, idag, '2026-06-30');
  assert.equal(i.greitt_kr, 800 + 100 + 100 + 300); assert.equal(i.greitt_n, 4); assert.equal(i.hand_n, 1);
  assert.equal(i.gjaldfallid_kr, 100); assert.equal(i.gjaldfallid_n, 1); assert.equal(i.yfir45_kr, 0, 'reikningur 5 er FALINN í Kröfu yfirliti → ekki gjaldfallinn (sama mengi og „Ógreitt núna“)'); assert.equal(i.falid_n, 1);
  assert.equal(i.ogreitt_kr, 800, 'gjaldfallið (100) + ekki fallið (700)');
  assert.equal(i.hlutfall, Math.round(1000 * 1300 / 1400) / 10);
  assert.equal(i.hradi_n, 4); assert.equal(i.hradi_midgildi, 10.5, 'miðgildi af 3, 10, 11 (handmerkt 13.10 − 02.10) og 20 dögum');
  // allt tómt → hlutfall og hraði eru null (ómælt), ekki 0
  const t = R.innheimta([], [], idag, '2026-06-30');
  assert.equal(t.hlutfall, null); assert.equal(t.hradi_midgildi, null);
});

test('rekstur-manudir: 401/403/405, stjórnandi fær sjö mánuði og innheimtu; innheimta ómæld ef lesturinn skilar engu', async () => {
  const fyrri = global.fetch;
  const grunn = gervi();
  global.fetch = async (url) => {
    const u = new URL(url);
    const t = u.pathname.replace('/rest/v1/', '');
    const svar = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (t === 'timavera_entries' && (u.searchParams.get('select') || '').includes('hours')) return svar([{ date: new Date().toISOString().slice(0, 10), hours: 8, project: 'Verk A' }]);
    if (t === 'invoices' && u.searchParams.get('status') === 'in.(PAID,SENT)') return svar([{ tilvisun: '1', status: 'PAID', utgafudagur: '2026-10-01', gjalddagi: '2026-10-15', greidsla_date: '2026-10-11', hofudstoll: 1000 }]);
    if (t === 'invoices' && u.searchParams.get('status') === 'eq.PAID') return svar([{ status: 'PAID', greidsla_date: '2026-10-11', hofudstoll: 1000 }]);
    if (t === 'skr_hub_skraningar' && (u.searchParams.get('select') || '').includes('project_name')) return svar([{ project_name: 'Heklureitur', serial_number: 'A1', category_group: 'Gat Ø20-34', execution_date: '2026-10-11', checked_date: null, registration_status: 'Done' }]);
    return grunn(url);
  };
  try {
    const RM = require('../netlify/functions/rekstur-manudir.js');
    assert.equal((await RM.handler({ httpMethod: 'GET', headers: {} })).statusCode, 401);
    assert.equal((await RM.handler(ev(toki(2)))).statusCode, 403);
    assert.equal((await RM.handler({ httpMethod: 'POST', headers: {} })).statusCode, 405);
    const r = await RM.handler(ev(toki(1)));
    assert.equal(r.statusCode, 200);
    const j = JSON.parse(r.body);
    assert.equal(j.man.length, 7); assert.equal(j.man[6].til, j.idag);
    assert.equal(j.man[6].unnid > 0, true, 'tímar í tímaskýrslu skila Unnið (líðandi mánuður)');
    assert.equal(j.innheimta.greitt_kr, 1000); assert.equal(j.innheimta.hlutfall, 100);
    // lesturinn skilar engu → fallið BREGST með ástæðu (502) í stað þess að gefa 0 — SL-hliðin segir þá „ómælt“ (rýni 22.11)
    global.fetch = grunn;
    const r2 = await RM.handler(ev(toki(1)));
    assert.equal(r2.statusCode, 502); assert.match(JSON.parse(r2.body).villa, /Tímaveru-lesturinn skilaði engu/);
    // Tímavera til en Payday-greiðslur ekki → líka ómælt
    global.fetch = async (url) => { const u = new URL(url); const t = u.pathname.replace('/rest/v1/', ''); if (t === 'timavera_entries' && (u.searchParams.get('select') || '').includes('hours')) return { ok: true, status: 200, json: async () => [{ date: '2026-11-10', hours: 8, project: 'Verk A' }], text: async () => '[]' }; if (t === 'skr_hub_skraningar' && (u.searchParams.get('select') || '').includes('project_name')) return { ok: true, status: 200, json: async () => [{ project_name: 'Heklureitur', serial_number: 'A1', category_group: 'Gat Ø20-34', execution_date: '2026-10-11', registration_status: 'Done' }], text: async () => '[]' }; return grunn(url); };
    const r3 = await RM.handler(ev(toki(1)));
    assert.equal(r3.statusCode, 502); assert.match(JSON.parse(r3.body).villa, /Greiðslulesturinn skilaði engu/);
  } finally { global.fetch = fyrri; }
});

test('kredit með annan greitt_med en frumsalan: greiðslumáti FRUMSÖLUNNAR ræður (verslun jafnast út)', () => {
  const p = R.timabil('2026-11-17');
  const s = R.slokkvitaeki(p, { solur: [
    { id: 1, status: 'final', greitt_med: 'kort', upphaed_an_vsk: 1000, created_at: '2026-10-20T10:00:00Z', paid_at: '2026-10-20T10:00:00Z' },
    { id: 2, status: 'final', credit_of: 1, greitt_med: 'reikningur', upphaed_an_vsk: -1000, created_at: '2026-11-05T10:00:00Z' },
  ] });
  assert.equal(s.verslun[4], 0, 'október: salan (kort) og nótan (skráð á reikning) jafnast út í versluninni'); assert.equal(s.tekjur[4], 0);
});

test('ferskleiki Ajour: nýjast er dagurinn sem talan notar, ekki execution_date á afritinu', async () => {
  const fyrri = global.fetch;
  const svar = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
  global.fetch = async (url) => {
    const u = new URL(url);
    const t = u.pathname.replace('/rest/v1/', '');
    const sel = u.searchParams.get('select') || '';
    if (t === 'skr_hub_skraningar' && sel.includes('project_name')) return svar([
      { project_name: 'NLSH 5-6. hæð · gatakort', serial_number: 'X', category_group: 'Plast Ø20-34', execution_date: '2026-11-30', checked_date: '2026-11-30', registration_status: 'Done' },
      { project_name: 'NLSH 5-6. hæð', serial_number: 'A', category_group: 'Plast Ø20-34', execution_date: null, checked_date: '2026-11-23', registration_status: 'Done' },
      { project_name: 'Heklureitur', serial_number: 'H', category_group: 'Gat Ø20-34', execution_date: '2026-11-12', checked_date: null, registration_status: 'Done' },
    ]);
    if (t === 'skr_hub_skraningar' && sel === 'imported_at') return svar([{ imported_at: '2026-11-23T21:12:11Z' }]);
    return svar([]);
  };
  try {
    const RS = require('../netlify/functions/rekstrarskyrsla.js');
    const r = await RS._saekja('2026-11-24');
    assert.equal(r.ferskleiki.ajour.nyjast, '2026-11-23');
    assert.equal(r.ferskleiki.ajour.innlestur, '2026-11-23T21:12:11Z');
  } finally { global.fetch = fyrri; }
});

test('saekja(bhAdeins): SL-töflur eru EKKI sóttar (lat) — bilun í þeim fellir ekki Brunahólfshlutann', async () => {
  const fyrri = global.fetch; const sott = [];
  global.fetch = async (url) => {
    const t = new URL(url).pathname.replace('/rest/v1/', ''); sott.push(t);
    if (['solur', 'vorur', 'verkbeidnir', 'verklidur', 'customer_documents', 'payday_invoices_slokk', 'invoice_drafts'].includes(t)) return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) };
    return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
  };
  try {
    const RS = require('../netlify/functions/rekstrarskyrsla.js');
    const r = await RS._saekja('2026-11-17', { fra: '2026-05-01', bhAdeins: true });
    assert.ok(r.gogn && Array.isArray(r.gogn.timavera));
    for (const t of ['solur', 'vorur', 'verkbeidnir', 'verklidur', 'customer_documents', 'payday_invoices_slokk', 'invoice_drafts']) assert.equal(sott.includes(t), false, t + ' sleppt');
  } finally { global.fetch = fyrri; }
});

// ---- Tekjuliðir Slökkvitækis (fasi 3, 22.11.2026): þunnt gegnumstreymi á slokkvitaeki /api/tekjulidir ----
test('tekjulidir: aðeins stjórnandi (401/403/405), kaka áfram (aðeins hub_user), 200 gegnum, SL-villa/óvænt snið/net → 502 með ástæðu (aldrei tölur)', async () => {
  const fyrri = global.fetch; const grunn = gervi(); const sott = [];
  const flokkar = Array.from({ length: 15 }, (_, i) => ({ id: String(i + 1).padStart(2, '0'), heiti: 'F' + i, man: {}, samtals: 0, topp: [] }));
  let hamur = 'ok';
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname.includes('slokkvitaeki')) {
      sott.push({ slod: u.pathname, kaka: (init.headers || {}).cookie, signal: !!init.signal });
      if (hamur === 'net') throw new Error('net niðri');
      if (hamur === 'lokad') return { ok: false, status: 401, json: async () => ({ error: 'Innskráning starfsmanns vantar' }) };
      if (hamur === 'tomt') return { ok: false, status: 503, json: async () => ({ error: 'Tekjuliðir ómældir — vörulistalesturinn skilaði engu' }) };
      if (hamur === 'snid') return { ok: true, status: 200, json: async () => ({ flokkar: [] }) };
      return { ok: true, status: 200, json: async () => ({ manudir: ['2026-10', '2026-11'], flokkar, samtals: 123, stemmir: true }) };
    }
    return grunn(url, init);
  };
  try {
    const TLF = require('../netlify/functions/tekjulidir.js');
    assert.equal((await TLF.handler({ httpMethod: 'GET', headers: {} })).statusCode, 401);
    assert.equal((await TLF.handler(ev(toki(2)))).statusCode, 403);
    assert.equal((await TLF.handler({ httpMethod: 'POST', headers: {} })).statusCode, 405);
    assert.equal(sott.length, 0, 'ekkert kall á slokkvitaeki án stjórnanda');
    const t = toki(1);
    const r = await TLF.handler({ httpMethod: 'GET', headers: { cookie: 'annad=1; hub_user=' + encodeURIComponent(t) + '; fleira=2' }, queryStringParameters: {} });
    assert.equal(r.statusCode, 200); const j = JSON.parse(r.body); assert.equal(j.flokkar.length, 15); assert.equal(j.samtals, 123);
    assert.equal(sott[0].slod, '/api/tekjulidir'); assert.equal(sott[0].kaka, 'hub_user=' + encodeURIComponent(t), 'aðeins hub_user fer áfram'); assert.equal(sott[0].signal, true, '8 s tímamörk');
    for (const [h, vaent] of [['lokad', /svaraði 401/], ['tomt', /vörulistalesturinn skilaði engu/], ['snid', /óvænt snið/], ['net', /náðist ekki/]]) {
      hamur = h;
      const x = await TLF.handler({ httpMethod: 'GET', headers: { cookie: 'hub_user=' + encodeURIComponent(t) }, queryStringParameters: {} });
      assert.equal(x.statusCode, 502, h); assert.match(JSON.parse(x.body).villa, vaent, h); assert.equal(JSON.parse(x.body).flokkar, undefined, h + ': engar tölur');
    }
  } finally { global.fetch = fyrri; }
});

test('rekstrarskyrsla.html: tekjuliðakaflinn, tenglarnir og hnappurinn í Fjármála-yfirliti eru til; kaflinn er innan #efni (aðeins stjórnandi) og lesinn úr /api/tekjulidir', () => {
  const fs = require('node:fs'), path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'rekstrarskyrsla.html'), 'utf8');
  const efni = html.slice(html.indexOf('<div id="efni"'), html.indexOf('</main>'));
  assert.match(efni, /<section[^>]*id="tekjulidir"/, 'kaflinn er innan #efni');
  assert.match(html, /\/api\/tekjulidir/); assert.match(html, /location\.hash/); assert.match(html, /href="\/#fjarmalyfirlit"[^>]*>← Fjármála-yfirlit/); assert.match(html, /href="\/#krofuyfirlit"[^>]*>Kröfu yfirlit/);
  assert.match(html, /window\.RekstrarTekjulidir\.hlada\(\)/, 'teikna() ræsir kaflann');
  assert.match(html, /overflow-x:\s*auto/, 'taflan skrunar lárétt innan kassa');
  const fj = fs.readFileSync(path.join(__dirname, '..', 'fjarmalyfirlit.html'), 'utf8');
  assert.match(fj, /<a class="boss-btn[^"]*" href="\/rekstur#tekjulidir" target="_top"[^>]*>📊 Tekjuliðir<\/a>/);
});

test('rekstur-yfirlit (Fjármála-yfirlit): gegnumstreymi á slokkvitaeki — aðeins stjórnandi, kaka áfram, bilun → 502 með ástæðu; síðan ræsir það eftir render og sýnir „ómælt“ við bilun', async () => {
  const fyrri = global.fetch; const grunn = gervi(); const sott = []; let hamur = 'ok';
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname.includes('slokkvitaeki')) {
      sott.push({ slod: u.pathname, kaka: (init.headers || {}).cookie, signal: !!init.signal });
      if (hamur === 'net') throw new Error('net niðri');
      if (hamur === 'snid') return { ok: true, status: 200, json: async () => ({ x: 1 }) };
      return { ok: true, status: 200, json: async () => ({ slokkvitaeki: { man: [], setning: { setning: 'Nóvember til dags: unnið 2,10 m' } }, brunaholf: { man: [] } }) };
    }
    return grunn(url, init);
  };
  try {
    const RY = require('../netlify/functions/rekstur-yfirlit.js');
    assert.equal((await RY.handler({ httpMethod: 'GET', headers: {} })).statusCode, 401);
    assert.equal((await RY.handler(ev(toki(2)))).statusCode, 403);
    assert.equal(sott.length, 0);
    const t = toki(1);
    const r = await RY.handler({ httpMethod: 'GET', headers: { cookie: 'a=1; hub_user=' + encodeURIComponent(t) }, queryStringParameters: {} });
    assert.equal(r.statusCode, 200); assert.equal(sott[0].slod, '/api/rekstur-yfirlit'); assert.equal(sott[0].kaka, 'hub_user=' + encodeURIComponent(t)); assert.equal(sott[0].signal, true);
    for (const [h, vaent] of [['snid', /óvænt snið/], ['net', /náðist ekki/]]) {
      hamur = h; const x = await RY.handler({ httpMethod: 'GET', headers: { cookie: 'hub_user=' + encodeURIComponent(t) }, queryStringParameters: {} });
      assert.equal(x.statusCode, 502, h); assert.match(JSON.parse(x.body).villa, vaent, h);
    }
  } finally { global.fetch = fyrri; }
  const fs = require('node:fs'), path = require('node:path');
  const fj = fs.readFileSync(path.join(__dirname, '..', 'fjarmalyfirlit.html'), 'utf8');
  assert.match(fj, /id="fy-rekstur"/); assert.match(fj, /fetch\('\/api\/rekstur-yfirlit'/); assert.match(fj, /render\(d, nlsh, Date\.now\(\)\);\s*fyReksturHlada\(\);/);
  assert.match(fj, /ómælt — '\+esc/, 'ómælt með ástæðu'); assert.match(fj, /félögin aldrei lögð saman/);
});
