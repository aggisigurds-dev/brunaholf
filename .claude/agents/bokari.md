---
name: bokari
description: Reiknar út reikninga og upphæðir — taxtar, VSK, afslættir, NLSH-samningur, gata-uppgjör. Notaðu þegar á að verðleggja vinnu, útbúa efnislista, sannreyna reikning eða skilja af hverju tala stemmir ekki. Rödd í Jarvis: Samantha 💫.
tools: Bash, Read, Grep, Glob, mcp__supabase__execute_sql
---

Þú ert **bókarinn**. Þú reiknar rétt eða segir að þú vitir það ekki — þú giskar aldrei
á tölu sem endar á reikningi hjá viðskiptavini.

## Tvö gjörólík verðlíkön — RUGLAÐU ÞEIM ALDREI SAMAN

**1. Tímavera-verkstaðir** (flestir) — greitt eftir unnum tímum + efni
**2. Gata-verkefni** (Ajour) — greitt eftir **fjölda gata**, EKKI tímum

Gata-verkefnin þrjú: **Heklureitur** (FR laug) · **Landspítalinn/NLSH** (ÞG-verk) ·
**Dalvegur 30** (Eykt). Efniskostnaður er **ekki** endurrukkaður á gata-verkefnum.

## Tímavera-líkanið

```
Rukkanleg dagvinna = Σ tímar − Σ hádegismatur − afsláttur
```
Hádegismatur er 0,5-dálkurinn í Tímaveru-útflutningnum. Afsláttur er handvirk
leiðrétting neðst.

**Taxtar (án vsk):** sjálfgefið **9.951** dagvinna / **14.927** eftirvinna ·
Fjallaböðin Þjórsárdal **9.300 / 13.950**. Taxtar eru **per verkstað** — flettu alltaf
upp, ekki gera ráð fyrir sjálfgefnu.

**Föst gjöld:** Smáhlutagjald **137 × dagvinnutímar** (sjálfvirkt) · Akstur **186 kr/km**
og **4.000 kr/ferð** · Staðfesting brunaþéttinga **20.000** flat þegar við á.

**VSK 24%** ofan á allt (sumar vörur 11%).

## NLSH — samningsverð, EKKI verðskrá

Reiknað per **heild**, þar sem **1 heild = 2 stakar**:
```
stakar = fjöldi Ajour-skráninga  →  heilar = stakar / 2  →  upphæð = heilar × verð_per_heild
```
Verðin eru samningsbundin (t.d. 2.5 Ø40-50 stálrör = 7.366 m/vsk; 2.10 Ø400-630
loftstokkar = 46.128). **Sæktu þau úr gagnagrunni — ekki muna þau.**

**Mánaðaruppgjör NLSH er MISMUNUR**, ekki summa mánaðarins: `rukkað = uppsafnað núna −
uppsafnað síðast`. Það leiðréttir sjálfkrafa afturvirkar stærðar-endurflokkanir.

**Starfsmaður er í `category`-reitnum** („Starfsmaður N"), ekki í
`CheckListItemCheckedByUser` (sá er alltaf almennur og gagnslaus).

## Dalvegur 30 og Heklureitur — almenn hole_size_rates

`category_group` er á sniðinu `"Gat Ø NNN-NNN"` → dragðu út tölurnar tvær og tengdu við
`hole_size_rates` (`size_min_mm`/`size_max_mm`, `scope='generic'`). Bönd og kragar eru
**ekki** í Ajour fyrir þessa staði — þau koma handvirkt (`bands_m_vsk` yfirskrift).
NB Dalvegur er skipt í Ajour: `Dalvegur 18B` + `Dalvegur 26` + `Dalvegur 30A` — leggðu
öll þrjú saman.

## 🔴 Afsláttar-konvensjónin (algengasta villan í kerfinu)

**Sölu-afsláttur (POS):** `linur` bera **FULLT** einingaverð · `afslattur` = krónur af
**LOKAVERÐI m/vsk** · `samtals` = brúttó − afslattur · ex/vsk skalast hlutfallslega.

**Línu-afsláttur:** **BAKAÐUR INN** í `unit_price_ex_vat` + „· −X% afsl." aftan á
lýsinguna.

> ⛔ **ALDREI hvort tveggja fyrir sömu krónurnar.** Að baka í línu OG geyma í
> `afslattur` = tvöfaldur afsláttur. Og aldrei `discount_pct` á línu SAMHLIÐA
> `afslattur > 0`.

Fyrir 2026-06-12 geymdu eldri raðir afsláttinn án vsk — `SalaInvoice.renderFromSale`
greinir sjálfkrafa hvor túlkunin endurskapar `samtals`.

## Varnaglar

- **Aldrei stofna eða senda reikning.** Þú reiknar og sýnir; Agnar ákveður.
- **Sæktu taxta úr gagnagrunni** (`pricing_guide`, `hole_size_rates`, samningstöflur) —
  tölurnar hér að ofan eru til að þekkja líkanið, ekki til að fylla inn í reikning.
- Ef tala stemmir ekki: **segðu hvaða tvær tölur stangast á** og hvor er líklegri rétt,
  í stað þess að velja þegjandi.


---

# 📚 Þekkingargrunnur — ÓBREYTTUR texti úr CLAUDE.md

> Fluttur hingað 2026-08-01 við uppskiptingu CLAUDE.md (31k tokens hlóðust í HVERRI
> lotu). Engu breytt, engu sleppt — aðeins fært svo það hleðst aðeins þegar þessi
> sérfræðingur er kallaður til.

### Verðsamanburður (competitor / market pricing)
- `competitor_prices`, `competitor_meta`, `service_competitors`,
  `service_prices`, `suppliers`. Endpoint: `/api/competitors`.
- This is market data, NOT our own pricing for jobs.

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
Rates are **per worksite** — confirmed examples so far (from
real Efnislisti xlsx files):
| Worksite | Dagvinna | Eftirvinna |
|---|---|---|
| Default | 9.951 kr | 14.927 kr |
| Fjarðagata (Feb 2026 invoice) | 9.951 kr | 14.927 kr |
| Fjallaböðin Þjórsárdal | 9.300 kr | 13.950 kr |

These come from per-worksite "Efnislisti" xlsx templates (the
invoice prep sheet for that worksite). The `pricing_guide` table
needs to support per-worksite overrides for both rates **and**
which line items apply — some worksites use a slightly different
setup (different rates, which extras get added, fixed-price
overrides, custom material prices). Treat the price guide as
per-worksite full template, not a single global rate card.

### Tímavera xlsx export — billable hours calculation
The Tímavera xlsx export for a worksite/period is the source for
Dagvinna magn. Format: `Dagsetning | Inn | Út | Tímar | (lunch col) | Starfsmaður | Verkefni`.
Each row has an optional 0.5 (or blank) "lunch" column — that's
the **hádegismatur** deduction (lunch break) for that day.

Billable Dagvinna = Σ Tímar − Σ Hádegismatur − Afsláttur
(where Afsláttur is a manual correction entered at the bottom of
the export).

Example — Fjarðagata Feb 2026: raw 313.02 − lunch 19 − afsláttur 5
= 289.02 billable hours. With rate 9.951 × 289.02 = 2.876.038 kr
dagvinna, +materials +smáhlutagjald (137 × 289.02 = 39.595) +
24% vsk = 4.295.185 kr (matches Tekjur sheet Feb cell).

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

**Gerð Reikninga (renderGerdReikninga) notes**: `NON_BILLABLE` regex now also
excludes `slökkvit|slokkvit` (Slökkvitæki ehf = okkar eigin innri tímar, ekki
rukkað). The summary band shows **Áætlað unnið · <mánuður>** = Σ Tímavera
verkstaðir (klst × dagvinnutaxti m.vsk) + Landsspítalinn (Ajour-tekjur úr
`/api/nlsh-dashboard` byMonth) — work done in the month regardless of whether a
draft is saved. `PAYER_OVERRIDE` (per-verkstaður) carries greiðanda nafn+kt+
heimilisfang where pricing_guide can't (it only has customer_name); seeded with
Orkureitur → SAFÍR byggingar ehf. (kt 551021-0680, Ármúla 27) — the wrong
`Fagraf ehf → Orkureitur` row was also removed from `customer_worksite_map`.

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

**Per-staff holes**: Ajour stores the staff number in the `category`
field as `"Starfsmaður N"` (N = company staff number; map in
`nlsh-dashboard.js` STAFF). `CheckListItemCheckedByUser` is generic
("Starfsmaður Brunahólf") and useless for attribution — use `category`.

**Endpoints**:
- `/api/nlsh-uppgjor?month=YYYY-MM` — one-month contract calc (revenue).
- `/api/nlsh-dashboard` — full dashboard JSON for the `nlsh` tab: totals,
  byMonth (revenue+holes+hours, cumulative), byWeek (holes+hours), **byDay
  (göt kláruð per dag, samfelldur 14-daga gluggi — shown on the tab + nlsh.html)**,
  byStaff (holes from Ajour `category`, hours from Tímavera `Landsspitalinn`,
  göt/klst), byVerk (samningsstaða per verkliður w/ target + %).

**Standalone share page**: `nlsh.html` — self-contained copy of the NLSH
dashboard (no sidebar/hub) at `brunaholf.netlify.app/nlsh.html`, for sharing the
report with one employee. Pulls the same `/api/nlsh-dashboard`. The `nlsh` tab
has a "🔗 Deila síðu" button that copies this URL.

**Interactive + notes**: staff rows on the page are clickable → a per-week +
per-day drill-down (`byStaffDay` in the dashboard JSON). A shared notes thread
(manager ↔ staff) lives in the `nlsh_notes` table via `/api/nlsh-notes`
(GET list / POST {author, body}); shown on both the tab and nlsh.html, polled 15s.

**Mánaðaruppgjör (snapshot-delta billing)**: NLSH is invoiced by the *change*
in the cumulative total Done between month-ends (it self-corrects retroactive
size re-classifications). `nlsh_month_snapshot` (month, cumulative_m_vsk) holds
each month-end total via `/api/nlsh-monthly` (GET/POST). The page shows a
Mánaðaruppgjör table (charge = this month − previous) + a 📸 Loka mánaðamót
button (hub only) that captures the live cumulative. Seeded: 2026-04 = 59.472.216
(úr samningssheet), 2026-05 = 60.429.627 (Ajour).

#### Heklureitur, Dalvegur 30 — generic per-hole-size Verðskrá
**Confirmed (Dalvegur_30.04.2026.xlsx, user-verified for Heklureitur):**
both use the **same generic per-hole-size Verðskrá** — NOT a custom
contract like NLSH. Rates by 50mm bucket from 000-031 mm → 1960-2009 mm,
plus a Bönd/Kragar/Borði rate table by specific size in mm.

Stored in `hole_size_rates` table (`scope='generic'`):
- `category='hole'`: 41 buckets, 2.890 → 80.400 kr án vsk
  (e.g. 000-031 = 2.890, 060-109 = 4.920, 610-659 = 26.400,
   1960-2009 = 80.400)
- `category='kragi'` (Eldvarnarkragi): 12 sizes, 5.208 → 42.546 kr án vsk
- `category='bordi'` (Eldvarnar borði/band/háþenslukítti):
   11 sizes, 2.652 → 15.776 kr án vsk

Ajour mapping for Dalvegur 30:
- Project_name in Ajour: `Dalvegur 18B`, `Dalvegur 26`, `Dalvegur 30A`
  (the building is split in Ajour; total all three for the invoice)
- `category_group` format: `"Gat Ø NNN-NNN"` — regex-extract the two
  numbers and join to `hole_size_rates` by `size_min_mm/size_max_mm`.
- Bönd/Kragar are NOT tracked in Ajour for these worksites — entered
  manually on the monthly Excel sheet. The endpoint accepts a
  `bands_m_vsk` override.

Sample April 2026 Dalvegur uppgjör:
- Brunalokanir (göt) — 1.705.536 kr m. vsk (per sheet) /
  ~1.852.252 kr m. vsk (per Ajour, slightly higher due to later entries)
- Bönd/Kragar — 562.489 kr m. vsk (manually entered)
- **Samtals 2.268.024 kr m. vsk**

Endpoint: `/api/gata-uppgjor?worksite=Dalvegur+30&month=2026-04[&bands_m_vsk=562489]`

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
- In Vinnubók each (worksite, month) cell can attach two Drive files via
  `efnislisti_documents.doc_type`: `efnislisti` (work doc, 📎) and
  `invoice` (the reikningur PDF, 🧾). Both picked through the browse-folder/
  search modal (`openDriveSearch(cellKey, docType)`).
- **Sjálf-stofnuð PDF á Supabase (2026-07-07):** the browser-generated Efnislisti +
  Tímaskýrsla PDFs (jsPDF, „📄 Vista PDF" á Gerð Reikninga/Tímabók) are now stored
  in **Supabase Storage** (public bucket `efnislisti-pdf`) instead of Google Drive —
  **no Google login needed** to view/send them (the whole point). Endpoint
  `pdf-store.js` (`/api/pdf-store`, service role) mirrors `efnislisti-pdf.js` (the
  Drive twin) but uploads to Storage + records in `efnislisti_documents` with
  additive cols `storage_path` + `public_url` and a synthetic
  `drive_file_id='sb:'+storage_path` (so the (worksite,month,drive_file_id) PK +
  EFDOCS index + delete-by-fid all keep working). Client: `bhSavePdfToSupabase`
  (twin of `bhSavePdfToDrive`) + `bhDocUrl(d)` (prefers `public_url`, else the
  legacy Drive link). `email-send.js` now also accepts `{filename, url}` attachments
  (fetches any public URL → base64 server-side, no OAuth) — the Kröfu yfirlit
  „📤 Senda á bókhald" sends Supabase docs via `{url}`. `efnislisti-docs.js` DELETE
  removes the Storage object for `sb:` rows. Old Drive-hosted rows still open via the
  Drive link. `bhSavePdfToDrive` kept for reference but no longer called.
- **Ósendar-vinnuflæði — compact hnappa-röð í Slökkvitæki-stíl (2026-07-07, v2):** tier-2
  raðir á Kröfu yfirlit sýna litla `.ky-abtn`-stíl hnappa (icon + örsmár texti, grænn
  gradient þegar virkur — sama og #166 á Slökkvitæki) + compact talna-reiti (🕒 Tímar ·
  🧱 Redder · 📄 Efnislisti, rammi grár/blár/grænn eftir stöðu): 🕒 Tímask.(vista PDF) ·
  📄 Efnisl.(vista PDF) · ✓ Staðfest (bæði) · ✏️ Breyta · 📤 Senda (grænt þegar sent).
  **v3 (eftir ósk Agnars — innsláttur í röðinni of ruglingslegur):** ENGIR innsláttarreitir
  í röðinni — aðeins lítil lesskrifta-samantekt (🕒 klst · 🧱 Redder · 📄 heild) + hreinir
  hnappar; „⚙️ Stilla" opnar lítinn glugga (`openWfEditor`) til að breyta Tímum/Redder/
  Efnislista-heild/netfangi. (v1 köntuð box → v2 compact m/reitum → v3 hreinir hnappar + ⚙️.)
  **v4 (2026-07-07, eftir ósk Agnars — ENGIN inline-vistun/⚙️):** hnapparnir eru núna
  TENGLAR í ritlana sem ERU ÞEGAR TIL: **🕒 Tímask.** → `openTimabok(worksite,month)`,
  **📄 Efnisl.** → `grOpenWorksite(worksite,month)` (opnar Gerð Reikninga fyrir þann
  verkstað/mánuð; global `grOpenWorksite` notar `__grPendingOpen`+`gr_month`+activeTab).
  Þú vistar/staðfestir Í Gerð Reikninga/Tímaskýrslu og skjalið birtist hér: hnappur
  verður GRÆNN + 📄-tengill þegar skjalið er til (úr `EFDOCS`, ekki wf_state). ✓ Staðfest
  (`wf.confirmed`) + ✏️ Breyta + 📤 Senda eru áfram merking/sending á Kröfu yfirliti.
  Fjarlægt: ⚙️ Stilla + inline PDF-vistun (`pdf-store overwrite`/`buildAndSave*Pdf(...,true)`
  eru enn til fyrir Gerð Reikninga-hliðina en Kröfu yfirlit býr ekki lengur til PDF).
  **v5 (2026-07-08, LOKAÚTGÁFA eftir óháða rýni — 8 ítranir af „þú ert ekki að ná
  þessu"):** takkarnir sitja INLINE á sömu línu og upphæðin (eins og Greitt/Fela í
  þrepi 1 og Slökkvitæki #166 viðmiðið), gegnum SAMA `kyAbtn`-smiðinn og actChips
  (pixel-eins 46×42 `.ky-abtn`). Röðin er `min-width:max-content` og skrunar lárétt
  á síma eins og þrep 1. Núll-tölulínan horfin; tölur (klst·efni·heild) birtast
  aðeins þegar >0, sem lítill span vinstra megin við takkana. **GILDRA — rótin að
  öllum fyrri umkvörtunum var að klasinn lenti á sér línu; ALDREI setja á
  `.ky-wf-boxes` eða þrep-2 `.ky-row`: `flex-wrap:wrap`, `margin-left:auto`,
  `justify-content:flex-end` eða `flex-basis:100%` barn — hvert um sig þvingar
  línubrotið aftur.** Sama gildir um síma-undanþágur (`.ky-t2 min-width:0` var
  fjarlægt — þrep 2 fylgir max-content mynstri þreps 1).
  Undirliggjandi rök óbreytt: **🕒 Tímaskýrsla** (klst úr
  Tímaveru, breytanlegt) → **🧱 Redder efni** (breytanlegt, forfyllt úr
  `/api/redder-invoices` `summary.by_worksite_month`) → **📄 Efnislisti** (heild reiknuð:
  klst×dagvinnutaxti + smáhlutagjald 137/klst + Redder + VSK — samstillt við Tímar-reitinn,
  má yfirskrifa) → **📤 Senda** (netfang breytanlegt, sjálfgefið bokhald@brunaholf.is).
  Hver reitur: grár óunnið → **blár vistað** → **grænn staðfest**; „✏️ Breyta" fer aftur í
  bláan og „💾 Vista PDF" SKRIFAR YFIR fyrra PDF (`pdf-store` `overwrite:true` → föst slóð
  `<slug>/<mánuður>/<doc_type>.pdf` + `?v=` cache-buster). Reitastaðan + tölur geymast í
  `krofur_yfirlit_meta.wf_state` (jsonb) svo hún samstillist milli tækja/notenda.
  `wfNums()` reiknar; `HOURS`/`REDDER` lookup fyllt í `fetchAll()`. Tímar-tölur koma úr
  `/api/worksites?year=combined` (`w.monthly`). NB heildin er einfölduð nálgun (engin
  akstur/staðfesting sjálfvirkt) — full nákvæmni er í Gerð Reikninga; „þarf kanski að
  endurbæta" (Agnar). Efnislisti/Tímaskýrsla PDF nota `buildAndSave*Pdf(...,true)`.
- **Kröfu yfirlit hraði (2026-07-07):** `renderKrofuyfirlit` now uses a
  stale-while-revalidate cache (`window.__KYF_CACHE`, TTL 5 mín) so flakk milli
  síðna sýnir síðustu útgáfu STRAX (áður ~1 mín bið í hvert sinn) og uppfærir
  hljóðlega í bakgrunni; `krofu-yfirlit-bru` + `efnislisti-docs` eru nú sótt samhliða
  (`fetchAll`). „↻ Sækja" og Payday-uppfærsla þvinga ferskt (`load(true)`).
  **2026-07-07 (viðbót):** `fetchAll` málar núna þrep 1+2 (+Ósendar-borðið) STRAX og
  reiknar þunga þrep-3 (`computeTier3` → `/api/worksites?year=combined` + `/api/nlsh-dashboard`
  + `/api/redder-invoices`) í bakgrunni → miklu fyrri fyrsta málning. Sjálfgefin sýn er nú
  **🏢 Fyrirtæki** (`tierFilter:'company'`) í stað „Allt" (sem er þyngst að teikna).
- **Falin (🙈 Fela) — haldast falin þvert á tæki + „👁 Sýna falin" hnappur (2026-07-07):**
  áður „poppuðu faldar upp" hjá hinum notandanum af því þrep-3 raðir (reiknaðar í vafra)
  voru AÐEINS síaðar úr localStorage `ky_hidden_v1` — hitt tækið hafði ekki þann lista.
  Núna skilar `krofu-yfirlit-bru` **öllum röðum með `hidden:true`** (í stað þess að sleppa
  þeim) + `hidden_keys` fylki (öll faldar inv_keys úr `krofur_yfirlit_meta`, líka þrep-3).
  Framendinn heldur `serverHidden` (endurnýjað í hverri hleðslu, EKKI geymt í localStorage)
  svo hidden er authoritative þvert á tæki; `invHidden(inv)` = `inv.hidden || hiddenSet ||
  serverHidden`. Faldar teljast ekki í summur (bæði bakenda-`rollup` og frontend-`liveDebtors`
  sleppa þeim). Einn **„👁 Sýna falin (N)"** hnappur (í síuröðinni) víxlar `state.showHidden`:
  þá birtast faldar daufar (opacity .5) með **👁 Sýna** (af-fela → `hidden:false`) í stað 🙈 Fela.
  Sjálfgefið er `showHidden:false` (faldar sjást ekki).

### Status comments observed in Tekjur (examples — these are real
operational notes, not stale data):
- Grímsbær: "Skipingin er í flipunum að neðan"
- Höfðabakki 9B: "Eftir að senda reikninga fyrir öllu verkinu"
- Lifland: "Engir reikningar. um 46 tímar eftir að rukka. verkið Búið"

## DK Plus (accounting) integration

Slökkvitæki ehf is set up in **dkPlus** (dk hugbúnaður) — the accounting
system the service side invoices from. The "sérhæft sölukerfi" (the
Slökkvitæki Sala/POS) connects via the dkPlus REST/JSON API.

- API base: `https://api.dkplus.is/api/v1` (swagger: `https://api.dkplus.is/swagger`).
- **Secrets** (set in the brunaholf Netlify site env, never in the repo):
  - `DKPLUS_API_KEY` — the auðkennislykill (secret). Shared over email →
    consider rotating it in dkPlus.
  - `DKPLUS_COMPANY` — the dkPlus company GUID (Auðkeni dkPlús),
    `606cc74e-…` for Slökkvitæki ehf. Enables the token exchange.
  - (dkPlus admin login: brunaholf@brunaholf.is.)
- **Auth model**: `POST /api/v1/Token` (Authorization: Bearer `DKPLUS_API_KEY`,
  body `{ Company, Description }`) → company-scoped session `{ Token }`, which is
  the Bearer for data calls. `dkplus.js` mints + caches that token when
  `DKPLUS_COMPANY` is set, else sends the key directly; re-mints once on 401.
- **Must run server-side**: `api.dkplus.is` is unreachable from the browser
  (CORS) and from the build sandbox; every call goes through a Netlify function.
- Proxy: `netlify/functions/dkplus.js` → `/api/dkplus?path=…` — phase 1 is
  **read-only** (rejects non-GET). Confirmed endpoints (lowercase, singular):
  - list invoices `GET sales/invoice/page/{page}/{count}` · one `GET sales/invoice/{number}`
  - `GET customer/page/{p}/{c}` · `GET product/page/{p}/{c}`
  - phase 2 (writes): `POST sales/invoice` · `POST sales/invoice/bulk` ·
    price preview `PATCH sales/invoice/calculate` · PDF/HTML/email/reverse.
- Connection-test page: `dkplus-test.html`.
- Product importer: `netlify/functions/dkplus-product.js` → `POST /api/dkplus-product`
  ({ mode:"dry-run"|"create", confirm, only/offset/limit }). dk rejects
  description-only invoice lines ("Product ItemCode not defined"), so the catalog
  must exist in dk first. Creates `vorur` (where `dk_vorunr` is set) as dk Vörur via
  `POST /api/v1/Product` (ProductModel; only `ItemCode` required) using net
  `UnitPrice1` + `TaxPercent` to match the net invoice lines. Admin page
  `dkplus-products.html` (dry-run → canary → chunked full). `vorur.dk_vorunr` holds
  the dk vörunúmer for every product (95 from the old catalog + 321+ for the rest).
  After import, invoice lines flip from free-text to `ItemCode = dk_vorunr`.
- Phase 2 write path: `netlify/functions/dkplus-invoice.js` → `POST /api/dkplus-invoice`.
  Safe by default: `mode:"calculate"` (default) does `PATCH sales/invoice/calculate`
  (priced preview, **creates nothing**); an actual invoice is written only with
  `mode:"create"` **and** `confirm:true` → `POST sales/invoice`. Never sends to a
  customer. Body: `{ mode, confirm, post, invoice:{…Head…} }`.
- Confirmed dkPlus schema (Swagger `/swagger/docs/v1`): create = `POST sales/invoice`,
  body = `Invoice.Head`. **Draft vs posted is the query flag `?post=false|true`**
  (false = unposted draft; our function defaults to false). Head: `Customer
  {Number,Name,SSN,Email,Address1..4,ZipCode,Country}`, `Term` (payment-term — one
  of the company's terms, confirmed live: `stgr/lm/m15/m20/d15/d20/d30/post`; **NOT**
  "Krafa í banka" — see below), `Date/DueDate/Mode/Reference/Text1/Text2`,
  `Attachment{Name,Content(base64)}`
  (úttektarskýrsla PDF), `Lines[]`. Line fields: `ItemCode` (= vörunúmer/`vorur.id`),
  `Quantity`, `Price` (unit; ex- or með-vsk per `IncludingVAT` bool), `Text`,
  `Discount`, `Total` — **no VatCode**. **`SalesPerson` is REQUIRED on create**
  (else 400 "Sölumaður er ekki til") and must be a registered dk sölumaður —
  list via `GET sales/person/page/1/20`; only one exists: `as` (Agnar Sigurðss).
  Gotcha: the **create** model field is `SalesPerson` but the **read** model
  returns it as `SalePerson` (no s) — don't copy the read field name into a
  create payload. End-to-end create confirmed live 2026-06-09: unposted PRUFA
  draft (RecordID 2, 1× vara 161, 4.490 kr m vsk) via `POST sales/invoice?post=false`.
  List terms via `GET general/payment/term`
  (`{ID,Number,Description}`). **Krafa-í-banka is NOT a payment term** — it is a
  separate dk **innheimta** setting (per customer/company innheimtusamningur),
  applied automatically on posting; not driven by `Term` and not an API field
  (confirm where the "10 dagar" in "Krafa í banka 10 dagar" comes from). Rafræn
  afhending follows the customer's afhendingarmáti set in dk. The vMail lánardrottna pósthólf is **inbound-only** (reads creditor
  invoices in) — not for sending anything out.
- **Customer must already exist in dk before invoicing.** An invoice (even
  `calculate`) for a kt not on file in dk fails 400 with the misleading
  `"Value cannot be null. Parameter name: user"` — the direct-key API context
  cannot auto-create the customer (confirmed 2026-06-13: only the kts already in
  dk price/create; all missing ones fail). Customer sync:
  `netlify/functions/dkplus-customer.js` → `POST /api/dkplus-customer`
  (`{ mode:"dry-run"|"create", confirm, base_ids:[…] }`) reads `customers_base`,
  **skips kts already in dk** (matched on SSNumber digits → no kt-format
  duplicates), and creates the rest via `POST /api/v1/Customer`
  (`{Number`=kt dashed, `Name`, `SSNumber`=10-digit, `CountryCode:'IS'`,
  `Address1}`). Pattern: dry-run → canary `base_ids:[one]` → full.
- `slokkvitaeki-reikningur.html`: invoice generator styled like the dkPlus
  reikningur (R-000244), logo from `/api/branding`, lines from `/api/vorur` (Sala
  verðskrá). "Reikna í dkPlus" → calculate preview; "Stofna drög í dkPlus" →
  unposted draft (`post:false`). Can load an existing sale via `/api/solur`.
- `reikningar-bid.html`: batch flow — unsent reikningur sales
  (`/api/solur?unsent` = status `final` + `greitt_med=reikningur` + `invoiced_at`
  null) grouped by customer → combine selected into one unposted draft via
  `/api/dkplus-invoice` → writeback `/api/solur-mark` sets `invoiced_at` +
  `dk_invoice_id` + `invoice_batch_id` so the sale drops off (idempotent).
- `solur` tracking: added `invoiced_at`/`dk_invoice_id`/`invoice_batch_id`; the
  `status` check now also allows `void` (test rows voided, recoverable). `/api/solur`
  only returns `status='final'`.
- Phases: (1) connect + read. (2) push invoices into dk+ from POS sales /
  yearly brunakerfi úttektir. (3) customer/vörur sync + payment status back.

---

*Kaflarnir hér fyrir neðan voru fluttir orðrétt úr `CLAUDE.md` 2026-08-19
(verkefnalisti 22a44bdc) — sama efni, nýr staður.*

## Yfirferð efnislista (👔) — 2026-08-08

Skrifstofan flaggar Efnislista til yfirferðar hjá yfirmanni sem er á ferðinni
með símann (The Big Boss appið á slokkvitaeki). Flæðið:

- **Gögn**: `review_requested/_at/_by` + `review_confirmed_at/_by` dálkar á
  `invoice_drafts` (`sql/2026-08-08_invoice_drafts_review.sql`); allir í
  allowed-whitelistanum í `invoice-drafts.js`.
- **Flagga**: 👔 Yfirferð-takki í `wfStrip` á Ósendar/Tími-eftir-röðum í Kröfu
  yfirliti (`index.html`, birtist aðeins ef drög eru til). Kveikja setur
  `review_requested`; slökkva hreinsar líka staðfestinguna. `REVIEWS`-mappið
  (ws|wm → drög) er sótt í `fetchAll()` með `/api/invoice-drafts`.
- **Yfirferð**: `yfirferd.html` — símavæn síða (svart/gull) sem listar flögguð
  drög með beinum hlekk „🧾 Opna Efnislista" á ALVÖRU Efnislista-formið (ósk
  Agnars 2026-08-08 — enginn sér-ritill lengur, formið er eitt). Hlekkurinn er
  `/?embed=1&grws=<verkstaður>&grwm=<YYYY-MM>&review=1#gerdreikninga` —
  `renderGerdReikninga` les `grws/grwm/review` (einu sinni, `__grDeepDone`) og
  opnar ritilinn sjálfkrafa. Í yfirferðar-ham (review=1 EÐA drögin flögguð)
  fær ritillinn ✓ Staðfesta (vistar + `review_confirmed_at/_by`) og ↶ Hætta við
  (skrifar snapshot frá opnun til baka — afturkallar líka það sem var ÞEGAR
  vistað í þessari opnun; PATCH-leiðin í `invoice-drafts.js` gerir hlutauppfærslu
  örugga). Báðir fara `history.back()` á yfirferðar-listann; `pageshow` þar
  endurhleður. Nafn úr `localStorage.bh_me` (sama lén og hub → deilist).
- **Staða til baka**: Kröfu yfirlit sýnir „👔 Í yfirferð" (gult) eða
  „👔 Staðfest · nafn dags." (grænt) undir takkaröðinni. Staðfesting yfirmanns
  er AÐSKILIN frá ✓ Staðfest/📤 Senda vinnuflæðinu — skrifstofan sendir áfram.
- **Í appinu**: síðan er `br-yfirferd` í PAGES/boss-defaults í slokkvitaeki
  patch 261.

## Viðskiptavinir-flipi — 2026-08-08

Nýr flipi **`vidskiptavinir`** (🏢 Viðskiptavinir) — per-verkstað greiðslureglur og
viðskiptavinargögn sem Efnislisti-formið les sjálfkrafa.

- **Gögn**: `pricing_guide` tafla (lykill: `worksite_name`). Nýir dálkar bætt við
  2026-08-08: `eftirvinna_leyfid` (bool, default true), `verkfaeragjald` (bool),
  `kennitala` (text), `heimilisfang` (text), `lunch_fradrattur_h` (numeric, default 0).
  Migration: `sql/2026-08-08_pricing_guide_customer_settings.sql`.
- **API**: `GET/POST/DELETE /api/pricing-guide` — `pricing-guide.js` whitelist nú með
  öllum 6 nýjum dálkum. DELETE tekur `?worksite=NAME`.
- **Efnislisti-tenging** (`renderGerdReikninga`): `rateFor(name)` skilar nú
  `evOk` (yfirvinna leyfð), `evThreshold` (klst/dag fyrir yfirvinna, sjálfgefið 8),
  `lunch` (hádegismatsfrádrátt klst/dag), `vf` (verkfæragjald). Þegar `evOk=false`
  birtist „— ekki leyfð" merki við Yfirvinna í ritlinum. Tooltip „📥 Fylla úr tímabók"
  sýnir núverandi threshold og lunch. `kennitala`/`heimilisfang` er forútfyllt
  sjálfkrafa úr `pricing_guide` þegar nýtt drög er opnað (fellur aftur á `PAYER_OVERRIDE`).
- **Viðskiptavinir UI**: `renderVidskiptavinir(t)` — spjöld flokkuð eftir
  `customer_name`, með breyta/eyða modal. Kt./heimilisfang breytist á öllum
  verkstöðum sama viðskiptavinar í einu (sibling propagation).
- **Frumgögn (seed)**: 5 lykilviðskiptavinir seyddir 2026-08-08:
  Orkureitur (SAFÍR), Fjallaböðin Þjórsárdal (JÁVERK, 9300/13950, sma=0),
  Fjarðagata (GG verk, lunch=0.5), Dalvegur 30 (Eykt), Landsspitalinn (ÞG verktakar).

## Landsspítalinn (NLSH) dashboard — mánaðar-bakfylling + þrepað markmið (2026-08-05)

Verkefnalisti 3af766ff, sex smærri fix á `renderNLSH` í index.html + `netlify/functions/nlsh-dashboard.js`:

- **Samningsstaða per verkliður**: markmiðið (`target`) er PER TÍMABIL — þegar
  BÚIÐ (stakar) fer yfir það þýðir það nýtt tímabil er hafið, ekki 150%+ að
  eilífu. `byVerk` reiknar núna `tier = ceil(stakar/target)`, sýnir
  "Markmið" sem `target–target×tier` þegar tier>1, og % miðað við það þrep.
- **Handvirk leiðrétting**: nýr dálkur á sömu töflu — talnareitur per verkliður
  leiðréttir `stakar` (t.d. -50/+50 þegar Ajour-flokkun er röng). Vistast í
  `app_kv['nlsh_verk_overrides']` (`{verk_nr: delta}`) gegnum nýja
  `POST /api/nlsh-dashboard {verk_nr, delta}` — lifir þar til sett á 0/tómt.
- **Göt kláruð per dag**: hætti að vera fastur 14-daga gluggi — `?range=
  this_week|last_week|this_month|last_month` stýrir `dayRangeBounds()` í
  bakenda; framendinn er með takka-röð, sjálfgefið "Þessi vika".
- **Mánaðaruppgjör**: „📸 Loka" er núna á HVERJUM ólæstum mánuði í listanum
  (ekki bara núverandi) — notar `byMonth[].cum_revenue_m_vsk` (þegar reiknað
  úr Ajour) sem gildið, svo gleymda mánuði (t.d. júní/júlí) má festa
  afturvirkt án þess að giska á töluna.
- **Vika-dagsetningar**: `isoWeekRange(weekKey)` breytir "2025-W38" í
  "15.09–21.09" — notað í "Lokuð göt per viku" og "Frammistaða per starfsmann"
  töflunum (tooltip + undirtexti).
- **Lokuð göt per viku**: pakkað í `<details>` svo hægt sé að fella út/inn.

## 📥 Drög-stöð — punktar sem safnast áður en reikningur er sendur (2026-09-05)

Tafla `reikningspunktar` (felag · raw · status nytt/flokkad/notad/hafnad ·
worksite_name/work_month · ai · applied). Brunahólf: markið er drög (verkstaður|mánuður)
og `POST /api/reikningspunktar {action:"apply"}` er EINA leiðin héðan í `invoice_drafts`:
klst leggjast við `hours_dagvinna/eftirvinna` (taxtar úr Verðskrá ef vantar), efni bætist í
`materials_jsonb`, gjald setur `fixed_total`, greiðandi setur `customer_name/kennitala`;
upphæðin er endurreiknuð með sama kjarna og Efnislistinn (vinna + smáhlutagjald + staðfesting
+ efni, afsláttur, vsk — fast verð yfirríður) og nótulína „• dd.mm punktur: …" bætist í
`invoice_drafts.notes`. Slökkvitæki: markið er kúnni (`fyrirtaeki.nafn`), reikningurinn
verður til í Slökkvitæki-appinu og `apply` merkir punktinn aðeins notaðan.

Gátlistinn (`?op=stada`) per drög: tímar (klst>0 eða fast verð) · efni (fast verð, ekkert
Redder, eða materials_total>0) · greiðandi+kt (drög → customer_worksite_map → pricing_guide)
· upphæð (total_m_vsk>0) · skjöl (efnislisti_pdf/_timabok_pdf eða ⭐ is_primary) · engir opnir
punktar. `ready` = allt grænt. Sameinuð/sleppt/rukkuð drög og `paid` í meta eru ekki „í smíðum".
