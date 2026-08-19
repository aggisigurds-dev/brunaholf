---
name: screenshot-verify
description: >
  Take a real rendered screenshot of a page (or drive a form / verify a UI change)
  from a Claude Code web/remote session, where plain Playwright fails every time
  with net::ERR_CONNECTION_RESET. Uses tools/bh-browser.cjs, a local TLS-splitting
  relay that works around the egress proxy RST-ing Chromium's ECH-GREASE TLS
  extension. Use whenever a task needs a screenshot for the Verkefnalisti result
  image (result_image_b64), or to confirm a UI fix looks right before calling it done.
---

# Screenshot / browser-verify from a remote session

**A screenshot of the result is part of finishing a Verkefnalisti task** (Agnar
reviews from his phone). But in a Claude Code **web/remote** session a plain
`playwright` `chromium.launch()` + `page.goto('https://…')` fails every time with
`net::ERR_CONNECTION_RESET` — not locally, and not for curl/fetch, only for a real
Chromium. Root cause: Chromium sends an **ECH-GREASE** TLS extension on every
ClientHello and the session's egress proxy RSTs the connection when it sees it.

## Use the relay, not raw Playwright
`tools/bh-browser.cjs` runs a local TLS-splitting relay and hands you a normal
Playwright context:
```js
const { launch } = require('./tools/bh-browser.cjs');
const { context, cleanup } = await launch();
const page = await context.newPage();
await page.goto('https://brunaholf.netlify.app');
const buf = await page.screenshot({ fullPage: false });
require('fs').writeFileSync('/tmp/shot.png', buf);          // write BEFORE cleanup
await cleanup();
```
Run it with the global Playwright on the expected path:
```bash
NODE_PATH=/opt/node22/lib/node_modules node your-script.cjs
```

## Non-obvious gotchas (each cost real time once)
- **Name the script `.cjs`** (like `tools/bh-browser.cjs`). If the repo is an ES
  module, a plain `.js` loads through the ESM loader and `module.exports` silently
  no-ops (`launch is not a function`).
- **`NODE_PATH=/opt/node22/lib/node_modules`** — Playwright is installed globally in
  that environment, not as a repo dep. The file throws a clear error if it's missing.
- **Do NOT `playwright install`** — Chromium is pre-installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
- **Relay teardown can hang** — `writeFileSync` your screenshot/result to a file
  *before* `await cleanup()`, put `cleanup()` in a `finally`, and guard with a
  `setTimeout(() => process.exit(0), 1500)` so a hung relay can't wedge the run.
- **Wait for the app to be ready** before interacting — e.g.
  `await page.waitForFunction(() => window.DB && window.DB.sb)` (the hub's Supabase
  client) or a known DOM anchor; the big `index.html` hydrates asynchronously.

## Attaching to a Verkefnalisti task
When moving a task to `i_yfirferd`, pass the screenshot as base64 in the same call:
```
POST https://brunaholf.netlify.app/api/verkefnalisti
{ "action":"update", "id":<id>, "stada":"i_yfirferd",
  "result_image_b64":"<base64 png>", "claude_notes":"hvað var gert" }
```

## If this breaks again on a new Chromium
The relay targets a specific TLS-extension behavior. The full re-diagnosis writeup
(how to confirm it's still ECH-GREASE and how to adjust) is in the header comment of
`tools/bh-browser.cjs` — read that before assuming the whole approach is dead.
