/* nlsh-stada.js — Mánaðarlokaskýrsla Landsspítalans (NLSH): EIN útfærsla, sýnd bæði á
 * /nlsh.html og í hub-flipanum #nlsh (index.html renderNLSH) — sama mynstur og
 * nlsh-sections.js. window.mountNlshStada() finnur #nl-stada og teiknar (idempotent);
 * window.__nlStadaReload() endurhleður. Sjálfstæð: eigin hjálparföll + CSS.
 *
 * Agnar 02.–03.09.2026: „bara total stöðuna í lok mánaðar … setja það inní töfluna
 * sem reiknar rest" → „put in new month and add the final month's end numbers or
 * change it" → „replicate the report into more digital form" → „Ég sé samt ekki
 * landsspitala útreikningasíðuna" (hann var á #nlsh í hub-inum, ekki á nlsh.html —
 * þess vegna eining sem báðir staðir monta). Bakendi: /api/nlsh-stada.
 */
(function(){
  if (window.mountNlshStada) return;
  const num = n => (Math.round(n||0)).toLocaleString('is-IS');
  const kr  = n => num(n) + ' kr';
  const MON = ['jan','feb','mar','apr','maí','jún','júl','ágú','sep','okt','nóv','des'];
  const mLabel = ym => { const [y,m]=String(ym||'').split('-'); return (MON[(+m)-1]||'')+'. '+y; };
  function fmtTs(s){ const t=new Date(s); if(isNaN(t)) return ''; return t.toLocaleString('is-IS',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  const CSS = ".nl-stada-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:8px;font-size:13px}\n.nl-skyrsla-h{padding:8px 4px 6px;font-size:13.5px}\n.nl-lok{width:84px;padding:5px 7px;border:1px solid var(--border,#d6dae0);border-radius:7px;font:inherit;font-size:13px;text-align:right;background:var(--card-bg,#fff)}\n.nl-skyrsla .c-stada{background:rgba(10,132,255,.06)} .nl-skyrsla th.c-stada{background:rgba(10,132,255,.12)}\n.nl-skyrsla .c-man{color:var(--text-dim,#5b6673);font-size:12px} .nl-skyrsla .c-lok{color:var(--text,#14181f);font-weight:600}\ntr.nl-diff td{background:rgba(200,48,47,.07)} tr.nl-diff .nl-lok{border-color:#c8302f;font-weight:700}\n.nl-stada-bar select{padding:6px 8px;border:1px solid var(--border,#d6dae0);border-radius:7px;font:inherit;font-size:13px;margin-left:4px}";
  function css(){ if(document.getElementById('nl-stada-css')) return; const st=document.createElement('style'); st.id='nl-stada-css'; st.textContent=CSS; document.head.appendChild(st); }

  // ── Staða í lok mánaðar — STAFRÆN ÚTGÁFA SKÝRSLUNNAR til Landsspítalans ─────
  // Agnar 02.09.2026: „bara total stöðuna í lok mánaðar … setja það inní töfluna
  // sem reiknar rest." · 03.09.2026: „put in new month and add the final month's
  // end numbers or change it" · „replicate the report into more digital form."
  // Ajour-talan er tillaga; LOKATALAN (reiturinn) er sú sem fer í skýrsluna og
  // vistast per mánuð+verklið (nlsh_manadarlok). Reiknað eins og blaðið: heilar,
  // upphæð heild, mánaðarmunur, upphæð í mánuði — dálkur per mánuð frá sept 2025.
  // Veljarinn og takkarnir teiknast EINU SINNI; aðeins taflan endurnýjast.
  let stadaGogn=null;
  function stadaManudir(){
    const out=[], now=new Date();
    for(let d=new Date(2025,8,1); d<=now; d.setMonth(d.getMonth()+1)) out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    return out;
  }
  function stadaSjalfgefid(){ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  function msgSet(t){ const m=document.getElementById('nl-stada-msg'); if(m) m.textContent=t; }
  const MSTUTT=['jan','feb','mar','apr','maí','jún','júl','ágú','sep','okt','nóv','des'];
  const mStutt=ym=>{ const [y,m]=ym.split('-'); return MSTUTT[+m-1]+' '+y.slice(2); };
  const nf1=n=>Number.isInteger(n)?num(n):(+n).toLocaleString('is-IS',{minimumFractionDigits:1,maximumFractionDigits:2});
  function stadaGrind(){
    const box=document.getElementById('nl-stada'); if(!box||box.dataset.grind) return;
    box.dataset.grind='1';
    const man=stadaManudir(), val=stadaSjalfgefid();
    box.innerHTML=`<div class="nl-stada-bar">
        <label>Lok mánaðar<select id="nl-stada-man">${man.map(m=>`<option value="${m}"${m===val?' selected':''}>${mLabel(m)}</option>`).join('')}</select></label>
        <button id="nl-stada-vista" class="tv-btn" type="button" title="Vistar lokatölurnar fyrir valinn mánuð — sömu tölur á öllum vélum">💾 Vista lokatölur</button>
        <button id="nl-stada-ajour" class="tv-btn" type="button" title="Setja Ajour-tölurnar í reitina (vistast ekki fyrr en þú ýtir á Vista)">↺ Ajour-tölur</button>
        <button id="nl-stada-afrita" class="tv-btn" type="button" title="Stöðu-dálkurinn í verkliðaröð — límist í blaðið ef þú vilt">📋 Afrita tölur</button>
        <button id="nl-stada-afrita2" class="tv-btn" type="button" title="Verkliður + tala, tab-aðskilið">📋 Afrita með númerum</button>
        <span id="nl-stada-msg" class="nl-note"></span>
      </div><div id="nl-stada-t" class="nl-tw"></div>`;
    box.querySelector('#nl-stada-man').addEventListener('change', loadStada);
    box.querySelector('#nl-stada-vista').onclick=stadaVista;
    box.querySelector('#nl-stada-ajour').onclick=()=>{ document.querySelectorAll('#nl-stada-t input.nl-lok').forEach(i=>{ i.value=i.dataset.ajour; }); stadaSamtala(); msgSet('Ajour-tölur settar í reitina — ýttu á Vista til að geyma'); };
    box.querySelector('#nl-stada-afrita').onclick=()=>stadaAfrita(false);
    box.querySelector('#nl-stada-afrita2').onclick=()=>stadaAfrita(true);
  }
  function lokGildi(i){ const v=String(i.value).trim().replace(/\./g,'').replace(',','.'); if(v==='') return null; const n=+v; return Number.isFinite(n)&&n>=0?n:null; }
  function stadaLinur(){ return [...document.querySelectorAll('#nl-stada-t input.nl-lok')].map(i=>({ verk_nr:i.dataset.verk, lokatala:lokGildi(i) })); }
  // Lifandi endurreikningur línu: staða → heilar → upphæð → Δ → upphæð í mánuði.
  function stadaSamtala(){
    const T={stada:0,heilar:0,upphaed:0,delta:0,upphaed_man:0};
    document.querySelectorAll('#nl-stada-t tr[data-verk]').forEach(tr=>{
      const i=tr.querySelector('input.nl-lok'); const lok=lokGildi(i); const ajour=+i.dataset.ajour; const st=lok==null?ajour:lok;
      const full=tr.dataset.full==='1', metrar=tr.dataset.metrar==='1', rate=+tr.dataset.rate, prevSt=+tr.dataset.prevstada, prevH=+tr.dataset.prevheilar;
      const heilar=full?st:st/2, upphaed=Math.round(heilar*rate), delta=st-prevSt, dH=heilar-prevH, um=Math.round(dH*rate);
      tr.querySelector('.c-heilar').textContent=nf1(heilar); tr.querySelector('.c-upphaed').textContent=kr(upphaed);
      tr.querySelector('.c-delta').textContent=(delta>=0?'+':'')+nf1(delta); tr.querySelector('.c-um').textContent=kr(um);
      tr.classList.toggle('nl-diff', lok!=null && lok!==ajour);
      T.stada+=st; T.heilar+=heilar; T.upphaed+=upphaed; T.delta+=delta; T.upphaed_man+=um;
    });
    const f=id=>document.getElementById(id); if(f('nl-t-stada')){ f('nl-t-stada').textContent=nf1(T.stada); f('nl-t-heilar').textContent=nf1(T.heilar); f('nl-t-upphaed').textContent=kr(T.upphaed); f('nl-t-delta').textContent=(T.delta>=0?'+':'')+nf1(T.delta); f('nl-t-um').textContent=kr(T.upphaed_man); }
  }
  async function stadaVista(){
    if(!stadaGogn) return;
    const btn=document.getElementById('nl-stada-vista'); btn.disabled=true; btn.textContent='Vista…';
    try{
      const r=await fetch('/api/nlsh-stada',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({month:stadaGogn.month, lines:stadaLinur()})});
      const d=await r.json(); if(!r.ok||d.error) throw new Error(d.error||('HTTP '+r.status));
      stadaTeikna(d); msgSet('Vistað ✓ '+mLabel(d.month)+(d.vistad_at?' · '+fmtTs(d.vistad_at):' (allir reitir auðir → Ajour gildir)'));
    }catch(e){ msgSet('Vistaðist EKKI: '+e.message); }
    btn.disabled=false; btn.textContent='💾 Vista lokatölur';
  }
  async function stadaAfrita(medNr){
    if(!stadaGogn){ msgSet('Engin gögn enn'); return; }
    const L=[...document.querySelectorAll('#nl-stada-t tr[data-verk]')].map(tr=>{ const i=tr.querySelector('input.nl-lok'); const lok=lokGildi(i); return { verk_nr:tr.dataset.verk, v: lok==null?+i.dataset.ajour:lok }; });
    const txt=L.map(l=>medNr?(l.verk_nr+'\t'+l.v):String(l.v)).join('\n');
    const ok=await klippibord(txt);
    msgSet(ok ? 'Afritað ✓ '+L.length+' línur · '+mLabel(stadaGogn.month)+' (staða; auðir reitir = Ajour)' : 'Klippiborð lokað — veldu tölurnar í töflunni og afritaðu handvirkt');
  }
  // Fyrst nýja API-ið (þarf HTTPS + fókus + leyfi), annars gamla execCommand-leiðin.
  async function klippibord(txt){
    try{ await navigator.clipboard.writeText(txt); return true; }catch(_){}
    try{
      const ta=document.createElement('textarea'); ta.value=txt; ta.setAttribute('readonly','');
      ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0,txt.length);
      const ok=document.execCommand('copy'); ta.remove(); return !!ok;
    }catch(_){ return false; }
  }
  function stadaTeikna(d){
    stadaGogn=d;
    const t=document.getElementById('nl-stada-t'); if(!t) return;
    const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const S=d.skyrsla, man=S.manudir, valinn=man[man.length-1], fyrri=man.length>1?man[man.length-2]:null;
    const verkMap=Object.fromEntries(S.verk.map(v=>[v.verk_nr,v]));
    const hdrMan=man.slice(0,-1).map(m=>`<th title="Lokað í ${esc(mLabel(m.month))}${m.vistad?' · lokatölur vistaðar':' · Ajour'}">${esc(mStutt(m.month))}${m.vistad?' ●':''}</th>`).join('');
    const rows=valinn.lines.map((l,i)=>{ const v=verkMap[l.verk_nr]; const prev=fyrri?fyrri.lines[i]:{stada:0,heilar:0};
      const manCells=man.slice(0,-1).map(m=>{ const x=m.lines[i]; return `<td class="c-man${x.lokatala!=null?' c-lok':''}" title="staða ${nf1(x.stada)}${x.lokatala!=null?' (lokatala)':' (Ajour)'}">${x.delta?((x.delta>0?'+':'')+nf1(x.delta)):'<span style=color:#c8ccd2>·</span>'}</td>`; }).join('');
      return `<tr data-verk="${esc(l.verk_nr)}" data-rate="${v.rate}" data-full="${v.full?1:0}" data-metrar="${v.metrar?1:0}" data-prevstada="${prev.stada}" data-prevheilar="${prev.heilar}">
        <td>${esc(l.verk_nr)}</td><td style="text-align:left">${esc(v.label)}${v.metrar?' <span class="nl-note">(m)</span>':''}${v.full?' <span class="nl-note">1=1</span>':''}</td>
        <td>${v.fjoldi==null?'—':num(v.fjoldi)}</td><td>${kr(v.rate)}</td>${manCells}
        <td class="c-stada"><input class="nl-lok" inputmode="decimal" data-verk="${esc(l.verk_nr)}" data-ajour="${l.ajour_cum}" value="${l.lokatala==null?'':l.lokatala}" placeholder="${nf1(l.ajour_cum)}" title="Ajour: ${nf1(l.ajour_cum)} — auður reitur = Ajour gildir"></td>
        <td class="c-delta"></td><td class="c-heilar"></td><td class="c-upphaed"></td><td class="c-um"></td></tr>`; }).join('');
    t.innerHTML=`<div class="nl-skyrsla-h"><b>Landsspítalinn 5.–6. hæð — staða í lok ${esc(mLabel(d.month))}</b> <span class="nl-note">· ${d.vistad_at?'lokatölur vistaðar '+esc(fmtTs(d.vistad_at)):'engar lokatölur vistaðar fyrir þennan mánuð — Ajour-tölur sýndar'}</span></div>
      <table class="nl-t nl-skyrsla" id="nl-stada-tafla">
      <thead><tr><th>Verk</th><th>Verkliður</th><th>Fjöldi</th><th>Verð/heild</th>${hdrMan}<th class="c-stada">Staða ${esc(mStutt(d.month))}</th><th>Δ ${esc(mStutt(d.month))}</th><th>Heilar</th><th>Upphæð heild</th><th>Upphæð í ${esc(mStutt(d.month))}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Samtals</td>${man.slice(0,-1).map(m=>`<td>${m.totals.delta?((m.totals.delta>0?'+':'')+nf1(m.totals.delta)):'·'}</td>`).join('')}<td id="nl-t-stada"></td><td id="nl-t-delta"></td><td id="nl-t-heilar"></td><td id="nl-t-upphaed"></td><td id="nl-t-um"></td></tr></tfoot></table>
      <div class="nl-note" style="padding:6px 2px">${esc(S.reglur)} Mánaðardálkar sýna lokanir í hverjum mánuði (● = lokatölur vistaðar). Reiturinn „Staða" er lokatalan sem þú sendir — auður = Ajour gildir; rauð lína = víkur frá Ajour. ${d.unmapped.length?'Utan samnings: '+d.unmapped.map(u=>esc(u.category_group)+' '+num(u.stakar_alls)).join(' · ')+'. ':''}Ekki merkt Done í Ajour núna: <b>${num(d.ekki_done)}</b>.</div>`;
    t.querySelectorAll('input.nl-lok').forEach(i=>i.addEventListener('input', stadaSamtala));
    stadaSamtala();
    const sel=document.getElementById('nl-stada-man');
    if(sel && document.activeElement!==sel){ const set=new Set((d.vistadir_manudir||[]).map(x=>x.month)); [...sel.options].forEach(o=>{ o.textContent=mLabel(o.value)+(set.has(o.value)?' ●':''); }); }
  }
  async function loadStada(){
    stadaGrind();
    const sel=document.getElementById('nl-stada-man'), t=document.getElementById('nl-stada-t'); if(!sel||!t) return;
    t.innerHTML='<div style="padding:10px;color:#94a3b8;font-size:12px">Sækir…</div>';
    try{ const r=await fetch('/api/nlsh-stada?til='+encodeURIComponent(sel.value)); const d=await r.json(); if(!r.ok||d.error) throw new Error(d.error||('HTTP '+r.status)); stadaTeikna(d); msgSet(''); }
    catch(e){ t.innerHTML='<div style="padding:10px;color:#b91c1c;font-size:12px">Villa: '+String(e.message).replace(/[<>]/g,'')+'</div>'; stadaGogn=null; }
  }

  window.mountNlshStada = function(){ css(); loadStada(); };
  window.__nlStadaReload = loadStada;
})();
