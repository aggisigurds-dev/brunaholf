/* viewmode.js — Sími / Spjaldtölva / Tölva forskoðun fyrir brunahólf-hubbið.
 *
 * Lítill fljótandi rofi (📱 📲 🖥). „Tölva" = venjulegt app. „Sími"/„Spjaldtölva"
 * birta appið í miðjuðum device-ramma (iframe í réttri breidd) svo ALLAR
 * @media-reglur svara eins og á alvöru tæki — ekki bara það sem við stílum
 * sérstaklega. Valið geymist í localStorage (bh_viewmode).
 *
 * Sjálf-innihaldið: einn <script src> í index.html. Iframe-eintakið keyrir sama
 * skjal með ?bhframe=1 og römmum sig þá EKKI aftur (bara venjulegt app).
 */
(function () {
  var KEY = 'bh_viewmode';
  var WIDTHS = { mobile: 390, tablet: 834 };
  var LABELS = [['mobile', '📱', 'Sími'], ['tablet', '📲', 'Spjaldtölva'], ['desktop', '🖥', 'Tölva']];
  var params = new URLSearchParams(location.search);
  var FRAMED = params.get('bhframe') === '1';

  function mode() { try { return localStorage.getItem(KEY) || 'desktop'; } catch (_) { return 'desktop'; } }
  function setMode(m) { try { localStorage.setItem(KEY, m); } catch (_) {} }

  // Slóð fyrir innri iframe: sama skjal + ?bhframe=1, hash varðveitt.
  function framedUrl() {
    var p = new URLSearchParams(location.search); p.set('bhframe', '1');
    return location.pathname + '?' + p.toString() + location.hash;
  }

  function seg(active, onPick) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:inline-flex;gap:2px;background:#0f172a;border:1px solid #334155;border-radius:11px;padding:3px;box-shadow:0 8px 24px -8px rgba(0,0,0,.5);font-family:-apple-system,Segoe UI,Roboto,sans-serif';
    LABELS.forEach(function (o) {
      var b = document.createElement('button');
      var on = o[0] === active;
      b.type = 'button'; b.title = o[2];
      b.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:1px;min-width:46px;padding:5px 8px;border:0;border-radius:8px;cursor:pointer;font:inherit;font-size:9px;font-weight:700;' +
        (on ? 'background:#2563eb;color:#fff' : 'background:transparent;color:#94a3b8');
      b.innerHTML = '<span style="font-size:15px;line-height:1">' + o[1] + '</span><span>' + o[2] + '</span>';
      b.onclick = function () { onPick(o[0]); };
      wrap.appendChild(b);
    });
    return wrap;
  }

  function pick(m) {
    if (m === mode()) return;
    setMode(m);
    if (FRAMED) { try { window.top.location.reload(); } catch (_) { location.reload(); } }
    else location.reload();
  }

  // ── Innri (römmuð) eintak: gera ekkert nema leyfa venjulegu appi að birtast ──
  if (FRAMED) return;

  function ready(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    var m = mode();
    if (m === 'mobile' || m === 'tablet') {
      buildFrame(m);
    } else {
      buildFloatingToggle();
    }
  });

  // Fljótandi rofi neðst til vinstri (Tölvu-ham).
  function buildFloatingToggle() {
    var host = document.createElement('div');
    host.id = '_bh-viewmode';
    host.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000';
    host.appendChild(seg('desktop', pick));
    document.body.appendChild(host);
  }

  // Device-rammi: fela venjulega appið, sýna miðjaðan iframe í tæki-breidd.
  function buildFrame(m) {
    var w = WIDTHS[m] || 390;
    // Fela raunverulega body-innihaldið (án þess að eyða því).
    var hideId = '_bh-frame-hide';
    if (!document.getElementById(hideId)) {
      var st = document.createElement('style'); st.id = hideId;
      st.textContent = 'body > *:not(#_bh-frame){display:none!important}';
      document.head.appendChild(st);
    }
    var overlay = document.createElement('div');
    overlay.id = '_bh-frame';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:radial-gradient(circle at 50% 0%,#1e293b,#020617);display:flex;flex-direction:column;align-items:center;gap:14px;padding:16px 8px;overflow:auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif';

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center';
    bar.appendChild(seg(m, pick));
    var cap = document.createElement('span');
    cap.style.cssText = 'color:#94a3b8;font-size:12px;font-weight:600';
    cap.textContent = (m === 'mobile' ? '📱 Sími' : '📲 Spjaldtölva') + ' · ' + w + 'px forskoðun';
    bar.appendChild(cap);
    overlay.appendChild(bar);

    var frameWrap = document.createElement('div');
    frameWrap.style.cssText = 'flex:1 1 auto;width:min(' + w + 'px,96vw);max-width:96vw;display:flex';
    var ifr = document.createElement('iframe');
    ifr.src = framedUrl();
    ifr.style.cssText = 'flex:1 1 auto;width:100%;border:0;border-radius:22px;background:#fff;box-shadow:0 30px 80px -20px rgba(0,0,0,.7),0 0 0 10px #0b1220,0 0 0 12px #1e293b';
    frameWrap.appendChild(ifr);
    overlay.appendChild(frameWrap);

    document.body.appendChild(overlay);
  }
})();
