# Agentaskrá

Kanónísk skrá yfir sérfræðinga og skills sem liggja **á diski í git**. Byggð 31.08.2026 af skrám í `slokkvitaeki`, `brunaholf` og `kjarni`. Claude-artifactið „Agentaskráin" var **ekki** synchað: lota opnaði parent-möppu og hlóð **0 af 23** agentum.

**Regla:** ein staðreynd, einn staður. Heimaskráin er í dálkinum Heim. Kjarni á afrit, ekki frumrit. **Engin fjórða kópia** í parent `.claude/agents` (sú mappa er ekki til og á ekki að verða til).

Opnaðu **repo-rótina** (`slokkvitaeki` eða `brunaholf`), ekki parent-möppuna. Annars finnur Claude engar agent-skrár.

Kveikjuorðin í stuttu máli: [`docs/TRIGGERS.md`](TRIGGERS.md). Þetta skjal er nafn, heim, slóð, kveikjur og aldrei-gera.

Teljarinn **153/187** (tilbúið-staða) er **óbreyttur**. Hann er ekki hluti af þessari skrá.

---

## Hvað var úr takti

| Uppspretta | Staða á diski | Vandinn |
|---|---|---|
| Claude-artifact „Agentaskráin" | 0/23 hlaðnir | Cwd var parent-mappa. Artifactið er ekki git. |
| `docs/AGENTASKRA.md` | vantaði | Engin git-heimild fyrir áhöfnina. |
| `docs/TRIGGERS.md` | á diski, **ekki** í `master` | Villuleit-skill vísar hingað; taflan var ócommituð. |
| Jarvis-roster (`brunaholf/jarvis.html` áhöfnin) | 16 HUD-sæti + disk-listi | Uppfært 31.08.2026: HUD sýnir 16 raddir; þar undir 6 agentar án HUD + `villuleit` (hindra klúður). Svið/raddir/KPI-reikningur óbreytt. |
| `kjarni/.claude/agents` | 20 afrit | Afrit (dagsett 20.08.2026), **ekki** heim. Vantar `natalie`, `netvordur`, `elon-musk`. |
| `kjarni/.agents/skills` | 5 **raunveruleg** skills | Ekki stubbar. Platform-tól (schema, shadcn, pgTap, cache). |
| Parent `.claude/agents` | ekki til | Rétt. Ekki búa til. |
| Skill `hindra-kludur` / „hindra klúður" | **ekki á diski** | Leitað í öllum þremur repo. Næsta vörn: `villuleit` + `variant-analysis` + `netvordur`. |

**25 einstök agent-nöfn** á diski (15 skrár í brunaholf + 14 í slokkvitaeki = 29 skrár; `joker`, `kunnaskra`, `natalie` og `rukkari` eru í báðum sem sitthvor heimaskrá). Uppfært 28.10.2026.

**04.11.2026 (Agentakerfið 2.0, fasi 2):** +14 nýir agentar (2 í brunaholf, 9 í slokkvitaeki, 3 í kjarna) og `rambo` + `samthykktir` komnir í töfluna → **39 agentar**. `oryggi` heitir nú Ripley, `framendi` Lara Croft.

**04.11.2026 (fasi 5 — Agentanetið í Jarvis):** `brunaholf/js/agentanet.js` teiknar lag 2 í `jarvis.html`: fullskjás-graf (⛶ á Sérfræðinga-spjaldinu eða `#agentanet`) með Jarvis-kjarnann í miðju → 5 stjórar (`fyrirtaeki · framendi · bord-flettur · kjarni-vefur · rukkari`) → sérfræðingar → 321 síður sem punktar (grænn eigandi · rauður enginn · grár merki), verðir í rönd; smellur lýsir síður agents, tvísmellur opnar Agentaskrána; lifandi yfirlag úr `charlize_sessions` (agent sem var kallaður glóir). Fjögur ný spjöld: **Síðukort** (þekja per vef, „Leggja til eiganda“ → `agent_notes`), **Lotur síðustu 7 daga** (`/api/lotur`, rautt „ólokið minni“ = kt snert án kúnnaminnis), **Göt & tillögur** (router-göt + síður án eiganda), **Minnið** (`/api/charlize-stada`, biðstofa með Samþykkja = `charlize_approve` / Hafna = `rejected`). Eigendur í öðru repói (`sl:`, `bh:`, `skill:`) leysast nú í byggjaranum (`leysaEiganda`) → kjarni 98/98 ✅. Þemað erfist (klassískt/Ragnarök). Útlitið er úr hönnuninni „Agentanetið — Jarvis-mælaborð“ (04.11, HANDOFF): `css/agentanet.css` (tókenar .theme-jarvis/.theme-ragnarok, klasar .pnl .nd .kc .tab .gw .lnk* .li .ttl haldast fyrir Cowork), hringurinn er íhluturinn `js/jarvis-ring.js` + `css/jarvis-ring.css`, sporbaugsuppröðun með hermdri rúmfræði (engin skörun), engin emoji. Tengill af Þjónustuborðinu í appinu: slokkvitaeki patch 493.

---

## 39 agentar

`Heim` = kanóníska skráin. `kj` = afrit í `kjarni/.claude/agents` (stale vs heim). Dual-home: `joker` og `kunnaskra` eiga raunverulega skrá í **báðum** rekstrar-repo (hub vs app).

| Nafn | Roster | Heim | Slóð | Kveikjur | Aldrei |
|---|---|---|---|---|---|
| `jarvis` | 🎩 Jarvis | brunaholf | `.claude/agents/jarvis.md` (kj afrit) | `hver er staðan` · `morgunyfirferð` · `Jarvis` · `hype` · `hvernig gengur` (kafli „Svið yfirlit“ — áður agent `hype`) | Fundin upp tala/dagsetning/nafn. Lestu ekki heilar töflur. |
| `bokari` | 💰 Samantha | brunaholf | `.claude/agents/bokari.md` (kj afrit) | `taxti` · `VSK` · `NLSH` · `uppgjör` · `stemmir tala` · `krafa` (með sala) | Baka afslátt í línu **og** geyma í `afslattur`. Stofna eða senda reikning. |
| `rukkari` | 🦆 Jóakim aðalönd | brunaholf (spegill í slokkvitaeki + ~/.claude/agents) | `.claude/agents/rukkari.md` | `rukka` · `rukkunarmál` · `reikningalota` · `klára reikninga` · `hvað er tilbúið að senda` · `nýjustu póstar` · `sækja úr pósti` (kafli „Póstur → punktar“ — áður agent `eldklar-postur`) · `ósent` · `ógreitt` · `útistandandi` | Senda eða skrifa sjálfur í drög, sölur eða Payday. Giska á tölu. Spyrja um það sem stendur í REIKNINGALOTA.md. |
| `sara-organizer` | 🗂️ Sara (pör) | brunaholf | `.claude/agents/sara-organizer.md` (kj afrit) | `para` · `þekja` · `gloppa` · `vantar að rukka` | Giska á pörun. Stofna/breyta reikningi. Senda póst. Sameina rekstrarfélaga-staði. |
| `sara-coworker` | 🗂️ Sara (skýrslur) | slokkvitaeki | `.claude/agents/sara-coworker.md` (kj afrit, styttra) | `skýrsla` · `úttekt` · `fylla skýrslu` | Yfirskrifa texta sem er þegar í reit. Baka afslátt **og** `afslattur`. Segja „vistað" án lesturs til baka. Hengja brunakerfi á úttekt. Sameina staði. |
| `kunnaskra` | ❄️ Charlize | **bæði** | bh `.claude/agents/kunnaskra.md` (hryggurinn) · slokk sama nafn (app-hlið) · kj = bh-afrit | `kennitala` · `kt` · `999999` · `customers_base` · `rekstrarfélag` · `sameina` · `tvítak` · `Tengireglan` · `hits[0]` · `companyForBld` | Sameina staði rekstrarfélags. Giska / núlla `fyrirtaeki_id`. Eyða/skrifa yfir kúnnaröð án Agnars. Rugla `fyrirtaeki_id` við kennitölu. |
| `skjol` | 🎙️ Freeman | brunaholf | `.claude/agents/skjol.md` (kj afrit) | `Drive` · `PDF` · `endurnefna` · `skjal` | Eyða Drive-skrá (`files.delete`). Treysta skráarheiti. Giska á fyrirtæki. |
| `gagnaleidslur` | 🥊 Statham | brunaholf | `.claude/agents/gagnaleidslur.md` (kj afrit, styttra) | `Tímavera` · `Ajour` · `Redder` · `innsog` | Merkja rautt af hráu „cancel". Giska rekstrarfélags-systur. |
| `hradi` | 💥 Willis | brunaholf | `.claude/agents/hradi.md` (kj afrit) | `hraði` · `hægt` · `polling` · `bundle` | Fullyrða um bata án mælingar fyrir og eftir. Hamra á DB á meðan mælt er. |
| `tengingar` | 😤 Samuel L. J. | brunaholf | `.claude/agents/tengingar.md` (kj afrit) | `lykill` · `tengingar` · `gult` · `rautt` | Falskt grænt. Skila lyklum. Setja lykil í kóða eða skjal. |
| `kerfisheilsa` | 🩺 Dr. House | brunaholf | `.claude/agents/kerfisheilsa.md` (kj afrit) | `bilað` · `niðri` · `timeout` · `eitthvað skrítið` | Úrskurða af status-síðu. Afturkalla deploy til að „prófa". |
| `oryggi` | 🔒 Ripley (Sigourney Weaver; áður „Arnold“) | brunaholf | `.claude/agents/oryggi.md` (kj afrit) | `RLS` · `policy` · `lekt` · `anon` · `bucket` | Enable RLS án policy. Lyklar í frontend/repo. |
| `framendi` | 🗺️ Lara Croft *(ekkert HUD-sæti enn)* | brunaholf | `.claude/agents/framendi.md` (kj afrit) | hub-flipi, hvar eitthvað í `index.html` býr | Lesta `index.html` í heilu lagi. |
| `joker` | 🃏 Joker | **bæði** | slokk `.claude/agents/joker.md` (app) · bh sama nafn (hub) · kj = **bh**-afrit (app-útgáfan er lengri) | `útlit` · `sími` · `mobile` · `þröngt` · `endurhanna` | Giska á útlit án skjás. `node deploy.js`. Harður stoppari á Vista. Fara framhjá Stílstjóra. |
| `natalie` | 🌸 Natalie | slokkvitaeki | `.claude/agents/natalie.md` (**ekki** í kjarni) | `stemmir þetta` · `er þetta rétt` · `factcheck` · `farðu yfir árið` · `hvað er satt hérna` | Leiðrétta gögn. Skrifa í `solur` / `uttaeki` / `customer_documents`. „Nokkur tilvik" án töflu. |
| `netvordur` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/netvordur.md` (**ekki** í kjarni) | `öryggisnet` · `er óhætt` · `brýtur þetta` · `audit-all` | Breyta kóða (úrskurðar SAFE / CUTS-A-WIRE). Persónu-kt í log. |
| `elon-musk` | ⚡ Elon Musk | slokkvitaeki | `.claude/agents/elon-musk.md` + skill sama nafn (**ekki** í kjarni) | `árs` · `ársreitur` · `pera` · `FULLBÚIÐ` · `VANTAR` · `SOURCE` · `FILTER` | Endurstíla `._yr`. Sameina hótel á kt. `hits[0]`. `node deploy.js`. Vista allan Ársskoðun-blob. |
| `prentun` | 🏷️ DeVito | slokkvitaeki | `.claude/agents/prentun.md` (kj afrit) | `prentun` · `QR` · `miði` · `Brother` · `raðnúmer` | Gamla QR-fallback (falskur QR). Geyma QR í dálk. |
| `kort` | 🗺️ Ramsay | slokkvitaeki | `.claude/agents/kort.md` (kj afrit) | `kort` · `pinnar` · `geocode` · `Leaflet` · `kill-dots` | Vektor-merki (á að vera `L.divIcon`). Rugla við `bord-flettur` (síðurnar). |
| `sala-reikningar` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/sala-reikningar.md` (kj afrit) | `reikningur` · `sala` · `POS` · `Payday` · `dkPlus` · `afsláttur` · `krafa` | Afsláttur á tvo vegu. Blokka Vista. Yfirskrifa úttektartexta. Leiða vottun af tækjalista. |
| `thema` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/thema.md` (kj afrit) | `þema` · `skinna` · `Brunastál` · `theme.css` | Endurvekja þemaskipti (frosið 17.08.2026) án Agnars. |
| `bord-flettur` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/bord-flettur.md` (kj afrit, styttra) | `flipi` · `borð` · `nav` · `bílstjóri` · `aksturslisti` · `bakk` | Blanda bakk-lögum (18/276/277). Nota `history.length` fyrir bakk. |
| `adstod` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/adstod.md` (kj afrit) | `watchlist` · `banner` · `aðstoð` | (Fasi 2 AI-tips er óunninn; ekki lofa honum.) |
| `rambo` | 🪖 Rambo | brunaholf | `.claude/agents/rambo.md` | `er óhætt að keyra` · `forskoða` · `hvað getur farið úrskeiðis` · `áður en ég ýti` · `Rambo` | Framkvæma aðgerðina sjálfur. GO án talinna raða. |
| `samthykktir` | 🕵️ Columbo *(ekkert HUD-sæti)* | slokkvitaeki | `.claude/agents/samthykktir.md` | svör Agnars · `samþykkt` · `Aðalmál` · Þjónustuborð-ákvarðanir | Svara fyrir Agnar. Loka máli án svars hans. |
| `verkstadur` | 🪨 The Rock | brunaholf | `.claude/agents/verkstadur.md` (NÝR 04.11) | `Frá verkstað` · `vettvangsapp` · `Brunaþéttingar-appið` · `field-app` · `efniskostnaður verkstjóra` · `sérkaup` | Breyta verði utan `js/gr-materials.js`. Kostnaður á einingaverk (LSH/Heklureitur). Eyða `field_entries`-röð. |
| `endurskodandi` | 🧮 The Accountant | brunaholf | `.claude/agents/endurskodandi.md` (NÝR 04.11) + `references/endurskodandi/` (5 lög) | `VSK` · `VSK-skýrsla` · `númeraröð` · `kreditreikningur` · `ársreikningur` · `stenst þetta` | Leiðrétta/eyða/kreditfæra sjálfur. Byggja á `payday_invoices_slokk` einni. Skila til Skattsins. |
| `fyrirtaeki` | 🎖️ M (Judi Dench) — stjóri | slokkvitaeki | `.claude/agents/fyrirtaeki.md` (NÝR 04.11) | `fyrirtæki í þjónustu` · `fyrirtækjakort` · `staðan hjá …` · kt/fyrirtækjanafn | Breyta gögnum sjálfur. Giska á `fyrirtaeki_id`. Sameina rekstrarfélags-staði. |
| `postur` | ✉️ Meg Ryan | slokkvitaeki | `.claude/agents/postur.md` (NÝR 04.11) | `póstur` · `nýjustu póstar` · `hvað kom í pósti` · `sækja úr pósti` · `ósvarað` · `svardrög` · `Póstleit` · `brýnt` · `óafgreitt` | Senda póst. Lesa `aggisigurds@gmail.com` (einkapóstur). |
| `thjonustugatt` | 🛡️ Heimdall | slokkvitaeki | `.claude/agents/thjonustugatt.md` (NÝR 04.11) | `þjónustugátt` · `gátt` · `gatt-admin` · `Tilkynna` · `rýmingaráætlun` · `portal` | Opna gátt/slug/hlekk án lykilorðs. Sýna kúnna gögn annars. |
| `logfraedingur` | ⚖️ Elle Woods | slokkvitaeki | `.claude/agents/logfraedingur.md` (NÝR 04.11) + `references/logfraedingur/` (15 lög) | `lög` · `reglugerð` · `er þetta löglegt` · `fyrning` · `innheimtuviðvörun` · `dráttarvextir` · `persónuvernd` | Giska á greinanúmer/gildistöku. Senda innheimtuviðvörun eða kröfu. |
| `innkaupabokari` | 🔢 Rain Man | slokkvitaeki (undiragent `endurskodandi`) | `.claude/agents/innkaupabokari.md` (NÝR 04.11) | `innkaupareikningur` · `birgjareikningur` · `kvittun` · `kíktu í vasann` · `tvíbókað` · `flokka kostnað` | Bóka/samþykkja án leyfis. Telja `reikningslestur` sem innkaup. Eyða röð í `kostnadur`/`vasinn`. |
| `birgdastjori` | 🤠 Indiana Jones | slokkvitaeki | `.claude/agents/birgdastjori.md` (NÝR 04.11) | `birgðir` · `lager` · `endursala` · `endurrukka` · `keypt fyrir verk` · `innkaupapöntun` · `talning` | Uppfæra birgðir/verð án leyfis. Afslátt birgis á reikning kúnna. |
| `kodafraedingur` | 🖤 Lisbeth Salander | slokkvitaeki | `.claude/agents/kodafraedingur.md` (NÝR 04.11) | `rétta aðferðin` · `kóðarýni` · `patch-mynstur` · `cache-bump` · `tvítak` · `MutationObserver` | Skrifa kóða sjálf eða `node deploy.js`. RÉTT AÐFERÐ án systkinaleitar. |
| `utlitsserfraedingur` | 👠 Miranda Priestly | slokkvitaeki | `.claude/agents/utlitsserfraedingur.md` (NÝR 04.11) | `farðu yfir útlitið` · `kontrast` · `svart á svörtu` · `hvítt á hvítu` · `hlutföll` · `snertiflötur` | Hanna/skrifa CSS sjálf (Joker). SAMÞYKKT án skjáskots í S26 og 412 px. |
| `opp` | 🐜 Ant-Man | slokkvitaeki | `.claude/agents/opp.md` (NÝR 04.11) | `firestarter` · `öpp` · `app-síða` · `zoom` · `skölun` · `of stórt` · `of lítið` · `skipta um síðu` | Blanda bakk-lögum 18/276/277. Fasta haus-/stikuhæð í stað mældrar breytu (353). |
| `kjarni-vefur` | 🕶️ Neo | kjarni | `.claude/agents/kjarni-vefur.md` (NÝR 04.11) | `Kjarni` · `Vercel` · `404 í Kjarna` · `Stjórnstöðin /kjarni` · `kjarni_*` · `tólaskrá` | Deploy án build-prófs. Ný tafla án RLS. |
| `artcraft` | ✂️ Edward Scissorhands | kjarni | `.claude/agents/artcraft.md` (NÝR 04.11) | `ArtCraft` · `Skýjastúdíó` · `Replicate` · `myndvinnsla` · `hvað kostar kallið` | Opna API-leið án auðkenningar. Kalla á greitt líkan án verðs. |
| `skraning` | 📚 Hermione | kjarni | `.claude/agents/skraning.md` (NÝR 04.11) | `Skráning` · `Skráning & QA` · `skr_*` · `Ajour-innflutningur` · `pinni` · `gátlisti` | Skrifa í `skr_ajour_lesid` (fer framhjá RLS í `ajour_registrations`). Keyra innflutning án leyfis. |

---

## Grunnreglur allra agenta (04.11.2026)

Samþykkt af Agnari 04.11.2026 (Agentakerfið 2.0). Kaflinn er í hverri agent-skrá; hér er heimildin.

1. Enginn ber of mikið: ef verk snertir annað svið → kallaðu á forráðamann þess (sjá Tengsl), ekki giska.
2. Veiddu úr þínum töflum (gagnakortið í docs/AGENTASKRA.md) og skráðu reglur sem bíta í charlize_knowledge (topic = þitt heiti).
3. Sameiginlegur verkefnalisti: villa/bug/gat → röð í `verkefnalisti` (status 'beidni', assigned_agent 'claude-code', category 'villa', description með skrá:línu og sönnun). Aldrei laga framhjá listanum.
4. Áður en lotu lýkur: hvað veit ég núna sem næsta lota veit ekki? → charlize_knowledge (1–5 færslur), kúnnafróðleikur → scope 'kunni' með kennitölu.

---

## Gagnakort — forráðamenn

Supabase `osfdzskyvisifcwyjkuk` skipt í 12 búta. **Forráðamaður** = sá sem LES fyrst, SKRÁIR niðurstöðu og hinir spyrja; hann
skrifar ekki í gögnin nema hann sé þegar með það hlutverk. Töfluheiti stytt (fullur listi: planið „Agentakerfið 2.0“ kafli 2;
töfluhlutinn er byggður sjálfvirkt í `data/gagnakort.json`).

| Bútur | Forráðamaður (sérfræðingar) | Helstu töflur |
|---|---|---|
| Fyrirtæki & kúnnar | **`fyrirtaeki`** (stjóri) → `kunnaskra` | customers_base, fyrirtaeki, fyrirtaeki_virkni, vidskiptavinir, customer_info, stadur_kerfi, postfang_tengsl, charlize_contacts, verkkaupi_crm, hunter_adilar … |
| Tæki & ársskoðun | `elon-musk` · `natalie` · `arnold` | uttaeki, taeki_saga, skodunar_saga, thjonustusaga, year_factcheck, trio_saga, bunadargreining, slokkvikerfi, brunakerfi_skyrslur, eldvarnabok … |
| Skýrslur & skjöl | `skjol` · `sara-coworker` · `sara-organizer` | customer_documents, document_pairs, doc_factcheck, report_inbox, staging_docs, efnislisti_documents, eydublod_skjol, sara_yfirferd … |
| Sala, reikningar & kröfur | `sala-reikningar` · `rukkari` · `bokari` (+ `endurskodandi` vottar, `innkaupabokari` innkaup) | solur, vorur, birgdir, invoices, invoice_drafts, reikningslinur, reikningslestur, payday_invoices_slokk, stolpi_*, bank_transactions, kostnadur, teya_faerslur, tilbod, hole_size_rates … |
| Þjónustuborð & verk | `bord-flettur` · `samthykktir` | thjonustubeidni, thjonustubord_*, verkbeidnir, verklidur, verkefnalisti, dagskra, bilstjori_vakt, akstursdagbok, verkdagbok, vasinn … |
| Póstur & samskipti | **`postur`** | email_digest, email_actions, postur_*, postsaga_otengd, reikninga_postur_*, sms_saga, gmail_oauth, google_oauth |
| Brunahólf rekstur | `bokari` · `gagnaleidslur` · **`verkstadur`** | ajour_registrations, ajour_teikningar, timavera_*, nlsh_*, worksite_status, verkstadur_info, field_entries, field_shares, cg_entries, brunaholf_mal, hub_adgangar … |
| Þjónustugátt | **`thjonustugatt`** | portal_*, skodun_invites, skodun_submissions, rymingaraetlun, vefryni_*, vefverslun, hunter_blad/_fasteignir/_herferdir |
| Kjarni | **`kjarni-vefur`** · **`artcraft`** · **`skraning`** · `arnold` (TurboPaint) | turbopaint_*, teikning_bord, work3d_projects, marks_boards, mask_jobs, mindmap_boards, kjarni_*, skr_*, kerfi_*, hus_maelingar … |
| Kerfi, sjálfvirkni & vörður | `kerfisheilsa` · `tengingar` · `netvordur` · `oryggi` · `hradi` | app_settings, app_kv, app_problems, audit_*, oryggisnet_keyrslur, override_log, automation_*, heilsucheck, vel_heartbeat, villur, user_profiles … |
| Agentar & minni | `charlize` (skill) · `jarvis` | charlize_knowledge, charlize_inbox, charlize_artifacts, charlize_sessions (ný), agent_logs, agent_notes, factcheck_*, artifact_listar, raddminni … |
| Afrit & snapshots | `rambo` (forskoðun áður en eytt) | backup_*, uttaeki_backup_*, cowork_*_2026xxxx, _merge_backup_*, ajour_registrations_villa_*, stg_*, trp_* — „má eyða eftir N daga“, ekki eytt í þessu plani |

---

## Skills sem hindra klúður

`hindra-kludur` / „hindra klúður" er **ekki** skill-mappa á diski. Það sem *er* til og gegnir því hlutverki:

| Nafn | Tegund | Heim | Slóð | Kveikjur | Aldrei |
|---|---|---|---|---|---|
| `villuleit` | skill | slokkvitaeki | `.claude/skills/villuleit/SKILL.md` | `villuleit` · `variant` · `variant-alert` · `sama mynstur` · `er þetta víðar` · `afrit` · `systkini` · `fölsk staðreynd` · `röng join` | Nýtt app / nýr flipi / ný tafla. Laga fyrsta hitt. |
| `variant-analysis` | skill | slokkvitaeki | `.claude/skills/variant-analysis/SKILL.md` | `er þetta víðar` · `laga þetta alls staðar` · eftir að villa finnst | Segja „lagað" án RÓT/LEITAÐ/FUNDIÐ/LAGAÐ/EFTIR/SANNAÐ. |
| `netvordur` | agent | slokkvitaeki | `.claude/agents/netvordur.md` | sjá að ofan | Sjá að ofan. |
| `uttekt-audit` | skill | slokkvitaeki | `.claude/skills/uttekt-audit/SKILL.md` | `audit` · `samræmi` · `stemmir` · `passar magnið` | Skrifa (lesaðeins). |
| `charlize` | skill | slokkvitaeki | `.claude/skills/charlize/SKILL.md` | `muna` · `skrá` · `Charlize` · `hvernig var þetta` | Spyrja Agnar að því sem Charlize veit nú þegar. |
| `arnold` | skill | slokkvitaeki | `.claude/skills/arnold/SKILL.md` | `staðsetning` · `slökkvigildi` · `flóttaleið` · `byggingarreglugerð` · `TurboPaint` · `3D` | Arnold er í TurboPaint, staðsetningu slökkvitækja og 3D-veggjateikningum (Agnar 29.10.2026). Rugla ekki við agent `oryggi` (RLS) — röddin þar heitir enn Arnold í `jarvis-voice.js`, nafnið óákveðið. |
| `elon-musk` | skill | slokkvitaeki | `.claude/skills/elon-musk/SKILL.md` | sama og agentinn | Sjá `elon-musk` að ofan. |
| `deploy` | skill | slokk + bh | `.claude/skills/deploy/SKILL.md` | `deploy` · `ýta` · `deploy.js` | `node deploy.js`. |
| `vidmotsprof` | skill | brunaholf | `.claude/skills/vidmotsprof/SKILL.md` (+ `sink.cjs`) | `prófa` · `staðfesta` · `virkar þetta` · `skjáskot af PDF` | Staðfesta UI með API-kalli. Láta próf skrifa í lifandi gögn. |
| `gata-manadarlok` | skill | brunaholf | `.claude/skills/gata-manadarlok/SKILL.md` | `loka mánuðinum` · `Efnislisti NLSH` · `Heklureitur göt` · `lokastaðan` | Endurreikna frosinn mánuð. Setja 5% í drögin. Nota mánuð síðunnar. |
| `bh-pdf` | skill | brunaholf | `.claude/skills/bh-pdf/SKILL.md` | `PDF útlit` · `font í Verkstaður` · `lógóið` · `Tímaskýrsla PDF` | Teikna haus upp á nýtt. Edit án fallheitis (teiknararnir eru nær eins). |
| `samthykki-a-bord` | skill | ~/.claude (bæði félög) | `~/.claude/skills/samthykki-a-bord/SKILL.md` | `settu á þjónustuborðið` · `setja inn á samþykktir` · `settu á mig` | Safnspjald. Insert án `assigned_to 'Agnar'`. |

---

## Jarvis-roster (brunaholf)

Áhöfnin á `jarvis.html` er **tveir opnir hópar** (17 raddir + 6 lén). Villuleit er alvöru HUD-sæti (`data-spjald="villuleit"`) með grep-kveikjum — skill, ekki rödd.

Sæti: Jarvis · Samantha · Sara · Charlize · Freeman · Statham · Willis · Samuel L. J. · Dr. House · Trump · Arnold · DeVito · Ramsay · Elon Musk · Natalie · Joker · Jóakim aðalönd (🦆 rukkari, svið `rukkun`, 05.09.2026).

Veiði-kort koma úr `/api/veidin` + `v_veidin_hunt_*`. Grunnlínan **2026-07-30** er **staða um mánuði síðan**. Hunt-kort (systkini-kt, blob-græn, HUD Búið vs skýrsla, Drive-tvítök) eiga enga grunnlínu. `153/187` er óbreytt.

Aðrar Jarvis-tölur sem `jarvis.md` telur ósamræmdar (ekki lagaðar hér): `js/jarvis-voice.js` AGENTS = 16 raddir; `svid-status.js` SVID = 13 svið. Roster er útlit, ekki loader.

---

## Kjarni: afrit vs raunveruleg skills

`.claude/agents/` í kjarna er **samsteypa afrita** (CLAUDE.md: „Afrit, ekki frumrit", afritað 20.08.2026). Breytingar fara fyrst í Heim-dálkinn hér að ofan.

Afritin eru **ekki stubbar** (fullar skrár) en þau eru **stale**: stærðarmunur vs heim, og þrjú nýrri agentar vantar (`natalie`, `netvordur`, `elon-musk`). Ekki lagað hér; kjarni er ekki git-heimildin.

`.agents/skills/` í kjarna eru **raunveruleg** platform-skills (ekki stubbar, ekki afrit af slokk/bh):

| Skill | Slóð | Notað þegar |
|---|---|---|
| `supabase-schema-migrations` | `kjarni/.agents/skills/supabase-schema-migrations/SKILL.md` | Schema / RLS / migrations. Aldrei handskrifa migration. |
| `shadcn-expert` | `kjarni/.agents/skills/shadcn-expert/SKILL.md` | shadcn/ui í Next.js. |
| `pgtap-test-generator` | `kjarni/.agents/skills/pgtap-test-generator/SKILL.md` | pgTap / RLS-próf. |
| `nextjs-cache-components` | `kjarni/.agents/skills/nextjs-cache-components/SKILL.md` | Next.js 16 `use cache` / PPR. |
| `component-to-shadcn-component-converter` | `kjarni/.agents/skills/component-to-shadcn-component-converter/SKILL.md` | Flytja UI yfir í shadcn. |

Kjarni á líka `.claude/skills/` (viðskipta-afrit + hönnun). Þau eru ekki heim.

---

## Repo-vísun

| Lén | Repo |
|---|---|
| App, POS, Ársskoðun, Bílstjóri, QR, kort | `slokkvitaeki` |
| Hub, customer.html, Drive-tól, Jarvis-síða, RLS | `brunaholf` |
| Ný Next.js / schema / shadcn | `kjarni` |

Bæði slökkvitæki og brunahólf lesa sama Supabase `osfdzskyvisifcwyjkuk`.

**Hvernig Agnar sendir:** opna rétt repo, líma eina línu úr [`TRIGGERS.md`](TRIGGERS.md), t.d. `villuleit: sama mynstur og Plaza`.

## Sjálfvirk skrá, kveikjuorð og athugasemdir (28.10.2026)

- **Kveikjuorð eru í `description:` hverrar agent-/skill-skrár** (síðasta setning: `Kveikjuorð: …`) — þar velur Claude agent. Lýsingar birtast í samhengi hverrar lotu: haltu þeim ≤ ~650 stafir. Kveikjur-dálkurinn í töflunni hér að ofan er frá 31.08; núverandi orð eru í sjálfvirku töflunni neðst í [`TRIGGERS.md`](TRIGGERS.md).
- **Jarvis → Sérfræðingar:** spjaldið sjálft les lifandi stöðu (🟢🟡🔴⚪, skrif, síðast skrifað) úr `data/agentar-stada.json`, sem `slokkvitaeki/tools/audit-agentar.cjs --json` skrifar daglega. 📖 „Agentaskráin“ opnar glugga úr `js/agents-registry.js` (lýsing, kveikjuorð, „aldrei“, verkfæri, dagsetning úr git; smellur á röð í spjaldinu opnar hann líka) — hann býr `node tools/build-agents-registry.cjs` til úr `.claude/agents` + `.claude/skills` og `tools/agents-meta.json` (persóna, flokkur, sérhæfing). Keyrðu byggjarann eftir hverja breytingu á agent- eða skill-skrá (`SL_REPO=<slóð>` ef slökkvitækja-repóið er ekki systurmappa).
- **Athugasemdir Agnars við agenta** (Jarvis → opna agent → „📝 Bæta við upplýsingum“) vistast í `agent_notes` (`/api/agent-notes`). Skill `agent-athugasemdir` lýsir hvernig þær eru teknar inn.
- **Nýr lærdómur** fer í Charlize (`charlize_knowledge`); lotu-uppskera fer fyrst í `charlize_inbox` og Agnar hleypir inn með `charlize_approve(id)`.

## Tengt

- Kveikjur: [`docs/TRIGGERS.md`](TRIGGERS.md)
- Charlize-vísun (eldri listi, 12 slokk-agentar): `.claude/skills/charlize/references/agentar.md`
- Öryggisnet: [`docs/ORYGGISNET.md`](ORYGGISNET.md)
- As-built: [`docs/RAFKERFI.md`](RAFKERFI.md)

**23.10.2026 (mál #1239):** `hype` sameinaður í `jarvis.md` (kafli „Svið `yfirlit`“) og `eldklar-postur` í `rukkari.md` (kafli „Póstur → punktar“). Engin virkni breyttist. Afrit í kjarna (`hype.md`) er ósnert — kjarni er ekki git-heimildin.

<!-- SIDUKORT:BEGIN -->
## Síðukort — hver á hverja síðu (búið til af `node tools/build-agents-registry.cjs`)

Byggt 2026-11-05 úr `brunaholf/.claude/sidukort.json`, `slokkvitaeki/.claude/sidukort.json`, `kjarni/.claude/sidukort.json`. Staða: ✅ eigandi til · ⚠️ eigandi ekki í registry eða skilgreind-skrá finnst ekki · ❌ enginn eigandi. Breyttu síðukortinu, ekki hér.

| Vefur | Síða | Leið | Skilgreind | Eigandi | Undiragentar | Staða |
|---|---|---|---|---|---|---|
| brunaholf | Verkkaupar | `/verkkaupar.html` | `index.html` · `verkkaupar.html` | `kunnaskra` | `framendi` | ✅ |
| brunaholf | Dagurinn | `/#dagurinn` | `index.html#renderDagurinn` | `framendi` | `postur` · `gagnaleidslur` · `jarvis` | ✅ |
| brunaholf | J.A.R.V.I.S. | `/#jarvis` | `index.html#renderJarvis` · `jarvis.html` | `jarvis` | `framendi` | ✅ |
| brunaholf | TurboPaint | `/#turbopaint` | `index.html#renderTurbopaint` | `arnold` | `framendi` · `artcraft` | ✅ |
| brunaholf | Yfirlit | `/#yfirlit` | `index.html#renderYfirlit` | `framendi` | `bokari` · `rukkari` | ✅ |
| brunaholf | Stjórnborð | `/#stjornbord` | `index.html#renderStjornbord` | `framendi` | `gagnaleidslur` | ✅ |
| brunaholf | Leiðsögn | `/#leidsogn` | `index.html#renderLeidsogn` | `sara-organizer` | `kort` | ✅ |
| brunaholf | Inbox | `/#inbox` | `index.html#renderInbox` | `postur` | `gagnaleidslur` · `rukkari` | ✅ |
| brunaholf | Spurningar | `/#spurningar` | `index.html#renderSpurningar` | `postur` | `rukkari` | ✅ |
| brunaholf | Tímavera | `/#timavera` | `index.html#renderTimavera` | `gagnaleidslur` | `bokari` · `verkstadur` | ✅ |
| brunaholf | Mæting · verkstaðir | `/#tvmaeting` | `index.html#renderTvMaeting` | `verkstadur` | `gagnaleidslur` | ✅ |
| brunaholf | Frá verkstað | `/#verkstadapostur` | `index.html#renderVerkstadapostur` | `verkstadur` | `bokari` · `framendi` | ✅ |
| brunaholf | Verðsamanburður | `/#verdsamanburdur` | `index.html` | `bokari` | — | ✅ |
| brunaholf | Verkstaðir | `/#verkstadir` | `index.html` | `bokari` | `gagnaleidslur` · `verkstadur` | ✅ |
| brunaholf | Skuldunautar | `/#skuldunautar` | `index.html#renderSkuldunautar` | `rukkari` | `bokari` | ✅ |
| brunaholf | Skýrslur | `/#skyrslur` | `index.html#renderSkyrslur` | `rukkari` | `bokari` | ✅ |
| brunaholf | Skýrslu-stöð | `/#skyrslustod` | `index.html#renderSkyrslustod` | `skjol` | `sara-organizer` · `kunnaskra` | ✅ |
| brunaholf | Afköst | `/#afkost` | `index.html#renderAfkost` | `jarvis` | `bokari` | ✅ |
| brunaholf | Kröfu yfirlit | `/#krofuyfirlit` | `index.html#renderKrofuyfirlit` | `rukkari` | `bokari` · `sala-reikningar` | ✅ |
| brunaholf | Drög-stöð | `/#drogstod` | `index.html#renderDrogstod` | `rukkari` | — | ✅ |
| brunaholf | Fjármála-yfirlit | `/#fjarmalyfirlit` | `index.html#renderFjarmalyfirlit` · `fjarmalyfirlit.html` | `bokari` | `rukkari` | ✅ |
| brunaholf | Viðskiptavinir | `/#vidskiptavinir` | `index.html#renderVidskiptavinir` · `vidskiptavinir.html` | `kunnaskra` | `bokari` | ✅ |
| brunaholf | Kröfur & Tekjur | `/#krofur` | `index.html#renderKrofur` | `rukkari` | `bokari` | ✅ |
| brunaholf | Hreyfingaryfirlit | `/#hreyfingaryfirlit` | `index.html` | `rukkari` | `bokari` | ✅ |
| brunaholf | Landsspítalinn | `/#nlsh` | `index.html#renderNLSH` · `nlsh.html` | `bokari` | `gagnaleidslur` · `verkstadur` | ✅ |
| brunaholf | Ajour | `/#ajour` | `index.html#renderAjour` | `gagnaleidslur` | `bokari` | ✅ |
| brunaholf | Mæting | `/#maeting` | `index.html#renderMaeting` · `maeting.html` | `verkstadur` | `gagnaleidslur` · `framendi` | ✅ |
| brunaholf | Verkefnastaða | `/#verkefnastada` | `index.html` | `framendi` | — | ✅ |
| brunaholf | Apríl reikningar | `/#april` | `index.html` | `framendi` | `bokari` | ✅ |
| brunaholf | Todo | `/#todo` | `index.html` | `framendi` | `jarvis` | ✅ |
| brunaholf | Slökkvitæki gögn | `/#slokkvitaeki` | `index.html` | `framendi` | `gagnaleidslur` | ✅ |
| brunaholf | Gögn & geymslur | `/#gogn` | `index.html` | `framendi` | `gagnaleidslur` | ✅ |
| brunaholf | Samþætting | `/#samthaetting` | `index.html` | `tengingar` | `gagnaleidslur` | ✅ |
| brunaholf | Anni & Aggi | `/#okkarVerkefni` | `index.html#renderOkkarVerkefni` | `jarvis` | — | ✅ |
| brunaholf | Verkefnaskrá | `/#verkefnaskra` | `index.html#renderVerkefnaskra` | `jarvis` | — | ✅ |
| brunaholf | Mín verkefni | `/#minverkefni` | `index.html` | `jarvis` | — | ✅ |
| brunaholf | Kvittanir & PDF | `/#kvittanir` | `index.html#renderKvittanir` | `skjol` | `bokari` | ✅ |
| brunaholf | Tenglar | `/#tenglar` | `index.html` | `framendi` | — | ✅ |
| brunaholf | Reikningatenglar | `/#reikningatenglar` | `index.html#renderReikningatenglar` | `rukkari` | — | ✅ |
| brunaholf | PDF verkfæri | `/#pdftools` | `index.html#renderPdfTools` · `pdftools.html` | `skjol` | — | ✅ |
| brunaholf | Staðf. Brunalokana | `/#eydublod` | `index.html#renderEydublod` · `eydublod.html` | `skjol` | — | ✅ |
| brunaholf | Reikningagerð | `/#reikningar` | `index.html` | `bokari` | — | ✅ |
| brunaholf | Gerð Reikninga | `/#gerdreikninga` | `index.html#renderGerdReikninga` | `bokari` | `verkstadur` · `rukkari` · `framendi` | ✅ |
| brunaholf | Tilbúnir reikningar | `/#tilbunirReikningar` | `index.html#renderTilbunirReikningar` | `bokari` | `rukkari` | ✅ |
| brunaholf | Vinnubók | `/#vinnubok` | `index.html#renderVinnubok` | `bokari` | — | ✅ |
| brunaholf | Vinnustofa | `/#vinnustofa` | `index.html#renderVinnustofa` | `framendi` | `bokari` · `rukkari` · `jarvis` | ✅ |
| brunaholf | Verðskrá | `/#verdskra` | `index.html#renderVerdskra` | `bokari` | — | ✅ |
| brunaholf | Efniskostnaður | `/#efniskostnadur` | `index.html#renderEfniskostnadur` | `bokari` | `rukkari` · `verkstadur` · `gagnaleidslur` | ✅ |
| brunaholf | Verðlisti | `/#verdlisti` | `index.html#renderVerdlisti` | `bokari` | `gagnaleidslur` | ✅ |
| brunaholf | Vörubirgðir | `/#vorubirgdir` | `index.html#renderVorubirgdir` | `bokari` | `birgdastjori` | ✅ |
| brunaholf | Útgjöld | `/#utgjold` | `index.html` | `framendi` | `bokari` | ✅ |
| brunaholf | Sjálfvirkni | `/#sjalfvirkni` | `index.html#renderSjalfvirkni` | `gagnaleidslur` | `kerfisheilsa` | ✅ |
| brunaholf | Vefrýni | `/#vefryni` | `index.html#renderVefryni` | `framendi` | `kerfisheilsa` · `joker` | ✅ |
| brunaholf | Skoðanir | `/#skodanir` | `index.html#renderSkodanir` | `sara-coworker` | `sara-organizer` | ✅ |
| brunaholf | Brunakerfi yfirlit | `/#brunayfirlit` | `index.html` | `sara-organizer` | `sara-coworker` | ✅ |
| brunaholf | Verkfæri | `https://verkfaeri.netlify.app` | `index.html` | `framendi` | — | ✅ |
| brunaholf | Skjala-multitool | `/#multitool` | `index.html#renderMultitool` · `multitool.html` | `skjol` | — | ✅ |
| brunaholf | Skráalisti | `/#skraalisti` | `index.html#renderSkraalisti` · `skraalisti.html` | `skjol` | — | ✅ |
| brunaholf | Drive-leit | `/#driveleit` | `index.html#renderDriveLeit` | `skjol` | `rukkari` | ✅ |
| brunaholf | Póstleit | `/#postleit` | `index.html#renderPostleit` | `postur` | — | ✅ |
| brunaholf | Bakendi | `/#bakendi` | `index.html#renderBakendi` | `skjol` | `kunnaskra` · `gagnaleidslur` · `sara-organizer` | ✅ |
| brunaholf | Stillingar | `/#stillingar` | `index.html#renderStillingar` | `tengingar` | `oryggi` · `framendi` | ✅ |
| brunaholf | Aðgangar — Brunahólf | `/adgangar.html` | `adgangar.html` | `oryggi` | `tengingar` | ✅ |
| brunaholf | Afkastavakt — Vélarrými | `/afkastavakt.html` | `afkastavakt.html` | `jarvis` | `bokari` · `rukkari` | ✅ |
| brunaholf | Skoðunarskýrsla Brunaviðvörunarkerfis · Slökkvitæki ehf | `/brunakerfi-skodun.html` | `brunakerfi-skodun.html` | `sara-organizer` | `sara-coworker` | ✅ |
| brunaholf | Brunakerfi — yfirlit | `/brunakerfi.html` | `brunakerfi.html` | `sara-organizer` | `sara-coworker` | ✅ |
| brunaholf | Brunaþéttingar — verkstaðir | `/brunathettingar.html` | `brunathettingar.html` | `verkstadur` | `gagnaleidslur` · `bokari` · `oryggi` | ✅ |
| brunaholf | Kúnna-yfirlit · Brunahólf | `/customer.html` | `customer.html` | `kunnaskra` | `skjol` · `sara-organizer` | ✅ |
| brunaholf | dk Vörur — innflutningur | `/dkplus-products.html` | `dkplus-products.html` | `sala-reikningar` | `endurskodandi` | ✅ |
| brunaholf | DK Plus — tengipróf | `/dkplus-test.html` | `dkplus-test.html` | `sala-reikningar` | `tengingar` | ✅ |
| brunaholf | Skjala-checklist · Brunahólf | `/doc-matrix.html` | `doc-matrix.html` | `skjol` | `sara-organizer` | ✅ |
| brunaholf | Svarhjálp — Brunahólf | `/email-helper.html` | `email-helper.html` | `postur` | — | ✅ |
| brunaholf | 🔋 Hleðsluáætlun — Brunahólf | `/hledsluaaetlun.html` | `hledsluaaetlun.html` | `skjol` | `sara-organizer` | ✅ |
| brunaholf | Keepit — persónulegt | `/keepit.html` | `keepit.html` | `skjol` | — | ✅ |
| brunaholf | Kerfisheilsa — Brunahólf | `/kerfisheilsa.html` | `kerfisheilsa.html` | `tengingar` | `kerfisheilsa` · `hradi` | ✅ |
| brunaholf | 🗺️ Kerfis-kort — viðskiptavina-gagnagrunnur | `/kerfiskort.html` | `kerfiskort.html` | `tengingar` | `kunnaskra` | ✅ |
| brunaholf | PDF Flokkari · Brunahólf | `/pdf-classify.html` | `pdf-classify.html` | `skjol` | — | ✅ |
| brunaholf | 🎙️ Raddminni — Brunahólf | `/radd.html` | `radd.html` | `jarvis` | — | ✅ |
| brunaholf | Reikningar í bið — dk+ | `/reikningar-bid.html` | `reikningar-bid.html` | `sala-reikningar` | `bokari` | ✅ |
| brunaholf | Rekstrarfélög — Brunahólf | `/rekstrarfelog.html` | `rekstrarfelog.html` | `kunnaskra` | `skjol` · `heimaleiga` · `center-hotel` | ✅ |
| brunaholf | Brunakerfi · Ársskoðun | `/skoda.html` | `skoda.html` | `sara-coworker` | `sara-organizer` | ✅ |
| brunaholf | Reikningur — Slökkvitæki ehf | `/slokkvitaeki-reikningur.html` | `slokkvitaeki-reikningur.html` | `sala-reikningar` | `bokari` | ✅ |
| brunaholf | Starfsmenn — dagur fyrir dag | `/starfsmenn.html` | `starfsmenn.html` | `verkstadur` | `gagnaleidslur` | ✅ |
| brunaholf | 🕵️ Gleymt að skrá í þjónustu — Brunahólf | `/thjonusta-gloppur.html` | `thjonusta-gloppur.html` | `sara-organizer` | `kunnaskra` | ✅ |
| brunaholf | 🎯 Veiðin — endurheimtar-mælaborð | `/veidin.html` | `veidin.html` | `kunnaskra` | `sara-organizer` | ✅ |
| brunaholf | Verkefnalisti · Brunahólf | `/verkefnalisti.html` | `verkefnalisti.html` | `jarvis` | — | ✅ |
| brunaholf | Yfirferð efnislista | `/yfirferd.html` | `yfirferd.html` | `bokari` | — | ✅ |
| brunaholf | Kerfis-vitals | `/jarvis.html#vitals` | `jarvis.html` | `kerfisheilsa` | `tengingar` · `jarvis` | ✅ |
| brunaholf | Fjarskipti (straumur) | `/jarvis.html#fjarskipti` | `jarvis.html` | `jarvis` | — | ✅ |
| brunaholf | Sérfræðingar + 📖 Agentaskráin | `/jarvis.html#serfraedingar` | `jarvis.html` | `jarvis` | — | ✅ |
| brunaholf | Villuleit | `/jarvis.html#villuleit` | `jarvis.html` | `netvordur` | `villuleit` · `variant-analysis` | ✅ |
| brunaholf | Kröfur | `/jarvis.html#krofur` | `jarvis.html` | `rukkari` | `bokari` | ✅ |
| brunaholf | Verk (verkefnalisti) | `/jarvis.html#verk` | `jarvis.html` | `jarvis` | — | ✅ |
| brunaholf | Markmið — skýrsluþekja 2026 | `/jarvis.html#markmid` | `jarvis.html` | `kunnaskra` | `sara-organizer` | ✅ |
| brunaholf | Vélar (ratsjá) | `/jarvis.html#velar` | `jarvis.html` | `kerfisheilsa` | `tengingar` | ✅ |
| brunaholf | Hljóð (raddminni) | `/jarvis.html#hljod` | `jarvis.html` | `jarvis` | — | ✅ |
| brunaholf | Tengingar | `/jarvis.html#tengingar` | `jarvis.html` | `tengingar` | — | ✅ |
| brunaholf | Gögn (gagnauppsprettur) | `/jarvis.html#gogn` | `jarvis.html` | `gagnaleidslur` | — | ✅ |
| brunaholf | Þekja (pör) | `/jarvis.html#thekja` | `jarvis.html` | `sara-organizer` | — | ✅ |
| brunaholf | Gloppur | `/jarvis.html#gloppur` | `jarvis.html` | `sara-organizer` | `kunnaskra` | ✅ |
| brunaholf | Þrýstingur — frammistaða | `/jarvis.html#perf` | `jarvis.html` | `hradi` | `kerfisheilsa` | ✅ |
| brunaholf | Öryggisnet — verðir | `/jarvis.html#oryggisnet` | `jarvis.html` | `netvordur` | `rambo` | ✅ |
| slokkvitaeki | Afgreiðsla | `#counter` | `index.html` | `sala-reikningar` | `prentun` | ✅ |
| slokkvitaeki | Verkstæði | `#workshop` | `index.html` | `sala-reikningar` | `elon-musk` · `prentun` | ✅ |
| slokkvitaeki | Þjónustutæki | `#field` | `index.html` | `kort` | `bord-flettur` | ✅ |
| slokkvitaeki | Fyrirtæki (skrá) | `#companies` | `index.html` · `js/patches/261-app-profiles.js` | `fyrirtaeki` | `kunnaskra` | ✅ |
| slokkvitaeki | Brunakerfi (áskriftir) | `#brunakerfi` | `index.html` | `elon-musk` | `natalie` · `sara-coworker` · `sala-reikningar` | ✅ |
| slokkvitaeki | Tilboð & samningar | `#tilbodhub` | `index.html` | `sala-reikningar` | `logfraedingur` | ✅ |
| slokkvitaeki | Tekjur | `#income` | `index.html` · `js/patches/261-app-profiles.js` | `sala-reikningar` | — | ✅ |
| slokkvitaeki | Lánstæki | `#lanstaeki` | `index.html` | `elon-musk` | — | ✅ |
| slokkvitaeki | Geymsla | `#geymsla` | `index.html` | `bord-flettur` | `elon-musk` · `prentun` | ✅ |
| slokkvitaeki | Stillingar | `#settings` | `index.html` | `joker` | `prentun` · `thema` · `elon-musk` | ✅ |
| slokkvitaeki | Bókhald | `#bokhalds-yfirlit` | `js/patches/11-bokhalds-yfirlit.js` · `js/patches/261-app-profiles.js` | `sala-reikningar` | `bh:bokari` | ✅ |
| slokkvitaeki | Aldursgreining | `#aging-report` | `js/patches/23-aging-report.js` | `sala-reikningar` | `rukkari` | ✅ |
| slokkvitaeki | Tilboð | `#tilbod` | `js/patches/27-tilbod-quote.js` | `sala-reikningar` | `logfraedingur` · `arnold` | ✅ |
| slokkvitaeki | Drög | `#drog` | `js/patches/143-drog-list.js` | `sala-reikningar` | — | ✅ |
| slokkvitaeki | Fyrirtæki í þjónustu | `#arsskodun` | `js/patches/153-arsskodun.js` · `js/patches/317-arsskodun-bilstjori.js` · `js/patches/331-ars-phone-skjar.js` · `js/patches/341-ars-skjar-scroll-left.js` · `js/patches/261-app-profiles.js` | `elon-musk` | `natalie` · `arnold` | ✅ |
| slokkvitaeki | Allir viðskiptavinir | `#allir-vidsk` | `js/patches/157-allir-vidskiptavinir.js` | `kunnaskra` | `natalie` · `fyrirtaeki` | ✅ |
| slokkvitaeki | Fyrirtækjakort / fyrirtækjaprófíll | `#vidsk-detail` | `js/patches/158-vidsk-detail.js` | `fyrirtaeki` | `kunnaskra` · `sala-reikningar` · `sara-coworker` · `joker` | ✅ |
| slokkvitaeki | Leiðsögn | `#leidsogn` | `js/patches/161-leidsogn.js` · `js/patches/373-leidsogn-uttektarplan.js` | `bord-flettur` | `kort` | ✅ |
| slokkvitaeki | Kröfu yfirlit | `#krofu-yfirlit` | `js/patches/166-krofu-yfirlit.js` · `js/patches/261-app-profiles.js` | `sala-reikningar` | `rukkari` · `natalie` | ✅ |
| slokkvitaeki | Hreyfingarlisti | `#hreyfingarlisti` | `js/patches/167-hreyfingarlisti.js` · `js/patches/261-app-profiles.js` | `sala-reikningar` | `rukkari` | ✅ |
| slokkvitaeki | Þjónustuverk | `#thjonustuverk` | `js/patches/172-thjonustuverk.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | — | ✅ |
| slokkvitaeki | Beiðnir | `#beidnir` | `js/patches/178-beidnir.js` | `bord-flettur` | — | ✅ |
| slokkvitaeki | Móttaka | `#mottaka` | `js/patches/179-mottaka-arrival.js` | `sala-reikningar` | — | ✅ |
| slokkvitaeki | ÞjónustuVerkstæði | `#thjonustu-verkstaedi` | `js/patches/190-thjonustu-verkstaedi.js` · `js/patches/261-app-profiles.js` | `sala-reikningar` | `elon-musk` | ✅ |
| slokkvitaeki | Yfirferð greiðslna | `#payrev` | `js/patches/193-payment-review.js` | `sala-reikningar` | `natalie` | ✅ |
| slokkvitaeki | Bókhald · yfirferð | `#bokhald-yfirferd` | `js/patches/197-bokhald-yfirferd.js` | `sala-reikningar` | `natalie` | ✅ |
| slokkvitaeki | Fyrirtæki · yfirferð | `#fyrirtaeki-yfirferd` | `js/patches/198-fyrirtaeki-yfirferd.js` | `kunnaskra` | `sala-reikningar` | ✅ |
| slokkvitaeki | Vertíð | `#vertid` | `js/patches/210-vertid-mottaka.js` | `sala-reikningar` | — | ✅ |
| slokkvitaeki | Bílstjóri · leið dagsins | `#bilstjori` | `js/patches/219-bilstjori.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | `kort` | ✅ |
| slokkvitaeki | Kerfi | `#kerfi` | `js/patches/221-kerfi-registry.js` | `bord-flettur` | — | ✅ |
| slokkvitaeki | Bakendi | `#bakendi` | `js/patches/232-bakendi.js` | `kunnaskra` | `bord-flettur` | ✅ |
| slokkvitaeki | Sameining | `#sameining` | `js/patches/236-customer-sameining.js` | `kunnaskra` | `samthykktir` | ✅ |
| slokkvitaeki | Aðstoðarmiðstöð | `#adstod` | `js/patches/239-adstodarmidstod.js` | `adstod` | `kunnaskra` · `sala-reikningar` | ✅ |
| slokkvitaeki | Reikninga-póstur | `#reikninga-postur` | `js/patches/240-reikninga-postur.js` · `js/patches/261-app-profiles.js` | `rukkari` | `postur` · `sala-reikningar` | ✅ |
| slokkvitaeki | Öpp (stýriborð) | `#opp` | `js/patches/261-app-profiles.js` | `opp` | `bord-flettur` · `joker` | ✅ |
| slokkvitaeki | Aksturslisti | `#aksturslisti` | `js/patches/268-aksturslisti-vakt.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | `kort` | ✅ |
| slokkvitaeki | Brunakerfi yfirlit (eldra) | `#brunakerfi-yfirlit` | `js/patches/272-brunakerfi-yfirlit.js` | `elon-musk` | `sara-coworker` | ✅ |
| slokkvitaeki | Samskiptaborð | `#samskiptabord` | `js/patches/287-crm-board.js` | `fyrirtaeki` | `kunnaskra` · `rukkari` | ✅ |
| slokkvitaeki | Mínar síður | `#minar-sidur` | `js/patches/302-minar-sidur.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | — | ✅ |
| slokkvitaeki | Þjónustuborð (sími, eldra) | `#thjonustubord` | `js/patches/306-thjonustu-mob.js` | `bord-flettur` | `samthykktir` | ✅ |
| slokkvitaeki | Þjónustuver póstar | `#thjonustuver-postar` | `js/patches/309-thjonustuver-postar.js` | `postur` | — | ✅ |
| slokkvitaeki | Tengiliðir | `#tengilidir` | `js/patches/310-tengilidir.js` | `fyrirtaeki` | `kunnaskra` · `bh:oryggi` | ✅ |
| slokkvitaeki | TurboPaint — teikningar | `#turbopaint` | `js/patches/342-turbopaint-nav.js` · `js/patches/376-teikning-ur-teikningaglugga.js` · `js/patches/261-app-profiles.js` | `arnold` | `elon-musk` | ✅ |
| slokkvitaeki | Staðan | `#stadan` | `js/patches/345-stadan.js` | `bord-flettur` | — | ✅ |
| slokkvitaeki | Mælaborð | `#maelabord` | `js/patches/346-maelabord.js` | `bord-flettur` | `netvordur` | ✅ |
| slokkvitaeki | Þjónustuborð | `#bord` | `js/patches/368-thjonustubord5.js` · `js/patches/369-krofu-vinnugluggi.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | `samthykktir` | ✅ |
| slokkvitaeki | Kostnaður · reikningar úr pósti | `#kostnadur` | `js/patches/419-kostnadur.js` · `js/patches/261-app-profiles.js` | `innkaupabokari` | `birgdastjori` · `bh:endurskodandi` | ✅ |
| slokkvitaeki | Samþykkja | `#samthykkja` | `js/patches/446-samthykkja-simi.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | `samthykktir` | ✅ |
| slokkvitaeki | Svar-stöð · hvernig textar verða til | `#svarstod` | `js/patches/447-svarstod.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | `samthykktir` · `sala-reikningar` · `postur` | ✅ |
| slokkvitaeki | Reglur | `#reglur` | `js/patches/449-reglur.js` | `bord-flettur` | `samthykktir` · `arnold` | ✅ |
| slokkvitaeki | Tölvupóstar | `#tolvupostar` | `js/patches/449-tolvupostar-simi.js` · `js/patches/261-app-profiles.js` | `postur` | `samthykktir` · `kunnaskra` | ✅ |
| slokkvitaeki | Erindi · tilbúin svör | `#erindi` | `js/patches/449c-erindi-simi.js` · `js/patches/261-app-profiles.js` | `postur` | `samthykktir` · `sara-coworker` | ✅ |
| slokkvitaeki | Hunter · sölulistar | `#hunter` | `js/patches/487-hunter.js` | `fyrirtaeki` | `kunnaskra` | ✅ |
| slokkvitaeki | Vasinn · skjáskot, myndir, skrár, hljóð handa Claude | `#vasinn` | `js/patches/491-vasinn.js` · `js/patches/261-app-profiles.js` | `innkaupabokari` | `bord-flettur` | ✅ |
| slokkvitaeki | Aðalmál · fundir, frestir og það sem skiptir mestu | `#adalmal` | `js/patches/492-adalmal.js` · `js/patches/261-app-profiles.js` | `bord-flettur` | `samthykktir` | ✅ |
| slokkvitaeki | Viðskiptavinir | `#vidskiptavinir` | `js/patches/261-app-profiles.js` | `kunnaskra` | — | ✅ |
| slokkvitaeki | Sala | `#sala` | `js/patches/261-app-profiles.js` | `sala-reikningar` | `prentun` · `birgdastjori` | ✅ |
| slokkvitaeki | Slökkvikerfis skoðun | `#slokkvikerfi` | `js/patches/261-app-profiles.js` | `elon-musk` | `sara-coworker` | ✅ |
| slokkvitaeki | Brunakerfis skoðun | `#brunaskra` | `js/patches/261-app-profiles.js` | `elon-musk` | `sara-coworker` | ✅ |
| slokkvitaeki | Rekstrarfélög | `#rekstrarfelog` | `js/patches/261-app-profiles.js` | `kunnaskra` | `natalie` · `heimaleiga` · `center-hotel` | ✅ |
| slokkvitaeki | Birgðir | `#birgdir` | `js/patches/261-app-profiles.js` | `birgdastjori` | `sala-reikningar` | ✅ |
| slokkvitaeki | Vörur og þjónusta | `#vorur` | `js/patches/261-app-profiles.js` | `birgdastjori` | `sala-reikningar` | ✅ |
| slokkvitaeki | Gerð reikninga | `https://brunaholf.netlify.app/?embed=1#gerdreikninga` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Vinnubók | `https://brunaholf.netlify.app/?embed=1#vinnubok` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Krófur & Tekjur | `https://brunaholf.netlify.app/?embed=1#krofur` | `js/patches/261-app-profiles.js` | `opp` | `bh:rukkari` | ✅ |
| slokkvitaeki | Kröfu yfirlit (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#krofuyfirlit` | `js/patches/261-app-profiles.js` | `opp` | `bh:rukkari` | ✅ |
| slokkvitaeki | Drög-stöð (punktar + draft-körfur) | `https://brunaholf.netlify.app/?embed=1#drogstod` | `js/patches/261-app-profiles.js` | `opp` | `bh:rukkari` | ✅ |
| slokkvitaeki | Efniskostnaður · kostnaðarreikningar (dropp úr síma) | `https://brunaholf.netlify.app/?embed=1#efniskostnadur` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Mæting · verkstaðir (Tímavera) | `https://brunaholf.netlify.app/?embed=1#tvmaeting` | `js/patches/261-app-profiles.js` | `opp` | `bh:verkstadur` | ✅ |
| slokkvitaeki | Fjármála-yfirlit (Slökkv. + Brunahólf) | `https://brunaholf.netlify.app/fjarmalyfirlit.html` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Dagurinn (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#dagurinn` | `js/patches/261-app-profiles.js` | `opp` | `bh:framendi` | ✅ |
| slokkvitaeki | Reikningagerð (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#reikningar` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Skuldunautar (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#skuldunautar` | `js/patches/261-app-profiles.js` | `opp` | `bh:rukkari` | ✅ |
| slokkvitaeki | Hreyfingaryfirlit (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#hreyfingaryfirlit` | `js/patches/261-app-profiles.js` | `opp` | `bh:rukkari` | ✅ |
| slokkvitaeki | Verkstaðir (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#verkstadir` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Landsspítalinn (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#nlsh` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Efnisnotkun · verkstjórar skrá efni á verk | `https://brunaholf.netlify.app/brunathettingar?embed=1` | `js/patches/261-app-profiles.js` | `opp` | `bh:verkstadur` | ✅ |
| slokkvitaeki | Frá verkstað · efnisnotkun per verk | `https://brunaholf.netlify.app/?embed=1#verkstadapostur` | `js/patches/261-app-profiles.js` | `opp` | `bh:verkstadur` | ✅ |
| slokkvitaeki | Verkkaupar (Brunahólf) | `https://brunaholf.netlify.app/verkkaupar.html` | `js/patches/261-app-profiles.js` | `opp` | `bh:kunnaskra` | ✅ |
| slokkvitaeki | J.A.R.V.I.S. (Brunahólf) | `https://brunaholf.netlify.app/jarvis.html?embed=1` | `js/patches/261-app-profiles.js` | `opp` | `bh:jarvis` | ✅ |
| slokkvitaeki | Raddminni (Brunahólf) | `https://brunaholf.netlify.app/radd.html` | `js/patches/261-app-profiles.js` | `opp` | `bh:jarvis` | ✅ |
| slokkvitaeki | Kerfisheilsa (Brunahólf) | `https://brunaholf.netlify.app/kerfisheilsa.html` | `js/patches/261-app-profiles.js` | `opp` | `bh:tengingar` | ✅ |
| slokkvitaeki | Þjónustugátt · stjórnborð (kúnnavefir) | `/gatt-admin/` | `js/patches/261-app-profiles.js` | `thjonustugatt` | `bh:oryggi` | ✅ |
| slokkvitaeki | Yfirferð efnislista (Brunahólf) | `https://brunaholf.netlify.app/yfirferd.html` | `js/patches/261-app-profiles.js` | `opp` | `bh:bokari` | ✅ |
| slokkvitaeki | Eyðublöð (Brunahólf) | `https://brunaholf.netlify.app/eydublod.html` | `js/patches/261-app-profiles.js` | `opp` | `bh:skjol` | ✅ |
| slokkvitaeki | Skýrslu-stöð (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#skyrslustod` | `js/patches/261-app-profiles.js` | `opp` | `bh:skjol` | ✅ |
| slokkvitaeki | Drive-leit (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#driveleit` | `js/patches/261-app-profiles.js` | `opp` | `bh:skjol` | ✅ |
| slokkvitaeki | Póstleit (Brunahólf) | `https://brunaholf.netlify.app/?embed=1#postleit` | `js/patches/261-app-profiles.js` | `opp` | `bh:postur` | ✅ |
| slokkvitaeki | 3dwork — merkja/CAD-bekkur | `https://kjarni-3dwork.vercel.app/3dwork` | `js/patches/261-app-profiles.js` | `opp` | `kj:3dwork` | ✅ |
| slokkvitaeki | Brunaáætlun — rýmingaráætlun, eigið eftirlit, flóttaáætlanir | `/brunaaaetlun/` | `js/patches/261-app-profiles.js` | `thjonustugatt` | `arnold` | ✅ |
| slokkvitaeki | Fjármál (app) | `/app/fjarmal/` | `js/patches/261-app-profiles.js` | `opp` | `sala-reikningar` | ✅ |
| slokkvitaeki | Þjónustuborð (app) | `/app/verkefni/` | `js/patches/261-app-profiles.js` | `opp` | `bord-flettur` · `samthykktir` | ✅ |
| slokkvitaeki | Brunahólf (app) | `/app/brunaholf/` | `js/patches/261-app-profiles.js` | `opp` | `bh:framendi` | ✅ |
| slokkvitaeki | Verkstjórar (app) | `/app/verkstjorar/` | `js/patches/261-app-profiles.js` | `opp` | `bh:verkstadur` | ✅ |
| slokkvitaeki | Skýrslu-stöð (app) | `/app/skyrslustod/` | `js/patches/261-app-profiles.js` | `opp` | `bh:skjol` | ✅ |
| slokkvitaeki | Brunakerfi (app) | `/app/brunakerfi/` | `js/patches/261-app-profiles.js` | `opp` | `elon-musk` | ✅ |
| slokkvitaeki | Bílstjóri (app) | `/app/bilstjori/` | `js/patches/261-app-profiles.js` | `opp` | `bord-flettur` · `kort` | ✅ |
| slokkvitaeki | The Big Boss (app) | `/app/boss/` | `js/patches/261-app-profiles.js` | `opp` | `bord-flettur` | ✅ |
| slokkvitaeki | 3dwork (app) | `/app/threedwork/` | `js/patches/261-app-profiles.js` | `opp` | `kj:3dwork` | ✅ |
| slokkvitaeki | Vinnusamantekt (efst á Þjónustuborði) | `#bord (eining efst)` | `js/patches/489-vinnusamantekt.js` | `bord-flettur` | `samthykktir` | ✅ |
| slokkvitaeki | Þjónustusamningar | `#samningar` | `js/patches/50-service-contracts.js` | `sala-reikningar` | `logfraedingur` · `kunnaskra` | ✅ |
| slokkvitaeki | Söluyfirlit | `#soluyfirlit` | `js/patches/54-sales-analytics.js` | `sala-reikningar` | — | ✅ |
| slokkvitaeki | Kreditfæra reikning | `#bokhald (Kreditfæra)` | `js/patches/92-credit-by-num.js` · `js/patches/26-credit-invoice.js` | `sala-reikningar` | `natalie` | ✅ |
| slokkvitaeki | Akstursdagbók | `view-akstur` | `js/patches/47-mileage-log.js` | `bord-flettur` | — | ✅ |
| slokkvitaeki | Tæknimenn + skírteini | `view-taeknimenn` | `js/patches/59-technicians.js` | `bord-flettur` | `arnold` | ✅ |
| slokkvitaeki | Stjórnstöð | `#stjornstod` | `js/patches/61-command-center.js` · `js/patches/420-stjornstod-samstilling.js` | `bord-flettur` | `samthykktir` | ✅ |
| slokkvitaeki | Uppfærsluborð | `#uppferslubord` | `js/patches/431-uppferslubord.js` | `bord-flettur` | `kodafraedingur` | ✅ |
| slokkvitaeki | Póstsvörun | `/postsvorun.html` | `postsvorun.html` | `postur` | `samthykktir` | ✅ |
| slokkvitaeki | Kúnnaskrá (stök síða) | `/kunnaskra.html` | `kunnaskra.html` | `kunnaskra` | — | ✅ |
| slokkvitaeki | Uppgjörslisti | `/uppgjorslisti.html` | `uppgjorslisti.html` | `sala-reikningar` | `rukkari` | ✅ |
| slokkvitaeki | Hreyfingaryfirlit (stök síða) | `/hreyfingaryfirlit.html` | `hreyfingaryfirlit.html` | `sala-reikningar` | `rukkari` | ✅ |
| slokkvitaeki | Innskráning | `/innskraning.html` | `innskraning.html` | `bord-flettur` | `bh:oryggi` | ✅ |
| slokkvitaeki | Þjónustugátt (kúnnavefur) | `/gatt/?c=<slug>[&eign=<id>]` | `gatt/index.html` · `netlify/functions/gatt.cjs` · `netlify/functions/_portal.cjs` | `thjonustugatt` | `sara-coworker` · `kunnaskra` · `bh:oryggi` | ✅ |
| slokkvitaeki | Tilkynna (QR) | `/gatt/q/?t=<qr>` | `gatt/q/index.html` · `netlify/functions/gatt-qr.cjs` | `thjonustugatt` | `prentun` | ✅ |
| slokkvitaeki | Stuttslóðir gáttar | `/g/:slug · /heimaleiga` | `netlify.toml` | `thjonustugatt` | — | ✅ |
| slokkvitaeki | Rýmingaráætlun | `/rymingaraetlun/?fyrirtaeki=<id>` | `rymingaraetlun/index.html` · `js/patches/464-brunaaaetlun-takki.js` | `thjonustugatt` | `arnold` | ✅ |
| slokkvitaeki | Vefverslun (prufa) | `/vefverslun/` | `vefverslun/index.html` · `netlify/functions/vefverslun.cjs` | `thjonustugatt` | `sala-reikningar` | ✅ |
| slokkvitaeki | Gamla kúnnagáttin (v1) | `index.html#portal=<base64 id>` | `js/patches/51-customer-portal.js` | `thjonustugatt` | `bh:oryggi` · `kodafraedingur` | ✅ |
| slokkvitaeki | Spotify | `/spotify/` | `spotify` | — | — | ❌ |
| slokkvitaeki | Myndasafn (img/safn) | `/img/safn/` | `img/safn` | — | — | ❌ |
| slokkvitaeki | Kennslubækur (docs/) | `/docs/index.html` | `docs/index.html` | — | — | ❌ |
| kjarni | Síðuritils-síða | `/[slug]` | `apps/slokkvitaeki/app/[slug]/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | InstantID | `/api/andlit` | `apps/slokkvitaeki/app/api/andlit/route.ts` | `artcraft` | — | ✅ |
| kjarni | Nýr bakgrunnur | `/api/breyta/background` | `apps/slokkvitaeki/app/api/breyta/background/route.ts` | `artcraft` | — | ✅ |
| kjarni | Pro headshot | `/api/breyta/headshot` | `apps/slokkvitaeki/app/api/breyta/headshot/route.ts` | `artcraft` | — | ✅ |
| kjarni | Hraðbreyta (pruna) | `/api/breyta/pruna` | `apps/slokkvitaeki/app/api/breyta/pruna/route.ts` | `artcraft` | — | ✅ |
| kjarni | Depth Anything | `/api/dypt` | `apps/slokkvitaeki/app/api/dypt/route.ts` | `artcraft` | — | ✅ |
| kjarni | IC-Light | `/api/endurljos` | `apps/slokkvitaeki/app/api/endurljos/route.ts` | `artcraft` | — | ✅ |
| kjarni | Flux Redux | `/api/innblastur` | `apps/slokkvitaeki/app/api/innblastur/route.ts` | `artcraft` | — | ✅ |
| kjarni | DDColor | `/api/litun` | `apps/slokkvitaeki/app/api/litun/route.ts` | `artcraft` | — | ✅ |
| kjarni | roop face-swap ræsa | `/api/myndband-andlit` | `apps/slokkvitaeki/app/api/myndband-andlit/route.ts` | `artcraft` | — | ✅ |
| kjarni | roop face-swap staða | `/api/myndband-andlit/status` | `apps/slokkvitaeki/app/api/myndband-andlit/status/route.ts` | `artcraft` | — | ✅ |
| kjarni | Kling ræsa | `/api/skyjahreyfimynd/kling` | `apps/slokkvitaeki/app/api/skyjahreyfimynd/kling/route.ts` | `artcraft` | — | ✅ |
| kjarni | Kling staða | `/api/skyjahreyfimynd/kling/status` | `apps/slokkvitaeki/app/api/skyjahreyfimynd/kling/status/route.ts` | `artcraft` | — | ✅ |
| kjarni | Wan 2.2 ræsa | `/api/skyjahreyfimynd` | `apps/slokkvitaeki/app/api/skyjahreyfimynd/route.ts` | `artcraft` | — | ✅ |
| kjarni | Wan 2.2 staða | `/api/skyjahreyfimynd/status` | `apps/slokkvitaeki/app/api/skyjahreyfimynd/status/route.ts` | `artcraft` | — | ✅ |
| kjarni | Skýjastúdíó Flux Fill | `/api/skyjastudio/flux-fill` | `apps/slokkvitaeki/app/api/skyjastudio/flux-fill/route.ts` | `artcraft` | — | ✅ |
| kjarni | Skýjastúdíó Juggernaut | `/api/skyjastudio/juggernaut` | `apps/slokkvitaeki/app/api/skyjastudio/juggernaut/route.ts` | `artcraft` | — | ✅ |
| kjarni | Skýjastúdíó SDXL | `/api/skyjastudio/replicate` | `apps/slokkvitaeki/app/api/skyjastudio/replicate/route.ts` | `artcraft` | — | ✅ |
| kjarni | ElevenLabs Music ræsa | `/api/tonsmid` | `apps/slokkvitaeki/app/api/tonsmid/route.ts` | `artcraft` | — | ✅ |
| kjarni | ElevenLabs Music staða | `/api/tonsmid/status` | `apps/slokkvitaeki/app/api/tonsmid/status/route.ts` | `artcraft` | — | ✅ |
| kjarni | Sækja teikningu (fetch-plan) | `/api/turbopaint/fetch-plan` | `apps/slokkvitaeki/app/api/turbopaint/fetch-plan/route.ts` | `sl:arnold` | `elon-musk` | ✅ |
| kjarni | Teikningaleit | `/api/turbopaint/teikningar` | `apps/slokkvitaeki/app/api/turbopaint/teikningar/route.ts` | `sl:arnold` | `elon-musk` | ✅ |
| kjarni | Clarity ræsa | `/api/upplyfting/clarity` | `apps/slokkvitaeki/app/api/upplyfting/clarity/route.ts` | `artcraft` | — | ✅ |
| kjarni | Clarity staða | `/api/upplyfting/clarity/status` | `apps/slokkvitaeki/app/api/upplyfting/clarity/status/route.ts` | `artcraft` | — | ✅ |
| kjarni | Topaz upplyfting | `/api/upplyfting` | `apps/slokkvitaeki/app/api/upplyfting/route.ts` | `artcraft` | — | ✅ |
| kjarni | Flux Fill outpaint | `/api/utvikka` | `apps/slokkvitaeki/app/api/utvikka/route.ts` | `artcraft` | — | ✅ |
| kjarni | Real-ESRGAN video ræsa | `/api/video-upplyfting` | `apps/slokkvitaeki/app/api/video-upplyfting/route.ts` | `artcraft` | — | ✅ |
| kjarni | Real-ESRGAN video staða | `/api/video-upplyfting/status` | `apps/slokkvitaeki/app/api/video-upplyfting/status/route.ts` | `artcraft` | — | ✅ |
| kjarni | Viðgerð (Replicate) | `/api/vidgerd/replicate` | `apps/slokkvitaeki/app/api/vidgerd/replicate/route.ts` | `artcraft` | — | ✅ |
| kjarni | Borð — stjórnborð | `/bord` | `apps/slokkvitaeki/app/bord/page.tsx` | `sl:bord-flettur` | `kjarni-vefur` | ✅ |
| kjarni | Borgarferðir — Manchester · Glasgow | `/borgarferdir` | `apps/slokkvitaeki/app/borgarferdir/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Prufusvæði — blokkir, þemu & skikt | `/draft` | `apps/slokkvitaeki/app/draft/page.tsx` | `kjarni-vefur` | `joker` | ✅ |
| kjarni | Kerfi — þjónustukerfi | `/kerfi` | `apps/slokkvitaeki/app/kerfi/page.tsx` | `sl:bord-flettur` | `kjarni-vefur` · `kort` | ✅ |
| kjarni | <forrit> — Kjarni (5: photocraft, filmcraft, lightcraft, effectcraft, designcraft; OfficeCraft-öppin vísast á /kjarni/officecraft/<id>) | `/kjarni/artcraft/[app]` | `apps/slokkvitaeki/app/kjarni/artcraft/[app]/page.tsx` | `artcraft` | — | ✅ |
| kjarni | OfficeCraft — yfirlit | `/kjarni/officecraft` | `apps/slokkvitaeki/app/kjarni/officecraft/page.tsx` | `artcraft` | `kjarni-vefur` | ✅ |
| kjarni | <forrit> — OfficeCraft — Kjarni (8: wordcraft, gridcraft, deckcraft, pdfcraft, cadcraft, figcraft, vectorcraft, soundcraft) | `/kjarni/officecraft/[app]` | `apps/slokkvitaeki/app/kjarni/officecraft/[app]/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Andlit | `/kjarni/artcraft/andlit` | `apps/slokkvitaeki/app/kjarni/artcraft/andlit/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Bakgrunnur / Á hvítan bakgrunn | `/kjarni/artcraft/bakgrunnur` | `apps/slokkvitaeki/app/kjarni/artcraft/bakgrunnur/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Breyta mynd | `/kjarni/artcraft/breyta` | `apps/slokkvitaeki/app/kjarni/artcraft/breyta/page.tsx` | `artcraft` | — | ✅ |
| kjarni | ComfyUI | `/kjarni/artcraft/comfy` | `apps/slokkvitaeki/app/kjarni/artcraft/comfy/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Dýpt | `/kjarni/artcraft/dypt` | `apps/slokkvitaeki/app/kjarni/artcraft/dypt/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Endurljós | `/kjarni/artcraft/endurljos` | `apps/slokkvitaeki/app/kjarni/artcraft/endurljos/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Hreyfimynd | `/kjarni/artcraft/hreyfimynd` | `apps/slokkvitaeki/app/kjarni/artcraft/hreyfimynd/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Innblástur | `/kjarni/artcraft/innblastur` | `apps/slokkvitaeki/app/kjarni/artcraft/innblastur/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Kastljós | `/kjarni/artcraft/kastljos` | `apps/slokkvitaeki/app/kjarni/artcraft/kastljos/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Leiðarvísir — ArtCraft | `/kjarni/artcraft/leidarvisir` | `apps/slokkvitaeki/app/kjarni/artcraft/leidarvisir/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Litun | `/kjarni/artcraft/litun` | `apps/slokkvitaeki/app/kjarni/artcraft/litun/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Móta | `/kjarni/artcraft/mota` | `apps/slokkvitaeki/app/kjarni/artcraft/mota/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Myndband-andlit | `/kjarni/artcraft/myndband-andlit` | `apps/slokkvitaeki/app/kjarni/artcraft/myndband-andlit/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Myndband-framhald | `/kjarni/artcraft/myndband-framhald` | `apps/slokkvitaeki/app/kjarni/artcraft/myndband-framhald/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Myndband-portret-andlit | `/kjarni/artcraft/myndband-portret-andlit` | `apps/slokkvitaeki/app/kjarni/artcraft/myndband-portret-andlit/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Myndbanda-saumur | `/kjarni/artcraft/myndband-saumur` | `apps/slokkvitaeki/app/kjarni/artcraft/myndband-saumur/page.tsx` | `artcraft` | — | ✅ |
| kjarni | ArtCraft — yfirlit | `/kjarni/artcraft` | `apps/slokkvitaeki/app/kjarni/artcraft/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Skýjahreyfimynd | `/kjarni/artcraft/skyjahreyfimynd` | `apps/slokkvitaeki/app/kjarni/artcraft/skyjahreyfimynd/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Skýjastúdíó | `/kjarni/artcraft/skyjastudio` | `apps/slokkvitaeki/app/kjarni/artcraft/skyjastudio/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Einkastúdíó | `/kjarni/artcraft/studio` | `apps/slokkvitaeki/app/kjarni/artcraft/studio/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Sjálfvirk tól | `/kjarni/artcraft/tol` | `apps/slokkvitaeki/app/kjarni/artcraft/tol/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Tónsmíð | `/kjarni/artcraft/tonsmid` | `apps/slokkvitaeki/app/kjarni/artcraft/tonsmid/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Upplyfting | `/kjarni/artcraft/upplyfting` | `apps/slokkvitaeki/app/kjarni/artcraft/upplyfting/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Útvíkka | `/kjarni/artcraft/utvikka` | `apps/slokkvitaeki/app/kjarni/artcraft/utvikka/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Myndbanda-upplyfting | `/kjarni/artcraft/video-upplyfting` | `apps/slokkvitaeki/app/kjarni/artcraft/video-upplyfting/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Ljósmyndaviðgerð | `/kjarni/artcraft/vidgerd` | `apps/slokkvitaeki/app/kjarni/artcraft/vidgerd/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Verkbók | `/kjarni/artcraft/vinnslur` | `apps/slokkvitaeki/app/kjarni/artcraft/vinnslur/page.tsx` | `artcraft` | — | ✅ |
| kjarni | Kjarni — Stjórnstöð | `/kjarni` | `apps/slokkvitaeki/app/kjarni/page.tsx` | `kjarni-vefur` | `joker` · `thema` | ✅ |
| kjarni | Skráning — flokkar, gátlisti og starfsmenn | `/kjarni/skraning/flokkar` | `apps/slokkvitaeki/app/kjarni/skraning/flokkar/page.tsx` | `skraning` | `gagnaleidslur` · `bokari` | ✅ |
| kjarni | Skráning — greining | `/kjarni/skraning/greining` | `apps/slokkvitaeki/app/kjarni/skraning/greining/page.tsx` | `skraning` | `gagnaleidslur` | ✅ |
| kjarni | Skráning — Kjarni | `/kjarni/skraning` | `apps/slokkvitaeki/app/kjarni/skraning/page.tsx` | `skraning` | `gagnaleidslur` · `bokari` | ✅ |
| kjarni | Skráning — prenta teikningu | `/kjarni/skraning/prenta` | `apps/slokkvitaeki/app/kjarni/skraning/prenta/page.tsx` | `skraning` | `gagnaleidslur` | ✅ |
| kjarni | Skráning — byggingar og teikningar | `/kjarni/skraning/verk` | `apps/slokkvitaeki/app/kjarni/skraning/verk/page.tsx` | `skraning` | `gagnaleidslur` | ✅ |
| kjarni | Skráning — vinna | `/kjarni/skraning/vinna` | `apps/slokkvitaeki/app/kjarni/skraning/vinna/page.tsx` | `skraning` | `gagnaleidslur` | ✅ |
| kjarni | Skráning — yfirsýn | `/kjarni/skraning/yfirsyn` | `apps/slokkvitaeki/app/kjarni/skraning/yfirsyn/page.tsx` | `skraning` | `gagnaleidslur` | ✅ |
| kjarni | TurboPaint — Kjarni | `/kjarni/turbopaint` | `apps/slokkvitaeki/app/kjarni/turbopaint/page.tsx` | `sl:arnold` | `elon-musk` · `joker` · `jarvis` | ✅ |
| kjarni | Marks (tilvísun) | `/marks` | `apps/slokkvitaeki/app/marks/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Brunavarnir í öruggum höndum | `/` | `apps/slokkvitaeki/app/page.tsx` | `kjarni-vefur` | `joker` | ✅ |
| kjarni | Nýr vefur | `/s/[slug]` | `apps/slokkvitaeki/app/s/[slug]/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Skjalarinn — skjöl · pdf · lestur | `/skjalarinn` | `apps/slokkvitaeki/app/skjalarinn/page.tsx` | `bh:skjol` | — | ✅ |
| kjarni | Stjórnborð — Brunahólf Slökkvitæki | `/stjorn` | `apps/slokkvitaeki/app/stjorn/page.tsx` | `sl:bord-flettur` | `kjarni-vefur` | ✅ |
| kjarni | Verslun — Slökkvitæki ehf | `/verslun` | `apps/slokkvitaeki/app/verslun/page.tsx` | `kjarni-vefur` | `sala-reikningar` | ✅ |
| kjarni | Dashboard new (sniðmát) | `/dashboard/new` | `apps/web/src/app/(app-pages)/dashboard/new/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Dashboard (sniðmát) | `/dashboard` | `apps/web/src/app/(app-pages)/dashboard/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Private Item (sniðmát) | `/private-item/[privateItemId]` | `apps/web/src/app/(app-pages)/private-item/[privateItemId]/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Private Items (sniðmát) | `/private-items` | `apps/web/src/app/(app-pages)/private-items/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Auth code error (sniðmát) | `/auth/auth-code-error` | `apps/web/src/app/(auth-pages)/auth/auth-code-error/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Auth callback (sniðmát) | `/auth/callback` | `apps/web/src/app/(auth-pages)/auth/callback/route.ts` | `kjarni-vefur` | — | ✅ |
| kjarni | Auth confirm (sniðmát) | `/auth/confirm` | `apps/web/src/app/(auth-pages)/auth/confirm/route.ts` | `kjarni-vefur` | — | ✅ |
| kjarni | Forgot password (sniðmát) | `/forgot-password` | `apps/web/src/app/(auth-pages)/forgot-password/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Login (sniðmát) | `/login` | `apps/web/src/app/(auth-pages)/login/page.tsx` | `kjarni-vefur` | `oryggi` | ✅ |
| kjarni | Sign up (sniðmát) | `/sign-up` | `apps/web/src/app/(auth-pages)/sign-up/page.tsx` | `kjarni-vefur` | `oryggi` | ✅ |
| kjarni | Update password (sniðmát) | `/update-password` | `apps/web/src/app/(auth-pages)/update-password/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | About (sniðmát) | `/about` | `apps/web/src/app/(external-pages)/about/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | City trips from Keflavík | `/borgarferdir` | `apps/web/src/app/(external-pages)/borgarferdir/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Nextbase-sniðmát | `/` | `apps/web/src/app/(external-pages)/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | 3dwork — STL bench | `/3dwork` | `apps/web/src/app/3dwork/page.tsx` | `skill:3dJoker` | — | ✅ |
| kjarni | 3dwork geometry | `/api/3dwork/github/geometry/[id]` | `apps/web/src/app/api/3dwork/github/geometry/[id]/route.ts` | `skill:3dJoker` | — | ✅ |
| kjarni | 3dwork eitt verkefni | `/api/3dwork/github/projects/[id]` | `apps/web/src/app/api/3dwork/github/projects/[id]/route.ts` | `skill:3dJoker` | — | ✅ |
| kjarni | 3dwork verkefni | `/api/3dwork/github/projects` | `apps/web/src/app/api/3dwork/github/projects/route.ts` | `skill:3dJoker` | — | ✅ |
| kjarni | 3dwork GitHub-sync | `/api/3dwork/github` | `apps/web/src/app/api/3dwork/github/route.ts` | `skill:3dJoker` | — | ✅ |
| kjarni | Marks hlekkjaforskoðun | `/api/marks/preview` | `apps/web/src/app/api/marks/preview/route.ts` | `kjarni-vefur` | — | ✅ |
| kjarni | Marks — site | `/marks/[boardId]` | `apps/web/src/app/marks/[boardId]/page.tsx` | `kjarni-vefur` | — | ✅ |
| kjarni | Marks — kjarni bookmarks | `/marks` | `apps/web/src/app/marks/page.tsx` | `kjarni-vefur` | — | ✅ |

**Samantekt:** brunaholf 102/102 með eiganda (100%), 0 ⚠️, 0 ❌ · slokkvitaeki 118/121 með eiganda (98%), 0 ⚠️, 3 ❌ · kjarni 100/100 með eiganda (100%), 0 ⚠️, 0 ❌

### Síður án eiganda

- slokkvitaeki · Spotify (`/spotify/`)
- slokkvitaeki · Myndasafn (img/safn) (`/img/safn/`)
- slokkvitaeki · Kennslubækur (docs/) (`/docs/index.html`)
<!-- SIDUKORT:END -->
