#!/usr/bin/env node
/* tools/setja-hooka.cjs — setur agentakerfis-hookana upp á VÉLINNI (~/.claude/settings.json), 04.11.2026.
 *
 * Hvers vegna: hookarnir þrír (router á UserPromptSubmit, lotu-lok á Stop, lotu-byrjun á SessionStart) eru committaðir í
 * .claude/settings.json í brunaholf, slokkvitaeki og kjarni — en þeir gilda AÐEINS þegar lota er opnuð með repó-rótina sem
 * möppu. Lota opnuð í C:\projects (algengast) fær þá eingöngu úr ~/.claude/settings.json, sem er per vél. 04.11.2026 reyndust
 * þrjár nýjar lotur á skrifstofuvélinni án leiðarvísis og án skráningar í charlize_sessions — þessi skrá lagar það með einni
 * skipun á hverri vél:
 *
 *   git -C C:\projects\brunaholf pull
 *   node C:\projects\brunaholf\tools\setja-hooka.cjs --pull
 *
 * Hvað hún gerir: (1) les ~/.claude/settings.json (býr til ef vantar), tekur afrit settings.json.bak-<tími>; (2) bætir hookunum
 * þremur við með ABSOLUTE slóð á þetta brunaholf-eintak (þar sem skráin sjálf liggur) — sleppir hverjum sem er þegar til;
 * (3) með --pull: git pull --ff-only í brunaholf, slokkvitaeki og kjarni (systurmöppur) svo agent-skrár og hookar séu nýjastir;
 * (4) sannreynir: node ≥ 18, lyklar finnast (slokkvitaeki/js/config.js), router svarar prófprompti; (5) prentar töflu.
 * Flögg: --dry (sýnir, skrifar ekkert) · --check (aðeins staða) · --pull (sjá ofan). Hreyfir ALDREI við öðrum stillingum í
 * skránni (permissions, env, plugins) — aðeins hooks.<atburður> fær nýjar færslur. Afturkræft: afritið er við hliðina.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const arg = process.argv.slice(2);
const DRY = arg.includes('--dry'), CHECK = arg.includes('--check'), PULL = arg.includes('--pull');
const BH = path.resolve(__dirname, '..');
const ROT = path.dirname(BH);
const BHs = BH.replace(/\\/g, '/');
const HEIMA = path.join(os.homedir(), '.claude');
const SKRA = path.join(HEIMA, 'settings.json');
const HOOKAR = [
  ['UserPromptSubmit', 'router.cjs', 5],
  ['Stop', 'lotu-lok.cjs', 10],
  ['SessionStart', 'lotu-byrjun.cjs', 5],
  ['PreToolUse', 'sidu-vordur.cjs', 5, 'Read|Edit|Write|MultiEdit|NotebookEdit'],   // síðuvörður (04.11.2026 kvöld)
  ['PreToolUse', 'deploy-vordur.cjs', 5, 'Bash'],   // deploy-vörður: stoppar ekkert, Lisbeth fer yfir deploy eftir á (05.11.2026)
];
const REPO = ['brunaholf', 'slokkvitaeki', 'kjarni'].map(n => ({ nafn: n, slod: n === 'brunaholf' ? BH : path.join(ROT, n) }));
const ut = [];
const log = (m) => { ut.push(m); console.log(m); };

function sh(cmd, cwd) { try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).trim(); } catch (e) { return null; } }

// 1) Repó og pull
log('Vél: ' + os.hostname() + ' · notandi ' + os.userInfo().username + ' · brunaholf-eintak: ' + BH);
for (const r of REPO) {
  if (!fs.existsSync(path.join(r.slod, '.git'))) { log('  ✗ ' + r.nafn + ': vantar í ' + r.slod + ' — klónaðu það þangað (systurmappa við brunaholf)'); r.vantar = true; continue; }
  if (PULL && !DRY && !CHECK) {
    const p = sh('git pull --ff-only', r.slod);
    log('  ' + (p === null ? '⚠ ' + r.nafn + ': git pull mistókst (ópushað/ósamræmi?) — keyrðu git status þar' : '✓ ' + r.nafn + ': ' + (p.split('\n').pop() || '').slice(0, 70)));
  }
  const h = sh('git log -1 --format=%h·%cd --date=format:%d.%m.%Y', r.slod);
  log('  · ' + r.nafn + ' @ ' + (h || '?') + (sh('git status --porcelain', r.slod) ? ' (óvistaðar breytingar)' : ''));
}

// 2) Forsendur hookanna
const nodeV = parseInt(process.versions.node.split('.')[0], 10);
log((nodeV >= 18 ? '  ✓' : '  ✗') + ' node ' + process.versions.node + (nodeV >= 18 ? '' : ' — þarf 18 eða nýrra'));
for (const [, s] of HOOKAR) { const p = path.join(BH, 'tools', s); log((fs.existsSync(p) ? '  ✓ ' : '  ✗ ') + 'tools/' + s + (fs.existsSync(p) ? '' : ' VANTAR — git pull í brunaholf')); }
let lyklar = false;
try { const G = require(path.join(BH, 'tools', '_lotu-grunnur.cjs')); lyklar = !!G.keys(); } catch (_) {}
log((lyklar ? '  ✓' : '  ✗') + ' Supabase-lyklar ' + (lyklar ? 'fundust (slokkvitaeki/js/config.js)' : 'FUNDUST EKKI — slokkvitaeki-repóið þarf að vera í ' + path.join(ROT, 'slokkvitaeki')));

// 3) ~/.claude/settings.json
let st = {};
if (fs.existsSync(SKRA)) {
  try { st = JSON.parse(fs.readFileSync(SKRA, 'utf8')); } catch (e) { log('  ✗ ' + SKRA + ' er ekki gild JSON (' + e.message + ') — lagaðu hana fyrst, ekkert skrifað'); process.exit(2); }
} else log('  · ' + SKRA + ' er ekki til — verður búin til');
st.hooks = st.hooks || {};
let baett = 0, voru = 0;
for (const [ev, skra, timeout, matcher] of HOOKAR) {
  const cmd = 'node ' + BHs + '/tools/' + skra + ' --notandi';
  const listi = Array.isArray(st.hooks[ev]) ? st.hooks[ev] : (st.hooks[ev] = []);
  const til = listi.some(g => (g.hooks || []).some(h => String(h.command || '').includes('/tools/' + skra) || String(h.command || '').includes('\\tools\\' + skra)));
  if (til) { voru++; log('  = ' + ev + ' → ' + skra + ' er þegar í skránni'); continue; }
  listi.push(Object.assign(matcher ? { matcher } : {}, { hooks: [{ type: 'command', command: cmd, timeout }] }));
  baett++; log('  + ' + ev + (matcher ? ' [' + matcher + ']' : '') + ' → ' + cmd);
}
if (CHECK || DRY) {
  log(CHECK ? 'Staða aðeins — ekkert skrifað.' : 'Þurrkeyrsla — ekkert skrifað. ' + baett + ' hook(ar) myndu bætast við.');
} else if (baett) {
  fs.mkdirSync(HEIMA, { recursive: true });
  if (fs.existsSync(SKRA)) { const bak = SKRA + '.bak-' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 15); fs.copyFileSync(SKRA, bak); log('  · afrit: ' + bak); }
  fs.writeFileSync(SKRA, JSON.stringify(st, null, 2) + '\n', 'utf8');
  log('  ✓ skrifað: ' + SKRA + ' (' + baett + ' nýir hookar, ' + voru + ' voru fyrir)');
} else log('  ✓ ekkert að gera — allir þrír hookar voru þegar í ' + SKRA);

// 4) Router-próf (sama og lotan sér): verður að nefna postur fyrir „Tölvupóstar“
const prof = sh('node "' + path.join(BH, 'tools', 'router.cjs') + '" --dry "Tölvupóstar: svara pósti og senda reikning"', ROT);
const ok = !!(prof && /postur|rukkari/.test(prof));
log((ok ? '  ✓' : '  ✗') + ' router-próf: ' + (prof ? prof.split('\n').find(l => /postur|rukkari|agent/i.test(l)) || prof.split('\n')[0] : 'svaraði ekki').slice(0, 110));
log('');
log(baett && !DRY && !CHECK ? 'BÚIÐ. Hookarnir gilda í NÝRRI lotu (og í opnum lotum við næsta prompt eftir endurræsingu Claude).'
  : 'Ekkert breytt í stillingum.');
log('Sönnun í lotu: system-reminder með „Leiðarvísir — kveikjuorð“ birtist við prompt, „Síðustu lotur hér“ við ræsingu.');
process.exit(ok && lyklar ? 0 : 1);
