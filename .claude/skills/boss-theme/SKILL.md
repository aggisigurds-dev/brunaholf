---
name: boss-theme
description: The Boss theme for Brunahólf / Slökkvitæki back-office pages — black steel chrome, cream paper surfaces, gold metal accents, Playfair titles, Plex Mono labels. Use whenever building or restyling a hub page, tab or modal in the Boss look. Contains tokens (colors, the four gold recipes, elevation objects, spacing, type), the .boss-* component classes, foundation cards and the reference Þjónustuborð screen. Mirrored in production as css/theme.css.
user-invocable: true
---

Read the readme.md within this skill, then `tokens/gold.css` and
`tokens/elevation.css` — those two files are the theme. If creating visual
artifacts, copy the folder's `styles.css` + `tokens/` + `components.css` and
build static HTML with the `.boss-*` classes. If working on production code,
lift the exact gradient recipes from `tokens/gold.css`; do not approximate gold
with a flat colour or a two-stop gradient.

Three rules make or break a Boss screen:

- **Gold is decorative.** It marks structure — panel starts, the active nav,
  the one main action — and never carries information. Status and age read
  from their own colour and number.
- **One gold button per panel.** Everything else is ivory or obsidian.
- **Pick the object, don't compose a shadow.** Every element is one of eight:
  panel, strip, ivory key, obsidian key, gold key, well, slab, dark well.

Content rules, the status scale, the 4.5:1 data-text floor and the data layer
are inherited from the root Slökkvitæki system; read its readme when unsure.

## Í þessu repói (brunaholf)

- **Framleiðslu-CSS:** `css/theme.css` (v2) ber sömu tokens (`--gold-line`, `--gold-face`,
  `--gold-side`, `--gold-coin`, `--panel-shadow`, `--key-shadow`, `--obsidian-shadow`,
  `--well-shadow`, `--slab-shadow`, `--kpi-shadow`, `--font-display`, `--font-mono` …) og
  `.boss-*` klasana (panel, panel-head, plate, kpi, slab, btn.ivory|obsidian|gold, field,
  seg, labeled, badge, led, kicker, h1, tray, chip, lcd, medallion …). `index.html` hleður
  hana; **30 af 32 síðum gera það EKKI** — þar þarf `<link rel="stylesheet" href="/css/theme.css">`
  eða afrit af tokens í `<style>` síðunnar (sjá skill `brunaholf-layout`).
- **Hönnunarheimildir:** þessi mappa (tokens/, components.css, guidelines/, ui_kits/) og
  `docs/design-boss/`. Þær eru sami sannleikur; uppfærðu báðar ef reglu er breytt.
- **Áður en CSS er skrifað:** lesa skill `brunaholf-layout` (per-síðu CSS, tíu breakpoints —
  endurnýta breakpoint síðunnar, aldrei bæta við ellefta).
- **Kaflanúmer:** hvert spjald fær gullplötu með tveggja stafa númeri í lesröð (`01 VERK`,
  `02 TÍMI & AKSTUR` …) svo fólk geti sagt „sjá 03".
- **Útfærslur:** Þjónustuborð (viðmiðunarskjár, ui_kits/), Efnislista-ritillinn í Gerð
  reikninga (03.09.2026 — tölva + sími, mockup „Efnislisti boss" / „Efnislisti boss sími").
