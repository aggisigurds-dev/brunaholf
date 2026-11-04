#!/usr/bin/env node
// tools/agent-prompt.cjs — agent-skrár → data/agent-prompts.json (Agentakerfið 2.0, fasi 6 B, 04.11.2026)
//
// Netlify-föllin (svardrog.js o.fl.) nota sömu agent-skrár og Claude Code-loturnar sem system-prompt, en skrárnar búa í
// slokkvitaeki-repóinu og eru ekki með í brunaholf-deployinu. Þetta tól les þær og skrifar textann í data/agent-prompts.json
// sem fallið sækir um /data/agent-prompts.json (sama vefur). Ein skilgreining, tvö svið. Keyrt í lok build-agents-registry.cjs.
//
//   node tools/agent-prompt.cjs            skrifar data/agent-prompts.json fyrir AGENTAR hér fyrir neðan
//
// Sleppt úr textanum: frontmatter, línur um SQL/MCP/REST-lestur (verkfæri lotunnar, ekki þekking) og „Charlize — lestu fyrst“-kaflinn.

'use strict';
const fs = require('fs');
const path = require('path');
const BH = path.resolve(__dirname, '..');
const SL = process.env.SL_REPO ? path.resolve(process.env.SL_REPO) : path.resolve(BH, '..', 'slokkvitaeki');
const AGENTAR = { postur: SL, rukkari: SL, fyrirtaeki: SL };

function hreinsa(text) {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const meta = {};
  if (fm) { for (const l of fm[1].split('\n')) { const m = /^(\w+):\s*(.*)$/.exec(l); if (m) meta[m[1]] = m[2]; } text = text.slice(fm[0].length); }
  const out = []; let sleppa = false;
  for (const l of text.split(/\r?\n/)) {
    if (/^##\s*Charlize/i.test(l)) { sleppa = true; continue; }
    if (sleppa && /^##\s/.test(l)) sleppa = false;
    if (sleppa) continue;
    if (/execute_sql|anon-lykli|js\/config\.js|Supabase MCP|REST með/i.test(l)) continue;
    out.push(l);
  }
  return { meta, texti: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

function skrifa() {
  const agents = {};
  for (const [nafn, repo] of Object.entries(AGENTAR)) {
    const f = path.join(repo, '.claude', 'agents', nafn + '.md');
    if (!fs.existsSync(f)) { console.warn(`agent-prompt: vantar ${f}`); continue; }
    const { meta, texti } = hreinsa(fs.readFileSync(f, 'utf8'));
    agents[nafn] = { nafn, lysing: (meta.description || '').slice(0, 400), stafir: texti.length, texti };
  }
  const out = { generated: new Date().toISOString().slice(0, 10), _athugasemd: 'GENERATED af tools/agent-prompt.cjs úr <repo>/.claude/agents/<nafn>.md — breyttu agent-skránum, ekki hér. Lesið af netlify/functions/svardrog.js.', agents };
  fs.writeFileSync(path.join(BH, 'data', 'agent-prompts.json'), JSON.stringify(out, null, 1));
  console.log(`agent-prompts.json: ${Object.keys(agents).map(k => k + ' ' + agents[k].stafir).join(' · ')}`);
  return out;
}
module.exports = { skrifa, hreinsa };
if (require.main === module) skrifa();
