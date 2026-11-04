#!/usr/bin/env node
/* lotu-lok.cjs — Stop-hook: lotuminnið (charlize_sessions). Agentakerfið 2.0, fasi 4 (04.11.2026).
 *
 * Eftir hvert svar: les NÝJA hluta transcript-skrárinnar (frá offset), telur svör (prompt Agnars),
 * kallaða agenta (tool_use name "Agent"/"Task" → subagent_type, annars description), skrifaðar
 * staðreyndir (minni.cjs --skra eða POST/insert í charlize_knowledge), kennitölur lögaðila í texta,
 * og sameinar raðir úr ~/.claude/router-log.jsonl með sama session_id (kt + göt). Upsertar svo eina
 * röð í charlize_sessions (session_id = lykill) — aðeins ef eitthvað breyttist.
 *
 *   (hook)  stdin {session_id, transcript_path, cwd, last_assistant_message, stop_hook_active}
 *   --dry   prentar röðina á stdout, skrifar hvorki ástand né í grunninn
 *   --notandi  (í ~/.claude/settings.json) þegir ef verkefnið hefur hookinn sjálft
 *
 * Ástand: ~/.claude/lotu-state/<session_id>.json {offset, turns, agentar, facts, kt, got, started, hash}.
 * Aldrei stdout í hook-ham, alltaf exit 0, öll netköll með AbortSignal.timeout(2000). */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const G = require('./_lotu-grunnur.cjs');

const HAMARK_LESTUR = 32 * 1024 * 1024;   // les mest 32 MB í einu (transcript getur verið 90+ MB)

function lesaNytt(slod, offset) {
  let fd;
  try {
    const st = fs.statSync(slod);
    if (st.size < offset) offset = 0;                 // skráin var endurskrifuð
    let fra = offset, hoppad = false;
    if (st.size - fra > HAMARK_LESTUR) { fra = st.size - HAMARK_LESTUR; hoppad = true; }
    const len = st.size - fra;
    if (len <= 0) return { linur: [], offset: st.size, hoppad };
    const buf = Buffer.alloc(len);
    fd = fs.openSync(slod, 'r');
    fs.readSync(fd, buf, 0, len, fra);
    const sidasta = buf.lastIndexOf(0x0a);
    if (sidasta < 0) return { linur: [], offset: fra, hoppad };
    let texti = buf.subarray(0, sidasta).toString('utf8');
    if (hoppad) texti = texti.slice(texti.indexOf('\n') + 1);   // fyrsta lína hálf
    return { linur: texti.split('\n'), offset: fra + sidasta + 1, hoppad };
  } catch (_) { return { linur: [], offset, hoppad: false }; }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch (_) {} }
}

function greinaLinur(linur) {
  const ut = { turns: 0, agentar: [], facts: 0, texti: [], fyrstaTs: null };
  for (const l of linur) {
    if (!l || l[0] !== '{') continue;
    let o; try { o = JSON.parse(l); } catch (_) { continue; }
    if (o.type !== 'user' && o.type !== 'assistant') continue;
    if (o.isSidechain) continue;
    if (!ut.fyrstaTs && o.timestamp) ut.fyrstaTs = o.timestamp;
    const c = o.message && o.message.content;
    if (o.type === 'user') {
      // raunverulegt prompt: strengur, eða fylki með texta og ENGU tool_result
      if (typeof c === 'string') { if (!o.isMeta && !/^<(command|local-command|system-reminder)/.test(c)) { ut.turns++; ut.texti.push(c); } }
      else if (Array.isArray(c) && !c.some(b => b.type === 'tool_result') && c.some(b => b.type === 'text')) {
        ut.turns++; for (const b of c) if (b.type === 'text') ut.texti.push(b.text || '');
      }
      continue;
    }
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type === 'text') ut.texti.push(b.text || '');
      if (b.type !== 'tool_use') continue;
      const i = b.input || {};
      if (b.name === 'Agent' || b.name === 'Task') ut.agentar.push(String(i.subagent_type || i.description || 'general-purpose').slice(0, 60));
      const cmd = String(i.command || i.query || '');
      if (/minni\.cjs[^\n]*--skra/.test(cmd)) ut.facts += (cmd.match(/--skra/g) || []).length;
      else if (/charlize_knowledge/.test(cmd) && /(insert\s+into|method\s*:\s*['"]POST|-X\s*POST|POST)/i.test(cmd)) ut.facts++;
    }
  }
  return ut;
}

function routerRadir(sid) {
  const f = path.join(G.HEIMA, 'router-log.jsonl');
  try {
    const st = fs.statSync(f);
    const fra = Math.max(0, st.size - 4 * 1024 * 1024);
    const buf = Buffer.alloc(st.size - fra);
    const fd = fs.openSync(f, 'r'); fs.readSync(fd, buf, 0, buf.length, fra); fs.closeSync(fd);
    return buf.toString('utf8').split('\n').filter(l => l.includes(sid)).map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(o => o && o.session_id === sid);
  } catch (_) { return []; }
}

const anKoda = s => String(s || '').replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`[^`\n]*`/g, m => m.slice(1, -1)).replace(/\s+/g, ' ').trim().slice(0, 600);

async function keyra(arg = process.argv.slice(2)) {
  const dry = arg.includes('--dry');
  let inn;
  try { inn = JSON.parse(await G.lesaStdin(dry ? 3000 : 2000) || '{}'); } catch (_) { return G.ljuka('', 0); }
  if (!inn.session_id || inn.stop_hook_active) return G.ljuka('', 0);
  const cwd = inn.cwd || process.cwd();
  if (arg.includes('--notandi') && G.verkefniHefur(cwd, 'lotu-lok.cjs', 'lotu-hookar.cjs')) return G.ljuka('', 0);

  const sid = String(inn.session_id);
  const stDir = path.join(G.HEIMA, 'lotu-state');
  const stSkra = path.join(stDir, sid.replace(/[^\w.-]/g, '_') + '.json');
  let st = { offset: 0, turns: 0, agentar: [], facts: 0, kt: [], got: [], started: null, hash: null };
  try { st = { ...st, ...JSON.parse(fs.readFileSync(stSkra, 'utf8')) }; } catch (_) {}

  const nytt = inn.transcript_path ? lesaNytt(inn.transcript_path, st.offset) : { linur: [], offset: st.offset };
  const g = greinaLinur(nytt.linur);
  st.offset = nytt.offset;
  st.turns += g.turns;
  st.facts += g.facts;
  st.started = st.started || g.fyrstaTs || new Date().toISOString();
  for (const a of g.agentar) if (!st.agentar.includes(a)) st.agentar.push(a);
  const ktSet = new Set(st.kt);
  for (const kt of G.finnaKt(g.texti.join('\n'))) ktSet.add(kt);
  const sedGot = new Set(st.got.map(x => x.ts));
  for (const r of routerRadir(sid)) {
    for (const kt of r.kt || []) if (G.ktLogadili(kt)) ktSet.add(kt);
    if (r.gat && !sedGot.has(r.ts)) { st.got.push({ ts: r.ts, ord: (r.ord || []).slice(0, 6) }); sedGot.add(r.ts); }
  }
  st.kt = [...ktSet].slice(0, 40);
  st.got = st.got.slice(-30);

  // kunni_skrifad: charlize_knowledge-raðir (scope kunni) á kt lotunnar síðan hún hófst
  let kunni = 0;
  const k = G.keys();
  if (st.kt.length && k) {
    const r = await G.saekja(`${k.url}/rest/v1/charlize_knowledge?select=id&scope=eq.kunni&kennitala=in.(${st.kt.map(encodeURIComponent).join(',')})&created_at=gte.${encodeURIComponent(st.started)}`,
      { headers: { ...k.h, Prefer: 'count=exact', Range: '0-0' } }, 2000);
    const cr = r.headers && r.headers.get && r.headers.get('content-range');
    if (cr && /\/(\d+)$/.test(cr)) kunni = +cr.match(/\/(\d+)$/)[1];
    else if (Array.isArray(r.json)) kunni = r.json.length;
  }

  const rod = {
    session_id: sid, cwd, repo: G.repoNafn(cwd), machine: os.hostname(),
    last_at: new Date().toISOString(), turns: st.turns, agents_called: st.agentar,
    kennitolur: st.kt, kunni_skrifad: kunni, got: st.got,
    summary: anKoda(inn.last_assistant_message) || null, facts_written: st.facts,
  };
  const { last_at, ...efni } = rod;
  const hash = JSON.stringify(efni);
  const breytt = hash !== st.hash;

  if (dry) {
    return G.ljuka(JSON.stringify({ rod, breytt, lesid: nytt.linur.length + ' línur' + (nytt.hoppad ? ' (hoppað yfir eldri hluta > 32 MB)' : ''), astand: stSkra }, null, 1) + '\n', 0);
  }
  if (breytt && k) {
    const r = await G.saekja(`${k.url}/rest/v1/charlize_sessions?on_conflict=session_id`, {
      method: 'POST', headers: { ...k.h, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rod),
    }, 2000);
    if (r.ok) st.hash = hash;        // misheppnað → reynt aftur í næsta svari
  }
  try { fs.mkdirSync(stDir, { recursive: true }); fs.writeFileSync(stSkra, JSON.stringify(st)); } catch (_) {}
  return G.ljuka('', 0);
}

module.exports = { keyra, greinaLinur };
if (require.main === module) keyra().catch(() => G.ljuka('', 0));
