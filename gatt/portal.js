/* portal.js — Þjónustuvefur (kúndavefur) framendi.
 * Sækir gögn úr /api/gatt (innskráð session). ?demo=1 sýnir hönnunina með
 * sýnishorns-gögnum (engin auðkenning) svo hægt sé að skoða útlitið á forskoðun.
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var fmtKr = function (n) { return (n == null || n === '') ? '—' : Number(n).toLocaleString('is-IS') + ' kr.'; };
  var fmtDate = function (d) {
    if (!d) return '—';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
    return m ? (m[3] + '.' + m[2] + '.' + m[1]) : String(d);
  };
  var TYPE_LABEL = { uttektarskyrsla: 'Slökkvitæki', brunakerfi: 'Brunakerfi' };

  /* ── SÝNISHORN (úr v3 Steel hönnun) ── */
  var DEMO = {
    account: { name: 'Center Hótel', theme: 'steel' },
    stats: [
      { k: 'Byggingar', v: '11' }, { k: 'Slökkvitæki', v: '155' }, { k: 'Brunaslöngur', v: '77' },
      { k: 'Brunakerfi', v: '10', s: 'hús' }, { k: 'Skoðun á tíma', v: '1', s: 'hús', dark: true },
    ],
    buildings: [
      { nafn: 'Arnarhvoll', heimilisfang: 'Ingólfsstræti 1, 101 Reykjavík', sl: 13, slo: 8, br: true, y: [['no', 'ok'], ['ok', 'ok'], ['ok', 'ok'], ['ok', 'ok']], nt: 'Tæki: 01.01.2027|Kerfi: 01.05.2027' },
      { nafn: 'Grandi', heimilisfang: 'Seljavegur 2, 101 Reykjavík', sl: 14, slo: 11, br: true, y: [['ok', 'ok'], ['ok', 'ok'], ['ok', 'ok'], ['ok', 'ok']], nt: 'Tæki: 01.01.2027|Kerfi: 01.03.2027' },
      { nafn: 'Hlaðvarpinn', heimilisfang: 'Aðalstræti 4, 101 Reykjavík', sl: null, slo: null, br: true, y: [['no', 'no'], ['no', 'ok'], ['no', 'ok'], ['no', 'ok']], nt: 'Tæki: —|Kerfi: 01.06.2027' },
      { nafn: 'Klöpp', heimilisfang: 'Klapparstígur 26, 101 Reykjavík', sl: 18, slo: 10, br: true, y: [['no', 'ok'], ['ok', 'ok'], ['ok', 'ok'], ['ok', 'ok']], nt: 'Tæki: 01.07.2027|Kerfi: 01.10.2026' },
      { nafn: 'Laugavegur', heimilisfang: 'Laugavegur 95–99, 101 Reykjavík', sl: 15, slo: null, br: true, y: [['ok', 'no'], ['ok', 'ok'], ['ok', 'ok'], ['ok', 'ok']], nt: 'Tæki: 01.08.2027|Kerfi: 01.09.2027' },
      { nafn: 'Miðgarður', heimilisfang: 'Laugavegur 120, 101 Reykjavík', sl: 31, slo: null, br: true, y: [['ok', 'no'], ['ok', 'ok'], ['ok', 'ok'], ['due', 'ok']], nt: 'Tæki: 01.09.2026|Kerfi: 01.09.2027', ontime: '01.09.2026' },
      { nafn: 'Plaza', heimilisfang: 'Aðalstræti 4–6, 101 Reykjavík', sl: 44, slo: 39, br: true, y: [['ok', 'no'], ['ok', 'ok'], ['ok', 'ok'], ['ok', 'due']], nt: 'Tæki: 01.08.2027|Kerfi: 01.12.2026' },
      { nafn: 'Skjaldbreið', heimilisfang: 'Laugavegur 16, 101 Reykjavík', sl: 3, slo: null, br: true, y: [['no', 'no'], ['no', 'ok'], ['ok', 'ok'], ['ok', 'ok']], nt: 'Tæki: 01.07.2027|Kerfi: 01.09.2027' },
    ],
    reports: [
      { dags: '2026-08-03', bygging: 'Klöpp', heimilisfang: 'Klapparstígur 26', tegund: 'Slökkvitæki og slöngur', magn: '18 + 10', ar: 2026 },
      { dags: '2026-08-03', bygging: 'Skjaldbreið', heimilisfang: 'Laugavegur 16', tegund: 'Slökkvitæki', magn: '3', ar: 2026 },
      { dags: '2026-05-01', bygging: 'Arnarhvoll', heimilisfang: 'Ingólfsstræti 1', tegund: 'Brunakerfi', magn: null, ar: 2026 },
      { dags: '2026-03-01', bygging: 'Grandi', heimilisfang: 'Seljavegur 2', tegund: 'Brunakerfi', magn: null, ar: 2026 },
      { dags: '2026', bygging: 'Grandi', heimilisfang: 'Seljavegur 2', tegund: 'Slökkvitæki og slöngur', magn: '14 + 11', ar: 2026 },
      { dags: '2025-12-01', bygging: 'Plaza', heimilisfang: 'Aðalstræti 4–6', tegund: 'Brunakerfi', magn: null, ar: 2025 },
      { dags: '2025-10-01', bygging: 'Klöpp', heimilisfang: 'Klapparstígur 26', tegund: 'Brunakerfi', magn: null, ar: 2025 },
      { dags: '2025-09-01', bygging: 'Laugavegur', heimilisfang: 'Laugavegur 95–99', tegund: 'Brunakerfi', magn: null, ar: 2025 },
      { dags: '2025-09-01', bygging: 'Miðgarður', heimilisfang: 'Laugavegur 120', tegund: 'Brunakerfi', magn: null, ar: 2025 },
      { dags: '2025-09-01', bygging: 'Skjaldbreið', heimilisfang: 'Laugavegur 16', tegund: 'Brunakerfi', magn: null, ar: 2025 },
      { dags: '2025-09-01', bygging: 'Þingholt', heimilisfang: 'Þingholtsstræti 3–5', tegund: 'Brunakerfi', magn: null, ar: 2025 },
    ],
    invoices: [
      { nr: 'R-000668', dags: '2026-08-03', bygging: 'Klöpp', lysing: 'Úttekt — slökkvitæki og brunaslöngur', upphaed: 174747 },
      { nr: 'R-000670', dags: '2026-08-03', bygging: 'Skjaldbreið', lysing: 'Úttekt — slökkvitæki', upphaed: 19778 },
      { nr: 'R-107802', dags: '2026', bygging: 'Plaza', lysing: 'Þjónusta', upphaed: null },
      { nr: 'R-108001', dags: '2026', bygging: 'Grandi', lysing: 'Þjónusta', upphaed: null },
      { nr: 'R-108134', dags: '2026', bygging: 'Grandi', lysing: 'Þjónusta', upphaed: null },
      { nr: 'R-107257', dags: '2025', bygging: 'Plaza', lysing: 'Úttekt', upphaed: null },
      { nr: 'R-107258', dags: '2025', bygging: 'Arnarhvoll', lysing: 'Úttekt', upphaed: null },
      { nr: 'R-107259', dags: '2025', bygging: 'Miðgarður', lysing: 'Úttekt', upphaed: null },
      { nr: 'R-107260', dags: '2025', bygging: 'Laugavegur', lysing: 'Úttekt', upphaed: null },
      { nr: 'R-107261', dags: '2025', bygging: 'Þingholt', lysing: 'Úttekt', upphaed: null },
      { nr: 'R-107053', dags: '2025', bygging: 'Skjaldbreið', lysing: 'Þjónusta', upphaed: null },
    ],
  };

  var state = { data: null, demo: false };

  /* ── boot ── */
  function boot() {
    var demo = /[?&]demo=1/.test(location.search);
    if (demo) { state.demo = true; renderPortal(DEMO); showDemoRibbon(); return; }
    fetch('/api/gatt', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) { showLogin(); return null; }  // 401/503/o.fl. → hreint innskráningarform
        return r.json();
      })
      .then(function (d) { if (d) renderPortal(normalize(d)); })
      .catch(function () { showLogin(); });
  }

  /* Map API-svar → sama form og DEMO */
  function normalize(d) {
    var s = d.stats || {};
    return {
      account: d.account || {},
      stats: [
        { k: 'Byggingar', v: s.byggingar != null ? String(s.byggingar) : '—' },
        { k: 'Slökkvitæki', v: s.taeki_alls != null ? String(s.taeki_alls) : '—' },
        { k: 'Brunaslöngur', v: '—' },
        { k: 'Brunakerfi', v: '—' },
        { k: 'Skoðun á tíma', v: s.i_lagi != null ? String(s.i_lagi) : '—', s: 'hús', dark: true },
      ],
      buildings: (d.buildings || []).map(function (b) {
        return { nafn: b.nafn, heimilisfang: b.heimilisfang, sl: b.taeki, slo: null, br: b.i_thjonustu,
          y: yearsFromStatus(b), nt: '', docId: null, stada: b.stada };
      }),
      reports: (d.reports || []).map(function (r) {
        return { docId: r.docId, dags: r.dags || r.ar, bygging: r.bygging, heimilisfang: '', tegund: TYPE_LABEL[r.tegund] || r.tegund, magn: r.magn, ar: r.ar };
      }),
      invoices: (d.invoices || []).map(function (i) {
        return { docId: i.docId, nr: i.nr, dags: i.dags || i.ar, bygging: i.bygging, lysing: '', upphaed: i.upphaed };
      }),
    };
  }
  function yearsFromStatus(b) {
    // Einföld nálgun þar til full 4-ára tafla er reiknuð server-megin.
    var cur = b.sidasta_ar || 0;
    return ['2023', '2024', '2025', '2026'].map(function (y) {
      var on = b.stada === 'ok' && Number(y) <= cur ? 'ok' : (b.stada === 'engin_skyrsla' ? 'no' : (Number(y) <= cur ? 'ok' : 'no'));
      return [on, on];
    });
  }

  /* ── LOGIN ── */
  function showLogin(msg) {
    $('#portal').classList.add('hidden');
    $('#login').classList.remove('hidden');
    if (msg) $('#lerr').textContent = msg;
  }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('#lerr').textContent = '';
    var email = $('#email').value, password = $('#password').value;
    fetch('/api/gatt-login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) { $('#login').classList.add('hidden'); boot(); }
        else $('#lerr').textContent = res.j.error || 'Rangt netfang eða lykilorð';
      })
      .catch(function () { $('#lerr').textContent = 'Villa við innskráningu. Reyndu aftur.'; });
  });

  /* ── PORTAL ── */
  function renderPortal(data) {
    state.data = data;
    document.documentElement.setAttribute('data-theme', (data.account && data.account.theme) || 'steel');
    $('#login').classList.add('hidden');
    $('#portal').classList.remove('hidden');
    var d = new Date();
    var today = ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
    $('#yf-kicker').textContent = 'Staða brunavarna · uppfært ' + today;
    renderCards(data.stats);
    renderYfirlit(data.buildings);
    renderChips('#sk-chips', data.reports, renderSkyrslur);
    renderChips('#re-chips', data.invoices, renderReikningar);
    renderSkyrslur('');
    renderReikningar('');
    wireNav();
  }

  function renderCards(stats) {
    $('#cards').innerHTML = (stats || []).map(function (c) {
      return '<div class="sc' + (c.dark ? ' dark' : '') + '"><div class="k">' + esc(c.k) + '</div>' +
        '<div class="v">' + esc(c.v) + (c.s ? ' <small>' + esc(c.s) + '</small>' : '') + '</div></div>';
    }).join('');
  }

  function markCell(pair) {
    function m(v) { return v === 'ok' ? '✓' : v === 'due' ? '<span class="due">!</span>' : '<span class="no">—</span>'; }
    return '<div class="mk">' + m(pair[0]) + ' ' + m(pair[1]) + '</div>';
  }
  function renderYfirlit(bldgs) {
    var yrs = ["'23", "'24", "'25", "'26"];
    $('#yf-body').innerHTML = (bldgs || []).map(function (b) {
      var boxes = (b.y || []).map(function (p, i) {
        return '<div class="yb"><div class="yy">' + yrs[i] + '</div>' + markCell(p) + '</div>';
      }).join('');
      var next = '';
      if (b.nt) {
        var parts = b.nt.split('|');
        next = parts.map(function (line) {
          var kv = line.split(':');
          var lbl = kv.shift(), val = kv.join(':').trim();
          var isOn = b.ontime && val.indexOf(b.ontime) > -1;
          return '<div><span class="lbl">' + esc(lbl) + ':</span> ' + (isOn ? '<b>' + esc(val) + '</b><span class="badge">Á tíma</span>' : esc(val)) + '</div>';
        }).join('');
      }
      return '<tr' + (b.ontime ? ' class="ontime"' : '') + '>' +
        '<td><div class="bname">' + esc(b.nafn) + '</div><div class="baddr">' + esc(b.heimilisfang) + '</div></td>' +
        '<td class="num">' + (b.sl != null ? b.sl : '—') + '</td>' +
        '<td class="num">' + (b.slo != null ? b.slo : '—') + '</td>' +
        '<td>' + (b.br ? 'Já' : '—') + '</td>' +
        '<td><div class="yrs">' + boxes + '</div></td>' +
        '<td><div class="next">' + (next || '<span class="dim">—</span>') + '</div></td>' +
        '<td class="r">' + docLink('Skjöl', b.docId) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="empty">Engar byggingar skráðar</td></tr>';
  }

  function docLink(label, docId) {
    if (state.demo || !docId) return '<a class="pdf" href="#" onclick="return false">' + label + '</a>';
    return '<a class="pdf" href="/api/gatt-doc?doc=' + encodeURIComponent(docId) + '" target="_blank" rel="noopener">' + label + '</a>';
  }

  function buildingsOf(rows) {
    var seen = {}, out = [];
    (rows || []).forEach(function (r) { if (r.bygging && !seen[r.bygging]) { seen[r.bygging] = 1; out.push(r.bygging); } });
    return out;
  }
  function renderChips(sel, rows, onPick) {
    var names = buildingsOf(rows);
    var html = '<button class="chip on" data-b="">Allar byggingar</button>' +
      names.map(function (n) { return '<button class="chip" data-b="' + esc(n) + '">' + esc(n) + '</button>'; }).join('');
    var box = $(sel); box.innerHTML = html;
    box.querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        box.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        onPick(c.getAttribute('data-b'));
      });
    });
  }

  function renderSkyrslur(filter) {
    var rows = (state.data.reports || []).filter(function (r) { return !filter || r.bygging === filter; });
    $('#sk-body').innerHTML = rows.map(function (r) {
      return '<tr><td class="num">' + esc(fmtDate(r.dags)) + '</td>' +
        '<td><span class="bname" style="font-size:17px">' + esc(r.bygging) + '</span></td>' +
        '<td class="dim">' + esc(r.heimilisfang || '') + '</td>' +
        '<td><span class="tb">' + esc(r.tegund) + '</span></td>' +
        '<td class="num">' + (r.magn != null ? esc(r.magn) : '<span class="dim">—</span>') + '</td>' +
        '<td class="num">' + esc(r.ar || '') + '</td>' +
        '<td class="r">' + docLink('PDF ⬇', r.docId) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="empty">Engar skýrslur skráðar</td></tr>';
  }

  function renderReikningar(filter) {
    var rows = (state.data.invoices || []).filter(function (r) { return !filter || r.bygging === filter; });
    $('#re-body').innerHTML = rows.map(function (r) {
      return '<tr><td class="kt">' + esc(r.nr || '—') + '</td>' +
        '<td class="num">' + esc(fmtDate(r.dags)) + '</td>' +
        '<td><span class="bname" style="font-size:17px">' + esc(r.bygging) + '</span></td>' +
        '<td class="dim">' + esc(r.lysing || '') + '</td>' +
        '<td class="r num">' + (r.upphaed != null ? esc(fmtKr(r.upphaed)) : '<span class="dim">—</span>') + '</td>' +
        '<td class="r">' + docLink('PDF ⬇', r.docId) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="empty">Engir reikningar skráðir</td></tr>';
  }

  /* ── nav / lang / logout ── */
  function wireNav() {
    document.querySelectorAll('nav .tab').forEach(function (t) {
      t.onclick = function () {
        document.querySelectorAll('nav .tab').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        var v = t.getAttribute('data-view');
        ['yfirlit', 'skyrslur', 'reikningar'].forEach(function (name) {
          $('#v-' + name).classList.toggle('hidden', name !== v);
        });
      };
    });
    $('#logoutBtn').onclick = function () {
      if (state.demo) { showLogin(); return; }
      fetch('/api/gatt-login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
        .then(function () { location.reload(); });
    };
    $('#langBtn').onclick = function () { /* EN/IS þýðingar koma síðar */ };
  }

  function showDemoRibbon() {
    var r = document.createElement('div'); r.className = 'demo-ribbon'; r.textContent = 'Sýnishorn';
    document.body.appendChild(r);
  }

  boot();
})();
