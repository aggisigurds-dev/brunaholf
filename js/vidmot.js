/* js/vidmot.js — VIÐMÓTSVAL sem er EINS á öllum vélum (REGLA 15.10.2026).
 *
 * Agnar: „ég vill ekki sjá neinstaðar neina slíka stillingu að það virki bara í einhverju ákveðnu
 * tæki … þetta á bara að vera eins alls staðar og haldast". Hann vinnur á fimm tölvum.
 *
 * Hubbinn (index.html) geymir ÖLL viðmótsval í hub_state:  state.ui.vidmot = { <lykill>: { v, ts } }
 * og sameinar per undirlykli þar sem hærri ts vinnur (vidmotLesa/vidmotSetja/_mergeIn). Síðurnar
 * UTAN hubbsins (verkefnalisti, jarvis, afkastavakt, multitool, skraalisti, pdf-classify, eydublod,
 * radd …) hlaða ekki `state` — þessi skrifta gefur þeim sama geymslustað:
 *
 *   Vidmot.lesa(lykill, sjalfgefid)   gildið (sjalfgefid ef ekkert/null)
 *   Vidmot.setja(lykill, gildi)       {v, ts:Date.now()} → þjónn. AÐEINS við raunverulegan smell/breytingu.
 *   Vidmot.mengi(forskeyti)           { <afgangur>: v } fyrir lykla með forskeyti og sönnu gildi
 *   Vidmot.hlada()                    Promise — sækir EINU SINNI; skilar true ef eitthvað breyttist
 *   Vidmot.vid(fall)                  fall(map) kallað þegar hlada() breytti einhverju (síðan beitir nýja gildinu)
 *
 * Hvaðan gildin koma, í þessari röð (hærri ts vinnur alltaf):
 *   1. strax: localStorage['brunaholf-app-v1'].ui.vidmot (afrit hubbsins á þessari vél, sama lén)
 *      + localStorage['bh_vidmot_v1'] (eigið skyndiminni þessarar skriftu — það sem síðurnar skrifuðu
 *      hér síðast). Hvorugt er sannleikurinn, bara það sem þessi vél sá síðast.
 *   2. einu sinni við hleðslu: GET /api/app-state?key=hub_state (≈40 KB) → .value.ui.vidmot.
 *      ALDREI pollað. Inni í iframe í hubbnum (sama lén) er lesið beint úr parent.state í stað GET.
 *
 * Skrif: POST /api/app-state { key:'hub_state', patch:{ deep:{ vidmot:{ <lykill>:{v,ts} } } } } —
 * `deep` svo hub_state_merge skrifi EINN undirlykil (p_deep) og hinir haldist; `ui:{vidmot:…}` hefði
 * skipt öllu mappinu út. Inni í hubb-iframe er kallað beint í parent.vidmotSetja (hubbinn sendir).
 * Fylki eru bönnuð sem gildi (sameinast ekki) — mengi geymast sem map {id:true} eða einn lykill per
 * atriði. Stór gildi (myndir/data-URL) fara ALDREI hingað.
 */
(function () {
  'use strict';
  var HUB_LS = 'brunaholf-app-v1', CACHE_LS = 'bh_vidmot_v1';
  var map = {};          // lykill → { v, ts }
  var hlustendur = [];
  var hladid = null;

  function erMap(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  // Sameina inn: per lykil, hærri ts vinnur. Skilar hvort eitthvað breyttist.
  function inn(src) {
    var br = false;
    if (!erMap(src)) return false;
    Object.keys(src).forEach(function (k) {
      var s = src[k]; if (!erMap(s)) return;
      var l = map[k];
      if (!l || (+s.ts || 0) > (+l.ts || 0)) { map[k] = { v: s.v, ts: +s.ts || 0 }; br = true; }
    });
    return br;
  }

  // Hubbinn sem foreldragluggi (iframe í index.html, sama lén) — hann á lifandi state og sendir sjálfur.
  // (`state` hubbsins er let-breyta og sést EKKI sem parent.state — þess vegna vidmotAllt().)
  function hub() {
    try {
      var p = window.parent;
      if (p && p !== window && typeof p.vidmotSetja === 'function' && typeof p.vidmotAllt === 'function') return p;
    } catch (_) {}
    return null;
  }

  function lesaLS() {
    try { inn(JSON.parse(localStorage.getItem(CACHE_LS) || 'null')); } catch (_) {}
    try { var h = JSON.parse(localStorage.getItem(HUB_LS) || 'null'); inn(h && h.ui && h.ui.vidmot); } catch (_) {}
  }
  function vistaCache() { try { localStorage.setItem(CACHE_LS, JSON.stringify(map)); } catch (_) {} }

  function lesa(k, d) { var e = map[k]; return (e && e.v !== undefined && e.v !== null) ? e.v : d; }

  function mengi(forskeyti) {
    var ut = {};
    Object.keys(map).forEach(function (k) {
      if (k.indexOf(forskeyti) === 0 && map[k] && map[k].v) ut[k.slice(forskeyti.length)] = map[k].v;
    });
    return ut;
  }

  function setja(k, v) {
    var e = { v: (v === undefined ? null : v), ts: Date.now() };
    map[k] = e; vistaCache();
    var p = hub();
    if (p) { try { p.vidmotSetja(k, e.v); return; } catch (_) {} }
    var patch = { ui: {}, top: {}, deep: { vidmot: {} } };
    patch.deep.vidmot[k] = e;
    try {
      fetch('/api/app-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hub_state', patch: patch }), keepalive: true
      }).catch(function () {});
    } catch (_) {}
  }

  function tilkynna() { hlustendur.forEach(function (f) { try { f(map); } catch (_) {} }); }

  function hlada() {
    if (hladid) return hladid;
    var p = hub();
    if (p) {
      var br0 = false; try { br0 = inn(p.vidmotAllt()); } catch (_) {}
      if (br0) { vistaCache(); tilkynna(); }
      hladid = Promise.resolve(br0);
      return hladid;
    }
    hladid = fetch('/api/app-state?key=hub_state', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var br = inn(j && j.value && j.value.ui && j.value.ui.vidmot);
        if (br) { vistaCache(); tilkynna(); }
        return br;
      })
      .catch(function () { return false; });
    return hladid;
  }

  lesaLS();
  window.Vidmot = { lesa: lesa, setja: setja, mengi: mengi, hlada: hlada, vid: function (f) { hlustendur.push(f); }, allt: function () { return map; } };
  // Sækja EINU SINNI þegar síðan er komin (kallendur mega kalla hlada() fyrr sjálfir).
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hlada(); });
  else hlada();
})();
