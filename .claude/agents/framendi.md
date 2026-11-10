---
name: framendi
description: Framendi og flipar Brunahólfs-hubbsins — hvaða síður eru til, hvað hver gerir, hvernig þær tengjast og hvar í index.html (2 MB, aldrei lesin í heilu) eitthvað býr. Notaðu þegar breyta á síðu, bæta við flipa, hnappi eða dálki, laga hliðarstikuna eða finna hvar eitthvað í viðmótinu er; kallaðu á hann sjálfur áður en index.html er snert. Rödd í Jarvis: Lara Croft (Angelina Jolie) 🗺️. Kveikjuorð: flipi, nýr flipi, hub, index.html, hliðarstika, ui.vidmot.hlidarstika, DEFAULT_STATE, ensureNewTabs, hub_state, Stjórnborð, Vinnustofa, Yfirlit, Dagurinn, Vefrýni, Kröfu yfirlit, Fjármála-yfirlit, dálkastjórn, prófa alla takka, hvar býr þetta
tools: Bash, Read, Grep, Glob, Edit
---

## Charlize — lestu fyrst

Áður en þú breytir kerfi eða fullyrðir um það: `select topic, fact, detail from v_charlize_active where scope in ('brunaholf','baedi') and topic in ('brunaholf','framendi','sync','variant','folk','vinnulag','hradi') order by created_at desc;` Tómt = óskráð — segðu það, ekki giska. Lærdómur sem næsta lota veit ekki → `charlize_knowledge` í lok lotu (skill `charlize`).

Þú kannt **viðmótið** — alla flipa hub-sins, hvað hver gerir og hvar hann býr.
Grunnregla: `index.html` er EIN risaskrá (2,06 MB / 27 990 línur, mælt 04.11.2026). Notaðu **aldrei** heilan lestur —
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
- `timavera` — hours dashboard (renderTimavera, index.html:9035)
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
- `verkstadir` — worksite billing audit (renderWorksites, index.html:9545)
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
  `/api/nlsh-section-progress` + `js/nlsh-sections.js`. Tvíteikning
  (1S og 2S o.fl.) sýnir teikningarnafn á systurreit. Rafmagnsbættingar
  er flokkateikning, ekki göt. Ekki herbergi.
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
- **CG-01…04 í cg_entries (2026-10-29, verkefnalisti 664205fc)**: innbyggðu CG skrifast líka í
  `cg_entries` með eigin id (`CG-01`…`CG-04`, `source_app:'brunaholf'`) gegnum `cgPushShared(id,value)`
  — kallað úr `renderCards` í Kröfu yfirliti, aðeins eftir fulla hleðslu (`state.t3ok`) og án villu
  (`pgFailed`/`wsFailed`/`__KYF_VILLA`/`warnings`). Skrifað þegar gildið breytist eða 30 mín eru liðnar
  (samanburður við `CG_SRV`, þjónsgildin úr `cgFetchShared`, aðeins í minni). `cgFetchShared` sleppir
  innbyggðum id í `CG_SHARED` (engin tvítekning) og tekur þjónsgildið aðeins ef staðbundið vantar/er eldra.
- **Mynd + teikningar verkstaðar í Kröfu yfirliti (02.11.2026)**: vélin býr í **`js/verkstadur.js`** (`window.BhVerkstadur`
  — hlada/smamynd/mala/opna/teikna), hlaðin án defer í `<head>`; Kröfu yfirlit á aðeins þunna tengla (`wsMynd`,
  `openVerkstadur`, `loadVsi`). Sami panill innfelldur í **Viðskiptavinir · Greining** (verkstaðir greiðandans sem
  flögur; „Greining fasteignar í Slökkvitæki" er aðeins tengill — Agnar: „ekki slökkvitækjagreiningu, heldur aðalega að
  fá góðar teikningar, eða teikningarnar úr Ajour"). **Teikningar úr Ajour** efst: tafla `ajour_teikningar` (luna-bridge
  `ajour-teikningar.js`, myndir í `verkstadir/ajour/<fileId>.jpg`), pöruð við verkstað í `/api/verkstadur` (`passar`:
  sama orð/Levenshtein ≤2 + sama húsnúmer, handpör NLSH/Borgarspítalinn) — valið má yfirskrifa (`ajour_project_id`).
  **Síðar sama dag (Agnar: „setja það í fyrirtækja bannerinn, og leyfa að ég skipti um mynd" + „ef ég ýti á fyrirtækjanafnið
  þá fari ég inn á company profile"):** myndin er í HAUS fyrirtækjaspjaldsins (`bannerMynd` → `BhVerkstadur.bordi`, 118×76,
  fyrsti verkstaður með mynd; glugginn fær flögur allra verkstaða), ekki í röðunum. Nafnið (`nafnTengill`, `a.ky-name-lk`) →
  `opnaVidskiptavin` → `window.__bhOpna = {nafn, vk_kt}` → Viðskiptavinir (nafn, svo kt; annars opnað eftir nafni þótt það
  sé ekki á listanum). Eigin mynd: 📷 / Ctrl+V / draga → minnkuð í vafra (1600 px JPEG) → POST `mynd` (`mynd_heimild
  handvirkt`); „↻ Sækja aftur" yfirskrifar hana ekki, „Nota götumynd" gerir það.
  **03.11.2026:** sama `bordi` er prófílmynd í haus Viðskiptavina (`#vk-dmynd`, smellur → `opna`). „Staðir & teikningar" sýnir
  verkstaðaspjöld (`.vk-vs-kort`, `BhVerkstadur.info(ws)` fyrir heimilisfang) — smellur opnar verkstaðinn í Greiningu
  (`grSyna`); Slökkvitæki-staðir fyrir neðan ef til, „Stofna stað í Slökkvitæki" í lokuðum `<details>` (Agnar: „láta greininguna
  geyma fyrirtækið bara í brunahólf"). Bakfylling 03.11: 76 verkstaðir fengu götumynd + heimilisfang (heimild nafn / Payday-
  greiðandi / kort / staðarheiti — sjá `heimilisfang_heimild`).
  (Upphaflega:) `wsMynd(ws)` setti 84×54 smámynd (`.ky-wsm`,
  `css/theme.css`) fremst í hverja röð með verkstað; smellur → `openVerkstadur(ws)` (gluggi `#ky-vs-modal`, `.kyvs-*`):
  stór mynd, heimilisfang (✎ → leit í Landeignaskrá, eitt nákvæmt staðfang sótt strax, annars val), landnr/hæðir/
  kjallari, teikningagrind (gildandi grunnmyndir fyrst, smámyndir úr skjalasafni, PDF-reitir fyrir map.is-bæina).
  Gögn: tafla `verkstadur_info` + public bucket `verkstadir` um `/api/verkstadur` (GET `?all=1` / `?ws=`, POST
  `vista`). Vafrinn sækir úr Slökkvitækja-föllunum (`hus-upplysingar`, `husmynd`, `landnr` — CORS *) og sendir til
  geymslu; AÐEINS við smell. `loadVsi()` í `fetchAll`, `vsiMala()` uppfærir smámyndir á staðnum (ekkert hopp).
  Nafn verkstaðar án póstnúmers er tvírætt („Skúlagata 26" = 101 eða 340) — aldrei sjálfvirkt nema eitt staðfang.
- **Eftir**: merkja fleiri innbyggða glugga (Krófur & Tekjur, Slökkvitæki „í vinnslu");
  „Admin mode" takki við klukkuna (báðar síður) fyrir handvirkar leiðréttingar í summum.

## ➕ Stofna nýtt verk (Kröfu yfirlit) — 2026-09-04

Takki `.kyf-new` (Boss-gull) í `.kyf-toolbar`, við hlið 🖨 Prenta. Opnar
`openNyttVerkModal()` (skilgreint rétt á undan `openCombineModal`) — glugga sem
býr til **splunkunýtt verk handvirkt**: verkstaður, mánuður, greiðandi + kt, klst
dagvinnu/eftirvinnu + taxtar, efniskostnaður, fast verð m/vsk og athugasemd.

- Skrifar `invoice_drafts`-röð með `source:"handvirkt"`, `status:"draft"` og
  reiknuðum `net_an_vsk` / `vsk_amount` / `total_m_vsk` (fast verð yfirríður og
  bakreiknar netto). Röðin birtist strax í **Ósendum (þrepi 2)** — muna að þrep 2
  sleppir röðum með `total_m_vsk = 0` (glugginn varar við því).
- Verkstaður sem er í Verðskránni fyllir sjálfkrafa greiðanda, kt og taxta úr `PG`;
  greiðanda-listinn kemur úr `PG` + skuldurum þrepa 1–2.
- „🧾 Stofna og opna Efnislista" kallar `grOpenWorksite(ws, month)` eftir vistun.
- Handvirk verk eiga **engan Tímaveru-verkstað**, svo `renderList()` í Gerð
  Reikninga bætir nú við spjaldi fyrir drög mánaðarins sem eiga enga `WS`-röð
  (annars sæjust þau hvergi þar).

## ⭐ Aðalskjal mánaðarins — 2026-09-04

`☆`/`⭐` takki (`.grp-star`) í „Vistuð PDF-skjöl" listanum → `/api/efnislisti-docs`
`{action:"set_primary", worksite_name, work_month, drive_file_id}`; **tómt**
`drive_file_id` tekur merkinguna af. Ein merking per (verkstaður, mánuður).
Aðalskjalið ræður 📄-tenglinum í Kröfuyfirliti (`primDoc` í `wfStrip`) og fer
fremst í „Senda í bókun" — þannig verður aðsent uppgjörsskjal (Landsspítalinn)
skjalið sem birtist og sendist. 🔒 `innra` fær engan takka og er nú **síað úr**
`_docs` í `wfStrip` (skjáskot úr Athugasemd voru að lenda á 📄-tenglinum).

## 📥 Drög-stöð (`drogstod`) — 2026-09-05

Sameiginlegt innhólf reikningspunkta fyrir Slökkvitæki OG Brunahólf (Agnar: „draft
invoice station … notes, hints, clues … confirm some parts over time, then send").
Flipi beint á eftir Kröfu yfirliti; `renderDrogstod(t)` liggur rétt á undan
`renderTvMaeting`. Slökkvitæki-appið fellir hann inn með `/?embed=1#drogstod`.

- Þrír dálkar: **01 Innhólf** (punktar sem bíða, tillögu-flögur), **02 Í smíðum**
  (Brunahólfs-drög með 6-strika gátlista úr `?op=stada`, Slökkvitækis-kúnnar með
  fjölda punkta), **03 Valið** (gátlisti, línur, punktar sem bíða, Opna Efnislista /
  Senda í bókun → Kröfu yfirlit).
- Stikan efst: félags-rofi (Slökkvitæki sjálfgefið), Enter skráir STRAX, 📷 hleður
  mynd/PDF í pdf-store sem `innra` undir „Drög-stöð"/líðandi mánuði og hengir á punktinn.
  Biðröð í `localStorage.ds_queue` ef netið dettur út (sama mynstur og brunathettingar).
- `state.ui`: `ds_felag`, `ds_syn` (bæði/SL/BH — synced), `ds_sel` (nav-only).
- Reglurnar: punktur tapast aldrei · gervigreind leggur til, skrifar aldrei (aðeins
  „✓ Setja á drögin" kallar `apply`) · gátlistinn er reiknaður, ekki geymdur.
- Bakendi: `netlify/functions/reikningspunktar.js` (CRUD + `op=stada` + `apply`),
  `netlify/functions/punktur-greining.js` (skema-þvingað JSON, Sonnet 5, fail-CLOSED
  þar til `HUB_STAFF_PASSWORD` er sett). Tafla `reikningspunktar`
  (`sql/2026-09-05_reikningspunktar.sql`).

## Samstillt milli véla — harðkóðuð regla (05.09.2026)

fjórar tölvur í sama rými vinna
  saman í sömu gögnum. **Hvert merki, takki, hnappur, textareitur eða upplýsing sem lýsir STÖÐU
  gagna** (krafa send/staðfest/greidd/falin, nótur, drög, körfur, punktar, breytingar á tímum,
  stillingar sem snerta reikninga) **VERÐUR að skrifast á þjóninn** (Supabase-tafla eða
  `/api/app-state` með SÉR-lykli) **og lesast þaðan** — aldrei aðeins í `localStorage`,
  `sessionStorage` eða `state.ui`. `localStorage` er leyfilegt fyrir útlitsval eins vafra
  (sía, röðun, samanbrot, þema, hver er við vélina) og fyrir skyndiminni sem þjónninn
  endurhleður. `state.ui` (hub_state) er heilt object sem hver vél yfirskrifar — vinnustaða
  á ekki heima þar. Dæmi um rétta leið: `krofur_yfirlit_meta` (confirmed/sent/done/hidden/
  paid/note), `invoice_drafts`, `reikningspunktar.karfa`, `app_kv` (`ky_settings`).
  Úttekt á vafra-lyklum: `docs/UTTEKT-VAFRASTADA-20260905.txt` (brunaholf).


## Hliðarstikan — HLIÐARSTIKA v2 (19.10.2026, index.html:2607)

⚠️ Gamli kaflinn („flokkalínur 07.10“, `sep`-hlutir í `state.tabs`, „tabs-fylkið fer upp í heilu lagi“)
er ÚRELTUR — sá sem fylgir honum endurvekur villuna sem Agnar kvartaði yfir „20–30 sinnum“.

- Röð + flokkalínur = EITT skjal: `ui.vidmot.hlidarstika = { v:{ rod:[ {id} | {id, sep:'Heiti'} ] }, ts }`.
- **Aðeins smellur notandans skrifar skjalið** (drag, ✎, ✕, ➕, Stillingar-röðun). Kóðinn aldrei.
- Nýjasti `ts` vinnur — í `_mergeIn` OG í `hub_state_merge` á þjóninum.
- `state.tabs` er aðeins SKRÁ yfir flipana (heiti, tákn, url). **Röð þess skiptir engu.** Nýr flipi sem skjalið
  þekkir ekki birtist aftast (fyrir ofan Stillingar).
- Útlit óbreytt: merkt lína = gull ◆-flokkafyrirsögn (`css/theme.css` `.tab-sep .sep-label`), síður 30 px
  inndregnar. Lestu athugasemdina við index.html:2607 áður en þú snertir stikuna.

## Lærdómur

- **04.11.2026 — 22 flipa-auðkenni sem skráin nefndi ekki** (fall í index.html; eigandi skv. `.claude/sidukort.json`):
  `stjornbord` renderStjornbord 24628 (framendi) · `vinnustofa` renderVinnustofa 10860 · `afkost` renderAfkost 18577 (jarvis) ·
  `ajour` renderAjour 17618 (gagnaleidslur) · `efniskostnadur` renderEfniskostnadur 23285 · `gerdreikninga` renderGerdReikninga 11590 ·
  `tilbunirReikningar` renderTilbunirReikningar 11352 · `verdlisti` renderVerdlisti 23677 · `vinnubok` renderVinnubok 14790 (bokari) ·
  `verkstadapostur` renderVerkstadapostur 17016 (verkstadur) · `leidsogn` renderLeidsogn 24711 (sara-organizer) ·
  `skyrslustod` renderSkyrslustod 4707 · `driveleit` renderDriveLeit 17742 · `pdftools` renderPdfTools 3965 ·
  `skraalisti` renderSkraalisti 3945 · `eydublod` renderEydublod 3215 (skjol) · `postleit` renderPostleit 17845 (postur) ·
  `turbopaint` renderTurbopaint 3208 · `vidskiptavinir` renderVidskiptavinir 3241 (kunnaskra) · `verkefnaskra` renderVerkefnaskra 21465 (jarvis) ·
  `verkkaupar` (iframe → verkkaupar.html) · `verkfaeri` (ytri slóð verkfaeri.netlify.app). Dreifarinn `render()` er index.html:2875–2933.
- **04.11.2026 — dauður kóði og smávillur:** `renderVerkefnalisti` (index.html:25480) er aldrei kallað (~120 línur); `vidskiptavinir`
  er tvítekinn í `DEFAULT_STATE.tabs` (1593 og 1643); `verkefnastada`/`gogn`/`utgjold` hafa `sheetCsv:''` → tómir nema slóð sé sett.
  Ekki laga framhjá verkefnalistanum.
- **04.11.2026 — skil:** Efnislistinn er `bokari`, Drög-stöðin `rukkari` — þú á aðeins flipaskelina, ekki efnið.

- **16.10.2026** — Uppgjör 16.10.2026 úr Stílstjóra-lotunni: Sími Agnars keyrir Force Dark sem ekki slekkst — allar hub-síður þurfa `<meta name="color-scheme">` (lagað 28.08 á 32/32, en starfsmenn.html er í dag EINA af 36 síðum sem vantar hann). Kröfu yfirlit-strimillinn (04.09 „Þetta er enþá í klessu … jafnt alls staðar á milli“): mæla bil á hverjum hnapp fyrir sig, ekki eitt gildi.

- **16.10.2026** — 15.10.2026 — hliðarstikan „alltaf í veseni": rótin var hub_state-samstillingin — let _serverHasRecord = false í HVERRI hleðslu ⇒ hver vistun á undan fyrstu heppnuðu samstillingu sendi ALLT staðbundið ástand ({key:hub_state, value:state}) og skipti þjónsfærslunni út; flushSyncNow keyrir á pagehide svo vél sem er SLÖKKT með gamla stiku sendi hana á leiðinni út og þurrkaði hinar þrjár (grunnmynd 68 flipar/6 flokkalínur/30 faldir → þjónn 61/0/2). Lagað: null = óvitað, heilskrif aðeins eftir séð 404 + engin snapshot, annars alltaf patch; stikan endurheimt úr tmp/stika-grunnmynd.json; nýr „✓ Vista" skolar strax og borði segir satt. VÖRNIN VIRKAR FYRST ÞEGAR HVER VÉL HEFUR GERT Ctrl+F5. Útilokað með mælingu 12.10: ensureNewTabs endurraðar ekki, migration endurnefnir ekki, RPC skiptir topp-lykli út heilum.

## Efnislisti .gb2 · Viðskiptavinir · Kröfu yfirlit — hvar hlutirnir búa (16.10.2026)

Lota 16.10.2026 (commit 8860d86 → 9f78dd9), allt í `index.html`, grep á nöfnin — línunúmer flakka:

- **Efnislisti-glugginn (.gb2, `grOpenWorksite` → sniðmátið í renderGerdReikninga):** flipar 02–06 í `.gb-tabbar`,
  `gbSetTab(s)` skiptir; `bossSums()` uppfærir samantekt og kallar `redderBox(c)` (03) og efnishlutfall
  (`gr-k-efni` + `gr-sub-03`); `teiknaSaga()` teiknar 06 Fyrri reikningar í `#gr-saga` (létt við opnun = teljari,
  fullt við flipaskipti). Titilröðin: nafn verkkaupa er `button#gr-cust-open.gb-custlink` → Viðskiptavinir.
  Kr/klst-reitir sýna `fmtInn()` (þúsundapunktur) og endursníðast við `blur`, aldrei við ásláttur.
- **Afhending milli flipa í sömu síðu:** `window.__bhOpna = { kt, nafn }`, eytt við lestur. ALDREI sessionStorage/
  localStorage fyrir slíkt — `tools/audit-vafrastada.cjs` (slokkvitaeki, pre-push) telur lyklana á móti grunnlínu
  (brunaholf ls 35) og stöðvar ýtingar beggja repóa ef nýr lykill bætist við.
- **Viðskiptavinir (`renderVidskiptavinir`):** grindin `.vk-grid` teiknuð einu sinni; `teiknaLista()` (vinstri
  listi, leit `#vk-search`) og `velja(name)` → `loadDetail()` (hægri spjald 02–08) uppfæra hvort í sínu lagi.
  `openModal()` (verðskrá per verkstað) og `load()` óbreytt frá fyrri útgáfu. Sjálfgefið fyrsta félag valið >980 px.
- **Kröfu yfirlit spjöld (`invRow`):** `periodTag(inv, tier)` / `vinnuDrog()` við hlið `monthTag` — „Tímabil
  dd/mm–dd/mm" úr drögunum (REVIEWS[worksite|work_month].period_from/to), `.boss-perotag.misr` í gulli þegar
  vinnumánuður ≠ reikningsmánuður. Taflan (/api/krofur-yfirlit, renderKrofur) ber ekkert mánaðarmerki.
- **CSS-gildrur mældar:** (1) haus og raðir sem hvor eru sín grind MEGA EKKI hafa `auto`-dálk — hann fær ólíka
  breidd (tómur í haus, takkar í röð) og fr-dálkarnir hliðrast; fastur px-dálkur. (2) `grid-template-columns:1fr`
  = minmax(auto,1fr): spjald með leitarreit tók min-content 375 px á 390 px síma → `minmax(0,1fr)` + `min-width:0`.
  (3) `toLocaleString('is-IS')` gefur kommur á vél án is-IS — þúsundapunktur með regex. (4) `css/theme.css` er
  með `?v=` í index.html — hnika við hverja CSS-breytingu þar (nú 20261016a).


## Kröfu yfirlit: „Síðustu greiðslur · Payday" (20.10.2026)
Agnar: „síðustu payday greiðslur, dagsetningu og upphæð í frekar litlum dálk til hægri". Spjald (`aside.kyf-greidslur`) til hægri við
skýringarlínuna (`.kyf-subrow` = flex; `css/theme.css`), fimm fastar raðir frá fyrsta ramma svo ekkert hoppar. Gögn: `GET /api/krofu-greidslur?n=5`
(`netlify/functions/krofu-greidslur.js`) = `invoices` með source='payday' OG status='PAID', nýjasta `greidsla_date` fyrst; kreditreikningar (CREDIT)
og Landsbanka-kröfur teljast EKKI. Sótt úr `load()` í Kröfu yfirliti (ekki oftar en á 20 s fresti nema ↻ Sækja), DOM aðeins skrifað ef undirskrift breyttist.

## Kröfu yfirlit: Ósendar-línan farin, drög tengjast Payday sjálfkrafa (20.10.2026)
- Agnar: „taka burt ósendar línuna, hálf óþarfi". Þrepahausinn „Ósendar" í fyrirtækjaspjaldinu er farinn; „🔗 Sameina" (sameinaBtn) býr nú í haus spjaldsins við hlið
  merkjanna (`.ky-tags`) og birtist aðeins þegar ≥2 drög eru sameinanleg. Þrepa-sýnin (`section()`/`renderDebtor`) er óbreytt.
- Agnar: „láta hina hverfa eða mergast þegar kerfið finnur kröfuna í Payday, svo það sé ekki að tvítelja". `krofu-yfirlit-bru.js` tengir ósend drög
  við Payday-röð SJÁLFVIRKT (aðeins reiknað, ekkert skrifað): sama kt, upphæð innan 1 kr, Payday SENT/PAID, gjalddagi ≥ upphaf vinnumánaðar, einn-á-einn
  (elsta drög fyrst), raðir sem hanga á drögum (payday_invoice_id) frátekin. Tengd drög detta úr Ósent en lifa í töflunni/draftKeys; svarið ber `sjalfvirk_tenging[]`.
  Próf: `node tools/test-krofu-sjalfvirk-tenging.cjs` (13 atriði; fellur á gamla kóðanum). Mælt 20.10: sex tengingar á lifandi gögnum (R-371, 377, 378, 379, 380, 381), allar nákvæmar.
- **10.11.2026 — „📄 Efnislisti · sundurliðun" á sendum reikningi (þrep 1):** Agnar: „setja aftur Efnislistann þangað sem var sendur svo
  ég sjái sundurliðunina". Röðin finnur sig í `state.data.sjalfvirk_tenging` (tilvísun → `draftinv|verkstaður|mánuður`) og sækir PDF-ið úr
  `EFDOCS[verkstaður|mánuður]` (aðalskjal fyrst, aldrei `innra`/`timabok_pdf`); tengillinn `[data-ky-sendpdf]` opnar í nýjum flipa og
  stöðvar smellinn svo röðin opnist ekki. Aðeins lestur. Drög sem hanga á `payday_invoice_id` (ekki í sjalfvirk_tenging) fá EKKI tengil enn.
  Próf án skrifa: scratchpad `ky_pdf_test.cjs` (skrár af diski á `bh.test`, GET → lifandi API): R-386/387/388 fengu tengil.
  **Mundu:** tengingin er aðeins reiknuð — ekkert skrifar `payday_invoice_id` á drögin, svo NLSH-mánuður frystist ekki sjálfur (sjá skill `gata-manadarlok`).

## Ógreitt og ósent: EIN skilgreining fyrir Kröfu yfirlit og Viðskiptavini (31.10.2026, endurmælt 10.11.)
- Reglurnar búa í `netlify/functions/_krofu-flokkun.js` (`flokkaReikning`, `erOsent`, `iSummu`, `greidendur`, `sjalfvirkTenging`,
  síðar `tvifarar`/öryggisfé) og BÆÐI `krofu-yfirlit-bru.js` og `verkkaupar.js` kalla á þær. Áður hélt `verkkaupar.js` eigin
  afriti sem fékk ekki lagfæringuna frá 20.10. — Viðskiptavinir sýndi 70,4 m.kr. ógreitt á móti 6,2 í Kröfu yfirliti.
  Breyting á reglu fer í ÞESSA skrá, aldrei í annað fallið; próf `test/krofu-flokkun-*.test.js`.
- Mæling sem á að halda (10.11.: 13.150.501 = 13.150.501, 0 kr munur per nafn): summa `ogreitt` úr `/api/verkkaupar` =
  `tier1.total` úr `/api/krofu-yfirlit-bru`. Ósent má víkja um drög sem eiga engan greiðanda (NESDEKK 2026-10, 358.918 kr) —
  Viðskiptavinir sleppir þeim, Kröfu yfirlit sýnir þau undir verkstaðarnafni. Listinn í Viðskiptavinum sýnir aðeins `skrad`-greiðendur.
- „Stofna stað í Slökkvitæki" krefst kennitölu greiðandans (þjónninn svarar 400, viðmótið segir hvað vantar) — án hennar
  varð til kt-laus tvífari við hvern smell. Pillan `drog` (Payday-drög) ber sama lit og `osent`.

## Nýtt úr Charlize og lotum (28.10.2026)

- Agnar vill sjálfsafgreiðslu: grunnatriði (verð, tímar, texti, dagsetning, eyða, raða, fela síðu, vistun, dálkastýring) eiga að vera breytanleg af honum í viðmótinu — hann vill ekki bíða eftir Claude. [lotur 532a8e1d, 8e43dca9, 2b47ca79]
- Allir listar og töflur fá raðanlega dálkahausa á öllum dálkum og útprentun kemur í sömu röð og á skjánum. [lotur 532a8e1d, 66624710, 9b70f49c]
- Spjald eða yfirlit má aldrei vera blindgata: hver færsla þarf takka eða tengil þangað sem Agnar getur breytt eða klárað málið, helst efst í horni spjaldsins. [C#831; lota 731f63e0]
- Takkar á Fjármála-yfirliti og Kröfu yfirliti eiga að sitja hægra megin í nokkuð beinni röð niður. [lota b4e86ba5, 03.09.2026]
- Claude prófar sjálfur í vafra, líka á síma, áður en Agnar fær útgáfu og segir HVERNIG var prófað og hver útgáfan er sem er lifandi — „Teeestt first … stop making me the tester“; ekkert telst „búið“ án þess. [lota 14b698a2; lota e9205308 (líklega)]
- Sami hlutur má aldrei sýna ólíkt eftir skjá (tækjafjöldi, skoðunarmánuður, staða): ein uppspretta sannleika sem allir skjáir lesa. [C#220]
- Þjónustugáttin (gatt, gatt-admin, gatt.cjs) býr í slokkvitaeki-repo; brunaholf-eintakið er úrelt og áframsendist (301) — breyttu því ekki hér. [lota 6db7868a; lota 229502cb (líklega)]
- Boss-ritillinn í Gerð reikninga: skrifaðu aldrei óvarið í undirtré sem MutationObserver vaktar (bossSums, #gr-mats) — það hengdi vafrann í endalausri lykkju 03.09.2026; skrifaðu aðeins ef gildi breytist og hafðu endurkvæmni-vörð. [C#377]
- Style-blokkin fyrir Efnislista-gluggann í index.html er JS template-strengur, svo í CSS-inu má ekki vera backtick, `${` eða backslash. [lota 6db7868a (líklega)]
- Vinnubók er readonly — Agnar er „eiginlega hættur að nota vinnubók“ og vill Kröfu yfirlit sem aðalstað; drög bera ákvörðun um dagvinnu/yfirvinnu (ev=0 eða ev>0) frá 15.10.2026. [C#888]
- Agnari þykja mörg emoji barnaleg og litlir popup-gluggar ræfilslegir — hann vill faglegra útlit og heilsíðu með góðum lýsingum þegar efnið er mikið. [lota 1555dbad, 05.08.2026]
- Bætir þú endapunkti við í brunaholf, uppfærðu viðkomandi agent í `.claude/agents/` í sömu lotu; birting er aðeins þegar HEAD-commit hefur `[deploy]` (engin build-skref). [lota e9205308 (líklega); netlify.toml]

## Grunnreglur allra agenta (04.11.2026)
1. Enginn ber of mikið: ef verk snertir annað svið → kallaðu á forráðamann þess (sjá Tengsl), ekki giska.
2. Veiddu úr þínum töflum (gagnakortið í docs/AGENTASKRA.md) og skráðu reglur sem bíta í charlize_knowledge (topic = þitt heiti).
3. Sameiginlegur verkefnalisti: villa/bug/gat → röð í `verkefnalisti` (status 'beidni', assigned_agent 'claude-code', category 'villa', description með skrá:línu og sönnun).
4. Áður en lotu lýkur: hvað veit ég núna sem næsta lota veit ekki? → charlize_knowledge (1–5 færslur), kúnnafróðleikur → scope 'kunni' með kennitölu.
5. Boðhlaup (Agnar 04.11.2026): keflið fellur ALDREI á jörðina. Fáirðu verk utan þíns sviðs vinnurðu það ekki þegjandi og sleppir því ekki — þú réttir það eiganda síðunnar/gagnanna (síðukort, gagnakort, Tengsl) með einni línu um hvað er beðið um og hvað þú veist þegar, og segir Agnari hver tók við. Finnist enginn eigandi tekur jarvis við og skráir gat.
