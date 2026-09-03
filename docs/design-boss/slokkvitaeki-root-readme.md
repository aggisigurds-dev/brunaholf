# Slökkvitæki ehf. / Brunahólf — design system

Internal tooling for a fire-equipment service company in Iceland. Two products
share one visual language:

- **Slökkvitæki** (`slokkvitaeki.netlify.app`) — the back office. Ársskoðun
  (annual inspection of ~678 companies), Þjónustuborð (service desk),
  Afgreiðsla, Verkstæði, Kröfu yfirlit.
- **Brunahólf** — the customer-facing side of the same business.

The audience is four to six people: Agnar in the office, and drivers who read
the screen in a van, in a basement, and outdoors in daylight. Nobody is
browsing. Every screen is a tool.

## Sources

- GitHub: `aggisigurds-dev/slokkvitaeki` (branch `master`) — the live app.
  Read for this system: `js/patches/153-arsskodun.js` (the Ársskoðun view,
  its year pills, status logic and per-company save), `js/patches/314-*`
  (the phone layers), `css/mobile.css`, `docs/LITASKRA.md`,
  `.claude/skills/slokkvitaeki-layout/SKILL.md`.
- `DESIGN.md` (this repo root) — the same system in the nine-section
  `DESIGN.md` format, for handing to coding agents.
- Screenshots of the live Þjónustuborð at 1280px and of Ársskoðun at 390px,
  supplied 29.08 and 02.09.2026.

Data lives behind `AppSettings.path('arsskodun_customers')`, `CanonStadur`
(patch 312) and `ArsAkstur` — a standalone HTML page cannot read it. Any new
screen must be a patch inside the app.

## CONTENT FUNDAMENTALS

**Language is Icelandic, throughout, with no English fallback.** Feature names
are the nouns the business already uses and must not be translated or softened:
Ársskoðun, Þjónustuborð, Skipulagsborð, Aksturslisti, Úttekt, Brunakerfi,
Slökkvitæki, Reykskynjari, Slöngukefli.

**Tone: flat statement of fact.** The interface says what is true and stops.

- `enginn póstur bíður svars`
- `96 af 98 málum eru falin · starfsmaður: Bjarndís`
- `Veldu mál í Þjónustuborðinu og smelltu á Skipulag til að bæta við.`
- `Í vinnslu — óklárað · 3 af 9 tækjum skráð`

No exclamation marks, no encouragement, no "Great job!". An empty state is a
sentence, not a shrug: `Engin áríðandi mál`, `Ekkert sagt enn.`

**Casing.** Sentence case in prose. Panel headers are uppercase with wide
tracking (`DAGSKRÁ`, `SKIPULAGSBORÐ`, `SPJALL`). Field labels are 10px
uppercase (`BORÐ`, `MERKI`, `AKSTUR`, `FYLGISKJÖL`). Buttons are sentence case
with a leading `+` when they create something (`+ Nýtt mál`, `+ Skrá verk`,
`+ Bæta við`).

**Person.** The interface addresses the user directly and informally — second
person singular, imperative: `Dragðu spjöld á dagskrárröður`, `Skrifaðu — eða
dragðu skrá hingað`, `Leita í málum…`. It never speaks as "we" and never
narrates its own actions.

**Numbers carry the meaning.** Counts sit next to their noun (`36 staðir · 24
búnir`, `12 tæki`, `0 / 5 spjöld`, `24/36`). Age of a case is a bare monospace
token: `0D`, `1D`, `6D`. Currency is Icelandic — `105.710 kr`, period as the
thousands separator, `kr` lowercase after a space. Use `fmtKr` in
`js/utils.js`; `toLocaleString` alone produces `105,710` and is wrong.

**Emoji.** The live app uses them as compact category and action markers, and
that is part of its voice: 🚗 for an aksturslista, 📞 Hringja, 🗺 Leiðsögn,
📝 for a note, ⟳ for sync, 🏢 for a company, 🔧 for the service desk. They act
as icons, never as decoration or sentiment. Never put an emoji in a sentence.

## VISUAL FOUNDATIONS

**The direction is a toolbox, not an app.** Dense rows of real data on a light
ground, with dark steel chrome separating frame from content. Nothing decorative
takes space from data.

**Colour.** Steel `#1a1f2e` chrome, paper `#f5f4ef` ground, white surfaces. Two
accents with strictly separated jobs: **red `#C93C1D` is identity** (the mark,
and the one button that creates a new case) and **deep blue `#17324f` is
action** — every filled, touchable thing. Before 02.09 the service desk had four
competing "primary" button colours and none of them read as the main action.
Status is a five-value scale (skoðað green, í vinnslu steel-blue, á eftir red,
sleppt gold, á dagskrá grey) used as a 3px left edge or a small pill, never as a
card fill. A card that was filled blue swallowed its own text; that was reverted.

**Age is a colour.** 0–1 day muted, 2–4 days deep blue, 5+ days `#b0503c`. This
was the information that vanished in the shipped phone layout — `1D` was set in
near-white on white.

**Contrast floor.** Nothing under 4.5:1 carries data. `#8c8880` (3.5:1) and
`#a8a49c` (2.5:1) were both in use and were removed; the floor for data text is
`#5d5a54` at 6.9:1, and 10px uppercase labels use `#6f6b63` at 4.6:1. Raw steel
blue `#5980a6` is 4.2:1 and therefore never sits on text under 14px — small text
in the action colour uses `#2a4763` (8.8:1). This screen is read outdoors.

**Type.** The system stack (`system-ui`) with a monospace face for every number
— dates, ages, counts, prices, kennitölur, the clock. Numbers must stack
vertically between rows, so they are tabular. Sizes run 25px screen title,
16.5px card heading, 15.5px row name, 12.5–13px data, 10px uppercase labels.
Nothing below 12.5px except those labels. There are **no webfonts**: the app
loads none, and substituting one would change its character.

**Geometry.** Radius 2px on buttons, fields and year cells; 3px on cards;
nothing higher. The only circle in the system is the 26px status dot in a table
row. Rows are 52px, headers 38px, the frozen name column 150px. Cards sit 12px
apart with 13px/14px padding.

**Backgrounds.** Flat colour only. No gradients, no imagery, no patterns, no
texture. The one exception in the live app is the flame banner on the Brunahólf
header — a photographic band that was replaced in the 02.09 exploration with a
flat steel band of identical height, because four saturated colours in a header
leave nothing for the interface to signal with. Both are documented; the flat
band is the recommendation.

**Elevation.** Three shadows exist. `0 1px 1px rgba(20,20,18,.04)` on a card;
`3px 0 8px -6px rgba(0,0,0,.45)` on the frozen name column, which is the only
place depth carries real meaning; `0 -1px 0 rgba(0,0,0,.08)` above a bottom tool
panel. Everything else is a 1px hairline `#e3e1dc`. Dark metal gradients were
tried across the whole driver card on 29.08 and rejected — seven equally heavy
objects competing on one card.

**Cards.** White fill, 1px `#e3e1dc` border, 3px radius, the small card shadow,
and a 3px left edge in the status colour. Never a filled colour field on the
card itself.

**Borders and rules.** Hairlines do the structural work: `#e3e1dc` for a border,
`#eeece7` for a row divider. Panels are boxed; there are no floating shadows
standing in for structure.

**Hover, press, focus.** Hover is a tint, not a lift: a row goes to
`rgba(0,0,0,.03)`, a quiet button to `rgba(0,0,0,.05)`. A filled action darkens
one step to `#0f2437` on press. Focus is a 2px `#5980a6` outline at 2px offset —
never the browser default. Nothing scales, nothing bounces.

**Animation.** Effectively none. Transitions are limited to `background-color`
and `border-color` at 120ms. No entrance animation, no skeleton shimmer, no
spinner where a count will do. The screen is read while standing up.

**Transparency and blur.** Not used. There is no glass, no scrim except the
dialog backdrop at `rgba(22,24,28,.5)`.

**Layout rules.** One filter per screen, at the top, governing everything below
it — the same employee was being chosen in three separate places on the service
desk. Scroll rather than drop: a table wider than the screen scrolls sideways
behind a frozen name column, and the filter strips scroll horizontally in a
single line instead of wrapping into four rows and eating 160px. The frozen
column and the scrolling body must mirror `scrollTop`; they went 456px out of
sync in the shipped build.

**Responsive.** The trigger is `data-viewmode` on `<html>` — a user setting —
not `matchMedia`. Three views: desktop (full table, KPI cards), phone table
(frozen 150px name column + 668px scrolling), phone driver (cards grouped by
month). KPI cards are not in the phone views; a driver does not use those
numbers on site and they fit in the footer strip that already carries the count
and total.

## ICONOGRAPHY

**There is no icon font, no SVG sprite and no icon library in the app.** Icons
are Unicode emoji, used at text size, inline in labels and buttons. This is the
real convention and it is kept: 🚗 aksturslisti, 📞 Hringja, 🗺 Leiðsögn,
📝 note, ⟳ Samstilla, 🏢 company, 🔧 Þjónustuborð, 🔎 search, ⚙ settings,
📎 attachment, 🖨 print, ✓ done, ⏳ waiting, ⚠ overdue, ○ queued, ◐ in progress.

They are markers, never illustration. They never appear inside a sentence and
they never carry colour of their own. Where a glyph would be ambiguous, the
label carries the meaning and the glyph is dropped.

No icon set was substituted from a CDN, because none is in use to substitute.
If a real icon set is ever adopted, the closest match to the current weight
would be Lucide at stroke-width 1.5 — but that would be a change to the system,
not a documentation of it.

## BRAND MARK

**No logo files were supplied**, and none are reconstructed here. The Brunahólf
header sets the name in plain type — "Brunahólf" at 31px over "SLÖKKVITÆKI EHF."
at 13px with 0.19em tracking — with a flame glyph standing in for the mark in
the live header. Everywhere a mark would go, this system sets the brand name in
type. If you have the real logo files, drop them into `assets/` and they will
replace the type treatment.

## Index

| File | What it is |
| --- | --- |
| `styles.css` | The entry point. Link this one file; it imports the tokens. |
| `tokens/colors.css` | Chrome, grounds, identity vs action, text, status, age |
| `tokens/typography.css` | System stack, monospace numbers, the size scale |
| `tokens/spacing.css` | Spacing, radii, row/column geometry, touch targets |
| `tokens/elevation.css` | The three shadows |
| `DESIGN.md` | The same system in nine-section `DESIGN.md` form, for agents |
| `guidelines/` | Foundation specimen cards |
| `components/core/` | Button, IconButton, SegmentedControl, Tag, StatusPill |
| `components/arsskodun/` | YearCells, InspectionRow, DriverCard, WorkInProgress |
| `ui_kits/arsskodun-simi/` | Ársskoðun on the phone — table view and driver view |
| `ui_kits/thjonustubord/` | The service desk, recoloured onto this system |
| `SKILL.md` | Portable skill file for Claude Code |

### Intentional additions

- `YearCells` and `InspectionRow` are lifted straight from `153-arsskodun.js`;
  they are the app's own primitives, not additions.
- `WorkInProgress` formalises the "Í vinnslu — óklárað" block that the live app
  renders ad hoc, so the sync action has one home.
