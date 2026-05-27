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

## Invoicing model

### Source of truth: the Tekjur sheet
The master dashboard today is the **Tekjur** Google Sheet
(`1cv3Q3UFXMR0D3KrdCZFYkhfVxnkvfzFYdRbxztH_NW8`). The hub's
Reikningagerð tab is being built to replace it. The sheet contains:

1. **Main grid** (the screenshot view): rows = worksites, columns =
   months (Skuldir, Nov, Des, Jan, Feb, Mar, Apr…). Per month each
   row has two checkboxes — `rei` (reikningur sendur) and `Greitt`
   (greitt) — plus the amount in kr (m. vsk). Column A holds a
   Google Drive folder link per worksite.
2. **Tímatekjur summary** — Tímavera hours summed per worksite per
   month, separated into Dagvinna / Eftirvinna.
3. **Per-worksite invoice calc sheets** with the full breakdown
   (Dagvinna × rate + Eftirvinna × rate + Akstur + Materials +
   Smáhlutagjald + Staðfesting → Samtals án vsk → +24% vsk → m vsk).
4. **Verðskrá** (price list) — material unit prices and hourly rates.
5. **NLSH Verðskrá** — per-hole-size schedule (separate model).
6. **Materials register** — expenses by worksite by month.

### Hourly rates (Dagvinna / Eftirvinna)
| Worksite type | Dagvinna | Eftirvinna |
|---|---|---|
| Default | 9.951 kr | 14.927 kr |
| Fjarðagata | 10.300 kr | 15.450 kr |

(Confirm any other per-worksite override before invoicing.)

### Standard line items applied to most worksites
- **Akstur**: 186 kr/km, 4.000 kr/ferð.
- **Smáhlutagjald**: 137 kr × Dagvinna hours (auto-applied).
- **Staðfesting brunaþéttinga**: 20.000 kr (flat, when applicable).
- **VSK**: 24% added on top of Samtals án vsk.

### Materials source (Tímavera-based jobs only)
For Tímavera-based worksites, material costs that get **re-charged
to the customer** come from:
- **Redder** (vendor) invoices
- PDF receipts/bills in the **`bokhald@brunaholf.is`** Gmail mailbox

These are recorded against a worksite (see the "Materials register"
in the Tekjur sheet — `dags / nr / Verkstaður / Upphæð / Lýsing`)
and added to the invoice line items at the unit rate from the
Verðskrá below.

**Important**: this materials flow does NOT apply to Gata verkefni
(Ajour-based) — those bill purely on the per-hole-size rate.

### Materials price list (selected — full list in Tekjur Verðskrá)
- Eldvarnar akríl: 1.235–1.624 kr/stk
- Eldvarnar þéttull / háþennslukítti: 4.489 kr/stk
- Eldvarnar Akríl 5kg: 14.400 kr/stk
- Eldvaranr steinull: 10.703 kr/plata
- Eldvarnar málning: 2.500 kr/líter
- Eldvarnar band 55–200mm: 1.236–6.025 kr/stk (by size)
- Eldvarnar kragi 32–315mm: 2.821–151.754 kr/stk (by size)
- Brunaþéttirör 16–50mm: 6.426–9.012 kr/stk
- Brunaþéttirör PVC 32–50mm: 2.498–2.970 kr/stk

### Gata verkefni — Ajour-based (not Tímavera)
All three Gata verkefni source their billable work from
**ajoursoftware.com** (CSV imported into `ajour_registrations`),
NOT from Tímavera. They're billed by **count × per-hole-size rate**
from a Verðskrá table.

The three:
- **Heklureitur** — customer **FR laug**
- **Landsspítalinn (NLSH)** — customer **ÞG-verk**
- **Dalvegur 30** — customer **Eykt**

Verðskrá (per-hole-size rate, applies to all three):
- Hole sizes are 50mm-wide buckets: `000-031 mm`, `032-059 mm`,
  `060-109 mm`, … up through `1960-2009 mm`.
- Rates: 2.900 kr (smallest) → 100.500 kr (largest). Full table
  is in the NLSH tab of the Tekjur sheet.
- Categories tracked per registration: Golf/Hæðarskil, loftstokkar,
  plaströr, rafgöt, raf raufar, raflagnaþéttingar, stálrör.
- Counts come from `ajour_registrations` in Supabase. Match worksite
  via `project_aliases`.

### Fixed price (occasional)
Some worksites — or some portions of work — are billed at an
**agreed fixed price** instead of hours × rate. The price guide
needs to support this: per worksite (or per work item) you can
either use the calculated total or override with a flat amount.

### Invoice systems
- **Payday** — most invoices.
- **Landsbankinn krafnir** — krafa-only flow.
- Both end up in the `invoices` table after syncing.
- Older invoices for reference live in the brunaholf Google Drive
  (shared with `aggisigurds@gmail.com`).

### Status comments observed in Tekjur (examples — these are real
operational notes, not stale data):
- Grímsbær: "Skipingin er í flipunum að neðan"
- Höfðabakki 9B: "Eftir að senda reikninga fyrir öllu verkinu"
- Lifland: "Engir reikningar. um 46 tímar eftir að rukka. verkið Búið"

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
- **`hole_size_rates` table**: per-size buckets and kr rates for
  Gata verkefni (000-031mm → 1960-2009mm).
- **Payday API integration**: end goal is to push draft invoices into
  Payday. Currently it's just one-way sync in.
