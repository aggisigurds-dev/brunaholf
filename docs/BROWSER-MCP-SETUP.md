# Browser MCP — keeping all machines in sync

Goal: every new Claude Code / Cowork session on any of the 3 computers comes up
with the same browser-automation MCP servers **ready, no per-session clicking**,
so browser work (screenshots, verifying a UI fix, driving a form) just works.

## What is configured in git (syncs to every machine on `git pull`)

- **`.mcp.json`** declares the servers:
  | server | package | what it does |
  |---|---|---|
  | `playwright` | `@playwright/mcp` | launches its own Chrome, drives it |
  | `chrome-devtools` | `chrome-devtools-mcp` | drives a Chrome + DevTools (console, network, perf) |
  | `browsermcp` | `@browsermcp/mcp` | drives your **real, logged-in** desktop Chrome via a browser extension |
- **`.claude/settings.json`** sets `"enableAllProjectMcpServers": true`, which
  auto-approves the `.mcp.json` servers so they load every session **without a
  prompt**. (In `slokkvitaeki` this file is force-added past `.gitignore`'s
  `.claude/*` rule via a `!.claude/settings.json` exception.)

Both `brunaholf` and `slokkvitaeki` carry this. `brunaholf` already had the three
servers; `browsermcp` was added to `slokkvitaeki`.

## One-time per-machine steps (git can't do these for you)

Do this **once** on each of the 3 computers:

1. **Trust the folder.** Open the repo in Claude Code and accept the "trust the
   files in this folder?" prompt. ⚠️ Required: as of Claude Code ≥ 2.1.196,
   `enableAllProjectMcpServers` is **ignored in an untrusted folder** — the
   servers sit at `⏸ Pending` until you trust it. After trusting once, they
   auto-connect every future session.
2. **Verify:** `claude mcp list` → `playwright`, `chrome-devtools`, `browsermcp`
   should each say `✓ Connected`.
3. **For `browsermcp` only:** install the "Browser MCP" Chrome extension
   (https://browsermcp.io), then click **Connect** on the tab you want driven.
   `playwright` and `chrome-devtools` launch their own Chrome and need no
   extension.

Optional global fallback (makes them available in *every* repo on that machine,
not just these two):

```bash
claude mcp add playwright      --scope user -- npx -y @playwright/mcp@latest
claude mcp add chrome-devtools --scope user -- npx -y chrome-devtools-mcp@latest
claude mcp add browsermcp      --scope user -- npx -y @browsermcp/mcp@latest
```

## ⚠️ Desktop vs. cloud/mobile — this is the part that bites

Browser MCPs only reach real web pages from a **real desktop**. They do **not**
work from a Claude Code **cloud / web / mobile** session:

| | browser MCPs (playwright / chrome-devtools / browsermcp) | `tools/bh-browser.cjs` |
|---|---|---|
| **A desktop machine** (no proxy) | ✅ work for real | not needed |
| **Cloud / web / mobile session** | connect, but **can't load pages** — the egress proxy RSTs Chromium's ECH GREASE TLS extension (`net::ERR_CONNECTION_RESET`); `browsermcp` also has no local Chrome to attach to | ✅ the only thing that gets through |

So **opening a session from the Claude mobile app does not give you your
desktop's browser** — a mobile session runs in the cloud, same as any web
session, and hits the proxy wall above.

### Using a real browser "from your phone"

- **Recommended: remote-desktop into one of the 3 computers** (Chrome Remote
  Desktop / RustDesk / AnyDesk / Microsoft Remote Desktop / Jump Desktop), then
  use the **local** Claude Code session on that machine. That session has clean,
  real browser-MCP access — including `browsermcp` driving your logged-in Chrome.
- **Mobile cloud session** is still great for everything non-browser (code, git,
  Supabase / Gmail / Netlify MCP). For a screenshot from a cloud session, use
  `tools/bh-browser.cjs`, not the browser MCPs.
