// Les niðurhalaðar Drive-skrár (tool-results), dregur út texta og greinir reiti. Skrifar parsed.json + pdfs/<id>.pdf
const fs = require('fs'), path = require('path');
const DIR = 'C:/Users/Slokkvitaeki/.claude/projects/C--Users-Slokkvitaeki/5703e450-58b6-4dba-a31e-0cd005b56ac0/tool-results';
const OUT = path.join(__dirname, 'pdfs'); fs.mkdirSync(OUT, { recursive: true });
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function lines(buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const rows = new Map();
    tc.items.forEach((it) => { const y = Math.round(it.transform[5]); (rows.get(y) || rows.set(y, []).get(y)).push(it); });
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, its]) => {
      its.sort((a, b) => a.transform[4] - b.transform[4]);
      out.push(its.map((i) => i.str).join('').replace(/\s+/g, ' ').trim());
    });
  }
  return { pages: doc.numPages, lines: out.filter(Boolean) };
}
const isoDate = (s) => { const m = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/.exec(s || ''); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; };

(async () => {
  const res = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.includes('download_file_content'))) {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (j.mimeType !== 'application/pdf' || !/Sta[ðd]festing/i.test(j.title)) { console.log('SKIP', j.title); continue; }
    const buf = Buffer.from(j.content, 'base64');
    fs.writeFileSync(path.join(OUT, j.id + '.pdf'), buf);
    const { pages, lines: L } = await lines(buf);
    const iHead = L.findIndex((l) => /Leyfisn/i.test(l));
    const iDate = L.findIndex((l) => /^Dagsetning/i.test(l));
    const iIntro = L.findIndex((l) => /lýsir yfir/i.test(l));
    const iFram = L.findIndex((l) => /^Framkvæmd og gæðaviðmið/i.test(l));
    let stadur = '', dags = null;
    if (iDate >= 0) {
      dags = isoDate(L[iDate]);
      // staðurinn er á línum milli „Leyfisnúmer" og „Dagsetning"; stundum er Dagsetning á sömu línu og staður
      const before = L.slice(iHead + 1, iDate).filter(Boolean);
      const same = L[iDate].replace(/Dagsetning:.*$/i, '').trim();
      stadur = [...before, same].filter(Boolean).join(', ');
    }
    // Á sumum skjölum er „Dagsetning" á sömu línu og staður
    if (iDate < 0) { const k = L.findIndex((l) => /Dagsetning:/i.test(l)); if (k >= 0) { dags = isoDate(L[k]); stadur = L.slice(iHead + 1, k).concat(L[k].replace(/Dagsetning:.*$/i, '').trim()).filter(Boolean).join(', '); } }
    const iHv = L.findIndex((l, i) => i > iIntro && /^Hvað var gert/i.test(l));
    const body = (iHv >= 0 && iFram > iHv) ? L.slice(iHv + 1, iFram) : [];
    // inngangur: með eða án „Eftirfarandi var unnið:"
    const intro = L.slice(iIntro, iHv >= 0 ? iHv : iIntro + 1).join(' ');
    const medEftirf = /Eftirfarandi var unni/.test(intro);
    res.push({ id: j.id, title: j.title, pages, stadur, dags, medEftirf, body, firstLines: L.slice(0, 6), nL: L.length });
  }
  fs.writeFileSync(path.join(__dirname, 'parsed.json'), JSON.stringify(res, null, 1));
  res.sort((a, b) => String(a.dags).localeCompare(String(b.dags)));
  res.forEach((r) => console.log(r.dags, '|', r.stadur.slice(0, 70), '|', r.pages + 's', '|', r.body.length + ' línur', '|', r.title.slice(0, 40)));
  console.log(res.length, 'skjöl');
})();
