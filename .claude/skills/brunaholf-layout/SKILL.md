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

## 3. Theme: gold + navy, shipped

The gold theme is live (all screens plus a dark pass). Tokens in `css/theme.css`:

```
--bg:#f6f4f0     --bg-2:#efece5      --card:#ffffff    --input-bg:#faf9f5
--line:#e5e0d6   --line-2:#d9d4c9
--ink:#16222f    --ink-2:#2c3a49     --muted:#5f6b78   --muted-2:#8b95a1
--navy:#2a2723   --navy-2:#38332c    --navy-dark:#1a1714
--gold:#c9a45c   --gold-deep:#b48d4c --accent:#b48d4c
```

On the 30 pages that do not link `theme.css`, these tokens are **undefined** -
`var(--gold)` silently falls back to nothing. Either link `theme.css` on that
page or copy the tokens into its `<style>` block. Check before using a token.

Known remaining tail: `fjarmalyfirlit` detailing, mobile bottom tabs.

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
