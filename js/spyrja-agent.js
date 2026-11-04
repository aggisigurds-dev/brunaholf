// js/spyrja-agent.js — „Spyrja <agent>“-takki á hverri síðu hubbsins og Jarvis (Agentakerfið 2.0, fasi 6 G, 04.11.2026)
//
// Les data/sidukort.json, finnur síðuna sem er opin (hash-sýn eða slóð) og eigandann hennar, og sýnir lítinn takka neðst
// til vinstri: „Spyrja · <agent>“. Smellur opnar spyrja.html í rennihurð hægra megin (sama uppruni → starfsmanna-kakan
// fylgir); á þröngum skjá í nýjum flipa. Kennitala sem sést á síðunni (fyrsta „123456-7890“ í meginmáli) fylgir með svo
// agentinn fái kúnnaminnið. Hash-breyting uppfærir merkimiðann. Engin skrif héðan.
(function () {
  'use strict';
  if (window.__spyrjaAgent) return; window.__spyrjaAgent = true;
  var VEFUR = 'brunaholf', kort = null, btn = null, dr = null;
  var css = '.sa-btn{position:fixed;left:14px;bottom:14px;z-index:99990;font:11px/1 "JetBrains Mono",ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;padding:9px 12px;border:1px solid rgba(212,165,58,.55);background:rgba(10,14,20,.92);color:#f0c35c;border-radius:4px;cursor:pointer;box-shadow:0 2px 14px rgba(0,0,0,.45)}' +
    '.sa-btn:hover{border-color:#f0c35c;background:#141b26}.sa-btn b{font-weight:600;color:#fff}' +
    '.sa-dr{position:fixed;top:0;right:0;bottom:0;width:min(520px,100vw);z-index:99995;background:#07090c;border-left:1px solid rgba(212,165,58,.35);box-shadow:-8px 0 30px rgba(0,0,0,.5);display:flex;flex-direction:column}' +
    '.sa-dr iframe{flex:1;border:0;width:100%}.sa-x{position:absolute;top:6px;right:10px;z-index:1;font:16px/1 sans-serif;background:transparent;border:0;color:#8a97a8;cursor:pointer;padding:6px}.sa-x:hover{color:#fff}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function view() { return (location.hash || '').replace(/^#/, '').split(/[?/&]/)[0]; }
  function sida() {
    if (!kort) return null; var v = view(), p = location.pathname.replace(/\/index\.html$/, '/'), base = p.replace(/^\//, '').replace(/\.html$/, '');
    var s = (kort.sidur || []).filter(function (x) { return x.vefur === VEFUR && x.leid; });
    var f = function (fn) { for (var i = 0; i < s.length; i++) if (fn(s[i])) return s[i]; return null; };
    return (v && (f(function (x) { return x.leid === p + '#' + v; }) || f(function (x) { return x.leid === '/#' + v || x.id === v; }) || f(function (x) { return x.leid.slice(-(v.length + 1)) === '#' + v; }))) ||
      f(function (x) { return x.leid === p || x.leid === p.replace(/^\//, ''); }) ||
      (base && f(function (x) { return x.id === base || x.leid === '/#' + base; })) ||
      f(function (x) { return x.leid.indexOf(p + '#') === 0; }) || null;
  }
  function kt() {
    try { var m = /\b(\d{6})-(\d{4})\b/.exec((document.querySelector('main') || document.body).innerText.slice(0, 20000)); return m ? m[1] + '-' + m[2] : ''; } catch (_) { return ''; }
  }
  function merkja() {
    if (!btn) return; var s = sida(); var a = s ? (s.eigandi_nafn || s.eigandi || '') : '';
    a = String(a).replace(/^(sl|bh|kj|skill):/, '');
    btn.innerHTML = 'Spyrja · <b>' + (a || 'agent') + '</b>'; btn.title = s ? 'Síða: ' + s.titill + ' — eigandi ' + a : 'Síðan er ekki í síðukortinu; vefagentinn svarar';
  }
  function slod() {
    var s = sida(); var q = 'vefur=' + VEFUR + '&view=' + encodeURIComponent(view()) + '&path=' + encodeURIComponent(location.pathname);
    if (s) q += '&titill=' + encodeURIComponent(s.titill); var k = kt(); if (k) q += '&kt=' + k;
    return '/spyrja.html?' + q;
  }
  function opna() {
    if (window.innerWidth < 900) { window.open(slod(), '_blank', 'noopener'); return; }
    if (dr) { loka(); return; }
    dr = document.createElement('div'); dr.className = 'sa-dr';
    dr.innerHTML = '<button type="button" class="sa-x" aria-label="Loka">✕</button><iframe src="' + slod() + '" title="Spyrja agent"></iframe>';
    dr.querySelector('.sa-x').addEventListener('click', loka); document.body.appendChild(dr);
  }
  function loka() { if (dr) { dr.remove(); dr = null; } }
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && dr) loka(); });

  function init() {
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sa-btn'; btn.innerHTML = 'Spyrja · <b>agent</b>';
    btn.addEventListener('click', opna); document.body.appendChild(btn);
    fetch('/data/sidukort.json').then(function (r) { return r.json(); }).then(function (j) { kort = j; merkja(); }).catch(function () {});
    window.addEventListener('hashchange', merkja);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
