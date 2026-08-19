---
name: verkefnalisti
description: >
  The Verkefnalisti task board workflow (Agnar's Claude task board) — how to pick
  up work at the start of a session, move a task through beidni → i_vinnu →
  i_yfirferd → klarad, attach the required result screenshot, and read the feedback
  column when a task bounces back from review. Use at the start of any work session
  to check open work, and whenever moving a task through the board.
---

# Verkefnalisti — Claude task board

Agnar queues work for Claude on a shared board. **Standing instruction (2026-07-30):
at the start of a work session, look at open work before starting anything new.**

- **Read the board:** `GET https://brunaholf.netlify.app/api/verkefnalisti` — returns
  everything; the ones that matter are `stada` in `beidni` (requested) and `i_vinnu`
  (in progress).
- **States:** `beidni` → `i_vinnu` → `i_yfirferd` (Agnar approves) → `klarad`.
- **Move a task:** `POST /api/verkefnalisti { action:'update', id, stada, … }`.
- **`claude_notes`** is Claude's reply text on the task.

## A screenshot of the result is part of finishing
When a task goes to `i_yfirferd`, include a screenshot of the change so Agnar can
review from his phone without opening the app — pass it as `result_image_b64` in the
**same** update call:
```
POST /api/verkefnalisti
{ "action":"update", "id":<id>, "stada":"i_yfirferd",
  "result_image_b64":"<base64 png>", "claude_notes":"hvað var gert" }
```
In a Claude Code web/remote session, take that screenshot with `tools/bh-browser.cjs`
(plain Playwright fails there) — see the **screenshot-verify** skill.

## Read `feedback` when a task comes back
"↶ Aftur í vinnu" from review opens a comment box for Agnar; the text is appended,
timestamped, to the `feedback` column (shows as 📣 on the page). **The newest line
says what to change — take it over the original description if they conflict.**

## Request images
- `request_image_urls` (jsonb array) is the primary field; `request_image_url` is
  always the first image (older readers).
- `add` takes `request_images_b64` (array); `update` takes `add_request_images_b64`
  (append) and `request_image_urls` (removal).

Board UI: `verkefnalisti.html`; table `verkefnalisti`; images in the public
`verkefnalisti` bucket.
