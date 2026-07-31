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
      fb: { lang: "en-GB", rate: 0.96, pitch: 0.92, pref: /daniel|arthur|uk english male|ryan|george/i }
    },
    hunter: {
      name: "Hunter", emoji: "🍀", role: "Enginn afsláttur",
      voice_id: "880fb671ebcb446dbc0d5fc99baf909e",   // Fish — Gruff Irish
      fb: { lang: "en-IE", rate: 1.02, pitch: 0.68, pref: /moira|irish|scottish|rishi|daniel/i }
    },
    harley: {
      name: "Harley", emoji: "🃏", role: "Ringulreiðs-áminningar",
      voice_id: "e723d4c8547d4552af98ded15728cfbd",   // Fish — Harley Quinn
      fb: { lang: "en-US", rate: 1.12, pitch: 1.46, pref: /samantha|zira|google us english|female/i }
    },
    narrator: {
      name: "Náttúran", emoji: "🌿", role: "Skuldalistinn lesinn",
      voice_id: "eabac87f2d8b47f1b174e7d2f685618a",   // Fish — David Attenborough
      fb: { lang: "en-GB", rate: 0.82, pitch: 0.82, pref: /daniel|arthur|george|uk english male/i }
    },
    dolly: {
      name: "Dolly", emoji: "🤠", role: "Hvatningin",
      voice_id: "",   // TODO: pick a Fish "southern/country" voice (or wire ElevenLabs "Aunt Shirley")
      fb: { lang: "en-US", rate: 0.97, pitch: 1.22, pref: /karen|samantha|google us english|female/i }
    },
    glados: {
      name: "GLaDOS", emoji: "🤖", role: "Kaldhæðnar tölur",
      voice_id: "ee885900b0874d12b1c3439d1e56cc95",   // Fish — GLaDOS
      fb: { lang: "en-US", rate: 0.9, pitch: 0.55, pref: /zira|samantha|google us english|tessa|female/i }
    }
  };

  var endpoint = "/api/jarvis-tts";
  var current = null;              // current HTMLAudioElement

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  function stop() {
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

    // 1) real character voice via the serverless proxy (if the agent has one)
    if (a.voice_id) {
      try {
        var r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text, voice_id: a.voice_id, format: "mp3" })
        });
        var d = await r.json().catch(function () { return null; });
        if (d && d.ok && (d.url || d.audio)) {
          var src = d.url || ("data:" + (d.mime || "audio/mpeg") + ";base64," + d.audio);
          current = new Audio(src);
          emit("jarvis:speak", { agent: agentId, text: text, source: "fish" });
          current.onended = current.onerror = function () { current = null; emit("jarvis:done", { agent: agentId }); };
          await current.play();
          return;
        }
        // API not ready (no key etc.) → fall through to the browser voice
        if (d && d.error) console.info("[jarvis-voice] " + d.error + " — using browser voice.");
      } catch (e) {
        console.info("[jarvis-voice] /api/jarvis-tts unreachable, using browser voice.");
      }
    }

    // 2) free browser fallback, tuned per character
    browserSay(a, agentId, text);
  }

  function browserSay(a, agentId, text) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
    var u = new SpeechSynthesisUtterance(text);
    var vs = speechSynthesis.getVoices() || [];
    u.voice = vs.find(function (v) { return a.fb.pref.test(v.name); })
           || vs.find(function (v) { return (v.lang || "").toLowerCase().indexOf(a.fb.lang.toLowerCase()) === 0; })
           || vs.find(function (v) { return /^en/i.test(v.lang || ""); })
           || vs[0] || null;
    if (u.voice) u.lang = u.voice.lang;
    u.rate = a.fb.rate; u.pitch = a.fb.pitch;
    emit("jarvis:speak", { agent: agentId, text: text, source: "browser" });
    u.onend = u.onerror = function () { emit("jarvis:done", { agent: agentId }); };
    speechSynthesis.cancel();
    setTimeout(function () { speechSynthesis.speak(u); }, 40);
  }

  window.Jarvis = Object.assign(window.Jarvis || {}, {
    say: say,
    stop: stop,
    agents: AGENTS,
    setEndpoint: function (u) { endpoint = u; },
    setVoice: function (id, refId) { if (AGENTS[id]) AGENTS[id].voice_id = refId; }
  });
})();
