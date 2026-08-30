---
name: framendi
description: Framendi og flipar — hvaða síður eru til í hub-num, hvað hver gerir og hvernig þær eru tengdar. Notaðu þegar breyta á síðu, bæta við flipa eða finna hvar eitthvað í viðmótinu býr. Rödd í Jarvis: Margot Robbie 🗂️.
tools: Bash, Read, Grep, Glob, Edit
---

Þú kannt **viðmótið** — alla flipa hub-sins, hvað hver gerir og hvar hann býr.
Grunnregla: `index.html` er EIN risaskrá (1,29 MB). Notaðu **aldrei** heilan lestur —
finndu réttu línurnar með `grep` og lestu þröngt með `offset`/`limit`.

---

# 📚 Þekkingargrunnur — ÓBREYTTUR texti úr CLAUDE.md

> Fluttur hingað 2026-08-01 við uppskiptingu CLAUDE.md (31k tokens hlóðust í HVERRI
> lotu). Engu breytt, engu sleppt — aðeins fært svo það hleðst aðeins þegar þessi
> sérfræðingur er kallaður til.

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
- `jarvis` — **🧠 J.A.R.V.I.S.** (renderJarvis; situr beint undir Deginum). HUD-ið
  yfir allt kerfið, innfellt sem full-hæðar iframe á `/jarvis.html` — sama mynstur og
  `multitool` (eitt `<iframe>` í `#view`, hæð stillt af `window.innerHeight`, endur-passað
  við `resize`), svo síðan er EIN og enginn tvíverknaður. Iframe-ið ber
  **`allow="microphone"`** — án þess þagnar kjarninn (HUD-ið notar `getUserMedia` +
  talgreiningu og bregst við raunverulegu hljóðstigi). `body[data-tab="jarvis"] main`
  fær `max-width:none;padding:0;background:#020814` svo hvítt blikki ekki í gegn meðan
  iframe-ið hleðst. Spjaldið í Bakendi opnar hana áfram á **sérskjá** (`target=_blank`)
  — ætlunin er að hún standi opin á sínum skjá; flipinn er fyrir fljóta kíkið.
  Deep-link `#jarvis` virkar sjálfkrafa (`applyDeepLinkTab` les `state.tabs`).
  **Kjarninn = AGNAHNÖTTUR (2026-07-31, eftir mynd frá Agnari; fyrri „plasma-
  hnöttur" var hafnað og bakfærður í #338 — ekki endurvekja hann).** ~1400 agnir
  á kúluskel, varpaðar flatt: það er ÞÉTTINGIN við jaðarinn sem býr til
  hnattarformið, ekki teiknaður hringur. Fibonacci-dreifing (jafnt bil) + hnik,
  annars sést spíral-**moiré**. Agnirnar **streyma INN** (`p.r` minnkar, ný
  stefna yst þegar þær ná `INNSTA`) — skelin er þröng (0,68–1,0) VILJANDI: breið
  skel fyllir miðjuna og hnattarformið hverfur. Í miðju er **pínulítill
  hvítglóandi punktur**, ekki stór hnöttur. Utan um: punktahringur · bogar með
  opum · gráðuhringur 000–330 (5°/30° strik). Snýst á **~5°/s** — hægt.
  Hreyfingin er **tímabundin (dt)**, annars tvöfalt hraðar á 120Hz skjá.
  **Hringirnir ÞRÍR snúast hver á sínum hraða og átt** (punktar +2°/s · bogar
  −1,4°/s · strikahringur +0,9°/s); gráðutextinn er teiknaður ÓHREYFÐUR svo hann
  standi ekki á hvolfi neðst. **ALLT er kalt á litinn** — `heilsulitur` var tekinn
  af hringjunum (Agnar: „not a red ring"), staðan sést í pillunum efst og í
  KERFIS-VITALS. Agnirnar **blossa** (skammlífir neistar) og streymið er
  **hviðukennt**: `gustur` = margfeldi tveggja ósammælanlegra sveiflna, svo hviður
  endurtaki sig aldrei sýnilega — jafn hraði las sem færiband. Teiknað
  samleggjandi (`lighter`).
  TALA-hnappurinn er NEÐST og málrofinn út í horn — miðjan má ekki hafa neitt
  ofan á sér. GILDRA: inline-glóðin á `#hnappur` slær út `.on`-regluna í CSS, svo
  rauði hlustunarliturinn er valinn í JS líka.
  **Raddir (2026-07-31, `js/jarvis-voice.js` + `netlify/functions/jarvis-tts.js`):**
  Jarvis getur TALAÐ með karakter-röddum. `jarvis.html` hleður `jarvis-voice.js`
  (ein `<script defer>` lína) sem gefur `window.Jarvis.say(agentId, text)` og
  sprautar sjálf-innihaldið 🎙️ **radd-prufu** (fljótandi „Raddir"-hnappur → spjald
  með áhöfninni + textareit; stöðu-lína segir 🐟 Fish vs 🔊 vafra-rödd; slökkt með
  `window.JARVIS_VOICE_NO_TESTER=true`). 8 raddir (Jarvis MCU · Ramsay · Freeman ·
  Arnold · Trump[in-house parody] · Harley · Samantha/Her · Natalie), hver með Fish
  `voice_id` + túnaðri vafra-rödd sem varaleið. Raunraddir fara gegnum
  **`/api/jarvis-tts`** (`jarvis-tts.js` — Fish Audio S2.1 Pro proxy, `FISH_API_KEY`
  server-megin, valkv. Supabase `jarvis-tts` bucket-skyndiminni sem endur-rukkar
  ekki; 503 þegar lykil vantar → client fellur á vafra-rödd). `say()` sendir
  `jarvis:speak`/`jarvis:done` atburði svo HUD geti glóað með röddinni. Birtist líka
  í Slökkvitæki Fjármála-appinu (br-jarvis = `jarvis.html?embed=1`). Sjá
  `docs/JARVIS-VOICE.md`.
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
  göt per starfsmann, samningsstaða per verkliður. Data: `/api/nlsh-dashboard`.
  **8 svæði** (4H/5H × S1–S4): áætlað vs Ajour-lokið per teikningu —
  `/api/nlsh-section-progress` + `js/nlsh-sections.js`. Ekki herbergi.
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

---

*Kaflarnir hér fyrir neðan voru fluttir orðrétt úr `CLAUDE.md` 2026-08-19
(verkefnalisti 22a44bdc) — sama efni, nýr staður.*

## Fjármála-yfirlit-flipi — 2026-08-08

Nýr flipi **`fjarmalyfirlit`** (💰 Fjármála-yfirlit, beint á eftir `krofuyfirlit`) —
app-síðan `/fjarmalyfirlit.html` (peningapípan þvert á Slökkvitæki + Brunahólf,
les `/api/fjarmal-yfirlit` + `/api/nlsh-dashboard`) er nú líka alvöru hub-flipi.
`renderFjarmalyfirlit(t)` í `index.html` fellir hana inn í iframe með
`?v=Date.now()` — sama mynstur og Eyðublöð/Multitool, svo síðan á sér einn
sannleik og lifir áfram óbreytt sem sjálfstæð slóð og app-síða í
slökkvitæki-öppunum (`br-fjarmalyfirlit` í patch 261). Deep-link:
`/#fjarmalyfirlit` (líka í `?embed=1`).

## Brunakerfi yfirlit — 2026-08-25

Flipi **`brunayfirlit`** (🔔 Brunakerfi yfirlit, rétt á eftir `skodanir`) —
`/brunakerfi.html` innfellt í iframe (`renderBrunakerfiYfirlit`, `?v=Date.now()`).
Les `/api/brunakerfi-yfirlit`. Ein röð per stað; **Skoðað YYYY** aðeins ef
brunakerfi-PDF er á þessum `fyrirtaeki_id`. Deep-link: `/#brunayfirlit`.
Eldri handskráði `CUSTOMERS`-listinn (eitt spjald fyrir alla Center Hótel-keðjuna)
var fjarlægður — hann málaði 2026-skýrslu Granda/Arnarhvolls á Klöpp.

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
