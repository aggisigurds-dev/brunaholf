// Próf: drog-timar.js STOFNAR drög líðandi mánaðar úr Tímaveru (15.11.2026, Fjallaböðin) og uppfærsluáfanginn
// snertir ekki send / tengd drög. Stub-fetch hermir PostgREST — ekkert fer í lifandi grunn.
'use strict';
process.env.SUPABASE_URL = 'http://stub.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../netlify/functions/drog-timar.js');

const NOV = new Date('2026-11-15T12:00:00Z');
const FJ = 'Fjallaböðin Þjórsárdal';

const pg = (worksite_name, o = {}) => Object.assign({
  worksite_name, source: 'timavera', dagvinna_rate: 9951, eftirvinna_rate: 14927, smahlutagjald_per_h: null,
  eftirvinna_threshold_per_day: null, stadfesting_default: null, stadfesting_amount: null, vsk_pct: 24,
  fixed_amount: null, customer_name: `${worksite_name} ehf.`, kennitala: null, heimilisfang: null,
}, o);
const faersla = (date, employee, project, hours) => ({ date, time_in: '08:00', time_out: '', hours, employee, project });
const drag = (id, worksite_name, work_month, o = {}) => Object.assign({
  id, worksite_name, work_month, source: 'timavera', status: 'draft', payday_invoice_id: null, merged_into: null, merged_from: null,
  fixed_total: null, notes: '', customer_name: `${worksite_name} ehf.`, kennitala: null, hours_dagvinna: 8, hours_eftirvinna: 0,
  timavera_klst_vid_vistun: 8, rate_dagvinna: 9951, rate_eftirvinna: 14927, smahlutagjald: 1, stadfesting: 0, akstur_km: 0,
  akstur_ferdir: 0, akstur_gjald: 0, materials_jsonb: [], materials_total: 0, discount_pct: 0, total_m_vsk: 100000,
}, o);

function heimur() {
  return {
    pricing: [
      pg(FJ, { dagvinna_rate: 9300, eftirvinna_rate: 13950, eftirvinna_threshold_per_day: 8, smahlutagjald_per_h: 0, customer_name: 'JÁVERK ehf.', kennitala: '701292-4809', heimilisfang: 'Þjórsárdal' }),
      pg('Grensásvegur 1', { stadfesting_default: true, stadfesting_amount: 15000, customer_name: 'Grensás ehf.', kennitala: '4101012340', heimilisfang: 'Grensásvegi 1' }),
      pg('Fjarðagata'), pg('Orkureitur'), pg('Skúlagata 26'), pg('Bíldshöfði 9'), pg('Lækjargata 12'),
      pg('Stórhöfði', { fixed_amount: 500000 }),
      pg('Gata Kringlan', { source: 'ajour' }),
      pg('Ármúli 4', { dagvinna_rate: null }),
      pg('Hvaleyrarbraut 3', { customer_name: null }),
    ],
    cwmap: [{ customer_name: 'JÁVERK ehf.', worksite_name: FJ, kt_greidanda: '701292-4809', confidence: 'manual', tilvisun: FJ, retention_pct: null }],
    invoices: [{ id: 900, source: 'payday', status: 'SENT', kt_greidanda: '550101-2345', customer_name: 'Kirkjusandur hf.', tilvisun: 'R-400', upphaed_total: 124000, gjalddagi: '2026-11-20' }],
    aliases: [{ canonical_name: FJ, alias: 'Fjallaböð JÁ Verk' }],
    minni: ['Orkureitur|2026-11'],
    meta: [
      { inv_key: 'timavera|Fjarðagata|2026-11', hidden: true },
      { inv_key: 'draftinv|Bíldshöfði 9|2026-11' },
      { inv_key: 'draftinv|Hraunbær 1|2026-11', sent: true },
      { inv_key: 'draftinv|Hraunbær 2|2026-11', done: true },
    ],
    drafts: [
      drag(11, 'Skúlagata 26', '2026-11', { hours_dagvinna: 10, timavera_klst_vid_vistun: 10 }),
      drag(12, 'Hraunbær 1', '2026-11'),
      drag(13, 'Hraunbær 2', '2026-11'),
      drag(14, 'Kirkjusandur', '2026-11', { kennitala: '550101-2345', total_m_vsk: 124000 }),
      drag(15, 'Lækjargata 12', '2026-09', { fixed_total: 300000, status: 'invoiced' }),
    ],
    entries: [
      // Fjallaböðin: mán 10 klst (8 dv + 2 ev), þri 8 klst undir aliasnum, lau 5 klst (helgi = ev) → 23 klst: dv 16, ev 7
      faersla('2026-11-02', 'Gunnar', FJ, 10), faersla('2026-11-03', 'Gunnar', 'Fjallaböð JÁ Verk', 8), faersla('2026-11-07', 'Gunnar', FJ, 5),
      // Grensásvegur 1: mán 9,25 + þri 3 = 12,25 klst, enginn yfirvinnuþröskuldur → allt í dagvinnu (aurar → námundun)
      faersla('2026-11-09', 'Jón', 'Grensásvegur 1', 9.25), faersla('2026-11-10', 'Jón', 'Grensásvegur 1', 3),
      faersla('2026-11-02', 'Anna', 'Skúlagata 26', 8), faersla('2026-11-03', 'Anna', 'Skúlagata 26', 8),
      faersla('2026-11-02', 'Jón', 'Tindasel', 30), faersla('2026-11-02', 'Jón', 'Smáverk', 0.5),
      faersla('2026-11-02', 'Pétur', 'Landsspitalinn', 50), faersla('2026-11-04', 'Pétur', 'Veikindi', 8),
      faersla('2026-11-04', 'Óli', 'Fjarðagata', 20), faersla('2026-11-04', 'Óli', 'Orkureitur', 10),
      faersla('2026-11-04', 'Óli', 'Stórhöfði', 5), faersla('2026-11-04', 'Óli', 'Lækjargata 12', 6),
      faersla('2026-11-05', 'Óli', 'Gata Kringlan', 7), faersla('2026-11-05', 'Óli', 'Ármúli 4', 4),
      faersla('2026-11-05', 'Óli', 'Bíldshöfði 9', 3), faersla('2026-11-05', 'Óli', 'Hvaleyrarbraut 3', 2),
      faersla('2026-11-05', 'Óli', 'Hraunbær 1', 9), faersla('2026-11-05', 'Óli', 'Hraunbær 2', 9), faersla('2026-11-05', 'Óli', 'Kirkjusandur', 9),
    ],
  };
}

// Gildin í in.(…)-lista, hvort sem hann er URL-kóðaður (inLista) eða hrár (timabok).
const inGildi = (url, reitur) => {
  const m = decodeURIComponent(url).match(new RegExp(`[?&]${reitur}=in\\.\\((.*?)\\)(?:&|$)`));
  if (!m) return null;
  const strengir = [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1].replace(/\\"/g, '"'));
  return strengir.length ? strengir : m[1].split(',');
};
const dags = (url, op) => (decodeURIComponent(url).match(new RegExp(`date=${op}\\.(\\d{4}-\\d{2}-\\d{2})`)) || [])[1];

function stub(h, opt = {}) {
  const kall = [];
  let nyttId = 1000;
  const svar = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  global.fetch = async (url, o = {}) => {
    url = String(url);
    const method = o.method || 'GET';
    const body = o.body ? JSON.parse(o.body) : null;
    kall.push({ url, method, body, prefer: (o.headers || {}).Prefer || '' });
    const slod = decodeURIComponent(url.replace('http://stub.invalid/rest/v1/', ''));
    if (method === 'POST' && slod.startsWith('app_kv')) { h.minni = body.value; return svar(null); }
    if (method === 'POST' && slod.startsWith('invoice_drafts')) {
      if (opt.arekstur) return svar([]);                       // ignore-duplicates: röðin var þegar til
      const rod = Object.assign({ id: ++nyttId }, body);
      h.drafts.push(rod);
      return svar([rod]);
    }
    if (method === 'PATCH' && slod.startsWith('invoice_drafts')) {
      const id = Number(slod.match(/id=eq\.(\d+)/)[1]);
      const d = h.drafts.find((x) => x.id === id); Object.assign(d, body);
      return svar([d]);
    }
    if (method !== 'GET') throw new Error('óvænt kall ' + method + ' ' + slod);
    if (slod.startsWith('pricing_guide')) return svar(h.pricing);
    if (slod.startsWith('customer_worksite_map')) return svar(h.cwmap);
    if (slod.startsWith('invoices')) return svar(h.invoices);
    if (slod.startsWith('project_aliases')) return svar(h.aliases);
    if (slod.startsWith('app_kv')) return svar(h.minni ? [{ value: h.minni }] : []);
    if (slod.startsWith('krofur_yfirlit_meta')) { const k = new Set(inGildi(url, 'inv_key')); return svar(h.meta.filter((m) => k.has(m.inv_key))); }
    if (slod.startsWith('timavera_entries')) {
      const fra = dags(url, 'gte'), til = dags(url, 'lt'), nofn = inGildi(url, 'project');
      const rodur = h.entries.filter((e) => e.date >= fra && e.date < til && (!nofn || nofn.includes(e.project)));
      return svar(slod.startsWith('timavera_entries?select=project,hours') ? rodur.map(({ project, hours }) => ({ project, hours })) : rodur);
    }
    if (slod.startsWith('invoice_drafts?select=*')) {
      const man = inGildi(url, 'work_month');
      return svar(h.drafts.filter((d) => man.includes(d.work_month) && ['draft', 'overdue'].includes(d.status) && d.payday_invoice_id == null));
    }
    if (slod.startsWith('invoice_drafts')) return svar(h.drafts);
    throw new Error('óþekkt slóð ' + slod);
  };
  return kall;
}

const stofnLina = (ut, ws) => ut.stofnun.find((l) => l.ws === ws);
const uppfLina = (ut, ws) => ut.linur.find((l) => l.ws === ws);

test('dry-run: Fjallaböðin og Grensásvegur fá drög, ástæður hinna standa, ekkert skrifað', async () => {
  const h = heimur();
  const kall = stub(h);
  const ut = await D.keyra({ dry: true, now: NOV });
  assert.deepEqual(kall.filter((k) => k.method !== 'GET'), [], 'dry-run má ekkert skrifa');
  assert.equal(ut.stofnud, 2);
  assert.equal(ut.villur, 0, JSON.stringify(ut.stofnun.filter((l) => l.villa)));

  // Fjallaböðin: 23 klst (líka undir aliasnum), yfirvinnuþröskuldur í Verðskrá → skipting tímabókar, smáhlutagjald 0 í Verðskrá
  const fj = stofnLina(ut, FJ);
  assert.equal(fj.stofnad, true);
  assert.equal(fj.klst, 23);
  assert.equal(fj.dv, 16); assert.equal(fj.ev, 7);
  assert.equal(fj.greidandi, 'JÁVERK ehf.'); assert.equal(fj.kt, '701292-4809');
  assert.equal(fj.total, 246450 + 59148);                     // 16×9.300 + 7×13.950 = 246.450 + 24% vsk

  // Grensásvegur: enginn þröskuldur → allt í dagvinnu; smáhlutagjald 137 kr/klst; staðfesting sjálfgefin; kt úr Verðskrá
  const gr = stofnLina(ut, 'Grensásvegur 1');
  assert.equal(gr.dv, 12.25); assert.equal(gr.ev, 0);
  assert.equal(gr.kt, '410101-2340');
  assert.equal(gr.total, 138578 + 33259);                     // 12,25×9.951 + 137×12,25 + 15.000 = 138.577,75 → 138.578 + vsk

  const sleppt = Object.fromEntries(ut.stofnun.filter((l) => l.sleppt).map((l) => [l.ws, l.sleppt]));
  assert.deepEqual(sleppt, {
    'Tindasel': 'ekki í Verðskrá',
    'Landsspitalinn': 'gata-/Ajour-verk',
    'Veikindi': 'ó-rukkanlegt',
    'Fjarðagata': 'falið í Kröfu yfirliti',
    'Orkureitur': 'stofnað áður (eytt síðan?) — ekki stofnað aftur',
    'Stórhöfði': 'fast verð',
    'Lækjargata 12': 'fast verð',
    'Gata Kringlan': 'Ajour-verk',
    'Ármúli 4': 'enginn dagvinnutaxti í Verðskrá',
    'Bíldshöfði 9': 'merkt í Kröfu yfirliti (draftinv)',
    'Hvaleyrarbraut 3': 'enginn greiðandi',
  });
  assert.equal(stofnLina(ut, 'Smáverk'), undefined, 'undir 1 klst → ekki einu sinni skoðað');
  for (const ws of ['Skúlagata 26', 'Hraunbær 1', 'Hraunbær 2', 'Kirkjusandur']) assert.equal(stofnLina(ut, ws), undefined, ws + ': drögin eru til → uppfærsluáfanginn');

  // Uppfærsluáfanginn: Skúlagata hækkar um 6 klst; send, krafa send og Payday-tengd drög eru ósnert
  assert.equal(uppfLina(ut, 'Skúlagata 26').delta, 6);
  assert.equal(uppfLina(ut, 'Hraunbær 1').sleppt, '📤 sent í bókun');
  assert.equal(uppfLina(ut, 'Hraunbær 2').sleppt, '📨 krafa send');
  assert.equal(uppfLina(ut, 'Kirkjusandur').sleppt, 'tengt Payday-reikningi');
});

test('keyrsla: minnið skrifast Á UNDAN drögunum, réttir reitir, ný drög ekki uppfærð aftur í sömu keyrslu', async () => {
  const h = heimur();
  const kall = stub(h);
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.equal(ut.villur, 0);
  assert.equal(ut.stofnud, 2);

  const skrif = kall.filter((k) => k.method !== 'GET');
  const iMinni = skrif.findIndex((k) => k.url.includes('/app_kv'));
  const iDrog = skrif.findIndex((k) => k.method === 'POST' && k.url.includes('/invoice_drafts'));
  assert.ok(iMinni >= 0 && iDrog > iMinni, 'app_kv-minnið á undan innsetningunni');
  assert.deepEqual([...h.minni].sort(), ['Fjallaböðin Þjórsárdal|2026-11', 'Grensásvegur 1|2026-11', 'Orkureitur|2026-11']);

  const ins = skrif.filter((k) => k.method === 'POST' && k.url.includes('/invoice_drafts'));
  assert.equal(ins.length, 2);
  for (const k of ins) {
    assert.match(k.url, /on_conflict=worksite_name,work_month/);
    assert.match(k.prefer, /resolution=ignore-duplicates/);
  }
  const fj = ins.find((k) => k.body.worksite_name === FJ).body;
  assert.equal(fj.work_month, '2026-11');
  assert.equal(fj.source, 'timavera'); assert.equal(fj.status, 'draft');
  assert.equal(fj.customer_name, 'JÁVERK ehf.'); assert.equal(fj.kennitala, '701292-4809');
  assert.equal(fj.tilvisun, FJ); assert.equal(fj.heimilisfang, 'Þjórsárdal');
  assert.equal(fj.hours_dagvinna, 16); assert.equal(fj.hours_eftirvinna, 7);
  assert.equal(fj.rate_dagvinna, 9300); assert.equal(fj.rate_eftirvinna, 13950);
  assert.equal(fj.smahlutagjald, 0); assert.equal(fj.stadfesting, 0);
  assert.deepEqual(fj.materials_jsonb, []); assert.equal(fj.discount_pct, 0);
  assert.equal(fj.net_an_vsk, 246450); assert.equal(fj.vsk_amount, 59148); assert.equal(fj.total_m_vsk, 305598);
  assert.equal(fj.timavera_klst_vid_vistun, 23);
  assert.equal(fj.notes, undefined, 'ekkert í notes — það prentast á Efnislistann');
  for (const k of ins) assert.ok(Number.isInteger(k.body.total_m_vsk) && Number.isInteger(k.body.net_an_vsk), 'heilar krónur');

  // Uppfærsluáfanginn sér nýju drögin en breytir þeim ekki (Δ = 0); aðeins Skúlagata er PATCH-uð
  assert.equal(uppfLina(ut, FJ).obreytt, true);
  const patch = skrif.filter((k) => k.method === 'PATCH');
  assert.equal(patch.length, 1);
  assert.match(decodeURIComponent(patch[0].url), /id=eq\.11$/);
  assert.equal(patch[0].body.hours_dagvinna, 16); assert.equal(patch[0].body.hours_eftirvinna, 0);
  assert.equal(patch[0].body.total_m_vsk, 161408 + 38738);   // 16×9.951 + 137×16 = 161.408 + vsk
});

test('önnur keyrsla eftir að drögunum var eytt: ekki stofnað aftur', async () => {
  const h = heimur();
  stub(h);
  await D.keyra({ dry: false, now: NOV });
  h.drafts = h.drafts.filter((d) => d.worksite_name !== FJ);   // Agnar eyðir drögunum í Reikningalistanum
  const kall = stub(h);
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.equal(stofnLina(ut, FJ).sleppt, 'stofnað áður (eytt síðan?) — ekki stofnað aftur');
  assert.equal(kall.filter((k) => k.method === 'POST' && k.url.includes('/invoice_drafts')).length, 0);
});

test('árekstur: manneskja stofnaði drögin á sömu sekúndu → ekki talið stofnað, ekkert yfirskrifað', async () => {
  const h = heimur();
  const kall = stub(h, { arekstur: true });
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.equal(ut.stofnud, 0);
  assert.equal(stofnLina(ut, FJ).sleppt, 'drög urðu til á sama tíma — ekki snert');
  assert.equal(kall.filter((k) => k.method === 'PATCH' && !k.url.includes('id=eq.11')).length, 0);
});

test('yfirvinnuþröskuldur í Verðskrá: drög stofnuð án yfirvinnu fá hana þegar hún kemur', async () => {
  const h = heimur();
  h.drafts.push(drag(20, FJ, '2026-11', { hours_dagvinna: 16, hours_eftirvinna: 0, timavera_klst_vid_vistun: 16, rate_dagvinna: 9300, rate_eftirvinna: 13950, smahlutagjald: 0 }));
  const kall = stub(h);
  const ut = await D.keyra({ dry: false, now: NOV });
  const lina = uppfLina(ut, FJ);
  assert.equal(lina.delta, 7);
  assert.equal(lina.dv, 16); assert.equal(lina.ev, 7, 'ev = 0 á drögunum má ekki setja yfirvinnuna í dagvinnu');
  assert.equal(kall.find((k) => k.method === 'PATCH' && k.url.includes('id=eq.20')).body.hours_eftirvinna, 7);
});

test('fyrstu 3 dagar mánaðar: drög aðeins stofnuð fyrir líðandi mánuð, fyrri mánuður aðeins uppfærður', async () => {
  const h = heimur();
  const kall = stub(h);
  const ut = await D.keyra({ dry: true, now: new Date('2026-12-02T08:00:00Z') });
  assert.deepEqual(ut.manudir, ['2026-12', '2026-11']);
  const manadarlestur = kall.filter((k) => k.url.includes('timavera_entries?select=project,hours'));
  assert.equal(manadarlestur.length, 1);
  assert.match(decodeURIComponent(manadarlestur[0].url), /date=gte\.2026-12-01&date=lt\.2027-01-01/);
  assert.equal(ut.stofnun.filter((l) => l.m === '2026-11').length, 0, 'nóvember-drög eru ALDREI stofnuð í desember');
  assert.equal(uppfLina(ut, 'Skúlagata 26').delta, 6, 'nóvember-drög sem eru til uppfærast áfram');
});

test('GET á handlerinn er ALLTAF áætlun — líka án ?dry=1 (GET framkvæmir aldrei verk)', async () => {
  for (const q of [{ dry: '1' }, {}, { dry: '0' }]) {
    const h = heimur();
    const kall = stub(h);
    const r = await D.handler({ httpMethod: 'GET', queryStringParameters: q, headers: {} });
    assert.equal(r.statusCode, 200, JSON.stringify(q));
    assert.equal(JSON.parse(r.body).dry, true, JSON.stringify(q));
    assert.deepEqual(kall.filter((k) => k.method !== 'GET'), [], JSON.stringify(q));
  }
});

test('POST á handlerinn keyrir (dry=1 virt)', async () => {
  const h = heimur();
  const kall = stub(h);
  const r = await D.handler({ httpMethod: 'POST', queryStringParameters: { dry: '1' }, headers: {} });
  assert.equal(JSON.parse(r.body).dry, true);
  assert.deepEqual(kall.filter((k) => k.method !== 'GET'), []);
});
