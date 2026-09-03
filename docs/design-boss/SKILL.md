---
name: boss-design
description: Use this skill to build interfaces for Slökkvitæki ehf. / Brunahólf in the Boss finish — black steel chrome, cream paper surfaces, gold metal accents, Playfair titles, Plex Mono labels — for production or prototypes. Contains tokens, the four gold recipes, elevation objects, component classes and the reference Þjónustuborð screen.
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
