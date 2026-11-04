/* jarvis-ring.js — HUD-hringurinn úr Agentanets-hönnuninni, tilbúinn fyrir Brunahólf.
 *
 * Notkun:
 *   <link rel="stylesheet" href="jarvis-ring.css">
 *   <div id="ring"></div>
 *   <script src="jarvis-ring.js"></script>
 *   <script>JarvisRing.mount(document.getElementById('ring'), { size: 520, theme: 'jarvis' });</script>
 *
 * Valkostir:
 *   size   — hæð í px (sjálfgefið 520). Allt skalast með.
 *   aspect — breidd/hæð (sjálfgefið 1 = hringur; 1.35 = ílangur, passar í breitt spjald).
 *   theme  — 'jarvis' (cyan) eða 'ragnarok' (gull). Setur CSS-breytur á rótina;
 *            má líka sleppa og setja --jr-acc / --jr-acc-hi / --jr-acc2 / --jr-edge sjálfur.
 *   labels — true/false, gráðumerkingar 000–330 (sjálfgefið true).
 *   stars  — true/false, stjörnuhiminn inni í hringnum (sjálfgefið true).
 *   core   — texti í miðju, t.d. 'J.A.R.V.I.S.' (sjálfgefið), '' = enginn.
 *   sub    — lína undir kjarnatexta, t.d. '39 agentar · 38 skills'.
 *
 * Skilar { el, setTheme(name), destroy() }.
 * Hreyfingar slokkna sjálfkrafa undir prefers-reduced-motion: reduce (sjá CSS).
 */
(function (global) {
  'use strict';

  var THEMES = {
    jarvis:   { acc: '#4fd8ff', accHi: '#bff2ff', acc2: '#1a7fc0', edge: 'rgba(79,216,255,.45)',  glow: 'rgba(79,216,255,.4)',  glowIn: 'rgba(79,216,255,.03)',  coreA: 'rgba(79,216,255,.35)', coreB: 'rgba(10,60,90,.55)', font: "'Rajdhani','JetBrains Mono',sans-serif" },
    ragnarok: { acc: '#d4a53a', accHi: '#f6dc8c', acc2: '#8a6418', edge: 'rgba(212,165,58,.5)',   glow: 'rgba(212,165,58,.45)', glowIn: 'rgba(212,165,58,.025)', coreA: 'rgba(212,165,58,.45)', coreB: 'rgba(60,40,8,.6)',   font: "'Cinzel','Rajdhani',serif" }
  };

  // Hringirnir, innan frá og út. r = radíus í 520-kerfinu, g = snúningshópur (a/b/c/d).
  // Allar tölur eru nákvæmlega þær sömu og í hönnuninni.
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var RINGS = [
    // ysti tifhringur (hópur d, 90 s rangsælis)
    { g: 'd', r: 236, w: 14, dash: '1.5 10.86', op: .55, stroke: 'acc' },
    { g: 'd', r: 238, w: 26, dash: '2.5 122.1', op: .85, stroke: 'accHi' },      // langt tif á 30°
    // kyrr grunnlína
    { g: null, r: 220, w: 1, dash: null, op: 1, stroke: 'edge' },
    // bogar (hópur a, 40 s réttsælis)
    { g: 'a', r: 206, w: 9, dash: '190 70 320 110 80 40 260 224', op: .8, stroke: 'acc', glow: 6 },
    { g: 'a', r: 194, w: 3, dash: '60 20 60 20 300 100 400 259', op: .9, stroke: 'acc2' },
    // hópur b (18 s rangsælis)
    { g: 'b', r: 180, w: 2, dash: '420 90 200 60 361', op: .7, stroke: 'accHi' },
    { g: 'b', r: 172, w: 16, dash: '2 6', op: .3, stroke: 'acc' },
    // hópur c (11 s réttsælis)
    { g: 'c', r: 154, w: 5, dash: '240 60 120 548', op: .9, stroke: 'acc', glow: 8 },
    { g: 'c', r: 146, w: 1, dash: '4 6', op: 1, stroke: 'edge' },
    // innsti kyrri hringur með glóð
    { g: null, r: 138, w: 1, dash: null, op: .6, stroke: 'acc', glow: 10 }
  ];

  var DEG = ['000','030','060','090','120','150','180','210','240','270','300','330'];

  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function applyTheme(root, name) {
    var t = THEMES[name] || THEMES.jarvis;
    root.style.setProperty('--jr-acc', t.acc);
    root.style.setProperty('--jr-acc-hi', t.accHi);
    root.style.setProperty('--jr-acc2', t.acc2);
    root.style.setProperty('--jr-edge', t.edge);
    root.style.setProperty('--jr-glow', t.glow);
    root.style.setProperty('--jr-glow-in', t.glowIn);
    root.style.setProperty('--jr-core-a', t.coreA);
    root.style.setProperty('--jr-core-b', t.coreB);
    root.style.setProperty('--jr-font', t.font);
    root.setAttribute('data-jr-theme', name);
  }

  function mount(container, opts) {
    opts = opts || {};
    var size = opts.size || 520;
    var aspect = opts.aspect || 1;
    var scale = size / 520;          // lóðrétt
    var scaleX = scale * aspect;     // lárétt
    var width = Math.round(size * aspect);

    var root = document.createElement('div');
    root.className = 'jr';
    root.style.width = width + 'px';
    root.style.height = size + 'px';
    root.setAttribute('aria-hidden', 'true');
    if (opts.theme !== null) applyTheme(root, opts.theme || 'jarvis');

    // Stjörnuhiminn (280/520 af þvermáli)
    if (opts.stars !== false) {
      var stars = document.createElement('div');
      stars.className = 'jr-stars';
      var d = Math.round(280 * scale), dw = Math.round(280 * scaleX);
      stars.style.width = dw + 'px'; stars.style.height = d + 'px';
      stars.style.left = Math.round((width - dw) / 2) + 'px';
      stars.style.top = Math.round((size - d) / 2) + 'px';
      root.appendChild(stars);
    }

    // Ratsjárgeisli
    var sweep = document.createElement('div');
    sweep.className = 'jr-sweep';
    root.appendChild(sweep);

    // SVG með hringjunum — viewBox er alltaf 520, svo tölurnar haldast
    var svg = el('svg', { viewBox: '0 0 520 520', width: width, height: size, preserveAspectRatio: 'none', 'class': 'jr-svg' }, root);
    var groups = {};
    ['d', 'a', 'b', 'c'].forEach(function (k) {
      groups[k] = el('g', { 'class': 'jr-g jr-g-' + k }, svg);
    });
    RINGS.forEach(function (R) {
      var c = el('circle', {
        cx: 260, cy: 260, r: R.r, fill: 'none',
        stroke: 'var(--jr-' + ({ acc: 'acc', accHi: 'acc-hi', acc2: 'acc2', edge: 'edge' })[R.stroke] + ')',
        'stroke-width': R.w,
        'stroke-dasharray': R.dash,
        opacity: R.op
      }, R.g ? groups[R.g] : svg);
      if (R.glow) c.style.filter = 'drop-shadow(0 0 ' + R.glow + 'px var(--jr-acc))';
    });

    // Gráðumerkingar á r = 264 (rétt utan við tifhringinn)
    if (opts.labels !== false) {
      DEG.forEach(function (txt, i) {
        var a = (i * 30 - 90) * Math.PI / 180;
        var s = document.createElement('span');
        s.className = 'jr-deg';
        s.textContent = txt;
        s.style.left = Math.round((260 + 264 * Math.cos(a)) * scaleX) + 'px';
        s.style.top = Math.round((260 + 264 * Math.sin(a)) * scale) + 'px';
        root.appendChild(s);
      });
    }

    // Kjarni
    var core = document.createElement('div');
    core.className = 'jr-core';
    var cd = Math.round(176 * scale), cw = Math.round(176 * scaleX);
    core.style.width = cw + 'px'; core.style.height = cd + 'px';
    core.style.left = Math.round((width - cw) / 2) + 'px';
    core.style.top = Math.round((size - cd) / 2) + 'px';
    var dot = document.createElement('div'); dot.className = 'jr-dot'; core.appendChild(dot);
    var coreText = opts.core === undefined ? 'J.A.R.V.I.S.' : opts.core;
    if (coreText) {
      var t = document.createElement('div'); t.className = 'jr-core-t'; t.textContent = coreText;
      t.style.fontSize = Math.round(17 * scale) + 'px';
      core.appendChild(t);
    }
    if (opts.sub) {
      var sb = document.createElement('div'); sb.className = 'jr-core-s'; sb.textContent = opts.sub;
      sb.style.fontSize = Math.max(9, Math.round(10.5 * scale)) + 'px';
      core.appendChild(sb);
    }
    root.appendChild(core);

    container.appendChild(root);
    return {
      el: root,
      setTheme: function (name) { applyTheme(root, name); },
      destroy: function () { root.remove(); }
    };
  }

  global.JarvisRing = { mount: mount, THEMES: THEMES, RINGS: RINGS };
})(window);
