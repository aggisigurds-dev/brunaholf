#!/usr/bin/env node
/**
 * Þáttunarpróf á inline <script> blokkum í HTML-skrám.
 *
 * AF HVERJU ÞETTA ER TIL
 * 2026-08-08 varð brunaholf.netlify.app ALVEG tómt — hausinn birtist en ekkert
 * efni. Orsökin var EINN vantandi `}` í template-segð í „Fast verð"-reitnum
 * (kom inn með #380):
 *     value="${escapeAttr(...)"      ← brotið
 *     value="${escapeAttr(...)}"     ← rétt
 * SyntaxError í inline script fellir ALLAN blokkina — hér 1,2 MB, þ.e. allt
 * appið. Netlify byggir ekkert fyrir þetta repo: index.html er borin fram eins
 * og hún er, svo deploy-preview varð „grænn" því afritunin tókst. Að skráin
 * KEYRI ekki var aldrei mælt.
 *
 * Þetta próf lokar þeirri gloppu: það þáttar hverja inline-blokk og fellur með
 * skráarnafni + LÍNUNÚMERI Í UPPRUNALEGU HTML-SKRÁNNI (ekki í útdrættinum —
 * annars er villan ófinnanleg í 18.000 lína skrá).
 *
 * Keyrsla:  node tools/check-inline-js.cjs [skrár…]     (sjálfgefið: allar *.html)
 * Skilar 0 ef allt þáttast, 1 annars.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

// Blokk sem ber src= er ytri skrá; type sem er ekki JS (json-ld, text/template,
// x-handlebars …) á ekki að þáttast sem JavaScript.
function isJs(attrs) {
  if (/\bsrc\s*=/i.test(attrs)) return false;
  const m = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
  if (!m) return true;
  const t = m[1].toLowerCase();
  return t === 'text/javascript' || t === 'application/javascript' || t === 'module';
}
function isModule(attrs) {
  const m = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
  return !!m && m[1].toLowerCase() === 'module';
}

// HTML-athugasemdir eru NÚLLAÐAR áður en leitað er — en LENGD og línuskil
// varðveitt, svo offset og línunúmer haldist rétt. Ástæðan er mæld: jarvis.html
// ber orðið `<script>` inni í athugasemd („svo ein <script>-lína dugar"), og án
// þessa las prófið athugasemdatextann sem JavaScript og féll á `Unexpected
// identifier 'dugar'`. Vörður sem gaggar að engu kennir fólki að líta undan.
function blankComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
}

function checkFile(file) {
  const src = blankComments(fs.readFileSync(file, 'utf8'));
  const problems = [];
  let blocks = 0;
  let m;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(src)) !== null) {
    const [, attrs, body] = m;
    if (!isJs(attrs) || !body.trim()) continue;
    blocks++;
    // Lína þar sem blokkin BYRJAR í upprunalegu skránni — svo villunúmerið
    // vísi á raunverulegan stað, ekki á útdráttinn.
    const startLine = src.slice(0, m.index).split('\n').length;
    try {
      // `new vm.Script` þáttar án þess að KEYRA. Module-blokkir mega bera
      // import/export á efsta stigi, svo þær eru vafðar í async-fall sem
      // leyfir top-level await en fellur samt á raunverulegri málvillu.
      const code = isModule(attrs) ? '(async()=>{' + body + '})' : body;
      new vm.Script(code, { filename: file, lineOffset: startLine - 1 });
    } catch (e) {
      // Skilaboð Node bera línu miðað við lineOffset → rétt HTML-lína.
      const where = (e.stack || '').split('\n').find(l => l.includes(file)) || '';
      problems.push({ startLine, msg: e.message, where: where.trim() });
    }
  }
  return { file, blocks, problems };
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : fs.readdirSync(process.cwd()).filter(f => f.endsWith('.html')).sort();

let bad = 0, totalBlocks = 0;
const rows = [];
for (const f of files) {
  if (!fs.existsSync(f)) { console.error('vantar skrá: ' + f); bad++; continue; }
  const r = checkFile(f);
  totalBlocks += r.blocks;
  rows.push(r);
  if (r.problems.length) bad += r.problems.length;
}

const pad = Math.max(...rows.map(r => r.file.length), 10);
for (const r of rows) {
  const tag = r.problems.length ? '❌' : (r.blocks ? '✅' : '· ');
  console.log(tag + ' ' + r.file.padEnd(pad) + '  ' + String(r.blocks).padStart(3) + ' inline-blokk'
    + (r.blocks === 1 ? '' : 'ir'));
  for (const p of r.problems) {
    console.log('     ↳ blokk sem byrjar á línu ' + p.startLine + ': ' + p.msg);
    if (p.where) console.log('       ' + p.where);
  }
}
console.log('\n' + files.length + ' skrár · ' + totalBlocks + ' inline-blokkir · '
  + (bad ? bad + ' ÞÁTTAST EKKI' : 'allar þáttast'));
if (bad) {
  console.log('\nSyntaxError í inline script fellir ALLA blokkina — og þar með síðuna.');
  console.log('Sjá haus-athugasemdina í tools/check-inline-js.cjs (niðurfallið 2026-08-08).');
}
process.exit(bad ? 1 : 0);
