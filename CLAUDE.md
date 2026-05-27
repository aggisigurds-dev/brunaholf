# Brunahólf hub — project guide for Claude

This file is read on every session. Read it first before exploring code.
It tells you what this app is, how it's wired, where the data lives, and
what we're building next so you don't restart from scratch.

If you change anything material (a new table, a new tab, a new
endpoint), update the relevant section here in the same commit.

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

- **Frontend**: `index.html` — single 4800-line file, vanilla JS, no
  framework. Tabs defined in `DEFAULT_STATE.tabs` around line 1052.
  Each tab id maps to a `render<Name>(t)` function further down.
- **Backend**: Netlify Functions in `netlify/functions/*.js`. CommonJS,
  no TypeScript. Each function is self-contained.
- **DB**: Supabase project `osfdzskyvisifcwyjkuk` (region eu-west-1).
  Connection via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars.
- **Auth**: Google OAuth (tokens in `google_oauth` table), used for
  Drive/Sheets/Gmail. See `netlify/functions/_google.js`.
- **Static site**: `public/tilbod/` is the standalone tilbod generator.

## Tabs (current)

Defined in `DEFAULT_STATE.tabs`. Render functions in `index.html`:

- `yfirlit` — front page / dashboard
- `okkarVerkefni` — Anni & Aggi shared todo (two columns)
- `inbox` — email digest (renderInbox)
- `spurningar` — question-email triage (renderSpurningar)
- `timavera` — hours dashboard (renderTimavera, ~line 1670)
- `verdsamanburdur` — Verðsamanburður / competitor pricing (renderCompetitors)
- `verkstadir` — worksite billing audit (renderWorksites, ~line 2175)
- `maeting`, `verkefnastada` — sheet-CSV-backed generic tabs
- `april` — Apríl reikningar punch list
- `todo`, `minverkefni` — todo lists
- `slokkvitaeki` — fire-extinguisher data
- `gogn`, `samthaetting` — config/integration checklist
- `kvittanir`, `tenglar`, `reikningar`, `utgjold`, `stillingar` — utility/link tabs

> The `reikningar` tab is currently a placeholder. The Reikningagerð
> (invoicing prep) work is being built on top of it — see Open work below.

## Data sources

### Tímavera — base calculus for invoicing
- `timavera_entries` (~3.7k rows): `date, hours, employee, project`.
  Pulled by an external scraper twice daily (09:00 / 17:00). `project`
  is a free-form string; rolled up via `project_aliases` for matching.
- `timavera_meta`: last_import timestamp + source file.
- Endpoint: `/api/timavera?year=YYYY&weeks=N&topProjects=M`.

### Worksites & invoicing
- `worksite_status`: manual billing status per (project, year) — one of
  `unreviewed | review | billing_in_progress | invoiced | not_billable`,
  plus notes / drive folder url / contract url / invoice amount+date.
- `invoices` (~249 rows): Payday + Landsbankinn krafnir.
  Cols: `customer_name, kt_greidanda, hofudstoll, gjalddagi, status,
  greidsla_date, tilvisun, worksite_match, ...`. Joined to worksites
  via `customer_worksite_map` + `worksite_match`.
- `bank_transactions` (~840 rows): Landsbankinn ledger, used to detect
  payments made via bank that haven't been reflected in Payday.
- `customer_worksite_map`: contractor ↔ worksite links + `retention_pct`.
- `customer_info`: payment behaviour per contractor (payment method,
  terms, notes).
- `project_aliases`: maps Tímavera/Ajour/invoice name variants to a
  canonical worksite name (e.g. `NLSH 5-6. hæð` → `Landsspítalinn`).
- Endpoint: `/api/worksites?year=YYYY|combined`. Aggregates hours,
  emails, ajour counts, invoices, retention, bank cross-ref.

### Ajour
- `ajour_registrations` (~15k rows): fire-stop registrations from Ajour
  CSV exports. Counted per worksite to validate billable scope.

### Verðsamanburður (competitor / market pricing)
- `competitor_prices`, `competitor_meta`, `service_competitors`,
  `service_prices`, `suppliers`. Endpoint: `/api/competitors`.
- This is market data, NOT our own pricing for jobs.

### Google integration
- `google_oauth`: OAuth tokens (1 row).
- `app_kv`: generic key/value store.
- Helpers: `_google.js`, `drive-folders.js`, `drive-download.js`,
  `gmail-search.js`, `sheet-create.js`.

### Email
- `email_digest` (~29k rows): all emails from connected Gmail accounts
  (`Brunaholf@brunaholf.is`, `aggisigurds@gmail.com` etc.). Used for
  Inbox + Spurningar tabs and worksite email-mention matching.
- `email_actions`: per-email triage state (status/priority/notes) for
  Spurningar.

## Invoicing model (current understanding)

- **Base calculus**: Tímavera hours × hourly rate from price guide.
- **Most worksites** bill from Tímavera entries → price guide rate.
- **Three exceptions** bill from other sources instead of Tímavera:
  1. **NLSH** (Landsspítalinn — fire-stop): billed from **Ajour CSV
     overview** (jobs done). Data already in `ajour_registrations`
     table — count registrations × rate.
  2. **Dalvegur 30**: billed from a **Google Sheet** (manual entry by
     site).
  3. **Heklureiturinn**: billed from a **Google Sheet** (manual entry
     by site).
- **Older invoices** for reference live in the brunaholf Google Drive
  (shared with `aggisigurds@gmail.com`).
- **Invoice systems used**: Payday (most invoices) and Landsbankinn
  krafnir (krafa-only flow). Both end up in the `invoices` table after
  syncing.

## Conventions

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
- **Icelandic worksite names**: case + diacritics are inconsistent
  across Tímavera / Ajour / invoices. Use `project_aliases` for any
  cross-source matching.
- **Co-authored commits**: include the Co-Authored-By line for Claude.

## Security note

19 tables currently have RLS disabled (see Supabase advisory). This
means the anon key can read/write them. Not auto-fixing because
enabling RLS without policies would lock the app out. Tackle as a
dedicated task with policies designed per-table.

## Open work

- **Reikningagerð (invoicing prep) tab**: replace the placeholder
  `reikningar` tab with a real consolidated view —
  - **Verðlisti** (price guide per worksite / per job type)
  - **Til að senda** (pending billable work: Tímavera hours since
    last invoice × rate; manual rows for the 3 sheet-based projects)
  - **Sent nýlega** (recent invoices from `invoices` table)
  - Refresh + manual data entry
- **`pricing_guide` table**: needs schema — per worksite or per
  (worksite, work_type), with `rate_isk_per_hour`, optional
  `flat_amount`, `effective_from`, notes.
- **Source pointers per special worksite** need to be captured (in
  the price guide row or `app_kv`):
  - NLSH → Ajour project filter / canonical name in `ajour_registrations`
  - Dalvegur 30 → Google Sheet ID + tab + columns
  - Heklureiturinn → Google Sheet ID + tab + columns
- **Payday API integration**: end goal is to push draft invoices into
  Payday. Currently it's just one-way sync in.
