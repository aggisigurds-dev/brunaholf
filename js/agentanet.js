/* agentanet.js — Jarvis lag 2: AGENTANETIÐ (Agentakerfið 2.0, fasi 5, 04.11.2026; útlit úr hönnuninni
 * „Agentanetið — Jarvis-mælaborð“ sama dag, sjá HANDOFF í agentanet-live.dc.html).
 *
 * Fjögur spjöld á jarvis.html og eitt fullskjás-lag:
 *   data-spjald="sidukort"  Síðukort — þekja per vef (data/sidukort.json), síður án eiganda, „Leggja til eiganda“ (agent_notes)
 *   data-spjald="lotur"     Lotur síðustu 7 daga — /api/lotur → charlize_sessions (Stop-hookurinn skrifar), rautt „ólokið minni“
 *   data-spjald="got"       Göt & tillögur — router-göt úr lotum + síður án eiganda → tillaga í agent_notes (sjálfsbæting með samþykki)
 *   data-spjald="minni"     Minnið — /api/charlize-stada: Charlize eftir sviði, kúnnaminni, biðstofa með Samþykkja/Hafna
 *   Agentanetið             Toppstika með KPI-smákössum · þemahnappar · netið: Jarvis-hringurinn (js/jarvis-ring.js) í miðju,
 *                           5 stjórar á innri sporbaug með púlsum, sérfræðingar utar, 321 síðupunktar á ysta baug,
 *                           agentaspjald hægra megin, varðastika neðst. Lifandi: agent sem var kallaður í lotu fær tölu.
 *                           Smellur á hnút velur (ljósar línur til þeirra sem hann kallar á + síðurnar hans), tvísmellur
 *                           eða takkinn opnar Agentaskrána (agents-panel.js).
 *
 * Uppbygging og gögn hér; útlitið (css/agentanet.css) pússar Cowork — klasarnir .pnl .nd .nd-st .nd-new .nd-sel .kc .tab
 * .gw .lnk* .li .ttl eru hönnunarinnar og haldast. Engin emoji, tákn eru inline stroke-SVG. Allt lesaðeins nema
 * agent_notes (tillögur, status 'nytt') og charlize_inbox um charlize_approve / status 'rejected'.
 * Les window.AGENTS_REGISTRY (js/agents-registry.js) — sama heimild og Agentaskráin. Ef skráin vantar gerist ekkert. */
(function () {
  'use strict';
  var R = window.AGENTS_REGISTRY;
  if (!R || !R.list) return;

  /* Lita-punktur per agent (Agnar 04.11.2026): grænn = kallaður síðasta sólarhring, gulur = innan viku, rauður = ekki
   * kallaður í lotu síðustu 7 daga (glugginn sem /api/lotur skilar). „Kallaður“ = leiðarvísir, síðuvörður eða Agent-tól (lotu-lok). */
  function stPunktur(live, n) {
    var lv = live && live[n], h = lv && lv.sidast ? (Date.now() - new Date(lv.sidast).getTime()) / 36e5 : null;
    var st = h == null ? 'r' : h <= 24 ? 'g' : h <= 24 * 7 ? 'y' : 'r';
    var t = h == null ? 'Ekki kallaður í lotu síðustu 7 daga' : (st === 'g' ? 'Kallaður síðasta sólarhring' : 'Kallaður innan viku') + ' · síðast ' + fmtDT(lv.sidast) + ' · ' + lv.lotur + ' lotu(r)';
    return '<i class="st st-' + st + '" title="' + esc(t) + '"></i>';
  }
  var API_LOTUR = '/api/lotur', API_STADA = '/api/charlize-stada', API_NOTES = '/api/agent-notes';
  var STJORAR = ['fyrirtaeki', 'framendi', 'bord-flettur', 'kjarni-vefur', 'rukkari'];
  var STJORI_VEFUR = { framendi: 'brunaholf', 'bord-flettur': 'slokkvitaeki', 'kjarni-vefur': 'kjarni' };
  var VERDIR = ['netvordur', 'rambo', 'kodafraedingur', 'utlitsserfraedingur', 'oryggi', 'kerfisheilsa', 'tengingar', 'hradi', 'gagnaleidslur',
    'samthykktir', 'joker', 'thema', 'kort', 'prentun', 'adstod', 'villuleit', 'variant-analysis'];
  var KEDJA = {
    fyrirtaeki: ['kunnaskra', 'thjonustugatt', 'sara-coworker', 'sala-reikningar', 'natalie', 'elon-musk', 'arnold', 'postur'],
    framendi: ['verkstadur', 'bokari', 'skjol', 'sara-organizer', 'jarvis'],
    'bord-flettur': ['postur', 'sala-reikningar', 'opp', 'innkaupabokari', 'birgdastjori', 'elon-musk'],
    'kjarni-vefur': ['artcraft', 'skraning', '3dJoker', 'arnold'],
    rukkari: ['bokari', 'postur', 'logfraedingur', 'endurskodandi']
  };
  var NYIR = ['fyrirtaeki', 'postur', 'thjonustugatt', 'logfraedingur', 'endurskodandi', 'innkaupabokari', 'birgdastjori', 'kodafraedingur',
    'utlitsserfraedingur', 'opp', 'verkstadur', 'kjarni-vefur', 'artcraft', 'skraning'];
  var VEFIR = { brunaholf: 'Brunahólf', slokkvitaeki: 'Slökkvitæki', kjarni: 'Kjarni' };
  var VEF_ROD = ['brunaholf', 'slokkvitaeki', 'kjarni'];
  var FONTS = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Rajdhani:wght@500;600;700&family=Cinzel:wght@600;700&display=swap';

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cut = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmtDT = function (iso) { var d = new Date(iso || ''); return isNaN(d) ? '—' : p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  var fmtD = function (iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '.' + m[2] : '—'; };
  var idag = function (iso) { var d = new Date(iso || ''), n = new Date(); return !isNaN(d) && d.toDateString() === n.toDateString(); };
  var getAuthor = function () { try { return localStorage.getItem('bh_me') || ''; } catch (_) { return ''; } };
  var erRagnarok = function () { return document.documentElement.getAttribute('data-thema') === 'ragnarok'; };
  var SVG = {
    net: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="3" r="1.5"/><circle cx="20" cy="17" r="1.5"/><circle cx="4" cy="17" r="1.5"/><path d="M12 9V4.5M14.3 13.6l4.4 2.6M9.7 13.6l-4.4 2.6"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 6h14l2 7v6H3v-6z"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function getJSON(url, opt) {
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; });
    });
  }
  function postJSON(url, body) { return getJSON(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }

  /* ---------- agentar úr registry ---------- */
  var byName = {};
  R.list.forEach(function (e) { if (!byName[e.name] || e.type === 'agent') byName[e.name] = e; });
  var agents = R.list.filter(function (e) { return e.type === 'agent'; });
  function entry(n) { return byName[n] || null; }
  function registryId(n) { var e = entry(n); return e ? e.id : null; }
  function eigandaSidur(e) { return (e && e.sidur || []).filter(function (s) { return s.hlutverk === 'eigandi'; }); }
  function persona(e) { if (!e) return ''; return (e.rodd || '').replace(/\s*\(.*$/, '').trim(); }
  function erNyr(n) { return NYIR.indexOf(n) !== -1; }

  /* ---------- gögn ---------- */
  var D = { sidukort: null, lotur: null, stada: null };
  var sidukortP = null, loturP = null;
  function saekjaSidukort() {
    if (!sidukortP) sidukortP = getJSON('/data/sidukort.json', { cache: 'no-store' }).then(function (j) { D.sidukort = j; return j; })
      .catch(function (e) { D.sidukort = { villa: e.message, vefir: R.thekja || [], sidur: [] }; return D.sidukort; });
    return sidukortP;
  }
  function saekjaLotur(afram) {
    if (D.lotur && !afram) return Promise.resolve(D.lotur);
    if (loturP) return loturP;
    loturP = getJSON(API_LOTUR + '?days=7&limit=60').then(function (j) { D.lotur = j; return j; })
      .catch(function (e) { D.lotur = { villa: e.message, rows: [], agentar: {}, got: [], tolur: {} }; return D.lotur; })
      .then(function (j) { loturP = null; return j; });
    return loturP;
  }
  function saekjaStada(afram) {
    if (D.stada && !afram) return Promise.resolve(D.stada);
    return getJSON(API_STADA).then(function (j) { D.stada = j; return j; })
      .catch(function (e) { D.stada = { villa: e.message }; return D.stada; });
  }
  function villuTexti(v) { return esc(v) + (/401|Innskráning/.test(v) ? ' — skráðu þig inn sem starfsmaður.' : ''); }

  /* ---------- hjálp: tillaga í agent_notes (sýnilegt spor) ---------- */
  function leggjaTil(texti, el) {
    var hver = prompt('Tillaga vistast í agent_notes (status „nýtt“) og lota vinnur hana inn.\n\n' + texti + '\n\nHver á að eiga þetta? (agent-nafn, t.d. bord-flettur)');
    if (hver == null) return;
    hver = hver.trim();
    var note = texti + (hver ? ' → eigandi: ' + hver : '');
    if (el) el.disabled = true;
    postJSON(API_NOTES, { agent: 'almennt', note: note, author: getAuthor() })
      .then(function () { if (el) { el.textContent = 'Sent'; el.classList.add('ok'); } })
      .catch(function (e) { if (el) el.disabled = false; alert('Tókst ekki: ' + e.message); });
  }

  /* ---------- spjald: Síðukort ---------- */
  function teiknaSidukort(el) {
    var box = el || document.getElementById('an-sidukort'); if (!box) return;
    saekjaSidukort().then(function (j) {
      var h = '';
      (j.vefir || []).forEach(function (v) {
        var cls = v.hlutfall >= 95 ? 'ok' : v.hlutfall >= 80 ? 'var' : 'hae';
        h += '<div class="maelir"><div class="lina"><span>' + esc(VEFIR[v.vefur] || v.vefur) + '</span><b>' + v.med_eiganda + '/' + v.alls + (v.an_eiganda ? ' <span style="color:var(--hae);letter-spacing:0">· ' + v.an_eiganda + ' án eiganda</span>' : '') + '</b></div>' +
          '<div class="rein ' + cls + '"><i style="width:' + v.hlutfall + '%"></i></div></div>';
      });
      var an = (j.sidur || []).filter(function (p) { return p.stada === '❌'; });
      h += '<div class="an-h">Án eiganda <span>' + an.length + '</span></div>';
      if (!an.length) h += '<div class="an-tom">Allar síður eiga eiganda.</div>';
      an.slice(0, 8).forEach(function (p, i) {
        h += '<div class="an-rod"><span class="n">' + esc(p.titill) + '<i>' + esc(VEFIR[p.vefur] || p.vefur) + ' · ' + esc(p.leid || '') + '</i></span><button type="button" class="an-btn" data-tillaga="' + i + '">Leggja til</button></div>';
      });
      if (an.length > 8) h += '<div class="an-tom">+ ' + (an.length - 8) + ' til viðbótar í Agentanetinu.</div>';
      if (j.villa) h += '<div class="an-villa">Síðukortið náðist ekki (' + esc(j.villa) + ') — sýni þekju úr agents-registry.</div>';
      h += '<button type="button" class="an-open" id="an-opna">' + SVG.net + '<span>Agentanetið — stjóri → sérfræðingar → síður</span></button>';
      box.innerHTML = h;
      box.onclick = function (ev) {
        var b = ev.target.closest('[data-tillaga]');
        if (b) { var p = an[Number(b.getAttribute('data-tillaga'))]; leggjaTil('Síðukort: „' + p.titill + '“ (' + (VEFIR[p.vefur] || p.vefur) + ', ' + (p.leid || p.id) + ') vantar eiganda', b); return; }
        if (ev.target.closest('#an-opna')) openNet();
      };
    });
  }

  /* ---------- spjald: Lotur ---------- */
  function teiknaLotur(afram, el) {
    var box = el || document.getElementById('an-lotur'); if (!box) return;
    saekjaLotur(afram).then(function (j) {
      var t = j.tolur || {}, rows = j.rows || [];
      var h = '<div class="an-chips"><span class="an-chip"><b>' + rows.length + '</b> lotur</span><span class="an-chip"><b>' + (t.med_kt || 0) + '</b> með kt</span>' +
        '<span class="an-chip' + (t.olokid ? ' hae' : '') + '"><b>' + (t.olokid || 0) + '</b> ólokið minni</span><span class="an-chip"><b>' + (t.kunni_skrifad || 0) + '</b> kúnnaminni skráð</span></div>';
      if (j.villa) h += '<div class="an-villa">' + villuTexti(j.villa) + '</div>';
      if (!rows.length && !j.villa) h += '<div class="an-tom">Engar lotur skráðar síðustu 7 daga. Stop-hookurinn (tools/lotu-lok.cjs) skrifar hér þegar lota lýkur.</div>';
      rows.slice(0, 12).forEach(function (s) {
        var ag = (s.agents_called || []).filter(function (a) { return entry(a); }).slice(0, 3).join(' · ');
        h += '<div class="an-rod' + (s.olokid ? ' olokid' : '') + '" title="' + esc(s.cwd || '') + (s.machine ? ' · ' + s.machine : '') + '"><span class="t">' + fmtDT(s.last_at) + '</span>' +
          '<span class="n">' + esc(cut(s.summary || '(engin samantekt)', 110)) + '<i>' + esc(s.repo || '?') + ' · ' + (s.turns || 0) + ' svör' + ((s.kennitolur || []).length ? ' · ' + s.kennitolur.length + ' kt' : '') + '</i></span>' +
          '<span class="m">' + (s.olokid ? 'ólokið minni' : ag ? esc(ag) : (s.kunni_skrifad ? 'skráð ' + s.kunni_skrifad : '')) + '</span></div>';
      });
      box.innerHTML = h;
    });
  }

  /* ---------- spjald: Göt & tillögur ---------- */
  function teiknaGot(afram, el) {
    var box = el || document.getElementById('an-got'); if (!box) return;
    Promise.all([saekjaLotur(afram), saekjaSidukort()]).then(function (r) {
      var lot = r[0], sk = r[1];
      var got = lot.got || [];
      var an = (sk.sidur || []).filter(function (p) { return p.stada === '❌'; });
      var sof = (sk.sidur || []).filter(function (p) { return p.merki === 'sofandi'; });
      var okalladir = agents.filter(function (e) { return !(lot.agentar || {})[e.name] && STJORAR.indexOf(e.name) === -1; }).length;
      var h = '<div class="an-chips"><span class="an-chip' + (got.length ? ' hae' : '') + '"><b>' + got.length + '</b> router-göt</span><span class="an-chip"><b>' + an.length + '</b> síður án eiganda</span><span class="an-chip"><b>' + sof.length + '</b> sofandi síður</span><span class="an-chip"><b>' + okalladir + '</b> agentar ókallaðir 7 d</span></div>';
      if (lot.villa) h += '<div class="an-villa">' + villuTexti(lot.villa) + '</div>';
      h += '<div class="an-h">Router-göt úr lotum <span>síða/kt nefnd, enginn eigandi</span></div>';
      if (!got.length) h += '<div class="an-tom">Engin göt skráð — routerinn fann eiganda fyrir allt sem var nefnt.</div>';
      got.slice(0, 6).forEach(function (g, i) {
        h += '<div class="an-rod"><span class="t">' + fmtD(g.sidast) + '</span><span class="n">„' + esc(g.ord) + '“<i>' + g.lotur + ' lot' + (g.lotur === 1 ? 'a' : 'ur') + '</i></span><button type="button" class="an-btn" data-gat="' + i + '">Leggja til</button></div>';
      });
      if (an.length) {
        h += '<div class="an-h">Síður án eiganda <span>' + an.length + '</span></div>';
        an.slice(0, 4).forEach(function (p, i) { h += '<div class="an-rod"><span class="n">' + esc(p.titill) + '<i>' + esc(VEFIR[p.vefur] || p.vefur) + '</i></span><button type="button" class="an-btn" data-sida="' + i + '">Leggja til</button></div>'; });
      }
      box.innerHTML = h;
      box.onclick = function (ev) {
        var b = ev.target.closest('[data-gat]'); if (b) { var g = got[Number(b.getAttribute('data-gat'))]; leggjaTil('Router-gat: orðin „' + g.ord + '“ komu fyrir í ' + g.lotur + ' lotu(m) án þess að nokkur agent ætti þau — kveikjuorð eða nýr agent?', b); return; }
        var s = ev.target.closest('[data-sida]'); if (s) { var p = an[Number(s.getAttribute('data-sida'))]; leggjaTil('Síðukort: „' + p.titill + '“ (' + (VEFIR[p.vefur] || p.vefur) + ', ' + (p.leid || p.id) + ') vantar eiganda', s); }
      };
    });
  }

  /* ---------- spjald: Minnið ---------- */
  function teiknaMinni(afram, el) {
    var box = el || document.getElementById('an-minni'); if (!box) return;
    saekjaStada(afram).then(function (j) {
      if (j.villa) { box.innerHTML = '<div class="an-villa">' + villuTexti(j.villa) + '</div>'; return; }
      var k = j.knowledge || {}, ib = j.inbox || {}, ku = j.kunni || {};
      var alls = k.active || 1, h = '';
      h += '<div class="an-chips"><span class="an-chip"><b>' + (k.active || 0) + '</b> virkar</span><span class="an-chip"><b>' + (k.superseded || 0) + '</b> úreltar</span><span class="an-chip"><b>' + (k.wrong || 0) + '</b> rangar</span></div>';
      Object.keys(k.per_scope || {}).forEach(function (sc) {
        var n = k.per_scope[sc];
        h += '<div class="maelir"><div class="lina"><span>' + esc(sc) + '</span><b>' + n + '</b></div><div class="rein"><i style="width:' + Math.max(1, Math.round(100 * n / alls)) + '%"></i></div></div>';
      });
      var kh = ku.af ? Math.round(100 * (ku.felog || 0) / ku.af) : 0;
      h += '<div class="an-h">Kúnnaminni <span>' + (ku.felog || 0) + ' / ' + (ku.af || '?') + ' félög · ' + kh + '%</span></div>';
      h += '<div class="rein ' + (kh >= 50 ? 'ok' : kh >= 15 ? 'var' : 'hae') + '"><i style="width:' + Math.max(1, kh) + '%"></i></div>';
      h += '<div class="an-h">Biðstofa <span>' + (ib.pending || 0) + ' kandídatar</span></div>';
      var pa = ib.per_agent || {};
      h += '<div class="an-chips">' + Object.keys(pa).slice(0, 5).map(function (a) { return '<span class="an-chip">' + esc(a) + ' <b>' + pa[a] + '</b></span>'; }).join('') + '</div>';
      h += '<button type="button" class="an-open" id="an-bidstofa">' + SVG.inbox + '<span>Biðstofan — samþykkja / hafna (' + (ib.pending || 0) + ')</span></button>';
      box.innerHTML = h;
      box.onclick = function (ev) { if (ev.target.closest('#an-bidstofa')) openBidstofa(); };
    });
  }

  /* ---------- Biðstofan ---------- */
  var bsOv = null, bsScope = '';
  function themaKlasi(el) { el.classList.toggle('theme-ragnarok', erRagnarok()); el.classList.toggle('theme-jarvis', !erRagnarok()); }
  function hladaLetur() { if (!document.getElementById('an-letur')) { var l = document.createElement('link'); l.id = 'an-letur'; l.rel = 'stylesheet'; l.href = FONTS; document.head.appendChild(l); } }
  function openBidstofa() {
    hladaLetur();
    if (!bsOv) {
      bsOv = document.createElement('div'); bsOv.className = 'an-ov an-bsov'; bsOv.hidden = true;
      bsOv.innerHTML = '<div class="an-bs pnl" role="dialog" aria-modal="true" aria-label="Charlize biðstofa"><div class="an-bs-top"><span class="ttl">Charlize · biðstofa</span><span class="n" id="an-bs-t">sæki…</span>' +
        '<div class="an-bs-f" id="an-bs-f"></div><button type="button" class="tab" aria-label="Loka">' + SVG.x + '</button></div><div class="an-bs-l" id="an-bs-l"></div>' +
        '<div class="an-bs-fot">Samþykkja = charlize_approve → charlize_knowledge (sama leið og SQL-samþykktin). Hafna = status rejected með athugasemd. Hvert skrif skráist í agent_logs. Ekkert fer beint í rekstrargögn.</div></div>';
      document.body.appendChild(bsOv);
      bsOv.addEventListener('click', function (ev) { if (ev.target === bsOv) closeBidstofa(); });
      bsOv.querySelector('.an-bs-top .tab').addEventListener('click', closeBidstofa);
      bsOv.querySelector('#an-bs-f').addEventListener('click', function (ev) { var b = ev.target.closest('[data-sc]'); if (!b) return; bsScope = b.getAttribute('data-sc'); hladaBidstofu(); });
      bsOv.querySelector('#an-bs-l').addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-adg]'); if (!b) return;
        var k = b.closest('.an-k'), id = Number(k.getAttribute('data-id')), adg = b.getAttribute('data-adg');
        var note = null;
        if (adg === 'hafna') { note = prompt('Af hverju er þessu hafnað? (valfrjálst, vistast sem review_note)'); if (note === null) return; }
        k.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        postJSON(API_STADA, { action: adg === 'hafna' ? 'hafna' : 'samthykkja', id: id, note: note || undefined, by_who: getAuthor() || 'jarvis.html' })
          .then(function () { k.classList.add('burt'); var t = bsOv.querySelector('#an-bs-t'); var n = Number(t.getAttribute('data-n') || 0) - 1; t.setAttribute('data-n', n); t.textContent = n + ' í bið'; D.stada = null; teiknaMinni(true); })
          .catch(function (e) { k.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); alert('Tókst ekki: ' + e.message); });
      });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && bsOv && !bsOv.hidden) closeBidstofa(); });
    }
    themaKlasi(bsOv);
    bsOv.hidden = false; document.body.style.overflow = 'hidden';
    hladaBidstofu();
  }
  function closeBidstofa() { if (bsOv) { bsOv.hidden = true; if (!ov || ov.hidden) document.body.style.overflow = ''; } }
  function hladaBidstofu() {
    var l = bsOv.querySelector('#an-bs-l'), t = bsOv.querySelector('#an-bs-t'), f = bsOv.querySelector('#an-bs-f');
    l.innerHTML = '<div class="an-tom">sæki…</div>';
    getJSON(API_STADA + '?op=inbox&limit=40' + (bsScope ? '&scope=' + encodeURIComponent(bsScope) : '')).then(function (j) {
      t.textContent = (j.pending || 0) + ' í bið'; t.setAttribute('data-n', j.pending || 0);
      var ps = (D.stada && D.stada.inbox && D.stada.inbox.per_scope) || {};
      f.innerHTML = '<button type="button" class="gw' + (!bsScope ? ' gw-acc' : '') + '" data-sc="">Allt</button>' + Object.keys(ps).map(function (s) { return '<button type="button" class="gw' + (bsScope === s ? ' gw-acc' : '') + '" data-sc="' + esc(s) + '">' + esc(s) + ' ' + ps[s] + '</button>'; }).join('');
      if (!(j.rows || []).length) { l.innerHTML = '<div class="an-tom">Biðstofan er tóm.</div>'; return; }
      l.innerHTML = j.rows.map(function (r) {
        return '<div class="an-k" data-id="' + r.id + '"><small>#' + r.id + ' · ' + esc(r.scope) + ' / ' + esc(r.topic || '—') + ' · ' + esc(r.agent || '?') + ' · ' + fmtD(r.created_at) + (r.kennitala ? ' · kt ' + esc(r.kennitala) : '') + (r.confidence ? ' · ' + esc(r.confidence) : '') + '</small>' +
          '<div class="f">' + esc(r.fact) + '</div>' + (r.detail ? '<div class="d">' + esc(cut(r.detail, 320)) + '</div>' : '') +
          (r.review_note ? '<div class="d sp">' + esc(cut(r.review_note, 300)) + '</div>' : '') +
          '<div class="r"><button type="button" class="btn-ok" data-adg="samthykkja">' + SVG.ok + 'Samþykkja</button><button type="button" class="btn-gh" data-adg="hafna">' + SVG.x + 'Hafna</button><span>' + esc(cut(r.source_path || '', 50)) + '</span></div></div>';
      }).join('');
    }).catch(function (e) { l.innerHTML = '<div class="an-villa">' + esc(e.message) + '</div>'; });
  }

  /* ---------- Agentanetið ---------- */
  var ov = null, stageEl = null, sideEl = null, ring = null, valinn = null;
  var SW = 1300, SH = 700, CX = 650, CY = 350;          // sviðið (hönnunin er 1260×640; 40 px breiðara og 60 px hærra svo 25 spjöld skarist hvergi)
  var RING = 312;                                        // 520 × .6 — hringurinn í miðju
  var E1 = { rx: 280, ry: 165 }, E2 = { rx: 460, ry: 250 }, E3 = { rx: 630, ry: 330 }, E3b = { rx: 612, ry: 318 };   // sporbaugar: stjórar · sérfræðingar · síðupunktar (tveir baugar)
  var STAG = { rx: 44, ry: 26 }, ND_MAX = 200;   // hermt 04.11 (sim-net): engin skörun hnúta/punkta/hrings                                                                           // sérfræðingar staggast ±STAG; spjald aldrei breiðara en ND_MAX (css)
  function epos(e, deg) { var a = (deg - 90) * Math.PI / 180; return { x: CX + e.rx * Math.cos(a), y: CY + e.ry * Math.sin(a) }; }
  function nodeW(e) { var n = e.name.length, s = (persona(e) + ' · ' + eigandaSidur(e).length + ' síður').length; return Math.min(ND_MAX, Math.max(n * 7.6, s * 6.7) + 26); }   // örlítið ríflegt mat á raunbreidd (JetBrains Mono 10/11 px)

  function leggjaNet() {
    var sk = D.sidukort || { sidur: [] };
    var verdir = {}; VERDIR.forEach(function (v) { verdir[v] = true; });
    var stj = STJORAR.map(entry).filter(Boolean);
    var ser = agents.filter(function (e) { return STJORAR.indexOf(e.name) === -1 && !verdir[e.name] && e.name !== 'jarvis'; })
      .concat(['arnold', '3dJoker'].map(entry).filter(Boolean))
      .filter(function (e, i, a) { return a.indexOf(e) === i; });
    // raðað eftir keðju stjóranna svo sérfræðingur lendi nálægt þeim sem kallar á hann
    var ord = []; STJORAR.forEach(function (s) { (KEDJA[s] || []).forEach(function (n) { if (ord.indexOf(n) === -1 && ser.some(function (e) { return e.name === n; })) ord.push(n); }); });
    ser.forEach(function (e) { if (ord.indexOf(e.name) === -1) ord.push(e.name); });
    ser = ord.map(entry);
    var P = {}, sett = [];
    stj.forEach(function (e, i) { var p = epos(E1, i * 360 / stj.length); p.w = nodeW(e); P[e.name] = p; sett.push(p); });
    var skarast = function (p, q) { return Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 10 && Math.abs(p.y - q.y) < 46; };
    ser.forEach(function (e, i) {
      var deg = i * 360 / ser.length + 180 / ser.length, w = nodeW(e);
      var inn = { rx: E2.rx - STAG.rx, ry: E2.ry - STAG.ry }, ut = { rx: E2.rx + STAG.rx, ry: E2.ry + STAG.ry }, inn2 = { rx: E2.rx - STAG.rx * 2, ry: E2.ry - STAG.ry * 2 };
      var ut2 = { rx: E2.rx + STAG.rx * 2, ry: E2.ry + STAG.ry * 2 };
      var kostir = i % 2 ? [ut, inn, E2, ut2, inn2] : [inn, ut, E2, ut2, inn2];
      var best = null, bestN = 1e9;
      for (var k = 0; k < kostir.length; k++) {
        var p = epos(kostir[k], deg); p.w = w;
        var n = sett.filter(function (q) { return skarast(p, q); }).length;
        if (n < bestN) { best = p; bestN = n; }
        if (!n) break;
      }
      P[e.name] = best; sett.push(best);
    });
    // afstilling: hnútur sem skarast enn er ýtt út eftir sínum geisla (6 px í senn) þar til hann er laus eða kominn að punktahringnum
    for (var it = 0; it < 40; it++) {
      var hreyft = false;
      ser.forEach(function (e) {
        var p = P[e.name];
        var hitt = sett.filter(function (q) { return q !== p && skarast(p, q); });
        if (!hitt.length) return;
        var dx = p.x - CX, dy = (p.y - CY) * (E3.rx / E3.ry), d = Math.hypot(dx, dy) || 1;
        if (d + 6 > E3.rx - 12) return;
        p.x += 6 * dx / d; p.y += 6 * (dy / d) * (E3.ry / E3.rx); hreyft = true;
      });
      if (!hreyft) break;
    }
    return { stj: stj, ser: ser, P: P, pages: sk.sidur || [] };
  }

  function teiknaNet() {
    if (!stageEl) return;
    var L = leggjaNet(), P = L.P, lot = D.lotur || { agentar: {} }, live = lot.agentar || {};
    var ln = '', nd = '', dots = '', lab = '';
    var line = function (a, b, cls) { return '<line class="' + cls + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '"/>'; };
    var C = { x: CX, y: CY };
    // kjarni → stjóri (þykkar, með púlsum)
    L.stj.forEach(function (e, i) {
      var p = P[e.name];
      ln += line(C, p, 'lnk lnk-st');
      ln += '<circle class="pulse" r="3"><animateMotion dur="' + (2 + (i % 4) * .2) + 's" repeatCount="indefinite" path="M' + CX + ',' + CY + ' L' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + '"/></circle>';
    });
    // stjóri → sérfræðingur
    STJORAR.forEach(function (sn) {
      var a = P[sn]; if (!a) return;
      (KEDJA[sn] || []).forEach(function (n) {
        var b = P[n]; if (!b) return;
        var sel = valinn && (valinn === sn || valinn === n);
        ln += line(a, b, 'lnk' + (sel ? ' lnk-sel' : erNyr(n) ? ' lnk-new' : ''));
      });
    });
    // síðupunktar á ysta baug, geirar per vef
    var alls = L.pages.length || 1, deg = 0;
    var valSidur = valinn && entry(valinn) ? eigandaSidur(entry(valinn)).map(function (x) { return x.vefur + ':' + x.id; }) : null;
    VEF_ROD.forEach(function (v) {
      var ps = L.pages.filter(function (p) { return p.vefur === v; }), span = 360 * ps.length / alls, start = deg;
      var lp = epos({ rx: E3.rx - 60, ry: E3.ry + 10 }, start + span / 2);
      lab += '<span class="rl" style="left:' + lp.x.toFixed(0) + 'px;top:' + lp.y.toFixed(0) + 'px">' + esc(VEFIR[v]).toUpperCase() + ' ' + ps.length + '</span>';
      ps.forEach(function (p, i) {
        var pp = epos(i % 2 ? E3b : E3, start + span * (i + 0.5) / ps.length);
        var key = p.vefur + ':' + p.id, lys = valSidur && valSidur.indexOf(key) !== -1;
        var cls = 'pd' + (p.stada === '❌' ? ' pd-bad' : p.merki ? ' pd-m' : '') + (lys ? ' pd-lys' : valSidur ? ' pd-dauf' : '');
        dots += '<circle class="' + cls + '" cx="' + pp.x.toFixed(1) + '" cy="' + pp.y.toFixed(1) + '" r="' + (lys ? 4 : 2.6) + '"><title>' + esc(p.titill) + ' — ' + esc(VEFIR[v]) + (p.eigandi_nafn ? ' · ' + esc(p.eigandi_nafn) + (p.eigandi_utan ? ' (annað repó)' : '') : ' · ENGINN EIGANDI') + (p.merki ? ' · ' + esc(p.merki) : '') + '</title></circle>';
      });
      deg += span;
    });
    // hnútar
    var node = function (e, cls) {
      var p = P[e.name], lv = live[e.name], sidur = eigandaSidur(e).length;
      var v = STJORI_VEFUR[e.name], th = v && ((D.sidukort && D.sidukort.vefir) || R.thekja || []).filter(function (t) { return t.vefur === v; })[0];
      var sub = (persona(e) ? esc(persona(e)) + ' · ' : '') + (th ? th.alls + ' síður' + (th.an_eiganda ? ' · <span class="red">' + th.an_eiganda + ' án eiganda</span>' : '') : sidur + ' síður');
      return '<div class="nd ' + cls + (erNyr(e.name) ? ' nd-new' : '') + (valinn === e.name ? ' nd-sel' : '') + '" data-ag="' + esc(e.name) + '" style="left:' + p.x.toFixed(0) + 'px;top:' + p.y.toFixed(0) + 'px">' + stPunktur(live, e.name) + '<b>' + esc(e.name) + '</b>' + sub +
        (lv ? '<span class="lif" title="Kallaður í ' + lv.lotur + ' lotu(m) síðustu 7 daga">' + lv.lotur + '</span>' : '') + '</div>';
    };
    L.stj.forEach(function (e) { nd += node(e, 'nd-st'); });
    L.ser.forEach(function (e) { nd += node(e, ''); });
    stageEl.innerHTML = '<svg width="' + SW + '" height="' + SH + '" viewBox="0 0 ' + SW + ' ' + SH + '" aria-hidden="true">' + dots + ln + '</svg>' +
      '<div class="an-ring" id="an-ring" style="left:' + (CX - RING / 2) + 'px;top:' + (CY - RING / 2) + 'px;width:' + RING + 'px;height:' + RING + 'px"></div>' + lab + nd;
    ring = window.JarvisRing ? window.JarvisRing.mount(stageEl.querySelector('#an-ring'), { size: RING, theme: erRagnarok() ? 'ragnarok' : 'jarvis', sub: R.agents + ' agentar · ' + R.skills + ' skills' }) : null;
    teiknaVerdi();
    fitStage();
  }

  /* Skölun: sviðið er teiknað í 1300×700 hnitum og skalað svo það passi í breidd rammans (k ≤ 1).
     Á síma (≤ 860 px) er lágmark k = 0,8 svo spjöldin séu læsileg; þá rennur maður til hliðar innan rammans. 04.11.2026 */
  var MIN_K_SIMI = 0.8;   // 04.11 síðdegis: 0,55 var ólæsilegt á síma — heldur skrun en smáletur
  function fitStage() {
    if (!stageEl || !ov || ov.hidden) return;
    var box = stageEl.parentElement; if (!box) return;
    var w = box.clientWidth - 8; if (w <= 0) return;
    var fit = Math.min(1, w / SW);
    var k = window.innerWidth <= 860 ? Math.max(fit, MIN_K_SIMI) : fit;
    var scroll = k > fit + 0.001;
    stageEl.style.transform = 'scale(' + k.toFixed(4) + ')';
    stageEl.style.marginLeft = scroll ? '4px' : Math.max(0, Math.round((w - SW * k) / 2) + 4) + 'px';
    stageEl.style.marginTop = '4px';
    box.style.height = Math.round(SH * k) + 8 + 'px';
    box.classList.toggle('an-scroll', scroll);
    box.classList.toggle('an-fit', !scroll);
    if (scroll && !box.dataset.midjad) { box.scrollLeft = Math.max(0, Math.round((SW * k - w) / 2)); box.dataset.midjad = '1'; }
  }
  var fitT = null;
  function fitStageSeint() { clearTimeout(fitT); fitT = setTimeout(fitStage, 80); }

  function teiknaVerdi() {
    var f = ov.querySelector('#an-verdir'); if (!f) return;
    var live = (D.lotur && D.lotur.agentar) || {};
    f.innerHTML = '<span class="l">VERÐIR OG KERFI · <span class="dim">KALLAST Á UNDAN AÐGERÐ, EKKI Í KEÐJUNNI</span></span>' + VERDIR.map(function (n) {
      var e = entry(n); if (!e) return '';
      var cls = (n === 'netvordur' || n === 'rambo') ? ' gw-bad' : erNyr(n) ? ' gw-warn' : n === 'oryggi' ? ' gw-acc' : '';
      return '<button type="button" class="gw' + cls + '" data-ag="' + esc(n) + '">' + stPunktur(live, n) + esc(n) + (persona(e) ? ' · ' + esc(persona(e)) : '') + (live[n] ? ' · ' + live[n].lotur + ' lotur' : '') + '</button>';
    }).join('');
  }

  function teiknaMaela() {
    var m = ov.querySelector('#an-maelar'); if (!m) return;
    var st = D.stada || {}, k = st.knowledge || {}, ib = st.inbox || {}, ku = st.kunni || {}, lot = D.lotur || {}, t = lot.tolur || {}, sk = D.sidukort || {};
    var an = (sk.sidur || []).filter(function (p) { return p.stada === '❌'; }).length;
    var hitt = (lot.rows || []).filter(function (r) { return idag(r.last_at); }).length;
    var strik = function (v) { return v == null ? '—' : v; };   // „mælist ekki“ = strik, aldrei fundið upp
    // 04.11.2026 (Agnar: „myndi helst vilja komast allsstaðar inn“): hver mælir opnar sitt spjald í hliðarrammanum (data-sp).
    var SP = { 'Charlize': 'minni', 'Biðstofa': 'bidstofa', 'Kúnnaminni': 'kunni', 'Lotur 7 d': 'lotur', 'Ólokið minni': 'lotur', 'Síður án eiganda': 'sidukort', 'Göt': 'got', 'Lotur í dag': 'lotur' };
    var kc = function (lbl, v, cls, eftir) { var sp = SP[lbl]; return '<span class="kc ' + (cls || '') + (sp ? ' kc-sp' : '') + '"' + (sp ? ' data-sp="' + sp + '" role="button" tabindex="0" title="Opna ' + lbl + '"' : '') + '>' + lbl + ' <b>' + v + '</b>' + (eftir ? ' ' + eftir : '') + '</span>'; };
    m.innerHTML = kc('Charlize', strik(k.active), k.active == null ? 'dauft' : '', 'virkar') +
      kc('Biðstofa', strik(ib.pending), ib.pending > 0 ? 'var' : '') +
      kc('Kúnnaminni', ku.felog != null ? ku.felog + ' / ' + (ku.af || '?') : '—', '') +
      kc('Lotur 7 d', strik(t.lotur), '') +
      kc('Ólokið minni', strik(t.olokid), t.olokid > 0 ? 'hae' : '') +
      kc('Síður án eiganda', an, an > 0 ? 'hae' : '') +
      kc('Göt', lot.got ? lot.got.length : '—', lot.got && lot.got.length ? 'hae' : '') +
      kc('Lotur í dag', hitt, '') +
      '<span class="kc kc-sp" data-sp="skipanir" role="button" tabindex="0" title="Skipanahólfið — keyra vinnslur á vélunum, líka Claude-API-vinnslurnar">Skipanir <b>▶</b></span>' +
      '<span class="kc an-skyr" title="Punkturinn á hverjum agent: hvenær hann var síðast kallaður í lotu"><i class="st st-g"></i>24 klst <i class="st st-y"></i>vika <i class="st st-r"></i>ekki kallaður</span>';
    if (lot.villa || st.villa) m.innerHTML += '<span class="kc hae" title="' + esc(lot.villa || st.villa) + '">' + (/401|Innskráning/.test(lot.villa || st.villa) ? 'Innskráning starfsmanns vantar' : 'Lifandi gögn náðust ekki') + '</span>';
  }

  /* ---------- Mælarnir opna spjöldin í hliðarrammanum (04.11.2026) ---------- */
  var SP_HEITI = { minni: 'Minnið — Charlize', lotur: 'Lotur síðustu 7 daga', got: 'Göt og tillögur', sidukort: 'Síðukort', kunni: 'Kúnnaminni — félög', skipanir: 'Skipanahólfið' };
  function opnaSpjald(sp) {
    if (sp === 'bidstofa') { openBidstofa(); return; }
    if (!sideEl) return;
    valinn = null; teiknaNet();
    sideEl.onclick = null;
    sideEl.innerHTML = '<div><h3>' + esc(SP_HEITI[sp] || sp) + '</h3><div class="u">úr Jarvis-spjaldinu · sömu aðgerðir</div></div><div class="an-sp" id="an-sp"></div>' +
      '<button type="button" class="btn-out" id="an-sp-aftur" style="align-self:flex-start;margin-top:auto">Til baka í netið</button>';
    sideEl.querySelector('#an-sp-aftur').onclick = function () { velja(null); };
    var box = sideEl.querySelector('#an-sp');
    box.innerHTML = '<p class="dim">sæki…</p>';
    if (sp === 'minni') teiknaMinni(false, box);
    else if (sp === 'lotur') teiknaLotur(false, box);
    else if (sp === 'got') teiknaGot(false, box);
    else if (sp === 'sidukort') teiknaSidukort(box);
    else if (sp === 'kunni') teiknaKunni(box);
    else if (sp === 'skipanir') teiknaSkipanir(box);
    if (window.innerWidth <= 860 && sideEl.scrollIntoView) sideEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* Kúnnaminni: félög með minni (op=kunni) + félög án minnis úr data/felog.json. Hver lína: Kúnni (customer.html) · Spyrja (spyrja.html). */
  function teiknaKunni(box) {
    var leit = '';
    getJSON(API_STADA + '?op=kunni&limit=2000').then(function (j) {
      j = j || {};
      var med = (j.felog || []).map(function (e) { return { kt: e.kt, nafn: e.nafn || e.kt, n: e.n, sidast: e.sidast, efni: Object.keys(e.efni || {}).join(' · ') }; });
      var an = (j.an || []).map(function (e) { return { kt: e.kt, nafn: e.nafn || e.kt }; });
      var lina = function (e, hefur) {
        return '<div class="an-rod"><span class="n">' + esc(e.nafn) + '<i>' + esc(e.kt) + (hefur ? ' · ' + e.n + ' staðr. · ' + fmtD(e.sidast) + (e.efni ? ' · ' + esc(e.efni) : '') : ' · ekkert kúnnaminni') + '</i></span>' +
          '<a class="an-lnk" href="customer.html?kt=' + encodeURIComponent(e.kt) + '" target="_blank" rel="noopener" title="Kúnnasíðan">Kúnni</a>' +
          '<a class="an-lnk" href="spyrja.html?vefur=brunaholf&view=kunni&kt=' + encodeURIComponent(e.kt) + '&titill=' + encodeURIComponent(e.nafn) + '" target="_blank" rel="noopener" title="Spyrja fyrirtaeki-stjórann um félagið — og skrá">Spyrja</a></div>';
      };
      var teikna = function () {
        var q = leit.toLowerCase();
        var m2 = q ? med.filter(function (e) { return (e.nafn + ' ' + e.kt).toLowerCase().indexOf(q) !== -1; }) : med;
        var a2 = q ? an.filter(function (e) { return (e.nafn + ' ' + e.kt).toLowerCase().indexOf(q) !== -1; }) : an;
        var h = '<div class="an-chips"><span class="an-chip"><b>' + med.length + '</b> með minni</span><span class="an-chip hae"><b>' + an.length + '</b> án minnis</span></div>';
        h += '<input class="an-leit" id="an-kunni-leit" placeholder="Leita að félagi eða kt…" value="' + esc(leit) + '">';
        h += '<div class="an-h">Með kúnnaminni <span>' + m2.length + '</span></div>' + m2.slice(0, 60).map(function (e) { return lina(e, true); }).join('');
        if (m2.length > 60) h += '<div class="an-tom">+ ' + (m2.length - 60) + ' til viðbótar — þrengdu leitina.</div>';
        h += '<div class="an-h">Án kúnnaminnis <span>' + a2.length + '</span></div>' + a2.slice(0, q ? 60 : 12).map(function (e) { return lina(e, false); }).join('');
        if (a2.length > (q ? 60 : 12)) h += '<div class="an-tom">+ ' + (a2.length - (q ? 60 : 12)) + ' til viðbótar — leitaðu að nafni. „Spyrja“ opnar stjórann með kúnnaminninu; „Skráðu þetta“ þar setur í biðstofu.</div>';
        box.innerHTML = h;
        var inp = box.querySelector('#an-kunni-leit');
        inp.oninput = function () { leit = inp.value; var p = inp.selectionStart; teikna(); var i2 = box.querySelector('#an-kunni-leit'); i2.focus(); try { i2.setSelectionRange(p, p); } catch (_) {} };
      };
      teikna();
    }).catch(function (e) { box.innerHTML = '<div class="an-villa">' + villuTexti(e.message) + '</div>'; });
  }

  /* Skipanahólfið: uppskriftir per vél (vel-skipun), Keyra-takki, síðustu keyrslur með úttaki. Claude-API-vinnslurnar merktar 🤖. */
  function teiknaSkipanir(box) {
    Promise.all([getJSON('/api/vel-skipun?uppskriftir=1'), getJSON('/api/vel-skipun?limit=20'), getJSON('/api/vel-heartbeat')]).then(function (r) {
      var upp = (r[0] && r[0].uppskriftir) || [], sk = (r[1] && r[1].skipanir) || [], velar = ((r[2] && r[2].velar) || []).filter(function (v) { return v.heimild !== 'charlize_sessions'; });
      var teikna = function () {
        var h = '<p class="dim">Vélin sækir skipunina með næsta lífsmarki (≤ 30 mín, eða strax ef lífsmarkið keyrir). Aðeins fastar uppskriftir — enginn frjáls texti. Claude-vinnslurnar skrifa aðeins tillögur sem þú samþykkir.</p>';
        velar.forEach(function (v) {
          h += '<div class="an-h">' + esc(v.vel) + ' <span>' + (v.status === 'graent' ? 'í sambandi' : v.aldur_min + ' mín síðan') + '</span></div>';
          upp.forEach(function (u) {
            var irod = sk.some(function (x) { return x.vel === v.vel && x.uppskrift === u.id && (x.stada === 'bid' || x.stada === 'sott'); });
            h += '<div class="an-rod"><span class="n">' + esc(u.heiti) + '<i>' + esc(u.lysing) + '</i></span><button type="button" class="an-lnk" data-vel="' + esc(v.vel) + '" data-upp="' + esc(u.id) + '"' + (irod ? ' disabled' : '') + '>' + (irod ? 'í röð' : 'Keyra') + '</button></div>';
          });
        });
        if (!velar.length) h += '<div class="an-tom">Engin vél með luna-bridge lífsmark — skipanir keyra aðeins þar.</div>';
        h += '<div class="an-h">Síðustu keyrslur <span>' + sk.length + '</span></div>';
        sk.slice(0, 12).forEach(function (x) {
          var st = x.stada === 'lokid' ? 'ok' : x.stada === 'villa' ? 'hae' : 'var';
          h += '<div class="an-rod" title="' + esc((x.utkoma || '').slice(-600)) + '"><span class="t">' + fmtD(x.lokid_at || x.sott_at || x.created_at) + '</span><span class="n">' + esc(x.heiti || x.uppskrift) + '<i>' + esc(x.vel) + ' · ' + esc(x.stada) + (x.exit_code != null ? ' · exit ' + x.exit_code : '') + (x.beidandi ? ' · ' + esc(x.beidandi) : '') + '</i></span><span class="an-chip ' + st + '">' + esc(x.stada) + '</span></div>';
        });
        box.innerHTML = h;
        box.onclick = function (ev) {
          var b = ev.target.closest('[data-upp]'); if (!b || b.disabled) return;
          b.disabled = true; b.textContent = 'sendi…';
          postJSON('/api/vel-skipun', { action: 'senda', vel: b.getAttribute('data-vel'), uppskrift: b.getAttribute('data-upp'), beidandi: (getAuthor() || 'jarvis') + ' (agentanet)' })
            .then(function (j) { b.textContent = j && j.thegar_i_rod ? 'í röð' : 'í röð ✓'; return getJSON('/api/vel-skipun?limit=20'); })
            .then(function (j2) { sk = (j2 && j2.skipanir) || sk; teikna(); })
            .catch(function (e) { b.disabled = false; b.textContent = 'Keyra'; alert('Tókst ekki: ' + e.message); });
        };
      };
      teikna();
    }).catch(function (e) { box.innerHTML = '<div class="an-villa">' + villuTexti(e.message) + '</div>'; });
  }

  function velja(n) {
    valinn = valinn === n ? null : n;
    teiknaNet();
    var e = entry(n); if (!sideEl) return;
    sideEl.onclick = null;
    if (!e || valinn !== n) { sideEl.innerHTML = '<p class="dim">Smelltu á agent til að lýsa síðurnar hans og sjá hverja hann kallar á. Tvísmellur opnar Agentaskrána.</p>'; return; }
    var sid = eigandaSidur(e), und = (e.sidur || []).filter(function (s) { return s.hlutverk === 'undiragent'; });
    var live = ((D.lotur && D.lotur.agentar) || {})[n];
    var h = '<div><h3>' + esc(n) + '</h3><div class="u">' + esc(e.rodd || (e.type === 'skill' ? 'skill' : 'agent')) + (erNyr(n) ? ' · <span class="ylw">nýr 04.11</span>' : '') + '</div></div>';
    h += '<p>' + esc(cut(e.lysing, 260)) + '</p>';
    h += '<div class="sk">' + (live ? 'Kallaður í <b style="color:var(--acc-hi)">' + live.lotur + '</b> lotu(m) síðustu 7 daga · síðast ' + fmtDT(live.sidast) : 'Ekki kallaður í lotu síðustu 7 daga.') + '</div>';
    var kallar = KEDJA[n]; if (kallar) h += '<div><div class="ttl" style="margin-bottom:8px">Kallar á</div>' + kallar.map(function (x) { return '<div class="li">' + esc(x) + '</div>'; }).join('') + '</div>';
    var kalladur = STJORAR.filter(function (sn) { return (KEDJA[sn] || []).indexOf(n) !== -1; }); if (kalladur.length) h += '<div><div class="ttl" style="margin-bottom:8px">Kallaður af</div>' + kalladur.map(function (x) { return '<div class="li">' + esc(x) + '</div>'; }).join('') + '</div>';
    h += '<div><div class="hh"><span class="ttl">Síður</span><span>' + sid.length + ' EIGANDI · ' + und.length + ' UNDIR</span></div>' + sid.slice(0, 14).map(function (x) { return '<div class="li">' + esc(x.titill) + ' <i>' + esc(VEFIR[x.vefur] || x.vefur) + '</i></div>'; }).join('') + (sid.length > 14 ? '<div class="li dim">+ ' + (sid.length - 14) + ' til viðbótar</div>' : '') + '</div>';
    if (e.aldrei && e.aldrei.length) h += '<div><div class="ttl bad" style="margin-bottom:8px">Aldrei</div>' + e.aldrei.slice(0, 4).map(function (x) { return '<div class="li li-bad">' + esc(x) + '</div>'; }).join('') + '</div>';
    h += '<button type="button" class="btn-out" data-skra="' + esc(e.id) + '" style="align-self:flex-start;margin-top:auto">Opna í Agentaskránni</button>';
    sideEl.innerHTML = h;
    if (window.innerWidth <= 860 && sideEl.scrollIntoView) sideEl.scrollIntoView({ behavior: 'smooth', block: 'start' });   // á síma er spjaldið undir netinu
  }

  function setjaThema(t) {
    var rg = t === 'ragnarok';
    var rofi = document.getElementById('thema-rofi');   // rofinn í kjarnanum (js/ragnarok.js) — sama leið, sama vistun
    if (rofi) { if (erRagnarok() !== rg) rofi.click(); }
    else {
      if (rg) document.documentElement.setAttribute('data-thema', 'ragnarok'); else document.documentElement.removeAttribute('data-thema');
      try { localStorage.setItem('jarvis_thema_v1', rg ? 'ragnarok' : 'klassiskt'); } catch (_) {}
      try { if (window.Vidmot) window.Vidmot.setja('jarvis_thema_v1', rg ? 'ragnarok' : 'klassiskt'); } catch (_) {}
    }
    malaThema();
  }
  function malaThema() {
    if (!ov) return;
    var rg = erRagnarok();
    themaKlasi(ov); if (bsOv) themaKlasi(bsOv);
    ov.querySelectorAll('.an-tabs [data-t]').forEach(function (b) { var on = (b.getAttribute('data-t') === 'ragnarok') === rg; b.classList.toggle('tab-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    if (ring) ring.setTheme(rg ? 'ragnarok' : 'jarvis');
  }

  function buildNet() {
    if (ov) return;
    ov = document.createElement('div'); ov.className = 'an-ov'; ov.hidden = true;
    ov.innerHTML = '<div class="jv" role="dialog" aria-modal="true" aria-label="Agentanetið"><div class="jv-grid" aria-hidden="true"></div><div class="jv-scan" aria-hidden="true"></div><div class="jv-topline" aria-hidden="true"></div>' +
      '<div class="an-inner"><header class="an-head"><div class="an-logo">J.A.R.V.I.S.</div><div class="an-tag">AGENTANETIÐ · LAG 2 · STJÓRI → SÉRFRÆÐINGAR → SÍÐUR</div><div id="an-maelar" style="display:contents"></div></header>' +
      '<div class="an-tabs"><button type="button" class="tab" data-t="klassiskt" aria-pressed="false">Klassískt</button><button type="button" class="tab" data-t="ragnarok" aria-pressed="false">Ragnarök</button><button type="button" class="tab an-x" aria-label="Loka">' + SVG.x + '</button></div>' +
      '<div class="an-body"><section class="pnl an-net" aria-label="Agentanetið"><div class="an-stage" id="an-stage"></div></section><aside class="pnl an-side" id="an-side" aria-label="Valinn agent"></aside></div>' +
      '<section class="pnl an-verdir" id="an-verdir" aria-label="Verðir og kerfi"></section></div></div>';
    document.body.appendChild(ov);
    stageEl = ov.querySelector('#an-stage'); sideEl = ov.querySelector('#an-side');
    ov.querySelector('#an-maelar').addEventListener('click', function (ev) { var b = ev.target.closest('[data-sp]'); if (b) opnaSpjald(b.getAttribute('data-sp')); });
    ov.querySelector('.an-x').addEventListener('click', closeNet);
    ov.querySelector('.an-tabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-t]'); if (b) setjaThema(b.getAttribute('data-t')); });
    window.addEventListener('rg:thema', malaThema);
    ov.addEventListener('click', function (ev) {
      var sk = ev.target.closest('[data-skra]'); if (sk) { closeNet(); if (window.openAgentRegistry) window.openAgentRegistry(sk.getAttribute('data-skra')); return; }
      var n = ev.target.closest('[data-ag]'); if (n) velja(n.getAttribute('data-ag'));
    });
    ov.addEventListener('dblclick', function (ev) {
      var n = ev.target.closest('[data-ag]'); if (!n) return;
      var id = registryId(n.getAttribute('data-ag')); if (id && window.openAgentRegistry) { closeNet(); window.openAgentRegistry(id); }
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && ov && !ov.hidden && (!bsOv || bsOv.hidden)) closeNet(); });
    window.addEventListener('resize', fitStageSeint);
    window.addEventListener('orientationchange', fitStageSeint);
  }
  function openNet() {
    hladaLetur(); buildNet();
    ov.hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('an-lock');
    themaKlasi(ov); teiknaMaela(); velja(null); fitStage();
    saekjaSidukort().then(function () { teiknaNet(); teiknaMaela(); malaThema(); });
    saekjaLotur().then(function () { teiknaNet(); teiknaMaela(); malaThema(); });
    saekjaStada().then(teiknaMaela);
  }
  function closeNet() { if (ov) { ov.hidden = true; document.body.style.overflow = ''; document.body.classList.remove('an-lock'); } }

  /* ---------- Sérfræðinga-spjaldið fær takka ---------- */
  function addEntry() {
    var card = document.querySelector('.spjald[data-spjald="serfraedingar"]');
    if (!card || card.querySelector('#an-open-sfr')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'an-open'; btn.id = 'an-open-sfr'; btn.style.margin = '2px 0 6px';
    btn.innerHTML = SVG.net + '<span>Agentanetið — stjóri → sérfræðingar → síður</span>';
    var ref = card.querySelector('#ag-open') || card.querySelector('h2');
    if (ref) ref.insertAdjacentElement('afterend', btn); else card.insertBefore(btn, card.firstChild);
    btn.addEventListener('click', openNet);
  }

  /* ---------- opinbert ---------- */
  function saekja(syn, afram) {
    syn = syn || [];
    if (syn.indexOf('sidukort') !== -1) teiknaSidukort();
    if (syn.indexOf('lotur') !== -1) teiknaLotur(afram);
    if (syn.indexOf('got') !== -1) teiknaGot(afram);
    if (syn.indexOf('minni') !== -1) teiknaMinni(afram);
  }
  window.Agentanet = { saekja: saekja, opna: openNet, loka: closeNet, bidstofa: openBidstofa, gogn: D };

  function init() {
    try { addEntry(); } catch (err) { console.warn('agentanet: spjald', err); }
    var syn = [];
    document.querySelectorAll('.spjald[data-spjald]').forEach(function (el) { if (el.style.display !== 'none') syn.push(el.getAttribute('data-spjald')); });
    saekja(syn);
    if (/^#agentanet/.test(location.hash || '')) openNet();
    if (/^#bidstofa/.test(location.hash || '')) openBidstofa();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
