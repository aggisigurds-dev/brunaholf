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
`document_pairs` er ekki sjálfvirkt viðhaldið (engin trigger) — bakfyllingin er
ein-skipta; ný gögn sjást samt strax gegnum core kt+source-flæðið í patch 253, bara
ekki gegnum `document_pairs`-lagið fyrr en bakfyllt er aftur.

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

## graphify

Þekkingargraf **aðeins uppsett á stóru vélinni** — `graphify`-skipunin er EKKI til á
öllum vélum. Ef `graphify-out/graph.json` er til OG skipunin svarar má nota
`graphify query "<spurning>"`. Annars: notaðu `grep`/`Glob` og sérfræðingana að ofan.

`graphify-out/` á að vera í `.gitignore` (eins og `.memsearch/`) — hún er sjálfgerð og
392.000 tokens að stærð.
