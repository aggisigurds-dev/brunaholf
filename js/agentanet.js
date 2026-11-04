/* agentanet.js — Jarvis lag 2: AGENTANETIÐ (Agentakerfið 2.0, fasi 5, 04.11.2026).
 *
 * Fjögur ný spjöld á jarvis.html og eitt fullskjás-lag:
 *   data-spjald="sidukort"  Síðukort — þekja per vef (data/sidukort.json), síður án eiganda, „Leggja til eiganda“ (agent_notes)
 *   data-spjald="lotur"     Lotur síðustu 7 daga — /api/lotur → charlize_sessions (Stop-hookurinn skrifar), rautt „ólokið minni“
 *   data-spjald="got"       Göt & tillögur — router-göt úr lotum + síður án eiganda → tillaga í agent_notes (sjálfsbæting með samþykki)
 *   data-spjald="minni"     Minnið — /api/charlize-stada: Charlize eftir sviði, kúnnaminni, biðstofa með Samþykkja/Hafna
 *   Agentanetið (⛶)        SVG-graf: Jarvis-kjarninn í miðju → 5 stjórar → sérfræðingar → síður (punktar), verðir í rönd.
 *                           Lifandi yfirlag: agent sem var kallaður í lotu síðustu 7 daga glóir, talan = lotur.
 *                           Smellur á hnút opnar sömu Agentaskrá og 📖 (agents-panel.js). Smellur á agent lýsir síðurnar hans.
 *
 * Les window.AGENTS_REGISTRY (js/agents-registry.js) — sama heimild og Agentaskráin — svo listinn og grafið eru aldrei ósamhljóða.
 * Þemað (klassískt/Ragnarök) erfist af html[data-thema] og CSS-breytunum; takkarnir í laginu skipta því eins og rofinn í kjarnanum.
 * Allt lesaðeins nema: agent_notes (tillögur, status 'nytt') og charlize_inbox um charlize_approve / status 'rejected'.
 * Ef skráin vantar gerist ekkert. */
(function () {
  'use strict';
  var R = window.AGENTS_REGISTRY;
  if (!R || !R.list) return;

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

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cut = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmtDT = function (iso) { var d = new Date(iso || ''); return isNaN(d) ? '—' : p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  var fmtD = function (iso) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || ''); return m ? m[3] + '.' + m[2] : '—'; };
  var idag = function (iso) { var d = new Date(iso || ''), n = new Date(); return !isNaN(d) && d.toDateString() === n.toDateString(); };
  var getAuthor = function () { try { return localStorage.getItem('bh_me') || ''; } catch (_) { return ''; } };

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
  function persona(e) { if (!e) return ''; var r = e.rodd || ''; return r.replace(/\s*\(.*$/, '').trim() || ''; }

  /* ---------- gögn ---------- */
  var D = { sidukort: null, lotur: null, stada: null, inbox: null };
  var sidukortP = null;   // eitt loforð fyrir alla kallara — tvö spjöld sækja samtímis við ræsingu
  function saekjaSidukort() {
    if (!sidukortP) sidukortP = getJSON('/data/sidukort.json', { cache: 'no-store' }).then(function (j) { D.sidukort = j; return j; })
      .catch(function (e) { D.sidukort = { villa: e.message, vefir: R.thekja || [], sidur: [] }; return D.sidukort; });
    return sidukortP;
  }
  var loturP = null;      // beiðni í gangi deilist milli spjalda (lotur + göt sækja samtímis)
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

  /* ---------- stíll ---------- */
  var css = [
    '.an-rod{display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px dashed rgba(79,216,255,.1);font-size:11px;line-height:1.4;min-width:0}.an-rod:last-child{border-bottom:0}',
    '.an-rod .t{color:var(--ink3);white-space:nowrap;font-variant-numeric:tabular-nums;letter-spacing:.02em}.an-rod .n{flex:1;min-width:0;color:var(--ink)}.an-rod .n i{font-style:normal;color:var(--ink3);margin-left:4px}',
    '.an-rod .m{color:var(--ink2);white-space:nowrap}.an-rod.olokid .m{color:var(--hae)}.an-rod .e{letter-spacing:.05em}',
    '.an-tom{color:var(--ink3);font-size:11px;padding:6px 0}.an-villa{color:var(--hae);font-size:10.5px;padding:4px 0}',
    '.an-btn{background:none;border:1px solid var(--cy-dim);color:var(--ink2);font:inherit;font-size:10px;letter-spacing:.06em;padding:3px 8px;cursor:pointer;white-space:nowrap}.an-btn:hover{color:var(--cy);border-color:var(--cy)}',
    '.an-btn.ok{color:var(--ok);border-color:var(--ok)}.an-btn.ok:hover{background:rgba(67,245,160,.12)}.an-btn.hae{color:var(--hae);border-color:var(--hae)}.an-btn.hae:hover{background:rgba(255,90,110,.12)}.an-btn:disabled{opacity:.45;cursor:default}',
    '.an-open{display:block;width:100%;margin:8px 0 2px;padding:10px 12px;background:rgba(79,216,255,.08);border:1px solid var(--cy-dim);color:var(--cy);font:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;text-align:left}.an-open:hover{background:rgba(79,216,255,.18);color:#fff}',
    '.an-h{display:flex;justify-content:space-between;align-items:baseline;margin:10px 0 3px;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--cy2);font-weight:700}.an-h span{color:var(--ink3);letter-spacing:.06em;font-weight:400}',
    '.an-chips{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 6px}.an-chip{border:1px solid var(--cy-dim);color:var(--ink2);font-size:10px;padding:2px 7px;letter-spacing:.04em}.an-chip b{color:var(--ink);font-weight:700}',
    /* lagið */
    '.an-ov{position:fixed;inset:0;z-index:100000;background:rgba(2,6,14,.9);display:flex;flex-direction:column;padding:12px}.an-ov[hidden]{display:none}body.an-lock #jvt-launch,body.an-lock #jvt-panel{display:none!important}',
    '.an-win{flex:1;min-height:0;background:var(--bg2);border:1px solid var(--cy-dim);display:flex;flex-direction:column;box-shadow:0 0 44px rgba(79,216,255,.12);color:var(--ink)}',
    '.an-top{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--cy-dim);flex-wrap:wrap}.an-top b{letter-spacing:.3em;font-size:12px;color:var(--cy)}.an-top i{font-style:normal;font-size:10px;color:var(--ink3);letter-spacing:.12em;text-transform:uppercase}',
    '.an-maelar{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}.an-mae{border:1px solid var(--cy-dim);padding:3px 9px;font-size:10px;color:var(--ink2);letter-spacing:.04em;white-space:nowrap}.an-mae b{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}.an-mae.hae b{color:var(--hae)}.an-mae.var b{color:var(--var)}',
    '.an-thema{display:flex;gap:4px}.an-thema button{background:none;border:1px solid var(--cy-dim);color:var(--ink2);font:inherit;font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:6px 10px;cursor:pointer;min-height:32px}.an-thema button.on{color:var(--cy);border-color:var(--cy);background:rgba(79,216,255,.1)}',
    '.an-x{background:none;border:1px solid var(--cy-dim);color:var(--ink2);font:inherit;font-size:13px;padding:4px 10px;cursor:pointer}.an-x:hover{color:#fff;border-color:var(--cy)}',
    '.an-body{flex:1;min-height:0;display:flex}.an-svgw{flex:1;min-width:0;overflow:auto;position:relative}.an-svgw svg{display:block;width:100%;height:100%;min-height:520px;font-family:var(--mono)}',
    '.an-side{width:300px;flex:0 0 300px;border-left:1px solid var(--cy-dim);overflow:auto;padding:12px 14px;font-size:11.5px;line-height:1.5}.an-side h3{margin:0 0 4px;font-size:15px;color:var(--ink)}.an-side p{margin:4px 0;color:var(--ink2)}',
    '.an-side .an-p{font-size:11px;color:var(--ink)}.an-side ul{margin:4px 0;padding-left:16px;font-size:11px}.an-side li{color:var(--ink2)}.an-side li.hae{color:var(--hae)}',
    '.an-fot{padding:6px 14px;border-top:1px solid var(--cy-dim);display:flex;gap:6px;flex-wrap:wrap;align-items:center}.an-fot .l{font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--cy2);font-weight:700;margin-right:4px}',
    '.an-v{border:1px solid var(--cy-dim);color:var(--ink2);padding:2px 8px;font-size:10px;cursor:pointer;background:none;font-family:inherit}.an-v.hae{border-color:var(--hae);color:var(--hae)}.an-v.var{border-color:var(--var);color:var(--var)}.an-v:hover{color:#fff}',
    /* SVG-hnútar */
    '.an-node{cursor:pointer}.an-node rect{fill:var(--bg2);stroke:var(--cy-dim);stroke-width:1}.an-node.stjori rect{stroke:var(--cy);stroke-width:1.6}.an-node.nyr rect{stroke:var(--var);stroke-dasharray:4 3}',
    '.an-node:hover rect,.an-node.valinn rect{stroke:var(--cy);fill:rgba(79,216,255,.1)}.an-node.lif rect{filter:drop-shadow(0 0 7px var(--cy))}',
    '.an-node text{fill:var(--ink);font-size:11px;pointer-events:none}.an-node text.sm{font-size:9.2px}.an-node .u{fill:var(--ink3);font-size:9px}.an-node .hae{fill:var(--hae)}.an-node .lifn{fill:var(--bg);font-size:9px;font-weight:700}',
    '.an-lina{stroke:var(--cy-dim);stroke-width:1;fill:none}.an-lina.stjori{stroke:var(--cy);stroke-width:1.4;opacity:.7}.an-lina.nyr{stroke:var(--var);stroke-dasharray:5 4}.an-lina.sida{stroke:var(--cy);opacity:.55}',
    '.an-dot{cursor:pointer}.an-dot circle{fill:var(--ok);opacity:.75}.an-dot.an-x1 circle{fill:var(--hae);opacity:1}.an-dot.an-m circle{fill:var(--ink3);opacity:.6}.an-dot.lys circle{r:4.5;opacity:1;filter:drop-shadow(0 0 5px var(--cy))}.an-dot.daufur circle{opacity:.12}',
    '.an-vef{fill:var(--ink3);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase}.an-kj circle{fill:none;stroke:var(--cy);opacity:.5}.an-kj .sveip{fill:var(--cy);opacity:.12}.an-kj .agn{fill:var(--cy);opacity:.8}.an-kj .jt{fill:var(--cy);font-size:11px;letter-spacing:.3em;font-weight:700}.an-kj .jt2{fill:var(--ink3);font-size:8.5px}',
    'html[data-thema="ragnarok"] .an-ov{background:rgba(0,0,0,.92)}html[data-thema="ragnarok"] .an-node.lif rect{filter:drop-shadow(0 0 8px #ffb347)}',
    /* biðstofa */
    '.an-bs{width:min(960px,100%);height:min(760px,100%);margin:auto;background:var(--bg2);border:1px solid var(--cy-dim);display:flex;flex-direction:column;color:var(--ink);box-shadow:0 0 44px rgba(79,216,255,.12)}',
    '.an-bs .an-top b{letter-spacing:.2em}.an-bs-l{flex:1;overflow:auto;padding:10px 14px}.an-k{border:1px solid var(--cy-dim);padding:8px 10px;margin-bottom:8px;background:rgba(79,216,255,.03)}.an-k.burt{opacity:.35;pointer-events:none}',
    '.an-k small{display:block;color:var(--ink3);font-size:10px;letter-spacing:.04em;margin-bottom:3px}.an-k .f{font-size:12px;line-height:1.5;color:var(--ink)}.an-k .d{font-size:11px;color:var(--ink2);margin-top:3px;line-height:1.45}.an-k .r{display:flex;gap:6px;margin-top:6px;align-items:center}.an-k .r span{font-size:10px;color:var(--ink3);margin-left:auto}',
    '@media(max-width:860px){.an-side{display:none}.an-ov{padding:0}.an-win{border:0}.an-svgw svg{min-height:420px}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'an-css'; st.textContent = css; document.head.appendChild(st);

  /* ---------- hjálp: tillaga í agent_notes ---------- */
  function leggjaTil(texti, el) {
    var hver = prompt('Tillaga vistast í agent_notes (status „nýtt“) og lota vinnur hana inn.\n\n' + texti + '\n\nHver á að eiga þetta? (agent-nafn, t.d. bord-flettur)');
    if (hver == null) return;
    hver = hver.trim();
    var note = texti + (hver ? ' → eigandi: ' + hver : '');
    if (el) el.disabled = true;
    postJSON(API_NOTES, { agent: 'almennt', note: note, author: getAuthor() })
      .then(function () { if (el) { el.textContent = '✓ sent'; el.classList.add('ok'); } })
      .catch(function (e) { if (el) { el.disabled = false; } alert('Tókst ekki: ' + e.message); });
  }

  /* ---------- spjald: Síðukort ---------- */
  function teiknaSidukort() {
    var box = document.getElementById('an-sidukort'); if (!box) return;
    saekjaSidukort().then(function (j) {
      var h = '';
      (j.vefir || []).forEach(function (v) {
        var cls = v.hlutfall >= 95 ? 'ok' : v.hlutfall >= 80 ? 'var' : 'hae';
        h += '<div class="maelir"><div class="lina"><span>' + esc(VEFIR[v.vefur] || v.vefur) + '</span><b>' + v.med_eiganda + '/' + v.alls + (v.an_eiganda ? ' <span style="color:var(--hae);letter-spacing:0">· ' + v.an_eiganda + ' ❌</span>' : '') + '</b></div>' +
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
      h += '<button type="button" class="an-open" id="an-opna">⛶ Agentanetið — stjóri → sérfræðingar → síður</button>';
      box.innerHTML = h;
      box.onclick = function (ev) {
        var b = ev.target.closest('[data-tillaga]');
        if (b) { var p = an[Number(b.getAttribute('data-tillaga'))]; leggjaTil('Síðukort: „' + p.titill + '“ (' + (VEFIR[p.vefur] || p.vefur) + ', ' + (p.leid || p.id) + ') vantar eiganda', b); return; }
        if (ev.target.closest('#an-opna')) openNet();
      };
    });
  }

  /* ---------- spjald: Lotur ---------- */
  function teiknaLotur(afram) {
    var box = document.getElementById('an-lotur'); if (!box) return;
    saekjaLotur(afram).then(function (j) {
      var t = j.tolur || {}, rows = j.rows || [];
      var h = '<div class="an-chips"><span class="an-chip"><b>' + rows.length + '</b> lotur</span><span class="an-chip"><b>' + (t.med_kt || 0) + '</b> með kt</span>' +
        '<span class="an-chip"' + (t.olokid ? ' style="border-color:var(--hae);color:var(--hae)"' : '') + '><b>' + (t.olokid || 0) + '</b> ólokið minni</span><span class="an-chip"><b>' + (t.kunni_skrifad || 0) + '</b> kúnnaminni skráð</span></div>';
      if (j.villa) h += '<div class="an-villa">' + esc(j.villa) + (/401|Innskráning/.test(j.villa) ? ' — skráðu þig inn sem starfsmaður.' : '') + '</div>';
      if (!rows.length && !j.villa) h += '<div class="an-tom">Engar lotur skráðar síðustu 7 daga. Stop-hookurinn (tools/lotu-lok.cjs) skrifar hér þegar lota lýkur.</div>';
      rows.slice(0, 12).forEach(function (s) {
        var ag = (s.agents_called || []).map(function (a) { var e = entry(a); return e ? '<span title="' + esc(a) + '">' + esc(e.emoji) + '</span>' : ''; }).join('');
        h += '<div class="an-rod' + (s.olokid ? ' olokid' : '') + '" title="' + esc(s.cwd || '') + (s.machine ? ' · ' + s.machine : '') + '"><span class="t">' + fmtDT(s.last_at) + '</span>' +
          '<span class="n">' + esc(cut(s.summary || '(engin samantekt)', 110)) + '<i>' + esc(s.repo || '?') + ' · ' + (s.turns || 0) + ' svör' + ((s.kennitolur || []).length ? ' · ' + s.kennitolur.length + ' kt' : '') + '</i></span>' +
          '<span class="m">' + (s.olokid ? 'ólokið minni' : ag ? '<span class="e">' + ag + '</span>' : (s.kunni_skrifad ? '✓ ' + s.kunni_skrifad : '')) + '</span></div>';
      });
      box.innerHTML = h;
    });
  }

  /* ---------- spjald: Göt & tillögur ---------- */
  function teiknaGot(afram) {
    var box = document.getElementById('an-got'); if (!box) return;
    Promise.all([saekjaLotur(afram), saekjaSidukort()]).then(function (r) {
      var lot = r[0], sk = r[1];
      var got = lot.got || [];
      var an = (sk.sidur || []).filter(function (p) { return p.stada === '❌'; });
      var sof = (sk.sidur || []).filter(function (p) { return p.merki === 'sofandi'; });
      var okalladir = agents.filter(function (e) { return !(lot.agentar || {})[e.name] && STJORAR.indexOf(e.name) === -1; }).length;
      var h = '<div class="an-chips"><span class="an-chip"' + (got.length ? ' style="border-color:var(--hae);color:var(--hae)"' : '') + '><b>' + got.length + '</b> router-göt</span><span class="an-chip"><b>' + an.length + '</b> síður án eiganda</span><span class="an-chip"><b>' + sof.length + '</b> sofandi síður</span><span class="an-chip"><b>' + okalladir + '</b> agentar ókallaðir 7 d</span></div>';
      if (lot.villa) h += '<div class="an-villa">' + esc(lot.villa) + '</div>';
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
  function teiknaMinni(afram) {
    var box = document.getElementById('an-minni'); if (!box) return;
    saekjaStada(afram).then(function (j) {
      if (j.villa) { box.innerHTML = '<div class="an-villa">' + esc(j.villa) + (/401|Innskráning/.test(j.villa) ? ' — skráðu þig inn sem starfsmaður.' : '') + '</div>'; return; }
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
      h += '<button type="button" class="an-open" id="an-bidstofa">🗂 Biðstofan — samþykkja / hafna (' + (ib.pending || 0) + ')</button>';
      box.innerHTML = h;
      box.onclick = function (ev) { if (ev.target.closest('#an-bidstofa')) openBidstofa(); };
    });
  }

  /* ---------- Biðstofan ---------- */
  var bsOv = null, bsScope = '';
  function openBidstofa() {
    if (!bsOv) {
      bsOv = document.createElement('div'); bsOv.className = 'an-ov'; bsOv.hidden = true;
      bsOv.innerHTML = '<div class="an-bs" role="dialog" aria-modal="true" aria-label="Charlize biðstofa"><div class="an-top"><b>CHARLIZE · BIÐSTOFA</b><i id="an-bs-t">sæki…</i>' +
        '<div class="an-maelar" id="an-bs-f"></div><button type="button" class="an-x" aria-label="Loka">✕</button></div><div class="an-bs-l" id="an-bs-l"></div>' +
        '<div class="an-fot"><span class="l">Reglan</span><span style="font-size:10.5px;color:var(--ink3)">Samþykkja = charlize_approve → charlize_knowledge (sama leið og SQL-samþykktin). Hafna = status rejected með athugasemd. Ekkert fer beint í rekstrargögn.</span></div></div>';
      document.body.appendChild(bsOv);
      bsOv.addEventListener('click', function (ev) { if (ev.target === bsOv) closeBidstofa(); });
      bsOv.querySelector('.an-x').addEventListener('click', closeBidstofa);
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
    bsOv.hidden = false; document.body.style.overflow = 'hidden';
    hladaBidstofu();
  }
  function closeBidstofa() { if (bsOv) { bsOv.hidden = true; document.body.style.overflow = ''; } }
  function hladaBidstofu() {
    var l = bsOv.querySelector('#an-bs-l'), t = bsOv.querySelector('#an-bs-t'), f = bsOv.querySelector('#an-bs-f');
    l.innerHTML = '<div class="an-tom">sæki…</div>';
    getJSON(API_STADA + '?op=inbox&limit=40' + (bsScope ? '&scope=' + encodeURIComponent(bsScope) : '')).then(function (j) {
      t.textContent = (j.pending || 0) + ' í bið'; t.setAttribute('data-n', j.pending || 0);
      var ps = (D.stada && D.stada.inbox && D.stada.inbox.per_scope) || {};
      f.innerHTML = '<button type="button" class="an-v' + (!bsScope ? ' var' : '') + '" data-sc="">Allt</button>' + Object.keys(ps).map(function (s) { return '<button type="button" class="an-v' + (bsScope === s ? ' var' : '') + '" data-sc="' + esc(s) + '">' + esc(s) + ' ' + ps[s] + '</button>'; }).join('');
      if (!(j.rows || []).length) { l.innerHTML = '<div class="an-tom">Biðstofan er tóm.</div>'; return; }
      l.innerHTML = j.rows.map(function (r) {
        return '<div class="an-k" data-id="' + r.id + '"><small>#' + r.id + ' · ' + esc(r.scope) + ' / ' + esc(r.topic || '—') + ' · ' + esc(r.agent || '?') + ' · ' + fmtD(r.created_at) + (r.kennitala ? ' · kt ' + esc(r.kennitala) : '') + (r.confidence ? ' · ' + esc(r.confidence) : '') + '</small>' +
          '<div class="f">' + esc(r.fact) + '</div>' + (r.detail ? '<div class="d">' + esc(cut(r.detail, 320)) + '</div>' : '') +
          '<div class="r"><button type="button" class="an-btn ok" data-adg="samthykkja">✓ Samþykkja</button><button type="button" class="an-btn hae" data-adg="hafna">✕ Hafna</button><span>' + esc(cut(r.source_path || '', 50)) + '</span></div></div>';
      }).join('');
    }).catch(function (e) { l.innerHTML = '<div class="an-villa">' + esc(e.message) + '</div>'; });
  }

  /* ---------- Agentanetið (SVG) ---------- */
  var ov = null, svgEl = null, sideEl = null, valinn = null;
  var W = 1200, H = 900, CX = 600, CY = 450, R1 = 180, R2 = 280, R3 = 410, STAGG = 48;   // hermt 04.11: engin skörun hnúta/punkta/kjarna   // hringur 2 staggar ±STAGG svo 19 spjöld skarist ekki
  function pos(r, deg) { var a = (deg - 90) * Math.PI / 180; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }

  function nodeSvg(e, p, cls, undir) {
    var n = e.name, live = (D.lotur && D.lotur.agentar || {})[n];
    var w = 124, hh = 44, x = p.x - w / 2, y = p.y - hh / 2;
    var g = '<g class="an-node ' + cls + (live ? ' lif' : '') + (valinn === n ? ' valinn' : '') + '" data-ag="' + esc(n) + '" transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')">' +
      '<rect width="' + w + '" height="' + hh + '" rx="2"/>' +
      '<text x="8" y="18"' + (n.length > 14 ? ' class="sm"' : '') + '>' + esc(e.emoji || '') + ' ' + esc(n) + '</text>' +
      '<text x="8" y="33" class="u">' + esc(cut(undir, 25)) + '</text>';
    if (live) g += '<circle cx="' + (w - 10) + '" cy="10" r="8" fill="var(--cy)"/><text x="' + (w - 10) + '" y="13.5" text-anchor="middle" class="lifn">' + live.lotur + '</text>';
    return g + '</g>';
  }

  function teiknaNet() {
    if (!svgEl) return;
    var sk = D.sidukort || { sidur: [] }, pages = sk.sidur || [];
    var lot = D.lotur || { agentar: {} };
    var verdir = {}; VERDIR.forEach(function (v) { verdir[v] = true; });
    var stj = STJORAR.map(entry).filter(Boolean);
    var ser = agents.filter(function (e) { return STJORAR.indexOf(e.name) === -1 && !verdir[e.name] && e.name !== 'jarvis'; })
      .concat(['arnold', '3dJoker'].map(entry).filter(Boolean))
      .filter(function (e, i, a) { return a.indexOf(e) === i; })
      .sort(function (a, b) { return eigandaSidur(b).length - eigandaSidur(a).length; });
    // raða sérfræðingum þannig að þeir lendi nálægt stjóranum sem kallar á þá
    var ord = []; STJORAR.forEach(function (s) { (KEDJA[s] || []).forEach(function (n) { if (ord.indexOf(n) === -1 && ser.some(function (e) { return e.name === n; })) ord.push(n); }); });
    ser.forEach(function (e) { if (ord.indexOf(e.name) === -1) ord.push(e.name); });
    ser = ord.map(entry);
    var P1 = {}, P2 = {};
    stj.forEach(function (e, i) { P1[e.name] = pos(R1, i * 360 / stj.length); });
    // gráðug staðsetning: hver sérfræðingur fær fyrsta radíusinn (innar/utar til skiptis) sem skarast ekki við það sem er komið
    var sett = Object.keys(P1).map(function (k) { return P1[k]; });
    var skarast = function (p, q) { return Math.abs(p.x - q.x) < 132 && Math.abs(p.y - q.y) < 50; };
    ser.forEach(function (e, i) {
      var deg = i * 360 / ser.length + 180 / ser.length;
      var kostir = i % 2 ? [R2 + STAGG, R2 - STAGG, R2, R2 - STAGG * 1.7] : [R2 - STAGG, R2 + STAGG, R2, R2 - STAGG * 1.7];   // aldrei utar en R2+STAGG (punktahringurinn)
      var best = null, bestN = 1e9;
      for (var k = 0; k < kostir.length; k++) {
        var p = pos(kostir[k], deg), n = sett.filter(function (q) { return skarast(p, q); }).length;
        if (n < bestN) { best = p; bestN = n; }
        if (!n) break;
      }
      P2[e.name] = best; sett.push(best);
    });

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Agentanetið">';
    s += '<defs><radialGradient id="an-g"><stop offset="0" stop-color="var(--cy)" stop-opacity=".22"/><stop offset="1" stop-color="var(--cy)" stop-opacity="0"/></radialGradient></defs>';
    s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R1 + '" fill="none" stroke="var(--cy-dim)" stroke-dasharray="2 6"/><circle cx="' + CX + '" cy="' + CY + '" r="' + R2 + '" fill="none" stroke="var(--cy-dim)" stroke-dasharray="2 6"/><circle cx="' + CX + '" cy="' + CY + '" r="' + R3 + '" fill="none" stroke="var(--cy-dim)" opacity=".5"/>';
    // línur: kjarni → stjóri · stjóri → sérfræðingur
    stj.forEach(function (e) { var p = P1[e.name]; s += '<line class="an-lina stjori" x1="' + CX + '" y1="' + CY + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '"/>'; });
    STJORAR.forEach(function (sn) { var a = P1[sn]; if (!a) return; (KEDJA[sn] || []).forEach(function (n) { var b = P2[n]; if (!b) return; s += '<line class="an-lina' + (NYIR.indexOf(n) !== -1 ? ' nyr' : '') + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '"/>'; }); });
    // síður: punktar á ysta hring, geirar per vef
    var perVef = {}; VEF_ROD.forEach(function (v) { perVef[v] = pages.filter(function (p) { return p.vefur === v; }); });
    var alls = pages.length || 1, deg = 0, dots = '';
    var valSidur = valinn && entry(valinn) ? eigandaSidur(entry(valinn)).map(function (x) { return x.vefur + ':' + x.id; }) : null;
    VEF_ROD.forEach(function (v) {
      var ps = perVef[v], span = 360 * ps.length / alls, start = deg;
      var lab = pos(R3 + 26, start + span / 2);
      dots += '<text class="an-vef" x="' + lab.x.toFixed(1) + '" y="' + lab.y.toFixed(1) + '" text-anchor="middle">' + esc(VEFIR[v]) + ' ' + ps.length + '</text>';
      ps.forEach(function (p, i) {
        var pp = pos(R3 + [-8, 0, 8][i % 3], start + span * (i + 0.5) / ps.length);
        var key = p.vefur + ':' + p.id, lys = valSidur && valSidur.indexOf(key) !== -1;
        var cls = p.stada === '❌' ? 'an-x1' : p.merki ? 'an-m' : '';
        dots += '<g class="an-dot ' + cls + (lys ? ' lys' : valSidur ? ' daufur' : '') + '" data-sida="' + esc(key) + '"><title>' + esc(p.titill) + ' — ' + esc(VEFIR[v]) + (p.eigandi_nafn ? ' · ' + esc(p.eigandi_nafn) + (p.eigandi_utan ? ' ⇢' : '') : ' · ENGINN EIGANDI') + (p.merki ? ' · ' + esc(p.merki) : '') + '</title><circle cx="' + pp.x.toFixed(1) + '" cy="' + pp.y.toFixed(1) + '" r="3"/></g>';
        if (lys) { var o = P2[valinn] || P1[valinn]; if (o) s += '<line class="an-lina sida" x1="' + o.x.toFixed(1) + '" y1="' + o.y.toFixed(1) + '" x2="' + pp.x.toFixed(1) + '" y2="' + pp.y.toFixed(1) + '"/>'; }
      });
      deg += span;
    });
    s += dots;
    // Jarvis-kjarninn: radar með sveip og ögnum
    s += '<g class="an-kj" data-ag="jarvis" style="cursor:pointer"><circle cx="' + CX + '" cy="' + CY + '" r="88" fill="url(#an-g)" stroke="none"/>';
    [72, 54, 36, 18].forEach(function (r, i) { s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + r + '" stroke-width="' + (i ? .8 : 1.4) + '"/>'; });
    s += '<path class="sveip" d="M ' + CX + ' ' + CY + ' L ' + CX + ' ' + (CY - 72) + ' A 72 72 0 0 1 ' + (CX + 72 * Math.sin(Math.PI / 3)).toFixed(1) + ' ' + (CY - 72 * Math.cos(Math.PI / 3)).toFixed(1) + ' Z"><animateTransform attributeName="transform" type="rotate" from="0 ' + CX + ' ' + CY + '" to="360 ' + CX + ' ' + CY + '" dur="6s" repeatCount="indefinite"/></path>';
    for (var i = 0; i < 18; i++) { var ang = i * 137.5, rr = 14 + (i * 23) % 56; var q = pos(rr, ang); s += '<circle class="agn" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + (1 + (i % 3) * .6) + '"><animate attributeName="opacity" values=".2;1;.2" dur="' + (2 + (i % 5)) + 's" repeatCount="indefinite"/></circle>'; }
    s += '<text class="jt" x="' + CX + '" y="' + (CY - 2) + '" text-anchor="middle">J.A.R.V.I.S.</text><text class="jt2" x="' + CX + '" y="' + (CY + 12) + '" text-anchor="middle">' + R.agents + ' agentar · ' + R.skills + ' skills</text></g>';
    // hnútar
    stj.forEach(function (e) {
      var v = STJORI_VEFUR[e.name], th = v && (sk.vefir || R.thekja || []).filter(function (t) { return t.vefur === v; })[0];
      var u = persona(e) + (th ? ' · ' + th.alls + ' síður' + (th.an_eiganda ? ' · ' + th.an_eiganda + ' ❌' : '') : ' · ' + eigandaSidur(e).length + ' síður');
      s += nodeSvg(e, P1[e.name], 'stjori' + (NYIR.indexOf(e.name) !== -1 ? ' nyr' : ''), u);
    });
    ser.forEach(function (e) { s += nodeSvg(e, P2[e.name], NYIR.indexOf(e.name) !== -1 ? 'nyr' : '', persona(e) + ' · ' + eigandaSidur(e).length + ' síður'); });
    s += '</svg>';
    svgEl.innerHTML = s;
    teiknaVerdi();
  }

  function teiknaVerdi() {
    var f = ov.querySelector('#an-verdir'); if (!f) return;
    var lot = D.lotur || { agentar: {} };
    f.innerHTML = '<span class="l">Verðir og kerfi · kallast á undan aðgerð, ekki í keðjunni</span>' + VERDIR.map(function (n) {
      var e = entry(n); if (!e) return '';
      var cls = (n === 'netvordur' || n === 'rambo') ? ' hae' : NYIR.indexOf(n) !== -1 ? ' var' : '';
      var live = (lot.agentar || {})[n];
      return '<button type="button" class="an-v' + cls + '" data-ag="' + esc(n) + '">' + esc(e.emoji) + ' ' + esc(n) + (persona(e) ? ' · ' + esc(persona(e)) : '') + (live ? ' · ' + live.lotur + ' lotur' : '') + '</button>';
    }).join('');
  }

  function teiknaMaela() {
    var m = ov.querySelector('#an-maelar'); if (!m) return;
    var st = D.stada || {}, k = st.knowledge || {}, ib = st.inbox || {}, ku = st.kunni || {}, lot = D.lotur || {}, t = lot.tolur || {}, sk = D.sidukort || {};
    var an = (sk.sidur || []).filter(function (p) { return p.stada === '❌'; }).length;
    var hitt = (lot.rows || []).filter(function (r) { return idag(r.last_at); }).length;
    m.innerHTML = [
      ['Charlize', (k.active != null ? k.active : '…') + ' virkar', ''],
      ['Biðstofa', ib.pending != null ? ib.pending : '…', ib.pending > 0 ? 'var' : ''],
      ['Kúnnaminni', (ku.felog != null ? ku.felog + ' / ' + (ku.af || '?') : '…'), ''],
      ['Lotur 7 d', t.lotur != null ? t.lotur : '…', ''],
      ['Ólokið minni', t.olokid != null ? t.olokid : '…', t.olokid > 0 ? 'hae' : ''],
      ['Síður án eiganda', an, an > 0 ? 'hae' : ''],
      ['Göt', (lot.got || []).length, (lot.got || []).length ? 'hae' : ''],
      ['Lotur í dag', hitt, '']
    ].map(function (x) { return '<span class="an-mae ' + x[2] + '">' + x[0] + ' <b>' + x[1] + '</b></span>'; }).join('');
    if (lot.villa || st.villa) m.innerHTML += '<span class="an-mae hae" title="' + esc(lot.villa || st.villa) + '">' + (/401|Innskráning/.test(lot.villa || st.villa) ? 'innskráning starfsmanns vantar' : 'lifandi gögn náðust ekki') + '</span>';
  }

  function velja(n) {
    valinn = valinn === n ? null : n;
    teiknaNet();
    var e = entry(n); if (!sideEl) return;
    if (!e || valinn !== n) { sideEl.innerHTML = '<p>Smelltu á agent til að lýsa síðurnar hans og sjá hvað hann gætir. Tvísmellur opnar Agentaskrána.</p>'; return; }
    var sid = eigandaSidur(e), und = (e.sidur || []).filter(function (s) { return s.hlutverk === 'undiragent'; });
    var live = (D.lotur && D.lotur.agentar || {})[n];
    var h = '<h3>' + esc(e.emoji) + ' ' + esc(n) + '</h3><p>' + esc(e.rodd || (e.type === 'skill' ? 'skill' : 'agent')) + (NYIR.indexOf(n) !== -1 ? ' · <span style="color:var(--var)">nýr 04.11</span>' : '') + '</p>';
    h += '<p class="an-p">' + esc(cut(e.lysing, 260)) + '</p>';
    if (live) h += '<p>Kallaður í <b style="color:var(--cy)">' + live.lotur + '</b> lotu(m) síðustu 7 daga · síðast ' + fmtDT(live.sidast) + '</p>';
    else h += '<p style="color:var(--ink3)">Ekki kallaður í lotu síðustu 7 daga.</p>';
    var kallar = KEDJA[n]; if (kallar) h += '<div class="an-h">Kallar á</div><ul>' + kallar.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    var kalladur = STJORAR.filter(function (sn) { return (KEDJA[sn] || []).indexOf(n) !== -1; }); if (kalladur.length) h += '<div class="an-h">Kallaður af</div><ul>' + kalladur.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<div class="an-h">Síður <span>' + sid.length + ' eigandi · ' + und.length + ' undir</span></div><ul>' + sid.slice(0, 14).map(function (x) { return '<li>' + esc(x.titill) + ' <i style="color:var(--ink3)">' + esc(VEFIR[x.vefur] || x.vefur) + '</i></li>'; }).join('') + (sid.length > 14 ? '<li style="color:var(--ink3)">+ ' + (sid.length - 14) + '</li>' : '') + '</ul>';
    if (e.aldrei && e.aldrei.length) h += '<div class="an-h">Aldrei</div><ul>' + e.aldrei.slice(0, 4).map(function (x) { return '<li class="hae">' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<p><button type="button" class="an-btn" data-skra="' + esc(e.id) + '">📖 Opna í Agentaskránni</button></p>';
    sideEl.innerHTML = h;
  }

  function setjaThema(t) {
    var rg = t === 'ragnarok';
    var rofi = document.getElementById('thema-rofi');   // rofinn í kjarnanum (js/ragnarok.js) — sama leið, sama vistun
    if (rofi) { if ((document.documentElement.getAttribute('data-thema') === 'ragnarok') !== rg) rofi.click(); malaThema(); return; }
    if (rg) {
      document.documentElement.setAttribute('data-thema', 'ragnarok');
      if (!document.getElementById('rg-letur')) { var l = document.createElement('link'); l.id = 'rg-letur'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap'; document.head.appendChild(l); }
    } else document.documentElement.removeAttribute('data-thema');
    try { localStorage.setItem('jarvis_thema_v1', rg ? 'ragnarok' : 'klassiskt'); } catch (_) {}
    try { if (window.Vidmot) window.Vidmot.setja('jarvis_thema_v1', rg ? 'ragnarok' : 'klassiskt'); } catch (_) {}
    window.dispatchEvent(new CustomEvent('rg:thema', { detail: { ragnarok: rg } }));
    malaThema();
  }
  function malaThema() {
    if (!ov) return;
    var rg = document.documentElement.getAttribute('data-thema') === 'ragnarok';
    ov.querySelectorAll('.an-thema button').forEach(function (b) { b.classList.toggle('on', (b.getAttribute('data-t') === 'ragnarok') === rg); });
  }

  function buildNet() {
    if (ov) return;
    ov = document.createElement('div'); ov.className = 'an-ov'; ov.hidden = true;
    ov.innerHTML = '<div class="an-win" role="dialog" aria-modal="true" aria-label="Agentanetið"><div class="an-top"><b>J.A.R.V.I.S.</b><i>Agentanetið · lag 2 · stjóri → sérfræðingar → síður</i>' +
      '<div class="an-maelar" id="an-maelar"></div><div class="an-thema"><button type="button" data-t="klassiskt">Klassískt</button><button type="button" data-t="ragnarok">Ragnarök</button></div><button type="button" class="an-x" aria-label="Loka">✕</button></div>' +
      '<div class="an-body"><div class="an-svgw" id="an-svg"></div><aside class="an-side" id="an-side"><p>Smelltu á agent til að lýsa síðurnar hans. Tvísmellur opnar Agentaskrána.</p></aside></div>' +
      '<div class="an-fot" id="an-verdir"></div></div>';
    document.body.appendChild(ov);
    svgEl = ov.querySelector('#an-svg'); sideEl = ov.querySelector('#an-side');
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeNet(); });
    ov.querySelector('.an-x').addEventListener('click', closeNet);
    ov.querySelector('.an-thema').addEventListener('click', function (ev) { var b = ev.target.closest('[data-t]'); if (b) setjaThema(b.getAttribute('data-t')); });
    window.addEventListener('rg:thema', malaThema);
    ov.addEventListener('click', function (ev) {
      var sk = ev.target.closest('[data-skra]'); if (sk) { closeNet(); if (window.openAgentRegistry) window.openAgentRegistry(sk.getAttribute('data-skra')); return; }
      var n = ev.target.closest('[data-ag]'); if (n) { velja(n.getAttribute('data-ag')); }
    });
    ov.addEventListener('dblclick', function (ev) {
      var n = ev.target.closest('[data-ag]'); if (!n) return;
      var id = registryId(n.getAttribute('data-ag')); if (id && window.openAgentRegistry) { closeNet(); window.openAgentRegistry(id); }
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && ov && !ov.hidden) closeNet(); });
  }
  function openNet() {
    buildNet(); ov.hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('an-lock');
    malaThema(); teiknaMaela();
    saekjaSidukort().then(function () { teiknaNet(); teiknaMaela(); });
    saekjaLotur().then(function () { teiknaNet(); teiknaMaela(); });
    saekjaStada().then(teiknaMaela);
  }
  function closeNet() { if (ov) { ov.hidden = true; document.body.style.overflow = ''; document.body.classList.remove('an-lock'); } }

  /* ---------- Sérfræðinga-spjaldið fær takka ---------- */
  function addEntry() {
    var card = document.querySelector('.spjald[data-spjald="serfraedingar"]');
    if (!card || card.querySelector('#an-open-sfr')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'an-open'; btn.id = 'an-open-sfr'; btn.style.margin = '2px 0 6px';
    btn.textContent = '⛶ Agentanetið — stjóri → sérfræðingar → síður';
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
  window.Agentanet = { saekja: saekja, opna: openNet, bidstofa: openBidstofa, gogn: D };

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
