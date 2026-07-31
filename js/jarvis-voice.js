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
    dolly: {
      name: "Dolly", emoji: "🤠", role: "Hvatningin (kvenrödd)",
      voice_id: "",   // TODO: velja kvenrödd — t.d. Fish Taylor Swift / Kim K, eða „southern/country"
      sample: "Well howdy, sugar! Ya closed a sale — I'm real proud of ya.",
      fb: { lang: "en-US", rate: 0.97, pitch: 1.22, pref: /karen|samantha|google us english|female/i }
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
