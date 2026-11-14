/* Efnislag síðunnar. Hleðst fyrst (í <head>) og sér um þrennt:
   1. Bannerasafnið (BANNERAR): það sem forsíðuhausinn getur sýnt. Skriftan neðst í site/router.js setur bannerinn í hausinn.
   2. Breytingar úr ritlinum: texti (data-e), myndir (data-m), svæði (data-k) og þema síðunnar sem breytt var eru sótt af
      þjóninum og sett á síðuna.
      Efnið geymir aðeins það sem breytt var; allt annað stendur eins og það er í síðunni sjálfri. Síðasta útgáfa er geymd
      í vafranum svo síðan birtist rétt strax við næstu heimsókn, og er borin saman við þjóninn í hvert sinn.
   3. Ritillinn: ?ritill í slóðinni hleður site/ritill.js og site/ritill.css.
   Stillingar eru á <script>-merkinu: data-utgafa (v1, v2 eða v3), data-api (slóð fallsins; vanti hana er ekkert sótt og
   ritillinn ekki í boði), data-myndir (forskeyti slóða á myndir sem hlaðið var upp) og data-litir (litaval útgáfunnar).
   Allt sem kemur af þjóninum er hreinsað áður en það fer á síðuna: texti, fáein textamerki og stílar af lista, ekkert annað.

   Snið efnisins:
     t[lykill]  { h: "texti með <b>, <i>, <span style>, <a href>, <br>", href, s: {…stílar}, sm: {…stílar} }
     k[lykill]  { s: {…stílar}, sm: {…stílar} }      svæði: kafli, spjald, listi, haus, fótur
     rod[lykill svæðis]  [lyklar barna í þeirri röð sem þau eiga að standa]
     utlit      { "--tákn": gildi }      þema: litir, letur og mál af listanum í <script id="bh-utlit"> í haus síðunnar
     m[lykill]  { src, fit: "cover"|"contain", pos, z, r, h, w, sm: {h, w, pos, z, fit} }
     hetja      { id: "<banner>" } eða { id: "ser", mynd, pos, ljos }
     litir      litaval ritilsins (mest 15 litir)
     myndasafn  slóðir mynda sem hlaðið var upp í ritlinum
   s gildir alls staðar og sm aðeins á síma (mjórri en 701 px).
   Stílar (í s og sm): letur og texti  ff, fs, fw, lh, ls, ta, it, tt, c
                       kassi           bg, r, pt, pb, pl, pr, mt, mb, mw, jf, h, bw, bc, sk, op, gap, dal, fal
   Hvert gildi er tala innan marka, litur (#rrggbb) eða orð af lista; ekkert frjálst CSS kemst á síðuna. */
(function () {
  'use strict';
  var d = document, s = d.currentScript || {};
  function att(n) { return (s.getAttribute && s.getAttribute(n)) || ''; }
  /* síða sem opnuð er beint af diski (file:) á engan þjón: þá er ekkert sótt og ritillinn ekki í boði */
  var U = att('data-utgafa'), API = location.protocol === 'file:' ? '' : att('data-api'), MYNDIR = att('data-myndir');
  var GRUNNUR = (s.src || '').replace(/[^/]*$/, '');          /* mappan sem þessi skrá er í */
  var q = { get: function () { return null; }, has: function () { return false; } };
  try { q = new URLSearchParams(location.search); } catch (e) {}
  var RITILL = !!API && q.has('ritill');
  var LYKILL = 'bh_efni_' + U;
  var SIMI = '(max-width:700px)';
  var LETUR = ['Poppins', 'Inter', 'Questrial', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Raleway', 'Work Sans', 'DM Sans',
    'Source Sans 3', 'Playfair Display', 'Merriweather', 'Oswald'];
  var BLOB = 'blob:' + location.origin + '/';                 /* mynd sem bíður upphleðslu í ritlinum */
  var STADIR = { 'left top': 1, top: 1, 'right top': 1, left: 1, center: 1, right: 1, 'left bottom': 1, bottom: 1, 'right bottom': 1 };
  var BANNERAR = [
    { id: 'eldur', heiti: 'Eldur, myndskeið', gerd: 'video', mynd: 'img/hetja-eldur.webp' },
    { id: 'eldur-kyrr', heiti: 'Eldur, kyrrmynd', gerd: 'kyrr', mynd: 'img/hetja-eldur.webp' },
    { id: 'hus', heiti: 'Húsið', gerd: 'mynd', mynd: 'img/hetja-v3.webp', pos: 'right top' },
    { id: 'hus-vatn', heiti: 'Hús við vatn', gerd: 'mynd', mynd: 'img/verslun-hetja.webp', pos: 'right center' },
    { id: 'hus-breid', heiti: 'Hús, breið mynd', gerd: 'mynd', mynd: 'img/banner/hus-breid.webp', pos: 'right center' },
    { id: 'solarlag', heiti: 'Sólarlag', gerd: 'mynd', mynd: 'img/banner/solarlag.webp', pos: 'right bottom' },
    { id: 'logi', heiti: 'Logi', gerd: 'mynd', mynd: 'img/banner/logi.webp', pos: 'right 30%', ljos: true }
  ];

  /* ---- gildi sem mega fara á síðuna ---- */
  function litur(v) { return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v.toLowerCase() : null; }
  function tala(v, min, max) {
    if (typeof v === 'string') v = v.trim() === '' ? NaN : Number(v);      /* aðeins tala eða talnastrengur: hlutur gæti kastað villu við umbreytingu */
    return typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
  }
  function leturOk(v) { return typeof v === 'string' && LETUR.indexOf(v) >= 0; }
  function lykillOk(k) { return typeof k === 'string' && /^[a-z0-9][a-z0-9._-]{0,80}$/.test(k); }
  function stadur(v) {
    if (typeof v !== 'string') return null;
    if (Object.prototype.hasOwnProperty.call(STADIR, v)) return v;
    return /^(left|center|right|(?:100|\d{1,2})%) (top|center|bottom|(?:100|\d{1,2})%)$/.test(v) ? v : null;
  }
  /* mynd: skrá í síðunni sjálfri, mynd sem hlaðið var upp, eða (aðeins í ritlinum) mynd sem bíður upphleðslu */
  function myndOk(src) {
    if (typeof src !== 'string' || src.length > 400) return false;
    if (/^(img|myndir|vv)\/[A-Za-z0-9_\/.-]+\.(webp|jpe?g|png)$/.test(src) && src.indexOf('..') < 0) return true;
    if (MYNDIR && src.indexOf(MYNDIR) === 0 && /^[A-Za-z0-9_\/.-]+\.(webp|jpe?g|png)$/.test(src.slice(MYNDIR.length)) && src.indexOf('..') < 0) return true;
    return RITILL && src.indexOf(BLOB) === 0 && /^[0-9A-Fa-f-]{8,80}$/.test(src.slice(BLOB.length));
  }
  function slod(h) {
    if (typeof h !== 'string') return null;
    h = h.trim();
    if (/^#[A-Za-z0-9_\/.=&%-]{0,120}$/.test(h) || /^tel:\+?[0-9 ()-]{3,24}$/.test(h) || /^mailto:[^\s<>"']{3,120}$/.test(h)) return h;
    return /^https:\/\/[^\s<>"']{3,400}$/.test(h) ? h : null;
  }

  /* ---- hreinsun á texta: aðeins þessi merki, klasar og stílar lifa ---- */
  var MERKI = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, BR: 1, SPAN: 1, SMALL: 1, A: 1, SUP: 1, SUB: 1 };
  var UT = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, TEMPLATE: 1, NOSCRIPT: 1, TITLE: 1, HEAD: 1, LINK: 1, META: 1 };
  function still(v) {
    var ut = [];
    String(v || '').split(';').forEach(function (bit) {
      var i = bit.indexOf(':');
      if (i < 0) return;
      var p = bit.slice(0, i).trim().toLowerCase(), g = bit.slice(i + 1).trim().replace(/\s*!important$/i, '');
      var m;
      if (p === 'color' || p === 'background-color') {
        m = litur(g) || rgb(g);
        if (m) ut.push(p + ':' + m);
      } else if (p === 'font-size') {
        m = /^(\d+(?:\.\d+)?)(px|em|rem|%)$/.exec(g);
        if (m) {
          var n = Number(m[1]), hi = { px: 200, em: 6, rem: 12, '%': 600 }[m[2]], lo = { px: 8, em: 0.4, rem: 0.5, '%': 40 }[m[2]];
          ut.push('font-size:' + Math.min(hi, Math.max(lo, n)) + m[2]);
        }
      } else if (p === 'font-family') {
        m = g.split(',')[0].replace(/["']/g, '').trim();
        if (leturOk(m)) ut.push('font-family:"' + m + '",sans-serif');
      } else if (p === 'font-weight') {
        if (/^(normal|bold|[1-9]00)$/.test(g)) ut.push('font-weight:' + g);
      } else if (p === 'font-style') {
        if (g === 'italic' || g === 'normal') ut.push('font-style:' + g);
      } else if (p === 'text-decoration' || p === 'text-decoration-line') {
        if (g === 'underline' || g === 'line-through' || g === 'none') ut.push('text-decoration:' + g);
      } else if (p === 'letter-spacing') {
        m = /^(-?\d+(?:\.\d+)?)em$/.exec(g);
        if (m) ut.push('letter-spacing:' + Math.min(0.5, Math.max(-0.1, Number(m[1]))) + 'em');
      } else if (p === 'text-transform') {
        if (g === 'uppercase' || g === 'none') ut.push('text-transform:' + g);
      }
    });
    return ut.join(';');
  }
  function rgb(g) {      /* vafrar skrifa liti sem rgb(...) þegar texti er litaður í ritlinum */
    var m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(g);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(function (x) { var n = Math.min(255, Number(x)).toString(16); return n.length < 2 ? '0' + n : n; }).join('');
  }
  function klasar(v, leyfdir) {
    return String(v || '').split(/\s+/).filter(function (k) {
      return /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(k) && !/^(brr|bsafn)/i.test(k) && (!leyfdir || Object.prototype.hasOwnProperty.call(leyfdir, k));
    }).join(' ');
  }
  /* klasar sem upprunalegi textinn í stakinu notar sjálfur: aðeins þeir standa þegar texta þess er breytt */
  function klasarI(html) {
    var ut = {};
    String(html || '').replace(/\bclass="([^"]*)"/g, function (_, a) { a.split(/\s+/).forEach(function (k) { if (k) ut[k] = 1; }); return _; });
    return ut;
  }
  function ganga(fra, til, leyfdir) {
    Array.prototype.slice.call(fra.childNodes).forEach(function (n) {
      if (n.nodeType === 3) { til.appendChild(d.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1 || n instanceof HTMLFormElement) return;      /* form getur falið eigin eiginleika á bak við reiti með sama nafni: sleppt í heild */
      var merki = String(n.nodeName).toUpperCase();
      if (UT[merki]) return;
      if (merki === 'DIV' || merki === 'P') {            /* lína sem vafrinn bjó til við innslátt: efnið, með línuskilum á undan */
        if (til.childNodes.length) til.appendChild(d.createElement('br'));
        ganga(n, til, leyfdir);
        return;
      }
      var el;
      if (merki === 'FONT') {                            /* eldra snið á lit og letri: verður að <span style> */
        el = d.createElement('span');
        var st = [];
        if (n.getAttribute('color')) st.push('color:' + n.getAttribute('color'));
        if (n.getAttribute('face')) st.push('font-family:' + n.getAttribute('face'));
        st = still(st.join(';') + ';' + (n.getAttribute('style') || ''));
        if (st) el.setAttribute('style', st);
        ganga(n, el, leyfdir);
        if (st) til.appendChild(el); else while (el.firstChild) til.appendChild(el.firstChild);
        return;
      }
      if (!MERKI[merki]) { ganga(n, til, leyfdir); return; }      /* óþekkt merki: textinn innan úr því lifir */
      el = d.createElement(merki.toLowerCase());
      var kl = klasar(n.getAttribute('class'), leyfdir), stl = still(n.getAttribute('style'));
      if (kl) el.setAttribute('class', kl);
      if (stl) el.setAttribute('style', stl);
      if (merki === 'A') {
        var h = slod(n.getAttribute('href'));
        if (h) el.setAttribute('href', h);
        if (n.getAttribute('target') === '_blank') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
      }
      if (merki !== 'BR') ganga(n, el, leyfdir);
      /* tómt span án stíls og klasa gerir ekkert: sleppt */
      if (merki === 'SPAN' && !kl && !stl) { while (el.firstChild) til.appendChild(el.firstChild); return; }
      til.appendChild(el);
    });
  }
  function hreinsa(html, leyfdir) {
    var t = d.createElement('template'), ut = d.createElement('div');
    t.innerHTML = String(html === null || html === undefined ? '' : html).slice(0, 20000);
    try { ganga(t.content, ut, leyfdir); } catch (e) { ut.textContent = t.content.textContent || ''; }
    return ut.innerHTML;
  }
  /* texti fyrir tiltekið stak: sama hreinsun, og aðeins klasar úr upprunalegum texta staksins */
  function hreinsaFyrir(el, html) {
    if (el._bhFrum === undefined) return hreinsa(html, klasarI(el.innerHTML));
    return hreinsa(html, el._bhKl || (el._bhKl = klasarI(el._bhFrum)));
  }

  /* ---- stílar: s gildir alls staðar, sm á síma ---- */
  function imp(r) { return r.map(function (x) { return x + '!important'; }).join(';'); }
  /* kassastílar: [CSS-eiginleiki, lágmark, hámark, eining]. Eiga við textastök og svæði. */
  var KASSI = {
    pt: ['padding-top', 0, 400, 'px'], pb: ['padding-bottom', 0, 400, 'px'], pl: ['padding-left', 0, 400, 'px'], pr: ['padding-right', 0, 400, 'px'],
    mt: ['margin-top', -200, 400, 'px'], mb: ['margin-bottom', -200, 400, 'px'], mw: ['max-width', 120, 2400, 'px'], h: ['min-height', 0, 2000, 'px'],
    r: ['border-radius', 0, 200, 'px'], bw: ['border-width', 0, 20, 'px'], gap: ['gap', 0, 200, 'px'], op: ['opacity', 0.05, 1, '']
  };
  var SKUGGAR = { none: 'none', s: '0 1px 2px rgba(2,25,60,.06),0 4px 12px rgba(2,25,60,.08)', m: '0 2px 4px rgba(2,25,60,.08),0 14px 32px rgba(2,25,60,.14)',
    l: '0 8px 16px rgba(2,25,60,.12),0 28px 64px rgba(2,25,60,.22)' };
  var JOFNUN = { v: ['0', 'auto'], m: ['auto', 'auto'], h: ['auto', '0'] };      /* hvar kassi með mestu breidd stendur: vinstri, miðja, hægri */
  function hefur(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function stillKassi(o, r) {
    var n, k;
    for (k in KASSI) if (hefur(KASSI, k) && (n = tala(o[k], KASSI[k][1], KASSI[k][2])) !== null) r.push(KASSI[k][0] + ':' + n + KASSI[k][3]);
    if (tala(o.bw, 0, 20) !== null) r.push('border-style:solid');
    if (litur(o.bg)) r.push('background:' + litur(o.bg));
    if (litur(o.bc)) r.push('border-color:' + litur(o.bc));
    if (typeof o.sk === 'string' && hefur(SKUGGAR, o.sk)) r.push('box-shadow:' + SKUGGAR[o.sk]);
    if (typeof o.jf === 'string' && hefur(JOFNUN, o.jf)) { r.push('margin-left:' + JOFNUN[o.jf][0]); r.push('margin-right:' + JOFNUN[o.jf][1]); }
    if ((n = tala(o.dal, 1, 6)) !== null) r.push('grid-template-columns:repeat(' + Math.round(n) + ',minmax(0,1fr))');
  }
  /* þematákn síðunnar: listinn stendur í <script type="application/json" id="bh-utlit"> í haus hennar, á undan þessari skrá.
     Hvert tákn: { k: "--heiti", t: "l" (litur) | "f" (letur) | "px" (mál), n: heiti í ritlinum, h: hópur, min, max } */
  var TAKN = [];
  try {
    var tk = d.getElementById('bh-utlit');
    (tk ? JSON.parse(tk.textContent) : []).forEach(function (x) {
      if (x && typeof x.k === 'string' && /^--[a-z0-9-]{1,40}$/.test(x.k) && (x.t === 'l' || x.t === 'f' || x.t === 'px')) TAKN.push(x);
    });
  } catch (e) { TAKN = []; }
  function stilUtlit(u) {
    var r = [];
    if (!u || typeof u !== 'object') return '';
    TAKN.forEach(function (x) {
      var v = u[x.k], n;
      if (v === undefined || v === null) return;
      if (x.t === 'l') { if (litur(v)) r.push(x.k + ':' + litur(v)); }
      else if (x.t === 'f') { if (leturOk(v)) r.push(x.k + ':"' + v + '",system-ui,-apple-system,"Segoe UI",sans-serif'); }
      else if ((n = tala(v, typeof x.min === 'number' ? x.min : 0, typeof x.max === 'number' ? x.max : 400)) !== null) r.push(x.k + ':' + n + 'px');
    });
    return r.length ? ':root{' + imp(r) + '}' : '';
  }
  function stillT(o) {
    var r = [], n;
    if (!o || typeof o !== 'object') return '';
    stillKassi(o, r);
    if (leturOk(o.ff)) r.push('font-family:"' + o.ff + '",sans-serif');
    if ((n = tala(o.fs, 8, 200)) !== null) r.push('font-size:' + n + 'px');
    if ((n = tala(o.fw, 100, 900)) !== null) r.push('font-weight:' + Math.round(n / 100) * 100);
    if ((n = tala(o.lh, 0.8, 3)) !== null) r.push('line-height:' + n);
    if ((n = tala(o.ls, -0.1, 0.5)) !== null) r.push('letter-spacing:' + n + 'em');
    if (o.ta === 'left' || o.ta === 'center' || o.ta === 'right') r.push('text-align:' + o.ta);
    if (o.it === true) r.push('font-style:italic');
    if (o.tt === 'uppercase' || o.tt === 'none') r.push('text-transform:' + o.tt);
    if (litur(o.c)) r.push('color:' + litur(o.c));
    return imp(r);
  }
  /* tekur síðan þetta gildi gilt í s eða sm? Ritillinn notar þetta til að segja frá gildum sem var sleppt úr svari. */
  var STILAR = ['ff', 'fs', 'fw', 'lh', 'ls', 'ta', 'it', 'tt', 'c', 'bg', 'bc', 'sk', 'jf', 'dal', 'fal'].concat(Object.keys(KASSI));
  function giltStil(k, v) {
    if (STILAR.indexOf(k) < 0) return false;
    if (k === 'fal' || k === 'it') return v === true;
    var o = {};
    o[k] = v;
    return stillT(o) !== '';
  }
  /* mynd: [mynd með ramma, ramminn, mynd án ramma] */
  function stillM(o) {
    var mynd = [], rammi = [], laus = [], n, p;
    if (!o || typeof o !== 'object') return ['', '', ''];
    if (o.fit === 'cover' || o.fit === 'contain') mynd.push('object-fit:' + o.fit);
    if ((p = stadur(o.pos))) mynd.push('object-position:' + p);
    if ((n = tala(o.z, 100, 300)) !== null && n > 100) { mynd.push('transform:scale(' + n / 100 + ')'); mynd.push('transform-origin:' + (p || 'center')); }
    if ((n = tala(o.r, 0, 80)) !== null) mynd.push('border-radius:' + n + 'px');
    if ((n = tala(o.h, 30, 1400)) !== null) { rammi.push('min-height:' + n + 'px'); laus.push('height:' + n + 'px'); laus.push('width:auto'); laus.push('max-width:none'); }
    if ((n = tala(o.w, 10, 100)) !== null) rammi.push('width:' + n + '%');
    return [imp(mynd), imp(rammi), imp(laus)];
  }
  /* falið stak: gestir sjá það ekki. Í ritlinum (html.brr-syna-falid) sést það dauft með strikalínu, svo hægt sé að velja það og sýna aftur. */
  var FALID = 'opacity:.38!important;outline:2px dashed #e11d48!important;outline-offset:-2px!important';
  function stilblad(efni) {
    var a = [], b = [], t = efni.t || {}, m = efni.m || {}, sv = efni.k || {};
    function regla(listi, val, st) { if (st) listi.push(val + '{' + st + '}'); }
    function fela(listi, val, o) {
      if (!o || typeof o !== 'object' || o.fal !== true) return;
      listi.push('html:not(.brr-syna-falid) ' + val + '{display:none!important}');
      listi.push('html.brr-syna-falid ' + val + '{' + FALID + '}');
    }
    /* litur texta á svæði nær til textanna í því, nema hnappa og hlekkja. Reglan vegur ekkert (:where), svo texti með eigin lit
       heldur honum, og innra svæði með eigin lit ræður sínum textum (--bh-c erfist niður tréð). */
    function litSvaedis(val, st) {
      var c = st && typeof st === 'object' ? litur(st.c) : null;
      if (!c) return;
      a.push(val + '{--bh-c:' + c + '}');
      a.push(':where(' + val + ' [data-e]:not(a,button,a *,button *)){color:var(--bh-c)!important}');
    }
    var thema = stilUtlit(efni.utlit);
    if (thema) a.push(thema);
    [[t, 'data-e'], [sv, 'data-k']].forEach(function (x) {
      Object.keys(x[0]).forEach(function (k) {
        var o = x[0][k], val = '[' + x[1] + '="' + k + '"]';
        if (!lykillOk(k) || !o || typeof o !== 'object') return;
        regla(a, val, stillT(o.s));
        regla(b, val, stillT(o.sm));
        if (x[1] === 'data-k') litSvaedis(val, o.s);
        fela(a, val, o.s);
        fela(b, val, o.sm);
      });
    });
    Object.keys(m).forEach(function (k) {
      if (!lykillOk(k) || !m[k]) return;
      [[a, stillM(m[k])], [b, stillM(m[k].sm)]].forEach(function (x) {
        regla(x[0], '[data-m="' + k + '"]', x[1][0]);
        regla(x[0], '[data-mr="' + k + '"]', x[1][1]);
        regla(x[0], '[data-m="' + k + '"]:not([data-mf])', x[1][2]);
      });
    });
    return a.join('\n') + (b.length ? '\n@media ' + SIMI + '{\n' + b.join('\n') + '\n}' : '');
  }
  function leturIEfni(efni) {
    var fundid = {}, t = efni.t || {}, sv = efni.k || {}, u = efni.utlit || {};
    Object.keys(sv).forEach(function (k) { var o = sv[k] || {}; [o.s, o.sm].forEach(function (x) { if (x && leturOk(x.ff)) fundid[x.ff] = 1; }); });
    if (typeof u === 'object') TAKN.forEach(function (x) { if (x.t === 'f' && leturOk(u[x.k])) fundid[u[x.k]] = 1; });
    Object.keys(t).forEach(function (k) {
      var o = t[k] || {};
      [o.s, o.sm].forEach(function (x) { if (x && leturOk(x.ff)) fundid[x.ff] = 1; });
      (typeof o.h === 'string' ? o.h : '').replace(/font-family:\s*(?:&quot;|["'])?([A-Za-z0-9 ]+)/g, function (_, f) { f = f.trim(); if (leturOk(f)) fundid[f] = 1; return _; });
    });
    return Object.keys(fundid);
  }
  var hladid = {};
  function hladaLetri(nafn) {
    if (!leturOk(nafn) || hladid[nafn]) return;
    hladid[nafn] = 1;
    var fam = nafn.replace(/ /g, '+'), til = d.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < til.length; i++) if ((til[i].getAttribute('href') || '').indexOf('family=' + fam) >= 0) return;
    var l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@400;500;600;700&display=swap';
    d.head.appendChild(l);
  }

  /* ---- efnið sett á síðuna ---- */
  var efni = {}, nr = null, blad = null;
  function finnaBanner(id) {
    for (var i = 0; i < BANNERAR.length; i++) if (BANNERAR[i].id === id) return BANNERAR[i];
    return null;
  }
  function serBanner(h) {      /* eigin mynd í forsíðuhausnum */
    if (!h || !myndOk(h.mynd)) return null;
    var b = { id: 'ser', heiti: 'Eigin mynd', gerd: 'mynd', mynd: h.mynd, pos: stadur(h.pos) || 'center', ljos: h.ljos === true };
    var i = BANNERAR.length;
    while (i--) if (BANNERAR[i].id === 'ser') BANNERAR.splice(i, 1);
    BANNERAR.push(b);
    return b;
  }
  function hetja() {
    var h = efni.hetja, hero = d.querySelector('[data-hetja]');
    if (!hero) return;
    if (hero._bhFrum === undefined) hero._bhFrum = hero.getAttribute('data-hetja');
    var b = h && typeof h === 'object' ? (h.id === 'ser' ? serBanner(h) : finnaBanner(h.id)) : null;
    if (!b) b = finnaBanner(hero._bhFrum);
    if (!b) return;
    var merki = [b.id, b.mynd, b.pos, b.ljos].join('|');
    if (hero._bhSett === merki) return;      /* þegar sett: forskoðun (?hetja=) fær að standa */
    hero._bhSett = merki;
    if (window.BH_HETJA) { window.BH_HETJA.setja(b.id); return; }      /* skriftan í router.js er komin: hún sér um allt */
    /* annars rétt mynd strax, áður en síðan er teiknuð */
    hero.setAttribute('data-hetja', b.id);
    var mynd = hero.querySelector('[data-hetja-mynd]'), v = hero.querySelector('[data-hetja-video]');
    if (mynd && mynd.getAttribute('src') !== b.mynd) { mynd.removeAttribute('width'); mynd.removeAttribute('height'); mynd.setAttribute('src', b.mynd); }
    if (v && b.gerd !== 'video') v.hidden = true;
  }
  function setjaTexta(el) {
    if (el.closest('#vv-app')) return;                     /* verslunin teiknar sín eigin merktu stök */
    var k = el.getAttribute('data-e'), o = (efni.t || {})[k];
    var breytt = o && typeof o.h === 'string';
    /* hlekkur: stakið sjálft sé það <a>, annars hlekkurinn sem það stendur í */
    var hl = el.nodeName === 'A' ? el : el.closest('a'), ny = o && typeof o === 'object' ? slod(o.href) : null;
    if (hl && (ny || hl._bhHref !== undefined)) {
      if (hl._bhHref === undefined) hl._bhHref = hl.getAttribute('href');
      var vil = ny || hl._bhHref;
      if (hl.getAttribute('href') !== vil) { if (vil === null) hl.removeAttribute('href'); else hl.setAttribute('href', vil); }
    }
    if (!breytt && el._bhFrum === undefined) return;       /* ósnert stak: látið vera */
    if (el._bhFrum === undefined) el._bhFrum = el.innerHTML;
    var html = breytt ? hreinsaFyrir(el, o.h) : el._bhFrum;
    if (el._bhNu !== html) { el.innerHTML = html; el._bhNu = html; }
  }
  function setjaMynd(el) {
    if (el.hasAttribute('data-hetja-mynd')) return;        /* bannerinn ræður myndinni í forsíðuhausnum */
    if (el.nodeName !== 'IMG' || el.closest('#vv-app')) return;
    var k = el.getAttribute('data-m'), o = (efni.m || {})[k];
    var breytt = o && myndOk(o.src);
    if (!breytt && el._bhFrum === undefined) return;
    if (el._bhFrum === undefined) el._bhFrum = { src: el.getAttribute('src') || '', w: el.getAttribute('width'), h: el.getAttribute('height') };
    var src = breytt ? o.src : el._bhFrum.src;
    if (el.getAttribute('src') === src) return;
    if (breytt) { el.removeAttribute('width'); el.removeAttribute('height'); } else {
      if (el._bhFrum.w) el.setAttribute('width', el._bhFrum.w);
      if (el._bhFrum.h) el.setAttribute('height', el._bhFrum.h);
    }
    el.setAttribute('src', src);
  }
  /* röð svæða: lykluð börn svæðis fá röðina úr rod[lykill svæðis]; börn án lykils standa kyrr í sínum sætum */
  function rada() {
    var rod = efni.rod && typeof efni.rod === 'object' ? efni.rod : {};
    Array.prototype.forEach.call(d.querySelectorAll('[data-k]'), function (p) {
      if (p.closest('#vv-app')) return;
      var born = Array.prototype.filter.call(p.children, function (c) { return c.hasAttribute('data-k'); });
      if (born.length < 2) return;
      var lykill = function (c) { return c.getAttribute('data-k'); };
      if (p._bhRod === undefined) p._bhRod = born.map(lykill);      /* upprunalega röðin */
      var osk = Array.isArray(rod[lykill(p)]) ? rod[lykill(p)] : [], vaent = [];
      osk.forEach(function (x) { if (typeof x === 'string' && p._bhRod.indexOf(x) >= 0 && vaent.indexOf(x) < 0) vaent.push(x); });
      p._bhRod.forEach(function (x) { if (vaent.indexOf(x) < 0) vaent.push(x); });
      if (born.map(lykill).join('|') === vaent.join('|')) return;
      var eftir = {}, saeti = born.map(function (c) { eftir[lykill(c)] = c; var m = d.createComment(''); p.insertBefore(m, c); return m; });
      vaent.forEach(function (key, i) { if (saeti[i].nextSibling !== eftir[key]) p.insertBefore(eftir[key], saeti[i].nextSibling); });
      saeti.forEach(function (m) { p.removeChild(m); });
    });
  }
  function reyna(f) { try { f(); } catch (e) {} }
  function setja() {
    if (!blad) { blad = d.createElement('style'); blad.id = 'bh-efni-stilar'; (d.head || d.documentElement).appendChild(blad); }
    /* hvert skref stendur eitt: gallað gildi á einum stað stöðvar ekki hin */
    reyna(function () { var css = stilblad(efni); if (blad.textContent !== css) blad.textContent = css; });
    reyna(function () { leturIEfni(efni).forEach(hladaLetri); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-e]'), function (el) { reyna(function () { setjaTexta(el); }); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-m]'), function (el) { reyna(function () { setjaMynd(el); }); });
    reyna(rada);
    reyna(hetja);
  }
  function beita(nytt, nyttNr) {
    efni = nytt && typeof nytt === 'object' ? nytt : {};
    if (nyttNr !== undefined) nr = nyttNr;
    setja();
  }

  /* ---- fyrsta heimsókn: breytanlegt efni bíður augnablik eftir þjóninum, svo gamall texti blikki ekki ---- */
  var bid = null;
  function bida() {
    bid = d.createElement('style');
    bid.textContent = 'body{visibility:hidden!important}';
    d.head.appendChild(bid);
    setTimeout(synda, 350);
  }
  function synda() { if (bid) { bid.remove(); bid = null; } }

  var E = window.BH_EFNI = {
    utgafa: U, api: API, myndir: MYNDIR, ritill: RITILL, simi: SIMI, LETUR: LETUR, STADIR: Object.keys(STADIR), BANNERAR: BANNERAR,
    litir: att('data-litir').split(',').map(function (x) { return litur(x.trim()); }).filter(Boolean),
    efni: function () { return efni; }, nr: function () { return nr; },
    setja: setja, beita: beita, hreinsa: hreinsa, hreinsaFyrir: hreinsaFyrir, hladaLetri: hladaLetri,
    litur: litur, tala: tala, leturOk: leturOk, myndOk: myndOk, stadur: stadur, slod: slod, finnaBanner: finnaBanner,
    KASSI: KASSI, SKUGGAR: Object.keys(SKUGGAR), TAKN: TAKN, lykillOk: lykillOk, STILAR: STILAR, giltStil: giltStil,
    frum: function (el) { return el._bhFrum; }
  };

  var geymt = null;
  try { geymt = JSON.parse(localStorage.getItem(LYKILL) || 'null'); } catch (e) {}
  if (RITILL) {
    /* ritillinn sækir drögin sjálfur og setur þau á síðuna */
    var hlada = function () {
      var l = d.createElement('link'), r = d.createElement('script');
      l.rel = 'stylesheet'; l.href = GRUNNUR + 'ritill.css';
      r.src = GRUNNUR + 'ritill.js';
      d.head.appendChild(l); d.body.appendChild(r);
    };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', hlada); else hlada();
    return;
  }
  if (!API) return;                    /* síðan stendur ein (t.d. tillaga í Claude): ekkert að sækja */
  if (geymt && typeof geymt === 'object' && geymt.efni) beita(geymt.efni, geymt.nr); else bida();
  /* Svar þjónsins er geymt á jaðrinum og getur verið nokkurra mínútna gamalt rétt eftir birtingu. Útgáfunúmerið hækkar aðeins,
     svo lægra númer en það sem þessi vafri lærði af á síðustu tíu mínútum er gamalt svar og er ekki tekið fram yfir nýja efnið.
     Eldra afrit víkur (taflan gæti hafa verið endurstillt). */
  var nybirt = !!geymt && typeof geymt.kl === 'number' && Date.now() - geymt.kl < 600000;
  fetch(API + '?utgafa=' + encodeURIComponent(U), { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (r) {
    if (r && r.efni && typeof r.efni === 'object' && r.nr !== nr && !(nybirt && typeof nr === 'number' && r.nr < nr)) {
      beita(r.efni, r.nr);
      try { localStorage.setItem(LYKILL, JSON.stringify({ nr: r.nr, efni: r.efni, kl: Date.now() })); } catch (e) {}
    }
  }).catch(function () {}).then(synda);
  d.addEventListener('DOMContentLoaded', setja);
})();
