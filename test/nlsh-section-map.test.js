// Lives outside netlify/functions/ on purpose. A file named *.test.js in the
// functions directory is packaged as a function named "….test" — Netlify
// rejects names with a period (422 Incorrect function names) and the deploy
// preview fails in ~18s. Run: node --test test/nlsh-section-map.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  SECTIONS,
  DUAL_POLICY,
  isCategoryDrawing,
  matchSectionIds,
  primarySectionId,
  tallyBySection,
  sectionStatus,
  crewCopy,
} = require('../netlify/functions/nlsh-section-map');

test('eight named wings, S4 cell is the S4+S5 pair', () => {
  assert.equal(SECTIONS.length, 8);
  assert.deepEqual(SECTIONS.map((s) => s.id), [
    '4h-s1', '4h-s2', '4h-s3', '4h-s4',
    '5h-s1', '5h-s2', '5h-s3', '5h-s4',
  ]);
  assert.equal(SECTIONS.find((s) => s.id === '5h-s4').label, '5H S4+S5');
  assert.equal(DUAL_POLICY, 'primary-only');
});

test('5H / SH S4+S5 ceiling drawing maps once to 5h-s4 (S5 folds into S4)', () => {
  assert.deepEqual(matchSectionIds('5H S4 + S5 Ceiling.pdf'), ['5h-s4']);
  assert.deepEqual(matchSectionIds('SH S4 + S5 Ceiling.pdf'), ['5h-s4']);
  assert.deepEqual(matchSectionIds('SH S4 + S5.pdf'), ['5h-s4']);
  assert.equal(primarySectionId('SH S4 + S5 Ceiling.pdf (1)'), '5h-s4');
});

test('Ajour list: 5H S4 + S5.pdf (0 pins) still maps to 5h-s4', () => {
  assert.deepEqual(matchSectionIds('5H S4 + S5.pdf'), ['5h-s4']);
  assert.equal(primarySectionId('5H S4 + S5.pdf'), '5h-s4');
});

test('Ajour list: 5H 1S og 2S.jpg maps to S1+S2, counted once on S1', () => {
  assert.deepEqual(matchSectionIds('5H 1S og 2S.jpg'), ['5h-s1', '5h-s2']);
  assert.equal(primarySectionId('5H 1S og 2S.jpg'), '5h-s1');
  assert.deepEqual(matchSectionIds('5H 1S og 2S'), ['5h-s1', '5h-s2']);
  assert.deepEqual(matchSectionIds('5h 1s OG 2s.JPG'), ['5h-s1', '5h-s2']);
  assert.deepEqual(matchSectionIds('SH 1S og 2S.jpg'), ['5h-s1', '5h-s2']);
});

test('glued 5H1S / 5H2S and SH1S map to the matching wing', () => {
  assert.deepEqual(matchSectionIds('5H1S'), ['5h-s1']);
  assert.deepEqual(matchSectionIds('5H2S'), ['5h-s2']);
  assert.deepEqual(matchSectionIds('SH1S'), ['5h-s1']);
  assert.deepEqual(matchSectionIds('5H1S OG 5H2S.jpg'), ['5h-s1', '5h-s2']);
  assert.equal(primarySectionId('5H1S OG 5H2S.jpg'), '5h-s1');
});

test('Ajour list: 5H. Ceiling / 5H Ceiling is floor-wide, counted once on 5h-s1', () => {
  assert.deepEqual(matchSectionIds('5H. Ceiling'), ['5h-s1', '5h-s2', '5h-s3', '5h-s4']);
  assert.deepEqual(matchSectionIds('5H Ceiling'), ['5h-s1', '5h-s2', '5h-s3', '5h-s4']);
  assert.deepEqual(matchSectionIds('5H.Ceiling'), ['5h-s1', '5h-s2', '5h-s3', '5h-s4']);
  assert.equal(primarySectionId('5H. Ceiling'), '5h-s1');
});

test('Ajour list: Rafmagnsbættingar is a category drawing, not leftover holes', () => {
  const name = '5H1S OG 5H2S - Rafmagnsbættingar.jpg';
  assert.equal(isCategoryDrawing(name), true);
  assert.deepEqual(matchSectionIds(name), []);
  assert.equal(primarySectionId(name), null);
  assert.equal(isCategoryDrawing('5H 1S og 2S.jpg'), false);
});

test('4H 1S og 2S style matches 4H S1+S2', () => {
  assert.deepEqual(matchSectionIds('4H 1S og 2S.jpg'), ['4h-s1', '4h-s2']);
  assert.equal(primarySectionId('4H 1S og 2S.jpg'), '4h-s1');
  assert.deepEqual(matchSectionIds('4H1S og 4H2S.jpg'), ['4h-s1', '4h-s2']);
});

test('4H 45+55 ceiling maps to 4h-s4, not both floors', () => {
  assert.deepEqual(matchSectionIds('4H 45 + 55 Ceiling.pdf'), ['4h-s4']);
});

test('4H 51-52 dual drawing: primary S1, sibling S2 (counted once)', () => {
  assert.deepEqual(matchSectionIds('4H, 51-52.jpg'), ['4h-s1', '4h-s2']);
  assert.equal(primarySectionId('4H, 51-52.jpg'), '4h-s1');
});

test('single-wing drawings', () => {
  assert.deepEqual(matchSectionIds('5H S2 Floor.pdf'), ['5h-s2']);
  assert.deepEqual(matchSectionIds('4H S3.pdf'), ['4h-s3']);
});

test('unknown drawing does not invent a section', () => {
  assert.deepEqual(matchSectionIds('Guide point overview.pdf'), []);
  assert.equal(primarySectionId(''), null);
});

test('tally does not double-count a dual drawing across two wings', () => {
  const rows = [
    { serial_number: '1', registration_status: 'Done', drawing_name: '4H, 51-52.jpg' },
    { serial_number: '1', registration_status: 'Done', drawing_name: '4H, 51-52.jpg' },
    { serial_number: '2', registration_status: 'Published', drawing_name: '4H, 51-52.jpg' },
    { serial_number: '3', registration_status: 'Done', drawing_name: 'SH S4 + S5 Ceiling.pdf' },
  ];
  const t = tallyBySection(rows);
  assert.equal(t.serials, 3);
  assert.equal(t.byId['4h-s1'].doneSerials.size, 1);
  assert.equal(t.byId['4h-s1'].openSerials.size, 1);
  assert.equal(t.byId['4h-s2'].doneSerials.size, 0);
  assert.equal(t.byId['4h-s2'].sharedFrom, '4h-s1');
  assert.deepEqual(t.byId['4h-s2'].sharedDrawings, ['4H, 51-52.jpg']);
  assert.equal(t.byId['5h-s4'].doneSerials.size, 1);
  assert.equal(t.byId['5h-s1'].doneSerials.size, 0);
});

test('tally: 5H 1S og 2S counted on S1; sibling names the drawing; Rafmagnsbættingar ignored', () => {
  const rows = [
    { serial_number: '10', registration_status: 'Done', drawing_name: '5H 1S og 2S.jpg' },
    { serial_number: '11', registration_status: 'Published', drawing_name: '5H 1S og 2S.jpg' },
    { serial_number: '12', registration_status: 'Done', drawing_name: '5H. Ceiling' },
    { serial_number: '13', registration_status: 'Done', drawing_name: '5H S4 + S5.pdf' },
    { serial_number: '14', registration_status: 'Done', drawing_name: '5H1S OG 5H2S - Rafmagnsbættingar.jpg' },
    { serial_number: '14', registration_status: 'Done', drawing_name: '5H1S OG 5H2S - Rafmagnsbættingar.jpg' },
  ];
  const t = tallyBySection(rows);
  assert.equal(t.serials, 5);
  assert.equal(t.byId['5h-s1'].doneSerials.size, 2); // 1S og 2S + Ceiling
  assert.equal(t.byId['5h-s1'].openSerials.size, 1);
  assert.equal(t.byId['5h-s2'].doneSerials.size, 0);
  assert.equal(t.byId['5h-s2'].sharedFrom, '5h-s1');
  assert.ok(t.byId['5h-s2'].sharedDrawings.includes('5H 1S og 2S.jpg'));
  assert.ok(t.byId['5h-s2'].sharedDrawings.includes('5H. Ceiling'));
  assert.equal(t.byId['5h-s4'].doneSerials.size, 1); // 5H S4 + S5.pdf
  assert.equal(t.byId['5h-s4'].sharedFrom, '5h-s1'); // Ceiling is floor-wide
  assert.deepEqual(t.byId['5h-s4'].sharedDrawings, ['5H. Ceiling']);
  assert.equal(t.category['5H1S OG 5H2S - Rafmagnsbættingar.jpg'], 1);
  assert.equal(t.byId['5h-s1'].doneSerials.has('14'), false);
});

test('rows without drawing_name stay unmapped; backfill flag is honest', () => {
  const empty = tallyBySection([
    { serial_number: '9', registration_status: 'Done', drawing_name: null },
  ]);
  assert.equal(empty.drawingBackfilled, false);
  assert.equal(empty.unmapped['(engin teikning)'], 1);

  const mixed = tallyBySection([
    { serial_number: '9', registration_status: 'Done', drawing_name: null },
    { serial_number: '8', registration_status: 'Done', drawing_name: '5H S1.pdf' },
  ]);
  assert.equal(mixed.drawingBackfilled, true);
  assert.equal(mixed.byId['5h-s1'].doneSerials.size, 1);
});

test('status and crew copy', () => {
  assert.equal(sectionStatus(10, null), 'vantar_teikningu');
  assert.equal(sectionStatus(0, 0), 'oskrad');
  assert.equal(sectionStatus(8, 0), 'ohafid');
  assert.equal(sectionStatus(8, 3), 'i_vinnu');
  assert.equal(sectionStatus(8, 8), 'lokid');
  assert.equal(sectionStatus(0, 5), 'i_vinnu');
  assert.equal(crewCopy('5H S2', 40, 12, 28), 'senda áhöfn: 5H S2, 28 göt eftir');
  assert.match(crewCopy('5H S2', 40, null, null), /Ajour-teikning ekki innlesin/);
});
