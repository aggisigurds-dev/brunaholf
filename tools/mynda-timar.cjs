#!/usr/bin/env node
/* mynda-timar.cjs — les tökutíma úr myndum og raðar þeim á daga.
 *
 *   node tools/mynda-timar.cjs <mappa|mynd> [mynd2 …]
 *
 * Agnar 10.09.2026, um mynd af brunaþéttingu: „can you see timestamp on this
 * one... registered 9.9, last picture of the day".
 *
 * Svarið við þeirri spurningu er nei — mynd sem er límd inn í spjall berst mér
 * sem hreinir myndpunktar. EXIF-in fylgir ekki með. SKRÁIN sjálf ber hann hins
 * vegar, og þetta verkfæri les hann.
 *
 * ── AF HVERJU ÞETTA SKIPTIR MÁLI ──────────────────────────────────────────
 * Í Ajour-útflutningnum er nákvæmlega EINN raunverulegur tímastimpill:
 * augnablikið sem gátlistinn var hakaður. `RegistrationCreatedDate` mældist
 * 0 sekúndum frá honum í hverri einustu röð — sama augnablik, skráð tvisvar —
 * og allur gátlisti eins gats er hakaður á 11 sekúndum að miðgildi. Eitt gat
 * gefur því EINN punkt á tímaásnum, ekki upphaf og endi.
 *
 * 186 af 189 skráningum bera myndir (oftast 2-3). Tökutími myndar er eina
 * merkið í öllu kerfinu sem starfsmaðurinn slær ekki inn sjálfur — hann verður
 * til í símanum þegar myndin er tekin. Hann kemur bara ekki með í neinu
 * útflutningssniðanna þriggja; þau segja aðeins `NumberOfPhotos`.
 *
 * Lesið er `DateTimeOriginal` (töku-augnablikið) og `DateTimeDigitized` til
 * vara — EKKI `DateTime`, sem breytist við ritstýringu. Enginn aðflutningur;
 * JPEG-APP1-hlutinn er þáttaður beint.
 *
 * VARÚÐ: EXIF ber sjaldnast tímabelti. Tíminn er sá sem síminn sýndi.
 */
const fs = require('fs');
const path = require('path');

const inn = process.argv.slice(2);
if (!inn.length) {
  console.error('Notkun: node tools/mynda-timar.cjs <mappa|mynd> [mynd2 …]');
  process.exit(1);
}

const skrar = [];
for (const p of inn) {
  if (!fs.existsSync(p)) { console.error('finnst ekki: ' + p); continue; }
  if (fs.statSync(p).isDirectory()) {
    for (const f of fs.readdirSync(p)) {
      if (/\.(jpe?g|heic)$/i.test(f)) skrar.push(path.join(p, f));
    }
  } else skrar.push(p);
}

const nidur = [];
for (const f of skrar) {
  let ts = null, villa = null;
  try { ts = exifTimi(fs.readFileSync(f)); } catch (e) { villa = e.message; }
  nidur.push({ f, ts, villa, breytt: fs.statSync(f).mtime });
}

nidur.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));

console.log('SKRÁR: ' + nidur.length + '\n');
const perDag = {};
for (const r of nidur) {
  const nafn = path.basename(r.f).slice(0, 40).padEnd(40);
  if (r.ts) {
    console.log('  ' + nafn + r.ts);
    const d = r.ts.slice(0, 10);
    (perDag[d] = perDag[d] || []).push(r.ts.slice(11, 19));
  } else {
    // Skráardagsetning er EKKI tökutími — hún breytist við afritun og
    // niðurhal. Hún er sýnd merkt, aldrei talin með.
    console.log('  ' + nafn + '(engin EXIF)  skráardags ' + r.breytt.toISOString().slice(0, 19).replace('T', ' ') + (r.villa ? '  ' + r.villa : ''));
  }
}

const dagar = Object.keys(perDag).sort();
if (dagar.length) {
  console.log('\nPER DAG (úr EXIF):');
  for (const d of dagar) {
    const t = perDag[d].sort();
    const spönn = (mín(t[t.length - 1]) - mín(t[0])) / 60;
    console.log('  ' + d + '   fyrsta ' + t[0] + '   síðasta ' + t[t.length - 1] +
      '   spönn ' + spönn.toFixed(2) + ' klst   myndir ' + t.length);
  }
}
function mín(s) { return +s.slice(0, 2) * 60 + +s.slice(3, 5); }

// ── EXIF ──────────────────────────────────────────────────────────────────
// Nógu stór þáttari fyrir DateTimeOriginal/Digitized úr JPEG APP1. Ekkert safn.
function exifTimi(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('ekki JPEG');
  let o = 2;
  while (o < buf.length - 4) {
    if (buf[o] !== 0xFF) { o++; continue; }
    const mark = buf[o + 1];
    const len = buf.readUInt16BE(o + 2);
    if (mark === 0xE1 && buf.toString('ascii', o + 4, o + 10) === 'Exif\0\0') {
      return lesTiff(buf.slice(o + 10, o + 2 + len));
    }
    if (mark === 0xDA) break;                       // myndgögnin byrja
    o += 2 + len;
  }
  return null;
}
function lesTiff(t) {
  const le = t.toString('ascii', 0, 2) === 'II';
  const u16 = i => le ? t.readUInt16LE(i) : t.readUInt16BE(i);
  const u32 = i => le ? t.readUInt32LE(i) : t.readUInt32BE(i);
  const fundid = {};
  const gangaIfd = (off, dypt) => {
    if (off <= 0 || off + 2 > t.length || dypt > 2) return;
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > t.length) return;
      const tag = u16(e), gerd = u16(e + 2), telja = u32(e + 4);
      if (tag === 0x8769) { gangaIfd(u32(e + 8), dypt + 1); continue; }   // ExifIFD
      if (tag === 0x9003 || tag === 0x9004) {                             // Original / Digitized
        const lengd = telja * (gerd === 2 ? 1 : 4);
        const p = lengd > 4 ? u32(e + 8) : e + 8;
        if (p + lengd <= t.length) {
          const s = t.toString('ascii', p, p + lengd).replace(/\0+$/, '').trim();
          const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(s);
          if (m) fundid[tag] = `${m[1]}-${m[2]}-${m[3]} ${m[4]}`;
        }
      }
    }
  };
  gangaIfd(u32(4), 0);
  return fundid[0x9003] || fundid[0x9004] || null;    // Original fram yfir Digitized
}
