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
Rates are **per worksite** — confirmed examples so far:
| Worksite | Dagvinna | Eftirvinna |
|---|---|---|
| Default | 9.951 kr | 14.927 kr |
| Fjarðagata | 10.300 kr | 15.450 kr |
| Fjallaböðin Þjórsárdal | 9.300 kr | 13.950 kr |

These come from per-worksite "Efnislisti" xlsx templates (the
invoice prep sheet for that worksite). The `pricing_guide` table
needs to support per-worksite overrides for both rates **and**
which line items apply — some worksites use a slightly different
setup (different rates, which extras get added, fixed-price
overrides, custom material prices). Treat the price guide as
per-worksite full template, not a single global rate card.

### Standard line items applied to most worksites
- **Akstur**: 186 kr/km, 4.000 kr/ferð.
- **Smáhlutagjald**: 137 kr × Dagvinna hours (auto-applied).
- **Staðfesting brunaþéttinga**: 20.000 kr (flat, when applicable).
- **VSK**: 24% added on top of Samtals án vsk.

### Per-worksite invoice prep documents ("Efnislisti")
Each Tímavera-based worksite has a per-month **Efnislisti** xlsx
that is the invoice calc sheet. Format (confirmed from
Fjallaböðin Þjórsárdal Mars 2026 example):

- Header: `Brunahólf ehf. / Verðskrá / tilboð / <date range> / <worksite>`
- Sections: Dagvinna (rate × magn = samtals), Eftirvinna,
  Akstur (km + ferð), Efni (all materials in Verðskrá with
  blank magn for that month), Samtals án vsk + vsk + samtals
  með vsk.
- The xlsx is paired with a PDF print of the same content.
- The bottom total (samtals með vsk) is what gets entered into
  the Tekjur sheet for that worksite/month cell, and what gets
  invoiced via Payday.

The Tímavera xlsx export for that worksite/month is the source
for the hours that fill in Dagvinna magn + Eftirvinna magn.

The Reikningagerð tab should be able to **generate this
Efnislisti automatically** from Tímavera hours + material entries
+ per-worksite rates.

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
NOT from Tímavera. Each has its OWN contract rates table.

The three:
- **Heklureitur** — customer **FR laug**
- **Landsspítalinn (NLSH)** — customer **ÞG-verk**
- **Dalvegur 30** — customer **Eykt**

#### NLSH (Landsspítalinn 5-6 hæð) — contract rates
Cumulative monthly tracker (one PDF/xlsx, columns added each month).
Each work item has a target Fjöldi (budgeted count) and a
contract unit price per "heild" (1 heild = 2 stakar). For each month:
- Count `ajour_registrations` matching the worksite + work item type
- `stakar` = count
- `heilar` = `stakar / 2`
- amount m vsk = `heilar × unit_price_m_vsk`

Confirmed NLSH unit prices (m vsk) — these are CONTRACT rates,
not the general Verðskrá:
| Verk nr | Verkliður | Target | Verð/heild |
|---|---|---:|---:|
| 2.1 | Ø20-34 plaströr | 600 | 7.166 |
| 2.2 | (35-50) plaströr m eldv. kraga | 600 | 19.532 |
| 2.3 | Ø75-100 plaströr | 100 | 23.720 |
| 2.4 | Ø15-35 stálror | 800 | 7.166 |
| 2.5 | Ø40-50 stálrör | 1100 | 7.366 |
| 2.6 | Ø75-110 stálrör | 350 | 7.566 |
| 2.7 | Ø110-160 stálror | 100 | 8.066 |
| 2.8 | Ø125-160 loftstokkar | 600 | 11.532 |
| 2.9 | Ø200-315 loftstokkar | 600 | 23.064 |
| 2.10 | Ø400-630 loftstokkar | 109 | 46.128 |
| 2.11 | Frágangur raufa m kontuðum stokkum (metrum) | 102 | 11.532 |
| 1.1 | Ø100-150 Golf/Hæðarskil | 50 | 38.806 |
| 1.2 | Ø160-200 Golf/Hæðarskil | 100 | 56.224 |
| 1.3 | Ø210-300 Golf/Hæðarskil | 25 | 65.116 |
| 3.1 | Rafmagnsraufar | 768 | 9.766 |

Header used on the PDF: "Nýji Landsspítalinn Hringbraut /
Landsspítalinn 5-6 hæð / Brunahólf ehf / <date>". Title:
"Samtals kláraðir verkþættir per mánuð". Sample April 2026
totals: April m vsk = 4.956.679 / án vsk = 3.997.322;
cumulative Heild m vsk = 56.360.118.

#### Heklureitur, Dalvegur 30
Same Ajour pattern but each has its own contract rates table
(not yet captured — need example documents). The earlier
generic per-hole-size Verðskrá (2.900 → 100.500 kr by 50mm
buckets) was from a different sheet and is NOT used directly
for these three — they bill on their own contract rates.

### Fixed price (occasional)
Some worksites — or some portions of work — are billed at an
**agreed fixed price** instead of hours × rate. The price guide
needs to support this: per worksite (or per work item) you can
either use the calculated total or override with a flat amount.

### Invoice + payment sources (for rei / Greitt detection)
- **Payday** — most invoices are created and sent from here. Payday
  also marks most paid invoices. → syncs into `invoices` table
  (`status`, `greidsla_date`).
- **Landsbankinn krafnir** — krafa-only flow. → also syncs into
  `invoices` table.
- **Landsbankinn bank ledger** — some customers pay straight to the
  bank, bypassing Payday. User exports CSV from Landsbankinn
  regularly → imported into `bank_transactions` (currently 840 rows).
  The `worksites.js` function already cross-references by
  `kt_counterparty` + fuzzy text match on customer name to detect
  bank-paid invoices that aren't marked paid in Payday.
- Therefore in the Reikningagerð grid:
  - `rei` = exists in `invoices` for this (worksite, month)
  - `Greitt` = invoice `status` is paid OR matching bank inflow found
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
