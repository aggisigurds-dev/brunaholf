/* Ritill síðunnar. site/efni.js hleður þessari skrá þegar slóðin ber ?ritill.
   Smellt er á texta, mynd, lógó eða forsíðuhausinn á síðunni sjálfri og honum breytt í spjaldinu. Breytingarnar eru efni
   (sjá sniðið efst í site/efni.js), ekki kóði: þær vistast sem drög á þjóninum og fara til gesta þegar ýtt er á Birta.
   - Innskráning: notendaskrá starfsmanna (sama notandanafn og lykilorð og í stjórnstöðinni og Slökkvitæki-appinu), gegnum
     /api/hub-adgangar sem setur cookie. Aðeins Admin má breyta vefnum. Án innskráningar er ritillinn í prufuham: allt
     virkar á skjánum, en ekkert vistast á þjóninum.
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
  var LS_NN = 'bh_ritill_nn', SS_PRUFA = 'bh_ritill_prufa_' + U;
  var INN = API.replace(/[^\/]*$/, 'hub-adgangar');      /* innskráning starfsmanna, á sama vef og fallið */

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
    efni: {}, birt: {}, birtNr: 0, grunnur: null, nafn: '', hamur: 'hled', astaeda: '', villa: '',
    itarlegt: false, spj: null, takn: null,      /* ítarlegi hamurinn, sérspjald (útlit síðunnar) og táknið sem er opið þar */
    val: null, svid: 'reit', saga: [], fram: [], sLykill: null, sTimi: 0, ovistad: false, obirt: false, vistar: false, timi: null, breyta: true,
    simi: window.matchMedia(E.simi).matches, litaBreyting: false
  };
  var bar, spjald, valRange = null;

  /* ---- samskipti við þjóninn ---- */
  function svarJson(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; }); }
  /* innskráningin er cookie á þessum vef: hún fylgir beiðnum á sama uppruna. Hausinn x-ritill segir að beiðnin komi frá síðunni. */
  var HAUSAR = { 'Content-Type': 'application/json', 'x-ritill': '1' };
  function kalla(body) {
    return fetch(API, { method: 'POST', credentials: 'same-origin', headers: HAUSAR, body: JSON.stringify(body) }).then(svarJson);
  }
  function saekja(auka) {      /* birt efni (ekkert auka) er sótt án cookie, eins og gestir sækja það */
    return fetch(API + '?utgafa=' + encodeURIComponent(U) + (auka || ''), auka ? { credentials: 'same-origin', cache: 'no-store' } : { credentials: 'omit' }).then(svarJson);
  }
  function innskraning(body) {
    return fetch(INN, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(svarJson);
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
    Object.keys(efni).forEach(function (h) { if (efni[h] === null) delete efni[h]; });
    ['t', 'm', 'k'].forEach(function (h) {
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
    if (efni.rod) { Object.keys(efni.rod).forEach(function (k) { if (!Array.isArray(efni.rod[k]) || !efni.rod[k].length) delete efni.rod[k]; }); if (tomt(efni.rod)) delete efni.rod; }
    if (efni.utlit && tomt(efni.utlit)) delete efni.utlit;
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
      else if (r.status === 401 || r.status === 403) lokid(r.status === 403);
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
    d.documentElement.classList.add('brr-syna-falid');            /* falin stök sjást dauf í ritlinum, svo hægt sé að velja þau */
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
    var teg = el.hasAttribute('data-e') ? 'e' : el.hasAttribute('data-m') ? 'm' : 'k', k = el.getAttribute(teg === 'e' ? 'data-e' : teg === 'm' ? 'data-m' : 'data-k');
    R.spj = null;
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
    if (!el) {      /* autt svæði: kaflinn (einfalt) eða innsta svæðið (ítarlegt) */
      var sv = e.target.closest('[data-k]'), virkt = e.target.closest('a,button,input,select,textarea,label,summary');
      if (sv && !sv.closest('#vv-app')) {
        if (!virkt) el = R.itarlegt ? sv : kafliAf(sv);
        else if (R.itarlegt && virkt.contains(sv)) el = sv;         /* hnappur eða flís sem er sjálf svæði */
      }
    }
    var a = e.target.closest('a[href],button');
    if (el) {
      if (a && (e.ctrlKey || e.metaKey)) return;                    /* Ctrl+smellur fylgir hlekknum eða ýtir á hnappinn eins og venjulega */
      e.preventDefault(); e.stopPropagation();
      velja(el, e.clientX, e.clientY);
    } else if (!e.target.closest('a,button,input,select,textarea,label,summary')) afvelja();
  }, true);
  d.addEventListener('keydown', function (e) {
    var iTexta = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if (e.key === 'Escape' && R.val && !e.target.closest('.brr-hula')) { afvelja(); return; }
    if (e.key === 'Escape' && !R.val && R.spj && !e.target.closest('.brr-hula')) { R.spj = null; R.takn = null; teiknaSpjald(); return; }
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
  /* stílar texta (h = 't') og svæða (h = 'k') eru geymdir eins: s gildir alls staðar, sm á síma */
  function stillAf(h, k, simi) { var o = (R.efni[h] || {})[k] || {}; return (simi ? o.sm : o.s) || {}; }
  function setjaStil(h, k, eig, gildi, simi) {
    breyta(h + 's:' + k + ':' + eig, function (efni) {
      var t = efni[h] || (efni[h] = {}), o = t[k] || (t[k] = {}), b = simi ? (o.sm || (o.sm = {})) : (o.s || (o.s = {}));
      if (gildi === '' || gildi === null || gildi === undefined || gildi === false) delete b[eig]; else b[eig] = gildi;
    });
  }
  function tStill(k, simi) { return stillAf('t', k, simi); }
  function setjaTStil(k, eig, gildi, simi) { setjaStil('t', k, eig, gildi, simi); }
  function hvar(v) { return v.teg === 'e' ? 't' : 'k'; }
  /* stærðir, bil og uppröðun eru sér fyrir síma; letur, litir, horn og rammar gilda alls staðar */
  var SER_SIMI = { fs: 1, lh: 1, ls: 1, ta: 1, pt: 1, pb: 1, pl: 1, pr: 1, mt: 1, mb: 1, mw: 1, h: 1, gap: 1, dal: 1, jf: 1, fal: 1 };
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

  /* ---- hamir: Einfalt (texti, myndir, kaflar, grunnlitir) og Ítarlegt (allar stillingar; þar getur Claude hjálpað) ----
     Hamurinn stendur í slóðinni (?ritill&hamur=itarlegt), svo hann helst við endurhleðslu og í símasýn og hægt er að senda
     hlekk beint í ítarlega ritilinn. Án hans opnast ritillinn í einfalda hamnum. */
  R.itarlegt = q.get('hamur') === 'itarlegt';
  d.documentElement.classList.toggle('brr-itarlegt', R.itarlegt);
  function setjaHam(itarlegt) {
    R.itarlegt = !!itarlegt;
    try { history.replaceState(history.state, '', slodMed({ hamur: R.itarlegt ? 'itarlegt' : null })); } catch (e) {}
    d.documentElement.classList.toggle('brr-itarlegt', R.itarlegt);
    if (!R.itarlegt && R.val && R.val.teg === 'k' && !erKafli(R.val.el)) { var kf = kafliAf(R.val.el); if (kf) velja(kf); else afvelja(); }
    teiknaSpjald();
  }
  function hamHnappar() {
    return '<div class="brr-hamur" role="group" aria-label="Hamur ritilsins">' + hnappar('hamur', [['0', 'Einfalt'], ['1', 'Ítarlegt']], R.itarlegt ? '1' : '0') + '</div>';
  }
  function opnaSpjald() { spjald.classList.remove('brr-saman'); d.body.classList.remove('brr-spjald-saman'); }

  /* ---- svæði (data-k): kaflar, spjöld, listar, atriði, hnappar ---- */
  var NOFN = { SECTION: 'Kafli', HEADER: 'Haus', FOOTER: 'Fótur', NAV: 'Valmynd', MAIN: 'Meginmál', UL: 'Listi', OL: 'Listi', DL: 'Listi', LI: 'Atriði', A: 'Hnappur', BUTTON: 'Hnappur',
    SPAN: 'Tákn', DIV: 'Svæði', ARTICLE: 'Grein', ASIDE: 'Hliðarefni', FIGURE: 'Mynd', FORM: 'Form' };
  function nafnSvaedis(el) {
    var n = NOFN[el.nodeName] || 'Svæði', f = el.nodeName === 'MAIN' ? null : el.querySelector('h1,h2,h3,h4');
    var t = f ? f.textContent : (/^(LI|A|BUTTON)$/.test(el.nodeName) ? el.textContent : '');
    t = String(t || '').replace(/\s+/g, ' ').trim();
    return n + (t ? ' · ' + (t.length > 26 ? t.slice(0, 25) + '…' : t) : '');
  }
  function lykludBorn(p) { return Array.prototype.filter.call(p.children, function (c) { return c.hasAttribute('data-k'); }); }
  function erKafli(x) {             /* kafli: það sem einfaldi hamurinn velur í heild */
    if (!x.hasAttribute('data-k')) return false;
    var n = x.nodeName;
    return n === 'SECTION' || n === 'FOOTER' || (n === 'HEADER' && !x.closest('section')) || (n === 'NAV' && !x.closest('header,footer')) || (!!x.parentNode && x.parentNode.nodeName === 'MAIN');
  }
  function kafliAf(el) {
    for (var x = el; x && x.nodeType === 1 && x !== d.body; x = x.parentNode) if (!x.closest('#vv-app') && erKafli(x)) return x;
    return null;
  }
  function svaediYfir(el) {         /* svæðin sem stakið stendur í, yst fyrst */
    var l = [];
    for (var x = el.parentNode; x && x.nodeType === 1 && x !== d.body; x = x.parentNode) if (x.hasAttribute('data-k') && !x.closest('#vv-app')) l.unshift(x);
    return l;
  }
  function systkinSvaedis(el) {     /* lykluð systkini í röð síðunnar, og svæðið sem þau standa í */
    var p = el.parentNode;
    if (!p || !p.hasAttribute || !p.hasAttribute('data-k')) return null;
    var born = lykludBorn(p);
    return born.length > 1 ? { p: p, pk: p.getAttribute('data-k'), born: born } : null;
  }
  function faera(el, skref) {
    var s = systkinSvaedis(el);
    if (!s) return;
    var l = s.born.map(function (c) { return c.getAttribute('data-k'); }), i = l.indexOf(el.getAttribute('data-k')), j = i + skref;
    if (j < 0 || j >= l.length) return;
    l.splice(j, 0, l.splice(i, 1)[0]);
    var frum = s.p._bhRod || null;
    breyta(null, function (efni) {
      var r = efni.rod || (efni.rod = {});
      if (frum && frum.join('|') === l.join('|')) delete r[s.pk]; else r[s.pk] = l;
    });
    teiknaSpjald();
    try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }
  function veljaLykil(eig, k) {     /* velja stak eftir lykli; sé það á annarri síðu er hún opnuð fyrst */
    var el = E.lykillOk(k) && /^data-[ekm]$/.test(eig) ? $('[' + eig + '="' + k + '"]') : null;
    if (!el || el.closest('#vv-app')) { skilabod('Stakið fannst ekki á síðunni'); return false; }
    if (el.getClientRects().length) { velja(el); return true; }
    var syn = el.closest('#heim,#brunasyn,#verslunarsyn');
    afvelja();
    location.hash = syn && syn.id === 'brunasyn' ? '#brunathettingar' : syn && syn.id === 'verslunarsyn' ? '#verslun' : '#top';
    setTimeout(function () { if (el.getClientRects().length) velja(el); else skilabod('Stakið sést ekki á þessari skjástærð'); }, 120);
    return true;
  }
  function slodHtml(v) {            /* leiðin að stakinu: svæðin utan um það, og í ítarlega hamnum það sem er inni í svæði */
    function hn(x) { return '<button type="button" class="brr-h" data-r="velja-k" data-v="' + esc(x.getAttribute('data-k')) + '">' + esc(nafnSvaedis(x)) + '</button>'; }
    if (!R.itarlegt) {
      var kf = v.teg === 'k' ? null : kafliAf(v.el);
      return kf ? '<div class="brr-slod"><span>Stendur í:</span>' + hn(kf) + '</div>' : '';
    }
    var l = svaediYfir(v.el).slice(-4), ut = '<p class="brr-hint brr-lykill">Lykill: <code>' + esc(v.k) + '</code></p>';
    if (l.length) ut += '<div class="brr-slod" role="group" aria-label="Svæðin utan um þetta"><span>Utan um:</span>' + l.map(hn).join('') + '</div>';
    if (v.teg === 'k') {
      var born = lykludBorn(v.el).slice(0, 12);
      if (born.length) ut += '<div class="brr-slod" role="group" aria-label="Svæðin inni í þessu"><span>Inni í:</span>' + born.map(hn).join('') + '</div>';
    }
    return ut;
  }

  /* ---- sést textinn? litur texta á móti því sem er á bak við hann ---- */
  function rgbAf(hex) { hex = String(hex).replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&'); return [0, 2, 4].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function ljomiRgb(c) { var x = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]; }
  function skilRgb(a, b) { var x = ljomiRgb(a), y = ljomiRgb(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function skil(a, b) { return skilRgb(rgbAf(a), rgbAf(b)); }
  function litAf(s) {               /* litur úr útreiknuðum stíl: rgb(), rgba() eða color(srgb …) */
    var m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)$/.exec(s), f = 1;
    if (!m) { m = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(s); f = 255; }
    if (!m) return null;
    return { c: [m[1], m[2], m[3]].map(function (x) { return Math.round(Number(x) * f); }), a: m[4] === undefined ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : Number(m[4]) };
  }
  function bakvid(el) {             /* liturinn á bak við texta: næsti forfaðir með heilan lit. null þegar mynd, litstigull eða hálfgegnsær flötur er á bak við */
    for (var x = el; x && x.nodeType === 1; x = x.parentNode) {
      if (x.hasAttribute('data-mr')) return null;
      var cs = window.getComputedStyle(x), b = litAf(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      if (b && b.a > 0.85) return b.c;
      if (b && b.a > 0.1) return null;
    }
    return [255, 255, 255];
  }
  function illaSed(svaedi) {        /* textar í svæðinu sem sjást illa á því sem er á bak við þá */
    return all('[data-e]', svaedi).filter(function (x) {
      if (x.closest('#vv-app') || !x.getClientRects().length || !x.textContent.trim()) return false;
      var f = litAf(window.getComputedStyle(x).color), b = bakvid(x);
      return !!f && f.a > 0.5 && !!b && skilRgb(f.c, b) < 2.5;
    });
  }
  function skilSvaedis(v) {
    var illa = illaSed(v.el);
    if (!illa.length) return '';
    return '<div class="brr-ath brr-gult" data-r="illa"><strong>' + illa.length + (illa.length === 1 ? ' texti sést' : ' textar sjást') + ' illa</strong> á bakgrunninum hér. Breyttu lit texta eða bakgrunni.' +
      '<div class="brr-slod">' + illa.slice(0, 4).map(function (x) {
        var t = x.textContent.replace(/\s+/g, ' ').trim();
        return '<button type="button" class="brr-h" data-r="velja-l" data-v="' + esc('data-e|' + x.getAttribute('data-e')) + '">' + esc(t.length > 22 ? t.slice(0, 21) + '…' : t) + '</button>';
      }).join('') + '</div></div>';
  }

  /* ---- kassastillingar (ítarlegt): bil, breidd, horn, rammi, skuggi, uppröðun. Eins fyrir textastök og svæði. ---- */
  var MAL = { pt: 'Að ofan', pb: 'Að neðan', pl: 'Vinstra megin', pr: 'Hægra megin', mt: 'Að ofan', mb: 'Að neðan', mw: 'Mesta breidd', h: 'Lágmarkshæð',
    r: 'Rúnnun horna', bw: 'Þykkt ramma', gap: 'Bil milli staka', op: 'Gegnsæi' };
  var CSSNAFN = { pt: 'paddingTop', pb: 'paddingBottom', pl: 'paddingLeft', pr: 'paddingRight', mt: 'marginTop', mb: 'marginBottom', r: 'borderTopLeftRadius', bw: 'borderTopWidth', gap: 'rowGap' };
  function kassaGildi(v, eig, cs) {            /* það sem rennan sýnir: stillt gildi, annars það sem stakið hefur núna */
    var h = hvar(v), st = stillAf(h, v.k, false), sm = stillAf(h, v.k, true);
    if (iSima(eig) && sm[eig] !== undefined) return sm[eig];
    if (st[eig] !== undefined) return st[eig];
    if (eig === 'op') return 1;
    if (eig === 'mw') return Math.min(2400, Math.max(120, Math.round(v.el.getBoundingClientRect().width)));
    if (eig === 'h') return 0;
    var n = parseFloat(cs[CSSNAFN[eig]]);
    return isFinite(n) ? Math.round(n) : 0;
  }
  function rennaK(v, eig, cs, max) {
    var m = E.KASSI[eig];
    return renna(MAL[eig], 'st-' + eig, kassaGildi(v, eig, cs), eig === 'mt' || eig === 'mb' ? -80 : m[1], max || m[2], eig === 'op' ? 0.05 : 1, eig === 'op' ? '' : ' px');
  }
  function dalkar(cs) { var n = String(cs.gridTemplateColumns || '').split(' ').filter(function (x) { return x && x !== 'none'; }).length; return Math.min(6, Math.max(1, n || 1)); }
  function kassaStillingar(v) {
    var cs = window.getComputedStyle(v.el), h = hvar(v), st = stillAf(h, v.k, false), b = R.simi ? stillAf(h, v.k, true) : st, grid = /grid/.test(cs.display), flex = /flex/.test(cs.display), ut = '';
    if (v.teg === 'e') ut += kafli('Bakgrunnur', litaval(st.bg || null, 'st-bg', true));
    ut += kafli('Bil innan í', rennaK(v, 'pt', cs, 200) + rennaK(v, 'pb', cs, 200) + rennaK(v, 'pl', cs, 200) + rennaK(v, 'pr', cs, 200));
    ut += kafli('Bil utan um', rennaK(v, 'mt', cs, 200) + rennaK(v, 'mb', cs, 200));
    ut += kafli('Breidd og hæð', rennaK(v, 'mw', cs) + '<div class="brr-rod"><span>Staða</span>' + hnappar('st-jf', [['v', 'Vinstri'], ['m', 'Miðja'], ['h', 'Hægri']], b.jf || st.jf || '') + '</div>' + rennaK(v, 'h', cs, 1200));
    ut += kafli('Horn og skuggi', rennaK(v, 'r', cs, 80) + '<div class="brr-rod"><span>Skuggi</span>' + hnappar('st-sk', [['', 'Sjálfg.'], ['none', 'Enginn'], ['s', 'Lítill'], ['m', 'Meðal'], ['l', 'Mikill']], st.sk || '') + '</div>' + rennaK(v, 'op', cs));
    ut += kafli('Rammi', rennaK(v, 'bw', cs, 12) + litaval(st.bc || null, 'st-bc', true));
    if (grid || flex) ut += kafli('Uppröðun innihalds', rennaK(v, 'gap', cs, 120) + (grid ? renna('Dálkar', 'st-dal', b.dal || st.dal || dalkar(cs), 1, 6, 1, '') : ''));
    return ut;
  }
  function felaHnappur(v) {          /* fela alls staðar (tölvusýn) eða aðeins á síma (símasýn) */
    var h = hvar(v), alls = stillAf(h, v.k, false).fal === true, sm = stillAf(h, v.k, true).fal === true;
    var merki = alls ? 'Falið: sýna aftur' : R.simi ? (sm ? 'Falið á síma: sýna aftur' : 'Fela á síma') : 'Fela';
    return '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="st-fal" aria-pressed="' + (alls || (R.simi && sm)) + '">' + merki + '</button>' +
      (!R.simi && sm && !alls ? '<button type="button" class="brr-h" data-r="st-fal-sm">Sýna aftur á síma</button>' : '') + '</div>' +
      (alls ? '<p class="brr-hint">Gestir sjá þetta ekki. Hér í ritlinum sést það dauft með strikalínu.</p>' : sm ? '<p class="brr-hint">Gestir sjá þetta ekki á síma.</p>' : '');
  }
  function spjaldSvaedi() {
    var v = R.val, st = stillAf('k', v.k, false), s = systkinSvaedis(v.el), i = s ? s.born.indexOf(v.el) : -1, h = slodHtml(v);
    if (R.simi) h += '<p class="brr-ath">Þú ert í símasýn: að fela' + (R.itarlegt ? ', bil, breidd, hæð og dálkar' : '') + ' gildir aðeins á síma. Litir gilda alls staðar.</p>';
    h += kafli('Bakgrunnur', litaval(st.bg || null, 'st-bg', true));
    h += kafli('Litur texta', litaval(st.c || null, 'st-c', true) + '<p class="brr-hint">Nær til texta í svæðinu, nema hnappa og hlekkja. Texti sem fékk eigin lit heldur honum.</p>' + skilSvaedis(v));
    h += kafli('Sýnileiki og röð', felaHnappur(v) + (s ? '<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h" data-r="k-upp"' + (i <= 0 ? ' disabled' : '') + '>Færa framar</button>' +
      '<button type="button" class="brr-h" data-r="k-nidur"' + (i >= s.born.length - 1 ? ' disabled' : '') + '>Færa aftar</button></div>' : ''));
    if (R.itarlegt) {
      h += kafli('Jöfnun texta', hnappar('st-ta', [['left', 'Vinstri'], ['center', 'Miðja'], ['right', 'Hægri']], (R.simi ? stillAf('k', v.k, true).ta : st.ta) || ''));
      h += kassaStillingar(v);
    }
    h += kafli('', (R.itarlegt ? '' : '<p class="brr-hint" style="margin:0 0 8px">Bil, breidd, horn, rammi, skuggi og dálkar eru í ítarlega hamnum.</p>') + '<div class="brr-hnappar">' +
      (R.itarlegt ? '' : '<button type="button" class="brr-h" data-r="hamur" data-v="1">Ítarlegar stillingar</button>') + '<button type="button" class="brr-h brr-raudur" data-r="st-endurstilla">Endurstilla svæðið</button></div>');
    return h;
  }
  /* slóðin sem hnappur eða valmyndarliður vísar á. Standi fleiri textar í sama hlekk eiga þeir slóðina saman. */
  function hlekkurAf(el) { return el.nodeName === 'A' ? el : el.closest('a'); }
  function hlekkjaLyklar(a) { return (a.hasAttribute('data-e') ? [a] : []).concat(all('[data-e]', a)).map(function (x) { return x.getAttribute('data-e'); }); }
  function hlekkurStaks(v) {
    var a = hlekkurAf(v.el);
    if (!a || a.closest('#vv-app')) return '';
    var t = R.efni.t || {}, sett = hlekkjaLyklar(a).filter(function (k) { return t[k] && t[k].href; })[0];
    return kafli('Hvert vísar hlekkurinn', '<input type="url" data-r="t-href" value="' + esc(sett ? t[sett].href : a.getAttribute('href') || '') + '" placeholder="https://… eða #hafa-samband" aria-label="Slóð sem hlekkurinn vísar á">' +
      '<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h" data-r="t-hlekkur">Vista slóð</button>' + (sett ? '<button type="button" class="brr-h" data-r="t-hlekkur-frum">Upprunaleg slóð</button>' : '') + '</div>');
  }

  /* ---- útlit síðunnar: þematákn (litir, letur, horn, breidd) ---- */
  function taknAf(k) { for (var i = 0; i < E.TAKN.length; i++) if (E.TAKN[i].k === k) return E.TAKN[i]; return null; }
  function taknGildi(x) { var u = R.efni.utlit || {}; return u[x.k] !== undefined ? u[x.k] : x.v; }
  function hslAf(hex) {
    var c = rgbAf(hex).map(function (x) { return x / 255; }), mx = Math.max.apply(null, c), mn = Math.min.apply(null, c), l = (mx + mn) / 2, dd = mx - mn, h = 0, s = 0;
    if (dd) {
      s = dd / (1 - Math.abs(2 * l - 1));
      h = mx === c[0] ? ((c[1] - c[2]) / dd) % 6 : mx === c[1] ? (c[2] - c[0]) / dd + 2 : (c[0] - c[1]) / dd + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s, l];
  }
  function hexAf(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + r.map(function (v) { var n = Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16); return n.length < 2 ? '0' + n : n; }).join('');
  }
  function afleida(grunnur, nytt) {            /* tónar sem fylgja grunnlit halda sömu afstöðu til hans og í upprunalega útlitinu */
    var a = hslAf(grunnur.v), b = hslAf(nytt), ut = {};
    E.TAKN.forEach(function (x) {
      if (x.af !== grunnur.k || x.t !== 'l') return;
      var c = hslAf(x.v);
      var l = c[2] >= a[2] ? b[2] + (c[2] - a[2]) * (a[2] < 1 ? (1 - b[2]) / (1 - a[2]) : 0) : b[2] * (a[2] > 0 ? c[2] / a[2] : 0);
      var s = a[1] > 0.02 ? Math.min(1, b[1] * c[1] / a[1]) : b[1];
      ut[x.k] = hexAf((b[0] + (c[0] - a[0]) + 360) % 360, s, Math.min(1, Math.max(0, l)));
    });
    return ut;
  }
  function iUtlit(u, t, g) {         /* gildi tákns í breytingunum; upprunalega gildið þarf enga færslu */
    if (g === null || g === undefined || g === '' || String(g).toLowerCase() === String(t.v).toLowerCase()) delete u[t.k]; else u[t.k] = g;
  }
  function setjaTakn(k, gildi) {
    var x = taknAf(k);
    if (!x) return;
    if (x.t === 'l') gildi = gildi ? (E.litur(gildi) || '').slice(0, 7) : null;
    breyta('u:' + k, function (efni) {
      var u = efni.utlit || (efni.utlit = {});
      iUtlit(u, x, gildi);
      if (x.t === 'l') { var afl = gildi ? afleida(x, gildi) : null; E.TAKN.forEach(function (t) { if (t.af === x.k) iUtlit(u, t, afl ? afl[t.k] : null); }); }
      (x.med || []).forEach(function (m) { var t = taknAf(m); if (t) iUtlit(u, t, gildi); });
    });
    if (x.t === 'f' && gildi) E.hladaLetri(gildi);
  }
  /* textalitur og flöturinn sem hann stendur á: [texti, flötur, heiti] */
  var POR = [['--on-navy', '--navy-950', 'Texti á aðallit'], ['--on-navy-muted', '--navy-950', 'Daufur texti á aðallit'], ['--on-orange', '--orange', 'Texti á áherslulit'],
    ['--ink', '--surface', 'Fyrirsagnir á spjöldum'], ['--ink-2', '--surface', 'Texti á spjöldum'], ['--muted', '--surface', 'Daufur texti á spjöldum'], ['--ink', '--page', 'Fyrirsagnir á bakgrunni síðunnar']];
  function slaemPor(gildi) {         /* pör þar sem breytingin gerði texta torlæsilegri en hann var (og undir 4,5:1) */
    var l = [];
    POR.forEach(function (p) {
      var a = taknAf(p[0]), b = taknAf(p[1]);
      if (!a || !b) return;
      var nu = skil(gildi(a), gildi(b)), adur = skil(a.v, b.v);
      if (nu < Math.min(4.5, adur) - 0.05) l.push({ a: a, b: b, heiti: p[2], nu: nu, adur: adur });
    });
    return l;
  }
  function skilAdvorun() {
    var l = slaemPor(taknGildi);
    return l.length ? '<div class="brr-ath brr-gult" data-r="u-skil"><strong>Lítill litamunur.</strong> Texti gæti orðið torlæsilegur:<br>' + l.map(function (x) { return esc(x.heiti + ': ' + x.nu.toFixed(1) + ':1 (var ' + x.adur.toFixed(1) + ':1)'); }).join('<br>') +
      '<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h" data-r="u-laga">Laga textaliti sjálfkrafa</button></div></div>' : '';
  }
  function lagaSkil() {              /* textalitur verður upprunalegur ef hann sést nógu vel á fletinum, annars ljós eða dökkur eftir því hvor sést betur */
    var nytt = {};
    function g(x) { return nytt[x.k] || taknGildi(x); }
    slaemPor(g).forEach(function (x) {
      if (nytt[x.a.k]) return;
      var bg = g(x.b);
      nytt[x.a.k] = skil(x.a.v, bg) >= Math.min(4.5, x.adur) - 0.05 ? x.a.v : skil('#ffffff', bg) >= skil('#0b1220', bg) ? '#ffffff' : '#0b1220';
    });
    breyta(null, function (efni) { var u = efni.utlit || (efni.utlit = {}); Object.keys(nytt).forEach(function (k) { iUtlit(u, taknAf(k), nytt[k]); }); });
  }
  function spjaldUtlit() {
    var u = R.efni.utlit || {}, h = '', hopar = {}, rod = [];
    E.TAKN.forEach(function (x) { if (x.falid || (!R.itarlegt && !x.e)) return; if (!hopar[x.h]) { hopar[x.h] = []; rod.push(x.h); } hopar[x.h].push(x); });
    h += '<p class="brr-hint">' + (R.itarlegt ? 'Hvert tákn stýrir lit, letri eða máli alls staðar þar sem það er notað. Þegar grunnlit er breytt fylgja tónar hans.'
      : 'Aðallitir og letur síðunnar. Tónar hvers litar fylgja sjálfkrafa. Hver tónn, horn og breidd eru í ítarlega hamnum.') + '</p>';
    var radir = '';
    rod.forEach(function (hp) {
      var b = hopar[hp].map(function (x) {
        var g = taknGildi(x), breytt = u[x.k] !== undefined;
        if (x.t === 'l') {
          return '<div class="brr-takn"><button type="button" class="brr-takn__b" data-r="takn" data-v="' + esc(x.k) + '" aria-expanded="' + (R.takn === x.k) + '"><span class="brr-takn__lit" style="background:' + esc(E.litur(g) || '#ffffff') + '"></span>' +
            '<span class="brr-takn__n">' + esc(x.n) + '</span>' + (breytt ? '<em>breytt</em>' : '') + '</button>' +
            (R.takn === x.k ? litaval(g, 'u-lit', false) + (breytt ? '<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h" data-r="u-frum" data-v="' + esc(x.k) + '">Upprunalegur litur</button></div>' : '') : '') + '</div>';
        }
        if (x.t === 'f') return '<label class="brr-rod"><span>' + esc(x.n) + '</span>' + leturVal('u-f:' + x.k, breytt ? g : '', x.v + ' (upprunalegt)') + '</label>';
        return renna(x.n, 'u-px:' + x.k, g, typeof x.min === 'number' ? x.min : 0, typeof x.max === 'number' ? x.max : 400, 1, ' px');
      }).join('');
      if (R.itarlegt) h += kafli(hp, b); else radir += b;
    });
    if (radir) h += kafli('', radir);
    h += skilAdvorun();
    h += kafli('', '<div class="brr-hnappar">' + (R.itarlegt ? '' : '<button type="button" class="brr-h" data-r="hamur" data-v="1">Ítarlegar stillingar</button>') +
      '<button type="button" class="brr-h brr-raudur" data-r="u-allt-frum"' + (tomt(u) ? ' disabled' : '') + '>Upprunalegt útlit</button></div>');
    return h;
  }

  /* ---- það sem er falið: listi í tóma spjaldinu, svo ekkert týnist ---- */
  function falin() {
    var l = [];
    [['t', 'data-e'], ['k', 'data-k']].forEach(function (x) {
      var o = R.efni[x[0]] || {};
      Object.keys(o).forEach(function (k) {
        var a = ((o[k] || {}).s || {}).fal === true, b = ((o[k] || {}).sm || {}).fal === true;
        if (!a && !b) return;
        var el = E.lykillOk(k) ? $('[' + x[1] + '="' + k + '"]') : null;
        if (el && !el.closest('#vv-app')) l.push({ h: x[0], eig: x[1], k: k, el: el, simi: !a });
      });
    });
    return l;
  }
  function falinHtml() {
    var l = falin();
    if (!l.length) return '';
    return kafli('Falið á síðunni', l.map(function (x) {
      var nafn = x.h === 'k' ? nafnSvaedis(x.el) : 'Texti · ' + (x.el.textContent.replace(/\s+/g, ' ').trim().slice(0, 26) || heiti(x.k));
      return '<div class="brr-rod brr-falid"><span>' + esc(nafn) + (x.simi ? ' <small>(á síma)</small>' : '') + '</span><span class="brr-hnappar"><button type="button" class="brr-h" data-r="velja-l" data-v="' + esc(x.eig + '|' + x.k) + '">Velja</button>' +
        '<button type="button" class="brr-h" data-r="syna" data-v="' + esc(x.h + '|' + x.k) + '">Sýna</button></span></div>';
    }).join(''));
  }

  /* ---- leiðin fyrir Claude: lýsing á öllu sem má breyta, og svar hans sameinað við breytingarnar sem fyrir eru ---- */
  var HLUTAR = ['t', 'm', 'k', 'rod', 'utlit', 'hetja', 'litir', 'myndasafn'];
  function sameina(a, b) {          /* b ofan á a: hlutir sameinast, fylki og gildi koma í staðinn, null eyðir */
    Object.keys(b).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var v = b[k], til = Object.prototype.hasOwnProperty.call(a, k) ? a[k] : undefined;
      if (v === null) delete a[k];
      else if (typeof v === 'object' && !Array.isArray(v)) { if (!til || typeof til !== 'object' || Array.isArray(til)) til = a[k] = {}; sameina(til, v); }
      else a[k] = v;
    });
    return a;
  }
  function erHlutur(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function sannreynaSnid(b) {        /* lögun efnisins; gildin sjálf hreinsar efnislagið og þjónninn */
    if (!erHlutur(b)) throw new Error('Efnið þarf að vera einn hlutur: { "t": {…}, "k": {…} }');
    var o = Object.keys(b).filter(function (k) { return HLUTAR.indexOf(k) < 0; });
    if (o.length) throw new Error('Óþekktur hluti: ' + o.join(', ') + '. Leyfðir hlutar: ' + HLUTAR.join(', '));
    ['t', 'm', 'k', 'rod', 'utlit', 'hetja'].forEach(function (h) { if (b[h] !== undefined && b[h] !== null && !erHlutur(b[h])) throw new Error('"' + h + '" þarf að vera hlutur: { … }'); });
    ['litir', 'myndasafn'].forEach(function (h) { if (b[h] !== undefined && b[h] !== null && !Array.isArray(b[h])) throw new Error('"' + h + '" þarf að vera listi: [ … ]'); });
    ['t', 'k', 'm'].forEach(function (h) {
      Object.keys(b[h] || {}).forEach(function (k) {
        var x = b[h][k];
        if (x === null) return;
        if (!erHlutur(x)) throw new Error(h + '["' + k + '"] þarf að vera hlutur, til dæmis ' + (h === 't' ? '{ "h": "nýr texti" }' : '{ "s": { … } }'));
        ['s', 'sm'].forEach(function (s) { if (x[s] !== undefined && x[s] !== null && !erHlutur(x[s])) throw new Error(h + '["' + k + '"].' + s + ' þarf að vera hlutur: { … }'); });
      });
    });
    Object.keys(b.rod || {}).forEach(function (k) { if (b.rod[k] !== null && !Array.isArray(b.rod[k])) throw new Error('rod["' + k + '"] þarf að vera listi yfir lykla'); });
  }
  function othekktir(efni) {         /* lyklar í efninu sem eiga sér ekkert stak á síðunni: þeir gera ekkert */
    var ut = [];
    [['t', 'data-e'], ['k', 'data-k'], ['m', 'data-m'], ['rod', 'data-k']].forEach(function (x) {
      Object.keys(efni[x[0]] || {}).forEach(function (k) { if (!E.lykillOk(k) || !$('[' + x[1] + '="' + k + '"]')) ut.push(x[0] + '.' + k); });
    });
    Object.keys(efni.utlit || {}).forEach(function (k) { if (!taknAf(k)) ut.push('utlit.' + k); });
    return ut;
  }
  /* svar frá Claude er oft næstum rétt: litur sem "red" eða "rgb(…)" verður "#rrggbb" og "12px" verður 12 */
  var LITASTILAR = { bg: 1, bc: 1, c: 1 };
  function litHex(v) {               /* hvaða CSS-litur sem er verður "#rrggbb" (vafrinn les hann, aðeins tölurnar eru notaðar); annað verður null */
    if (E.litur(v)) return E.litur(v);
    if (typeof v !== 'string' || v.length > 60) return null;
    var el = d.createElement('span');
    el.style.color = v;
    if (!el.style.color) return null;
    d.body.appendChild(el);
    var c = litAf(window.getComputedStyle(el).color);
    el.remove();
    return c && c.a > 0.99 ? '#' + c.c.map(function (n) { n = Math.min(255, Math.max(0, n)).toString(16); return n.length < 2 ? '0' + n : n; }).join('') : null;
  }
  function talaUr(v) { return typeof v === 'string' && /^-?\d+(\.\d+)?\s*px$/.test(v.trim()) ? Number(v.trim().replace(/\s*px$/, '')) : v; }
  function yfirfara(b) {             /* lagar það sem hægt er, tekur út það sem síðan notar ekki og segir frá því */
    var sk = { fannst_ekki: [], ogild_gildi: [], ytri_hlekkir: [] };
    function ut(slod, v) { var s; try { s = JSON.stringify(v); } catch (e) { s = '?'; } sk.ogild_gildi.push(slod + ' = ' + String(s).slice(0, 40)); }
    function ytri(u) {               /* hlekkur á annan vef: nefndur, svo notandinn sjái hvert svarið vísar gestum */
      var m = /^https:\/\/([^\/?#\s"'<>]+)/i.exec(String(u || '').trim()), h = m ? m[1].toLowerCase() : null;
      if (h && h !== location.host && sk.ytri_hlekkir.indexOf(h) < 0) sk.ytri_hlekkir.push(h);
    }
    [['t', 'data-e'], ['k', 'data-k'], ['m', 'data-m'], ['rod', 'data-k']].forEach(function (x) {
      var o = b[x[0]];
      if (!erHlutur(o)) return;
      Object.keys(o).forEach(function (k) {
        var el = E.lykillOk(k) ? $('[' + x[1] + '="' + k + '"]') : null, e = o[k];
        if (!el || el.closest('#vv-app')) { sk.fannst_ekki.push(x[0] + '.' + k); delete o[k]; return; }
        if (e === null) return;
        if (x[0] === 'rod') { o[k] = e.filter(function (y, i) { return E.lykillOk(y) && e.indexOf(y) === i; }); return; }
        if (x[0] === 'm') { if (e.src !== undefined && e.src !== null && !E.myndOk(e.src)) { ut('m.' + k + '.src', e.src); delete e.src; } return; }
        if (x[0] === 't') {
          if (e.h !== undefined && e.h !== null && typeof e.h !== 'string') { ut('t.' + k + '.h', e.h); delete e.h; }
          if (e.href !== undefined && e.href !== null && !E.slod(e.href)) { ut('t.' + k + '.href', e.href); delete e.href; }
          if (e.href) ytri(e.href);
          if (typeof e.h === 'string') e.h.replace(/href\s*=\s*["']?\s*(https:\/\/[^"'\s>]+)/gi, function (_, u) { ytri(u); return _; });
        }
        ['s', 'sm'].forEach(function (s) {
          var st = e[s];
          if (!erHlutur(st)) return;
          Object.keys(st).forEach(function (p) {
            var v = st[p];
            if (v === null) return;
            if ((p === 'fal' || p === 'it') && v === false) { st[p] = null; return; }      /* false = ekki: færslan fer */
            v = LITASTILAR[p] ? litHex(v) || v : talaUr(v);
            if (E.giltStil(p, v)) st[p] = v; else { ut(x[0] + '.' + k + '.' + s + '.' + p, st[p]); delete st[p]; }
          });
        });
      });
    });
    if (erHlutur(b.utlit)) {
      Object.keys(b.utlit).forEach(function (k) {
        var x = taknAf(k), v = b.utlit[k];
        if (!x) { sk.fannst_ekki.push('utlit.' + k); delete b.utlit[k]; return; }
        if (v === null) return;
        if (x.t === 'l') v = litHex(v);
        else if (x.t === 'px') { v = talaUr(v); v = E.tala(v, -1e9, 1e9) === null ? null : Number(v); }
        else if (!E.leturOk(v)) v = null;
        if (v === null) { ut('utlit.' + k, b.utlit[k]); delete b.utlit[k]; } else b.utlit[k] = v;
      });
    }
    if (Array.isArray(b.litir)) b.litir = b.litir.map(litHex).filter(Boolean).slice(0, 15);
    return sk;
  }
  function anNull(o) { Object.keys(o).forEach(function (k) { if (o[k] === null) delete o[k]; else if (erHlutur(o[k])) anNull(o[k]); }); return o; }
  /* breytingar sem hlutur: ofan á þær sem fyrir eru (sam) eða í stað þeirra. Skilar því sem var ekki notað:
     { fannst_ekki: lyklar sem eiga sér ekkert stak á síðunni, ogild_gildi: gildi sem síðan tekur ekki gild,
       ytri_hlekkir: aðrir vefir sem hlekkir í breytingunum vísa á } */
  function setjaInn(b, sam) {
    sannreynaSnid(b);
    var x = afrit(b), sk = yfirfara(x), nytt = sam ? sameina(afrit(R.efni), x) : anNull(x);
    hreinsaTomt(nytt);
    setjaAllt(nytt, true);
    return sk;
  }
  function daemi() {                 /* dæmi með lyklum sem eru til á þessari síðu */
    var o = {}, sv = all('[data-k]').filter(function (x) { return !x.closest('#vv-app'); });
    var kf = sv.filter(function (x) { return x.nodeName === 'SECTION' && !x.hasAttribute('data-mr') && !x.querySelector('[data-mr]'); })[0];
    var p = sv.filter(function (x) { return x.nodeName === 'MAIN' && lykludBorn(x).length > 1; })[0] || sv.filter(function (x) { return lykludBorn(x).length > 1; })[0];
    var tx = $('h1[data-e]') || $('h2[data-e]') || $('[data-e]'), lit = E.TAKN.filter(function (x) { return x.t === 'l' && x.e; })[1] || E.TAKN.filter(function (x) { return x.t === 'l'; })[0];
    if (lit) { o.utlit = {}; o.utlit[lit.k] = '#d62828'; }
    if (kf) { o.k = {}; o.k[kf.getAttribute('data-k')] = { s: { bg: '#f3f6fb', pt: 48, pb: 48, r: 20 }, sm: { pt: 24, pb: 24 } }; }
    if (p) { var b = p._bhRod || lykludBorn(p).map(function (c) { return c.getAttribute('data-k'); }); o.rod = {}; o.rod[p.getAttribute('data-k')] = [b[1], b[0]].concat(b.slice(2)); }
    if (tx) { o.t = {}; o.t[tx.getAttribute('data-e')] = { h: 'Ný fyrirsögn', s: { fs: 52 }, sm: { fs: 30 } }; }
    return JSON.stringify(o);
  }
  function lysing() {
    var kassi = {};
    Object.keys(E.KASSI).forEach(function (k) { kassi[k] = E.KASSI[k][0] + ', ' + E.KASSI[k][1] + ' til ' + E.KASSI[k][2] + (E.KASSI[k][3] ? ' ' + E.KASSI[k][3] : ''); });
    kassi.bg = 'bakgrunnslitur "#rrggbb"'; kassi.bc = 'litur ramma "#rrggbb"'; kassi.sk = 'skuggi: ' + E.SKUGGAR.join(' | ');
    kassi.jf = 'staða kassa sem hefur mestu breidd (mw): v | m | h'; kassi.dal = 'dálkar í grind, 1 til 6'; kassi.fal = 'true = falið fyrir gestum';
    return {
      utgafa: U,
      sidur: { heim: 'Forsíða', bruna: 'Brunaþéttingar', sida: 'Sameiginlegt á öllum síðum: haus, hafa samband, fótur' },
      snid: {
        t: 't["<lykill texta>"] = { "h": "nýr texti", "href": "slóð ef textinn er hlekkur eða hnappur", "s": { stílar }, "sm": { stílar aðeins á síma } }',
        k: 'k["<lykill svæðis>"] = { "s": { stílar }, "sm": { stílar aðeins á síma } }',
        rod: 'rod["<lykill svæðis>"] = ["<lyklar barna þess í nýrri röð>"]',
        utlit: 'utlit["--tákn"] = gildi: litur "#rrggbb", letur af listanum eða tala (px)',
        m: 'm["<lykill myndar>"] = { "src": "mynd úr myndasafni", "fit": "cover" | "contain", "pos": "center", "z": 100 til 300, "r": 0 til 80, "h": 30 til 1400, "sm": { "h", "pos", "z", "fit" } }',
        hetja: '{ "id": "<banner af listanum>" }',
        litir: 'litaval ritilsins: mest 15 litir "#rrggbb"'
      },
      stilar: {
        texti: { ff: 'letur af listanum', fs: 'stærð, 8 til 200 px', fw: 'þykkt, 100 til 900', lh: 'línubil, 0.8 til 3', ls: 'stafabil, -0.1 til 0.5 em', ta: 'left | center | right', it: 'true = skáletur',
          tt: 'uppercase | none', c: 'litur texta "#rrggbb"; á svæði nær hann til texta í því, nema hnappa og hlekkja' },
        kassi: kassi
      },
      textamerki: 'Í "h" má aðeins nota: b, strong, i, em, u, s, br, small, sup, sub, span (style: color, font-size, font-family, font-weight) og a (href)',
      letur: E.LETUR,
      takn: E.TAKN.filter(function (x) { return !x.falid; }).map(function (x) {
        return { takn: x.k, heiti: x.n, tegund: x.t === 'l' ? 'litur' : x.t === 'f' ? 'letur' : 'px', upprunalegt: x.v, nuna: taknGildi(x), fylgir: x.af, min: x.min, max: x.max };
      }),
      bannerar: E.BANNERAR.map(function (b) { return { id: b.id, heiti: b.heiti }; }),
      litaval: litir(),
      svaedi: all('[data-k]').filter(function (x) { return !x.closest('#vv-app'); }).map(function (x) {
        var p = x.parentNode;
        return { lykill: x.getAttribute('data-k'), hvad: nafnSvaedis(x), i: p && p.hasAttribute && p.hasAttribute('data-k') ? p.getAttribute('data-k') : undefined };
      }),
      myndir: all('[data-m]').filter(function (x) { return !x.closest('#vv-app'); }).map(function (x) { return { lykill: x.getAttribute('data-m'), src: x.getAttribute('src') || '' }; }),
      myndasafn: myndasafn().map(function (x) { return x[0]; }).filter(function (s) { return s.indexOf('blob:') !== 0; }),
      textar: allirTextar(),
      nuverandi_breytingar: R.efni
    };
  }
  function leidbeiningar() {
    return 'Þú hjálpar til við að breyta útliti og texta vefsíðunnar ' + location.origin + location.pathname + ' (útgáfa ' + U + ') í ritli síðunnar.\n' +
      'Breytingarnar eru ekki kóði. Þær eru einn JSON-hlutur sem ritillinn les, hreinsar og vistar.\n\n' +
      'SVARIÐ ÞITT\n' +
      'Einn JSON-hlutur í kóðablokk, aðeins með því sem á að breytast. Hann er sameinaður við breytingarnar sem fyrir eru, svo þú endurtekur ekki\n' +
      'það sem á að standa. Gildið null eyðir færslu og þá gildir upprunalegt útlit aftur.\n\n' +
      'REGLUR\n' +
      '- Notaðu aðeins lykla af listunum hér að neðan (textar, svaedi, myndir, takn). Ritillinn segir frá lyklum sem finnast ekki.\n' +
      '- Litir eru "#rrggbb" og tölur án einingar, innan markanna í "stilar". Ekkert CSS og enginn kóði: gildi sem eru ekki á listunum hér er sleppt,\n' +
      '  og ritillinn segir notandanum hvaða gildum var sleppt.\n' +
      '- "s" gildir á öllum skjám, "sm" aðeins á síma (mjórri en 701 px). Stærðir, bil, dálka og "fal" má setja í "sm".\n' +
      '- Litir síðunnar í heild eru í "utlit". Tákn sem „fylgir“ öðru breytist ekki sjálfkrafa hér: settu það líka ef tónninn á að fylgja.\n' +
      '- Litur texta á svæði ("c" í k) nær til texta í svæðinu, nema hnappa og hlekkja. Gættu þess að texti sjáist vel á bakgrunni (helst 4,5:1).\n' +
      '- Röð: rod["<svæði>"] er listi yfir lykla barna þess í nýrri röð. Börn sem vantar í listann koma á eftir í upprunalegri röð.\n\n' +
      'DÆMI (lyklarnir eru af þessari síðu)\n' + daemi() + '\n\n' +
      'SVONA FER SVARIÐ INN\n' +
      'Notandinn límir það í ritilinn: Fleiri aðgerðir → Leiðbeiningar fyrir Claude → Setja inn svar frá Claude → Sameina.\n' +
      'Stýrir þú vafranum sjálfur: keyrðu window.BH_RITILL.sameina(<hluturinn>) á síðunni með ?ritill í slóðinni. Það skilar\n' +
      '{ fannst_ekki: [lyklar sem eru ekki til á síðunni], ogild_gildi: [gildi sem var sleppt], ytri_hlekkir: [aðrir vefir sem hlekkir vísa á] }.\n' +
      'Breytingarnar verða drög. Gestir sjá þær fyrst þegar notandinn ýtir á Birta.\n\n' +
      'ALLT SEM MÁ BREYTA\n' + JSON.stringify(lysing(), null, 1);
  }
  function afritaTexta(ta) {
    ta.select();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { skilabod('Afritað'); }, function () { d.execCommand('copy'); skilabod('Afritað'); });
    else { d.execCommand('copy'); skilabod('Afritað'); }
  }
  function gluggiClaude() {
    afvelja();
    var g = gluggi('<h3>Leiðbeiningar fyrir Claude</h3><ol class="brr-skref"><li>Afritaðu textann hér að neðan og límdu hann í spjall við Claude.</li>' +
      '<li>Segðu hvað á að breytast, til dæmis „gerðu áherslulitinn rauðan og stækkaðu fyrirsögnina“.</li><li>Límdu svarið frá Claude inn með hnappnum <b>Setja inn svar frá Claude</b>.</li></ol>' +
      '<textarea data-r="lysing" readonly spellcheck="false" aria-label="Leiðbeiningar og lýsing síðunnar"></textarea>' +
      '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="haetta">Loka</button><button type="button" class="brr-h" data-r="svar">Setja inn svar frá Claude</button>' +
      '<button type="button" class="brr-h brr-blar" data-r="afrita">Afrita allt</button></div>', true);
    var ta = $('textarea', g);
    ta.value = leidbeiningar();
    g.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b) return;
      var r = b.getAttribute('data-r');
      if (r === 'afrita') afritaTexta(ta);
      else if (r === 'svar') { g.remove(); gluggiJson(true); }
    });
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
  function simaAth() {
    return R.simi ? '<p class="brr-ath">Þú ert í símasýn: stærð' + (R.itarlegt ? ', línubil, stafabil, jöfnun, bil, breidd og hæð' : ' og jöfnun') + ' sem þú breytir hér gilda aðeins á síma.</p>' : '';
  }
  function spjaldTomt() {
    var prufa = '';
    if (R.hamur === 'prufa') {
      prufa = '<div class="brr-ath brr-gult"><strong>Prufuhamur.</strong> Þú getur prófað allt, en ekkert vistast og gestir sjá engar breytingar. ' +
        (R.astaeda === 'utskrad' ? 'Skráðu þig inn til að vista.<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h brr-blar" data-r="innskra">Skrá inn</button></div>'
          : R.astaeda === 'heimild' ? 'Notandinn sem er skráður inn má ekki breyta vefnum (aðeins notendur með hlutverkið Admin).<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h brr-blar" data-r="innskra">Skrá inn sem annar notandi</button></div>'
            : R.astaeda === 'ovirkt' ? 'Innskráning starfsmanna hefur ekki verið sett upp á þjóninum.'
              : R.astaeda === 'geymsla' ? 'Geymslan á þjóninum er ekki tilbúin enn.' : 'Ekki náðist samband við þjóninn.') + '</div>';
    }
    var it = R.itarlegt;
    return prufa + kafli('', hamHnappar() + '<p class="brr-hint">' + (it ? 'Ítarlegt: allar stillingar á hverju svæði og hverjum texta. Hér getur Claude líka hjálpað.' : 'Einfalt: texti, myndir, litir og kaflar. Ítarlegt opnar allar stillingar.') + '</p>') +
      kafli('', '<p style="margin:0 0 6px">Smelltu á það sem þú vilt breyta:</p><ul style="margin:0;padding-left:18px;line-height:1.7"><li><b>Texta</b>: skrifaðu beint í hann</li>' +
      '<li><b>Hluta af texta</b>: veldu orðin og breyttu letri, stærð eða lit</li><li><b>Mynd eða lógó</b>: skipta um, stækka eða minnka</li><li><b>Forsíðuhausinn</b>: velja banner og hæð</li>' +
      '<li><b>Kafla</b> (autt svæði í honum): bakgrunnur, litur texta, fela eða færa</li>' + (it ? '<li><b>Hvaða svæði sem er</b>: bil, breidd, horn, rammi, skuggi, dálkar</li>' : '') + '</ul>' +
      '<div class="brr-hnappar" style="margin-top:10px">' + ($('[data-hetja-mynd]') ? '<button type="button" class="brr-h" data-r="velja-hetju">Breyta banner</button>' : '') +
      ($('header [data-m]') ? '<button type="button" class="brr-h" data-r="velja-logo">Breyta lógói</button>' : '') +
      (E.TAKN.length ? '<button type="button" class="brr-h" data-r="utlit">Litir og letur síðunnar</button>' : '') + '</div>' +
      '<p class="brr-hint">' + (R.hamur === 'innskrad' ? 'Allt vistast sjálfkrafa sem drög. Gestir sjá ekkert fyrr en þú ýtir á Birta.' : '') + ' Haltu Ctrl inni til að fylgja hlekk, eða notaðu síðuvalið neðst.</p>') +
      (it ? kafli('Með hjálp Claude', '<p class="brr-hint" style="margin-top:0">Claude fær lýsingu á öllu sem má breyta og skilar breytingunum sem texta sem þú setur inn hér.</p>' +
        '<div class="brr-hnappar" style="margin-top:8px"><button type="button" class="brr-h brr-blar" data-r="claude">Leiðbeiningar fyrir Claude</button><button type="button" class="brr-h" data-r="svar">Setja inn svar</button></div>') : '') +
      falinHtml() + kafli('Litaval síðunnar', litaval(null, 'lit-skoda', false));
  }
  function spjaldTexti() {
    var v = R.val, cs = window.getComputedStyle(v.el), st = tStill(v.k, false), sm = tStill(v.k, true);
    function g(eig) { var b = iSima(eig) ? sm : st; return b[eig]; }
    var a = hlekkurVals(), h = slodHtml(v);
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
        '<div class="brr-rod"><span>Jöfnun</span>' + hnappar('t-ta', [['left', 'Vinstri'], ['center', 'Miðja'], ['right', 'Hægri']], g('ta') || '') + '</div>' +
        (R.itarlegt ? renna('Línubil', 't-lh', lh, 0.9, 2.4, 0.05, '') + renna('Stafabil', 't-ls', g('ls') !== undefined ? g('ls') : 0, -0.05, 0.25, 0.005, '') +
          '<div class="brr-rod"><span>Stíll</span><div class="brr-hnappar"><button type="button" class="brr-h" data-r="t-it" aria-pressed="' + (st.it === true) + '"><i>Skáletur</i></button>' +
          '<button type="button" class="brr-h" data-r="t-tt" aria-pressed="' + (st.tt === 'uppercase') + '">HÁSTAFIR</button></div></div>' : ''));
      h += kafli('Litur', litaval(st.c || null, 't-c', true));
      h += hlekkurStaks(v);
      if (R.itarlegt) h += kassaStillingar(v);
    }
    h += kafli('', felaHnappur(v) + '<div class="brr-hnappar" style="margin-top:8px">' + (a ? '<button type="button" class="brr-h" data-r="opna">Opna hlekkinn</button>' : '') +
      (R.itarlegt ? '' : '<button type="button" class="brr-h" data-r="hamur" data-v="1">Ítarlegar stillingar</button>') +
      '<button type="button" class="brr-h brr-raudur" data-r="t-endurstilla">Endurstilla reitinn</button></div>');
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
    var v = R.val, o = mStill(v.k, false), sm = mStill(v.k, true), b = R.simi ? sm : o, h = slodHtml(v);
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
    if (R.simi) h += '<p class="brr-ath">Þú ert í símasýn: hæð, aðdráttur og staðsetning sem þú breytir hér gilda aðeins á síma.</p>';
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
    var v = R.val, utlit = !v && R.spj === 'utlit', skrun = $('.brr-sp-efni', spjald) ? $('.brr-sp-efni', spjald).scrollTop : 0;
    var titill = utlit ? 'Útlit síðunnar' : !v ? 'Ritill' : v.teg === 'e' ? 'Texti' : v.teg === 'k' ? (erKafli(v.el) ? 'Kafli' : 'Svæði') : v.hetja ? 'Forsíðuhaus' : 'Mynd';
    var undir = utlit ? 'Litir, letur, horn og breidd' : !v ? '' : v.teg === 'k' ? nafnSvaedis(v.el).replace(/^[^·]*(·\s*)?/, '') || heiti(v.k) : heiti(v.k);
    var virkt = d.activeElement && spjald.contains(d.activeElement) ? d.activeElement.getAttribute('data-r') : null;
    spjald.innerHTML = '<div class="brr-sp-haus"><h3>' + titill + (undir ? '<small>' + esc(undir) + '</small>' : '') + '</h3>' +
      '<button type="button" class="brr-h brr-aseins-simi" data-r="saman" aria-label="Fela eða sýna stillingar">' + IKON.nidur + '</button>' +
      (v || utlit ? '<button type="button" class="brr-h" data-r="afvelja" aria-label="Loka">' + IKON.loka + '</button>' : '') + '</div>' +
      '<div class="brr-sp-efni">' + (R.hamur === 'hled' ? '<p class="brr-hint">Sæki efnið…</p>' : utlit ? spjaldUtlit() : !v ? spjaldTomt() : v.teg === 'e' ? spjaldTexti() : v.teg === 'k' ? spjaldSvaedi() : spjaldMynd()) + '</div>';
    $('.brr-sp-efni', spjald).scrollTop = skrun;
    if (virkt) { var f = $('[data-r="' + virkt + '"]', spjald); if (f && f.tagName !== 'BUTTON') f.focus({ preventScroll: true }); }
  }
  var MRENNUR = { h: 1, z: 1 };
  function spjaldInntak(e) {            /* rennur: breytast jafnóðum */
    var t = e.target, r = t.getAttribute('data-r'), v = R.val;
    if (!r || t.type !== 'range') return;
    var n = Number(t.value), ut = t.parentNode.querySelector('output');
    if (ut) ut.textContent = ut.textContent.replace(/^-?[\d.]+/, t.value);
    if (r.indexOf('u-px:') === 0) return setjaTakn(r.slice(5), n);
    if (!v) return;
    var eig = r.slice(3);
    if (r === 't-fs' || r === 't-lh' || r === 't-ls') { eig = r.slice(2); setjaTStil(v.k, eig, n, iSima(eig)); }
    else if (r.indexOf('st-') === 0 && v.teg !== 'm' && (E.KASSI[eig] || eig === 'dal')) setjaStil(hvar(v), v.k, eig, eig === 'op' && n >= 1 ? null : n, iSima(eig));
    else if (MRENNUR[r]) setjaM(v.k, r, r === 'z' && n <= 100 ? null : n, R.simi);
  }
  function spjaldBreyting(e) {
    var t = e.target, r = t.getAttribute('data-r'), v = R.val, m;
    if (!r) return;
    if (r === 'u-lit-ser') { if (R.takn) { setjaTakn(R.takn, t.value); teiknaSpjald(); } return; }
    if (r.indexOf('u-f:') === 0) { setjaTakn(r.slice(4), t.value || null); return teiknaSpjald(); }
    if (r === 't-ff' && v) { if (t.value) E.hladaLetri(t.value); setjaTStil(v.k, 'ff', t.value, false); }
    else if (r === 'v-ff' && v) { if (t.value) stillaVal('ff', t.value); t.value = ''; }
    else if (r === 'v-fs' && v) stillaVal('fs', Number(t.value));
    else if (r === 't-c-ser' && v) setjaTStil(v.k, 'c', t.value, false);
    else if (r === 'v-c-ser' && v) stillaVal('c', t.value);
    else if ((m = /^st-(bg|bc|c)-ser$/.exec(r)) && v && v.teg !== 'm') { setjaStil(hvar(v), v.k, m[1], t.value, false); teiknaSpjald(); }
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
    if (r === 'afvelja') { if (!v && R.spj) { R.spj = null; R.takn = null; return teiknaSpjald(); } return afvelja(); }
    if (r === 'saman') { spjald.classList.toggle('brr-saman'); d.body.classList.toggle('brr-spjald-saman', spjald.classList.contains('brr-saman')); return; }
    if (r === 'innskra') return gluggiInnskraning();
    if (r === 'hamur') return setjaHam(g === '1');
    if (r === 'utlit') return opnaUtlit();
    if (r === 'claude') return gluggiClaude();
    if (r === 'svar') return gluggiJson(true);
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
    if (r === 'takn') { R.takn = R.takn === g ? null : g; return teiknaSpjald(); }
    if (r === 'u-lit') { if (R.takn) setjaTakn(R.takn, g); return teiknaSpjald(); }
    if (r === 'u-frum') { setjaTakn(g, null); return teiknaSpjald(); }
    if (r === 'u-laga') { lagaSkil(); return teiknaSpjald(); }
    if (r === 'u-allt-frum') { breyta(null, function (efni) { delete efni.utlit; }); R.takn = null; return teiknaSpjald(); }
    if (r === 'velja-k') return veljaLykil('data-k', g);
    if (r === 'velja-l') { l = String(g).split('|'); return veljaLykil(l[0], l[1]); }
    if (r === 'syna') {
      l = String(g).split('|');
      breyta(null, function (efni) { var o = Object.prototype.hasOwnProperty.call(efni[l[0]] || {}, l[1]) ? efni[l[0]][l[1]] : null; if (o) { if (o.s) delete o.s.fal; if (o.sm) delete o.sm.fal; } });
      return teiknaSpjald();
    }
    if (r === 'velja-hetju' || r === 'velja-logo') {
      var mark = $(r === 'velja-hetju' ? '[data-hetja-mynd]' : 'header [data-m]');
      if (!mark) return;
      if (!mark.getClientRects().length) location.hash = '#top';            /* forsíðan er ekki opin */
      window.scrollTo(0, 0);
      setTimeout(function () { velja(mark); }, 60);
      return;
    }
    if (!v) return;
    var hv = v.teg === 'm' ? null : hvar(v), eig = r.slice(3), si;
    if (r === 'svid') { R.svid = g; if (g === 'val' && !(valRange && !valRange.collapsed)) skilabod('Veldu orð í textanum á síðunni'); return teiknaSpjald(); }
    if (r === 't-c') setjaTStil(v.k, 'c', g, false);
    else if (r === 't-fw') setjaTStil(v.k, 'fw', g === '' ? null : Number(g), false);
    else if (r === 't-ta') setjaTStil(v.k, 'ta', tStill(v.k, iSima('ta')).ta === g ? null : g, iSima('ta'));
    else if (r === 't-it') setjaTStil(v.k, 'it', tStill(v.k, false).it === true ? null : true, false);
    else if (r === 't-tt') setjaTStil(v.k, 'tt', tStill(v.k, false).tt === 'uppercase' ? null : 'uppercase', false);
    else if (hv && (r === 'st-bg' || r === 'st-bc' || r === 'st-c' || r === 'st-sk')) setjaStil(hv, v.k, eig, g, false);
    else if (hv && (r === 'st-jf' || r === 'st-ta')) { si = iSima(eig); setjaStil(hv, v.k, eig, stillAf(hv, v.k, si)[eig] === g ? null : g, si); }
    else if (hv && r === 'st-fal') {
      if (stillAf(hv, v.k, false).fal === true) setjaStil(hv, v.k, 'fal', null, false);
      else if (R.simi) setjaStil(hv, v.k, 'fal', stillAf(hv, v.k, true).fal === true ? null : true, true);
      else setjaStil(hv, v.k, 'fal', true, false);
    }
    else if (hv && r === 'st-fal-sm') setjaStil(hv, v.k, 'fal', null, true);
    else if (r === 'k-upp' || r === 'k-nidur') return faera(v.el, r === 'k-upp' ? -1 : 1);
    else if (r === 'st-endurstilla' && v.teg === 'k') { var sk = v.k; breyta(null, function (efni) { if (efni.k) delete efni.k[sk]; }); }
    else if (r === 't-hlekkur' || r === 't-hlekkur-frum') {
      var hl = hlekkurAf(v.el);
      if (!hl) return;
      var ny = r === 't-hlekkur' ? E.slod(($('[data-r="t-href"]', spjald) || {}).value) : null, lyklar = hlekkjaLyklar(hl), frum = hl._bhHref !== undefined ? hl._bhHref : hl.getAttribute('href');
      if (r === 't-hlekkur' && !ny) { skilabod('Slóðin þarf að byrja á https://, #, tel: eða mailto:'); return; }
      breyta(null, function (efni) {
        var t = efni.t || (efni.t = {});
        lyklar.forEach(function (k) { if (t[k]) delete t[k].href; });
        if (ny && ny !== frum) (t[v.k] || (t[v.k] = {})).href = ny;
      });
      if (ny) skilabod('Hlekkurinn vísar nú á ' + ny);
    }
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
  function opnaUtlit() { afvelja(); R.spj = 'utlit'; opnaSpjald(); teiknaSpjald(); }

  /* ---- aðgerðir: forskoðun, birting, saga, breytingar sem texti, innskráning ---- */
  function forskoda(a) {
    afvelja();
    R.breyta = !a;
    d.body.classList.toggle('brr-forskoda', a); d.body.classList.toggle('brr-breyta', !a);
    d.documentElement.classList.toggle('brr-syna-falid', !a);
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
      (E.TAKN.length ? '<button type="button" role="menuitem" data-r="utlit">Litir og letur síðunnar…</button>' : '') +
      '<button type="button" role="menuitem" data-r="hamur">' + (R.itarlegt ? 'Skipta í einfaldan ritil' : 'Skipta í ítarlegan ritil') + '</button>' +
      '<button type="button" role="menuitem" data-r="claude">Leiðbeiningar fyrir Claude…</button>' +
      (inn ? '<button type="button" role="menuitem" data-r="saga">Útgáfusaga…</button>' : '') +
      '<button type="button" role="menuitem" data-r="henda">Henda óbirtum breytingum</button>' +
      '<button type="button" role="menuitem" data-r="json">Breytingar sem texti…</button>' +
      (inn ? '<button type="button" role="menuitem" data-r="utskra">Skrá út</button>' : R.astaeda === 'utskrad' || R.astaeda === 'heimild' ? '<button type="button" role="menuitem" data-r="innskra">Skrá inn</button>' : '');
    d.body.appendChild(m);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b) return;
      var r = b.getAttribute('data-r');
      m.remove();
      if (r === 'forskoda') forskoda(true);
      else if (r === 'gestur') window.open(slodMed({ ritill: null, rammi: null, simi: null, hamur: null }), '_blank', 'noopener');
      else if (r === 'utlit') opnaUtlit();
      else if (r === 'hamur') { setjaHam(!R.itarlegt); opnaSpjald(); skilabod(R.itarlegt ? 'Ítarlegur ritill: allar stillingar' : 'Einfaldur ritill'); }
      else if (r === 'claude') gluggiClaude();
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
      var ma = R.astaeda === 'utskrad' || R.astaeda === 'heimild';
      gluggi('<h3>Birting er ekki í boði í prufuham</h3><p>' + (R.astaeda === 'utskrad' ? 'Skráðu þig inn með notandanafni og lykilorði til að vista og birta breytingar.'
        : R.astaeda === 'heimild' ? 'Notandinn sem er skráður inn má ekki breyta vefnum. Aðeins notendur með hlutverkið Admin geta vistað og birt.'
          : R.astaeda === 'ovirkt' ? 'Innskráning starfsmanna hefur ekki verið sett upp á þjóninum. Þangað til er hægt að prófa ritilinn, en ekkert vistast.'
            : 'Ekki náðist í geymsluna á þjóninum.') + '</p><div class="brr-hnappar">' +
        (ma ? '<button type="button" class="brr-h brr-blar" data-r="inn">Skrá inn</button>' : '') + '<button type="button" class="brr-h" data-r="haetta">Loka</button></div>')
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
  /* breytingarnar sem texti. svar = true: tómur reitur fyrir svar frá Claude, sem er sameinað við breytingarnar sem fyrir eru. */
  function gluggiJson(svar) {
    afvelja();
    var g = gluggi(svar
      ? '<h3>Setja inn svar frá Claude</h3><p>Límdu JSON-svarið hér. Það er sameinað við breytingarnar sem fyrir eru og verður drög: gestir sjá ekkert fyrr en þú birtir. Hægt er að afturkalla.</p>' +
        '<textarea data-r="json" spellcheck="false" placeholder="{ &quot;utlit&quot;: { … }, &quot;k&quot;: { … } }" aria-label="Svar frá Claude sem JSON"></textarea><p class="brr-villa" data-r="jvilla" hidden></p>' +
        '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="haetta">Loka</button><button type="button" class="brr-h" data-r="allt">Sjá allar breytingar</button>' +
        '<button type="button" class="brr-h brr-blar" data-r="sameina">Sameina</button></div>'
      : '<h3>Breytingar sem texti</h3><p>Allar breytingar ritilsins á þessari útgáfu, sem JSON: <code>t</code> textar, <code>k</code> svæði, <code>rod</code> röð, <code>utlit</code> litir og letur síðunnar, <code>m</code> myndir, ' +
        '<code>hetja</code> bannerinn og <code>litir</code> litavalið. <b>Setja inn</b> skiptir öllum breytingunum út fyrir textann hér.</p>' +
        '<textarea data-r="json" spellcheck="false" aria-label="Breytingar sem JSON"></textarea><p class="brr-villa" data-r="jvilla" hidden></p>' +
        '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="claude">Leiðbeiningar fyrir Claude</button><button type="button" class="brr-h" data-r="afrita">Afrita</button>' +
        '<button type="button" class="brr-h" data-r="haetta">Loka</button><button type="button" class="brr-h brr-blar" data-r="setja">Setja inn</button></div>', true);
    var ta = $('textarea', g), villa = $('[data-r="jvilla"]', g);
    if (!svar) ta.value = JSON.stringify(R.efni, null, 1);
    function segja(s) { villa.hidden = false; villa.textContent = s; }
    g.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b) return;
      var r = b.getAttribute('data-r');
      if (r === 'afrita') afritaTexta(ta);
      else if (r === 'claude') { g.remove(); gluggiClaude(); }
      else if (r === 'allt') { g.remove(); gluggiJson(); }
      else if (r === 'setja' || r === 'sameina') {
        var nytt, texti = ta.value.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, ''), fannstEkki;      /* svar í kóðablokk: girðingin fer af */
        if (!texti) return segja('Reiturinn er tómur.');
        try { nytt = JSON.parse(texti); } catch (x) { return segja('Þetta er ekki gilt JSON: ' + x.message); }
        try { fannstEkki = setjaInn(nytt, r === 'sameina'); } catch (x) { return segja(x.message); }
        g.remove();
        if (fannstEkki.fannst_ekki.length || fannstEkki.ogild_gildi.length || fannstEkki.ytri_hlekkir.length) {
          gluggi('<h3>' + (fannstEkki.fannst_ekki.length || fannstEkki.ogild_gildi.length ? 'Sett inn, en sumt var ekki notað' : 'Sett inn sem drög') + '</h3>' +
            (fannstEkki.ytri_hlekkir.length ? '<p><b>Hlekkir á aðra vefi.</b> Breytingarnar vísa gestum á þessa vefi. Gakktu úr skugga um að það sé rétt áður en þú birtir:</p><p><code>' +
              fannstEkki.ytri_hlekkir.slice(0, 20).map(esc).join('</code>, <code>') + '</code></p>' : '') +
            (fannstEkki.fannst_ekki.length ? '<p>Þessir lyklar eiga sér ekkert stak á þessari útgáfu síðunnar:</p><p><code>' + fannstEkki.fannst_ekki.slice(0, 30).map(esc).join('</code>, <code>') + '</code></p>' : '') +
            (fannstEkki.ogild_gildi.length ? '<p>Þessum gildum var sleppt. Litir eru „#rrggbb“, tölur án einingar, og letur og orð eru af listunum í leiðbeiningunum:</p><p><code>' +
              fannstEkki.ogild_gildi.slice(0, 30).map(esc).join('</code><br><code>') + '</code></p>' : '') +
            '<div class="brr-hnappar"><button type="button" class="brr-h brr-blar" data-r="haetta">Í lagi</button></div>');
        } else skilabod(r === 'sameina' ? 'Breytingarnar voru sameinaðar við drögin' : 'Breytingarnar voru settar inn sem drög');
      }
    });
  }
  function gluggiInnskraning() {
    var nn = '';
    try { nn = localStorage.getItem(LS_NN) || ''; } catch (e) {}
    var g = gluggi('<h3>Innskráning</h3><p>Sama notandanafn og lykilorð og í stjórnstöðinni og Slökkvitæki-appinu. Með innskráningu vistast breytingarnar á þjóninum og hægt er að birta þær.</p>' +
      '<form><label for="brr-nn">Notandanafn</label><input type="text" id="brr-nn" autocomplete="username" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="8" value="' + esc(nn) + '">' +
      '<label for="brr-lykilord">Lykilorð</label><input type="password" id="brr-lykilord" autocomplete="current-password">' +
      '<p class="brr-villa" data-r="villa" hidden></p><div class="brr-hnappar"><button type="button" class="brr-h" data-r="haetta">Skoða án innskráningar</button>' +
      '<button type="submit" class="brr-h brr-blar">Skrá inn</button></div></form>');
    var takki = $('button[type="submit"]', g);
    $('form', g).addEventListener('submit', function (e) {
      e.preventDefault();
      var villa = $('[data-r="villa"]', g), n = $('#brr-nn', g).value.trim().toUpperCase(), lyk = $('#brr-lykilord', g).value;
      function segja(s) { villa.hidden = false; villa.textContent = s; takki.disabled = false; $('#brr-lykilord', g).value = ''; }      /* lykilorðið stendur ekki eftir í reitnum */
      if (!n || !lyk) return segja('Notandanafn og lykilorð vantar.');
      takki.disabled = true;
      innskraning({ action: 'login', nn: n, password: lyk }).then(function (r) {
        if (r.status !== 200) {
          return segja(r.status === 401 ? 'Rangt notandanafn eða lykilorð.' : r.status === 429 ? 'Of margar rangar tilraunir. Reyndu aftur eftir nokkrar mínútur.'
            : r.status === 503 ? 'Innskráning starfsmanna hefur ekki verið sett upp á þjóninum.' : 'Innskráning mistókst.');
        }
        try { localStorage.setItem(LS_NN, n); } catch (x) {}
        var prufa = R.hamur === 'prufa' ? JSON.stringify(R.efni) : null;
        return saekja('&drog=1').then(function (x) {
          if (x.status === 403) return segja('Notandinn ' + n + ' má ekki breyta vefnum. Aðeins notendur með hlutverkið Admin geta það.');
          if (x.status !== 200) return segja('Drögin náðust ekki. Reyndu aftur.');
          g.remove();
          afvelja();
          innskrad(x.j);
          if (prufa && prufa !== JSON.stringify(R.efni) && prufa !== JSON.stringify(R.birt)) {
            spyrja('Nota breytingarnar úr prufuhamnum?', 'Þú gerðir breytingar áður en þú skráðir þig inn. Á að setja þær í drögin?', 'Nota þær', function () { setjaAllt(JSON.parse(prufa), true); });
          }
          try { sessionStorage.removeItem(SS_PRUFA); } catch (y) {}
        });
      }).catch(function () { segja('Ekki náðist samband við þjóninn.'); });
    });
    setTimeout(function () { var r = $(nn ? '#brr-lykilord' : '#brr-nn', g); if (r) r.focus(); }, 30);
  }
  /* innskráningin endaði á meðan unnið var (lykilorði skipt, útskráð annars staðar, heimild tekin): breytingarnar standa á
     skjánum, ritillinn fer í prufuham og býður innskráningu. Eftir hana er spurt hvort nota eigi breytingarnar. */
  function lokid(anHeimildar) {
    utskradur(anHeimildar ? 'heimild' : 'utskrad');
    if (anHeimildar) return skilabod('Þessi notandi má ekki lengur breyta vefnum. Breytingarnar eru enn á skjánum.');
    skilabod('Innskráningin rann út. Skráðu þig inn aftur til að vista.');
    if (!IRAMMA && !$('#brr-nn')) gluggiInnskraning();
  }
  /* innskráningin er ekki lengur gild hér (útskráð, útrunnin eða án heimildar): ritillinn heldur áfram í prufuham */
  function utskradur(astaeda) {
    afvelja();
    R.hamur = 'prufa'; R.astaeda = astaeda || 'utskrad'; R.ovistad = false;
    stada(); teiknaSpjald();
  }
  function utskra() {      /* sama innskráning og í stjórnstöðinni: útskráning hér gildir líka þar */
    innskraning({ action: 'logout' }).then(function (r) {
      if (r.status === 200) utskradur('utskrad'); else skilabod('Útskráning tókst ekki. Reyndu aftur.');      /* cookie-ið stendur þá enn: ekki látast vera útskráð */
    }).catch(function () { skilabod('Útskráning tókst ekki: ekkert samband við þjóninn.'); });
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

  /* ---- það sem Claude (eða annað tól sem stýrir vafranum) getur kallað á ---- */
  R.lysing = lysing; R.leidbeiningar = leidbeiningar;
  R.sameina = function (b) { return setjaInn(b, true); };       /* breytingar ofan á þær sem fyrir eru; skilar lyklum sem fundust ekki */
  R.setjaAllt = function (b) { return setjaInn(b, false); };     /* í stað allra breytinga */
  R.veljaLykil = veljaLykil; R.setjaHam = setjaHam; R.opnaUtlit = opnaUtlit;
  R.tol = { illaSed: illaSed, afleida: afleida, taknAf: taknAf, erKafli: erKafli, othekktir: othekktir, litHex: litHex };

  /* ---- ræsing ---- */
  window.addEventListener('pagehide', function () {
    if (R.hamur === 'innskrad' && R.ovistad) {
      try { fetch(API, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: HAUSAR, body: JSON.stringify({ adgerd: 'vista', utgafa: U, efni: R.efni, grunnur: R.grunnur }) }); } catch (e) {}
    }
  });
  window.matchMedia(E.simi).addEventListener('change', function (e) { R.simi = e.matches; teiknaSpjald(); });
  teiknaKrom(); stada(); teiknaSpjald();
  saekja('').then(function (p) {
    R.birt = (p.j && p.j.efni) || {}; R.birtNr = (p.j && p.j.nr) || 0;
    return saekja('&drog=1');
  }).then(function (r) {
    if (r.status === 200) return innskrad(r.j);
    if (r.status === 401) return prufa('utskrad', true);
    if (r.status === 403) return prufa('heimild', false);
    return prufa(r.status === 503 ? 'ovirkt' : 'geymsla', false);
  }).catch(function () { prufa('samband', false); });
})();
