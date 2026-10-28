# Kveikjuorð — Jarvis

Ein setning vakir réttum sérfræðingi. Límdu orðið (eða línuna) inn í Claude /
Jarvis. Agentinn les `description:` í skill-/agent-frontmatter og hleður sér.

Kanónísk tafla (spegluð í brunaholf `docs/` 31.08.2026 svo hub-lotur finni
hana). Sömu orð virka í slokkvitaeki af því `description:` inniheldur lénið.

**Snið:** `orð: stutt mál` — t.d. `villuleit: sama mynstur og Plaza`.

## Villuleit / variant (sama villa, mörg eintök)

Eitt staðfest dæmi → leitaðu að afritum. **Ekki** nýtt app. Skil: Charlize +
einn listi. Vörðu leið → `netvordur` á undan lagfæringu.

| Orð | Agent | Aðgerð |
|---|---|---|
| `villuleit` | `villuleit` | Finna afrit af sama villumynstri. Byrja á rót, svo grep, svo triage. |
| `variant` / `variant-alert` | `villuleit` | Sama og villuleit. Variant analysis: eitt dæmi → öll eintök. |
| `sama mynstur` / `er þetta víðar` / `afrit` | `villuleit` | Hunt copies. Skila lista, laga ekki fyrsta hitt. |
| `systkini` / `systkini-kt` | `villuleit` + `kunnaskra` | Ein skýrsla/reikningur málað á öll hótel/pizzur á sömu kt. Lykill: `fyrirtaeki.id`. |
| `fölsk staðreynd` / `false-fact` / `falskt grænt` | `villuleit` + `uttekt-audit` | Pera/ár græn án skýrslu+reiknings á **þessum** stað. Par á `fyrirtaeki_id`. |
| `röng join` / `FK-join` / `join-villa` | `villuleit` + `elon-musk` | `uttaeki.client` / nafn-fold / `.limit(1)` í stað `uttaeki.fyrirtaeki_id`. `audit-fk-join.cjs`. |
| `hits[0]` / `companyForBld` | `villuleit` + `kunnaskra` | Giskað fyrsta hit á rekstrarfélagi. Aldrei. |
| `Tengireglan` | `kunnaskra` + `sara-coworker` | `fyrirtaeki_id` aðeins með sönnun. Aldrei giskað, aldrei núllað. |

Þekkt dæmi (ekki finna upp ný): Plaza, Center/Pizzan, Hotel Grandi, Heimaleiga
base 293, Hlaðvarpinn, Steypustöðin 2026.

## Lén — orð → agent → aðgerð

| Orð | Agent | Aðgerð |
|---|---|---|
| `kennitala` / `kt` / `999999` | `kunnaskra` | Hreinsa kt, tengja base↔stað, aldrei sameina rekstrarfélags-staði. |
| `customers_base` / `rekstrarfélag` / `sameina` / `tvítak` | `kunnaskra` | Lesa hrygginn áður en röð er sameinuð eða eytt. |
| `skýrsla` / `úttekt` / `fylla skýrslu` | `sara-coworker` | Fylla / yfirfara úttektarskýrslu live. Skýrsla og reikningur segi það sama. |
| `para` / `þekja` / `gloppa` / `vantar að rukka` | `sara-organizer` *(brunaholf)* | Pör skýrsla↔reikningur, `v_bundle_coverage`, aldrei ágiskun. |
| `reikningur` / `sala` / `POS` / `Payday` / `dkPlus` / `afsláttur` | `sala-reikningar` | Sala, reikningagerð, PDF-vistun, póstur. ALLTAF LEYFA VISTUN. |
| `krafa` / `kröfur` / `útistandandi` | `sala-reikningar` + `bokari` *(brunaholf)* | Kröfuyfirlit / AR. Bókari sannreynir tölu. |
| `rukka` / `rukkunarmál` / `reikningalota` / `klára reikninga` / `hvað er tilbúið að senda` | `rukkari` *(brunaholf, spegill í slokkvitaeki)* | Stjórnar allri lotunni: les REIKNINGALOTA.md, tengingar, Drög-stöð, póstur; kallar á bokari / sala-reikningar / eldklar-postur. Útskýrir sig sjálfur — Agnar útskýrir ekkert. |
| `taxti` / `VSK` / `NLSH` / `uppgjör` / `stemmir tala` | `bokari` *(brunaholf)* | Verðleggja, efnislisti, af hverju tala stemmir ekki. |
| `audit` / `samræmi` / `stemmir` / `passar magnið` | `uttekt-audit` | Magn á tækjalista ↔ skýrslu ↔ reikningi. Lesaðeins. `docs/SAMRAEMI-<ár>.md`. |
| `RLS` / `policy` / `lekt` / `anon` / `bucket` | `oryggi` *(brunaholf)* | RLS-staða, policies, lyklar. Áður en ný tafla fer í loftið. |
| `hraði` / `hægt` / `polling` / `bundle` | `hradi` *(brunaholf)* | Mæla og laga hleðslu, þung köll, polling sem étur DB. |
| `kort` / `pinnar` / `geocode` / `Leaflet` / `kill-dots` | `kort` | Pinnar, Nominatim, grátt kort, appelsínugulir punktar. |
| `prentun` / `QR` / `miði` / `Brother` / `raðnúmer` | `prentun` | Miði vitlaust/óskannanlegur, prentleið, S0001 / GY-0012. |
| `árs` / `ársreitur` / `pera` / `FULLBÚIÐ` / `VANTAR` / `SOURCE` / `FILTER` | `elon-musk` | As-built: `docs/RAFKERFI.md` fyrst. Hvaða patch/tafla á þetta borð. |
| `öryggisnet` / `er óhætt` / `brýtur þetta` / `audit-all` | `netvordur` | Kortið + `node tools/audit-all.cjs`. SAFE eða CUTS-A-WIRE. |
| `útlit` / `sími` / `mobile` / `þröngt` / `endurhanna` | `joker` | Farsímaskjár, appham, takkar, letur. Ekki grind (það er 153). |
| `þema` / `skinna` / `Brunastál` / `theme.css` | `thema` | Hönnunarkerfi + per-page skeletons. |
| `flipi` / `borð` / `nav` / `bílstjóri` / `aksturslisti` / `bakk` | `bord-flettur` | Nýr flipi, deep-link, bakk (3 lög). |
| `muna` / `skrá` / `Charlize` / `hvernig var þetta` | `charlize` | Lesa áður en breytt er, skrifa áður en lokað er. |
| `Drive` / `PDF` / `endurnefna` / `skjal` | `skjol` *(brunaholf)* / `cowork-doc-sweep` | Skjöl, möppur, filename-snið. Aldrei eyða. |
| `Tímavera` / `Ajour` / `Redder` / `innsog` | `gagnaleidslur` *(brunaholf)* | Gögn vantar, innsog brotnar, hvað keyrir hvenær. |
| `bilað` / `niðri` / `timeout` / `eitthvað skrítið` | `kerfisheilsa` *(brunaholf)* | Supabase vs Netlify vs Claude vs appið. |
| `lykill` / `tengingar` / `gult` / `rautt` | `tengingar` *(brunaholf)* | Kerfisheilsu-borðið, endurnýja lykil. |
| `staðsetning` / `slökkvigildi` / `flóttaleið` / `byggingarreglugerð` | `arnold` | Hvar búnaður á að vera, hve mörg tæki. |
| `deploy` / `ýta` / `deploy.js` | `deploy` | Aðeins `git push`. Aldrei `node deploy.js`. |
| `verkefnalisti` / `beidni` / `i_vinnu` | `verkefnalisti` | Opna verk áður en nýtt er hafið. Reiturinn heitir `status`. |
| `watchlist` / `banner` / `aðstoð` | `adstod` | Customer brief, 🤖-spjald, Aðstoðarmiðstöð. |
| `hver er staðan` / `morgunyfirferð` / `Jarvis` | `jarvis` *(brunaholf)* | Dagleg yfirsýn, hvaða sérfræðingur á spurninguna. |
| `hype` / `hvernig gengur` | `jarvis` *(brunaholf, kafli „Svið yfirlit“ — áður agent `hype`)* | Sigrar + það sem stendur út af. Alvöru tölur. |

## Límsetningar (copy-paste)

```
villuleit: sama mynstur og Plaza — systkini-kt málar skýrslu á öll hótel
variant: röng join, tæki→nafn í stað FK
fölsk staðreynd: ársreitur grænn án pars á þessum stað
kennitala: tengja kt við customers_base, ekki sameina staði
skýrsla: fylla úttekt og láta reikning stemma
reikningur: POS + Payday, alltaf leyfa vistun
krafa: útistandandi á Kröfuyfirliti
RLS: er taflan opin / þarf policy
hraði: síðan er hægt, finna þunga köll
kort: pinnar vantar / grátt kort
prentun: QR skannast ekki / miði of lítill
árs: pera á röngum lit, as-built fyrst
öryggisnet: er óhætt að ýta
```

## Repo-vísun

| Lén | Repo |
|---|---|
| App, POS, Ársskoðun, Bílstjóri, QR, kort | `slokkvitaeki` |
| Hub, customer.html, Drive-tól, Jarvis-síða, RLS | `brunaholf` |
| Ný Next.js / schema / shadcn | `kjarni` |

Bæði slökkvitæki og brunahólf lesa sama Supabase `osfdzskyvisifcwyjkuk`.

## Tengt

- Agentaskrá (nafn, heim, slóð, aldrei): `docs/AGENTASKRA.md`
- Skill: `.claude/skills/villuleit/SKILL.md`
- Öryggisnet: `docs/ORYGGISNET.md` + agent `netvordur`
- Staðreyndir: `docs/STADREYNDIR.md`
- As-built: `docs/RAFKERFI.md`
- Magn-audit: `.claude/skills/uttekt-audit/SKILL.md`

<!-- AGENT-KVEIKJUR:BEGIN -->
## Sjálfvirk tafla — kveikjuorð úr `description` (búin til af `node tools/build-agents-registry.cjs`)

Byggð 2026-10-28. Þessi tafla er dregin beint úr agent- og skill-skránum og gildir ef hún stangast á við handskrifuðu töfluna hér að ofan. Breyttu kveikjuorðum í `description:` skrárinnar, ekki hér.

| Heiti | Tegund | Kveikjuorð | Skrá síðast uppfærð |
|---|---|---|---|
| `adstod` | agent | `watchlist` · `banner` · `aðstoð` · `tips` · `Aðstoðarmiðstöð` · `customer brief` · `dot á kúnna` · `snooze` · `áríðandi` · `útrunnin tæki` · `líklegir tvítekningar` | 28.10.2026 |
| `bokari` | agent | `taxti` · `VSK` · `efnislisti` · `NLSH` · `Landsspítalinn uppgjör` · `Heklureitur göt` · `Dalvegur 30` · `smáhlutagjald` · `heildarafsláttur` · `stemmir tala` · `mánaðarlok` · `5% geymslufé` | 28.10.2026 |
| `bord-flettur` | agent | `flipi` · `borð` · `nav` · `Þjónustuborð` · `Mitt borð` · `Afmerkja` · `bílstjóri` · `aksturslisti` · `bakk` · `back` · `deep link` · `#company` · `Öpp-síða` · `app finnst ekki í síma` · `uppsetning appa` | 28.10.2026 |
| `elon-musk` | agent | `árs` · `ársreitur` · `pera` · `FULLBÚIÐ` · `VANTAR` · `SOURCE` · `FILTER` · `RAFKERFI` · `röng join` · `tækjafjöldi` · `teikningar` · `búnaðargreining` · `EI-60` · `veggjavél` | 28.10.2026 |
| `framendi` | agent | `flipi` · `nýr flipi` · `hub` · `index.html` · `hliðarstika` · `Kröfu yfirlit` · `Fjármála-yfirlit` · `Drög-stöð` · `Efnislisti` · `dálkastjórn` · `raðanlegir dálkar` · `prófa alla takka` · `hvar býr þetta` | 28.10.2026 |
| `gagnaleidslur` | agent | `Tímavera` · `Ajour` · `Redder` · `luna-bridge` · `innsog` · `póstur skilar sér ekki` · `sjálfvirkni` · `automation_triggers` · `redder lesari bilaður` · `1000 raða þak` · `tímabók` · `samstilla Ajour` · `gögn vantar` | 28.10.2026 |
| `hradi` | agent | `hraði` · `hægt` · `lengi að loadast` · `performance check` · `polling` · `bundle` · `hopp` · `layout thrashing` · `MutationObserver` · `HT-3.10` · `LCP` · `CLS` · `INP` | 28.10.2026 |
| `jarvis` | agent | `hver er staðan` · `morgunyfirferð` · `Jarvis` · `HUD` · `svið` · `hype` · `hvernig gengur` · `vikuyfirlit` · `sigrar` · `afköst` · `agentaskráin` · `hvaða agentar eru til` · `Golden Jarvis` · `Ragnarök` | 28.10.2026 |
| `joker` | agent | `útlit` · `sími` · `mobile` · `þröngt` · `of smátt` · `brotið` · `endurhanna` · `mockup` · `skinna` · `Boss-þema` · `Ragnarök` · `kontrast` · `grátt á gráu` · `laga hlutföll` | 28.10.2026 |
| `kerfisheilsa` | agent | `hægt` · `niðri` · `timeout` · `frosið` · `eitthvað skrítið` · `health check` · `Supabase hrun` · `504` · `statement timeout` · `eru einhverjir gallar` · `peak time Claude` · `appið hleðst ekki` | 28.10.2026 |
| `kort` | agent | `kort` · `pinnar` · `hnit` · `geocode` · `Leaflet` · `kill-dots` · `Nominatim` · `Staðfangaskrá` · `loftmynd` · `bláa slikjan á kortum` · `grátt kort` | 28.10.2026 |
| `kunnaskra` | agent | `kennitala` · `kt` · `customers_base` · `rekstrarfélag` · `sameina` · `tvítak` · `umsjónaraðili` · `endurnefna fyrirtæki` · `nýtt fyrirtæki` · `er þetta sami aðili` · `hits[0]` · `Tengireglan` | 28.10.2026 |
| `natalie` | agent | `stemmir þetta` · `er þetta rétt` · `factcheck` · `farðu yfir árið` · `hvað er satt` · `T=S=I` · `tækjafjöldi stemmir ekki` · `full audit` · `truthcheck` · `fölsk staðreynd` · `false-fact` · `kt-flakk` · `misræmi` · `í þjónustu` · `þjónustulisti` · `ársskoðunarlistinn` · `alls ekki í þjónustu` · `ranglega skráð` · `búið að fara` · `rekstrarfélag` · `hreinsa listann` | 28.10.2026 |
| `netvordur` | agent | `öryggisnet` · `er óhætt` · `er óhætt að ýta` · `brýtur þetta` · `audit-all` · `SAFE` · `CUTS-A-WIRE` · `full audit` · `patch wars` · `áður en deploy` · `áður en merge` | 28.10.2026 |
| `oryggi` | agent | `RLS` · `policy` · `lekt` · `anon` · `bucket` · `service role` · `rótera lykil` · `er taflan opin` · `opið án lykilorðs` · `publishable key` · `security advisor` · `öryggi` | 28.10.2026 |
| `prentun` | agent | `prentun` · `prenta merki` · `QR` · `QR-miði` · `miði` · `Brother` · `PT-P750W` · `raðnúmer` · `skanni` · `strikamerki` | 28.10.2026 |
| `rambo` | agent | `er óhætt að keyra` · `forskoða` · `hvað getur farið úrskeiðis` · `áður en ég ýti` · `Rambo` | 22.10.2026 |
| `rukkari` | agent | `rukka` · `rukkunarmál` · `reikningalota` · `klára reikninga` · `hvað er tilbúið að senda` · `hvað á eftir að rukka` · `ósent` · `ógreitt` · `útistandandi` · `kröfur` · `Drög-stöð` · `nýjustu póstar` · `sækja úr pósti` · `hvað kom í pósti` · `brýnt` · `bókhald ósent` · `óafgreitt` · `hvað var rukkað og greitt` | 28.10.2026 |
| `sala-reikningar` | agent | `reikningur` · `sala` · `POS` · `söluborð` · `Payday` · `dkPlus` · `afsláttur` · `afsláttarhópar` · `krafa` · `kredit` · `Hreyfingarlisti` · `verðlisti` · `birgðir` · `Teya` | 28.10.2026 |
| `samthykktir` | agent | `klára svörin` · `yfirfara svör` · `vinna úr Samþykkja` · `ég er búinn að svara` · `taka borðið` · `afgreiða samþykktir` · `hvað bíður Claude` · `svörin mín á þjónustuborðinu` | 26.10.2026 |
| `sara-coworker` | agent | `skýrsla` · `úttekt` · `fylla skýrslu` · `vinnublað` · `Sara-borðið` · `para` · `Tengireglan` · `tækjafjöldi` · `T=S` · `ferðanóta` · `staðfesta lista` | 28.10.2026 |
| `sara-organizer` | agent | `para` · `þekja` · `gloppa` · `vantar að rukka` · `skýrsla og reikningur` · `finna reikninginn sem passar` · `document_pairs` · `v_bundle_coverage` · `hunt tracker` · `brunaskýrsla vs slökkvitæki` | 28.10.2026 |
| `skjol` | agent | `Drive` · `PDF` · `skjal` · `skýrslumappa` · `tvítök í möppu` · `gömul eintök` · `endurnefna` · `dauður hlekkur` · `customer_documents` · `doc-index` · `Skýrslu-stöð` · `skráarheiti` | 28.10.2026 |
| `tengingar` | agent | `tengingar` · `lykill` · `gult` · `rautt` · `tengja pósthólf` · `tengja GitHub` · `tengja MCP` · `samstilla vélar` · `VEL_HEARTBEAT_TOKEN` · `google-auth` · `rótera lykil` · `næ ekki að tengja` | 28.10.2026 |
| `thema` | agent | `þema` · `skinna` · `Brunastál` · `theme.css` · `litur á takka` · `of mikið appelsínugult` · `dökkblár málmur` · `málmhnappur` · `LITASKRA` · `hönnunarkerfi` | 28.10.2026 |
| `3dJoker` | skill | `power tube` · `hamar/ventill/striker` · `leiðari` · `merkjari` · `marker` · `CO2` · `bolti` · `hleðslublokk` · `breech` · `gengja/thread` · `3mf` · `build123d` · `renna/prenta/lóða` · `Bambu Studio` · `P1S` · `support/yfirhang` · `seam/saumur` · `flow/shrinkage` · `slicer` · `saumbursti` · `klóna/clone stamp` · `One piece` · `vatnsþétt/watertight` · `bd_warehouse` · `meshlib` | 24.10.2026 |
| `add-feature` | skill | `nýr flipi` · `bæta við flipa` · `ný síða í hub` · `nýtt API` · `nýtt endpoint` · `iframe-síða` · `renderXxx` · `add-feature` | 28.10.2026 |
| `agent-athugasemdir` | skill | `taka inn athugasemdir` · `athugasemdir við agenta` · `agent_notes` · `bæta inn í agentana` · `uppfæra agentana` · `fara yfir athugasemdirnar` · `agentaskráin` | 28.10.2026 |
| `ajour-endpoint-capture` | skill | `Ajour` · `NLSH` · `CSV` · `endpoint` · `AjourRegistrationData` | 31.08.2026 |
| `arnold` | skill | `staðsetning` · `kröfur` · `slökkvigildi` · `flóttaleið` · `merkingar` · `byggingarreglugerð` · `notkunarflokkur` · `gönguleið` · `neyðarlýsing` · `útljós` · `leiðarlýsing` · `skylda` · `skyldugir` · `reglugerð` · `lög` · `eldvarnaeftirlit` · `þjónustusamningur` · `löggilding` · `byggingarlýsing` · `brunahönnun` · `skráningartafla` · `sameign` · `stigagangur` · `fjölbýli` · `húsfélag` · `hvar á tækið að vera` · `teikning` · `aðaluppdráttur` · `skera að húsinu` · `festa útlit` · `teikningagluggi` | 20.10.2026 |
| `bh-pdf` | skill | `láta PDF-ið líta svona út` · `font í Verkstaður` · `lógóið eins og í Efnislistanum` | 10.10.2026 |
| `boss-theme` | skill | `Boss-þema` · `Boss-útlit` · `boss-*` · `gull og svart stál` · `skinna hub-síðu` · `modal í Boss` · `Þjónustuborð-útlit` · `theme.css` | 28.10.2026 |
| `brunaholf-layout` | skill | `layout` · `CSS` · `media query` · `breakpoint` · `dálkar` · `þröngt á síma` · `spacing` · `taflan brotnar` | 28.10.2026 |
| `charlize` | skill | `muna` · `skrá` · `Charlize` · `hvernig var þetta` · `þekkingargrunnur` | 08.10.2026 |
| `cowork-doc-sweep` | skill | `Drive` · `skjal` · `veiði` · `doc-sweep` · `samningur` · `úttektarskýrsla` | 31.08.2026 |
| `deploy` | skill | `deploy` · `merge` · `keyra deploy merge` · `ýta` · `git push` · `[deploy]` · `backup fyrst` · `er deployið komið` · `revert` | 28.10.2026 |
| `elon-musk` | skill | `árs` · `ársreitur` · `pera` · `FULLBÚIÐ` · `VANTAR` · `SOURCE` · `FILTER` · `TÆKI` · `KPI` · `data-elon` · `RAFKERFI` · `röng join` · `FK-join` | 31.08.2026 |
| `fact-check` | skill | `fact check` · `tríó` · `stemmir` · `úttekt vs reikningur` · `óskoðaður` · `fram yfir` · `þjónustulisti` · `tækjatala` | 16.10.2026 |
| `gata-manadarlok` | skill | `loka mánuðinum` · `Efnislisti NLSH` · `Landsspítalinn september` · `Heklureitur göt` · `lokastaðan` · `setja stöðuna inn` · `sendi reikning fyrir mismuninum` | 12.10.2026 |
| `google-drive` | skill | `Drive` · `Drive-mappa` · `skýrslumappa` · `endurnefna skjal` · `tvítök í möppunni` · `customer_documents` · `finna skýrslu` · `aldrei eyða` | 28.10.2026 |
| `heidarlegt-vidmot` | skill | `lygandi takki` · `vistun segir OK` · `röðun` · `forgangur` · `hvað er efst` · `hnappur sem gerir ekkert` · `heiðarlegt viðmót` | 18.09.2026 |
| `reikningalota` | skill | `reikningalota` · `klára reikninga` · `hvað er tilbúið að senda` · `ertu með nýjustu póstana` | 04.09.2026 |
| `rekstrarfelog-parun` | skill | `stemmir reikningurinn við skýrsluna` · `hvaða reikningur á þessa skýrslu` · `para eftir magni` · `af hverju er þessi staður vantar reikning` · `tvíræð` · `vegna-línan` · `hvað þarf að sækja mörg tæki til hleðslu` | 27.10.2026 |
| `sara` | skill | `skrá tækin` · `staðfesta lista` · `Annað` · `geturðu klárað blað B` · `skráðu Distica` | 16.10.2026 |
| `slokkvitaeki-layout` | skill | `layout` · `CSS` · `media query` · `sími` · `mobile` · `grind` · `!important` · `sidebar` | 20.10.2026 |
| `stadfesting-brunalokana` | skill | `Staðfesting brunalokana` · `Yfirlýsing vegna brunalokana` · `staðfesting brunalokana` · `yfirlýsing vegna brunalokana` · `staðfesting til verkkaupa` · `búa til yfirlýsingu fyrir <stað>` · `Keldur/Kringlan staðfesting` · `yfirlýsing fyrir byggingar 3-5-7` | 20.10.2026 |
| `uttekt-audit` | skill | `audit` · `samræmi` · `stemmir` · `passar magnið` · `fölsk staðreynd` · `false-fact` · `falskt grænt` · `arsskodun_report_facts` | 31.08.2026 |
| `variant-analysis` | skill | `lagað` · `villuleit` · `variant` · `variant-alert` · `er þetta víðar` · `laga þetta alls staðar` · `hvar annars staðar` · `afrit` · `sama mynstur` | 31.08.2026 |
| `verkefnalisti` | skill | `verkefnalisti` · `beiðni` · `beidni` · `i_vinnu` · `i_yfirferd` · `klarad` · `settu á borðið` · `athuga opin verk` | 28.10.2026 |
| `vidmotsprof` | skill | `prófa` · `staðfesta` · `virkar þetta` · `sannreyna` · `skjáskot af PDF` · `opnast glugginn` | 16.10.2026 |
| `villuleit` | skill | `hindra klúður` · `stöðva klúður` · `villuleit` · `variant` · `variant-alert` · `fölsk staðreynd` · `false-fact` · `sama mynstur og X` · `er þetta víðar` · `afrit` · `systkini` · `röng join` · `FK-join` | 16.10.2026 |
<!-- AGENT-KVEIKJUR:END -->
