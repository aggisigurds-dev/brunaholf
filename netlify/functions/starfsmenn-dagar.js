// starfsmenn-dagar.js — „hvað eru þeir raunverulega lengi að vinna?"
//
//   GET /api/starfsmenn-dagar?nr=20,24&dagar=30[&verkefni=nlsh|allt]
//     → { fra, til, starfsmenn:[{ nr, nafn, dagar:[…], samtals:{…} }], skyringar }
//
// Ósk Agnars 10.09.2026: „analys for staffmembers nr 20 and 24 for 30 days,
// how many they do each day, when the first activity is seen what hour, and
// last activity hour — we are wondering how long they are working for reals".
//
// ── HVAÐAN KLUKKAN KEMUR — og hvaðan hún kemur EKKI ────────────────────────
// Fyrsta og síðasta klukkustund koma úr TÍMAVERU (`time_in` / `time_out`),
// ekki úr Ajour. Ástæðan er mæld, ekki ágiskuð: `ajour-ingest-drive-background.js`
// klippir tímann AF við innlestur —
//     checked_date: parseDate((get('CheckListItemCheckedDate')||'').split(' ')[0])
// og `parseTs` skrifar `T00:00:00Z`. Hver einasta dagsetning í
// `ajour_registrations` er því miðnætti. Gata-skráningar geta ekki sagt
// hvenær dags var unnið, þótt CSV-skráin á Drive beri tímann.
// (Vilji menn raunverulegan gata-tímastimpil er það ein lína í innlestrinum
// + endurinnlestur — sjá `skyringar.ajour_tapar_klukku` í svarinu.)
//
// Þess vegna mælir þessi endapunktur ÞRENNT hlið við hlið, og ruglar þeim ekki
// saman:
//   • VIÐVERA  = time_out − time_in (fyrsta stimplun → síðasta). Þetta er
//     spönnin á staðnum, matartímar og hlé MEÐTALIN.
//   • BÓKAÐ    = summa `hours` úr Tímaveru. Þetta er það sem er borgað/rukkað.
//   • AFKÖST   = kláruð göt þann dag úr Ajour (dagsetning, engin klukka).
// Munurinn viðvera − bókað er EKKI „svindl" og ekki „óskráð vinna" — hann er
// hlé, akstur milli staða, og færslur á ÖNNUR verkefni sama dag. Þess vegna er
// hann birtur sem `mismunur`, með `verkefni_dagsins` við hliðina svo maður sjái
// hvort tíminn fór annað. Talan svarar spurningunni; hún dæmir engan.
//
// Sjálfgefið er sían `verkefni=nlsh` (Landspítala-verkefnin). `verkefni=allt`
// tekur ALLA Tímaveru-tíma dagsins — það er rétta stillingin þegar spurt er
// „hvað var hann lengi í vinnu", því maður fer ekki heim þótt hann skipti um
// verkstað.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NLSH_AJOUR = 'NLSH 5-6. hæð';
const NLSH_TIMAVERA = ['Landsspitalinn', 'Landsspítalinn', 'NLSH 5-6. hæð', 'NLSH 5-6 hæð'];

const { STAFF, nrForEmployee, nrFromCategory } = require('./nlsh-dashboard.js');

const VD = ['sun', 'mán', 'þri', 'mið', 'fim', 'fös', 'lau'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const qs = event.queryStringParameters || {};
  const nrar = String(qs.nr || '20,24').split(',').map(x => +x.trim()).filter(Boolean);
  const dagar = Math.min(Math.max(+qs.dagar || 30, 1), 200);
  const alltVerk = qs.verkefni === 'allt';

  const nu = new Date();
  const til = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()));
  const fra = new Date(til.getTime() - (dagar - 1) * 86400000);
  const lykill = d => d.toISOString().slice(0, 10);
  const fraS = lykill(fra), tilS = lykill(til);

  let ajour, timar;
  try {
    ajour = await fetchAll('ajour_registrations',
      `select=serial_number,category,execution_date,checked_date,registration_status&project_name=eq.${encodeURIComponent(NLSH_AJOUR)}`);
    let tq = `select=date,hours,employee,project,time_in,time_out&date=gte.${fraS}&date=lte.${tilS}`;
    if (!alltVerk) tq += `&project=in.(${NLSH_TIMAVERA.map(n => `"${n}"`).join(',')})`;
    timar = await fetchAll('timavera_entries', tq);
  } catch (e) { return json(502, { error: e.message }); }

  // ── Göt per starfsmann/dag (kláruð). Eitt serial = eitt gat. ─────────────
  const got = new Map();
  for (const r of ajour) {
    const sn = r.serial_number; if (!sn) continue;
    const eff = r.execution_date || r.checked_date || null;
    const p = got.get(sn);
    const done = r.registration_status === 'Done';
    if (!p) { got.set(sn, { nr: nrFromCategory(r.category), date: eff, done }); continue; }
    if (!p.date && eff) p.date = eff;
    if (p.nr == null) p.nr = nrFromCategory(r.category);
    if (done) p.done = true;
  }
  const gotDag = new Map();                       // 'nr|dags' → {klarad, olokid}
  for (const g of got.values()) {
    if (!g.nr || !g.date) continue;
    const d = String(g.date).slice(0, 10);
    if (d < fraS || d > tilS) continue;
    const k = g.nr + '|' + d;
    const c = gotDag.get(k) || gotDag.set(k, { klarad: 0, olokid: 0 }).get(k);
    if (g.done) c.klarad++; else c.olokid++;
  }

  // ── Tímavera per starfsmann/dag ─────────────────────────────────────────
  const tDag = new Map();                         // 'nr|dags' → {inn, ut, bokad, faerslur, verk:Set}
  for (const t of timar) {
    const n = nrForEmployee(t.employee); if (!n || !nrar.includes(n)) continue;
    const d = String(t.date).slice(0, 10);
    const k = n + '|' + d;
    let c = tDag.get(k);
    if (!c) tDag.set(k, c = { inn: null, ut: null, bokad: 0, faerslur: 0, verk: new Set() });
    c.bokad += +t.hours || 0;
    c.faerslur++;
    if (t.project) c.verk.add(t.project);
    const i = klst(t.time_in), o = klst(t.time_out);
    if (i != null && (c.inn == null || i < c.inn)) c.inn = i;
    if (o != null && (c.ut == null || o > c.ut)) c.ut = o;
  }

  const ut = [];
  for (const nr of nrar) {
    const linur = [];
    for (let t = fra.getTime(); t <= til.getTime(); t += 86400000) {
      const d = new Date(t), key = lykill(d);
      const g = gotDag.get(nr + '|' + key) || { klarad: 0, olokid: 0 };
      const c = tDag.get(nr + '|' + key);
      const bokad = c ? Math.round(c.bokad * 100) / 100 : 0;
      const vidvera = (c && c.inn != null && c.ut != null && c.ut > c.inn)
        ? Math.round((c.ut - c.inn) * 100) / 100 : null;
      linur.push({
        dags: key,
        vikudagur: VD[d.getUTCDay()],
        helgi: d.getUTCDay() === 0 || d.getUTCDay() === 6,
        fyrsta: c ? hhmm(c.inn) : null,
        sidasta: c ? hhmm(c.ut) : null,
        vidvera_klst: vidvera,
        bokad_klst: bokad,
        mismunur: vidvera != null ? Math.round((vidvera - bokad) * 100) / 100 : null,
        faerslur: c ? c.faerslur : 0,
        verkefni_dagsins: c ? [...c.verk] : [],
        klarad: g.klarad,
        olokid: g.olokid,
        got_per_klst: bokad ? Math.round(g.klarad / bokad * 100) / 100 : null,
      });
    }

    const virkir = linur.filter(x => x.bokad_klst || x.klarad || x.fyrsta);
    const medal = (arr, f) => { const v = arr.map(f).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 : null; };
    const samtals = {
      virkir_dagar: virkir.length,
      klarad: linur.reduce((a, x) => a + x.klarad, 0),
      olokid: linur.reduce((a, x) => a + x.olokid, 0),
      bokad_klst: Math.round(linur.reduce((a, x) => a + x.bokad_klst, 0) * 10) / 10,
      vidvera_klst: Math.round(virkir.reduce((a, x) => a + (x.vidvera_klst || 0), 0) * 10) / 10,
      medal_fyrsta: hhmm(medal(virkir, x => mins(x.fyrsta))),
      medal_sidasta: hhmm(medal(virkir, x => mins(x.sidasta))),
      medal_vidvera: medal(virkir, x => x.vidvera_klst),
      medal_bokad: medal(virkir, x => x.bokad_klst || null),
      medal_klarad: medal(virkir, x => x.klarad),
      dagar_an_stimplunar: virkir.filter(x => !x.fyrsta).length,
    };
    samtals.got_per_klst = samtals.bokad_klst ? Math.round(samtals.klarad / samtals.bokad_klst * 100) / 100 : null;

    ut.push({ nr, nafn: (STAFF[nr] && STAFF[nr].name) || ('Starfsmaður ' + nr), dagar: linur, samtals });
  }

  return json(200, {
    fra: fraS, til: tilS, dagar, verkefni: alltVerk ? 'allt' : 'nlsh',
    starfsmenn: ut,
    skyringar: {
      klukka: 'Fyrsta/síðasta klukkustund kemur úr Tímaveru (time_in/time_out), ekki úr gata-skráningum.',
      ajour_tapar_klukku: 'ajour_registrations geymir EKKI klukkustund — innlesturinn (ajour-ingest-drive-background.js) klippir tímann af CheckListItemCheckedDate og skrifar miðnætti. CSV-skráin á Drive ber tímann; það þarf eina línu í innlestrinum + endurinnlestur til að fá hann inn.',
      vidvera: 'Viðvera = síðasta stimplun − fyrsta stimplun. Hlé og matartímar eru MEÐTALIN.',
      bokad: 'Bókað = summa hours úr Tímaveru — það sem er borgað/rukkað.',
      mismunur: 'Viðvera − bókað er hlé, akstur og tímar á ÖNNUR verkefni sama dag. Sjá verkefni_dagsins áður en ályktað er.',
      sia: alltVerk ? 'Allir Tímaveru-tímar dagsins (rétt til að meta vinnudaginn í heild).' : 'Aðeins Landspítala-verkefnin — maður sem skipti um verkstað sýnir styttri dag en hann vann.',
    },
  });
};

// „07:30" / „7.5" / Excel-brot → klukkustundir sem tala
function klst(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  // AÐEINS tvípunktur telst klukkuform. Fyrsta útgáfa leyfði líka punkt
  // (`[:.]`) og las þá Excel-brotið 0.3333 sem „0 klst 33 mín" — Prosper
  // mældist mæta 00:33 og vinna 0,6 klst. Punktur er TUGABROT hér, ekki
  // skilmerki: "7.5" eru sjö og hálfur tími, "0.3333" er brot úr sólarhring.
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return +m[1] + (+m[2]) / 60;
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n)) return null;
  return n > 0 && n < 1 ? n * 24 : n;        // Excel geymir tímann sem brot úr sólarhring
}
function hhmm(h) {
  if (h == null || !isFinite(h)) return null;
  const t = Math.round(h * 60), hh = Math.floor(t / 60), mm = t % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
function mins(s) { const m = /^(\d{2}):(\d{2})$/.exec(s || ''); return m ? +m[1] + (+m[2]) / 60 : null; }

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
