/* jarvis-voice.js — give the J.A.R.V.I.S. HUD a speaking voice.
 *
 * Include once on the Jarvis page:   <script src="/js/jarvis-voice.js"></script>
 * Then:                              Jarvis.say('hunter', "Right ya numpty, send the invoices!");
 *
 * How it works:
 *   • If the agent has a Fish `voice_id` AND /api/jarvis-tts is live (FISH_API_KEY
 *     set) → real character voice via Fish Audio S2.1 Pro.
 *   • Otherwise → falls back to the free built-in browser voice, tuned per agent,
 *     so it already talks today with no key.
 *
 * Events (so the HUD can react — glow, react to the voice):
 *   window 'jarvis:speak'  { detail:{ agent, text, source:'fish'|'browser' } }
 *   window 'jarvis:done'   { detail:{ agent } }
 *
 * Voice ids are the `/m/<id>` from a fish.audio model page. Swap freely.
 */
(function () {
  "use strict";

  var AGENTS = {
    jarvis: {
      name: "Jarvis", emoji: "🎩", role: "Dagleg yfirsýn",
      voice_id: "612b878b113047d9a770c069c8b4fdfe",   // Fish — J.A.R.V.I.S. (MCU)
      sample: "Good morning, sir. Three sales await their invoices, and fourteen extinguishers are overdue. Shall I arrange your day?",
      fb: { lang: "en-GB", rate: 0.96, pitch: 0.92, pref: /daniel|arthur|uk english male|ryan|george/i }
    },
    ramsay: {
      name: "Gordon Ramsay", emoji: "🔥", role: "Enginn afsláttur",
      voice_id: "e605a2a42b0a44ccb7af2e42e1676c92",   // Fish — Gordon Ramsay
      sample: "This sölunóta has been sitting as a draft for EIGHT days. It's RAW! Send the invoice — now!",
      fb: { lang: "en-GB", rate: 1.08, pitch: 0.85, pref: /daniel|arthur|george|uk english male|ryan/i }
    },
    freeman: {
      name: "Morgan Freeman", emoji: "🎙️", role: "Sögumaður · skuldalistinn",
      voice_id: "76bb6ae7b26c41fbbd484514fdb014c2",   // Fish — Morgan Freeman
      sample: "And so the invoice sat unpaid. Forty days it waited, in the quiet dark of Payday, hoping someone would chase it.",
      fb: { lang: "en-US", rate: 0.84, pitch: 0.68, pref: /alex|aaron|arthur|david|google us english/i }
    },
    arnold: {
      name: "Arnold", emoji: "💪", role: "Hvatning",
      voice_id: "2270085c19e14054b63e0e451593e0f0",   // Fish — Arnold Schwarzenegger
      sample: "Agnar. Three invoices, still drafts. Stop whining and send them. Do it. Do it now!",
      fb: { lang: "en-US", rate: 0.92, pitch: 0.58, pref: /alex|david|aaron|rishi/i }
    },
    trump: {
      name: "Trump", emoji: "🇺🇸", role: "Hype-man",
      voice_id: "5dcaea7bfca74256bdbafc77593a8770",   // Fish — President Trump (in-house parody)
      sample: "Nobody sells fire extinguishers like Agnar. Nobody. Tremendous sales, the best. But those invoices — send them. Believe me.",
      fb: { lang: "en-US", rate: 0.92, pitch: 0.8, pref: /alex|david|aaron|google us english/i }
    },
    harley: {
      name: "Harley", emoji: "🃏", role: "Ringulreiðs-áminningar",
      voice_id: "e723d4c8547d4552af98ded15728cfbd",   // Fish — Harley Quinn
      sample: "Heyyy puddin'! Ya got four overdue reminders and I am NOT gonna quit singin' about 'em!",
      fb: { lang: "en-US", rate: 1.12, pitch: 1.46, pref: /samantha|zira|google us english|female/i }
    },
    scarlett: {
      name: "Samantha", emoji: "💫", role: "Blíð aðstoð (Her)",
      voice_id: "474887f7949b4d1ab3e626cddf82613a",   // Fish — OS1 Samantha (Scarlett Johansson, Her)
      sample: "Hi. It's just me. Everything's under control — three sales to invoice, and I've tidied your day. Shall we?",
      fb: { lang: "en-US", rate: 0.98, pitch: 1.06, pref: /samantha|ava|allison|google us english|female/i }
    },
    natalie: {
      name: "Natalie", emoji: "🌸", role: "Hlý & róleg",
      voice_id: "9154a623447644788ce990c64e0f235a",   // Fish — Natalie Portman (calm, warm, empathetic)
      sample: "Hey Agnar. No rush — just so you know, three sales are ready to invoice whenever you are. You've got this.",
      fb: { lang: "en-US", rate: 0.95, pitch: 1.04, pref: /samantha|ava|allison|google us english|female/i }
    },

    /* ── 2026-08-01: áhöfnin stækkuð (val Agnars). Hver þessara á sér SVIÐ, ekki
     * bara rödd — sjá Miro-kortið „Sérfræðingarnir". Röddin er útrásin; sjálf
     * þekkingin á að búa í .claude/agents/ + sameiginlega staðreyndasafninu.
     * Öll voice_id staðfest á fish.audio og prófuð á ÍSLENSKU 2026-08-01. ── */
    house: {
      name: "Dr. House", emoji: "🩺", role: "Kerfisheilsa — greiningin",
      voice_id: "0de22bbc814e4857a1558b46ba7e7817",   // Fish — Dr. House
      sample: "It's never Netlify. It's never the app. It's the database — it's always the database. Stop guessing and read the logs.",
      fb: { lang: "en-US", rate: 0.98, pitch: 0.92, pref: /alex|david|aaron|google us english/i }
    },
    statham: {
      name: "Jason Statham", emoji: "🥊", role: "Rukkarinn — ógreitt",
      voice_id: "656b4b83522644d9b1d11e31afb90cfd",   // Fish — Jason Statham
      sample: "Three invoices. Forty days overdue. I know exactly where they are. Consider it handled.",
      fb: { lang: "en-GB", rate: 1.00, pitch: 0.82, pref: /daniel|arthur|george|uk english male|ryan/i }
    },
    sara: {
      name: "Sara", emoji: "🗂️", role: "Organizer — pör og skjöl",
      voice_id: "4575dfa5b64148ad8b48542a5ebd0749",   // Fish — Margot Robbie
      sample: "Okay! Every report is filed, every invoice is paired, and I flagged the gaps for you. You're welcome.",
      fb: { lang: "en-AU", rate: 1.02, pitch: 1.10, pref: /karen|samantha|ava|female/i }
    },
    devito: {
      name: "Danny DeVito", emoji: "🦞", role: "Bókarinn",
      voice_id: "17b88cf496b9495298a10f1b7eada19a",   // Fish — Danny DeVito
      sample: "You wanna know where the money went? Nowhere! It's still sitting there, because nobody sent the invoice!",
      fb: { lang: "en-US", rate: 1.05, pitch: 0.90, pref: /alex|david|aaron|google us english/i }
    },
    sam: {
      name: "Samuel L. Jackson", emoji: "😤", role: "Áríðandi",
      voice_id: "ce67291306284add89ad9e3db6249ad9",   // Fish — Samuel L. Jackson
      sample: "Listen up. That report is missing, the customer is waiting, and this is not a drill. Handle it.",
      fb: { lang: "en-US", rate: 1.02, pitch: 0.80, pref: /alex|david|aaron|google us english/i }
    },
    willis: {
      name: "Bruce Willis", emoji: "💥", role: "Neyðarástand",
      voice_id: "87efb8f2ec4f4b3b8ed9f3fd64a3ab4b",   // Fish — Bruce Willis
      sample: "Database is back on its feet. Sixteen hours down, everything's green again. Yippee-ki-yay.",
      fb: { lang: "en-US", rate: 0.96, pitch: 0.85, pref: /alex|david|aaron|google us english/i }
    },
    charlize: {
      name: "Charlize Theron", emoji: "❄️", role: "Verkstaðir",
      voice_id: "97f77cf6e657419ab543e9d94dcf10a0",   // Fish — Charlize Theron
      sample: "Landspítalinn is on schedule. Four hundred holes closed this month. No mistakes, no excuses.",
      fb: { lang: "en-US", rate: 0.97, pitch: 1.00, pref: /samantha|ava|allison|female/i }
    }
  };

  var endpoint = "/api/jarvis-tts";
  var current = null;              // current HTMLAudioElement
  var sayToken = 0;                // ticket bumped on every stop()/say() → cancels in-flight requests

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  function stop() {
    sayToken++;                    // invalidate anything still loading (prevents two voices at once)
    try {
      if (current) { current.pause(); current.currentTime = 0; current = null; }
      if (window.speechSynthesis) speechSynthesis.cancel();
    } catch (e) {}
  }

  async function say(agentId, text, opts) {
    opts = opts || {};
    var a = AGENTS[agentId] || AGENTS.jarvis;
    text = String(text || "").trim();
    if (!text) return;
    stop();
    var myToken = sayToken;        // this call's ticket; a newer say()/stop() bumps sayToken past it

    // 1) real character voice via the serverless proxy (if the agent has one)
    if (a.voice_id) {
      try {
        var r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text, voice_id: a.voice_id, format: "mp3" })
        });
        if (myToken !== sayToken) return;          // a newer tap superseded us while fetching → drop
        var d = await r.json().catch(function () { return null; });
        if (myToken !== sayToken) return;
        if (d && d.ok && (d.url || d.audio)) {
          if (current) { try { current.pause(); } catch (e2) {} current = null; }  // belt & suspenders
          var src = d.url || ("data:" + (d.mime || "audio/mpeg") + ";base64," + d.audio);
          var audio = new Audio(src);
          current = audio;
          emit("jarvis:speak", { agent: agentId, text: text, source: "fish" });
          audio.onended = audio.onerror = function () { if (current === audio) current = null; emit("jarvis:done", { agent: agentId }); };
          try { await audio.play(); } catch (e3) {}
          return;
        }
        // API not ready (no key etc.) → fall through to the browser voice
        if (d && d.error) console.info("[jarvis-voice] " + d.error + " — using browser voice.");
      } catch (e) {
        console.info("[jarvis-voice] /api/jarvis-tts unreachable, using browser voice.");
      }
    }

    // 2) free browser fallback, tuned per character
    if (myToken !== sayToken) return;              // superseded before we reached the fallback
    browserSay(a, agentId, text, Object.assign({}, opts, { _tok: myToken }));
  }

  function browserSay(a, agentId, text, opts) {
    opts = opts || {};
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
    var tok = (opts._tok !== undefined) ? opts._tok : sayToken;   // honour the say() ticket
    var vs = speechSynthesis.getVoices() || [];
    // Voices load ASYNC — on the very first call the list is often empty, which
    // is why a first reply can come out silent or with a robotic default voice.
    // Wait once for them to arrive (voiceschanged OR a short timeout), then retry.
    if (!vs.length && !opts._retried) {
      var done = false;
      var retry = function () {
        if (done) return; done = true;
        browserSay(a, agentId, text, Object.assign({}, opts, { _retried: true, _tok: tok }));
      };
      try { window.speechSynthesis.addEventListener("voiceschanged", retry, { once: true }); } catch (e) {}
      setTimeout(retry, 300);
      return;
    }
    if (tok !== sayToken) return;   // a newer voice took over while we waited
    var u = new SpeechSynthesisUtterance(text);
    // opts.lang (set when answering a spoken question) forces the reply language
    // so an Icelandic answer isn't read by an English voice; otherwise use the
    // agent's own character preference.
    var langPref = opts.lang || a.fb.lang;
    var two = langPref.toLowerCase().slice(0, 2);
    var byLang = function () { return vs.find(function (v) { return (v.lang || "").toLowerCase().indexOf(two) === 0; }); };
    u.voice = (opts.lang ? byLang() : vs.find(function (v) { return a.fb.pref.test(v.name); }))
           || byLang()
           || vs.find(function (v) { return /^en/i.test(v.lang || ""); })
           || vs[0] || null;
    u.lang = u.voice ? u.voice.lang : langPref;
    u.rate = a.fb.rate; u.pitch = a.fb.pitch;
    emit("jarvis:speak", { agent: agentId, text: text, source: "browser" });
    u.onend = u.onerror = function () { emit("jarvis:done", { agent: agentId }); };
    speechSynthesis.cancel();
    setTimeout(function () { if (tok !== sayToken) return; speechSynthesis.speak(u); }, 40);
  }

  window.Jarvis = Object.assign(window.Jarvis || {}, {
    say: say,
    stop: stop,
    agents: AGENTS,
    setEndpoint: function (u) { endpoint = u; },
    setVoice: function (id, refId) { if (AGENTS[id]) AGENTS[id].voice_id = refId; },
    // main assistant voice — the HUD's spoken replies (tala) use sayMain()
    getMain: getMain,
    setMain: setMain,
    sayMain: sayMain,
    // voice tester (the floating 🎙️ panel) — see below
    openTester: openTester,
    closeTester: closeTester,
    toggleTester: toggleTester
  });

  /* ── Main assistant voice (persisted) ──────────────────────────────────────
   * Which agent answers when you TALK to Jarvis. Switch it from the 🎙️ tester
   * (tap the ★ on any agent) — e.g. flip the main between Natalie and Jarvis.
   * The HUD's tala() calls Jarvis.sayMain(text, {lang}) so replies use this. */
  var MAIN_KEY = "jarvis_main_voice";
  function getMain() {
    try { var m = localStorage.getItem(MAIN_KEY); return (m && AGENTS[m]) ? m : "jarvis"; }
    catch (e) { return "jarvis"; }
  }
  function setMain(id) {
    if (!AGENTS[id]) return;
    try { localStorage.setItem(MAIN_KEY, id); } catch (e) {}
    reflectMain();
  }
  function sayMain(text, opts) { return say(getMain(), text, opts); }

  /* ══ Radd-prufa: self-contained floating 🎙️ panel ══════════════════════════
   * Auto-injects a small launcher on DOM-ready so the whole tester ships with
   * ONE <script src="/js/jarvis-voice.js"> — no markup needed in jarvis.html.
   * Tap the launcher → panel with every agent; tap an agent → it speaks (its
   * sample line, or whatever you typed). The status line says whether the real
   * Fish voice answered (🐟) or it fell back to the free browser voice (🔊) —
   * so this doubles as the "is FISH_API_KEY live?" check.
   * Opt out entirely with:  window.JARVIS_VOICE_NO_TESTER = true  (before load).
   * Styled to match the HUD (cy #4fd8ff on #04101f); positioned bottom-right so
   * it never sits on the centre TALA button. */
  var PANEL_ID = "jvt-panel", LAUNCH_ID = "jvt-launch", STYLE_ID = "jvt-style";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      "#" + LAUNCH_ID + "{position:fixed;right:14px;bottom:14px;z-index:2147483000;",
      "  font:700 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.06em;",
      "  color:#4fd8ff;background:linear-gradient(180deg,#0a2740,#04101f);border:1px solid #1b4a63;",
      "  padding:10px 14px;border-radius:999px;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.55);",
      "  -webkit-tap-highlight-color:transparent}",
      "#" + LAUNCH_ID + ":hover{border-color:#4fd8ff}",
      "#" + PANEL_ID + "{position:fixed;right:14px;bottom:64px;z-index:2147483000;width:274px;max-width:calc(100vw - 28px);",
      "  max-height:72vh;display:none;flex-direction:column;gap:8px;padding:12px;border-radius:14px;",
      "  background:rgba(4,16,31,.97);border:1px solid #1b4a63;box-shadow:0 10px 40px rgba(0,0,0,.6);",
      "  color:#cfeeff;font:400 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;",
      "  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}",
      "#" + PANEL_ID + ".open{display:flex}",
      "#" + PANEL_ID + " .jvt-hd{display:flex;align-items:center;gap:8px;margin:-2px 0 2px}",
      "#" + PANEL_ID + " .jvt-hd b{font-size:12px;letter-spacing:.12em;color:#79b4d0;text-transform:uppercase}",
      "#" + PANEL_ID + " .jvt-x{margin-left:auto;background:transparent;border:0;color:#3f7391;font-size:18px;cursor:pointer;line-height:1;padding:2px 4px}",
      "#" + PANEL_ID + " .jvt-x:hover{color:#ff5a6e}",
      "#" + PANEL_ID + " textarea{width:100%;box-sizing:border-box;background:#03101d;border:1px solid #143147;color:#cfeeff;",
      "  border-radius:8px;padding:7px 9px;font:inherit;font-size:12px;resize:vertical;min-height:38px}",
      "#" + PANEL_ID + " textarea:focus{outline:0;border-color:#1d7fa8}",
      "#" + PANEL_ID + " .jvt-list{display:flex;flex-direction:column;gap:6px;overflow-y:auto;margin:1px -2px;padding:0 2px}",
      "#" + PANEL_ID + " .jvt-ag{display:flex;align-items:center;gap:10px;width:100%;text-align:left;min-height:46px;",
      "  padding:7px 10px;border-radius:10px;border:1px solid #143147;background:#071726;color:#cfeeff;cursor:pointer;",
      "  -webkit-tap-highlight-color:transparent;transition:border-color .12s,box-shadow .12s,background .12s}",
      "#" + PANEL_ID + " .jvt-ag:hover{border-color:#1d7fa8}",
      "#" + PANEL_ID + " .jvt-ag.on{border-color:#4fd8ff;background:#0a2740;box-shadow:0 0 0 1px #4fd8ff,0 0 16px rgba(79,216,255,.35)}",
      "#" + PANEL_ID + " .jvt-ag.loading{border-color:#1d7fa8;animation:jvtPulse 1s ease-in-out infinite}",
      "@keyframes jvtPulse{0%,100%{opacity:.5}50%{opacity:1}}",
      "#" + PANEL_ID + " .jvt-ag.ismain{border-color:#2f5a3a}",
      "#" + PANEL_ID + " .jvt-play{display:flex;align-items:center;gap:10px;flex:1 1 auto;min-width:0;background:transparent;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:0}",
      "#" + PANEL_ID + " .jvt-star{flex:0 0 auto;background:transparent;border:0;color:#2a4c60;font-size:17px;line-height:1;cursor:pointer;padding:4px 2px 4px 8px}",
      "#" + PANEL_ID + " .jvt-star:hover{color:#ffd873}",
      "#" + PANEL_ID + " .jvt-ag.ismain .jvt-star{color:#ffc746}",
      "#" + PANEL_ID + " .jvt-ag .em{font-size:20px;flex:0 0 auto;width:24px;text-align:center}",
      "#" + PANEL_ID + " .jvt-play>span+span{min-width:0}",
      "#" + PANEL_ID + " .jvt-ag .nm{display:block;font-weight:700;font-size:13px}",
      "#" + PANEL_ID + " .jvt-ag .rl{display:block;font-size:10.5px;color:#79b4d0;margin-top:1px}",
      "#" + PANEL_ID + " .jvt-main{font-size:10.5px;color:#79b4d0;margin:-1px 0 2px;letter-spacing:.02em}",
      "#" + PANEL_ID + " .jvt-main b{color:#ffc746;font-weight:700}",
      "#" + PANEL_ID + " .jvt-ft{display:flex;align-items:center;gap:8px}",
      "#" + PANEL_ID + " .jvt-stop{background:#1a0a10;border:1px solid #5a2530;color:#ff8a98;border-radius:8px;padding:7px 11px;",
      "  font:700 12px system-ui;cursor:pointer}",
      "#" + PANEL_ID + " .jvt-stop:hover{border-color:#ff5a6e}",
      "#" + PANEL_ID + " .jvt-status{font-size:10.5px;color:#3f7391;min-height:14px;flex:1;text-align:right}"
    ].join("");
    var st = document.createElement("style");
    st.id = STYLE_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var testerBuilt = false, panelEl = null, statusEl = null, taEl = null;

  function buildTester() {
    if (testerBuilt) return;
    injectStyles();

    var launch = document.createElement("button");
    launch.id = LAUNCH_ID; launch.type = "button";
    launch.textContent = "🎙️ Raddir";
    launch.setAttribute("aria-label", "Opna radd-prufu");
    launch.addEventListener("click", toggleTester);

    var panel = document.createElement("div");
    panel.id = PANEL_ID;

    var rows = "";
    Object.keys(AGENTS).forEach(function (id) {
      var a = AGENTS[id];
      rows += '<div class="jvt-ag" data-agent="' + id + '">'
            +   '<button type="button" class="jvt-play" data-play="' + id + '">'
            +     '<span class="em">' + esc(a.emoji || "🗣") + "</span>"
            +     "<span><span class='nm'>" + esc(a.name || id) + "</span>"
            +       "<span class='rl'>" + esc(a.role || "") + "</span></span>"
            +   "</button>"
            +   '<button type="button" class="jvt-star" data-star="' + id + '" title="Gera að aðalrödd" aria-label="Aðalrödd">★</button>'
            + "</div>";
    });

    panel.innerHTML =
      '<div class="jvt-hd"><b>🎙️ Radd-prufa</b>'
    +   '<button type="button" class="jvt-x" aria-label="Loka">×</button></div>'
    + '<div class="jvt-main">Aðalrödd (svör): <b id="jvt-main-name">—</b> <span style="color:#3f7391">· ★ velur</span></div>'
    + '<textarea rows="2" placeholder="Skrifaðu texta til að lesa… (annars les sýnishorn)"></textarea>'
    + '<div class="jvt-list">' + rows + "</div>"
    + '<div class="jvt-ft"><button type="button" class="jvt-stop">⏹ Stöðva</button>'
    +   '<span class="jvt-status"></span></div>';

    document.body.appendChild(launch);
    document.body.appendChild(panel);
    panelEl = panel;
    statusEl = panel.querySelector(".jvt-status");
    taEl = panel.querySelector("textarea");

    panel.querySelector(".jvt-x").addEventListener("click", closeTester);
    panel.querySelector(".jvt-stop").addEventListener("click", function () {
      stop(); setStatus("stöðvað"); clearSpeaking();
    });
    panel.querySelector(".jvt-list").addEventListener("click", function (e) {
      // ★ → set as the main assistant voice (used for spoken replies); no speak
      var star = e.target.closest(".jvt-star");
      if (star) {
        var sid = star.getAttribute("data-star");
        setMain(sid);
        setStatus("Aðalrödd: " + ((AGENTS[sid] && AGENTS[sid].name) || sid));
        return;
      }
      var btn = e.target.closest(".jvt-play"); if (!btn) return;
      var id = btn.getAttribute("data-play"), a = AGENTS[id] || {};
      var txt = (taEl && taEl.value.trim()) || a.sample || "Halló, þetta er prufa.";
      markLoading(id);
      setStatus("⏳ sæki " + (a.name || id) + "…");
      say(id, txt);
    });

    // reflect speaking state coming out of say()/browserSay()
    window.addEventListener("jarvis:speak", function (e) {
      var d = (e && e.detail) || {};
      markSpeaking(d.agent);
      setStatus((d.source === "fish" ? "🐟 Fish rödd" : "🔊 vafra-rödd") +
                (d.source === "fish" ? "" : " (Fish óvirkt)"));
    });
    window.addEventListener("jarvis:done", function () { clearSpeaking(); });

    reflectMain();
    testerBuilt = true;
  }

  function setStatus(t) { if (statusEl) statusEl.textContent = t || ""; }
  function clearRowStates() {
    if (!panelEl) return;
    panelEl.querySelectorAll(".jvt-ag.on,.jvt-ag.loading").forEach(function (b) {
      b.classList.remove("on"); b.classList.remove("loading");
    });
  }
  function markLoading(id) {
    if (!panelEl) return;
    clearRowStates();
    var b = panelEl.querySelector('.jvt-ag[data-agent="' + id + '"]');
    if (b) b.classList.add("loading");
  }
  function markSpeaking(id) {
    if (!panelEl) return;
    clearRowStates();
    var b = panelEl.querySelector('.jvt-ag[data-agent="' + id + '"]');
    if (b) b.classList.add("on");
  }
  function clearSpeaking() { clearRowStates(); }
  function reflectMain() {
    if (!panelEl) return;
    var main = getMain();
    panelEl.querySelectorAll(".jvt-ag").forEach(function (row) {
      row.classList.toggle("ismain", row.getAttribute("data-agent") === main);
    });
    var lbl = panelEl.querySelector("#jvt-main-name");
    if (lbl) lbl.textContent = (AGENTS[main] && AGENTS[main].name) || main;
  }

  function openTester()  { buildTester(); if (panelEl) panelEl.classList.add("open"); }
  function closeTester() { if (panelEl) panelEl.classList.remove("open"); }
  function toggleTester() {
    buildTester();
    if (panelEl) panelEl.classList.toggle("open");
  }

  function autoInit() {
    if (window.JARVIS_VOICE_NO_TESTER) return;   // explicit opt-out
    try { buildTester(); } catch (e) { /* never let the tester break the page */ }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();
