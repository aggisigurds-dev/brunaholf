# Vendored: designer-skills (design-flow et al.)

The following skills are vendored from **Julian Oczkowski's `designer-skills`**:

- `grill-me`, `design-brief`, `information-architecture`, `design-tokens`,
  `brief-to-tasks`, `frontend-design`, `design-review`, `design-flow`

- Source: https://github.com/julianoczkowski/designer-skills
- License: **Apache-2.0** (see `DESIGNER-SKILLS-LICENSE-Apache-2.0.txt`)
- Author: Julian Oczkowski

These are copied verbatim. Our design agent **Joker** (`.claude/agents/joker.md`)
orchestrates them; because our apps are vanilla HTML/CSS/JS (no framework, no
build step), Joker treats the `design-tokens` phase as CSS custom properties on
top of the existing `theme.css` (not Tailwind) and `frontend-design` as vanilla
markup/patches — the methodology, not the literal toolchain.
