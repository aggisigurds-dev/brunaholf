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

## Gagnalíkan viðskiptavina (the customer spine) + 🗺️ Kerfis-kort

**Read this before touching customer / document / equipment data in either app.**
Slökkvitæki + Brunahólf share ONE Supabase project, and the customer model is a
spine — one canonical customer, then its sites, then its equipment:

- **`customers_base`** — the *canonical* customer, **one row per kennitala**
  ("Allir viðskiptavinir"). Carries `rekstrarfelag`.
- **`fyrirtaeki`** — **sites / starfsstöðvar**, linked to base via
  `customer_base_id`. **One kt can own many sites = rekstrarfélag** (Pizzan 11,
  Colas 3). `er_i_thjonustu` = in service (this IS the "þjónustuflokkur" signal —
  there is no separate category column). `deleted_at` = soft-deleted.
  **NEVER merge/delete a rekstrarfélag's sites** (Agnar, standing rule).
- **`uttaeki`** — equipment, linked via `customer_base_id` + `worksite_id`→site.
  **Auto-generated PLACEHOLDERS — they don't matter; may be deleted / regenerated.
  "Equipment without a site" (`worksite_id` null) is NOT a problem** (Agnar
  2026-07-12) — do not surface it as a health flag.
- **`customer_documents`** — úttektarskýrslur / reikningar / samningar indexed from
  Google Drive. Keyed `customer_base_id` + `fyrirtaeki_id` (site) + `year`;
  `drive_file_id` = the file in the master folder. **One úttektarskýrsla per
  (site, year); reikningar deduped by R-number.** `is_duplicate=true` = flagged
  copy (reversible, never deleted).
- **`solur`** (POS/Slökkvitæki invoices) + **`payday_invoices_slokk`** (Payday
  krófur, kt stored **digits-only**) link by **kt**, not a base FK. ~120 krófur
  are sent via Payday out of Kröfu yfirlit; patch 199 (slökkvitæki) surfaces them
  on the company profile.
- **Conventions:** walk-in / anonymous sale = kt `999999-9999`.
- **Forgangsröð (Agnar 2026-07-30):** the customers that matter are `customers_base`
  ("Allir viðskiptavinir", the canonical spine) and `fyrirtaeki` with
  `er_i_thjonustu=true` ("Fyrirtæki í þjónustu"). The Slökkvitæki-side
  `vidskiptavinir` table is the LOWEST grade (individuals/legacy) — never treat it
  as the primary customer lookup.

**Tengireglan (2026-07-15, `netlify/functions/_spine.js`)** — EIN sameiginleg regla
fyrir hvernig skjal tengist hryggnum, notuð af öllum tengjurum (doc-index,
reikningar-read, samningar-read, drive-sort): `customer_base_id` kemur úr
kennitölunni; `fyrirtaeki_id` (STAÐURINN — það sem skiptir máli fyrir
rekstrarfélög eins og Center Hótel) AÐEINS með sönnun, í röð: (1) „` - #<id>`"
stimpill í skráarheiti → sá staður (eina sönnunin sem má yfirskrifa fyrirliggjandi
fyrirtaeki_id), (2) félagið á nákvæmlega EINN lifandi stað, (3) heimilisfang í
skráarheiti (heild + per „ - " bút) eða PDF-innihaldi passar við nákvæmlega EINN
lifandi stað (`addrKeyLoose`: götu-forskeyti + húsnúmer; tveir staðir á sama
lykli → óvíst), (4) annars ÓSNERT — aldrei giskað, aldrei núllað.
API: `siteStampFromName · addrKeyLoose · sitesByBases · sitesForBase ·
resolveSite(fileName, sites, extraAddr) → {id,nafn,via:'stamp'|'single'|'addr'}|null ·
siteWriteAllowed(drive_file_id, site)` (varðar merge-upsert gegn yfirskrift).
Framleiðendahliðin: `uttekt-rename` og `drive-sort` (skýrslur) skeyta #id-stimplinum
aftan á kanónísk nöfn þegar staðurinn er þekktur, svo framtíðar-lesarar tengja beint.
**Nafnavenja staða (Agnar 2026-07-15) + nafna-sönnun `via:'name'`:** staðanöfn
fylgja „Rekstrarfélag - Sérkenni" („Aðalskoðun - Skeifan", „Heimaleiga -
Laugavegi 18", „Center Hótel - Arnarhvoll") — „ - " á eftir félagsnafni merkir
að næsti bútur sé AÐGREINIR staðarins (útibú/undirfang) og skal reyndur sem
staðar-sönnun úr skráarheiti/innihaldi. Endandi „ehf."/„hf." = eins-staðar félag
eða höfuðstöð rekstrarfélagsins sjálfs — EKKI útibú (fær engan nafna-lykil).
Samanburður er fold-aður (án broddstafa/hástafa/greinarmerkja) svo „Center Hótel
Arnarhvoll" og „Center Hótel - Arnarhvoll" eru jafngild. Útfært í
`felag-endurlestur.js` (`resolveByName`: sameiginlegt forskeyti + ehf/hf klippt,
HQ-lykill sem er forskeyti að útibús-lykli felldur; nákvæmlega EITT aðgreinandi
nafn í skjali = sönnun, 0 eða 2+ = ekki snert).

**🗺️ Kerfis-kort** (`kerfiskort.html` at `brunaholf.netlify.app/kerfiskort.html`
+ hero card at the top of Bakendi) is the **live single-page map of the whole
customer DB** — one row per customer with kt · service · rekstrarfélag · sites ·
equipment · master-folder docs · 2023–2026 skýrsla/reikningur/Payday per year ·
health flags (unlinked docs, dups, no-kt/base). Expand a row → sites + all docs
(Drive links) + Payday + a link to Skýrslu-stöð. It reads live every time (no
cache). Backed by Postgres view **`v_kerfi_kort`** (rollup per base, `grant select
to anon`) + endpoint **`/api/kerfi-kort`** (`kerfi-kort.js`: default=all ·
`?base=ID`=detail · `?counts=1`=schema/health). **Fixing connection gaps** is done
in the Bakendi tools: 🔗 Skýrslu-stöð (doc→site), 🧩 Kt-samræming (kt/base on
sites), 🧽 Hreinsi-borð (batch doc reconnect), 🧹 Drive-flokkun + 🗜️ Fletja (Drive).

## Tabs (current)

Defined in `DEFAULT_STATE.tabs`. Render functions in `index.html`:

- `dagurinn` — **🌅 Dagurinn** front-page starter (first tab, the landing page,
  renderDagurinn). Honest daily dashboard — **never a fake "live" label**; every
  status is a real DB timestamp. Four bands: **🔄 Samstilling** (sync health from
  `/api/data-sources-status` — per source a traffic-light dot + "Nýjustu gögn"
  (`newest_real`) vs "Síðast samstillt" (`last_import`) + a plain-Icelandic
  verdict; email ≥2 days flags the bridge-tölva being off), **💡 Claude mælir
  með** (recommendations computed client-side: aging/stale sources → uppfæra,
  plus `summary.worksites_with_no_invoice` from `/api/worksites?year=combined`),
  **📧 Nýjustu póstar** (`recent_emails`), **✅ Verkefni** (open to-dos read from
  `state` — `minverkefni.checklist` + `okkarVerkefni.twoCol`). Buttons switch
  tabs via `state.ui.activeTab=…; save(); render()`.
- `yfirlit` — front page / dashboard. Includes an **Útistandandi** band
  (óinnheimt + verkstaðir án reiknings) pulling `summary.total_unpaid` +
  `summary.worksites_with_no_invoice` live from `/api/worksites?year=combined`;
  tiles link to the `verkstadir` tab.
- `okkarVerkefni` — Anni & Aggi shared todo (two columns)
- `inbox` — email digest (renderInbox)
- `spurningar` — question-email triage (renderSpurningar)
- `timavera` — hours dashboard (renderTimavera, ~line 1670)
- `tvmaeting` — **🕒 Mæting · verkstaðir** (renderTvMaeting, situr undir Tímaveru):
  hvenær starfsmenn mættu og hættu síðustu daga + verkstaðir. Eitt spjald per dag
  (nýjast efst, „Í dag/Í gær"), röð per starfsmann: 🟢 mætti (fyrsta time_in) ·
  🔴 hætti (síðasta time_out) · klst · verkstaða-chippar (hver með eigin
  inn–út/klst). Dagafjöldi 3/8/14/31 (`state.ui.tvm_days`). Endpoint
  `/api/timavera-dagar?days=N` (`timavera-dagar.js`, les `timavera_entries` —
  NB ólíkt `timavera-maeting.js` sem er dagurinn-í-dag úr Mæting-sheetinu).
  Líka síða í Slökkvitæki **Fjármál-appinu** (patch 261 `br-maeting`,
  `?embed=1#tvmaeting`).
- `verdsamanburdur` — Verðsamanburður / competitor pricing (renderCompetitors)
- `verkstadir` — worksite billing audit (renderWorksites, ~line 2175)
- `skuldunautar` — Skuldunautar (AR snapshot, renderSkuldunautar). `/api/debtors`:
  open Payday/Landsbanki invoices per debtor, each flagged Útistandandi / Greitt í
  banka? / Kannski í banka / Kreditfært via bank cross-ref; aging + vintage + search.
  **Vocabulary-agnostic + respects `krofur_yfirlit_meta` (2026-07-25):** `debtors.js`
  now matches status by substring (English `PAID/SENT/CANCELLED/CREDIT` + Icelandic)
  and honours the shared `paid`/`hidden` meta flags — so old SENT krófur the office
  already marked greitt/falið in Kröfu yfirlit drop here too (fixed a 124.5M→5.8M
  overstatement from stale-SENT invoices Payday was never marked paid on, older than
  the bank ledger's 2025-07-30 start). **Staðfestir stöðupunktar + inline mark
  (2026-07-25):** `debtors.js` also takes **POST** — `{action:'mark',inv_key,paid?
  |hidden?}` writes the SAME `krofur_yfirlit_meta` (a reikningur drops instantly,
  consistent with Kröfu yfirlit); `{action:'confirm',kt,confirmed_balance,by}` /
  `{action:'unconfirm',kt}` snapshot/clear a per-customer checkpoint in new table
  **`ar_checkpoints`** (`kt`+`company` unique, RLS-locked to service role). GET now
  returns per-invoice `inv_key`+`is_new` and per-debtor `checkpoint{confirmed_balance,
  confirmed_at,delta,new_kr}`. UI (`renderSkuldunautar`): „✓ greitt"/„🙈 fela" per
  reikningur, „✓ Staðfesta stöðu núna (X)" per skuldunaut → „🔒 Staðfest X · breyting
  síðan ±Y", newer invoices badged „🆕 nýtt síðan staðfest". Lets the office work
  down the AR gradually and measure new numbers against a confirmed baseline.
- `krofur` — **📊 Krófur & Tekjur** (renderKrofur) — executive overview of BOTH
  companies' krófur, scoped to one year (default 2026). Endpoint
  `/api/krofur-yfirlit?year=YYYY` (`krofur-yfirlit.js`, service role): reads
  `invoices` (Payday+Landsbanki, filtered by gjalddagi year) and cross-references
  `bank_transactions` (the old Landsbanki CSV — a krófa is `bank_paid` when an
  inflow matches kt+amount within max(5k,1%) and lands ≥ gjalddagi−15d) and
  `invoice_drafts` (what the office computed in Vinnubók/Reikningagerð → `draft_match`
  hint). Also returns a Slökkvitæki summary from `solur` (reikningur=krófur út,
  staðgreitt, greitt síðar) + per-month revenue for both. **Manual overrides** live
  in `krofur_yfirlit_meta` (`inv_key='source|tilvisun'`, `hidden` + `amount_override`
  + `note`; RLS off) via `POST {action:'save',...}` — hide a krófa already paid by
  bank, or correct a wrong amount; hidden krófur drop from every total, override
  replaces upphaed_total. UI: expandable stat cards (click a total → filter the list
  to its rows), searchable krófulista with inline amount edit + 🙈 fela, Slökkvitæki
  cards, monthly-revenue strip. Also **🧾 Óinnheimt í afgreiðslu** (Slökkvitæki
  reikningur sales from `solur` = POS AR, each flag/note/hide-able, `inv_key='sl-sala|<id>'`)
  and **🔧 Ókláraðar ársskoðanir** (equipment from `uttaeki` with `next_insp<=today`,
  grouped by `client` = overdue annual inspections / unbilled work, flag/note/hide-able,
  `inv_key='sl-ars|<client>'`, `>1 ár` badge for long-overdue). Meant to be the main
  financial-status page across both companies. NB Slökkvitæki monthly is by `solur.created_at`
  (bill date) — distorted when invoicing is batched/caught-up; flag this, inspection
  date would be truer but isn't on the sale row.
- `hreyfingaryfirlit` — Hreyfingaryfirlit (per-customer account statement,
  renderHreyfingar). `/api/hreyfingar`: invoices (debet) + Payday-paid (kredit),
  running staða — **all amounts MEÐ VSK (`upphaed_total`, not `hofudstoll`)**.
  Staða = Σ ógreiddir reikningar, which **matches the accounting Viðskiptakröfur
  (account 3400) Lokastaða exactly** — verified per-customer against the dkPlus
  Hreyfingalisti export (all 18 debtors, total 159.76M; e.g. Eykt 22.799.337, ÞG
  4.410.930). Bank inflows are mixed into the list **for information only** (they
  do NOT change staða — the AR balance is invoice-status based; a bank inflow on a
  still-"Ógreitt" invoice flags that Payday needs updating). Hide companies
  (localStorage), cumulative invoiced-vs-paid charts, balance-per-customer bars.
  NB `/api/debtors` (Skuldunautar) also uses `upphaed_total` (m.vsk) for the same
  reason.
- `nlsh` — Landsspítalinn (NLSH) dashboard (renderNLSH): tekjur/mánuð
  (contract heildir × taxti, uppsafnað), lokuð göt per viku, vinnustundir +
  göt per starfsmann, samningsstaða per verkliður. Data: `/api/nlsh-dashboard`
- `maeting`, `verkefnastada` — sheet-CSV-backed generic tabs
- `verdskra` — Verðskrá (rate editor for pricing_guide + hole_size_rates + read-only NLSH contract)
- `april` — Apríl reikningar punch list
- `todo`, `minverkefni` — todo lists
- `slokkvitaeki` — fire-extinguisher data
- `gogn`, `samthaetting` — config/integration checklist
- `kvittanir`, `tenglar`, `reikningar`, `utgjold`, `stillingar` — utility/link tabs
- `bakendi` — Bakendi control panel (renderBakendi, bottom of sidebar above
  Stillingar). Currently a PDF document-reader: pick a Google Drive folder,
  Prufa/Keyra the server-side `/api/doc-index` indexer in batches (live
  progress), shows connected docs + a RESOLVE list of kennitölur not in
  `customers_base`. Reads/writes `customer_documents`. Also hosts **Mínir
  Sheet-tenglar** at the top: 3 manual, always-editable Google Sheets link slots
  saved to `state.bakendiLinks` (synced cross-device via `/api/app-state`). The
  Reikningalesari / Samningalesari „Skrifa í Google Sheet" actions auto-fill the
  first/second slot when it's still empty. Also hosts **🔗 Skýrslu-stöð** at the
  top — the human-in-the-loop report→site matcher (see `match-station.js`).
- `reikningatenglar` — advanced, always-editable/movable invoice-links page
  (`renderReikningatenglar`): live search, quick-add by pasting a URL, open-all
  per group, copy-link, and drag-to-reorder without entering edit mode. Buttons
  live in `state.buttons` (`tab:'reikningatenglar'`), curated defaults seeded via
  `ensureNewTabs` + a `loadState` migration so existing users get the tab.
- `vorubirgdir` — **🏷️ Vörubirgðir** (renderVorubirgdir; situr rétt á eftir
  Efniskostnaði). EIN vörulisti þvert á Slökkvitæki + Brunakerfi með **inn- og
  söluverði**. Les/skrifar **SÖMU `vorur`-töflu og Slökkvitæki Sala** (deildur
  Supabase) gegnum `/api/vorubirgdir` (`vorubirgdir.js`, service role): `GET` →
  `{products, categories}`; `POST {action:'save', product}` (insert/PATCH — ALLTAF
  LEYFA VISTUN, aðeins nafn skylda) · `POST {action:'delete', id}` (NB eyðir líka
  af Sölu — nota heldur `virkt=false`). Tafla: nafn · flokkur (brunakerfis-flokkar
  rauðir) · birgir · **kaupverð (`vorur.kostnadarverd`)** · söluverð (`verd_an_vsk`)
  · **álagning** (reiknuð) · vsk% · lager · virk. Leit + flokka-sía + sýn-rofi
  (Allar / 🧯 Slökkvitæki / 🚨 Brunakerfi / Aðeins virkar) + tölfustika (m.a.
  lagervirði). Modal-ritill (add/edit) reiknar álagning + söluverð m.vsk lifandi.
  Brunakerfis-búnaður (skynjarar/sensorar/tæki) bætist við undir eigin flokki svo
  brunakerfis-verk geti síðar sótt vörur eftir `flokkur`. **Bætti `vorur.birgi`
  (text) — birgir/seljandi** (additive, sjá migration `add_birgi_to_vorur`).
  **📥 Skrá birgja-reikning (2026-07-28):** hnappur efst + modal (`openImport`) þar
  sem maður límir línur af birgja-reikningi (afritað úr PDF). Framendinn þáttar hverja
  línu (`parseLine`: klippir tölu-halann magn·ein.verð·afsl·vsk·samtals frá HÆGRI svo
  innfelldar tölur í lýsingu — „2kg", 1", „SND-500-S", „FLÖT(12)" — lifa; hendir
  dagsetningum), reiknar **kaupverð án vsk = ein.verð×(1−afsl%)**, giskar á vöru-match
  (`bestMatch`, token-skörun með æ→ae/þ→th/ð→d) og birtir ritanlegt borð (lýsing ·
  kaupverð · vöru-veljari · flokkur-ef-ný). „Vista" POSTar `{action:'import', birgir,
  overwrite?, rows}`. Endapunktur: **tengd vara → PATCH AÐEINS `kostnadarverd`+`birgi`**
  (aldrei nafn/söluverð/virkt; sleppir ef kaupverð er þegar til nema `overwrite=true`);
  **ný vara → INSERT `virkt=false` + `verd_an_vsk=null`** (poppar ekki á Sölu fyrr en
  verðlögð). NB verð sem eru „með VSK" á reikningi (sumar töflur) þarf að leiðrétta í
  borðinu — allt er ritanlegt fyrir vistun.
- `sjalfvirkni` — **⚙️ Sjálfvirkni** automation control board (renderSjalfvirkni;
  sits in the control-panel area, just above Bakendi). Reads `/api/automations` and
  renders one card per enabled `automation_jobs` row: a status dot from the latest
  `automation_runs` (success=green, error=red, running=amber, no-run=grey), the
  label + small `name`, „Síðast keyrt: <afstæður tími> · <detail>" (or „Aldrei
  keyrt"), the schedule, a 📋 „Afrita skipun" button (copies `command`, e.g.
  `run_workflow ajour-nlsh`) and a 🔗 „Afrita hlekk" button (copies
  `location.origin + '/#sjalfvirkni/' + name`). A small „➕ Skrá nýja sjálfvirkni"
  form (name/label/command/schedule) POSTs `{action:'register'}` then reloads;
  „↻ Sækja" refreshes. Wired in the 3 standard spots (`DEFAULT_STATE.tabs`,
  `ensureNewTabs`, the `render()` dispatcher). Reuses global `escapeHtml`; local
  `esc`/`relTime` helpers like renderDagurinn.

- `vefryni` — **Vefrýni** visual review/annotation tool (`renderVefryni`, tab just
  above Bakendi; also a launch card at the top of Bakendi). A deck of slökkvitæki
  screenshots shown flip (⇄) or scroll (▤); click a page to drop a dot with a
  comment + optional pasted screenshot. Status flow: 🟡 `nytt` → 🔵 `tilbuid`
  (Claude, after fixing) → 🟢 `samthykkt` / 🟠 `lagfaera` (Agnar). "Senda í viðgerð"
  flags all unsubmitted pins as a batch. Pages added manually (upload/paste) for now;
  one-click auto-capture is a planned fast-follow. Backend `/api/vefryni`
  (`netlify/functions/vefryni.js`, service-role key): `GET ?what=deck|queue`; `POST`
  actions `add-page|update-page|delete-page|reorder-pages|add-pin|update-pin|delete-pin|submit`.
  Data: `vefryni_pages` + `vefryni_pins` (**RLS ON, no anon policies** — only this
  function / admin can read; the public anon key cannot) + public `vefryni` storage
  bucket (screenshots, UUID keys). **Claude's worklist after a "Senda í viðgerð":**
  `GET /api/vefryni?what=queue` (or SQL: pins where `submitted` and `status in (nytt,lagfaera)`);
  fix each, set `status='tilbuid'` + a `claude_note`, then Agnar marks green/orange.

> The `reikningar` tab is NO LONGER a placeholder — `render()` maps it to
> `renderReikningagerd` (full invoicing-prep view). The remaining Reikningagerð
> ambitions live under Open work below.

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
- `invoices` (~430 rows): Payday + Landsbankinn krafnir.
  Cols: `customer_name, kt_greidanda, hofudstoll, gjalddagi, status,
  greidsla_date, tilvisun, worksite_match, ...`. Joined to worksites
  via `customer_worksite_map` + `worksite_match`. Upsert key `(tilvisun,source)`,
  Payday rows `source='payday'` (refresh via Payday "Reikningar" xlsx).
  **⚠️ `status` vocabulary is MIXED (2026-07-25):** the Payday-API sync
  (`payday-pull.js`) writes **English UPPERCASE** — `PAID` / `SENT` (=unpaid
  krafa) / `CANCELLED` (+) / `CREDIT` (− twin of CANCELLED, nets to 0) / `DRAFT`;
  Landsbanki + manual rows still use Icelandic `Greidd` / `Ógreidd` / `Greitt` /
  `Drög`. **Every reader must match by SUBSTRING, not exact string**, and treat
  the „ó/o"-prefix as negation (`ógreitt`/`ógreidd` = UNPAID — must NOT match the
  paid word). Canonical helpers (copied across `hreyfingar.js`, `debtors.js`,
  `worksites.js`, `customer.js`; `krofur-yfirlit.js`/`krofu-yfirlit-bru.js` were
  already tolerant): `isPaid = !/[óo]grei/ && /paid|greitt|greidd/`, `isDraft =
  /draft|dr[öo]g/`, `isCancelled = /cancel|afturk|felld|[óo]gild/`, `isCredit =
  /credit|kredit/ || amt<0`; **open AR = the COMPLEMENT** (not paid/draft/
  cancelled/credit, amt>0) so a new status word never silently drops real AR.
  True unpaid AR ≈ **131.5M** (41 `SENT` 130.1M + 5 `Ógreidd` 1.4M). An
  exact-string match had broken Hreyfingar (showed 489.6M — PAID un-credited) and
  Skuldunautar (showed 1.4M — all SENT dropped); fixed 2026-07-25.
- `bank_transactions` (~938 rows): Landsbankinn ledger, used to detect
  payments made via bank that haven't been reflected in Payday. Upsert key
  `(trans_date, tnr, amount)`, `source='landsbankinn_account'`, `company='brunaholf'`
  (refresh via Landsbankinn xlsx export). **Drive-ingest (2026-07-26):**
  `landsbanki-ingest-drive.js` (`/api/landsbanki-ingest-drive`) — twin of
  `payday-ingest-drive`: finds the newest Landsbanki xlsx in Drive (name matches
  `/landsbank|hreyf|a[ck]count|f[æa]rsl/i`), fuzzy-maps headers → upserts on the
  same key. `?dry=1` previews (no write, echoes resolved header→column mapping —
  RUN THIS FIRST to confirm the mapping against a real export, esp. the `tnr`
  column); default upserts. Bakendi „🔄 Gagna-uppfærslur úr Drive" button.
  ⚠️ mapping is best-guess (`// TODO verify against real export`) until confirmed.
- `customer_worksite_map`: unified payer → worksite/starfsstöð map +
  `retention_pct`. Now also carries `base_id` (FK → `customers_base`, the
  paying customer) and `heimilisfang` (site address) so one kennitala can own
  many sites while the invoice rolls up to the base payer. Originally a
  name-only draft of Brunahólf construction worksites (GG verk → Fjarðagata,
  Eykt → Dalvegur 30/Heklureitur, ÞG verktakar → Landsspítalinn …); it now also
  holds Slökkvitæki service customers' starfsstöðvar (e.g. Colas: one kt
  420187-1499 / base 52, three sites Óseyrarbraut / Gullhella / Álfhellu).
  Backfill `base_id` by exact `customer_name` → `customers_base.nafn` match;
  low-confidence rows stay `base_id`-null for manual review. See
  `sql/2026-06-04_customer_db_finish.sql`.
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
  `drive-list.js` (paginated folder/query listing),
  `gmail-search.js`, `sheet-create.js`.
- `doc-index.js` — server-side Drive→`customer_documents` indexer behind the
  Bakendi tab. `GET /api/doc-index?folder=ID[&dry=1][&limit=8][&offset=N]`:
  reads each PDF (pdf-parse), requires Slökkvitæki issuer kt 600508-0400
  (skips vendor invoices), takes the customer kt, classifies, matches
  kt→`customers_base`, upserts `customer_documents` (dedup on drive_file_id).
  Batched by `offset` (each call ≤ ~10s); the UI pages through. The result table
  has an **editable customer match** (breyta/✗ + „+ stofna" — `POST
  {action:'set-link'|'create'}`), a clean-text Drive fallback for PDFs pdf-parse
  can't read, and re-surfaces already-indexed-but-unmatched (RESOLVE) docs so they
  can be fixed (only already-*matched* docs are skipped on re-run). **Tengist líka
  á STAÐINN** (2026-07-15): aðal-lykkjan, audit-relink og set-link nota
  `_spine.resolveSite` — `fyrirtaeki_id` fylgir aðeins með sönnun (sjá Tengireglan).
- `uttekt-rename.js` — Bakendi **Endurnefna úttektarskýrslur** (`/api/uttekt-rename`):
  deep-scans report PDFs (both layouts — slökkvitæki úttektarskýrsla + brunaviðvörunar-
  kerfi viðtökupróf/árleg prófun), renames in Drive to `Fyrirtæki - Kennitala -
  Heimilisfang - Ár - Mánuður` (address preferred from the clean old filename, else
  extracted from content with the company-prefix stripped + city abbrevs expanded
  e.g. Grb→Garðabær — multi-site companies like Aðalskoðun stay distinct), excludes
  stray reikningar, takes the real `Dags` date (not „Næsta
  skoðun"), `?dedup=1` finds dupes. **Seigla (2026-07-15):** all Drive calls go
  through `driveFetch` (backoff-retry á 403/429/5xx), canonical names
  (fyrirtæki+kt+ár í nafni) are SKIPPED without download/OCR, `?apply=1` renames
  each ready file INLINE per batch (nothing lost on a crash; default limit 2,
  UI uses limit 1) and the UI persists progress in
  `localStorage.bh_uttekt_progress` so a re-run RESUMES from the saved offset
  (live-log + counter instead of one giant table; manual/villur rows kept for
  review). Twin of `reikningar-rename.js` (invoices →
  `Fyrirtæki - kt - R nr - dags - upphæð`, with md5 **and** invoice-number dedup).
- `allt-sheet.js` — builds a sortable "whole database" Google Sheet from the
  úttektarskýrslu *filenames* in a folder (parses `Fyrirtæki - Kennitala -
  Heimilisfang - Ár - Mánuður` — also tolerates the legacy
  `Fyrirtæki - Heimilisfang - Kennitala - Mánuður - Ár` order). `GET /api/allt-sheet[?folder=ID]`.
- **Sheet creation note**: the sheet-building fns (`allt-sheet`, `reikningar-sheet`,
  `samningar-sheet`, `sheet-create`) create the spreadsheet **without a `locale`**
  property — the Sheets API rejects `locale:'is_IS'` with 400 INVALID_ARGUMENT
  ("Unsupported locale"). Don't re-add it.
- **One-click data refresh from Drive** (2026-06-12): `nlsh-update.js` —
  `GET /api/nlsh-update` finds the NEWEST `AjourRegistrationData*.csv` in Drive
  and triggers `ajour-ingest-drive-background` with its fileId (`?status=1`
  polls `app_kv.ajour_ingest_status`); wired to the „🔄 Uppfæra gögn úr Drive"
  button on the NLSH tab (polls + reloads on done). `timavera-ingest-drive.js`
  (newest „vinnufærslur" xlsx → `timavera_entries`, exact twin of
  luna-bridge/timavera-bridge.js: same fuzzy headers + entry_key) and
  `payday-ingest-drive.js` (newest „payday" xlsx → `invoices`, line-level
  export grouped per Reikningur nr.; tilvisun=nr + source='payday' dedup;
  fills kt/gjalddagi/eindagi/greidsla_date; NEVER writes worksite_match) —
  both behind buttons in the Bakendi „🔄 Gagna-uppfærslur úr Drive" section.
- `timavera-pull.js` — **Tímavera API beintenging (2026-07-10)**: pulls work logs
  STRAIGHT from the Tímavera Customer API (`https://api.timavera.is/api/v1`,
  read-only, `Authorization: Bearer tv_live_…`; OpenAPI at
  api.timavera.com/docs/tv-docs-2026/openapi.yaml — endpoints /employees,
  /projects, /worklogs?from&to [ISO, no pagination], /report, /billing/status)
  into `timavera_entries` with the SAME `entry_key` as bridge/Drive
  (`date|employee.lc|project.lc|time_in`, `source_file='timavera-api'`) — all
  three paths interchangeable. Iceland=UTC so UTC clock == wall time; OPEN
  (running) worklogs are skipped until closed. `GET /api/timavera-pull?probe=1`
  (auth check) · `?dry=1&days=N` (map only) · `?days=N|&from&to` (upsert + stamps
  `timavera_meta` + logs `automation_runs('timavera-pull')`). **Key handling:**
  `POST {action:'set-key', key}` stores the key server-side in
  `app_kv['timavera_api_key']` (`has-key`/`clear-key` too); env
  `TIMAVERA_API_KEY` overrides. The key itself was shared via a 1Password link
  (gildir í 30 daga) in the 2026-07-09 email from timavera@timavera.is to
  brunaholf@brunaholf.is — Agnar opens it and pastes into the Bakendi
  „🕒 Tímavera API — beintenging" card (input POSTs set-key, never stored in the
  browser). Registered in Sjálfvirkni as `timavera-pull`. This replaces the
  desktop scraper dependency (c9fbea70 staleness root cause).
- `data-sources-status.js` — `GET /api/data-sources-status` freshness report
  per source (Tímavera/Ajour/bank/invoices/Redder/email). Each source now returns
  both `last_import` (when last SYNCED) **and** `newest_real` (the newest REAL
  data date — e.g. `max(timavera_entries.date)`, `max(ajour.execution_date)`,
  `max(bank.trans_date)`); for time-data sources `age_days`/`status` are based on
  `newest_real` so a file re-imported "today" with old rows is not falsely
  "fresh". Also returns `recent_emails` (5 newest from `email_digest`:
  `{subject, from(=sender_name), sender_email, received_at, account}`). Powers the
  🌅 Dagurinn tab's Samstilling band.
- `gmail-ingest.js` — **Cloud email (Gmail úr skýi), phase 1.** `GET
  /api/gmail-ingest?account=<email>&days=N&dry=1`. Pulls Gmail **straight from
  Google** (Gmail API `users.messages.list q="in:inbox newer_than:Nd"` →
  `messages.get` metadata) into `email_digest`, so the hub no longer needs the
  Thunderbird/luna-bridge desktop path for Google mailboxes. Writes the **exact
  same `email_digest` record shape** as `luna-bridge/bridge.js` (`message_id`,
  `account`, `folder='INBOX'`, `sender_name/email`, `to_addresses`, `subject`,
  `snippet`, `body_preview`, `is_question` [ported `looksLikeQuestion`],
  `has_attachment`, `attachment_names`, `received_at`) and upserts
  `on_conflict=message_id` (no dupes — bridge and cloud are interchangeable).
  `dry=1` returns a preview (counts + sample subjects), writes nothing. `days`
  default 10, max 90. `folder=sent` pulls the SENT mailbox instead (`in:sent`) —
  rows get `folder='SENT'`, `is_question=false`, same `message_id` upsert.
  **Multi-account (2026-07-17):** `google_oauth` now holds a row PER
  mailbox (unique index on `user_email`, id from `google_oauth_id_seq`; row
  `id=1` stays the PRIMARY account that Drive/Sheets use — untouched).
  `/api/google-auth?account=<email>` starts consent with `login_hint`;
  `oauth-callback` saves via `_google.saveTokensFor` (same email as primary →
  id=1, otherwise its own row — NEVER clobbers the Drive token).
  `gmail-ingest?account=<email>` uses `freshAccessTokenFor(email)` when that
  mailbox has its own row, else falls back to the primary with the old 409
  guard. `?accounts=1` lists connections. `_google.js` exports
  `saveTokensFor/loadTokensFor/freshAccessTokenFor/listConnectedAccounts`.
  Bakendi „☁️ Gmail úr skýi": „Tengja" connects AS the email in the input,
  shows all connections, and a „Sent-mappa" checkbox pulls `folder=sent`.
  First use-case: **bokhald@eldklar.is SENT** (týndu Stólpa-reikningarnir
  feb–mars 2026 — sjá Verkborð #690). Next: Microsoft Graph for the
  @brunaholf.is (Office 365) mailboxes.
- **Canonical doc folders (2026-07-05):** all readers now default to ONE folder per
  type — reikningar → **`1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p` "Reikningar - Invoices"**,
  úttektarskýrslur → **`1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg` "Úttektarskýrslur"** (both
  under parent `1ZATA15k…`; also the Drive-flokkun master/reports + Skjalatalning +
  skýrslu-ár defaults). The old split folders (`1TDusB2…` "Slökkvitæki - Reikningar -
  Master" and `11Gf4yU…` "Allt") were retired — `reikningar-read/rename/sheet` +
  `uttekt-rename` + `allt-sheet` all repointed. Þjónustusamningar (`1f2kzXh…`) and
  Redder (`1GXs9fV…`) stay separate (different doc types).
- `reikningar-read.js` + `reikningar-sheet.js` — Bakendi **Reikningalesari** for
  SENT Slökkvitæki invoice PDFs (default folder
  `1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p` = "Reikningar - Invoices").
  `reikningar-read` (`GET ?folder&dry&limit=6&offset`) reads each PDF's *content*
  and extracts **Fyrirtæki · Heimilisfang · Kennitala · Reikningsnúmer (R-…) ·
  Dagsetning · Heildarupphæð**; batched like doc-index; non-dry upserts
  `customer_documents` (doc_type=reikningur; `invoice_number`/`doc_date`/
  `customer_name`/`amount` columns added 2026-06-12, additive). Heildarupphæð =
  largest ISK-formatted figure (grand total ≥ every line). `reikningar-sheet`
  (`POST {folder,rows}`) find-or-creates ONE living summary Sheet
  ("Reikningar – gagnayfirlit") **inside the folder** and overwrites it — the
  database-summary view. UI: 🔍 Lesa / 📊 Skrifa í Google Sheet / ▶️ Skrá í gagnagrunn.
  **Tengist líka á STAÐINN** (2026-07-15): `_spine.resolveSite(f.name, sites, address)`
  — PDF-heimilisfangið er líka sönnun; `fyrirtaeki_id` fer aðeins í upsertið gegnum
  `siteWriteAllowed` (yfirskrifar aldrei réttan stað). Sama gildir um `samningar-read.js`.
- `redder-read.js` — **Redder-lesari** (Efniskostnaður tab): the CLOUD twin of
  `luna-bridge/redder.js`. `GET /api/redder-read?folder&dry&limit=6&offset` reads
  the Redder supplier-invoice PDFs in the Drive folder
  `1GXs9fVXfl_nU2L8xBy_aDIKdiev8lgIt` ("Reikningar — Redder"), parses each
  (Reikningur nr. · Dagsetning · Eindagi · Sölumaður · „Vegna <verkstaður> umb
  <tengiliður>" · Upphæð án vsk / Vsk / Samtals m.vsk — Icelandic `.`=thousands),
  and non-dry **upserts `redder_invoices`** (`on_conflict=invoice_nr`,
  `source='gdrive'`, `drive_file_id` set). `invoice_nr` is **zero-padded to 7**
  (e.g. `0129467`) so the Drive path and the luna-bridge mbox path dedup to the
  same key — the two are interchangeable, no collisions. Worksite via a small
  `ALIAS` map (Strandgata→Fjarðagata etc.); unknown worksite kept as the cleaned
  raw string (still groups) — keep this map in sync with `redder.js` +
  `project_aliases`. Batched by `offset`; UI (`efReadRedder`) is **preview-first**
  (dry → parsed table) then „▶️ Skrá N í gagnagrunn". Reuses `pdf-parse` (already
  in `external_node_modules`) + the `reikningar-read` Drive/OCR-fallback helpers.
  Redirect `/api/redder-read` in netlify.toml.
  **Efnis-vörulínur (2026-07-09):** `extractLines()` þáttar líka vörulínurnar
  (vörunr/heiti/magn/eining/ein.verð/afsl%/upphæð) og skrifar þær í
  `redder_line_items` (wipe+insert per reikning, AÐEINS þegar þáttun fann línur
  — mislestur þurrkar aldrei út góðar línur). Línusniðið er samþjappað
  (`…Hvítt (12)12,00Stk1.547,58  50,00 9.285`) og lýsingin getur endað á tölustaf
  (hanska-stærðir „M-st8") svo magn-skiptingin er reynd á alla mögulega vegu og
  **sannreynd með round(magn×verð×(1−afsl%)) === upphæð**. Form B: línur án
  Afsl%-dálks líma ein.verð+upphæð saman („stk2.217,7417.742" — ,dd afmarkar).
  Kredit-reikningar bera AFTANÁ-mínus („41.458-") → magn/upphæð (og haus-tölurnar
  an_vsk/vsk/m_vsk gegnum `parseIsk`) verða neikvæð. Tilvísanir „V: <staður>" /
  „V/ <staður> umb: <nafn>" / „Vegna: <staður> - Sótt: <nafn>" fylla vegna/tengilið
  þegar gamla „Vegna X umb Y" formið vantar. Sannreynt 65/65 PDF í möppunni:
  Σ línu-upphæða === Upphæð án vsk á hverjum einasta. Þar með getur Gerð Reikninga
  Efnislisti-autofillið (`matchVerdskra` á `item_name`) loks unnið úr Drive-lesnum
  reikningum — áður skrifaði Drive-leiðin engar línur (0 af 65).
- `uttekt-upload.js` — **App→Drive brú fyrir úttektarskýrslur** (`POST
  /api/uttekt-upload`): Slökkvitæki-appið (patch 233) vistar app-gerðar
  úttektarskýrslur aðeins í Supabase bucket — þessi endapunktur tekur við
  `{kt, fyrirtaeki_id?, company, address?, year, month?, filename?,
  pdf_base64?|public_url?}` (public_url = aðal-leiðin, max ~10 MB, %PDF-vörn),
  setur AFRIT í kanónísku Úttektarskýrslur-möppuna (`1VSRRw6O…`) undir
  uttekt-rename nafnavenjunni `Fyrirtæki[ - Heimilisfang] - kt - Ár[ - mánuður]
  [ - #fyrirtaeki_id].pdf` og upsert-ar `customer_documents`
  (doc_type=uttektarskyrsla; base find-or-create eftir kt). Idempotent: sama
  nafn í möppunni → files.update (ný revision, aldrei annað eintak); til
  (fyrirtaeki_id, year) röð → drive_file_id hennar uppfært + ` · app-útgáfa
  <dags>` í notes; 409 á drive_file_id → sótt fyrirliggjandi id. Svar
  `{ok, drive_file_id, doc_id, name, updated, fyrirtaeki_id, resolved_via?}`.
  CORS `*` (m.a. slokkvitaeki.netlify.app); generic `/api/*` redirect dekkar slóðina.
  **Staðar-herðing (2026-07-24):** ef appið gefur EKKI `fyrirtaeki_id` leysir
  brúin hann úr STÖÐUM félagsins (sömu kt) gegnum `_spine.resolveSite` (#id-stimpill
  / eini staðurinn / heimilisfang → nákvæmlega EINN stað); enginn match → óbreytt
  (null), aldrei giskað. Þar sem `resolveSite` skoðar aldrei annað en staði
  ÞESSARAR kt getur app-skýrsla ALDREI ratað á fyrirtæki með svipað nafn undir
  annarri kt (rótin að „Hamraborg 7"→„Hamraborg ehf" ruglingnum). Leyst
  `fyrirtaeki_id` fær líka ` - #<id>` stimpil í skráarheitið svo framtíðar-lesarar
  tengja beint (`via:'stamp'`). App-gefið `fyrirtaeki_id` er treyst óbreytt.
- `match-station.js` — **🔗 Skýrslu-stöð** (Bakendi top): a human-in-the-loop board
  to assign each `customer_documents` row (úttektarskýrsla/reikningur) to the RIGHT
  service-customer **location (`fyrirtaeki_id`) + year**. Built because an earlier
  auto-renamer mangled ~1/3 of filenames (the „uttekt-master / MATCH 90" rows), so
  the **filename can't be trusted** — the board surfaces the actual **PDF (Drive
  view link)** + a *suggested* site (address-match, non-authoritative) and only
  writes what the user **confirms** (`reviewed=true`). Pure Supabase (no Drive/PDF):
  `GET /api/match-station` (service companies + counts) · `GET ?base=ID` (one
  company → `{company, locations, docs[]}`) · `POST {action:'save', id,
  fyrirtaeki_id, year, is_duplicate, reviewed}` (PATCH one doc) · `POST
  {action:'add-site', base_id, nafn, heimilisfang}` (create a missing
  `fyrirtaeki` location) · `POST {action:'delete', id}` (remove ONE tracking row —
  e.g. a confirmed duplicate; the Drive file is kept). Added
  `customer_documents.reviewed bool` + `reviewed_at` (additive). `er_i_thjonustu`
  service companies drive the picker. The board **splits docs into 📄
  Úttektarskýrslur vs 🧾 Reikningar** (never mixed). Suggestions carry a
  **confidence**: `high` (single-site, or street+postcode address match) is
  amber + bulk-connectable via „🔗 Tengja öll augljós"; `low` (a name/parenthetical
  hint off a mangled „uttekt-master" name — incl. the `(V Hringbrautar)` 2023
  batch) is a dashed „tillaga?" that pre-fills but is **excluded from bulk-connect**
  (open the PDF + confirm). Per-row 🗑 removes a row; „✓ Staðfesta öll tengd"
  bulk-marks reviewed. NB a blind duplicate purge is unsafe — the 52 flagged
  „dups" include distinct sites mis-addressed to one location (Pizzan 2023,
  Center Hótel Arnarhvoll), so dedup is by-eye via 🗑.

- `skyrslu-vakt.js` — **🚨 Skýrslu-vakt** (`/api/skyrslu-vakt`): fastur vörður yfir
  skýrslu-þekju per stað — ef staður rekstrarfélags gleymist er samningurinn í
  hættu. Les Postgres-sýnina **`v_stadir_skyrslu_stada`** (ein röð per lifandi
  stað í þjónustu: base/félag/kt/staður/heimilisfang/`sites_i_felagi`/
  `report_year`/`stada`, þar sem `stada ∈ engin_skyrsla·olesanleg·gomul·ok`).
  GET skilar `{counts, rows}` — rows = allar EKKI-ok raðir raðaðar engin_skyrsla
  → olesanleg → gomul, rekstrarfélags-hópar fyrst. **Rekstrarfélags-hópun
  (2026-07-15):** sýnin ber líka `rekstrarfelag` (merkið á `customers_base` —
  Eignaumsjón spannar 59+ staði þvert á margar kt) og `felag_stadir` (fjöldi
  þjónustu-staða yfir allt MERKIÐ þegar það er sett, annars per base). Hópur í
  endapunktinum = rekstrarfélags-merki EÐA `sites_i_felagi>1`; hópum raðað eftir
  stærð (`felag_stadir` desc). UI: Bakendi-spjaldið „🚨 Skýrslu-vakt" (4
  talnapillur + tafla með **hópa-hausum per rekstrarfélag** — merki + 📍N staðir
  + hve marga vantar — staðir inndregnir undir, stakir staðir á eftir,
  `wireSkyrsluVakt`) + viðvörunarlína á 🌅 Dagurinn (birtist AÐEINS þegar
  engin_skyrsla+olesanleg > 0, smellur opnar Bakendi). Lagfærist í Skýrslu-stöð.
- `service-gaps.js` — **🕵️ Gleymt að skrá í þjónustu** (`/api/service-gaps`): ÖFUG
  hlið á Skýrslu-vaktinni — fyrirtæki sem EIGA úttektarskýrslu/brunakerfi/þjónustu-
  samning (`customer_documents`) EN enginn lifandi staður þeirra er merktur
  `er_i_thjonustu` = líklega gleymt að skrá í þjónustu. Les Postgres-sýnina
  **`v_service_gaps`** (rollup per base: base_id/nafn/kt/rekstrarfelag/skyrslur/
  samningar/nyjasta_ar/lifandi_stadir, `grant select to anon`; sjá
  `sql/2026-07-27_v_service_gaps.sql`). **LES LIFANDI (engin skyndiminni)** svo
  listinn sé áreiðanlegur meðan verið er að endurlesa/tengja. TVEIR flokkar: **A**
  `rows` (base á skrá, á skjöl, EN enginn staður í þjónustu; `flokkur` med_stad =
  bara vantar merkinguna | an_stadar) + **B** `unlinked` (þjónustu-skjöl EKKI tengd
  neinum base — kt ekki á skrá / ótengt — svo ekkert falli á milli; 57 við útgáfu).
  `GET` → `{counts:{linked_total,med_stad,an_stadar,unlinked}, rows, unlinked}` ·
  `GET ?base=ID` → `{docs,sites}` **drill-down til að SANNREYNA** (nákvæmlega hvaða
  skjöl m/Drive-tenglum + staðir) · `POST {action:'mark-service', base_id}` merkir
  ALLA lifandi staði base `er_i_thjonustu=true` (afturkræft). Tvær sýnir: Bakendi-
  spjald „🕵️ Gleymt að skrá í þjónustu" (`wireServiceGaps`, talnapillur + A-tafla +
  hlekkur á sér-síðu) OG **sjálfstæð sér-síða `thjonusta-gloppur.html`** (les lifandi,
  útvíkkanlegar raðir m/skjala-/staða-drill-down til sannreyningar + B-listi).
  (38 í flokki A við útgáfu: 20 með stað, 18 án; 57 ótengd í flokki B.)
- `felag-endurlestur.js` — **„🔁 Endurlesa öll skjöl (innihald)"** (`/api/
  felag-endurlestur`), hnappur í haus Skýrslu-stöðvar-borðsins per félag. Les ÖLL
  `customer_documents` eins base úr Drive (pdf-parse → Google-Doc OCR fallback,
  `driveFetch`-backoff), flokkar úr INNIHALDI (slökkvitæki-úttekt [Fjöldi-línur] ·
  **brunakerfi** [viðtökupróf/árleg prófun, engin slökkvitæki — NÝTT additive
  doc_type gildi, sjá `sql/2026-07-15_doc_type_brunakerfi.sql`; skýrslu-lesarar
  sía `uttektarskyrsla` svo brunakerfi-skjal hættir réttilega að teljast] ·
  reikningur [R-nr/„til greiðslu"]), les rétt ár+mánuð (Dags, ekki „Næsta
  skoðun") og með `&apply=1` leiðréttir `year`/`doc_type`/`fyrirtaeki_id`.
  Staðurinn fer gegnum Tengiregluna (`_spine.resolveSite` + `siteWriteAllowed`)
  **plús nafna-sönnun `via:'name'`** (Agnar: „endurtengja á address … eða
  heiti"): sameiginlegt forskeyti staða-nafna klippt („Center Hótel Plaza" →
  „plaza") og NÁKVÆMLEGA EITT aðgreinandi nafn í skráarheiti/PDF-texta = sönnun;
  0 eða 2+ → ósnert. Eftir lotu: nýjasta slökkvitæki-skýrsla hvers staðar →
  upsert **`arsskodun_report_facts`** (PK fyrirtaeki_id; equipment 9-bucket
  jsonb, Fjöldi-lógíkin er SAMEIGINLEG í `_bunadur.js` — líka notuð af
  `skyrsla-bunadur.js`; aldrei yfirskrifað með eldri skýrslu). **CO2-gildran
  (2026-07-16, `_bunadur.js`):** pdf-parse brýtur ₂-subscriptið í „Co₂" á eigin
  línu („Slökkvitæki Co\n2\n 2 kg. Fjöldi: …") svo línu-bundnu regexin misstu
  ALLAR CO2-línur → co2_2/co2_5 kerfisbundið 0 í facts. `normalizeText` límir
  brotið saman (+NBSP/₂), CO2-merkið þolir að „Slökkvitæki"-forskeytið vanti
  („Kolsýrutæki 5 kg") og stærðarlaus CO2-lína fer í co2_5 — aldrei tvítalin í
  duft6_12-remainder. ~184 staðir þurfa facts-endurkeyrslu eftir deploy (listi:
  co2-rerun-list, sjá PR). `GET ?base=ID[&offset&limit=2][&apply=1]` →
  `{base,total,offset,nextOffset,rows:[{id,file,verdict,year,site,via,changed}],
  counts,facts_updated}`; batchað (~8s vörn), UI lykkjar með live-log +
  localStorage framvindu (`bh_felag_endurlestur`, `rereadFelag` í index.html).
  Skráð í Sjálfvirkni sem `felag-endurlestur` (sjálfvirkt í lok apply-yfirferðar).
- `kt-samraeming.js` — **Bakendi „🧩 Kt-samræming"** (`/api/kt-samraeming`): closes the
  last gaps in the customer spine (`customers_base` root → `fyrirtaeki` locations →
  `vidskiptavinir`) **additively — never deletes/merges a location**. `GET` returns three
  worklists: **kt-less live fyrirtaeki** (no kennitala AND no `customer_base_id`),
  **multi-location kts** (one kt across >1 live `fyrirtaeki` = rekstrarfélög með marga
  staði; flags `same_address` when ≥2 sites share one address), and **vidskiptavinir gaps**
  (unlinked / no-kt). `POST` actions: `set-kt` (set `fyrirtaeki.kennitala` + find-or-create
  base by kt + link `customer_base_id`), `link-base`, `create-base` (find-or-create),
  `relabel` (fix a mislabelled site nafn/heimilisfang), `flag-note` (mark a site for review
  via `banner_note`). Bakendi card + `wireKtSamraeming` in index.html. Service role.
- `hreinsi-bord.js` — **Bakendi „🧽 Hreinsi-borð"** (`/api/hreinsi-bord`): safe, additive,
  idempotent **batch reconnect of `customer_documents` to the spine**. Never deletes a doc,
  never flags a duplicate (that stays by-eye in Skýrslu-stöð), never touches a location.
  `GET` computes preview buckets from a full snapshot; `POST {action:'apply',bucket,ids}`
  **recomputes server-side** so apply always matches the preview. Buckets: `reconnect`
  (fyrirtaeki_id null · kt-in-notes → exactly ONE live fyrirtæki → set it +base), `base_link`
  (cb null · kt already in base → set cb), `base_missing` (kt not in base → create base +
  link), `deleted_ptr` (fyrirtaeki_id → soft-deleted row → repoint to lone live sibling else
  clear, keep base), `dangling` (fyrirtaeki_id → no row → clear), `bad_year` (year <2005 or
  >next year → null). `reconnect_many` (kt → several live sites), `reconnect_conflict`
  (doc's base kt disagrees with a second kt in notes), `bad_kt` (implausible/corrupted kt
  in notes — `ktShapeValid` guards it, so a base is NEVER minted for a garbage kt), and
  `bad_year` are all COUNT/surface-only → handed to Skýrslu-stöð. **Run history (2026-07-05):**
  reconnect 372, deleted_ptr 72, dangling 1 applied live (445 docs reconnected); base_missing
  ran via SQL with the same ktShapeValid guard → 73 new `customers_base` rows (ids 962-1034,
  7 misleading auto-names reset to `kt …` placeholders) + 92 docs linked; docs-without-base
  164→72. Remaining: reconnect_many 26 · reconnect_conflict 1 · bad_kt 1 (VR-5) · bad_year 3 ·
  ~970 mangled names → all by-hand in Skýrslu-stöð. Bakendi card + `wireHreinsiBord` in
  index.html. Service role.

- `relink-docs.js` — **Bakendi „🔗 Dauðir skjala-linkar"** (`/api/relink-docs`): when
  files were MOVED into the two master folders and old copies deleted in cleanup,
  `customer_documents.drive_file_id` kept pointing at the deleted copy → dead link.
  Lists both masters (reikningar + úttektarskýrslur), builds R-number→file (reikn.)
  and kt|year(+addr)→file (skýrslur) lookups, and for every doc whose `drive_file_id`
  is NOT in a master, finds the right master file and relinks. **Multi-site guard:**
  reikningar match on the unique R-number (right file regardless of site); skýrslur of
  a **rekstrarfélag (>1 live fyrirtaeki: Pizzan/Colas)** must ALSO match the site's
  `heimilisfang` (fyrirtaeki_id) — no unique address match → „óviss", never cross-linked.
  `GET ?dry=1` → summary + FULL `ambiguous`/`unmatched` lists (each enriched: base
  nafn · site · year · dead fid · candidate master files) rendered as a picker in the
  Bakendi card. `GET ?apply=1[&flagdups=1]` → relinks (parallel chunks) + optionally
  flags collisions `is_duplicate`. `POST {action:'set',id,drive_file_id}` → manual pick
  of the right master file for one óviss/unmatched doc (409 on UNIQUE collision). NB
  Skýrslu-stöð assigns site+year but does NOT repair dead drive_file_ids — THIS does.
  Run history (2026-07-13): 149 relinked + 177→170 collisions flagged; 6 multi-site
  relinks all reikningar (0 skýrslur crossed). Bakendi card + `wireRelinkDocs` in
  index.html; redirect in netlify.toml. Service role + `_google.freshAccessToken`.
  **Recursion (2026-07-22):** `listFolder` now WALKS the master tree (subfolders
  too), so when a master is split into `<ár>/` subfolders (Skjalavörsla) a file
  living at `master/2023/…` stays in `masterIds` — otherwise relink-docs would see
  the live file as a dead link and false-cross-link it. Folders themselves are never
  returned; behaviour is identical when there are no subfolders.

- `drive-dedup.js` — **Bakendi „🗂️ Drive tvítekningar"** (`/api/drive-dedup`): pick any
  Drive folder → lists files with **duplicate names** (groups by name with the extension
  and a trailing `(1)/(2)` copy-suffix stripped, case-folded). `GET ?folder=ID[&cap=N]`
  returns the duplicate groups (one keeper per name — prefers the copy WITHOUT a `(n)`
  suffix, else oldest `createdTime` — plus the extra copies to move); `cap=100` stops after
  the first 100 duplicate files. Human-in-the-loop: the UI shows the list for confirmation,
  then `POST {action:'move', fileIds:[…], trashFolder}` **moves** (never deletes) each copy
  into the bin folder (default `1CnnNHm1xCukiTs806z9Ha1nZnSELM9k8`) via Drive
  `files.update` (addParents=trash, removeParents=current). Reuses `_google.freshAccessToken`.

- `drive-sort.js` — **Bakendi „🧹 Drive-flokkun"** (`/api/drive-sort`): resilient,
  slow-&-steady pipeline for a messy source folder of mixed PDFs. `GET
  ?src=&master=&reports=&dupes=&other=[&limit=2][&rename=1][&dry=1]` reads a FEW
  files per call with the **OCR reader** (pdf-parse → Google-Doc OCR fallback, the
  reliable path for dkPlus PDFs) and MOVES each immediately, so a freeze never loses
  more than the file in hand (resumable — sorted files leave `src`). Only
  **Slökkvitæki-issued** docs (issuer kt 600508-0400) are kept: reikningur (has an
  R-number) → rename → master + link `customer_documents`; úttektarskýrsla (report
  wording, no R-nr) → rename → reports + link (doc_type `uttektarskyrsla`); a copy of
  an already-recorded doc → dupes (delete folder); everything else (vendor bókhald,
  Nóta, mbox, …) → other (óflokkað). Dedup by invoice number (reikn.) or (base,year)
  (skýrsla). Reuses `_google.freshAccessToken`. UI loops 2-at-a-time until `done`.
  **Subfolders (2026-07-05):** `recurse` (default ON) walks the whole folder tree
  — files anywhere under `src` get sorted (each keeps its own `parents`, so a move
  lifts it straight out of its subfolder); `done` covers the whole tree. `recurse=0`
  restores flat, direct-children-only behaviour. Folders themselves are never moved.
  **Tengist líka á STAÐINN** (2026-07-15): báðar greinar (skýrsla + reikningur) nota
  `_spine.resolveSite` (skýrslur fá `siteFrom(text)` sem auka-sönnun) og skrifa
  `fyrirtaeki_id` aðeins gegnum `siteWriteAllowed`; endurnefnd skýrsla með þekktan
  stað fær ` - #<fyrirtaeki_id>` stimpilinn aftast (reikninga-nafnasniðið óbreytt —
  R-nr er lykillinn).

- `drive-multitool.js` — **Bakendi „🧰 Skjala-multitool"** (`/api/drive-multitool`):
  sameinaða skjala-tólið — READ **og** WRITE, tveir hamir sem sameina með tímanum
  Skjalalestur · Drive-flokkun · Drive tvítekningar · Endurnefna skýrslur · Skjalavörsla.
  Endurnýtir sönnuðu frumaðgerðir drive-sort (move/rename via `files.update`,
  `upsertDoc`, dedup-uppfletting) + `_spine` (`sitesForBase`/`resolveSite`/
  `siteWriteAllowed`/`siteStampFromName`).
  - **Fasi 1 — GET (les-eingöngu forskoðun):** `?src=&recurse=&limit=3&offset=N[&order=]`
    → OCR-flokkar hvert PDF og skilar TILLÖGU per skrá (`doc_type · base/site ·
    proposed_name · target · already_linked`). FÆRIR EKKERT, SKRIFAR EKKERT.
    `order` (UI-veljari „Röð", geymt í `localStorage.multitool_order_v1`): `name`
    (sjálfg. A→Ö) · `new` (nýjast BÆTT við fyrst, createdTime desc) · `name-desc`
    (öfug nöfn). `new` gerir kleift að lesa AÐEINS nýbættar skrár (t.d. 100 nýjar í
    1100-skjala möppu) án þess að endur-OCR-a allt — `createdTime` bætt í fields.
  - **Fasi 2 — POST `{action:'apply', id, doc_type, base_id, year, invoice_number,
    site_id, proposed_name, targetFolder, linkMode}`** (eyðileggjandi, EITT skjal
    sem UI rekur af yfirfarnu forskoðuninni — aldrei blint bulk-sweep): (1)
    endurnefnir í `proposed_name`, (2) **FÆRIR** (relocate) í `targetFolder` gegnum
    `files.update` addParents/removeParents, (3) tengir `customer_documents` eftir
    `linkMode`. Endurnefning+færsla gerast óháð `linkMode`; aðeins DB-tengingin er
    hlið-stýrð. Skilar `{ok, id, renamed, moved, linked, linkAction, conflict, doc_id}`.
  - **`linkMode` (þrír hamir):** `warn` (SJÁLFGEFIÐ, öruggast) — ef tengill fyrir
    lykilinn er þegar til á ANNARRI skrá → `conflict:true, linkAction:'conflict'`,
    EKKERT tengt (skrifar aldrei í hljóði; UI birtir mannin til að leysa). `if_empty`
    — tengir aðeins ef enginn tengill er til; annars `linkAction:'skipped_exists'`,
    ósnert. `overwrite` — beinir fyrirliggjandi lykil-röð á ÞESSA skrá (fall-back
    upsert á `drive_file_id` við einkvæmnisárekstur). Lykill = `invoice_number`
    (reikningur) · `(customer_base_id, doc_type, year)` [+ `fyrirtaeki_id` fyrir
    rekstrarfélag með >1 lifandi stað] (skýrsla/brunakerfi/samningur).
  - **Öryggis-samningur (allur útfærður):** ekkert án `action:'apply'`+`id` (GET
    er les-eingöngu); **ALDREI `files.delete`** — tvítök eru FÆRÐ í ruslmöppu;
    idempotent (rétt nafn→engin endurnefning · þegar í markmöppu→engin færsla ·
    upsert á `drive_file_id`); `vendor`/`other` hvorki færð né tengd nema UI sendi
    þeim markmöppu vísvitandi (og ALDREI tengd í customer_documents); markmöppu
    vantar → færsla sleppt (endurnefna+tengja samt); hver villa skilar
    `{ok:false,error}` fyrir ÞÁ skrá (kastar aldrei hálf-kláruðu); hvert apply skráð
    í **`override_log`** (`field='multitool_apply'`, old=upphaflegt nafn,
    new=proposed+target+linkAction). Hæsta áhætta: rangur `linkMode:'overwrite'`
    beinir lykil-röð á ranga skrá — því er `warn` sjálfgefið og aldrei skrifað án
    ótvíræðs vals; jafnvel þá er skráin bara FÆRÐ (afturkræft), ekkert eytt.
  - **UI (Bakendi-spjaldið):** linkMode-rofi (warn sjálfgefinn), markmöppu-reitir per
    tegund (reikningar-master · skýrslur · samningar · **brunakerfisskýrslur** ·
    **brunakerfis reikningar** · rusl, með 📁 Velja picker), hak per röð (sjálfgefið
    valið fyrir okkar tegundir; vendor/other/villa afvalin+óvirk) + „▶️ Keyra valið (N)"
    sem POST-ar valdar raðir í röð (samhliðni ≤2) með lifandi framvindu + niðurstöðu
    per röð (✓ fært+tengt / ⚠ árekstur / ✗ villa / — sleppt) + „⏸ Stöðva"; virðir
    „Stöðva eftir N" þakið. **Skrá-nafnið í forskoðuninni er tengill** → opnar PDF-ið í
    Drive (`drive.google.com/file/d/<id>/view`) svo hægt sé að skoða skjalið fyrir apply.
  - **Brunakerfi — TVÆR markmöppur (2026-07-26):** skýrslur (doc_type `brunakerfi` →
    target `brunakerfi-skýrslur`) og reikningar (doc_type `reikningur` + sub_hint
    `brunakerfi-reikningur` → target `brunakerfi-reikningar`) fara í SITT hvora möppuna;
    brunakerfis-reikningur fellur á reikningar-master ef sú mappa er ekki fyllt.
    Brunakerfis-reikningur greinist AÐEINS á sterku fire-alarm-orðalagi
    (`brunaviðvörunarkerfi`/`ársskoðun brunakerfis`/`brunakerfis…`) — ekki hverju stöku
    „brunakerfi"-orði. Samningar fá nafn `Fyrirtæki - kt - (þjónustu|brunakerfis)samningur - ár`.
  - **Kaupanda-kt (2026-07-26):** `customerKt` sleppir NÚ bæði útgefanda-kt (600508-0400)
    OG kt undirritaðs Slökkvitæki-fulltrúa („Fyrir hönd Slökkvitækja ehf … Frank Höybye
    kt: 080379-5019" er ekki kúnninn) og kýs kt í kaupanda-blokk („Nafn: <félag> … kt:").
    `allKts` þolir bil við bandstrik („510809 - 0170" úr form-línum).
  - **Tvítök (2026-07-26):** UI hópar raðir eftir tillögu-nafni; aukaeintök (sama nafn)
    fá 🔁-merki + „🗑 Færa aukaeintök í rusl"-hnapp. POST `{action:'move-dupe', id,
    targetFolder}` FÆRIR eintakið í ruslmöppu (engin endurnefning/tenging/eyðing, afturkræft;
    heldur einu — helst þegar-tengda — í hverjum hópi). Skráð í override_log.
  - **Standalone-síða `multitool.html` (2026-07-26):** full-breidd útgáfa á eigin síðu
    (`brunaholf.netlify.app/multitool.html`, tengt af Bakendi-spjaldinu) af því tólið var
    of þröngt í 2-dálka Bakendi-grindinni (nöfn ólæsileg). Tveggja-glugga útlit: vinstra
    megin skjala-listinn (full breidd, læsileg nöfn), hægra megin **PDF-forskoðun í iframe**
    (`drive.google.com/file/d/<id>/preview`) sem uppfærist við að smella á röð eða fletta
    með ◀ ▶ / örvatökkum. Sami `/api/drive-multitool` endapunktur + sama apply-lógík
    (linkMode, markmöppur, Keyra valið ≤2 samhliða). Auka: **möppu-tenglar** (localStorage
    `multitool_folders_v1`) — vista Drive-möppur sem flýtileiðir (setja sem uppsprettu +
    forskoða / opna í Drive) til að skipuleggja. Bakendi-spjaldið er áfram til en vísar á síðuna.
    **Líka innfelldur SPA-flipi `multitool`** (🗂️ Skjala-multitool í hliðarstiku, fyrir ofan
    Bakendi; `renderMultitool` fellir `/multitool.html` inn í `#view` sem full-hæðar iframe —
    endurnýtir sömu síðu, enginn tvíverknaður). Bætt í `DEFAULT_STATE.tabs` + `ensureNewTabs`
    + dispatcher eins og aðrir flipar; deep-link `#multitool`.
  - **Röðun + fljót tvítaka-hreinsun + edit-vernd (2026-07-27):** „Röð"-veljari
    (`?order=name|new|name-desc`, geymt í `localStorage.multitool_order_v1`) — `new`
    (createdTime desc) les AÐEINS nýbættar skrár svo ekki þarf að endur-OCR-a allt.
    „🗂️ Tvítök (nöfn)"-hnappur opnar glugga sem endurnýtir `/api/drive-dedup` (les BARA
    nöfn, engin OCR, strípar `(1)/(2)`, færir aukaeintök í rusl — sjá drive-dedup.js).
    `paint()` varðveitir nú ó-vistaðar breytingar í opnum „✏️ Leiðrétta"-ritli (`__draft*`)
    + fókus/bendil við endur-teikningu, svo næsta forskoðunar-lota sópi þeim ekki burt.
    „ekki tengt" statusinn er rauð pilla (⛔).
  - **Leiðréttingar + villuskýrsla (2026-07-26):** hver forskoðunar-röð fær „✏️ Leiðrétta"
    hnapp sem opnar innfelldan ritil (Tegund · Ár · Nafn · Athugasemd). „💾 Vista leiðréttingu"
    (1) uppfærir röðina svo „Keyra valið" noti leiðréttu gildin (breytt tegund → ný markmappa
    gegnum `TARGET_LBL`, `site_id` hreinsað ef ekki-okkar tegund) OG (2) skráir í nýja töflu
    **`multitool_corrections`** (tillaga tólsins vs leiðrétting notandans + athugasemd; service
    role skrifar, RLS af). POST `{action:'log-correction', …}` snertir EKKERT í Drive — bara
    skráning. „📋 Leiðréttingaskrá" hnappur efst opnar viewer (`GET ?corrections=1&limit=N`,
    nýjast fyrst) svo hægt sé að yfirfara og stilla flokkarann/nafnasmíðina út frá raunverulegum
    villum. Ritillinn breytir röðinni AÐEINS við vistun (án vistunar → apply notar upprunalegu
    tillöguna, engin þögul gliðnun). NB v1 leiðréttir nafn/tegund/ár — base/staðar-tenging er
    áfram Skýrslu-stöðvar-verk.
  - **Gamlir „Stolpi"-reikningar greindir sem OKKAR (2026-07-26):** Slökkvitæki-útgefnir
    reikningar úr gamla Stolpi-kerfinu (skráarnöfn eins og `…bokhald-Nóta.pdf` /
    `Stolpi_Invoice_10xxxx.pdf`) lentu ranglega í vendor/óflokkað því `slokkviIssuer`
    náði ekki seljanda-merkinu í OCR. Hert: (1) `slokkviIssuer` þolir bert `98107`
    (seljanda-VSK, OCR sleppir stundum „VSK nr."-forskeytinu — kaupanda-VSK er ALDREI
    prentað svo 98107 = við erum seljandi, óhætt) OG fellur á Slökkvitæki-þjónustulínur
    (`slokkviServiceLines ≥2`: léttvatn · skýrslugerð og vottun · yfirferð/hleðsla
    Co2/duft/kolsýra · handslökkvitæki — okkar vörulisti, birt AÐEINS á reikningi sem
    VIÐ gefum út). (2) Ný classify-grein 2b: `!inv && issuerOurs && „reikningur"-orðalag
    && !isReport` → reikningur (invoice_number null) svo hann lendi í reikningar-master
    + tengist þótt R-nr misfórst í OCR. ÖRUGGT: issuerOurs er seljanda-eingöngu, svo
    birgja-reikningur TIL okkar (ber okkar kt í kaupanda-blokk en hvorki 98107 né
    þjónustulínur) helst vendor. Sannreynt á Babalú R-104339 (hreint + gallað OCR) +
    mótdæmi (birgja-reikningur → áfram vendor). **Hert (Agnar 2026-07-26):** veika
    þjónustulínu-fallbackið (`slokkviServiceLines ≥2`) krefst NÚ að **Akstur EÐA
    Skýrslugerð** sé á reikningnum (`hasAksturOrSkyrsla`) — þessar tvær einkennislínur
    eru á nær öllum okkar þjónustureikningum en aldrei á birgja-reikningi til okkar.
    98107-seljanda-merkið stendur áfram eitt sér (óháð þessu).
  - **„Annað / óflokkað"-markmappa (2026-07-26):** nýr markmöppu-reitur `tf-annad`
    (📦 docs · sheets · innkaup) fyrir vendor/other skjöl. `targetFor` beinir
    vendor+other þangað; þegar reiturinn er fylltur verða vendor/other raðir VALANLEGAR
    (opt-in, sjálfgefið ÓVALIÐ — okkar tegundir áfram sjálfvaldar) svo hægt sé að SÓPA
    óskyldum birgja-/bókhalds-/innkaupa-skjölum í eina Annað-möppu. Bakendinn færir
    vendor/other AÐEINS þegar markmappa fylgir og TENGIR þau ALDREI í customer_documents
    (óbreyttur öryggis-samningur). Reiturinn geymist í `localStorage.multitool_tf_annad_v1`.

- `drive-count.js` — **Bakendi „📊 Skjalatalning"** (`/api/drive-count`): read-only
  file counter for the reikningar (master) + skýrslur Drive folders, broken down
  **per year** (parsed from each file name via a `20\d\d` / date regex). `GET
  ?reikningar=<id>&skyrslur=<id>[&recurse=0]` walks each folder tree (recurse
  default ON), tallies non-folder files by year, returns
  `{ folders:{ reikningar:{total,pdf,subfolders,byYear}, skyrslur:{…} } }`. UI is a
  per-year table + a „↻ Uppfæra talningu" manual-refresh button (defaults to the
  Drive-flokkun master/reports folder ids). No move, no DB write.
- `skyrslu-ar.js` — **Bakendi „🔎 Lesa ár á skýrslur án árs"** (`/api/skyrslu-ar`):
  many úttektarskýrslu file names carry NO date (`Torfufell 50 111 Reykjavík -
  481074-1349.pdf`) → counted as „óþekkt". These reports are app-generated PDFs
  with a real TEXT LAYER (`…yfirfarin af Slökkvitæki ehf í nóvember 2025`), so this
  reads the date with **pdf-parse (NO OCR — no Google-Doc copy)** and **renames**
  the file appending „ - <ár> - <mánuður>" (same „Dags"/„{mánuður} {ár}"-not-„Næsta
  skoðun" logic as `uttekt-rename`). Batched (`?limit=4`, default folder = skýrslur);
  the Skjalatalning card loops it until done, then re-counts. Read + rename only.
- `skjalavarsla.js` — **Bakendi „🗂️ Skjalavörsla"** (`/api/skjalavarsla`): files every
  doc into a `<ár>/` subfolder (2024/, 2025/…, óþekkt/) under a canonical folder by
  the **year in its NAME** (cheap — NO OCR, NO rename). Optional `src` = an old folder
  → its files are **moved** into `dest/<ár>/` (names KEPT, so well-named files are not
  downgraded). `GET ?dest=<canonical>[&src=<old>][&dupes=<bin>][&limit=20][&dry=1]`,
  batched; the UI loops with 👁 dry preview + ▶️ run. **Dedup is by exact filename
  within a year folder** — so multi-address kts (rekstrarfélög with several sites, whose
  names carry different addresses) are NEVER collapsed; only true same-name copies go to
  the bin. NB it trusts the filename year; run `skyrslu-ar` (and any OCR-rename) FIRST so
  names are reliable before filing.
- `pdf-split.js` — **Bakendi „✂️ Skipta PDF í stakar síður"** (`/api/pdf-split`): splits a
  big Drive PDF (e.g. 70 pages) into one-page PDFs written BACK to Drive, into a new
  `„<nafn> - stakar"` subfolder beside the source (or under a given `dest`). `GET
  ?file=<id|url>[&dest=<parentFolder>][&folder=<destSubfolder>][&offset=N][&limit=M]`
  — batched/resumable like drive-sort (first call creates the subfolder + returns its
  id; UI loops passing `folder`+`nextOffset` until `done`, ~8 pages/call). Uses
  `pdf-lib` (added to deps + `external_node_modules`) + `_google.freshAccessToken`;
  re-reads the (small/medium) source per batch; read+create+upload only, no DB. The
  Bakendi card also has a **local browser mode** (úr tölvu → ZIP) via client-side
  `pdf-lib`+`JSZip` — no Drive, nothing sent to the server.

### Email
- `email_digest` (~29k rows): all emails from connected Gmail accounts
  (`Brunaholf@brunaholf.is`, `aggisigurds@gmail.com` etc.). Used for
  Inbox + Spurningar tabs and worksite email-mention matching.
- `email_actions`: per-email triage state (status/priority/notes) for
  Spurningar.
- **Three ingest paths into `email_digest` (interchangeable — same `message_id`
  dedupe):** (1) the desktop **luna-bridge/bridge.js** (Thunderbird mbox →
  upsert, runs every 15 min on the Windows tölva); (2) **cloud** —
  `gmail-ingest.js` (`/api/gmail-ingest`) pulls Gmail directly via the Gmail API
  (no desktop needed); (3) **browser-bridge** — the `Brunahólf · Mail Pulse`
  Chrome extension (in `extension/`) scrapes opna Gmail/Outlook flipa and POSTs
  to **`/api/email-ingest-browser`** (auth via `X-Brunaholf-Token` header
  matching `EXTENSION_INGEST_TOKEN` env). Stable `message_id` =
  `browser:<sha256(account|sender|subject|received_at)>[:32]` so re-scans
  upsert the same row; `source_path='browser-extension'`. The three paths
  coexist without collision (RFC822 ids vs Gmail-API ids vs `browser:` prefix).
  The cloud direction is: **Gmail API now** (Google
  mailboxes, eldklar@eldklar.is first), **Microsoft Graph later** for the
  Office-365 @brunaholf.is mailboxes. Goal is to stop depending on the
  bridge-tölva being on (which the 🌅 Dagurinn tab flags when email is ≥2 days
  stale).
- **SENT-ingest (2026-07-10):** the digest also carries the company's OWN
  outgoing mail — `luna-bridge/bridge.js` reads each account's sent mbox
  (`[Gmail].sbd/Sent Mail` / `Sent` / `Sent Items`, skipped when missing) and
  `gmail-ingest.js` takes `folder=sent`. SENT rows land with `folder='SENT'`,
  `is_question=false` (same `message_id` dedupe), so answered/unanswered state
  can be computed downstream. Inbox-style consumers filter them out with
  `folder=neq.SENT`: `inbox.js`, `email-tasks.js`, `worksites.js`
  (email-mention matching) and `data-sources-status.js` (freshness,
  recent_emails, per-account status). `email-ingest-browser.js` additionally
  rejects content-less extension rows (no subject AND no snippet → counted as
  `skipped_empty`, never upserted).

### Sjálfvirkni (automation registry + run log)
- `automation_jobs` — one row per registered automation: `name` (UNIQUE), `label`,
  `description`, `command` (copy-paste run command, e.g. `run_workflow ajour-nlsh`),
  `url`, `schedule`, `runner`, `enabled` bool, `created_at`, `updated_at`. Seeded:
  `name='ajour-nlsh'`.
- `automation_runs` — run-status log: `job_name`, `status` (`running|success|error`),
  `detail`, `source`, `started_at`, `finished_at` (DB default now()). Index on
  `(job_name, finished_at desc)` — the GET pulls the latest run per job from it.
- Endpoint: `netlify/functions/automations.js` → `/api/automations` (mirrors the
  `debtors.js` REST pattern — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, CORS,
  `json()`/`sbFetch()` helpers).
  - `GET` → `{ jobs:[ {…automation_jobs fields…, last_run:{status,detail,source,
    finished_at}|null } ] }` — only `enabled=true` jobs, each with its single newest
    `automation_runs` row.
  - `POST { action, … }`: `register` (upsert `automation_jobs` ON CONFLICT(name),
    `Prefer: resolution=merge-duplicates`, never overwrites existing cols with null);
    `run` (insert one `automation_runs` row — `{job_name,status,detail,source,
    started_at?,finished_at?}`, DB fills `finished_at` when omitted); `toggle`
    (PATCH `automation_jobs.enabled`).
- UI: the ⚙️ Sjálfvirkni tab (`renderSjalfvirkni`) — see Tabs above.

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

## Companion repo: luna-bridge

A separate repo `aggisigurds-dev/luna-bridge` runs on the user's
**Windows desktop** as a set of scheduled scripts. It's the source
for several Supabase tables this app reads:

- **`bridge.js`** — reads Thunderbird mbox files for 5 accounts,
  classifies messages, upserts to `email_digest`. Runs every 15min
  via Task Scheduler.
- **`timavera-bridge.js`** — reads the latest `Tímaveru vinnufærslur*.xlsx`
  from the user's `Downloads` folder, parses with `xlsx` lib,
  upserts to `timavera_entries`. Dedupe key:
  `date|employee.toLowerCase()|project.toLowerCase()|time_in`.
  Columns matched fuzzily by header substring (`dagsetning`/`date`,
  `inn`, `út`/`ut`/`out`, `tímar`/`hours`, `starfsma…`/`employee`,
  `verkefn…`/`project`).
- **`ajour-ingest.py`** — reads the latest `AjourRegistrationData*.csv`
  from Downloads, upserts to `ajour_registrations`. CSV is
  semicolon-delimited UTF-8-with-BOM. Dedupe key:
  `(serial_number, project_name, execution_date)`. Maps:
  `SerialNumber`, `RegistrationType`, `RegistrationStatus`,
  `ProjectName`, `CategoryGroup`, `Category`, `Category1`,
  `CheckListItem`, `CheckListItemCheckedDate`,
  `CheckListItemCheckedByUser`, `ExecutionDateFrom`,
  `ReceiverCompany`, `Longitude`, `Latitude`,
  `RegistrationCreatedDate`.

The brunaholf drop-zone parser should reuse the exact same column
mapping and dedupe keys so files can be uploaded via the web UI
**or** via the local scripts interchangeably.

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

## Verkefnalisti (Claude task board) — vinnureglur

`verkefnalisti.html` + `/api/verkefnalisti` (tafla `verkefnalisti`, myndir í
public `verkefnalisti` bucket). Staðir: beidni → i_vinnu → i_yfirferd (Agnar
samþykkir) → klarad. GET skilar öllu; POST `{action:'update', id, …}`.

**Standing instructions fyrir Claude/agenta sem vinna verkefni af listanum:**
- **Skjáskot af niðurstöðunni er hluti af verklokum.** Þegar verk fer í
  `i_yfirferd` skal fylgja skjámynd af breytingunni (Playwright-skot af
  síðunni eftir breytingu) gegnum `result_image_b64` í sama update-kalli —
  Agnar yfirfer af símanum og á að geta séð útkomuna án þess að opna appið.
- **Lesa `feedback` þegar verk kemur aftur í vinnu.** „↶ Aftur í vinnu" úr
  yfirferð opnar athugasemdabox hjá Agnari; textinn bætist tímastimplaður í
  `feedback`-dálkinn (birtist sem 📣 á síðunni). Nýjasta línan segir hverju á
  að breyta — taktu hana fram yfir upprunalegu lýsinguna ef þær stangast á.
- Margar beiðni-skjámyndir: `request_image_urls` (jsonb fylki) er aðal-sniðið;
  `request_image_url` er alltaf fyrsta myndin (eldri lesarar). `add` tekur
  `request_images_b64` fylki; `update` tekur `add_request_images_b64` (viðbót)
  og `request_image_urls` (fjarlæging). `claude_notes` er svar-texti Claude.

## Service-doc ledger (standing task — keep alive)

`brunakerfi-skodun.html` — a self-contained, fillable + printable
**Skoðunarskýrsla brunaviðvörunarkerfis** (fire-alarm-system inspection report),
modelled on the Öryggismiðstöðin layout but branded Slökkvitæki ehf (logo from
`/api/branding`, kt 600508-0400). Sections: Búnaður counts (Samtals/Í lagi/Ekki í
lagi/Vantar), Hljóðstyrksmælingar, Aðalstöð/rása checklist, Rafhlöðumælingar,
repeatable Athugasemdir tables per device group, Ábendingar, signature canvas.
localStorage draft autosave (no required fields — ALLTAF LEYFA VISTUN), 🖨 print
CSS for a clean PDF. Linked from `brunakerfi.html` („🧯 Ný skoðunarskýrsla…").

`brunakerfi.html` is a per-customer ledger for the brunakerfi /
slökkvitæki **service customers** (fyrirtæki í þjónustu): a one-time
þjónustusamningur + a yearly úttektarskýrsla + reikningur (2024–2026),
each linked to Google Drive. Data is hand-encoded in `CUSTOMERS` /
`INVOICES_2026` / `FILE_IDS`, cross-linked to `rekstrarfelog.html` by kt.

**Standing instruction:** whenever new docs/PDFs surface — in the Drive
`Brunakerfi\{Skýrslur,Samningar,Reikningar}` folders, the top-level
`Skýrslur` slökkvitæki-inspection archive, or the `bokhald@eldklar.is` /
`eldklar.is` mail — link them into this ledger: add the file to the right
customer/year (resolve its Drive fileId into `FILE_IDS`; OCR scanned
reikningar for customer + kt + amount) and fill the matching `vantar`
cell. Add new service customers as they sign up. Surface (don't drop)
anything undated.

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

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
