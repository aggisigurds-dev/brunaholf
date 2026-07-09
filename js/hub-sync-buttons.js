/* hub-sync-buttons.js — drop-in "Samstilla" buttons for the Brunahólf hub.
 *
 * WHAT IT DOES
 *   Renders a "🔄 Samstilla <label>" button plus a "síðast samstillt: <date>"
 *   line. Clicking writes a run request to Supabase `automation_triggers`
 *   (workflow = timavera | ajour | …). The local watcher.js on the bridge
 *   machine picks it up, runs the fetch, and writes status back — which this
 *   component then shows. No credentials in the page (publishable key only).
 *
 * HOW TO USE (in the hub pages)
 *   1) Include this script once (in index.html):
 *        <script src="/js/hub-sync-buttons.js" defer></script>
 *   2) Drop a placeholder wherever you want a button:
 *        <span data-sync-workflow="timavera" data-sync-label="Tímavera"></span>
 *        <span data-sync-workflow="ajour"     data-sync-label="Ajour"></span>
 *   The script auto-initializes on load AND on hash navigation (the hub is a
 *   hash-SPA), so buttons added to tab markup light up when that tab renders.
 *
 * WHERE (per request)
 *   - #gerdreikninga (Gerð Reikninga) : timavera
 *   - #vinnubok      (Vinnubók)       : timavera
 *   - #landsspitalinn (Landsspítalinn): timavera  AND  ajour
 */
(function () {
  const SUPABASE_URL = "https://osfdzskyvisifcwyjkuk.supabase.co";
  const SUPABASE_KEY = "sb_publishable_YVpznM5EK01qOdevQwOcIg_rMjTkT7f"; // publishable — safe in browser
  const H = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };

  const fmt = (s) => s ? new Date(s).toLocaleString("is-IS", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

  async function lastRun(wf) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_triggers?workflow=eq.${encodeURIComponent(wf)}&order=requested_at.desc&limit=1`, { headers: H });
      const rows = r.ok ? await r.json() : [];
      return rows[0] || null;
    } catch { return null; }
  }
  async function trigger(wf, by) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_triggers`, {
      method: "POST", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ workflow: wf, requested_by: by || "hub" }),
    });
    return r.ok;
  }

  const CSS = `
    .hub-sync{display:inline-flex;flex-direction:column;align-items:flex-start;gap:3px;font-size:12px}
    .hub-sync button{background:#e8590c;color:#fff;border:0;border-radius:8px;padding:6px 11px;font-weight:600;font-size:12px;cursor:pointer}
    .hub-sync button:disabled{opacity:.6;cursor:default}
    .hub-sync .d{color:#2563eb;font-weight:600;font-size:11px;padding-left:2px}
    .hub-sync.fresh .d{color:#16a34a}
    .hub-sync .dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;background:#adb5bd;vertical-align:middle}
    .hub-sync .dot.done{background:#2f9e44}.hub-sync .dot.running{background:#1c7ed6}.hub-sync .dot.pending{background:#f59f00}.hub-sync .dot.error{background:#e03131}`;
  function injectCss() { if (document.getElementById("hub-sync-css")) return; const s = document.createElement("style"); s.id = "hub-sync-css"; s.textContent = CSS; document.head.appendChild(s); }

  function render(el) {
    const wf = el.getAttribute("data-sync-workflow");
    const label = el.getAttribute("data-sync-label") || wf;
    el.classList.add("hub-sync");
    el.innerHTML = `<button type="button">🔄 Samstilla ${label}</button><span class="d"><span class="dot"></span><span class="txt">…</span></span>`;
    const btn = el.querySelector("button"), dot = el.querySelector(".dot"), txt = el.querySelector(".txt");

    async function refresh() {
      const last = await lastRun(wf);
      dot.className = "dot" + (last ? " " + last.status : "");
      if (!last) { txt.textContent = "aldrei samstillt"; el.classList.remove("fresh"); return; }
      const ts = last.finished_at || last.started_at || last.requested_at;
      const when = fmt(ts);
      const state = (last.status === "pending" || last.status === "running") ? ` (${last.status})` : "";
      txt.textContent = `síðast samstillt: ${when}${state}`;
      // Grænn þegar samstillt innan 24 klst, annars blár (ósk Agnars 2026-07-08).
      const ageH = ts ? (Date.now() - new Date(ts).getTime()) / 3600000 : Infinity;
      el.classList.toggle("fresh", isFinite(ageH) && ageH < 24);
    }
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = "⏳ Samstilli…";
      const ok = await trigger(wf, (location.hash || "hub").replace("#", ""));
      txt.textContent = ok ? "samstilling beðin…" : "villa — reyndu aftur";
      dot.className = "dot pending";
      setTimeout(async () => { await refresh(); btn.disabled = false; btn.textContent = `🔄 Samstilla ${label}`; }, 1000);
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
