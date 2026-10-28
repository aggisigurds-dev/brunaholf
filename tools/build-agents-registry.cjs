#!/usr/bin/env node
// Býr til js/agents-registry.js (Jarvis → Sérfræðingar) úr agent- og skill-skránum sjálfum.
// Lýsing, kveikjuorð, verkfæri og dagsetning koma úr skránum; persóna, sérhæfing og „aldrei“
// koma úr tools/agents-meta.json. Keyra eftir hverja breytingu á .claude/agents eða .claude/skills:
//   node tools/build-agents-registry.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const BH = path.resolve(__dirname, '..');
const SL = process.env.SL_REPO ? path.resolve(process.env.SL_REPO) : path.resolve(BH, '..', 'slokkvitaeki');
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'agents-meta.json'), 'utf8'));
const DOMAIN = new Set(META.skillFlokkar.domain);

function parseFM(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  let key = null, mode = null, buf = [];
  const flush = () => {
    if (key !== null) out[key] = buf.join(mode === '|' ? '\n' : ' ').replace(/[ \t]+/g, ' ').trim().replace(/^(["'])([\s\S]*)\1$/, '$2');
    key = null; buf = []; mode = null;
  };
  for (const ln of m[1].split(/\r?\n/)) {
    const kv = ln.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) {
      flush(); key = kv[1];
      if (/^[>|][-+]?$/.test(kv[2])) mode = kv[2][0]; else { mode = 's'; buf = [kv[2]]; }
    } else if (key !== null) buf.push(ln.trim());
  }
  flush();
  return out;
}

function dateOf(file) {
  const d = fs.statSync(file).mtime;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function gitDate(repoDir, file) {
  try {
    const rel = path.relative(repoDir, file);
    const dirty = cp.execFileSync('git', ['-C', repoDir, 'status', '--porcelain', '--', rel], { encoding: 'utf8' }).trim();
    if (dirty) return dateOf(file);
    const d = cp.execFileSync('git', ['-C', repoDir, 'log', '-1', '--format=%cs', '--', rel], { encoding: 'utf8' }).trim();
    return d || dateOf(file);
  } catch (_) { return dateOf(file); }
}
const lineCount = f => fs.readFileSync(f, 'utf8').split('\n').length;

function splitDesc(desc) {
  let lysing = desc || '';
  let kv = [];
  const m = lysing.match(/(?:Kveikjuorð|Trigger words?|Triggers?)\s*:\s*([\s\S]+)$/i);
  if (m) {
    lysing = lysing.slice(0, m.index).trim();
    kv = m[1].split(/\.\s+(?=[A-ZÁÐÉÍÓÚÝÞÆÖ])/)[0].split(/\s*[,·;]\s*/).map(s => s.replace(/[.\s]+$/, '').replace(/^["„“]|["“”]$/g, '').trim()).filter(Boolean);
  } else {
    kv = [...lysing.matchAll(/[„"]([^“"”]{2,50})[“"”]/g)].map(x => x[1].trim());
  }
  lysing = lysing.replace(/\s*Rödd í Jarvis:[^.]*\.?/i, '').replace(/\s+/g, ' ').trim();
  return { lysing, kveikjuord: [...new Set(kv)] };
}

function pluginSkillRoots() {
  const base = path.join(process.env.APPDATA || '', 'Claude', 'local-agent-mode-sessions', 'skills-plugin');
  const roots = [];
  try {
    for (const a of fs.readdirSync(base)) for (const b of fs.readdirSync(path.join(base, a))) {
      const p = path.join(base, a, b, 'skills');
      if (fs.existsSync(p)) roots.push(p);
    }
  } catch (_) {}
  return roots;
}

const entries = new Map();
function add(type, name, repo, file, relLabel, date, fm) {
  const id = `${type}:${name}`;
  const { lysing, kveikjuord } = splitDesc(fm.description || '');
  const skra = { repo, path: relLabel, uppfaert: date, linur: lineCount(file) };
  const tools = (fm.tools || '').split(/\s*,\s*/).filter(Boolean);
  if (!entries.has(id)) {
    const m = type === 'agent' ? (META.agents[name] || {}) : {};
    const sk = META.skillFlokkar;
    entries.set(id, {
      id, type, name,
      emoji: m.emoji || (sk.emoji[name]) || (type === 'agent' ? '🤖' : '🧩'),
      rodd: m.rodd || null,
      flokkur: type === 'agent' ? (m.flokkur || 'len') : (DOMAIN.has(name) ? 'skill' : 'verkfaeri'),
      svid: m.svid || null,
      lysing, serhaefing: m.serhaefing || [], kveikjuord,
      aldrei: m.aldrei || (sk.aldrei && sk.aldrei[name]) || [],
      tools, heimili: [repo], skrar: [skra], afbrigdi: [],
    });
  } else {
    const e = entries.get(id);
    e.heimili.push(repo); e.skrar.push(skra);
    if (lysing && lysing !== e.lysing) e.afbrigdi.push({ repo, lysing, kveikjuord });
    for (const t of tools) if (!e.tools.includes(t)) e.tools.push(t);
  }
}

// Agentar: brunaholf fyrst (frumskrá), svo slokkvitaeki
for (const [repo, dir] of [['brunaholf', BH], ['slokkvitaeki', SL]]) {
  const ad = path.join(dir, '.claude', 'agents');
  if (!fs.existsSync(ad)) { console.warn('vantar', ad); continue; }
  for (const f of fs.readdirSync(ad).filter(x => x.endsWith('.md')).sort()) {
    const file = path.join(ad, f);
    const fm = parseFM(fs.readFileSync(file, 'utf8'));
    add('agent', fm.name || f.replace(/\.md$/, ''), repo, file, `.claude/agents/${f}`, gitDate(dir, file), fm);
  }
}
// Skills
const skillSources = [
  ['brunaholf', path.join(BH, '.claude', 'skills'), BH, '.claude/skills'],
  ['slokkvitaeki', path.join(SL, '.claude', 'skills'), SL, '.claude/skills'],
  ['notandi', path.join(HOME, '.claude', 'skills'), null, '~/.claude/skills'],
];
for (const root of pluginSkillRoots()) skillSources.push(['cowork', root, null, 'cowork-skills']);
for (const [repo, root, git, label] of skillSources) {
  if (!fs.existsSync(root)) continue;
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const file = path.join(root, d.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    if (repo === 'cowork' && !DOMAIN.has(d.name)) continue;
    const fm = parseFM(fs.readFileSync(file, 'utf8'));
    add('skill', fm.name || d.name, repo, file, `${label}/${d.name}/SKILL.md`, git ? gitDate(git, file) : dateOf(file), fm);
  }
}

const list = [...entries.values()].map(e => {
  e.uppfaert = e.skrar.map(s => s.uppfaert).sort().pop();
  return e;
}).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'is'));

const out = {
  generated: new Date().toISOString().slice(0, 10),
  agents: list.filter(e => e.type === 'agent').length,
  skills: list.filter(e => e.type === 'skill').length,
  list,
};
fs.writeFileSync(path.join(BH, 'js', 'agents-registry.js'),
  '// GENERATED af tools/build-agents-registry.cjs — ekki breyta í höndunum.\nwindow.AGENTS_REGISTRY = ' + JSON.stringify(out) + ';\n');

// docs/TRIGGERS.md: sjálfvirk tafla (kveikjuorð úr description) milli merkja
const BEGIN = '<!-- AGENT-KVEIKJUR:BEGIN -->', END = '<!-- AGENT-KVEIKJUR:END -->';
const rows = list.filter(e => e.kveikjuord.length && (e.type === 'agent' || e.flokkur === 'skill'));
const dd = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : '—'; };
const block = [
  BEGIN,
  '## Sjálfvirk tafla — kveikjuorð úr `description` (búin til af `node tools/build-agents-registry.cjs`)',
  '',
  `Byggð ${out.generated}. Þessi tafla er dregin beint úr agent- og skill-skránum og gildir ef hún stangast á við handskrifuðu töfluna hér að ofan. Breyttu kveikjuorðum í \`description:\` skrárinnar, ekki hér.`,
  '',
  '| Heiti | Tegund | Kveikjuorð | Skrá síðast uppfærð |',
  '|---|---|---|---|',
  ...rows.map(e => `| \`${e.name}\` | ${e.type === 'agent' ? 'agent' : 'skill'} | ${e.kveikjuord.map(k => '`' + k.replace(/\|/g, '/') + '`').join(' · ')} | ${dd(e.uppfaert)} |`),
  END,
].join('\n');
const tdoc = path.join(BH, 'docs', 'TRIGGERS.md');
if (fs.existsSync(tdoc)) {
  let t = fs.readFileSync(tdoc, 'utf8');
  const nl = t.includes('\r\n') ? '\r\n' : '\n';
  const b = block.replace(/\n/g, nl);
  const i = t.indexOf(BEGIN), j = t.indexOf(END);
  t = i !== -1 && j > i ? t.slice(0, i) + b + t.slice(j + END.length) : t.replace(/\s*$/, '') + nl + nl + b + nl;
  fs.writeFileSync(tdoc, t);
}

console.log(`js/agents-registry.js: ${out.agents} agentar, ${out.skills} skills (${list.length} færslur)`);
for (const e of list) {
  const warn = [];
  if (!e.kveikjuord.length) warn.push('engin kveikjuorð');
  if (e.type === 'agent' && !e.serhaefing.length) warn.push('vantar meta');
  if (warn.length) console.log(`  ! ${e.type}:${e.name} — ${warn.join(', ')}`);
}
