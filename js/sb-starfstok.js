/* sb-starfstok.js — innskráður starfsmaður les Supabase sem `authenticated`, ekki anon (23.11.2026).
 *
 * TILEFNI: Frá 09:36 23.11.2026 (Supabase-migration rls_starfsfolk_20261123) hefur anon ekkert GRANT á 127 töflum.
 * Síður sem lesa grunninn beint með opinbera lyklinum fengu 401: hledsluaaetlun.html (síðan brotin), Supabase-mælirinn
 * í jarvis.html (falskt rautt), og á forsíðunni kerfisheilsu-græjan og Netlify-innskotið (cowork_js_patches).
 *
 * TÁKNIÐ: window.__sbToki() → Promise<string|null>. Sótt úr /api/sb-toki (krefst köku hub_user, sjá
 * netlify/functions/sb-toki.js), geymt í minni síðunnar á meðan það gildir (10 klst, endurnýjað mínútu fyrir lok).
 * Óinnskráður (401) eða villa → null og engin ný tilraun í 60 s; kallið fer þá óbreytt (og fær 401 eins og áður).
 *
 * MILLILAG Á fetch: beiðni á https://osfdzskyvisifcwyjkuk.supabase.co/rest/v1/ með apikey-haus og annaðhvort ENGU
 * Authorization eða nákvæmlega 'Bearer ' + apikey fær 'Bearer ' + starfsmannatáknið. Annað fer óbreytt: aðrir hýslar,
 * /storage/, /auth/, /functions/, og köll sem bera eigið tákn. Fyrirmynd: millilagið í hliðinu í slokkvitaeki/index.html
 * (grein starfstok-anon-fetch, 91d9e3f5); hér er það bundið við hýsil verkefnisins.
 *
 * Hlaðið í <head> á eftir js/hub-bru.js og á undan supabase-js (sem grípur fetch þegar createClient er kallað).
 * Innfellt í Slökkvitæki-appinu (iframe) fylgir kakan ekki → /api/sb-toki svarar 401 → óbreytt hegðun.
 */
(function () {
  if (window.__sbStarfstok) return;
  window.__sbStarfstok = true;
  var HYSILL = 'osfdzskyvisifcwyjkuk.supabase.co';
  var BID_MS = 60000, FRESTUR_MS = 8000;
  var upphaflegt = window.fetch;
  if (typeof upphaflegt !== 'function') return;

  function gildur(t) {
    try {
      var b = String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var p = JSON.parse(atob(b));
      return !!(p && p.exp && p.exp * 1000 > Date.now() + 60000);
    } catch (e) { return false; }
  }

  var tok = null, bidur = null, synjadKl = 0;
  function saekja() {
    if (tok && gildur(tok)) return Promise.resolve(tok);
    if (bidur) return bidur;
    if (synjadKl && Date.now() - synjadKl < BID_MS) return Promise.resolve(null);
    var kall = upphaflegt.call(window, '/api/sb-toki', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && typeof j.sb_jwt === 'string' && gildur(j.sb_jwt)) { tok = j.sb_jwt; synjadKl = 0; return tok; }
        synjadKl = Date.now(); return null;
      }, function () { synjadKl = Date.now(); return null; });
    var teljari;
    var tima = new Promise(function (res) { teljari = setTimeout(function () { res(null); }, FRESTUR_MS); });
    bidur = Promise.race([kall, tima]).then(function (t) { clearTimeout(teljari); bidur = null; return t; });
    return bidur;
  }
  if (typeof window.__sbToki !== 'function') window.__sbToki = saekja;

  function slod(input) {
    try {
      var s = (typeof input === 'string' || (typeof URL !== 'undefined' && input instanceof URL)) ? String(input) : (input && input.url);
      return s ? new URL(s, location.href) : null;
    } catch (e) { return null; }
  }
  var nyr = function (input, init) {
    var args = arguments;
    try {
      var u = slod(input);
      if (u && u.host === HYSILL && u.pathname.indexOf('/rest/v1/') === 0) {
        var fra = (init && init.headers) || (input && typeof input === 'object' && !(typeof URL !== 'undefined' && input instanceof URL) && input.headers) || {};
        var h = new Headers(fra);
        var key = h.get('apikey'), auth = h.get('authorization');
        if (key && (!auth || auth === 'Bearer ' + key)) {
          return window.__sbToki().then(function (t) {
            if (!t) return upphaflegt.apply(window, args);
            h.set('Authorization', 'Bearer ' + t);
            var ni = {}; if (init) for (var k in init) ni[k] = init[k];
            ni.headers = h;
            return upphaflegt.call(window, input, ni);
          }, function () { return upphaflegt.apply(window, args); });
        }
      }
    } catch (e) {}
    return upphaflegt.apply(window, args);
  };
  nyr.__sbStarfstok = true;
  window.fetch = nyr;
})();
