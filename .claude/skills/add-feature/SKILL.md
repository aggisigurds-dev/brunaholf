---
name: add-feature
description: >
  How to add a feature to the Brunahólf hub — the tab pattern (add to
  DEFAULT_STATE.tabs, write renderXxx(t), hook the renderTab dispatcher), the
  iframe-embed pattern for standalone pages, and the endpoint pattern (a CommonJS
  netlify function, GET returns JSON / POST writes, always CORS, paginate Supabase
  reads via the Range header). Use when adding a tab, an embedded page, or an /api
  endpoint to the hub.
---

# Add a feature — Brunahólf hub

No framework, no build step. A feature is edits to `index.html` (a tab) and/or a new
`netlify/functions/*.js` (an endpoint). `index.html` is ~1.29 MB — **grep first,
never read it whole.**

## New tab
1. Add an entry to **`DEFAULT_STATE.tabs`** (index.html ~line 1493): `{ id, label, … }`.
2. Write a **`renderXxx(t)`** function further down.
3. Hook it into the **`renderTab(t)`** dispatcher so the id routes to your renderer.
4. Deep-link is `/#<id>` (also works inside `?embed=1`).

## Standalone page as a tab (iframe pattern)
For a self-contained page (see `eydublod.html`, `multitool.html`,
`fjarmalyfirlit.html`): `renderXxx(t)` drops it in an iframe loaded with
`?v=Date.now()` (cache-bust). One source of truth — the page lives as both a
standalone URL and a hub tab, and the iframe always gets the fresh copy.

## New endpoint
`netlify/functions/<name>.js`, **CommonJS**, self-contained:
```js
exports.handler = async (event) => {
  // CORS always. GET → return JSON. POST → write.
  // Paginate Supabase reads via the Range header (never rely on the default 1000 cap).
};
```
`/api/<name>` resolves automatically via the catch-all. Env via
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role — bypasses RLS).

## House rules (match the rest of the hub)
- **UI text in Icelandic.** Money in **ISK**, no decimals (`Math.round` + locale).
  Dates: ISO `YYYY-MM-DD` for storage, `dd.mm.yyyy` for display.
- **ALLTAF LEYFA VISTUN** — no Save/„Vista" button may block on validation, required
  fields, or unsigned signatures. Drafts always persist; required-state checks belong
  on the *review* side (a „Vantar …" badge), never as a hard stop on save.
- **Worksite names are inconsistent** across Tímavera/Ajour/invoices — always match
  through `project_aliases`, and add a new alias when you spot one rather than
  hard-coding a string list.
- **Additive Supabase changes** (new nullable columns, new tables) are safe without a
  backup; destructive ones need a backup + Agnar's go-ahead. 19 tables have RLS
  disabled so the anon key can reach them — mirror that only when the client needs it.

## After you change something material
Update the relevant **`CLAUDE.md`** section (new table / tab / endpoint) in the same
commit. Verify + screenshot with the **deploy** and **screenshot-verify** skills.
