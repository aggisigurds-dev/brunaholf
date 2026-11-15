/* postur-bru.js — póstsending úr Brunahólfi, líka þegar síðan er innfelld í Slökkvitæki-appinu (15.11.2026).
 *
 * gmail-send krefst innskráningar frá 15.11.2026 (Agnar: „aðeins innskráðir geti sent"). Á brunaholf.netlify.app
 * fylgir innskráningarkakan (hub_user) og sendingin fer beint. Innfelld í appinu (iframe, ?embed=1) fylgir hún EKKI
 * (SameSite=Lax milli vefja) og gmail-send svarar 401 — þá biður síðan appið að senda í sinn stað:
 *   síða → app:  { type:'postur-senda', id, payload }          (postMessage, aðeins á slokkvitaeki.netlify.app)
 *   app  → síða: { type:'postur-senda-svar', id, status, json } (254-receipt-sender.js → /api/postur-senda)
 * Appið krefst eigin innskráningar og sendir payload óbreytt, svo sendandi, viðhengi og villuboð eru þau sömu.
 *
 * Heilsupróf án pósts: appið getur sent { type:'postur-prufa', id } — síðan keyrir sömu leið með { prufa:true }
 * (gmail-send svarar 200 { prufa, via } og sendir EKKERT) og skilar { type:'postur-prufa-svar', id, status, json, leid }.
 *
 *   window.bhPosturSenda(payload) → Promise<{ ok, status, json, leid:'beint'|'app' }>
 */
(function () {
  if (window.bhPosturSenda) return;
  var APP = 'https://slokkvitaeki.netlify.app';
  var innfellt = true;
  try { innfellt = window.self !== window.top; } catch (e) { innfellt = true; }
  // Lesið við hleðslu, áður en síðan getur breytt slóðinni. ?embed=1 = innfelld (261-app-profiles.js).
  var embed = window.__hubEmbed === true || /[?&]embed=1(&|$)/.test(location.search || '');
  // Chrome/Safari segja hver foreldrið er (ancestorOrigins). Firefox gerir það ekki og appið sendir
  // Referrer-Policy: no-referrer, svo þar ræður ?embed=1. Öruggt hvort sem er: postMessage(…, APP) nær
  // aðeins til foreldris sem ER appið — vafrinn hendir skeytinu annars (netvörður 15.11.2026).
  function foreldriErApp() {
    try { var a = location.ancestorOrigins; if (a && typeof a.length === 'number') return a.length > 0 && a[0] === APP; } catch (e) {}
    return embed || String(document.referrer || '').indexOf(APP + '/') === 0;
  }
  var bida = {}, n = 0;

  function gegnumApp(payload) {
    return new Promise(function (res) {
      var id = 'p' + Date.now().toString(36) + '_' + (++n);
      var t = setTimeout(function () {
        delete bida[id];
        res({ ok: false, status: 0, leid: 'app', json: { error: 'TIMEOUT', message: 'Appið svaraði ekki innan 90 sek. Athugaðu Sent-möppuna áður en þú sendir aftur.' } });
      }, 90000);
      bida[id] = function (d) {
        clearTimeout(t);
        var j = (d && d.json) || {};
        var st = Number(d && d.status) || 0;
        res({ ok: st >= 200 && st < 300 && !j.error && j.ok !== false, status: st, json: j, leid: 'app' });
      };
      window.parent.postMessage({ type: 'postur-senda', id: id, payload: payload }, APP);
    });
  }

  window.bhPosturSenda = async function (payload) {
    var r, j;
    try {
      r = await fetch('/api/gmail-send', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}) });
      j = await r.json().catch(function () { return {}; });
    } catch (e) {
      return { ok: false, status: 0, leid: 'beint', json: { error: 'NETWORK', message: String((e && e.message) || e) } };
    }
    if (r.status === 401 && innfellt && foreldriErApp()) return gegnumApp(payload || {});
    return { ok: r.ok && !j.error && j.ok !== false, status: r.status, json: j, leid: 'beint' };
  };

  window.addEventListener('message', function (e) {
    if (e.origin !== APP || e.source !== window.parent) return;
    var d = e.data || {};
    if (d.type === 'postur-senda-svar' && bida[d.id]) { var f = bida[d.id]; delete bida[d.id]; f(d); return; }
    if (d.type === 'postur-prufa' && typeof d.id === 'string') {
      window.bhPosturSenda({ prufa: true }).then(function (x) {
        window.parent.postMessage({ type: 'postur-prufa-svar', id: d.id, status: x.status, json: x.json, leid: x.leid }, APP);
      });
    }
  });
})();
