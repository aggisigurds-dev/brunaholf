// Próf: drog-timar.js STOFNAR drög líðandi mánaðar úr Tímaveru (15.11.2026, Fjallaböðin) og uppfærsluáfanginn
// snertir ekki send / tengd drög. Stub-fetch hermir PostgREST — ekkert fer í lifandi grunn.
// Stubburinn les slóðina EINS OG PostgREST (URLSearchParams á hráu slóðinni), svo ókóðað & eða bil brýtur prófið eins og þjóninn.
'use strict';
process.env.SUPABASE_URL = 'http://stub.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub';
delete process.env.HUB_STAFF_PASSWORD;
const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../netlify/functions/drog-timar.js');
const T = require('../netlify/functions/timabok.js');

const NOV = new Date('2026-11-15T12:00:00Z');
const FJ = 'Fjallaböðin Þjórsárdal';

const pg = (worksite_name, o = {}) => Object.assign({
  worksite_name, source: 'timavera', dagvinna_rate: 9951, eftirvinna_rate: 14927, smahlutagjald_per_h: null,
  eftirvinna_threshold_per_day: null, eftirvinna_leyfid: true, yfirvinna_samningur: false,
  stadfesting_default: false, stadfesting_amount: 20000, vsk_pct: 24,
  fixed_amount: null, customer_name: `${worksite_name} ehf.`, kennitala: null, heimilisfang: null,
}, o);
const faersla = (date, employee, project, hours) => ({ id: ++faersla.n, date, time_in: '08:00', time_out: '', hours, employee, project });
faersla.n = 0;
const drag = (id, worksite_name, work_month, o = {}) => Object.assign({
  id, worksite_name, work_month, source: 'timavera', status: 'draft', payday_invoice_id: null, merged_into: null, merged_from: null,
  fixed_total: null, notes: '', customer_name: `${worksite_name} ehf.`, kennitala: null, hours_dagvinna: 8, hours_eftirvinna: 0,
  timavera_klst_vid_vistun: 8, rate_dagvinna: 9951, rate_eftirvinna: 14927, smahlutagjald: 1, stadfesting: 0, akstur_km: 0,
  akstur_ferdir: 0, akstur_gjald: 0, materials_jsonb: [], materials_total: 0, discount_pct: 0, total_m_vsk: 100000,
}, o);

function heimur() {
  return {
    pricing: [
      // Eins og í lifandi Verðskrá 15.11: Fjallaböðin ber samningsbundna yfirvinnu, þröskuld 8 og staðfestingu af.
      pg(FJ, { dagvinna_rate: 9300, eftirvinna_rate: 13950, eftirvinna_threshold_per_day: 8, yfirvinna_samningur: true, smahlutagjald_per_h: 0, customer_name: 'JÁVERK ehf.', kennitala: '701292-4809', heimilisfang: 'Þjórsárdal' }),
      // Grensás: þröskuldur 8 og eftirvinna_leyfid (eins og Viðskiptavinir-glugginn skrifar) en ENGINN samningur → allt í dagvinnu.
      // stadfesting_default null → á (regla ritilsins), stadfesting_amount 15.000 hunsað → GR_STADF 20.000. kt aðeins í Verðskrá.
      pg('Grensásvegur 1', { eftirvinna_threshold_per_day: 8, stadfesting_default: null, stadfesting_amount: 15000, customer_name: 'Grensás ehf.', kennitala: '4101012340', heimilisfang: 'Grensásvegi 1' }),
      // Skjólbraut 3: „jól" í nafninu — K.ORUKKANLEGT grípur það, en verk í Verðskrá má hún aldrei loka.
      // … og ber stadfesting_default TRUE (→ 20.000) og source NULL (tómt source leyfist, eins og timavera).
      pg('Skjólbraut 3', { stadfesting_default: true, source: null }),
      // Bakskástrik í nafni: in-listinn verður að flýja \ svo falið-merkið finnist.
      pg('Bak\\slóð 1'),
      pg('Fjarðagata'), pg('Orkureitur'), pg('Skúlagata 26'), pg('Bíldshöfði 9'), pg('Lækjargata 12'),
      pg('Stórhöfði', { fixed_amount: 500000 }),
      pg('Gata Kringlan', { source: 'ajour' }),
      pg('Hamraborg 11', { source: 'fixed' }),
      pg('Ármúli 4', { dagvinna_rate: null }),
      pg('Hvaleyrarbraut 3', { customer_name: null }),
      // Dalvegur 30: í lifandi Verðskrá source 'timavera' MEÐ taxta og greiðanda — aðeins nafnið (K.GATA) heldur gata-verkinu utan.
      pg('Dalvegur 30'),
    ],
    cwmap: [{ customer_name: 'JÁVERK ehf.', worksite_name: FJ, kt_greidanda: '701292-4809', confidence: 'manual', tilvisun: FJ, retention_pct: null }],
    invoices: [{ id: 900, source: 'payday', status: 'SENT', kt_greidanda: '550101-2345', customer_name: 'Kirkjusandur hf.', tilvisun: 'R-400', upphaed_total: 124000, gjalddagi: '2026-11-20' }],
    aliases: [{ canonical_name: FJ, alias: 'Fjallaböð JÁ Verk' }],
    minni: ['Orkureitur|2026-11'],
    meta: [
      { inv_key: 'timavera|Fjarðagata|2026-11', hidden: true },
      { inv_key: 'timavera|Bak\\slóð 1|2026-11', hidden: true },
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
      // Grensásvegur 1: mán 9,25 + þri 3 = 12,25 klst; tímabókin segir 1,25 ev, en án samnings fer allt í dagvinnu (aurar → námundun)
      faersla('2026-11-09', 'Jón', 'Grensásvegur 1', 9.25), faersla('2026-11-10', 'Jón', 'Grensásvegur 1', 3),
      faersla('2026-11-09', 'Jón', 'Skjólbraut 3', 4),
      faersla('2026-11-09', 'Jón', 'Bak\\slóð 1', 3),
      faersla('2026-11-02', 'Anna', 'Skúlagata 26', 8), faersla('2026-11-03', 'Anna', 'Skúlagata 26', 8),
      faersla('2026-11-02', 'Jón', 'Tindasel', 30), faersla('2026-11-02', 'Jón', 'Smáverk', 0.5),
      faersla('2026-11-02', 'Pétur', 'Landsspitalinn', 50), faersla('2026-11-04', 'Pétur', 'Veikindi', 8),
      faersla('2026-11-04', 'Óli', 'Fjarðagata', 20), faersla('2026-11-04', 'Óli', 'Orkureitur', 10),
      faersla('2026-11-04', 'Óli', 'Stórhöfði', 5), faersla('2026-11-04', 'Óli', 'Lækjargata 12', 6),
      faersla('2026-11-05', 'Óli', 'Gata Kringlan', 7), faersla('2026-11-05', 'Óli', 'Hamraborg 11', 4), faersla('2026-11-05', 'Óli', 'Ármúli 4', 4),
      faersla('2026-11-05', 'Óli', 'Bíldshöfði 9', 3), faersla('2026-11-05', 'Óli', 'Hvaleyrarbraut 3', 2),
      faersla('2026-11-05', 'Óli', 'Dalvegur 30', 12),
      faersla('2026-11-05', 'Óli', 'Hraunbær 1', 9), faersla('2026-11-05', 'Óli', 'Hraunbær 2', 9), faersla('2026-11-05', 'Óli', 'Kirkjusandur', 9),
    ],
  };
}

// Síur lesnar eins og PostgREST les þær: URLSearchParams á HRÁU slóðinni (ókóðað & klýfur gildið, eins og á þjóninum).
const inGildi = (url, reitur) => {
  const v = new URL(url).searchParams.get(reitur);
  if (!v || !v.startsWith('in.(') || !v.endsWith(')')) return null;
  const innra = v.slice(4, -1);
  const strengir = [...innra.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1].replace(/\\(.)/g, '$1'));
  return strengir.length ? strengir : innra.split(',');
};
const dags = (url, op) => (new URL(url).searchParams.getAll('date').find((x) => x.startsWith(op + '.')) || '').slice(op.length + 1);

function stub(h, opt = {}) {
  const kall = [];
  let nyttId = 1000, kvKoll = 0;
  const svar = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  const bilun = (s) => ({ ok: false, status: s, json: async () => ({}), text: async () => 'stub-villa ' + s });
  global.fetch = async (url, o = {}) => {
    url = String(url);
    const method = o.method || 'GET';
    const body = o.body ? JSON.parse(o.body) : null;
    kall.push({ url, method, body, prefer: (o.headers || {}).Prefer || '' });
    const u = new URL(url);
    const tafla = decodeURIComponent(u.pathname.replace('/rest/v1/', ''));
    const sel = u.searchParams.get('select') || '';
    if (method === 'POST' && tafla === 'app_kv') {
      kvKoll++;
      if (opt.kvBilar && opt.kvBilar(kvKoll)) return bilun(503);
      h.minni = body.value; return svar(null);
    }
    if (method === 'POST' && tafla === 'invoice_drafts') {
      if (opt.insertBilar && opt.insertBilar.has(body.worksite_name)) return bilun(500);
      if (opt.arekstur && opt.arekstur.has(body.worksite_name)) {
        // Manneskja vistaði drög sama verks og mánaðar rétt á undan: röðin er til, INSERT … ignore-duplicates skilar engu.
        h.drafts.push(drag(777, body.worksite_name, body.work_month, { customer_name: 'Manneskja ehf.', notes: 'vistað af manneskju', hours_dagvinna: 12, timavera_klst_vid_vistun: 12 }));
        return svar([]);
      }
      const rod = Object.assign({ id: ++nyttId }, body);
      h.drafts.push(rod);
      return svar([rod]);
    }
    if (method === 'PATCH' && tafla === 'invoice_drafts') {
      const id = Number(u.searchParams.get('id').replace('eq.', ''));
      const d = h.drafts.find((x) => x.id === id); Object.assign(d, body);
      return svar([d]);
    }
    if (method !== 'GET') throw new Error('óvænt kall ' + method + ' ' + tafla);
    if (tafla === 'pricing_guide') return svar(h.pricing);
    if (tafla === 'customer_worksite_map') return svar(h.cwmap);
    if (tafla === 'invoices') return svar(h.invoices);
    if (tafla === 'project_aliases') return svar(h.aliases);
    if (tafla === 'app_kv') return opt.kvLesturBilar ? bilun(500) : svar(h.minni ? [{ value: h.minni }] : []);
    if (tafla === 'krofur_yfirlit_meta') { const k = new Set(inGildi(url, 'inv_key')); return svar(h.meta.filter((m) => k.has(m.inv_key))); }
    if (tafla === 'timavera_entries') {
      const fra = dags(url, 'gte'), til = dags(url, 'lt'), nofn = inGildi(url, 'project');
      if (u.searchParams.has('project') && !nofn) throw new Error('project-sían þáttast ekki: ' + u.searchParams.get('project'));
      const rodur = h.entries.filter((e) => e.date >= fra && e.date < til && (!nofn || nofn.includes(e.project)));
      return svar(sel === 'project,hours' ? rodur.map(({ project, hours }) => ({ project, hours })) : rodur);
    }
    if (tafla === 'invoice_drafts' && sel === '*') {
      if (opt.fasi1Bilar) return bilun(504);
      const man = inGildi(url, 'work_month');
      return svar(h.drafts.filter((d) => man.includes(d.work_month) && ['draft', 'overdue'].includes(d.status) && d.payday_invoice_id == null));
    }
    if (tafla === 'invoice_drafts') return svar(h.drafts);
    throw new Error('óþekkt slóð ' + tafla);
  };
  return kall;
}

const stofnLina = (ut, ws) => ut.stofnun.find((l) => l.ws === ws);
const uppfLina = (ut, ws) => ut.linur.find((l) => l.ws === ws);
const innsetningar = (kall) => kall.filter((k) => k.method === 'POST' && k.url.includes('/invoice_drafts'));

test('dry-run: þrjú verk fá drög, ástæður hinna standa, ekkert skrifað', async () => {
  const h = heimur();
  const kall = stub(h);
  const ut = await D.keyra({ dry: true, now: NOV });
  assert.deepEqual(kall.filter((k) => k.method !== 'GET'), [], 'dry-run má ekkert skrifa');
  assert.equal(ut.villur, 0, JSON.stringify(ut.stofnun.filter((l) => l.villa)));
  assert.equal(ut.stofnud, 3);

  // Fjallaböðin: 23 klst (líka undir aliasnum), yfirvinna_samningur → skipting tímabókar, smáhlutagjald 0 í Verðskrá
  const fj = stofnLina(ut, FJ);
  assert.equal(fj.stofnad, true);
  assert.equal(fj.klst, 23);
  assert.equal(fj.dv, 16); assert.equal(fj.ev, 7);
  assert.equal(fj.greidandi, 'JÁVERK ehf.'); assert.equal(fj.kt, '701292-4809');
  assert.equal(fj.total, 246450 + 59148);                     // 16×9.300 + 7×13.950 = 246.450 + 24% vsk

  // Grensásvegur: þröskuldur 8 en enginn samningur → allt í dagvinnu; smáhlutagjald 137; staðfesting 20.000 (null → á); kt úr Verðskrá
  const gr = stofnLina(ut, 'Grensásvegur 1');
  assert.equal(gr.dv, 12.25); assert.equal(gr.ev, 0);
  assert.equal(gr.kt, '410101-2340');
  assert.equal(gr.total, 143578 + 34459);                     // 12,25×9.951 + 137×12,25 + 20.000 = 143.577,75 → 143.578 + vsk

  assert.equal(stofnLina(ut, 'Skjólbraut 3').stofnad, true, 'verk í Verðskrá lokast aldrei á ORUKKANLEGT („jól")');

  const sleppt = Object.fromEntries(ut.stofnun.filter((l) => l.sleppt).map((l) => [l.ws, l.sleppt]));
  assert.deepEqual(sleppt, {
    'Tindasel': 'ekki í Verðskrá',
    'Landsspitalinn': 'gata-/Ajour-verk',
    'Veikindi': 'ó-rukkanlegt',
    'Fjarðagata': 'falið í Kröfu yfirliti',
    'Bak\\slóð 1': 'falið í Kröfu yfirliti',
    'Orkureitur': 'stofnað áður (eytt síðan?) — ekki stofnað aftur',
    'Stórhöfði': 'fast verð',
    'Lækjargata 12': 'fast verð',
    'Gata Kringlan': 'Ajour-verk',
    'Hamraborg 11': 'fast verð (Verðskrá)',
    'Ármúli 4': 'enginn dagvinnutaxti í Verðskrá',
    'Bíldshöfði 9': 'merkt í Kröfu yfirliti (draftinv)',
    'Hvaleyrarbraut 3': 'enginn greiðandi',
    'Dalvegur 30': 'gata-/Ajour-verk',
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
  assert.equal(ut.stofnud, 3);

  const skrif = kall.filter((k) => k.method !== 'GET');
  const iMinni = skrif.findIndex((k) => k.url.includes('/app_kv'));
  const iDrog = skrif.findIndex((k) => k.method === 'POST' && k.url.includes('/invoice_drafts'));
  assert.ok(iMinni >= 0 && iDrog > iMinni, 'app_kv-minnið á undan innsetningunni');
  assert.deepEqual([...h.minni].sort(), ['Fjallaböðin Þjórsárdal|2026-11', 'Grensásvegur 1|2026-11', 'Orkureitur|2026-11', 'Skjólbraut 3|2026-11']);

  const ins = innsetningar(kall);
  assert.equal(ins.length, 3);
  for (const k of ins) {
    assert.equal(new URL(k.url).searchParams.get('on_conflict'), 'worksite_name,work_month');
    assert.match(k.prefer, /resolution=ignore-duplicates/);
    assert.ok(Number.isInteger(k.body.total_m_vsk) && Number.isInteger(k.body.net_an_vsk), 'heilar krónur');
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
  const gr = ins.find((k) => k.body.worksite_name === 'Grensásvegur 1').body;
  assert.equal(gr.stadfesting, 20000, 'staðfesting eftir reglu ritilsins (GR_STADF), ekki stadfesting_amount');
  assert.equal(gr.hours_eftirvinna, 0, 'þröskuldur í Verðskrá án samnings → engin yfirvinna');
  assert.equal(ins.find((k) => k.body.worksite_name === 'Skjólbraut 3').body.stadfesting, 20000, 'stadfesting_default true → 20.000');

  // Uppfærsluáfanginn sér nýju drögin en breytir þeim ekki (Δ = 0); aðeins Skúlagata er PATCH-uð
  assert.equal(uppfLina(ut, FJ).obreytt, true);
  const patch = skrif.filter((k) => k.method === 'PATCH');
  assert.equal(patch.length, 1);
  assert.equal(new URL(patch[0].url).searchParams.get('id'), 'eq.11');
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
  assert.equal(innsetningar(kall).length, 0);
});

test('árekstur: manneskja vistaði sömu drög á undan → stofnun sleppt, reitir hennar standa, áfangi 1 tekur við', async () => {
  const h = heimur();
  const kall = stub(h, { arekstur: new Set([FJ]) });
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.equal(stofnLina(ut, FJ).sleppt, 'drög urðu til á sama tíma — stofnun sleppt');
  assert.equal(stofnLina(ut, FJ).stofnad, undefined);
  assert.equal(ut.stofnud, 2, 'hin verkin stofnast áfram');
  const hennar = h.drafts.find((d) => d.id === 777);
  assert.equal(hennar.customer_name, 'Manneskja ehf.'); assert.equal(hennar.notes, 'vistað af manneskju');
  // Áfangi 1 fer með drögin eins og öll önnur drög líðandi mánaðar (hönnunin 14.10): tímarnir fylgja Tímaveru
  const patch = kall.find((k) => k.method === 'PATCH' && new URL(k.url).searchParams.get('id') === 'eq.777');
  assert.ok(patch, 'drög manneskjunnar uppfærð úr Tímaveru');
  assert.deepEqual(Object.keys(patch.body).filter((k) => /customer|notes|kennitala|tilvisun/.test(k)), [], 'PATCH snertir aðeins tíma og upphæðir');
  assert.ok(h.minni.includes(`${FJ}|2026-11`), 'minnið heldur lyklinum — drögin eru til');
});

test('innsetning bregst: ekki „stofnað", lykillinn úr minninu, næsta keyrsla stofnar', async () => {
  const h = heimur();
  stub(h, { insertBilar: new Set([FJ]) });
  const ut = await D.keyra({ dry: false, now: NOV });
  const l = stofnLina(ut, FJ);
  assert.equal(l.stofnad, undefined, 'ekki merkt stofnað');
  assert.match(l.villa, /invoice_drafts INSERT: 500/);
  assert.ok(ut.villur >= 1);
  assert.ok(!h.minni.includes(`${FJ}|2026-11`), 'lykillinn tekinn úr minninu aftur');
  assert.ok(h.minni.includes('Grensásvegur 1|2026-11'), 'hin verkin í minninu');
  assert.ok(!h.drafts.some((d) => d.worksite_name === FJ && d.work_month === '2026-11'));
  const kall = stub(h);
  const ut2 = await D.keyra({ dry: false, now: NOV });
  assert.equal(stofnLina(ut2, FJ).stofnad, true, 'næsta keyrsla stofnar');
  assert.equal(innsetningar(kall).length, 1);
});

test('minnisskrif bregst einu sinni: engin drög fyrir það verk og mánuðurinn ekki lokaður', async () => {
  const h = heimur();
  const kall = stub(h, { kvBilar: (n) => n === 1 });   // fyrsta app_kv-skrifið (Fjallaböðin, fyrst í stafrófsröð) bregst
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.match(stofnLina(ut, FJ).villa, /app_kv drog_timar_stofnud: 503/);
  assert.ok(!innsetningar(kall).some((k) => k.body.worksite_name === FJ), 'engin innsetning án minnis');
  assert.ok(!h.minni.includes(`${FJ}|2026-11`), 'lykillinn barst ekki í minnið með næsta verki');
  assert.ok(h.minni.includes('Grensásvegur 1|2026-11'));
});

test('bakgrunnsfallið skráir stofnuð drög OG villur í automation_runs', async (t) => {
  mock.timers.enable({ apis: ['Date'], now: NOV });
  t.after(() => mock.timers.reset());
  const B = require('../netlify/functions/drog-timar-background.js');
  const h = heimur();
  const kall = stub(h, { insertBilar: new Set(['Grensásvegur 1']) });
  const r = await B.handler({});
  assert.equal(r.statusCode, 200);
  const run = kall.find((k) => k.method === 'POST' && k.url.includes('/automation_runs'));
  assert.ok(run, 'automation_runs skráð');
  assert.equal(run.body.status, 'error');
  assert.match(run.body.detail, /^2 drög stofnuð/);
  assert.match(run.body.detail, /＋ Fjallaböðin Þjórsárdal 2026-11 23 klst → 305\.598 kr \(JÁVERK ehf\.\)/);
  assert.match(run.body.detail, /✗ Grensásvegur 1 2026-11: invoice_drafts INSERT: 500/);
  assert.doesNotMatch(run.body.detail, /＋ Grensásvegur/, 'misheppnuð drög eru ekki talin stofnuð');
});

test('yfirvinna_samningur: drög sem bera ev = 0 fá yfirvinnuna þegar hún kemur', async () => {
  const h = heimur();
  h.drafts.push(drag(20, FJ, '2026-11', { hours_dagvinna: 16, hours_eftirvinna: 0, timavera_klst_vid_vistun: 16, rate_dagvinna: 9300, rate_eftirvinna: 13950, smahlutagjald: 0 }));
  const kall = stub(h);
  const ut = await D.keyra({ dry: false, now: NOV });
  const lina = uppfLina(ut, FJ);
  assert.equal(lina.delta, 7);
  assert.equal(lina.dv, 16); assert.equal(lina.ev, 7);
  assert.equal(kall.find((k) => k.method === 'PATCH' && k.url.includes('id=eq.20')).body.hours_eftirvinna, 7);
});

test('þröskuldur 8 í Verðskrá ÁN samnings: hrein drög fá enga yfirvinnu (Viðskiptavinir-glugginn skrifar 8 sjálfgefið)', async () => {
  const h = heimur();
  h.pricing.find((p) => p.worksite_name === 'Skúlagata 26').eftirvinna_threshold_per_day = 8;
  h.entries.push(faersla('2026-11-07', 'Anna', 'Skúlagata 26', 5));   // laugardagur — tímabókin kallar það yfirvinnu
  const kall = stub(h);
  const ut = await D.keyra({ dry: false, now: NOV });
  const lina = uppfLina(ut, 'Skúlagata 26');
  assert.equal(lina.dv, 21); assert.equal(lina.ev, 0);
  assert.equal(kall.find((k) => k.method === 'PATCH' && k.url.includes('id=eq.11')).body.hours_eftirvinna, 0);
});

test('fyrstu 3 dagar mánaðar: drög aðeins stofnuð fyrir líðandi mánuð, fyrri mánuður aðeins uppfærður', async () => {
  const h = heimur();
  const kall = stub(h);
  const ut = await D.keyra({ dry: true, now: new Date('2026-12-02T08:00:00Z') });
  assert.deepEqual(ut.manudir, ['2026-12', '2026-11']);
  const manadarlestur = kall.filter((k) => new URL(k.url).searchParams.get('select') === 'project,hours');
  assert.equal(manadarlestur.length, 1);
  assert.deepEqual(new URL(manadarlestur[0].url).searchParams.getAll('date'), ['gte.2026-12-01', 'lt.2027-01-01']);
  assert.equal(ut.stofnun.filter((l) => l.m === '2026-11').length, 0, 'nóvember-drög eru ALDREI stofnuð í desember');
  assert.equal(uppfLina(ut, 'Skúlagata 26').delta, 6, 'nóvember-drög sem eru til uppfærast áfram');
});

test('síðuskiptur lestur ber einkvæma röðun (order=id.asc)', async () => {
  const h = heimur();
  const kall = stub(h);
  await D.keyra({ dry: true, now: NOV });
  for (const tafla of ['invoices', 'invoice_drafts', 'timavera_entries']) {
    const k = kall.find((x) => x.url.includes(`/${tafla}?`) && x.url.includes('select=') && !x.url.includes('select=*') && !x.url.includes('project=in'));
    assert.equal(new URL(k.url).searchParams.get('order'), 'id.asc', tafla);
  }
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

test('starfsmanna-hlið: með HUB_STAFF_PASSWORD fá GET og POST 401 án innskráningar og grunnurinn er ekki snertur', async () => {
  const slod = require.resolve('../netlify/functions/drog-timar.js');
  const portal = require.resolve('../netlify/functions/_portal.js');
  const gomul = [require.cache[slod], require.cache[portal]];
  delete require.cache[slod]; delete require.cache[portal];
  process.env.HUB_STAFF_PASSWORD = 'prof-lykilord';
  try {
    const D2 = require(slod);
    const kall = stub(heimur());
    for (const httpMethod of ['GET', 'POST']) {
      const r = await D2.handler({ httpMethod, queryStringParameters: {}, headers: {} });
      assert.equal(r.statusCode, 401, httpMethod);
    }
    assert.equal(kall.length, 0, 'ekkert kall á grunninn');
  } finally {
    delete process.env.HUB_STAFF_PASSWORD;
    delete require.cache[slod]; delete require.cache[portal];
    if (gomul[0]) require.cache[slod] = gomul[0];
    if (gomul[1]) require.cache[portal] = gomul[1];
  }
});

test('timabok: verkheiti með & og " finnur færslurnar sínar (in-listinn er kóðaður)', async () => {
  const h = heimur();
  const ws = 'Gjáhella 5 bil 107 & 110 "B"';
  h.entries.push(faersla('2026-11-09', 'Jón', ws, 7), faersla('2026-11-10', 'Jón', ws, 2));
  const kall = stub(h);
  const r = await T.handler({ httpMethod: 'GET', queryStringParameters: { worksite: ws, month: '2026-11' } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(JSON.parse(r.body).totals.hours, 9);
  const tb = kall.find((k) => new URL(k.url).searchParams.has('project'));
  assert.equal(new URL(tb.url).searchParams.get('order'), 'date.asc,employee.asc,id.asc', 'einkvæm röðun við síðuskipti');
});

test('lestur áfanga 1 bregst: keyrslan skilar samt stofnuðu drögunum og villunni (ekkert kast)', async () => {
  const h = heimur();
  stub(h, { fasi1Bilar: true });
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.equal(ut.stofnud, 3);
  assert.equal(stofnLina(ut, FJ).stofnad, true);
  assert.match(ut.linur[0].villa, /^uppfærsla: invoice_drafts: 504/);
  assert.equal(ut.villur, 1);
});

test('in-listinn á krofur_yfirlit_meta er bútaður (≤ 40 lyklar í kalli) og nær yfir alla lykla', async () => {
  const h = heimur();
  for (let i = 1; i <= 30; i++) h.entries.push(faersla('2026-11-12', 'Óli', `Verk ${i}`, 2));
  const kall = stub(h);
  await D.keyra({ dry: true, now: NOV });
  const metaKoll = kall.filter((k) => new URL(k.url).pathname.endsWith('/krofur_yfirlit_meta') && new URL(k.url).searchParams.get('select') === 'inv_key,hidden');
  const lyklar = metaKoll.flatMap((k) => inGildi(k.url, 'inv_key'));
  assert.ok(metaKoll.length >= 2, 'fleiri en eitt kall');
  for (const k of metaKoll) assert.ok(inGildi(k.url, 'inv_key').length <= 40);
  assert.equal(new Set(lyklar).size, lyklar.length, 'enginn lykill tvisvar');
  assert.ok(lyklar.includes('timavera|Verk 30|2026-11') && lyklar.includes(`draftinv|${FJ}|2026-11`));
});

test('innsetning SÍÐASTA verksins bregst: minnið hreinsað þótt ekkert verk komi á eftir', async () => {
  const h = heimur();
  stub(h, { insertBilar: new Set(['Skjólbraut 3']) });   // síðast í stafrófsröð þeirra sem stofnast
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.match(stofnLina(ut, 'Skjólbraut 3').villa, /invoice_drafts INSERT: 500/);
  assert.ok(!h.minni.includes('Skjólbraut 3|2026-11'), 'lykillinn tekinn úr minninu');
  assert.ok(h.minni.includes(`${FJ}|2026-11`));
});

test('minnislestur bregst: ENGIN stofnun (eydd drög mega ekki lifna), en uppfærslan heldur áfram', async () => {
  const h = heimur();
  const kall = stub(h, { kvLesturBilar: true });
  const ut = await D.keyra({ dry: false, now: NOV });
  assert.equal(innsetningar(kall).length, 0, 'engin innsetning án minnis');
  assert.equal(ut.stofnud, 0);
  assert.match(ut.stofnun[0].villa, /^stofnun sleppt — minnið \(app_kv\) náðist ekki að lesa/);
  assert.equal(ut.villur, 1);
  assert.equal(uppfLina(ut, 'Skúlagata 26').delta, 6, 'áfangi 1 keyrir samt');
  assert.ok(kall.some((k) => k.method === 'PATCH'));
});

test('áfangi 1, drög verks UTAN Verðskrár: engin yfirvinna nema drögin beri hana', async () => {
  const h = heimur();
  h.drafts.push(drag(30, 'Tindasel', '2026-11', { hours_dagvinna: 20, hours_eftirvinna: 0, timavera_klst_vid_vistun: 20 }));
  const kall = stub(h);
  const ut = await D.keyra({ dry: false, now: NOV });
  const lina = uppfLina(ut, 'Tindasel');
  assert.equal(lina.dv, 30); assert.equal(lina.ev, 0);   // 30 klst á einum degi: tímabókin segir 22 ev, en enginn samningur
  assert.equal(kall.find((k) => k.method === 'PATCH' && k.url.includes('id=eq.30')).body.hours_eftirvinna, 0);
});
