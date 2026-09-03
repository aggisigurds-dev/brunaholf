---
name: brunaholf-layout
description: Layout, CSS and responsive rules specific to the Brunaholf hub. Use BEFORE writing any CSS, media query, or layout change in this repo - including mobile/desktop adjustments, dashboard/table layout, spacing, or theming. Explains the per-page style architecture and the breakpoint sprawl.
---

# Brunaholf layout rules

Read before touching CSS or layout here. This repo is NOT a single app - it is
32 independent HTML pages that mostly do not share styles.

## 1. Architecture: per-page, not shared

- **32 `.html` pages** at the repo root, each standalone.
- **Only 2 CSS files**: `css/theme.css` and `css/fjarmalyfirlit.css`.
- **Only 2 of 32 pages link `theme.css`.** The other 30 carry their own inline
  `<style>` block. `index.html` alone has 27 `<style>` blocks.

Consequences you must respect:

- **There is no global stylesheet.** Editing `css/theme.css` changes almost
  nothing - it reaches 2 pages.
- A layout fix applies to **one page only** unless deliberately repeated.
- Before "fixing the app", confirm which page. Ask if unclear; do not fan a
  change across 32 files on assumption.
- When asked to change something everywhere, list the affected pages first and
  confirm - that is a 30-file edit, not a one-liner.

## 2. Breakpoint sprawl - the main hazard

Ten distinct breakpoints are in use across the repo:

```
1200  980  960  900  880  840  780  720  700  640
```

They are **not** a designed scale; they accumulated per page. `900px` (8 uses)
and `980px` (6) are the most common.

Rules:

- **Match the page you are editing.** Read its existing `@media` blocks first
  and reuse those values. Consistency within a page beats consistency with the
  repo.
- **Never add an eleventh breakpoint.**
- If asked to standardise them repo-wide, treat it as its own project with a
  before/after check per page - not a side effect of another task.

## 3. Theme: "Boss" (black steel · cream paper · gold), shipped 2026-09-03

The Boss theme is live in `css/theme.css` (v2). Source of truth for the design
system (tokens, gold recipes, elevation objects, page mockups): `docs/design-boss/`
— read `docs/design-boss/README.md` first. Core tokens:

```
--bg:#f4f1ea      --bg-2:#ece7dc      --card:#ffffff     --input-bg:#f6f3ec
--line:#e6e1d6    --line-2:#d9d3c6    --border:#cfc8b9   --edge:#c9c2b3
--ink:#161513     --ink-2:#4a463f     --muted:#6f685c    --muted-2:#8f8776 (placeholders only)
--navy:#161513    --navy-2:#2a2823    --navy-dark:#0a0a09   (steel ladder aliases)
--gold:#c9a54a    --gold-deep:#8f6a1c (gold as TEXT)      --accent:#b8892e
--red:#b5522a (terra)  --green:#2f7a4a  --blue:#5980a6  --warn:#8a6a1c
--font-display: Playfair Display 700/800   --font-mono: IBM Plex Mono 500/600   --font-ui: system-ui
```

Gold recipes (never author a new gold gradient): `--gold-line`, `--gold-face`,
`--gold-side`, `--gold-coin`, `--gold-band`, `--gold-text`. Depth objects, one
shadow each: `--panel-shadow`, `--key-shadow`, `--obsidian-shadow`, `--well-shadow`,
`--slab-shadow`, `--kpi-shadow`. Component classes: `.boss-panel`, `.boss-panel-head`,
`.boss-plate`, `.boss-kpi(.dark)`, `.boss-slab`, `.boss-btn.ivory|.obsidian|.gold`,
`.boss-field`, `.boss-seg`, `.boss-labeled`, `.boss-badge`, `.boss-led`, `.boss-kicker`,
`.boss-h1`. Header/sidebar CSS lives in theme.css; index.html keeps only behaviour.

The old variable names (`--navy`, `--gold-deep`, …) still exist and are remapped,
so tabs using `var(--…)` picked the theme up automatically. On the 30 pages that
do not link `theme.css`, these tokens are **undefined** - link `theme.css` on that
page or copy the tokens into its `<style>` block. Check before using a token.

Runtime-injected `<style>` (js/hub-sync-buttons.js, `.cg-badge`) lands after
theme.css; theme.css raises specificity with a `body ` prefix for those.

## 4. Constraints

- **No build step.** No React, Vite, or Tailwind. Plain HTML/CSS/JS.
- `package.json` holds **Netlify function deps only** (`mailparser`, `pdf-lib`,
  `pdf-parse`, `xlsx`) - it is not a frontend toolchain. Do not add frontend
  packages there.
- Deployed on Netlify. `gatt/` and `gatt-admin/` are separate areas - check auth
  assumptions before changing their layout.
- No runtime JS style-stamping here (unlike the sibling `slokkvitaeki` repo), so
  normal CSS specificity applies and `!important` behaves as expected.

## 5. Verify before claiming done

1. `preview_start` with `brunaholf-dev` (`.claude/launch.json`, port 5601).
2. Navigate to **the specific page** you changed - the root index does not
   exercise other pages' styles.
3. `resize_window` to mobile (375) and desktop; check the page's own
   breakpoints, not generic ones.
