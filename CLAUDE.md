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


---

## 🧭 HVER KANN HVAÐ — byrjaðu hér

Þekkingin sem áður var í þessu skjali (31.000 tokens sem hlóðust í **hverri einustu
lotu**) býr núna hjá sérfræðingum í `.claude/agents/`. **Ekkert var fjarlægt** — aðeins
fært, orðrétt. Hver þeirra hleðst AÐEINS þegar hann er kallaður til.

| Spurningin snýst um … | → Sérfræðingur | Rödd |
|---|---|---|
| Viðskiptavini, kennitölur, rekstrarfélög, `customers_base` | `kunnaskra` | ❄️ Charlize Theron |
| Verðútreikninga, taxta, VSK, afslætti, NLSH, gata-uppgjör, dkPlus | `bokari` | 💫 Samantha |
| Skýrslu↔reikningur pör, þekju, gloppur, skjalatengingu | `sara-organizer` | 🗂️ Margot Robbie |
| Skjöl, Drive, PDF-lestur, endurnefningu, Skýrslu-stöð | `skjol` | 🎙️ Morgan Freeman |
| Tímavera, Ajour, Payday, Redder, email-innsog, luna-bridge, sjálfvirkni | `gagnaleidslur` | 🥊 Jason Statham |
| Flipa, viðmót, hvar eitthvað í `index.html` býr | `framendi` | 🗂️ Margot Robbie |
| Hvað er bilað — Supabase vs Netlify vs Claude vs appið | `kerfisheilsa` | 🩺 *(rödd í endurskoðun)* |
| Hraða, hleðslutíma, þung köll, polling — **vélarýmið** | `hradi` | 💥 Bruce Willis |
| Að ALLAR tengingar/lyklar séu í lagi á Kerfisheilsu | `tengingar` | 😤 Samuel L. Jackson |

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

## Fjármála-yfirlit-flipi — 2026-08-08

Nýr flipi **`fjarmalyfirlit`** (💰 Fjármála-yfirlit, beint á eftir `krofuyfirlit`) —
app-síðan `/fjarmalyfirlit.html` (peningapípan þvert á Slökkvitæki + Brunahólf,
les `/api/fjarmal-yfirlit` + `/api/nlsh-dashboard`) er nú líka alvöru hub-flipi.
`renderFjarmalyfirlit(t)` í `index.html` fellir hana inn í iframe með
`?v=Date.now()` — sama mynstur og Eyðublöð/Multitool, svo síðan á sér einn
sannleik og lifir áfram óbreytt sem sjálfstæð slóð og app-síða í
slökkvitæki-öppunum (`br-fjarmalyfirlit` í patch 261). Deep-link:
`/#fjarmalyfirlit` (líka í `?embed=1`).

## Skýrslur-flipi + CG (Calculation Group) — 2026-08-02

Nýr flipi **`skyrslur`** (fyrir ofan `krofuyfirlit`) — samantektir yfir óinnheimtar
tekjur (klárað en ógreitt). `renderSkyrslur(t)` í `index.html`.

- **CG-id kerfi**: hver samantektar-/heildartölu-gluggi fær fast CG-id. Innbyggð:
  `CG-01` Ógreitt · `CG-02` Ósent · `CG-03` Tími eftir · `CG-04` Samtals í pípunni
  (öll á Kröfu yfirlit KPI-spjöldunum gegnum `cgBadge(id,value)`).
- **Gildi** vistuð í `localStorage.cg_values` (`cgRecord`); Skýrslur les þau.
  `CG_BUILTINS` = föst, `CG_REGISTRY` = builtins + notenda-CG.
- **Handvalin CG** (`localStorage.cg_user`): „🎯 Bæta við CG" → `cgCaptureOn()`
  kveikir upptökuham (borði neðst + `document`-smellhlustari í fanga-fasa). Notandi
  flettir að glugga, smellir á töluna → `cgFindContainer`/`cgExtractKr`/`cgExtractLabel`
  → modal → `cgSaveCaptured` gefur næsta id (CG-05+). Handvalin CG geyma snapshot
  (ekki live) — taka upp aftur til að uppfæra.
- **Skýrslur** (`localStorage.cg_reports`): notandi leggur saman CG-id (`➕ Ný skýrsla`).
  Hvert spjald tengir á aðgerðasíðuna (uppruna) svo hægt sé að breyta þar (greitt/fela).
- `cgSyncBanner()` er kallað efst í `render()` svo upptöku-borðinn lifir milli flipa.
- **Cross-app capture (2026-08-05)**: `localStorage` deilist ALDREI milli léna, svo tölur
  á slokkvitaeki.netlify.app náðust ekki hingað með gamla upptökukerfinu (verkefnalisti
  664205fc feedback). Nýtt: tafla `cg_entries` í sama Supabase-verkefni + fall
  `netlify/functions/cg-entries.js` (`GET` listar, `POST {action:'record',…}` vistar/
  uppfærir, eigið id-nafnrými `CG-Sxx` svo það rekist ekki á staðbundna `cg_user` teljara).
  `window.cgFetchShared()` (kallað við ræsingu) sækir þessar færslur og bætir í
  `CG_SHARED`/`CG_REGISTRY`/`CG_VALUES`. Á Slökkvitæki-hliðinni: `js/patches/
  296-cg-capture.js` — fljótandi „🎯 CG" takki neðst t.v. á ÖLLUM síðum, sami
  smell-á-töluna-flæði, POSTar beint á `https://brunaholf.netlify.app/api/cg-entries`
  með `source_app:'slokkvitaeki'`.
- **Eftir**: merkja fleiri innbyggða glugga (Krófur & Tekjur, Slökkvitæki „í vinnslu");
  „Admin mode" takki við klukkuna (báðar síður) fyrir handvirkar leiðréttingar í summum.

## Pörun — document_pairs (2026-08-05)

Skýrsla↔reikningur pörun (verkefnalisti 94295522). `customer_documents` hefur ENGA
FK milli skýrslu- og reikningsraða (`doc_type` ∈ `samningur|uttektarskyrsla|reikningur|
brunakerfi`; `invoice_number` er bara sett á `reikningur`-raðir). `v_bundle_coverage`
(`sql/2026-07-31_v_bundle_coverage.sql`) er lifandi kt+ár+kind heurística (engin
geymd tengsl) sem `veidin.js`/`svid-status.js` lesa — hún nær EKKI utan um það þegar
ein úttektarskýrsla dekkar bæði Úttekt- OG Brunakerfi-parið sama ár (t.d. E
Fasteignafélag / Norðurhella 17: R-000652 = úttekt, R-000651 = brunakerfi, EIN
skýrslu-röð).

`document_pairs` (`sql/2026-08-05_document_pairs.sql`) er ný, viðbótar (ekki í stað
`v_bundle_coverage`) tafla með `customer_base_id, year, service_type ('uttekt'|
'brunakerfi'), report_doc_id, invoice_doc_id, solur_id, status, matched_by`. Ein-
skipta bakfylling keyrð 2026-08-05 (91 klarad þ.m.t. 1 `shared_report`, 1085
vantar_reikning, 5 vantar_skyrslu) — `on conflict do nothing` gerir endurkeyrslu
óhætta. `matched_by='shared_report'` = sama skýrslu-röðin endurnýtt fyrir hitt
kind-ið þegar það á enga eigin.

Slökkvitæki-hliðin: núverandi „📦 Pör" bandið (`js/patches/253-sala-customer-
history.js`, Sala → 🧾 Fyrri viðskipti) er ÓBREYTT í grunninn (les enn `customer_
documents`+`solur` beint, alltaf ferskt) en spyr núna líka `document_pairs` til að
fylla inn skýrslu sem vantaði bara vegna shared_report-tilviksins, og til að láta
kind-röð birtast yfirhöfuð þegar reikningur er til en engin doc_type-röð flokkast
undir það kind. Sendingin sjálf (`sendBundle`) sendi nú þegar bæði skjölin saman —
ekkert nýtt þurfti þar.

**Vísvitandi sleppt** (sjá verkefnalisti-athugasemd): full endursköpun „Skjöl &
Viðhengi"-síðunnar sem flipuðum árs-bundlum, og að BLOKKA sendingu ef parið er
ófullkomið — `sendBundle` sendir nú þegar það sem er til án þess að neita, sem er
skárra en að læsa notandann úti vegna heimtu-galla í parningar-rökfræðinni.
### Sjálfvirk pörun — biðstaða (2026-08-08)

`document_pairs` er **núna sjálfvirkt viðhaldið**. Áður þurfti Agnar að tengja í
höndunum í hvert sinn: opna fellilistann „— hvaða reikningur?", force-reseta til að
sjá nýja reikninginn, fara á Sölu-síðuna, finna fyrirtækið, staðfesta að númerið væri
rétt, og smella á „Tengja". Bakfyllingin frá 2026-08-05 var ein-skipta, svo hvert nýtt
skjal datt strax út fyrir.

Trigger `trg_auto_pair_customer_document` á `customer_documents` (fall
`auto_pair_customer_document()`) sér um þetta núna. Tvær leiðir:

- **Biðstaða (INSERT).** Bíði par eftir hinni hliðinni grípur það NÆSTA skjal sem
  verður til fyrir sama `customer_base_id` + ár. Þetta er vinnuflæðið sjálft:
  skýrsla klárast → tengill bíður → reikningurinn sem þú býrð til næst tengist
  sjálfkrafa. `matched_by='auto_standby'`.
- **Varfærna leiðin (UPDATE / INSERT sem biðstaðan tók ekki).** Tengir aðeins þegar
  nákvæmlega EITT óafritað skjal af þeirri tegund er til á fyrirtæki+ári, og býr til
  nýtt par ef ekkert er fyrir. `matched_by='auto_trigger'`.

⚠️ **Tvær skorður sem má ekki fjarlægja:**

1. **Biðstaðan er AÐEINS framvirk (`TG_OP='INSERT'`).** Mælt 2026-08-08: 56 bíðandi
   pör áttu 126 mögulega lausa reikninga — fjóra hvert. Afturvirk „gríptu einhvern
   lausan" hefði því giskað rangt oftar en rétt. Tímaröðin sjálf ber ætlunina:
   reikningurinn sem verður til næst ER reikningur skýrslunnar. Ekki keyra
   biðstöðuna sem bakfyllingu.
2. **Talið er yfir ALLAR þjónustutegundir, ekki bara `uttekt`.** Bíði bæði úttektar-
   OG brunakerfis-par eftir reikningi er ómögulegt að vita hvoru hann tilheyrir, svo
   þá er ekki giskað og fellilistinn stendur eftir. Fyrsta útgáfan síaði á
   `service_type='uttekt'` og hefði rænt brunakerfis-parinu í hljóði — prófun greip það.

Prófað 2026-08-08 í transaction sem var rúllað til baka: eitt par bíður → tengist;
tvö pör bíða → **0 rangar tengingar**. Bakfylling á 2026 með sömu vörðu rökfræði
færði `klarad` úr 96 í 203. Afrit: `backup_20260808_document_pairs`.

Ath. að tengingin gerist í gagnagrunninum, óháð því hvaða app skrifaði skjalið
(Sala, Drive-innsog, POS, appið) — en gömul opin síða þarf samt endurhleðslu til að
**sjá** hana. Cache-hliðin er óleyst.

**2026-08-09 — pörin eru núna PER STAÐ (`fyrirtaeki_id`), ekki bara per lögaðila.**
Gamla `UNIQUE (customer_base_id, year, service_type)` skorðan þýddi að fjölstaða-
viðskiptavinur gat aðeins átt EITT par per ár: hjá Heimaleigu (12 staðir á base 293)
tók Dalbrekka sætið 3. ágúst og Urðarhvarf 2 gat því ALDREI tengst — sama hvað var
reynt í fellilistanum. Breytt: nýr dálkur `document_pairs.fyrirtaeki_id` (backfyllt
úr skjölum paranna, 1.273/1.281), einkvæmnin er nú
`(customer_base_id, year, service_type, coalesce(fyrirtaeki_id,0))`, og triggerinn
skalar bæði talningar og pörun á staðinn þegar skjalið ber `fyrirtaeki_id`. Skjal
MEÐ stað parast aðeins við pör SAMA staðar (aldrei við null-staðar pör — það væri
ágiskun); skjal ÁN staðar hegðar sér eins og áður gegn null-staðar pörum. Prófað:
reikningur á þriðja systkinastað bjó til sitt eigið par án þess að snerta hin.
Afrit: `backup_20260809_document_pairs`. Sama lexía og annars staðar í skjalinu:
**kennitala/base svarar „hver borgar", aldrei „hvar unnum við".**

## Efniskostnaður — handvirk verkstaða-tenging (2026-08-05)

Verkefnalisti a12d429a: Redder-reikningar sem `redder-read.js` gat ekki tengt sjálfkrafa
(`worksite_match IS NULL` — oftast af því engin verkstaðar-tilvísun fannst í PDF-inu
sjálfu, bara tengiliða-merki eins og „umb Lukas") sátu áður sem varanlega ólæsanleg
„Án verkstaðs"-hrúga. Efniskostnaður-flipinn hefur núna:
- **„🔗 Tengja við verkstað" á hverjum reikningi** — setur `worksite_match` á ÞANN eina
  reikning (POST `/api/redder-invoices {invoice_nr, worksite_match}` — endapunkturinn
  studdi þetta nú þegar, bara enga UI). Engin sjálfvirk `project_aliases`-lærdómur hér,
  af því hrátextinn á ólæstum reikningum er oftast bara tengiliðs-nafn, ekki alvöru
  verkstaðar-afbrigði — að læra af honum myndi ranglega flokka næsta reikning með sama
  tengilið en ANNAN verkstað.
- **„✏️" á hverjum verkstaða-hóp** — endurnefnir ALLA reikninga undir því nafni í einu
  (nýtt `POST /api/redder-invoices {action:'rename_worksite', from, to, learn_alias:true}`)
  OG skrifar `project_aliases(alias=from, canonical_name=to)` — því hér ER `worksite_match`
  þegar alvöru (þótt misstafað) verkstaðarnafn. `redder-read.js` sækir núna
  `project_aliases` úr gagnagrunni (`loadAliasesFromDb()`, keyrt einu sinni per innlestur,
  DB-gildi vinna umfram hardcoded `ALIAS`-kortið) svo ný PDF-innlestur nýtir handvirku
  leiðréttinguna sjálfkrafa — `ALIAS`-kortið í kóðanum er ekki lengur eina uppsprettan.
- Verkstaða-listinn í tengi-reitnum (`<datalist>`) er sambland af `/api/worksites?year=
  combined` og því sem þegar er notað í `redder_invoices` — alltaf a.m.k. þau nöfn sem
  eru í notkun nú þegar.

**Vísvitandi sleppt**: línu-stigs tenging (að taka STAKA vörulínu úr reikningi og tengja
við annan verkstað en restina af reikningnum) — `redder_line_items` hefur engan eigin
`worksite`-dálk, og öll skoðuð dæmi af ólæstum reikningum voru heilir reikningar sem
vantaði verkstað, ekki blönduð fjölverkstaða-reikningar. Bæta við ef alvöru þörf kemur upp.

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

## customer.html — síðasta póstsamskipti (2026-08-05)

Verkefnalisti aaaa0cb6. Slökkvitæki-hliðin (unreplied-envelope á „Fyrirtæki í þjónustu",
`/api/company-mail` + patch 295) var þegar til (2026-07-31) — vantaði bara sama upplýsingu
á Brunahólfs kúnna-síðuna sjálfa. `netlify/functions/customer.js` reiknar núna
`last_contact` (nýjasti INN-pósturinn frá `base.contact_email`/`netfang` eða einhverju
lifandi `fyrirtaeki.netfang`, + hvort honum sé svarað — sama varfærna nákvæma-netfangs-
mátun og company-mail.js, bara á einn kúnna í einu). Birtist sem badge í haus-kortinu
(`customer.html`) ALLTAF þegar til er samskipti, og sem `🤖 AI Ráðgjafi`-flagg (info fyrstu
2 daga, warn frá 3 dögum) þegar ósvarað — bein ósk verkefnalistans um „flagar 'enginn
svarað í 3 daga'".

## customer.html — skjalatenglar benda á Supabase (2026-08-07)

`/api/customer` byggði `view_url` EINGÖNGU úr `drive_file_id`, þótt röðin ætti
`storage_path`. Mælt á lifandi gögnum 2026-08-07 (alls 3.590 raðir):

| | |
|---|---|
| Aðeins Drive | 2.626 |
| **Aðeins Storage** | **241** ← sýndust „án Drive-tengingar", skráin samt til |
| Bæði | 287 |
| **Hvorugt** (draugaraðir) | **436** |

Nýtt `docViewUrl(d)` í `customer.js` — sama rökfræði og `openUrl` í
`service-gaps.js` en með **Supabase á undan Drive**: `storage_path` er stöðug slóð
sem rofnar ekki við endurnefningu og krefst engrar Google-innskráningar, á meðan
Drive-hlekkur er skráarauðkenni sem rofnar (793 mældir dauðir — sjá
`docs/SKJALA-FLUTNINGUR.md`). Þau 287 sem eiga BÁÐA opnast því á örugga eintakinu.
Ekkert er flutt eða endurnefnt og engu eytt í Drive; `drive_file_id` stendur áfram
í svarinu. `link_source` (`'storage'|'drive'|null`) fylgir með svo viðmótið geti
sagt hvaðan skráin kemur (birt í `title` á tenglinum).

⚠️ `storage_path` ber bucket-nafnið sjálft (allar 528 raðir byrja á `samningar/`,
sem er public bucket) — ALDREI bæta bucket-forskeyti við slóðina.

`summary.missing_drive_file_id` → **`summary.missing_file`**, og telur nú aðeins
raðir með HVORUGA uppsprettu (draugaraðirnar, varnagli 3 í SKJALA-FLUTNINGUR).
Gamla talan gaf falskt viðvörunarflagg á skjöl sem áttu fína Supabase-skrá.
Sama leiðrétting í `docLink()` í `customer.html`: „engin Drive-tenging" →
„engin skrá".

Þetta er hlekkja-lagfæring á framsetningu, ekki Fasi 0 — hún nær aðeins til raða
sem ERU í `customer_documents`. Þau ~1.534 storage-hlutir sem eiga enga röð eru
enn ósóttir (Fasi 0 í `docs/SKJALA-FLUTNINGUR.md`).

## Ártals-lesarinn í Drive-föllunum (2026-08-07)

`yearFrom`/`yearFromName` er afritað í FIMM skrár (`drive-count`, `skyrslu-ar`,
`drive-sort`, `drive-multitool`, `doc-index`) og útgáfurnar höfðu rekið í sundur.
Tvennt lagað — báðar breytingar eru á lestri, engin skrá hreyfð:

- **`_` telst nú sem bil.** Innsog sem kemur ekki frá Drive-flokkuninni skrifar
  `Tangarbryggja_2024.pdf`; `_` er orðstafur svo hvorki bandstriks-liðurinn né
  „stakt 20xx umlukið bilum" sá ártalið. Mælt: **31 af 56** ártalslausum skrám í
  Úttektarskýrslur-möppunni lagast, þar af 4 frá 2026 (einstök 2026-skjöl 243 → 247).
- **`drive-sort` fjarlægir nú kennitölu fyrst**, eins og `drive-multitool` gerði
  þegar. Kt endar oft á gildu ártali (`500993-2009`) og var lesin sem ÁRIÐ. Það var
  verst í `drive-sort` af öllum stöðunum, því þar ræður talan í hvaða ár-möppu skrá
  er FÆRÐ. Mælt: 12 fyrirtæki eiga slíka kt, 6 þeirra í þjónustu. Bæði föllin fengu
  líka þak (`2008..nú+1`) sem `drive-multitool` vantaði.

⚠️ Eftir stendur meðvitað frávik: `drive-sort`/`drive-multitool` lesa
dagsetningarforskeyti (`2024-03-11 nóta.pdf`), `drive-count`/`skyrslu-ar` ekki.
Það er eldra en þessi lagfæring og snertir reikninganöfn, ekki skýrslur.

**Ef þú breytir einu þeirra, breyttu hinum.** Ósamræmi milli `skyrslu-ar` og
`drive-count` þýðir að skrá sem á ártal fyrir fer samt í endurnefningu.

## Eyðublöð — skjalasmiðja með útgáfusögu (2026-08-06)

Nýr flipi **`eydublod`** + sjálfstæð síða `eydublod.html` (sama iframe-mynstur og
`multitool`/`pdftools`; `renderEydublod(t)` í index.html). Býr til útprentanleg
skjöl til verkkaupa. Fyrsta eyðublaðið: **„Yfirlýsing vegna brunalokana"**.

- **Stafrétt eftirmynd af Word-frumritinu.** Uppsetningin er lesin beint úr
  `Staðfesting_Keldur31072026.docx` — ekki ágiskuð: US Letter 8,5×11in, spássía
  1in, grunnletur Aptos 11pt (`docDefaults`), meginmál **Calibri 12pt** (sz 24),
  fyrirsögn Calibri 14pt feitletruð miðjuð (sz 28), línubil 1,15 (`line 276`),
  bil á eftir málsgrein 0, punktar `●` með 0,5in inndrætti og 0,25in hangandi,
  haus með merki 2,04×0,49in miðjuðu og línu undir, undirskrift 4,39×1,06in.
  ATH: þrjár „Hvað var gert"-línurnar eru á grunnletrinu (11pt) í frumritinu, ekki
  Calibri 12pt — það er hermt eftir viljandi.
- **Myndirnar eru úr frumritinu**: `img/yfirlysing-logo.jpg` (merkið, `word/media/
  image2.jpg`) og `img/undirskrift-annthor.png` (undirskrift Annþórs, `image1.png`).
  ⚠️ Báðar eru sóttanlegar opinberlega því `publish = "."` — loka má á þær með
  redirect-reglu þegar innskráningin kemur (sjá „Open work").
- **Ritað BEINT ofan í skjalið** (`contenteditable` per svæði). Hliðarstikan geymir
  aðeins það sem er ekki í skjalinu: dagsetningarval, `byggingar`, `sveitarfelag`
  og undirskriftarflötinn. Sjálfvirku setningarnar tvær („Um ræðir…" og
  niðurstaðan) skrifa sig út frá byggingunum og hætta því um leið og notandinn
  skrifar ofan í þær. Vantar byggingarnúmer (t.d. „Rekstrarfélag Kringlunnar,
  Útisvæði – Kúmen 07-009-222") er efnið sótt í fyrirsögnina á eftir kommunni.
- **Gulu svæðin** = nákvæmlega þau sem Agnar strikaði gul á fyrirmyndinni. Rofinn
  „Sýna breytileg svæði" kveikir/slekkur; prentast aldrei.
- **PDF**: `js/jspdf.umd.min.js` (vistað í repo-inu, EKKI cdnjs — PDF-inn er
  afurðin og má ekki detta út þótt CDN sé niðri) + `fonts/carlito-*.ttf`
  (OFL, málsamhæft við Calibri, hlutmengjað í latínu+íslensku svo hver PDF er
  ~140 KB). Vektor, leitanlegur texti, réttir íslenskir stafir.
  ⚠️ Google Fonts skilar Carlito-skránum í röðinni *italic, bold-italic, regular,
  bold* — bold/italic víxluðust í fyrstu atrennu. Staðfestu alltaf með
  `TTFont(p)['name'].getDebugName(4)` ef skipt er um leturskrár.
- **Geymsla + útgáfur**: tafla `eydublod_skjol` + public fatan `eydublod`
  (`sql/2026-08-06_eydublod.sql`), endapunktur `netlify/functions/eydublod.js`
  (`/api/eydublod`, ríður `/api/*` catch-all). `gogn` (jsonb) geymir REITAGILDIN —
  þau eru uppspretta sannleikans, svo hægt er að opna skjal, breyta og vista sem
  NÝJA útgáfu. `skjal_id` heldur útgáfunum saman, `utgafa` telur upp; hver útgáfa
  fær sinn eigin storage-hlut svo eldri PDF (þegar farinn til verkkaupa) er
  ALDREI skrifaður yfir. GET skilar nýjustu útgáfu per skjal (`?all=1` fyrir allar).
- **A4, ekki Letter (2026-08-07)**: frumritið var US Letter (Word-sjálfgildi) en
  hér er prentað á A4 — `@page{size:A4}`, `.doc{width:210mm}` og jsPDF
  `format:'a4'` (595,28×841,89pt). Spássían er áfram 1in.
- **Línubil er stillanlegt (2026-08-07)**: Agnar bað um rýmra bil en frumritsins
  1,15. Sjálfgefið **1,5**, geymt í `values.linubil` svo það fylgi skjalinu og
  vistist með því. Stillt á EINUM stað — `--lh` (CSS) og `LH` (PDF) lesa bæði
  sama gildi; ekki hardkóða línubil aftur.
  **„📄 Passa á eina síðu"** (`passaEinaSidu()`) prófar bilið frá völdu gildi
  niður í 1,0 í 0,05-þrepum og velur það STÆRSTA sem heldur skjalinu á einni
  síðu — byggir PDF í hverri umferð því það er eina örugga mælingin (HTML-
  forskoðunin brýtur línur ekki alltaf eins). Leturskrárnar eru í `_fontCache`
  svo umferðirnar séu ódýrar. Dæmi: Kringlan-skjalið fer úr 2 síðum í 1 við 1,35.
- **Kveðjublokkin er ein heild**: „Með kveðju / FH. Brunahólf ehf. / nafn /
  undirskrift" fær `P.need(...)` á undan sér svo undirskriftin slitni ALDREI
  frá nafninu yfir á næstu síðu.
- **Cache-gildra (2026-08-07)**: iframe-ar endurnýta vistað eintak án þess að
  spyrja þjóninn, svo Agnar sat fastur á gamalli útgáfu eftir deploy og hélt að
  breytingarnar virkuðu ekki. Hub-inn hleður núna `/eydublod.html?v=<Date.now()>`
  (alltaf ferskt; síðan er ~60 KB, þungu skrárnar cachast áfram). Síðan sýnir
  líka `UTGAFA` í hausnum — **bumpaðu því við hverja breytingu**, það er eina
  leiðin til að sjá strax hvort vafrinn situr á gömlu eintaki.
- **Nýtt eyðublað** = einn hlutur í `FORMS`-fylkinu í `eydublod.html`
  (`id/titill/lysing/sections/doc(v,E)/pdf(v,P)`) — sjá leiðbeiningarnar í
  haus-athugasemdinni þar. Engin bakenda-breyting þarf; `form_id` er frjálst.

## Samningar mega bera ár (2026-08-11)

Agnar: „multitool use the year in the name that I want — to have when it was
registered.. but something in the system dont want files with years within the
filename." **„Eitthvað í kerfinu" var CHECK-reglan `customer_documents_year_shape`**,
sem krafðist `year IS NULL` á `doc_type='samningur'`.

Samningar BERA ártal í raunveruleikanum (endurnýjunarár — sjá Samningar-möppuna:
„… - þjónustusamningur - 2026.pdf"). Reglan var því röng forsenda, ekki vörn, og
braut þrennt í hljóði:

1. **`samningar-read.js`** sendir `year` á samning → `23514 check_violation` →
   samningurinn skráðist ALDREI þegar heitið bar ártal.
2. **`drive-multitool.js`** neyddist til að henda árinu (`rowYear = null`) og
   geyma það í `notes` í staðinn. Mælt: **146 af 204** multitool-samningum báru
   ártal í notes, **0** í `year`-dálknum.
3. **`findExistingLink`** síar á `year=eq.<ár>`. Þar sem hver geymdur samningur
   hafði `year=NULL` fann sú fyrirspurn ALDREI fyrirliggjandi samning → hvert
   sweep bjó til NÝJA röð. Tvítök: Thai Lindin 5 raðir, Center Hótel 4,
   Húsfélagið Stakkholt 2-4 4, Prikið 3, Suðurhella 9 3.
4. **`match-station`** deduppar samninga á `(staður, ár)`; með ár alltaf NULL
   féllu ALLIR samningar staðarins í einn hóp.

Migration `allow_year_on_samningur` rýmkar regluna: samningur MÁ hafa ár (áfram
valfrjálst svo eldri NULL-raðir standist). Vörnin sem skiptir máli heldur —
`uttektarskyrsla`/`reikningur` VERÐA áfram að hafa ár (prófað: innsetning án árs
er enn hafnað).

Bakfyllt: 146 ártöl endurheimt úr `notes` (2008–2026). 212 samningar eru enn án
árs — nöfn þeirra bera ekkert ártal.

⚠️ **`findExistingLink` leyfir `year.is.null` LÍKA fyrir samninga.** Samningar
skráðir fyrir þessa breytingu eiga `year=NULL`; hrein árs-sía sæi þá ekki og
byggi til nýja röð — sama tvítaka-hegðun og var verið að laga. Ekki herða þetta
í hreina árs-jöfnun fyrr en bakfyllingin nær til allra.

## graphify

Þekkingargraf **aðeins uppsett á stóru vélinni** — `graphify`-skipunin er EKKI til á
öllum vélum. Ef `graphify-out/graph.json` er til OG skipunin svarar má nota
`graphify query "<spurning>"`. Annars: notaðu `grep`/`Glob` og sérfræðingana að ofan.

`graphify-out/` á að vera í `.gitignore` (eins og `.memsearch/`) — hún er sjálfgerð og
392.000 tokens að stærð.
