// vefur-vorur.js — lifandi vörur fyrir verslunina á nýja vefnum (vefur/): heiti, flokkur, verð, lager og mynd.
//
// GET /api/vefur-vorur → { vorur: [{ id, nafn, flokkur, verd, an, birgdir, mynd, ms }], val: { falid, profill }, sott }
//
// HVAÐAN. Vörurnar koma úr vöruskránni gegnum /api/vefverslun í Slökkvitæki-appinu. Það fall ræður hvaða vörur eru til sölu
// á netinu og í hvaða röð, og reiknar verð með vsk. Hér er engu bætt við þá reglu, svo vefurinn sýnir sömu vörur og sama
// verð og vefverslunin. Þetta fall les ekki gagnagrunninn sjálft, notar enga lykla og skrifar hvergi.
//
// HVAÐ FER ÚT. Aðeins reitirnir hér að ofan, hver af sinni gerð og innan marka (hvítlisti). Svar vöruskrárinnar er ekki
// talið traust: vara með ógilt auðkenni, heiti, flokk eða verð fellur út, og svar sem enga gilda vöru ber telst bilun.
//   nafn, flokkur  ein lína. Vara fellur út beri heiti hennar eða flokkur síma, netfang, slóð, löng númer eða orð lengra en
//                  40 stafir (OVIDKOMANDI): það á ekki heima í vöruheiti og brýtur útlit síðunnar á síma.
//   verd   með vsk, heil tala, minnst 1 kr: vara án verðs er ekki sýnd á vefnum
//   mynd   slóð á myndina í vöruskránni eða í myndageymslu vefverslunarinnar ('' sé hún annars staðar), ms = fingrafar hennar.
//          Vefurinn á smækkað afrit af myndum þeirra vara sem voru til þegar hann var byggður og notar það meðan fingrafarið
//          er óbreytt
//   val    vöruval úr ritli vefverslunarinnar: falid = vörur sem eru faldar, profill = vörur með ítarlega vörusíðu
//   sott   hvenær vöruskráin var lesin (vefurinn spyr aftur ef svarið sem hann fékk úr skyndiminni er orðið gamalt)
//
// LÝSINGAR FARA EKKI ÚT. Lýsingardálkur vöruskrárinnar er líka minnisblað starfsfólks (birgjanúmer, birgjareikningar,
// innkaupsverð), og sía sem leitar að slíku nær aldrei öllu. Vefurinn sýnir því yfirfarnar lýsingar úr afritinu sínu
// (vefur/verslun/gogn.js), og ný eða breytt lýsing birtist þegar afritið er endurnýjað og lesið yfir. umbreyta(d, { lysing: true })
// gefur lýsingarnar fyrir afritið: /api/vefverslun fellir út heilar línur með innkaupsverði eða birgi, hér falla að auki út
// bútar á sömu línu (aðskildir með „ · “) sem bera slíkt (INNRI), og standi eitthvað eftir sem líkist minnispunkti (GRUNUR)
// verður lýsingin null og maður ákveður hana.
//
// AÐGANGUR. Engin innskráning og engin cookie: þetta eru sömu upplýsingar og standa í versluninni. Hvaða síða sem er má
// lesa svarið (Access-Control-Allow-Origin: *), því vefurinn sjálfur verður á öðru léni en þetta fall þegar brunaholf.is
// er tengt (vefur/README.md, „Áður en lénið er tengt“). Svarið er eins fyrir alla, svo eitt eintak dugar í skyndiminni.
//
// SKYNDIMINNI. Svarið er geymt á CDN í 5 mínútur, og eldra svar er afhent strax á meðan nýtt er sótt (allt að sólarhring).
// Beiðni með fyrirspurnarstreng eða undirslóð er hafnað, svo ekki sé hægt að sneiða hjá skyndiminninu og láta hverja
// beiðni lesa vöruskrána. Svari vöruskráin ekki er síðasta gilda svar notað í allt að 6 klst.; annars 502 og vefurinn sýnir
// afritið.

const crypto = require('crypto');

const UPPSPRETTA = 'https://slokkvitaeki.netlify.app';      // Slökkvitæki-appið: þar er vefverslunin og fallið sem les vöruskrána
const SLOD = UPPSPRETTA + '/api/vefverslun';
// myndir sem ritill vefverslunarinnar hleður upp fara í opna bucketinn vefverslun; aðrir bucketar koma vörum ekki við
const GEYMSLA = /^https:\/\/osfdzskyvisifcwyjkuk\.supabase\.co\/storage\/v1\/object\/public\/vefverslun\/[A-Za-z0-9][A-Za-z0-9._~\/-]{0,300}$/;
const MYND_UR_SKRA = /^\/api\/vefverslun\?mynd=([1-9]\d{0,9})&v=(\d{1,12})$/;
const FRESTUR = 8000;                 // ms sem beðið er eftir vöruskránni
const MAX_SVAR = 2 * 1024 * 1024;     // stærsta svar sem er lesið (stafir)
const MAX_VORUR = 400;
const MAX_NAFN = 160, MAX_FLOKKUR = 80, MAX_LYSING = 4000, MAX_KR = 100000000, MAX_ID = 2147483647, MAX_VAL = 1000;
const NYTT = 60 * 1000;               // svo lengi er síðasta svar notað án þess að spyrja vöruskrána aftur
const TIL_VARA = 6 * 3600 * 1000;     // svo gamalt svar má afhenda ef vöruskráin svarar ekki
const HLE = 30 * 1000;                // eftir bilun er ekki spurt aftur fyrr en að þessum tíma liðnum

// orðamörk sem þekkja íslenska stafi (\b í JavaScript þekkir aðeins a-z)
const F = '(?<![\\p{L}\\p{N}_])', A = '(?![\\p{L}\\p{N}_])';
// bútur lýsingar sem er minnispunktur starfsfólks: fellur út
const INNRI = new RegExp(`${F}birgja|${F}vnr${A}|kaupverð|${F}keypt|listaverð|kr/stk|reikn\\.|${F}verð\\s*=|${F}innkaup|${F}kostar${A}`, 'iu');
// það sem má ekki standa eftir í lýsingu: leifar af ofantöldu og annað sem minnisblöð bera (birgir, kostnaður, heildsala,
// pantanir, reikningar, afsláttur, álagning, upphæðir, númer önnur en staðlanúmer eins og EN 14604, sími, netfang, slóð).
// Rangur grunur kostar aðeins það að maður lítur á lýsinguna; sleppi minnispunktur fer hann á vefinn.
const GRUNUR = new RegExp([
  'birgi', 'birgj', `${F}vnr${A}`, 'kaupver', 'keypt', 'listaver', 'kr/stk', 'reikn', 'innk', 'kostar', 'kostn', 'heilds', 'pant', 'pönt',
  'afsl', 'álagn', 'framlegð', `${F}nr\\.?\\s*\\d`, `\\d\\s*kr${A}`, `${F}kr\\.?\\s*\\d`, `${F}(?<!(?:EN|ISO|IEC)\\s?)\\d{5,}${A}`, `${F}\\d{3}[ -]?\\d{4}${A}`,
  `${F}oger${A}`, `${F}dalberg${A}`, '@', 'https?:', 'www\\.',
].join('|'), 'iu');
// heiti og flokkur: ekkert sem á heima í auglýsingu eða minnispunkti, og ekkert orð lengra en 40 stafir
const OVIDKOMANDI = new RegExp(`@|https?:|www\\.|${F}\\d{3}[ -]?\\d{4}${A}|${F}\\d{6,}${A}|\\S{41}`, 'iu');
// stýristafir og ósýnilegir stafir (núllbreidd, stefnustýring, fyllistafir, afbrigðaval, merkjastafir) eiga ekki heima í
// vörutexta. Skrifaðir sem \u-runur svo þessi skrá beri enga ósýnilega stafi sjálf.
const OSYNILEGT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFFB]|\uDB40[\uDC00-\uDDEF]/g;

const texti = (s) => (typeof s === 'string' ? s : '').replace(/\r\n?/g, '\n').replace(OSYNILEGT, '');
const einLina = (s) => texti(s).replace(/\s+/g, ' ').trim();
const heil = (n, min, max) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

function hreinsaLysingu(t) {
  const linur = [];
  for (const lina of texti(t).split('\n')) {
    const bitar = lina.split(' · ').filter((b) => !INNRI.test(b));
    if (bitar.length || !lina.trim()) linur.push(bitar.join(' · '));
  }
  return linur.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// lýsingin fyrir afritið: hreinsuð, eða null ef eitthvað stendur eftir sem líkist minnispunkti eða hún er óeðlilega löng
function lysing(t) {
  const l = hreinsaLysingu(t);
  return l.length > MAX_LYSING || GRUNUR.test(l) ? null : l;
}
// slóð myndarinnar: aðeins mynd úr vöruskránni sjálfri (sótt um vefverslunarfallið) eða úr myndageymslu vefverslunarinnar
function mynd(v, id) {
  const m = typeof v.mynd === 'string' ? v.mynd : '';
  const x = MYND_UR_SKRA.exec(m);
  const slod = x && Number(x[1]) === id ? `${UPPSPRETTA}/api/vefverslun?mynd=${x[1]}&v=${x[2]}` : GEYMSLA.test(m) && !m.includes('..') ? m : '';
  return { mynd: slod, ms: m ? crypto.createHash('sha256').update(m).digest('hex').slice(0, 12) : '' };
}
function vara(v, sed, medLysingu) {
  if (!v || typeof v !== 'object' || !heil(v.id, 1, MAX_ID) || sed.has(v.id)) return null;
  const nafn = einLina(v.nafn), flokkur = einLina(v.flokkur) || 'Annað';
  if (!nafn || nafn.length > MAX_NAFN || flokkur.length > MAX_FLOKKUR || OVIDKOMANDI.test(nafn) || OVIDKOMANDI.test(flokkur)) return null;
  if (!heil(v.verd, 1, MAX_KR) || !heil(v.an, 0, v.verd)) return null;
  // lager sem er ekki tala telst ótalinn (null), eins og vöruskráin skráir vöru sem hefur ekki verið talin
  const birgdir = typeof v.birgdir === 'number' && Number.isFinite(v.birgdir) && Math.abs(v.birgdir) <= 1e6 ? Math.floor(v.birgdir) : null;
  sed.add(v.id);
  const ut = { id: v.id, nafn, flokkur };
  if (medLysingu) ut.lysing = lysing(v.lysing);
  return Object.assign(ut, { verd: v.verd, an: v.an, birgdir }, mynd(v, v.id));
}
function val(efni) {
  const ev = efni && typeof efni === 'object' && efni.vorur && typeof efni.vorur === 'object' && !Array.isArray(efni.vorur) ? efni.vorur : {};
  const falid = [...new Set((Array.isArray(ev.falid) ? ev.falid : []).filter((n) => heil(n, 1, MAX_ID)))].slice(0, MAX_VAL);
  const profill = {};
  if (ev.profill && typeof ev.profill === 'object' && !Array.isArray(ev.profill)) {
    for (const k of Object.keys(ev.profill).slice(0, MAX_VAL)) if (/^[1-9]\d{0,9}$/.test(k)) profill[k] = ev.profill[k] === true;
  }
  return { falid, profill };
}
// svar /api/vefverslun → það sem vefurinn fær; null ef svarið er ekki eins og við er búist eða ber enga gilda vöru.
// o.lysing: líka lýsingar, fyrir afrit vefsins (aldrei í svari fallsins)
function umbreyta(d, o) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.vorur) || d.vorur.length > MAX_VORUR) return null;
  const sed = new Set(), medLysingu = !!(o && o.lysing);
  const vorur = d.vorur.map((v) => vara(v, sed, medLysingu)).filter(Boolean);
  return vorur.length ? { vorur, val: val(d.efni) } : null;
}

const HAUSAR = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Access-Control-Allow-Origin': '*' };
const GEYMA = { 'Cache-Control': 'public, max-age=60', 'Netlify-CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=86400, durable' };
const svar = (status, body, auka) => ({ statusCode: status, headers: Object.assign({}, HAUSAR, auka || { 'Cache-Control': 'no-store' }), body: typeof body === 'string' ? body : JSON.stringify(body) });

let sidast = null;      // { t, body }: síðasta gilda svar í þessu keyrsluumhverfi
let bilun = 0;          // hvenær vöruskráin svaraði síðast ekki

async function saekja() {
  const r = await fetch(SLOD, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(FRESTUR) });
  if (!r.ok) throw new Error('vöruskráin svaraði ' + r.status);
  const t = await r.text();
  if (t.length > MAX_SVAR) throw new Error('svar vöruskrárinnar er of stórt');
  const u = umbreyta(JSON.parse(t));
  if (!u) throw new Error('svar vöruskrárinnar er ekki eins og við er búist');
  return JSON.stringify(Object.assign(u, { sott: new Date(Date.now()).toISOString() }));
}

exports.handler = async (event) => {
  const m = event.httpMethod;
  if (m === 'OPTIONS') return { statusCode: 204, headers: { Allow: 'GET, OPTIONS', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Cache-Control': 'no-store' }, body: '' };
  if (m !== 'GET') return svar(405, { error: 'Aðeins GET' }, { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' });
  // /api/vefur-vorur/<eitthvað> fer líka hingað (/api/* í netlify.toml): hver slík slóð væri nýr lykill í skyndiminninu
  if (/vefur-vorur\/./.test(String(event.path || ''))) return svar(404, { error: 'Ekki til' });
  if (event.rawQuery || Object.keys(event.queryStringParameters || {}).length) return svar(400, { error: 'Fallið tekur engar færibreytur' });
  const nu = Date.now();
  if (sidast && nu - sidast.t < NYTT) return svar(200, sidast.body, GEYMA);
  if (!bilun || nu - bilun >= HLE) {
    try {
      sidast = { t: nu, body: await saekja() };
      bilun = 0;
      return svar(200, sidast.body, GEYMA);
    } catch (e) {
      bilun = Date.now();
      console.error('vefur-vorur:', e && e.message);
    }
  }
  if (sidast && nu - sidast.t < TIL_VARA) return svar(200, sidast.body, GEYMA);
  return svar(502, { error: 'Vöruskráin svaraði ekki' });
};
exports.umbreyta = umbreyta;
exports.hreinsaLysingu = hreinsaLysingu;
