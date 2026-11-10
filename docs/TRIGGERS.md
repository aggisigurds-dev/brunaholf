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

Byggð 2026-11-10. Þessi tafla er dregin beint úr agent- og skill-skránum og gildir ef hún stangast á við handskrifuðu töfluna hér að ofan. Breyttu kveikjuorðum í `description:` skrárinnar, ekki hér.

| Heiti | Tegund | Kveikjuorð | Skrá síðast uppfærð |
|---|---|---|---|
| `adstod` | agent | `watchlist` · `banner` · `aðstoð` · `tips` · `Aðstoðarmiðstöð` · `customer brief` · `dot á kúnna` · `punktar á kúnnum` · `snooze` · `fresta` · `þarf athygli` · `áríðandi` · `útrunnin tæki` · `líklegir tvítekningar` · `Pennyworth` | 04.11.2026 |
| `artcraft` | agent | `ArtCraft` · `Skýjastúdíó` · `Skýjahreyfimynd` · `Einkastúdíó` · `Upplyfting` · `Breyta mynd` · `Útvíkka` · `Endurljós` · `Tónsmíð` · `Verkbók` · `Bakgrunnur` · `Replicate` | 05.11.2026 |
| `birgdastjori` | agent | `birgðir` · `lager` · `á lager` · `endursala` · `endurrukka` · `rukka áfram` · `efni í verk` · `keypt fyrir verk` · `innkaupapöntun` · `panta inn` · `vantar á lager` · `kostnaðarverð` · `álagning` · `lágmark` · `talning` | 04.11.2026 |
| `bokari` | agent | `taxti` · `VSK` · `efnislisti` · `NLSH` · `Landsspítalinn uppgjör` · `Heklureitur göt` · `Dalvegur 30` · `smáhlutagjald` · `heildarafsláttur` · `stemmir tala` · `mánaðarlok` · `5% geymslufé` · `Verðlisti` · `Kostnaður` · `uppgjörslisti` · `öryggisfé` · `gata-tilboð` · `gatatilboð` · `tilboð í göt` · `brunaþéttingatilboð` · `tilboð Brunahólfs` | 10.11.2026 |
| `bord-flettur` | agent | `flipi` · `borð` · `nav` · `Þjónustuborð` · `Mitt borð` · `Afmerkja` · `Aðalmál` · `Vinnusamantekt` · `bílstjóri` · `aksturslisti` · `Akstursdagbók` · `Tæknimenn` · `Uppfærsluborð` · `Mælaborð` · `Stjórnstöð` · `Geymsla` · `Mínar síður` · `bakk` · `back` · `deep link` · `#company` · `Öpp-síða` · `app finnst ekki í síma` · `uppsetning appa` | 10.11.2026 |
| `center-hotel` | agent | `Center Hótel` · `Center Hotels` · `Centerhotels` · `Miðbæjarhótel` · `Melissa` · `Munguia` · `Lydia gjaldkeri` · `Arnarhvoll` · `Miðgarður` · `Plaza` · `Klöpp` · `Skjaldbreið` · `Þingholt` · `Þingholt Apartments` · `Hlaðvarpinn` · `Þverholt 14` · `Laugavegur 95-99` · `Laugavegur 120` · `tvíborgun` · `skeytamiðlun` · `reyklosun` | 05.11.2026 |
| `elon-musk` | agent | `árs` · `ársreitur` · `pera` · `FULLBÚIÐ` · `VANTAR` · `SOURCE` · `FILTER` · `RAFKERFI` · `röng join` · `tækjafjöldi` · `year_factcheck` · `gap-flöggur` · `Fyrirtæki í þjónustu` · `skoðunarmánuður` · `Í vinnslu` · `Gleymt` | 10.11.2026 |
| `endurskodandi` | agent | `VSK` · `virðisaukaskattur` · `VSK-skýrsla` · `uppgjörstímabil` · `innskattur` · `bókhald` · `ársreikningur` · `númeraröð` · `kreditreikningur` · `rafrænn reikningur` · `stenst þetta` · `endurskoðun` · `dkPlus` · `Payday` | 04.11.2026 |
| `framendi` | agent | `flipi` · `nýr flipi` · `hub` · `index.html` · `hliðarstika` · `ui.vidmot.hlidarstika` · `DEFAULT_STATE` · `ensureNewTabs` · `hub_state` · `Stjórnborð` · `Vinnustofa` · `Yfirlit` · `Dagurinn` · `Vefrýni` · `Kröfu yfirlit` · `Fjármála-yfirlit` · `dálkastjórn` · `prófa alla takka` · `hvar býr þetta` | 10.11.2026 |
| `fyrirtaeki` | agent | `fyrirtæki í þjónustu` · `kúnni` · `greiðandi` · `tengiliður` · `vantar netfang` · `Samskiptaborð` · `Tengiliðir` · `Hunter` · `sölulisti` · `fyrirtækjaprófíll` · `Kúnna-yfirlit` · `afskráð félag` · `kúnnaminni` · `M` | 10.11.2026 |
| `gagnaleidslur` | agent | `Tímavera` · `Ajour` · `Redder` · `luna-bridge` · `innsog` · `póstur skilar sér ekki` · `sjálfvirkni` · `automation_triggers` · `redder lesari bilaður` · `1000 raða þak` · `tímabók` · `samstilla Ajour` · `gögn vantar` · `Sent Items-1` · `undirmöppur` · `email_digest` · `bank_transactions` · `Teya` | 10.11.2026 |
| `heimaleiga` | agent | `Heimaleiga` · `Dimka` · `Eva Mareksdóttir` · `Máni Apartments` · `Midtown Hotel` · `Blue Mountain` · `Icelandic Apartments` · `Iceland Comfort` · `Ice Apartments` · `S30 Apartments` · `46heima` · `TYR Apartments` · `Bríetartún` · `Dalbrekka` · `Urðarhvarf` · `Eldsalir` · `Aegina` · `Mannheimar` · `Grettisgata 62` · `Freyjugata 16` · `Laugavegur 46` · `Laugavegur 42` · `Iðun apartments` | 10.11.2026 |
| `hradi` | agent | `hraði` · `hægt` · `lengi að loadast` · `performance check` · `polling` · `bundle` · `hopp` · `layout thrashing` · `MutationObserver` · `HT-3.10` · `LCP` · `CLS` · `INP` | 04.11.2026 |
| `innkaupabokari` | agent | `innkaupareikningur` · `birgjareikningur` · `kostnaður` · `kvittun` · `setja í kostnað` · `kíktu í vasann` · `reikningur frá` · `hver seldi okkur` · `tvíbókað` · `ósamþykktur reikningur` · `flokka kostnað` · `Barki` · `Veldix` · `Ólafur Gíslason` · `Öryggismiðstöðin` | 04.11.2026 |
| `jarvis` | agent | `hver er staðan` · `morgunyfirferð` · `Jarvis` · `HUD` · `svið` · `hype` · `hvernig gengur` · `vikuyfirlit` · `sigrar` · `afköst` · `agentaskráin` · `hvaða agentar eru til` · `Agentanetið` · `síðukort` · `lotur` · `göt` | 10.11.2026 |
| `joker` | agent | `útlit` · `sími` · `mobile` · `þröngt` · `of smátt` · `brotið` · `endurhanna` · `mockup` · `skinna` · `Boss-þema` · `Ragnarök` · `kontrast` · `grátt á gráu` · `laga hlutföll` | 04.11.2026 |
| `kerfisheilsa` | agent | `hægt` · `niðri` · `timeout` · `frosið` · `eitthvað skrítið` · `health check` · `Supabase hrun` · `504` · `statement timeout` · `eru einhverjir gallar` · `peak time Claude` · `appið hleðst ekki` · `föst pósthólf` · `fast í keyrslu` · `heilsucheck` · `lífsmark` · `PGRST003` | 04.11.2026 |
| `kerfisrynir` | agent | `kerfisrýni` · `heildarrýni` · `sími og tölva` · `öpp-rýni` · `kontrast` · `snertimörk` · `PWA` · `service worker` · `manifest` · `RLS-rýni` · `Netlify-fall rýni` · `Hawking` · `Stephen Hawking` | 05.11.2026 |
| `kjarni-vefur` | agent | `Stjórnstöð` · `kjarni.vercel.app` · `Vercel` · `Turborepo` · `Verslun` · `Vefverslun` · `Marks` · `Stjórnborð` · `Síðuritill` · `Nýr vefur` · `Prufusvæði` · `Tólaskrá` · `build fellur` | 04.11.2026 |
| `kodafraedingur` | agent | `rétta aðferðin` · `kóðarýni` · `kóðayfirferð` · `diff` · `merge` · `deploya` · `deploy` · `cache-bump` · `?v=` · `tvítak` · `Netlify-fall` · `Lisbeth` | 05.11.2026 |
| `kort` | agent | `kort` · `pinnar` · `hnit` · `hnitalaus` · `pinni á röngum stað` · `firmanafn-lyklar` · `geocode` · `Leaflet` · `kill-dots` · `Nominatim` · `Staðfangaskrá` · `loftmynd` · `bláa slikjan á kortum` · `grátt kort` | 04.11.2026 |
| `kunnaskra` | agent | `kennitala` · `kt` · `customers_base` · `rekstrarfélag` · `sameina` · `tvítak` · `umsjónaraðili` · `endurnefna fyrirtæki` · `nýtt fyrirtæki` · `er þetta sami aðili` · `hits[0]` · `Tengireglan` | 10.11.2026 |
| `logfraedingur` | agent | `lög` · `reglugerð` · `er þetta löglegt` · `má ég` · `skylda` · `starfsleyfi` · `fyrning` · `fyrnd krafa` · `innheimtuviðvörun` · `dráttarvextir` · `samningur` · `tilboð` · `galli` · `kvörtun` · `trygging` · `persónuvernd` · `kennitala` · `Vinnueftirlitið` | 04.11.2026 |
| `natalie` | agent | `stemmir þetta` · `er þetta rétt` · `factcheck` · `farðu yfir árið` · `hvað er satt` · `T=S=I` · `tækjafjöldi stemmir ekki` · `full audit` · `truthcheck` · `fölsk staðreynd` · `false-fact` · `kt-flakk` · `misræmi` · `í þjónustu` · `þjónustulisti` · `ársskoðunarlistinn` · `alls ekki í þjónustu` · `ranglega skráð` · `búið að fara` · `rekstrarfélag` · `hreinsa listann` | 04.11.2026 |
| `netvordur` | agent | `öryggisnet` · `er óhætt` · `er óhætt að ýta` · `brýtur þetta` · `audit-all` · `SAFE` · `CUTS-A-WIRE` · `full audit` · `patch wars` · `áður en deploy` · `áður en merge` | 04.11.2026 |
| `opp` | agent | `firestarter` · `öpp` · `app-síða` · `zoom` · `skölun` · `of stórt` · `of lítið` · `hlutföll` · `botnstika` · `iframe` · `skipta um síðu` · `Ant-Man` | 04.11.2026 |
| `oryggi` | agent | `RLS` · `policy` · `lekt` · `anon` · `bucket` · `service role` · `rótera lykil` · `er taflan opin` · `opið án lykilorðs` · `publishable key` · `security advisor` · `öryggi` · `anon DELETE` · `afritstöflur opnar` · `requireStaff` · `innskráningarhlið` | 04.11.2026 |
| `postur` | agent | `póstur` · `tölvupóstar` · `nýjustu póstar` · `hvað kom í pósti` · `ósvarað` · `svara` · `svardrög` · `Svarhjálp` · `Erindi` · `Póstleit` · `Póstsvörun` · `tilbúin svör` · `email_digest` · `brýnt` · `óafgreitt` · `hver sendi þetta` | 10.11.2026 |
| `prentun` | agent | `prentun` · `prenta merki` · `QR` · `QR-miði` · `miði` · `Brother` · `PT-P750W` · `raðnúmer` · `S-raðnúmer` · `tvítekið raðnúmer` · `auður miði` · `skanni` · `strikamerki` | 04.11.2026 |
| `rambo` | agent | `er óhætt að keyra` · `forskoða` · `hvað getur farið úrskeiðis` · `áður en ég ýti` · `Rambo` | 04.11.2026 |
| `rukkari` | agent | `rukka` · `rukkunarmál` · `reikningalota` · `klára reikninga` · `hvað er tilbúið að senda` · `hvað á eftir að rukka` · `ósent` · `ógreitt` · `útistandandi` · `kröfur` · `Drög-stöð` · `bókhald ósent` · `hvað var rukkað og greitt` · `eindagi` · `inneign` | 10.11.2026 |
| `sala-reikningar` | agent | `reikningur` · `sala` · `POS` · `söluborð` · `Payday` · `dkPlus` · `afsláttur` · `afsláttarhópar` · `krafa` · `kredit` · `Kreditfæra` · `Hreyfingarlisti` · `verðlisti` · `birgðir` · `Teya` · `Tilboð` · `Þjónustusamningar` · `Yfirferð greiðslna` · `Söluyfirlit` · `Bókhald yfirferð` | 10.11.2026 |
| `samthykktir` | agent | `klára svörin` · `yfirfara svör` · `vinna úr Samþykkja` · `ég er búinn að svara` · `taka borðið` · `afgreiða samþykktir` · `hvað bíður Claude` · `svörin mín á þjónustuborðinu` · `settu á borðið` · `settu á þjónustuborðið` · `settu á Samþykkja` · `setja tag á mig` | 08.11.2026 |
| `sara-coworker` | agent | `skýrsla` · `úttekt` · `fylla skýrslu` · `vinnublað` · `Sara-borðið` · `Tengireglan` · `tækjafjöldi` · `T=S` · `ferðanóta` · `staðfesta lista` | 10.11.2026 |
| `sara-organizer` | agent | `para` · `þekja` · `gloppa` · `vantar að rukka` · `skýrsla og reikningur` · `finna reikninginn sem passar` · `document_pairs` · `v_bundle_coverage` · `hunt tracker` · `brunaskýrsla vs slökkvitæki` · `Leiðsögn` | 04.11.2026 |
| `skjol` | agent | `Drive` · `PDF` · `skjal` · `skýrslumappa` · `tvítök í möppu` · `gömul eintök` · `endurnefna` · `dauður hlekkur` · `customer_documents` · `doc-index` · `Skýrslu-stöð` · `skráarheiti` · `Drive-leit` · `PDF Flokkari` · `Skjala-checklist` · `keepit` | 04.11.2026 |
| `skraning` | agent | `Skráning` · `Skráning & QA` · `Yfirsýn` · `Greining` · `Hæðarskýrsla` · `Vinnuútgáfa` · `pinni á teikningu` · `gátlisti` · `Gat Ø` · `Ajour-innflutningur` · `brunaþéttingar` · `skr_yfirlit` | 04.11.2026 |
| `tengingar` | agent | `tengingar` · `lykill` · `gult` · `rautt` · `tengja pósthólf` · `tengja GitHub` · `tengja MCP` · `samstilla vélar` · `VEL_HEARTBEAT_TOKEN` · `google-auth` · `rótera lykil` · `næ ekki að tengja` | 04.11.2026 |
| `thema` | agent | `þema` · `skinna` · `Brunastál` · `theme.css` · `litur á takka` · `of mikið appelsínugult` · `dökkblár málmur` · `málmhnappur` · `LITASKRA` · `hönnunarkerfi` | 04.11.2026 |
| `thjonustugatt` | agent | `þjónustugátt` · `gátt` · `gatt-admin` · `kúnnavefur` · `þjónustuvefur` · `Viðskiptavinavefir` · `opinn aðgangur` · `opna sem kúnni` · `Tilkynna` · `rýmingaráætlun` · `skoda.html` · `vefverslun` · `vefrýni` · `eldvarnabók` · `Heimdall` | 10.11.2026 |
| `utlitsserfraedingur` | agent | `farðu yfir útlitið` · `samþykkja útlit` · `kontrast` · `svart á svörtu` · `hvítt á hvítu` · `snertiflötur` · `of smátt` · `hlutföll` · `mobile` · `Miranda` | 04.11.2026 |
| `verkstadur` | agent | `Frá verkstað` · `vettvangsapp` · `Brunaþéttingar-appið` · `field-app` · `verkstjóri` · `efni af lager` · `sérkaup` · `efniskostnaður verkstjóra` · `gr-materials` · `kvittun` · `nýtt verk á staðnum` · `Deilt með verkstað` | 10.11.2026 |
| `3dJoker` | skill | `power tube` · `hamar/ventill/striker` · `leiðari` · `merkjari` · `marker` · `CO2` · `bolti` · `hleðslublokk` · `breech` · `gengja/thread` · `3mf` · `build123d` · `renna/prenta/lóða` · `Bambu Studio` · `P1S` · `support/yfirhang` · `seam/saumur` · `flow/shrinkage` · `slicer` · `saumbursti` · `klóna/clone stamp` · `One piece` · `vatnsþétt/watertight` · `bd_warehouse` · `meshlib` | 24.10.2026 |
| `add-feature` | skill | `nýr flipi` · `bæta við flipa` · `ný síða í hub` · `nýtt API` · `nýtt endpoint` · `iframe-síða` · `renderXxx` · `add-feature` | 10.11.2026 |
| `agent-athugasemdir` | skill | `taka inn athugasemdir` · `athugasemdir við agenta` · `agent_notes` · `bæta inn í agentana` · `uppfæra agentana` · `fara yfir athugasemdirnar` · `agentaskráin` | 31.10.2026 |
| `ajour-endpoint-capture` | skill | `Ajour` · `NLSH` · `CSV` · `endpoint` · `AjourRegistrationData` | 31.08.2026 |
| `arnold` | skill | `staðsetning` · `kröfur` · `slökkvigildi` · `flóttaleið` · `merkingar` · `byggingarreglugerð` · `notkunarflokkur` · `gönguleið` · `neyðarlýsing` · `útljós` · `leiðarlýsing` · `skylda` · `skyldugir` · `reglugerð` · `lög` · `eldvarnaeftirlit` · `þjónustusamningur` · `löggilding` · `byggingarlýsing` · `brunahönnun` · `skráningartafla` · `sameign` · `stigagangur` · `fjölbýli` · `húsfélag` · `hvar á tækið að vera` · `teikning` · `aðaluppdráttur` · `skera að húsinu` · `festa útlit` · `teikningagluggi` | 10.11.2026 |
| `bh-pdf` | skill | `láta PDF-ið líta svona út` · `font í Verkstaður` · `lógóið eins og í Efnislistanum` | 10.10.2026 |
| `boss-theme` | skill | `Boss-þema` · `Boss-útlit` · `boss-*` · `gull og svart stál` · `skinna hub-síðu` · `modal í Boss` · `Þjónustuborð-útlit` · `theme.css` | 28.10.2026 |
| `brunaholf-layout` | skill | `layout` · `CSS` · `media query` · `breakpoint` · `dálkar` · `þröngt á síma` · `spacing` · `taflan brotnar` | 28.10.2026 |
| `charlize` | skill | `muna` · `skrá` · `Charlize` · `hvernig var þetta` · `þekkingargrunnur` | 08.10.2026 |
| `cowork-doc-sweep` | skill | `Drive` · `skjal` · `veiði` · `doc-sweep` · `samningur` · `úttektarskýrsla` | 31.08.2026 |
| `deploy` | skill | `deploy` · `merge` · `keyra deploy merge` · `ýta` · `git push` · `[deploy]` · `backup fyrst` · `er deployið komið` · `revert` | 10.11.2026 |
| `elon-musk` | skill | `árs` · `ársreitur` · `pera` · `FULLBÚIÐ` · `VANTAR` · `SOURCE` · `FILTER` · `TÆKI` · `KPI` · `data-elon` · `RAFKERFI` · `röng join` · `FK-join` | 31.08.2026 |
| `fact-check` | skill | `fact check` · `tríó` · `stemmir` · `úttekt vs reikningur` · `óskoðaður` · `fram yfir` · `þjónustulisti` · `tækjatala` | 08.11.2026 |
| `gata-manadarlok` | skill | `loka mánuðinum` · `Efnislisti NLSH` · `Landsspítalinn september` · `Heklureitur göt` · `lokastaðan` · `setja stöðuna inn` · `sendi reikning fyrir mismuninum` | 10.11.2026 |
| `google-drive` | skill | `Drive` · `Drive-mappa` · `skýrslumappa` · `endurnefna skjal` · `tvítök í möppunni` · `customer_documents` · `finna skýrslu` · `aldrei eyða` | 28.10.2026 |
| `heidarlegt-vidmot` | skill | `lygandi takki` · `vistun segir OK` · `röðun` · `forgangur` · `hvað er efst` · `hnappur sem gerir ekkert` · `heiðarlegt viðmót` | 18.09.2026 |
| `reikningalota` | skill | `reikningalota` · `klára reikninga` · `hvað er tilbúið að senda` · `ertu með nýjustu póstana` | 04.09.2026 |
| `rekstrarfelog-parun` | skill | `stemmir reikningurinn við skýrsluna` · `hvaða reikningur á þessa skýrslu` · `para eftir magni` · `af hverju er þessi staður vantar reikning` · `tvíræð` · `vegna-línan` · `hvað þarf að sækja mörg tæki til hleðslu` | 08.11.2026 |
| `sara` | skill | `skrá tækin` · `staðfesta lista` · `Annað` · `geturðu klárað blað B` · `skráðu Distica` | 10.11.2026 |
| `slokkvitaeki-layout` | skill | `layout` · `CSS` · `media query` · `sími` · `mobile` · `grind` · `!important` · `sidebar` | 10.11.2026 |
| `stadfesting-brunalokana` | skill | `Staðfesting brunalokana` · `Yfirlýsing vegna brunalokana` · `staðfesting brunalokana` · `yfirlýsing vegna brunalokana` · `staðfesting til verkkaupa` · `búa til yfirlýsingu fyrir <stað>` · `Keldur/Kringlan staðfesting` · `yfirlýsing fyrir byggingar 3-5-7` · `ný staðfesting fyrir <verk>` · `Heklureitur staðfesting` · `Laugavegur 170` | 04.11.2026 |
| `uttekt-audit` | skill | `audit` · `samræmi` · `stemmir` · `passar magnið` · `fölsk staðreynd` · `false-fact` · `falskt grænt` · `arsskodun_report_facts` | 10.11.2026 |
| `variant-analysis` | skill | `lagað` · `villuleit` · `variant` · `variant-alert` · `er þetta víðar` · `laga þetta alls staðar` · `hvar annars staðar` · `afrit` · `sama mynstur` | 31.08.2026 |
| `verkefnalisti` | skill | `verkefnalisti` · `beiðni` · `beidni` · `i_vinnu` · `i_yfirferd` · `klarad` · `settu á borðið` · `athuga opin verk` | 02.11.2026 |
| `vidmotsprof` | skill | `prófa` · `staðfesta` · `virkar þetta` · `sannreyna` · `skjáskot af PDF` · `opnast glugginn` | 02.11.2026 |
| `villuleit` | skill | `hindra klúður` · `stöðva klúður` · `villuleit` · `variant` · `variant-alert` · `fölsk staðreynd` · `false-fact` · `sama mynstur og X` · `er þetta víðar` · `afrit` · `systkini` · `röng join` · `FK-join` | 16.10.2026 |
<!-- AGENT-KVEIKJUR:END -->
