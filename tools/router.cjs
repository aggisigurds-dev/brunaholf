#!/usr/bin/env node
/* router.cjs — kveikjuorða-router (UserPromptSubmit-hook). Agentakerfið 2.0, fasi 3 (04.11.2026).
 *
 * Les prompt Agnars, finnur hvaða agent(ar) eiga málið út frá kveikjuorðum í
 * data/agents-registry.json (úr tools/build-agents-registry.cjs), síðukortunum og
 * fyrirtækjanöfnum/kennitölum (data/felog.json), og skilar leiðarvísi sem additionalContext.
 * Lotan fær þannig ALGERA slóð að agent-skránni + „ALDREI“-línurnar, í stað þess að treysta á að
 * Claude velji réttan agent sjálf.
 *
 *   (hook)   stdin {session_id, transcript_path, cwd, prompt, …} → stdout hookSpecificOutput-JSON
 *   node tools/router.cjs --dry "<prompt>" [--cwd <slóð>]   leiðarvísirinn á stdout, stigataflan á stderr
 *   node tools/router.cjs --test                            keyrir tools/router.prof.json (exit 1 á misræmi)
 *   node tools/router.cjs --notandi                         (í ~/.claude/settings.json) þegir ef verkefnið
 *                                                            hefur router.cjs í eigin .claude/settings.json
 *
 * Reglurnar:
 *   Normalísering  NFC, lágstafir, orð = [a-z0-9þæöðáéíóúý]+; orð < 3 stafir hunsuð nema kt,qr,pos,rls,
 *                  vsk,pdf,nav,3d; viðskeyti strípað (stofn ≥ 4); forskeyti ≥ 5 telst beyging;
 *                  broddalaus ritháttur (thjonustubord) telst beyging.
 *   Stig           kveikjuorð nákvæmt 3 · beygt 2 · síðuheiti/síðu-kveikjuorð 3 (til eiganda síðunnar) ·
 *                  almennt orð (skrá, muna, sala, kort, borð, flipi, app, skjal, villa, prófa, staðan) 1,
 *                  og telur aðeins ef agentinn hefur annað hitt. Sama orð fer til þess agents sem nær
 *                  hæstu stigum á það (jafntefli deilist).
 *   Val            ≥ 2 stig, hámark 3 agentar; jafntefli → sá sem á heima í basename(cwd).
 *   Þögn           prompt sem byrjar á „/“ eða er < 3 orð.
 *   Fyrirtæki      kt (\b\d{6}-?\d{4}\b, aðeins lögaðilar) eða nafn úr data/felog.json (≥ 2 orð eða
 *                  ≥ 8 stafir) → agentinn `fyrirtaeki` fremst (nefndur þótt hann vanti í registry) +
 *                  charlize_yfirlit('<kt>') um REST, 3 s tímamörk; hámark 2 fyrirtæki.
 *   Log            ~/.claude/router-log.jsonl {ts,session_id,cwd,ord,agentar,kt,gat} — ENGINN prompt-texti.
 *                  gat:true = prompt > 8 orð nefnir síðu (síðukort) eða töflu (data/gagnakort.json) en enginn eigandi fannst.
 * Eina netkallið er charlize_yfirlit, og aðeins þegar fyrirtæki finnst. Hookinn hættir alltaf með exit 0. */
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./_lotu-grunnur.cjs');

/* ── Normalísering ──────────────────────────────────────────────────────── */
const STUTT = new Set(['kt', 'qr', 'pos', 'rls', 'vsk', 'pdf', 'nav', '3d']);
const VISK = /(innar|inu|num|nir|nar|inn|ins|in|ið|um|ar|ir|ur|na|i|a|u|s)$/;
const FOLD = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ý: 'y', ð: 'd', þ: 'th', æ: 'ae', ö: 'o' };
const fold = w => w.replace(/[áéíóúýðþæö]/g, c => FOLD[c]);
function stofn(w) {
  const m = VISK.exec(w);
  return m && w.length - m[0].length >= 4 ? w.slice(0, w.length - m[0].length) : w;
}
const tok = w => { const s = stofn(w); return { w, s, f: fold(s) }; };
const ordin = texti => String(texti || '').normalize('NFC').toLowerCase().split(/[^a-z0-9þæöðáéíóúý]+/);
/* Fallorð sem hittu kveikjuorð með stofn-pörun (04.11.2026: „fyrir“ ~ fyrirtæki → stjórinn kallaður á hvert „fyrir mig“). */
const FALLORD = new Set(['fyrir', 'eftir', 'undir', 'yfir', 'milli', 'þegar', 'þetta', 'þessi', 'þessu', 'þessa', 'aðeins', 'alveg', 'hvernig', 'hvort',
  'einnig', 'þannig', 'vegna', 'meðan', 'síðan', 'núna', 'bara', 'líka', 'samt', 'annars', 'allir', 'allar', 'öllum', 'hérna', 'þarna', 'eitthvað', 'ekkert', 'hægt']);
/* orð fyrir kveikjuorð: < 3 stafir hunsuð nema STUTT; fallorð aldrei */
const ord = texti => ordin(texti).filter(w => w && !FALLORD.has(w) && (w.length >= 3 || STUTT.has(w))).map(tok);
/* orð fyrir fyrirtækjanöfn: tölur haldast (Laugavegur 11), lagaform (ehf, hf …) fara */
const LAGAFORM = new Set(['ehf', 'hf', 'sf', 'ses', 'slf', 'ohf', 'bs', 'svf', 'hses', 'co']);
const ordN = texti => ordin(texti).filter(w => w && !LAGAFORM.has(w) && (w.length >= 3 || /^\d+$/.test(w) || STUTT.has(w))).map(tok);

/* forskeyti ≥ 5 stafir og afgangurinn ≤ 3 stafir: beyging (rukka ~ rukkaðu), ekki samsetning
 * (þjónustu ≁ þjónustuborð, skýrsla ≁ skýrslustöð). */
const forskeyti = (a, b) => { const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return s.length >= 5 && l.length - s.length <= 3 && l.startsWith(s); };
/* 'n' = nákvæmt, 'b' = beygt, null = ekki */
function sama(p, k) {
  if (p.w === k.w) return 'n';
  if (p.s === k.s || p.f === k.f || forskeyti(p.w, k.w) || forskeyti(p.s, k.s) || forskeyti(p.f, k.f)) return 'b';
  return null;
}
const ALMENN = ['skrá', 'muna', 'sala', 'kort', 'borð', 'flipi', 'app', 'skjal', 'villa', 'prófa', 'staðan'].map(tok);
const erAlmennt = K => K.length === 1 && ALMENN.some(a => K[0].w === a.w || K[0].s === a.s || K[0].f === a.f);

/* Finnur K (orðaröð) samfellt í P; skilar { pos[], teg:'n'|'b' } — nákvæmt tekið fram yfir beygt. */
function finnaRod(K, P) {
  let best = null;
  for (let i = 0; i + K.length <= P.length; i++) {
    let allN = true, ok = true;
    for (let j = 0; j < K.length; j++) {
      const t = sama(P[i + j], K[j]);
      if (!t) { ok = false; break; }
      if (t !== 'n') allN = false;
    }
    if (!ok) continue;
    const pos = K.map((_, j) => i + j);
    if (allN) return { pos, teg: 'n' };
    if (!best) best = { pos, teg: 'b' };
  }
  return best;
}

/* ── Gögn (lesin einu sinni per ferli) ──────────────────────────────────── */
function lesaJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } }
function lesaRegistry(cwd) {
  for (const f of [path.join(cwd || '.', 'data', 'agents-registry.json'), path.resolve(__dirname, '..', 'data', 'agents-registry.json')]) {
    const r = fs.existsSync(f) && lesaJson(f);
    if (r && Array.isArray(r.list)) return { r, dir: path.dirname(f) };
  }
  return null;
}
const FAST_STOPP = ['slökkvitæki', 'slökkvikerfi', 'brunahólf', 'brunakerfi', 'eldklár', 'húsfélag', 'reikningur',
  'endurvinnslan', 'herbergjaleiga', 'stilling', 'innviðir', 'provision', 'fyrirtæki', 'verkstæði'];
function lesaFelog(dir, kvOrd) {
  const f = [path.join(dir, 'felog.json'), path.resolve(__dirname, '..', 'data', 'felog.json')].find(x => fs.existsSync(x));
  const j = f && lesaJson(f);
  const ut = { til: !!j, kt: new Map(), index: new Map() };
  if (!j || !Array.isArray(j.felog)) return ut;
  const stopp = new Set([...FAST_STOPP.map(w => fold(stofn(w))), ...kvOrd]);
  for (const [kt, nafn] of j.felog) {
    if (!ut.kt.has(kt)) ut.kt.set(kt, nafn);
    const K = ordN(nafn);
    if (!K.length) continue;
    const stafir = K.reduce((n, t) => n + t.w.length, 0);
    if (!(K.length >= 2 || stafir >= 8)) continue;
    if (K.length === 1 && stopp.has(K[0].f)) continue;
    const lyk = K[0].f.slice(0, 6);
    if (!ut.index.has(lyk)) ut.index.set(lyk, []);
    ut.index.get(lyk).push({ kt, nafn, K, stafir });
  }
  return ut;
}
/* nafnamatch: stofn eða broddalaust jafnt, eða forskeyti þegar bæði ≥ 6 (Landspítali ~ Landspítalanum) */
const samaN = (p, k) => p.w === k.w || p.s === k.s || p.f === k.f || (p.f.length >= 6 && k.f.length >= 6 && forskeyti(p.f, k.f));
function finnaFelog(PN, felog) {
  const hitt = [];
  for (let i = 0; i < PN.length; i++) {
    const c = felog.index.get(PN[i].f.slice(0, 6));
    if (!c) continue;
    for (const x of c) {
      if (i + x.K.length > PN.length) continue;
      let ok = true;
      for (let j = 0; j < x.K.length; j++) if (!samaN(PN[i + j], x.K[j])) { ok = false; break; }
      if (ok) hitt.push({ ...x, pos: i });
    }
  }
  hitt.sort((a, b) => b.K.length - a.K.length || b.stafir - a.stafir);
  return hitt;
}

/* ── Greining ───────────────────────────────────────────────────────────── */
const _gogn = new Map();
function gogn(cwd, profsidur) {
  const lykill = (profsidur ? 'prof:' : '') + path.resolve(cwd || '.');
  if (_gogn.has(lykill)) return _gogn.get(lykill);
  const reg = lesaRegistry(cwd);
  if (!reg) return null;
  const { r, dir } = reg;
  const agentar = r.list.filter(e => e.type === 'agent');
  const kv = agentar.map(e => ({ e, kv: e.kveikjuord.map(k => ({ k, K: ord(k) })).filter(x => x.K.length) }));
  const kvOrd = new Set();
  for (const a of kv) for (const x of a.kv) if (x.K.length === 1) kvOrd.add(x.K[0].f);
  const sidur = [...(r.pages || []), ...(profsidur || [])].map(p => {
    const heiti = new Set([String(p.titill || '').split(/[·(—–]/)[0].trim(), ...(p.kveikjuord || [])]);
    if (p.id && !/[:/]/.test(p.id) && p.id.length >= 4) heiti.add(p.id);
    return { p, heiti: [...heiti].filter(Boolean).map(h => ({ h, K: ord(h) })).filter(x => x.K.length) };
  });
  for (const s of sidur) for (const x of s.heiti) if (x.K.length === 1) kvOrd.add(x.K[0].f);
  // gagnakort: data/gagnakort.json (staðbundið, gitignore) — vantar → engin töfluskynjun, aðeins síður
  const gk = lesaJson(path.join(dir, 'gagnakort.json')) || lesaJson(path.resolve(__dirname, '..', 'data', 'gagnakort.json')) || {};
  const toflur = (gk.toflur || []).filter(t => t.includes('_') || t.length >= 6);
  const g = { r, dir, agentar, kv, sidur, toflur, byName: new Map(agentar.map(e => [e.name, e])), felog: lesaFelog(dir, kvOrd) };
  _gogn.set(lykill, g);
  return g;
}

function greina(prompt, cwd, opt = {}) {
  const tomt = (astaeda) => ({ thogn: true, astaeda, agentar: [], ord: [], kt: [], fyrirtaeki: [], sidur: [], gat: false, stig: [] });
  const texti = String(prompt || '').trim();
  if (!texti) return tomt('tómt prompt');
  if (texti.startsWith('/')) return tomt('skipun (/…)');
  const fjoldiOrda = texti.split(/\s+/).filter(Boolean).length;
  if (fjoldiOrda < 3) return tomt('færri en 3 orð');
  const g = gogn(cwd, opt.profsidur);
  if (!g) return tomt('data/agents-registry.json finnst ekki');
  const heima = G.repoNafn(cwd);
  const sneid = texti.slice(0, 6000);
  const P = ord(sneid);

  // 1) kandídatar: kveikjuorð agenta + síðuheiti (til eiganda)
  const kand = [];
  for (const { e, kv } of g.kv) for (const { k, K } of kv) {
    const m = finnaRod(K, P);
    if (!m) continue;
    const alm = erAlmennt(K);
    kand.push({ agent: e.name, kv: k, pos: m.pos, stig: alm ? 1 : (m.teg === 'n' ? 3 : 2), alm, teg: m.teg });
  }
  const sidaHitt = [];
  for (const { p, heiti } of g.sidur) for (const { h, K } of heiti) {
    const m = finnaRod(K, P);
    if (!m) continue;
    sidaHitt.push({ p, h });
    if (p.eigandi) { const alm = erAlmennt(K); kand.push({ agent: p.eigandi, kv: h, pos: m.pos, stig: alm ? 1 : 3, alm, teg: m.teg, sida: p }); }
    break;
  }
  // 2) hvert orð fer til hæstu stiga (jafntefli deilist)
  const hamark = new Map();
  for (const c of kand) for (const i of c.pos) hamark.set(i, Math.max(hamark.get(i) || 0, c.stig));
  const gild = kand.filter(c => c.stig >= Math.max(...c.pos.map(i => hamark.get(i))));
  // 3) stig per agent: skarast ekki, almenn orð aðeins með öðru hitti
  const perA = new Map();
  for (const c of gild.sort((a, b) => b.stig - a.stig || b.pos.length - a.pos.length)) {
    const a = perA.get(c.agent) || { agent: c.agent, notud: new Set(), hitt: [], serhaeft: 0 };
    if (c.pos.some(i => a.notud.has(i))) continue;
    c.pos.forEach(i => a.notud.add(i));
    a.hitt.push(c);
    if (!c.alm) a.serhaeft++;
    perA.set(c.agent, a);
  }
  const stig = [...perA.values()].map(a => {
    const hitt = a.serhaeft ? a.hitt : [];
    const e = g.byName.get(a.agent);
    return { agent: a.agent, stig: hitt.reduce((n, c) => n + c.stig, 0), hitt: a.hitt, heima: !!(e && heimaRepo(e).includes(heima)) };
  }).sort((a, b) => b.stig - a.stig || (b.heima - a.heima) || a.agent.localeCompare(b.agent));
  const valdir = stig.filter(s => s.stig >= 2).slice(0, 3);

  // 4) fyrirtæki: kt í texta + nöfn úr felog.json
  const fyrirtaeki = [];
  const ktTexti = G.finnaKt(texti, g.felog.kt);
  for (const kt of ktTexti) fyrirtaeki.push({ kt, nafn: g.felog.kt.get(kt) || null, hvadan: 'kt' });
  if (g.felog.til) {
    for (const h of finnaFelog(ordN(sneid), g.felog)) {
      if (fyrirtaeki.length >= 2) break;
      if (fyrirtaeki.some(f => f.kt === h.kt)) continue;
      fyrirtaeki.push({ kt: h.kt, nafn: h.nafn, hvadan: 'nafn' });
    }
  }
  fyrirtaeki.splice(2);

  // 5) síður sem passa + gat
  const sidur = [];
  for (const s of sidaHitt) if (!sidur.includes(s.p)) sidur.push(s.p);
  const nefnirToflu = g.toflur.filter(t => t.includes('_') ? new RegExp('(^|[^a-z0-9_])' + t + '($|[^a-z0-9_])').test(sneid.toLowerCase()) : P.some(p => p.w === t)).slice(0, 5);
  const enginnEigandi = sidur.some(p => !p.eigandi) || (!valdir.length && !fyrirtaeki.length);
  const gat = fjoldiOrda > 8 && (sidur.length > 0 || nefnirToflu.length > 0) && enginnEigandi;

  const agentar = valdir.map(v => v.agent);
  if (fyrirtaeki.length) agentar.unshift('fyrirtaeki');
  const ordUt = [...new Set(valdir.flatMap(v => v.hitt.map(c => c.kv)).concat(fyrirtaeki.map(f => f.nafn || f.kt)))].slice(0, 12);
  return { thogn: false, agentar, valdir, stig, fyrirtaeki, sidur, toflur: nefnirToflu, gat, ord: ordUt, fjoldi: fjoldiOrda, kt: fyrirtaeki.map(f => f.kt), g, heima };
}

function heimaRepo(e) { return (e.skrar || []).filter(s => !s.afrit).map(s => s.repo); }
function agentSkra(e) {
  const s = (e.skrar || []).find(x => !x.afrit) || (e.skrar || [])[0];
  if (!s) return null;
  const rot = s.repo === 'notandi' ? G.HEIMA : G.REPO[s.repo];
  if (!rot) return null;
  const p = path.join(rot, s.path.replace(/^~\/\.claude\/|^~\//, ''));
  return { slod: p, til: fs.existsSync(p) };
}

/* ── Kúnnaminnið: charlize_yfirlit('<kt>') ──────────────────────────────── */
async function kunnaminni(kts) {
  const k = G.keys();
  if (!k) return kts.map(kt => ({ kt, texti: null, villa: 'enginn lykill' }));
  return Promise.all(kts.map(async kt => {
    const r = await G.saekja(`${k.url}/rest/v1/rpc/charlize_yfirlit`, { method: 'POST', headers: k.h, body: JSON.stringify({ kt }) }, 3000);
    if (r.ok && typeof r.json === 'string') return { kt, texti: r.json };
    // 42702 = „nafn“ tvírætt í fallinu þegar charlize_contacts skilar engu (anon) — lagað í sql/2026-11-04_charlize_yfirlit_fix.sql
    const pg = r.json && r.json.code ? `${r.json.code}${r.json.code === '42702' ? ', fallið sjálft bilað — sql/2026-11-04_charlize_yfirlit_fix.sql' : ''}` : null;
    return { kt, texti: null, villa: r.villa || (r.status + (pg ? ' ' + pg : '')) };
  }));
}

/* ── Leiðarvísirinn (additionalContext) ─────────────────────────────────── */
function smida(res, minni) {
  if (res.thogn) return '';
  const { g } = res;
  if (!res.valdir.length && !res.fyrirtaeki.length && !res.sidur.length) {
    // Boðhlaupið (Agnar 04.11.2026): enginn sérfræðingur hitti — keflið fellur samt ekki, jarvis heldur því. Aðeins þegar
    // promptið lýsir verki (≥ 9 orð), svo stutt svör („já gerðu það“) fái ekki línu.
    if ((res.fjoldi || 0) >= 9) return 'Keflið: engin kveikjuorð hittu — jarvis (stjóri) heldur keflinu. Finndu eiganda verksins í data/sidukort.json eða docs/AGENTASKRA.md (eða `node tools/router.cjs --dry "<verkið>"`) og réttu honum það áður en þú vinnur; finnist enginn: jarvis vinnur og skráir gat.';
    return '';
  }
  const L = [];
  const kvL = [];
  for (const v of res.valdir) for (const c of v.hitt.filter(c => !c.alm || v.hitt.some(x => !x.alm))) kvL.push(`„${c.kv}“ → ${v.agent}`);
  for (const f of res.fyrirtaeki) kvL.push(`${f.hvadan === 'kt' ? 'kt ' + f.kt : '„' + f.nafn + '“'} → fyrirtaeki`);
  L.push('Leiðarvísir — kveikjuorð: ' + (kvL.length ? kvL.slice(0, 8).join(' · ') : '(engin)'));
  for (const p of res.sidur.slice(0, 2)) {
    L.push(`Síða: ${p.titill} (${p.vefur}${p.leid ? ', ' + p.leid : ''}) — ${p.eigandi ? 'eigandi ' + p.eigandi : 'ENGINN EIGANDI skráður (gat í síðukortinu)'}`
      + (p.undiragentar && p.undiragentar.length ? '; undiragentar: ' + p.undiragentar.join(', ') : ''));
  }
  for (const f of res.fyrirtaeki) L.push(`Fyrirtæki: ${f.nafn || '(nafn ekki í data/felog.json)'} — kt ${f.kt}`);
  const fremstur = res.agentar[0];
  if (fremstur) {
    const e = g.byName.get(fremstur);
    L.push(`Forráðamaður lotunnar: ${fremstur}${e ? ' (' + [e.emoji, e.rodd].filter(Boolean).join(' ') + ')' : ''}`);
  }
  if (res.agentar.length) {
    L.push('Agentar — lestu skrána ÁÐUR en þú vinnur verkið:');
    for (const n of res.agentar) {
      const e = g.byName.get(n);
      if (!e) { L.push(`- ${n} — (agent ekki til í registry enn; byggðu á kúnnaminninu hér að neðan og kunnaskra fyrir kt-tengingar)`); continue; }
      const s = agentSkra(e);
      L.push(`- ${n} — ${s ? (s.til ? s.slod : s.slod + ' (skrá vantar á þessari vél)') : '(skrá vantar á þessari vél)'}`);
      if (e.aldrei && e.aldrei.length) L.push(`  ALDREI: ${e.aldrei.slice(0, 4).join(' · ')}`);
    }
  }
  if (minni && minni.length) {
    for (const m of minni) {
      if (m.texti) L.push(`Kúnnaminnið — charlize_yfirlit('${m.kt}'):`, ...m.texti.split('\n').slice(0, 24).map(x => '  ' + x.slice(0, 220)));
      else L.push(`Kúnnaminnið (${m.kt}): Charlize nær ekki í grunninn (${m.villa}) — sæktu með charlize_yfirlit('${m.kt}') síðar.`);
    }
  }
  L.push('Í repo-rótinni má kalla á agentinn sem undiragent (subagent_type = nafnið); ef cwd er ekki repo-rót: lestu skrána með Read og fylgdu henni.');
  return L.join('\n');
}

function stigatafla(res) {
  if (res.thogn) return `(þögn: ${res.astaeda})`;
  const L = ['agent            stig  heima  hitt'];
  for (const s of res.stig) L.push(`${s.agent.padEnd(16)} ${String(s.stig).padStart(4)}  ${s.heima ? ' já  ' : '     '}  ${s.hitt.map(c => `${c.kv}(${c.stig}${c.teg === 'b' ? 'b' : ''}${c.alm ? ',alm' : ''})`).join(' ')}`);
  if (!res.stig.length) L.push('(engin kveikjuorð hittu)');
  L.push(`valdir: ${res.agentar.join(', ') || '—'} · kt: ${res.kt.join(', ') || '—'} · síður: ${res.sidur.map(p => p.titill).join(', ') || '—'} · töflur: ${res.toflur.join(', ') || '—'} · gat: ${res.gat}`);
  return L.join('\n');
}

/* ── Próf ───────────────────────────────────────────────────────────────── */
function profa() {
  const f = path.join(__dirname, 'router.prof.json');
  const j = lesaJson(f);
  if (!j || !Array.isArray(j.tilvik)) { console.error('router.prof.json vantar eða er ógilt'); return 1; }
  let villur = 0, sleppt = 0;
  const t0 = Date.now();
  for (const t of j.tilvik) {
    const cwd = t.cwd || G.REPO.brunaholf;
    const res = greina(t.prompt, cwd, { profsidur: j._profsidur });
    // tilvik sem krefjast staðbundinna skráa (data/felog.json, data/gagnakort.json — ekki í git) sleppa ef þær vantar
    const vantar = [].concat(t.krefst || []).filter(k => !fs.existsSync(path.resolve(__dirname, '..', 'data', k + '.json')));
    if (vantar.length) { sleppt++; console.log(`  –  ${t.prompt.slice(0, 70)}  (sleppt: data/${vantar[0]}.json vantar — keyrðu ${vantar[0] === 'felog' ? 'tools/felog-saekja.cjs' : 'tools/build-agents-registry.cjs'})`); continue; }
    const vandi = [];
    const ctx = smida(res, null);
    if (t.tomt && ctx) vandi.push(`átti að þegja, fékk: ${res.agentar.join(', ') || res.sidur.map(p => p.titill).join(', ')}`);
    for (const a of t.vaent || []) if (!res.agentar.includes(a)) vandi.push(`vantar ${a}`);
    for (const a of t.ekki || []) if (res.agentar.includes(a)) vandi.push(`átti ekki að fá ${a}`);
    if (t.fremstur && res.agentar[0] !== t.fremstur) vandi.push(`fremstur ${res.agentar[0] || '—'} ≠ ${t.fremstur}`);
    if (t.kt) for (const k of t.kt) if (!res.kt.includes(k)) vandi.push(`vantar kt ${k}`);
    if (typeof t.gat === 'boolean' && res.gat !== t.gat) vandi.push(`gat ${res.gat} ≠ ${t.gat}`);
    if (t.sida && !res.sidur.some(p => p.id === t.sida)) vandi.push(`vantar síðu ${t.sida}`);
    if (vandi.length) villur++;
    console.log(`${vandi.length ? '  ✗' : '  ✓'} ${t.prompt.slice(0, 70).padEnd(70)} → ${res.thogn ? '(þögn)' : res.agentar.join(', ') || '—'}${vandi.length ? '   ← ' + vandi.join('; ') : ''}`);
  }
  console.log(`${j.tilvik.length - villur - sleppt}/${j.tilvik.length - sleppt} rétt${sleppt ? `, ${sleppt} sleppt` : ''} (${Date.now() - t0} ms)`);
  return villur ? 1 : 0;
}

/* ── Keyrsla ────────────────────────────────────────────────────────────── */
async function keyra(arg = process.argv.slice(2)) {
  const flagg = n => { const i = arg.indexOf(n); return i > -1 ? arg[i + 1] : null; };
  if (arg.includes('--test')) return G.ljuka('', profa());
  const dry = arg.includes('--dry');
  let inn;
  if (dry) inn = { prompt: flagg('--dry') || '', cwd: flagg('--cwd') || process.cwd(), session_id: 'dry' };
  else {
    try { inn = JSON.parse(await G.lesaStdin(2000) || '{}'); } catch (_) { return G.ljuka('', 0); }
  }
  const cwd = inn.cwd || process.cwd();
  if (arg.includes('--notandi') && G.verkefniHefur(cwd, 'router.cjs', 'lotu-hookar.cjs')) return G.ljuka('', 0);

  const res = greina(inn.prompt, cwd);
  const minni = !res.thogn && res.fyrirtaeki.length && !arg.includes('--an-nets') ? await kunnaminni(res.kt) : null;
  const ctx = smida(res, minni);

  if (dry) {
    process.stderr.write(stigatafla(res) + '\n');
    return G.ljuka((ctx || '(enginn leiðarvísir — routerinn þegir)') + '\n', 0);
  }
  if (!res.thogn) {
    try {
      fs.mkdirSync(G.HEIMA, { recursive: true });
      fs.appendFileSync(path.join(G.HEIMA, 'router-log.jsonl'), JSON.stringify({
        ts: new Date().toISOString(), session_id: inn.session_id || null, cwd,
        ord: res.ord, agentar: res.agentar, kt: res.kt, gat: res.gat,
      }) + '\n');
    } catch (_) {}
  }
  if (!ctx) return G.ljuka('', 0);
  return G.ljuka(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx } }), 0);
}

module.exports = { keyra, greina, smida, ord, stofn };
if (require.main === module) keyra().catch(() => G.ljuka('', 0));
