# Brunahólf hub — project guide for Claude

This file is read on every session. Read it first before exploring code.
For customer/data questions, **`docs/STADREYNDIR.md`** is the verified fact
ledger (sannreyndar grunnstaðreyndir) — it overrides stale numbers here.
**Í upphafi vinnu-session:** líta á opin verk á Verkefnalistanum —
`GET /api/verkefnalisti` (beidni/i_vinnu) — áður en nýtt verk er hafið
(Agnar 2026-07-30).
It tells you what this app is, how it's wired, where the data lives, and
what we're building next so you don't restart from scratch.

If you change anything material (a new table, a new tab, a new
endpoint), update the owning expert in `.claude/agents/` — or the
relevant section here if it's core — in the same commit.

---

## What this app is

`brunaholf.netlify.app` is the operations hub for **Brunahólf ehf**
(passive fire protection — brunavarnir í sameign). Single static HTML
page (`index.html`) with a tab-driven UI, backed by Netlify serverless
functions and a Supabase Postgres database. There is no build step —
edit `index.html` directly.

The hub consolidates: email triage, Tímavera (hour tracking),
worksite billing audit, competitor pricing, fire-stop registration
data from Ajour, Google Drive/Sheets/Gmail integration, and a tilbod
(quote/offer) generator.

## Stack

- **Frontend**: `index.html` — single ~17.700-line / 1,1 MB file, vanilla JS, no
  framework. Tabs defined in `DEFAULT_STATE.tabs` around line 1052.
  Each tab id maps to a `render<Name>(t)` function further down.
- **Viewmode-rofi (`js/viewmode.js`, 2026-07-07):** fljótandi 📱 Sími · 📲
  Spjaldtölva · 🖥 Tölva rofi (neðst til vinstri í Tölvu-ham). „Sími"/„Spjaldtölva"
  birta appið í miðjuðum **device-ramma (iframe í 390/834px)** svo ALLAR `@media`-reglur
  svara eins og á alvöru tæki (ekki bara það sem er sér-stílað). Val geymt í
  `localStorage.bh_viewmode`; iframe-eintakið keyrir `?bhframe=1` og römmun sig ekki
  aftur. Sjálf-innihaldið, einn `<script src>` (eins og `hub-sync-buttons.js`).
- **Backend**: Netlify Functions in `netlify/functions/*.js`. CommonJS,
  no TypeScript. Each function is self-contained.
- **DB**: Supabase project `osfdzskyvisifcwyjkuk` (region eu-west-1).
  Connection via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars.
- **Auth**: Google OAuth (tokens in `google_oauth` table), used for
  Drive/Sheets/Gmail. See `netlify/functions/_google.js`.
- **Static site**: `public/tilbod/` is the standalone tilbod generator.


---

## 🧭 HVER KANN HVAÐ — byrjaðu hér

Þekkingin sem áður var í þessu skjali (31.000 tokens sem hlóðust í **hverri einustu
lotu**) býr núna hjá sérfræðingum í `.claude/agents/`. **Ekkert var fjarlægt** — aðeins
fært, orðrétt. Hver þeirra hleðst AÐEINS þegar hann er kallaður til.

| Spurningin snýst um … | → Sérfræðingur | Rödd |
|---|---|---|
| Viðskiptavini, kennitölur, rekstrarfélög, `customers_base`, customer.html | `kunnaskra` | ❄️ Charlize Theron |
| Verðútreikninga, taxta, VSK, afslætti, NLSH, gata-uppgjör, dkPlus, pricing_guide, Efnislisti-yfirferð 👔 | `bokari` | 💫 Samantha |
| Skýrslu↔reikningur pör (document_pairs), þekju, gloppur, skjalatengingu | `sara-organizer` | 🗂️ Margot Robbie |
| Skjöl, Drive, PDF-lestur, endurnefningu, Skýrslu-stöð, multitool, Eyðublöð, Skráalisti | `skjol` | 🎙️ Morgan Freeman |
| Tímavera, Ajour, Payday, Redder/Efniskostnaður, email-innsog, luna-bridge, sjálfvirkni | `gagnaleidslur` | 🥊 Jason Statham |
| Flipa, viðmót, hvar eitthvað í `index.html` býr, CG/Skýrslur, Fjármála-yfirlit | `framendi` | 🗂️ Margot Robbie |
| Útlit, farsíma-fínstillingu (mobile view), endurhönnun flipa/skjáa, hönnun | `joker` | 🃏 Heath Ledger |
| Hvað er bilað — Supabase vs Netlify vs Claude vs appið | `kerfisheilsa` | 🩺 *(rödd í endurskoðun)* |
| Hraða, hleðslutíma, þung köll, polling — **vélarýmið** | `hradi` | 💥 Bruce Willis |
| Að ALLAR tengingar/lyklar séu í lagi á Kerfisheilsu | `tengingar` | 😤 Samuel L. Jackson |
| Dagleg yfirsýn + jarvis.html sjálf — svið, raddir, TTS, cache | `jarvis` | 🎩 Jarvis |
| RLS, policies, lyklar/tokens, public buckets — öryggið | `oryggi` | 🔒 *(rödd óvalin)* |
| Hype-yfirlitið — sigrarnir fyrst, svo það sem á að klára | `hype` | 🇺🇸 Trump |
| Staðreyndayfirferð — kerfið segir eitt, gögnin annað (factcheck_bord) | `natalie` | 🌸 Natalie |

**Notkun:** kallaðu á sérfræðinginn með Agent-tólinu (`subagent_type`), eða lestu skrána
hans beint þegar þú þarft bara þekkinguna. **Ekki afrita innihald þeirra hingað** — ein
staðreynd á að eiga sér einn stað, annars rekur hún í sundur.

⚠️ **Um stórar skrár:** `index.html` er 1,29 MB ≈ **323.000 tokens**. Lestu hana
ALDREI í heilu lagi — `grep` fyrst, svo `offset`/`limit`. Sama gildir um
`graphify-out/graph.json` (392k tokens).

## Conventions

- **ALLTAF LEYFA VISTUN** ("always allow save"): No save / „Vista" button in
  any form anywhere may block on validation, required fields, or unsigned
  signatures. Drafts must always persist. Required-state checks belong on the
  REVIEW side (Aggi sees „Vantar undirskrift" badge), never as a hard stop on
  save. Applies to `/skoda.html`, all Slökkvitæki templates, Verkefnalisti
  beidnir, customer-detail editing — every form.
- **Language**: UI text in Icelandic. Keep new labels in Icelandic
  unless the field is intrinsically English (e.g. column names).
- **Money**: ISK, no decimals. Format with `Math.round` + locale.
- **Dates**: ISO `YYYY-MM-DD` for storage; `dd.mm.yyyy` for display
  when shown to user.
- **No build step**: edit `index.html` and Netlify functions directly.
- **Tab pattern**: add to `DEFAULT_STATE.tabs`, add `renderXxx(t)`
  function, hook it into the dispatcher around `renderTab(t)`
  (~line 1359).
- **Endpoint pattern**: GET returns JSON, POST writes; always include
  CORS, always paginate Supabase reads via `Range` header.
- **Icelandic worksite names**: case + diacritics + naming are
  inconsistent across Tímavera / Ajour / invoices / file names.
  Same physical worksite can be called many things by accident —
  e.g. Fjarðagata also appears as `Fjörður` / `Fjörðurinn` /
  `Strandgata` / `Fjarðargata`. Always use `project_aliases` for
  any cross-source matching, and add new aliases when you spot
  them rather than hard-coding string lists.
- **Co-authored commits**: include the Co-Authored-By line for Claude.

## Security note

19 tables currently have RLS disabled (see Supabase advisory). This
means the anon key can read/write them. Not auto-fixing because
enabling RLS without policies would lock the app out. Tackle as a
dedicated task with policies designed per-table.


## Verkefnalisti (Claude task board) — vinnureglur

`verkefnalisti.html` + `/api/verkefnalisti` (tafla `verkefnalisti`, myndir í
public `verkefnalisti` bucket). Staðir: beidni → i_vinnu → i_yfirferd (Agnar
samþykkir) → klarad. GET skilar öllu; POST `{action:'update', id, …}`.

**Standing instructions fyrir Claude/agenta sem vinna verkefni af listanum:**
- **Skjáskot af niðurstöðunni er hluti af verklokum.** Þegar verk fer í
  `i_yfirferd` skal fylgja skjámynd af breytingunni (Playwright-skot af
  síðunni eftir breytingu) gegnum `result_image_b64` í sama update-kalli —
  Agnar yfirfer af símanum og á að geta séð útkomuna án þess að opna appið.
  **Í Claude Code web/remote session:** plain `playwright` `chromium.launch()`
  brotnar þar (`net::ERR_CONNECTION_RESET`) — egress-proxy þess umhverfis RSTar
  Chromium's ECH GREASE TLS-viðbót. Notaðu `tools/bh-browser.cjs`
  (`require('./tools/bh-browser.cjs').launch()`, keyrt með
  `NODE_PATH=/opt/node22/lib/node_modules`) í staðinn — sjá haus-athugasemdina
  í þeirri skrá fyrir fulla greiningu og hvernig á að endurgreina ef þetta
  brotnar aftur á nýrri Chromium-útgáfu.
- **Lesa `feedback` þegar verk kemur aftur í vinnu.** „↶ Aftur í vinnu" úr
  yfirferð opnar athugasemdabox hjá Agnari; textinn bætist tímastimplaður í
  `feedback`-dálkinn (birtist sem 📣 á síðunni). Nýjasta línan segir hverju á
  að breyta — taktu hana fram yfir upprunalegu lýsinguna ef þær stangast á.
- Margar beiðni-skjámyndir: `request_image_urls` (jsonb fylki) er aðal-sniðið;
  `request_image_url` er alltaf fyrsta myndin (eldri lesarar). `add` tekur
  `request_images_b64` fylki; `update` tekur `add_request_images_b64` (viðbót)
  og `request_image_urls` (fjarlæging). `claude_notes` er svar-texti Claude.


## Open work

- **Innskráning + notenda-aðgangsstýring (síðar — beðið um 2026-07-07):** virkja
  innskráningarsíðu fyrir hubbið. Sameiginlegt lykilorð fyrir alla `@brunaholf.is`
  notendur. Teymi: **Annþór, Agnar, Andri, Hákon, Elías** (nöfnin þegar notuð í
  „👤 Ég" veljaranum á Kröfu yfirlit). **Agnar = admin** og fær nýja stjórnborðs-síðu
  þar sem hann velur **hvaða síður/flipa hver notandi sér** (per-user page
  permissions — sbr. `sidebar_hidden`/`sidebar_order` mynstrið sem er þegar til).
  Vinnuflæði-rekjanleiki (hver staðfesti/sendi/kláraði) er þegar kominn í
  `krofur_yfirlit_meta` (`confirmed_by/sent_by/done_by`), svo auðkennið er til staðar.
- **Reikningagerð (invoicing prep) tab**: replace the placeholder
  `reikningar` tab with a real consolidated view —
  - **Verðlisti** (price guide per worksite / per job type)
  - **Til að senda** (pending billable work: Tímavera hours since
    last invoice × rate for Tímavera-based worksites;
    Ajour-count × per-hole-size rate for Gata verkefni)
  - **Sent nýlega** (recent invoices from `invoices` table)
  - Refresh + manual data entry
- **`pricing_guide` table**: needs schema — per worksite (and
  optionally per work_type), with `dagvinna_rate`, `eftirvinna_rate`,
  `fixed_amount` (override), `source` enum (`timavera` | `ajour` |
  `fixed`), `effective_from`, notes.
- **`material_prices` table** (or `app_kv` entry): unit prices for
  akríl / þéttull / kragar by size / band by size / brunaþéttirör /
  steinull / smáhlutagjald rate / akstur rates. Currently lives in
  the Tekjur sheet Verðskrá tab.
- ~~**`hole_size_rates` table**: per-size buckets and kr rates for
  Gata verkefni (000-031mm → 1960-2009mm).~~ ✓ Done — table created
  and seeded with hole + kragi + bordi rates. `/api/gata-uppgjor`
  computes per-month totals for Dalvegur 30 / Heklureitur from Ajour.
  Still needed: surface in Reikningagerð grid and UI for Bönd/Kragar
  manual override per month.
- **Payday API integration**: end goal is to push draft invoices into
  Payday. Currently it's just one-way sync in.

  **Inn-átt (read) — payday-pull.js (2026-06-29):** `/api/payday-pull` —
  OAuth2 `client_credentials` against `api.payday.is`, paginated invoice list,
  upsert into `invoices` with `(tilvisun, source='payday')` (same key the
  xlsx-from-Drive path uses — they're interchangeable, no dupes). Env vars:
  `PAYDAY_CLIENT_ID`, `PAYDAY_CLIENT_SECRET` (set in Netlify, **never
  committed**). Optional overrides: `PAYDAY_API_BASE` (default
  `https://api.payday.is`), `PAYDAY_TOKEN_PATH` (`/api/v1/oauth/token`),
  `PAYDAY_INVOICES_PATH` (`/api/v1/invoices`). Access-tokens are cached in
  `app_kv['payday_oauth']` until expiry. Modes: `?probe=1` (auth only + raw
  page 1, **no DB write** — run this first to confirm endpoint shape);
  `?dry=1` (fetch + map + return rows, no upsert); no flag = full upsert.
  Filters: `?since=YYYY-MM-DD&until=YYYY-MM-DD&pageSize=N`. Logs run status
  to `automation_runs(job_name='payday-pull')`. Field-mapping is intentionally
  forgiving (tries `number|invoiceNumber|reference|…`, `amount|subtotal|…`,
  `amountWithTax|total|…`, `dueDate|due_date|gjalddagi`, `paidAt|paid_at|…`)
  so it works without per-deploy tweaks; verify via probe before the first
  real run. Register a Sjálfvirkni-spjald with `POST /api/automations
  {action:'register', name:'payday-pull', label:'Payday — sækja reikninga',
  command:'/api/payday-pull', url:'/api/payday-pull?probe=1', schedule:'Daglega'}`.

## graphify

Þekkingargraf **aðeins uppsett á stóru vélinni** — `graphify`-skipunin er EKKI til á
öllum vélum. Ef `graphify-out/graph.json` er til OG skipunin svarar má nota
`graphify query "<spurning>"`. Annars: notaðu `grep`/`Glob` og sérfræðingana að ofan.

`graphify-out/` á að vera í `.gitignore` (eins og `.memsearch/`) — hún er sjálfgerð og
392.000 tokens að stærð.

## Cursor Cloud specific instructions

Brunahólf ehf (brunavarnir í sameign) is the parent. It bought Slökkvitæki ehf a few months ago. This repo is the hub / stjórnstöð (`brunaholf.netlify.app`) and a backend for the acquired app as well as Brunahólf’s own ops. Same Supabase `osfdzskyvisifcwyjkuk`. The owner mesh (kúnnar, rekstrarfélög, kennitölur, hver á hvað) is still being organized — not a clean parent/child tree, and this hub is not "just an API."

Cloud paths: this repo `/agent/repos/brunaholf`, sibling app `/agent/repos/slokkvitaeki`. Prefer a two-repo Cloud environment (brunaholf + slokkvitaeki). Do not treat the 8-repo dump, or slokkvitaeki-alone, as the long-term default.

Use a cross-repo window for shared DB, kúnnar, reikningar, Drive, póstur, Payday, Verkefnalisti, or öryggisnet. One-repo window only when the change is truly local to this hub.

Before merging customers, moving a kennitala, or assuming who owns a record: read Charlize (`v_charlize_active`, scope `kerfi`/`baedi`/`slokkvitaeki`) and `docs/STADREYNDIR.md`, then call `kunnaskra`. Never invent a parent/child company link.

**Verkefnalisti** still applies: `GET https://brunaholf.netlify.app/api/verkefnalisti` (beidni/i_vinnu) before starting new work.

**Screenshots / browser:** use Cursor Playwright MCP or computer use. `tools/bh-browser.cjs` is a Claude Code remote-egress workaround (see `docs/BROWSER-MCP-SETUP.md`). Do not use bh-browser unless Playwright fails.

Never read `index.html` or `graphify-out/` whole. Grep first, then Read with offset/limit.

No build step: edit `index.html` and Netlify functions directly. Always-allow-save (Vista never blocks on validation). UI text is Icelandic.

graphify hooks in `.claude/settings.json` will not exist on most Cloud VMs. Ignore them; do not install graphify here.
