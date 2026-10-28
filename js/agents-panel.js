/* agents-panel.js — Jarvis → Sérfræðingar: agentaskrá í sprettiglugga.
 * Les window.AGENTS_REGISTRY (js/agents-registry.js, búið til af tools/build-agents-registry.cjs).
 * Sérfræðinga-spjaldið á jarvis.html (lifandi staða úr /data/agentar-stada.json) er teiknað af síðunni sjálfri
 * og er látið vera; hér bætist við 📖-takki og smellur á röð opnar glugga með lýsingu, sérhæfingu,
 * kveikjuorðum, „aldrei“, dagsetningu síðustu uppfærslu og reit til að bæta við upplýsingum
 * (vistast í agent_notes gegnum /api/agent-notes; lota les þær seinna og vinnur þær inn í skrána).
 * Ef skráin vantar gerist ekkert. */
(function () {
  'use strict';
  var R = window.AGENTS_REGISTRY;
  if (!R || !R.list) return;

  var API = '/api/agent-notes';
  var HEIMILI = { brunaholf: 'Brunahólf', slokkvitaeki: 'Slökkvitæki', notandi: 'Notandi (~/.claude)', cowork: 'Cowork' };
  var STUTT = { jarvis: 'Jarvis', bokari: 'Samantha', 'sara-organizer': 'Sara (pör)', 'sara-coworker': 'Sara', kunnaskra: 'Charlize',
    skjol: 'Freeman', gagnaleidslur: 'Statham', hradi: 'Willis', tengingar: 'Samuel L. J.', kerfisheilsa: 'Dr. House', rambo: 'Rambo', samthykktir: 'Columbo',
    rukkari: 'Jóakim', oryggi: 'Arnold', joker: 'Joker', natalie: 'Natalie', prentun: 'DeVito', kort: 'Ramsay', 'elon-musk': 'Elon Musk' };
  var ROD = ['jarvis', 'bokari', 'sara-coworker', 'sara-organizer', 'kunnaskra', 'skjol', 'gagnaleidslur', 'hradi', 'tengingar', 'kerfisheilsa',
    'rambo', 'rukkari', 'oryggi', 'prentun', 'kort', 'elon-musk', 'natalie', 'joker', 'samthykktir'];

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmtD = function (iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : '—'; };
  var shortD = function (iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '.' + m[2] : '—'; };
  var ageD = function (iso) { var t = Date.parse((iso || '') + 'T12:00:00'); return isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 864e5)); };
  var ageTxt = function (n) { return n === null ? '' : n === 0 ? 'í dag' : n === 1 ? 'í gær' : 'fyrir ' + n + ' dögum'; };
  var ageCls = function (n) { return n === null ? '' : n <= 30 ? 'ok' : n <= 60 ? 'mid' : 'old'; };
  var cut = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  var noteKey = function (e) { return e.id === 'almennt' ? 'almennt' : (e.type === 'skill' ? 'skill-' : '') + e.name.toLowerCase(); };
  var typeLbl = { agent: 'Agent', skill: 'Skill', verkfaeri: 'Verkfæri-skill', almennt: 'Almennt' };

  var GENERAL = { id: 'almennt', type: 'almennt', name: 'almennt', emoji: '📝', rodd: null, flokkur: 'almennt',
    lysing: 'Á við alla agenta og skills: vinnulag Agnars, orðaforði, almennar reglur. Skrifaðu hér það sem ekki á heima hjá einum sérfræðingi.',
    serhaefing: [], kveikjuord: [], aldrei: [], tools: [], heimili: [], skrar: [], afbrigdi: [], uppfaert: null };

  var byId = {};
  R.list.forEach(function (e) { byId[e.id] = e; });
  byId.almennt = GENERAL;

  var agents = R.list.filter(function (e) { return e.type === 'agent'; });
  var rod = agents.filter(function (e) { return e.flokkur === 'rodd'; }).sort(function (a, b) { return ROD.indexOf(a.name) - ROD.indexOf(b.name); });
  var len = agents.filter(function (e) { return e.flokkur !== 'rodd'; });
  var skills = R.list.filter(function (e) { return e.type === 'skill' && e.flokkur === 'skill'; });
  var tolSkills = R.list.filter(function (e) { return e.type === 'skill' && e.flokkur !== 'skill'; });

  var counts = {};
  var authorKey = 'ag_author';
  var getAuthor = function () { try { return localStorage.getItem(authorKey) || localStorage.getItem('bh_me') || ''; } catch (_) { return ''; } };
  var setAuthor = function (v) { try { localStorage.setItem(authorKey, v); } catch (_) {} };

  function getJSON(url, opt) {
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; });
    });
  }

  /* ---------- stíll ---------- */
  var css = [
    'body.ag-lock #jvt-launch,body.ag-lock #jvt-panel{display:none!important}',
    '.ag-open{display:block;width:100%;margin:2px 0 6px;padding:10px 12px;background:rgba(79,216,255,.08);border:1px solid var(--cy-dim);color:var(--cy);font:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;text-align:left}',
    '.ag-open:hover{background:rgba(79,216,255,.18);color:#fff}',
    '.spjald[data-spjald="serfraedingar"] .sfr-rod{cursor:pointer}.sfr-rod[data-ag]{cursor:pointer}.sfr-rod[data-ag]:hover .sfr-n,.sfr-rod[data-ag]:focus .sfr-n{color:var(--cy)}.sfr-rod[data-ag]:focus{outline:1px solid var(--cy-dim);outline-offset:1px}',
    '.ag-dags{font-size:9px;color:var(--ink3);white-space:nowrap;margin-left:5px;letter-spacing:.03em}.ag-nb{font-size:9.5px;color:var(--var);margin-left:5px;white-space:nowrap}',
    '.ag-ov{position:fixed;inset:0;z-index:100000;background:rgba(2,6,14,.84);display:flex;align-items:center;justify-content:center;padding:18px}.ag-ov[hidden]{display:none}',
    '.ag-win{width:min(1120px,100%);height:min(800px,100%);background:var(--bg2);border:1px solid var(--cy-dim);display:flex;flex-direction:column;box-shadow:0 0 44px rgba(79,216,255,.12);color:var(--ink)}',
    '.ag-top{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--cy-dim)}.ag-top b{letter-spacing:.2em;font-size:11px;color:var(--cy)}.ag-top i{font-style:normal;font-size:10px;color:var(--ink3);margin-right:auto}',
    '.ag-x,.ag-back{background:none;border:1px solid var(--cy-dim);color:var(--ink2);font:inherit;font-size:12px;padding:5px 10px;cursor:pointer}.ag-x:hover,.ag-back:hover{color:#fff;border-color:var(--cy)}.ag-back{display:none}',
    '.ag-body{flex:1;display:flex;min-height:0}',
    '.ag-list{width:310px;flex:0 0 310px;border-right:1px solid var(--cy-dim);display:flex;flex-direction:column;min-height:0}',
    '.ag-q{margin:10px 10px 6px;background:rgba(79,216,255,.05);border:1px solid var(--cy-dim);color:var(--ink);font:inherit;font-size:12px;padding:8px 10px}.ag-q:focus{outline:1px solid var(--cy);border-color:var(--cy)}',
    '.ag-chips{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px}.ag-chip{background:none;border:1px solid var(--cy-dim);color:var(--ink2);font:inherit;font-size:10px;letter-spacing:.05em;padding:3px 8px;cursor:pointer}.ag-chip.on{color:#021;background:var(--cy);border-color:var(--cy)}',
    '.ag-items{flex:1;overflow:auto;padding:0 6px 10px}.ag-gh{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink3);padding:10px 6px 4px}',
    '.ag-it{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:0;border-left:2px solid transparent;color:var(--ink);font:inherit;padding:7px 6px;cursor:pointer;min-height:38px}',
    '.ag-it:hover{background:rgba(79,216,255,.07)}.ag-it.on{background:rgba(79,216,255,.13);border-left-color:var(--cy)}',
    '.ag-ie{width:22px;text-align:center;font-size:14px;flex:0 0 22px}.ag-in{flex:1;min-width:0;display:flex;flex-direction:column}.ag-in b{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ag-in i{font-style:normal;font-size:10px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ag-det{flex:1;overflow:auto;padding:16px 20px 28px;min-width:0}.ag-empty{color:var(--ink3);padding:30px 0;text-align:center;font-size:12px}',
    '.ag-h{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}.ag-big{font-size:34px;line-height:1}.ag-h h3{margin:0;font-size:20px;letter-spacing:.02em;color:var(--ink)}.ag-h p{margin:2px 0 0;font-size:11px;color:var(--ink2)}',
    '.ag-meta{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 14px}.ag-tag{font-size:10px;letter-spacing:.06em;border:1px solid var(--cy-dim);padding:2px 8px;color:var(--ink2)}',
    '.ag-tag.ok{color:var(--ok);border-color:var(--ok)}.ag-tag.mid{color:var(--var);border-color:var(--var)}.ag-tag.old{color:var(--hae);border-color:var(--hae)}',
    '.ag-s{margin:16px 0 6px;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--cy2);font-weight:700}',
    '.ag-p{font-size:12.5px;line-height:1.55;color:var(--ink);margin:0}.ag-ul{margin:0;padding-left:18px;font-size:12.5px;line-height:1.6;color:var(--ink)}.ag-ul.neg li::marker{color:var(--hae)}',
    '.ag-kv{display:flex;flex-wrap:wrap;gap:6px}.ag-k{background:rgba(79,216,255,.06);border:1px solid var(--cy-dim);color:var(--ink);font:inherit;font-size:11.5px;padding:4px 9px;cursor:pointer}.ag-k:hover{border-color:var(--cy);color:var(--cy)}.ag-k.cp{color:var(--ok);border-color:var(--ok)}',
    '.ag-mini{background:none;border:1px solid var(--cy-dim);color:var(--ink2);font:inherit;font-size:10px;padding:2px 8px;cursor:pointer;margin-left:8px;letter-spacing:.04em}.ag-mini:hover{color:var(--cy);border-color:var(--cy)}',
    '.ag-skra{font-size:11px;color:var(--ink2);line-height:1.7;font-family:ui-monospace,Consolas,monospace}.ag-skra span{color:var(--ink3)}',
    '.ag-det details{margin-top:8px;border:1px solid var(--cy-dim);padding:6px 10px}.ag-det summary{cursor:pointer;font-size:11px;color:var(--ink2)}',
    '.ag-note{margin-top:22px;border:1px solid var(--cy-dim);background:rgba(79,216,255,.04);padding:12px 14px}',
    '.ag-note textarea{width:100%;min-height:92px;resize:vertical;background:rgba(0,0,0,.25);border:1px solid var(--cy-dim);color:var(--ink);font:inherit;font-size:12.5px;line-height:1.5;padding:8px 10px;box-sizing:border-box}.ag-note textarea:focus{outline:1px solid var(--cy);border-color:var(--cy)}',
    '.ag-row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.ag-row input{background:rgba(0,0,0,.25);border:1px solid var(--cy-dim);color:var(--ink);font:inherit;font-size:12px;padding:6px 8px;width:150px}',
    '.ag-save{background:var(--cy);color:#021;border:0;font:inherit;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;cursor:pointer}.ag-save:disabled{opacity:.5;cursor:default}',
    '.ag-msg{font-size:11px;color:var(--ink2)}.ag-msg.err{color:var(--hae)}.ag-msg.ok{color:var(--ok)}.ag-hint{font-size:10.5px;color:var(--ink3);line-height:1.5;margin:0 0 8px}',
    '.ag-nl{margin-top:12px;display:flex;flex-direction:column;gap:8px}.ag-n{border-left:2px solid var(--cy-dim);padding:2px 0 2px 10px;font-size:12px;line-height:1.5}.ag-n small{display:block;color:var(--ink3);font-size:10px;margin-bottom:2px}',
    '.ag-n .st{display:inline-block;margin-left:6px;padding:0 6px;border:1px solid var(--var);color:var(--var);font-size:9.5px;letter-spacing:.06em}.ag-n .st.tekid_inn{color:var(--ok);border-color:var(--ok)}.ag-n .st.hafnad{color:var(--ink3);border-color:var(--ink3)}',
    '.ag-n pre{margin:0;white-space:pre-wrap;word-break:break-word;font:inherit;color:var(--ink)}.ag-n button{background:none;border:0;color:var(--ink3);cursor:pointer;font:inherit;font-size:10px;margin-left:8px}.ag-n button:hover{color:var(--hae)}',
    '@media(max-width:720px){.ag-ov{padding:0}.ag-win{height:100%;border-left:0;border-right:0}.ag-body{position:relative}.ag-list{width:100%;flex:1;border-right:0}.ag-det{display:none;padding:14px 14px 40px}',
    '.ag-win.show .ag-list{display:none}.ag-win.show .ag-det{display:block}.ag-back{display:inline-block}.ag-win:not(.show) .ag-back{display:none}.ag-it{min-height:46px}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'ag-css'; st.textContent = css; document.head.appendChild(st);

  /* ---------- spjaldið á síðunni ---------- */
  // Spjaldið (lifandi staða úr /data/agentar-stada.json) er teiknað af jarvis.html og endurteiknað þar;
  // hér bætist aðeins við 📖-takki fyrir ofan listann og smellur á röð (slóðin í title) opnar gluggann.
  var cardRef = /\.claude\/(agents|skills)\/([^\/\s.]+)/;
  function addEntry() {
    var card = document.querySelector('.spjald[data-spjald="serfraedingar"]');
    if (!card || card.querySelector('#ag-open')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ag-open'; btn.id = 'ag-open';
    btn.textContent = '📖 Agentaskráin — lýsing, kveikjuorð, uppfært';
    var h2 = card.querySelector('h2');
    if (h2 && h2.parentNode === card) h2.insertAdjacentElement('afterend', btn); else card.insertBefore(btn, card.firstChild);
    card.addEventListener('click', function (ev) {
      if (ev.target.closest('#ag-open')) return openWin();
      var r = ev.target.closest('.sfr-rod'); if (!r) return;
      var m = cardRef.exec(r.getAttribute('title') || '');
      openWin(m ? (m[1] === 'agents' ? 'agent:' : 'skill:') + m[2] : undefined);
    });
  }

  /* ---------- lifandi staða úr git (sama skrá og spjaldið notar) ---------- */
  var live = null, liveTried = false;
  function loadLive() {
    if (liveTried) return; liveTried = true;
    getJSON('/data/agentar-stada.json', { cache: 'no-store' }).then(function (j) {
      live = {};
      (j.atridi || []).forEach(function (x) { var k = x.tegund + ':' + x.nafn; (live[k] = live[k] || []).push(x); });
      if (cur && byId[cur]) paintLive(byId[cur]);
    }).catch(function () {});
  }
  function paintLive(e) {
    var el = detEl && detEl.querySelector('#ag-live'); if (!el) return;
    var arr = live && live[e.type + ':' + e.name];
    if (!arr || !arr.length) { el.innerHTML = ''; return; }
    el.innerHTML = arr.map(function (x) {
      var m = x.merki || '🟢';
      var skyr = m === '🔴' ? (x.daudir && x.daudir.length ? 'dauður vísir' : x.breytt + ' á eftir') : m === '🟡' ? x.breytt + ' á eftir' : m === '⚪' ? 'ósnertur 30+ d' : 'uppfærður';
      return '<span class="ag-tag" title="Staða úr git (data/agentar-stada.json): síðasta skrifun, fjöldi skrifa, hvort það sem hann gætir hefur breyst síðan">' +
        esc(m) + ' ' + esc(skyr) + ' · ' + (x.skrif || 0) + ' skrif · skrifað ' + fmtD(x.sidast) + (arr.length > 1 ? ' · ' + (x.heim === 'brunaholf' ? 'bh' : 'slokk') : '') + '</span>';
    }).join('');
  }

  /* ---------- glugginn ---------- */
  var ov, win, qEl, itemsEl, detEl, filter = 'allt', cur = null;

  function build() {
    if (ov) return;
    ov = document.createElement('div'); ov.className = 'ag-ov'; ov.hidden = true;
    ov.innerHTML = '<div class="ag-win" role="dialog" aria-modal="true" aria-label="Agentaskrá">' +
      '<div class="ag-top"><button type="button" class="ag-back">← Listi</button><b>AGENTASKRÁ</b><i>' + R.agents + ' agentar · ' + R.skills + ' skills · byggð ' + fmtD(R.generated) + '</i><button type="button" class="ag-x" aria-label="Loka">✕</button></div>' +
      '<div class="ag-body"><aside class="ag-list"><input class="ag-q" type="search" placeholder="Leita: nafn, kveikjuorð, efni…" autocomplete="off">' +
      '<div class="ag-chips">' + [['allt', 'Allt'], ['agent', 'Agentar'], ['skill', 'Skills'], ['verkfaeri', 'Verkfæri'], ['notes', '📝 Athugasemdir']].map(function (c) { return '<button type="button" class="ag-chip" data-f="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<div class="ag-items"></div></aside><section class="ag-det"></section></div></div>';
    document.body.appendChild(ov);
    win = ov.querySelector('.ag-win'); qEl = ov.querySelector('.ag-q'); itemsEl = ov.querySelector('.ag-items'); detEl = ov.querySelector('.ag-det');
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeWin(); });
    ov.querySelector('.ag-x').addEventListener('click', closeWin);
    ov.querySelector('.ag-back').addEventListener('click', function () { win.classList.remove('show'); });
    qEl.addEventListener('input', drawList);
    ov.querySelector('.ag-chips').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-f]'); if (!b) return; filter = b.getAttribute('data-f'); drawList();
    });
    itemsEl.addEventListener('click', function (ev) { var b = ev.target.closest('[data-id]'); if (b) select(b.getAttribute('data-id')); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !ov.hidden) closeWin(); });
  }

  function hay(e) { return [e.name, e.rodd, STUTT[e.name], e.lysing, e.kveikjuord.join(' '), e.serhaefing.join(' ')].join(' ').toLowerCase(); }
  function drawList() {
    var q = qEl.value.trim().toLowerCase();
    ov.querySelectorAll('.ag-chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-f') === filter); });
    var all = [GENERAL].concat(rod, len, skills, tolSkills);
    var shown = all.filter(function (e) {
      if (filter === 'agent' && e.type !== 'agent') return false;
      if (filter === 'skill' && !(e.type === 'skill' && e.flokkur === 'skill')) return false;
      if (filter === 'verkfaeri' && !(e.type === 'skill' && e.flokkur === 'verkfaeri')) return false;
      if (filter === 'notes' && !(counts[noteKey(e)] > 0)) return false;
      return !q || hay(e).indexOf(q) !== -1;
    });
    var out = '', last = '';
    shown.forEach(function (e) {
      var g = e.id === 'almennt' ? '' : e.type === 'agent' ? 'Agentar' : e.flokkur === 'skill' ? 'Skills' : 'Verkfæri-skills';
      if (g !== last) { if (g) out += '<div class="ag-gh">' + g + '</div>'; last = g; }
      var n = counts[noteKey(e)];
      out += '<button type="button" class="ag-it' + (e.id === cur ? ' on' : '') + '" data-id="' + esc(e.id) + '"><span class="ag-ie">' + esc(e.emoji) + '</span>' +
        '<span class="ag-in"><b>' + esc(STUTT[e.name] ? STUTT[e.name] + ' · ' + e.name : e.name === 'almennt' ? 'Almennt (á við alla)' : e.name) + '</b><i>' +
        esc(e.id === 'almennt' ? 'vinnulag og orðaforði' : (e.type === 'agent' ? 'agent' : 'skill') + ' · uppfært ' + shortD(e.uppfaert)) + '</i></span>' +
        (n ? '<span class="ag-nb">📝' + n + '</span>' : '') + '</button>';
    });
    itemsEl.innerHTML = out || '<div class="ag-empty">Ekkert fannst.</div>';
  }

  function select(id) {
    var e = byId[id]; if (!e) return;
    cur = id; drawList(); win.classList.add('show'); detEl.scrollTop = 0;
    var age = ageD(e.uppfaert);
    var h = '<div class="ag-h"><span class="ag-big">' + esc(e.emoji) + '</span><div><h3>' + esc(STUTT[e.name] ? STUTT[e.name] + ' · ' + e.name : e.id === 'almennt' ? 'Almennt — á við alla' : e.name) + '</h3>' +
      '<p>' + esc(e.rodd ? 'Rödd í Jarvis: ' + e.rodd : typeLbl[e.type === 'skill' && e.flokkur === 'verkfaeri' ? 'verkfaeri' : e.type] || '') + '</p></div></div>';
    h += '<div class="ag-meta"><span class="ag-tag">' + esc(typeLbl[e.type === 'skill' && e.flokkur === 'verkfaeri' ? 'verkfaeri' : e.type]) + '</span>';
    e.heimili.forEach(function (x) { h += '<span class="ag-tag">' + esc(HEIMILI[x] || x) + '</span>'; });
    if (e.uppfaert) h += '<span class="ag-tag ' + ageCls(age) + '" title="Dagsetning síðustu breytingar á skránni">Uppfært ' + fmtD(e.uppfaert) + ' · ' + ageTxt(age) + '</span>';
    h += '<span id="ag-live"></span></div>';
    if (e.svid) h += '<button type="button" class="ag-mini" data-svid="' + esc(e.svid) + '" style="margin:0 0 6px">▶ Spila svið „' + esc(e.svid) + '“ á Jarvis</button>';
    h += '<div class="ag-s">Lýsing</div><p class="ag-p">' + esc(e.lysing || '—') + '</p>';
    if (e.serhaefing.length) h += '<div class="ag-s">Sérhæfir sig í</div><ul class="ag-ul">' + e.serhaefing.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (e.type !== 'almennt') {
      h += '<div class="ag-s">Kveikjuorð <button type="button" class="ag-mini" data-copyall="1">📋 afrita öll</button></div>';
      h += e.kveikjuord.length ? '<div class="ag-kv">' + e.kveikjuord.map(function (k) { return '<button type="button" class="ag-k" data-copy="' + esc(k) + '" title="Smelltu til að afrita">' + esc(k) + '</button>'; }).join('') + '</div>'
        : '<p class="ag-p" style="color:var(--ink3)">Engin kveikjuorð skráð í lýsingunni enn — án þeirra velur Claude þennan síður sjálfur.</p>';
    }
    if (e.aldrei.length) h += '<div class="ag-s">Aldrei</div><ul class="ag-ul neg">' + e.aldrei.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    e.afbrigdi.forEach(function (a) { h += '<details><summary>Önnur útgáfa — ' + esc(HEIMILI[a.repo] || a.repo) + '</summary><p class="ag-p" style="margin-top:6px">' + esc(a.lysing) + '</p></details>'; });
    if (e.skrar.length) h += '<div class="ag-s">Skrár</div><div class="ag-skra">' + e.skrar.map(function (s) { return esc(HEIMILI[s.repo] || s.repo) + ' · ' + esc(s.path) + ' <span>— ' + s.linur + ' línur · ' + fmtD(s.uppfaert) + '</span>'; }).join('<br>') + '</div>';
    if (e.tools.length) h += '<details><summary>Verkfæri (' + e.tools.length + ')</summary><p class="ag-p" style="margin-top:6px;font-size:11px;color:var(--ink2)">' + e.tools.map(esc).join(' · ') + '</p></details>';
    h += '<div class="ag-note"><div class="ag-s" style="margin-top:0">📝 Bæta við upplýsingum</div>' +
      '<p class="ag-hint">Skrifaðu hér það sem ' + (e.id === 'almennt' ? 'allir sérfræðingar' : 'þessi sérfræðingur') + ' ætti að vita: reglu, gildru, orðalag, leiðréttingu. Þetta vistast í gagnagrunninn. Næst þegar þú sendir mig inn les ég athugasemdirnar og vinn þær inn í skrána — þá færast þær í „Tekið inn“.</p>' +
      '<textarea id="ag-ta" maxlength="4000" placeholder="T.d. „Þegar ég segi ósent á ég við …“ eða „Aldrei rukka X án þess að …“"></textarea>' +
      '<div class="ag-row"><input id="ag-au" placeholder="Nafn (valfrjálst)" maxlength="60" value="' + esc(getAuthor()) + '"><button type="button" class="ag-save" id="ag-sv">Vista</button><span class="ag-msg" id="ag-ms"></span></div>' +
      '<div class="ag-nl" id="ag-nl"></div></div>';
    detEl.innerHTML = h;
    paintLive(e);
    loadNotes(e);
  }

  function loadNotes(e) {
    var box = detEl.querySelector('#ag-nl'); if (!box) return;
    var key = noteKey(e);
    getJSON(API + '?agent=' + encodeURIComponent(key)).then(function (j) {
      if (cur !== e.id) return;
      var arr = j.notes || [];
      counts[key] = arr.filter(function (n) { return n.status === 'nytt'; }).length;
      box.innerHTML = arr.length ? arr.map(function (n) {
        var lbl = { nytt: 'Nýtt', tekid_inn: 'Tekið inn', hafnad: 'Hafnað' }[n.status] || n.status;
        return '<div class="ag-n"><small>' + fmtD(n.created_at) + (n.author ? ' · ' + esc(n.author) : '') + '<span class="st ' + esc(n.status) + '">' + lbl + '</span>' +
          (n.status === 'nytt' ? '<button type="button" data-del="' + n.id + '">eyða</button>' : '') + '</small><pre>' + esc(n.note) + '</pre></div>';
      }).join('') : '<p class="ag-hint">Engar athugasemdir enn.</p>';
      paintBadges();
    }).catch(function (err) {
      box.innerHTML = '<p class="ag-msg err">Næ ekki athugasemdum (' + esc(err.message) + '). Vistun virkar þegar /api/agent-notes er í loftinu.</p>';
    });
  }

  function save(e) {
    var ta = detEl.querySelector('#ag-ta'), au = detEl.querySelector('#ag-au'), ms = detEl.querySelector('#ag-ms'), sv = detEl.querySelector('#ag-sv');
    var note = ta.value.trim(); if (!note) { ms.className = 'ag-msg err'; ms.textContent = 'Skrifaðu eitthvað fyrst.'; return; }
    setAuthor(au.value.trim()); sv.disabled = true; ms.className = 'ag-msg'; ms.textContent = 'Vista…';
    getJSON(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: noteKey(e), note: note, author: au.value.trim() }) })
      .then(function () { ta.value = ''; ms.className = 'ag-msg ok'; ms.textContent = '✓ Vistað'; loadNotes(e); })
      .catch(function (err) { ms.className = 'ag-msg err'; ms.textContent = 'Tókst ekki: ' + err.message + ' — textinn er enn í reitnum.'; })
      .then(function () { sv.disabled = false; });
  }

  function paintBadges() {
    document.querySelectorAll('[data-nb]').forEach(function (el) { var n = counts[el.getAttribute('data-nb')]; el.textContent = n ? '📝' + n : ''; });
    if (ov && !ov.hidden) drawList();
  }
  function loadCounts() { getJSON(API + '?counts=1').then(function (j) { counts = j.counts || {}; paintBadges(); }).catch(function () {}); }

  function openWin(id) {
    build(); ov.hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('ag-lock');
    drawList(); loadCounts(); loadLive();
    if (id && byId[id]) select(id); else { win.classList.remove('show'); detEl.innerHTML = '<div class="ag-empty">Veldu sérfræðing til vinstri.</div>'; }
    if (!id) qEl.focus();
  }
  function closeWin() { if (ov) { ov.hidden = true; document.body.style.overflow = ''; document.body.classList.remove('ag-lock'); } }

  document.addEventListener('click', function (ev) {
    if (!ov || ov.hidden || !detEl.contains(ev.target)) return;
    var e = byId[cur]; if (!e) return;
    var c = ev.target.closest('[data-copy]');
    if (c) { copy(c.getAttribute('data-copy'), c); return; }
    var ca = ev.target.closest('[data-copyall]');
    if (ca) { copy('kveikjuorð: ' + e.kveikjuord.join(', '), ca); return; }
    var sid = ev.target.closest('[data-svid]');
    if (sid) { var b = document.querySelector('.svidbtn[data-svid="' + sid.getAttribute('data-svid') + '"]'); if (b) { closeWin(); b.click(); } return; }
    if (ev.target.closest('#ag-sv')) { save(e); return; }
    var d = ev.target.closest('[data-del]');
    if (d && confirm('Eyða þessari athugasemd?')) {
      getJSON(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: Number(d.getAttribute('data-del')) }) })
        .then(function () { loadNotes(e); }).catch(function (err) { alert('Tókst ekki: ' + err.message); });
    }
  });
  function copy(txt, el) {
    var done = function () { el.classList.add('cp'); setTimeout(function () { el.classList.remove('cp'); }, 900); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () {});
    else { var t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (_) {} t.remove(); }
  }

  function init() {
    try { addEntry(); } catch (err) { console.warn('agents-panel: spjald', err); }
    loadCounts();
    window.openAgentRegistry = openWin;
    var m = /^#agent=([\w:-]+)/.exec(location.hash || '');
    if (m) openWin(byId[m[1]] ? m[1] : 'agent:' + m[1]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
