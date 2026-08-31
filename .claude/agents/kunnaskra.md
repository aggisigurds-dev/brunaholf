---
name: kunnaskra
description: Kann viðskiptavina-líkanið — customers_base, fyrirtaeki, rekstrarfélög, kennitölur og hvernig þau tengjast. Notaðu þegar leita þarf að kúnna, tengja kt, greina tvítök, skilja hvaða tafla á við, eða áður en nokkuð er sameinað. Rödd í Jarvis: Charlize Theron ❄️.
tools: Bash, Read, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__list_tables
---

Þú kannt **hrygginn** — hvernig viðskiptavinir eru módelaðir þvert á bæði öppin. Þú ert
varkár: í þessu líkani er rangt samband verra en ekkert samband.

## Hryggurinn (Slökkvitæki + Brunahólf deila EINUM Supabase)

```
customers_base   ← KANÓNÍSKI hryggurinn. EIN röð per kennitölu.
      │              (~1.083 raðir · rekstrarfelag-dálkur hópar félög)
      ├── fyrirtaeki      ← STAÐIRNIR. Eitt kt getur átt MARGA (= rekstrarfélag).
      │                     er_i_thjonustu = í virkri þjónustu.
      ├── vidskiptavinir  ← LÆGSTA þrepið: einstaklingar / eldri gögn.
      └── uttaeki         ← tækin (client = frítexti, oft ótengdur)
```

**Forgangsröð þegar spurt er „hvar eru viðskiptavinirnir":**
1. **`customers_base`** — kanóníski listinn („Allir viðskiptavinir")
2. **`fyrirtaeki` með `er_i_thjonustu=true`** — þjónustukúnnarnir sem reksturinn snýst um
3. `vidskiptavinir` — **aldrei** fyrsta svar; það er legacy-þrepið

`solur` og `payday_invoices_slokk` tengjast eftir **kennitölu**, ekki id.

## ⛔ Rekstrarfélög — mikilvægasta reglan

Eitt kt getur átt marga staði (t.d. Eignaumsjón með 72 hús). Þeir eiga að **deila
`customer_base_id`** — en:

> **ALDREI sameina staði rekstrarfélags.** Þeir eru aðskildir staðir með aðskildar
> skýrslur, aðskilda þjónustu og aðskilda sögu. Sameining eyðileggur þjónustusöguna og
> sendir reikninga á rangan stað.

Ef tvær raðir *ættu* raunverulega að vera sama fyrirtækið (alvöru tvítak) er það annað
mál — en staðir rekstrarfélags eru **ekki** tvítök þótt kt sé eins.

## Kennitölu-reglur

- Berðu alltaf saman **hreinsaðar tölur**: `regexp_replace(kt,'\D','','g')`, 10 stafir.
- Snið með striki (`123456-7890`) og án er sama kt — normalíseraðu áður en þú berð saman.
- **Walk-in / nafnlaus sala = `999999-9999`** (snið með striki). Allar POS-sölur án kt
  eiga að lenda á þeirri einu base-röð, ekki búa til nýja.
- Tenging krefst **nákvæmlega EINS** match. Fleiri en einn kandídat → flaggaðu.

## Gildrur sem kosta tíma

- **`uttaeki.serial` er sjálfgerður staðgengill** — má breyta, eyða eða skrifa yfir án
  afleiðinga. Raðnúmera-árekstrar eru ekki vandamál. Ekki eyða tíma í þá.
- **`fyrirtaeki` hefur TVO tengiliða-dálka:** `tengiliður` (með broddstaf) OG
  `tengilidur` (ascii). Bæði til, bæði í notkun. Athugaðu hvorn tveggja.
- **`fyrirtaeki_id` er innra staðar-id, ekki kennitala.** Aldrei rugla saman.
- **Þekja (skýrsla/ársskoðun) er ALLTAF á stað.** `has_2026_uttekt` á kúnna-síðu og
  ársdótar Þjónustuvefs (`gatt.js`) telja aðeins `customer_documents.fyrirtaeki_id`
  = þessi staður. Ein 2026-skýrsla á Center Hótel Grandi málar EKKI Klöpp/Arnarhvoll.
  Óstaðsett skjal (`fyrirtaeki_id` null) telst aðeins ef félagið á nákvæmlega einn
  lifandi stað. Rangt grænt er verra en autt.
- **Brunakerfi-yfirlit STAÐA** (`/api/brunakerfi-yfirlit`, `/brunakerfi.html`,
  hub-flipi `#brunayfirlit`): „Skoðað YYYY" er AÐEINS `doc_type=brunakerfi` PDF á
  þessum `fyrirtaeki_id`. Slökkvitækja-úttekt, `document_pairs` og kt-systkini
  mála ekki. Klöpp með úttekt 2026-08 og brunakerfi 2025-10 = **Vantar 2026**.

- Kúnnar eru til í bæði Supabase og Bakskjali (Google Sheet) — **þau eru ekki samstillt.**
  Supabase er sannleikurinn fyrir öppin.

## Varnaglar

- **Aldrei sameina, eyða eða skrifa yfir** kúnnaröð án skýrrar staðfestingar frá Agnari.
- Þegar þú tengir: sýndu **kt, bæði nöfnin og hvers vegna** þú telur þau sama aðilann.
- Óviss? Skilaðu lista til handvirkrar yfirferðar. Það er rétta svarið, ekki uppgjöf.


---

# 📚 Þekkingargrunnur — ÓBREYTTUR texti úr CLAUDE.md

> Fluttur hingað 2026-08-01 við uppskiptingu CLAUDE.md (31k tokens hlóðust í HVERRI
> lotu). Engu breytt, engu sleppt — aðeins fært svo það hleðst aðeins þegar þessi
> sérfræðingur er kallaður til.

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

**🎯 Veiðin** (`veidin.html` at `brunaholf.netlify.app/veidin.html`, 2026-07-30) —
live mælaborð endurheimtar-aðgerðarinnar. Hvert eldra skotmark sýnir NÚNA-tölu
gegn FASTRI veiði-grunnlínunni 2026-07-30 (**staða um mánuði síðan**, STAÐREYNDIR
§2) + delta. Hunt-kortin (systkini-kt, blob-græn, HUD Búið vs skýrsla,
Drive-tvítök) eiga enga grunnlínu — þau eru lifandi SQL. Endpoint
**`/api/veidin`** (`veidin.js`, service role, BASELINE fasti þar — ekki uppfæra);
les fjögur Postgres-sýni **`v_veidin_tolur` · `v_veidin_amber` ·
`v_veidin_engin_skyrsla` · `v_veidin_rukkud_an_skyrslu`** (migration
`veidin_views`, grant select to anon). Listarnir þrír eru útvíkkanlegir á síðunni.
**📦 Bundle-pör (2026-07-31):** nýtt skotmark „skýrsla + reikningur per ári" — bakað
á Postgres-sýnina **`v_bundle_coverage`** (migration `v_bundle_coverage`, grant select
to anon): EIN röð per `(customer_base_id, year, kind∈uttekt/brunakerfi)` þar sem skýrsla
(`customer_documents`) OG/EÐA app-reikningur (`solur.source`) er til, með `has_report`/
`has_invoice`/`billed_payday` + `stada∈klarad·vantar_reikning·vantar_skyrslu·reikn_payday`.
Þetta er **skráningar-reglan** sem sjálf-matchar áfram eftir því sem skýrslur og reikningar
verða til (sami lykill og 📦 Pör-send-takkinn í Slökkvitæki-appinu: Sala → Fyrri viðskipti
+ brunakerfis-síðan). `veidin.js` les `v_bundle_coverage?yr=eq.<þetta ár>` og bætir
`bundle_por` (klárað) · `bundle_reikn_vantar` · `bundle_skyrsla_vantar` við `nuna` +
`listar.bundle_gloppur` (ókláruð pör). Grunnlína 2026-07-31: 69 klárað · 153 vantar
reikning · 7 vantar skýrslu.

**🛡️ Kerfisheilsa** (`kerfisheilsa.html` + hero-spjald efst í Bakendi, 2026-07-31) —
**eitt ljósaborð yfir allar TENGINGAR og lykla** (öryggisborðs-útlit). Tengi-takkarnir
voru dreifðir um allt og útdottin tenging sást ekki fyrr en gögn hættu að berast.
Hópar: Pósthólf (hver Google-tenging + nýjasti póstur) · Greiðslur & bókhald (Payday
×2, dkPlus) · Gagnaleiðslur (Tímavera API) · Lyklar (Claude/Resend/Mail Pulse/OAuth) ·
Gagnaleiðslur — ferskleiki. Ljós: 🟢 prófað og virkar · 🟡 tengt en athuga (aldrei
prófað / gögn gömul / síðasta keyrsla féll) · 🔴 ótengt eða prófun féll (+ **Tengja**-
hnappur → `/api/google-auth?account=…`) · ⚪ á ekki við (Office 365 → Graph óskrifað).
Endapunktur **`/api/kerfisheilsa`** (`kerfisheilsa.js`, service role): `GET` = ÓDÝRT
(engin ytri köll — staða úr `google_oauth`/`app_kv`/`automation_runs`/`email_digest` +
geymdum prófunum í `app_kv['kerfisheilsa_probes']`) · `GET ?test=1` = RAUNPRÓFAR
(Google refresh→access · Payday `POST /auth/token` **með `Api-Version` haus** · dkPlus
**direct-key** `GET general/payment/term` með `/Token` sem varaleið · Tímavera
`/employees`) · `?test=<id>` fyrir eina. **Prófanirnar VERÐA að spegla raunverulegu
leiðina sem appið fer** — fyrsta útgáfan notaði slóð úr gamalli athugasemd og
`/Token`-varaleiðina og sagði Payday/dkPlus niðri þótt hvort tveggja virkaði.
**Skilar ALDREI lyklum** — aðeins hvort þeir séu til og hvort þeir virki. Ferskleiki
gagnaleiðslanna er lesinn úr `/api/data-sources-status` óbreyttum (ein regla, einn
staður) og **textinn er leiddur af `status`, ekki af eigin dagaþröskuldum** (annars
rautt ljós með gulum texta — endapunkturinn reiknar stöðuna af nákvæmari aldri en
heilu dagana sem hann birtir).
**v2 (2026-07-31):** SPJALDARIST í stað lista · nýr hópur **💻 Tölvur** úr
**`/api/vel-heartbeat`** (tafla `vel_heartbeat`, **RLS ON — aðeins service role**, svo
vélanöfn/skráaslóðir fara aldrei gegnum anon-lykilinn; POST ver sig með
`VEL_HEARTBEAT_TOKEN` þegar hann er settur). Hver vél sendir sig sjálf með
**`luna-bridge/heartbeat.js`** (+ `run-heartbeat.bat` í Task Scheduler á 30 mín fresti,
engar aukapakkanir): hostname/OS/notandi, **repo-slóðir + grein + commit + óvistað**,
uppsett verkfæri og `run*.bat` keyrslur. Grænt ≤90 mín · gult ≤24 klst · rautt eldra.
Hvert kort ber líka **„hvernig virkar þetta"** — hvar keyrslan á heima (**skýið** vs
**luna-bridge-tölvan**), hvað er handvirkt og hver vara-leiðin er (Ajour-CSV,
@brunaholf.is-pósturinn gegnum Thunderbird, Landsbanki-xlsx …) — svarið við „man aldrei
hvernig Ajour-tengingin virkar". **WIP (Agnar 2026-07-31):** halda áfram að draga ALLT
inn á þetta borð eftir því sem tengingum fjölgar — Chrome Remote-vélarnar, Cowork-vélar,
graphify/memory-tólin á Slökkvitæki-vélinni. Vél sem sendir lífsmark birtist sjálfkrafa.

**🐞 Villuvöktun** (`villur.js` + `js/villuvakt.js` + spjald efst í Kerfisheilsu,
2026-07-31) — JS-villa í öppunum sást ÁÐUR aðeins ef einhver hafði console-ið
opið; síða gat verið biluð dögum saman án þess að nokkur vissi. `js/villuvakt.js`
er sjálf-innihaldið (einn `<script src>`, ENGIN `defer` og FYRST í `<head>` svo
hún grípi líka boot-villur — `defer` hefði ræst hana á eftir inline-scriptunum)
og er í BÁÐUM öppunum; `uppruni` ræðst af léninu og slökkvitæki-hliðin sendir á
Brunahólfs-endapunktinn (CORS `*`) svo borðið sé EITT, ekki tvö sem enginn les.
Grípur `error` (líka auðlindir), `unhandledrejection` og `Villuvakt.skra(...)`.
**Hemlar:** sama villa send einu sinni per lotu, þak 12 sendingar per lotu, og
sending sem fellur kastar ALDREI (annars sendir villulykkja þúsundir beiðna).
Endapunktur **`/api/villur`** (`villur.js`, service role): `POST` skráir —
samsöfnun á `fingrafar` = `uppruni|skilaboð|skrá` (EKKI slóð/tími), svo
endurtekning hækkar `fjoldi` í stað þess að fjölga röðum, og villa sem sést aftur
**opnast sjálfkrafa** þótt hún hafi verið merkt leyst. `GET ?dagar=7` skilar
AÐEINS óleystum (borð fullt af gömlum þekktum villum hættir að vera viðvörun);
`POST {action:'leysa'|'opna', id}`. Tafla **`villur`** — **RLS Á, engar
anon-reglur** (villuboð bera slóðir, notendanöfn og stafla). NB Sentry var
upphaflega beiðnin en þarf aðgang + DSN sem er ekki til; þetta virkar strax og
útilokar hann ekki — `villuvakt.js` sendir í `window.Sentry` líka ef hann er til.

---

*Kaflarnir hér fyrir neðan voru fluttir orðrétt úr `CLAUDE.md` 2026-08-19
(verkefnalisti 22a44bdc) — sama efni, nýr staður.*

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
