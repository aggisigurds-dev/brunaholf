# 🎯 Veiðiskýrsla — fyrsta ferðin (nótt 30.7.2026)

## Stærstu fundir (top 5)

1. **Heimaleiga er heitasti kúnninn og bíður svars** — 3 opnir póstþræðir (dimka@/eva@heimaleiga.is, nýjast 29.7.), tilboðs-eftirfylgni 24.7. ósvöruð, og beiðni #687 flaggar 3 staði með „ENGIN SKÝRSLA — panta skoðun" (Dalbrekka 4-6, Urðarhvarf 4, Laugavegur 18) + 3 útrunnar skoðanir.
2. **5 „VANTAR-kt" kúnnar EIGA 2026-skýrslu** undir öðru nafni/kt á sama stað (Hress→Heilsudalurinn 540497-2149, Hörðukór→530307-0340, Háaleitisbraut 58-60→Thai Lindin, Kaplahrauni 13→Þúsund Fjalir, Hagvagnar→Hagvagnar hf 461291-1399) — þetta er tengingargat, ekki skoðunargat.
3. **53 sölu-drög óreikningsfærð, ~620þ kr+** — stærst Hagvagnar R-000391 102.616 kr (24.6.), elst ICS R-000034 47.260 kr frá 8.5. (12 vikur). NB status-gildið er `drog`, ekki `draft`.
4. **ICS ehf. (kt 641122-0760): 26 reikningar + 2026-skýrsla en EKKI merkt í þjónustu** — efst á týndra-kúnna listanum, á líka 47þ kr drög.
5. **App-gerðar 2026-skýrslur sitja ótengdar í bucket/staging** — Sveitahótelið Brú (júlí, bæði bucket og Drive-staging möppu frá 26.7.), E Fasteignafélag (júlí + 3 brunakerfisskýrslur), Bílabúð Benna Fiskislóð, Miðleiti 2-6, Skaftahlíð 4-10 — brúin `uttekt-upload`/Skýrslu-stöð nær ekki utan um þær enn.

## 1. Skýrslur fundnar (bucket + Drive)

| Félag/staður | Hvar fannst | Skráarnafn / ár | Næsta skref |
|---|---|---|---|
| Sveitahótelið Brú (Borealis) | **Bucket + Drive-staging** (mappa 1tWlFq…) | úttektarskýrsla 2026-júlí (#202) | Færa úr staging í kanónísku möppuna + tengja (Skýrslu-stöð) |
| E Fasteignafélag (630216-1680) | Bucket eingöngu | úttektarskýrsla júlí 2026 + 3× brunakerfi 26-0003 + R-651/652 | Keyra gegnum uttekt-upload brúna → Drive + customer_documents |
| Bílabúð Benna - Fiskislóð | Bucket | brunakerfisskýrsla + úttektarskýrsla jún 2026 | Tengja á stað 1612/532 í Skýrslu-stöð |
| Aðalskoðun (5409942269) | **Bucket + Drive** (utan kanónísku möppu!) | Grjótháls/Hjallahraun/Skeifan/Skemmuvegur 2026 | Sópa gömlu 2026-möppuna (1ZW55IrJ…) inn í kanónísku; tengja per stað |
| Miðleiti 2-6 (Húsf. v/bílageymslu) | Bucket | Úttektarskýrsla 2026 (mappa 119) | uttekt-upload brú; Drive á bara 2025 |
| Skaftahlíð 4-10 | Bucket | Skaptahl. 4-10 2026 | uttekt-upload brú (Drive: aðeins reikningur) |
| Húsfél. Laugavegi 42 | Bucket | „Heimaleiga ehf vegna Laugavegur 42 febr.2026" | Staðfesta að þetta sé skýrslan (nafnið segir Heimaleiga) → tengja |
| Hagvagnar | **Bucket + Drive** | Hagvagnar hf 2026 — **kt-misræmi** (461291-1399 vs 640996-3159) | Leysa hvor kt er rétt í Kt-samræmingu, svo tengja |
| Hress (VANTAR-kt) | Drive | Heilsudalurinn eignarhaldsfélag, Dalshrauni 11, kt 540497-2149, 2026 | Setja rétta kt á fyrirtaeki-röðina + tengja |
| Hörðukór bílageymsla (VANTAR-kt) | Drive | Hörðukór 5 Bílakjallari, kt 530307-0340, 2026 | Sama — kt-lagfæring + tenging |
| Háaleitisbraut 58-60 (VANTAR-kt) | Drive | Thai Lindin, kt 450424-1290, 2026 — sama heimilisfang | Staðfesta að leigjandi = staðurinn, svo tengja |
| Kaplahrauni 13 (VANTAR-kt) | Drive | Þúsund Fjalir ehf, kt 591199-3159, 2026 | Sama |
| Vélsm. Orms & Víglundar | Drive | 2026-skýrsla EN fyrir Skútuhraun 9 (#288), ekki Slippinn | Slippurinn (Vesturhraun 1) vantar enn 2026-skýrslu |
| Center Hótel | Bucket | Grandi 2026 (kerfi + slökkvitæki) | Miðgarður/Þverholt 14 vantar samt — bara kt-hópsmatch |
| Steypustöðin (6607070420) | Bucket/Drive | 2026 fyrir Hvalfjörð/Malarhöfða/Hringhellu | Borgarnes/Selfoss/Þorlákshöfn vantar enn |
| Heimaleiga (5101170690) | Bucket | Hamraborg 7 júlí 2026 + almenn 2026-skýrsla | Dalbrekka 4-6 og Freyjugata 16 vantar — bóka skoðun (sbr. #687) |
| Prikið | Bucket | þjónustusamningur 2026 (ekki skýrsla) | Tengja sem samning |

**Ótengd bucket-skjöl án brúar:** Galtarlind kt 710797-2429 (2026-skýrsla, **engin base-röð til fyrir kt-ið**), Sjómannafélag Íslands (möppu-kt vísar á Megin lögmannsstofu — misræmi), AH Pípulagnir / Bragðarefir / hótel Laxnes / Hreyfill 2026 (engin kt-vísbending).

## 2. Netföng fundin

| Félag | Netfang | Sönnun | Vissa |
|---|---|---|---|
| Blikk ehf | brynja@blikk.is (+bjorgvin@, hlynur@) | 3 sendendur @blikk.is í digest | Há |
| Brynja leigufélag ses | armann@brynjaleigufelag.is | 3 póstar, nýjast 6/2026 | Há |
| Bílastjarnan | kiddi@bilastjarnan.is | lén = félagsnafn | Há |
| Afltak ehf | bokhald@afltak.is | lén = félagsnafn | Há |
| Reising Byggingarfélag | bergthor@reising.is | lén = félagsnafn, 9/2025 | Há |
| Þórarinna Söebech | mimisoebech@outlook.com | sendandanafn = kúnnanafn, 14 póstar | Há |
| Garðabær | gardabaer@gardabaer.is (tengiliður: maniei@) | opinbert lén | Há |
| Lampar.is | elma@lampar.is | 1 póstur frá 2018 — staðfesta | Miðlungs |
| Klúbburinn Geysir | thorunn@geysir.is | lén gæti verið annað Geysir-félag | Miðlungs |
| Fasteignasalan Garður | gardurinn@gardurinn.is (+bokhald@) | beygingar-match, 6/2026 | Miðlungs |
| Lyngás 1a-d bílag. | bvlyngas@gmail.com | local-part passar, 1 póstur 2020 | Miðlungs |

Þekja: 11 af 190 netfangslausum (~6%) — restin hefur aldrei sent póst á hólfin.

## 3. Ný tækifæri (skátinn)

- **Krókháls 9 / benni.is** — FJÓRAR opnar tilboðsbeiðnir sama þráðar (#7, #9, #23, #683) síðan 1.6.; Guðmundur (gudmundurs@benni.is) skrifaði síðast 10.7. → sameina í eina og svara.
- **#698 Engjasel 31 — SAMÞYKKT tilboð, uppsetning óbókuð** (unnir peningar, ekki á plani).
- **#699 (base 230) — win-back:** ex-kúnni biður um gamla reikninga, „ætlar kanski að koma í þjónustu aftur".
- **#477** — tilboð í 22+1 slökkvitæki (11.6., 7 vikur ósvarað); **#487** — þjónustusamningur + léttvatnstæki (15.6.).
- **Greg Mortimer CO2** (#29/#31 + gara@gara.is 24.7.) — áfylling átti að gerast 27.7.; staðfesta unnið/rukkað.
- Ósvaraðir kúnnapóstar 30d: gísli björn (tilboð 23.7.), Reykjavíkurborg bókhald (eindagamál 20.7.), Colas (#697), Stangarhylur-þráður (fjölaðila, 22.7.).
- **53 drög í solur** (elst 8.5.) ≈ 620þ kr+; toppar: Hagvagnar 102.616, ICS 47.260, Höldur 41.600, Lemon 37.130, Vélrás 35.696, Sendó 33.640.
- Tvíteknar beiðnir til að sameina: #696/#25 (Dalbrekka), #490/#21 (Reykjavíkurvegur 72), #29/#31.

## 4. Týndir kúnnar í forgangsröð (top 10)

Allir með skjöl/reikninga en engan stað merktan `er_i_thjonustu`:

| # | Félag | kt | Sönnun |
|---|---|---|---|
| 1 | ICS ehf. | 641122-0760 | Skýrsla 2026 + **26 reikningar** (nýjast 2026) |
| 2 | SyNord ehf. | 520417-2650 | Skýrsla 2026 + 10 reikningar |
| 3 | Teitur Jónasson ehf. | 520273-0349 | Skýrsla 2026 + 9 reikningar |
| 4 | Sjúkraþjálfun Grafarvogs | 640801-2040 | Skýrsla + reikningur 2026 |
| 5 | Þemasnyrting ehf | 450106-1860 | Skýrsla + reikningur 2026 |
| 6 | InfoMentor ehf. | 450912-1900 | Skýrsla + reikningur 2026 |
| 7 | Prinsinn | 690420-0740 | Skýrsla + reikningur 2026 |
| 8 | K-50 ehf. | 551217-1830 | Skýrsla 2026, reikningur 2025 |
| 9 | Verkalýðsfél. Hlíf | 620169-3319 | 4 skýrslur + reikningur 2026, **enginn lifandi staður** |
| 10 | Húsfélag Næfurás 15 | 680489-1739 | Samningur + reikningur 2026 |

Rétt fyrir neðan: Prennsýn, Hitt húsið, Sætoppur (5 skýrslur!), Geco, Gullsmári & Norðurturninn (bæði **Eignaumsjónar-regnhlíf** — tapið smitar). Auk þess ~20 félög með samning en engin dagsett skjöl (Vibrant Hostel o.fl.).

## 5. Það sem fannst EKKI + gölluð gögn

- **Rukkuð 2026 en skýrsla finnst hvergi (né eldri):** Bríetartún 9-11, EA Law, Fagkaup, Garðabær, Hamraborg ehf, Sóleyjarhlíð 1, LAG-Lögmenn, Rafgeymasalan, Snyrtistofan Gyðjan, Stálskip, Versa, Bílaverk (síðast 2024), Þangbakki 8-10, Lyngás 1a-d.
- **Ekkert fannst neins staðar:** Ingi Már Björnsson, KAT ehf., Rekagrandi 5, Nielsen sérverslun, RB Rúm, Sextett, Fótaaðgerðastofa Rvk, Arkbing, Hótel Atlantic, Hlíðablóm, Rentur Fagraberg 18, Kjarrhólmi 14, Dalshrauni/Flatahrauni 5b húsfélög. (Reising: engin skýrsla en netfang fannst.)
- **Junk-kt:** ~10 amber-raðir með `VANTAR-xxxx` staðgengils-kt; 5 leystust í nótt (sjá kafla 1), hinar standa. Galtarlind-kt á enga base-röð.
- **Misræmi/gildrur:** Nesdekk-skrá með ártalið mangað í „2079" (er 2025-skýrslan); Endurvinnslu-skrá vistuð í Orms&Víglundar möppu (288); Sjómannafélags-skrá undir rangri kt-möppu; **Hamraborg 28 (541281-1429) ≠ Hamraborg ehf (501285-0649) — ekki kross-tengja**; Gröfuþjónusta Stjána með 2026-skýrslu á heimilisfangi Rétt Máls (Hvaleyrarbraut 41) — sannreyna hvaða heimsókn það var.
- Aths.: ~117 bucket-skýrslur 2026 pössuðu ekkert markmið en eru þegar tengdar á kt-stigi — í lagi.

## Næstu skref

1. **uttekt-upload brú / handfærsla:** koma bucket-eingöngu 2026-skýrslunum (E Fasteignafélag, Bílabúð Benna, Miðleiti 2-6, Skaftahlíð 4-10, Laugavegi 42, Sveitahótelið Brú) í kanónísku Úttektarskýrslu-möppuna + `customer_documents`.
2. **Skýrslu-stöð:** staðfesta 5 junk-kt tengingarnar (Hress, Hörðukór, Háaleitisbraut, Kaplahraun 13, Hagvagnar) — setja rétta kt í Kt-samræmingu FYRST, svo tengja; leysa Galtarlind (stofna base) og Sjómannafélags-misræmið.
3. **Drive-flokkun/multitool sweep** á gömlu 2026-möppuna 1ZW55IrJ… (Aðalskoðunar-skýrslurnar o.fl. utan kanónísku möppu) og staging-möppuna 1tWlFq….
4. **Verkefnalisti:** stofna verk fyrir (a) Heimaleiga-pakkann (svara Dimku/Evu + bóka Dalbrekku/Urðarhvarf/Laugaveg 18), (b) Krókháls 9 tilboðið (sameina 4 beiðnir), (c) Engjasel 31 uppsetningu, (d) Greg Mortimer CO2 staðfestingu, (e) win-back #699.
5. **Klára drögin:** fara yfir 53 `drog`-sölur (byrja á Hagvagnar 102þ og ICS 47þ), eyða test-röðum (626/632, 0-kr).
6. **Merkja í þjónustu:** keyra `POST /api/service-gaps {action:'mark-service'}` á top-10 týndu kúnnana eftir yfirferð (byrja á ICS).
7. **Skrá netföngin 7 há-vissu** á base-raðirnar; sannreyna miðlungs-vissu 4 áður en notuð.