// Próf: Tekjuliðir Brunahólfs (fasi 4, 22.11.2026) — _rekstur.js verkstadir() + tekjulidir-bh.js.
// Reglurnar prófaðar á tilbúnum röðum; fallið sjálft á gervi-PostgREST. Ekkert fer í lifandi grunn.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.SUPABASE_URL = 'https://gervi.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'gervilykill';
const R = require('../netlify/functions/_rekstur.js');
const TB = require('../netlify/functions/tekjulidir-bh.js');

const per3 = R.manudir('2026-11-17').slice(4);                // sept · okt · nóv til dags
const done = (project_name, serial_number, category_group, execution_date, extra) => ({ project_name, serial_number, category_group, execution_date, registration_status: 'Done', ...(extra || {}) });
const gogn = () => ({
  pricing: [{ worksite_name: 'Orkureitur', dagvinna_rate: 10500, effective_from: '2026-01-01' }],
  timavera: [
    { date: '2026-09-10', hours: 8, project: 'Orkureitur' }, { date: '2026-10-05', hours: 4, project: 'Orkureitur' }, { date: '2026-11-03', hours: 6, project: 'Orkureitur' },
    { date: '2026-09-11', hours: 1, project: 'orkureitur ' },                    // sama verk, annað stafabil/stafastærð → ein röð (Verðskráin leitar án stafastærðar)
    { date: '2026-10-06', hours: 2, project: 'Tindasel' },                       // enginn taxti í Verðskrá → 9.951, merkt „án taxta“
    { date: '2026-10-07', hours: 5, project: 'Brunahólf almennt' },             // ekki rukkanlegt
  ],
  ajour: [
    done('NLSH 5-6. hæð', 'A1', 'Plast Ø20-34', '2026-10-20'), done('NLSH 5-6. hæð', 'A2', 'Plast Ø20-34', '2026-10-20'), done('NLSH 5-6. hæð', 'G1', 'Gólf Ø160-200', '2026-10-20'),
    done('NLSH 5-6. hæð · gatakort', 'A1', 'Plast Ø20-34', '2026-10-20'),         // afrit, sleppt
    done('Heklureitur', 'H1', 'Gat Ø1210-1300', '2026-11-05'),                   // verðlagt Heklureitsgat
    done('Heklureitur', 'H2', 'Gat Ø0-31', null, { checked_date: '2026-11-07' }), // engin execution_date → ekki verðlagt, talið sem „önnur göt“
    done('Skúlagata 26', 'S1', 'Gat Ø0-31', '2026-11-06'),                       // ekki Landspítali/Hekla → ekki verðlagt, „önnur göt“
    { ...done('Skúlagata 26', 'S2', 'Gat Ø0-31', '2026-11-06'), registration_status: 'Published' },
  ],
  holeRates: [{ scope: 'generic', size_min_mm: 1210, size_max_mm: 1259, rate_an_vsk: 50000 }, { scope: 'heklureitur', size_min_mm: 1210, size_max_mm: 1259, rate_an_vsk: 60000 }, { scope: 'generic', size_min_mm: 0, size_max_mm: 31, rate_an_vsk: 2900 }],
  paydayBh: [
    { status: 'PAID', greidsla_date: '2026-09-20', hofudstoll: 1000 }, { status: 'PAID', greidsla_date: '2026-09-03', hofudstoll: 1500 }, { status: 'PAID', greidsla_date: '2026-09-25', hofudstoll: 400 },
    { status: 'PAID', greidsla_date: '2026-10-15', hofudstoll: 2000 }, { status: 'PAID', greidsla_date: '2026-10-20', hofudstoll: 5000 },
  ],
});

test('verkstadir: Σ raða = brunaholf().virdi á hverju tímabili; taxti, „án taxta“, Landspítali, Heklureitur, önnur göt', () => {
  const g = gogn();
  const v = R.verkstadir(per3, g), b = R.brunaholf(per3, g);
  for (let i = 0; i < 3; i++) {
    const sum = v.rows.reduce((a, r) => a + r.unnid[i], 0);
    assert.ok(Math.abs(sum - b.virdi[i]) < 0.01, `tímabil ${i}: ${sum} ≠ ${b.virdi[i]}`);
    assert.ok(Math.abs(v.samtals[i] - b.virdi[i]) < 0.01);
    assert.ok(Math.abs(v.klst[i] - b.klst[i]) < 1e-9);
  }
  const ork = v.rows.find((r) => r.verk === 'Orkureitur');
  assert.equal(v.rows.filter((r) => r.key === 'orkureitur').length, 1, '„Orkureitur“ og „orkureitur “ eru EITT verk');
  assert.deepEqual(ork.klst, [9, 4, 6]); assert.equal(ork.taxti, 10500); assert.equal(ork.an_taxta, false);
  assert.deepEqual(ork.unnid, [9 * 10500, 4 * 10500, 6 * 10500]);
  const tin = v.rows.find((r) => r.verk === 'Tindasel');
  assert.equal(tin.an_taxta, true, 'verkstað vantar í Verðskrá → merkt'); assert.equal(tin.taxti, 9951); assert.equal(tin.unnid[1], 2 * 9951);
  assert.equal(v.rows.find((r) => r.verk === 'Brunahólf almennt'), undefined, 'ekki rukkanlegt');
  const lsh = v.rows.find((r) => r.verk === 'Landsspitalinn');
  assert.equal(lsh.got[1], 3, 'A1, A2, G1 — afritið og tvítekning úti'); assert.equal(lsh.got[0] + lsh.got[2], 0);
  assert.ok(Math.abs(lsh.got_kr[1] - b.lshV[1]) < 0.01); assert.ok(lsh.got_kr[1] > 0);
  const hek = v.rows.find((r) => r.verk === 'Heklu reitur');
  assert.equal(hek.got[2], 1); assert.equal(hek.got_kr[2], 60000, 'eigin verðskrá Heklureits gengur fyrir generic');
  assert.deepEqual(v.onnur_got, [0, 0, 2], 'H2 (engin execution_date) og S1 (annað verk) eru ekki verðlögð — talin sér, aldrei í krónum');
  assert.equal(R.verkLykill('NLSH 5-6. hæð'), 'Landsspitalinn'); assert.equal(R.verkLykill('Heklureitur'), 'Heklu reitur'); assert.equal(R.verkLykill(' Orkureitur '), 'Orkureitur');
  // raðað eftir Σ unnið, stærsta verk fyrst
  const rod = v.rows.map((r) => r.unnid.reduce((a, x) => a + x, 0));
  assert.deepEqual(rod, [...rod].sort((a, b2) => b2 - a));
});

const inv = (tilvisun, status, utgafudagur, hofudstoll, extra) => ({ tilvisun: String(tilvisun), status, utgafudagur, gjalddagi: null, greidsla_date: null, hofudstoll, worksite_match: null, ...(extra || {}) });

test('reikna: reikningsfært eftir útgáfudegi, verkstaður aðeins úr worksite_match (annars „án verkstaðar“), greitt, ógreitt, eldra, gat', () => {
  const radir = [
    inv(1, 'PAID', '2026-09-05', 1000, { greidsla_date: '2026-09-20', worksite_match: 'Orkureitur' }),
    inv(2, 'PAID', '2026-09-10', 2000, { greidsla_date: '2026-10-15' }),
    inv(3, 'SENT', '2026-10-02', 5000),                                  // handmerktur greiddur 20.10
    inv(4, 'SENT', '2026-10-03', 4000),                                  // ógreitt
    inv(5, 'SENT', '2026-11-02', 3000),                                  // falinn í Kröfu yfirliti → hvorki greitt né ógreitt
    inv(6, 'CANCELLED', '2026-10-04', 485),                              // utan
    inv(7, 'SENT', '2026-08-15', 7000),                                  // eldra ógreitt
    inv(8, 'SENT', '2026-05-01', 800),                                   // handmerktur greiddur 183 d síðar → utan 120 d reglu (ekki „greitt“ í mánuði) EN merktur greiddur → ekki útistandandi
    inv(9, 'PAID', '2026-08-20', 1500, { greidsla_date: '2026-09-03' }), // greitt í sept, útgefið í ágúst → ekki reikningsfært
    inv(10, 'SENT', '2026-11-04', 9000, { worksite_match: 'NLSH 5-6. hæð' }),
    inv(11, 'SENT', '2026-10-05', 600),                                  // merktur greiddur án dagsetningar → ekki ógreitt (Kröfu yfirlit), ekki greitt í mánuði
    inv(12, 'PAID', '2026-09-06', 400, { greidsla_date: '2026-09-25', worksite_match: 'orkureitur' }), // annað stafabil → sama verkstað og „Orkureitur“
  ];
  const hand = [
    { inv_key: 'payday|3', paid: true, paid_at: '2026-10-20T10:00:00Z', hidden: false, done: false },
    { inv_key: 'payday|5', paid: false, hidden: true, done: false },
    { inv_key: 'payday|8', paid: true, paid_at: '2026-10-30T10:00:00Z' },
    { inv_key: 'payday|11', paid: true, paid_at: null },
    { inv_key: 'draftinv|X|2026-10', paid: true, paid_at: '2026-10-30T10:00:00Z' },           // ekki payday-lykill → sleppt
  ];
  const g = gogn();
  const r = TB._reikna({ per: per3, gogn: g, radir, hand }, '2026-11-17');
  assert.deepEqual(r.manudir.map((m) => m.man), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(r.an_verkstadar.reikningsfaert, { '2026-09': 2000, '2026-10': 9600, '2026-11': 3000 });
  assert.deepEqual(r.an_verkstadar.greitt, { '2026-09': 1500, '2026-10': 7000, '2026-11': 0 });
  assert.deepEqual(r.an_verkstadar.ogreitt, { '2026-09': 0, '2026-10': 4000, '2026-11': 0 }, 'nr. 11 (merktur greiddur) og nr. 5 (falinn) eru ekki útistandandi');
  assert.equal(r.verkstadir.filter((x) => x.verk.toLowerCase() === 'orkureitur').length, 1, 'ein röð fyrir „Orkureitur“ og „orkureitur“');
  const ork = r.verkstadir.find((x) => x.verk === 'Orkureitur');
  assert.deepEqual(ork.reikningsfaert, { '2026-09': 1400, '2026-10': 0, '2026-11': 0 }); assert.deepEqual(ork.greitt, { '2026-09': 1400, '2026-10': 0, '2026-11': 0 });
  const lsh = r.verkstadir.find((x) => x.verk === 'Landsspitalinn');
  assert.equal(lsh.reikningsfaert['2026-11'], 9000, 'worksite_match „NLSH 5-6. hæð“ fellur á verkstað Landspítalans'); assert.equal(lsh.ogreitt['2026-11'], 9000);
  assert.equal(r.eldra_ogreitt_kr, 7000, 'aðeins nr. 7; nr. 8 er merktur greiddur (utan 120 d reglu en samt ekki útistandandi, eins og Kröfu yfirlit)'); assert.equal(r.eldra_ogreitt_n, 1);
  assert.deepEqual(r.samtals.reikningsfaert, { '2026-09': 3400, '2026-10': 9600, '2026-11': 12000 });
  assert.deepEqual(r.samtals.greitt, { '2026-09': 2900, '2026-10': 7000, '2026-11': 0 });
  assert.deepEqual(r.samtals.ogreitt, { '2026-09': 0, '2026-10': 4000, '2026-11': 9000 });
  for (const mm of ['2026-09', '2026-10', '2026-11']) assert.equal(r.samtals.ogefid[mm], r.samtals.unnid[mm] - r.samtals.reikningsfaert[mm]);
  assert.equal(r.an_verkstadar.n_reikningar, 5, 'PAID/SENT útgefnir í mánuðunum án worksite_match: nr. 2, 3, 4, 5 og 11');
  for (const k of ['unnid', 'reikningsfaert', 'greitt', 'ogreitt']) for (const mm of Object.keys(r.samtals[k])) {
    const dalkur = r.verkstadir.reduce((a, x) => a + (k === 'unnid' ? x.unnid[mm] : x[k][mm]), 0) + (k === 'unnid' ? 0 : r.an_verkstadar[k][mm]);
    assert.equal(r.samtals[k][mm], dalkur, `Samtals ${k} ${mm} = summa raðanna eins og þær eru sýndar`);
  }
  // greitt = sama og Rekstrarskýrslan (paydayBh í fixtúrunni er stillt eins) — krossathugunin þegir ekki þegar tölurnar víkja
  assert.equal(r.krossathugun.unnid_stemmir, true); assert.equal(r.krossathugun.greitt_stemmir, true);
  g.paydayBh.pop();
  assert.equal(TB._reikna({ per: per3, gogn: g, radir, hand }, '2026-11-17').krossathugun.greitt_stemmir, false);
});

test('reikningar: merking fram í tímann er ekki greiðsla í mánuði (en reikningurinn er samt merktur greiddur); núll-/neikvæðar upphæðir og CREDIT teljast hvergi', () => {
  const radir = [inv(1, 'SENT', '2026-10-02', 5000), inv(2, 'SENT', '2026-10-02', 0), inv(3, 'CREDIT', '2026-10-03', -485), inv(4, 'SENT', '2026-10-04', 700)];
  const hand = [{ inv_key: 'payday|1', paid: true, paid_at: '2026-12-30T10:00:00Z' }, { inv_key: 'payday|4', paid: false, paid_at: '2026-10-10T10:00:00Z' }];
  const x = TB._reikningar(per3, radir, hand, '2026-11-17');
  const an = x.m.get('__an_verkstadar__');
  assert.deepEqual(an.gr, {}, 'merking fram í tímann er ekki greiðsla; paid:false er ekki merking');
  assert.equal(an.ogr['2026-10'], 700, 'nr. 1 er merktur greiddur (Kröfu yfirlit) → ekki útistandandi; nr. 4 með paid:false er enn ógreitt; núll-upphæð telst ekki');
  assert.equal(an.rf['2026-10'], 5700, 'reikningsfært: PAID/SENT útgefnir (núll-upphæð bætir engu við); CREDIT utan');
});

test('reikningar: engin útgáfudagsetning → gjalddagi ræður mánuði (eins og T.brunaholfManudir); verkstaður án stafastærðar', () => {
  const radir = [inv(1, 'SENT', null, 3000, { gjalddagi: '2026-11-10', worksite_match: 'Tindasel The farm' }), inv(2, 'SENT', '2026-10-02', 1000, { worksite_match: 'tindasel the farm' })];
  const x = TB._reikningar(per3, radir, [], '2026-11-17');
  assert.equal(x.m.size, 1, 'sami verkstaður þótt stafastærð sé önnur'); const e = [...x.m.values()][0];
  assert.deepEqual(e.rf, { '2026-11': 3000, '2026-10': 1000 }); assert.equal([...x.disp.values()][0], 'Tindasel The farm', 'sýnisnafn = fyrsta nafnið');
});

test('síðurnar: Tekjuliðir Brunahólfs lesið úr /api/tekjulidir-bh; platan á Fjármála-yfirliti er hlekkur með þremur aðskildum tölum á félag (engin heildarsumma)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const rs = fs.readFileSync(path.join(__dirname, '..', 'rekstrarskyrsla.html'), 'utf8');
  assert.match(rs, /id="tekjulidir-bh"/); assert.match(rs, /fetch\('\/api\/tekjulidir-bh'/); assert.match(rs, /RekstrarTekjulidirBh\.hlada\(\)/);
  assert.match(rs, /href="#tekjulidir-bh"/); assert.match(rs, /án verkstaðar/); assert.match(rs, /ÁÆTLUN/);
  assert.match(rs, /:is\(#tekjulidir, #tekjulidir-bh\)/, 'sami stíll á báðum köflum');
  const fj = fs.readFileSync(path.join(__dirname, '..', 'fjarmalyfirlit.html'), 'utf8');
  assert.match(fj, /<a class="boss-slab grand grand2" href="\/rekstur#tekjulidir"/, 'platan er hlekkur á Tekjuliði');
  assert.doesNotMatch(fj, /Heildar-pípa · allt óinnheimt/, 'engin heildar-pípa lengur'); assert.doesNotMatch(fj, /class="pipe"/); assert.doesNotMatch(fj, /grandDisp/, 'engin samlögð tala');
  assert.match(fj, /Ógreitt · sent og óborgað/); assert.match(fj, /Ósent · ekki sent/); assert.match(fj, /g2Felag\('Slökkvitæki', 'sl', A\.ogreitt_payday, A\.osendar, 'kröfur'\)/, 'Slökkvitæki: „kröfur“ eins og spjaldið'); assert.match(fj, /g2Felag\('Brunahólf', 'bh', d\.bru_payday_ogreitt, d\.bru_osendar, 'drög'\)/); assert.match(fj, /Unnið en ekki gefið út/);
  assert.match(fj, /m\.ogefid==null/, 'ógefið út: null er ómælt, ekki „ekkert“');
  assert.match(fj, /render\(d, nlsh, Date\.now\(\)\);\s*fyReksturHlada\(\);/); assert.match(fj, /fyG2\('sl', j\.slokkvitaeki\); fyG2\('bh', j\.brunaholf\)/);
  assert.match(fj, /css\/fjarmalyfirlit\.css\?v=7/); assert.match(fj, /📊 Tekjuliðir/, 'hnappurinn í haus stendur');
  assert.match(fj, /ómælt/, 'ómælt með ástæðu, aldrei 0');
});

// ---- fallið: aðgangur og sókn ----
const LEYND = 'leynd-session-lykill';
const PW = '2026-10-19T12:00:00Z';
function toki(uid, leynd = LEYND) {
  const g = Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + 3600, v: PW })).toString('base64url');
  return g + '.' + crypto.createHmac('sha256', leynd).update(g).digest('base64url');
}
const ev = (t) => ({ httpMethod: 'GET', headers: t ? { cookie: 'hub_user=' + encodeURIComponent(t) } : {} });

test('tekjulidir-bh: 401/403/405; stjórnandi fær þrjá mánuði; tómur lestur → 502 með ástæðu (aldrei 0)', async () => {
  const idag = new Date().toISOString().slice(0, 10);
  const nuMan = idag.slice(0, 7);
  const fyrri = global.fetch;
  const notendur = { 1: { id: 1, nafn: 'Agnar S', rola: 'Admin', virkur: true }, 2: { id: 2, nafn: 'Starfs M', rola: 'Starfsmaður', virkur: true } };
  let ham = 'ok';
  const svar = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
  global.fetch = async (url) => {
    const u = new URL(url), t = u.pathname.replace('/rest/v1/', ''), sel = u.searchParams.get('select') || '';
    if (t === 'hub_adgangar_stilling') return svar([{ session_secret: LEYND, pw_changed_at: PW }]);
    if (t === 'hub_adgangar') { const id = (u.searchParams.get('id') || '').replace('eq.', ''); return svar(notendur[id] ? [notendur[id]] : []); }
    if (t === 'timavera_entries' && sel.includes('hours')) return svar(ham === 'tomt' ? [] : [{ date: idag, hours: 8, project: 'Verk A' }]);
    if (t === 'skr_hub_skraningar' && sel.includes('project_name')) return svar([{ project_name: 'Heklureitur', serial_number: 'A1', category_group: 'Gat Ø1210-1300', execution_date: idag, registration_status: 'Done' }]);
    if (t === 'hole_size_rates') return svar(ham === 'engarVerdskrar' ? [] : [{ scope: 'heklureitur', size_min_mm: 1210, size_max_mm: 1259, rate_an_vsk: 60000 }]);
    if (t === 'pricing_guide') return svar(ham === 'engarVerdskrar' ? [] : [{ worksite_name: 'Orkureitur', dagvinna_rate: 10500, effective_from: '2026-01-01' }]);
    if (t === 'invoices' && sel.includes('worksite_match')) return svar(ham === 'enginir' ? [] : [{ tilvisun: '1', status: 'PAID', utgafudagur: idag, gjalddagi: idag, greidsla_date: idag, hofudstoll: 1000, worksite_match: null }]);
    if (t === 'invoices' && u.searchParams.get('status') === 'eq.PAID') return svar([{ status: 'PAID', greidsla_date: idag, hofudstoll: 1000 }]);
    return svar([]);
  };
  try {
    assert.equal((await TB.handler({ httpMethod: 'GET', headers: {} })).statusCode, 401);
    assert.equal((await TB.handler(ev(toki(2)))).statusCode, 403);
    assert.equal((await TB.handler({ httpMethod: 'POST', headers: {} })).statusCode, 405);
    const r = await TB.handler(ev(toki(1)));
    assert.equal(r.statusCode, 200);
    const j = JSON.parse(r.body);
    assert.equal(j.manudir.length, 3); assert.equal(j.manudir[2].man, nuMan); assert.equal(j.manudir[2].til, idag);
    const a = j.verkstadir.find((x) => x.verk === 'Verk A');
    assert.equal(a.an_taxta, true); assert.equal(a.unnid[nuMan], 8 * 9951);
    assert.equal(j.verkstadir.find((x) => x.verk === 'Heklu reitur').unnid[nuMan], 60000);
    assert.equal(j.samtals.unnid[nuMan], 8 * 9951 + 60000);
    assert.equal(j.an_verkstadar.reikningsfaert[nuMan], 1000, 'enginn worksite_match → „án verkstaðar“');
    assert.equal(j.samtals.ogefid[nuMan], 8 * 9951 + 60000 - 1000);
    assert.equal(j.krossathugun.unnid_stemmir, true); assert.equal(j.krossathugun.greitt_stemmir, true);
    assert.doesNotMatch(r.body, /\b\d{10}\b/, 'engar kennitölur eða viðskiptavinanöfn í svarinu');
    ham = 'tomt';
    const r2 = await TB.handler(ev(toki(1)));
    assert.equal(r2.statusCode, 502); assert.match(JSON.parse(r2.body).villa, /Tímaveru-lesturinn skilaði engu/);
    ham = 'enginir';
    const r3 = await TB.handler(ev(toki(1)));
    assert.equal(r3.statusCode, 502); assert.match(JSON.parse(r3.body).villa, /reikningalesturinn skilaði engu/);
    ham = 'engarVerdskrar';                                           // tóm Verðskrá = allir verkstaðir fengju 9.951 og Heklureitsgöt hyrfu → ómælt, ekki villandi tölur
    const r4 = await TB.handler(ev(toki(1)));
    assert.equal(r4.statusCode, 502); assert.match(JSON.parse(r4.body).villa, /Verðskrárlesturinn skilaði engu/);
  } finally { global.fetch = fyrri; }
});
