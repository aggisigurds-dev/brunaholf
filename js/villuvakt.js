/* villuvakt.js — grípur JS-villur og skilar þeim á /api/villur.
 * ────────────────────────────────────────────────────────────────────────
 * Sjálf-innihaldið, engar pakkanir, einn <script src> (eins og viewmode.js).
 * Sama skrá er notuð í BÁÐUM öppunum; `uppruni` ræðst af léninu.
 *
 * AF HVERJU: fram að þessu sáust JS-villur AÐEINS ef einhver hafði console-ið
 * opið. Síða gat verið biluð dögum saman án þess að nokkur vissi — það var
 * gatið („villuvöktun — stærsta gatið", Agnar 2026-07-31).
 *
 * SENTRY: um leið og DSN er til er honum stungið inn hér (eða í
 * window.SENTRY_DSN áður en þessi skrá hleðst) og þá fer villan BÆÐI í Sentry
 * og í okkar eigin töflu. Án DSN er Sentry einfaldlega sleppt — vöktunin
 * virkar samt, í dag.
 */
(function () {
  if (window.__villuvaktUppsett) return;
  window.__villuvaktUppsett = true;

  var API = (location.hostname.indexOf('brunaholf') !== -1 || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? '/api/villur'
    : 'https://brunaholf.netlify.app/api/villur';
  var UPPRUNI = location.hostname.indexOf('slokkvitaeki') !== -1 ? 'slokkvitaeki' : 'brunaholf';

  // ── Hemlar. Ein lykkja sem kastar villu getur sent þúsundir beiðna á
  //    sekúndu; það er verra en engin vöktun. Þrennt ver okkur:
  //      1. sama villan er send EINU SINNI per lotu (bakendinn telur saman)
  //      2. þak á heildarfjölda sendinga per lotu
  //      3. villa í sendingunni sjálfri má ALDREI kalla á sendingu aftur
  var sed = {}, sent = 0, MAX_SENDINGAR = 12;

  function senda(tegund, skilabod, skra, stafli) {
    try {
      skilabod = String(skilabod || '').slice(0, 500);
      if (!skilabod) return;
      // Ritlar/viðbætur í vafranum henda villum sem koma okkur ekki við.
      if (/ResizeObserver loop|Script error\.?$/i.test(skilabod)) return;

      var lykill = skilabod + '|' + (skra || '');
      if (sed[lykill] || sent >= MAX_SENDINGAR) return;
      sed[lykill] = 1; sent++;

      var gogn = {
        uppruni: UPPRUNI, tegund: tegund, skilabod: skilabod,
        slod: (location.pathname + location.hash).slice(0, 300),
        skra: skra || null,
        stafli: stafli ? String(stafli).slice(0, 4000) : null,
        vafri: navigator.userAgent.slice(0, 300),
        notandi: notandi(),
      };

      // keepalive svo skýrslan lifi af að síðunni sé lokað í sömu andrá.
      fetch(API, {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(gogn),
      }).catch(function () {});   // ALDREI kasta héðan — sjá lið 3 að ofan

      if (window.Sentry && Sentry.captureMessage) {
        try { Sentry.captureMessage(skilabod, { level: 'error', extra: gogn }); } catch (_) {}
      }
    } catch (_) {}
  }

  function notandi() {
    try {
      return localStorage.getItem('ky_eg') || localStorage.getItem('bs_employee') ||
             localStorage.getItem('starfsmadur') || null;
    } catch (_) { return null; }
  }

  window.addEventListener('error', function (e) {
    // Villur á <img>/<script> koma líka hingað en bera ekkert `error`-hlut.
    if (e && e.target && e.target !== window && e.target.tagName) {
      var s = e.target.src || e.target.href;
      if (s) senda('audlind', 'Náði ekki í ' + e.target.tagName.toLowerCase(), String(s).slice(0, 300), null);
      return;
    }
    senda('onerror', (e && (e.message || (e.error && e.error.message))) || 'Óþekkt villa',
          e && e.filename ? e.filename + ':' + e.lineno + ':' + e.colno : null,
          e && e.error && e.error.stack);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    senda('unhandledrejection', (r && (r.message || r)) || 'Loforð féll án meðhöndlunar',
          null, r && r.stack);
  });

  // Handvirkt: Villuvakt.skra('eitthvað fór úrskeiðis', villa)
  window.Villuvakt = {
    skra: function (skilabod, villa) {
      senda('handvirk', skilabod, null, villa && villa.stack);
    },
  };
})();
