#!/usr/bin/env node
/* tools/deploy-vordur.cjs — DEPLOY-VÖRÐUR: Lisbeth (kodafraedingur) fer í gegnum ÖLL deploy (Agnar 05.11.2026).
 *
 * Agnar: „hún ætti í raun að fara í gegnum öll deploy“. Kveikjuorð duga ekki — enginn skrifar „kóðarýni“ þegar hann
 * segir „já, deploya“. Þessi hook (PreToolUse á Bash) sér SKIPUNINA sem fer að keyra og stoppar við deploy-skref:
 *   · git commit … "[deploy] …"            (birtingar-commitið, báðar síður)
 *   · git push þegar HEAD-commitið ber [deploy]
 *   · netlify deploy · node deploy.js · gh pr merge · git merge
 * Hann flettir upp úrskurði Lisbeth í ~/.claude/lisbeth/<repo>.json. Gildur úrskurður = RÉTT AÐFERÐ (eða RÉTT MEÐ
 * SKILYRÐUM), yngri en 4 klst, á sama kóða (git diff --quiet <head> HEAD, ekkert óvistað í tracked skrám). Þá fer
 * skipunin í gegn með línu um úrskurðinn. Annars: permissionDecision 'ask' — Agnar sér af hverju og má hleypa í gegn
 * sjálfur, en lotan fær leiðbeiningar um að kalla á Lisbeth fyrst. Hookurinn NEITAR aldrei (engin 'deny'): Agnar ræður.
 *
 * Lisbeth skráir úrskurð (hún skrifar ekki kóða, en hún skrifar úrskurðinn):
 *   node C:\projects\brunaholf\tools\deploy-vordur.cjs --urskurdur "RÉTT AÐFERÐ" --cwd <repo-rót> [--hawking "…"]
 * Staða:   node tools/deploy-vordur.cjs --stada [--cwd <repo>]
 * Þurrkeyrsla: node tools/deploy-vordur.cjs --dry "git commit --allow-empty -m \"[deploy] x\"" [--cwd <repo>]
 * Úttak: {hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision?, permissionDecisionReason?, additionalContext}}.
 * Alltaf exit 0, aldrei villa í lotuna. Mælt < 200 ms (tvö git-köll).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const G = require('./_lotu-grunnur.cjs');

const GILDISTIMI_MS = 4 * 60 * 60 * 1000;
const MAPPA = path.join(G.HEIMA, 'lisbeth');
const flagg = (arg, n) => { const i = arg.indexOf(n); return i >= 0 ? arg[i + 1] : null; };

function git(cwd, ...a) {
  try { return execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (_) { return null; }
}
function repoAf(cwd) {
  const top = git(cwd, 'rev-parse', '--show-toplevel');
  if (!top) return null;
  const b = path.basename(top).toLowerCase().replace(/-wt-.*$/, '');
  return { rot: top, nafn: G.REPO_NOFN.has(b) ? b : b };
}
/* Er þetta deploy-skref? Skilar lýsingu eða null. */
function deploySkref(cmd, cwd) {
  const c = String(cmd || '');
  if (/\[deploy\]/i.test(c) && /\bgit\s+commit\b/.test(c)) return '[deploy]-commit';
  if (/\bnetlify\s+deploy\b/.test(c)) return 'netlify deploy';
  if (/\bnode\s+deploy\.js\b/.test(c)) return 'node deploy.js (BANNAÐ — eyðir föllunum)';
  if (/\bgh\s+pr\s+merge\b/.test(c)) return 'gh pr merge';
  if (/\bgit\s+merge\b/.test(c) && !/--abort|--continue|--quit/.test(c)) return 'git merge';
  if (/\bgit\s+push\b/.test(c) && !/--dry-run/.test(c)) {
    const msg = git(cwd, 'log', '-1', '--format=%s');
    if (msg && /\[deploy\]/i.test(msg)) return 'git push með [deploy]-haus';
  }
  return null;
}
function urskurdarSkra(nafn) { return path.join(MAPPA, nafn.replace(/[^\w.-]/g, '_') + '.json'); }
function lesaUrskurd(nafn) { try { return JSON.parse(fs.readFileSync(urskurdarSkra(nafn), 'utf8')); } catch (_) { return null; } }

/* Gildir úrskurðurinn um kóðann sem er að fara út? */
function meta(repo) {
  const u = lesaUrskurd(repo.nafn);
  if (!u) return { gildur: false, hvers: 'enginn úrskurður skráður' };
  const aldur = Date.now() - Date.parse(u.ts || 0);
  if (!(aldur < GILDISTIMI_MS)) return { gildur: false, hvers: 'úrskurður eldri en 4 klst (' + String(u.ts).slice(0, 16) + ')', u };
  if (!/^RÉTT/i.test(u.urskurdur || '')) return { gildur: false, hvers: 'síðasti úrskurður var „' + u.urskurdur + '“', u };
  const head = git(repo.rot, 'rev-parse', 'HEAD');
  if (u.head && head && u.head !== head && git(repo.rot, 'diff', '--quiet', u.head, 'HEAD') === null)
    return { gildur: false, hvers: 'kóði breyttist eftir úrskurð (' + u.head.slice(0, 7) + ' → ' + head.slice(0, 7) + ')', u };
  if (git(repo.rot, 'diff', '--quiet') === null || git(repo.rot, 'diff', '--cached', '--quiet') === null)
    return { gildur: false, hvers: 'óvistaðar breytingar í tracked skrám eftir úrskurð', u };
  return { gildur: true, u };
}

function leidbeining(repo, skref, m) {
  return [
    `Deploy-vörður: „${skref}“ í ${repo.nafn} — Lisbeth (kodafraedingur) hefur EKKI hleypt þessu í gegn: ${m.hvers}.`,
    'Regla Agnars 05.11.2026: hún fer í gegnum ÖLL deploy. Gerðu þetta ÁÐUR en skipunin er keyrð aftur:',
    '1. Kallaðu á kodafraedingur (Agent, subagent_type „kodafraedingur“, eða lestu .claude/agents/kodafraedingur.md) á diffið: git diff <síðasta birta>..HEAD.',
    '2. Hún kallar á kerfisrynir (Stephen Hawking) ef breytingin snertir viðmót, síma, öpp, RLS eða Netlify-fall.',
    `3. Hún skráir úrskurðinn: node ${path.join(G.BH, 'tools', 'deploy-vordur.cjs')} --urskurdur "RÉTT AÐFERÐ" --cwd "${repo.rot}"`,
    '4. Keyrðu deploy-skrefið aftur. RÖNG AÐFERÐ = lagað fyrst, ekki deployað framhjá.',
    'Agnar má hleypa skipuninni í gegn núna (hann sér spurninguna) — þá skal segja honum að Lisbeth fór ekki yfir hana.',
  ].join('\n');
}

function logga(rod) {
  try { fs.mkdirSync(G.HEIMA, { recursive: true }); fs.appendFileSync(path.join(G.HEIMA, 'router-log.jsonl'), JSON.stringify(Object.assign({ ts: new Date().toISOString() }, rod)) + '\n'); } catch (_) {}
}

async function keyra(extra) {
  const arg = [...process.argv.slice(2), ...(Array.isArray(extra) ? extra : [])];
  const cwdFlagg = flagg(arg, '--cwd');

  if (arg.includes('--urskurdur')) {
    const repo = repoAf(cwdFlagg || process.cwd());
    if (!repo) return G.ljuka('Ekki git-repó: ' + (cwdFlagg || process.cwd()) + '\n', 1);
    const u = { ts: new Date().toISOString(), repo: repo.nafn, head: git(repo.rot, 'rev-parse', 'HEAD'), urskurdur: flagg(arg, '--urskurdur'),
      hawking: flagg(arg, '--hawking') || null, vel: require('os').hostname() };
    fs.mkdirSync(MAPPA, { recursive: true }); fs.writeFileSync(urskurdarSkra(repo.nafn), JSON.stringify(u, null, 1));
    logga({ session_id: 'lisbeth', cwd: repo.rot, deploy: { repo: repo.nafn, urskurdur: u.urskurdur, head: u.head } });
    return G.ljuka(`🖤 Lisbeth: ${u.urskurdur} skráð fyrir ${repo.nafn} á ${String(u.head).slice(0, 7)}${u.hawking ? ' · Hawking: ' + u.hawking : ''}\n`, 0);
  }
  if (arg.includes('--stada')) {
    const repo = repoAf(cwdFlagg || process.cwd());
    if (!repo) return G.ljuka('Ekki git-repó\n', 1);
    const m = meta(repo);
    return G.ljuka((m.gildur ? '✓ gildur: ' + m.u.urskurdur + ' á ' + String(m.u.head).slice(0, 7) + ' ' + String(m.u.ts).slice(0, 16) : '✗ ' + m.hvers) + '\n', 0);
  }

  const dry = arg.includes('--dry');
  let inn;
  if (dry) inn = { session_id: 'dry', cwd: cwdFlagg || process.cwd(), tool_name: 'Bash', tool_input: { command: flagg(arg, '--dry') } };
  else { try { inn = JSON.parse(await G.lesaStdin(1500) || '{}'); } catch (_) { return G.ljuka('', 0); } }
  const cwd = inn.cwd || process.cwd();
  if (arg.includes('--notandi') && G.verkefniHefur(cwd, 'deploy-vordur.cjs', 'lotu-hookar.cjs')) return G.ljuka('', 0);
  if (inn.tool_name !== 'Bash') return G.ljuka('', 0);
  const cmd = (inn.tool_input || {}).command;
  if (!cmd) return G.ljuka('', 0);
  /* -C <mappa> í skipuninni ræður repóinu, annars cwd lotunnar */
  const mC = String(cmd).match(/git\s+-C\s+"?([^"\s]+)"?/);
  const repo = repoAf(mC ? mC[1] : cwd);
  if (!repo) return G.ljuka('', 0);
  const skref = deploySkref(cmd, repo.rot);
  if (!skref) return G.ljuka(dry ? '(ekki deploy-skref)\n' : '', 0);
  const m = meta(repo);
  const ut = { hookEventName: 'PreToolUse' };
  if (m.gildur) {
    ut.additionalContext = `Deploy-vörður: Lisbeth úrskurðaði ${m.u.urskurdur} á ${String(m.u.head).slice(0, 7)} kl. ${String(m.u.ts).slice(11, 16)} (${repo.nafn})${m.u.hawking ? ' · Hawking: ' + m.u.hawking : ''}. „${skref}“ fer í gegn.`;
  } else {
    ut.permissionDecision = 'ask';
    ut.permissionDecisionReason = `🖤 Lisbeth hefur ekki farið yfir þetta deploy (${repo.nafn}): ${m.hvers}. Kalla á kodafraedingur fyrst — eða hleypa í gegn án yfirferðar?`;
    ut.additionalContext = leidbeining(repo, skref, m);
  }
  if (!dry) logga({ session_id: inn.session_id, cwd, deploy: { repo: repo.nafn, skref, gildur: m.gildur, hvers: m.hvers || null } });
  return G.ljuka(JSON.stringify({ hookSpecificOutput: ut }) + '\n', 0);
}

module.exports = { keyra, deploySkref, meta };
if (require.main === module) keyra().catch(() => G.ljuka('', 0));
