---
name: deploy
description: >
  How to ship a change to brunaholf.netlify.app — there is NO build step, so you
  edit index.html and netlify/functions/*.js directly and push; Netlify's Git
  integration serves the repo root (publish="."), and PR deploy-previews mirror
  production. Covers the publish="." exposure gotcha and its redirect guards, how
  /api/* maps to functions, where secrets live, the huge-index.html rule, and how
  to revert. Use whenever committing/pushing/deploying the Brunahólf hub.
---

# Deploy — Brunahólf hub

The hub has **no build step**. The site *is* the repo: `publish = "."` in
`netlify.toml`. You edit the source directly and push.

## The flow
```bash
# edit index.html and/or netlify/functions/*.js directly
git push origin <branch>     # Netlify builds a deploy-preview for the PR
# merge to main              # → production at brunaholf.netlify.app
```
PR deploy-previews are the real thing — trust them.

## Functions & /api
- Serverless functions live in `netlify/functions/*.js`, **CommonJS**, self-contained:
  `exports.handler = async (event) => { … }`. Model of record: any existing sibling
  (`verkefnalisti.js`, `customer.js`, `pricing-guide.js`).
- `/api/*` resolves to `netlify/functions/*` (a catch-all rewrite, plus a few
  explicit `[[redirects]]` for renamed endpoints). Name a new function and `/api/<name>`
  just works.
- Env/secrets live in **Netlify env vars** (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  PAYDAY_*, RESEND_API_KEY, Google OAuth…). **Never commit secrets.**

## ⚠️ publish="." serves EVERYTHING in the repo
Because the whole repo is published, `.md` files, images and anything else are
publicly fetchable. Lock-downs are **redirect rules that must stay FIRST** in
`netlify.toml` — don't reorder them below other rules, or the guard stops applying.

## The big file
`index.html` is ~1.29 MB (~323k tokens). **Never read it whole** — `grep` first,
then `offset`/`limit`. Same for `graphify-out/graph.json`.

## Verify a deploy
- **Function/logic**: hit the `/api/*` route directly (curl through the proxy works).
- **UI in an iframe/app-page**: pages are loaded with `?v=<Date.now()>`; a page that
  shows a version stamp is the quickest way to tell whether the browser is on the new
  build. For onscreen confirmation use the **screenshot-verify** skill.

## Revert
Restore a previous Netlify deploy by its deploy id (Netlify UI or API), then fix
forward on `main` — a restore is a stopgap, not a commit.

## Convention
If you add a table, a tab, or an endpoint, update the matching section of
`CLAUDE.md` in the **same commit** — one fact, one place.
