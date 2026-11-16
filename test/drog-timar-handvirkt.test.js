// Próf: drog-timar.stofnaHandvirkt — „＋ Stofna drög" / „🔗 Sameina" á Tími eftir-röðum í Kröfu yfirliti (16.11.2026).
// Stub-fetch hermir PostgREST; ekkert fer í lifandi grunn.
'use strict';
process.env.SUPABASE_URL = 'http://stub.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../netlify/functions/drog-timar.js');
const ID = require('../netlify/functions/invoice-drafts.js');

const TS = 'Tindasel The farm';
let nId = 0;
const f = (date, employee, project, hours) => ({ id: ++nId, date, time_in: '08:00', time_out: '', hours, employee, project });

function heimur() {
  return {
    pricing: [
      { worksite_name: TS, source: 'timavera', dagvinna_rate: 10951, eftirvinna_rate: 16427, smahlutagjald_per_h: null, eftirvinna_leyfid: false,
        yfirvinna_samningur: false, stadfesting_default: false, vsk_pct: 24, fixed_amount: null, customer_name: 'Deluxe Lodges ehf.', kennitala: '680923-0510', heimilisfang: 'Vesturvör 30B' },
      { worksite_name: 'Fjallaböðin', source: 'timavera', dagvinna_rate: 9300, eftirvinna_rate: 13950, smahlutagjald_per_h: 0, eftirvinna_leyfid: true,
        yfirvinna_samningur: true, stadfesting_default: false, vsk_pct: 24, fixed_amount: null, customer_name: 'JÁVERK ehf.', kennitala: '701292-4809' },
      { worksite_name: 'Heklu reitur', source: 'ajour', customer_name: 'Laugavegur ehf.' },
      { worksite_name: 'Fastverk 1', source: 'timavera', dagvinna_rate: 9951, fixed_amount: 500000, customer_name: 'Fast ehf.' },
    ],
    cwmap: [{ customer_name: 'Deluxe Lodges ehf.', worksite_name: TS, kt_greidanda: '680923-0510', confidence: 'manual', tilvisun: null, retention_pct: null }],
    invoices: [], aliases: [], minni: ['Annað|2026-01'],
    drafts: [
      // Verk utan Verðskrár sem á eldri send drög á 10.951 → „sendur reikningur er verðið".
      { id: 5, worksite_name: 'Egilsgata14', work_month: '2026-08', status: 'invoiced', rate_dagvinna: 10951, rate_eftirvinna: 16467, customer_name: 'Egilsgata 14, húsfélag', kennitala: '690822-0240', heimilisfang: 'Egilsgötu 14', netfang: 'hus@egils.is', tilvisun: null, fixed_total: null },
    ],
    entries: [
      // Tindasel okt: 2 dagar, einn yfir 8 klst (8,5) → tímabók segir 0,5 yfirvinnu, en Verðskrá leyfir hana ekki.
      f('2026-10-29', 'marius', TS, 8.5), f('2026-10-30', 'marius', TS, 8),
      // Tindasel nóv: 3 dagar
      f('2026-11-02', 'kamara', TS, 8), f('2026-11-03', 'kamara', TS, 9), f('2026-11-04', 'kamara', TS, 4),
      // Fjallaböðin nóv: 10 klst einn dag → 8 dv + 2 ev (samningsbundin)
      f('2026-11-02', 'gunnar', 'Fjallaböðin', 10),
      // Egilsgata14 okt: utan Verðskrár
      f('2026-10-05', 'jon', 'Egilsgata14', 6),
      // Splunkunýtt verk: hvorki Verðskrá né eldri drög
      f('2026-10-06', 'jon', 'Nýverk 9', 5),
    ],
  };
}

function stub(h) {
  const kall = [];
  const svar = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  global.fetch = async (url, o = {}) => {
    url = String(url); const method = o.method || 'GET'; const body = o.body ? JSON.parse(o.body) : null;
    const u = new URL(url); const tafla = decodeURIComponent(u.pathname.replace('/rest/v1/', ''));
    kall.push({ method, tafla, body, prefer: (o.headers || {}).Prefer || '' });
    const eq = (k) => { const v = u.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
    if (method === 'POST' && tafla === 'app_kv') { h.minni = body.value; return svar(null); }
    if (method === 'POST' && tafla === 'invoice_drafts') {
      if (h.drafts.some((d) => d.worksite_name === body.worksite_name && d.work_month === body.work_month)) return svar([]);   // ignore-duplicates
      const rod = Object.assign({ id: 1000 + h.drafts.length }, body); h.drafts.push(rod); return svar([rod]);
    }
    if (method !== 'GET') throw new Error('óvænt kall ' + method + ' ' + tafla);
    if (tafla === 'pricing_guide') return svar(h.pricing);
    if (tafla === 'customer_worksite_map') return svar(h.cwmap);
    if (tafla === 'invoices') return svar(h.invoices);
    if (tafla === 'project_aliases') return svar(h.aliases);
    if (tafla === 'app_kv') return svar([{ value: h.minni }]);
    if (tafla === 'invoice_drafts') {
      const ws = eq('worksite_name'), wm = eq('work_month');
      return svar(h.drafts.filter((d) => (!ws || d.worksite_name === ws) && (!wm || d.work_month === wm)).sort((a, b) => String(b.work_month).localeCompare(String(a.work_month))));
    }
    if (tafla === 'timavera_entries') {
      const d = u.searchParams.getAll('date'); const fra = d.find((x) => x.startsWith('gte.')).slice(4), til = d.find((x) => x.startsWith('lt.')).slice(3);
      const nofn = [...(u.searchParams.get('project') || '').matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
      return svar(h.entries.filter((e) => e.date >= fra && e.date < til && nofn.includes(e.project)));
    }
    throw new Error('óþekkt slóð ' + tafla);
  };
  return kall;
}

test('Tindasel okt + nóv: tvö drög á Verðskrártaxta, engin yfirvinna (ekki leyfð), greiðandi og minni', async () => {
  const h = heimur(); const kall = stub(h);
  const ut = await D.stofnaHandvirkt({ worksite: TS, months: ['2026-11', '2026-10'], by: 'Agnar' });
  assert.equal(ut.ok, true);
  assert.deepEqual(ut.stofnud.map((s) => s.m), ['2026-10', '2026-11']);
  const okt = h.drafts.find((d) => d.worksite_name === TS && d.work_month === '2026-10');
  assert.equal(okt.hours_dagvinna, 16.5); assert.equal(okt.hours_eftirvinna, 0);          // 0,5 yfirvinna tímabókar fer í dagvinnu
  assert.equal(okt.rate_dagvinna, 10951); assert.equal(okt.stadfesting, 0);
  assert.equal(okt.smahlutagjald, Math.round(137 * 16.5));
  const net = Math.round(10951 * 16.5 + Math.round(137 * 16.5));
  assert.equal(okt.net_an_vsk, net); assert.equal(okt.total_m_vsk, net + Math.round(net * 0.24));
  assert.equal(okt.customer_name, 'Deluxe Lodges ehf.'); assert.equal(okt.kennitala, '680923-0510');
  assert.equal(okt.status, 'draft'); assert.equal(okt.source, 'timavera'); assert.equal(okt.timavera_klst_vid_vistun, 16.5);
  assert.match(okt.updated_by, /Agnar · stofnað í Kröfu yfirliti/);
  assert.equal(ut.taxti_ur, 'verdskra');
  assert.ok(h.minni.includes(TS + '|2026-10') && h.minni.includes(TS + '|2026-11') && h.minni.includes('Annað|2026-01'), 'minnið bætir við, eyðir engu');
  assert.ok(kall.filter((k) => k.method === 'POST' && k.tafla === 'invoice_drafts').every((k) => /ignore-duplicates/.test(k.prefer)), 'aldrei merge-duplicates');
});

test('mánuður sem á drög fyrir er ekki snertur — skilað sem `til`', async () => {
  const h = heimur(); h.drafts.push({ id: 77, worksite_name: TS, work_month: '2026-11', status: 'draft', rate_dagvinna: 10951, total_m_vsk: 999 }); stub(h);
  const ut = await D.stofnaHandvirkt({ worksite: TS, months: ['2026-10', '2026-11'] });
  assert.deepEqual(ut.stofnud.map((s) => s.m), ['2026-10']);
  assert.deepEqual(ut.til.map((s) => [s.m, s.id]), [['2026-11', 77]]);
  assert.equal(h.drafts.find((d) => d.id === 77).total_m_vsk, 999);
});

test('samningsbundin yfirvinna (Fjallaböðin) skiptist; smáhlutagjald 0 virt', async () => {
  const h = heimur(); stub(h);
  const ut = await D.stofnaHandvirkt({ worksite: 'Fjallaböðin', months: ['2026-11'] });
  const d = h.drafts.find((x) => x.worksite_name === 'Fjallaböðin');
  assert.equal(d.hours_dagvinna, 8); assert.equal(d.hours_eftirvinna, 2); assert.equal(d.smahlutagjald, 0);
  assert.equal(d.net_an_vsk, 9300 * 8 + 13950 * 2); assert.equal(ut.stofnud[0].total, d.total_m_vsk);
});

test('verk utan Verðskrár: taxti, greiðandi og netfang úr síðustu sendu drögum; staðfesting eftir reglu ritilsins', async () => {
  const h = heimur(); stub(h);
  const ut = await D.stofnaHandvirkt({ worksite: 'Egilsgata14', months: ['2026-10'] });
  const d = h.drafts.find((x) => x.worksite_name === 'Egilsgata14' && x.work_month === '2026-10');
  assert.equal(ut.taxti_ur, 'fyrri_drog'); assert.equal(d.rate_dagvinna, 10951); assert.equal(d.rate_eftirvinna, 16467);
  assert.equal(d.customer_name, 'Egilsgata 14, húsfélag'); assert.equal(d.kennitala, '690822-0240'); assert.equal(d.netfang, 'hus@egils.is');
  assert.equal(d.stadfesting, 20000);
  assert.equal(d.net_an_vsk, Math.round(10951 * 6 + Math.round(137 * 6) + 20000));
});

test('splunkunýtt verk: sjálfgefinn taxti merktur, drög stofnuð án greiðanda (alltaf leyfa vistun)', async () => {
  const h = heimur(); stub(h);
  const ut = await D.stofnaHandvirkt({ worksite: 'Nýverk 9', months: ['2026-10'] });
  assert.equal(ut.taxti_ur, 'sjalfgefinn'); assert.equal(ut.greidandi, null); assert.equal(ut.stofnud.length, 1);
  assert.equal(h.drafts.find((x) => x.worksite_name === 'Nýverk 9').rate_dagvinna, 9951);
});

test('gata-verk, fast verð, engir tímar og vöntun á viðföngum: ekkert stofnað', async () => {
  const h = heimur(); const kall = stub(h);
  assert.equal((await D.stofnaHandvirkt({ worksite: 'Heklu reitur', months: ['2026-11'] })).status, 409);
  assert.equal((await D.stofnaHandvirkt({ worksite: 'Fastverk 1', months: ['2026-11'] })).status, 409);
  assert.equal((await D.stofnaHandvirkt({ worksite: TS, months: ['rugl'] })).status, 400);
  const tomt = await D.stofnaHandvirkt({ worksite: TS, months: ['2026-07'] });
  assert.deepEqual(tomt.stofnud, []); assert.equal(tomt.sleppt[0].astaeda, 'engir tímar í Tímaveru');
  assert.equal(kall.filter((k) => k.method === 'POST').length, 0, 'engin skrif');
});

test('/api/invoice-drafts action stofna_ur_timaveru skilar sömu niðurstöðu og 4xx sem villu', async () => {
  const h = heimur(); stub(h);
  const ok = await ID.handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'stofna_ur_timaveru', worksite_name: TS, months: ['2026-10'], updated_by: 'kröfuyfirlit' }) });
  assert.equal(ok.statusCode, 200); assert.equal(JSON.parse(ok.body).stofnud.length, 1);
  const nei = await ID.handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'stofna_ur_timaveru', worksite_name: 'Heklu reitur', months: ['2026-11'] }) });
  assert.equal(nei.statusCode, 409); assert.match(JSON.parse(nei.body).error, /götum/);
});
