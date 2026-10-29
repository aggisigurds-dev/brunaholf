// Próf fyrir netlify/functions/_ktvorn.js — keyrt með `node --test test/ktvorn.test.js` (gervi-PostgREST, ekkert fer í lifandi grunn).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../netlify/functions/_ktvorn.js');

const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');

// Gervi-PostgREST sem hermir kveikjurnar sem skipta máli: kt_normalize (bandstrik), einkvæmi vísirinn
// (kt, stadur_nr) yfir ALLAR raðir (líka eyddar) og trg_stadur_nr_sjalfvirkt (nr = hæsta+1 þegar kt á þegar röð).
function gervi(seed, opts) {
  opts = opts || {};
  const db = { fyrirtaeki: (seed || []).map((r) => Object.assign({ deleted_at: null, er_i_thjonustu: false, stadur_nr: null, kennitala: null, heimilisfang: null, simi: null, netfang: null, customer_base_id: null }, r)), nextId: 2000, log: [], failGet: 0, failPost: 0, conflictOn: [] };
  const fetchFn = async (url, init) => {
    init = init || {};
    const u = new URL(url);
    const method = init.method || 'GET';
    const table = u.pathname.split('/').pop();
    db.log.push({ method, path: u.pathname.split('/rest/v1/')[1] + u.search });
    const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
    if (table !== 'fyrirtaeki') return reply(404, { message: 'tafla vantar' });
    const q = u.searchParams;
    const match = (r) => {
      if (q.get('deleted_at') === 'is.null' && r.deleted_at != null) return false;
      const or = q.get('or');
      if (or) {
        const parts = or.replace(/^\(|\)$/g, '').split(',').map((p) => p.replace(/^kennitala\.eq\./, ''));
        if (!parts.includes(r.kennitala)) return false;   // dálkurinn geymir BANDSTRIK — hrein tala ein og sér finnur ekkert
      }
      const cb = q.get('customer_base_id'); if (cb && cb !== 'eq.' + r.customer_base_id) return false;
      const id = q.get('id'); if (id && id !== 'eq.' + r.id) return false;
      return true;
    };
    if (method === 'GET') {
      if (db.failGet > 0) { db.failGet--; return reply(500, { message: 'timeout (gervi)' }); }
      return reply(200, db.fyrirtaeki.filter(match).sort((a, b) => a.id - b.id));
    }
    const body = init.body ? JSON.parse(init.body) : null;
    if (method === 'POST') {
      if (db.failPost > 0) { db.failPost--; return reply(500, { message: 'POST hafnað (gervi)' }); }
      const p = Object.assign({ deleted_at: null, er_i_thjonustu: false, stadur_nr: null, kennitala: null, heimilisfang: null, simi: null, netfang: null, customer_base_id: null }, Array.isArray(body) ? body[0] : body);
      if (p.kennitala) p.kennitala = K.dashKt(p.kennitala) || p.kennitala;
      const kd = digits(p.kennitala);
      if (db.conflictOn.includes(p.stadur_nr)) { db.conflictOn.splice(db.conflictOn.indexOf(p.stadur_nr), 1); return reply(409, { code: '23505', message: 'duplicate key value violates unique constraint "fyrirtaeki_kt_stadur_nr_uniq"' }); }
      if (p.stadur_nr != null && db.fyrirtaeki.some((r) => digits(r.kennitala) === kd && r.stadur_nr === p.stadur_nr)) return reply(409, { code: '23505', message: 'duplicate key' });
      if (p.stadur_nr == null && kd.length === 10) { const sam = db.fyrirtaeki.filter((r) => digits(r.kennitala) === kd); if (sam.length) p.stadur_nr = sam.reduce((m, r) => Math.max(m, r.stadur_nr || 0), 0) + 1; }
      p.id = db.nextId++;
      db.fyrirtaeki.push(p);
      return reply(201, [p]);
    }
    if (method === 'PATCH') {
      const hit = db.fyrirtaeki.filter(match);
      hit.forEach((r) => Object.assign(r, body));
      return reply(200, hit);
    }
    return reply(405, { message: 'aðgerð ekki studd' });
  };
  return { db, sb: K.makeSb(fetchFn, 'https://x.supabase.co', 'k') };
}
const posts = (g) => g.db.log.filter((l) => l.method === 'POST');

const KROKUR = () => [{ id: 1895, nafn: 'Krókur 77 ehf.', kennitala: '490517-1620', heimilisfang: 'Suðurlandsbraut Suðurlandsbraut 44, 108 Reykjavík', tengiliður: 'Logi', simi: '8234274', er_i_thjonustu: false, stadur_nr: null, customer_base_id: 1238 }];
const PIZZAN = () => [
  { id: 317, nafn: 'Pizzan - Fjarðargata', kennitala: '681016-1200', heimilisfang: 'Fjarðargötu 11, 220 Hafnarfirði', er_i_thjonustu: true, stadur_nr: 1, customer_base_id: 77 },
  { id: 615, nafn: 'Pizzan - Hringbraut', kennitala: '681016-1200', heimilisfang: 'Hringbraut 119, 101 Reykjavík', er_i_thjonustu: true, stadur_nr: 2, customer_base_id: 77 },
  { id: 999, nafn: 'Pizzan - Eydd', kennitala: '681016-1200', heimilisfang: 'Gamla 1', er_i_thjonustu: false, stadur_nr: 9, customer_base_id: 77, deleted_at: '2026-01-01' },
];

// ── hjálparföll ─────────────────────────────────────────────────────────────
test('normKt / dashKt / ktOr: bæði snið, ógild kt gefur tómt', () => {
  assert.equal(K.normKt('490517-1620'), '4905171620');
  assert.equal(K.dashKt('4905171620'), '490517-1620');
  assert.equal(K.normKt('12345'), '');
  assert.equal(K.dashKt(''), '');
  assert.equal(K.ktOr('4905171620'), 'kennitala.eq.490517-1620,kennitala.eq.4905171620');
});
test('normNafn: lágstafir, bil samþjöppuð, punktar felldir', () => {
  assert.equal(K.normNafn('  Krókur   77 EHF. '), 'krókur 77 ehf');
  assert.equal(K.normNafn(null), '');
});
test('samaHeimili: gata+númer, þágufall, bókstafur og póstsvæði', () => {
  assert.equal(K.samaHeimili('Hjallahrauni 4, 220 Hafnarfirði', 'Hjallahraun 4'), true);          // þágufall
  assert.equal(K.samaHeimili('Strandgötu 75, 220', 'Strandgata 75, 220 Hafnarfjörður'), true);
  assert.equal(K.samaHeimili('Bríetartún 9-11, 105', 'Bríetartún 9, 105 Reykjavík'), true);        // bil í númeri
  assert.equal(K.samaHeimili('Suðurvangi 23a, 220', 'Suðurvangi 23b, 220'), false);                // ólíkur bókstafur
  assert.equal(K.samaHeimili('Suðurlandsbraut Suðurlandsbraut 44, 108', 'Suðurlandsbraut 4, 108'), false); // annað númer
  assert.equal(K.samaHeimili('Strandgata 75, 220 Hafnarfjörður', 'Strandgata 75, 600 Akureyri'), false);   // annað póstsvæði
  assert.equal(K.samaHeimili('Hamraborg 7, 201', 'Hamrahlíð 7, 201'), false);                        // önnur gata
  assert.equal(K.samaHeimili('', 'Hringbraut 119'), false);
  assert.equal(K.samaHeimili('Hringbraut', 'Hringbraut'), false);                                    // ekkert númer = ekki nóg
});
test('naestaNr: max(hæsta, fjöldi)+1; engin röð = ekkert númer', () => {
  assert.equal(K.naestaNr([]), null);
  assert.equal(K.naestaNr([{ stadur_nr: null }]), 2);                       // ∅ ⇒ 2
  assert.equal(K.naestaNr([{ stadur_nr: 1 }, { stadur_nr: 2 }, { stadur_nr: 3 }]), 4);
  assert.equal(K.naestaNr([{ stadur_nr: null }, { stadur_nr: 9 }]), 10);    // hæsta (líka eydd) ræður
  assert.equal(K.naestaNr([{ stadur_nr: null }, { stadur_nr: null }, { stadur_nr: null }]), 4);
});

// ── leit ────────────────────────────────────────────────────────────────────
test('finnaKt notar or=(DASH,DIGITS) og deleted_at=is.null og finnur röð með bandstriki', async () => {
  const g = gervi(KROKUR());
  const rows = await K.finnaKt(g.sb, '4905171620');                         // hrein tala inn → finnur samt dashed röð
  assert.equal(rows.length, 1);
  const get = g.db.log[0].path;
  assert.match(get, /or=\(kennitala\.eq\.490517-1620,kennitala\.eq\.4905171620\)/);
  assert.match(get, /deleted_at=is\.null/);
});
test('finnaKt: eydd röð telst ekki til leitar', async () => {
  const g = gervi(PIZZAN());
  const rows = await K.finnaKt(g.sb, '681016-1200');
  assert.deepEqual(rows.map((r) => r.id), [317, 615]);
});
test('finnaKt: leitarvilla KASTAR (er aldrei lesin sem „ekkert til")', async () => {
  const g = gervi(KROKUR()); g.db.failGet = 1;
  await assert.rejects(() => K.finnaKt(g.sb, '490517-1620'), /500/);
});
test('finnaStad: leitarvilla → ok:false og engin skrif', async () => {
  const g = gervi(KROKUR()); g.db.failGet = 1;
  const f = await K.finnaStad({ sb: g.sb, kt: '490517-1620', nafn: 'Krókur 77 ehf.' });
  assert.equal(f.ok, false);
  assert.equal(posts(g).length, 0);
});
test('finnaStad: kt vantar og enginn base → ekkert athugað', async () => {
  const g = gervi(KROKUR());
  const f = await K.finnaStad({ sb: g.sb, kt: '', nafn: 'X' });
  assert.deepEqual([f.ok, f.athugad, f.rows.length], [true, false, 0]);
  assert.equal(g.db.log.length, 0);
});
test('finnaStad: lausasala (999999-9999) er ekki athuguð', async () => {
  const g = gervi(KROKUR());
  const f = await K.finnaStad({ sb: g.sb, kt: '999999-9999', nafn: 'X' });
  assert.equal(f.athugad, false);
});
test('finnaStad: base-leit finnur raðir án kt', async () => {
  const g = gervi([{ id: 5, nafn: 'Kt-laus', kennitala: null, heimilisfang: 'Gata 1, 101', customer_base_id: 42 }]);
  const f = await K.finnaStad({ sb: g.sb, kt: null, baseId: 42, nafn: 'Kt-laus' });
  assert.equal(f.sama && f.sama.id, 5);
});

// ── reglan: Krókur-mynstrið ─────────────────────────────────────────────────
test('KRÓKUR: röð 1 (ekki í þjónustu) + ný færsla með sama nafni og kt → röðin sem er til, ENGIN ný röð', async () => {
  const g = gervi(KROKUR());
  const r = await K.faTilStad({ sb: g.sb, kt: '490517-1620', thjonusta: true, row: { nafn: 'Krókur 77 ehf.', heimilisfang: 'Suðurlandsbraut 4, 108 Reykjavík', simi: '8234274', netfang: 'logi@gufufoss.is' } });
  assert.equal(r.ok, true);
  assert.equal(r.hvernig, 'reuse');
  assert.equal(r.astaeda, 'nafn');
  assert.equal(r.row.id, 1895);
  assert.equal(posts(g).length, 0);
  assert.equal(g.db.fyrirtaeki.length, 1);
  assert.equal(g.db.fyrirtaeki[0].er_i_thjonustu, true);                   // sett í þjónustu
  assert.equal(g.db.fyrirtaeki[0].netfang, 'logi@gufufoss.is');            // auður reitur fylltur
  assert.equal(g.db.fyrirtaeki[0].tengiliður, 'Logi');                     // ósnertur
  assert.match(g.db.fyrirtaeki[0].heimilisfang, /Suðurlandsbraut Suðurlandsbraut 44/);   // heimilisfang yfirskrifað ALDREI (ekki auður reitur)
});
test('sama heimilisfang, annað nafn → röðin sem er til', async () => {
  const g = gervi(PIZZAN());
  const r = await K.faTilStad({ sb: g.sb, kt: '681016-1200', thjonusta: false, row: { nafn: 'Pizzan Hringbraut ehf', heimilisfang: 'Hringbraut 119, 101 Reykjavík' } });
  assert.deepEqual([r.hvernig, r.astaeda, r.row.id], ['reuse', 'heimilisfang', 615]);
  assert.equal(posts(g).length, 0);
});
test('thjonusta=false setur EKKI í þjónustu við endurnýtingu', async () => {
  const g = gervi(KROKUR());
  await K.faTilStad({ sb: g.sb, kt: '490517-1620', thjonusta: false, row: { nafn: 'Krókur 77 ehf.' } });
  assert.equal(g.db.fyrirtaeki[0].er_i_thjonustu, false);
});
test('nýr staður (annað nafn + annað heimilisfang) fær nr = max(mx, fjöldi)+1 — ∅ ⇒ 2', async () => {
  const g = gervi(KROKUR());
  const r = await K.faTilStad({ sb: g.sb, kt: '490517-1620', thjonusta: true, row: { nafn: 'Krókur 77 ehf. - Suðurhella 5', heimilisfang: 'Suðurhella 5, 221 Hafnarfjörður', customer_base_id: 1238 } });
  assert.equal(r.hvernig, 'site');
  assert.equal(r.row.stadur_nr, 2);
  assert.equal(r.row.er_i_thjonustu, true);
  assert.equal(r.row.customer_base_id, 1238);
  assert.equal(r.row.kennitala, '490517-1620');
});
test('nr tekur mið af EYDDUM röðum (einkvæmi vísirinn nær yfir þær): hæsta 9 → 10', async () => {
  const g = gervi(PIZZAN());
  const r = await K.faTilStad({ sb: g.sb, kt: '681016-1200', thjonusta: true, row: { nafn: 'Pizzan - Nýbýlavegur', heimilisfang: 'Nýbýlavegur 6, 200 Kópavogur' } });
  assert.equal(r.row.stadur_nr, 10);
});
test('fyrsta röð á nýrri kt fær ekkert nr (∅) og hvernig=ny', async () => {
  const g = gervi([]);
  const r = await K.faTilStad({ sb: g.sb, kt: '551295-2499', thjonusta: false, row: { nafn: 'Glæný ehf.', heimilisfang: 'Nýgata 1, 105' } });
  assert.deepEqual([r.ok, r.hvernig, r.row.stadur_nr], [true, 'ny', null]);
  assert.equal(g.db.fyrirtaeki[0].kennitala, '551295-2499');
});
test('kt-laus röð fær aldrei stadur_nr (vísirinn deilir lyklinum "" milli allra kt-lausra raða)', async () => {
  const g = gervi([{ id: 5, nafn: 'Kt-laus', kennitala: null, heimilisfang: 'Gata 1, 101', customer_base_id: 42 }]);
  const r = await K.faTilStad({ sb: g.sb, kt: '', baseId: 42, thjonusta: true, row: { nafn: 'Kt-laus staður 2', heimilisfang: 'Önnur 2, 101', customer_base_id: 42 } });
  assert.equal(r.hvernig, 'site');
  assert.equal(r.row.stadur_nr, null);
});
test('23505 (kapphlaup um nr) → reynt aftur með nr+1', async () => {
  const g = gervi(PIZZAN()); g.db.conflictOn = [10];
  const r = await K.faTilStad({ sb: g.sb, kt: '681016-1200', thjonusta: true, row: { nafn: 'Pizzan - Kapp', heimilisfang: 'Kapp 1, 101' } });
  assert.equal(r.ok, true);
  assert.equal(r.row.stadur_nr, 11);
  assert.equal(posts(g).length, 2);
});
test('23505 aftur og aftur → gefst upp eftir 4 tilraunir án þess að kasta', async () => {
  const g = gervi(PIZZAN()); g.db.conflictOn = [10, 11, 12, 13, 14];
  const r = await K.faTilStad({ sb: g.sb, kt: '681016-1200', thjonusta: true, row: { nafn: 'Pizzan - Kapp', heimilisfang: 'Kapp 1, 101' } });
  assert.equal(r.ok, false);
  assert.equal(posts(g).length, 4);
});
test('POST-villa (500) → ok:false, engin ný röð', async () => {
  const g = gervi(PIZZAN()); g.db.failPost = 1;
  const r = await K.faTilStad({ sb: g.sb, kt: '681016-1200', thjonusta: true, row: { nafn: 'Pizzan - X', heimilisfang: 'X 1, 101' } });
  assert.equal(r.ok, false);
  assert.equal(g.db.fyrirtaeki.length, 3);
});
test('leitarvilla í faTilStad → ok:false, EKKERT stofnað (ekki lesið sem „ekkert til")', async () => {
  const g = gervi(KROKUR()); g.db.failGet = 1;
  const r = await K.faTilStad({ sb: g.sb, kt: '490517-1620', thjonusta: true, row: { nafn: 'Krókur 77 ehf.' } });
  assert.equal(r.ok, false);
  assert.match(r.error, /ekkert stofnað/);
  assert.equal(posts(g).length, 0);
});
test('sjálfvirkir innlesarar (nyrStadurLeyfdur=false): kt á þegar röð → engin ný röð, hvernig="til"', async () => {
  const g = gervi(PIZZAN());
  const r = await K.faTilStad({ sb: g.sb, kt: '681016-1200', thjonusta: false, nyrStadurLeyfdur: false, row: { nafn: 'Eitthvað annað nafn úr skjali', heimilisfang: 'Hvergi 1' } });
  assert.deepEqual([r.ok, r.hvernig, r.row.id], [true, 'til', 317]);
  assert.equal(posts(g).length, 0);
});
test('sjálfvirkir innlesarar: ný kt → ný röð eins og áður', async () => {
  const g = gervi(PIZZAN());
  const r = await K.faTilStad({ sb: g.sb, kt: '551295-2499', thjonusta: false, nyrStadurLeyfdur: false, row: { nafn: 'Ný ehf.' } });
  assert.deepEqual([r.ok, r.hvernig], [true, 'ny']);
});
test('endurnýting yfirskrifar aldrei reiti sem eru fylltir', async () => {
  const g = gervi([{ id: 7, nafn: 'Fyllt ehf.', kennitala: '700000-0000', heimilisfang: 'Gamla 1, 101', simi: '1111111', netfang: 'a@b.is', er_i_thjonustu: true }]);
  await K.faTilStad({ sb: g.sb, kt: '700000-0000', thjonusta: true, row: { nafn: 'Fyllt ehf.', heimilisfang: 'Nýja 2, 101', simi: '2222222', netfang: 'c@d.is' } });
  const r = g.db.fyrirtaeki[0];
  assert.deepEqual([r.heimilisfang, r.simi, r.netfang], ['Gamla 1, 101', '1111111', 'a@b.is']);
  assert.equal(g.db.log.filter((l) => l.method === 'PATCH').length, 0);   // ekkert að skrifa → engin skrifbeiðni
});
