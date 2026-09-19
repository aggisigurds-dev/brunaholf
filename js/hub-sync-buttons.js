/* hub-sync-buttons.js — drop-in "Samstilla" buttons for the Brunahólf hub.
 *
 * WHAT IT DOES
 *   Renders a "🔄 Samstilla <label>" button plus a freshness line. Clicking runs
 *   the sync DIRECTLY against the cloud endpoints (no desktop bridge needed):
 *   Tímavera/Payday are one fast call; Redder/Ajour are batched/polled with live
 *   progress. The freshness line ("síðast · nýjast") reads /api/data-sources-status
 *   — the REAL data freshness — so it's honest even if the bridge is off.
 *   Any workflow WITHOUT a known cloud endpoint falls back to writing an
 *   `automation_triggers` request for the bridge watcher.
 *
 * HOW TO USE
 *   1) <script src="/js/hub-sync-buttons.js" defer></script>  (once per page)
 *   2) <span data-sync-workflow="timavera" data-sync-label="Tímavera"></span>
 *      <span data-sync-workflow="ajour"    data-sync-label="Ajour"></span>
 *      <span data-sync-workflow="redder"   data-sync-label="Redder"></span>
 *      <span data-sync-workflow="payday"   data-sync-label="Payday"></span>
 *   Auto-inits on load AND on hashchange (hub is a hash-SPA).
 */
(function () {
  const SUPABASE_URL = "https://osfdzskyvisifcwyjkuk.supabase.co";
  const SUPABASE_KEY = "sb_publishable_YVpznM5EK01qOdevQwOcIg_rMjTkT7f"; // publishable — read-only in browser
  const H = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };

  const fmt = (s) => s ? new Date(s).toLocaleString("is-IS", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
  const fmtDay = (s) => s ? new Date(s).toLocaleDateString("is-IS", { day: "2-digit", month: "2-digit" }) : null;

  // ── real data freshness (cached ~60s, shared across all buttons) ─────────────
  let _dss = null, _dssAt = 0, _dssP = null;
  async function dss() {
    if (_dss && Date.now() - _dssAt < 60000) return _dss;
    if (_dssP) return _dssP;
    _dssP = fetch("/api/data-sources-status").then((r) => r.json()).then((d) => { _dss = d; _dssAt = Date.now(); _dssP = null; return d; })
      .catch(() => { _dssP = null; return _dss || { sources: [] }; });
    return _dssP;
  }
  const SRC_KEY = { timavera: "timavera", ajour: "ajour", redder: "redder", payday: "invoices" };

  async function trigger(wf, by) {   // legacy fallback: ask the bridge to run it
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_triggers`, {
        method: "POST", headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ workflow: wf, requested_by: by || "hub" }),
      });
      return r.ok;
    } catch { return false; }
  }

  // ── direct cloud sync per workflow (setP(text) shows live progress) ──────────
  async function getJSON(url) {
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || ("HTTP " + r.status));
    return d;
  }
  async function redderRun(setP) {
    let off = 0, total = 0, guard = 0;
    while (guard++ < 80) {
      let d = null, lastErr = "";
      for (let a = 0; a < 3; a++) {                        // þolin lota: 3 tilraunir með bakslagi
        try { d = await getJSON("/api/redder-read?limit=4&offset=" + off); break; }
        catch (e) { lastErr = e.message; d = null; await new Promise((s) => setTimeout(s, 1500 * (a + 1))); }
      }
      if (!d) throw new Error("lota féll (offset " + off + "): " + lastErr);
      total += (d.processed || 0);
      if (d.total) setP(Math.min(off + (d.processed || 0), d.total) + "/" + d.total + "…");
      if (d.nextOffset == null) break;
      off = d.nextOffset;
    }
    return total + " reikningar";
  }
  // Ajour (18.09.2026): Ajour á ekkert API — gögnin koma AÐEINS þegar brúartölva
  // (luna-bridge watcher á skrifstofu- eða heimavél) skráir sig inn og flytur út CSV.
  // Gamli takkinn las bara síðustu CSV-skrá úr Drive og sagði „✓" þótt ekkert nýtt
  // kæmi — þess vegna „virkuðu sumir takkar og sumir ekki". Nú: biðja brúna um alvöru
  // sókn og fylgjast með henni; svari engin tölva innan 100 sek. segjum við það hreint
  // út og lesum Drive-skrána sem varaleið.
  async function bridgeRun(wf, setP) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_triggers`, {
      method: "POST", headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify({ workflow: wf, requested_by: (location.hash || "hub").replace("#", "") }),
    });
    const row = r.ok ? (await r.json().catch(() => []))[0] : null;
    if (!row || row.id == null) throw new Error("gat ekki sent beiðni á brúna");
    const t0 = Date.now();
    for (;;) {
      await new Promise((s) => setTimeout(s, 4000));
      const sek = Math.round((Date.now() - t0) / 1000);
      let cur = null;
      try { cur = (await (await fetch(`${SUPABASE_URL}/rest/v1/automation_triggers?id=eq.${row.id}&select=status,result`, { headers: H })).json())[0]; } catch (_) {}
      const st = cur && cur.status;
      if (st === "done") return { ok: true, result: cur.result || "" };
      if (st === "error") throw new Error(/login/i.test(cur.result || "") ? "Ajour-innskráning útrunnin á brúartölvunni" : String(cur.result || "villa á brúartölvu").split("|")[0].slice(0, 140));
      if (st === "running") { setP("brúartölva sækir… " + sek + "s"); if (sek > 900) throw new Error("sókn tók of langan tíma"); continue; }
      setP("bíð eftir brúartölvu… " + sek + "s");
      if (sek > 100) {                                   // engin vél tók beiðnina
        fetch(`${SUPABASE_URL}/rest/v1/automation_triggers?id=eq.${row.id}&status=eq.pending`, {   // svo hún keyri ekki klukkutímum seinna
          method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
          body: JSON.stringify({ status: "error", result: "engin brúartölva svaraði innan 100 sek", finished_at: new Date().toISOString() }) }).catch(() => {});
        return { ok: false };
      }
    }
  }
  async function ajourRun(setP) {
    const b = await bridgeRun("ajour", setP);
    if (b.ok) return "sótt úr Ajour";
    setP("engin brúartölva í gangi — les Drive-skrá…");
    const d = await ajourDrive(setP);
    throw new Error("Engin brúartölva í gangi (skrifstofu-/heimavél) — las aðeins síðustu Drive-skrá (" + d + ")");
  }
  async function ajourDrive(setP) {
    await getJSON("/api/nlsh-update");                     // kveikir á bakgrunns-innlestri
    for (let i = 0; i < 45; i++) {
      await new Promise((s) => setTimeout(s, 2000));
      let s = {}; try { s = await getJSON("/api/nlsh-update?status=1"); } catch (_) {}
      const n = s.upserted != null ? s.upserted : (s.inserted != null ? s.inserted : s.count);
      if (s.state === "done") return (n != null ? n + " færslur" : "lokið");
      if (s.state === "error") throw new Error(s.error || "Ajour villa");
      setP("les inn… " + ((i + 1) * 2) + "s");
    }
    return "í vinnslu";
  }
  const CLOUD = {
    timavera: () => getJSON("/api/timavera-pull?days=30").then((d) => (d.upserted != null ? d.upserted : 0) + " færslur"),
    payday:   () => getJSON("/api/payday-pull").then((d) => (d.upserted != null ? d.upserted : 0) + " reikningar"),
    redder:   redderRun,
    ajour:    ajourRun,
  };

  const CSS = `
    /* Gull þema: lítill ljós chip-hnappur — punktur + nafn + „sótt <dags>" (SCREENS.md) */
    .hub-sync{display:inline-flex;flex-direction:row;align-items:center;gap:2px;font-size:12px;background:var(--card,#fff);border:1px solid var(--line-2,#d9d4c9);border-radius:var(--radius-sm,4px);padding:3px 10px 3px 4px}
    .hub-sync button{background:transparent;color:var(--ink-2,#2c3a49);border:0;border-radius:var(--radius-sm,4px);padding:4px 7px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit}
    .hub-sync button:hover{color:var(--gold-deep,#b48d4c)}
    .hub-sync button:disabled{opacity:.7;cursor:default}
    .hub-sync .d{color:var(--muted-2,#8b95a1);font-weight:500;font-size:11px;white-space:nowrap}
    .hub-sync.fresh .d{color:var(--green,#2e7d43)}
    .hub-sync.ok .d{color:var(--green,#2e7d43)}
    .hub-sync.err .d{color:var(--red,#a8442c)}
    .hub-sync .dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;background:var(--muted-2,#adb5bd);vertical-align:middle}
    .hub-sync .dot.done{background:var(--green,#2e7d43)}.hub-sync .dot.running{background:var(--blue,#2563eb)}.hub-sync .dot.pending{background:var(--warn,#8a6a1f)}.hub-sync .dot.error{background:var(--red,#a8442c)}`;
  function injectCss() { if (document.getElementById("hub-sync-css")) return; const s = document.createElement("style"); s.id = "hub-sync-css"; s.textContent = CSS; document.head.appendChild(s); }

  // -- Tengdir takkar (18.09.2026): allir takkar sama workflow — a sidunni, i odrum
  // flipum og i iframe-sidum (BroadcastChannel) — syna somu stodu. Smellur a einum
  // stad laesir hinum, speglar framvinduna og endurnyjar ferskleikann alls stadar.
  const PEERS = {};                                        // wf -> Set<controller>
  let BC = null; try { BC = new BroadcastChannel("hub-sync"); } catch (_) {}
  function announce(wf, phase, text, originId) {
    (PEERS[wf] ? [...PEERS[wf]] : []).forEach((c) => { if (c.id !== originId) { try { c.mirror(phase, text); } catch (_) {} } });
  }
  function tell(wf, phase, text, originId) {
    announce(wf, phase, text, originId);
    try { if (BC) BC.postMessage({ wf, phase, text }); } catch (_) {}
  }
  if (BC) BC.onmessage = (e) => { const m = e.data || {}; if (!m.wf) return; if (m.phase === "done" || m.phase === "error") _dss = null; announce(m.wf, m.phase, m.text, null);
    if (m.phase === "done") { try { document.dispatchEvent(new CustomEvent("hub-sync-done", { detail: { wf: m.wf, label: m.wf, detail: m.text, remote: true } })); } catch (_) {} } };
  // Sidur med EIGIN samstillingartakka (t.d. Maeting) geta tilkynnt sig inn i sama kerfi.
  window.HubSync = { announce: (wf, phase, text) => { if (phase === "done" || phase === "error") _dss = null; tell(wf, phase, text, null); } };
  let _cid = 0;

  function render(el) {
    const wf = el.getAttribute("data-sync-workflow");
    const label = el.getAttribute("data-sync-label") || wf;
    el.classList.add("hub-sync");
    el.innerHTML = `<button type="button">↻ Samstilla ${label}</button><span class="d"><span class="dot"></span><span class="txt">…</span></span>`;
    const btn = el.querySelector("button"), dot = el.querySelector(".dot"), txt = el.querySelector(".txt");
    const setTxt = (t) => { txt.textContent = t; };

    async function refresh() {
      if (Date.now() < (el._quiet || 0)) return;            // ekki yfirskrifa nýlega „✓ samstillt"
      const d = await dss();
      const src = (d.sources || []).find((s) => s.key === (SRC_KEY[wf] || wf));
      if (!src) { txt.textContent = "—"; dot.className = "dot"; el.classList.remove("fresh", "ok", "err"); return; }
      const nd = fmtDay(src.newest_real), li = fmt(src.last_import);
      txt.textContent = (src.inactive ? "⚠ ÓVIRKT · " : "") + "nýjast " + (nd || "—") + (li ? " · sótt " + li : "");
      el.title = src.inactive ? (src.inactive_reason || "Óvirkt") : "";
      el.classList.toggle("err", !!src.inactive);
      const st = src.status;                                // fresh | aging | stale
      dot.className = "dot " + (st === "fresh" ? "done" : st === "aging" ? "pending" : "error");
      el.classList.remove("ok"); if (!src.inactive) el.classList.remove("err"); el.classList.toggle("fresh", st === "fresh");
    }
    // spegill: annar takki sama workflow er ad keyra / klaradi
    const ctl = { id: ++_cid, mirror(phase, text) {
      if (!el.isConnected) { PEERS[wf] && PEERS[wf].delete(ctl); return; }
      if (phase === "start" || phase === "progress") { btn.disabled = true; btn.textContent = "… Samstilli"; dot.className = "dot running"; el.classList.remove("fresh", "ok", "err"); el._quiet = Date.now() + 3600e3; setTxt(text || "samstilli…"); }
      else { btn.disabled = false; btn.textContent = `↻ Samstilla ${label}`; dot.className = "dot " + (phase === "done" ? "done" : "error"); el.classList.add(phase === "done" ? "ok" : "err"); setTxt(text || ""); el._quiet = Date.now() + 8000; setTimeout(refresh, 8200); }
    } };
    (PEERS[wf] = PEERS[wf] || new Set()).add(ctl);
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = "… Samstilli"; el.classList.remove("fresh", "ok", "err");
      dot.className = "dot running"; el._quiet = Date.now() + 3600e3;   // frysta freshness-línuna á meðan
      if (CLOUD[wf]) {                                       // BEIN ský-samstilling (engin brú)
        setTxt("samstilli…"); tell(wf, "start", "samstilli…", ctl.id);
        try {
          const detail = await CLOUD[wf]((p) => { setTxt("samstilli… " + p); tell(wf, "progress", "samstilli… " + p, ctl.id); });
          dot.className = "dot done"; el.classList.add("ok"); setTxt("✓ samstillt núna · " + detail);
          tell(wf, "done", "✓ samstillt núna · " + detail, ctl.id); setTimeout(refresh, 8200);
          _dss = null;                                       // þvinga ferska freshness við næstu lestur
          el._quiet = Date.now() + 8000;                     // haltu „✓" í 8s, sýndu svo raun-ferskleika
          // Láttu síður sem eiga eigin gögn háð þessum workflow vita (t.d. Kröfu
          // yfirlit endurhleður þrepin sín þegar Payday er samstillt — sjá index.html).
          try { document.dispatchEvent(new CustomEvent("hub-sync-done", { detail: { wf, label, detail } })); } catch (_) {}
        } catch (e) {
          dot.className = "dot error"; el.classList.add("err"); setTxt("✗ " + (e.message || e)); el.title = String(e.message || e);
          tell(wf, "error", "✗ " + (e.message || e), ctl.id);
          el._quiet = Date.now() + 8000;
        } finally { btn.disabled = false; btn.textContent = `↻ Samstilla ${label}`; }
        return;
      }
      // Fallback: enginn ský-endapunktur → biðja brúna (gamla hegðunin).
      const ok = await trigger(wf, (location.hash || "hub").replace("#", ""));
      setTxt(ok ? "samstilling beðin…" : "villa — reyndu aftur"); dot.className = "dot pending";
      el._quiet = Date.now() + 5000;
      setTimeout(async () => { btn.disabled = false; btn.textContent = `↻ Samstilla ${label}`; await refresh(); }, 5000);
    };
    refresh();
    // 19.09.2026 — MÆLT í Supabase-loggum: /api/data-sources-status var sótt ~3.200× á sólarhring (hvert kall er
    // ~25 fyrirspurnir), líka um miðja nótt: hver takki endurlas á 15 s fresti, líka í földum flipa, og takkar sem
    // höfðu verið endurteiknaðir burt héldu áfram að tikka. Ferskleikinn mælist í klukkustundum og dögum — nú á
    // 2 mín fresti, aðeins í sýnilegum flipa, og tímamælirinn deyr með takkanum.
    if (!el._t) el._t = setInterval(() => {
      if (!el.isConnected) { clearInterval(el._t); el._t = null; return; }
      if (document.visibilityState === "visible") refresh();
    }, 120000);
  }

  function init() {
    injectCss();
    document.querySelectorAll("[data-sync-workflow]").forEach((el) => { if (!el.dataset.syncInit) { el.dataset.syncInit = "1"; render(el); } });
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("hashchange", () => setTimeout(init, 300)); // hub is a hash-SPA
  // SPA re-render öryggi: hub-ið skiptir um flipa-DOM gegnum render() sem notar
  // history.replaceState (ekki hashchange), svo nýteiknuð [data-sync-workflow] spön
  // myndu ANNARS aldrei ræsast. Fylgjast með DOM og ræsa (init er idempotent —
  // sleppir spönum sem eru þegar ræstar). Debounce svo það kosti ekkert í þungu appi.
  let _moT = null;
  const rescan = () => { clearTimeout(_moT); _moT = setTimeout(init, 120); };
  const startMo = () => { try { new MutationObserver(rescan).observe(document.body, { childList: true, subtree: true }); } catch (_) {} };
  if (document.body) startMo(); else document.addEventListener("DOMContentLoaded", startMo);
})();
