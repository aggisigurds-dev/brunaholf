/* Innskráningarskjár starfsfólks í Brunahólf premium útliti: sama myndefni, kort, reitir og hnappar og á innskráningarsíðu
   þjónustugáttarinnar. Notaður af site/innranet.js („Innranet“ í fætinum og valmyndin eftir innskráningu) og site/ritill.js
   (innskráning ritilsins). Útlitið er í site/innskraning.css.
   Letrið er það sem síðan hefur þegar sótt: Poppins á V2 og V1, Inter á V3.
   Hér er aðeins skjárinn sjálfur: bakgrunnur, merki, kort, reitir, sýna og fela lykilorð, lyklaborð og lokun. Hvað gerist við
   innskráningu ræður sá sem kallar. Skjárinn segir ekkert um innri kerfin: það sem gestur getur opnað er aðeins notandanafn
   og lykilorð (Agnar 14.11.2026). */
(function () {
  'use strict';
  var d = document;
  if (window.BH_INNSKRANING) return;
  var IMG = ((d.currentScript && d.currentScript.src) || '').replace(/site\/[^\/]*$/, 'img/');      /* myndir vefsins, við hlið site/ */
  var T = {
    notandi: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1.5a7 7 0 0 1 14 0V20"/>',
    las: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    auga: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/>',
    inn: '<path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7M3 12h14m-6-6 6 6-6 6"/>',
    ut: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M9 12h12m-5-5 5 5-5 5"/>',
    skjoldur: '<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5zM9 12l2 2 4-4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    penni: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    stillingar: '<path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
    kerfi: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
    or: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    orUt: '<path d="M8 16 16 8M9 8h7v7"/>'
  };
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function takn(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (T[n] || '') + '</svg>'; }

  var opinn = null;      /* skjárinn sem er uppi: { hula, fyrriFokus, yfirflaedi, vidLokun } */
  function faanleg(h) {
    return Array.prototype.filter.call(h.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])'), function (x) { return x.getClientRects().length > 0; });
  }
  /* fókus sem fer út af skjánum (smellt á bakgrunninn, Tab af síðasta hnappi) kemur aftur inn á hann */
  function haldaFokus(e) {
    if (!opinn || opinn.hula.contains(e.target)) return;
    var f = faanleg(opinn.hula)[0];
    if (f) f.focus({ preventScroll: true });
  }
  /* Escape lokar skjánum hvar sem fókusinn er (hnappur sem varð óvirkur sleppir honum á <body>). Hlustað er á glugganum í
     fangfasa og atburðurinn stöðvaður þar, svo ritillinn undir bregðist ekki við sama lykli. */
  function escLokar(e) {
    if (!opinn || e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    loka();
  }
  /* kallarinn = false: skjárinn víkur fyrir öðrum (innskráning → valmynd), svo fókus og skrun síðunnar bíða þess næsta */
  function loka(kallarinn) {
    if (!opinn) return;
    var o = opinn;
    opinn = null;
    d.removeEventListener('focusin', haldaFokus, true);
    window.removeEventListener('keydown', escLokar, true);
    o.hula.remove();
    if (kallarinn === false) return o;
    d.documentElement.style.overflow = o.yfirflaedi;
    if (o.fyrriFokus && o.fyrriFokus.focus && d.contains(o.fyrriFokus)) { try { o.fyrriFokus.focus({ preventScroll: true }); } catch (e) {} }
    if (o.vidLokun) o.vidLokun();
    return o;
  }
  /* Skjárinn sést ekki fyrr en stílblaðið hans er komið: á hægri tengingu stæðu reitirnir annars ósniðnir neðst á síðunni
     augnablik. Þegar hann birtist fær fyrsti auði reiturinn fókusinn (eða fyrsti hlekkurinn í valmyndinni), því falið stak
     tekur ekki við fókus og kallarinn reyndi það of snemma. */
  function bidaStila(h) {
    var l = d.querySelector('link[rel="stylesheet"][href$="innskraning.css"]');
    if (!l || l.sheet) return;
    h.style.visibility = 'hidden';
    var syna = function () {
      if (!h.style.visibility) return;
      h.style.visibility = '';
      if (!h.isConnected || h.contains(d.activeElement) && d.activeElement !== h) return;
      var r = Array.prototype.filter.call(h.querySelectorAll('.bhi-kort input'), function (x) { return !x.value; })[0] || h.querySelector('.bhi-kort a[href], .bhi-kort button');
      if (r) r.focus({ preventScroll: true });
    };
    l.addEventListener('load', syna);
    l.addEventListener('error', function () { l.remove(); syna(); });      /* næsta opnun reynir stílblaðið aftur */
    setTimeout(syna, 3000);
  }
  /* o: { html (það sem fer í kortið), titillId, breitt, klasi, vidLokun (kallað þegar skjánum er lokað, ekki þegar annar tekur við) } */
  function skjar(o) {
    var fyrri = opinn ? loka(false) : null;
    var h = d.createElement('div');
    h.className = 'bhi' + (o.klasi ? ' ' + o.klasi : '');
    h.tabIndex = -1;
    h.setAttribute('role', 'dialog');
    h.setAttribute('aria-modal', 'true');
    if (o.titillId) h.setAttribute('aria-labelledby', o.titillId);
    h.innerHTML = '<div class="bhi-topp"><span class="bhi-merki"><img src="' + esc(IMG + 'logo.webp') + '" alt="Brunahólf" width="500" height="150"></span>' +
      '<button type="button" class="bhi-loka" data-bhi="loka">' + takn('x') + '<span>Loka</span></button></div>' +
      '<div class="bhi-kort' + (o.breitt ? ' bhi-breitt' : '') + '">' + o.html + '</div>';
    h.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = faanleg(h);
      if (!f.length) return;
      if (e.shiftKey && (d.activeElement === f[0] || d.activeElement === h)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    h.addEventListener('click', function (e) {
      var a = e.target.closest('.bhi-auga');
      if (a) {
        var reitur = a.parentNode.querySelector('input'), syna = reitur.type === 'password';
        reitur.type = syna ? 'text' : 'password';
        a.setAttribute('aria-pressed', String(syna));      /* rofi: heitið stendur, aðeins staðan breytist */
        reitur.focus();
        return;
      }
      if (e.target.closest('[data-bhi="loka"]')) loka();
    });
    bidaStila(h);
    d.body.appendChild(h);
    opinn = { hula: h, fyrriFokus: fyrri ? fyrri.fyrriFokus : d.activeElement, yfirflaedi: fyrri ? fyrri.yfirflaedi : d.documentElement.style.overflow, vidLokun: o.vidLokun };
    d.documentElement.style.overflow = 'hidden';      /* síðan undir skrunar ekki á meðan */
    d.addEventListener('focusin', haldaFokus, true);
    window.addEventListener('keydown', escLokar, true);
    /* fókusinn fer strax inn á skjáinn (kallarinn velur svo sinn reit); falinn skjár fær hann þegar hann birtist */
    if (!h.style.visibility) { var f0 = h.querySelector('.bhi-kort input, .bhi-kort a[href], .bhi-kort button'); (f0 || h).focus({ preventScroll: true }); }
    return h;
  }
  /* reitirnir tveir. Heitin eru falin sjónrænt eins og í þjónustugáttinni (staðgengilstexti og tákn sýna hvað á að slá inn)
     en standa í <label>, svo skjálesarar og lykilorðastjórar finni reitina. */
  function reitir(o) {
    return '<div class="bhi-reitur"><label for="' + esc(o.idNn) + '">Notandanafn</label><div class="bhi-box">' + takn('notandi') +
      '<input type="text" id="' + esc(o.idNn) + '" name="username" placeholder="Notandanafn" autocomplete="username" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="8" value="' + esc(o.nn || '') + '"></div></div>' +
      '<div class="bhi-reitur"><label for="' + esc(o.idLyk) + '">Lykilorð</label><div class="bhi-box">' + takn('las') +
      '<input type="password" id="' + esc(o.idLyk) + '" name="password" placeholder="Lykilorð" autocomplete="current-password">' +
      '<button type="button" class="bhi-auga" aria-label="Sýna lykilorð" aria-pressed="false">' + takn('auga') + '</button></div></div>';
  }
  /* allt innskráningarkortið. o: { titillId, undir, idNn, idLyk, nn, auka (texti aukahnapps), aukaR (data-r á honum) } */
  function form(o) {
    return '<h2 class="bhi-titill" id="' + esc(o.titillId) + '">Innskráning</h2><p class="bhi-undir">' + esc(o.undir || 'Skráðu þig inn til að halda áfram.') + '</p>' +
      '<form novalidate>' + reitir(o) + '<p class="bhi-villa" data-r="villa" role="alert" hidden></p>' +
      '<button type="submit" class="bhi-adal">' + takn('inn') + '<span>Skrá inn</span></button>' +
      '<button type="button" class="bhi-auka" data-bhi="loka" data-r="' + esc(o.aukaR || 'loka') + '">' + esc(o.auka || 'Hætta við') + '</button></form>' +
      (location.protocol === 'https:' ? '<p class="bhi-oryggi">' + takn('skjoldur') + '<span>Örugg innskráning og dulkóðaður gagnaflutningur (HTTPS)</span></p>' : '');
  }
  function skilabod(t) {
    Array.prototype.forEach.call(d.querySelectorAll('.bhi-skilabod'), function (x) { x.remove(); });
    var s = d.createElement('div');
    s.className = 'bhi-skilabod'; s.setAttribute('role', 'status'); s.textContent = t;
    d.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 3400);
  }
  window.BH_INNSKRANING = { skjar: skjar, loka: loka, form: form, takn: takn, esc: esc, skilabod: skilabod };
})();
