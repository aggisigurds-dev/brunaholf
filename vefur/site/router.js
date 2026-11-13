/* Leiðir síðunnar. Forsíða, Brunaþéttingar og verslun eru þrjár sýnir í sömu síðu:
     #verslun, #vara-12 og #karfa   verslunin (forsíða hennar, vörusíða, karfa)
     #brunathettingar               Brunaþéttingar
     kaflar sem eru á öllum sýnum (Hafa samband) skipta ekki um sýn; allt annað er forsíðan.
   Stillingar hverrar útgáfu eru í window.BH_SITE (valmynd, stika, kaflar, vörukort á forsíðu). */
(function () {
  'use strict';
  var d = document, C = window.BH_SITE;
  function all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  var syn = { heim: d.getElementById('heim'), bruna: d.getElementById('brunasyn'), verslun: d.getElementById('verslunarsyn') };
  var bar = d.querySelector(C.bar), spyLinks = all(C.nav);
  var SHOP = /^(verslun|karfa|vara-\d+)$/;
  var nuna = 'heim';
  function iVerslun() { return SHOP.test(location.hash.slice(1)); }
  function synFyrir(h) {
    if (SHOP.test(h)) return 'verslun';
    if (h === 'brunathettingar') return 'bruna';
    if (C.sameiginlegt.indexOf(h) >= 0) return nuna;
    return 'heim';
  }
  function sest(el) { return !!el && el.getClientRects().length > 0; }

  /* Virkur hlekkur í valmynd */
  function virkur() {
    var key = 'top', VV = window.VV;
    if (nuna === 'verslun') key = VV && VV.sia.flokkur === 'slokkvitaeki' && location.hash === '#verslun' ? 'slokkvitaeki' : 'verslun';
    else if (nuna === 'bruna') key = 'brunathettingar';
    var line = bar.offsetHeight + window.innerHeight * 0.3;
    C.kaflar.forEach(function (k) {
      var el = d.getElementById(k[0]);
      if (sest(el) && el.getBoundingClientRect().top <= line) key = k[1];
    });
    /* neðst á síðunni nær síðasti kaflinn ekki upp að línunni: þá er lesandinn samt kominn í hann */
    if (C.nedst && window.innerHeight + window.pageYOffset >= d.documentElement.scrollHeight - 4) key = C.nedst;
    spyLinks.forEach(function (a) {
      if (a.getAttribute('data-spy') === key) a.setAttribute('aria-current', C.current);
      else a.removeAttribute('aria-current');
    });
  }

  /* Þegar skipt er um sýn eða síðu í versluninni hoppar síðan efst, hún rennur ekki (rennslið er fyrir kafla innan sýnar).
     Hlustarinn hér er skráður á undan hlustara verslunarinnar, svo stillingin gildir líka þegar hún teiknar síðuna. */
  function hopp(fn) {
    var root = d.documentElement;
    root.style.scrollBehavior = 'auto';
    try { fn(); } finally { setTimeout(function () { root.style.scrollBehavior = ''; }, 0); }
  }
  function syna(fyrsta) {
    var h = location.hash.slice(1), adur = nuna;
    nuna = synFyrir(h);
    syn.heim.hidden = nuna !== 'heim';
    syn.bruna.hidden = nuna !== 'bruna';
    syn.verslun.hidden = nuna !== 'verslun';
    if (nuna !== 'verslun' && (nuna !== adur || fyrsta)) {
      /* kaflinn var falinn þegar smellt var, svo vafrinn gat ekki skrunað að honum sjálfur */
      var t = h && h !== 'top' && h !== 'brunathettingar' ? d.getElementById(h) : null;
      if (sest(t)) t.scrollIntoView();
      else if (nuna !== adur) window.scrollTo(0, 0);
    }
    virkur();
    if (C.vidSyn) C.vidSyn(nuna);
  }
  window.addEventListener('hashchange', function () {
    if (synFyrir(location.hash.slice(1)) !== nuna || nuna === 'verslun') hopp(function () { syna(false); });
    else syna(false);
  });
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; virkur(); });
  }, { passive: true });
  window.addEventListener('resize', virkur);

  /* Karfan í stikunni */
  function fjoldi() {
    var VV = window.VV, n = 0;
    if (!VV) return 0;
    Object.keys(VV.karfa || {}).forEach(function (id) {
      var k = VV.karfa[id];
      if (k > 0 && VV.vorur.some(function (v) { return v.id === Number(id); })) n += k;
    });
    return n;
  }
  /* Vörukynning á forsíðunni: fyrstu vörurnar í sömu röð og verslunin sýnir þær.
     Heiti og mynd eru lesin eins og verslunin les þau: stilling í efni.t og efni.m (verslun/gogn.js) gengur fyrir vöruskránni. */
  function synd(v, VV) {
    var t = (VV.efni.t || {})['vara.' + v.id + '.nafn'], s = {};
    Object.keys(v).forEach(function (k) { s[k] = v[k]; });
    if (t && typeof t.x === 'string') s.nafn = t.x;
    s.mynd = VV.myndSrc('vara.' + v.id + '.mynd', v.mynd);
    return s;
  }
  var kynnt = false;
  function kynning() {
    var VV = window.VV, ul = d.getElementById('kynning');
    if (kynnt || !ul || !VV || !VV.vorur.length) return;
    kynnt = true;
    var vorur = VV.synilegar();
    ul.innerHTML = vorur.slice(0, C.kynningFjoldi).map(function (v) { return C.kynningarKort(synd(v, VV), VV); }).join('');
    var n = d.getElementById('allar-n');
    if (n) n.textContent = ' (' + vorur.length + ')';
  }
  function uppfaera() {
    var n = fjoldi(), merki = d.getElementById('w-cart-n');
    merki.textContent = n;
    merki.hidden = !n;
    d.querySelector('.w-cart').setAttribute('aria-label', n ? 'Karfa, ' + n + (n % 10 === 1 && n % 100 !== 11 ? ' vara' : ' vörur') : 'Karfa');
    kynning();
    virkur();
  }
  /* „Í körfu" á vörukorti teiknar ekki síðuna upp á nýtt, svo talan er lesin aftur eftir hvern smell í versluninni */
  d.addEventListener('click', function (e) { if (e.target.closest('#vv-app [data-act]')) setTimeout(uppfaera, 0); });
  window.addEventListener('storage', function () { setTimeout(uppfaera, 0); });

  /* Hlekkir sem opna verslunina í tilteknum flokki (Slökkvitæki) eða með öllu (Verslun) */
  all('a[data-filter]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var VV = window.VV;
      if (!VV) return;
      e.preventDefault();
      VV.sia.flokkur = a.getAttribute('data-filter');
      VV.sia.leit = '';
      if (location.hash === '#verslun') hopp(function () { VV.render(true); virkur(); });
      else location.hash = '#verslun';
    });
  });

  window.BHV2 = {
    iVerslun: iVerslun,
    tengja: function () { if (window.VV) window.VV.eftirTeikningu = uppfaera; uppfaera(); }
  };
  syna(true);
})();

/* Myndskeiðið í forsíðuhausnum (stökin með data-hetja-video og data-hetja-takki í síðunni). Kyrrmyndin undir því sést þar til
   það spilar. Það er sótt eftir að síðan er hlaðin, fer ekki sjálft í gang þar sem hreyfing er afþökkuð í tækinu
   (prefers-reduced-motion), gagnasparnaður er á eða tengingin er hæg, stöðvast á meðan hausinn sést ekki og takkinn stöðvar
   það og ræsir. */
(function () {
  'use strict';
  var v = document.querySelector('[data-hetja-video]'), takki = document.querySelector('[data-hetja-takki]');
  if (!v || typeof v.play !== 'function') return;
  var kyrrt = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var teng = navigator.connection || {};
  var spara = !!(teng.saveData || /(^|-)2g$|^3g$/.test(teng.effectiveType || ''));     /* gagnasparnaður eða hæg tenging */
  var stoppad = kyrrt || spara;                 /* sá sem skoðar, eða stilling tækisins, vill ekki hreyfingu */
  var sest = false, hladid = document.readyState === 'complete';
  function merkja() {
    if (!takki) return;
    takki.setAttribute('data-stada', v.paused ? 'stopp' : 'spilar');
    takki.setAttribute('aria-label', v.paused ? 'Spila myndskeið' : 'Stöðva myndskeið');
  }
  function stilla() {
    if (hladid && sest && !stoppad) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});     /* vafrinn leyfir ekki sjálfspilun: kyrrmyndin stendur */
    } else if (!v.paused) v.pause();
  }
  v.addEventListener('play', merkja);
  v.addEventListener('pause', merkja);
  var kildur = v.querySelectorAll('source');
  if (kildur.length) kildur[kildur.length - 1].addEventListener('error', function () { if (takki) takki.hidden = true; });
  if (takki) {
    takki.hidden = false;
    takki.addEventListener('click', function () { stoppad = !v.paused; hladid = true; stilla(); });
  }
  if (!hladid) window.addEventListener('load', function () { hladid = true; stilla(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (f) { sest = f[f.length - 1].isIntersecting; stilla(); }).observe(v);
  } else { sest = true; stilla(); }
  merkja();
})();
