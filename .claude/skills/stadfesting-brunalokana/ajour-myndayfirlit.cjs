// Yfirlit ljósmynda úr Ajour: 8 myndir á síðu (A4 langsnið, 4×2), engin komment.
// Notkun: node ajour-myndayfirlit.cjs <exportMappa-verks> [titill] [úttaksskrá]
//   exportMappa = mappan sem luna-bridge/ajour-export-allt.js bjó til (skraningar.json + myndir/)
const fs = require('fs');
const path = require('path');
const BH = process.env.BRUNAHOLF || 'C:/Users/Slokkvitaeki/brunaholf';
const { jsPDF } = require(BH + '/js/jspdf.umd.min.js');

const ARGV = process.argv.slice(2); // <exportMappa> [titill] [úttaksskrá]
const DIR = path.resolve(ARGV[0] || path.join(__dirname, 'Sunnukriki 3 Morfellsbær'));
const j = JSON.parse(fs.readFileSync(path.join(DIR, 'skraningar.json'), 'utf8'));
const TITILL = ARGV[1] || (j.project && j.project.name) || path.basename(DIR);
const UNDIRTITILL = 'Brunaþéttingar · ljósmyndir úr Ajour';


const myndir = [];
j.skraningar.slice().sort((a, b) => Number(a.serialNumber) - Number(b.serialNumber)).forEach((r) => {
  const nr = Number(r.serialNumber);
  (r.photos || []).forEach((p) => myndir.push({ nr, fl: r.categoryGroupName || '', file: path.join(DIR, 'myndir', p.fileId + '.jpg') }));
});

const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape', compress: true });
for (const [st, f] of Object.entries({ normal: 'regular', bold: 'bold' })) {
  const file = `carlito-${f}.ttf`;
  const cand = fs.readdirSync(BH + '/fonts').find((x) => x.toLowerCase().includes('carlito') && x.toLowerCase().includes(f) && !x.toLowerCase().includes('italic'));
  doc.addFileToVFS(file, fs.readFileSync(BH + '/fonts/' + cand).toString('base64'));
  doc.addFont(file, 'carlito', st);
}
const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
const M = 30, GAP = 10, COLS = 4, ROWS = 2, TOP = 58, BOT = 24;
const cw = (W - 2 * M - GAP * (COLS - 1)) / COLS;
const ch = (H - TOP - BOT - GAP * (ROWS - 1)) / ROWS;
const perSida = COLS * ROWS;
const sidur = Math.ceil(myndir.length / perSida);

function haus(n) {
  doc.setFont('carlito', 'bold'); doc.setFontSize(14); doc.setTextColor(20);
  doc.text(TITILL, M, 30);
  doc.setFont('carlito', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
  doc.text(UNDIRTITILL, M, 44);
  doc.text(`Síða ${n} af ${sidur}`, W - M, 30, { align: 'right' });
  doc.setDrawColor(190); doc.line(M, 50, W - M, 50);
}
function dim(buf) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xFF) { i++; continue; } const m = buf[i + 1]; if (m >= 0xC0 && m <= 0xC3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + buf.readUInt16BE(i + 2); } }

myndir.forEach((m, i) => {
  const pos = i % perSida;
  if (pos === 0) { if (i > 0) doc.addPage(); haus(Math.floor(i / perSida) + 1); }
  const x = M + (pos % COLS) * (cw + GAP);
  const y = TOP + Math.floor(pos / COLS) * (ch + GAP);
  const buf = fs.readFileSync(m.file);
  const [iw, ih] = dim(buf);
  const capH = 14, boxH = ch - capH;
  const sc = Math.min(cw / iw, boxH / ih);
  const w = iw * sc, h = ih * sc;
  doc.addImage(buf, 'JPEG', x + (cw - w) / 2, y + (boxH - h) / 2, w, h);
  doc.setFont('carlito', 'bold'); doc.setFontSize(9); doc.setTextColor(30);
  doc.text(`#${m.nr}`, x, y + ch - 3);
  doc.setFont('carlito', 'normal'); doc.setTextColor(90);
  doc.text(m.fl, x + 22, y + ch - 3);
});

const out = path.resolve(ARGV[2] || path.join(path.dirname(DIR), path.basename(DIR).replace(/s+/g, '_') + '_myndayfirlit_8-a-sidu.pdf'));
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log(out, myndir.length, 'myndir', sidur, 'síður');
