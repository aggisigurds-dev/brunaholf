#!/usr/bin/env node
/* tools/sidu-vordur.cjs — SÍÐUVÖRÐUR: eigandi síðunnar kemur inn þegar lotan snertir skrá hennar (04.11.2026).
 *
 * Agnar: „hittum ekkert með svona fáum triggerorðum, fyrir 30 agenta — hafa tripwire þegar þeir byrja að vinna inn á
 * sinni síðu“. Router-inn (UserPromptSubmit) sér aðeins orðin í promptinu; þessi hook sér SKRÁNA sem Claude les eða
 * breytir (PreToolUse á Read · Edit · Write · MultiEdit · NotebookEdit) og flettir henni upp í síðukortinu
 * (data/sidukort.json → sidur[].skilgreind). Finnist síða með eiganda fær lotan leiðarvísi: síða, eigandi, undiragentar,
 * agent-skrá með slóð og ALDREI-línur — EINU SINNI per síðu per lotu (ástand í ~/.claude/lotu-state/<lota>.json,
 * sama skrá og lotu-lok.cjs). Skrá sem engin síða á (í js/patches eða apps/) er skráð sem GAT í router-log.jsonl
 * → Göt-spjaldið í Jarvis / lotu-lok.
 *
 * Pörun (í þessari röð, fyrsta sem hittir gildir):
 *   1. nákvæm skrá í skilgreind (slóð miðað við repó-rót, skástrik)         js/patches/449-tolvupostar-simi.js
 *   2. index.html#renderX — aðeins ef textinn sem er skrifaður/leitað nefnir renderX (annars of vítt: 26 síður)
 *   3. sama patch-númer: js/patches/448-… ↔ skilgreind js/patches/448-…
 *   4. síðu-id í skráarheitinu: 448-tolvupostar.js ↔ id tolvupostar
 *
 * Keyrsla:  node tools/sidu-vordur.cjs            (hook, stdin {session_id,cwd,tool_name,tool_input})
 *           node tools/sidu-vordur.cjs --notandi  (í ~/.claude/settings.json) þegir ef verkefnið hefur hookinn sjálft
 *           node tools/sidu-vordur.cjs --dry <skrá> [--cwd <mappa>]   prentar leiðarvísinn, skrifar ekkert
 * Úttak: {hookSpecificOutput:{hookEventName:'PreToolUse', additionalContext}} — ALDREI neitar hann tóli (engin
 * permissionDecision), hann bætir aðeins við samhengi. Alltaf exit 0, aldrei villa í lotuna. Mælt < 150 ms.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./_lotu-grunnur.cjs');

const arg = process.argv.slice(2);
const flagg = n => { const i = arg.indexOf(n); return i >= 0 ? arg[i + 1] : null; };
const TOL = new Set(['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const lesaJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } };
const norm = s => String(s || '').replace(/\\/g, '/');
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9þæöðáéíóúý]+/g, '');

/* Hvaða repó á skrána? YSTA mappan í slóðinni sem heitir brunaholf/slokkvitaeki/kjarni (líka -wt-, -arnold) OG hefur
 * .git (skrá eða mappa — worktrees hafa skrá). Ekki innsta: kjarni/apps/slokkvitaeki/app/kjarni/… á að gefa kjarni,
 * og C:\Users\Slokkvitaeki\slokkvitaeki\… (skrifstofuvélin) á að gefa slokkvitaeki, ekki notendamöppuna. */
function repoAfSlod(skra) {
  const abs = norm(path.resolve(skra));
  const hl = abs.split('/');
  for (let i = 0; i < hl.length - 1; i++) {
    const m = hl[i].toLowerCase().match(/^(brunaholf|slokkvitaeki|kjarni)(?:-.*)?$/);
    if (!m) continue;
    const rot = hl.slice(0, i + 1).join('/');
    if (!fs.existsSync(path.join(rot, '.git'))) continue;
    return { repo: m[1], rot, rel: hl.slice(i + 1).join('/') };
  }
  return null;
}

function sidukort() {
  for (const f of [path.join(G.BH, 'data', 'sidukort.json')]) { const j = lesaJson(f); if (j && Array.isArray(j.sidur)) return j.sidur; }
  return [];
}
function registry() {
  const j = lesaJson(path.join(G.BH, 'data', 'agents-registry.json'));
  const m = new Map(); for (const e of (j && j.list) || []) if (e.type === 'agent') m.set(e.name, e);
  return m;
}
function agentSkra(e) {
  const s = (e.skrar || []).find(x => !x.afrit) || (e.skrar || [])[0];
  if (!s) return null;
  const rot = s.repo === 'notandi' ? G.HEIMA : G.REPO[s.repo];
  if (!rot) return null;
  const p = path.join(rot, s.path.replace(/^~\/\.claude\/|^~\//, ''));
  return { slod: p, til: fs.existsSync(p) };
}

/* Finnur síðurnar sem skráin skilgreinir. texti = það sem tólið skrifar/leitar (fyrir index.html#render-pörun). */
function finnaSidur(rel, repo, texti) {
  const S = sidukort().filter(p => (p.repo || p.vefur) === repo || p.vefur === repo);
  const relL = rel.toLowerCase();
  const ut = [];
  const baeta = (p, hvernig) => { if (!ut.some(x => x.p === p)) ut.push({ p, hvernig }); };
  for (const p of S) for (const sk of p.skilgreind || []) {
    const s = norm(sk).toLowerCase(), h = s.indexOf('#');
    if (h < 0) { if (s === relL) baeta(p, 'skrá'); }
    else if (s.slice(0, h) === relL && texti && texti.includes(sk.slice(h + 1))) baeta(p, sk.slice(h));
  }
  if (ut.length) return ut;
  const pm = relL.match(/^js\/patches\/(\d+[a-z]?)-/);
  if (pm) for (const p of S) if ((p.skilgreind || []).some(sk => norm(sk).toLowerCase().startsWith('js/patches/' + pm[1] + '-'))) baeta(p, 'patch ' + pm[1]);
  if (ut.length) return ut;
  const nafn = slug(path.basename(relL).replace(/\.[a-z]+$/, '').replace(/^\d+[a-z]?-/, ''));
  if (nafn.length >= 5) for (const p of S) { const id = slug(p.id); if (id.length >= 5 && (nafn === id || nafn.startsWith(id) || id.startsWith(nafn))) baeta(p, 'heiti'); }
  return ut;
}

function smida(rel, hitt, byName) {
  const L = [`Síðuvörður: skráin ${rel} skilgreinir ${hitt.length === 1 ? 'síðuna' : 'síðurnar'}:`];
  const agentar = [];
  for (const { p, hvernig } of hitt.slice(0, 3)) {
    L.push(`- ${p.titill} (${p.vefur}${p.leid ? ', ' + p.leid : ''}) — ${p.eigandi ? 'eigandi ' + p.eigandi : 'ENGINN EIGANDI (gat í síðukortinu)'}`
      + (p.undiragentar && p.undiragentar.length ? '; undiragentar: ' + p.undiragentar.join(', ') : '') + ` [pörun: ${hvernig}]`);
    if (p.eigandi && !agentar.includes(p.eigandi)) agentar.push(p.eigandi);
  }
  for (const n of agentar) {
    const e = byName.get(n);
    if (!e) { L.push(`- ${n}: (agent ekki í registry enn)`); continue; }
    const s = agentSkra(e);
    L.push(`Eigandi ${n}${e.rodd ? ' (' + [e.emoji, e.rodd].filter(Boolean).join(' ') + ')' : ''} — lestu ${s ? s.slod + (s.til ? '' : ' (vantar á þessari vél)') : '(skrá fannst ekki)'} ÁÐUR en þú breytir.`);
    if (e.aldrei && e.aldrei.length) L.push(`  ALDREI: ${e.aldrei.slice(0, 4).join(' · ')}`);
  }
  L.push('Í repo-rótinni má kalla eigandann sem undiragent (subagent_type = nafnið); hann yfirfer breytinguna á sinni síðu.');
  return { texti: L.join('\n'), agentar };
}

async function keyra() {
  const dry = arg.includes('--dry');
  let inn;
  if (dry) inn = { session_id: 'dry', cwd: flagg('--cwd') || process.cwd(), tool_name: 'Edit', tool_input: { file_path: flagg('--dry') } };
  else { try { inn = JSON.parse(await G.lesaStdin(1500) || '{}'); } catch (_) { return G.ljuka('', 0); } }
  const cwd = inn.cwd || process.cwd();
  if (arg.includes('--notandi') && G.verkefniHefur(cwd, 'sidu-vordur.cjs', 'lotu-hookar.cjs')) return G.ljuka('', 0);
  if (!TOL.has(inn.tool_name)) return G.ljuka('', 0);
  const ti = inn.tool_input || {};
  const skra = ti.file_path || ti.notebook_path || ti.path;
  if (!skra) return G.ljuka('', 0);
  const r = repoAfSlod(path.isAbsolute(skra) ? skra : path.join(cwd, skra));
  if (!r || !r.rel || /^(node_modules|\.git|_attic|backup)\//.test(r.rel)) return G.ljuka('', 0);
  const texti = [ti.old_string, ti.new_string, ti.content, ...(Array.isArray(ti.edits) ? ti.edits.flatMap(e => [e.old_string, e.new_string]) : [])].filter(Boolean).join('\n');
  const hitt = finnaSidur(r.rel, r.repo, texti);

  // ástand: einu sinni per síðu per lotu; gat einu sinni per skrá per lotu
  const sid = String(inn.session_id || 'x');
  const stSkra = path.join(G.HEIMA, 'lotu-state', sid.replace(/[^\w.-]/g, '_') + '.json');
  let st = {}; try { st = JSON.parse(fs.readFileSync(stSkra, 'utf8')); } catch (_) {}
  st.sidur_sagt = Array.isArray(st.sidur_sagt) ? st.sidur_sagt : [];
  st.gat_skrar = Array.isArray(st.gat_skrar) ? st.gat_skrar : [];
  const vista = () => { if (dry) return; try { fs.mkdirSync(path.dirname(stSkra), { recursive: true }); fs.writeFileSync(stSkra, JSON.stringify(st)); } catch (_) {} };
  const logga = (rod) => { if (dry) return; try { fs.mkdirSync(G.HEIMA, { recursive: true }); fs.appendFileSync(path.join(G.HEIMA, 'router-log.jsonl'), JSON.stringify({ ts: new Date().toISOString(), session_id: inn.session_id || null, cwd, tegund: 'sida', ...rod }) + '\n'); } catch (_) {} };

  if (!hitt.length) {
    const verd = /^(js\/patches\/|apps\/.*\/(app|pages)\/|netlify\/functions\/)/.test(r.rel) || /\.html$/.test(r.rel);
    if (verd && !st.gat_skrar.includes(r.rel)) { st.gat_skrar.push(r.rel); vista(); logga({ ord: [], agentar: [], kt: [], gat: { skra: r.rel, repo: r.repo }, skra: r.rel }); }
    return G.ljuka(dry ? '(engin síða á ' + r.rel + ' í síðukortinu' + (verd ? ' — skráð sem gat' : '') + ')\n' : '', 0);
  }
  const ny = hitt.filter(h => !st.sidur_sagt.includes(h.p.id));
  if (!ny.length && !dry) return G.ljuka('', 0);
  const { texti: ctx, agentar } = smida(r.rel, dry ? hitt : ny, registry());
  for (const h of ny) st.sidur_sagt.push(h.p.id);
  vista();
  logga({ ord: [], agentar, kt: [], gat: null, skra: r.rel, sidur: ny.map(h => h.p.id) });
  if (dry) return G.ljuka(ctx + '\n', 0);
  return G.ljuka(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: ctx } }), 0);
}

module.exports = { keyra, finnaSidur, repoAfSlod };
if (require.main === module) keyra().catch(() => G.ljuka('', 0));
