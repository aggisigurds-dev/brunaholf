/* _lotu-grunnur.cjs — sameiginlegt fyrir lotu-hookana (router.cjs, lotu-lok.cjs, lotu-byrjun.cjs)
 * og felog-saekja.cjs. Engar npm-dependencies, Node 20+.
 *
 * Repó-rætur: brunaholf = þessi mappa/.. ; hin eru systurmöppur (path.resolve(__dirname,'..','..')),
 * nema BH_REPO / SL_REPO / KJ_REPO segi annað.
 * Supabase-lyklar: sama uppspretta og allt annað — slokkvitaeki/js/config.js (mynstrið úr
 * slokkvitaeki/tools/minni.cjs keys()); varaleið SUPABASE_URL + SUPABASE_ANON_KEY í umhverfi.
 * Lykillinn er ALDREI prentaður. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const BH = process.env.BH_REPO ? path.resolve(process.env.BH_REPO) : path.resolve(__dirname, '..');
const ROT = path.resolve(__dirname, '..', '..');
const REPO = {
  brunaholf: BH,
  slokkvitaeki: process.env.SL_REPO ? path.resolve(process.env.SL_REPO) : path.join(ROT, 'slokkvitaeki'),
  kjarni: process.env.KJ_REPO ? path.resolve(process.env.KJ_REPO) : path.join(ROT, 'kjarni'),
};
const HEIMA = path.join(os.homedir(), '.claude');
const REPO_NOFN = new Set(['brunaholf', 'slokkvitaeki', 'kjarni', 'slokkvitaeki-arnold']);

/* repo-heiti lotunnar: basename(cwd) ef þekkt repó, annars 'projects' */
function repoNafn(cwd) {
  const b = path.basename(path.resolve(cwd || '.')).toLowerCase();
  return REPO_NOFN.has(b) ? b : 'projects';
}

let _keys;
function keys() {
  if (_keys !== undefined) return _keys;
  _keys = null;
  try {
    const cfg = fs.readFileSync(path.join(REPO.slokkvitaeki, 'js', 'config.js'), 'utf8');
    const url = (cfg.match(/SUPABASE_URL\s*=\s*["']([^"']+)/) || [])[1];
    const key = (cfg.match(/SUPABASE_KEY\s*=\s*["']([^"']+)/) || [])[1];
    if (url && key) _keys = { url, key };
  } catch (_) {}
  if (!_keys && process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY)) {
    _keys = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY };
  }
  if (_keys) _keys.h = { apikey: _keys.key, Authorization: 'Bearer ' + _keys.key, 'content-type': 'application/json' };
  return _keys;
}

/* Les stdin hooksins. Claude Code lokar stdin eftir JSON-ið; ef ekkert berst (handkeyrsla í
 * terminal) er haldið áfram eftir `ms` — hook má aldrei hanga. */
function lesaStdin(ms = 1500) {
  return new Promise(res => {
    if (process.stdin.isTTY) return res('');
    let d = '', lokid = false;
    const klara = () => {
      if (lokid) return; lokid = true; clearTimeout(t);
      try { process.stdin.removeAllListeners(); process.stdin.destroy(); } catch (_) {}
      res(d);
    };
    const t = setTimeout(klara, ms);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { d += c; });
    process.stdin.on('end', klara);
    process.stdin.on('error', klara);
  });
}

/* Hefur verkefnið sjálft (cwd/.claude/settings*.json) þegar þennan hook? Notað af --notandi
 * svo ~/.claude/settings.json keyri hann ekki tvisvar. */
function verkefniHefur(cwd, ...nofn) {
  // Lota opnuð í HEIMAMÖPPUNNI sjálfri (t.d. C:\Users\Slokkvitaeki á skrifstofuvélinni, 04.11.2026): þá er
  // <cwd>/.claude/settings.json = ~/.claude/settings.json, notendahookurinn sjálfur — ekki verkefnishookur.
  // Án þessarar línu þagði --notandi þar og engin lota fékk leiðarvísi né skráningu.
  try { if (path.resolve(cwd || '.') === path.resolve(os.homedir())) return false; } catch (_) {}
  for (const f of ['settings.json', 'settings.local.json']) {
    try {
      const t = fs.readFileSync(path.join(cwd || '.', '.claude', f), 'utf8');
      if (nofn.some(n => t.includes(n))) return true;
    } catch (_) {}
  }
  return false;
}

/* ── Kennitölur ──────────────────────────────────────────────────────────
 * Aðeins LÖGAÐILAR (fyrsti stafur 4–7) eru teknir: kt einstaklinga fara hvorki í log,
 * charlize_sessions (opin anon-tafla) né data/felog.json. */
const KT_RE = /\b\d{6}-?\d{4}\b/g;
const ktSnid = s => { const d = String(s || '').replace(/\D/g, ''); return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : null; };
const ktLogadili = kt => /^[4-7]/.test(kt || '');
function ktGild(kt) {
  const d = String(kt || '').replace(/\D/g, '');
  if (d.length !== 10) return false;
  const dagur = +d.slice(0, 2), man = +d.slice(2, 4);
  const dd = dagur > 40 ? dagur - 40 : dagur;
  if (dd < 1 || dd > 31 || man < 1 || man > 12) return false;
  if (!'890'.includes(d[9])) return false;
  const v = [3, 2, 7, 6, 5, 4, 3, 2];
  let s = 0; for (let i = 0; i < 8; i++) s += v[i] * +d[i];
  let r = 11 - (s % 11); if (r === 11) r = 0;
  return r !== 10 && r === +d[8];
}
/* Allar kt lögaðila í texta. `thekktar` (Set) = kt sem eru í felog.json — þær gilda þótt vartalan bregðist. */
function finnaKt(texti, thekktar) {
  const ut = new Set();
  for (const m of String(texti || '').matchAll(KT_RE)) {
    const kt = ktSnid(m[0]);
    if (kt && ktLogadili(kt) && ((thekktar && thekktar.has(kt)) || ktGild(kt))) ut.add(kt);
  }
  return [...ut];
}

/* fetch með tímamörkum sem kastar aldrei — skilar { ok, status, json|text } eða { ok:false, villa } */
async function saekja(slod, opt = {}, ms = 3000) {
  try {
    const r = await fetch(slod, { ...opt, signal: AbortSignal.timeout(ms) });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (_) {}
    return { ok: r.ok, status: r.status, json: j, text: t, headers: r.headers };
  } catch (e) { return { ok: false, status: 0, villa: e.name === 'TimeoutError' ? 'timeout' : e.message }; }
}

/* Skrifar á stdout og hættir — hook-ferli mega ekki hanga á opnum socketum. */
function ljuka(texti, kodi = 0) {
  if (texti) process.stdout.write(texti, () => process.exit(kodi));
  else process.exit(kodi);
}

module.exports = { BH, ROT, REPO, HEIMA, REPO_NOFN, repoNafn, keys, lesaStdin, verkefniHefur,
  KT_RE, ktSnid, ktLogadili, ktGild, finnaKt, saekja, ljuka };
