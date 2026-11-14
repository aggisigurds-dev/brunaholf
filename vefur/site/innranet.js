/* Innskráning starfsfólks á síðunni: „Innranet“ í fætinum, eða ?innranet aftan við slóðina. Hleðst aðeins þá (site/efni.js).
   Innskráningin er sú sama og í stjórnstöðinni og Slökkvitæki-appinu (notendaskrá starfsmanna, cookie hub_user).
   Eftir innskráningu: breyta síðunni, stillingar hennar, og leiðir í innri kerfin. Þær leiðir koma frá þjóninum
   (/api/vefur-efni?innranet=1) og standa ekki í þessari skrá, svo gestir sjái þær ekki. Útlitið er úr site/ritill.css. */
(function () {
  'use strict';
  var E = window.BH_EFNI, d = document;
  if (!E || !E.api || window.BH_INNRANET) return;
  var API = E.api, INN = API.replace(/[^\/]*$/, 'hub-adgangar'), LS_NN = 'bh_ritill_nn';
  var hula = null, fyrriFokus = null;

  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, rot) { return (rot || d).querySelector(sel); }
  function svarJson(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; }); }
  function slodMed(br) {
    var u = new URL(location.href);
    Object.keys(br).forEach(function (k) { if (br[k] === null) u.searchParams.delete(k); else u.searchParams.set(k, br[k]); });
    return u.pathname.replace(/^\/{2,}/, '/') + u.search.replace(/=(?=&|$)/g, '') + u.hash;      /* aldrei tvö skástrik fremst: það væri annað lén */
  }
  function skilabod(t) {
    Array.prototype.forEach.call(d.querySelectorAll('.brr-skilabod'), function (x) { x.remove(); });
    var s = d.createElement('div');
    s.className = 'brr brr-skilabod'; s.setAttribute('role', 'status'); s.textContent = t;
    d.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 3400);
  }
  function loka() {
    if (hula) { hula.remove(); hula = null; }
    try { if (new URLSearchParams(location.search).has('innranet')) history.replaceState(history.state, '', slodMed({ innranet: null })); } catch (e) {}
    if (fyrriFokus && fyrriFokus.focus) { try { fyrriFokus.focus({ preventScroll: true }); } catch (e) {} }
    fyrriFokus = null;
  }
  function gluggi(html) {
    if (hula) hula.remove(); else fyrriFokus = d.activeElement;
    hula = d.createElement('div');
    hula.className = 'brr brr-hula brr-innranet';
    hula.innerHTML = '<div class="brr-gluggi" role="dialog" aria-modal="true" aria-labelledby="brr-inn-titill">' + html + '</div>';
    hula.addEventListener('mousedown', function (e) { if (e.target === hula) loka(); });
    hula.addEventListener('keydown', function (e) { if (e.key === 'Escape') loka(); });
    hula.addEventListener('click', function (e) { if (e.target.closest('[data-r="loka"]')) loka(); });
    d.body.appendChild(hula);
    return hula;
  }
  function stada() { return fetch(API + '?innranet=1', { credentials: 'same-origin', cache: 'no-store' }).then(svarJson); }

  function innskraning() {
    var nn = '';
    try { nn = localStorage.getItem(LS_NN) || ''; } catch (e) {}
    var g = gluggi('<h3 id="brr-inn-titill">Innskráning starfsfólks</h3><p>Sama notandanafn og lykilorð og í stjórnstöðinni og Slökkvitæki-appinu.</p>' +
      '<form><label for="brr-inn-nn">Notandanafn</label><input type="text" id="brr-inn-nn" autocomplete="username" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="8" value="' + esc(nn) + '">' +
      '<label for="brr-inn-lykilord">Lykilorð</label><input type="password" id="brr-inn-lykilord" autocomplete="current-password">' +
      '<p class="brr-villa" data-r="villa" role="alert" hidden></p><div class="brr-hnappar"><button type="button" class="brr-h" data-r="loka">Hætta við</button>' +
      '<button type="submit" class="brr-h brr-blar">Skrá inn</button></div></form>');
    var takki = $('button[type="submit"]', g), villa = $('[data-r="villa"]', g);
    function segja(s) { villa.hidden = false; villa.textContent = s; takki.disabled = false; $('#brr-inn-lykilord', g).value = ''; }      /* lykilorðið stendur ekki eftir í reitnum */
    $('form', g).addEventListener('submit', function (e) {
      e.preventDefault();
      var n = $('#brr-inn-nn', g).value.trim().toUpperCase(), lyk = $('#brr-inn-lykilord', g).value;
      if (!n || !lyk) return segja('Notandanafn og lykilorð vantar.');
      takki.disabled = true;
      fetch(INN, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', nn: n, password: lyk }) }).then(svarJson).then(function (r) {
        if (r.status !== 200) {
          return segja(r.status === 401 ? 'Rangt notandanafn eða lykilorð.' : r.status === 429 ? 'Of margar rangar tilraunir. Reyndu aftur eftir nokkrar mínútur.'
            : r.status === 503 ? 'Innskráning starfsmanna hefur ekki verið sett upp á þjóninum.' : 'Innskráning mistókst.');
        }
        try { localStorage.setItem(LS_NN, n); } catch (x) {}
        return stada().then(function (s) { if (s.status === 200) valmynd(s.j); else segja('Innskráningin tókst, en leiðirnar náðust ekki. Reyndu aftur.'); });
      }).catch(function () { segja('Ekki náðist samband við þjóninn.'); });
    });
    setTimeout(function () { var r = $(nn ? '#brr-inn-lykilord' : '#brr-inn-nn', g); if (r) r.focus(); }, 30);
  }

  function lina(href, heiti, lysing, nyrFlipi) {
    return '<a class="brr-inn-lina" href="' + esc(href) + '"' + (nyrFlipi ? ' target="_blank" rel="noopener"' : '') + '><span><strong>' + esc(heiti) + '</strong>' + (lysing ? '<small>' + esc(lysing) + '</small>' : '') +
      '</span><span aria-hidden="true">' + (nyrFlipi ? '↗' : '→') + '</span></a>';
  }
  function valmynd(j) {
    var hlekkir = (Array.isArray(j.hlekkir) ? j.hlekkir : []).filter(function (x) { return x && typeof x.heiti === 'string' && typeof x.slod === 'string' && /^https:\/\//.test(x.slod) && E.slod(x.slod); }).slice(0, 12);
    var g = gluggi('<h3 id="brr-inn-titill">Innranet</h3><p>Skráð inn: <b>' + esc(j.nafn || '') + '</b>' + (j.nn ? ' (' + esc(j.nn) + ')' : '') + '</p>' +
      '<h4>Þessi vefur</h4>' +
      lina(slodMed({ ritill: '', hamur: null, innranet: null }), 'Breyta síðunni', 'Texti, myndir, kaflar og litir, beint á síðunni') +
      lina(slodMed({ ritill: '', hamur: 'itarlegt', innranet: null }), 'Stillingar síðunnar', 'Ítarlegi ritillinn: bil, horn, hver litur og leiðbeiningar fyrir Claude') +
      (j.ritstjori ? '' : '<p class="brr-hint">Þú ert ekki með hlutverkið Admin: ritillinn opnast í prufuham og vistar ekkert.</p>') +
      (hlekkir.length ? '<h4>Innri kerfi</h4>' + hlekkir.map(function (x) { return lina(E.slod(x.slod), x.heiti, typeof x.lysing === 'string' ? x.lysing : '', true); }).join('') : '') +
      '<div class="brr-hnappar"><button type="button" class="brr-h" data-r="utskra">Skrá út</button><button type="button" class="brr-h brr-blar" data-r="loka">Loka</button></div>');
    $('[data-r="utskra"]', g).addEventListener('click', function () {
      fetch(INN, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).then(svarJson).then(function (r) {
        if (r.status === 200) { loka(); skilabod('Þú hefur verið skráð(ur) út'); } else skilabod('Útskráning tókst ekki. Reyndu aftur.');
      }).catch(function () { skilabod('Útskráning tókst ekki: ekkert samband við þjóninn.'); });
    });
    setTimeout(function () { var a = $('.brr-inn-lina', g); if (a) a.focus(); }, 30);
  }

  function opna() {
    stada().then(function (r) {
      if (r.status === 200) valmynd(r.j);
      else if (r.status === 401 || r.status === 403) innskraning();
      else if (r.status === 503) { gluggi('<h3 id="brr-inn-titill">Innskráning starfsfólks</h3><p>Innskráning starfsmanna hefur ekki verið sett upp á þjóninum.</p><div class="brr-hnappar"><button type="button" class="brr-h brr-blar" data-r="loka">Loka</button></div>'); }
      else skilabod('Ekki náðist samband við þjóninn. Reyndu aftur.');
    }).catch(function () { skilabod('Ekki náðist samband við þjóninn. Reyndu aftur.'); });
  }
  window.BH_INNRANET = { opna: opna, loka: loka };
  opna();
})();
