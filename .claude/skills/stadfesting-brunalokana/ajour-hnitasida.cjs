// Viðaukasíða fyrir Staðfestingu: grunnmynd úr Ajour með grænum númeruðum punktum (eins og „Sýna hnit").
// Notkun: node ajour-hnitasida.cjs <exportMappa-verks> <stadfesting.pdf> <út.pdf> [titill] [crop=x0,y0,x1,y1]
//   exportMappa = mappan sem luna-bridge/ajour-export-allt.js bjó til (skraningar.json + teikningar/*.jpg)
//   stadfesting.pdf = PDF úr Eyðublöð; viðaukasíðunni er bætt AFTAN við (pdf-lib úr NODE_PATH/PDFLIB)
const fs = require('fs');
const path = require('path');
const BH = process.env.BRUNAHOLF || 'C:/Users/Slokkvitaeki/brunaholf';
const { jsPDF } = require(BH + '/js/jspdf.umd.min.js');
const { PDFDocument } = require(process.env.PDFLIB || 'pdf-lib');

const [DIRARG, STADF, OUT, TITILL_ARG, CROP_ARG] = process.argv.slice(2);
const DIR = path.resolve(DIRARG);
const j = JSON.parse(fs.readFileSync(path.join(DIR, 'skraningar.json'), 'utf8'));
const TITILL = TITILL_ARG || (j.project && j.project.name) || path.basename(DIR);

function dim(buf) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xFF) { i++; continue; } const m = buf[i + 1]; if (m >= 0xC0 && m <= 0xC3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + buf.readUInt16BE(i + 2); } }

// Hnit: ein skráning getur verið á fleiri en einni teikningu; notum fyrstu teikninguna sem hefur punkta.
const pins = [];
j.skraningar.forEach((r) => (r.registrationCoordinates || []).forEach((c) => pins.push({ nr: Number(r.serialNumber), x: c.x, y: c.y, file: c.fileId })));
const fileId = pins[0].file;
const mine = pins.filter((p) => p.file === fileId);
const imgBuf = fs.readFileSync(path.join(DIR, 'teikningar', fileId + '.jpg'));
const [IW, IH] = dim(imgBuf);

const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
for (const [st, f] of Object.entries({ normal: 'regular', bold: 'bold' })) {
  doc.addFileToVFS(`carlito-${f}.ttf`, fs.readFileSync(`${BH}/fonts/carlito-${f}.ttf`).toString('base64'));
  doc.addFont(`carlito-${f}.ttf`, 'carlito', st);
}
const W = doc.internal.pageSize.getWidth(), M = 72, CW = W - 2 * M;

// Haus eins og á Staðfestingunni
const logo = fs.readFileSync(BH + '/img/yfirlysing-logo.jpg');
const headTop = 36;
doc.addImage(logo, 'JPEG', M + (CW - 146.9) / 2, headTop, 146.9, 35.3);
doc.setFont('carlito', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
doc.text('BRUNAHÓLF EHF.', M, headTop + 35.3);
doc.setFont('carlito', 'normal');
doc.text('Staðfesting brunalokana', M + CW, headTop + 35.3, { align: 'right' });
const r2 = headTop + 35.3 + 12.65;
doc.text('Leyfisnúmer 202209-0174', M, r2);
doc.text('Ábyrgðarmaður: Annþór Kristján Karlsson', M + CW, r2, { align: 'right' });
doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(M, r2 + 3, M + CW, r2 + 3);

doc.setFont('carlito', 'bold'); doc.setFontSize(14);
doc.text(TITILL, W / 2, r2 + 40, { align: 'center' });
doc.setFont('carlito', 'normal'); doc.setFontSize(12);
doc.text('Staðsetning brunaþéttinga á teikningu', W / 2, r2 + 58, { align: 'center' });

// Útklipp: umhverfis punktana með spássíu, hlutfall = kassinn á síðunni
const BOXW = CW, BOXH = 400, BOXY = r2 + 74;
let [x0, y0, x1, y1] = CROP_ARG ? CROP_ARG.split(',').map(Number) : [null, null, null, null];
if (x0 == null) {
  const xs = mine.map((p) => p.x), ys = mine.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + 220, 360);
  const h = w * BOXH / BOXW;
  x0 = cx - w / 2; x1 = cx + w / 2; y0 = cy - h / 2; y1 = cy + h / 2;
}
const sc = BOXW / (x1 - x0);                      // pt á pixla
const boxH = (y1 - y0) * sc;
doc.saveGraphicsState();
doc.rect(M, BOXY, BOXW, boxH, null); doc.clip(); doc.discardPath();
doc.addImage(imgBuf, 'JPEG', M - x0 * sc, BOXY - y0 * sc, IW * sc, IH * sc);
// Punktar
const P2 = mine.map((p) => ({ ...p, px: M + (p.x - x0) * sc, py: BOXY + (p.y - y0) * sc }));
// Klasar: punktar innan 7 pt frá hver öðrum fá númerin sín dreifð með leiðarlínu, svo ekkert skarist.
const klasar = [];
P2.forEach((p) => {
  const k = klasar.find((c) => c.some((q) => Math.hypot(q.px - p.px, q.py - p.py) < 7));
  if (k) k.push(p); else klasar.push([p]);
});
const DOT = 2.6, STEP = 11;
const labels = [];
klasar.forEach((k) => {
  k.sort((a, b) => a.px - b.px || a.py - b.py);
  const cx = k.reduce((s, p) => s + p.px, 0) / k.length, cy = k.reduce((s, p) => s + p.py, 0) / k.length;
  const nearTop = cy < BOXY + boxH * 0.45;       // efst á teikningunni: númer upp á við, annars niður á við
  const ly = nearTop ? cy - 16 : cy + 20;
  k.forEach((p, i) => labels.push({ p, lx: cx + (i - (k.length - 1) / 2) * STEP, ly }));
});
doc.setDrawColor(30, 30, 30); doc.setLineWidth(0.4);
labels.forEach(({ p, lx, ly }) => doc.line(p.px, p.py, lx, ly + (ly < p.py ? 2 : -7)));
P2.forEach((p) => {
  doc.setFillColor(40, 200, 40); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
  doc.circle(p.px, p.py, DOT, 'FD');
});
labels.forEach(({ p, lx, ly }) => {
  doc.setFont('carlito', 'bold'); doc.setFontSize(8.5);
  doc.setTextColor(255); [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]].forEach(([dx, dy]) => doc.text(String(p.nr), lx + dx, ly + dy, { align: 'center' }));
  doc.setTextColor(0); doc.text(String(p.nr), lx, ly, { align: 'center' });
});
doc.restoreGraphicsState();
doc.setDrawColor(150); doc.setLineWidth(0.5); doc.rect(M, BOXY, BOXW, boxH);

// Skýring: númer = skráningarnúmer í Ajour
doc.setFont('carlito', 'normal'); doc.setFontSize(10); doc.setTextColor(60);
doc.text('Grænn punktur = brunaþétting skráð í gæðakerfi Brunahólfs (Ajour). Númer = skráningarnúmer.', M, BOXY + boxH + 16);
doc.text(`${mine.length} skráðar brunaþéttingar á teikningunni.`, M, BOXY + boxH + 30);
if (process.argv[7]) doc.text(process.argv[7], M, BOXY + boxH + 44);   // valfrjáls viðbótarlína, t.d. um umfang

(async () => {
  const main = await PDFDocument.load(fs.readFileSync(STADF));
  const app = await PDFDocument.load(Buffer.from(doc.output('arraybuffer')));
  const pages = await main.copyPages(app, app.getPageIndices());
  pages.forEach((p) => main.addPage(p));
  fs.writeFileSync(OUT, await main.save());
  console.log(OUT, main.getPageCount(), 'síður; crop', [x0, y0, x1, y1].map(Math.round).join(','));
})();
