/* Ritill síðunnar. site/efni.js hleður þessari skrá þegar slóðin ber ?ritill.
   Smellt er á texta, mynd, lógó eða forsíðuhausinn á síðunni sjálfri og honum breytt í spjaldinu. Breytingarnar eru efni
   (sjá sniðið efst í site/efni.js), ekki kóði: þær vistast sem drög á þjóninum og fara til gesta þegar ýtt er á Birta.
   - Innskráning: lykilorð ritilsins. Án hennar er ritillinn í prufuham: allt virkar, en ekkert vistast á þjóninum.
   - Sími: stærðir og uppröðun sem breytt er í símabreidd gilda aðeins á síma (sm í efninu). Á tölvu sýnir „Sími“ síðuna
     í ramma í símabreidd.
   - „Breytingar sem texti“ sýnir efnið sem JSON, svo hægt sé að afrita það, laga og setja inn aftur. */
(function () {
  'use strict';
  var E = window.BH_EFNI, d = document;
  if (!E || !E.api || window.BH_RITILL) return;
  var U = E.utgafa, API = E.api;
  var q = new URLSearchParams(location.search);
  var IRAMMA = q.has('rammi');
  var LS_TOK = 'bh_ritill_tok', LS_NAFN = 'bh_me', SS_PRUFA = 'bh_ritill_prufa_' + U;

  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, rot) { return (rot || d).querySelector(sel); }
  function all(sel, rot) { return Array.prototype.slice.call((rot || d).querySelectorAll(sel)); }
  function afrit(o) { return JSON.parse(JSON.stringify(o || {})); }
  function kl(t) { var x = new Date(t); return ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2); }
  function dags(t) { var x = new Date(t); return ('0' + x.getDate()).slice(-2) + '.' + ('0' + (x.getMonth() + 1)).slice(-2) + '.' + x.getFullYear() + ' ' + kl(t); }
  function svg(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }
  var IKON = {
    aftur: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    fram: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    auga: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
    meira: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    simi: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
    tolva: svg('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    loka: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    nidur: svg('<path d="m6 9 6 6 6-6"/>')
  };
  /* slóð þessarar síðu með breyttum viðföngum (null tekur viðfang út) */
  function slodMed(br) {
    var u = new URL(location.href);
    Object.keys(br).forEach(function (k) { if (br[k] === null) u.searchParams.delete(k); else u.searchParams.set(k, br[k]); });
    return u.pathname.replace(/^\/{2,}/, '/') + u.search.replace(/=(?=&|$)/g, '') + u.hash;      /* aldrei tvö skástrik fremst: það væri annað lén */
  }

  /* ---- símasýn á tölvu: þessi gluggi verður rammi utan um síðuna í símabreidd, og ritillinn keyrir inni í honum ---- */
  if (q.has('simi') && window.self === window.top && window.innerWidth > 800) {
    d.documentElement.className = 'brr-rammi';
    d.body.className = 'brr';
    d.body.innerHTML = '<div class="brr-rammi__stika"><strong>Símasýn</strong><span>Síðan eins og hún er á síma. Stærðir og uppröðun sem breytt er hér gilda aðeins á síma.</span>' +
      '<a class="brr-b" href="' + esc(slodMed({ simi: null })) + '">' + IKON.tolva + 'Tölva</a></div>' +
      '<iframe class="brr-rammi__sima" title="Síðan á síma" src="' + esc(slodMed({ simi: null, rammi: '1' })) + '"></iframe>';
    return;
  }

  var R = window.BH_RITILL = {
    efni: {}, birt: {}, birtNr: 0, grunnur: null, tok: null, nafn: '', hamur: 'hled', astaeda: '', villa: '',
    val: null, svid: 'reit', saga: [], fram: [], sLykill: null, sTimi: 0, ovistad: false, obirt: false, vistar: false, timi: null, breyta: true,
    simi: window.matchMedia(E.simi).matches, litaBreyting: false
  };
  var bar, spjald, valRange = null;

  /* ---- samskipti við þjóninn ---- */
  function svarJson(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; }); }
  function kalla(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ritill-tok': R.tok || '' }, body: JSON.stringify(body) }).then(svarJson);
  }
  function saekja(auka) {
    return fetch(API + '?utgafa=' + encodeURIComponent(U) + (auka || ''), { headers: R.tok ? { 'x-ritill-tok': R.tok } : {} }).then(svarJson);
  }

  /* ---- skilaboð og gluggar ---- */
  var skTimi = null;
  function skilabod(t) {
    all('.brr-skilabod').forEach(function (x) { x.remove(); });
    var s = d.createElement('div');
    s.className = 'brr brr-skilabod'; s.setAttribute('role', 'status'); s.textContent = t;
    d.body.appendChild(s);
    clearTimeout(skTimi); skTimi = setTimeout(function () { s.remove(); }, 3400);
  }
  function gluggi(html, breidur) {
    var h = d.createElement('div');
    h.className = 'brr brr-hula';
    h.innerHTML = '<div class="brr-gluggi' + (breidur ? ' brr-breidur' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    h.addEventListener('mousedown', function (e) { if (e.target === h) h.remove(); });
    h.addEventListener('keydown', function (e) { if (e.key === 'Escape') h.remove(); });
    h.addEventListener('click', function (e) { if (e.target.closest('[data-r="haetta"]')) h.remove(); });
    d.body.appendChild(h);
    var f = $('input,textarea,button', h);
    if (f) f.focus();
    return h;
  }
  function spyrja(titill, texti, hnappur, fn, raudur) {
    var g = gluggi('<h3>' + esc(titill) + '</h3><p>' + esc(texti) + '</p><div class="brr-hnappar"><button type="button" class="brr-h" data-r="haetta">Hætta við</button>' +
      '<button type="button" class="brr-h ' + (raudur ? 'brr-raudur' : 'brr-blar') + '" data-r="ja">' + esc(hnappur) + '</button></div>');
    $('[data-r="ja"]', g).addEventListener('click', function () { g.remove(); fn(); });
  }

  /* ---- efnið: allar breytingar fara hér í gegn, svo afturköllun og vistun fylgi ---- */
  function tomt(o) { return !o || typeof o !== 'object' || !Object.keys(o).length; }
  function hreinsaTomt(efni) {
    ['t', 'm'].forEach(function (h) {
      var x = efni[h];
      if (!x) return;
      Object.keys(x).forEach(function (k) {
        var o = x[k];
        ['s', 'sm'].forEach(function (b) { if (o && tomt(o[b])) delete o[b]; });
        if (tomt(o)) delete x[k];
      });
      if (tomt(x)) delete efni[h];
    });
    if (efni.hetja && tomt(efni.hetja)) delete efni.hetja;
    if (Array.isArray(efni.myndasafn) && !efni.myndasafn.length) delete efni.myndasafn;
  }
  function breyta(lykill, fn) {
    var fyrir = JSON.stringify(R.efni);
    fn(R.efni);
    hreinsaTomt(R.efni);
    if (JSON.stringify(R.efni) === fyrir) return false;
    var nu = Date.now();
    if (!(lykill && lykill === R.sLykill && nu - R.sTimi < 900)) { R.saga.push(fyrir); if (R.saga.length > 100) R.saga.shift(); }
    R.sLykill = lykill; R.sTimi = nu; R.fram = [];
    E.beita(R.efni);
    eftirBreytingu();
    return true;
  }
  function eftirBreytingu() {
    R.ovistad = true; R.obirt = true;
    if (R.hamur === 'innskrad') { clearTimeout(R.timi); R.timi = setTimeout(vista, 900); }
    else { try { sessionStorage.setItem(SS_PRUFA, JSON.stringify(R.efni)); } catch (e) {} R.ovistad = false; }
    stada();
  }
  function setjaAllt(efni, iSogu) {          /* skipt um allt efnið í einu (afturköllun, saga, innsett JSON) */
    if (iSogu) { R.saga.push(JSON.stringify(R.efni)); R.fram = []; }
    afvelja();
    R.efni = efni; R.sLykill = null;
    E.beita(R.efni);
    eftirBreytingu(); teiknaSpjald();
  }
  function afturkalla() {
    if (!R.saga.length) return;
    R.fram.push(JSON.stringify(R.efni));
    setjaAllt(JSON.parse(R.saga.pop()), false);
  }
  function endurgera() {
    if (!R.fram.length) return;
    R.saga.push(JSON.stringify(R.efni));
    var e = JSON.parse(R.fram.pop());
    afvelja(); R.efni = e; R.sLykill = null; E.beita(R.efni); eftirBreytingu(); teiknaSpjald();
  }
  function vista(yfirskrifa) {
    if (R.hamur !== 'innskrad' || !R.ovistad) return Promise.resolve(true);
    if (R.vistar) { clearTimeout(R.timi); R.timi = setTimeout(vista, 400); return Promise.resolve(false); }
    clearTimeout(R.timi);
    R.vistar = true; stada();
    var sent = JSON.stringify(R.efni);
    return kalla({ adgerd: 'vista', utgafa: U, efni: R.efni, grunnur: yfirskrifa === true ? '' : R.grunnur }).then(function (r) {
      R.vistar = false;
      if (r.status === 200) {
        R.grunnur = r.j.grunnur; R.vistadKl = Date.now(); R.villa = '';
        if (JSON.stringify(R.efni) === sent) R.ovistad = false; else R.timi = setTimeout(vista, 400);
      } else if (r.status === 409) arekstur(r.j);
      else if (r.status === 401) { R.villa = 'Innskráning rann út'; utskra(); }
      else R.villa = 'Vistun mistókst: ' + (r.j.villa || r.status);
      stada();
      return r.status === 200;
    }).catch(function () { R.vistar = false; R.villa = 'Vistun mistókst: ekkert samband'; stada(); return false; });
  }
  function arekstur(j) {
    var g = gluggi('<h3>Annað tæki vistaði breytingar</h3><p>Drögunum var breytt á öðru tæki' + (j.drog_af ? ' (' + esc(j.drog_af) + ')' : '') +
      ' á meðan þú varst að vinna. Hvora útgáfuna viltu halda?</p><div class="brr-hnappar"><button type="button" class="brr-h" data-r="theirra">Sækja þeirra</button>' +
      '<button type="button" class="brr-h brr-blar" data-r="min">Skrifa yfir með mínum</button></div>');
    $('[data-r="theirra"]', g).addEventListener('click', function () {
      g.remove(); afvelja();
      R.efni = j.efni || {}; R.grunnur = j.grunnur; R.saga = []; R.fram = []; R.ovistad = false;
      E.beita(R.efni); stada(); teiknaSpjald();
    });
    $('[data-r="min"]', g).addEventListener('click', function () { g.remove(); R.ovistad = true; vista(true); });
  }

  /* ---- stikan og spjaldið ---- */
  function teiknaKrom() {
    d.body.classList.add('brr-a', 'brr-breyta', 'brr-spjald-a');
    bar = d.createElement('div');
    bar.id = 'brr-bar'; bar.className = 'brr';
    bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Ritill síðunnar');
    bar.innerHTML =
      '<div class="brr-merki"><strong>Ritill</strong><span data-r="utg"></span></div>' +
      '<select data-r="sida" aria-label="Síða"><option value="#top">Forsíða</option><option value="#brunathettingar">Brunaþéttingar</option>' +
      '<option value="#verslun">Verslun</option><option value="#hafa-samband">Hafa samband</option></select>' +
      (IRAMMA ? '' : '<div class="brr-hopur brr-ekki-simi" role="group" aria-label="Sýn"><button type="button" class="brr-b" data-r="tolva" aria-pressed="true">' + IKON.tolva +
        '<span class="brr-t">Tölva</span></button><button type="button" class="brr-b" data-r="simi" aria-pressed="false">' + IKON.simi + '<span class="brr-t">Sími</span></button></div>') +
      '<button type="button" class="brr-b" data-r="aftur" aria-label="Afturkalla">' + IKON.aftur + '</button>' +
      '<button type="button" class="brr-b" data-r="fram" aria-label="Endurgera">' + IKON.fram + '</button>' +
      '<span class="brr-stada" data-r="stada" role="status"></span>' +
      '<button type="button" class="brr-b" data-r="forskoda" aria-label="Forskoða">' + IKON.auga + '<span class="brr-t">Forskoða</span></button>' +
      '<button type="button" class="brr-b" data-r="meira" aria-label="Fleiri aðgerðir" aria-haspopup="menu">' + IKON.meira + '</button>' +
      '<button type="button" class="brr-b brr-adal" data-r="birta">Birta</button>';
    d.body.appendChild(bar);
    spjald = d.createElement('aside');
    spjald.id = 'brr-spjald'; spjald.className = 'brr';
    spjald.setAttribute('aria-label', 'Stillingar ritilsins');
    d.body.appendChild(spjald);

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b || b.tagName === 'SELECT') return;
      var r = b.getAttribute('data-r');
      if (r === 'aftur') afturkalla();
      else if (r === 'fram') endurgera();
      else if (r === 'forskoda') forskoda(true);
      else if (r === 'meira') valmynd();
      else if (r === 'birta') birta();
      else if (r === 'simi') vista().then(function () { location.href = slodMed({ simi: '1' }); });
    });
    $('[data-r="sida"]', bar).addEventListener('change', function (e) { afvelja(); location.hash = e.target.value; });
    window.addEventListener('hashchange', function () { afvelja(); synaSidu(); });
    synaSidu();
    spjald.addEventListener('mousedown', function (e) {            /* hnappar taka ekki fókusinn úr textanum sem verið er að breyta */
      if (e.target.closest('button') && R.val && R.val.teg === 'e') e.preventDefault();
    });
    spjald.addEventListener('click', spjaldSmellur);
    spjald.addEventListener('input', spjaldInntak);
    spjald.addEventListener('change', spjaldBreyting);
  }
  function synaSidu() {
    var h = location.hash, s = $('[data-r="sida"]', bar);
    s.value = /^#(verslun|karfa|vara-)/.test(h) ? '#verslun' : h === '#brunathettingar' ? '#brunathettingar' : h === '#hafa-samband' ? '#hafa-samband' : '#top';
  }
  function stada() {
    var s = $('[data-r="stada"]', bar), t, stutt, villa = false;
    if (R.hamur === 'hled') t = stutt = 'Sæki…';
    else if (R.hamur === 'prufa') { t = 'Prufuhamur: vistast ekki'; stutt = 'Prufa'; }
    else if (R.villa) { t = R.villa; stutt = 'Villa'; villa = true; }
    else if (R.vistar) t = stutt = 'Vistar…';
    else if (R.ovistad) t = stutt = 'Óvistað';
    else if (R.vistadKl) { t = 'Drög vistuð ' + kl(R.vistadKl); stutt = 'Vistað ' + kl(R.vistadKl); }
    else { t = R.obirt ? 'Óbirt drög' : 'Allt birt'; stutt = R.obirt ? 'Drög' : 'Birt'; }
    s.textContent = t; s.setAttribute('data-stutt', stutt);      /* stutta orðið sést á síma */
    if (villa) s.setAttribute('data-villa', ''); else s.removeAttribute('data-villa');
    $('[data-r="utg"]', bar).textContent = U.toUpperCase() + (R.hamur === 'innskrad' ? ' · ' + (R.nafn || 'innskráð') : R.hamur === 'prufa' ? ' · prufa' : '');
    var b = $('[data-r="birta"]', bar);
    if (R.hamur === 'innskrad') b.removeAttribute('data-ovirkt'); else b.setAttribute('data-ovirkt', '');
    $('[data-r="aftur"]', bar).disabled = !R.saga.length;
    $('[data-r="fram"]', bar).disabled = !R.fram.length;
  }

  /* ---- val á síðunni ---- */
  function heiti(k) {
    var p = String(k).split('.');
    var syn = { heim: 'Forsíða', bruna: 'Brunaþéttingar', sida: 'Allar síður' }[p[0]] || p[0];
    return syn + ' · ' + p.slice(1).join(' ');
  }
  function afvelja() {
    var v = R.val;
    if (!v) return;
    if (v.teg === 'e') {
      geymaTexta();
      v.el.removeAttribute('contenteditable'); v.el.removeAttribute('spellcheck');
      var o = (R.efni.t || {})[v.k], html = o && typeof o.h === 'string' ? E.hreinsaFyrir(v.el, o.h) : v.el._bhFrum;
      v.el.innerHTML = html; v.el._bhNu = html;            /* það sem vafrinn bætti við við innslátt er hreinsað burt */
    }
    all('.brr-valid').forEach(function (x) { x.classList.remove('brr-valid'); });
    R.val = null; valRange = null; R.svid = 'reit';
    teiknaSpjald();
  }
  function velja(el, x, y) {
    if (R.val && R.val.el === el) return;
    afvelja();
    var teg = el.hasAttribute('data-e') ? 'e' : 'm', k = el.getAttribute(teg === 'e' ? 'data-e' : 'data-m');
    R.val = { teg: teg, k: k, el: el, hetja: el.hasAttribute('data-hetja-mynd'), rammi: el.hasAttribute('data-mf') ? $('[data-mr="' + k + '"]') : null };
    (R.val.rammi || el).classList.add('brr-valid');
    if (teg === 'e') {
      if (el._bhFrum === undefined) { el._bhFrum = el.innerHTML; el._bhNu = el.innerHTML; }
      el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false');
      el.focus({ preventScroll: true });
      var r = null;
      try {
        if (d.caretRangeFromPoint && x !== undefined) r = d.caretRangeFromPoint(x, y);
        else if (d.caretPositionFromPoint && x !== undefined) { var p = d.caretPositionFromPoint(x, y); if (p) { r = d.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); } }
      } catch (e) {}
      if (r && el.contains(r.startContainer)) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
    }
    spjald.classList.remove('brr-saman'); d.body.classList.remove('brr-spjald-saman');
    teiknaSpjald();
    if (window.matchMedia('(max-width:700px)').matches) {          /* á síma: það sem valið var sést ofan við skúffuna */
      var b = (R.val.rammi || el).getBoundingClientRect(), laust = window.innerHeight * 0.54 - 70;
      if (b.top < 60 || b.top > laust) window.scrollBy({ top: b.top - Math.max(70, laust * 0.3), behavior: 'smooth' });
    }
  }
  function aOrdum(el, x, y) {            /* er smellurinn á sjálfum orðunum, eða á auða hluta reitsins? */
    var r = d.createRange();
    r.selectNodeContents(el);
    var b = r.getClientRects();
    for (var i = 0; i < b.length; i++) if (x >= b[i].left - 14 && x <= b[i].right + 14 && y >= b[i].top - 8 && y <= b[i].bottom + 8) return true;
    return false;
  }
  d.addEventListener('click', function (e) {
    if (!R.breyta || R.hamur === 'hled' || e.target.closest('.brr')) return;
    var el = e.target.closest('[data-e],[data-m]');
    if (el && el.closest('#vv-app')) el = null;
    /* textareitir í forsíðuhausnum ná yfir alla breidd hans: smellur utan við orðin á við bannerinn á bak við */
    if (el && el.hasAttribute('data-e') && !(R.val && R.val.el === el) && el.closest('[data-mr]') && !e.target.closest('a,button') && !aOrdum(el, e.clientX, e.clientY)) el = null;
    if (!el) {
      var hr = e.target.closest('[data-mr]');
      if (hr && !e.target.closest('a,button,input,select,textarea,#vv-app')) el = $('[data-m="' + hr.getAttribute('data-mr') + '"]');
    }
    var a = e.target.closest('a[href]');
    if (el) {
      if (a && (e.ctrlKey || e.metaKey)) return;                    /* Ctrl+smellur fylgir hlekknum eins og venjulega */
      e.preventDefault(); e.stopPropagation();
      velja(el, e.clientX, e.clientY);
    } else if (!e.target.closest('a,button,input,select,textarea,label,summary')) afvelja();
  }, true);
  d.addEventListener('keydown', function (e) {
    var iTexta = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if (e.key === 'Escape' && R.val && !e.target.closest('.brr-hula')) { afvelja(); return; }
    if ((e.ctrlKey || e.metaKey) && !iTexta) {
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); afturkalla(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); endurgera(); }
    }
    if (R.val && R.val.teg === 'e' && e.target === R.val.el && e.key === 'Enter') {       /* línuskil, ekki ný málsgrein */
      e.preventDefault();
      if (!d.execCommand('insertLineBreak')) d.execCommand('insertHTML', false, '<br>');
    }
  });
  d.addEventListener('paste', function (e) {
    if (!R.val || R.val.teg !== 'e' || e.target.closest('.brr') || !R.val.el.contains(e.target)) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    d.execCommand('insertText', false, t);
  });
  d.addEventListener('input', function (e) { if (R.val && R.val.teg === 'e' && e.target === R.val.el) geymaTexta(); });
  d.addEventListener('selectionchange', function () {
    if (!R.val || R.val.teg !== 'e') return;
    var s = window.getSelection();
    if (!s.rangeCount) return;
    var r = s.getRangeAt(0);
    if (!R.val.el.contains(r.commonAncestorContainer)) return;
    var adur = valRange && !valRange.collapsed;
    valRange = r.cloneRange();
    var nu = !valRange.collapsed;
    if (nu !== adur) { R.svid = nu ? 'val' : 'reit'; teiknaSpjald(); }
  });

  /* ---- texti ---- */
  function geymaTexta() {
    var v = R.val;
    if (!v || v.teg !== 'e') return;
    var html = E.hreinsaFyrir(v.el, v.el.innerHTML), frum = E.hreinsaFyrir(v.el, v.el._bhFrum), eins = html === frum;
    v.el._bhNu = eins ? v.el._bhFrum : html;
    breyta('t:' + v.k, function (efni) {
      var t = efni.t || (efni.t = {}), o = t[v.k] || (t[v.k] = {});
      if (eins) delete o.h; else o.h = html;
    });
  }
  function tStill(k, simi) { var o = (R.efni.t || {})[k] || {}; return (simi ? o.sm : o.s) || {}; }
  function setjaTStil(k, eig, gildi, simi) {
    breyta('ts:' + k + ':' + eig, function (efni) {
      var t = efni.t || (efni.t = {}), o = t[k] || (t[k] = {}), b = simi ? (o.sm || (o.sm = {})) : (o.s || (o.s = {}));
      if (gildi === '' || gildi === null || gildi === undefined || gildi === false) delete b[eig]; else b[eig] = gildi;
    });
  }
  /* stærðir og uppröðun eru sér fyrir síma; letur, litur og stíll gilda alls staðar */
  var SER_SIMI = { fs: 1, lh: 1, ls: 1, ta: 1 };
  function iSima(eig) { return R.simi && SER_SIMI[eig]; }
  function endurvekjaVal() {
    if (!valRange) return false;
    R.val.el.focus({ preventScroll: true });
    var s = window.getSelection();
    s.removeAllRanges(); s.addRange(valRange);
    return !valRange.collapsed;
  }
  function stillaVal(teg, gildi) {            /* snið á valda textann: verður að <span style> eða <b>, <i>, <u>, <a> í textanum */
    var el = R.val.el;
    if (!endurvekjaVal()) { skilabod('Veldu fyrst texta í reitnum'); return; }
    try { d.execCommand('styleWithCSS', false, teg === 'c' || teg === 'ff' || teg === 'fs'); } catch (e) {}
    if (teg === 'c') { if (gildi) d.execCommand('foreColor', false, gildi); else d.execCommand('removeFormat'); }
    else if (teg === 'ff') { E.hladaLetri(gildi); d.execCommand('fontName', false, gildi); }
    else if (teg === 'b') d.execCommand('bold');
    else if (teg === 'i') d.execCommand('italic');
    else if (teg === 'u') d.execCommand('underline');
    else if (teg === 'hreinsa') d.execCommand('removeFormat');
    else if (teg === 'hlekkur') { if (gildi) d.execCommand('createLink', false, gildi); else d.execCommand('unlink'); }
    else if (teg === 'fs') {
      d.execCommand('fontSize', false, '7');             /* merki sem vafrinn setur; því er svo breytt í rétta stærð */
      all('font[size="7"], span', el).forEach(function (x) {
        if (x.tagName === 'FONT') {
          var sp = d.createElement('span');
          while (x.firstChild) sp.appendChild(x.firstChild);
          sp.style.fontSize = gildi + '%';
          x.parentNode.replaceChild(sp, x);
        } else if (/xxx-large/.test(x.style.fontSize)) x.style.fontSize = gildi + '%';
      });
    }
    var s = window.getSelection();
    if (s.rangeCount) valRange = s.getRangeAt(0).cloneRange();
    geymaTexta();
  }
  function valStaerd() {            /* stærð valda textans núna, í % af textanum í kring */
    if (!valRange) return 100;
    var n = valRange.commonAncestorContainer;
    if (n.nodeType === 3) n = n.parentNode;
    while (n && n !== R.val.el) { var m = /^(\d+(?:\.\d+)?)%$/.exec(n.style ? n.style.fontSize : ''); if (m) return Math.round(Number(m[1])); n = n.parentNode; }
    return 100;
  }
  function hlekkurVals() {
    var n = valRange ? valRange.commonAncestorContainer : null;
    if (n && n.nodeType === 3) n = n.parentNode;
    var a = n && n.closest ? n.closest('a') : null;
    if (a && R.val.el.contains(a)) return a;
    return R.val.el.closest('a');
  }

  /* ---- litaval: 15 litir síðunnar, sérlitur af öllum litaskalanum, og hægt að bæta honum í valið ---- */
  function litir() { return Array.isArray(R.efni.litir) && R.efni.litir.length ? R.efni.litir.filter(E.litur).slice(0, 15) : E.litir.slice(0, 15); }
  function litaval(nuna, r, medEngum) {
    var l = litir(), ser = E.litur(nuna) && l.indexOf(E.litur(nuna)) < 0 ? E.litur(nuna) : null;
    return '<div class="brr-litir" role="group" aria-label="Litaval">' +
      (medEngum ? '<button type="button" class="brr-lit brr-enginn" data-r="' + r + '" data-v="" aria-label="Enginn litur, sjálfgefið" aria-pressed="' + (!nuna) + '"></button>' : '') +
      l.map(function (c) {
        return '<button type="button" class="brr-lit" style="background:' + c + '" data-r="' + (R.litaBreyting ? 'lit-ut' : r) + '" data-v="' + c + '" aria-label="' +
          (R.litaBreyting ? 'Taka ' + c + ' úr litavalinu' : 'Litur ' + c) + '" aria-pressed="' + (!R.litaBreyting && E.litur(nuna) === c) + '">' + (R.litaBreyting ? '<span class="brr-x" aria-hidden="true">×</span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="brr-serlitur"><input type="color" data-r="' + r + '-ser" value="' + ((ser || E.litur(nuna) || '#ff6702').slice(0, 7)) + '" aria-label="Velja annan lit">' +
      '<button type="button" class="brr-h" data-r="lit-baeta" data-fra="' + r + '-ser">Bæta í litavalið</button>' +
      '<button type="button" class="brr-h" data-r="lit-breyta" aria-pressed="' + R.litaBreyting + '">' + (R.litaBreyting ? 'Búið' : 'Breyta litavali') + '</button></div>' +
      (R.litaBreyting ? '<p class="brr-hint">Smelltu á lit til að taka hann úr litavalinu. Valið rúmar 15 liti. <button type="button" class="brr-h" data-r="lit-frum">Upprunalegt litaval</button></p>' : '');
  }
  function setjaLitaval(nytt) {
    breyta('litir', function (efni) {
      if (JSON.stringify(nytt) === JSON.stringify(E.litir.slice(0, 15))) delete efni.litir; else efni.litir = nytt;
    });
  }

  /* ---- myndir ---- */
  function mStill(k, simi) { var o = (R.efni.m || {})[k] || {}; return (simi ? o.sm : o) || {}; }
  function setjaM(k, eig, gildi, simi) {
    breyta('m:' + k + ':' + eig, function (efni) {
      var m = efni.m || (efni.m = {}), o = m[k] || (m[k] = {}), b = simi ? (o.sm || (o.sm = {})) : o;
      if (gildi === '' || gildi === null || gildi === undefined) delete b[eig]; else b[eig] = gildi;
    });
  }
  function frumSrc(el) { return el._bhFrum && el._bhFrum.src !== undefined ? el._bhFrum.src : el.getAttribute('src'); }
  function systkini(el) {            /* aðrar myndir á síðunni sem sýna sömu upprunalegu mynd (lógóið er víðar en á einum stað) */
    var src = frumSrc(el);
    return all('[data-m]').filter(function (x) { return x !== el && !x.closest('#vv-app') && !x.hasAttribute('data-hetja-mynd') && frumSrc(x) === src; });
  }
  function setjaMyndSrc(src, alls) {
    var v = R.val, lyklar = [v.k];
    if (alls) systkini(v.el).forEach(function (x) { lyklar.push(x.getAttribute('data-m')); });
    all('[data-m]').forEach(function (x) { if (x._bhFrum === undefined && lyklar.indexOf(x.getAttribute('data-m')) >= 0) x._bhFrum = { src: x.getAttribute('src') || '', w: x.getAttribute('width'), h: x.getAttribute('height') }; });
    breyta('msrc:' + v.k, function (efni) {
      var m = efni.m || (efni.m = {});
      lyklar.forEach(function (k) { var o = m[k] || (m[k] = {}); if (src) o.src = src; else delete o.src; });
    });
  }
  function setjaBanner(h) {
    var hero = $('[data-hetja]'), sjalf = hero ? hero._bhFrum || hero.getAttribute('data-hetja') : 'eldur';
    if (hero && hero._bhFrum === undefined) hero._bhFrum = hero.getAttribute('data-hetja');
    breyta('hetja', function (efni) { if (h.id === sjalf && h.id !== 'ser') delete efni.hetja; else efni.hetja = h; });      /* banner síðunnar sjálfrar þarf enga færslu */
  }
  function minnka(file, mest) {            /* myndin er minnkuð í vafranum áður en hún fer upp */
    return new Promise(function (ok, nei) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var s = Math.min(1, mest / Math.max(img.naturalWidth, img.naturalHeight));
        var c = d.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
        var x = c.getContext('2d'), png = file.type === 'image/png';
        if (!png) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(img, 0, 0, c.width, c.height);
        var teg = png ? 'image/png' : 'image/jpeg';
        c.toBlob(function (blob) {
          if (!blob) return nei(new Error('Gat ekki lesið myndina'));
          var les = new FileReader();
          les.onload = function () { ok({ blob: blob, gogn: les.result }); };
          les.onerror = function () { nei(new Error('Gat ekki lesið myndina')); };
          les.readAsDataURL(blob);
        }, teg, 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); nei(new Error('Gat ekki lesið myndina')); };
      img.src = url;
    });
  }
  function hladaUpp(file, mest) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { skilabod('Aðeins JPEG, PNG eða WebP myndir'); return Promise.reject(new Error('gerd')); }
    return minnka(file, mest).then(function (m) {
      if (R.hamur !== 'innskrad') { skilabod('Prufuhamur: myndin sést hér en vistast ekki'); return URL.createObjectURL(m.blob); }
      if (m.blob.size > 4 * 1024 * 1024) throw new Error('Myndin er of stór (mest 4 MB eftir minnkun)');
      $('[data-r="stada"]', bar).textContent = 'Hleð upp mynd…';
      return kalla({ adgerd: 'mynd', utgafa: U, gogn: m.gogn }).then(function (r) {
        if (r.status !== 200) throw new Error(r.j.villa || 'Upphleðsla mistókst');
        breyta(null, function (efni) { efni.myndasafn = [r.j.url].concat((efni.myndasafn || []).filter(function (u) { return u !== r.j.url; })).slice(0, 60); });
        return r.j.url;
      });
    }).catch(function (e) { if (e && e.message !== 'gerd') skilabod(e.message || 'Upphleðsla mistókst'); stada(); throw e; });
  }

  /* ---- spjaldið ---- */
  function kafli(titill, innihald) { return '<div class="brr-kafli">' + (titill ? '<h4>' + esc(titill) + '</h4>' : '') + innihald + '</div>'; }
  function renna(merki, r, gildi, min, max, skref, eining) {
    return '<label class="brr-rod"><span>' + esc(merki) + '</span><span class="brr-tala"><input type="range" data-r="' + r + '" min="' + min + '" max="' + max + '" step="' + skref + '" value="' + gildi +
      '"><output>' + gildi + (eining || '') + '</output></span></label>';
  }
  function hnappar(r, val, nuna) {
    return '<div class="brr-hnappar">' + val.map(function (v) { return '<button type="button" class="brr-h" data-r="' + r + '" data-v="' + esc(v[0]) + '" aria-pressed="' + (String(nuna) === String(v[0])) + '">' + v[1] + '</button>'; }).join('') + '</div>';
  }
  function leturVal(r, nuna, sjalf) {
    return '<select data-r="' + r + '" aria-label="Leturgerð"><option value="">' + esc(sjalf) + '</option>' + E.LETUR.map(function (f) {
      return '<option value="' + esc(f) + '"' + (f === nuna ? ' selected' : '') + ' style="font-family:\'' + esc(f) + '\',sans-serif">' + esc(f) + '</option>';
    }).join('') + '</select>';
  }
  function simaAth() { return R.simi ? '<p class="brr-ath">Þú ert í símasýn: stærð, línubil, stafabil og jöfnun sem þú breytir hér gilda aðeins á síma.</p>' : ''; }
  function spjaldTomt() {
    var prufa = '';
    if (R.hamur === 'prufa') {
      prufa = '<div class="brr-ath brr-gult"><strong>Prufuhamur.</strong> Þú getur prófað allt, en ekkert vistast og gestir sjá engar breytingar. ' +
        (R.astaeda === 'utskrad' ? 'Skráðu þig inn til að vista.<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h brr-blar" data-r="innskra">Skrá inn</button></div>'
          : R.astaeda === 'ovirkt' ? 'Vistun er ekki virk enn: lykilorð ritilsins hefur ekki verið sett á þjóninum.'
            : R.astaeda === 'stutt' ? 'Vistun er ekki virk: lykilorð ritilsins á þjóninum er of stutt (þarf minnst 16 stafi).'
            : R.astaeda === 'geymsla' ? 'Geymslan á þjóninum er ekki tilbúin enn.' : 'Ekki náðist samband við þjóninn.') + '</div>';
    }
    return prufa + kafli('', '<p style="margin:0 0 6px">Smelltu á það sem þú vilt breyta:</p><ul style="margin:0;padding-left:18px;line-height:1.7"><li><b>Texta</b>: skrifaðu beint í hann</li>' +
      '<li><b>Hluta af texta</b>: veldu orðin og breyttu letri, stærð eða lit</li><li><b>Mynd eða lógó</b>: skipta um, stækka eða minnka</li><li><b>Forsíðuhausinn</b>: velja banner og hæð</li></ul>' +
      '<div class="brr-hnappar" style="margin-top:10px">' + ($('[data-hetja-mynd]') ? '<button type="button" class="brr-h" data-r="velja-hetju">Breyta banner</button>' : '') +
      ($('header [data-m]') ? '<button type="button" class="brr-h" data-r="velja-logo">Breyta lógói</button>' : '') + '</div>' +
      '<p class="brr-hint">' + (R.hamur === 'innskrad' ? 'Allt vistast sjálfkrafa sem drög. Gestir sjá ekkert fyrr en þú ýtir á Birta.' : '') + ' Haltu Ctrl inni til að fylgja hlekk, eða notaðu síðuvalið neðst.</p>') +
      kafli('Litaval síðunnar', litaval(null, 'lit-skoda', false));
  }
  function spjaldTexti() {
    var v = R.val, cs = window.getComputedStyle(v.el), st = tStill(v.k, false), sm = tStill(v.k, true);
    function g(eig) { var b = iSima(eig) ? sm : st; return b[eig]; }
    var a = hlekkurVals(), h = '';
    h += kafli('Á við', hnappar('svid', [['val', 'Valinn texta'], ['reit', 'Allan reitinn']], R.svid) +
      (R.svid === 'val' ? '<p class="brr-hint">Sniðið fer aðeins á orðin sem þú valdir í textanum.</p>' : '<p class="brr-hint">Veldu orð í textanum til að breyta aðeins þeim.</p>'));
    if (R.svid === 'val') {
      h += kafli('Letur og stærð', leturVal('v-ff', '', 'Óbreytt letur') + renna('Stærð', 'v-fs', valStaerd(), 50, 300, 5, '%') +
        '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="v-b"><b>Feitletrað</b></button><button type="button" class="brr-h" data-r="v-i"><i>Skáletrað</i></button>' +
        '<button type="button" class="brr-h" data-r="v-u"><u>Undirstrikað</u></button><button type="button" class="brr-h" data-r="v-hreinsa">Hreinsa snið</button></div>');
      h += kafli('Litur', litaval(null, 'v-c', false));
      h += kafli('Hlekkur', '<input type="url" data-r="v-href" placeholder="https://… eða #hafa-samband" value="' + esc(a && R.val.el.contains(a) ? a.getAttribute('href') || '' : '') + '" aria-label="Slóð hlekks">' +
        '<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h" data-r="v-hlekkur">Setja hlekk</button><button type="button" class="brr-h" data-r="v-afhlekkja">Taka hlekk af</button></div>');
    } else {
      var fs = g('fs') !== undefined ? g('fs') : Math.round(parseFloat(cs.fontSize)), lh = g('lh') !== undefined ? g('lh') : (Math.round((parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)) * 20) / 20 || 1.5);
      h += simaAth();
      h += kafli('Letur', leturVal('t-ff', st.ff || '', 'Letur síðunnar') + renna('Stærð', 't-fs', fs, 10, 140, 1, ' px') +
        '<div class="brr-rod"><span>Þykkt</span>' + hnappar('t-fw', [['', 'Sjálfg.'], [400, '400'], [500, '500'], [600, '600'], [700, '700'], [800, '800']], st.fw === undefined ? '' : st.fw) + '</div>' +
        renna('Línubil', 't-lh', lh, 0.9, 2.4, 0.05, '') + renna('Stafabil', 't-ls', g('ls') !== undefined ? g('ls') : 0, -0.05, 0.25, 0.005, '') +
        '<div class="brr-rod"><span>Jöfnun</span>' + hnappar('t-ta', [['left', 'Vinstri'], ['center', 'Miðja'], ['right', 'Hægri']], g('ta') || '') + '</div>' +
        '<div class="brr-rod"><span>Stíll</span><div class="brr-hnappar"><button type="button" class="brr-h" data-r="t-it" aria-pressed="' + (st.it === true) + '"><i>Skáletur</i></button>' +
        '<button type="button" class="brr-h" data-r="t-tt" aria-pressed="' + (st.tt === 'uppercase') + '">HÁSTAFIR</button></div></div>');
      h += kafli('Litur', litaval(st.c || null, 't-c', true));
    }
    h += kafli('', '<div class="brr-hnappar">' + (a ? '<button type="button" class="brr-h" data-r="opna">Opna hlekkinn</button>' : '') + '<button type="button" class="brr-h brr-raudur" data-r="t-endurstilla">Endurstilla reitinn</button></div>');
    return h;
  }
  function myndasafn() {
    var sed = {}, l = [];
    function baeta(src, nafn) { if (src && !sed[src] && E.myndOk(src)) { sed[src] = 1; l.push([src, nafn]); } }
    (R.efni.myndasafn || []).forEach(function (u) { baeta(u, 'Hlaðið upp'); });
    all('[data-m]').forEach(function (x) { if (!x.closest('#vv-app')) baeta(frumSrc(x), ''); });
    E.BANNERAR.forEach(function (b) { baeta(b.mynd, b.heiti); });
    return l;
  }
  function spjaldMynd() {
    var v = R.val, o = mStill(v.k, false), sm = mStill(v.k, true), b = R.simi ? sm : o, h = '';
    function g(eig, sj) { return b[eig] !== undefined ? b[eig] : (o[eig] !== undefined ? o[eig] : sj); }
    if (v.hetja) {
      var nu = window.BH_HETJA ? window.BH_HETJA.nuna() : '', eh = R.efni.hetja || {};
      h += kafli('Banner í forsíðuhausnum', '<div class="brr-myndir">' + E.BANNERAR.map(function (x) {
        return '<button type="button" class="brr-mynd" data-r="banner" data-v="' + esc(x.id) + '" aria-pressed="' + (x.id === nu) + '"><img src="' + esc(x.mynd) + '" alt="" loading="lazy"><span>' + esc(x.heiti) + '</span></button>';
      }).join('') + '</div><div class="brr-hnappar" style="margin-top:10px"><label class="brr-h brr-blar">Hlaða upp eigin mynd<input type="file" accept="image/jpeg,image/png,image/webp" data-r="banner-skra" hidden></label></div>' +
        (eh.id === 'ser' ? '<label class="brr-rod" style="grid-template-columns:24px 1fr"><input type="checkbox" data-r="banner-ljos"' + (eh.ljos ? ' checked' : '') + '><span>Ljós mynd: þéttari slikja undir textanum</span></label>' : '') +
        '<p class="brr-hint">Textinn í hausnum þarf að sjást vel yfir myndinni. Sé myndin björt þar sem textinn er, hakaðu við „Ljós mynd“ eða veldu aðra staðsetningu.</p>');
    } else {
      var syst = systkini(v.el).length;
      h += kafli('Mynd', '<div class="brr-hnappar"><label class="brr-h brr-blar">Hlaða upp mynd<input type="file" accept="image/jpeg,image/png,image/webp" data-r="skra" hidden></label>' +
        (o.src ? '<button type="button" class="brr-h" data-r="src-frum">Upprunaleg mynd</button>' : '') + '</div>' +
        (syst ? '<label class="brr-rod" style="grid-template-columns:24px 1fr"><input type="checkbox" data-r="alls" checked><span>Nota á sömu mynd annars staðar á síðunni (' + syst + ')</span></label>' : ''));
      h += kafli('Myndasafn', '<div class="brr-myndir">' + myndasafn().map(function (x) {
        return '<button type="button" class="brr-mynd" data-r="safn" data-v="' + esc(x[0]) + '" aria-pressed="' + (v.el.getAttribute('src') === x[0]) + '"><img src="' + esc(x[0]) + '" alt="" loading="lazy">' + (x[1] ? '<span>' + esc(x[1]) + '</span>' : '') + '</button>';
      }).join('') + '</div>');
    }
    h += simaAth().replace('stærð, línubil, stafabil og jöfnun', 'hæð, aðdráttur og staðsetning');
    if (v.rammi) {
      var hh = g('h', Math.round(v.rammi.getBoundingClientRect().height));
      h += kafli('Hvernig myndin passar', hnappar('fit', [['contain', 'Heil mynd'], ['cover', 'Fylla ramma']], g('fit', 'cover')) +
        '<p class="brr-hint">Heil mynd sýnir alla myndina. Fylla ramma klippir myndina til svo hún fylli svæðið.</p>' +
        renna('Hæð svæðis', 'h', hh, 160, 1200, 5, ' px') + renna('Aðdráttur', 'z', g('z', 100), 100, 300, 5, '%'));
    } else {
      h += kafli('Stærð', renna('Hæð', 'h', g('h', Math.round(v.el.getBoundingClientRect().height)), 16, 240, 1, ' px'));
    }
    if (v.rammi) {
      var pos = g('pos', '');
      h += kafli('Staðsetning', '<div class="brr-stadir" role="group" aria-label="Staðsetning myndar">' + ['left top', 'top', 'right top', 'left', 'center', 'right', 'left bottom', 'bottom', 'right bottom'].map(function (p) {
        return '<button type="button" data-r="pos" data-v="' + p + '" aria-label="' + p + '" aria-pressed="' + (pos === p) + '"></button>';
      }).join('') + '</div>');
    }
    h += kafli('', '<div class="brr-hnappar"><button type="button" class="brr-h brr-raudur" data-r="m-endurstilla">' + (v.hetja ? 'Endurstilla hausinn' : 'Endurstilla myndina') + '</button></div>');
    return h;
  }
  function teiknaSpjald() {
    if (!spjald) return;
    var v = R.val, skrun = $('.brr-sp-efni', spjald) ? $('.brr-sp-efni', spjald).scrollTop : 0;
    var titill = !v ? 'Ritill' : v.teg === 'e' ? 'Texti' : v.hetja ? 'Forsíðuhaus' : 'Mynd';
    var virkt = d.activeElement && spjald.contains(d.activeElement) ? d.activeElement.getAttribute('data-r') : null;
    spjald.innerHTML = '<div class="brr-sp-haus"><h3>' + titill + (v ? '<small>' + esc(heiti(v.k)) + '</small>' : '') + '</h3>' +
      '<button type="button" class="brr-h brr-aseins-simi" data-r="saman" aria-label="Fela eða sýna stillingar">' + IKON.nidur + '</button>' +
      (v ? '<button type="button" class="brr-h" data-r="afvelja" aria-label="Loka">' + IKON.loka + '</button>' : '') + '</div>' +
      '<div class="brr-sp-efni">' + (R.hamur === 'hled' ? '<p class="brr-hint">Sæki efnið…</p>' : !v ? spjaldTomt() : v.teg === 'e' ? spjaldTexti() : spjaldMynd()) + '</div>';
    $('.brr-sp-efni', spjald).scrollTop = skrun;
    if (virkt) { var f = $('[data-r="' + virkt + '"]', spjald); if (f && f.tagName !== 'BUTTON') f.focus({ preventScroll: true }); }
  }
  var MRENNUR = { h: 1, z: 1 };
  function spjaldInntak(e) {            /* rennur: breytast jafnóðum */
    var t = e.target, r = t.getAttribute('data-r'), v = R.val;
    if (!r || t.type !== 'range' || !v) return;
    var n = Number(t.value), ut = t.parentNode.querySelector('output');
    if (ut) ut.textContent = ut.textContent.replace(/^-?[\d.]+/, t.value);
    if (r === 't-fs' || r === 't-lh' || r === 't-ls') { var eig = r.slice(2); setjaTStil(v.k, eig, n, iSima(eig)); }
    else if (MRENNUR[r]) setjaM(v.k, r, r === 'z' && n <= 100 ? null : n, R.simi);
  }
  function spjaldBreyting(e) {
    var t = e.target, r = t.getAttribute('data-r'), v = R.val;
    if (!r) return;
    if (r === 't-ff' && v) { if (t.value) E.hladaLetri(t.value); setjaTStil(v.k, 'ff', t.value, false); }
    else if (r === 'v-ff' && v) { if (t.value) stillaVal('ff', t.value); t.value = ''; }
    else if (r === 'v-fs' && v) stillaVal('fs', Number(t.value));
    else if (r === 't-c-ser' && v) setjaTStil(v.k, 'c', t.value, false);
    else if (r === 'v-c-ser' && v) stillaVal('c', t.value);
    else if (r === 'banner-ljos') { var eh = afrit(R.efni.hetja); eh.ljos = t.checked; setjaBanner(eh); }
    else if ((r === 'skra' || r === 'banner-skra') && t.files && t.files[0] && v) {
      var skra = t.files[0], alls = $('[data-r="alls"]', spjald);
      hladaUpp(skra, r === 'skra' ? 1400 : 2400).then(function (url) {
        if (r === 'skra') setjaMyndSrc(url, !!(alls && alls.checked)); else setjaBanner({ id: 'ser', mynd: url, pos: 'center', ljos: false });
        stada(); teiknaSpjald();
      }).catch(function () {});
    }
  }
  function spjaldSmellur(e) {
    var b = e.target.closest('[data-r]');
    if (!b || /^(INPUT|SELECT|TEXTAREA|LABEL)$/.test(b.tagName)) return;
    var r = b.getAttribute('data-r'), g = b.getAttribute('data-v'), v = R.val, l;
    if (r === 'afvelja') return afvelja();
    if (r === 'saman') { spjald.classList.toggle('brr-saman'); d.body.classList.toggle('brr-spjald-saman', spjald.classList.contains('brr-saman')); return; }
    if (r === 'innskra') return gluggiInnskraning();
    if (r === 'lit-breyta') { R.litaBreyting = !R.litaBreyting; return teiknaSpjald(); }
    if (r === 'lit-frum') { setjaLitaval(E.litir.slice(0, 15)); return teiknaSpjald(); }
    if (r === 'lit-ut') { l = litir().filter(function (c) { return c !== g; }); if (l.length) setjaLitaval(l); return teiknaSpjald(); }
    if (r === 'lit-baeta') {
      var c = E.litur(($('[data-r="' + b.getAttribute('data-fra') + '"]', spjald) || {}).value);
      l = litir();
      if (!c) return;
      if (l.indexOf(c) >= 0) skilabod('Liturinn er þegar í litavalinu');
      else if (l.length >= 15) skilabod('Litavalið er fullt (15 litir). Taktu einn út fyrst með „Breyta litavali“.');
      else { setjaLitaval(l.concat(c)); skilabod('Litnum var bætt í litavalið'); }
      return teiknaSpjald();
    }
    if (r === 'lit-skoda') return;
    if (r === 'velja-hetju' || r === 'velja-logo') {
      var mark = $(r === 'velja-hetju' ? '[data-hetja-mynd]' : 'header [data-m]');
      if (!mark) return;
      if (!mark.getClientRects().length) location.hash = '#top';            /* forsíðan er ekki opin */
      window.scrollTo(0, 0);
      setTimeout(function () { velja(mark); }, 60);
      return;
    }
    if (!v) return;
    if (r === 'svid') { R.svid = g; if (g === 'val' && !(valRange && !valRange.collapsed)) skilabod('Veldu orð í textanum á síðunni'); return teiknaSpjald(); }
    if (r === 't-c') setjaTStil(v.k, 'c', g, false);
    else if (r === 't-fw') setjaTStil(v.k, 'fw', g === '' ? null : Number(g), false);
    else if (r === 't-ta') setjaTStil(v.k, 'ta', tStill(v.k, iSima('ta')).ta === g ? null : g, iSima('ta'));
    else if (r === 't-it') setjaTStil(v.k, 'it', tStill(v.k, false).it === true ? null : true, false);
    else if (r === 't-tt') setjaTStil(v.k, 'tt', tStill(v.k, false).tt === 'uppercase' ? null : 'uppercase', false);
    else if (r === 'v-c') stillaVal('c', g);
    else if (r === 'v-b' || r === 'v-i' || r === 'v-u' || r === 'v-hreinsa') stillaVal(r.slice(2));
    else if (r === 'v-hlekkur') { var h = E.slod($('[data-r="v-href"]', spjald).value); if (h) stillaVal('hlekkur', h); else skilabod('Slóðin þarf að byrja á https://, #, tel: eða mailto:'); }
    else if (r === 'v-afhlekkja') stillaVal('hlekkur', '');
    else if (r === 'opna') { var a = hlekkurVals(); if (a) { var href = a.getAttribute('href') || ''; afvelja(); if (href.charAt(0) === '#') location.hash = href; else window.open(href, '_blank', 'noopener'); } return; }
    else if (r === 't-endurstilla') { var k = v.k; afvelja(); breyta(null, function (efni) { if (efni.t) delete efni.t[k]; }); return; }
    else if (r === 'banner') setjaBanner({ id: g });
    else if (r === 'safn') setjaMyndSrc(g, !!($('[data-r="alls"]', spjald) || {}).checked);
    else if (r === 'src-frum') setjaMyndSrc('', !!($('[data-r="alls"]', spjald) || {}).checked);
    else if (r === 'fit') setjaM(v.k, 'fit', g, R.simi);
    else if (r === 'pos') setjaM(v.k, 'pos', mStill(v.k, R.simi).pos === g ? null : g, R.simi);
    else if (r === 'm-endurstilla') { var hetja = v.hetja; breyta(null, function (efni) { if (efni.m) delete efni.m[v.k]; if (hetja) delete efni.hetja; }); }
    teiknaSpjald();
  }

  /* ---- aðgerðir: forskoðun, birting, saga, breytingar sem texti, innskráning ---- */
  function forskoda(a) {
    afvelja();
    R.breyta = !a;
    d.body.classList.toggle('brr-forskoda', a); d.body.classList.toggle('brr-breyta', !a);
    all('.brr-forskodun').forEach(function (x) { x.remove(); });
    if (a) {
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'brr brr-b brr-adal brr-forskodun'; b.textContent = 'Hætta forskoðun';
      b.addEventListener('click', function () { forskoda(false); });
      d.body.appendChild(b);
    }
  }
  function valmynd() {
    var til = $('.brr-valmynd');
    if (til) return til.remove();
    var m = d.createElement('div');
    m.className = 'brr brr-valmynd'; m.setAttribute('role', 'menu');
    var inn = R.hamur === 'innskrad';
    m.innerHTML = '<button type="button" role="menuitem" data-r="forskoda">Forskoða án ritils</button>' +
      '<button type="button" role="menuitem" data-r="gestur">Opna eins og gestur sér hana</button>' +
      (inn ? '<button type="button" role="menuitem" data-r="saga">Útgáfusaga…</button>' : '') +
      '<button type="button" role="menuitem" data-r="henda">Henda óbirtum breytingum</button>' +
      '<button type="button" role="menuitem" data-r="json">Breytingar sem texti…</button>' +
      (inn ? '<button type="button" role="menuitem" data-r="utskra">Skrá út</button>' : R.astaeda === 'utskrad' ? '<button type="button" role="menuitem" data-r="innskra">Skrá inn</button>' : '');
    d.body.appendChild(m);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b) return;
      var r = b.getAttribute('data-r');
      m.remove();
      if (r === 'forskoda') forskoda(true);
      else if (r === 'gestur') window.open(slodMed({ ritill: null, rammi: null, simi: null }), '_blank', 'noopener');
      else if (r === 'saga') gluggiSaga();
      else if (r === 'henda') spyrja('Henda óbirtum breytingum?', 'Drögin verða aftur eins og síðan er hjá gestum núna.', 'Henda', henda, true);
      else if (r === 'json') gluggiJson();
      else if (r === 'utskra') utskra();
      else if (r === 'innskra') gluggiInnskraning();
    });
    setTimeout(function () {
      d.addEventListener('click', function loka(e) { if (!m.contains(e.target)) { m.remove(); d.removeEventListener('click', loka, true); } }, true);
    }, 0);
  }
  function henda() {
    afvelja();
    if (R.hamur !== 'innskrad') {
      try { sessionStorage.removeItem(SS_PRUFA); } catch (e) {}
      R.efni = afrit(R.birt); R.saga = []; R.fram = []; R.obirt = false;
      E.beita(R.efni); stada(); teiknaSpjald();
      return;
    }
    kalla({ adgerd: 'henda', utgafa: U }).then(function (r) {
      if (r.status !== 200) return skilabod('Mistókst: ' + (r.j.villa || r.status));
      R.efni = r.j.efni || {}; R.grunnur = r.j.grunnur; R.saga = []; R.fram = []; R.ovistad = false; R.obirt = false; R.vistadKl = null;
      E.beita(R.efni); stada(); teiknaSpjald();
      skilabod('Drögin eru aftur eins og birta útgáfan');
    });
  }
  function birta() {
    if (R.hamur !== 'innskrad') {
      gluggi('<h3>Birting er ekki í boði í prufuham</h3><p>' + (R.astaeda === 'utskrad' ? 'Skráðu þig inn með lykilorði ritilsins til að vista og birta breytingar.'
        : R.astaeda === 'ovirkt' || R.astaeda === 'stutt' ? 'Vistun hefur ekki verið virkjuð: lykilorð ritilsins (VEFUR_RITILL_LYKILORD, minnst 16 stafir) hefur ekki verið sett á þjóninum. Þangað til er hægt að prófa ritilinn, en ekkert vistast.'
          : 'Ekki náðist í geymsluna á þjóninum.') + '</p><div class="brr-hnappar">' +
        (R.astaeda === 'utskrad' ? '<button type="button" class="brr-h brr-blar" data-r="inn">Skrá inn</button>' : '') + '<button type="button" class="brr-h" data-r="haetta">Loka</button></div>')
        .addEventListener('click', function (e) { if (e.target.closest('[data-r="inn"]')) { this.remove(); gluggiInnskraning(); } });
      return;
    }
    afvelja();
    spyrja('Birta breytingarnar?', 'Drögin fara í loftið og gestir sjá þau á öllum tækjum innan mínútu.', 'Birta', function () {
      vista().then(function () {
        if (R.ovistad) return skilabod('Vistun mistókst, ekkert var birt');
        return kalla({ adgerd: 'birta', utgafa: U }).then(function (r) {
          if (r.status !== 200) return skilabod('Mistókst: ' + (r.j.villa || r.status));
          R.obirt = false; R.birt = afrit(R.efni); R.birtNr = r.j.birt_nr; R.vistadKl = null;
          try { localStorage.setItem('bh_efni_' + U, JSON.stringify({ nr: R.birtNr, efni: R.birt, kl: Date.now() })); } catch (e) {}      /* þessi vafri sér nýju útgáfuna strax */
          stada();
          skilabod('Breytingarnar eru komnar í loftið (útgáfa ' + R.birtNr + ')');
        });
      });
    });
  }
  function gluggiSaga() {
    saekja('&saga=1').then(function (r) {
      var l = (r.j && r.j.saga) || [];
      var g = gluggi('<h3>Útgáfusaga</h3>' + (l.length ? '<p>Smelltu á útgáfu til að setja hana í drögin. Hún fer ekki í loftið fyrr en þú birtir.</p><ul class="brr-saga">' + l.map(function (x) {
        return '<li><button type="button" data-id="' + esc(x.id) + '" data-nr="' + esc(x.nr) + '"><span>Útgáfa ' + esc(x.nr) + '</span><span>' + esc(dags(x.kl)) + (x.af ? ' · ' + esc(x.af) : '') + '</span></button></li>';
      }).join('') + '</ul>' : '<p>Engin útgáfa hefur verið birt ennþá.</p>') + '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="haetta">Loka</button></div>');
      g.addEventListener('click', function (e) {
        var b = e.target.closest('[data-id]');
        if (!b) return;
        g.remove();
        kalla({ adgerd: 'endurheimta', utgafa: U, id: Number(b.getAttribute('data-id')) }).then(function (x) {
          if (x.status !== 200) return skilabod('Mistókst: ' + (x.j.villa || x.status));
          afvelja();
          R.saga.push(JSON.stringify(R.efni)); R.fram = [];
          R.efni = x.j.efni || {}; R.grunnur = x.j.grunnur; R.ovistad = false; R.obirt = true;
          E.beita(R.efni); stada(); teiknaSpjald();
          skilabod('Útgáfa ' + b.getAttribute('data-nr') + ' er komin í drögin');
        });
      });
    });
  }
  function allirTextar() {
    var ut = {};
    all('[data-e]').forEach(function (x) { if (!x.closest('#vv-app')) ut[x.getAttribute('data-e')] = x.textContent.replace(/\s+/g, ' ').trim(); });
    return ut;
  }
  function gluggiJson() {
    afvelja();
    var g = gluggi('<h3>Breytingar sem texti</h3><p>Þetta eru allar breytingar ritilsins á þessari útgáfu, sem JSON. Hægt er að afrita textann, laga hann (til dæmis með hjálp Claude) og setja hann inn aftur. ' +
      'Sniðið: <code>t</code> eru textar, <code>m</code> myndir, <code>hetja</code> bannerinn og <code>litir</code> litavalið.</p>' +
      '<textarea data-r="json" spellcheck="false" aria-label="Breytingar sem JSON"></textarea><p class="brr-villa" data-r="jvilla" hidden></p>' +
      '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="lyklar">Sækja lista yfir alla texta</button><button type="button" class="brr-h" data-r="afrita">Afrita</button>' +
      '<button type="button" class="brr-h" data-r="haetta">Loka</button><button type="button" class="brr-h brr-blar" data-r="setja">Setja inn</button></div>', true);
    var ta = $('textarea', g), villa = $('[data-r="jvilla"]', g);
    ta.value = JSON.stringify(R.efni, null, 1);
    g.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b) return;
      var r = b.getAttribute('data-r');
      if (r === 'afrita') {
        ta.select();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { skilabod('Afritað'); }, function () { d.execCommand('copy'); });
        else d.execCommand('copy');
      } else if (r === 'lyklar') {
        var bl = new Blob([JSON.stringify({ utgafa: U, skyring: 'Lykill hvers texta á síðunni og textinn eins og hann er núna. Nýr texti fer í t["<lykill>"] = {"h": "…"} í breytingunum.', textar: allirTextar() }, null, 1)], { type: 'application/json' });
        var a = d.createElement('a');
        a.href = URL.createObjectURL(bl); a.download = 'textar-' + U + '.json';
        d.body.appendChild(a); a.click(); a.remove();
      } else if (r === 'setja') {
        var nytt;
        try { nytt = JSON.parse(ta.value); } catch (x) { villa.hidden = false; villa.textContent = 'Þetta er ekki gilt JSON: ' + x.message; return; }
        if (!nytt || typeof nytt !== 'object' || Array.isArray(nytt)) { villa.hidden = false; villa.textContent = 'Efnið þarf að vera einn hlutur: { "t": {…}, "m": {…} }'; return; }
        var othekkt = Object.keys(nytt).filter(function (k) { return ['t', 'm', 'hetja', 'litir', 'myndasafn'].indexOf(k) < 0; });
        if (othekkt.length) { villa.hidden = false; villa.textContent = 'Óþekktur hluti: ' + othekkt.join(', '); return; }
        g.remove();
        setjaAllt(nytt, true);
        skilabod('Breytingarnar voru settar inn sem drög');
      }
    });
  }
  function gluggiInnskraning() {
    var nafn = '';
    try { nafn = localStorage.getItem(LS_NAFN) || ''; } catch (e) {}
    var g = gluggi('<h3>Innskráning í ritilinn</h3><p>Með innskráningu vistast breytingarnar á þjóninum og hægt er að birta þær.</p>' +
      '<form><label for="brr-nafn">Nafn</label><input type="text" id="brr-nafn" autocomplete="name" value="' + esc(nafn) + '">' +
      '<label for="brr-lykilord">Lykilorð ritilsins</label><input type="password" id="brr-lykilord" autocomplete="current-password">' +
      '<p class="brr-villa" data-r="villa" hidden></p><div class="brr-hnappar"><button type="button" class="brr-h" data-r="haetta">Skoða án innskráningar</button>' +
      '<button type="submit" class="brr-h brr-blar">Skrá inn</button></div></form>');
    $('form', g).addEventListener('submit', function (e) {
      e.preventDefault();
      var villa = $('[data-r="villa"]', g), n = $('#brr-nafn', g).value.trim();
      kalla({ adgerd: 'innskra', lykilord: $('#brr-lykilord', g).value, nafn: n }).then(function (r) {
        if (r.status !== 200) { villa.hidden = false; villa.textContent = r.status === 503 ? 'Vistun er ekki virk: lykilorð ritilsins hefur ekki verið sett á þjóninum.' : (r.j.villa || 'Innskráning mistókst'); return; }
        R.tok = r.j.tok;
        try { localStorage.setItem(LS_TOK, R.tok); if (n) localStorage.setItem(LS_NAFN, n); } catch (x) {}
        g.remove();
        var prufa = R.hamur === 'prufa' ? JSON.stringify(R.efni) : null;
        saekja('&drog=1').then(function (x) {
          if (x.status !== 200) return skilabod('Drögin náðust ekki');
          afvelja();
          innskrad(x.j);
          if (prufa && prufa !== JSON.stringify(R.efni) && prufa !== JSON.stringify(R.birt)) {
            spyrja('Nota breytingarnar úr prufuhamnum?', 'Þú gerðir breytingar áður en þú skráðir þig inn. Á að setja þær í drögin?', 'Nota þær', function () { setjaAllt(JSON.parse(prufa), true); });
          }
          try { sessionStorage.removeItem(SS_PRUFA); } catch (y) {}
        });
      });
    });
  }
  function utskra() {
    R.tok = null;
    try { localStorage.removeItem(LS_TOK); } catch (e) {}
    afvelja();
    R.hamur = 'prufa'; R.astaeda = 'utskrad'; R.ovistad = false;
    stada(); teiknaSpjald();
  }
  function innskrad(j) {
    R.hamur = 'innskrad'; R.villa = '';
    R.efni = j.efni || {}; R.grunnur = j.grunnur; R.nafn = j.nafn || ''; R.birtNr = j.birt_nr || 0; R.obirt = !!j.obirt; R.ovistad = false; R.saga = []; R.fram = [];
    E.beita(R.efni); stada(); teiknaSpjald();
  }
  function prufa(astaeda, bjoda) {
    R.hamur = 'prufa'; R.astaeda = astaeda;
    var g = null;
    try { g = JSON.parse(sessionStorage.getItem(SS_PRUFA) || 'null'); } catch (e) {}
    R.efni = g && typeof g === 'object' ? g : afrit(R.birt);
    E.beita(R.efni); stada(); teiknaSpjald();
    if (bjoda && !IRAMMA) gluggiInnskraning();
  }

  /* ---- ræsing ---- */
  window.addEventListener('pagehide', function () {
    if (R.hamur === 'innskrad' && R.ovistad) {
      try { fetch(API, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'x-ritill-tok': R.tok || '' }, body: JSON.stringify({ adgerd: 'vista', utgafa: U, efni: R.efni, grunnur: R.grunnur }) }); } catch (e) {}
    }
  });
  window.matchMedia(E.simi).addEventListener('change', function (e) { R.simi = e.matches; teiknaSpjald(); });
  try { R.tok = localStorage.getItem(LS_TOK) || null; } catch (e) {}
  teiknaKrom(); stada(); teiknaSpjald();
  saekja('').then(function (p) {
    R.birt = (p.j && p.j.efni) || {}; R.birtNr = (p.j && p.j.nr) || 0;
    return saekja('&drog=1');
  }).then(function (r) {
    if (r.status === 200) return innskrad(r.j);
    if (r.status === 401) { R.tok = null; try { localStorage.removeItem(LS_TOK); } catch (e) {} return prufa('utskrad', true); }
    return prufa(r.status === 503 ? (r.j.astaeda === 'stutt' ? 'stutt' : 'ovirkt') : 'geymsla', false);
  }).catch(function () { prufa('samband', false); });
})();
