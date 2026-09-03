# Boss — design system

The black-steel, cream-paper and gold-metal theme for Slökkvitæki ehf. / Brunahólf
back-office screens. Built from `Þjónustuborð boss v4` (02.09.2026), the version
Agnar chose over the flat system, the dark Stjórnstöð/Kolefni takes and the
DESIGN.md-derived variants.

It is a **skin**, not a new information design: the same layout, copy rules,
status logic and data contracts as the root Slökkvitæki system apply. What
changes is the material — depth, gold, serif titles.

## Sources

- `Þjónustuborð boss v4.dc.html` (this project) — every value here is measured from it.
- The root Slökkvitæki system (`../../readme.md`) — content rules, status scale,
  contrast floor, data layer. Read it first; this document only covers what differs.
- Live app: `aggisigurds-dev/slokkvitaeki` — layout of the desk at 1280px.

## CONTENT FUNDAMENTALS

Unchanged from the root system: Icelandic throughout, flat statements of fact,
sentence case in prose, uppercase tracked labels, `fmtKr` for currency, emoji as
markers not decoration. One addition:

**Engraved section numbers.** Every panel title is preceded by a small gold
plate carrying a two-digit index — `01 DAGSKRÁ`, `02 SKIPULAGSBORÐ`, `03 SPJALL`,
`04 NÝJAST`, `05 ÁRÍÐANDI`, `06 VALIÐ MÁL`. The numbers follow reading order on
the page and are stable across sessions so people can say "sjá 04".

## VISUAL FOUNDATIONS

**Three materials.** Black steel for chrome (header, sidebar, the selected-case
slab), cream paper for the working surface, gold metal for emphasis. Nothing is
a fourth material. Status colours (green, terra, gold-ink) are paint on those
materials, not materials themselves.

**Gold is decorative.** It marks structure — where a panel begins, which nav item
is active, which button is *the* action — and never carries information on its
own. Age, status and counts read from their own colour and number. This is the
rule that keeps the theme usable outdoors.

**Colour.** Ground `#f4f1ea` with a faint radial vignette to `#ece7dc`. Panels
white-to-`#fbf9f5`. Chrome runs a ladder from `#050505` to `#4a463f`. Text
`#161513` / `#4a463f` / `#6f685c` (5.3:1, the data floor) / `#8f8776`
(placeholders only). Gold is a ten-step ramp from specular `#fff3b0` to bronze
`#3e2c06`; as text on cream it is always `#8f6a1c` (4.6:1).

**Gold recipes — four, no more.** `--gold-line` for every thin rule (a 7-stop
horizontal gradient bronze → 24k → specular → bronze). `--gold-face` for buttons,
plates and chips (specular sweep + 1px brushed grain + a bronze-bodied vertical
gradient). `--gold-side` for the active nav and view switch (same build, quieter
sweep). `--gold-coin` for the medallion (conic lathe grain over a lit sphere).
The header band is `--gold-band`; the wordmark is `--gold-text` clipped to type.
Never author a new gold gradient — reuse one of these.

**Type.** Playfair Display 700/800 for the page title, panel titles, KPI numbers
and day numbers. IBM Plex Mono 500/600 for every label, clock, identifier, count
and date. The system sans for body. Emphasis is weight and material, never
colour; the only coloured type is gold-ink on kickers and `0D`/`1D` age tokens.

**Depth.** Every object is one of: raised plate (panel), brushed strip (panel
header), ivory key (light button), obsidian key (dark button), gold key,
inset well (field, tray), dark slab (selected case, dark KPI), dark well (LCD
clock). Each has one shadow recipe in `tokens/elevation.css`. Do not compose
new ones; pick the object.

**Bevels.** Gold and obsidian keys have a pale top edge and a near-black bottom
edge — `border-top-color` / `border-bottom-color` — plus an inset highlight and
an inset lower shadow. Ivory keys have only the darker bottom edge. Wells invert:
inset top shadow, no outer shadow but a 1px white lip.

**Radius.** 2px plates and chips, 4px buttons/fields/KPI cards, 5px panels and
slabs, 14px on the single sync pill, 50% on the medallion and LEDs.

**Motion.** One: the LCD clock's glow breathes on a 4s ease cycle. Nothing else
animates. Buttons change `filter: brightness` by 4% on hover, −4% on press.

**Empty states.** A ghost medallion (40px, 22% opacity) above the sentence, so
an empty panel still reads finished.

**Selection.** A gold `◆` pin at the left of the selected row, not a filled edge.

## ICONOGRAPHY

As the root system: Unicode markers at text size, no icon font. The flame 🔥 sits
inside the medallion as the mark.

## BRAND MARK

Wordmark "Brunahólf" in Playfair Display 800 with `--gold-text` clipped to the
glyphs, over `STJÓRNSTÖÐ · SLÖKKVITÆKI EHF.` in 9.5px mono at 0.24em. The
medallion to its left. No logo files were supplied; drop real ones into
`assets/` to replace the type treatment.

## Index

| File | What it is |
| --- | --- |
| `styles.css` | Entry point — imports tokens and the component layer |
| `tokens/colors.css` | Chrome ladder, paper, text, status |
| `tokens/gold.css` | The gold ramp and the four recipes |
| `tokens/typography.css` | Playfair / Plex Mono / system, the size scale, `.boss-*` type classes |
| `tokens/spacing.css` | Spacing, radii, fixed geometry |
| `tokens/elevation.css` | One shadow recipe per object type |
| `components.css` | `.boss-*` classes for header, sidebar, panels, buttons, fields, chips |
| `guidelines/` | Foundation specimen cards |
| `components/` | Component cards |
| `ui_kits/thjonustubord/` | The full desk — the reference screen |
| `DESIGN.md` | The same system in nine-section form for coding agents |
| `SKILL.md` | Portable skill for Claude Code |

## Using it on another site

Copy this folder to the root of a new project and set File type → Design
System. Then in each page: `<link rel="stylesheet" href="styles.css">` and build
with the `.boss-*` classes. The three things that make a page read as Boss:
the gold-banded black header, `01`-style plates on panel titles, and exactly one
gold button per panel.
