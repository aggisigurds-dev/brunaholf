# DESIGN.md — Boss (Slökkvitæki ehf. / Brunahólf)

## 1. Overview
A back-office theme in three materials: black steel chrome, cream paper surfaces,
gold metal accents. Depth is explicit — plates, keys, wells, slabs — and gold is
decorative structure, never data. Derived from `Þjónustuborð boss v4`.

## 2. Colors
- Ground `#f4f1ea` (vignette to `#ece7dc`); panels `#fff → #fbf9f5`
- Chrome ladder `#050505 · #0a0a09 · #0f0f0e · #161513 · #1c1b18 · #23211e · #2a2823 · #3a3732 · #4a463f`
- Text `#161513` / `#4a463f` / `#6f685c` (data floor, 5.3:1) / `#8f8776` (placeholders only)
- Gold ramp `#fff3b0 · #f5d76e · #e8cb7a · #d9b25a · #c9a54a · #b8892e · #a87b1f · #8f6a1c · #5a4410 · #3e2c06`; gold as text on cream = `#8f6a1c`
- Status: green `#2f7a4a` (LED `#4fc47a`), terra `#b5522a`, gold-ink `#8a6a1c`
- Rules: `#d9d3c6` panel, `#e6e1d6` row, `#cfc8b9` panel border, `#c9c2b3` / `#a89f8c` button edges

## 3. Typography
- Display: Playfair Display 700/800 — h1 44px −.02em; panel title 20px; KPI 34px; row title 17px; day 16px
- Mono: IBM Plex Mono 500/600 — labels 10px uppercase .14em; identifiers/clock 11px; LCD 21px
- Body: system sans — 13px body, 12.5px data, 11.5px meta
- Emphasis by weight and material; the only coloured type is gold-ink kickers and age tokens

## 4. Spacing & Geometry
- Scale 4 · 6 · 9 · 12 · 14 · 16 · 18 · 26 · 30
- Radius 2px plates/chips, 4px buttons/fields/KPI, 5px panels/slabs, 14px sync pill, 50% medallion/LED
- Header 78px, sidebar 196px, button 36px (30 sm / 42 lg), field 36px, gold band 4px, top rules 3px

## 5. Gold recipes (verbatim)
- `--gold-line`: `linear-gradient(90deg,#7a5a12 0%,#c9a54a 18%,#f5d76e 38%,#fff3b0 47%,#f5d76e 56%,#c9a54a 78%,#7a5a12 100%)` — every thin rule
- `--gold-face`: `linear-gradient(115deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.55) 45%,rgba(255,255,255,0) 52%), repeating-linear-gradient(180deg,rgba(255,255,255,.08) 0 1px,rgba(0,0,0,0) 1px 3px), linear-gradient(180deg,#f3dc95 0%,#d9b25a 14%,#b8892e 46%,#8f6a1c 52%,#a87b1f 74%,#cfa54a 92%,#e8cb7a 100%)` — buttons, plates, chips
- `--gold-side`: same build with `.4` sweep over `linear-gradient(180deg,#e8cb7a 0%,#c9a54a 45%,#9c7422 55%,#b8892e 100%)` — active nav, view switch
- `--gold-coin`: `repeating-conic-gradient(from 0deg,rgba(255,255,255,.09) 0 1.5deg,rgba(0,0,0,0) 1.5deg 4deg), radial-gradient(circle at 32% 28%,#fff3d0 0%,#e8cb7a 16%,#b8892e 46%,#7a5a12 76%,#3e2c06 100%)` — medallion
- Gold key bevel: border `#5a4410`, top `#f7e6b8`, bottom `#2e2004`; shadow `inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 3px rgba(60,40,0,.45), 0 3px 6px rgba(22,21,19,.45), 0 0 12px rgba(184,137,46,.35)`

## 6. Elevation objects (one recipe each — see tokens/elevation.css)
panel · strip · ivory key · obsidian key · gold key · well · slab · dark well

## 7. Components
Header (band, medallion, wordmark, LCD, header keys, sync pill) · Sidebar (nav items, footer plate) · Panel (strip head with plate + title + one gold action) · KPI card (light / dark) · Slab (selected case) · Buttons (ivory / obsidian / gold, sm / lg) · Fields & trays · Plates · Chips · LEDs · Pin

## 8. Motion
LCD glow breathes, 4s ease-in-out infinite. Buttons `filter: brightness(1.04)` hover, `.96` press. Nothing else.

## 9. Do / Don't
- Do: one gold button per panel; plates on every panel title; gold-line on every panel hairline; ghost medallion in empty states.
- Don't: gold as information; new gold gradients; more than one motion; dropping below `#6f685c` for data text; shadows composed ad hoc.
