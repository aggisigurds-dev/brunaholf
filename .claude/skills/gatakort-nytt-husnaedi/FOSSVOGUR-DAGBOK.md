# Fossvogur — dagbók gatakortsins (Borgarspítalinn Fossvogi)

Snið eins og `NLSH-DAGBOK.md`: tól, tala, dagsetning, orð Agnars. Eigandi: agentinn `gatakort` (Jackie Chan).
Hver tala er mæld (með hverju) eða merkt ÓMÆLT.

## 25.11.2026 — Verkið stofnað og átta hæðir settar upp

**Beiðni Agnars (orðrétt):** „Geturdu kallad i jackie chan og sett upp nytt verkefni i ajour apex undir borgarspitalinn
fossvogi. Og sett þessar teikningar upp pusla þeim saman i eitt bord“ — og átta PDF-skrár, ein á hæð (0.–7. hæð).

### Hvað skrárnar eru (mælt með `pdfinfo`, `pdfimages -list`, `pdftotext`, skoðað með Read)
- Átta A3-síður (1190,55 × 841,89 pt), ein síða í hverri skrá, Producer pypdf.
- Þetta eru **glærur 1–8 af 10** úr kynningu: fótur hverrar segir „Fossvogur · Háaleitisbraut 175 · Frumteikning 28.05.2021 ·
  Glæra N · PDF bls. …“ og „<n> merkingar · N/10“. **Glærur 9–10 voru ekki sendar.**
- Hver síða hefur EINA innfellda rastamynd (enginn vektor í teikningunni sjálfri): 0H 1942×1711, 1H 2198×1824, 2H 1898×1937,
  3H 1795×1888, 4H 1678×1341, 5H 1672×1335, 6H 1672×1335, 7H 1652×1336 px.
- **Lituð merki (rautt, gult, blátt) eru brennd inn í rastann**, ekki sér lag. Skýringin á litunum er ekki í skránum sem bárust.
- Fótur 1H segir „PDF bls. 2–3“, 3H „bls. 5–7“, 6H „bls. 10–11“: það bendir til að þessar hæðir séu samsettar úr fleiri frumblöðum í
  kynningunni. Hvort svo er og hvar samskeytin liggja er ÓMÆLT (samskeyti sjást ekki sem aðskildir bútar). Glærurnar nefna tvær athugasemdir á teikningum (4H ólituð hurð, 7H lokun 60 mínútna hurðar) sem eru
  EKKI skráðar niðurstöður skoðunar.

### Hvað var gert (gagnagrunnur `osfdzskyvisifcwyjkuk`)
| Hvað | Hvernig | Niðurstaða |
|---|---|---|
| Verk | `insert into skr_verk` | **id 9**, „Borgarspítalinn Fossvogi · gatakort“, `ajour_nafn` NULL, `verkkaupi` NULL, heimilisfang „Fossvogur, Háaleitisbraut 175“ (úr fæti glæranna) |
| Myndir | Rastinn dreginn óbreyttur úr PDF (`pdfimages -png`), vistaður sem JPEG q95 4:4:4, sendur í fötuna `skraning` á `verk/9/yfirlit-<n>h.jpg` | 8 skrár; sóttar aftur af opinberri slóð og sha256 borið saman: 8 af 8 eins |
| Teikningar | `insert into skr_teikningar`, `tegund = 'yfirlit'`, `haed` 0H–7H, heiti „Brunayfirlit <n>H (Frumteikning 28.05.2021 · glæra N)“, `rod` 1 (7H) … 8 (0H) | `skr_teikningar` 18 → 26 (verk 9: 8, verk 4: 16 óbreytt) |

Heitið byrjar á „Brunayfirlit <haed>“ svo tólin finni blöðin; innihaldið er þó frumteikning með merkjum, ekki brunayfirlit með
rauðum EI-veggjum. `vorpun`, `yfirlit_id`, `deildir`, `flisar` og `skurdur` eru NULL (ekkert af því á við enn).

### Uppgjör ósnert (talið fyrir og eftir)
`skr_yfirlit` 36.979 → 36.979 · `skr_hub_skraningar` 36.979 → 36.979 · `skr_skraningar` 11.265 → 11.265 · `skr_verk` 3 → 4.
Engin skráning er í verki 9 (0 skráningar á kortinu).

### Prófað
Playwright, öll skrif stöðvuð (0 skrif náðu í gegn): `https://kjarni.vercel.app/kjarni/skraning/kort?verk=9` opnast, sýnir
„Borgarspítalinn Fossvogi · gatakort“, átta hæðartakka (7H … 0H), og 7H, 0H og 3H hlaðast úr fötunni (HTTP 200). Eina console-villan
(404 á `/_vercel/insights/script.js`) er eins á NLSH-verkinu (verk 4). Ekki prófað á síma Agnars; aðrar hæðir en 0H, 3H og 7H ekki
opnaðar í vafra (en allar átta skrárnar sóttar af opinberri slóð).

### Sjálfvirku tólin eru EKKI keyrð — og mega það ekki óbreytt
- `-veggir.py` greinir rauða EI-veggi (R > 190, G og B < 100): á þessum myndum eru rauð MERKI, ekki veggir. Útkoman yrði röng.
- Teikningarnar eru rastar (skönnun/mynd), ekki vektor: verkferlið (skref 1) segir STOPP fyrir slíkt yfirlitsblað.
- Deildamörk (17,9 % · 50 % · 81,2 %) og hlutamörk eru NLSH-föst í kóða á fjórum stöðum; `deildir` er því NULL hér.
- Engin áætlun (útboðsmagn eða talning) er til, svo stöðuskýrslan getur aðeins sýnt talningu, ekki prósentu.

### Merkin talin (Jackie Chan, svo endurmælt af aðallotunni)
Litirnir eru þrír flatir RGB-litir sem mældust á öllum átta myndum: rautt (255,0,0), gult (255,192,0), blátt (0,176,240).
Hvert merki er 10 px þykk stöng, 16–43 px löng. **Rauða merkið er máluð stöng, ekki EI-veggur.**

| Hæð | rautt | gult | blátt | alls | á glæru |
|---|---|---|---|---|---|
| 0 | 11 | 8 | 7 | 26 | 26 |
| 1 | 7 | 24 | 6 | 37 | 37 |
| 2 | 5 | 24 | 3 | 32 | 32 |
| 3 | 3 | 22 | 1 | 26 | 26 |
| 4 | 2 | 10 | 0 | 12 | 12 |
| 5 | 3 | 9 | 1 | 13 | 13 |
| 6 | 2 | 15 | 1 | 18 | 18 |
| 7 | 4 | 13 | 0 | 17 | 17 |
| **Alls** | **37** | **125** | **19** | **181** | **181** |

- **Aðferð:** tengdir fletir (8-tenging), litasía ≤ 12 í RGB-fjarlægð, fletir ≥ 100 px. Mælt tvisvar óháð (Jackie með eigin kóða, aðallota
  með öðrum kóða): báðar fá 180 flöt, 181 með einni skiptingu. Glærurnar gefa aðeins heildartölu á hæð, ekki tölu á lit.
- **Skiptingin:** á 2. hæð er einn gulur flötur við (1369–1402, 400–436) sem er tvær stangir sem mætast í horni (lóðrétt x 1393–1402,
  lárétt y 427–436). Talinn sem tvö merki; án þess væru 31 á 2. hæð og 180 alls, ósammála glærunni. Rúmfræðin sker ekki úr um að þetta séu
  tvö merki, aðeins að tvær stangir passi pixil fyrir pixil.
- **Örfletir:** 16 gulir fletir undir 100 px á 4. hæð (þunnar 1 px línur við (830–955, 300–390)) eru EKKI taldir; ekki heldur tveir
  pínulitlir rauðir deplar á 7. hæð við (930,1210) og (899,1218). Hvort þetta eru athugasemdirnar sem glærutextinn nefnir er ómælt.
- Hnit allra 181 merkja (px hverrar myndar) eru í `merki-hnit.csv` í vinnumöppu lotunnar, EKKI í þessu repói. Skráð sem skráningar eða
  áætluð göt hafa merkin ekki verið; það myndi tvítelja þau á kortinu því þau eru þegar brennd í myndina.

### Aðskildir bútar á blöðunum (hnit í px á frummynd; ekkert skorið eða fært)
- **0. hæð:** neðri bútur x 593–798, y 1548–1675 (um 108 px frá aðalteikningu), með 2 rauð merki.
- **1. hæð:** þrír bútar til hægri og í miðju. Efri hægri x ≈ 1614–2148, y ≈ 776–944 (1 gult), neðri hægri x ≈ 1614–2148,
  y ≈ 952–1137 (1 gult, 1 blátt), miðbútur x ≈ 1100–1561, y ≈ 861–1038 (1 rautt, 1 gult; fínar línur tengja hann við aðalteikninguna).
  Titlar bútanna, lesnir úr 6× stækkun hráu myndarinnar (stafahæð ~9 px): efri „GRUNNMYND 3. HÆÐAR“, neðri „GRUNNMYND 2. HÆÐAR“,
  miðbútur tölustafur ólæsilegur. **Bútarnir bera því önnur hæðarheiti en blaðið; hvort þeir tilheyra 1. hæð er ómælt.** 5 af 37
  merkjum 1. hæðar liggja á þeim.
- 2.–7. hæð: einn búkur, engir aðskildir bútar.

### Borðið
`fossvogur-bord.png` (7000 × 3730 px): allar átta hæðirnar í einni mynd, 0.–3. hæð efri röð, 4.–7. hæð neðri. Hver hæð skölluð til að
passa í sinn reit (0H ×0,875, 1H ×0,773, 2H ×0,878, 3H ×0,900, 4H–7H ×1,000), engin stækkuð. **Ekki í sameiginlegum kvarða**; hver hæð er
sín eigin rastamynd (135–196 ppi) og engin sameiginleg hnit eru til. Aðeins til að skoða; grunnmyndir verksins eru óskölluðu myndirnar
í gagnagrunninum. Prófað: 4H–7H á borðinu eru pixil fyrir pixil eins og frummyndirnar. Ekki prófað á síma.

## Opið / ómælt
- Merkin: hvað rautt, gult og blátt þýðir (líklega á glærum 9–10), hvort þau eigi að verða skráningar eða áætluð göt.
- Verkkaupi, og hvort þetta verður verk í Ajour (þá verður `ajour_nafn` sett — aðeins eftir að uppgjör er skoðað).
- Hvort teikningarnar megi liggja í opnu fötunni `skraning` (hún er lesanleg án innskráningar; NLSH-teikningar liggja þar líka).
