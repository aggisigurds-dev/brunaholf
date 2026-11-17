// Lives outside netlify/functions/ on purpose — see nlsh-section-map.test.js.
//
// VÖRÐURINN (_vord.js, Powerplan lota 13, 17.11.2026). Það sem má aldrei bila:
//   1. án innskráningar og án tóka → 401, líka þegar HUB_STAFF_PASSWORD er ekki sett (eins og í loftinu);
//   2. fölsuð, útrunnin eða gömul kaka, óvirkur notandi, rangur eða gamall tóki → 401;
//   3. gild kaka eða gildur tóki (haus EÐA ?_hubtoki=) → fallið keyrir, og _hubtoki berst ekki inn í fallið;
//   4. í LOKUÐUM ham: innskráningarkerfið vantar → 503; gagnagrunnur niðri → 502;
//   5. hamur FAIL-OPEN (17.11 kvöld): náist hamurinn ekki (niðri, hangir, röð vantar, rusl) → hleypt í gegn, ALDREI 401;
//      'lokad' aðeins sannarlega lesið (síðasti gildi lestur helst); 'skraning' og 'opin' hleypa STRAX (athugun í bakgrunni);
//      'lokud' lokar þrátt fyrir skraning; 'af' gerir ekkert;
//   6. eigin föll sem kalla hvert á annað (fetch á /api/…) fá tókann sjálfkrafa; önnur hýsing fær hann ALDREI;
//   7. ÖLL vafin föll svara 401 óinnskráð án þess að keyra (almenna prófið neðst).
// Keyrsla: node --test test/vord.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

process.env.SUPABASE_URL = 'https://x.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
process.env.HUB_VORD_FRESTUR_MS = '200';   // tímaþak varðarins stytt í prófinu (2000 í loftinu)
process.env.HUB_VORD_HAMUR_FRESTUR_MS = '150';   // bið eftir hamnum við kaldræsingu (1200 í loftinu)
delete process.env.HUB_STAFF_PASSWORD;

const LEYND = 'prufuleyndarmal-vord-0123456789';
const PW = '2026-11-01T00:00:00+00:00';
let STILLING, NOTENDUR, HAMUR, LOG, UTKOLL, DB_NIDRI;
function nytt() {
  STILLING = [{ session_secret: LEYND, pw_changed_at: PW }];
  NOTENDUR = { 1: { id: 1, nafn: 'Prufa Stjóri', notandanafn: 'ps', rola: 'Admin', virkur: true },
    2: { id: 2, nafn: 'Prufa Starfs', notandanafn: 'pst', rola: 'Starfsmaður', virkur: true },
    3: { id: 3, nafn: 'Hætt', notandanafn: 'h', rola: 'Starfsmaður', virkur: false } };
  HAMUR = { hamur: 'lokad' }; LOG = []; UTKOLL = []; DB_NIDRI = false; HAMUR_BILAR = false; HAMUR_RUSL = false; HAMUR_HANGIR = false; NOTANDALEIT = 0; STILLINGALEIT = 0;   // prófin ganga út frá þekktum LOKUÐUM ham
}
let HAMUR_BILAR = false, HAMUR_RUSL = false, HAMUR_HANGIR = false, HANGIR = false, NOTANDALEIT = 0, STILLINGALEIT = 0;
const bida = (ms = 30) => new Promise((r) => setTimeout(r, ms));   // bakgrunnsathugun/-skráning klárast
nytt();
const ok = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.startsWith('https://x.test/rest/v1/')) {
    if (HANGIR) return new Promise(() => {});   // Supabase hangir — og hunsar signal
    if (DB_NIDRI) return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
    const p = url.slice('https://x.test/rest/v1/'.length);
    if (p.startsWith('hub_adgangar_stilling')) { STILLINGALEIT++; return ok(STILLING); }
    if (p.startsWith('hub_adgangar?id=eq.')) { NOTANDALEIT++; const id = Number(p.match(/id=eq\.(\d+)/)[1]); return ok(NOTENDUR[id] ? [NOTENDUR[id]] : []); }
    if (p.startsWith('app_kv?key=eq.hub_vord')) {
      if (HAMUR_HANGIR) return new Promise(() => {});
      if (HAMUR_BILAR) return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
      if (HAMUR_RUSL) return { ok: true, status: 200, json: async () => { throw new Error('ekki JSON'); }, text: async () => '<html>rusl</html>' };
      return ok(HAMUR === undefined ? [] : [{ value: HAMUR }]);
    }
    if (p.startsWith('agent_logs')) { LOG.push(JSON.parse(init.body)); return ok([]); }
    return ok([]);
  }
  const h = new Headers(init.headers || {});
  UTKOLL.push({ url, toki: h.get('x-hub-toki') });
  return ok({ url });
};

const V = require('../netlify/functions/_vord');

function kaka(uid, { exp = Math.floor(Date.now() / 1000) + 3600, v = PW, leynd = LEYND } = {}) {
  const gogn = Buffer.from(JSON.stringify({ uid, exp, v })).toString('base64url');
  const sig = crypto.createHmac('sha256', leynd).update(gogn).digest('base64url');
  return 'hub_user=' + encodeURIComponent(gogn + '.' + sig);
}
function toki(minAftur = 0, leynd = LEYND) {
  const m = Math.floor(Date.now() / 60000) - minAftur;
  return m + '.' + crypto.createHmac('sha256', leynd).update('hub-api|' + m).digest('hex');
}
function vafid(st) {
  const kallad = [];
  const h = V.vafinn(async (e) => { kallad.push(e); return { statusCode: 200, body: JSON.stringify({ gogn: true }) }; }, { fall: 'prufufall', ...(st || {}) });
  return { h, kallad };
}
const ev = (o = {}) => ({ httpMethod: 'GET', headers: {}, queryStringParameters: {}, ...o });
const fyrir = (t) => test(t[0], async () => { nytt(); V._endurstilla(); await t[1](); });

fyrir(['án innskráningar → 401 og fallið keyrir ekki (HUB_STAFF_PASSWORD ósett)', async () => {
  const { h, kallad } = vafid();
  const r = await h(ev());
  assert.equal(r.statusCode, 401);
  assert.equal(JSON.parse(r.body).error, 'LOGIN_REQUIRED');
  assert.equal(kallad.length, 0);
  assert.equal(LOG.at(-1).action, 'hafnad');
}]);
fyrir(['gild kaka → fallið keyrir; starfsmaður (ekki Admin) kemst inn', async () => {
  const { h, kallad } = vafid();
  assert.equal((await h(ev({ headers: { cookie: kaka(2) } }))).statusCode, 200);
  assert.equal(kallad.length, 1);
}]);
fyrir(['fölsuð / útrunnin / gömul (lykilorði breytt) kaka og óvirkur notandi → 401', async () => {
  const { h, kallad } = vafid();
  for (const c of [kaka(1, { leynd: 'rangt-leyndarmal-xxxxxxxx' }), kaka(1, { exp: 1000 }), kaka(1, { v: 'gamalt' }), kaka(3), kaka(99), 'hub_user=stutt']) {
    assert.equal((await h(ev({ headers: { cookie: c } }))).statusCode, 401, c.slice(0, 30));
  }
  assert.equal(kallad.length, 0);
}]);
fyrir(['gildur tóki í haus eða ?_hubtoki= → inn; _hubtoki berst ekki inn í fallið', async () => {
  const { h, kallad } = vafid();
  assert.equal((await h(ev({ headers: { 'x-hub-toki': toki() } }))).statusCode, 200);
  const r = await h(ev({ queryStringParameters: { _hubtoki: toki(3), worksite: 'A' }, rawQuery: `_hubtoki=${toki(3)}&worksite=A` }));
  assert.equal(r.statusCode, 200);
  assert.deepEqual(kallad[1].queryStringParameters, { worksite: 'A' });
  assert.equal(kallad[1].rawQuery, 'worksite=A');
  assert.ok(LOG.some(l => l.action === 'inn' && l.output.via === 'toki'));
}]);
fyrir(['rangur, gamall (11 mín) eða framtíðar-tóki → 401', async () => {
  const { h, kallad } = vafid();
  for (const t of [toki(0, 'annad-leyndarmal'), toki(11), toki(-5), '123.abc', 'rusl']) {
    assert.equal((await h(ev({ headers: { 'x-hub-toki': t } }))).statusCode, 401, t);
  }
  assert.equal(kallad.length, 0);
}]);
fyrir(['innskráning ekki sett upp → 503; gagnagrunnur niðri → 502 (aldrei opið)', async () => {
  const { h } = vafid();
  STILLING = [];
  assert.equal((await h(ev({ headers: { cookie: kaka(1) } }))).statusCode, 503);
  // þekktur lokaður hamur, svo fer gagnagrunnurinn niður → lokað (502/503), aldrei opið
  V._endurstilla(); HAMUR = { hamur: 'lokad' }; STILLING = [{ session_secret: LEYND, pw_changed_at: PW }];
  await V.hamurFyrir('prufufall');
  V._rennaUt(); DB_NIDRI = true;
  const r = await h(ev({ headers: { cookie: kaka(1) } }));
  assert.ok([502, 503].includes(r.statusCode), String(r.statusCode));
}]);
fyrir(['hamur: lokad → 401; skraning hleypir í gegn og skráir; opin hleypir; lokud yfirtekur skraning', async () => {
  let { h, kallad } = vafid();
  assert.equal((await h(ev())).statusCode, 401);
  HAMUR = { hamur: 'skraning' }; V._endurstilla();
  assert.equal((await h(ev())).statusCode, 200);
  await bida();
  assert.equal(LOG.at(-1).action, 'myndi_hafna');
  HAMUR = { hamur: 'lokad', opin: ['prufufall'] }; V._endurstilla();
  assert.equal((await h(ev())).statusCode, 200);
  HAMUR = { hamur: 'skraning', lokud: ['prufufall'] }; V._endurstilla();
  assert.equal((await h(ev())).statusCode, 401);
  assert.equal(kallad.length, 2);
}]);
fyrir(['FAIL-OPEN: náist hamurinn ekki við kaldræsingu (niðri / röð vantar / rusl / óþekkt gildi) → fallið keyrir, viðvörun skráð', async () => {
  const tilfelli = [
    ['Supabase svarar 503', () => { HAMUR_BILAR = true; }, 'hamur_olesanlegur'],
    ['Supabase niðri (500 á öllu)', () => { DB_NIDRI = true; }, 'hamur_olesanlegur'],
    ['röð vantar', () => { HAMUR = undefined; }, 'hamur_ogildur'],
    ['rusl (ekki JSON)', () => { HAMUR_RUSL = true; }, 'hamur_olesanlegur'],
    ['gildið er strengur', () => { HAMUR = 'lokad'; }, 'hamur_ogildur'],
    ['gildið er fylki', () => { HAMUR = [1, 2]; }, 'hamur_ogildur'],
    ['óþekktur hamur', () => { HAMUR = { hamur: 'LOKAD!', lokud: ['prufufall'] }; }, 'hamur_ogildur'],
    ['hamur vantar í hlutinn', () => { HAMUR = { lokud: ['prufufall'] }; }, 'hamur_ogildur'],
  ];
  for (const [nafn, stilla, vidv] of tilfelli) {
    nytt(); V._endurstilla(); stilla();
    const { h, kallad } = vafid();
    const r = await h(ev());
    assert.equal(r.statusCode, 200, nafn + ': fallið á að keyra (aldrei 401 af því stillingin náðist ekki)');
    assert.equal(kallad.length, 1, nafn);
    assert.equal(await V.hamurFyrir('prufufall'), 'ovist', nafn);
    await bida();
    if (!DB_NIDRI) assert.ok(LOG.some((l) => l.action === vidv), nafn + ': viðvörun ' + vidv + ' (fékk ' + LOG.map((l) => l.action).join(',') + ')');
  }
}]);
fyrir(['FAIL-OPEN: Supabase HANGIR við kaldræsingu → hleypt innan HAMUR_FRESTUR_MS; lesturinn klárast fyrir næstu beiðni', async () => {
  const { h, kallad } = vafid();
  HAMUR_HANGIR = true;
  const t0 = Date.now();
  assert.equal((await h(ev())).statusCode, 200);
  assert.ok(Date.now() - t0 < V.HAMUR_FRESTUR_MS + V.FRESTUR_MS + 150, 'tafðist ' + (Date.now() - t0) + ' ms');
  assert.equal(kallad.length, 1);
  // önnur beiðni meðan sami lestur hangir enn bíður EKKI aftur heilt þak
  const t1 = Date.now();
  assert.equal((await h(ev())).statusCode, 200);
  assert.ok(Date.now() - t1 < 60, 'önnur beiðni beið ' + (Date.now() - t1) + ' ms');
  // Supabase vaknar: þegar næsta tilraun er leyfð er hamurinn (lokad) lesinn → fyrst þá lokað
  await V._bidaLestur();   // hangandi lesturinn gefst upp (sb-þak) og skráir bilun
  HAMUR_HANGIR = false; V._rennaUt();
  assert.equal((await h(ev())).statusCode, 401, 'sannarlega lesinn lokaður hamur lokar');
}]);
fyrir(['síðasti GILDI hamur helst þegar endurnýjun bregst — lokad helst lokað, skraning helst opin; endurnýjun tefur aldrei', async () => {
  const { h } = vafid();
  assert.equal((await h(ev())).statusCode, 401);   // lesið: lokad
  for (const bilun of [() => { HAMUR_BILAR = true; }, () => { HAMUR = undefined; }, () => { HAMUR_RUSL = true; }, () => { HAMUR = { hamur: 'eitthvað' }; }]) {
    HAMUR_BILAR = false; HAMUR_RUSL = false; HAMUR = { hamur: 'lokad' };
    V._rennaUt(); bilun();
    assert.equal((await h(ev())).statusCode, 401, 'síðasti gildi hamur (lokad) helst');
    await V._bidaLestur();
    assert.equal((await h(ev())).statusCode, 401);
  }
  HAMUR_BILAR = false; HAMUR_RUSL = false; HAMUR = { hamur: 'skraning' }; V._endurstilla();
  assert.equal((await h(ev())).statusCode, 200);
  V._rennaUt(); HAMUR_HANGIR = true;
  const t0 = Date.now();
  assert.equal((await h(ev())).statusCode, 200, 'skraning helst meðan endurnýjun hangir');
  assert.ok(Date.now() - t0 < 100, 'endurnýjun í bakgrunni tafði um ' + (Date.now() - t0) + ' ms');
  HAMUR_HANGIR = false;
}]);
fyrir(['hamur af: ekkert athugað, ekkert skráð, engin innskráningarleit (líka fyrir fall á lokud)', async () => {
  HAMUR = { hamur: 'af', lokud: ['prufufall'] };
  const { h, kallad } = vafid();
  assert.equal((await h(ev())).statusCode, 200);
  await bida();
  assert.equal(kallad.length, 1);
  assert.equal(STILLINGALEIT, 0);
  assert.equal(LOG.length, 0);
}]);
fyrir(['skraning og opin hleypa STRAX þótt innskráningarleitin hangi; myndi_hafna skráð í bakgrunni', async () => {
  for (const ham of [{ hamur: 'skraning' }, { hamur: 'lokad', opin: ['prufufall'] }]) {
    nytt(); V._endurstilla(); HAMUR = ham;
    const { h, kallad } = vafid();
    await V.hamurFyrir('prufufall');
    V._gleymaStillingu(); HANGIR = true;   // hamurinn er kominn; nú hangir Supabase í innskráningarleitinni
    const t0 = Date.now();
    assert.equal((await h(ev())).statusCode, 200);
    assert.ok(Date.now() - t0 < 50, JSON.stringify(ham) + ' tafðist ' + (Date.now() - t0) + ' ms');
    assert.equal(kallad.length, 1);
    HANGIR = false;
  }
  nytt(); V._endurstilla(); HAMUR = { hamur: 'skraning' };
  const { h } = vafid();
  await h(ev());
  await bida();
  assert.equal(LOG.at(-1).action, 'myndi_hafna');
}]);
fyrir(['Supabase HANGIR: skráningarhamur hleypir beint í gegn innan þaks; lokaður hamur → 502 innan þaks; myntun tóka gefst upp', async () => {
  const { h, kallad } = vafid();
  const thak = 5 * V.FRESTUR_MS + V.HAMUR_FRESTUR_MS;   // hamur + innskráning + svigrúm — langt undir 10 s Netlify
  // þekktur skraning, skyndiminni runnið út, Supabase hangir
  HAMUR = { hamur: 'skraning' }; await V.hamurFyrir('prufufall');
  V._rennaUt(); V._gleymaStillingu(); HANGIR = true;
  let t0 = Date.now();
  let r = await h(ev({ headers: { cookie: kaka(1) } }));
  assert.equal(r.statusCode, 200, 'fallið keyrir');
  assert.equal(kallad.length, 1);
  assert.ok(Date.now() - t0 < thak, 'skraning tafðist ' + (Date.now() - t0) + ' ms');
  // kaldræsing meðan hangir → skraning → beint í gegn
  V._endurstilla();
  t0 = Date.now();
  assert.equal((await h(ev())).statusCode, 200);
  assert.ok(Date.now() - t0 < thak);
  // þekktur lokad, svo hangir → 502 (aldrei opið), innan þaks
  HANGIR = false; V._endurstilla(); HAMUR = { hamur: 'lokad' }; await V.hamurFyrir('prufufall');
  V._rennaUt(); V._gleymaStillingu(); HANGIR = true;
  t0 = Date.now();
  r = await h(ev({ headers: { cookie: kaka(1) } }));
  assert.equal(r.statusCode, 502);
  assert.ok(Date.now() - t0 < thak, 'lokad tafðist ' + (Date.now() - t0) + ' ms');
  assert.equal(kallad.length, 2, 'fallið keyrði ekki í lokuðum ham');
  // myntun tóka fyrir innri köll gefst upp og kallið fer án tóka (hangir ekki)
  t0 = Date.now();
  assert.equal(await V.myntaToki(), '');
  assert.ok(Date.now() - t0 < 2 * V.FRESTUR_MS + 100);
  HANGIR = false;
}]);
fyrir(['OPTIONS fer alltaf í gegn; opidEf hleypir kúnnaslóð í gegn', async () => {
  const { h, kallad } = vafid({ opidEf: (e) => !!(e.queryStringParameters || {}).token });
  assert.equal((await h(ev({ httpMethod: 'OPTIONS' }))).statusCode, 200);
  assert.equal((await h(ev({ queryStringParameters: { token: 'abc' } }))).statusCode, 200);
  assert.equal((await h(ev({ queryStringParameters: { list: '1' } }))).statusCode, 401);
  assert.equal(kallad.length, 2);
}]);
fyrir(['stjornandi: starfsmaður → 403, Admin-kaka → inn, tóki (starfsmannsréttindi) → 403', async () => {
  const { h } = vafid({ stjornandi: true });
  assert.equal((await h(ev({ headers: { cookie: kaka(2) } }))).statusCode, 403);
  assert.equal((await h(ev({ headers: { cookie: kaka(1) } }))).statusCode, 200);
  assert.equal((await h(ev({ headers: { 'x-hub-toki': toki() } }))).statusCode, 403, 'tóki veitir ekki stjórnandaréttindi');
}]);
fyrir(['forspurn appsins með x-hub-toki fær 204 frá verðinum; annar uppruni/aðrir hausar → fallið svarar sjálft', async () => {
  const { h, kallad } = vafid();
  const APP = 'https://slokkvitaeki.netlify.app';
  const r = await h(ev({ httpMethod: 'OPTIONS', headers: { origin: APP, 'access-control-request-headers': 'content-type, x-hub-toki' } }));
  assert.equal(r.statusCode, 204);
  assert.equal(r.headers['Access-Control-Allow-Origin'], APP);
  assert.match(r.headers['Access-Control-Allow-Headers'], /x-hub-toki/);
  assert.equal(kallad.length, 0);
  assert.equal((await h(ev({ httpMethod: 'OPTIONS', headers: { origin: 'https://illt.example', 'access-control-request-headers': 'x-hub-toki' } }))).statusCode, 200);
  assert.equal((await h(ev({ httpMethod: 'OPTIONS', headers: { origin: APP, 'access-control-request-headers': 'content-type' } }))).statusCode, 200);
  assert.equal(kallad.length, 2);
}]);
fyrir(['skjal-tóki kúnnagáttarinnar: opnar AÐEINS sitt skjal og aðeins stutta stund', async () => {
  const st = (id, exp = Math.floor(Date.now() / 1000) + 600, leynd = LEYND) => exp + '.' + crypto.createHmac('sha256', leynd).update('skjal|' + id + '|' + exp).digest('hex');
  const { h, kallad } = vafid({ opidEf: (e) => { const q = (e && e.queryStringParameters) || {}; return !!(q.id && q.st) && V.erGildurSkjalToki(q.id, q.st); } });
  assert.equal((await h(ev({ queryStringParameters: { id: 'drive-1', st: st('drive-1') } }))).statusCode, 200);
  assert.equal((await h(ev({ queryStringParameters: { id: 'drive-2', st: st('drive-1') } }))).statusCode, 401, 'annað skjal');
  assert.equal((await h(ev({ queryStringParameters: { id: 'drive-1', st: st('drive-1', Math.floor(Date.now() / 1000) - 5) } }))).statusCode, 401, 'útrunninn');
  assert.equal((await h(ev({ queryStringParameters: { id: 'drive-1', st: st('drive-1', Math.floor(Date.now() / 1000) + 3600) } }))).statusCode, 401, 'of langur gildistími');
  assert.equal((await h(ev({ queryStringParameters: { id: 'drive-1', st: st('drive-1', undefined, 'rangt-leyndarmal') } }))).statusCode, 401, 'rangur lykill');
  assert.equal(kallad.length, 1);
}]);
fyrir(['notandaleitin er í skyndiminni (60 s): sama kaka tvisvar → ein leit', async () => {
  const { h } = vafid();
  await h(ev({ headers: { cookie: kaka(2) } }));
  await h(ev({ headers: { cookie: kaka(2) } }));
  assert.equal(NOTANDALEIT, 1);
}]);
fyrir(['401 til Slökkvitækis-appsins ber CORS-haus svo appið sjái villuna; aðrir uppruni ekki', async () => {
  const { h } = vafid();
  assert.equal((await h(ev({ headers: { origin: 'https://slokkvitaeki.netlify.app' } }))).headers['Access-Control-Allow-Origin'], 'https://slokkvitaeki.netlify.app');
  assert.equal((await h(ev({ headers: { origin: 'https://illt.example' } }))).headers['Access-Control-Allow-Origin'], undefined);
}]);
fyrir(['innri köll: fetch á eigin /api/ og /.netlify/functions/ fær tókann; önnur hýsing ALDREI', async () => {
  await fetch('https://brunaholf.netlify.app/api/worksites?x=1');
  await fetch('https://brunaholf.netlify.app/.netlify/functions/debtors', { method: 'POST', headers: { 'content-type': 'application/json' } });
  await fetch('https://illt.example/api/worksites');
  await fetch('https://brunaholf.netlify.app/index.html');
  assert.ok(UTKOLL[0].toki && await V.erGildurToki(UTKOLL[0].toki));
  assert.ok(UTKOLL[1].toki);
  assert.equal(UTKOLL[2].toki, null);
  assert.equal(UTKOLL[3].toki, null);
}]);

// ── ÖLL vafin föll: óinnskráð → 401 án þess að fallið keyri ─────────────────────────────────────────────────────
const DIR = path.join(__dirname, '..', 'netlify', 'functions');
const vafin = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !f.startsWith('_'))
  .filter(f => /require\('\.\/_vord'\)/.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
test(`öll vafin föll (${vafin.length}) svara 401 óinnskráð og flytja út óvarinn _innra`, async () => {
  nytt(); V._endurstilla();
  const ekkiHladid = [], opin = [];
  for (const f of vafin) {
    let m;
    try { m = require(path.join(DIR, f)); } catch (e) { ekkiHladid.push(f + ': ' + String(e.message).slice(0, 60)); continue; }
    assert.equal(m.handler._vord, f.replace(/\.js$/, ''), f + ' er ekki vafið með réttu nafni');
    assert.equal(typeof m._innra, 'function', f + ' vantar _innra');
    const fyrirUt = UTKOLL.length;
    for (const method of ['GET', 'POST']) {
      const r = await m.handler(ev({ httpMethod: method, body: '{}' }));
      if (!r || r.statusCode !== 401) opin.push(f + ' ' + method + ' → ' + (r && r.statusCode));
    }
    assert.equal(UTKOLL.length, fyrirUt, f + ' kallaði út á netið óinnskráð');
  }
  assert.deepEqual(opin, []);
  // Föll sem þurfa pakka sem eru ekki í vinnutrénu eru sögð hér, ekki falin
  if (ekkiHladid.length) console.log('# ekki hlaðið (vantar pakka):', ekkiHladid.join(' · '));
  assert.ok(ekkiHladid.length <= 10, 'of mörg föll hlóðust ekki: ' + ekkiHladid.length);
});
// Bein innri köll (require) fara framhjá HTTP og bera hvorki köku né tóka: þau VERÐA að nota _innra, annars stöðvar
// vörðurinn t.d. áætlaða heilsuvakt eða póstinnsog þegar lokað er (daily-health-background, gmail-ingest-background — CI 17.11).
test('ekkert fall kallar beint á vafinn handler (aðeins um _innra)', () => {
  const vafinNofn = new Set(vafin.map(f => f.replace(/\.js$/, '')));
  const brot = [];
  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const m of s.matchAll(/\{([^}]*)\}\s*=\s*require\(\s*['"]\.\/([\w-]+?)(?:\.js)?['"]\s*\)/g)) {
      if (vafinNofn.has(m[2]) && /\bhandler\b/.test(m[1])) brot.push(`${f}: {…handler…} = require('./${m[2]}')`);
    }
    for (const m of s.matchAll(/require\(\s*['"]\.\/([\w-]+?)(?:\.js)?['"]\s*\)\s*\.handler/g)) if (vafinNofn.has(m[1])) brot.push(`${f}: require('./${m[1]}').handler`);
    for (const m of s.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]\.\/([\w-]+?)(?:\.js)?['"]\s*\)/g)) {
      if (!vafinNofn.has(m[2])) continue;
      const v = m[1];
      const allt = (s.match(new RegExp('\\b' + v + '\\.handler\\b', 'g')) || []).length;
      const varid = (s.match(new RegExp('\\b' + v + '\\._innra\\s*\\|\\|\\s*' + v + '\\.handler\\b', 'g')) || []).length;
      if (allt > varid) brot.push(`${f}: ${v}.handler (${m[2]}) án _innra`);
    }
  }
  assert.deepEqual(brot, []);
});
test('ESM-fallið timavera-maeting er vafið og svarar 401 óinnskráð', async () => {
  nytt(); V._endurstilla();
  const m = await import(require('node:url').pathToFileURL(path.join(DIR, 'timavera-maeting.js')).href);
  assert.equal(m.handler._vord, 'timavera-maeting');
  const fyrirUt = UTKOLL.length;
  assert.equal((await m.handler(ev())).statusCode, 401);
  assert.equal(UTKOLL.length, fyrirUt);
});
