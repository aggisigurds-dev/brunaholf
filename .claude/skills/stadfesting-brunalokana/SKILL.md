---
name: stadfesting-brunalokana
description: >
  Býr til „Staðfesting brunalokana" (áður „Yfirlýsing vegna brunalokana"; staðfesting Brunahólfs ehf. til verkkaupa um að
  brunahólfun, eldvarnarhurðir og brunalokanir standist kröfur HMS) í Eyðublöð-flipanum
  (eydublod.html): hvaða reitir eru fylltir, hvað er sjálfvirkt, hvað má aldrei skálda, hvernig
  PDF og útgáfur vistast. Notaðu þegar Agnar segir „staðfesting brunalokana", „yfirlýsing vegna
  brunalokana", „staðfesting til verkkaupa", „búa til yfirlýsingu fyrir <stað>", „Keldur/Kringlan staðfesting",
  „yfirlýsing fyrir byggingar 3-5-7", eða biður um að breyta, endurútgefa eða laga þetta skjal.
---

# Staðfesting brunalokana

Skjal sem **Brunahólf ehf.** sendir verkkaupa að verki loknu. Það er stafrétt eftirmynd af
Word-frumritinu `Staðfesting_Keldur31072026.docx`, smíðað sem eyðublað í **Eyðublöð** (📝).
Allt er þegar til — þessi skill er **verklagið**, ekki ný smíði. Dýpri saga: agent `skjol`,
kaflinn „Eyðublöð — skjalasmiðja með útgáfusögu".

| Hvað | Hvar |
|---|---|
| Síðan | `eydublod.html` (`/eydublod.html?form=yfirlysing-brunalokana`), innfelld í flipann `eydublod` |
| Skilgreining | `FORMS[0]` (`id:'yfirlysing-brunalokana'`) — `defaults`, `autos`, `doc()`, `pdf()` |
| Endapunktur | `netlify/functions/eydublod.js` (`/api/eydublod`) |
| Geymsla | tafla `eydublod_skjol` + public fata `eydublod` |
| Myndir | `img/yfirlysing-logo.jpg` (merkið), `img/undirskrift-annthor.png` |
| PDF | `js/jspdf.umd.min.js` + `fonts/carlito-*.ttf` (vistað í repo, ekki CDN) |

## Reglur sem mega aldrei brotna

1. **Claude sendir aldrei skjalið og skrifar aldrei undir fyrir neinn.** Yfirlýsingin segir „Brunahólf
   ehf. lýsir yfir…" með undirskrift Annþórs Kristjáns Karlssonar (ábyrgðarmaður, leyfisnúmer
   202209-0174). Claude útbýr **drög og PDF** og afhendir Agnari — hann sendir.
2. **„Hvað var gert" má ekki skálda.** Þrjár sjálfgefnu línurnar (farið yfir brunahólfun, lagfæringar
   gerðar, eldvarnarhurðir yfirfarnar) eru staðlaður texti. Ef verkið var annað (t.d. aðeins göt
   þétt, engar hurðir) **spyrja Agnar eða strika línurnar út** — yfirlýsingin er skjal sem verkkaupi og
   yfirvöld lesa sem staðhæfingu. Sama gildir um niðurstöðusetninguna („…í samræmi við gildandi
   kröfur…"): hún á við **aðeins það sem Brunahólf náði til**.
3. **Útgáfur eru heilagar.** Vistun býr alltaf til NÝJA útgáfu (`skjal_id` helst, `utgafa` hækkar,
   hver útgáfa fær eigin storage-hlut). Eldri PDF er mögulega farinn til verkkaupa — **aldrei**
   skrifa yfir hann og aldrei `delete` útgáfu nema Agnar biðji um það.
4. **Prófa í gegnum viðmótið.** Staðfesta að skjalið sé rétt með því að opna eyðublaðið og skoða
   forskoðun/PDF — ekki með API-kalli (sjá minni *Prófa í gegnum viðmótið*).
5. **Dagsetningar:** birt `DD/MM/YYYY` (`fmtDate`), geymt `YYYY-MM-DD`. Skráarnafn má ekki innihalda `/`
   — `skra()` býr til `Stadfesting_<Staður>_<dd/mm/yyyy>`; ef nafnið á að fara á Drive eða disk, skipta
   `/` út (t.d. `-`) í því nafni.

## Skrefin

1. **Safna upplýsingum** (spyrja aðeins um það sem vantar):
   - **Staður / fyrirsögn** — t.d. „Rekstrarfélag Kringlunnar, Útisvæði – Kúmen 07-009-222". Gult svæði.
   - **Dagsetning** — sjálfgefið í dag.
   - **Byggingar** — t.d. „3-5-7" (aðeins ef verkið er númeraðar byggingar; annars tómt).
   - **Sveitarfélag** (eignarfall) fyrir „teikningar af vef …" — sjálfgefið Reykjavíkurborgar; listi í
     `SVEITARFELOG` (Kópavogsbæjar, Hafnarfjarðarbæjar, Garðabæjar, Mosfellsbæjar …).
   - **Frávik í texta** — hvað var raunverulega gert (regla 2).
2. **Opna eyðublaðið** í Browser-spjaldinu/Chrome á `brunaholf.netlify.app/eydublod.html?form=yfirlysing-brunalokana`
   (eða localhost). Hliðarstikan: *Verkið* (dagsetning, byggingar, sveitarfélag), *Útlit* (línubil),
   *Undirritun*. Allur annar texti er skrifaður **beint ofan í skjalið** (`contenteditable`).
3. **Fylla**: `stadur` (gula fyrirsögnin), dagsetning, byggingar, sveitarfélag. Tvær setningar skrifa sig
   sjálfar út frá byggingunum — **„Um ræðir…"** og **niðurstaðan** — og hætta því um leið og skrifað er
   ofan í þær. Vanti byggingarnúmer er efnið sótt í fyrirsögnina á eftir fyrsta kommunni.
4. **Útlit**: línubil sjálfgefið 1,5 (frumritið 1,15). „📄 Passa á eina síðu" finnur stærsta bilið sem
   heldur skjalinu á einni síðu. Gulu „breytileg svæði" eru aðeins á skjánum, prentast aldrei.
5. **Undirskrift**: undirskrift Annþórs úr frumritinu er sjálfgefin. Breyta aðeins ef Agnar segir að
   annar skrifi undir.
6. **Vista í skjalasafn** → vektor-PDF (A4, Carlito = Calibri-mál, leitanlegur texti) fer á
   `/api/eydublod` með reitagildunum (`gogn`). Nýtt skjal = útgáfa 1; opna vistað skjal og vista aftur =
   næsta útgáfa.
7. **Afhenda**: segja Agnari hvar PDF-inn er (`public_url`) og hvað var fyllt — hann sendir verkkaupa.

## Fastur texti (breytist ekki nema Agnar ákveði)

- Haus: **BRUNAHÓLF EHF.** · „Staðfesting brunalokana" (breytt úr „Yfirlýsing vegna Brunalokana" 20.10.2026; eldri vistuð skjöl bera gamla hausinn í `gogn`) · Leyfisnúmer 202209-0174 · Ábyrgðarmaður:
  Annþór Kristján Karlsson.
- Inngangur: „Brunahólf ehf. lýsir yfir að öll vinna og efni standist kröfur og reglugerðir samkvæmt
  leiðbeiningum Húsnæðis- og mannvirkjastofnunar (HMS)…".
- Kaflar: *Hvað var gert* · *Framkvæmd og gæðaviðmið* · *Lög og reglugerðir sem unnið er eftir*
  (75/2000, 160/2010, 1067/2011, 112/2012) · *Eftirlit og gæðaeftirlit*.
- Lokakveðja: „Með fyrirfram þökk…" · „Með kveðju," · „FH. Brunahólf ehf." · nafn · undirskrift.

Lagatilvísanir eða kröfur sem breytast (t.d. nýtt ákvæði í byggingarreglugerð) eru breyting á
`defaults` í `FORMS[0]` — **ekki** einstakt skjal. Spyrja Agnar áður.

## Ef þarf að breyta eyðublaðinu sjálfu

- Breytingar fara í `eydublod.html`. **Bumpa `UTGAFA`** (nú `'2026-10-20.2'`) við hverja breytingu —
  hún birtist í hausnum og er eina leiðin til að sjá strax hvort vafrinn situr á gömlu eintaki.
- `doc()` (skjár) og `pdf()` (PDF) verða að breytast **saman** — annars víkur PDF-ið frá forskoðun.
- Línubil á einum stað (`--lh` í CSS og `LH` í PDF lesa sama gildi) — ekki hardkóða.
- Kveðjublokkin er ein heild (`P.need`) svo undirskrift slitni ekki frá nafni yfir á næstu síðu.
- Skipti á leturskrám: staðfesta bold/italic með `TTFont(p)['name'].getDebugName(4)` — Google Fonts
  skilar þeim í röðinni *italic, bold-italic, regular, bold*.
- Myndirnar tvær eru sóttanlegar opinberlega (`publish = "."`) — sjá „Open work" í agent `skjol`.
- Útlit/hönnun PDF: skill `bh-pdf` á við um Efnislista/Tímaskýrslu í index.html; þetta skjal er
  sjálfstætt (Carlito, ekki Playfair) og **á að líkja eftir Word-frumritinu**.
- Birting: `[deploy]` í commit-skilaboðum (15 krítur/deploy), annars birtist ekkert.

## Ajour-gögn og myndayfirlit fyrir verkið (20.10.2026, Sunnukriki 3)

Staðfestingin sjálf er mestmegnis staðlaður texti. Það sem Ajour bætir við er **hvað var gert** (fjöldi
og tegund) og **myndayfirlit** sem fylgir oft með til verkkaupa.

1. **Finna verkið:** `GET /api/reporting/legacy/GetAllProjects` með kökunum úr `luna-bridge/ajour-state.json`
   (venjulegt Node-fetch, enginn vafri). Verkefnaheiti geta verið misrituð — „Sunnukriki 3 Morfellsbær".
   Talning og flokkar: `POST …/GetReportData` með `model[projectIds][]=<pid>` (sjá minni `project-ajour-api`).
2. **Sækja skráningar + ljósmyndir (aðeins lestur):**
   `AJOUR_EXPORT_DIR=<mappa> node luna-bridge/ajour-export-allt.js --project <heiti> --no-pdf`
   → `<mappa>/<verk>/skraningar.json` + `myndir/*.jpg` (841×1496, `scaled/print`). Sunnukriki 3: 9 skráningar,
   18 myndir (7 göt, 2 línuþéttingar, allt „Done" 19.10.2026).
3. **Ajour-skýrslan sjálf** (Print í AjourInspect & QA, flipinn *Detailed*): **8 Images per page**, **Show
   comments af**, *Show only checked* eða *Show all* eftir því hvað Agnar vill. Búin til með Claude in
   Chrome á `…/construction` (innskráður Chrome): Print → stilla → Print → tilkynning „Your report is ready" →
   `GET /api/reporting/download/<id>` (kökurnar duga). ⚠️ Ajour-skýrslan er ein síða á hverja **skráningu**
   (18–19 síður fyrir 9 skráningar) — „8 myndir á síðu" þéttir aðeins innan skráningar með margar myndir.
4. **Eigið yfirlit, 8 myndir á síðu án athugasemda:** `node ajour-myndayfirlit.cjs <exportMappa-verks> "<titill>" <út.pdf>`
   (skriptan er í þessari skill-möppu; jsPDF + Carlito úr brunaholf-repóinu). A4 langsnið, 4×2, aðeins
   `#nr` + flokkur undir hverri mynd, engin komment. Sunnukriki 3 = 3 síður. Staðfest sjónrænt í vafra.
5. **Staðfestingin sjálf** án vistunar: ræsa `brunaholf-proxy` (skrif hafnað), setja gildi í eyðublaðið
   (`values.stadur`, `values.sveitarfelag`, `autoOn.umraedir=false` + eigin setning þegar verkið er eitt
   heimilisfang, ekki númeraðar byggingar), `passaEinaSidu()`, `buildPdf()` og senda blobbið á
   staðbundinn móttakara. Vistun í lifandi skjalasafn aðeins þegar Agnar biður um það.

**Verk sem eru aðeins brunaþéttingar (göt/línuþéttingar), engar hurðir** (Agnar 20.10, Sunnukriki 3):
staðlaða textinn talar mest um eldvarnarhurðir. Taka út þriðju „Hvað var gert"-línuna („Farið var yfir allar
eldvarnarhurðir…", `values.hvadVarGert` = fyrstu tvær línurnar) og orðið „eldvarnarhurðir" úr niðurstöðunni
(„brunahólfun í <stað> sé í samræmi…"). Aðeins í því skjali, ekki í `defaults`.
Sunnukriki 3 (Agnar 20.10: „brunaþéttingar meðfram leiðslum og lögnum og brunahólfun") fékk í staðinn línuna
„Brunaþéttingar voru gerðar meðfram leiðslum og lögnum þar sem þær fara í gegnum brunahólfandi byggingarhluta."
og niðurstöðuna „…að brunahólfun og brunaþéttingar meðfram leiðslum og lögnum í <stað> séu í samræmi…".
Orðalagið er mitt, byggt á lýsingu Agnars — hann yfirfer það áður en skjalið fer út.

Dæmi um „eitt heimilisfang": `Sunnukriki 3, Mosfellsbær` · sveitarfélag `Mosfellsbæjar` · „Um ræðir húsnæðið
í Sunnukrika 3 samkvæmt teikningum af vef Mosfellsbæjar." (þágufall: Sunnukriki → Sunnukrika).

## Gildrur

- Gulu svæðin eru nákvæmlega þau sem Agnar strikaði á fyrirmyndinni — bæta ekki við fleiri án þess að spyrja.
- Þrjár „Hvað var gert"-línurnar eru á 11 pt (grunnletrið) í frumritinu, ekki 12 pt. Það er viljandi.
- A4, ekki US Letter (frumritið var Letter). Spássía áfram 1 in.
- Orðið er **brunalokun** (þétting gats/brunahólfunar), ekki „brunaloka" (damper) — fyrirsögn skjalsins
  er „Staðfesting brunalokana". Sama orð og í Heklureits- og Gata-verðskránni (`Brunalokanir á stærðum Ø…`).
