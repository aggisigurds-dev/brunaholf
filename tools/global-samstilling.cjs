#!/usr/bin/env node
/* global-samstilling.cjs — sömu almennu reglur, agentar, skills og hookar í ~/.claude á ÖLLUM vélum (Agnar 11.11.2026:
 * „ég er að vinna úr 4 tölvum, síma og 20 sessionum … helst allstaðar").
 *
 * FRUMRIT (git, berst með auto-sync):            AFRIT á hverri vél:
 *   brunaholf/claude-global/CLAUDE.md             → ~/.claude/CLAUDE.md
 *   brunaholf/claude-global/skills/<nafn>/…       → ~/.claude/skills/<nafn>/…
 *   heimaskrár agenta (AGENTAR hér að neðan)      → ~/.claude/agents/<nafn>.md
 *   hookarnir fimm (HOOKAR hér að neðan)          → ~/.claude/settings.json (aðeins BÆTT VIÐ því sem vantar)
 *
 * Keyrt úr lotu-byrjun.cjs við upphaf hverrar lotu (hljóðlaust nema eitthvað breytist). Aldrei eytt: skrá sem er yfirskrifuð
 * fer fyrst í ~/.claude/backups/global-samstilling/<tími>/. settings.json er aðeins snert ef hún þáttast sem JSON, og
 * aðeins til að bæta við hook sem vantar (þekkt á skráarheitinu); hookar sem eru til eru látnir í friði.
 *
 *   node tools/global-samstilling.cjs            → samstillir og segir hvað breyttist
 *   node tools/global-samstilling.cjs --athuga   → segir aðeins hvað er frábrugðið (skrifar ekkert)
 *   BH_GLOBAL_SAMSTILLING=0                      → slökkt á þessari vél
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const BH = path.resolve(__dirname, '..');
const ROT = path.resolve(BH, '..');
const HEIMA = process.env.BH_GLOBAL_HEIMA ? path.resolve(process.env.BH_GLOBAL_HEIMA) : path.join(os.homedir(), '.claude');
const FRUM = path.join(BH, 'claude-global');

const AGENTAR = {                       // nafn → heimaskrá (frumritið ræður)
  rukkari: path.join(BH, '.claude', 'agents', 'rukkari.md'),
  samthykktir: path.join(ROT, 'slokkvitaeki', '.claude', 'agents', 'samthykktir.md'),
};
const tol = n => 'node ' + path.join(BH, 'tools', n).replace(/\\/g, '/') + ' --notandi';
const HOOKAR = [                        // [atburður, skrá, matcher, tímamörk]
  ['UserPromptSubmit', 'router.cjs', null, 5],
  ['Stop', 'lotu-lok.cjs', null, 10],
  ['SessionStart', 'lotu-byrjun.cjs', null, 5],
  ['PreToolUse', 'sidu-vordur.cjs', 'Read|Edit|Write|MultiEdit|NotebookEdit', 5],
  ['PreToolUse', 'deploy-vordur.cjs', 'Bash', 5],
];

const lesa = p => { try { return fs.readFileSync(p); } catch (_) { return null; } };
const eins = (a, b) => !!a && !!b && a.equals(b);
function skrar(mappa, rot = mappa, ut = []) {
  let l = []; try { l = fs.readdirSync(mappa, { withFileTypes: true }); } catch (_) { return ut; }
  for (const e of l) { const p = path.join(mappa, e.name); if (e.isDirectory()) skrar(p, rot, ut); else ut.push(path.relative(rot, p)); }
  return ut;
}

function samstilla(o = {}) {
  const athuga = !!o.athuga, breytt = [], villur = [];
  if (process.env.BH_GLOBAL_SAMSTILLING === '0') return { breytt, villur, slokkt: true };
  if (!fs.existsSync(FRUM)) return { breytt, villur: ['claude-global vantar í brunaholf'] };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const afritRot = path.join(HEIMA, 'backups', 'global-samstilling', ts);
  const setja = (fra, til, heiti) => {
    const nytt = lesa(fra); if (!nytt) return;
    const gamalt = lesa(til);
    if (eins(nytt, gamalt)) return;
    breytt.push(heiti + (gamalt ? '' : ' (ný)'));
    if (athuga) return;
    try {
      if (gamalt) { const a = path.join(afritRot, heiti); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, gamalt); }
      fs.mkdirSync(path.dirname(til), { recursive: true }); fs.writeFileSync(til, nytt);
    } catch (e) { villur.push(heiti + ': ' + e.message); }
  };

  setja(path.join(FRUM, 'CLAUDE.md'), path.join(HEIMA, 'CLAUDE.md'), 'CLAUDE.md');
  for (const r of skrar(path.join(FRUM, 'skills'))) setja(path.join(FRUM, 'skills', r), path.join(HEIMA, 'skills', r), path.join('skills', r).replace(/\\/g, '/'));
  for (const [n, heim] of Object.entries(AGENTAR)) setja(heim, path.join(HEIMA, 'agents', n + '.md'), 'agents/' + n + '.md');

  // hookar: aðeins bætt við því sem vantar; aldrei breytt því sem er til
  const sp = path.join(HEIMA, 'settings.json');
  const hratt = lesa(sp);
  let s = null;
  if (!hratt) s = {}; else { try { s = JSON.parse(hratt.toString('utf8').replace(/^﻿/, '')); } catch (_) { villur.push('settings.json þáttast ekki sem JSON — hookar ósnertir'); } }
  if (s && typeof s === 'object') {
    s.hooks = s.hooks && typeof s.hooks === 'object' ? s.hooks : {};
    const vantar = [];
    for (const [atb, skra, matcher, timi] of HOOKAR) {
      const til = JSON.stringify(s.hooks[atb] || []).includes(skra);
      if (til) continue;
      vantar.push(atb + ':' + skra);
      const f = { hooks: [{ type: 'command', command: tol(skra), timeout: timi }] };
      if (matcher) f.matcher = matcher;
      (s.hooks[atb] = Array.isArray(s.hooks[atb]) ? s.hooks[atb] : []).push(f);
    }
    if (vantar.length) {
      breytt.push('settings.json hookar: ' + vantar.join(', '));
      if (!athuga) {
        try {
          const ut = JSON.stringify(s, null, 2) + '\n';
          JSON.parse(ut);
          if (hratt) { fs.mkdirSync(afritRot, { recursive: true }); fs.writeFileSync(path.join(afritRot, 'settings.json'), hratt); }
          fs.mkdirSync(HEIMA, { recursive: true }); fs.writeFileSync(sp, ut);
        } catch (e) { villur.push('settings.json: ' + e.message); }
      }
    }
  }
  return { breytt, villur, afrit: breytt.length && !athuga ? afritRot : null };
}

function lina(r) {
  if (!r || (!r.breytt.length && !r.villur.length)) return '';
  return 'Almennar reglur samstilltar á þessari vél (~/.claude ← brunaholf/claude-global): ' + (r.breytt.join(' · ') || 'ekkert')
    + (r.villur.length ? ' — VILLUR: ' + r.villur.join(' · ') : '') + (r.afrit ? ' — eldri eintök í ' + r.afrit : '');
}

module.exports = { samstilla, lina };
if (require.main === module) {
  const athuga = process.argv.includes('--athuga');
  const r = samstilla({ athuga });
  console.log(r.slokkt ? 'slökkt (BH_GLOBAL_SAMSTILLING=0)' : (athuga ? 'FRÁBRUGÐIÐ: ' : 'BREYTT: ') + (r.breytt.join('\n  ') || 'ekkert — allt eins'));
  if (r.villur.length) console.log('VILLUR: ' + r.villur.join(' · '));
  if (r.afrit) console.log('afrit: ' + r.afrit);
  process.exit(r.villur.length ? 1 : 0);
}
