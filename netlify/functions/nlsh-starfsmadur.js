// nlsh-starfsmadur.js — NLSH: einn starfsmaður, dagur fyrir dag.
//
//   GET /api/nlsh-starfsmadur?nr=20&dagar=30
//     → { nr, nafn, fra, til, samtals, dagar[], starfsmenn[] }
//
// Ósk Agnars 10.09.2026, orðrétt: „að ég geti valið starfsmannanúmer,, td Hamza
// og séð hvað hann er að klára, byrja á mörgum götum per dag síðustu td 30 daga".
//
// Af hverju sér endapunktur en ekki viðbót við nlsh-dashboard:
//   Borðið sækir ANNAÐHVORT aðeins `Done` (sjálfgefið) EÐA allt (`include_open=1`)
//   og skilar EINNI holes-tölu. Til að sjá „klárað í dag" og „byrjað í dag" hlið
//   við hlið þarf báðar í sömu keyrslu — og að breyta borðinu til þess myndi
//   hreyfa tölur sem mánaðaruppgjörið byggir á. Þessi les sjálfur, telur bæði,
//   og snertir ekki þá keðju.
//
// Skilgreiningar (nákvæmlega þær sömu og borðið notar, svo tölurnar stemmi):
//   • Gat = eitt einstakt `serial_number` í `ajour_registrations`.
//   • KLÁRAÐ  = `registration_status = 'Done'`.
//   • BYRJAÐ/ÓLOKIÐ = gat sem er til en er ekki Done. Ajour skráir ekki upphafs-
//     dagsetningu, svo dagurinn er sá sami og borðið notar: `execution_date`,
//     með `checked_date` sem varaleið. Talan svarar því „hvað var skráð á hann
//     þennan dag sem er ENN ólokið", ekki „hvað hóf hann þennan dag". Reiturinn
//     heitir því `olokid` í svarinu — ekki `byrjad` — svo hann lofi ekki meiru
//     en gögnin standa undir. Sama regla og í nlsh-dashboard.js (execution_date
//     fremur en checked_date, því checked_date hrannast upp á QA-dögum).
//   • KLST = `timavera_entries.hours` á Landspítala-verkefnunum, kortlagt á
//     starfsmannsnúmer eftir fornafni. Klukkustundir eru á STARFSMANN og DAG —
//     þær vita ekkert um einstök göt.
//
// Kortlagningin (STAFF, nrForEmployee, nrFromCategory) er SÓTT í
// nlsh-dashboard.js, ekki afrituð. Sú skrá ber sjálf viðvörun um afrit sem rak
// í sundur; ein tafla á að eiga einn stað.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NLSH_AJOUR = 'NLSH 5-6. hæð';
const NLSH_TIMAVERA = ['Landsspitalinn', 'Landsspítalinn', 'NLSH 5-6. hæð', 'NLSH 5-6 hæð'];

const { STAFF, nrForEmployee, nrFromCategory } = require('./nlsh-dashboard.js');

const VIKUDAGAR = ['sun', 'mán', 'þri', 'mið', 'fim', 'fös', 'lau'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const qs = event.queryStringParameters || {};
  const nr = qs.nr ? +qs.nr : null;
  const dagar = Math.min(Math.max(+qs.dagar || 30, 1), 400);

  // Gluggi: síðustu N dagar að og með deginum í dag (UTC, eins og borðið).
  const nu = new Date();
  const til = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()));
  const fra = new Date(til.getTime() - (dagar - 1) * 86400000);
  const lykill = (d) => d.toISOString().slice(0, 10);
  const fraS = lykill(fra), tilS = lykill(til);

  let ajour, hours;
  try {
    // ATH: EKKI síað á registration_status — við þurfum bæði Done og ólokið.
    ajour = await fetchAll('ajour_registrations',
      `select=serial_number,category,checked_date,execution_date,registration_status&project_name=eq.${encodeURIComponent(NLSH_AJOUR)}`);
    const tvIn = NLSH_TIMAVERA.map(n => `"${n}"`).join(',');
    hours = await fetchAll('timavera_entries',
      `select=date,hours,employee,project&project=in.(${tvIn})&date=gte.${fraS}&date=lte.${tilS}`);
  } catch (e) { return json(502, { error: e.message }); }

  // ── Göt: eitt serial = eitt gat. Sama afvöfnun og borðið. ────────────────
  // Röð getur birst oftar en einu sinni (mörg gátlista-svör); gatið telst KLÁRAÐ
  // ef EINHVER röð þess er Done — annars ólokið.
  const got = new Map();   // serial → { nr, date, done }
  for (const r of ajour) {
    const sn = r.serial_number; if (!sn) continue;
    const eff = r.execution_date || r.checked_date || null;
    const done = r.registration_status === 'Done';
    const p = got.get(sn);
    if (!p) { got.set(sn, { nr: nrFromCategory(r.category), date: eff, done }); continue; }
    if (!p.date && eff) p.date = eff;
    if (p.nr == null) p.nr = nrFromCategory(r.category);
    if (done) p.done = true;
  }

  // ── Telja per starfsmann og dag ──────────────────────────────────────────
  const perNr = new Map();          // nr → Map(dagur → {klarad, olokid})
  const reit = (n, d) => {
    let m = perNr.get(n); if (!m) perNr.set(n, m = new Map());
    let c = m.get(d); if (!c) m.set(d, c = { klarad: 0, olokid: 0 });
    return c;
  };
  for (const g of got.values()) {
    if (!g.nr || !g.date) continue;
    const d = String(g.date).slice(0, 10);
    if (d < fraS || d > tilS) continue;
    const c = reit(g.nr, d);
    if (g.done) c.klarad++; else c.olokid++;
  }

  const klstNr = new Map();         // nr → Map(dagur → klst)
  for (const h of hours) {
    const hrs = +h.hours || 0; if (!hrs || !h.date) continue;
    const n = nrForEmployee(h.employee); if (!n) continue;
    const d = String(h.date).slice(0, 10);
    if (d < fraS || d > tilS) continue;
    let m = klstNr.get(n); if (!m) klstNr.set(n, m = new Map());
    m.set(d, (m.get(d) || 0) + hrs);
  }

  // ── Starfsmannalisti fyrir valgluggann: aðeins þeir sem eiga eitthvað í ───
  // glugganum, raðað eftir kláruðum götum. Tómur listi er verri en enginn —
  // þá veit notandinn ekki hvort valið er tómt eða gagnalaust.
  const starfsmenn = [];
  const allirNr = new Set([...perNr.keys(), ...klstNr.keys()]);
  for (const n of allirNr) {
    const dg = perNr.get(n) || new Map();
    const kl = klstNr.get(n) || new Map();
    let klarad = 0, olokid = 0, klst = 0;
    dg.forEach(v => { klarad += v.klarad; olokid += v.olokid; });
    kl.forEach(v => { klst += v; });
    starfsmenn.push({
      nr: n, nafn: (STAFF[n] && STAFF[n].name) || ('Starfsmaður ' + n),
      klarad, olokid, klst: Math.round(klst * 10) / 10,
    });
  }
  starfsmenn.sort((a, b) => b.klarad - a.klarad || a.nr - b.nr);

  // Án `nr`: allir starfsmenn, dagur fyrir dag. Vikuborðið á NLSH-síðunni
  // byggir bæði töluna „klárað" og „ólokið" á þessu — í EINU kalli, svo
  // síðan þurfi ekki að sækja borðið tvisvar (einu sinni Done, einu sinni
  // include_open) og draga í sundur sjálf.
  if (!nr) {
    const allir = [];
    for (const [n2, m] of perNr.entries()) {
      const kl = klstNr.get(n2);
      for (const [dags, v] of m.entries()) {
        allir.push({ nr: n2, dags, klarad: v.klarad, olokid: v.olokid,
          klst: Math.round(((kl && kl.get(dags)) || 0) * 10) / 10 });
      }
    }
    // Dagar með tíma en engin göt mega ekki detta út — þeir segja sína sögu
    // (mætt, en ekkert klárað).
    for (const [n2, m] of klstNr.entries()) {
      const g = perNr.get(n2);
      for (const [dags, klst] of m.entries()) {
        if (g && g.has(dags)) continue;
        allir.push({ nr: n2, dags, klarad: 0, olokid: 0, klst: Math.round(klst * 10) / 10 });
      }
    }
    allir.sort((a, b) => a.dags.localeCompare(b.dags) || a.nr - b.nr);
    return json(200, { nr: null, fra: fraS, til: tilS, dagar, starfsmenn, dagar_allir: allir, note: NOTA });
  }

  // ── Dagarnir sjálfir — ALLIR dagar í glugganum, líka þeir tómu. ───────────
  // Eyður eru upplýsingar: „ekkert þennan dag" er svar, ekki gat í töflunni.
  const dagLina = [];
  const dg = perNr.get(nr) || new Map();
  const kl = klstNr.get(nr) || new Map();
  for (let t = fra.getTime(); t <= til.getTime(); t += 86400000) {
    const d = new Date(t);
    const key = lykill(d);
    const c = dg.get(key) || { klarad: 0, olokid: 0 };
    const klst = Math.round((kl.get(key) || 0) * 10) / 10;
    dagLina.push({
      dags: key,
      vikudagur: VIKUDAGAR[d.getUTCDay()],
      helgi: d.getUTCDay() === 0 || d.getUTCDay() === 6,
      klarad: c.klarad,
      olokid: c.olokid,
      klst,
      got_per_klst: klst ? Math.round(c.klarad / klst * 100) / 100 : null,
    });
  }

  const s = dagLina.reduce((a, x) => {
    a.klarad += x.klarad; a.olokid += x.olokid; a.klst += x.klst;
    if (x.klarad || x.klst) a.virkir_dagar++;
    if (x.klarad > a.besti_dagur.klarad) a.besti_dagur = { dags: x.dags, klarad: x.klarad };
    return a;
  }, { klarad: 0, olokid: 0, klst: 0, virkir_dagar: 0, besti_dagur: { dags: null, klarad: 0 } });
  s.klst = Math.round(s.klst * 10) / 10;
  s.got_per_klst = s.klst ? Math.round(s.klarad / s.klst * 100) / 100 : null;
  s.klarad_per_virkan_dag = s.virkir_dagar ? Math.round(s.klarad / s.virkir_dagar * 10) / 10 : null;
  s.klst_per_virkan_dag = s.virkir_dagar ? Math.round(s.klst / s.virkir_dagar * 10) / 10 : null;

  return json(200, {
    nr,
    nafn: (STAFF[nr] && STAFF[nr].name) || ('Starfsmaður ' + nr),
    fra: fraS, til: tilS, dagar,
    samtals: s,
    dagar_lina: dagLina,
    starfsmenn,
    note: NOTA,
  });
};

const NOTA = 'Klárað = Ajour registration_status Done. Ólokið = gat skráð á starfsmanninn þennan dag sem er enn ekki Done — ' +
  'Ajour geymir ekki upphafsdag, svo þetta er EKKI „byrjað þennan dag". Klst koma úr Tímaveru og eru á starfsmann og dag, ekki á einstök göt.';

// ── Supabase ──────────────────────────────────────────────────────────────
async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items',
      },
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
