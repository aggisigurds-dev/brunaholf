// Flytur upprunalegu Drive-PDF-in inn í lifandi Skjalasafn (eydublod_skjol). Endurkeyranlegt: sleppir því sem er þegar innflutt.
//   node import.cjs --dry   → sýnir bara hvað yrði vistað
const fs = require('fs'), path = require('path');
const DRY = process.argv.includes('--dry');
const API = 'https://brunaholf.netlify.app/api/eydublod';
const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'parsed.json'), 'utf8'));

// Línur → málsgreinar: ný málsgrein byrjar á eftir línu sem endar á punkti.
function paras(lines) {
  const out = []; let cur = '';
  for (const l of lines) { cur = cur ? cur + ' ' + l : l; if (/[.:]$/.test(l)) { out.push(cur.trim()); cur = ''; } }
  if (cur) out.push(cur.trim());
  return out;
}
function entry(p) {
  const P = paras(p.body);
  let umraedir = '', nidurstada = '';
  const rest = [];
  P.forEach((t) => {
    if (!umraedir && /^Um ræðir/i.test(t)) umraedir = t;
    else if (!nidurstada && /^Að loknum/i.test(t)) nidurstada = t;
    else rest.push(t);
  });
  const inngangur = 'Brunahólf ehf. lýsir yfir að öll vinna og efni standist kröfur og reglugerðir samkvæmt leiðbeiningum Húsnæðis- og mannvirkjastofnunar (HMS) og öðrum viðeigandi reglugerðum.'
    + (p.medEftirf ? '\nEftirfarandi var unnið:' : '');
  const gogn = {
    stadur: p.stadur, dagsetning: p.dags, byggingar: '',
    inngangur, hvadVarGert: rest.join('\n'), umraedir, nidurstada,
    _innflutt: { drive_id: p.id, drive_titill: p.title, innflutt: new Date().toISOString().slice(0, 10), athugasemd: 'Upprunalegt PDF úr Drive; fastir hlutar skjalsins eru sóttir úr núverandi sniðmáti við Breyta.' },
  };
  return { gogn };
}

(async () => {
  const have = await (await fetch(API + '?form_id=yfirlysing-brunalokana&all=1')).json();
  const done = new Set((have.docs || []).map((d) => d.gogn && d.gogn._innflutt && d.gogn._innflutt.drive_id).filter(Boolean));
  const list = parsed.filter((p) => p.dags && p.stadur && !/Straumhella/.test(p.title)).sort((a, b) => a.dags.localeCompare(b.dags));
  let ok = 0, skip = 0, fail = 0;
  for (const p of list) {
    if (done.has(p.id)) { skip++; continue; }
    const { gogn } = entry(p);
    const pdf = fs.readFileSync(path.join(__dirname, 'pdfs', p.id + '.pdf'));
    const fileName = p.title.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
    console.log(DRY ? 'DRY ' : 'POST', p.dags, '|', p.stadur.slice(0, 55), '|', (pdf.length / 1024 | 0) + ' KB', '|', gogn.hvadVarGert.split('\n').length + 'h', gogn.umraedir ? 'U' : '-', gogn.nidurstada ? 'N' : '-');
    if (DRY) continue;
    const body = { action: 'save', form_id: 'yfirlysing-brunalokana', titill: 'Staðfesting brunalokana', stadur: p.stadur, dagsetning: p.dags, gogn, fileName, contentBase64: pdf.toString('base64') };
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok && j.ok) ok++; else { fail++; console.log('  VILLA', r.status, JSON.stringify(j).slice(0, 200)); }
    } catch (e) { fail++; console.log('  VILLA', e.message); }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log({ vistað: ok, sleppt_þegar_til: skip, villur: fail, alls: list.length });
})();
