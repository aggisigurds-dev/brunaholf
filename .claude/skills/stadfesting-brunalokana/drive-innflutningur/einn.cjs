// Flytur EITT Drive-PDF inn í Skjalasafnið (eydublod_skjol), merkt _innflutt. Endurkeyranlegt: sleppir ef drive_id er þegar til.
//   node einn.cjs <drive_id> <niðurhal.json úr Drive-tengi> --dry
// Dæmi 03.11.2026: Gullslétta 18 (staðfesting 28.10.2026, send sama dag) vantaði í safnið.
const fs = require('fs');
const [id, src] = process.argv.slice(2);
const DRY = process.argv.includes('--dry');
const API = 'https://brunaholf.netlify.app/api/eydublod';
const d = JSON.parse(fs.readFileSync(src, 'utf8'));
const pdf = Buffer.from(d.content, 'base64');
if (pdf.slice(0, 4).toString() !== '%PDF') { console.log('ekki PDF'); process.exit(1); }
const gogn = {
  stadur: 'Gullslétta 18', dagsetning: '2026-10-28', byggingar: '',
  inngangur: 'Brunahólf ehf. lýsir yfir að öll vinna og efni standist kröfur og reglugerðir samkvæmt leiðbeiningum Húsnæðis- og mannvirkjastofnunar (HMS) og öðrum viðeigandi reglugerðum.',
  hvadVarGert: 'Brunahólfun í Gullsléttu 18 var yfirfarin og lagfærð þar sem þörf var á, byggt á sjónrænu mati.\nStaðfesting þessi tekur eingöngu til þeirra brunaþéttinga sem eru skráðar í gæðakerfi Brunahólfs og merktar með staðfestingu félagsins, þar sem hluti lokana hafði verið framkvæmdur áður en Brunahólf kom að verkinu.',
  umraedir: '', nidurstada: '',
  _innflutt: { drive_id: id, drive_titill: d.title, innflutt: new Date().toISOString().slice(0, 10), athugasemd: 'Upprunalegt PDF úr Drive (staðfesting send verkkaupa 28.10.2026); fastir hlutar skjalsins eru sóttir úr núverandi sniðmáti við Breyta.' },
};
(async () => {
  const have = await (await fetch(API + '?form_id=yfirlysing-brunalokana&all=1')).json();
  if ((have.docs || []).some((x) => x.gogn && x.gogn._innflutt && x.gogn._innflutt.drive_id === id)) { console.log('þegar til'); return; }
  console.log(DRY ? 'DRY' : 'POST', gogn.stadur, gogn.dagsetning, (pdf.length / 1024 | 0) + ' KB');
  if (DRY) return;
  const body = { action: 'save', form_id: 'yfirlysing-brunalokana', titill: 'Staðfesting brunalokana', stadur: gogn.stadur, dagsetning: gogn.dagsetning, gogn, fileName: 'Stadfesting_Gullslétta_18.pdf'.replace('é', 'e'), contentBase64: pdf.toString('base64') };
  const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  console.log(r.status, JSON.stringify(await r.json()).slice(0, 300));
})();
