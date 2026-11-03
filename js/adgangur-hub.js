/* Aðgangsstýring — Brunahólfs-hliðin (03.11.2026).
 *
 * Agnar: „ég þarf að geta merkt við allar síður í kerfinu … leyfðu mér að opna sýnina hjá starfsmönnunum, svo ég sjái að
 * þetta virki". Síðuvalið er stillt í Slökkvitæki-appinu (Þjónustuborð → Aðgangsstýring, patch 495) og býr í
 * hub_adgangar.sidur. Hér er því framfylgt í hliðarstiku Brunahólfs:
 *   • lyklar 'hub:<flipa-id>'; 'hub:*' = allir flipar, 'hub:!' = enginn, enginn hub-lykill = engin takmörkun.
 *     Gömlu orðin („Ajour", „Vinnubók"…) gilda EKKI hér — þau voru aldrei virk og eru aðeins tillaga í Aðgangsstýringunni.
 *   • Admin sér allt. Innskráður starfsmaður sér aðeins sína flipa (renderTabs + activeTab í index.html spyrja hubAdgSidur).
 *   • ?skoda_sem=LS (aðeins admin): stikan eins og LS sér hana, borði efst, „Hætta" skilar öllu. Geymt í sessionStorage
 *     (tímabundin staða í þessum flipa, leyfð skv. reglunni 15.10.2026).
 *   • Í ramma (?embed=1) gerir þetta ekkert — Slökkvitæki-appið stýrir þá.
 * Viðmótshlið eins og innskráningarkrafan: gögnin sjálf eru ekki læst á þjóni.
 */
(function () {
  'use strict';
  if (window.__hubEmbed) return;
  var SS = 'bh_skoda_sem';
  var S = { skoda: lesa(), synt: false };

  function lesa() { try { var j = JSON.parse(sessionStorage.getItem(SS) || 'null'); return j && Array.isArray(j.sidur) ? j : null; } catch (_) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function stada() { return window.__hubAdgangur || null; }
  function erAdmin() { var s = stada(); return !!(s && s.authed && s.user && s.user.rola === 'Admin'); }

  function settFyrir(u, iSkoda) {
    if (!u || (u.rola === 'Admin' && !iSkoda)) return null;
    var k = (u.sidur || []).filter(function (p) { return String(p).indexOf('hub:') === 0; });
    if (!k.length || k.indexOf('hub:*') > -1) return null;
    var s = new Set(); k.forEach(function (p) { if (p !== 'hub:!') s.add(p.slice(4)); }); return s;
  }
  // index.html (renderTabs, activeTab) spyr þetta: Set af leyfðum flipa-id eða null = engin takmörkun.
  window.hubAdgSidur = function () {
    if (S.skoda) return settFyrir(S.skoda, true);
    var s = stada(); return s && s.authed ? settFyrir(s.user, false) : null;
  };

  function teikna() {
    try { if (typeof renderTabs === 'function') renderTabs(); } catch (_) {}
    var leyft = window.hubAdgSidur();
    try {
      // Opinn flipi lokaður → render() sýnir fyrsta leyfða (activeTab velur hann). activeTab er per vél, engin vistun.
      if (leyft && typeof state !== 'undefined' && state.ui && !leyft.has(state.ui.activeTab) && typeof render === 'function') {
        var fyrsti = (state.tabs || []).find(function (t) { return !t.sep && leyft.has(t.id); });
        if (fyrsti) state.ui.activeTab = fyrsti.id;
        render();
      }
    } catch (_) {}
    tomt(leyft && leyft.size === 0);
    bordi();
  }
  function tomt(on) {
    var el = document.getElementById('bh-adg-tomt');
    if (!on) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div'); el.id = 'bh-adg-tomt';
    el.style.cssText = 'position:fixed;inset:0;z-index:99960;display:flex;align-items:center;justify-content:center;background:#f6f2e8;font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif;color:#1a1714;text-align:center;padding:24px';
    el.innerHTML = '<div><div style="font:700 26px/1.2 \'Playfair Display\',Georgia,serif;margin-bottom:8px">Enginn flipi opinn</div>Þú hefur ekki aðgang að neinum flipa í Brunahólfi. Talaðu við Agnar.</div>';
    document.body.appendChild(el);
  }
  function bordi() {
    var b = document.getElementById('bh-adg-bordi');
    if (!S.skoda) { if (b) b.remove(); return; }
    var u = S.skoda, leyft = settFyrir(u, true);
    if (!b) {
      b = document.createElement('div'); b.id = 'bh-adg-bordi'; b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99970;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:7px 8px 7px 14px;border-radius:10px;border:1px solid #000;border-bottom:2px solid #c9a14a;background:linear-gradient(145deg,#08080a 0%,#26262c 30%,#3a3a41 50%,#19191d 75%,#070709 100%);color:#fff;font:500 12.5px/1.2 "IBM Plex Sans",system-ui,sans-serif;box-shadow:0 14px 30px -10px rgba(0,0,0,.6);flex-wrap:wrap';
      document.body.appendChild(b);
    }
    b.innerHTML = '<span style="font:700 10px/1 \'JetBrains Mono\',monospace;letter-spacing:.18em;text-transform:uppercase;color:#c9a95a">Skoða sem</span>' +
      '<b>' + esc(u.nafn) + (u.nn ? ' (' + esc(u.nn) + ')' : '') + '</b><span style="color:#aab2c0">Brunahólf: ' + (leyft ? leyft.size + (leyft.size === 1 ? ' flipi' : ' flipar') : 'allir flipar') + '</span>' +
      '<button type="button" id="bh-adg-haetta" style="height:30px;padding:0 12px;border-radius:7px;border:1px solid #7d6020;background:linear-gradient(180deg,#e9cf86,#c9a14a 55%,#a9822f);color:#2a1f08;font:600 12px/28px inherit;font-family:inherit;cursor:pointer">Hætta að skoða</button>';
    b.querySelector('#bh-adg-haetta').addEventListener('click', function () {
      S.skoda = null; try { sessionStorage.removeItem(SS); } catch (_) {}
      teikna();
    });
  }

  // ?skoda_sem=NN — aðeins admin; listinn sóttur svo síðuvalið sé nýjasta vistaða útgáfan.
  function skodaUrSlod() {
    var nn = null; try { nn = new URLSearchParams(location.search).get('skoda_sem'); } catch (_) {}
    if (!nn) return Promise.resolve();
    try { var u = new URL(location.href); u.searchParams.delete('skoda_sem'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (_) {}
    if (!erAdmin()) return Promise.resolve();
    return fetch('/api/hub-adgangar?listi=1', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var u = (j.users || []).find(function (x) { return String(x.nn || '').toUpperCase() === String(nn).toUpperCase(); });
      if (!u) return;
      S.skoda = { nn: u.nn, nafn: u.nafn, rola: u.rola, sidur: u.sidur || [] };
      try { sessionStorage.setItem(SS, JSON.stringify(S.skoda)); } catch (_) {}
    }).catch(function () {});
  }

  var keyrt = false;
  function beita() {
    if (keyrt) return; keyrt = true;
    if (S.skoda && !erAdmin()) { S.skoda = null; try { sessionStorage.removeItem(SS); } catch (_) {} }
    teikna();                                   // strax (áður en síðan birtist, sé head-hliðið enn í gangi)
    skodaUrSlod().then(function () { if (S.skoda) teikna(); });
  }
  window.__hubAdgBeita = beita;
  if (window.__hubAdgangur) beita();            // staðan kom á undan þessari skrá
})();
