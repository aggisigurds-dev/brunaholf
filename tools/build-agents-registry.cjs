#!/usr/bin/env node
// Býr til js/agents-registry.js (Jarvis → Sérfræðingar) úr agent- og skill-skránum sjálfum.
// Lýsing, kveikjuorð, verkfæri og dagsetning koma úr skránum; persóna, sérhæfing og „aldrei“
// koma úr tools/agents-meta.json. Keyra eftir hverja breytingu á .claude/agents eða .claude/skills:
//   node tools/build-agents-registry.cjs
//
// 04.11.2026 (Agentakerfið 2.0, fasi 2): skrifar líka
//   data/agents-registry.json  — hreint JSON (sama efni og window.AGENTS_REGISTRY + pages/thekja/gagnakort),
//                                lesið af tools/router.cjs (UserPromptSubmit-hook) án vafra.
//   data/sidukort.json         — öll síðukort sameinuð, með reiknaðri stöðu (✅/⚠️/❌) og þekju per vef.
//   docs/AGENTASKRA.md         — tafla milli <!-- SIDUKORT:BEGIN --> og <!-- SIDUKORT:END -->.
// Síðukort repós: <repo>/.claude/sidukort.json (vantar → engar síður, byggjarinn keyrir samt).
// Agentar eru líka lesnir úr kjarna (KJ_REPO), en afrit þar (lína „> AFRIT — frumrit í …“ eða eldra
// „> ⚠️ **Afrit …**“) eru sleppt — kjarni á afrit, ekki frumrit.
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const BH = path.resolve(__dirname, '..');
const SL = process.env.SL_REPO ? path.resolve(process.env.SL_REPO) : path.resolve(BH, '..', 'slokkvitaeki');
const KJ = process.env.KJ_REPO ? path.resolve(process.env.KJ_REPO) : path.resolve(BH, '..', 'kjarni');
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'agents-meta.json'), 'utf8'));
const DOMAIN = new Set(META.skillFlokkar.domain);
// Afrits-merki. Staðlaða línan er „> AFRIT — frumrit í <repo>/…“; kjarni ber enn eldri formin
// „> ⚠️ **Afrit í kjarna** …“ og „> ⚠️ **Afrit** …“ (öll 21 eintökin 04.11.2026), svo þau gilda líka.
const AFRIT_RE = /^> (?:AFRIT — frumrit í|⚠️ \*\*Afrit\b)/m;

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
// 04.11.2026: tvö git-köll per repó (status + log yfir .claude) í stað tveggja per skrá — byggingin
// tók 5½ mín á Windows með ~130 skrám. Sama niðurstaða: óhrein/ný skrá → mtime, annars síðasta commit.
const gitCache = new Map();
function gitInfo(repoDir) {
  if (gitCache.has(repoDir)) return gitCache.get(repoDir);
  const g = { ok: false, dirty: new Set(), dates: new Map() };
  try {
    const o = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
    const st = cp.execFileSync('git', ['-c', 'core.quotePath=false', '-C', repoDir, 'status', '--porcelain', '-uall', '--', '.claude'], o);
    for (const ln of st.split('\n')) if (ln.length > 3) g.dirty.add(ln.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, '').trim());
    const lg = cp.execFileSync('git', ['-c', 'core.quotePath=false', '-C', repoDir, 'log', '--format=@%cs', '--name-only', '--', '.claude'], o);
    let d = null;
    for (const ln of lg.split('\n')) {
      if (ln.startsWith('@')) d = ln.slice(1).trim();
      else if (ln.trim() && d && !g.dates.has(ln.trim())) g.dates.set(ln.trim(), d);
    }
    g.ok = true;
  } catch (_) {}
  gitCache.set(repoDir, g);
  return g;
}
function gitDate(repoDir, file) {
  const g = gitInfo(repoDir);
  const rel = path.relative(repoDir, file).split(path.sep).join('/');
  if (!g.ok || g.dirty.has(rel)) return dateOf(file);
  return g.dates.get(rel) || dateOf(file);
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
function add(type, name, repo, file, relLabel, date, fm, afrit) {
  const id = `${type}:${name}`;
  const { lysing, kveikjuord } = splitDesc(fm.description || '');
  const skra = { repo, path: relLabel, uppfaert: date, linur: lineCount(file) };
  if (afrit) skra.afrit = true;   // router.cjs velur fyrstu skrá sem er EKKI afrit
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

// Agentar: brunaholf fyrst (frumskrá), svo slokkvitaeki, svo kjarni (afritum sleppt)
const slepptKjarni = [];
for (const [repo, dir] of [['brunaholf', BH], ['slokkvitaeki', SL], ['kjarni', KJ]]) {
  const ad = path.join(dir, '.claude', 'agents');
  if (!fs.existsSync(ad)) { console.warn('vantar', ad); continue; }
  for (const f of fs.readdirSync(ad).filter(x => x.endsWith('.md')).sort()) {
    const file = path.join(ad, f);
    const text = fs.readFileSync(file, 'utf8');
    const afrit = AFRIT_RE.test(text);
    if (repo === 'kjarni' && afrit) { slepptKjarni.push(f); continue; }
    const fm = parseFM(text);
    add('agent', fm.name || f.replace(/\.md$/, ''), repo, file, `.claude/agents/${f}`, gitDate(dir, file), fm, afrit);
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

/* ── Síðukort ─────────────────────────────────────────────────────────────
 * <repo>/.claude/sidukort.json:
 *   { utgafa, vefur, vefagent, sidur:[{ id, titill, tegund, leid, skilgreind[], yfir, eigandi,
 *                                         undiragentar[], kveikjuord[], stada? }] }
 * Vantar skrána → null (engar síður fyrir það repó). Ógilt JSON → viðvörun, ekki hrun. */
const arr = v => Array.isArray(v) ? v.filter(x => x != null && x !== '').map(String) : (v ? [String(v)] : []);
function readSidukort(repo, dir) {
  const f = path.join(dir, '.claude', 'sidukort.json');
  if (!fs.existsSync(f)) return null;
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); }
  catch (e) { console.warn(`  ! ${repo}/.claude/sidukort.json er ekki gilt JSON (${e.message}) — sleppt`); return null; }
  const vefur = j.vefur || repo;
  const sidur = (Array.isArray(j.sidur) ? j.sidur : []).filter(s => s && s.id).map(s => ({
    vefur, repo, id: String(s.id), titill: s.titill || String(s.id), tegund: s.tegund || null, leid: s.leid || null,
    skilgreind: arr(s.skilgreind), yfir: s.yfir || null, eigandi: s.eigandi || null,
    undiragentar: arr(s.undiragentar), kveikjuord: arr(s.kveikjuord),
    merki: typeof s.stada === 'string' && !/^(✅|⚠️|❌)$/.test(s.stada) ? s.stada : null,
  }));
  return { repo, dir, vefur, utgafa: j.utgafa || null, vefagent: j.vefagent || null, sidur };
}

/* stada: ❌ enginn eigandi · ⚠️ eigandi ekki í registry EÐA skilgreind-skrá finnst ekki · ✅ annars.
 * Bætir entry.sidur = [{id, vefur, titill, hlutverk}] við agentana og skilar þekju per vef. */
/* Eigandi í öðru repói eða skill utan registry: „sl:arnold“ / „bh:skjol“ / „kj:…“ → sama nafn í registry
 * (agent eða skill); „skill:3dJoker“ → skill í registry EÐA mappa ~/.claude/skills/<nafn>/SKILL.md.
 * Skilar { ok, entry, nafn, utan } — utan = eigandinn býr ekki í repói síðunnar (Jarvis sýnir það sem ⇢). */
function leysaEiganda(eig, byName) {
  const m = /^(sl|bh|kj|skill):(.+)$/.exec(eig || '');
  if (!m) return { ok: byName.has(eig), entry: byName.get(eig) || null, nafn: eig, utan: false };
  const nafn = m[2], entry = byName.get(nafn) || null;
  if (entry) return { ok: true, entry, nafn, utan: true };
  if (m[1] === 'skill' && HOME && fs.existsSync(path.join(HOME, '.claude', 'skills', nafn, 'SKILL.md'))) return { ok: true, entry: null, nafn, utan: true };
  return { ok: false, entry: null, nafn, utan: true };
}

function computeCoverage(pages, list, kortin) {
  const byName = new Map();
  for (const e of list) if (!byName.has(e.name) || e.type === 'agent') byName.set(e.name, e);
  const dirOf = new Map(kortin.map(k => [k.repo, k.dir]));
  for (const e of list) e.sidur = [];
  for (const p of pages) {
    const astaeda = [];
    if (!p.eigandi) { p.stada = '❌'; astaeda.push('enginn eigandi'); }
    else {
      if (!leysaEiganda(p.eigandi, byName).ok) astaeda.push(`eigandi „${p.eigandi}“ er ekki í registry`);
      const d = dirOf.get(p.repo);
      for (const s of p.skilgreind) if (d && !fs.existsSync(path.join(d, s.split('#')[0]))) astaeda.push(`skrá finnst ekki: ${s}`);
      p.stada = astaeda.length ? '⚠️' : '✅';
    }
    p.astaeda = astaeda;
    const le = p.eigandi ? leysaEiganda(p.eigandi, byName) : null;
    p.eigandi_nafn = le ? le.nafn : null; p.eigandi_utan = !!(le && le.utan);
    const e = le && le.entry;
    if (e) e.sidur.push({ id: p.id, vefur: p.vefur, titill: p.titill, hlutverk: 'eigandi' });
    for (const u of p.undiragentar) {
      const ue = leysaEiganda(u, byName).entry;
      if (ue && ue !== e) ue.sidur.push({ id: p.id, vefur: p.vefur, titill: p.titill, hlutverk: 'undiragent' });
    }
  }
  const thekja = kortin.map(k => {
    const ps = pages.filter(p => p.vefur === k.vefur && p.repo === k.repo);
    const n = s => ps.filter(p => p.stada === s).length;
    return { vefur: k.vefur, repo: k.repo, utgafa: k.utgafa, vefagent: k.vefagent, alls: ps.length,
      med_eiganda: n('✅'), vidvorun: n('⚠️'), an_eiganda: n('❌'),
      hlutfall: ps.length ? Math.round(100 * n('✅') / ps.length) : 0 };
  });
  return thekja;
}

/* Skiptir út efni milli BEGIN/END í skjali (eða bætir aftast). Heldur línuendingum skjalsins. */
function writeBlock(file, BEGIN, END, lines) {
  if (!fs.existsSync(file)) return false;
  let t = fs.readFileSync(file, 'utf8');
  const nl = t.includes('\r\n') ? '\r\n' : '\n';
  const b = [BEGIN, ...lines, END].join('\n').replace(/\n/g, nl);
  const i = t.indexOf(BEGIN), j = t.indexOf(END);
  t = i !== -1 && j > i ? t.slice(0, i) + b + t.slice(j + END.length) : t.replace(/\s*$/, '') + nl + nl + b + nl;
  fs.writeFileSync(file, t);
  return true;
}

/* Gagnakort (töfluhlutinn): töflu- og view-heiti úr create-setningum í sql/ (+ MIGRATION.sql og
 * skill-scripts) og úr .from('…') / rest/v1/… í netlify/functions beggja rekstrar-repóa.
 * router.cjs notar það til að merkja „gat“ (prompt nefnir töflu en enginn eigandi fannst).
 * Skrifað í data/gagnakort.json, sem er í data/.gitignore: töfluskemað er innra efni (netlify.toml
 * lokar /sql/* og CLAUDE.md af sömu ástæðu) og data/ er birt. Anon-lykillinn má ekki lesa OpenAPI-rótina. */
function lesaToflur() {
  const set = new Set();
  const reSql = /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)/gi;
  const reJs = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)|\/rest\/v1\/([a-z_][a-z0-9_]*)/g;
  const skrar = (d, ending) => { try { return fs.readdirSync(d).filter(f => f.endsWith(ending)).map(f => path.join(d, f)); } catch (_) { return []; } };
  const sql = [], js = [];
  for (const rot of [BH, SL]) {
    sql.push(...skrar(path.join(rot, 'sql'), '.sql'));
    try { for (const s of fs.readdirSync(path.join(rot, '.claude', 'skills'))) sql.push(...skrar(path.join(rot, '.claude', 'skills', s, 'scripts'), '.sql')); } catch (_) {}
    js.push(...skrar(path.join(rot, 'netlify', 'functions'), '.js'), ...skrar(path.join(rot, 'netlify', 'functions'), '.mjs'));
  }
  if (fs.existsSync(path.join(SL, 'MIGRATION.sql'))) sql.push(path.join(SL, 'MIGRATION.sql'));
  for (const [list, re] of [[sql, reSql], [js, reJs]]) for (const f of list) {
    let t; try { t = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    for (const m of t.matchAll(re)) { const n = (m[1] || m[2] || '').toLowerCase(); if (n && n !== 'rpc') set.add(n); }
  }
  return [...set].sort();
}

const list = [...entries.values()].map(e => {
  e.uppfaert = e.skrar.map(s => s.uppfaert).sort().pop();
  return e;
}).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'is'));

const kortin = [['brunaholf', BH], ['slokkvitaeki', SL], ['kjarni', KJ]].map(([r, d]) => readSidukort(r, d)).filter(Boolean);
const pages = kortin.flatMap(k => k.sidur);
const thekja = computeCoverage(pages, list, kortin);

const out = {
  generated: new Date().toISOString().slice(0, 10),
  agents: list.filter(e => e.type === 'agent').length,
  skills: list.filter(e => e.type === 'skill').length,
  list,
};
fs.writeFileSync(path.join(BH, 'js', 'agents-registry.js'),
  '// GENERATED af tools/build-agents-registry.cjs — ekki breyta í höndunum.\nwindow.AGENTS_REGISTRY = ' + JSON.stringify(out) + ';\n');

// data/agents-registry.json + data/sidukort.json (hreint JSON fyrir router.cjs og önnur tól)
fs.mkdirSync(path.join(BH, 'data'), { recursive: true });
const toflur = lesaToflur();
fs.writeFileSync(path.join(BH, 'data', 'agents-registry.json'),
  JSON.stringify({ ...out, pages, thekja, kjarni_afrit_sleppt: slepptKjarni }, null, 1) + '\n');
fs.writeFileSync(path.join(BH, 'data', 'gagnakort.json'), JSON.stringify({
  generated: out.generated,
  _athugasemd: 'GENERATED af tools/build-agents-registry.cjs (sql/, skill-scripts, netlify/functions). Staðbundið — í data/.gitignore.',
  toflur,
}) + '\n');
fs.writeFileSync(path.join(BH, 'data', 'sidukort.json'), JSON.stringify({
  generated: out.generated,
  _athugasemd: 'GENERATED af tools/build-agents-registry.cjs úr <repo>/.claude/sidukort.json — breyttu síðukortunum, ekki hér.',
  vefir: thekja, sidur: pages,
}, null, 1) + '\n');

// docs/TRIGGERS.md: sjálfvirk tafla (kveikjuorð úr description) milli merkja
const dd = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : '—'; };
const rows = list.filter(e => e.kveikjuord.length && (e.type === 'agent' || e.flokkur === 'skill'));
writeBlock(path.join(BH, 'docs', 'TRIGGERS.md'), '<!-- AGENT-KVEIKJUR:BEGIN -->', '<!-- AGENT-KVEIKJUR:END -->', [
  '## Sjálfvirk tafla — kveikjuorð úr `description` (búin til af `node tools/build-agents-registry.cjs`)',
  '',
  `Byggð ${out.generated}. Þessi tafla er dregin beint úr agent- og skill-skránum og gildir ef hún stangast á við handskrifuðu töfluna hér að ofan. Breyttu kveikjuorðum í \`description:\` skrárinnar, ekki hér.`,
  '',
  '| Heiti | Tegund | Kveikjuorð | Skrá síðast uppfærð |',
  '|---|---|---|---|',
  ...rows.map(e => `| \`${e.name}\` | ${e.type === 'agent' ? 'agent' : 'skill'} | ${e.kveikjuord.map(k => '`' + k.replace(/\|/g, '/') + '`').join(' · ')} | ${dd(e.uppfaert)} |`),
]);

// docs/AGENTASKRA.md: síðukortið — hver á hverja síðu
const cell = s => String(s == null || s === '' ? '—' : s).replace(/\|/g, '/').replace(/\s+/g, ' ');
const code = s => s ? '`' + cell(s) + '`' : '—';
const skLines = [
  '## Síðukort — hver á hverja síðu (búið til af `node tools/build-agents-registry.cjs`)',
  '',
];
if (!pages.length) {
  skLines.push(`Byggt ${out.generated}. _Ekkert síðukort fannst enn: \`.claude/sidukort.json\` vantar í brunaholf, slokkvitaeki og kjarna. Drög: \`node tools/sidukort-fraedi.cjs --repo <slóð>\` (eigendur fylltir úr greiningarlotum, svo vistað sem \`<repo>/.claude/sidukort.json\`)._`);
} else {
  skLines.push(
    `Byggt ${out.generated} úr ${kortin.map(k => '`' + k.repo + '/.claude/sidukort.json`').join(', ')}. Staða: ✅ eigandi til · ⚠️ eigandi ekki í registry eða skilgreind-skrá finnst ekki · ❌ enginn eigandi. Breyttu síðukortinu, ekki hér.`,
    '',
    '| Vefur | Síða | Leið | Skilgreind | Eigandi | Undiragentar | Staða |',
    '|---|---|---|---|---|---|---|',
    ...pages.map(p => `| ${cell(p.vefur)} | ${cell(p.titill)} | ${code(p.leid)} | ${p.skilgreind.length ? p.skilgreind.map(code).join(' · ') : '—'} | ${p.eigandi ? '`' + p.eigandi + '`' : '—'} | ${p.undiragentar.length ? p.undiragentar.map(u => '`' + u + '`').join(' · ') : '—'} | ${p.stada}${p.astaeda.length && p.stada === '⚠️' ? ' ' + cell(p.astaeda.join('; ')) : ''} |`),
    '',
    '**Samantekt:** ' + thekja.map(t => `${t.vefur} ${t.med_eiganda}/${t.alls} með eiganda (${t.hlutfall}%), ${t.vidvorun} ⚠️, ${t.an_eiganda} ❌`).join(' · '),
    '',
    '### Síður án eiganda',
    '',
  );
  const an = pages.filter(p => p.stada === '❌');
  if (an.length) skLines.push(...an.map(p => `- ${cell(p.vefur)} · ${cell(p.titill)}${p.leid ? ' (`' + cell(p.leid) + '`)' : ''}`));
  else skLines.push('_Engar — allar síður eiga eiganda._');
}
writeBlock(path.join(BH, 'docs', 'AGENTASKRA.md'), '<!-- SIDUKORT:BEGIN -->', '<!-- SIDUKORT:END -->', skLines);

console.log(`js/agents-registry.js: ${out.agents} agentar, ${out.skills} skills (${list.length} færslur)`);
console.log(`data/agents-registry.json + data/sidukort.json: ${pages.length} síður úr ${kortin.length} síðukortum; data/gagnakort.json: ${toflur.length} töflur`
  + (slepptKjarni.length ? `; kjarni: ${slepptKjarni.length} afrit sleppt` : ''));
for (const t of thekja) console.log(`  síðukort ${t.vefur}: ${t.med_eiganda}/${t.alls} ✅ · ${t.vidvorun} ⚠️ · ${t.an_eiganda} ❌`);
for (const e of list) {
  const warn = [];
  if (!e.kveikjuord.length) warn.push('engin kveikjuorð');
  if (e.type === 'agent' && !e.serhaefing.length) warn.push('vantar meta');
  if (warn.length) console.log(`  ! ${e.type}:${e.name} — ${warn.join(', ')}`);
}

// 04.11.2026 (fasi 6 B): agent-skrár → data/agent-prompts.json fyrir Netlify-föllin (svardrog.js) — sama heimild, tvö svið.
try { require('./agent-prompt.cjs').skrifa(); } catch (e) { console.warn('agent-prompt.cjs:', e.message); }
