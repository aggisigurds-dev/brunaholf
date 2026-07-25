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

  // ── real data freshness (cached ~12s, shared across all buttons) ─────────────
  let _dss = null, _dssAt = 0, _dssP = null;
  async function dss() {
    if (_dss && Date.now() - _dssAt < 12000) return _dss;
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
  async function ajourRun(setP) {
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
    .hub-sync{display:inline-flex;flex-direction:column;align-items:flex-start;gap:3px;font-size:12px}
    .hub-sync button{background:#e8590c;color:#fff;border:0;border-radius:8px;padding:6px 11px;font-weight:600;font-size:12px;cursor:pointer}
    .hub-sync button:disabled{opacity:.7;cursor:default}
    .hub-sync .d{color:#64748b;font-weight:600;font-size:11px;padding-left:2px}
    .hub-sync.fresh .d{color:#16a34a}
    .hub-sync.ok .d{color:#16a34a}
    .hub-sync.err .d{color:#e03131}
    .hub-sync .dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;background:#adb5bd;vertical-align:middle}
    .hub-sync .dot.done{background:#2f9e44}.hub-sync .dot.running{background:#1c7ed6}.hub-sync .dot.pending{background:#f59f00}.hub-sync .dot.error{background:#e03131}`;
  function injectCss() { if (document.getElementById("hub-sync-css")) return; const s = document.createElement("style"); s.id = "hub-sync-css"; s.textContent = CSS; document.head.appendChild(s); }

  function render(el) {
    const wf = el.getAttribute("data-sync-workflow");
    const label = el.getAttribute("data-sync-label") || wf;
    el.classList.add("hub-sync");
    el.innerHTML = `<button type="button">🔄 Samstilla ${label}</button><span class="d"><span class="dot"></span><span class="txt">…</span></span>`;
    const btn = el.querySelector("button"), dot = el.querySelector(".dot"), txt = el.querySelector(".txt");
    const setTxt = (t) => { txt.textContent = t; };

    async function refresh() {
      if (Date.now() < (el._quiet || 0)) return;            // ekki yfirskrifa nýlega „✓ samstillt"
      const d = await dss();
      const src = (d.sources || []).find((s) => s.key === (SRC_KEY[wf] || wf));
      if (!src) { txt.textContent = "—"; dot.className = "dot"; el.classList.remove("fresh", "ok", "err"); return; }
      const nd = fmtDay(src.newest_real), li = fmt(src.last_import);
      txt.textContent = "nýjast " + (nd || "—") + (li ? " · sótt " + li : "");
      const st = src.status;                                // fresh | aging | stale
      dot.className = "dot " + (st === "fresh" ? "done" : st === "aging" ? "pending" : "error");
      el.classList.remove("ok", "err"); el.classList.toggle("fresh", st === "fresh");
    }
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = "⏳ Samstilli…"; el.classList.remove("fresh", "ok", "err");
      dot.className = "dot running"; el._quiet = Date.now() + 3600e3;   // frysta freshness-línuna á meðan
      if (CLOUD[wf]) {                                       // BEIN ský-samstilling (engin brú)
        setTxt("samstilli…");
        try {
          const detail = await CLOUD[wf]((p) => setTxt("samstilli… " + p));
          dot.className = "dot done"; el.classList.add("ok"); setTxt("✓ samstillt núna · " + detail);
          _dss = null;                                       // þvinga ferska freshness við næstu lestur
          el._quiet = Date.now() + 8000;                     // haltu „✓" í 8s, sýndu svo raun-ferskleika
        } catch (e) {
          dot.className = "dot error"; el.classList.add("err"); setTxt("✗ " + (e.message || e));
          el._quiet = Date.now() + 8000;
        } finally { btn.disabled = false; btn.textContent = `🔄 Samstilla ${label}`; }
        return;
      }
      // Fallback: enginn ský-endapunktur → biðja brúna (gamla hegðunin).
      const ok = await trigger(wf, (location.hash || "hub").replace("#", ""));
      setTxt(ok ? "samstilling beðin…" : "villa — reyndu aftur"); dot.className = "dot pending";
      el._quiet = Date.now() + 5000;
      setTimeout(async () => { btn.disabled = false; btn.textContent = `🔄 Samstilla ${label}`; await refresh(); }, 5000);
    };
    refresh();
    if (!el._t) el._t = setInterval(refresh, 15000);
  }

  function init() {
    injectCss();
    document.querySelectorAll("[data-sync-workflow]").forEach((el) => { if (!el.dataset.syncInit) { el.dataset.syncInit = "1"; render(el); } });
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("hashchange", () => setTimeout(init, 300)); // hub is a hash-SPA
})();
