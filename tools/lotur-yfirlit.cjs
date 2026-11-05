#!/usr/bin/env node
/* LOTUYFIRLIT — ein síða sem sýnir hvaða Claude-lotur nota eigin skill/agenta og „almennileg gögn".
 *
 * Agnar 05.11.2026: „ég er bara með svo mörg sessions, svo veit ekki hver er hvar … svo ég sjái hvort session
 * sé að notast við almennileg gögn". Les afrit lotanna (~/.claude/projects/<verkefni>/*.jsonl) og býr til
 * EINA sjálfstæða HTML-skrá (engin net, engir lyklar) + lotur-stada.json.
 *
 *   node tools/lotur-yfirlit.cjs [--out <mappa>] [--dagar 7]
 *
 * Litur lotu (heiðarlega gróft — sjá „Hvað er mælt" á síðunni):
 *   GRÆNT  = notaði eigið skill/agent OG las grunngögn (Charlize, STADREYNDIR, minni, agent-/skill-skrár)
 *   GULT   = annað hvort
 *   RAUTT  = hvorugt, þótt lotan hafi unnið (>= 6 verkfærakall)
 * Hún sér ekki: hvað undiragentar lásu í eigin afritum, skill sem hook kveikti sjálfkrafa, hvort gögnin voru rétt notuð.
 * Á síðuna fara: titill lotu (annars fyrstu 60 stafir fyrstu beiðni) og tölur — aldrei texti svara. Skrárnar eru einkamál (OneDrive), ekki birtar opinberlega.
 * Skyndiminni per skrá (stærð+mtime) svo 10 mínútna keyrsla kostar nánast ekkert.
 */
const fs = require('fs'), path = require('path'), readline = require('readline');

const H = process.env.USERPROFILE ? process.env.USERPROFILE.replace(/\\/g, '/') : 'C:/Users/Slokkvitaeki';
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DAGAR = Number(arg('dagar', 7));
const OUT = arg('out', H + '/OneDrive/Lotuyfirlit');
const PROJ = H + '/.claude/projects';
const ROD_EFTIR = 6;

const ls = d => { try { return fs.readdirSync(d); } catch { return []; } };
const EIGIN_AG = new Set([H + '/slokkvitaeki/.claude/agents', H + '/brunaholf/.claude/agents', H + '/.claude/agents']
  .flatMap(d => ls(d)).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)));
const EIGIN_SK = new Set([H + '/slokkvitaeki/.claude/skills', H + '/brunaholf/.claude/skills', H + '/.claude/skills'].flatMap(d => ls(d)));
const OEIGIN = /^anthropic-skills:(docx|xlsx|pptx|pdf|docs|chrome-browser|built-in-browser|canvas-design|consolidate-memory)/;
const eiginSk = n => EIGIN_SK.has(String(n).replace(/^(slokkvitaeki|anthropic-skills):/, '')) && !OEIGIN.test(n);

function grunnur(tool, input) {
  const blob = JSON.stringify(input || {});
  if (/execute_sql$/.test(tool) && /charlize_knowledge|v_charlize_active/i.test(blob)) return 'Charlize';
  if (!/^(Read|Grep|Glob|Bash|PowerShell)$/.test(tool)) return null;
  // Bash/PowerShell telst aðeins ef skipunin LES skrána (ekki git/ls sem nefnir slóðina í framhjáhlaupi).
  if (/^(Bash|PowerShell)$/.test(tool) && !/\b(cat|type|Get-Content|gc|sed|head|tail|grep|rg|Select-String|minni\.cjs|sls)\b/i.test(blob)) return null;
  if (/STADREYNDIR/i.test(blob)) return 'STADREYNDIR';
  if (/minni\.cjs|MINNISBOK|[\\/]memory[\\/]/i.test(blob)) return 'minni';
  if (/charlize/i.test(blob)) return 'Charlize';
  if (/\.claude[\\/]+agents[\\/]/i.test(blob)) return 'agent-skrá';
  if (/\.claude[\\/]+skills[\\/]/i.test(blob)) return 'skill-skrá';
  if (/AGENTASKRA|TRIGGERS|ORYGGISNET|MAELINGAR/i.test(blob)) return 'leiðbeiningar';
  return null;
}

async function greina(p) {
  const r = { titill: '', fyrstaBeidni: '', verkfaeri: 0, sql: 0, skill: {}, agent: {}, ownAgent: {}, grunn: {}, fyrsta: 0, sidast: 0 };
  const rl = readline.createInterface({ input: fs.createReadStream(p, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.timestamp) { const t = Date.parse(o.timestamp); if (t) { if (!r.fyrsta) r.fyrsta = t; r.sidast = t; } }
    if (o.type === 'custom-title' && o.customTitle) r.titill = o.customTitle;
    else if (o.type === 'ai-title' && o.aiTitle && !r.titill) r.titill = o.aiTitle;
    if (!r.fyrstaBeidni && o.type === 'user' && o.message && o.message.role === 'user') {
      const t = typeof o.message.content === 'string' ? o.message.content : (Array.isArray(o.message.content) ? o.message.content.map(c => c.text || '').join(' ') : '');
      const clean = t.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean && !/^\[?(SYSTEM|Request interrupted)/.test(clean)) r.fyrstaBeidni = clean.slice(0, 60);
    }
    const m = o.message;
    if (!m || m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const c of m.content) {
      if (c.type !== 'tool_use') continue;
      r.verkfaeri++;
      const n = c.name || '', i = c.input || {};
      if (/execute_sql$/.test(n)) r.sql++;
      if (n === 'Skill') { const k = i.skill || '?'; r.skill[k] = (r.skill[k] || 0) + 1; }
      else if (n === 'Agent' || n === 'Task') { const k = i.subagent_type || 'general-purpose'; r.agent[k] = (r.agent[k] || 0) + 1; }
      const g = grunnur(n, i); if (g) r.grunn[g] = (r.grunn[g] || 0) + 1;
    }
  }
  return r;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cachePath = path.join(OUT, '.cache.json');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
  const nu = Date.now();
  const skrar = [];
  for (const d of ls(PROJ)) for (const f of ls(PROJ + '/' + d)) {
    if (!f.endsWith('.jsonl')) continue;
    const p = PROJ + '/' + d + '/' + f; let st; try { st = fs.statSync(p); } catch { continue; }
    if (nu - st.mtimeMs < DAGAR * 864e5) skrar.push({ f, p, mtime: st.mtimeMs, size: st.size });
  }
  const nyCache = {};
  const raðir = [];
  for (const x of skrar) {
    const lykill = x.p; const c = cache[lykill];
    const r = (c && c.size === x.size && c.mtime === x.mtime) ? c.r : await greina(x.p);
    nyCache[lykill] = { size: x.size, mtime: x.mtime, r };
    if (r.verkfaeri < 3) continue;
    const eigSk = Object.keys(r.skill).filter(eiginSk), eigAg = Object.keys(r.agent).filter(a => EIGIN_AG.has(a));
    const grunn = Object.keys(r.grunn);
    const eigin = eigSk.length + eigAg.length > 0;
    const lit = (eigin && grunn.length) ? 'graent' : (eigin || grunn.length) ? 'gult' : (r.verkfaeri >= ROD_EFTIR ? 'rautt' : 'gra');
    raðir.push({
      id: x.f.slice(0, 8), titill: r.titill || r.fyrstaBeidni || '(án titils)', sidast: x.mtime, fyrsta: r.fyrsta || null,
      nuna: nu - x.mtime < 90e3, verkfaeri: r.verkfaeri, sql: r.sql, lit,
      skill: eigSk.map(k => [k, r.skill[k]]), agent: eigAg.map(k => [k, r.agent[k]]),
      almenn: Object.entries(r.agent).filter(([k]) => !EIGIN_AG.has(k)).reduce((a, [, v]) => a + v, 0),
      grunn: Object.entries(r.grunn),
    });
  }
  raðir.sort((a, b) => b.sidast - a.sidast);
  fs.writeFileSync(cachePath, JSON.stringify(nyCache));
  const gogn = { bunad: new Date(nu).toISOString(), dagar: DAGAR, lotur: raðir };
  fs.writeFileSync(path.join(OUT, 'lotur-stada.json'), JSON.stringify(gogn));
  fs.writeFileSync(path.join(OUT, 'lotur.html'), sida(gogn));
  const t = { graent: 0, gult: 0, rautt: 0, gra: 0 }; raðir.forEach(r => t[r.lit]++);
  console.log(`Lotuyfirlit: ${raðir.length} lotur (${DAGAR} d) · grænt ${t.graent} · gult ${t.gult} · rautt ${t.rautt} → ${OUT}/lotur.html`);
})();

function sida(g) {
  const json = JSON.stringify(g).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="120"><title>Lotuyfirlit</title>
<style>
:root{--bg:#0e1622;--kort:#162234;--lina:#243650;--txt:#e6edf6;--dauf:#8a9bb3;--graent:#3ddc84;--gult:#ffc247;--rautt:#ff5d5d;--gra:#6b7a90}
@media (prefers-color-scheme:light){:root{--bg:#f3f5f9;--kort:#fff;--lina:#d6dde8;--txt:#16202e;--dauf:#5d6b80;--graent:#17a34a;--gult:#b7791f;--rautt:#d62f2f;--gra:#8793a5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.4 system-ui,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;background:var(--bg);padding:12px 16px 8px;border-bottom:1px solid var(--lina);z-index:2}
h1{font-size:18px;margin:0 0 6px}.sub{color:var(--dauf);font-size:12px}
.tolur{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.tolur button{border:1px solid var(--lina);background:var(--kort);color:var(--txt);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}
.tolur button.on{outline:2px solid var(--txt)}
.d{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:baseline}
main{padding:10px 16px 40px;max-width:980px;margin:0 auto}
.lota{background:var(--kort);border:1px solid var(--lina);border-left:5px solid var(--gra);border-radius:10px;padding:10px 12px;margin:8px 0}
.lota.graent{border-left-color:var(--graent)}.lota.gult{border-left-color:var(--gult)}.lota.rautt{border-left-color:var(--rautt)}
.top{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.ttl{font-weight:600;word-break:break-word}
.t{color:var(--dauf);font-size:12px;white-space:nowrap}.nuna{color:var(--graent);font-weight:700;font-size:12px}
.rad{font-size:13px;margin-top:4px;color:var(--dauf)}.rad b{color:var(--txt);font-weight:600}.ok{color:var(--graent)}.nei{color:var(--rautt)}
details{margin-top:18px;color:var(--dauf);font-size:13px}
</style></head><body>
<header><h1>Lotuyfirlit</h1><div class="sub" id="sub"></div><div class="tolur" id="sia"></div></header>
<main id="m"></main><main><details><summary>Hvað er mælt</summary>
<p><span class="d" style="background:var(--graent)"></span><b>Grænt</b>: lotan notaði eigið skill eða agent (úr þínum möppum) OG las grunngögn (Charlize, STADREYNDIR, minni, agent-/skill-skrár).<br>
<span class="d" style="background:var(--gult)"></span><b>Gult</b>: annað hvort. <span class="d" style="background:var(--rautt)"></span><b>Rautt</b>: hvorugt þótt lotan hafi unnið (6+ verkfærakall). <span class="d" style="background:var(--gra)"></span><b>Grátt</b>: örstutt lota.</p>
<p>Sést ekki: hvað undiragentar lásu í eigin afritum, skill sem hook kveikti sjálfkrafa, né hvort gögnin voru <i>rétt</i> notuð. „almenn agent-köll“ eru general-purpose/Explore (ekki þínir agentar). Aðeins titill og tölur eru sýnd. Síðan endurhleðst sjálf á 2 mín fresti; gögnin eru uppfærð á ~10 mín fresti af þessari vél.</p></details></main>
<script>
var G=${json};var sia='allt';
function tid(ms){var s=Math.round((Date.now()-ms)/1000);if(s<90)return'núna';if(s<3600)return Math.round(s/60)+' mín';if(s<86400)return Math.round(s/3600)+' klst';return Math.round(s/86400)+' d'}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function teikna(){
 var L=G.lotur,t={graent:0,gult:0,rautt:0,gra:0};L.forEach(function(l){t[l.lit]++});
 document.getElementById('sub').textContent=L.length+' lotur síðustu '+G.dagar+' daga · gögn frá '+new Date(G.bunad).toLocaleString('is-IS');
 var f=[['allt','Allt ('+L.length+')',''],['rautt','Rautt ('+t.rautt+')','var(--rautt)'],['gult','Gult ('+t.gult+')','var(--gult)'],['graent','Grænt ('+t.graent+')','var(--graent)'],['nuna','Í gangi núna','var(--graent)']];
 document.getElementById('sia').innerHTML=f.map(function(x){return '<button data-f="'+x[0]+'" class="'+(sia===x[0]?'on':'')+'">'+(x[2]?'<span class="d" style="background:'+x[2]+'"></span>':'')+x[1]+'</button>'}).join('');
 Array.prototype.forEach.call(document.querySelectorAll('#sia button'),function(b){b.onclick=function(){sia=b.dataset.f;teikna()}});
 var sl=L.filter(function(l){return sia==='allt'||(sia==='nuna'?l.nuna:l.lit===sia)});
 document.getElementById('m').innerHTML=sl.map(function(l){
  var eig=l.skill.map(function(x){return 'skill <b>'+esc(x[0])+'</b>×'+x[1]}).concat(l.agent.map(function(x){return 'agent <b>'+esc(x[0])+'</b>×'+x[1]}));
  var gr=l.grunn.map(function(x){return esc(x[0])+' ×'+x[1]});
  return '<div class="lota '+l.lit+'"><div class="top"><div class="ttl">'+esc(l.titill)+'</div><div class="t">'+(l.nuna?'<span class="nuna">● í gangi</span>':tid(l.sidast))+'</div></div>'
  +'<div class="rad">Eigin skill/agent: '+(eig.length?'<span class="ok">'+eig.join(' · ')+'</span>':'<span class="nei">ekkert</span>')+(l.almenn?' <span class="t">(+'+l.almenn+' almenn agent-köll)</span>':'')+'</div>'
  +'<div class="rad">Grunngögn: '+(gr.length?'<span class="ok">'+gr.join(' · ')+'</span>':'<span class="nei">engin lesin</span>')+'</div>'
  +'<div class="rad">'+l.verkfaeri+' verkfærakall'+(l.sql?' · '+l.sql+' SQL':'')+' · lota '+esc(l.id)+'</div></div>'}).join('')||'<p class="sub">Engar lotur í þessari síu.</p>';
}
teikna();
</script></body></html>`;
}
