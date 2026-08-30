// 8-section leftover map for NLSH 4.–5. hæð (not per-room, not 9738-row import).
//
// Ajour stores pins on a *drawing*. Real titles from the Registration drawings
// list (2026-08-30) include:
//   "5H 1S og 2S.jpg"          — one sheet covering S1 and S2 (count once)
//   "5H. Ceiling" / "5H Ceiling"
//   "5H S4 + S5.pdf"           — map even when pin count is 0
//   "5H1S OG 5H2S - Rafmagnsbættingar.jpg" — category, NOT leftover holes
// Older aliases still seen: "SH S4 + S5 Ceiling.pdf", "4H 45 + 55 Ceiling.pdf",
// "4H, 51-52.jpg". SH is Ajour's 5H shorthand (list says SH, popup says 5H).
//
// Dual drawings (S4+S5, 1S og 2S, 51-52): COUNT ONCE on the first matching wing
// in grid order. Sibling wings get shared_from + the drawing title so the UI
// can say the pins live on "5H 1S og 2S". Counting toward both would double
// leftover vs the 9738 hole register.
//
// S5 is not its own cell in the 8-grid — it folds into S4 (the S4+S5 teikning).
// Floor-wide ceiling with no wing ("5H. Ceiling") maps to all four wings of
// that floor, still counted once on the first.

const SECTIONS = [
  { id: '4h-s1', label: '4H S1', floor: '4H' },
  { id: '4h-s2', label: '4H S2', floor: '4H' },
  { id: '4h-s3', label: '4H S3', floor: '4H' },
  { id: '4h-s4', label: '4H S4+S5', floor: '4H' },
  { id: '5h-s1', label: '5H S1', floor: '5H' },
  { id: '5h-s2', label: '5H S2', floor: '5H' },
  { id: '5h-s3', label: '5H S3', floor: '5H' },
  { id: '5h-s4', label: '5H S4+S5', floor: '5H' },
];

const DUAL_POLICY = 'primary-only';

// Electrical-addition / sealing sheets sit on the same Ajour list as hole
// drawings. They must not inflate S1/S2 leftover.
const CATEGORY_DRAWING_RE = /rafmagns?\s*(bættingar|baettingar|þéttingar|thettingar|þettingar)/i;

function isCategoryDrawing(name) {
  return CATEGORY_DRAWING_RE.test(String(name || ''));
}

function normalizeDrawing(name) {
  let s = String(name || '').trim().toLowerCase();
  // SH → 5H, including glued SH1S / SHS4
  s = s.replace(/\bsh(?=\d|s\b)/g, '5h');
  s = s.replace(/\bsh\b/g, '5h');
  // Glued 5H1S / 5h2s and 5HS1 / 5hs2
  s = s.replace(/\b([45])h([1-5])s\b/g, '$1h $2s');
  s = s.replace(/\b([45])hs([1-5])\b/g, '$1h s$2');
  s = s.replace(/[_.,;:+\-–—]+/g, ' ');
  s = s.replace(/\s+/g, ' ');
  return s;
}

function floorOf(norm) {
  if (/\b4h\b/.test(norm)) return '4h';
  if (/\b5h\b/.test(norm)) return '5h';
  return null;
}

/** Wing tokens 1–5. S5 folds to 4. Accepts S1 and 1S. 51/52 on a 4H drawing are S1/S2. 45/55 → S4. */
function wingTokens(norm, floor) {
  const wings = new Set();
  const add = (n) => wings.add(+n === 5 ? 4 : +n);
  let m;
  const reS = /\bs\s*([1-5])\b/g;
  while ((m = reS.exec(norm))) add(m[1]);
  // Ajour "5H 1S og 2S" / "4H 1S og 2S" — number then S
  const reNS = /\b([1-5])\s*s\b/g;
  while ((m = reNS.exec(norm))) add(m[1]);
  if (floor === '4h') {
    if (/\b51\b/.test(norm)) add(1);
    if (/\b52\b/.test(norm)) add(2);
    if (/\b53\b/.test(norm)) add(3);
    if (/\b54\b/.test(norm) || /\b45\b/.test(norm) || /\b55\b/.test(norm)) add(4);
  }
  // "5H. Ceiling" / "5H Ceiling" / "4H Ceiling" — no wing in the title
  if (!wings.size && /\bceiling\b|\bloft\b/.test(norm)) {
    add(1); add(2); add(3); add(4);
  }
  return [...wings].sort((a, b) => a - b);
}

function matchSectionIds(drawingName) {
  if (isCategoryDrawing(drawingName)) return [];
  const norm = normalizeDrawing(drawingName);
  if (!norm) return [];
  const floor = floorOf(norm);
  if (!floor) return [];
  const wings = wingTokens(norm, floor);
  if (!wings.length) return [];
  const ids = [];
  for (const w of wings) {
    const id = `${floor}-s${w}`;
    if (SECTIONS.some((s) => s.id === id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function primarySectionId(drawingName) {
  const ids = matchSectionIds(drawingName);
  return ids[0] || null;
}

function emptyBucket() {
  return {
    doneSerials: new Set(),
    openSerials: new Set(),
    drawings: {},
    sharedFrom: null,
    sharedDrawings: [],
  };
}

/**
 * rows: { serial_number, registration_status, drawing_name }[]
 * One serial = one hole (checklist dupes collapse; Done wins).
 */
function tallyBySection(rows) {
  const serials = new Map();
  let withDrawing = 0;
  let withoutDrawing = 0;
  for (const r of rows || []) {
    const sn = r.serial_number;
    if (!sn) continue;
    const drawing = (r.drawing_name || '').trim();
    if (drawing) withDrawing++;
    else withoutDrawing++;
    const isDone = String(r.registration_status || '') === 'Done';
    const prev = serials.get(sn);
    if (!prev) {
      serials.set(sn, { drawing, done: isDone });
    } else {
      if (!prev.drawing && drawing) prev.drawing = drawing;
      if (isDone) prev.done = true;
    }
  }

  const byId = {};
  for (const s of SECTIONS) byId[s.id] = emptyBucket();
  const unmapped = {};
  const category = {};

  for (const [sn, info] of serials) {
    if (isCategoryDrawing(info.drawing)) {
      const key = info.drawing || '(flokkateikning)';
      category[key] = (category[key] || 0) + 1;
      continue;
    }
    const ids = matchSectionIds(info.drawing);
    const primary = ids[0] || null;
    if (!primary) {
      const key = info.drawing || '(engin teikning)';
      unmapped[key] = (unmapped[key] || 0) + 1;
      continue;
    }
    const b = byId[primary];
    if (info.done) b.doneSerials.add(sn);
    else b.openSerials.add(sn);
    const d = info.drawing || '(ónefnd)';
    const drow = b.drawings[d] || (b.drawings[d] = { done: 0, open: 0 });
    if (info.done) drow.done++;
    else drow.open++;
    for (const id of ids.slice(1)) {
      const sib = byId[id];
      if (!sib.sharedFrom) sib.sharedFrom = primary;
      if (d && !sib.sharedDrawings.includes(d)) sib.sharedDrawings.push(d);
    }
  }

  return {
    serials: serials.size,
    withDrawing,
    withoutDrawing,
    drawingBackfilled: withDrawing > 0,
    byId,
    unmapped,
    category,
  };
}

function sectionStatus(planned, done) {
  if (done == null) return 'vantar_teikningu';
  const p = Math.max(0, Math.round(Number(planned) || 0));
  const d = Math.max(0, Math.round(Number(done) || 0));
  if (p <= 0 && d <= 0) return 'oskrad';
  if (p > 0 && d >= p) return 'lokid';
  if (d > 0) return 'i_vinnu';
  return 'ohafid';
}

function crewCopy(label, planned, done, left) {
  if (done == null) {
    const p = Math.max(0, Math.round(Number(planned) || 0));
    return p
      ? `senda áhöfn: ${label}, áætlað ${p} (Ajour-teikning ekki innlesin)`
      : `senda áhöfn: ${label} (Ajour-teikning ekki innlesin)`;
  }
  const leftN = Math.max(0, Math.round(Number(left) || 0));
  return `senda áhöfn: ${label}, ${leftN} göt eftir`;
}

module.exports = {
  SECTIONS,
  DUAL_POLICY,
  CATEGORY_DRAWING_RE,
  isCategoryDrawing,
  normalizeDrawing,
  matchSectionIds,
  primarySectionId,
  tallyBySection,
  sectionStatus,
  crewCopy,
};
