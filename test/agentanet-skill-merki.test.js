// Agentanetið merkir skills sýnilega (17.11.2026). Keyrsla: node --test test/agentanet-skill-merki.test.js
//
// AF HVERJU: js/agentanet.js teiknar fjögur skills (villuleit, variant-analysis, arnold, 3dJoker) eins og agenta
// um harðkóðaða lista (VERDIR og concat(['arnold', '3dJoker'])). Á netinu litu þau út eins og agentar sem hægt væri
// að ræsa sem undirlotu. Þau eiga að haldast á netinu en bera merkið „skill". Þetta próf les listana úr kóðanum,
// flettir hverju nafni upp í js/agents-registry.js og fellur ef skill á listunum fær ekki merkið.
// (Vafra-staðfesting 17.11.2026: 2 skill-hnútar + 2 skill-verðir, 4 merki, punktalína, engin JS-villa.)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROT = path.join(__dirname, '..');
const KODI = fs.readFileSync(path.join(ROT, 'js/agentanet.js'), 'utf8');

function registry() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROT, 'js/agents-registry.js'), 'utf8'), ctx);
  return ctx.window.AGENTS_REGISTRY;
}
const strengir = (s) => (s.match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1));

test('hörðkóðuðu listarnir innihalda skills — annars er merkið óþarft og prófið úrelt', () => {
  const R = registry();
  const tegund = (n) => { const l = R.list.filter((e) => e.name === n); return l.some((e) => e.type === 'agent') ? 'agent' : (l[0] || {}).type; };
  const verdir = strengir((KODI.match(/var VERDIR = \[([\s\S]*?)\];/) || [])[1] || '');
  const aukaSer = strengir((KODI.match(/\.concat\(\[([^\]]*)\]\.map\(entry\)/) || [])[1] || '');
  assert.ok(verdir.length > 5, 'VERDIR fannst ekki í js/agentanet.js');
  const skills = verdir.concat(aukaSer).filter((n) => tegund(n) === 'skill');
  assert.ok(skills.length >= 1, 'enginn skill á listunum lengur');
});

test('hnútur og varðahnappur bera skill-merki þegar færslan er skill', () => {
  // node(): flokkur nd-skill + merkið inni í <b>; teiknaVerdi(): flokkur gw-skill + merkið.
  assert.match(KODI, /function erSkill\(n\)\s*\{[^}]*type === 'skill'/, 'erSkill() vantar eða les ekki registry-tegund');
  assert.match(KODI, /'<div class="nd ' \+ cls[^\n]*erSkill\(e\.name\) \? ' nd-skill'/, 'hnútur fær ekki nd-skill');
  assert.match(KODI, /esc\(e\.name\) \+ \(erSkill\(e\.name\) \? ' ' \+ SKILL_MERKI/, 'hnútur sýnir ekki merkið');
  assert.match(KODI, /'<button type="button" class="gw' \+ cls \+ \(erSkill\(n\) \? ' gw-skill'/, 'varðahnappur fær ekki gw-skill');
  assert.match(KODI, /esc\(n\) \+ \(erSkill\(n\) \? ' ' \+ SKILL_MERKI/, 'varðahnappur sýnir ekki merkið');
  const css = fs.readFileSync(path.join(ROT, 'css/agentanet.css'), 'utf8');
  assert.match(css, /\.an-ov \.tg-skill\{/, 'útlit merkisins vantar í css/agentanet.css');
});

test('jarvis.html sækir nýja útgáfu (skyndiminni)', () => {
  const html = fs.readFileSync(path.join(ROT, 'jarvis.html'), 'utf8');
  assert.match(html, /\/js\/agentanet\.js\?v=2026111[7-9]|\/js\/agentanet\.js\?v=202611[2-3]\d|\/js\/agentanet\.js\?v=2026121/);
});
