// Tilbod — Arleg yfirferd brunavarna i sameign
// Husfelag Birkimelur 10, 10A og 10B, Reykjavik

const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, ImageRun, PageBreak, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, TabStopType, TabStopPosition
} = require('docx');

// ============================================================
// EDITABLE FIELDS — change these before sending
// ============================================================
// ============================================================
// COMPANY (sjaldan breytt)
// ============================================================
const COMPANY = {
  nafn: 'Slökkvitæki ehf.',
  kt: 'Kt. 600508-0400  ·  Vsk. nr. 98107',
  heimilisfang: 'Helluhrauni 10',
  postnrStadur: '220 Hafnarfjörður',
  simi: '565-4080',
  netfang: 'eldklar@eldklar.is',
};

// ============================================================
// RATES (sjaldan breytt — verðskrá fyrirtækisins)
// ============================================================
const RATES = {
  // Árleg yfirferð (kr. án vsk., per stk.)
  yfirferdLettvatn:   3150,
  yfirferdCO2:        3270,
  yfirferdSkynjari:   2345,
  // 5-ára hleðsla (kr. án vsk., per stk.)
  hledslaLettvatn:    6782,
  hledslaCO2:         6900,
  // Nýtt tæki (kr. án vsk., per stk.)
  nyttLettvatn6kg:   11693,
  nyttLettvatn6L:    11693,
  nyttCO2:           23790,
  nyttSkynjari:       5363,
  // Annað
  skilti:             1650,
  uppsetningKlst:    16500,
  akstur:             3000,
  skyrsla:            3500,
  // Sérkjör
  serkjor:             0.80,   // 20% afslattur
  vskRate:             0.24,
};

// ============================================================
// BUILDING (breytt í hvert sinn — per tilboð)
// ============================================================
const BUILDING = {
  // Hver er verkkaupinn
  husfelag:     'Húsfélag Birkimelur 10, 10A og 10B',
  byggAdr:      '107 Reykjavík',

  // Bygging
  stiga:        3,        // fjöldi stigaganga
  haedir:       5,        // fjöldi hæða (ekki kjallari)
  kjallari:     true,     // er kjallari með sameign?
  ibudir:       31,

  // Búnaður á hverri hæð per stigi
  lettvatnPerHaed:     1,     // lettvatn 6kg per haed per stigi
  skynjariPerHaed:     1,
  // Búnaður í kjallara per stigi
  co2IKjallara:        true,  // CO2 5kg við rafmagnstoflu
  lettvatn6LIKjallara: 1,     // fjöldi 6L lettvatn í kjallara per stigi
  skynjariIKjallara:   2,
  skiltiPerStigi:      1,

  // Vinna
  uppsetningKlst:      5,     // klst sem þarf í uppsetningu

  // Tilboð
  tegund:      'uppsetning',  // 'uppsetning' eða 'yfirferd'
  tilbodNr:    '2026-001',
  dagsetning:  '22. maí 2026',
  tengilidur:  'Agnar Sigurðsson',
  starfsheiti: '[Starfsheiti / fagréttindi]',
};

// ============================================================
// Útreiknað magn (drífst af BUILDING)
// ============================================================
const N = (() => {
  const b = BUILDING;
  const lettvatn6kg = b.stiga * b.haedir * b.lettvatnPerHaed;
  const co2         = b.co2IKjallara && b.kjallari ? b.stiga * 1 : 0;
  const lettvatn6L  = b.kjallari ? b.stiga * b.lettvatn6LIKjallara : 0;
  const skynjari    = b.stiga * (b.haedir * b.skynjariPerHaed + (b.kjallari ? b.skynjariIKjallara : 0));
  const skilti      = b.stiga * b.skiltiPerStigi;
  return { lettvatn6kg, co2, lettvatn6L, skynjari, skilti, uppsetnKlst: b.uppsetningKlst };
})();

// Aliases for legacy text below (do not edit — derived)
const FYRIRTAEKI  = COMPANY.nafn;
const KENNITALA   = COMPANY.kt;
const HEIMILISFANG = COMPANY.heimilisfang;
const POSTNR_STADUR = COMPANY.postnrStadur;
const SIMI        = COMPANY.simi;
const NETFANG     = COMPANY.netfang;
const TILBOD_NR   = BUILDING.tilbodNr;
const DAGSETNING  = BUILDING.dagsetning;
const TENGILIDUR  = BUILDING.tengilidur;
const STARFSHEITI = BUILDING.starfsheiti;

const VERD_AKSTUR          = RATES.akstur;
const VERD_SKYRSLA         = RATES.skyrsla;
const VERD_UPPSETNING_KLST = RATES.uppsetningKlst;
const N_UPPSETNING_KLST    = N.uppsetnKlst;

const VERD_LETTVATN_6KG = RATES.yfirferdLettvatn;
const VERD_CO2_5KG      = RATES.yfirferdCO2;
const VERD_LETTVATN_6L  = RATES.yfirferdLettvatn;
const VERD_REYKSKYNJARI = RATES.yfirferdSkynjari;

const N_LETTVATN_6KG = N.lettvatn6kg;
const N_CO2_5KG      = N.co2;
const N_LETTVATN_6L  = N.lettvatn6L;
const N_REYKSKYNJARI = N.skynjari;
const N_SKILTI       = N.skilti;
const N_UPPSETN_KLST = N.uppsetnKlst;

const VERD_NYTT_LETTV6KG = RATES.nyttLettvatn6kg;
const VERD_NYTT_LETTV6L  = RATES.nyttLettvatn6L;
const VERD_NYTT_CO2      = RATES.nyttCO2;
const VERD_NYTT_SKYN     = RATES.nyttSkynjari;
const VERD_SKILTI        = RATES.skilti;
const SERKJOR            = RATES.serkjor;

// ============================================================
// Sundurliðun lína (eingöngu þær sem eiga við)
// ============================================================
const lina = (lysing, magn, einingaverd) => ({
  lysing, magn, einingaverd, samtals: magn * einingaverd
});

const linur = BUILDING.tegund === 'uppsetning' ? [
  lina('Slökkvitæki léttvatn 6 kg (stigapallar) — sérkjör –20%', N.lettvatn6kg, Math.round(RATES.nyttLettvatn6kg * RATES.serkjor)),
  lina('Slökkvitæki CO₂ 5 kg (rafmagnstafla í kjallara) — sérkjör –20%', N.co2, Math.round(RATES.nyttCO2 * RATES.serkjor)),
  lina('Slökkvitæki léttvatn 6 L (kjallari) — sérkjör –20%', N.lettvatn6L, Math.round(RATES.nyttLettvatn6L * RATES.serkjor)),
  lina('Samtengjanlegir reykskynjarar — sérkjör –20%', N.skynjari, Math.round(RATES.nyttSkynjari * RATES.serkjor)),
  lina('Slökkvitækjamerki sjálflýsandi 150×150 (1 á hvern stigagang)', N.skilti, RATES.skilti),
  lina('Uppsetning (klst.)', N.uppsetnKlst, RATES.uppsetningKlst),
].filter(l => l.magn > 0) : [
  lina('Akstur (per ferð)', 1, RATES.akstur),
  lina('Skýrslugerð í þjónustuskoðun', 1, RATES.skyrsla),
  lina('Árleg yfirferð slökkvitækja, léttvatn 6 kg (stigagangar)', N.lettvatn6kg, RATES.yfirferdLettvatn),
  lina('Árleg yfirferð slökkvitækja, CO₂ 5 kg (rafmagnstafla í kjallara)', N.co2, RATES.yfirferdCO2),
  lina('Árleg yfirferð slökkvitækja, léttvatn 6 L (kjallari)', N.lettvatn6L, RATES.yfirferdLettvatn),
  lina('Árleg yfirferð samtengdra reykskynjara í sameign', N.skynjari, RATES.yfirferdSkynjari),
].filter(l => l.magn > 0);

const heildVskLaus = linur.reduce((sum, l) => sum + l.samtals, 0);
const vsk = Math.round(heildVskLaus * RATES.vskRate);
const heildMedVsk = heildVskLaus + vsk;
const isk = n => n.toLocaleString('is-IS') + ' kr.';

// ============================================================
// Dynamic schematic SVG generator — adapts to BUILDING config
// ============================================================
const { execSync } = require('child_process');

function generateSchematicSVG(b, n) {
  const stiga = b.stiga;
  const haedir = b.haedir;
  const kjallari = b.kjallari;
  const ibudir = b.ibudir;
  const co2 = b.co2IKjallara && kjallari;

  // Plan view geometry
  const planY = 110, planH = 110;
  const planLeft = 20, planRight = 740;
  const planW = planRight - planLeft;
  const segW = planW / stiga;
  const stairW = Math.min(60, segW * 0.25);
  const aptW = (segW - stairW) / 2;

  let planSvg = `<rect x="${planLeft}" y="${planY}" width="${planW}" height="${planH}" fill="none" stroke="#333" stroke-width="2"/>`;
  for (let i = 0; i < stiga; i++) {
    const x0 = planLeft + i * segW;
    planSvg += `<rect x="${x0+1}" y="${planY+1}" width="${aptW-1}" height="${planH-2}" fill="#f4f4f3" stroke="#aaa"/>`;
    planSvg += `<text x="${x0+aptW/2}" y="${planY+planH/2+4}" font-size="10" fill="#666" text-anchor="middle">íbúð</text>`;
    const sx = x0 + aptW;
    planSvg += `<rect x="${sx}" y="${planY+1}" width="${stairW}" height="${planH-2}" fill="#fff4d6" stroke="#333" stroke-width="1.5"/>`;
    planSvg += `<text x="${sx+stairW/2}" y="${planY+48}" font-size="12" font-weight="600" text-anchor="middle">Stigi ${String.fromCharCode(65+i)}</text>`;
    planSvg += `<circle cx="${sx+stairW/2-10}" cy="${planY+20}" r="7" fill="#d93838"/>`;
    planSvg += `<text x="${sx+stairW/2-10}" y="${planY+24}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">F</text>`;
    planSvg += `<circle cx="${sx+stairW/2+10}" cy="${planY+20}" r="6" fill="#2563eb"/>`;
    planSvg += `<text x="${sx+stairW/2+10}" y="${planY+24}" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">S</text>`;
    const rx = sx + stairW;
    planSvg += `<rect x="${rx}" y="${planY+1}" width="${aptW-1}" height="${planH-2}" fill="#f4f4f3" stroke="#aaa"/>`;
    planSvg += `<text x="${rx+aptW/2}" y="${planY+planH/2+4}" font-size="10" fill="#666" text-anchor="middle">íbúð</text>`;
  }

  // Vertical section
  const floorH = 56;
  const secY0 = 322;
  const secLeft = 120, secW = 500, labelX = 135, colF = 380, colS = 480;
  let cur = secY0;
  let secSvg = '';
  for (let f = haedir; f >= 1; f--) {
    secSvg += `<rect x="${secLeft}" y="${cur}" width="${secW}" height="${floorH}" fill="#fafaf9" stroke="#ccc"/>`;
    secSvg += `<text x="${labelX}" y="${cur+22}" font-size="12">${f}. hæð</text>`;
    secSvg += `<text x="${labelX}" y="${cur+38}" font-size="10" fill="#555">stigapallur</text>`;
    secSvg += `<circle cx="${colF}" cy="${cur+28}" r="9" fill="#d93838"/><text x="${colF}" y="${cur+32}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">F</text>`;
    secSvg += `<circle cx="${colS}" cy="${cur+28}" r="8" fill="#2563eb"/><text x="${colS}" y="${cur+32}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">S</text>`;
    if (f === haedir) {
      secSvg += `<text x="${colF}" y="${cur+52}" font-size="9" fill="#555" text-anchor="middle">slökkvitæki 6kg</text>`;
      secSvg += `<text x="${colS}" y="${cur+52}" font-size="9" fill="#555" text-anchor="middle">samt. skynjari</text>`;
    }
    if (f === 1) {
      secSvg += `<rect x="${colS+50}" y="${cur+15}" width="55" height="26" fill="#fff8d6" stroke="#caa33a"/><text x="${colS+77}" y="${cur+32}" font-size="10" fill="#7a5a00" font-weight="600" text-anchor="middle">EXIT</text>`;
    }
    cur += floorH;
  }
  if (kjallari) {
    const kH = 100;
    secSvg += `<rect x="${secLeft}" y="${cur}" width="${secW}" height="${kH}" fill="#f0eee9" stroke="#ccc"/>`;
    secSvg += `<text x="${labelX}" y="${cur+22}" font-size="12">Kjallari</text>`;
    secSvg += `<text x="${labelX}" y="${cur+38}" font-size="10" fill="#555">geymslur, þvottahús,</text>`;
    secSvg += `<text x="${labelX}" y="${cur+51}" font-size="10" fill="#555">sorpgeymsla</text>`;
    if (co2) {
      secSvg += `<circle cx="320" cy="${cur+55}" r="9" fill="#d93838"/><text x="320" y="${cur+59}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">F</text>`;
      secSvg += `<text x="320" y="${cur+80}" font-size="9" fill="#555" text-anchor="middle">CO₂ rafm.tafla</text>`;
    }
    secSvg += `<circle cx="395" cy="${cur+55}" r="9" fill="#d93838"/><text x="395" y="${cur+59}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">F</text>`;
    secSvg += `<text x="395" y="${cur+80}" font-size="9" fill="#555" text-anchor="middle">þvottahús</text>`;
    secSvg += `<circle cx="470" cy="${cur+55}" r="8" fill="#2563eb"/><text x="470" y="${cur+59}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">S</text>`;
    secSvg += `<text x="470" y="${cur+80}" font-size="9" fill="#555" text-anchor="middle">geymslugangur</text>`;
    secSvg += `<circle cx="545" cy="${cur+55}" r="8" fill="#2563eb"/><text x="545" y="${cur+59}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">S</text>`;
    secSvg += `<text x="545" y="${cur+80}" font-size="9" fill="#555" text-anchor="middle">stigapallur</text>`;
    cur += kH;
  }
  const sumY = cur + 30;
  const totalF = n.lettvatn6kg + n.co2 + n.lettvatn6L;
  const totalS = n.skynjari;
  const svgH = sumY + 110;

  const planLabel = `${stiga} stigagang${stiga===1?'ur':'ar'} · ${haedir} hæðir${kjallari ? ' + kjallari' : ''} · ${ibudir} íbúð${ibudir===1?'':'ir'} · skv. byggingarreglugerð 112/2012 og reglugerð 723/2017`;

  return `<svg viewBox="0 0 760 ${svgH}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">
  <rect width="760" height="${svgH}" fill="#ffffff"/>
  <text x="20" y="28" font-size="17" font-weight="600">${b.husfelag} — ráðlögð uppsetning, sameign</text>
  <text x="20" y="46" font-size="12" fill="#555">${planLabel}</text>
  <text x="20" y="80" font-size="13" font-weight="600">Grunnmynd (dæmigerð hæð)</text>
  <text x="20" y="96" font-size="10" fill="#555">Eitt slökkvitæki + einn samtengdur reykskynjari á hverjum stigapalli</text>
  ${planSvg}
  <text x="20" y="252" font-size="10" fill="#555">Sama uppsetning endurtekur sig á hverri hæð (1.–${haedir}. hæð) í sömu lóðréttu stöðu.</text>
  <text x="20" y="292" font-size="13" font-weight="600">Lóðrétt snið um einn stigagang</text>
  <text x="20" y="308" font-size="10" fill="#555">Margfaldið með ${stiga} (Stigi ${[...Array(stiga)].map((_,i)=>String.fromCharCode(65+i)).join(' + ')}) til að fá heildarmagn fyrir sameignina</text>
  ${secSvg}
  <g transform="translate(640, 75)">
    <rect x="0" y="0" width="100" height="22" fill="#fff" stroke="#ccc" rx="3"/>
    <circle cx="14" cy="11" r="6" fill="#d93838"/><text x="14" y="15" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">F</text>
    <text x="26" y="15" font-size="10" fill="#555">slökkvitæki</text>
    <rect x="0" y="26" width="110" height="22" fill="#fff" stroke="#ccc" rx="3"/>
    <circle cx="14" cy="37" r="6" fill="#2563eb"/><text x="14" y="41" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">S</text>
    <text x="26" y="41" font-size="10" fill="#555">samt. skynjari</text>
  </g>
  <rect x="20" y="${sumY}" width="720" height="100" fill="#fff" stroke="#ccc" rx="4"/>
  <text x="35" y="${sumY+22}" font-size="13" font-weight="600">Áætlað magn fyrir tilboð (per stigagang × ${stiga})</text>
  <text x="35" y="${sumY+44}" font-size="12">Slökkvitæki (6 kg, 21A 183BC):</text>
  <text x="300" y="${sumY+44}" font-size="12" font-weight="600">${totalF} stk</text>
  <text x="35" y="${sumY+64}" font-size="12">Samtengjanlegir reykskynjarar:</text>
  <text x="300" y="${sumY+64}" font-size="12" font-weight="600">${totalS} stk</text>
  <text x="35" y="${sumY+86}" font-size="11" fill="#555">Reykskynjarar tengjast aðalstýringu — virkni og samskipti prófuð sérstaklega.</text>
</svg>`;
}

// Generate schematic dynamically before docx is built
function renderSchematic() {
  const fs2 = require('fs');
  const svg = generateSchematicSVG(BUILDING, N);
  fs2.writeFileSync('/sessions/vigilant-stoic-wozniak/mnt/outputs/build/schematic.svg', svg);
  execSync('convert -density 200 -background white /sessions/vigilant-stoic-wozniak/mnt/outputs/build/schematic.svg /sessions/vigilant-stoic-wozniak/mnt/outputs/build/schematic.png');
}
renderSchematic();

const ARIAL = 'Arial';
const COLOR_LINE = '2E75B6';
const COLOR_HEADER_BG = 'E8EEF7';
const COLOR_BORDER = 'BFBFBF';
const COLOR_SUBTLE = '6B6B6B';

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const para = (text, opts = {}) => new Paragraph({
  spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 280 },
  alignment: opts.align ?? AlignmentType.LEFT,
  children: [new TextRun({
    text,
    bold: opts.bold ?? false,
    italics: opts.italic ?? false,
    size: opts.size ?? 22,
    color: opts.color ?? '111111',
    font: ARIAL,
  })],
});

const heading1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text, bold: true, size: 28, color: '111111', font: ARIAL })],
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_LINE, space: 4 } },
});

const heading2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 200, after: 100 },
  children: [new TextRun({ text, bold: true, size: 24, color: '111111', font: ARIAL })],
});

const bullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 },
  spacing: { after: 60, line: 280 },
  children: [new TextRun({ text, size: 22, font: ARIAL })],
});

const hr = () => new Paragraph({
  spacing: { before: 120, after: 120 },
  children: [],
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_LINE, space: 1 } },
});

const cell = (text, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: opts.width, type: WidthType.DXA },
  shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
  margins: { top: 100, bottom: 100, left: 140, right: 140 },
  verticalAlign: opts.valign,
  children: [new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    children: [new TextRun({
      text,
      bold: opts.bold ?? false,
      size: opts.size ?? 22,
      font: ARIAL,
      color: opts.color ?? '111111',
    })],
  })],
});

const LOGO_PATH = '/sessions/vigilant-stoic-wozniak/mnt/outputs/build/logo.png';
const logoBuffer = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;

// Briefhaus — logo og fyrirtækisupplýsingar hlið við hlið í 2-dálka töflu
const briefhausTableRows = [new TableRow({
  children: [
    // Vinstri dálkur: logo
    new TableCell({
      borders: noBorders,
      width: { size: 4513, type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 80 },
      verticalAlign: 'center',
      children: logoBuffer ? [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
        children: [new ImageRun({
          type: 'png', data: logoBuffer,
          transformation: { width: 280, height: 80 },
          altText: { title: 'Logo', description: 'Merki fyrirtækisins', name: 'logo' },
        })],
      })] : [new Paragraph({ children: [] })],
    }),
    // Hægri dálkur: company info
    new TableCell({
      borders: noBorders,
      width: { size: 4513, type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 80, right: 0 },
      verticalAlign: 'center',
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 },
          children: [new TextRun({ text: FYRIRTAEKI, bold: true, size: 26, font: ARIAL })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 },
          children: [new TextRun({ text: KENNITALA, size: 18, color: COLOR_SUBTLE, font: ARIAL })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 },
          children: [new TextRun({ text: HEIMILISFANG, size: 18, color: COLOR_SUBTLE, font: ARIAL })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 },
          children: [new TextRun({ text: POSTNR_STADUR, size: 18, color: COLOR_SUBTLE, font: ARIAL })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 },
          children: [new TextRun({ text: 'Sími: ' + SIMI + '  •  ' + NETFANG, size: 18, color: COLOR_SUBTLE, font: ARIAL })] }),
      ],
    }),
  ],
})];

const briefhaus = [
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [4513, 4513],
    rows: briefhausTableRows,
  }),
  hr(),
];

const vidtakandi = [
  new Paragraph({
    spacing: { after: 40, before: 80 },
    children: [new TextRun({ text: 'Til:', bold: true, size: 22, font: ARIAL })],
  }),
  para('Húsfélag Birkimelur 10, 10A og 10B', { bold: true, after: 40 }),
  para('107 Reykjavík', { color: COLOR_SUBTLE, size: 20, after: 40 }),
  new Paragraph({
    spacing: { after: 60, before: 200 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: 'Tilboð nr.: ' + TILBOD_NR, size: 22, font: ARIAL }),
      new TextRun({ text: '\tDagsetning: ' + DAGSETNING, size: 22, font: ARIAL }),
    ],
  }),
];

const titill = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: 'TILBOÐ', bold: true, size: 40, color: '111111', font: ARIAL })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({
      text: 'Uppsetning brunavarna í sameign',
      bold: true, size: 28, color: COLOR_LINE, font: ARIAL,
    })],
  }),
];

const inngangur = [
  heading1('1. Inngangur'),
  para(
    'Vísað er til erindis húsfélagsins um tilboð í yfirferð á brunavörnum í sameign ' +
    'fasteignanna að Birkimel 10, 10A og 10B í Reykjavík. Um er að ræða þrjá stigaganga ' +
    'með 31 íbúð samtals — 5 hæðir auk kjallara með sameign.'
  ),
  para(
    'Hér með leggur ' + FYRIRTAEKI + ' fram tilboð í uppsetningu nýrra slökkvitækja, samtengjanlegra ' +
    'reykskynjara og flóttaleiðaskilta í sameign hússins. Öll tæki eru ný með 20% sérkjörum. Tilboðið byggir á ákvæðum byggingarreglugerðar nr. 112/2012 ' +
    'og reglugerðar nr. 723/2017 um eldvarnir og eldvarnaeftirlit, ásamt staðli ÍST EN 3 um handslökkvitæki.'
  ),
  para(
    'Vettvangsskoðun hefur farið fram og núverandi búnaður verið metinn. Núverandi slökkvitæki og reykskynjarar í sameign uppfylla ekki kröfur og er ekki hægt að nota eða endurnýta — fyrirhugað er að setja upp öll ný tæki og skilti á öllum stigagöngum.\n\nÞetta tilboð gildir um fyrstu uppsetningu (ár 1). Árleg þjónustuskoðun á nýjum tækjum hefst á ári 2 skv. þjónustusamningi (kafli 6).'
  ),
];

const verklysing = [
  heading1('3. Verklýsing'),
  heading2('3.1 Slökkvitæki — uppsetning nýrra tækja'),
  bullet('Uppsetning 15 nýrra léttvatnstækja 6 kg á stigapöllum (lágm. 21A 183B, prófuð fyrir 35 kV).'),
  bullet('Uppsetning 3 nýrra kolsýrutækja (CO₂) 5 kg við rafmagnstöflur í kjallara — engin leifar, óhætt á spennusettum búnaði.'),
  bullet('Uppsetning 3 nýrra léttvatnstækja 6 L í geymslu-/þvottahúsrými í kjallara.'),
  bullet('Öll tæki eru CE-merkt og uppfylla ÍST EN 3 staðal.'),
  bullet('Þjónustumiða (date tag) með dagsetningu fyrstu yfirferðar (ár 2) er sett á öll ný tæki.'),
  bullet('Léttvatns- og kolsýrutæki eru yfirfarin árlega og tekin til hleðslu á 5 ára fresti hjá Slökkvitæki ehf.'),
  bullet('Á meðan á hleðslu stendur er lánstæki sett í stað tækisins.'),

  heading2('3.2 Samtengjanlegir reykskynjarar — uppsetning'),
  bullet('Uppsetning 21 nýrra samtengjanlegra reykskynjara í stigagöngum og geymslugöngum.'),
  bullet('Tenging á aðalstýringu og prófun á samskiptum við alla lykilskynjara.'),
  bullet('Zónaprófun — staðfest að boðun og staðsetning skili sér á aðalstýringu.'),
  bullet('Festingar og aðlögun að núverandi rafmagnsuppsetningu.'),

  heading2('3.3 Slökkvitækjamerki'),
  bullet('Uppsetning sjálflýsandi slökkvitækjamerkja (150×150 mm), eitt á hvern stigagang.'),
  bullet('Merkin sýna hvar slökkvitæki eru staðsett og lýsa upp í myrkri til að auðkenna staðsetninguna í neyðartilfellum.'),

  heading2('3.4 Skýrsla'),
  bullet('Skrifleg skýrsla afhent húsfélaginu innan 10 virkra daga frá skoðun.'),
  bullet('Skýrslan inniheldur ljósmyndir, lista yfir frávik og forgangsraðaðar tillögur til úrbóta.'),
  bullet('Aukaverk verðlögð sérstaklega og kynnt húsfélaginu áður en framkvæmt er.'),
];

const tableWidth = 9026;

const tableRows = [
  new TableRow({
    tableHeader: true,
    children: [
      cell('Liður', { width: 4800, shade: COLOR_HEADER_BG, bold: true, valign: 'center' }),
      cell('Magn',   { width: 1100, shade: COLOR_HEADER_BG, bold: true, valign: 'center', align: AlignmentType.CENTER }),
      cell('Einingaverð', { width: 1700, shade: COLOR_HEADER_BG, bold: true, valign: 'center', align: AlignmentType.RIGHT }),
      cell('Samtals',{ width: 1426, shade: COLOR_HEADER_BG, bold: true, valign: 'center', align: AlignmentType.RIGHT }),
    ],
  }),
  ...linur.map(l => new TableRow({
    children: [
      cell(l.lysing,            { width: 4800 }),
      cell(String(l.magn),      { width: 1100, align: AlignmentType.CENTER }),
      cell(isk(l.einingaverd),  { width: 1700, align: AlignmentType.RIGHT }),
      cell(isk(l.samtals),      { width: 1426, align: AlignmentType.RIGHT }),
    ],
  })),
  new TableRow({
    children: [
      cell('Samtals án vsk.', { width: 4800, bold: true, shade: 'F5F5F5' }),
      cell('',                { width: 1100, shade: 'F5F5F5' }),
      cell('',                { width: 1700, shade: 'F5F5F5' }),
      cell(isk(heildVskLaus), { width: 1426, bold: true, align: AlignmentType.RIGHT, shade: 'F5F5F5' }),
    ],
  }),
  new TableRow({
    children: [
      cell('Virðisaukaskattur (24%)', { width: 4800, shade: 'F5F5F5' }),
      cell('',                { width: 1100, shade: 'F5F5F5' }),
      cell('',                { width: 1700, shade: 'F5F5F5' }),
      cell(isk(vsk),          { width: 1426, align: AlignmentType.RIGHT, shade: 'F5F5F5' }),
    ],
  }),
  new TableRow({
    children: [
      cell('HEILDARTILBOÐ (m. vsk.)', { width: 4800, bold: true, shade: COLOR_HEADER_BG }),
      cell('',                { width: 1100, shade: COLOR_HEADER_BG }),
      cell('',                { width: 1700, shade: COLOR_HEADER_BG }),
      cell(isk(heildMedVsk),  { width: 1426, bold: true, align: AlignmentType.RIGHT, shade: COLOR_HEADER_BG }),
    ],
  }),
];

const verdtafla = [
  heading1('4. Sundurliðun verðs'),
  para(
    'Sundurliðun byggir á niðurstöðum vettvangsskoðunar. Öll verð eru í íslenskum krónum.',
    { italic: true, color: COLOR_SUBTLE, size: 20 }
  ),
  new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [4800, 1100, 1700, 1426],
    rows: tableRows,
  }),
];

const innifalid = [
  heading1('5. Innifalið og ekki innifalið'),
  heading2('5.1 Innifalið í tilboði'),
  bullet('Ferðakostnaður innan höfuðborgarsvæðisins.'),
  bullet('Vinna á dagvinnutíma (mán.–fös. 08:00–16:00).'),
  bullet('Þjónustumiðar, smáfestingar og almenn neysluvara.'),
  bullet('Skrifleg skoðunarskýrsla með ljósmyndum.'),
  bullet('Ráðgjöf um úrbætur og forgangsröðun til húsfélagsstjórnar.'),
  heading2('5.2 Ekki innifalið — tilboðsskylt sérstaklega'),
  bullet('Endurnýjun slökkvitækja sem hafa náð 10 ára aldri eða eru ónothæf — 20% sérkjör á nýjum tækjum (sjá kafla 6).'),
  bullet('Hleðsla léttvatns- og kolsýrutækja á 5 ára fresti — lánstæki sett í stað á meðan.'),
  bullet('10-ára þrýstiprófun hylkis á verkstæði.'),
  bullet('Endurnýjun ónýtra eða úreltra reykskynjara — sérkjör –20%.'),
  bullet('Yfirferð eldvarnarhurða, flóttaleiða eða neyðarlýsingar — sérstök þjónusta, tilboðsskyld.'),
  bullet('Uppsetning nýrra tækja: gert ráð fyrir 5 klst. vinnu á 16.500 kr./klst.'),
  bullet('Vinna utan dagvinnutíma — 50% álag.'),

  // Áætlað verð fyrir næstu 5 árin
  heading2('5.3 Áætlað verð árlegrar þjónustu — næstu 5 árin'),
  para('Eftir uppsetningu hefst árleg þjónustuskoðun á ári 2. Á ári 5 falla einnig til hleðsla léttvatns- og kolsýrutækja (lánstæki innifalið á meðan).', { size: 20, color: COLOR_SUBTLE, italic: true, after: 80 }),
  new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [1400, 3826, 2000, 2000],
    rows: [
      new TableRow({ tableHeader: true, children: [
        cell('Ár', { width: 1400, shade: COLOR_HEADER_BG, bold: true, align: AlignmentType.CENTER }),
        cell('Þjónusta', { width: 3826, shade: COLOR_HEADER_BG, bold: true }),
        cell('Án vsk.', { width: 2000, shade: COLOR_HEADER_BG, bold: true, align: AlignmentType.RIGHT }),
        cell('M. vsk.', { width: 2000, shade: COLOR_HEADER_BG, bold: true, align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        cell('Ár 1', { width: 1400, align: AlignmentType.CENTER, bold: true }),
        cell('Uppsetning (sjá kafla 3)', { width: 3826 }),
        cell('403.008 kr.', { width: 2000, align: AlignmentType.RIGHT }),
        cell('499.730 kr.', { width: 2000, align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        cell('Ár 2', { width: 1400, align: AlignmentType.CENTER, bold: true }),
        cell('Árleg þjónustuskoðun (akstur, skýrsla, yfirferð slökkvitækja og reykskynjara)', { width: 3826 }),
        cell('122.255 kr.', { width: 2000, align: AlignmentType.RIGHT }),
        cell('151.596 kr.', { width: 2000, align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        cell('Ár 3', { width: 1400, align: AlignmentType.CENTER, bold: true }),
        cell('Árleg þjónustuskoðun', { width: 3826 }),
        cell('122.255 kr.', { width: 2000, align: AlignmentType.RIGHT }),
        cell('151.596 kr.', { width: 2000, align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        cell('Ár 4', { width: 1400, align: AlignmentType.CENTER, bold: true }),
        cell('Árleg þjónustuskoðun', { width: 3826 }),
        cell('122.255 kr.', { width: 2000, align: AlignmentType.RIGHT }),
        cell('151.596 kr.', { width: 2000, align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        cell('Ár 5', { width: 1400, align: AlignmentType.CENTER, bold: true, shade: 'FFF8D6' }),
        cell('Árleg þjónustuskoðun + 5-ára hleðsla á 15 léttvatn 6 kg, 3 CO₂ 5 kg og 3 léttvatn 6 L. Lánstæki innifalið.', { width: 3826, shade: 'FFF8D6' }),
        cell('265.031 kr.', { width: 2000, align: AlignmentType.RIGHT, bold: true, shade: 'FFF8D6' }),
        cell('328.638 kr.', { width: 2000, align: AlignmentType.RIGHT, bold: true, shade: 'FFF8D6' }),
      ]}),
    ],
  }),
  para('Verð á árlegri þjónustu er reiknað á sömu einingaverðum og kafli 3, og endurskoðast árlega skv. byggingarvísitölu (sjá kafla 6).', { size: 18, color: COLOR_SUBTLE, italic: true, before: 80 }),

];

const arlegur = [
  heading1('6. Árlegur þjónustusamningur'),
  para(
    'Að lokinni uppsetningu (ár 1) hefst árleg þjónustuskoðun á ári 2. ' + FYRIRTAEKI + ' býður ' +
    'húsfélaginu þjónustusamning þar sem öll uppsett tæki eru yfirfarin árlega, kolsýru- og ' +
    'léttvatnstæki tekin til hleðslu á 5 ára fresti með lánstæki á meðan. Sjá verðskrá árlegrar þjónustu í kafla 4.3.'
  ),
  para('Sérkjör á samningstíma — gildir frá dagsetningu tilboðs:', { bold: true, after: 80 }),
  bullet('20% afsláttur af verði nýrra slökkvitækja sem keypt eru í gegnum samninginn.'),
  bullet('Léttvatns- og kolsýrutæki tekin til hleðslu á 5 ára fresti — lánstæki innifalið á meðan.'),
  bullet('Forgangur á tímapunktum og hraðari afgreiðsla á aukaverkum.'),
  para('Helstu skilmálar þjónustusamnings:', { bold: true, before: 120, after: 80 }),
  bullet('Verð endurskoðast árlega skv. byggingarvísitölu (HMS-vísitala), að hámarki 5% á ári.'),
  bullet('Yfirferð fer fram á sama mánuði ár hvert — minnt á með tölvupósti tveimur vikum áður.'),
  bullet('Húsfélag fær 10% afslátt af öllum aukaverkum á samningstíma.'),
  bullet('Samningurinn er uppsegjanlegur af hálfu beggja aðila með 2ja mánaða fyrirvara.'),
  bullet('Þjónustumiðar á búnaði bera næsta yfirferðardag — engin aukagjöld fyrir áminningu.'),
];

const skilmalar = [
  heading1('7. Almennir skilmálar'),
  bullet('Tilboð þetta gildir í 30 daga frá útgáfudegi.'),
  bullet('Greiðsluskilmálar: reikningur gefinn út við lok verks, gjalddagi 10 dagar.'),
  bullet('Tryggingar: ' + FYRIRTAEKI + ' er með gilda ábyrgðartryggingu skv. lögum.'),
  bullet('Allt starfsfólk hefur tilskilin réttindi til eftirlits með brunavörnum skv. reglugerð nr. 723/2017.'),
  bullet('Trúnaður ríkir um upplýsingar húsfélagsins.'),
];


const skyringarmynd = [
  heading1('2. Skýringarmynd af fyrirhugaðri uppsetningu'),
  para(
    'Hér sést hvernig fyrirhuguð uppsetning lítur út: F (rauður hringur) sýnir staðsetningu hvers ' +
    'slökkvitækis, S (blár hringur) sýnir staðsetningu hvers samtengjanlegs reykskynjara. ' +
    'Sama uppsetning endurtekur sig á hverri hæð í öllum þremur stigagöngum, með viðbótartækjum í kjallararými.',
    { italic: true, color: COLOR_SUBTLE, size: 20 }
  ),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [new ImageRun({
      type: 'png',
      data: fs.readFileSync('/sessions/vigilant-stoic-wozniak/mnt/outputs/build/schematic.png'),
      transformation: { width: 620, height: 718 },
      altText: {
        title: 'Skýringarmynd af ráðlagðri uppsetningu',
        description: 'Grunnmynd og lóðrétt snið með staðsetningu slökkvitækja og reykskynjara',
        name: 'schematic'
      },
    })],
  }),
  para(
    'Áætlað heildarmagn: 21 slökkvitæki og 21 samtengjanlegir reykskynjarar í sameign — sjá sundurliðun verðs í kafla 4.',
    { size: 20, color: COLOR_SUBTLE, align: AlignmentType.CENTER, after: 0 }
  ),
];

const undirskrift = [
  heading1('8. Samþykki tilboðs'),
  para(
    'Húsfélagið staðfestir samþykki á þessu tilboði með undirskrift hér að neðan. ' +
    'Eitt undirritað eintak sendist til ' + FYRIRTAEKI + ' og annað heldur húsfélagið.',
    { after: 320 }
  ),
  new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [4513, 4513],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 4513, type: WidthType.DXA },
            margins: { top: 600, bottom: 80, left: 0, right: 80 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: '_______________________________', size: 22, font: ARIAL })],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'F.h. ' + FYRIRTAEKI, bold: true, size: 22, font: ARIAL })],
                spacing: { after: 40 },
              }),
              new Paragraph({
                children: [new TextRun({ text: TENGILIDUR, size: 20, color: COLOR_SUBTLE, font: ARIAL })],
                spacing: { after: 40 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'Dagsetning: ' + DAGSETNING, size: 20, color: COLOR_SUBTLE, font: ARIAL })],
              }),
            ],
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 4513, type: WidthType.DXA },
            margins: { top: 600, bottom: 80, left: 80, right: 0 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: '_______________________________', size: 22, font: ARIAL })],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'F.h. Húsfélagsins Birkimelur 10, 10A, 10B', bold: true, size: 22, font: ARIAL })],
                spacing: { after: 40 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'Formaður / fulltrúi húsfélagsstjórnar', size: 20, color: COLOR_SUBTLE, font: ARIAL })],
                spacing: { after: 40 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'Dagsetning: ____________________', size: 20, color: COLOR_SUBTLE, font: ARIAL })],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
];

const doc = new Document({
  creator: FYRIRTAEKI,
  title: 'Tilboð — Yfirferð brunavarna í sameign — Birkimelur 10, 10A, 10B',
  description: 'Tilboð í árlega yfirferð brunavarna í sameign',
  styles: {
    default: { document: { run: { font: ARIAL, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: ARIAL },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: ARIAL },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 280 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: FYRIRTAEKI + ' — Tilboð nr. ' + TILBOD_NR + '  •  Bls. ', size: 18, color: COLOR_SUBTLE, font: ARIAL }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR_SUBTLE, font: ARIAL }),
            new TextRun({ text: ' af ', size: 18, color: COLOR_SUBTLE, font: ARIAL }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLOR_SUBTLE, font: ARIAL }),
          ],
        })],
      }),
    },
    children: [
      ...briefhaus,
      ...vidtakandi,
      ...titill,
      ...inngangur,
      ...skyringarmynd,
      ...verklysing,
      ...verdtafla,
      ...innifalid,
      ...arlegur,
      ...skilmalar,
      ...undirskrift,
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = '/sessions/vigilant-stoic-wozniak/mnt/outputs/Tilbod_Birkimelur_10_brunavarnir.docx';
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, '(' + buf.length + ' bytes)');
  console.log('Samtals an vsk:', isk(heildVskLaus));
  console.log('Vsk 24%:       ', isk(vsk));
  console.log('Heildartilbod: ', isk(heildMedVsk));
});
