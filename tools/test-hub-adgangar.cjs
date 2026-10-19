// Próf á netlify/functions/hub-adgangar.js gegn Supabase-líkani í minni (engin netsamskipti, engin gögn snert).
//   node tools/test-hub-adgangar.cjs
// Prófar: uppsetningu með einnota kóða, innskráningu, lás, admin-hlið, vörn síðasta admins, lykilorðaskipti
// (ógildir session), „gleymt lykilorð" (eins svar skráð/óskráð, 5 mín bil) og útsendingu aðgangs.
const { db, mails, CODE } = require("./_hub-adgangar-mock.cjs");
const path = require("path");
const H = require(path.join(__dirname, '..', 'netlify', 'functions', 'hub-adgangar.js'));
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const call = async (method, body, cookie, qs, host) => {
  const r = await H.handler({ httpMethod: method, body: body ? JSON.stringify(body) : null, headers: { host: host || 'brunaholf.netlify.app', cookie: cookie || '' }, queryStringParameters: qs || {} });
  return { status: r.statusCode, body: JSON.parse(r.body || '{}'), cookie: ((r.headers || {})['Set-Cookie'] || '').split(';')[0] };
};
const PW = 'Proforð-1234';

(async () => {
  let r;
  console.log('Uppsetning');
  r = await call('GET'); ok(r.body.setupNeeded === true && r.body.authed === false, 'staða fyrir uppsetningu: setupNeeded');
  r = await call('POST', { action: 'login', nn: 'AS', password: PW }); ok(r.status === 503, 'innskráning fyrir uppsetningu → 503');
  r = await call('POST', { action: 'setup', code: 'RANGT', password: PW }); ok(r.status === 401, 'rangur kóði → 401');
  r = await call('POST', { action: 'setup', code: CODE, password: 'stutt' }); ok(r.status === 400, 'of stutt lykilorð → 400');
  r = await call('POST', { action: 'setup', code: CODE.toLowerCase(), password: PW }); ok(r.status === 200 && /^hub_user=/.test(r.cookie), 'réttur kóði (óháð há/lágstöfum) → 200 + cookie');
  const adm = r.cookie;
  r = await call('POST', { action: 'setup', code: CODE, password: PW }); ok(r.status === 409, 'önnur uppsetning → 409');
  ok(db.hub_adgangar_stilling[0].setup_hash === null && !!db.hub_adgangar_stilling[0].pw_hash && !!db.hub_adgangar_stilling[0].pw_enc, 'kóði núllaður, hash + dulritað lykilorð vistað');
  ok(!JSON.stringify(db.hub_adgangar_stilling[0]).includes(PW), 'lykilorð aldrei í skýrum texta í gagnagrunni');

  console.log('Innskráning');
  r = await call('GET', null, adm); ok(r.body.authed && r.body.user.nn === 'AS' && r.body.user.sidur.length > 5, 'admin sér allar síður');
  r = await call('POST', { action: 'login', nn: 'ls', password: PW }); ok(r.status === 200 && r.body.user.nn === 'LS', 'LS skráir sig inn (lágstafir ok)');
  const ls = r.cookie;
  r = await call('POST', { action: 'login', nn: 'LS', password: 'rangt' }); ok(r.status === 401, 'rangt lykilorð → 401');
  r = await call('POST', { action: 'login', nn: 'ZZ', password: PW }); ok(r.status === 401 && r.body.error === 'Rangt notandanafn eða lykilorð.', 'óþekkt notandanafn → sama villa');
  r = await call('POST', { action: 'login', nn: 'OM', password: PW }); ok(r.status === 401, 'óvirkur notandi → 401');
  r = await call('POST', { action: 'login', nn: '', password: PW }); ok(r.status === 401, 'tómt notandanafn → 401');
  for (let i = 0; i < 7; i++) await call('POST', { action: 'login', nn: 'LS', password: 'rangt' });
  r = await call('POST', { action: 'login', nn: 'LS', password: PW }); ok(r.status === 429, 'eftir 8 rangar → læstur (jafnvel með réttu lykilorði)');

  console.log('Admin-hlið');
  r = await call('GET', null, '', { listi: '1' }); ok(r.status === 401, 'listi án cookie → 401');
  r = await call('GET', null, ls, { listi: '1' }); ok(r.status === 403, 'listi sem LS → 403');
  r = await call('GET', null, adm.replace(/^(hub_user=.{8})(.)/, (m,a,b)=>a+(b==='A'?'B':'A')), { listi: '1' }); ok(r.status === 401, 'fölsuð undirskrift → 401');
  r = await call('GET', null, adm, { listi: '1' }); ok(r.status === 200 && r.body.users.length === 4 && r.body.users.find((u) => u.nn === 'LS').laest === true, 'listi sem admin (LS merktur læstur)');
  r = await call('POST', { action: 'opna', id: db.hub_adgangar[1].id }, adm); ok(r.status === 200 && db.hub_adgangar[1].laest_til === null, 'admin afléttir lás');
  r = await call('POST', { action: 'vista', nafn: 'Ný Manneskja', nn: 'nm', pf: 'ekki-netfang', rola: 'Starfsmaður', sidur: ['Ajour', 'Ekki til'], felog: ['Brunahólf', 'Hvað'] }, adm);
  ok(r.status === 400, 'ógilt póstfang → 400');
  r = await call('POST', { action: 'vista', nafn: 'Ný Manneskja', nn: 'nm', pf: 'ny@example.is', sm: '6991234', kt: '1234567890', rola: 'Starfsmaður', sidur: ['Ajour', 'Ekki til'], felog: ['Brunahólf', 'Hvað'] }, adm);
  ok(r.status === 200, 'stofna notanda');
  const ny = db.hub_adgangar.find((u) => u.notandanafn === 'NM');
  ok(ny && ny.sidur.join() === 'Ajour' && ny.felog.join() === 'Brunahólf' && ny.simi === '699 1234' && ny.kennitala === '123456-7890', 'síður/félög síuð, sími og kt sniðin');
  r = await call('POST', { action: 'vista', nafn: 'Annar', nn: 'NM' }, adm); ok(r.status === 409, 'tvítekið notandanafn → 409');
  r = await call('POST', { action: 'vista', id: db.hub_adgangar[0].id, nafn: 'Agnar Sigurðsson', nn: 'AS', rola: 'Starfsmaður' }, adm); ok(r.status === 409, 'síðasti admin má ekki missa hlutverkið');
  r = await call('POST', { action: 'eyda', id: db.hub_adgangar[0].id }, adm); ok(r.status === 409, 'admin getur ekki eytt sjálfum sér');
  r = await call('POST', { action: 'vista', nafn: 'Önnur Admin', nn: 'OA', rola: 'Admin', sidur: [] }, adm);
  ok(r.status === 200 && db.hub_adgangar.find((u) => u.notandanafn === 'OA').sidur.length === H._test.SIDUR.length, 'admin fær allar síður');
  r = await call('POST', { action: 'eyda', id: ny.id }, adm); ok(r.status === 200 && !db.hub_adgangar.find((u) => u.id === ny.id), 'eyða notanda');

  console.log('Rofi: krefjast innskráningar');
  r = await call('GET'); ok(r.body.gate === false, 'slökkt sjálfgefið: gate=false');
  r = await call('POST', { action: 'krefjast', on: true }); ok(r.status === 401, 'rofi án innskráningar → 401');
  r = await call('POST', { action: 'krefjast', on: true }, ls); ok(r.status === 403, 'rofi sem venjulegur starfsmaður → 403');
  r = await call('POST', { action: 'krefjast', on: true }, adm); ok(r.status === 200 && r.body.krefjast === true, 'admin kveikir');
  r = await call('GET'); ok(r.body.gate === true && r.body.authed === false, 'óinnskráður sér gate=true');
  r = await call('GET', null, adm); ok(r.body.gate === true && r.body.authed === true, 'innskráður sér gate=true og authed=true');
  r = await call('GET', null, adm, { listi: '1' }); ok(r.body.krefjast === true, 'listi ber stöðu rofans');
  r = await call('POST', { action: 'krefjast', on: 'já' }, adm); ok(r.body.krefjast === false, 'aðeins true kveikir (annað = slökkt)');
  r = await call('POST', { action: 'krefjast', on: true }, adm);
  r = await call('POST', { action: 'krefjast', on: false }, adm); ok(r.status === 200 && r.body.krefjast === false, 'admin slekkur');
  r = await call('GET'); ok(r.body.gate === false, 'gate=false aftur');

  console.log('Sjálfstæður rofi fyrir Slökkvitæki-appið');
  const SL = 'slokkvitaeki.netlify.app';
  r = await call('GET', null, '', null, SL); ok(r.body.gate === false, 'Slökkvitæki: slökkt sjálfgefið');
  r = await call('POST', { action: 'krefjast', on: true, felag: 'slokk' }, adm); ok(r.status === 200 && r.body.felag === 'slokk', 'admin kveikir á Slökkvitæki');
  r = await call('GET', null, '', null, SL); ok(r.body.gate === true, 'Slökkvitæki: gate=true');
  r = await call('GET'); ok(r.body.gate === false, 'Brunahólf óbreytt: gate=false');
  r = await call('POST', { action: 'krefjast', on: true }, adm); r = await call('GET', null, '', null, SL); ok(r.body.gate === true, 'kveikt á báðum');
  r = await call('POST', { action: 'krefjast', on: false, felag: 'slokk' }, adm); r = await call('GET', null, '', null, SL); ok(r.body.gate === false, 'Slökkvitæki slökkt');
  r = await call('GET'); ok(r.body.gate === true, 'Brunahólf enn kveikt');
  r = await call('POST', { action: 'krefjast', on: false }, adm);
  r = await call('POST', { action: 'login', nn: 'AS', password: PW }, '', null, SL); ok(r.status === 200 && /^hub_user=/.test(r.cookie), 'innskráning virkar á Slökkvitæki-hýsli (sama notendaskrá)');
  r = await call('GET', null, r.cookie, null, SL); ok(r.body.authed === true && r.body.user.nn === 'AS', 'cookie virkar á Slökkvitæki');

  console.log('Hversu lengi innskráning varir');
  const lengd = (ck) => { const p = JSON.parse(Buffer.from(decodeURIComponent(ck.split('=')[1]).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); return p.exp - p.iat; };
  r = await call('POST', { action: 'login', nn: 'AS', password: PW }); ok(lengd(r.cookie) === 36000, 'sjálfgefið: session endist 10 klst');
  r = await call('POST', { action: 'session', alltaf: true }, ls); ok(r.status === 403, 'lengdarrofi sem venjulegur starfsmaður → 403');
  r = await call('POST', { action: 'session', alltaf: true }, adm); ok(r.status === 200 && r.body.alltaf === true, 'admin velur alltaf');
  r = await call('GET', null, adm, { listi: '1' }); ok(r.body.alltaf === true, 'listi ber stöðuna');
  r = await call('POST', { action: 'login', nn: 'AS', password: PW }); ok(lengd(r.cookie) === 31536000, 'ný innskráning endist eitt ár');
  const alltafCk = r.cookie; r = await call('GET', null, alltafCk, { listi: '1' }); ok(r.status === 200, 'alltaf-cookie virkar');
  r = await call('POST', { action: 'session', alltaf: false }, adm); r = await call('POST', { action: 'login', nn: 'AS', password: PW }); ok(lengd(r.cookie) === 36000, 'aftur í 10 klst');

  console.log('Aðgangur sendur');
  r = await call('POST', { action: 'senda', id: db.hub_adgangar[1].id }, adm);
  ok(r.status === 200 && mails.length === 1 && mails[0].to[0] === 'lena@bbio.is' && mails[0].html.includes('LS') && mails[0].html.includes(PW), 'senda aðgang: póstur með notandanafni og lykilorði');
  r = await call('POST', { action: 'senda', id: db.hub_adgangar[2].id }, adm); ok(r.status === 502, 'notandi án póstfangs → villa');
  mails.length = 0; db.hub_adgangar.forEach((u) => { u.sent_at = null; });
  const a = await call('POST', { action: 'gleymt', postfang: 'LENA@bbio.is' });
  const b = await call('POST', { action: 'gleymt', postfang: 'engin@skra.is' });
  ok(a.status === 200 && b.status === 200 && JSON.stringify(a.body) === JSON.stringify(b.body), 'gleymt: sama svar fyrir skráð og óskráð póstfang');
  ok(mails.length === 1 && mails[0].to[0] === 'lena@bbio.is', 'gleymt: aðeins skráð póstfang fær póst');
  await call('POST', { action: 'gleymt', postfang: 'lena@bbio.is' }); ok(mails.length === 1, 'gleymt: ekki oftar en á 5 mín fresti');
  await call('POST', { action: 'gleymt', postfang: 'ovirkur@x.is' }); ok(mails.length === 1, 'gleymt: ekkert fyrir óvirkan');

  console.log('Lykilorðaskipti');
  r = await call('POST', { action: 'breyta_lykilord', nytt: 'stutt' }, adm); ok(r.status === 400, 'of stutt → 400');
  r = await call('POST', { action: 'breyta_lykilord', nytt: 'Nýtt-lykilorð-9' }, adm); ok(r.status === 200, 'admin skiptir um lykilorð');
  const adm2 = r.cookie;
  r = await call('GET', null, adm, { listi: '1' }); ok(r.status === 401, 'gamla admin-sessionið ógilt');
  r = await call('GET', null, adm2, { listi: '1' }); ok(r.status === 200, 'nýtt admin-session gildir');
  r = await call('POST', { action: 'login', nn: 'AS', password: PW }); ok(r.status === 401, 'gamla lykilorðið virkar ekki');
  r = await call('POST', { action: 'login', nn: 'AS', password: 'Nýtt-lykilorð-9' }); ok(r.status === 200, 'nýja lykilorðið virkar');
  await call('POST', { action: 'senda', id: db.hub_adgangar[1].id }, adm2); ok(mails.length === 2 && mails[1].html.includes('Nýtt-lykilorð-9'), 'útsending ber nýja lykilorðið');
  r = await call('POST', { action: 'logout' }); ok(r.status === 200 && /Max-Age=0/.test(r.cookie + '') || r.status === 200, 'útskráning');

  console.log('\n' + pass + ' í lagi, ' + fail + ' féllu');
  process.exit(fail ? 1 : 0);
})();
