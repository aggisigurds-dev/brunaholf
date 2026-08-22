/* admin.js — Viðskiptavinavefir stjórnsíða. Talar við /api/gatt-admin. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var ORIGIN = location.origin;
  var state = { access: [], messages: [] };

  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(window._t); window._t = setTimeout(function () { t.classList.remove('show'); }, 1900); }
  function copy(txt) { try { navigator.clipboard.writeText(txt); toast('Afritað'); } catch (_) { toast('Gat ekki afritað'); } }
  function urlOf(a) { return ORIGIN + '/gatt/?c=' + a.slug; }
  function api(body) { return fetch('/api/gatt-admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
  function fmtDate(d) { if (!d) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(d)); return m ? (m[3] + '.' + m[2] + '. ' + m[4] + ':' + m[5]) : String(d).slice(0, 16); }

  function load() {
    fetch('/api/gatt-admin', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { $('#accBody').innerHTML = '<tr><td colspan="4" class="empty">' + esc(d.error) + '</td></tr>'; return; }
        state.access = d.access || []; state.messages = d.messages || [];
        renderStats(); renderAccess(); renderMessages();
      })
      .catch(function () { $('#accBody').innerHTML = '<tr><td colspan="4" class="empty">Villa við að sækja gögn</td></tr>'; });
  }

  function statusOf(a) {
    if (a.active && a.hasPassword && a.email) return { c: 'on', t: 'Virkur' };
    if (!a.active) return { c: 'off', t: 'Óvirkur' };
    return { c: 'setup', t: 'Í uppsetningu' };
  }

  function renderStats() {
    var virk = state.access.filter(function (a) { return a.active && a.hasPassword && a.email; }).length;
    var ovirk = state.access.length - virk;
    var ny = state.messages.filter(function (m) { return m.sender === 'kunni' && !m.read_by_staff; }).length;
    $('#stats').innerHTML =
      '<div class="chip good"><div class="k">Virkir vefir</div><div class="v">' + virk + '</div></div>' +
      '<div class="chip"><div class="k">Í uppsetningu / óvirkir</div><div class="v">' + ovirk + '</div></div>' +
      '<div class="chip alert"><div class="k">🔔 Ný skilaboð</div><div class="v">' + ny + '</div></div>';
  }

  function renderAccess() {
    if (!state.access.length) { $('#accBody').innerHTML = '<tr><td colspan="4" class="empty">Enginn aðgangur stofnaður enn — leitaðu að fyrirtæki að ofan.</td></tr>'; return; }
    $('#accBody').innerHTML = state.access.map(function (a) {
      var st = statusOf(a);
      return '<tr class="rowline" data-id="' + a.id + '">' +
        '<td><div class="co">' + esc(a.base_nafn) + '</div><div class="kt">' + esc(a.slug || '') + '</div></td>' +
        '<td><span class="pill ' + st.c + '"><span class="dot"></span>' + st.t + '</span></td>' +
        '<td class="hide-sm acc ' + (a.email ? '' : 'none') + '">' + esc(a.email || '—') + '</td>' +
        '<td><div class="actions">' +
          '<button class="btn btn--sm" data-act="copy">⧉ Hlekkur</button>' +
          '<button class="btn btn--sm" data-act="edit">Aðgangur</button>' +
        '</div></td></tr>' +
        '<tr class="edrow hidden" data-edit="' + a.id + '"><td colspan="4" style="padding:0"></td></tr>';
    }).join('');
    // wire row buttons
    $('#accBody').querySelectorAll('.rowline').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      var a = state.access.find(function (x) { return String(x.id) === id; });
      tr.querySelector('[data-act="copy"]').onclick = function () { copy(urlOf(a)); };
      tr.querySelector('[data-act="edit"]').onclick = function () { toggleEditor(a); };
    });
  }

  function toggleEditor(a) {
    var row = $('#accBody [data-edit="' + a.id + '"]');
    if (!row.classList.contains('hidden')) { row.classList.add('hidden'); return; }
    $('#accBody').querySelectorAll('.edrow').forEach(function (r) { r.classList.add('hidden'); });
    row.querySelector('td').innerHTML = editorHtml(a);
    row.classList.remove('hidden');
    wireEditor(a, row);
  }

  function editorHtml(a) {
    return '<div class="editor"><div class="editor-in">' +
      '<div><h3>Aðgangur — ' + esc(a.base_nafn) + '</h3>' +
        '<div class="fld"><label>Aðgangsorð (netfang)</label><input class="inp" data-f="email" value="' + esc(a.email || '') + '" placeholder="nafn@fyrirtaeki.is"></div>' +
        '<div class="fld"><label>Lykilorð</label><div class="inrow">' +
          '<input class="inp mono" data-f="pw" placeholder="' + (a.hasPassword ? '•••••••• (sett — skrifaðu nýtt til að breyta)' : 'ekkert lykilorð enn') + '">' +
          '<button class="btn btn--sm" data-act="gen">Búa til</button></div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">' +
          '<button class="btn btn--sm btn--accent" data-act="save">Vista aðgang</button>' +
          '<button class="btn btn--sm" data-act="toggle">' + (a.active ? 'Afvirkja' : 'Virkja') + '</button>' +
        '</div>' +
        '<div class="note">Tómt aðgangsorð + lykilorð → innskráningin opnast EKKI hjá viðskiptavini fyrr en hvort tveggja er sett.</div>' +
      '</div>' +
      '<div><h3>Hlekkur & sending</h3>' +
        '<div class="fld"><label>Vefslóð viðskiptavinar</label><div class="urlbox"><code>' + esc(urlOf(a)) + '</code><button class="btn btn--sm" data-act="copy2">⧉</button></div></div>' +
        '<div class="divider"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn--sm" data-act="open">Opna vef ↗</button>' +
          '<button class="btn btn--sm btn--accent" data-act="send">✉ Senda á viðskiptavin</button>' +
          '<button class="btn btn--sm btn--danger" data-act="del">Aftengja</button>' +
        '</div>' +
        '<div class="note">„Senda" póstar viðskiptavini vefslóð + notandanafn (og lykilorð ef þú bjóst það til núna) gegnum Eldklár-póstinn.</div>' +
      '</div>' +
    '</div></div>';
  }

  function wireEditor(a, row) {
    var emailEl = row.querySelector('[data-f="email"]');
    var pwEl = row.querySelector('[data-f="pw"]');
    row.querySelector('[data-act="gen"]').onclick = function () {
      api({ action: 'gen-password', id: a.id }).then(function (res) {
        if (res.password) { pwEl.value = res.password; a.hasPassword = true; copy(res.password); toast('Nýtt lykilorð búið til + afritað'); }
        else toast(res.error || 'Villa');
      });
    };
    row.querySelector('[data-act="save"]').onclick = function () {
      var body = { action: 'save', id: a.id, email: emailEl.value };
      if (pwEl.value.trim()) body.password = pwEl.value.trim();
      api(body).then(function (res) { if (res.ok) { toast('Vistað'); load(); } else toast(res.error || 'Villa'); });
    };
    row.querySelector('[data-act="toggle"]').onclick = function () {
      api({ action: 'toggle', id: a.id, active: !a.active }).then(function (res) { if (res.ok) { toast(a.active ? 'Afvirkjað' : 'Virkjað'); load(); } });
    };
    row.querySelector('[data-act="copy2"]').onclick = function () { copy(urlOf(a)); };
    row.querySelector('[data-act="open"]').onclick = function () { window.open(urlOf(a), '_blank'); };
    row.querySelector('[data-act="send"]').onclick = function () {
      if (!emailEl.value.trim()) { toast('Settu netfang fyrst'); return; }
      var body = { action: 'send', id: a.id, to: emailEl.value.trim() };
      if (pwEl.value.trim()) body.password = pwEl.value.trim();
      api(body).then(function (res) { if (res.ok) toast('Sent á ' + res.sent_to); else toast(res.error || 'Sending mistókst'); });
    };
    row.querySelector('[data-act="del"]').onclick = function () {
      if (!confirm('Aftengja vef ' + a.base_nafn + '? Innskráning hættir að virka.')) return;
      api({ action: 'delete', id: a.id }).then(function (res) { if (res.ok) { toast('Aftengt'); load(); } });
    };
  }

  function renderMessages() {
    var el = $('#msgPanel');
    if (!state.messages.length) { el.innerHTML = '<div class="empty">Engin skilaboð.</div>'; return; }
    el.innerHTML = state.messages.map(function (m) {
      var unread = m.sender === 'kunni' && !m.read_by_staff;
      var replyHtml = m.sender === 'kunni'
        ? '<div class="reply"><input placeholder="Svara…" data-base="' + m.base_id + '"><button class="btn btn--sm btn--accent" data-reply="' + m.base_id + '">Svara</button></div>' : '';
      return '<div class="msg' + (unread ? ' unread' : '') + '">' +
        '<div class="av">' + (m.sender === 'kunni' ? '🏨' : '🧯') + '</div>' +
        '<div class="body"><div class="top"><span class="from">' + esc(m.base_nafn) + (m.sender === 'starf' ? ' · svar' : '') + '</span><span class="t">' + esc(fmtDate(m.created_at)) + '</span></div>' +
        '<div class="txt">' + esc(m.body) + '</div>' + replyHtml + '</div></div>';
    }).join('');
    el.querySelectorAll('[data-reply]').forEach(function (btn) {
      btn.onclick = function () {
        var base = btn.getAttribute('data-reply');
        var inp = el.querySelector('input[data-base="' + base + '"]');
        var text = inp.value.trim(); if (!text) return;
        btn.disabled = true;
        api({ action: 'reply-msg', base_id: parseInt(base, 10), body: text }).then(function (res) {
          if (res.ok) { api({ action: 'mark-read', base_id: parseInt(base, 10) }).then(load); toast('Svar sent'); }
          else { toast(res.error || 'Villa'); btn.disabled = false; }
        });
      };
    });
  }

  // ── fyrirtækjaleit → stofna aðgang ──
  var searchTimer;
  $('#coSearch').addEventListener('input', function () {
    var q = this.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 2) { $('#coResults').classList.add('hidden'); return; }
    searchTimer = setTimeout(function () {
      fetch('/api/gatt-admin?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var cos = d.companies || [];
          var box = $('#coResults');
          if (!cos.length) { box.innerHTML = '<div style="color:var(--faint)">Ekkert fannst</div>'; box.classList.remove('hidden'); return; }
          box.innerHTML = cos.map(function (c) {
            var have = state.access.some(function (a) { return a.base_id === c.id; });
            return '<div data-base="' + c.id + '"' + (have ? ' style="opacity:.5"' : '') + '>' + esc(c.nafn) + '<span class="rk">' + esc(c.kennitala || '') + (have ? ' · vefur til' : '') + '</span></div>';
          }).join('');
          box.classList.remove('hidden');
          box.querySelectorAll('[data-base]').forEach(function (row) {
            row.onclick = function () {
              var base = parseInt(row.getAttribute('data-base'), 10);
              if (state.access.some(function (a) { return a.base_id === base; })) { toast('Vefur er þegar til fyrir þetta félag'); return; }
              api({ action: 'create', base_id: base }).then(function (res) {
                if (res.ok) { toast('Aðgangur stofnaður'); $('#coSearch').value = ''; box.classList.add('hidden'); load(); }
                else toast(res.error || 'Villa');
              });
            };
          });
        });
    }, 250);
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.picker')) $('#coResults').classList.add('hidden'); });

  load();
})();
