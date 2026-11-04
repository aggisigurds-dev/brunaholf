#!/usr/bin/env node
/* lotu-byrjun.cjs — SessionStart-hook: „Síðustu lotur hér“ úr charlize_sessions. Agentakerfið 2.0, fasi 4.
 *
 * Sækir 5 nýjustu lotur repósins (öll repó þegar cwd er C:\projects eða annað óþekkt) og skilar
 *   Síðustu lotur hér (<repo>):
 *   dd.mm HH:MM · N svör · agentar · samantekt(160)   [+ 🔴 ólokið minni]
 * „ólokið minni“ = lotan nefndi kennitölu(r) en skrifaði ekkert í kúnnaminnið (kunni_skrifad = 0).
 * 3 s tímamörk; bilun (tafla ekki til, ekkert net) → ein lína, lotan heldur áfram.
 *
 *   (hook)  stdin {session_id, cwd, source, …} → stdout {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":…}}
 *   --texti     prentar aðeins textann (til að skoða í terminal)
 *   --notandi   (í ~/.claude/settings.json) þegir ef verkefnið hefur hookinn sjálft */
'use strict';
const G = require('./_lotu-grunnur.cjs');

/* Boðhlaupið: fyrsta línan í hverri lotu — keflið má aldrei falla (Agnar 04.11.2026). */
const KEFLI = "Keflið (boðhlaup, Agnar 04.11.2026): jarvis heldur keflinu í byrjun lotu. Keflið fellur ALDREI á jörðina — sá sem heldur því vinnur verkið sé það á hans sviði, annars réttir hann það eiganda síðunnar/gagnanna (leiðarvísir, síðuvörður, data/sidukort.json, docs/AGENTASKRA.md) og segir hverjum; finnist enginn eigandi heldur jarvis því áfram og skráir gat. Lestu Charlize (skill charlize / docs/MINNISBOK.md) áður en þú byrjar.";

const tvo = n => String(n).padStart(2, '0');
const dags = iso => { const d = new Date(iso); return isNaN(d) ? '??.??' : `${tvo(d.getDate())}.${tvo(d.getMonth() + 1)} ${tvo(d.getHours())}:${tvo(d.getMinutes())}`; };

async function smida(cwd) {
  const repo = G.repoNafn(cwd);
  const k = G.keys();
  if (!k) return 'Lotuminnið (charlize_sessions) svarar ekki: enginn Supabase-lykill á þessari vél — haldið áfram.';
  const sia = repo === 'projects' ? '' : `repo=eq.${repo}&`;
  const r = await G.saekja(`${k.url}/rest/v1/charlize_sessions?${sia}order=last_at.desc&limit=5&select=last_at,repo,turns,agents_called,kennitolur,kunni_skrifad,summary`, { headers: k.h }, 3000);
  if (!r.ok || !Array.isArray(r.json)) {
    const af = r.json && r.json.code === 'PGRST205' ? 'taflan er ekki til enn — sql/2026-11-04_charlize_sessions.sql' : (r.villa || 'HTTP ' + r.status);
    return `Lotuminnið (charlize_sessions) svarar ekki (${af}) — haldið áfram.`;
  }
  if (!r.json.length) return `Síðustu lotur hér (${repo}): engar skráðar enn.`;
  const L = [`Síðustu lotur hér (${repo === 'projects' ? 'öll repó' : repo}):`];
  for (const s of r.json) {
    const kt = (s.kennitolur || []).length;
    const ag = (s.agents_called || []).slice(0, 4).join(', ') || 'engir agentar';
    const sam = String(s.summary || '').replace(/\s+/g, ' ').slice(0, 160);
    L.push(`- ${dags(s.last_at)}${repo === 'projects' ? ' [' + s.repo + ']' : ''} · ${s.turns || 0} svör · ${ag} · ${sam || '—'}`
      + (kt > 0 && !s.kunni_skrifad ? ` · 🔴 ólokið minni (${kt} kt, ekkert í kúnnaminni)` : ''));
  }
  return L.join('\n');
}

async function keyra(arg = process.argv.slice(2)) {
  let inn = {};
  try { inn = JSON.parse(await G.lesaStdin(1500) || '{}'); } catch (_) {}
  const cwd = inn.cwd || process.cwd();
  if (arg.includes('--notandi') && G.verkefniHefur(cwd, 'lotu-byrjun.cjs', 'lotu-hookar.cjs')) return G.ljuka('', 0);
  let texti;
  try { texti = await smida(cwd); } catch (e) { texti = 'Lotuminnið (charlize_sessions) svarar ekki — haldið áfram.'; }
  texti = KEFLI + '\n' + texti;
  if (arg.includes('--texti')) return G.ljuka(texti + '\n', 0);
  return G.ljuka(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texti } }) + '\n', 0);
}

module.exports = { keyra, smida };
if (require.main === module) keyra().catch(() => G.ljuka('', 0));
