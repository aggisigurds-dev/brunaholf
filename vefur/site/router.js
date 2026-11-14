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
  /* Bein slóð á kafla (t.d. #hafa-samband): síðan lengist eftir fyrstu skrunun þegar vörukynningin, myndir og letur hlaðast,
     svo kaflinn færist undan. Skrunað er aftur að honum þar til sá sem skoðar hreyfir síðuna sjálfur. */
  var beint = null;
  function afturAdKafla() {
    var t = beint && nuna !== 'verslun' ? d.getElementById(beint) : null;
    if (sest(t)) hopp(function () { t.scrollIntoView(); });
  }
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (n) {
    window.addEventListener(n, function () { beint = null; }, { passive: true });
  });
  window.addEventListener('load', afturAdKafla);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(afturAdKafla);
  function syna(fyrsta) {
    var h = location.hash.slice(1), adur = nuna;
    nuna = synFyrir(h);
    syn.heim.hidden = nuna !== 'heim';
    syn.bruna.hidden = nuna !== 'bruna';
    syn.verslun.hidden = nuna !== 'verslun';
    if (nuna !== 'verslun' && (nuna !== adur || fyrsta)) {
      /* kaflinn var falinn þegar smellt var, svo vafrinn gat ekki skrunað að honum sjálfur */
      var t = h && h !== 'top' && h !== 'brunathettingar' ? d.getElementById(h) : null;
      if (sest(t)) { t.scrollIntoView(); beint = fyrsta ? h : null; }
      else if (nuna !== adur) window.scrollTo(0, 0);
    }
    virkur();
    if (C.vidSyn) C.vidSyn(nuna);
  }
  window.addEventListener('hashchange', function () {
    beint = null;
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
    afturAdKafla();
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

/* Bannerar í forsíðuhausnum (stakið með data-hetja í síðunni). Safnið hér fyrir neðan telur upp það sem hausinn getur sýnt.
   - Banner síðunnar er gildið í data-hetja á hausnum. ?hetja=<id> í slóðinni sýnir annan, til skoðunar og til að deila.
   - ?bannerar í slóðinni opnar bannerasafnið neðst á síðunni, þar sem skipt er á milli þeirra. Það er forskoðun: valið fylgir
     slóðinni og breytir engu fyrir aðra gesti.
   - gerd: 'video' er myndskeiðið, 'kyrr' er kyrrmynd með sömu slikju og myndskeiðið, 'mynd' er önnur mynd. Hausinn fær
     data-hetja-gerd, og stílblað hverrar útgáfu þéttir slikjuna undir textanum fyrir 'mynd' þar sem þess þarf.
     pos er object-position myndarinnar. ljos merkir ljósa mynd (data-hetja-ljos), sem fær enn þéttari slikju.
   Myndskeiðið (stökin með data-hetja-video og data-hetja-takki): kyrrmyndin undir því sést þar til það spilar. Það er sótt eftir
   að síðan er hlaðin, fer ekki sjálft í gang þar sem hreyfing er afþökkuð í tækinu (prefers-reduced-motion), gagnasparnaður er á
   eða tengingin er hæg, stöðvast á meðan hausinn sést ekki og takkinn stöðvar það og ræsir. */
(function () {
  'use strict';
  var d = document;
  var BANNERAR = [
    { id: 'eldur', heiti: 'Eldur, myndskeið', gerd: 'video', mynd: 'img/hetja-eldur.webp' },
    { id: 'eldur-kyrr', heiti: 'Eldur, kyrrmynd', gerd: 'kyrr', mynd: 'img/hetja-eldur.webp' },
    { id: 'hus', heiti: 'Húsið', gerd: 'mynd', mynd: 'img/hetja-v3.webp', pos: 'right top' },
    { id: 'hus-vatn', heiti: 'Hús við vatn', gerd: 'mynd', mynd: 'img/verslun-hetja.webp', pos: 'right center' },
    { id: 'hus-breid', heiti: 'Hús, breið mynd', gerd: 'mynd', mynd: 'img/banner/hus-breid.webp', pos: 'right center' },
    { id: 'solarlag', heiti: 'Sólarlag', gerd: 'mynd', mynd: 'img/banner/solarlag.webp', pos: 'right bottom' },
    { id: 'logi', heiti: 'Logi', gerd: 'mynd', mynd: 'img/banner/logi.webp', pos: 'right 30%', ljos: true }
  ];
  var hero = d.querySelector('[data-hetja]');
  if (!hero) return;
  var mynd = hero.querySelector('[data-hetja-mynd]'), v = hero.querySelector('[data-hetja-video]'), takki = hero.querySelector('[data-hetja-takki]');
  var videoOk = !!v && typeof v.play === 'function', bilad = false;
  function finna(id) {
    for (var i = 0; i < BANNERAR.length; i++) if (BANNERAR[i].id === id) return BANNERAR[i];
    return null;
  }
  var q = { get: function () { return null; }, has: function () { return false; } };
  try { q = new URLSearchParams(location.search); } catch (e) {}
  var sjalfgefinn = finna(hero.getAttribute('data-hetja')) || BANNERAR[0];
  var nuna = finna(q.get('hetja')) || sjalfgefinn;

  var kyrrt = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var teng = navigator.connection || {};
  var spara = !!(teng.saveData || /(^|-)2g$|^3g$/.test(teng.effectiveType || ''));     /* gagnasparnaður eða hæg tenging */
  var stoppad = kyrrt || spara;                 /* sá sem skoðar, eða stilling tækisins, vill ekki hreyfingu */
  var sest = false, hladid = d.readyState === 'complete';
  function merkja() {
    if (!takki || !videoOk) return;
    takki.setAttribute('data-stada', v.paused ? 'stopp' : 'spilar');
    takki.setAttribute('aria-label', v.paused ? 'Spila myndskeið' : 'Stöðva myndskeið');
  }
  function stilla() {
    if (!videoOk) return;
    if (nuna.gerd === 'video' && hladid && sest && !stoppad) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});     /* vafrinn leyfir ekki sjálfspilun: kyrrmyndin stendur */
    } else if (!v.paused) v.pause();
  }
  function setja(b) {
    var video = b.gerd === 'video' && videoOk;
    nuna = b;
    hero.setAttribute('data-hetja', b.id);
    hero.setAttribute('data-hetja-gerd', b.gerd);
    if (b.ljos) hero.setAttribute('data-hetja-ljos', ''); else hero.removeAttribute('data-hetja-ljos');
    if (b.pos) hero.style.setProperty('--hetja-pos', b.pos); else hero.style.removeProperty('--hetja-pos');
    if (mynd && mynd.getAttribute('src') !== b.mynd) {
      mynd.removeAttribute('width');
      mynd.removeAttribute('height');
      mynd.setAttribute('src', b.mynd);
    }
    if (v) v.hidden = !video;
    if (takki) takki.hidden = !video || bilad;
    stilla();
  }
  if (videoOk) {
    v.addEventListener('play', merkja);
    v.addEventListener('pause', merkja);
    var kildur = v.querySelectorAll('source');
    if (kildur.length) kildur[kildur.length - 1].addEventListener('error', function () { bilad = true; if (takki) takki.hidden = true; });
    if (takki) takki.addEventListener('click', function () { stoppad = !v.paused; hladid = true; stilla(); });
    if (!hladid) window.addEventListener('load', function () { hladid = true; stilla(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (f) { sest = f[f.length - 1].isIntersecting; stilla(); }).observe(hero);
    } else sest = true;
  }
  setja(nuna);
  merkja();

  /* ---- Bannerasafnið: opnast með ?bannerar í slóðinni ---- */
  if (!q.has('bannerar')) return;
  var utgafur = window.BH_UTGAFUR || [];        /* [heiti, skrá] hverrar útgáfu á vefnum; tómt þar sem síðan stendur ein */
  var skra = location.pathname.split('/').pop() || 'index.html';
  var st = d.createElement('style');
  st.textContent =
    '.bsafn{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;box-sizing:border-box;padding:10px max(12px,env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));background:#0b1220;color:#fff;font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 -8px 30px rgba(0,0,0,.4)}' +
    '.bsafn *{box-sizing:border-box}' +
    '.bsafn__haus{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
    '.bsafn__haus strong{margin-right:auto;font-size:15px;font-weight:600}' +
    '.bsafn__utg{display:flex;gap:6px}' +
    '.bsafn__utg a,.bsafn__loka{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;padding:0 10px;border:1px solid #46557a;border-radius:8px;background:none;color:#fff;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}' +
    '.bsafn__utg a[aria-current]{background:#fff;border-color:#fff;color:#0b1220}' +
    '.bsafn__loka{font-size:22px;line-height:1}' +
    '.bsafn__rod{display:flex;gap:8px;overflow-x:auto;padding:3px 3px 8px}' +
    '.bsafn__b{flex:0 0 auto;width:136px;padding:0;overflow:hidden;border:2px solid #2a3653;border-radius:10px;background:#172033;color:#fff;font:inherit;text-align:left;cursor:pointer}' +
    '.bsafn__b img{display:block;width:100%;height:60px;max-width:none;object-fit:cover;background:#000}' +
    '.bsafn__b span{display:block;padding:6px 8px 7px;font-size:13px}' +
    '.bsafn__b[aria-pressed="true"]{border-color:#ff8a1f;background:#22304d}' +
    '.bsafn :is(a,button,input):focus-visible{outline:3px solid #ffb066;outline-offset:2px}' +
    '.bsafn__fot{display:flex;gap:8px;margin-top:4px}' +
    '.bsafn__slod{flex:1 1 auto;min-width:0;height:44px;padding:0 10px;border:1px solid #46557a;border-radius:8px;background:#0f1930;color:#dbe4f3;font:13px ui-monospace,Menlo,Consolas,monospace}' +
    '.bsafn__afrita{flex:0 0 auto;height:44px;padding:0 14px;border:0;border-radius:8px;background:#ff8a1f;color:#111;font:inherit;font-weight:600;cursor:pointer}' +
    '.bsafn__ath{margin:8px 0 0;font-size:12.5px;color:#b8c4da}';
  d.head.appendChild(st);
  var safn = d.createElement('aside');
  safn.className = 'bsafn';
  safn.setAttribute('aria-label', 'Bannerasafn');
  safn.innerHTML =
    '<div class="bsafn__haus"><strong>Banner á forsíðu</strong>' +
    (utgafur.length ? '<span class="bsafn__utg" role="group" aria-label="Útgáfa"></span>' : '') +
    '<button type="button" class="bsafn__loka" aria-label="Loka bannerasafni"><span aria-hidden="true">×</span></button></div>' +
    '<div class="bsafn__rod" role="group" aria-label="Bannerar">' + BANNERAR.map(function (b) {
      return '<button type="button" class="bsafn__b" data-b="' + b.id + '"><img src="' + b.mynd + '" alt="" loading="lazy"><span>' + b.heiti + '</span></button>';
    }).join('') + '</div>' +
    '<div class="bsafn__fot"><input class="bsafn__slod" type="text" readonly aria-label="Hlekkur á síðuna með þessum banner">' +
    '<button type="button" class="bsafn__afrita" aria-live="polite">Afrita hlekk</button></div>' +
    '<p class="bsafn__ath">Forskoðun: aðrir sjá bannerinn aðeins með hlekknum.</p>';
  d.body.appendChild(safn);
  var inp = safn.querySelector('.bsafn__slod'), utg = safn.querySelector('.bsafn__utg'), afritun = safn.querySelector('.bsafn__afrita');
  var fyrraBil = d.body.style.paddingBottom;
  function rymi() { d.body.style.paddingBottom = safn.offsetHeight + 'px'; }     /* svo safnið hylji ekki neðsta hluta síðunnar */
  function vidbot(safnOpid) {       /* það sem bætist aftan við slóð síðunnar */
    var p = [];
    if (safnOpid) p.push('bannerar');
    if (nuna.id !== sjalfgefinn.id) p.push('hetja=' + nuna.id);
    return p.length ? '?' + p.join('&') : '';
  }
  function teikna() {
    [].forEach.call(safn.querySelectorAll('.bsafn__b'), function (k) {
      k.setAttribute('aria-pressed', String(k.getAttribute('data-b') === nuna.id));
    });
    inp.value = location.href.split(/[?#]/)[0] + vidbot(false);
    if (utg) utg.innerHTML = utgafur.map(function (u) {
      return '<a href="' + u[1] + '?bannerar&amp;hetja=' + nuna.id + '"' + (u[1] === skra ? ' aria-current="page"' : '') + '>' + u[0] + '</a>';
    }).join('');
    try { history.replaceState(null, '', location.pathname + vidbot(true) + location.hash); } catch (e) {}
  }
  function afrita() {
    function buid() {
      afritun.textContent = 'Afritað';
      setTimeout(function () { afritun.textContent = 'Afrita hlekk'; }, 1800);
    }
    function handvirkt() {
      inp.focus();
      inp.select();
      try { if (d.execCommand('copy')) buid(); } catch (e) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(buid, handvirkt);
    else handvirkt();
  }
  function loka() {
    window.removeEventListener('resize', rymi);
    safn.remove();
    st.remove();
    d.body.style.paddingBottom = fyrraBil;
    try { history.replaceState(null, '', location.pathname + vidbot(false) + location.hash); } catch (e) {}
  }
  safn.addEventListener('click', function (e) {
    var k = e.target.closest('.bsafn__b');
    if (k) {
      setja(finna(k.getAttribute('data-b')) || sjalfgefinn);
      teikna();
      if (!hero.getClientRects().length) location.hash = '#top';     /* verslunin eða Brunaþéttingar eru opnar: sýna forsíðuna */
      window.scrollTo(0, 0);
    } else if (e.target.closest('.bsafn__afrita')) afrita();
    else if (e.target.closest('.bsafn__loka')) loka();
  });
  window.addEventListener('resize', rymi);
  teikna();
  rymi();
})();
