/* Innskráning starfsfólks á síðunni: „Innranet“ í fætinum, eða ?innranet aftan við slóðina. Hleðst aðeins þá (site/efni.js).
   Innskráningin er sú sama og í stjórnstöðinni og Slökkvitæki-appinu (notendaskrá starfsmanna, cookie hub_user).
   Eftir innskráningu: breyta síðunni, stillingar hennar, og leiðir í innri kerfin. Þær leiðir koma frá þjóninum
   (/api/vefur-efni?innranet=1) og standa ekki í þessari skrá, svo gestir sjái þær ekki.
   Skjárinn sjálfur (premium útlitið) er í site/innskraning.js og site/innskraning.css, sem hlaðast á undan þessari skrá. */
(function () {
  'use strict';
  var E = window.BH_EFNI, S = window.BH_INNSKRANING, d = document;
  if (!E || !E.api || !S || window.BH_INNRANET) return;
  var API = E.api, INN = API.replace(/[^\/]*$/, 'hub-adgangar'), LS_NN = 'bh_ritill_nn';
  var esc = S.esc, takn = S.takn;

  function $(sel, rot) { return (rot || d).querySelector(sel); }
  function svarJson(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; }); }
  function slodMed(br) {
    var u = new URL(location.href);
    Object.keys(br).forEach(function (k) { if (br[k] === null) u.searchParams.delete(k); else u.searchParams.set(k, br[k]); });
    return u.pathname.replace(/^\/{2,}/, '/') + u.search.replace(/=(?=&|$)/g, '') + u.hash;      /* aldrei tvö skástrik fremst: það væri annað lén */
  }
  /* þegar skjánum er lokað fer ?innranet úr slóðinni, svo endurhleðsla opni hann ekki aftur */
  function urSlod() {
    try { if (new URLSearchParams(location.search).has('innranet')) history.replaceState(history.state, '', slodMed({ innranet: null })); } catch (e) {}
  }
  function skjar(html, breitt) { return S.skjar({ html: html, breitt: breitt, klasi: 'brr-innranet', titillId: 'brr-inn-titill', vidLokun: urSlod }); }
  function stada() { return fetch(API + '?innranet=1', { credentials: 'same-origin', cache: 'no-store' }).then(svarJson); }

  function innskraning() {
    var nn = '';
    try { nn = localStorage.getItem(LS_NN) || ''; } catch (e) {}
    /* skjárinn sem allir geta opnað segir ekkert um innri kerfin: aðeins notandanafn og lykilorð */
    var g = skjar(S.form({ titillId: 'brr-inn-titill', idNn: 'brr-inn-nn', idLyk: 'brr-inn-lykilord', nn: nn, auka: 'Hætta við', aukaR: 'loka' }));
    var takki = $('button[type="submit"]', g), villa = $('[data-r="villa"]', g);
    /* lykilorðið stendur ekki eftir í reitnum, og fókusinn fer í hann: hnappurinn var óvirkur á meðan og sleppti honum */
    function segja(s) { var lr = $('#brr-inn-lykilord', g); villa.hidden = false; villa.textContent = s; takki.disabled = false; lr.value = ''; lr.focus(); }
    $('form', g).addEventListener('submit', function (e) {
      e.preventDefault();
      var n = $('#brr-inn-nn', g).value.trim().toUpperCase(), lyk = $('#brr-inn-lykilord', g).value;
      if (!n || !lyk) return segja('Notandanafn og lykilorð vantar.');
      takki.disabled = true;
      fetch(INN, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', nn: n, password: lyk }) }).then(svarJson).then(function (r) {
        if (r.status !== 200) {
          return segja(r.status === 401 ? 'Rangt notandanafn eða lykilorð.' : r.status === 429 ? 'Of margar rangar tilraunir. Reyndu aftur eftir nokkrar mínútur.'
            : r.status === 503 ? 'Innskráning hefur ekki verið sett upp á þjóninum.' : 'Innskráning mistókst.');
        }
        try { localStorage.setItem(LS_NN, n); } catch (x) {}
        return stada().then(function (s) { if (s.status === 200) valmynd(s.j); else segja('Innskráningin tókst, en leiðirnar náðust ekki. Reyndu aftur.'); });
      }).catch(function () { segja('Ekki náðist samband við þjóninn.'); });
    });
    setTimeout(function () { var r = $(nn ? '#brr-inn-lykilord' : '#brr-inn-nn', g); if (r) r.focus(); }, 30);
  }

  function lina(href, heiti, lysing, mynd, nyrFlipi) {
    return '<a class="bhi-lina" href="' + esc(href) + '"' + (nyrFlipi ? ' target="_blank" rel="noopener"' : '') + '><span class="bhi-takn">' + takn(mynd) + '</span><span class="bhi-linutexti"><strong>' + esc(heiti) + '</strong>' +
      (lysing ? '<small>' + esc(lysing) + '</small>' : '') + '</span><span class="bhi-or" aria-hidden="true">' + takn(nyrFlipi ? 'orUt' : 'or') + '</span></a>';
  }
  function valmynd(j) {
    var hlekkir = (Array.isArray(j.hlekkir) ? j.hlekkir : []).filter(function (x) { return x && typeof x.heiti === 'string' && typeof x.slod === 'string' && /^https:\/\//.test(x.slod) && E.slod(x.slod); }).slice(0, 12);
    var g = skjar('<h2 class="bhi-titill" id="brr-inn-titill">Innranet</h2><p class="bhi-undir">Skráð inn: <b>' + esc(j.nafn || '') + '</b>' + (j.nn ? ' (' + esc(j.nn) + ')' : '') + '</p>' +
      '<h3 class="bhi-kafli">Þessi vefur</h3>' +
      lina(slodMed({ ritill: '', hamur: null, innranet: null }), 'Breyta síðunni', 'Texti, myndir, kaflar og litir, beint á síðunni', 'penni') +
      lina(slodMed({ ritill: '', hamur: 'itarlegt', innranet: null }), 'Stillingar síðunnar', 'Ítarlegi ritillinn: bil, horn, hver litur og leiðbeiningar fyrir Claude', 'stillingar') +
      (j.ritstjori ? '' : '<p class="bhi-ath">Þú ert ekki með hlutverkið Admin: ritillinn opnast í prufuham og vistar ekkert.</p>') +
      (hlekkir.length ? '<h3 class="bhi-kafli">Innri kerfi</h3>' + hlekkir.map(function (x) { return lina(E.slod(x.slod), x.heiti, typeof x.lysing === 'string' ? x.lysing : '', 'kerfi', true); }).join('') : '') +
      '<div class="bhi-hnappar"><button type="button" class="bhi-auka" data-r="utskra">' + takn('ut') + '<span>Skrá út</span></button><button type="button" class="bhi-dokk" data-bhi="loka" data-r="loka">Loka</button></div>', true);
    $('[data-r="utskra"]', g).addEventListener('click', function () {
      fetch(INN, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).then(svarJson).then(function (r) {
        if (r.status === 200) { S.loka(); S.skilabod('Þú hefur verið skráð(ur) út'); } else S.skilabod('Útskráning tókst ekki. Reyndu aftur.');
      }).catch(function () { S.skilabod('Útskráning tókst ekki: ekkert samband við þjóninn.'); });
    });
    setTimeout(function () { var a = $('.bhi-lina', g); if (a) a.focus(); }, 30);
  }

  function opna() {
    stada().then(function (r) {
      if (r.status === 200) valmynd(r.j);
      else if (r.status === 401 || r.status === 403) innskraning();
      else if (r.status === 503) {
        skjar('<h2 class="bhi-titill" id="brr-inn-titill">Innskráning</h2><p class="bhi-undir">Innskráning hefur ekki verið sett upp á þjóninum.</p>' +
          '<div class="bhi-hnappar"><button type="button" class="bhi-dokk" data-bhi="loka" data-r="loka">Loka</button></div>');
      } else S.skilabod('Ekki náðist samband við þjóninn. Reyndu aftur.');
    }).catch(function () { S.skilabod('Ekki náðist samband við þjóninn. Reyndu aftur.'); });
  }
  window.BH_INNRANET = { opna: opna, loka: S.loka };
  opna();
})();
