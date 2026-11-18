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
