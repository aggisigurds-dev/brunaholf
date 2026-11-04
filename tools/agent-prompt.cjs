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
// Allir agentar allra þriggja repóa → netlify/functions/_agent-prompts-all.json (EKKI birt opinberlega: /netlify/* er lokað í
// netlify.toml). Lesið af netlify/functions/spyrja-agent.js (fasi 6 G, „Spyrja agent“ á hverri síðu). Frumrit ráða: slokkvitaeki
// fyrst, svo brunaholf, kjarni aðeins fyrir agenta sem eru hvergi annars staðar (kjarni-vefur, artcraft, skraning).
function skrifaAll() {
  const KJ = path.resolve(BH, '..', 'kjarni');
  let meta = {}; try { meta = require(path.join(BH, 'tools', 'agents-meta.json')).agents || {}; } catch (_) {}
  const agents = {};
  for (const repo of [SL, BH, KJ]) {
    const dir = path.join(repo, '.claude', 'agents'); if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.md$/.test(f)) continue; const nafn = f.replace(/\.md$/, ''); if (agents[nafn]) continue;
      const { meta: fm, texti } = hreinsa(fs.readFileSync(path.join(dir, f), 'utf8'));
      agents[nafn] = { nafn, repo: path.basename(repo), lysing: (fm.description || '').slice(0, 400), rodd: (meta[nafn] && meta[nafn].rodd) || null, stafir: texti.length, texti: texti.slice(0, 14000) };
    }
  }
  const out = { generated: new Date().toISOString().slice(0, 10), _athugasemd: 'GENERATED af tools/agent-prompt.cjs — allir agentar, system-prompt fyrir /api/spyrja-agent. Ekki birt (netlify.toml lokar /netlify/*).', agents };
  fs.writeFileSync(path.join(BH, 'netlify', 'functions', '_agent-prompts-all.json'), JSON.stringify(out));
  console.log(`_agent-prompts-all.json: ${Object.keys(agents).length} agentar`);
  return out;
}
module.exports = { skrifa, hreinsa, skrifaAll };
if (require.main === module) { skrifa(); skrifaAll(); }
