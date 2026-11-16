/* Útgáfuvakt (16.11.2026) — lætur vita þegar ný útgáfa af hubbnum er komin í loftið.
 *
 * Agnar 16.11.2026: „ennndalaust vesen á öllum sessions í dag". Hubbinn er ein síða sem hleður kóðanum EINU SINNI, við
 * opnun. Flipi sem stendur opinn allan daginn keyrir því gamlan kóða áfram eftir hvert [deploy] — lagfæring sem fór út
 * kl. 16:49 „virkaði ekki" í flipa sem var opnaður kl. 14, og gamli kóðinn hélt áfram að gera það sem búið var að laga
 * (yfirvinna sett á verk þar sem hún er ekki leyfð, viðvörun sem bar saman við úrelt eintak).
 *
 * Hvað þetta gerir: les /build.json (kyrrstæð skrá sem hvert deploy skrifar: {commit, time}) við hleðslu, og aftur á
 * 5 mín. fresti og þegar flipinn verður sýnilegur. Breytist commit birtist gylltur borði efst: smellur endurhleður.
 * ALDREI sjálfvirk endurhleðsla — óvistuð vinna í opnum ritli má ekki tapast; notandinn velur augnablikið.
 * Engin skrif, engin gagnagrunnsköll; mistakist lesturinn gerist ekkert. Slökkt í innfelldum ramma (?bhframe=1). */
(function () {
  'use strict';
  if (window.__bhUtgafuvakt) return; window.__bhUtgafuvakt = true;
  try { if (/[?&]bhframe=1/.test(location.search)) return; } catch (_) {}
  var MILLIBIL = 5 * 60 * 1000;
  var upphaf = null, synt = false, sidast = 0;

  function lesa() {
    return fetch('/build.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.commit) ? String(j.commit) : null; })
      .catch(function () { return null; });
  }
  function bordi(nytt) {
    if (synt || document.getElementById('bh-ny-utgafa')) return; synt = true;
    var el = document.createElement('button');
    el.id = 'bh-ny-utgafa'; el.type = 'button';
    el.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;max-width:min(720px,94vw);'
      + 'padding:11px 20px;border-radius:12px;border:1px solid #5a4410;background:linear-gradient(180deg,#f3dc95,#b8892e);color:#2e2004;'
      + 'font:600 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:pointer;text-align:center';
    el.innerHTML = '🔄 <b>Ný útgáfa af síðunni er komin.</b> Smelltu hér til að uppfæra'
      + '<span style="display:block;font-weight:400;font-size:12px;opacity:.85">Vistaðu fyrst ef þú ert með óvistaðar breytingar — þessi flipi keyrir eldri útgáfu þar til hann er uppfærður.</span>';
    el.title = 'Útgáfa ' + nytt + ' er í loftinu; þessi flipi keyrir ' + (upphaf || '?');
    el.onclick = function () { try { location.reload(); } catch (_) { location.href = location.href; } };
    (document.body || document.documentElement).appendChild(el);
  }
  function athuga() {
    if (synt) return;
    var nu = Date.now(); if (nu - sidast < 60 * 1000) return; sidast = nu;   // mest einu sinni á mínútu, þótt flipinn blikki
    lesa().then(function (c) {
      if (!c) return;
      if (upphaf == null) { upphaf = c; return; }
      if (c !== upphaf) bordi(c);
    });
  }
  athuga();
  setInterval(function () { if (document.visibilityState === 'visible') athuga(); }, MILLIBIL);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') athuga(); });
  window.bhUtgafaAthuga = function () { sidast = 0; athuga(); };   // fyrir prófun
})();
