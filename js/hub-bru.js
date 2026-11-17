/* hub-bru.js — innfelldar Brunahólfs-síður í Slökkvitæki-appinu fá aðgang að föllunum (Powerplan lota 13, 17.11.2026).
 *
 * Föll Brunahólfs krefjast nú innskráningar (hub_user) EÐA tíma-tóka (netlify/functions/_vord.js). Á brunaholf.netlify.app
 * fylgir kakan hverju fetch og þessi skrá gerir EKKERT. Innfelld í appinu (iframe, ?embed=1) fylgir kakan EKKI
 * (SameSite=Lax milli vefja) — þá biður síðan appið um tóka og setur hann á eigin /api-köll:
 *   síða → app:  { type:'hub-toki', id }                        (postMessage, aðeins á slokkvitaeki.netlify.app)
 *   app  → síða: { type:'hub-toki-svar', id, toki, gildir_ms }  (appið fær tókann úr /api/bh-toki, sem krefst
 *                                                                 innskráningar appsins — slokkvitaeki js/patches/514-bh-bru.js)
 * Tókinn gildir 10 mín; hann er sóttur aftur mínútu áður. Svari appið ekki innan 6 sek fer kallið án tóka (og fær 401
 * ef fallið er lokað) — síðan hangir aldrei. Aðeins fetch á SAMA uppruna /api/ og /.netlify/functions/ fær tókann.
 */
(function () {
  if (window.__hubBru) return;
  window.__hubBru = true;
  var APP = 'https://slokkvitaeki.netlify.app';
  var innfellt = true;
  try { innfellt = window.self !== window.top; } catch (e) { innfellt = true; }
  var embed = window.__hubEmbed === true || /[?&]embed=1(&|$)/.test(location.search || '');
  // Sama prófun og js/postur-bru.js: Chrome/Safari segja hver foreldrið er; annars ræður ?embed=1 eða referrer.
  // postMessage(…, APP) nær aðeins til foreldris sem ER appið — vafrinn hendir skeytinu annars.
  function foreldriErApp() {
    try { var a = location.ancestorOrigins; if (a && typeof a.length === 'number' && a.length > 0) return a[0] === APP; } catch (e) {}
    return embed || String(document.referrer || '').indexOf(APP + '/') === 0;
  }
  if (!innfellt || !foreldriErApp() || typeof window.fetch !== 'function') return;

  var toki = '', gildirTil = 0, bidur = null, n = 0, bida = {};
  function saekjaToka() {
    if (toki && Date.now() < gildirTil - 60000) return Promise.resolve(toki);
    if (bidur) return bidur;
    bidur = new Promise(function (res) {
      var id = 't' + Date.now().toString(36) + '_' + (++n);
      var t = setTimeout(function () { delete bida[id]; bidur = null; res(''); }, 6000);
      bida[id] = function (d) {
        clearTimeout(t); bidur = null;
        if (d && typeof d.toki === 'string' && /^\d+\.[0-9a-f]{64}$/.test(d.toki)) {
          toki = d.toki; gildirTil = Date.now() + Math.min(Number(d.gildir_ms) || 0, 10 * 60000);
        }
        res(toki);
      };
      try { window.parent.postMessage({ type: 'hub-toki', id: id }, APP); } catch (e) { clearTimeout(t); delete bida[id]; bidur = null; res(''); }
    });
    return bidur;
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== APP || e.source !== window.parent) return;
    var d = e.data || {};
    if (d.type === 'hub-toki-svar' && bida[d.id]) { var f = bida[d.id]; delete bida[d.id]; f(d); }
  });

  function eigidFall(url) {
    try { var u = new URL(String(url), location.href); return u.origin === location.origin && /^\/(api|\.netlify\/functions)\//.test(u.pathname); }
    catch (e) { return false; }
  }
  var upphaflegt = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' || input instanceof URL ? String(input) : (input && input.url);
    if (!eigidFall(url)) return upphaflegt(input, init);
    return saekjaToka().then(function (t) {
      if (!t) return upphaflegt(input, init);
      var hausar = new Headers((init && init.headers) || (input && typeof input === 'object' && input.headers) || {});
      if (!hausar.has('x-hub-toki')) hausar.set('x-hub-toki', t);
      return upphaflegt(input, Object.assign({}, init || {}, { headers: hausar }));
    });
  };
  window.__hubBruToki = saekjaToka; // fyrir síður sem byggja slóðir (t.d. <a href>) og prófin
})();
