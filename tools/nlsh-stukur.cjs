#!/usr/bin/env node
// tools/nlsh-stukur.cjs — sundurliðun NLSH 4.–6. hæðar á STÚKUR úr hnitum Ajour (30.10.2026).
// Ajour geymir göt á teikningum sem ná yfir tvær stúkur (6H.pdf = S1+S2, „Brunayfirlit 6H“ = S4+S5 …). Hver skráning ber hnit
// (x,y) á teikningunni og atríum-bilið skilur vængina að — stærsta bilið í x ræður skiptingunni. AÐEINS LESTUR í Ajour.
//   node tools/nlsh-stukur.cjs [slóð-á-ajour-state.json]   → data/nlsh-stukur.json
// Krefst gildrar Ajour-lotu (luna-bridge: node ajour-fetch.js --login).
const fs = require('fs'), path = require('path');
const BASE = 'https://brunaholf.ajoursystem.net';
const STATE = process.argv[2] || 'C:/Users/Slokkvitaeki/luna-bridge/ajour-state.json';
const OUT = path.join(__dirname, '..', 'data', 'nlsh-stukur.json');
const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
const now = Date.now() / 1000;
const COOKIE = (st.cookies || []).filter((c) => /ajoursystem/i.test(c.domain || '')).filter((c) => !(c.expires > 0 && c.expires < now)).map((c) => `${c.name}=${c.value}`).join('; ');
const HDR = { Cookie: COOKIE, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
async function aj(p, init = {}) {
  const r = await fetch(BASE + p, { ...init, redirect: 'manual', headers: { ...HDR, ...(init.headers || {}) } });
  if (r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)) throw new Error('Ajour-lotan er útrunnin (' + r.status + ')');
  if (!r.ok) throw new Error('Ajour ' + r.status + ' ' + p);
  return r.json();
}
const body = (projectId, page) => ({ projectId, registrationSearch: { forProjectId: projectId, expandedSearch: false, ascending: true, currentPage: page, pageSize: 200,
  serialNumber: '', description: '', projectLevel1: null, projectLevel2: null, projectLevel3: null, projectLevelIncludeSub: true, projectLevelGroupBy: false,
  registrationTypeName: 'QA', registrationTypeId: 4, registrationHistoryTypeEnum: 'All', registrationHistoryTypes: 'All', executionFrom: null, executionTo: null,
  categoryGroupId: '', categoryId: '', assignedCompanyId: null, assignedToUser: '', forwardAssignedToUser: '', assignedDateFrom: null, assignedDateTo: null,
  createdDateFrom: null, createdDateTo: null, registrationDrawingName: '', registrationDeleted: false, registrationForwarded: false, allRegistrations: true,
  forwardedCompleted: false, forwardedRejected: false, commentedFrom: null, commentedTo: null, labelIds: [] } });

// [teikning, hæð, vinstri vængur, hægri vængur]. Flokkateikningar (Rafmagnsþéttingar) og „Viðbótarverkefni“ eru ekki hér.
const RULES = [
  [/^6H\.pdf/i, '6H', 'S1', 'S2'], [/Brunayfirlit 6H/i, '6H', 'S4', 'S5'], [/^6H4S/i, '6H', 'S4', 'S4'], [/^6H5S/i, '6H', 'S5', 'S5'],
  [/^5H 1S og 2S/i, '5H', 'S1', 'S2'], [/^5H\. Ceiling/i, '5H', 'S1', 'S2'], [/^5H\s+S4 \+ S5/i, '5H', 'S4', 'S5'],
  [/^4H\. S1-S2/i, '4H', 'S1', 'S2'], [/^4H\s+4S \+ 5S/i, '4H', 'S4', 'S5'],
];

// Hnit Ajour → Brunayfirlit-blað (A285-31 5H, A286-31 6H, Rev.A): pdf = x/kvarði + frávik, svo dregið frá útskurði (CROP).
// Fundið sjálfvirkt með því að para hnitin við RAUÐA brunaveggi blaðsins (30.10.2026). Sjá docs: hver Ajour-teikning hefur eigin kvarða.
const CROP = { x: 230, y: 265, w: 1930, h: 950 };
const TRANS = [
  [/^6H\.pdf/i, '6H', 1.58, 12.3, 34.1], [/Brunayfirlit 6H/i, '6H', 1.58, 2.1, 0.9],
  [/^5H 1S og 2S/i, '5H', 5.2906, 176.8, 207.2], [/^5H\s+S4 \+ S5/i, '5H', 3.22, 1372.1, 184.2],
];
const RAF = ['Raflagnaþéttingar, göt og raufar', 'Raufar. (Metrer) LV', 'Raf raufar. (Metrar og Stk.)', 'Raf göt (Stk.)'];
// Flokkahópur: 0 Loft, 1 Stál, 2 Rafmagn, 3 Gólf (milliloft), 4 Annað (plast o.fl.)
function hopur(c) { c = c || ''; return /^Loft/i.test(c) ? 0 : /^Stál/i.test(c) ? 1 : RAF.indexOf(c) >= 0 ? 2 : /^Gólf/i.test(c) ? 3 : 4; }
function punktar(regs) {
  const floors = { '5H': [], '6H': [] };
  for (const r of regs) {
    const c = r.coords[0]; if (!c) continue;
    const t = TRANS.find((x) => x[0].test(r.draw || '')); if (!t) continue;
    floors[t[1]].push([Math.round((c.x / t[2] + t[3] - CROP.x) * 10) / 10, Math.round((c.y / t[2] + t[4] - CROP.y) * 10) / 10, r.status === 4 ? 1 : 0, hopur(r.cat)]);
  }
  return floors;
}

function skiptaEftirHnitum(regs) {
  const byFile = {};
  for (const r of regs) { const c = r.coords[0]; if (c) (byFile[c.f] ??= []).push({ ...r, x: c.x, y: c.y }); }
  const wings = {};
  for (const a of Object.values(byFile)) {
    const rule = RULES.find((x) => x[0].test(a[0].draw || ''));
    if (!rule) continue;
    const xs = a.map((p) => p.x).sort((p, q) => p - q);
    let gi = 0, gm = 0;
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > gm) { gm = xs[i] - xs[i - 1]; gi = i; }
    const skil = xs.length > 1 && rule[2] !== rule[3] && gm > 150 ? (xs[gi - 1] + xs[gi]) / 2 : Infinity;
    // Norður / Center / Suður (skipting verktaka): brýrnar milli stúkna sjást sem dýfa í y-hnitum við ~27 % og ~72 % af
    // hæð teikningarinnar. Lítið y þýðir norður (efst á teikningu).
    const ys = a.map((p) => p.y);
    const ymn = Math.min(...ys), ymx = Math.max(...ys);
    for (const r of a) {
      const k = `${rule[1]} ${r.x < skil ? rule[2] : rule[3]}`;
      const w = (wings[k] ??= { done: 0, open: 0, cat: {}, catOpen: {}, mon: {}, z: { N: { done: 0, open: 0, cat: {} }, C: { done: 0, open: 0, cat: {} }, S: { done: 0, open: 0, cat: {} } } });
      const fy = (r.y - ymn) / ((ymx - ymn) || 1);
      const zz = w.z[fy < 0.275 ? 'N' : fy < 0.725 ? 'C' : 'S'];
      const zc = r.cat || '(tómt)';
      if (r.status === 4) { zz.done++; zz.cat[zc] = (zz.cat[zc] || 0) + 1; } else zz.open++;
      const ck = r.cat || '(tómt)';
      if (r.status === 4) {
        w.done++; w.cat[ck] = (w.cat[ck] || 0) + 1;
        // executionTo er „dd-mm-áááá“ (Ajour-tungumál innskráningar) — mánuðurinn er alltaf miðhlutinn.
        const dm = /^(\d{2})[-\/](\d{2})[-\/](\d{4})/.exec(String(r.exec || ''));
        if (dm) { const m = `${dm[3]}-${dm[2]}`; w.mon[m] = (w.mon[m] || 0) + 1; }
      } else { w.open++; w.catOpen[ck] = (w.catOpen[ck] || 0) + 1; }
    }
  }
  return wings;
}
module.exports = { skiptaEftirHnitum, RULES, punktar, TRANS, CROP };

if (require.main === module) (async () => {
  const projects = await aj('/api/construction/projects');
  const p = projects.find((x) => /NLSH 5-6/i.test(x.name));
  if (!p) throw new Error('NLSH-verk fannst ekki');
  const regs = [];
  for (let page = 1; page < 300; page++) {
    const j = await aj('/api/construction/registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(p.projectId, page)) });
    const arr = Array.isArray(j) ? j : (j.data || j.items || []);
    for (const r of arr) regs.push({ status: r.status, exec: r.executionTo, draw: r.blueprintName, cat: r.categoryGroupName || r.categoryGroup, coords: (r.registrationCoordinates || []).map((c) => ({ f: c.fileId, x: c.x, y: c.y })) });
    if (arr.length < 200) break;
  }
  const wings = skiptaEftirHnitum(regs);
  const PUNKTAR = path.join(__dirname, '..', 'data', 'nlsh-punktar.json');
  fs.writeFileSync(PUNKTAR, JSON.stringify({ updated: new Date().toISOString(), w: CROP.w, h: CROP.h, hopar: ['Loft', 'Stál', 'Rafmagn', 'Gólf', 'Annað'], floors: punktar(regs) }));
  const klarad = regs.filter((r) => r.status === 4).length;
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: 'Ajour hnit (registrationCoordinates), skipt við stærsta x-bil per teikningu', total: regs.length, done: klarad, open: regs.length - klarad, wings }, null, 1));
  console.log('skrifað', OUT, '| skráningar', regs.length, '| klárað', klarad);
  Object.keys(wings).sort().forEach((k) => console.log(k.padEnd(7), wings[k].done, 'opið', wings[k].open));
})().catch((e) => { console.error('VILLA', e.message); process.exit(1); });
