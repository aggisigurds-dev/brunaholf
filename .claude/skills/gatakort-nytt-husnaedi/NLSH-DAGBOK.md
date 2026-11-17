# NLSH-dagbók gatakortsins (meðferðarkjarni, 4.–6. hæð) — verk 4

> Fylgiskjal skillsins `gatakort-nytt-husnaedi` og agentsins `gatakort` (Jackie Chan 🥋). Hér er ALLT sem var gert, mælt og úrskurðað
> á NLSH 11.–14.11.2026, í tímaröð innan kafla: tól, tölur, gildrur og orð Agnars. Þetta er fyrirmyndin þegar nýtt húsnæði er kortlagt.
> Flutt óbreytt úr `kjarni/.claude/agents/skraning.md` 14.11.2026. Nýjar færslur um gatakort og stöðuskýrslu fara HINGAÐ, ekki í skraning.md.
> Slóðir sem byrja á `tools/` eða `apps/` eru í Kjarna (vinnutré `C:\Users\Slokkvitaeki\kjarni-skrkort`, tólin í `apps/slokkvitaeki/tools/`).
> Tölur eru mældar á dagsetningunni sem stendur við þær; mældu aftur áður en þú fullyrðir um stöðuna í dag.

**Leit:** kaflarnir byrja á `## `. Helstu: Gatakort · Rafmagn á sérteikningum · Hæðarhnit · Endurstilling teikninga · Sjálfvirk færsla ·
Færðir punktar · Tillögur · Símaviðmót · Stöðuskýrsla.

## Gatakort (11.11.2026) — `/kjarni/skraning/kort`
- **Hvað:** allar NLSH-skráningar (11.206) á brunayfirlitsblöðum 6H/5H/4H (A286-31 / A285-31 Rev.A, rauðir brunaveggir) eða á
  stakri Ajour-teikningu; tákn eftir tegund og stærð; síur: staða, deild, tegund, starfsmaður, tímabil, lagfæringar, tvítök;
  lög (`skr_log`: fagteikningar sem myndir með vörpun og gegnsæi) og áætluð göt (`skr_aaetlud`). Skráningum er ekki breytt þar.
- **Gögnin:** `skr_verk` id 4 „NLSH 5-6. hæð · gatakort" með **`ajour_nafn = NULL`**. Þess vegna heldur `skr_yfirlit` áfram
  að lesa NLSH úr `ajour_registrations` og uppgjör hubsins er óbreytt (sannreynt 11.11: nlsh-uppgjor, nlsh-dashboard og
  gata-uppgjor skiluðu sama JSON fyrir og eftir). Greiningarverkið birtist í `skr_yfirlit`/`skr_maelabord` undir eigin heiti,
  svo NLSH telst þar tvisvar (Ajour + gatakort) — Kjarna-yfirlitin eru ekki notuð í uppgjör.
- **Endurnýjun:** `node luna-bridge/ajour-export-allt.js --project NLSH --no-photos` → `node apps/slokkvitaeki/tools/skraning-gatakort-innflutningur.cjs`
  (DRY) → `--write`. Endurkeyranlegt (upsert á `ajour_registration_id`). Greiningin í `ajour_gogn`: deild, svaedi, lagf (A/B/?),
  a_stad, tvitak_af. Sama RULES/TRANS/CROP og `brunaholf/tools/nlsh-stukur.cjs` — breyta á báðum stöðum.
- **Gildrur:** (1) `5H. Ceiling` er heilt hæðarblað með fjórum deildum, ekki S1+S2. (2) Ajour á tvær skráningar með raðnúmer
  5786 — sú yngri fær `radnr` 1005786, rétta númerið er í `ajour_serial`. (3) Ljósmyndir eru EKKI fluttar inn; `ajour_gogn.myndir`
  geymir Ajour-fileId. (4) 466 skráningar eru án teikningar og sjást ekki á korti.
- **Lög (11.11.2026):** sex fagblöð úr Procore eru komin í `skr_log` — vatnsúðakerfi (M395/M396, fag `sprinkler`), þrifa-, hita- og
  kælikerfi (M195/M196, `vatn`) og lyfjaloft (M795/M796, `gas`) á 5H (teikning 5) og 6H (teikning 4). Ferlið: PDF úr Procore →
  `tools/skraning-gatakort-stilla.py` (hliðrun með FFT-fylgni við brunayfirlitið; `-kvardi.py` ef kvarðinn er annar) →
  `tools/skraning-gatakort-lagmynd.py` (gegnsæ PNG í hnitum grunnmyndar, vörpun 1:1) → `tools/skraning-gatakort-log.cjs --write`.
  Mæld afstilling er í haus `-log.cjs` og í `skr_log.uppruni`. **Gildra:** blöðin eru öll A1 en húsið situr EKKI á sama stað á
  blaðinu (hliðrun 10–90 pt) og M396 er teiknað 10 % minna (q = 1,1) — aldrei leggja fagblað beint yfir án mælingar.
  PDF-skrárnar: `Documents\NLSH\procore-yfirlit`. Raflagnaleiðir (R1150/R1160) eru ókomnar.
- **Loftræsing (11.11.2026):** engin yfirlitsmynd er til, aðeins 36 hlutablöð í 1:50 (M215-01…20 á 5H; M216-01…08 og 13…20 á 6H,
  S3 er aðeins á 5H). Hvert blað er stillt af eftir ásamerkjum (A–X, 1–13) með `tools/skraning-gatakort-asar.py` (q = 0,2, frávik
  ≤ 0,06 pt) og skeytt í eitt lag á hæð með `tools/skraning-gatakort-skeyta.py`; lagið geymir aðeins fyllta stokka (gráar fyllingar
  180/200 dökkir, 214–215/230 ljósir — útveggjafylling er 211–212 og má ekki slæðast með). Fag `loftraesting`, `skr_log.uppruni`
  byrjar á `Procore M215 ` / `Procore M216 `. PDF-skrárnar og `skra.json` (útgáfa hvers blaðs): `Documents\NLSH\procore-loftraesing`.
- **Vatnslagnir í lit og raflagnaleiðir (11.11.2026):** hlutablöð M115/M116 (litkóðuð: rautt, blátt, brúnt, grænt) og R1150/R1160
  (bakkar sem svartar línur) eru komin sem lög (`vatn` „Vatnslagnir í lit", `rafmagn` „Raflagnaleiðir"), falin sjálfgefið.
  M-blöðin stillast af eftir ásamerkjum; R-blöðin hafa ENGIN ásamerki og eru borin saman við loftræsiblað sama hlutanúmers með
  `tools/skraning-gatakort-fylgni.py`. Samskeyting: `tools/skraning-gatakort-skeyta-lit.py litur|dokkt`. PDF: `Documents\NLSH\procore-hlutablod`.
- **Áætluð göt úr Miro (11.11.2026):** 55 rafmagnsraufar á 6H S2 (grænir tíglar í rammanum „6H2S Rafmagnsraufar", borð
  `uXjVJ1jKBnY=`) eru í `skr_aaetlud` (fag `rafmagn`, fjoldi 2 = báðar hliðar, `uppruni` = `miro:<borð>:<id>`). Ferlið:
  `canvas_read_as_svg` → `tools/skraning-gatakort-miro-lesa.cjs` (dregur SVG úr lotuskrá) → `-miro-varpa.cjs` (borðhnit →
  grunnmynd; hver 6H2S-rammi er fjórar flísar, skráðar með `-miro-skra.py`, niðurstaðan í `-miro-6h2s-skra.json`: s = 1,602) →
  `-miro-festa.py` (festir merki við skurðpunkt lags og rauðs brunaveggs, annars lags og vegglínu, innan 45 px ≈ 1,3 m; Agnar
  leyfði 11.11 að færa merkin því þau voru sett ónákvæmt í síma) → `tools/skraning-gatakort-aaetlud.cjs --write`.
  Útkoma: 26 fest á brunavegg, 18 á vegglínu, 11 ófest. **Gildrur:** Miro-myndirnar eru af ELDRI útgáfu brunayfirlitsins — margir
  gangveggir (E30-S) eru ekki rauðir á Rev.A. 361 af 717 rafmagnsskráningum eru á blöðum sem varpast ekki á yfirlitið
  (`6H 2S-1S Rafmagnsþéttingar.jpg` o.fl.) og koma ekki fram í samanburði.
- **Allir Miro-rammar 6. hæðar komnir inn (11.11.2026): 744 áætluð göt á teikningu 4.** 6H2S: rafmagnsraufar 55, loftræsing 159
  (þar af 27 kantaðir stokkar → flokkur 41), sprinkler 83, vatnslagnir 154, regnvatn 28. 6H1S: loftræsing 131, vatnslagnir 134
  (engir rammar til fyrir 6H1S rafmagn/sprinkler/regnvatn). Flokkun í `tools/skraning-gatakort-miro-flokka.cjs`: `fjoldi` = stök verk
  (2 per gegnumtak; vatnsský með tölunni n = n lagnir = 2·n — stemmir við yfirlitstöflu rammans: gólfhiti 136, neysluvatn Ø40-50 104,
  plast 76). Litir vatnsskýja (úr skýringatöflu 6H2S): ljósblátt = neysluvatn Ø15-35, dökkrautt = gólfhiti Ø15-35, appelsínugult =
  ofnakerfi Ø40-50, dökkblátt = neysluvatn Ø40-50, gul ör „2pl hvitt" = plast Ø20-34; á 6H1S er rautt (#ff6464) TÚLKAÐ sem gólfhiti
  (engin skýringatafla þar — óstaðfest). 6H1S-rammar voru stilltir af ÁN skjámyndar með `-miro-hough.py` (merki kjósa hliðrun á móti
  skurðpunktum lags og brunaveggja; báðar flísar loftræsirammans gáfu sömu hliðrun innan 3 px; s = 0,296 loft, 0,336 vatn).
  Stórir rammar: `canvas_read_as_svg` vistar svarið í `tool-results/*.txt` (undiragent kallar, aðallota les skrána); `image_get_data`
  skilar aðeins 46×120 px smámynd — ónothæft til afstillingar. Miro-talningin er margra mánaða gömul (fyrir baðherbergin).
- **Pörun áætlaðra gata við skráningar (11.11.2026):** `tools/skraning-gatakort-para.cjs --haed 6H [--write]` skrifar `skr_aaetlud.parad`
  ({ids, radnr, n, stada: fullt|hluti|vantar}); græðgisleg pörun eftir fjarlægð innan 60 px (≈ 1,8 m), fyrst sami flokkur, svo sami
  hópur (loft | rör | rafmagn), hver skráning aðeins við eitt gat. Útkoma 6H: 612 full, 62 að hluta, 70 án skráningar. Kortið litar
  merkin eftir stöðu og síar („Öll / Fullt / Vantar hluta / Engin skráning", „Aðeins skráningar sem parast ekki við áætlað gat").
  **Endurkeyra eftir hverja Ajour-sókn og eftir handbreytingar á merkjum** — `parad` uppfærist ekki sjálft. Ópöruð skráning er
  EKKI sönnun um tvítekningu: S1 hefur enga sprinkler-/regnvatns-/rafmagnsramma og Miro-talningin er eldri en baðherbergin.

- **Skarpar flísar (11.11.2026):** grunnmyndir og öll lög eiga flísar í 4× upplausn (12 px/pt, 12×6 flísar à 1930×1900) í
  `flisar`-dálki `skr_teikningar`/`skr_log`. Kortið hleður þeim aðeins þegar stækkað er inn (≥ 1,15 skjápixlar per grunnpixil),
  aðeins sýnilegar flísar, mest 24 í minni, og teiknar lag úr flísum aðeins þegar allar sýnilegar eru hlaðnar. Gerð:
  `tools/skraning-gatakort-flisar.py <stilling.json> <mappa>` (teiknar hverja flís beint úr PDF, ~1,5 mín per lag) →
  `tools/skraning-gatakort-flisar-upp.cjs <mappa> --write`. Nýtt lag eða ný útgáfa blaðs → búa til flísar aftur.
- **Stöðusía (11.11.2026):** Allt / Tilbúin (kláraðar skráningar) / Í vinnslu (ókláraðar skráningar + merki að hluta) / Eftir
  (áætluð göt án skráningar og handvirkir punktar, teiknaðir RAUÐIR). Stærðarsían (táknin) gildir líka um áætluð göt.

## Rafmagn á sérteikningum telst á deild og sést á yfirlitinu (11.11.2026)
- `6H 2S-1S Rafmagnsþéttingar.jpg` (teikning 11, 240 skráningar) og `5H1S OG 5H2S - Rafmagnsþéttingar.jpg` (teikning 14, 72) voru „án deildar“.
  Báðar sýna S1 vinstra megin (ásar A–D) og S2 hægra megin (F–I). Nú fá skráningarnar `ajour_gogn.haed/deild/svaedi` með SÖMU aðferð
  og önnur blöð (stærsta bilið í x skiptir í deildir; y-svið punkta blaðsins í N/C/S): 6H S1 117 (109 kláruð), S2 123 (121);
  5H S1 12, S2 60 (0 kláruð). Reglan er í `RULES` í `tools/skraning-gatakort-innflutningur.cjs` (DRY-keyrsla gaf sömu tölur og
  SQL-uppfærslan sem var keyrð 11.11). Heild skýrslunnar: 87 % (10.291 af 11.889); 6H 96 %.
- **Vörpun á yfirlit:** fundin með FFT-fylgni rauðra/bleikra brunaveggja (styrkur 0,54–0,66, sannreynt með yfirlögn). Teikning 14:
  a 0,4536, e −158, f −172. Teikning 11 er SAMSETT úr tveimur myndum (bilið milli álma ekki í kvarða): vinstri a 0,46475, e −58,
  f −40; hægri (x ≥ 2180) a 0,46775, e 194,3, f −50 → `vorpun.hlutar` (síðasti hluti með `fra_x` ≤ x ræður; `varpa()` í KortClient,
  sama í para-tólinu). `SER_VORPUN` í innflutningstólinu heldur þessu við endurinnflutning.
- Enn án deildar: `NLSH - Viðbótarverkefni` (aukaverk, 85) og skráningar án teikningar (466). `6H4S`/`6H5S` (9) hafa deild en eru ekki á yfirliti.
- Hub-síðan (`brunaholf/tools/nlsh-stukur.cjs`) hefur EKKI þessar reglur enn — þar er rafmagn sérteikninga áfram „utan deilda“.

## Hæðarhnit: hver punktur með eigin hnit á hæðinni (11.11.2026) — sýnin `skr_haedarhnit`
- Agnar: „hver punktur verði í raun sjálfstæður, fær sín hnit miðað við alla hæðina“. Sýnin gefur fyrir hverja skráningu `yfirlit_id`, `haed`,
  `x_px`/`y_px` á yfirlitsblaðinu (vörpun teikningar með hlutum; færður punktur ræður), `faerdur`, og `deild`/`hluti` reiknað úr
  STÖÐUNNI (x < 17,9 % S1, < 50 % S2, < 81,2 % S4, annars S5; y < 28,8 % N, < 71,16 % C, annars S).
- Mælt 11.11: 10.646 af 10.740 skráningum með pinna hafa hæðarhnit (vantar: Viðbótarverkefni 85, 6H4S 4, 6H5S 5). Deild úr stöðu =
  `ajour_gogn.deild` í ÖLLUM tilvikum; hluti víkur í 35 (0,3 %) við mörkin. Skýrslan og kortið nota enn `ajour_gogn` — skipta má yfir á
  sýnina ef færðir punktar eiga að flytjast milli hluta.
- Upplausn: hnitin eru í pixlum yfirlitsins (5790 × 2850, 1 px ≈ 29 mm) með einum aukastaf (≈ 3 mm); skörpu flísarnar (12 px/pt) eru
  aðeins fyrir myndina. Hærri upplausn á hæðinni þarf því ekki vegna hnitanna.

## Endurstilling teikninga og talning eftir stöðu (11.11.2026, Agnar: „eins nákvæmt og hægt er“)
- **Talning eftir stöðu:** kortið (`deildAf`, `Punktur.d`) og stöðuskýrslan (les `skr_haedarhnit`) telja deild eftir STÖÐU punktsins á
  yfirlitsblaðinu; `ajour_gogn.deild` er aðeins varaleið fyrir punkta sem eru ekki á yfirliti. Færður punktur fylgir því nýja staðnum.
- **Mæling á vörpun** (`ser_stilla.py`/`allar_stilla.py` í lotumöppu: FFT-fylgni veggja per álmuhelming, borið við núverandi vörpun):
  6H.pdf, Brunayfirlit 6H og „5H. Ceiling“ sitja innan 0,03–0,19 m og voru látin vera. „5H 1S og 2S“ er samsett → sér vörpun per
  helming (færsla ≤ 0,11 m, fylgni 0,40 → 0,50). S4+S5-blöðin (4H og 5H): kvarði 0,9328 (færsla 0,07–0,14 m, fylgni 0,55 → 0,64).
- **„4H. S1-S2.jpg“ var RANGT stillt** (a 0,625; punktar allt að nokkrum metrum frá). Blaðið er SKÖNNUÐ 4. hæðar grunnmynd, snúin um
  0,31°, og veggjafylgni við 5H-yfirlitið virkar ekki (annað herbergjaskipulag). Ný vörpun úr þremur ásamótum sem eru eins á öllum
  hæðum, lesin af báðum myndum: A∩1 (532,5; 1155,8 → 68,5; 86,8), I∩13 (3431,8; 4900,7 → 2131,2; 2780,0), D∩13 (1538,8; 4910,8 →
  776,2; 2780,0) → full affín vörpun (a 0,71578, b 0,00382, c −0,00335, d 0,71621, e −308,78, f −743,03). `varpa()`, para-tólið og
  sýnin styðja nú b, c, d (sama röð og canvas.transform). Óháð athugun (fjarlægð í hreinlætistæki 5H): miðgildi 1,74 → 1,15 m.
- **„6H4S“ og „6H5S“** eru komin á yfirlit (fylgni 0,50): 10.655 af 10.740 skráningum með pinna hafa nú hæðarhnit.
- **Gildra:** FFT-hliðrun sem er stór og jákvæð (álma hægra megin) má ekki vefja við W/2 — vefja aðeins það sem er utan yfirlitsins.
- **Ógert:** „NLSH - Viðbótarverkefni“ (85) sýnir 6H efst og 5H neðst á sama blaði; þarf hluta eftir y með sitt yfirlit hvor.
  Hub-kortið (`brunaholf/tools/nlsh-stukur.cjs` TRANS) notar enn gömlu vörpunina fyrir 4H S1-S2.

## Sjálfvirk færsla skráninga á skurðpunkt lags og brunaveggjar (11.11.2026, Agnar: „já endilega“)
- **Tól:** `tools/skraning-gatakort-skr-festa.cjs --haed 6H|5H --yfirlit <mappa> --log <mappa> [--radius 45] [--write] [--afturkalla]`
  (kallar `-skr-festa.py`). Þurrkeyrsla nema `--write`. Þarf yfirlitsmyndirnar (5790 × 2850) og lagamyndirnar í sömu stærð
  (`lag-6h-<fag>-<blað>.png`) á diski. Hópar: Loft + Raufar → loftræsting; Stál + Plast → vatnslagnir, vatnsúði, lyfjaloft;
  Raf → raflagnaleiðir. Milliloft er ekki fært (göt í gólfi liggja ekki við vegg).
- **Regla:** skurðpunktur = klasi þar sem lag liggur innan 4 px frá RAUÐUM brunavegg; punktur fær næsta slíkan innan 45 px (1,35 m).
  Margir punktar mega eiga sama skurðpunkt. Finnist enginn: svört vegglína, en aðeins innan 20 px. Punkturinn lendir 4 px + 20 % af
  upphaflegri fjarlægð frá skurðpunktinum, SÍN megin við vegginn (mest 12 px), svo stök verk við sama gat leggist ekki saman.
- **Skrif:** `skr_faerslur` með `uppruni = sjalfvirkt` og `fra_x/fra_y` = vörpuð staða. Handvirkar færslur eru aldrei snertar;
  endurkeyrsla reiknar frá `fra_x/fra_y`. `--afturkalla --write` merkir allar sjálfvirkar færslur hæðar eytt.
- **Útkoma 11.11:** 6H 3.947 færðar af 5.510 (loft 1.008 af 1.200, rör 3.090 af 3.826, rafmagn 257 af 484); 5H 3.063 af 4.238.
  Miðgildi færslu 0,18–0,29 m (rafmagn 0,53–0,59 m), mest 0,96 m. Fjarlægð paraðra skráninga í áætlað gat: 6H miðgildi
  0,53 → 0,33 m (innan 0,3 m: 402 → 859 af 1.859), 5H 0,37 → 0,20 m (172 → 341 af 458). Deild breyttist hjá engri skráningu.
- **Eftir færslu:** keyra `-para.cjs --write` aftur (gert 11.11).

## Færðir punktar á gatakortinu (11.11.2026) — tafla `skr_faerslur`
- **Hvað:** hnappurinn „Færa punkta" (efst til hægri, aðeins á yfirlitsblöðum) kveikir á færsluham: bendill niður á sýndan punkt
  grípur hann (innan 14 skjápixla), dráttur færir, slepping vistar. Síur og lög gilda eins og venjulega, svo Agnar síar fyrst á
  flokk (t.d. Loft Ø400-630) og kveikir á réttu lagi. Dráttur á auðu svæði færir blaðið áfram.
- **Skráning:** nýja staðan fer í `skr_faerslur` (skraning_id, teikning_id = yfirlitsblaðið, x_px/y_px, fra_x/fra_y = vörpuð staða
  fyrir færslu, uppruni handvirkt | sjalfvirkt). `skr_skraningar` er ALDREI breytt — Ajour-hnitin standa og innflutningur
  yfirskrifar ekki færslur. Ein virk röð per skráningu og blað (einkvæmur vísir `where not eytt`); „Upprunaleg staða" í spjaldi
  punktsins merkir röðina `eytt`. Færður punktur sýnir bláa brotalínu frá skráðri stöðu meðan færsluhamur er á.
- **Áætlað gat:** dregið í sama ham; hnitin uppfærast beint í `skr_aaetlud` (þau eru á yfirlitsblaðinu). `parad` verður þá úrelt.
- **Pörun:** `tools/skraning-gatakort-para.cjs` notar færðu stöðuna. Keyra aftur eftir færslur.
- **Ekki til enn:** sjálfvirk færsla skráninga á skurðpunkt lags og brunaveggjar (sama aðferð og `-miro-festa.py` fyrir merki).

## Tillögur: stokkur í brunavegg án skráningar (13.11.2026) — `uppruni = 'tillaga:…'` í skr_aaetlud
- **Hvað:** `tools/skraning-gatakort-tillogur.cjs --haed 5H --vidmid 6H --yfirlit <mappa> --log <mappa> [--radius 30] [--write]` (+ `.py`, notar cv2).
  Finnur skurðklasa loftræsistokks og RAUÐS brunaveggjar (lag innan 4 px frá vegg; klasi lengri en 60 px = stokkur meðfram vegg, sleppt) sem eiga
  enga loftræstiskráningu innan 0,9 m á hæðinni, ÞÓTT sami staður (innan 25 px) á viðmiðunarhæðinni sé skráður. Þurrkeyrsla nema `--write`.
- **Mælt 13.11 (5H, viðmið 6H):** 377 klasar, 225 með skráningu, 152 án: sami staður á 6H skráður 73, líka óskráður á 6H 41 (ekki raunverulegt gat
  eða utan radíuss), enginn klasi á 6H 38. 2 áttu þegar áætlað gat → 71 tillaga (S1 5 · S2 4 · S4 15 · S5 47). Á 6H sjálfri eru 74 af 382 klösum án
  skráningar þótt hæðin sé 96 % kláruð: klasi einn og sér er EKKI sönnun um gat, þess vegna viðmiðunarhæðin.
- **Til samanburðar (sama dag):** loftræstiskráningar á 5H sitja vel á laginu eftir sjálfvirku færsluna: 89 % innan 6 px (0,18 m) frá stokk, 79 % innan
  6 px frá skurðpunkti stokks og rauðs veggjar (fyrir færslu 64 % innan 6 px frá stokk). 203 af 797 eru ófærðar; 158 þeirra standa samt á stokk.
- **Tillaga er EKKI áætlað gat:** stöðuskýrslan sleppir `uppruni like 'tillaga:%'` (SkyrslaClient), svo tölurnar til COWI breytast ekki. Á gatakortinu
  er tillaga appelsínugulur hringur með „?“ (gátreitur „Tillögur“ í Lög, talin í skýringarlínu símans). Spjaldið: „Já, eftir að þétta“ → uppruni verður
  `handvirkt` (rauður punktur, telst þá sem Eftir í skýrslunni) · „Nei, ekki gat“ → `eytt` (kemur ekki aftur við endurkeyrslu).
- **Aðrir lesendur skr_aaetlud:** `-para.cjs` parar tillögu við skráningu sem bætist við nálægt (þá hættir hún að birtast sem tillaga); `-vidbot-stutar`
  og `-aaetlud` snerta aðeins sinn uppruna.

## Símaviðmót gatakortsins (12.11.2026, Agnar: „í nokkuð góðu zoomi og góðu símaviðmóti“)
- **Hvenær:** `.gk.snerti` er sett þegar bendillinn er grófur (`pointer: coarse`) eða glugginn ≤ 860 px. Borðtölvusýnin er óbreytt (neðri stikan er `display: none`).
- **Uppsetning (≤ 860 px):** kortið fyllir skjáinn (`100dvh − 50px`), neðri stika `.gk-bar` (44 px hnappar): hæð 6H/5H/4H · stökk á deild S1/S2/S4/S5
  (`faraADeild`: 1.–99. hundraðshluti punkta deildarinnar) · „Sýn“ · Færa · ＋ Punktur · Lög og síur. Hliðarstikan er skúffa að neðan (`.gk.skuffa`).
  Blaðið opnast á hæðina (fyllir hæð, byrjar vestast); jafnstór blöð halda sýninni þegar skipt er um hæð.
- **Sýn eftir fagi (`SYNIR`, líka í hliðarstiku á borðtölvu):** Loftræsting / Úðakerfi / Vatn og lagnir / Rafmagn / Gólf. Ræður hvaða lög sjást og síar
  skráningar (táknhópur) og áætluð göt (fag). AÐEINS á skjánum: skrifar ekki `skr_log.synilegt` (gátreitir laga eru óvirkir á meðan).
- **4H fær lög 5H að láni:** yfirlitsblað án eigin laga með sömu `mynd_path` og annað yfirlit sýnir lög þess (`Lag.lan`), falin þar til kveikt er;
  kveikt/slökkt og gegnsæi gilda aðeins á skjánum.
- **Færa með fingri:** pikka FYRST á punkt (velur hann), draga hann svo (grip innan 44 px frá valda punktinum). Dráttur annars staðar færir blaðið —
  á þéttu korti gripi fingur annars punkt af slysni og skrifaði færslu. Stækkunargler (2,2×) birtist í horni fjær fingrinum meðan dregið er.
  Mús er óbreytt (grípur næsta punkt innan 14 px).
- **Rauður punktur með fingri:** „＋ Punktur“ sýnir krosshár á miðju korti og hnappinn „Setja rauðan punkt í krossinn“ (`setjaIKross`); pikk á kortið
  setur EKKI punkt á snertiskjá. Fag sjálfgefið úr sýninni (annars loftræsting), stök verk 2 (gólf 1). `uppruni = handvirkt`.
- **ATH skýrslan:** handsettur rauður punktur (óparað áætlað gat) telst strax sem „Eftir (áætlað og óskráð)“ í stöðuskýrslunni (`hkEftir`) og sést á
  hæðarkorti hennar; á 4H með fag `golf` hækkar hann líka áætlunina (`vidbot4`). Stendur í setja-spjaldinu í símanum.
- **Gildrur:** (1) hausinn `.aj-top` var breiðari en síminn → útlitsglugginn varð 694 px og fastsett skúffa lenti neðan við skjá; á gatakortssíðunni
  skrunar valmyndin nú lárétt (`.aj:has(> .gk)`). (2) Sími: mest 24 skarpar flísar í ramma (`FLISA_THAK_SNERTI`), annars grófa myndin — hver flís er
  ~15 MB afkóðuð. (3) Striginn breytir um stærð þegar setja-spjaldið opnast: `ResizeObserver` teiknar aftur.
- **Einföldun eftir fyrstu prófun Agnars („gríðarlega ruglingslegt“, 12.11.2026):** (1) síðan var stækkuð tvöfalt í vafranum og neðri stikan því utan
  skjás → stækkun síðunnar er læst á gatakortinu (`viewport` í `kort/page.tsx`: maximumScale 1, userScalable false; `touch-action: pan-x pan-y`),
  kortið hefur eigin stækkun. (2) Í síma sjást aðeins rauðir punktar („eftir“) af áætluðum götum; grænir og gulir tíglar (göt sem eiga skráningu) eru
  faldir nema hakað sé við „Sýna líka áætluð göt sem eiga skráningu“ í skúffunni (`synaParud`). (3) Síminn opnast í sýninni Loftræsting, ekki með öllum
  lögum. (4) Skýringarlína ofan við hnappana (`.gk-bar-skyring`): Skráð í Ajour · Opin skráning · Eftir, óskráð · lag fagsins.
- **Merkin í símasýn (Agnar 12.11.2026: „þessi x verða voða messy“, sendi þrjár myndir af Miro-borðinu sínu):** skráningar eru teiknaðar eins og á
  Miro-borði hans, ekki sem fylltir krossar. Loftræsting = PLÚSÚTLÍNA í lit stærðarflokks með stærðinni inni í (efri mörk flokksins, „Loft 125-160“ → 160:
  Ajour geymir flokkinn, ekki þvermálið) og dökk hök. Rör (stál, plast) = BLÓMHRINGUR með FJÖLDA stakra verka inni í og græn hök. Eitt hak = eitt klárað
  stakt verk (mest tvö sýnd; „×n“ við plús ef þrjú eða fleiri). Skráningar sama hóps innan 2,4 × merkisbreiddar eru EITT merki (`merkisR`, hópun í `teikna`);
  valinn eða dreginn punktur er alltaf stakur, og spjaldið telur upp „Í sama merki“. Opin skráning = rauð útlína + rauður hringur. Lagfæringarhringir eru
  ekki teiknaðir í síma. Borðtölvusýnin notar áfram gömlu táknin (kross/hringur/þríhyrningur) — ekki breytt án þess að Agnar biðji um það.
- **Ein deild í einu (Agnar 12.11.2026: „í breytingarham er alveg nóg að sjá bara eina deild í einu“):** deildarhnappur í neðri stikunni velur deild
  (`virkDeild`): stækkar inn á hana, sýnir aðeins skráningar og rauða punkta hennar og dofnar hinar deildirnar. Sami hnappur aftur = allar deildir.
  „Færa“ án valinnar deildar velur deildina á miðjum skjánum. Valið helst milli hæða. Aðeins á yfirlitsblöðum.
- **Sími í „tölvuútgáfu“ vafrans (Agnar 13.11.2026, raunskjáskot: „allt voða skrítið“):** Chrome í símanum hans teiknaði síðuna ~1.230 px breiða og
  smækkaða (Desktop site: viewport-merkið er hunsað), svo `@media (max-width: 860px)` náði aldrei símanum, borðtölvuútlitið birtist agnarsmátt og neðri
  stikan lenti neðan við skjáinn (100vh > sýnileg hæð). Útlitið ræðst því af KLASA, ekki media-fyrirspurn: KortClient setur `.gk.mjor` og `.aj.gk-mjor`
  þegar `innerWidth / zoom ≤ 860`, og `zoom = innerWidth / screen.width` á `.aj` þegar bendill er grófur, styttri kantur skjás ≤ 600 px og glugginn
  > 1,3 × skjábreidd. `--gk-vh` = `innerHeight / zoom` (sýnileg hæð) ræður hæð korts og skúffu. Undir zoom eru gluggahnit og `clientWidth` ekki í sömu
  einingum: `stadur()` og upplausn strigans leiðrétta með `getBoundingClientRect().width / clientWidth`. ALDREI setja símaútlit gatakortsins aftur í
  `@media (max-width)`. Hermipróf: `gk_simi2.cjs <slóð> <nafn> 980 1763 412 915 1.102` og `gk_hitt.cjs` (pikk og dráttur hitta rétt undir zoom).
  ÓSANNREYNT á tækinu sjálfu: hvort `screen.width` er 412 í tölvuútgáfu Chrome á S26 (ef ekki, gerist ekkert og Agnar slekkur á „Tölvuútgáfu“).
- **Hinn endinn (Agnar 13.11.2026: „fullkomnað ef maður gæti checkað við hina endana líka … rautt x ef það er ekki Ajour-punktur nálægt þeim megin“):**
  lokun í vegg er tvö stök verk. `endar` í KortClient finnur fyrir hverja skráningu næstu skráningu SAMA HÓPS innan `ENDI_PX` = 30 px (0,9 m) frá sýndri
  stöðu, úr öllum skráningum blaðsins (síur breyta því ekki); aðeins á yfirlitsblaði, gólf undanskilið. Vanti hana: rautt ✕ í stað seinna haksins í merkinu
  (símasýn), rauð lína „Hinn endinn: engin önnur skráning innan 0,9 m“ í spjaldinu (annars „Hinn endinn: #nr, x m frá“), hnappurinn „Hinn endann vantar (n)“
  í skýringarlínunni síar á þær (`anEnda`), og gátreitur í Síur gerir það sama á borðtölvu. Mælt 13.11 í loftræstisýn: 6H 75, 5H 55 (S1 5 · S2 15 · S4 14 ·
  S5 21). TAKMÖRKUN: mælir nálægð, ekki hlið veggjar — tvær skráningar sömu megin teljast par, og tvö gegnumtök nær en 0,9 m fela hvort annað.
- **Hinn endinn eftir HLIÐ VEGGJAR (Agnar 13.11.2026: „gáðu hvort þú finnir leið“):** starfsmenn pikka á Ajour-teikninguna þeim megin við vegginn sem
  þeir vinna. Mælt 13.11 (PCA á rauðum pixlum, loftræsting): í 87 % tveggja skráninga para á sama gegnumtaki eru Ajour-staðirnar sitt hvorum megin við
  rauða brunavegginn, bæði á 5H og 6H (tilviljun gæfi 50 %). Kortið notar því UPPRUNALEGU Ajour-stöðuna (`Punktur.x0/y0`, ekki færðu stöðuna):
  - Veggir: `tools/skraning-gatakort-veggir.py <yfirlit.jpg> <út.json>` dregur miðlínur rauðra veggja út sem línubúta (rauður litur → þynning →
    Hough í þremur umferðum; þekur 96 % miðlínunnar á 5H og 6H). Skrárnar eru í `kort/veggir/yfirlit-5h.json` og `-6h.json` og hlaðast eftir þörfum
    (`VEGGIR` í KortClient, lykill „hæð:myndarheiti“; 4H notar 5H-blaðið en fær enga veggi, þar er eitt verk ein þétting). Keyra aftur ef yfirlitsmynd breytist.
  - Regla (`endar`): fyrir skráningu p og hverja skráningu q sama hóps innan 0,9 m frá sýndri stöðu: sker beina línan milli Ajour-staðanna veggbút
    (`skerVegg`, bútar lengdir um `VL` = 8 px í hvorn enda)? Já → „hinum“ (græn lína í spjaldi: „hinum megin við brunavegginn“). Nei, rauður veggur
    innan 20 px frá merkinu og engin Ajour-staðanna nær miðlínu en 3 px → „sama“. Annars „ovist“ (nálægðarreglan ein, eins og áður).
  - „sama“ er VEIKT merki og því gult „?“ í stað seinna haksins, ekki rautt ✕: á 6H (96 % búin) lenda 123 af 1.090 loftskráningum þar (S2 66), á 5H 73
    af 780 (S1 14 · S2 29 · S4 19 · S5 11). Í þeim pörum er oftar sami starfsmaður sama dag (6H: 55 % / 43 % á móti 28 % / 12 % í „hinum“-pörum), þ.e.
    maður sem pikkar tvisvar á sama stað. Hvaða „sama“-tilvik eru raunveruleg göt er ÓMÆLT (ekki borið saman við myndir né skoðað á staðnum).
  - Viðmót: hnappurinn „? Sömu megin (n)“ í skýringarlínunni síar á þær (`samaSia`), gátreitur í Síur gerir það sama; þegar slík skráning er valin er
    dregin gul lína milli Ajour-staðanna tveggja svo sjáist hvar pikkin lentu miðað við vegginn. Rauða ✕-ið (engin skráning innan 0,9 m) er óbreytt.
  - Samanburðarmæling utan kortsins: `scratchpad/lm_hlid2.py 5H|6H` (sama regla í Python) gaf sömu tölur og kortið (5H 73 = 73, 6H 124 á móti 123).
- **NEMAR (Agnar 13.11.2026: „setja reglu að punktur má ekki tengjast sín megin við rauða vegginn. Gera rauða vegginn með einhvers konar nema … hann
  nemi sirka breiddina af rörunum sem fara í gegn“):** hvert gegnumtak loftræsilagsins gegnum rauðan vegg er nemi með breidd stokksins.
  - Gögn: `tools/skraning-gatakort-nemar.py <yfirlit.jpg> <lag.png> <veggir.json> <út.json>` → `kort/nemar/loft-5h.json` (427 nemar) og `loft-6h.json`
    (446), flatt [x, y, tx, ty, hb]; hálf breidd miðgildi 7 px (0,2 m), 90 % undir 17 px. 3×3 útvíkkun svo stokkar hlið við hlið haldast aðskildir
    (tillögutólið notar 9×9 og fær 377 klasa á 5H). Aðeins til fyrir hópinn Loft (`NEMA_HOPUR`); rör (úði, vatn) fá nema þegar lög þeirra eru keyrð í gegn.
  - Regla (`endar`): Loft-skráning tengist nema ef sýnd staða er innan hb + 6 px meðfram vegg og 12 px þvert. Hlið = formerki Ajour-staðar (x0, y0) frá
    vegglínu nemans, ±3 px telst á veggnum. Neminn á skráningar báðum megin → „hinum“. Annars: skráning ÁN nema handan veggjar innan 0,9 m → „hinum“;
    ein á nemanum → `einn` (rautt ✕: „engin skráning hinum megin … á þessu gegnumtaki“); allar sömu megin → `samaNemi` (rautt ✕); annars „ovist“.
    Skráning á ÖÐRUM nema telst aldrei hinn endinn. Skráningar utan nema (um 37 %) fylgja áfram línureglunni að ofan (gult „?“ ef sömu megin).
  - Af hverju: í „sömu megin“-pörum var bilið milli Ajour-staðanna oftar MEÐFRAM veggnum en þvert (5H 64 %, 6H 58 %; í „hinum“-pörum 28 % / 24 %),
    þ.e. tveir stokkar hlið við hlið. Með nemum: 5H rautt ✕ 84 (S1 16 · S2 20 · S4 18 · S5 30; þar af ein á gegnumtaki 41, allar sömu megin 16, engin
    innan 0,9 m 27) og gult „?“ 44; 6H rautt ✕ 137, gult „?“ 61. Áður (aðeins nálægð + lína): 5H ✕ 55 og ? 73; 6H ✕ 75 og ? 123.
    Kortið og `scratchpad/lm_nemar2.py` (sama regla í Python, gögn úr `lm_gogn2.cjs`) gefa SÖMU tölur per deild. ATH: `skr_faerslur.fra_x` er námundað
    í 0,1 px og það eitt færði 6 skráningar milli flokka; viðmiðunarmæling verður að varpa Ajour-hnitunum sjálf eins og kortið.
  - ÓMÆLT: hve mörg ✕ eru raunveruleg göt. 6H er 96 % búin en fær samt 137 ✕ af 1.090 loftskráningum, svo hluti þeirra er skekkja í pikki eða í því hvaða
    nema sjálfvirka færslan valdi. Ekkert af þessu fer í stöðuskýrsluna; þetta er vinnulisti til að ganga á.
  - Þegar skráning er valin er neminn hennar teiknaður sem strik meðfram veggnum (grænt = báðum megin, rautt = vantar, grátt = óvíst).
- **Raufar = loftræsting, og seinna hakið = hinn endinn SKRÁÐUR (Agnar 13.11.2026 seint: „teikningin sýnir næstum alls staðar að bara sé búið öðrum megin á
  t.d. 6H2S þar sem allt á að vera búið. Mátt bæta inn í loftræstingasýnina götin raufar metrar, sem eru kringum ferköntuðu loftræstingarnar“):**
  - Flokkurinn „Raufar. (Metrer) LV“ (id 41; 110 á 6H, 17 á 5H) féll undir Rafmagn af því að `RAF = /Raf|Raufar/`. Nú `takn()` → hópur **Loft**, heiti
    „Loft raufar“, dökkblár ferningur. Hann er því í loftræstisýninni, fær nema og parast við aðrar loftskráningar. „Raf raufar …“ (44) og
    „Raflagnaþéttingar …“ (34) eru áfram rafmagn. Samantektartafla kortsins telur raufarnar nú í Loft-dálki. Stöðuskýrslan notar ekki `takn()`.
  - Merkin (`merki(…, ve, vs, nh)`): seinna hakið sést ef hinn endinn er skráður og kláraður (`hinnKlar`: endar-færsla til, ekki `einn`, og q klárað),
    LÍKA þegar hann er teiknaður sem annað merki hinum megin við vegginn (áður sýndi stök skráning eitt hak og leit út sem „búið öðrum megin“). Rautt ✕
    aðeins ef engin skráning merkisins á hinn endann; í blönduðu merki er hakið sýnt og lítið ✕ við hornið. Gult „?“ sést AÐEINS þegar sían „Sömu megin“ er á.
  - `samaNemi` (allar skráningar gegnumtaks sömu megin) er EKKI lengur rautt ✕: það telst með „Sömu megin“. `vantarEnda` = engin færsla eða `einn`.
    Ástæða: hlið veggjar er lesin úr pikki og á búinni deild (6H S2) gaf reglan 24 ✕ og 28 ? sem ekki verða greind frá ónákvæmu pikki.
  - Mælt eftir breytingu (kort = `lm_nemar2.py` með raufum, per deild á 5H): 5H ✕ 75 (S1 17 · S2 19 · S4 18 · S5 21), sömu megin 60; 6H ✕ um 107 (S1 29 ·
    S2 33 · S4 19 · S5 26), sömu megin um 122 (Agnar var að færa punkta á 6H S2 á meðan, tölurnar hnikuðust um 1–3). 6H S2: 372 skráningar með raufum.
  - Próf án blindra pikka: `scratchpad/gk_tolur.cjs <grunnslóð>` (teljarar per hæð og deild), `gk_s2_mynd.cjs <grunnslóð> <nafn> [hæð] [deild] [stækkanir]`.
- **Myndir í spjaldi, víðari pörun og raufar á raflagnaleið (Agnar 13.11.2026 um miðnætti: „mátt alveg halda áfram að reyna láta matcha … mögulega eru
  einhverjar rafmagnsraufar og göt inn í þessu raufarmetrar … yrði hægt að geta séð preview mynd úr punktunum“, „kannski voru einhverjar raflagnir settar í
  rangan flokk“):**
  - Myndir: allar 27.463 Ajour-myndir verks 4 eru í OKKAR geymslu (`skr_myndir`, 10.896 skráningar, 0 vantar; mælt 13.11). Spjald valins punkts sækir
    `skr_myndir.path` og sýnir allt að 6 smámyndir efst (`.gk-myndir`); pikk opnar ljósakassa (`.gk-ljos`, fletta ‹ ›, Loka). Próf: `scratchpad/gk_mynd_prof.cjs`.
  - Víðari pörun (`ENDI_VITT_PX = 50`, 1,5 m): munaðarlaus skráning (engin færsla eða `einn`) + önnur munaðarlaus skráning SAMA flokks innan 1,5 m með
    brunavegg milli Ajour-staðanna → „hinum“ með `vitt: true`. Leysir 8 á 6H og 6 á 5H. Þær sem eiga aðra munaðarlausa nálægt sömu megin eða án veggjar
    (30 á 6H, 8 á 5H) eru EKKI paraðar. Mælt eftir (kort = `lm_nemar2.py`, eins per deild): 6H ✕ 94 (S1 29 · S2 24 · S4 15 · S5 26), sömu megin 124;
    5H ✕ 69 (15 · 17 · 18 · 19), sömu megin 60.
  - Raufar (flokkur 41) móti lögum (`scratchpad/lm_raufar.py`, fjarlægð frá loftræsilagi M215/M216 og raflagnaleiðum R1150/R1160): 6H 110, þar af 90 við
    loftstokk (≤ 0,3 m) og 15 á raflagnaleið (≤ 0,15 m) en ekki við stokk; 5H 17, þar af 10 við stokk og 7 á raflagnaleið. Þessar 22 GÆTU verið raflagnir í
    röngum flokki; ósannreynt, flokkun ekki breytt. Hringlaga loftskráningar á raflagnaleið og ekki við stokk: 33 á 6H, 17 á 5H.
  - Mynd #5364 (6H S1, 315) sýnir stokk upp í gegnum steypta loftplötu, ekki vegg: sum rauð ✕ eru þá gegnumtök í plötu þar sem ein skráning er öll lokunin.
    ÓMÆLT hve mörg; kortið greinir ekki plötu frá vegg.
- **Myndgreining: vísbendingar og kerfispunktur (Agnar 14.11.2026: „mögulega getur myndgreiningin hjálpað að flokka betur eða gefið vísbendingar“, „kannski
  bæta við pínulitlum lituðum punkti eftir kerfi hvað punkturinn er þegar búið er að greina hann“):**
  - `kort/visbendingar.json` ({utg, v: {ajour_serial: [dómur, í loftplötu 1/0/-1, vissa]}}), hlaðið í `visb`. Dómar: kaplar · ferkantadur_stokkur ·
    hringlaga_stokkur · ror · blandad · udi · einangrad. Spjaldið segir „Ljósmyndirnar sýna …“; `taknMedVisb`: Loft-skráning með „kaplar“ og vissu „há“
    telst RAFMAGN á kortinu; `iPlotu` (í plötu = 1, vissa há): ekki „hinn endann vantar“ (aðeins #5364 enn). Kerfispunktur (`VISB_KERFI`): lítill litaður
    punktur neðst til vinstri á merki (rafmagn grænt, loftræsting blátt, úði rautt, vatn/hiti blágrænt) + „Greint af mynd:“ í skýringum. Aðeins birting.
  - Aðferð (scratchpad): `lm_val.py` velur → `lm_saekja.cjs` sækir myndir úr OKKAR geymslu → `lm_litir.py` (hlutfall mettaðra grænna/blárra/fjólublárra
    og rauðra díla) → `lm_blod.py` skoðunarblöð → undiragent dæmir hverja skráningu → ég skoða nokkur blöð sjálfur → `lm_visb.cjs` sameinar í JSON.
  - Niðurstaða 14.11 (300 skráningar: allar 127 raufar, 49 loft á raflagnaleið, 146 sem vantar hinn endann): kaplalitir (≥ 1,2 %) hjá 99 óþekktum; skoðun:
    29 kaplar (ALLT raufar: #8692 og 28 í röðinni 11764–12106, október 2026), 53 hringlaga stokkar, 15 ferkantaðir, 1 rör (#3768), 1 óljós (#11086).
    Engin hringlaga loftskráning reyndist kaplar. Með þeim 18 sem áður voru staðfestar: 47 af 127 raufum eru raflagnir. Ég skoðaði blöð 8 og 13 sjálfur
    (12 skráningar): samhljóða. Raufar ÁN kaplalita (57) eru óskoðaðar. #463, #4456, #4463 sýna sömu þrjár myndirnar (hugsanlega þrítekið).
  - Mælt eftir (kort = `lm_nemar2.py` nema #5364 í plötu): 6H ✕ 73 (S1 21 · S2 19 · S4 11 · S5 22), sömu megin 84; 5H ✕ 64, sömu megin 34.
  - STÁL 40-50 („sprinkler alltaf óeinangruð stálrör … vatns- og hitakerfi alltaf með einangrun“): slembiúrtak 66 af 2.841 (fræ 12345, `stalurtak.json`),
    undiragent: 44 einangruð, 20 óeinangruð (14 rauð, 2 blá, 4 ómáluð), 2 óljós. Rautt hlutfall ≥ 2,7 % (mest yfir myndir): 12 af 14 rauðum, 0 af 44
    einangruðum. Blá og ómáluð ber rör nást EKKI á lit, og „einangrað“ verður ekki dæmt af lit (18 % af litlausum eru ber). Fjarlægð frá úðalögn/vatnslögn
    á teikningum greinir ekki á milli (M115/M116 liggur við flest). Í 6–7 skráningum er stuttur einangrunarhólkur í gatinu en rörið bert ofan við
    (#5023, 6110, 7128, 10026, 10155, 11149, 3278): dæmt einangrað. ÚRSKURÐUR Agnars 14.11.2026 (sá myndablöðin): „allt með hlutaeinangrun á bara
    eftir að klára einangrunina og er því annaðhvort í 32mm eða 40-50mm“, „allt vatnslagnir og hitalagnir“ → öll sjö í `visbendingar.json` sem
    einangrad/há (einangrað há alls 42). Hann merkti á myndirnar: grennri rörin með minni hólk = 32 (Stál Ø15-35), sverari = 50 (Stál Ø40-50)
    (#5023 og #6110 sýna hvort tveggja). Sami dagur: „gegnum millihæða … skráum við aðeins neðri vinnuna“ (ein skráning er öll lokunin), og
    „30 eða 32 sem fjöldi skráninga í gólf 160 sem teljast ekki með“ (skráðar OFAN FRÁ). MÆLT 14.11.2026 (`scratchpad/lm_golf.cjs`, myndir allra 35
    Gólf Ø160-200 á 6H skoðaðar á blöðum `blod/golf6h_01–06.jpg`): 31 skráning á 6H S2 frá sept.–nóv. 2025 er ljósmynduð OFAN FRÁ (rör niður í
    gólfið): #145, 1060, 1061, 1063–1066, 1077–1084, 1089, 1090, 1092, 1094, 1095, 1097–1099, 1363–1370. 27 þeirra liggja innan 0,7 m frá
    Gólf-skráningu á 5H (neðri vinnan); #1065, 1066, 1368, 1369 eru 1,2–2,0 m frá næstu. Hinar fjórar á 6H (#8815, 8816, 8833, 8834, júní 2026,
    S4/S5) eru teknar NEÐAN FRÁ. Agnar sagði fyrst „Þetta er eitthvað annað. Halda þessum“ (án þess að hafa séð myndablöðin), en eftir að hafa
    skoðað blað `golf6h_02` (#1066–1081): „Já þessar mátti setja í hide“ → LOKAÚRSKURÐUR: þessar 31 teljast EKKI með. Útfært sem `OFAN_FRA` í
    `skyrsla/SkyrslaClient.tsx` (Ajour-númer, síað við lestur; afstemmingin við Ajour sýnir áfram 11.206 og nýr liður í Forsendum skýrir). Fyrir/eftir
    á öllum texta skýrslunnar (`scratchpad/gk_skyrsla_texti.cjs`): hver breytt tala lækkar um nákvæmlega 31 (heild 10.291 → 10.260, 6H S2 1.624 → 1.593,
    milliloft 859 → 828, útboðsliður 1.2 861 → 830). Fjórar neðan frá á 6H teljast áfram.
    FALDAR Í GRUNNINUM sama dag (Agnar: „Þessir líka mega fara í hide. Jú má soft delete“): `eytt=true` á þessar 31 í skr_skraningar með
    `tools/skraning-ofan-fra-fela.cjs --write` (afrit raðanna: `tools/skraning-ofan-fra-afrit-20261114.json`; færsla í skr_atburdir, hvad 'eytt';
    afturköllun: `--til-baka`). Mælt fyrir/eftir: skr_skraningar eytt=false 11.206 → 11.175; skr_yfirlit og skr_hub_skraningar (verk 4) 11.206 →
    11.175; skr_haedarhnit 10.655 → 10.624; kortið sýnir 4 Gólf á 6H; lifandi stöðuskýrsla les orðrétt eins og fyrir földun (skýrslan telur földu
    raðirnar sér svo afstemmingin við Ajour sýni áfram 11.206). NLSH-uppgjör í hubnum les skr_hub_skraningar og telur þær því EKKI lengur; hvort
    þær voru þegar rukkaðar haustið 2025 er ÓMÆLT (ekki rannsakað). Ajour sjálft er óbreytt. GILDRA: innflutningur setur `eytt` við upsert —
    `skraning-gatakort-innflutningur.cjs` heldur þeim nú földum (OFAN_FRA), en `luna-bridge/ajour-import.js` (`eytt: !!r.deleted`) myndi BIRTA ÞÆR
    AFTUR; keyra þá `skraning-ofan-fra-fela.cjs --write` á eftir. Varanlegast er að fela þær líka í Ajour (Agnar gerir það sjálfur).
- **SKRÁNINGAR ÁN TEIKNINGAR FALDAR (Agnar 14.11.2026: „þær sem eru utan teikningar, 400+ má soft eyða“):** 466 raðir í verki 4 með tómt `teikning_id`
  (444 opnar, 22 merktar kláraðar: #3660, 6591, 7232, 7370, 7493, 8125, 8798, 9327, 9927, 9929, 9931, 9933, 9936, 9971, 11197, 11330, 11379–11381,
  11423, 11613, 11888; 193 með myndir; stærstu flokkar Stál Ø40-50 86, Guide point 81, Annað 50) fengu `eytt=true` með
  `tools/skraning-an-teikningar-fela.cjs --write` (afrit: `tools/skraning-an-teikningar-afrit-20261114.json`; skr_atburdir 'eytt'; `--til-baka`
  birtir þær aftur). Mælt fyrir/eftir: skr_skraningar eytt=false 11.175 → 10.709 (faldar alls 497 með OFAN_FRA); skr_yfirlit og skr_hub_skraningar
  11.175 → 10.709; skr_haedarhnit óbreytt 10.624 (þær voru aldrei á korti). Stöðuskýrslan: hæðatölur ÓBREYTTAR (heild 10.260 af 11.923); aðeins
  útboðssamanburðurinn lækkar um kláruðu 22 (1.2: 830 → 828, 2.2: 306 → 304, 2.4: 1.963 → 1.959, 2.5: 2.833 → 2.826, 2.6: 538 → 536, 2.8: 973 →
  971, 2.9: 696 → 695, 3.1: 488 → 487, Loft annað 1 → 0) og „opið“ lækkar um 444. Skýrslan telur földu raðirnar sér (`faldarAnT`) svo afstemmingin
  við Ajour (11.206) og liðurinn „Skráningar án teikningar: 466“ standi. Innflutningurinn (`skraning-gatakort-innflutningur.cjs`) heldur þeim földum
  MEÐAN þær eru án teikningar í Ajour; fái skráning stað birtist hún aftur. NÝJAR skráningar án teikningar koma inn ófaldar (skýrslan telur þær
  „utan“). `luna-bridge/ajour-import.js` myndi birta allar aftur. Ajour sjálft óbreytt.
    Óljósu þrjú (Agnar sama dag, af myndum): #12083 (5H S5) er ÚÐI → udi/há (úði há alls 25). #3129 (5H S1, hvítt yfirmálað): „held … sprinkler eða
    vatnslagnir“ → ÓDÆMT. #9178 (5H S2): „75 stál en mögulega frárennslislagnir því hún er svo neðarlega á vegg og fer líklega niður“ → ÓDÆMT, tekið
    úr `raud` (647 eftir); skráð í Stál Ø40-50 í Ajour, flokkur óbreyttur. Ber ómáluðu rörin (#1433, 4932, 10671, 11766) eru enn ósvöruð.
    Keyrt á ALLAR 2.841 (allar eiga myndir, 959 MB sótt í scratchpad/stalallt): rautt ≥ 2,7 % hjá 671 (23,6 %). SANNPRÓFUN á nýju slembiúrtaki 12 slíkra
    (fræ 777, ég skoðaði sjálfur): 8 rauð úðarör, 3 EINANGRUÐ rör með rautt rör í bakgrunni (#7371, 8290, 10343), 1 óljós (#9178). Litur einn er því
    EKKI dómur (um 2 af 3 rétt). Þess vegna: `visbendingar.json.raud` (648 númer) er aðeins vísbending í spjaldi („Sjálfvirk litagreining: rautt rör …“),
    enginn kerfispunktur og engin áhrif á sýnir. Dómar með vissu „há“ (skoðaðar myndir): úði 24, einangrað 36 → kerfispunktur, og sýnin „Úðakerfi“ felur
    stál dæmt einangrað, „Vatn og lagnir“ felur stál dæmt úði (ódæmd sjást í báðum). Full myndskoðun allra 2.841 kostar um 5–6 milljón tákn hjá
    undiragentum (66 kostuðu 134 þús.): ekki keyrt án samþykkis Agnars. Próf: `scratchpad/gk_udi_prof.cjs`.
- **Hurðalínur, hlið skráningar og smellur (Agnar 14.11.2026: „smá að pæla hvort stærðarplúsarnir gætu fundið skurðinn þar sem loftræstingin fer í gegn. Og
  maður gæti dregið punktana svo þeir festast í einhvern endann á plúsnum og þá kæmi neon check ✓ á þann hluta … væri hægt að gera bláa línu í hurðagötin“,
  „það er samt næstum því bara bein lína eftir öllum ganginum“):**
  - HURÐALÍNUR: `tools/skraning-gatakort-veggir.py` tengir rauða veggbúta í sömu línu (lárétt/lóðrétt, innan 4 px; bil ≤ 4,0 m alltaf, 4,0–6,6 m aðeins með
    bláu hurðartákni; línan þarf ≥ 2 m af rauðum vegg) → `hurdir` í veggir-JSON (282 á 5H, 285 á 6H) og aftast í `seg`, svo kortið fer með þær sem vegg.
    `skraning-gatakort-nemar.py` telur þær vegg → 489 nemar á 5H (var 427), 511 á 6H (var 446). Kortið teiknar þær sem bláar línur. Ástæðan: ofan við hurðir
    er veggurinn samfelldur, stokkarnir fara þar í gegn. INNDREGNAR stofuhurðir (E30-S í skoti milli baðherbergja; mynd Agnars 14.11, „reyna sjálfvirkt“):
    tveir veggendar með 0,6–2,35 m á milli (mjórra en gangurinn), innan 15° frá ás, ekkert rautt á milli og blátt hurðartákn (≥ 30 px) við línuna → hurð í
    skoti; ganglína FYRIR MYNNI skotsins (samsíða, 0,45–2,4 m frá, hurðin innan bilsins) er felld niður. 6H: 59 inndregnar, 4 ganglínur felldar (340 línur
    alls, 514 nemar); 5H: 71 og 8 (345 línur, 489 nemar). Fyrsta útgáfa (bil ≤ 2,85 m, 20°) dró rangar línur þvert yfir ganginn (229 á 6H): ekki víkka aftur.
    Skoðað á einum bút (6H S2, x 1500–2400): rétt þar; aðrir hlutar blaðanna ÓSKOÐAÐIR. Skoðunarmynd: `scratchpad/lm_hurdamynd.py <hæð> [x0 y0 b h]`.
    Mælt eftir (kort = `lm_nemar2.py`): 6H ✕ 82 (24 · 25 · 11 · 22), sömu megin 84; 5H ✕ 64 (12 · 15 · 18 · 19), sömu megin 34. Innri hurð (gátt → sjúkrastofa) á EKKI að fá línu; á hluta 6H S2 var
    þétt þar fyrir mistök og þær skráningar parast áfram á nálægð einni.
  - HLIÐ: skráning á nema fær `megin` (−1 ofan/vinstra megin, +1 neðan/hægra megin) úr Ajour-staðnum, eða úr sýndri stöðu ef henni var SMELLT (`fest`:
    handfærð, á miðju nemans og nákvæmlega `SMELL_PX` = 4 px frá vegglínu). Hakið fer þeim megin við merkið; neongrænt (`NEON`) ef `fest`, annars dökkt.
    Hitt sætið: hak ef hinn endinn er skráður, annars rautt ✕. Smellt hlið ræður líka pöruninni (A/B í `endar`).
  - SMELLUR: í Færa-ham lendir Loft-punktur sem er dreginn innan 14 px frá nema á miðju hans, 4 px frá vegg þeim megin sem sleppt er (`smella()` í `hreyfa`).
    Próf með skrifin stöðvuð og lesin: `scratchpad/gk_smell_prof.cjs` (PATCH átti að vista (1943.9, 385) = neminn (1943.9, 381) + 4 px).
  - Víðari pörunin krefst nú sama HÓPS auk sama flokks (raufar sem eru raflagnir pöruðust annars við loftraufar).
  - Mælt eftir (kort = `lm_nemar2.py`, eins per deild; viðmiðunin kann ekki `fest` enn, engin smellt skráning til): 6H ✕ 84 (S1 24 · S2 25 · S4 11 · S5 24),
    sömu megin 89; 5H ✕ 65 (12 · 16 · 18 · 19), sömu megin 39.
- **Hök uppi og niðri, og raufar sem eru raflagnir (Agnar 14.11.2026: „check ✓ mætti alveg líka koma uppi og niðri þegar við á, í stað hægri vinstri“,
  „þú kannski nærð að sjá hvort þetta séu loftstokkar eða rafmagns vírabúnt“):**
  - `veggurLarettur(v, x, y)`: liggi næsti brunaveggur (innan `VEGG_NAER`) lárétt við merkið fara sætin tvö OFAN og NEÐAN við það, annars vinstra og hægra megin.
  - Ljósmyndir skoðaðar 14.11 (`scratchpad/lm_raufamyndir.cjs` + `lm_raufablod.py` → `raufamyndir_blad_*.jpg`): af 22 raufum á raflagnaleið og ekki við
    loftstokk eiga 17 myndir og ALLAR 17 sýna kapalbúnt á strengjastiga gegnum vegg. Úrtak 8 raufa VIÐ loftstokk: 7 ferkantaðir stokkar, 1 kapalbúnt (#11834).
    Þessar 18 eru í `RAUFAR_RAFMAGN` (ajour_serial) í KortClient og teljast rafmagn Á KORTINU; flokkur í grunni og Ajour er ÓBREYTTUR og stöðuskýrslan líka.
    #8021, 8022, 8024, 8025, 8026 (5H S1, 01.06.2026) eiga engar myndir: óstaðfest, ekki í listanum. Hinar 92 raufarnar við loftstokk eru óskoðaðar
    (úrtakið gefur 1 af 8). Hringlaga loftskráningar á raflagnaleið (33 á 6H, 17 á 5H) eru líka óskoðaðar.
  - Mælt eftir (kort = `lm_nemar2.py`, eins per deild): 6H ✕ 92 (S1 27 · S2 24 · S4 15 · S5 26), sömu megin 120; 5H ✕ 67 (15 · 15 · 18 · 19), sömu megin 60.
- **Ajour-staðir (Agnar 13.11.2026: „þetta er allt rosa skrítið. Myndi vilja geta séð Ajour punktana hvar þeir eru“):** hnappurinn „Ajour-staðir“ í skýringunum
  neðst (og gátreitur í „Lög og síur“) teiknar bláan punkt þar sem pikkað var í Ajour (x0, y0) fyrir HVERJA skráningu og bláa strikalínu í merkið ef hún var
  færð (`ajLina` / `ajPt` í `teikna`); stærðartalan inni í merkinu er falin á meðan svo punkturinn sjáist. Valin skráning sýnir alltaf sinn Ajour-stað, og
  spjaldið segir „Á sama stað og í Ajour (ekki færð á kortinu)“ ef engin færsla er til. Tilefnið: 6H S1 #5364, #5365, #5366 (þrjú 315-verk 18.03.2026 í röð
  með 1,1 og 1,4 m bili við vegg sem er EKKI rauður á blaðinu; hvert stendur eitt innan 0,9 m og fær því rautt ✕). Próf: `scratchpad/gk_ajour_prof.cjs
  <grunnslóð> <nafn> [x y] [stækkanir]` (sími) og `gk_ajour_bord.cjs` (borðtölva). ATH: `gk_hlid_prof.cjs` pikkar blint og reynir ~20 PATCH (stöðvuð af prófinu).
- **Merkjastærð (Agnar 13.11.2026: „merki mega ekki vera of stór svo ég sjái ekki“):** `merkisR` þak 13 px (var 17), fylling merkja 40 % hvít (var 60 %),
  áætluð göt og tillögur mest um 9 px í símasýn (`zb`) og tillöguhringurinn hálfgegnsær. Teikningin undir merkinu á að sjást; ekki stækka þetta aftur.
- **Valinn punktur undir spjaldi:** í símasýn þekur spjaldið allt að neðri helming kortsins; lendi valdi punkturinn neðar en 40 % af hæð kortsins er
  kortinu hliðrað svo hann sitji í 25 % (`lyfta` í pikk-meðhöndluninni). Ekki í færsluham (spjaldið samanbrotið þar).
- **Próf:** `scratchpad/gk_simi2.cjs <slóð> <nafn>` (412 × 915, snerting um CDP, skrif stöðvuð og svarað með uppgerð).

## Stöðuskýrsla (11.11.2026) — `/kjarni/skraning/skyrsla`
- **4. hæð = gólf 5. hæðar (Agnar 12.11.2026):** þéttingar skráðar á 4H eru í gólfplötu 5. hæðar, unnar neðan frá á 4. hæð, og teljast
  því HLUTI af verkinu á 5. og 6. hæð (ekki sleppa þeim úr skýrslu til eftirlits). Skýrslan sýnir „Gólf 5. hæðar“ (`haedHeiti`);
  lyklarnir í gögnunum (4H/5H/6H) eru óbreyttir. Milliloft á 5H er á sama hátt gólf 6. hæðar.
- **Til hvers skýrslan er:** svar við beiðni COWI (Arnar Ingi Þórsson, eftirlit) um gögn vegna yfirferðar brunaþéttinga á 5. og 6. hæð,
  framsend af Hilmi Erni Stefánssyni hjá ÞG Verk 10.11.2026 (email_digest 75261): staða verks og yfirlit yfir svæði + samantekt
  í stað lesaðgangs að Ajour. Vörur, vottanir og námskeiðsgögn eru EKKI í kerfinu — Agnar leggur þau til.
- **Forsendur og fyrirvarar (12.11.2026, Agnar: skýrslan getur ráðið úrslitum um samninga upp á hundruð milljóna):** kaflinn
  `forsendur` (`.sk-forsendur`, efst, má fela í Kaflar) segir hvað er MÆLT (skráningar í Ajour) og hvað er ÁÆTLAÐ (markmiðin), færslu
  punkta (talið úr `skr_haedarhnit.faerdur`; mælt 12.11: miðgildi 0,31 m, mest 0,96 m) og stemmir af við Ajour: allar kláraðar =
  taldar á móti markmiði + raufar + aukaverk + án teikningar + „Annað“ (12.11: 10.526 = 10.291 + 115 + 81 + 22 + 17).
  466 skráningar eru ÁN TEIKNINGAR (444 opnar; 131 þeirra „Guide point“/„Annað“, 313 í verkflokkum) — hvað þær eru er ÓMÆLT.
  Aldrei kynna prósenturnar sem talningu á öllum götum: markmið 6. hæðar er það sem er skráð.
- **Gagnvirkt og til sýnis (12.11.2026, Agnar: skýrslan verður skoðuð af stærstu verktökum landsins — „geta sýnt nákvæmlega það sem
  maður vill sjá“, „eins flott og professional og hægt er“):**
  - `Haedir.tsx` → `Haedarkort`: aðdráttur (+/−/⤢, tvísmellur, Ctrl+skrun) og færsla (draga); sýnin er `{z, fx, fy}` sem HLUTFALL af
    kortinu (`translate(%) scale()`), svo prentun heldur því sem er á skjánum. Enginn `will-change` á `.sk-hk-lag` (annars óskýr teikning).
    Smellur á punkt (næsti innan 14 px) → spjald `.sk-hk-kort`: nr. (ajour_serial), flokkur, staður, dagsetning, starfsmaður, fjöldi mynda í
    Ajour — nánar sótt með einni `select` á `skr_skraningar`. Deildarflagg = hnappur sem stækkar deildina. Leit „Skráning nr.“ fer að punktinum.
  - `Framvinda` (í sama skjali): kláraðar skráningar á mánuði, staflað eftir hæð; smellur á mánuð setur „Til“ = staðan í lok mánaðar
    (prósenta á móti markmiði helst þá; „Frá“ og stærðarsía fella hana). Litir hæða `LITUR_H` eru sannprófaðir (dataviz validate_palette).
  - `Efni.tsx`: **Efni og kerfi** = Protecta-vörurnar af reikningum Redder vegna verksins (FR Acrylic PRO005/PRO022, FR Graphite PRO010,
    FR Board A006, FR Collar PRO0039-30, FR Pipe Wrap PRO276; FSi FS310CW25 og PW-band á rúllu nefnd í smáu letri). Redder-verkstaðurinn
    „Landsspítalinn“ geymir LÍKA annað verk: reikningar 14.11.2023–05.02.2024 („BUGL“, „LSH 0104-14“) eru ekki NLSH (FSi háþenslukítti
    FS310HPE er aðeins þar); NLSH-reikningar byrja 03.10.2025. Efni haustið 2025 er að mestu á ÓTENGDUM reikningum (worksite_match null). Myndir og tækniblöð eru TENGLAR á
    redder.is (ekki afrit í okkar geymslu). Magn og verð eru ekki sýnd. ETA-vottorð eru EKKI í kerfinu — ekki fullyrða um vottun.
    **Verkferli** = sex skref, DRÖG þar til Agnar hakar við „Yfirfarið“ (`gogn.verkferli_ok`); texti skrefa yfirskrifanlegur (`gogn.verkferli`).
  - **Kynningarhamur** `?kynning=1` (`.sk-les`): engin ritstjórn, engin vistun, ekkert app-nav — aðeins síur, kort og prentun. `.sk-gagnv`
    merkir stjórntæki sem sjást þar. ATH: þetta er ekki aðgangsstýring — slóðin án `?kynning=1` er jafn opin (RLS leyfir skrif).
  - Efnisyfirlit `.sk-yfirlit` (sticky; `.sk-blad` er `overflow: clip`). Merki hæðaspjalda: „Lokið“ aðeins við 100 %, „Á lokastigi“ ≥ 95 %.
  - Myndir þéttinganna sjálfra eru enn AÐEINS í Ajour (`ajour_gogn.myndir` = skráarauðkenni; `skr_myndir` er tóm fyrir verk 4).
- **„S4“ er DEILD (stúka 4), ekki 4. hæð (12.11.2026):** Agnar las sjálfur 6. hæð S4 í töflunni sem 4. hæð. Hæðin stendur því við hverja deild
  („Deild S4“ + hæð í deildarreit og samtölulínu, á flöggum og í töflum kortsins; síurnar „Hæð“ og „Deild“ aðskildar). Aldrei sýna „S4“ án hæðar
  í neinu sem fer út. Á 4H (gólf 5. hæðar) eru EINGÖNGU milliloftaþéttingar (Gólf), mælt 12.11: 367 skráningar.
- **Stærðarlínur stöðutöflunnar (12.11.2026, Agnar: „fylla inn í allar stærðir“):** hver stærð hefur markmið, % og stiku. Markmið stærðar =
  það sem er skráð (klárað + opið) + hlutur í afgangi flokksmarkmiðsins (, stærsta afgangs-aðferð), skipt eftir því sem vantar upp á
  sömu stærð á sömu deild á 6. hæð. Summa stærða = markmið flokksins (prófað: 84 línur, engin frávik). Viðmið, ekki talning.
- **Orðið er „Áætlað“, ekki „markmið“ (Agnar 12.11.2026):** í öllum birtum texta skýrslunnar (dálkar, lykiltölur, skýringar). Kóðaheiti
  (, , ) eru óbreytt. Prófið  leitar að orðinu í birtum texta.
- **Opnar skráningar án staðsetningar (12.11.2026, Agnar: „600 gulir punktar í Ajour sem eru opnir“):** opnar eru 680 = 236 með punkt á
  teikningu + 444 ÁN punkts ( tómt og  null í Ajour-útflutningnum; stofnaðar 02.–11.2026, flestar
  í apríl–maí, lýsing oftast tóm, 193 með mynd). Þær komast ekki á kort né hæð. Kaflinn  („Skráningar án staðsetningar“) telur
  þær upp eftir flokki og  segir frá þeim undir lykiltölum kortsins. Hvað þær eru (óunnin göt, drög, leiðarpunktar) er ÓMÆLT.
- **Stór sýn (12.11.2026, Agnar: „stækkunargler … opna þá hæð til að geta zoomað, og sjáanlega filterstiku til hliðar“):** hnappurinn
  „Stór sýn“ við hverja hæð og stækkunarglerið á hverju deildarflaggi opna `.sk-skodari` (fixed, yfir allan skjáinn): síurnar (`siuradir`,
  sama JSX og í skýrslunni, sama staða) vinstra megin með lykiltölum hæðarinnar; flipar hæða, „Loka“/Esc. Þar er skrun = aðdráttur.
  `Haedarkort` fær `stor`: glugginn er hærri en teikningin, `r` = hæð glugga / hæð teikningar; `klemma(z, fx, fy, r)` miðjar lóðrétt þegar
  z ≤ r og öll y-hnit eru í einingum TEIKNINGARHÆÐAR (ekki gluggans). Deildarflagg í skýrslunni opnar stóru sýnina á deildinni.
- **Skráningar án teikningar eru færslur sem verður EYTT (Agnar 12.11.2026, skjámynd úr Ajour „Registrations without drawing (list view) 456“:
  „Utan teikninga er það sem við eyðum síðan“):** þær eru hvorki unnið né óunnið verk. Aldrei kynna þær sem opin göt. Kaflinn `anstadar` er
  sjálfgefið FALINN (`SJALFG_FALDIR`), viðvörunin undir lykiltölum kortsins var tekin út, og „Forsendur“ segir hvað þetta er.
  (Fyrri lína hér að ofan um „opnar án staðsetningar“ lýsir gögnunum; túlkunin er þessi.)
- **Milliloft á gólfi 5. hæðar (4H) fylgja 5. hæð (Agnar 12.11.2026 bar sjálfur saman 4H-blöðin við „5H. Ceiling“: „alveg líklegt að vanti
  að gera fyrir 4. hæðina fleiri milliloftaþéttingar“):** `golfMark(haed, deild)` — 4H áætlun = max(110, skráð milliloft á sömu deild á 5H).
  Mælt 12.11: 5H S1 119, S2 150, S4 106, S5 99 → 4H áætlun 119 + 150 + 110 + 110 = 489 (var 440); klárað 357 → 73 % (var 81 %);
  heildin 10.291 af 11.938 = 86 % (var 87 %). Hub-síðan (brunaholf) notar enn 110 á deild og sýnir aðra tölu.
- **Ljósmyndir skráninga (12.11.2026, Agnar: „mátt sækja myndirnar líka“):** `tools/skraning-myndir-ajour.cjs [--write] [--limit N]` sækir
  prentstærð hverrar myndar úr Ajour (GET, ~100 kB, 1122×1496; 27.463 myndir ≈ 2,8 GB) í OPNU fötuna `skraning`
  (`verk/4/myndir/<fileId>.jpg`) og skráir í `skr_myndir` (stig 'annad': Ajour segir ekki fyrir/eftir). Endurkeyranlegt; stöðvast ef
  Ajour-lotan rennur út. Spjaldið í skýrslunni sýnir smámyndir (`.sk-hk-myndir`) og stóra mynd (`.sk-ljos`, örvar og Esc).
  Nýjar skráningar í Ajour fá ekki myndir sjálfkrafa — keyra tólið aftur eftir nýjan innflutning.
- **Stálrör eftir kerfi / úðakerfi (12.11.2026, Agnar: „brjóta aðeins upp og bjóða filter fyrir sprinklerkerfi“):** Ajour flokkar stálrör aðeins
  eftir stærð. `tools/skraning-gatakort-kerfi.cjs --log <lagamappa> [--write] [--prufa <yfirlitsmappa> 6H x y w h]` (+ `.py`) ber hverja
  stálröraskráningu á 5H/6H við lagnalögin (vatnsudi M395/M396 = 'udi'; vatn-litur + vatnslagnir = 'vatn'; lyfjaloft) og skrifar næsta
  kerfi í töfluna `skr_kerfi` (ný, aðeins lestur fyrir biðlara). ÁÆTLUN: `vafi` ef tvö kerfi eru innan 6 px eða lögn fjær en 15 px.
  Mælt 12.11: 5.664 stálrör → úði 743, vatn og hiti 4.511, lyfjaloft 410; 2.051 óviss. Vatnslagið er teiknað þykkt og dregur að sér punkta,
  svo úðakerfið er líklega VANTALIÐ. Sían „Stálrör eftir kerfi“ sýnir aðeins fjölda (engin áætlun per kerfi) og er merkt „áætlað af
  lagnateikningu“. Aldrei kynna kerfistölur sem skráðar staðreyndir.
  Stærðarregla (Agnar 12.11.2026: úðakerfið „er almennt í stál 50 mm til stál 75 mm“): aðeins Stál Ø40-50, Ø75-110 og Ø110-160 geta orðið 'udi' (Ø110-160 bætt við sama dag eftir myndskoðun: nr. 4808 og 5413 eru rauð úðarör). ÚÐALAGNIRNAR ERU RAUÐMÁLAÐAR — rauður litur á ljósmynd skráningar er betri vísbending en nálægð á teikningu (af 3 sýnum sem lágu „aðeins á úðalögn“ var eitt blátt einangrað rör); flokkun eftir myndlit er ógerð.
  Eftir regluna: úði 477 (6H 286, 5H 191), vatn og hiti 4.726, lyfjaloft 456. Þegar kerfi er valið í síunni birtist lagnateikning þess
  (skr_log, fag sprinkler/vatn/gas; CSS-klasinn sk-hk-lagmynd) ofan á hæðinni og grunnteikningin dofnar (klasinn medlag á kortglugganum). Sama á við um flokkana Loftræsting (fag loftraesting) og Rafmagn (fag rafmagn): HOP_FAG í Haedir.tsx (Agnar 12.11.2026: „líka svona loftræsti sýn“). Við aðdrátt (z ≥ 2) fá kláraðir punktar hvíta brún.
- **ÚÐAKERFI ER GREINT AF LJÓSMYND, ekki teikningu (12.11.2026, Agnar: „Jú hljómar vel“) — þetta GILDIR og víkur eldri línum um stærðarreglu:**
  úðalagnir á NLSH eru rauðmálaðar. `tools/skraning-gatakort-myndlitur.cjs [--write] [--syni <mappa>]` (+ .py) les myndir stálröraskráninga úr
  okkar geymslu og skrifar `skr_kerfi.rautt` = hlutfall rauðra díla í MIÐJU myndar (70 % × 70 %; litblær ±12°, mettun > 0,55), hæsta gildi af
  tveimur fyrstu myndum. `skraning-gatakort-kerfi.cjs`: rautt ≥ 1 % → kerfi 'udi', uppruni 'mynd' (vafi ef < 2,5 %); annars ræður næsta lögn á
  teikningu milli vatns og lyfjalofts (uppruni 'teikning'). ENGIN stærðarregla: grönn rauð úðarör sjást líka í Ø15-35 (nr. 9094, 2508, 3689).
  Rýnt á sýnisblöðum: 2,5–6 % → 15 af 15 úðarör; 0,8–2,5 % → um 10 af 15 (hitt: rautt rör í bakgrunni, rauður loki, rauð merking á mynd);
  þekkt villa: rauðbrún plata í bakgrunni (nr. 3326). Mælt 12.11: úði 1.488 (1.135 öruggar, 353 óvissar; 6H 550, 5H 938).
- **VIÐBÓTARVERK Á 4. HÆÐ: stútar af 5. hæð niður í inntaksrými 4. hæðar (12.11.2026, Agnar: „Jú inn“):** 35 staðir úr skjalinu
  „Lagnir 4. hæð – Stútar af 5. hæð niður í inntaksrými 4. hæðar“ (12 svæðisblöð S1/S2/S4/S5 × N/C2/S; S5-C2 enginn stútur). Bútarnir voru
  staðsettir á yfirlitsblað 5H með sniðmátsleit (kvarði 0,96–1,27, sannreynt með yfirlagi) og punktarnir eru í
  `tools/skraning-gatakort-vidbot-stutar.json` (með úttekt hvers stúts: th, st, ath). `tools/skraning-gatakort-vidbot-stutar.cjs [--write]` setur þá í
  skr_aaetlud (teikning 6 = 4H, fag 'golf', uppruni `vidbot:stutar-4h:<nr>`) og parar einn á móti einum við skráningu á 4H. Heildarteikningar
  með/án punkta voru afhentar Agnari sem JPG (1× og 4×), ekki vistaðar í repo.
  - **Betri pörun (12.11.2026, Agnar: „mátt reyna matcha meira, þá getur maður séð hvar maður hefur gleymt að gera, og merkja það sérstaklega“):**
    þrjár heimildir í fimm umferðum (lýst í haus tólsins): fjarlægð, nóvemberlotan (skráningar stofnaðar frá 01.11.2026; pinnar þeirra liggja
    0,1–1,2 m frá stútnum, svo 0,6 m radíusinn missti af þeim) og ÚTTEKTIN í skjalinu sjálfu. Merkingarnar („Brunaþétting: Komið“ ×13,
    „Eftir“ ×11, „Stútur ekki til staðar / innan í vegg“) eru frá 11.11.2026 og voru gerðar á A3-síðu sem var svo minnkuð í Letter: hnit þeirra
    (CL-lykillinn = örvaroddur) þarf að margfalda með 0,66554624 (cm-fylkið fremst í síðuefninu). Þá lenda allir oddar á þrívíddarmyndinni
    (þriðja mynd hverrar síðu) og hver merking var lesin á sinn stút af þeirri mynd (sjónrænt mat; #7 og #34 eru óvissust).
    Staða stútanna sjálfra er sannreynd tölulega: miðgildi 0,39 m frá næstu gólfskráningu á 5H (sami stofn hæð ofar); #30 á engan stofn nærri.
  - **Niðurstaða 12.11 (parad.flokkun):** 19 paraðir — stadfest 9 (úttekt Komið + kláruð skráning), eftir_skrad 7 (úttekt Eftir + opin skráning,
    þar af sex stofnaðar 09.11 án mynda), osamraemi 3 (#24 ↔ 9698 kláruð 23.09 en úttekt segir Eftir; #31 ↔ 12151 kláruð / #32 ↔ 12152 opin, víxlað
    miðað við úttekt). 16 án skráningar — eftir_oskrad 3 (#3, #6, #10), thett_oskrad 3 (#8, #9, #34: þétt í úttekt, engin skráning fannst),
    stutur_vantar 7 (#14, #15, #17, #19, #20, #27, #30), ometid 3 (#7 ákvörðun um legu pípu, #33, #35). Í S1-S liggja fjórar nóvemberskráningar
    (12162, 12163, 12165 kláraðar, 12164 opin) 2,4–12 m frá stútunum: myndirnar sýna rauða stúta en pörun við #6–#10 er ÓSTAÐFEST.
    Eldri kláraðar skráningar á sömu stofnum (10430, 10863, 10431, 5325, 5329) eru í öðrum rýmum (hvítmáluð loft) og parast ekki.
  - **Skýrslan:** aðeins ÓPARAÐIR stútar bætast við Áætlað á gólfi 5. hæðar (`vidbot4`: 489 → 505; S1 +6, S2 +5, S4 +1, S5 +4). Þeir eru
    sérmerktir á 4H-kortinu (`HkEftir.st`, `STUT` í Haedir.tsx): rauður tígull með dökkum ramma = eftir að þétta, gulur = þétt í úttekt en
    skráningu vantar, hvítur með rauðum ramma = stútur ekki kominn eða ómetinn. Smellur á tígul opnar spjald (númer, úttekt, næsta skráning);
    samantektarlína undir kortinu (`HkStutar`). Gatakortið sýnir sömu upplýsingar í athugasemd gatsins. Osamraemi er EKKI sýnt í skýrslunni
    (hún fer til eftirlits); það stendur í athugasemd á gatakortinu. Eftir nýjan Ajour-innflutning: keyra tólið aftur með --write.
- **Úrtakspróf á kerfisflokkuninni (12.11.2026, Agnar bað um það):** 150 stálröraskráningar í lagskiptu slembiúrtaki (fræ 20261112; 50 vissar úða,
  40 óvissar úða, 60 vatn), tvær fyrstu myndir hverrar metnar blint. Rétt: vissar úða 44/50 (88 %), óvissar úða 23/40 (58 %), vatn 57/60 (95 %).
  Vegið: um 81 % í „Úðakerfi“ eru úðalagnir, um 5 % í „Vatn og hiti“ (~210) eru rauð rör, næmi um 85 %; áætlaður raunfjöldi ~1.410 á móti 1.488 flokkuðum.
  Villurnar: rautt rör í BAKGRUNNI en þéttingin er á einangruðu röri (flestar), og dökkrauð rör í skugga sem ná ekki mettunarþröskuldi (nr. 6970, 6432, 3065).
  Textinn er í `KERFI_URTAK` í Haedir.tsx (sést þegar kerfi er valið). Breytist þröskuldur eða litaregla: endurtaka prófið og uppfæra textann.
- **Lyfjaloft er EKKI sér flokkur (Agnar 12.11.2026: „settu bara í sem vatn og hiti“):** stálrör eru aðeins 'udi' (rautt rör á ljósmynd) eða 'vatn'.
  Lyfjaloftsteikningin (M795/M796) er áfram í lagahópnum sem stálrör festast á, en gefur ekki sér kerfi. Tölur 12.11: úði 1.488, vatn og hiti 4.176.
- **Sjálfvirk færsla eftir kerfi (12.11.2026, Agnar: „hliðra punktunum til svo þeir séu á réttum stöðum“):** `skraning-gatakort-skr-festa` skiptir
  stálrörum eftir skr_kerfi: hópurinn 'udi' festist aðeins á skurðpunkta ÚÐALAGNA (vatnsudi) og veggja; 'stal' (önnur stálrör) á vatns- og
  lyfjaloftslagnir, ekki úðalagnir; plaströr ('ror') óbreytt. Þurrkeyrsla 12.11: úði 6H 354 af 550 festir, 5H 582 af 938; hinir standa á skráðum stað.
  Eftir færslu: keyra `skraning-gatakort-para.cjs --haed 6H|5H --write` og `skraning-gatakort-kerfi.cjs --write` aftur (staða punkta breyttist).
  Tólið PATCH-ar hverja færslu staka (nokkur þúsund köll, yfir 10 mín) — keyra í bakgrunni.
- **Snið hönnunarinnar (11.11.2026, Agnar: „svipað og artifact buildið“):** síðan fylgir Claude Design-skjalinu „Stöðuskýrsla NLSH“
  (Brunahólf V2): `.sk-v2` yfirskrifar `--aj-*` litabreyturnar innan skýrslunnar, Poppins um `next/font` í `page.tsx`
  (`--font-poppins`). Uppsetning: hliðarstika (`.sk-hlid`: kaflarofar, dagsetning, skýringar, vistun) + blað (`.sk-blad`) með
  hetjuhaus (heildarprósenta), hæðaspjöldum, hæðakorti, „Heild eftir flokkum“, töflum og útboðsstikum (strik = útboðsmagn,
  stikan nær 150 %). Kaflar faldir með `gogn.kaflar[lykill] === false` (`KAFLAR`; vistast með „Vista“). Útboðsliðir án gagna
  (enginn flokkur í Ajour: 1.1, 1.3) sjást aðeins í töflunni. Einingarofinn (stök verk / lokanir) úr hönnuninni er EKKI smíðaður.
  Yfirflæði á símabreidd eftir gluggabreytingu kemur frá `.aj-nav` (sameiginleg leiðarstika), ekki skýrslunni.
- **Hæðakortið (11.11.2026, Agnar: „skýrsluna byggða í kringum punktahæðina“, „filterkerfi og tölur“):** efsti kafli síðunnar,
  `skyrsla/Haedir.tsx`. Hver hæð = yfirlitsmyndin með ÖLLUM skráningum á sínum stað (`skr_haedarhnit`; færðir punktar ráða), hver
  deild skipt í Norður/Center/Suður með stöðulit og prósentu, flögg per deild og tafla með sömu tölum. Síur: flokkahópur
  (fjölval), stærð (þegar einn hópur er valinn), staða (allt/klárað/opið/eftir), hæð, deild, tímabil (mánuður `framkvaemt_til`).
  Prósenta birtist AÐEINS án stærðar- og tímabilssíu (markmið eru á flokkahóp). „Eftir“ = áætluð göt án skráningar
  (`skr_aaetlud.parad` tómt eða vantar). Markmið deildar = sama tala og í töflunni fyrir neðan (með leiðréttingum, `markDeild`);
  markmið hluta = `markmidHluta` (sama regla á hlutann, föst deildarmarkmið í þriðjungum). Punktar teiknaðir á canvas í minnst
  tvöfaldri upplausn svo prentun verði skörp; síurnar hverfa í prentun og ein lína lýsir þeim. Aðeins lestur.
- **Hvað:** skýrsla til Landspítalans: staða per hæð og deild (stök verk, markmið, %) og samanburður við UPPRUNALEGT útboð
  (liðir 1.1–3.1, magn úr mynd Agnars 11.11 — hann segir magnið hafa breyst). Allt reiknað úr `skr_skraningar` við opnun;
  Klárað, Markmið, Gildandi magn, „stök per ein.", Lokið og athugasemdir eru yfirskrifanleg og vistast í `skr_skyrslur.gogn`
  (ein röð per verk, nýjasta notuð). Tómur reitur = reiknað gildi. „Prenta / PDF" notar prentsnið (stjórntæki falin).
- **Reglur:** sjálfgefin markmið eru SAMA aðferð og Landspítalasíða hubsins (`brunaholf/js/nlsh-sections.js` hopStada: 6H = klárað,
  5H = 6H á sömu deild með loft kvarðað við Miro, milliloft 110) — breyta á báðum stöðum. Einingar: 2 stök verk = 1 lokun, gólf 1.
  Liður 2.11 er í metrum (ekki reiknað úr fjölda). Ajour hefur aðeins einn gólfflokk → allt gólf telst á 1.2.
- **Rafmagn telst með í heild (11.11.2026, Agnar):** markmið `RAF_MARK` = 104 stök verk á hverja deild á 5H og 6H (aldrei minna en
  klárað + opið, svo 6H S2 = 256). Heildin fór við það úr 91 % í 86 % (6H 100 → 95 %, því S4/S5 hafa enga rafmagnsskráningu og
  188 kláraðar á `6H 2S-1S Rafmagnsþéttingar` eru „Án deildar" og teljast ekki á álmu). Raufar við kantaða stokka eru enn án markmiðs.
  Hub-síðan (`brunaholf/js/nlsh-sections.js`, `RAF_TGT` + `hlutaStada`) fékk sömu reglu og hlutatöflu 11.11.2026 (brunaholf a0129d3).
- **Aukaverk sér (11.11.2026):** skráningar á teikningu sem heitir „…Viðbótarverkefni" (`AUKA_RE`, teikning 12: 81 kláruð, 4 opin)
  eru í sér kafla, utan stöðutaflna og — sjálfgefið — utan útboðssamanburðar. Hakið „Telja aukaverk með í útboðssamanburði"
  (`gogn.aukaverk_med`) setur þau aftur inn í flokkatalninguna.
- **Hlutar deildar:** hver skráning ber `ajour_gogn.svaedi` = N | C | S (Norðurhlið, Center, Suðurhlið). Skýrslusíðan sýnir þá ekki
  enn; hönnunin í Claude Design (Stöðuskýrsla NLSH) gerir það (skil við 27,5 % og 72,5 % af lengd álmu, mælt úr hnitum).
- ALDREI senda tölur úr þessari sýn sem „gildandi magn" án staðfestingar Agnars — útboðstölurnar eru upphafstölur.

## Apex Ajour: nafn, lógó og stækkun (14.11.2026)
- **Nafn:** „Ajour-Craft" → „Apex Ajour" í Kjarna (kjarni main f7a913a): valmynd, tólaskrá, skinn, síðutitlar sjö síðna. Stöðuskýrslan og
  prentsíðan óbreyttar viljandi (fara til annarra). Agnar: „Ajour-útgáfan mun heita síðar Apex … í bili Apex Ajour", „breyta síðan nafninu inn á Kjarna".
- **Lógó:** tillaga C valin („þetta er töff"). Í haus var það fyrst 36 px á hæð; Agnar: „eiginlega allt of stórt þarna" → ein lág lína
  (tákn + APEX + AJOUR), 18 px á hæð, 102 px á breidd; táknið eitt í síma 20 px (kjarni main 6b6d4ca). Skrár: `apps/slokkvitaeki/public/apex/`.
- **Stækkun á gatakorti:** Agnar: „geta zoomað alveg og full stjórn á öllu". Mælt á lifandi síðu í símabreidd (390 px): mesta stækkun var um
  3,5 m þvert yfir skjáinn (200 mm veggur = 22 px). `kMest` í KortClient: aldrei minna en 6 skjápixlar á grunnpixil → um 1,6 m (veggur 48 px).
  10 var prófað: einn veggur fyllti skjáinn, nýtist ekki. Tölva óbreytt. (kjarni main 05967e2)
- **Ósvarað:** hvað „þægilegt vinnubreytinga-layout" og „full stjórn á öllu" á að ná yfir (gatakortið í síma eða Vinnusíðan; hvaða aðgerðir
  vantar). Skráningum er enn aldrei breytt úr gatakortinu.

## Opna fyrir breytingar á skráningum (14.11.2026) — `skr_verk.stillingar`, `skr_skraningar.handvirkt`
- **Orð Agnars:** „helst að losna við kjánaleg höft sem stoppa mann í eðlilegri vinnu … þarf ekki allt að vera sjáanlegt. Kannski bara einhvers
  staðar í stillingum að ég geti opnað á sem flesta hluti sem eru að stoppa mann til að breyta einhverju, skrifa, stærðir, flokkar, texta, heiti".
- **Hvað:** Stillingar neðst í „Lög og síur" á gatakortinu: hak „Opna fyrir breytingar á skráningum" (sjálfgefið lokað). Opið: flokkur og stærð,
  staða (Klárað/Opið), lýsing og athugasemd breytanleg á völdum punkti. Kjarni main 87c3e20; migration `skr_handvirkt_stillingar` (tveir dálkar, viðbót).
- **Skrif:** `update skr_skraningar set <svið>, handvirkt` + `insert skr_atburdir` (hvad flokkur | stada | texti, gogn {svid, fra, til, uppruni: 'gatakort'}).
  `handvirkt` = { <svið>: { fra, hvenaer } }; sé gildið sett aftur á upprunalegt hverfur lykillinn. `-innflutningur.cjs` hlífir sviðum í `handvirkt`
  (flokkur_id, stada, lysing; athugasemd flytur hann ekki inn). Stöðuskýrslan: liður „Handbreytt í Apex Ajour" í afstemmingu ef eitthvað er breytt.
- **Prófað** í gegnum viðmótið á tölvu- og símabreidd með öll skrif gripin (ekkert fór í grunninn). Sýnirnar `skr_yfirlit`/`skr_hub_skraningar`
  töldu 10.709 fyrir verk 4 og 37.261 alls fyrir breytinguna; dálkaviðbót breytir því ekki.
- **Ekki opnað (viljandi, segja Agnari ef hann rekst á það):** heiti verks og yfirlitsblaða (sex tól finna verkið á heitinu „NLSH 5-6. hæð · gatakort"
  og blöðin á „Brunayfirlit <hæð>"; nafnbreyting myndi brjóta þau), starfsmaður og dagsetning á skráningu, heiti flokka (síðan Categories/schema).
- **Eftir flokkabreytingar:** `-para.cjs --haed … --write`; táknið á kortinu uppfærist við næstu hleðslu.

## Stærð og litir tákna í Stillingum (14.11.2026) — `skr_verk.stillingar.taknStaerd`, `.litir`
- **Orð Agnars:** „Stækka minnka icons slider, táknin kannski, litir á táknum". Og um „of stórt": „Meinti þá iconin. En þú síðan breyttir þeim. Svo allt í lagi."
- **Hvað:** sleðinn „Stærð tákna" (50–250 %) og litareitur við hvert tákn sem er á kortinu, með „Upprunalegir litir". Vistast á verkinu, eins á öllum
  tækjum; breytir aðeins útliti. Kóði: `tk` (margfaldari á `zs` og `merkisR`) og `LITIR` (lykill = heiti tákns, t.d. „Loft 125-160") í KortClient.
- **Prófað** með skrif gripin: sleði 100 → 200 %, litur breyttur og endurstilltur; sendingarnar réttar. Stöðuskýrslan notar sína eigin liti (óbreytt).

## Eitt merkjasett og neongræn fylling (14.11.2026)
- **Sömu merkin alls staðar** (kjarni main d677d7b). Agnar: „Af hverju ertu að nota sitthvor merkin … X í öðru og plúsmerkið mitt í öðru. Erum búnir að eyða
  gríðarlegum tíma að gera hitt fínt." Merkjastíll símans (útlína í lit stærðar, ✓ per klárað stakt verk) er nú líka á tölvu (`miro` í KortClient), og
  táknalistinn og litalistinn nota `MerkiSvg`. Gömlu X/fylltu táknin (`TaknSvg`, else-greinin í teikningunni) eru aðeins á bak við
  `skr_verk.stillingar.eldriTakn` (ekkert viðmót). **Aldrei smíða nýtt viðmót með gömlu táknunum.** Sannreynt á lifandi tölvusýn.
- **Neongræn fylling = tilbúið** (kjarni main 921d393). Agnar: „Í staðinn fyrir þennan stóra tígul yfir þegar eitthvað er ready. Er ekki hægt að setja
  neongrænt innfill inn í táknin." Merki fyllist (`NEON_FYLL`) þegar ekkert er opið, hinn endann vantar hvergi, og bæði stöku verkin eru kláruð eða ein
  skráning er öll lokunin (gólf, plata samkvæmt myndgreiningu). Græni tígullinn (parað áætlað gat, „fullt") er ekki teiknaður lengur í þessum stíl;
  guli tígullinn („vantar hluta") og rauðu punktarnir eru óbreyttir. Skýring: „Tilbúið" í neðri stiku símans og setning í hliðarstiku tölvu.

## Litakerfi merkjanna: grænt, gult, rautt (14.11.2026) — kjarni main e008ff5
- **Orð Agnars** (eftir neonfyllinguna, „er þetta ekki skýrara svoleiðis"): „En öll hin merkin, geturðu eitthvað gert öðruvísi útgáfu þar í samræmi.
  Til að reyna gera allt skýrara og augljósara."
- **Reglan:** fyllingin í merkinu segir stöðu lokunarinnar. Grænt (`NEON_FYLL`) = tilbúið · gult (`GULT_FYLL`) = hálfnað (klárað öðrum megin, eða sumt
  klárað og annað opið) · rautt (`RAUTT_FYLL`) = opið (ekkert klárað). Hálfnað er aðeins metið á yfirlitsblaði. Rauði hringurinn er aðeins á blönduðu
  merki. Parað áætlað gat (aðeins ef „Sýna líka áætluð göt sem eiga skráningu" er á) er lítil brotin útlína. Hök, rautt ✕, gult „?" og tölur óbreytt.
- **Hugmyndin sem hann staðfesti:** staða sést Í merkinu (fylling), ekki með stærra tákni ofan á því. Sama regla á við ný merki framvegis.
- **Óbreytt:** rauður punktur (eftir, óskráð), appelsínugulur „?" (tillaga), kerfispunktur við merkið, stöðuskýrslan (hún notar sína eigin punkta).

## Hvað rennur saman í eitt merki (14.11.2026)
- **Orð Agnars:** „Smá hættulegt með þetta 3x 4x … hvort það séu endar á öðrum eða aðrar stærðir, eða viðgerð."
- **Mælt á sama svæði (6H, símabreidd):** merkið tók STÆRSTU stærðina og taldi allt með. „630 ×4" var 630 og 315; „315 ×3" var 315 og 160.
- **Nú:** í vinnustækkun (Rs ≥ 7) rennur aðeins sama stærð saman, og lagfæring skráð sem nýtt verk (`lagf = 'A'`) er alltaf sér merki með brotinni
  útlínu og telst ekki í „×n". Merki sem lenda á sama stað hliðrast meðfram veggnum (aðeins teikningin). Reglur um hinn endann eru ÓBREYTTAR fyrir
  lagfæringar, svo talningin „Hinn endann vantar" passar við merkin. Yfirlit (Rs < 7) óbreytt.
- **Prófað og hafnað sama dag:** að skipta líka sömu stærð í eitt merki per lokun (mest tvö stök verk, endar hvort annars). „160 ×5" varð fimm merki í
  röð fjarri réttum stað, hvert með tvö hök (seinna hakið kemur af `hinnKlar`), sem leit út eins og fimm kláraðar lokanir. Einnig hafnað: að láta
  lagfæringu sleppa ✕ og verða sjálfkrafa græn; þá hefði talningin ekki passað við merkin.
- **Eftir stendur:** „×n" af sömu stærð án lagfæringa segir ekki hvort verkin eru endar sömu lokunar eða tveggja. Pikk á merkið sýnir númerin („Í sama merki").

## Merki hinna tegundanna: lýsing Agnars (14.11.2026) — ÓÚTFÆRT í kortinu
- **Mock-up:** þrjár tillögur hönnunarlotu (A fjölskylda plússins, B hluturinn sjálfur, C klasar) í `kjarni/apps/slokkvitaeki/docs/apex-merki-tillogur/`
  og í Claude Design: https://claude.ai/artifact/5MMdaWA8kQ14WKuFVJzQhn (Brunahólf V2; arkir Main, Simi, TillagaA–D).
- **Orð Agnars eftir að hafa séð þær:** „Milliloft. Já fínt kassi með V-inu innan í þegar tengt … rafmagn tígull með rafmagnseldingu … sprinkler eru svo oft
  bara stakir svo eitthvað annað … tveir hringir saman sniðugt fyrir vatn og hita sem er 80% alltaf í pörum. Þá kannski eins og 2 × 8-ur á hlið til að
  túlka þessi 4 rör meðfram endunum báðum megin í sitthvorum svipuðum litum."
- **Tillaga D (mín útfærsla á þessu, örk TillagaD):** milliloft = kassi, hakið fer INN í hann þegar klárað (ekkert hak utan við) · rafmagn = tígull
  með eldingu · úðakerfi = stakur hringur með punkti · vatn og hiti = tveir hringir saman (átta á hlið) per par; fjögur rör = tvær áttur hlið við hlið
  eftir veggnum, hvor í sínum tóni af sama lit · plaströr = átta með punkti í hvorum hring · loft raufar = tvö samsíða strik · plús óbreyttur.
- **Afleiðing fyrir útfærslu:** rör skiptast þá eftir KERFI (úði / vatn og hiti), ekki efni (stál / plast). Kerfið er aðeins þekkt þar sem `skr_kerfi`
  eða myndgreining (`visbendingar.json`) segir til; óþekkt kerfi þarf hlutlaust merki. Óstaðfest hjá Agnari: hvar áttirnar tvær eiga að standa
  („meðfram endunum báðum megin") og hvaða litatónar.
- **Viðbót Agnars sama dag um raufar:** „En metrar kringum ferkantaða loftræstingu. Mætti svona svipast sem plúsinn eða jú kannski bara kassa. En er í
  þeim flokk." → Loft raufar (metrar) eru LOFTRÆSTING og eiga að vera í fjölskyldu plússins: liggjandi kassi með sömu útlínu og plúsinn, metrarnir inni í,
  hök utan við eins og á plúsnum. Greinist frá millilofti (ferningur, hak inni í, annar litur) á lögun og lit. Uppfært á örkinni TillagaD.

## Tillaga D komin í kortið (14.11.2026) — kjarni main, commit „Gatakort: merki tillögu D"
- **Orð Agnars til viðbótar:** „Setja fyrir 2 x 2 á brunavegginn. V check sitt hvorum megin" og (með tveimur myndum af Miro-borðinu, blómhringir með „2" í
  rauðu, bláu, appelsínugulu og ljósbláu, „2pl hvitt") „Eru almennt 2 og 2 saman. 2x heitt og 2x kalt."
- **Útfært í KortClient (`merki`):** stálrör eftir KERFI (`kerfiKort` úr `skr_kerfi` án vafa: 1.135 úði, 4.176 vatn mælt 14.11; úrskurður af ljósmynd í
  `visbendingar.json` gengur fyrir): úði = hringur með punkti · vatn og hiti = átta (`attur`) þvert á brunavegginn · 3+ rör á staðnum = tvær áttur (2 × 2)
  á veggnum, `HEITT` rauð og `KALT` blá · óþekkt kerfi = blómhringur með fjölda. Plast = átta með punktum (2 × 2 í tveimur tónum af stærðarlitnum).
  Rafmagn = tígull með `elding`. Milliloft = kassi, hakið inni í (ekkert hak utan við). Loft raufar = liggjandi kassi. Úði og vatn renna ekki saman í merki.
- **Fyrirvarar:** (1) rautt/blátt í 2 × 2 er TÁKNRÆNT; gögnin segja ekki heitt eða kalt. (2) Fjöldi röra er metinn af fjölda stakra verka í merkinu
  (hæsta tala á annarri hlið, annars helmingur), ekki talinn. (3) Stærðarliturinn sést ekki á 2 × 2 stálmerkinu; pikk sýnir flokkinn. (4) Fagsýnirnar
  „Úðakerfi" og „Vatn og lagnir" sía enn aðeins eftir úrskurði af ljósmynd, ekki eftir `skr_kerfi`, svo vatnsáttur sjást í úðasýninni. (5) Metrar í
  raufamerkinu eru ekki sýndir (talan er í athugasemd skráningar, ekki sótt á kortið).
- **Prófað** á þróunarþjóni með skrif stöðvuð (Vatn og lagnir, Úðakerfi, tölvusýn, val á punkti); engar villur.

## Eitt aðalmerki á hverju gegnumtaki (14.11.2026) — kjarni main ad14f49
- **Orð Agnars:** „Mættir reyna að það komi bara eitt aðalmerki akkúrat á gegnumskurðinn. Síðan dregur maður Ajour-punktinn að honum til að fá V …
  séu kannski í öðrum lit þegar ótengd. Og aðalmerkin liggja ekki á hvert öðru."
- **Útfært í KortClient (hópunarlykkjan, vinnustækkun Rs ≥ 7):** loftræstiskráning sem á nema (`endar.get(id).nemi`) rennur í EITT merki per nema og stærð,
  og merkið stendur á nemanum sjálfum (miðlína brunaveggjar þar sem stokkurinn fer í gegn), ekki á meðaltali punktanna. Hökin sitt hvorum megin eins og áður.
- **Ótengdur punktur:** loftræstiskráning án nema sem er innan `OTENGD_PX` = 45 px frá einhverjum nema er teiknuð sem lítill grár plús (`OTENGT`), án stöðu.
  Dregin að merkinu í færsluham smellur hún á nemann (gamla smellireglan, `SMELL_NAER`) og gengur þá í aðalmerkið. Skráning fjær öllum nemum teiknast eins og áður.
- **Færsluhamur:** auð gegnumtök (nemi án skráningar) sjást sem daufar brotnar plúsútlínur, svo vitað sé hvert má draga.
- **Pikk:** finnist engin skráning undir fingrinum velst sú tengda skráning sem er næst pikkinu og á nema innan `mork × 1,4`.
- **Skýring:** „Ótengdur punktur (n)" með fjölda á sýndum punktum (110 í loftræstisýn á yfirlitsblaðinu sem opnast fyrst, mælt 14.11; í færsluham aðeins virka deildin).
- **Stilling:** „Eitt aðalmerki á hverju gegnumtaki" (`skr_verk.stillingar.adalmerki`, sjálfgefið á).
- **Skörun:** gamla hliðrunin (Loft-merki innan 1,9 R færð 2,1 R meðfram vegg) gildir áfram, líka fyrir tvær stærðir á sama nema.
- **Takmörk:** nemar eru aðeins til fyrir loftræstingu á yfirlitsblöðum (5H/6H); rör, rafmagn og gólf eru óbreytt. Ótengdur punktur sýnir EKKI hvort verkið er
  opið eða klárað fyrr en hann er tengdur.
- **Prófað** á þróunarþjóni í símasýn: grár punktur (#5356) valinn í færsluham og dreginn 12 px að merkinu, teljarinn fór 24 → 23 og hakið birtist; skrifin
  (`PATCH skr_faerslur`) fengu gervisvar, ekkert fór í grunninn. Prófunarskriftur: `apex_adal_prof.cjs`, `apex_adal_drag2.cjs` (scratchpad lotunnar).

## Flýtileiðir með Apex-tákninu (15.11.2026) — kjarni main 9ebdb59
- **Orð Agnars:** „Hver er linkurinn á aðalkerfið og síðan reportkerfið. Gæti ég downloadað shortcut með apex merkingu" og, þegar ég ætlaði að gera skýrslutáknið
  appelsínugult: „Oj. Nei eins og logoið. Hvíta og síðan bláa útgáfan." → táknin eru lógóið óbreytt: hvíta útgáfan = aðalkerfið, bláa = skýrslan. Engin ný litaafbrigði.
- **Útfært:** `public/apex/kort.webmanifest` (Apex Ajour, `/kjarni/skraning/kort`, hvítt tákn) og `public/apex/skyrsla.webmanifest` (Apex skýrsla,
  `/kjarni/skraning/skyrsla?kynning=1`, blátt tákn); `manifest`, `appleWebApp` og `icons` í `kort/page.tsx` og `skyrsla/page.tsx`. Tákn: `icon-192/512`,
  `icon-maskable-512`, `apple-touch-icon`, `apex.ico` (og `skyrsla-` afbrigðin), smíðuð með `apex-logo/takn.cjs` (scratchpad lotunnar).
- **Ósnert:** `public/skraning/manifest.webmanifest` (vinnuútgáfan `/vinna`, eldra pinnatákn) er á sviði `skraning`.
- **Skjáborð skrifstofuvélar:** `Apex Ajour.url` og `Apex skýrsla.url`, tákn í `%LOCALAPPDATA%\ApexAjour\`.

## Áttur alltaf á hlið (15.11.2026) — kjarni main 479ef69
- **Orð Agnars:** „2 x 2 áttu að vera 8 á hlið x 2 vatnslagnir... tígull með eldingu fyrir rafmagn stakur. Já flott merki."
- **Var:** áttan lá ÞVERT á brunavegginn, svo hún stóð upprétt (8) við láréttan vegg og 2 × 2 varð tvær uppréttar áttur hlið við hlið.
- **Nú:** `attuMidjur` / `attur` taka ekki lengur stefnu veggjar. Rörapar = ein átta á hlið (∞); 2 × 2 = tvær áttur á hlið, hvor ofan á annarri með bili (0,62 R),
  rauð (`HEITT`) og blá (`KALT`) á stálrörum. Hökin fylgja veggnum áfram (ofan og neðan við láréttan vegg).
- **Rafmagn:** óbreytt, stakur tígull með eldingu (sannreynt á lifandi síðu).
- **Opið:** stálrör með ÓÞEKKT kerfi teiknast enn sem blómhringur. Mælt 15.11: 381 af 5.692 stálskráningum á verki 4 eiga enga `skr_kerfi`-röð án vafa
  (4.176 vatn, 1.135 úði). Spurt Agnar hvort þau eigi líka að verða áttur.

## Klípa á hæðarteikningum skýrslunnar (15.11.2026) — kjarni main 4b429ee
- **Orð Agnars:** „Zoom pirringur. Get ekkert pinch-zoomað kringum teikningarnar, til að sjá aðeins betur.. og í að sjá stærra næ ég engan veginn að zooma nægilega mikið."
- **Orsök (mæld í símahermi á lifandi síðu fyrir breytingu):** `Haedarkort` í `skyrsla/Haedir.tsx` studdi ENGA klípu á snertiskjá (aðeins +, tvísmell, Ctrl + skrun),
  `touch-action: pan-y` lokaði á klípu síðunnar yfir teikningunni, og þakið var fast 8×. Tíu klípur skiluðu scale(1).
- **Nú:** snertiatburðir (`touchstart`/`touchmove`, ekki passive) á `.sk-hk-mynd`: tveir fingur stækka um miðjuna á milli sín og færa teikninguna með sér; eins fingurs
  drag og val á punkti óvirkt þar til allir fingur eru farnir af (`klipa.current`). Þak `zMest` = 3 skjápixlar á pixil teikningar, 8–60× (52× í 334 px glugga).
  Einn fingur skrunar síðunni áfram í fullri sýn. Gatakortið: tveir fingur færa nú líka blaðið meðan klipið er (`drag.current.mx/my`).
- **Prófað** með CDP `Input.dispatchTouchEvent` (tveir snertipunktar) í símahermi, prófunarþjónn og lifandi síða: 1 klípa → 4×, 3 → 52× (þak), tveggja fingra
  færsla breytir hliðrun, klípa inn → 1×, eins fingurs strok skrunar síðunni (2857 → 3042). Prófunarskrifta: `apex_klipa_skyrsla_prof.cjs` (scratchpad lotunnar).
- **Óvíst:** ég gekk út frá því að hann ætti við skýrsluna (þar var klípan dauð); á gatakortinu virkaði klípan í hermi fyrir breytingu. Myndin sjálf er 5.790 px breið,
  svo dýpsta stækkun er óskýr; skarpari mynd þyrfti hærri upplausn á yfirlitsblaðinu. Óprófað í síma Agnars.

## Aðalmerki endurskoðuð: breiðir nemar, smellur, klofin pör (15.11.2026) — kjarni main f36e6ee + 35db290
- **Orð Agnars (þrjú skjáskot af 6H úr símanum):** „Nú get ég ekki fært helvítis draslið. Og punktarnir minnka svo extreme með", „af hverju í andsk. splittast þetta upp...
  eru þetta 2 eða 4 göt", „og 5x andskotans hvað", síðar „5x götin eru líklegast út af hurðinni til hliðar. Ætti bara vera 1 par á veggnum sjálfum."
- **Mælt:** neminn við #5974 (6H, vísir 875) er á (1520,9; 954,1) með hb = 20,5 → 41 px = 1,2 m breiður meðfram veggnum. Nemar eru oft breiðari en eitt gegnumtak:
  hb miðgildi 7,5, mest 31,9; breiðari en 0,6 m: 133 af 514 á 6H og 101 af 489 á 5H; breiðari en 0,9 m: 76 og 56. Fyrsta útgáfa aðalmerkja (ad14f49) setti merkið á
  MIÐJU nemans og gamli smellurinn dró dreginn punkt alltaf þangað, svo punktur komst ekki að raunverulega stokknum 9 px ofar.
- **Lagað í KortClient:** (1) `smella` færir punkt aðeins ÞVERT á vegginn (SMELL_PX frá miðlínu); meðfram veggnum stendur hann þar sem honum var sleppt, innan hb.
  Nær mest `min(14, 30/k)` px frá vegg. `fest` = handfærð og SMELL_PX frá miðlínu, hvar sem er innan nemans. (2) `adalKlasar`: skráningar sama nema og stærðar
  flokkaðar eftir stöðu meðfram vegg (bil > `KLASA_BIL` = 6 px → nýtt merki); merkið á miðlínu veggjar við meðalstöðu klasans. Handfærð skráning sem er ekki fest er
  ekki í klasa. (3) Tveir endar sömu lokunar án nema (`hlid = hinum`, innan `PAR_PX` = 12 px) eru eitt merki í hvaða stækkun sem er (`hopAf`); áður klofnaði parið í
  tvö merki með tvö hök hvort þegar D = 2,4 R varð minna en bilið. (4) „Ótengdur punktur" er aðeins stakur punktur við nema: par á vegg og handfærður punktur eru
  venjuleg merki. (5) `merkisR` vex áfram eftir 13 px, upp í 22 px í dýpstu stækkun. (6) „Í sama merki (n stök verk): #…" telur upp klasann.
- **„160 ×5" við #5974:** #522, #555, #561, #712, #3888 (Loft Ø125-160, allar kláraðar, 06.10.2025–06.03.2026). Ajour-staðir þeirra: x 1502–1546, y 910–925, þ.e. í röð
  meðfram LÁRÉTTA veggnum ofan við, en sjálfvirka færslan (12.11.2026) setti þær allar á efri enda breiða nemans á lóðrétta veggnum (y ≈ 934–937). Agnar: þær eiga
  heima við hurðina, á veggnum sjálfum á aðeins að vera eitt par. Færslurnar fimm eru ÓBREYTTAR; spurt hvort eigi að taka sjálfvirku færsluna af þeim.
- **Almenn hætta:** sjálfvirka færslan (`skraning-gatakort-*`) treystir nemum; á breiðum nemum getur hún hafa sett punkta á rangan vegg. Ómælt hve víða.
- **Stöðuskýrsla (Haedir.tsx):** klípa hlustar á alla hæðina (.sk-hk-haed) og lok hennar á glugganum; fyrsta útgáfan (4b429ee) læsti færslu og vali ef fingur lenti
  utan teikningar. Punktar stækka sem z^0,75 (mest 14 px) í stað z^0,45.
- **Prófað** á prófunarþjóni og lifandi síðu í símahermi, skrif með gervisvari: #5974 valin í færsluham og dregin 9 px upp → `PATCH skr_faerslur {x 1524,8; y 945}`
  (áður hefði hún farið á 954,1); pikk á ×5 merkið telur upp skráningarnar; parið #8656/#10835 við (4041, 546) er eitt merki í dýpstu stækkun.
  Prófunarskriftur: `apex_adal2_prof.cjs`, `apex_klipa_skyrsla_prof2.cjs`. Óprófað í síma Agnars.

## Ótengdir punktar sem full merki (15.11.2026) — kjarni main 141521e
- **Orð Agnars (skjáskot af 6H S1 í færsluham, dýpsta stækkun, hringað um stokk gegnum láréttan vegg með tveimur litlum gráum plúsum):** „Hvernig í andsk. á ég að sjá þetta."
- **Var:** ótengdur loftræstipunktur = plús í 0,6 R, hvít fylling, grá útlína, engin stærð, engin staða. Auð gegnumtök í færsluham = dauf grá brotin útlína (sást ekki á rauðum vegg).
- **Nú:** ótengdur punktur fer um venjulegu hópunina með `ot = true` og teiknast sem FULLT merki (stærð, stöðufylling, hök); aðeins útlínan er grá (`OTENGT` #475569) í stað
  stærðarlitar. Ótengd merki renna aðeins saman við önnur ótengd, aldrei við aðalmerki. Auð gegnumtök í færsluham: svört brotin lína á hvítu undirlagi þvert yfir breidd
  stokksins á miðlínu veggjar.
- **Athugað:** á staðnum í skjáskotinu er ENGINN nemi á stokknum sem hringað var um (punkturinn hefði annars tengst); „ótengt" segir því aðeins að nemagögnin þekki ekki
  þetta gegnumtak, ekki að punkturinn sé á röngum stað. Nemar ná ekki öllum gegnumtökum.
- **Prófað** á prófunarþjóni og lifandi síðu í símahermi (grá útlína fannst á lifandi mynd við (399, 250) í `a4lif_naer.png`). Óprófað í síma Agnars.

## Skörun, samruni og stærðarsleði (15.11.2026) — kjarni main 864ca0d
- **Orð Agnars:** „Merkin eiga ekki að overlappa. Nema þetta sé bara viðgerð á sama gati. Geturðu bara sett inn stýringu fyrir merkjastærðir slider eða að lágmarksstærð sé
  svipuð og veggjaþykktin. Af hverju er oft 4x til 6x í sama merkinuuu."
- **Mælt (lesaðeins, `maela_klasa.cjs` í scratchpad lotunnar; færðar loftræstiskráningar með nema, án raufa):** 6H: 842 skráningar, 233 án nema, 403 merki á vegg:
  232 með 1, 153 með 2, 13 með 3, 4 með 4, 1 með 5. 5H: 586 skráningar, 164 án nema, 289 merki: 169 / 114 / 4 með 3 / 2 með 4. Aðeins 18 + 6 merki eiga í raun 3+ skráningar;
  í 12 af 18 á 6H eru Ajour-staðirnir dreifðir yfir meira en 0,6 m (sjálfvirka færslan safnaði þeim saman).
- **Svar við „4x til 6x":** samrunafjarlægðin var 2,4 R, sem er 0,5–0,9 m á blaðinu þegar ekki er stækkað alveg inn (k ≈ 1–2); tveir til þrír stokkar hlið við hlið urðu
  eitt merki. Nú `D = max(D_FAST = 8 px, 1,2 R)` í nærmynd.
- **Skörun:** öll merki í nærmynd (allir hópar) ýtast í sundur í allt að 12 umferðum þar til miðjubil er 2,05 R, mælt með hakaásinn þjappaðan um 1,7 (hökin standa 1,5 R
  til hliðar, eða ofan og neðan við láréttan vegg); mest 3,5 R frá réttum stað. Lagfæring og merkið sem hún lagar mega skarast (0,9 R). Gamla hliðrunin (aðeins Loft,
  2,1 R í eina átt, allt að 6 sinnum) er farin: hún hafði fært merki allt að 12 R niður eftir veggnum, langt frá réttum stað.
- **Stærð:** sleðinn „Merki" efst til vinstri á kortinu (`.gk-msledi`, sami `stillingar.taknStaerd` og í Stillingum, 0,5–2,5). `merkisR` ≥ `VEGG_THYKKT / 2 × k` (5,6 px).
  Nærmynd (`naerm`) ræðst af stækkuninni einni, ekki sleðanum. Pikk velur fyrst úr merkinu sem er TEIKNAÐ undir fingrinum (`merkiRef`).
- **Leiðrétt:** #5974 var fært með hendi 14.11 kl. 23:47 UTC (í þessari lotu), ekki kvöldið áður; #4739 og #4742 færð 15.11 kl. 00:07–00:08 UTC.
- **Prófað** á prófunarþjóni og lifandi síðu í símahermi: minnsta miðjubil merkja mælt 2,05 R (k = 0,861, 23–24 merki í sýn); drag á #5974 og pikk á ×5 virka áfram.
  Þekkt: í þéttustu klösunum standa merki allt að 3,5 R frá réttum stað þar til stækkað er inn; merki við jaðar skjás geta hnikast þegar hliðrað er. Óprófað í síma Agnars.

## „160 ×6" við Einangrunarstofu snertismit (15.11.2026) — kjarni main 41c3733
- **Agnar** sendi klippu úr prófunarmynd minni með rauðum hring um „160 ×6" (6H, veggur milli Einangrunarstofu snertismit og Gáttar snertismit, blaðhnit um (669, 1527)).
- **Mælt (lesaðeins, `maela_stad.cjs` í scratchpad lotunnar):** merkið er #4056, #4167, #4057, #4601, #4058, #4595; allar Loft Ø125-160, kláraðar, Atli Már Heiðarsson, 09.03.2026.
  `ajour_gogn.tvitak_af`: #4167 af #4056, #4601 af #4057, #4595 af #4058, þ.e. þrjár skráningar sem hver er skráð TVISVAR á nákvæmlega sömu Ajour-hnitum.
  Staðir: (666,9; 1519,3), (668,2; 1530,6), (672,1; 1531,1) eftir sjálfvirka færslu. Á teikningunni er einn stokkur gegnum tvær vegglínur með um 11 px bili.
  ÓMÆLT hvort tvískráningin er hin hliðin á sömu lokun (pinninn afritaður) eða tvítekning; gögnin segja það ekki.
- **Á 6H alls (loft án raufa, 1.090 skráningar):** 7 merktar tvítak, 75 merktar lagfæring. Merki innan 8 px og sömu stærðar: 615 með 1, 182 með 2, 19 með 3, 11 með 4,
  2 með 5. Af 32 merkjum með 3+: 3 með tvítaki, 9 með lagfæringu, 20 með hvorugu.
- **Breytt:** spjaldið sýnir efst „Í þessu merki: n stök verk á m stöðum („=" merkir sömu hnit í Ajour): #a = #b · #c = #d …" (`hjaTexti`, `hjaStadir`; flokkað eftir
  Ajour-hnitum x0, y0 með einum aukastaf). Í dýpstu stækkun klofnar merkið í ×2 (#4056 = #4167) og ×4.
- **Mistök á leiðinni:** fyrsta tilraun til að færa línuna efst færði RANGA línu (rauðröra-ábendingin ber líka klasann `gk-hja`); séð á prófunarmynd og leiðrétt áður en birt var.

## Hvert loftræstimerki er ein lokun (15.11.2026) — kjarni main, commit „Gatakort: hvert loftræstimerki er ein lokun, ×n aðeins við beina tilvísun"
- **Orð Agnars:** „Jú mætti brjóta upp allar svona 4x-6x bull. Nema það sé bein tilvísun í lýsingu í það gatanúmer um að þurfti að endurgera gatið, eða laga. Þetta er
  byrjað að líta betur út."
- **Mælt:** af 10.709 skráningum verksins eru 1.253 með lýsingu og 38 vísa í gatanúmer („lagfæring #926", „repair #471", „Repair work on point 5733", „aukaverk laga aftur
  punkt 465", „Repairing hole #3902", „yfirfara gat númer #4457"); 35 þeirra eru merktar lagfæring. Stærðir í lýsingu („650 x 400", „2.1metrar") eru ekki tilvísanir.
- **Regla í KortClient (nærmynd, hópur Loft):** merki með 3+ stök verk er brotið upp í lokanir, mest tvö verk hver, í röðinni (a) sömu Ajour-hnit (pinninn skráður tvisvar),
  (b) hinn endinn samkvæmt `endar`, (c) næsta skráning innan `PAR_PX` = 12 px, annars stakt merki. Skráning sem vísar í gatanúmer (`TILV`, `tilvisanir`, sótt við ræsingu með
  `lysing.ilike` á lykilorðin) fylgir lokun þess gats; það er eina ástæðan fyrir „×3" eða hærra. Skörunarvörnin raðar lokunum hlið við hlið.
- **Dæmi:** „160 ×6" við (669, 1527) → þrjú merki: #4056 = #4167, #4057 = #4601, #4058 = #4595. „160 ×5" við #5974 → þrjú merki (2 + 2 + 1).
- **Ósnert:** rör (2 × 2 merkið telur áfram pör), rafmagn, gólf og yfirlitsstækkun. Lagfæring A er áfram sér merki með brotinni útlínu.
- **Liður (c) er nálgun:** tvær skráningar innan 12 px eru settar í eina lokun án þess að gögnin segi að þær séu sitt hvor hliðin. Pikk á merkið sýnir númerin.
- **Prófað** á prófunarþjóni og lifandi síðu í símahermi; engar villur. Óprófað í síma Agnars.

## Sjálfvirk færsla tekin af fimm skráningum við hurð hjá #5974 (15.11.2026)
- **Samþykki Agnars í spjalli:** „svo þær fari aftur á Ajour-staðinn, já" (svar við: á ég að taka sjálfvirku færsluna af skráningunum fimm við hurðina hjá #5974).
- **Skrifað (sama aðgerð og hnappurinn „Upprunaleg staða", engin hörð eyðing):** `update skr_faerslur set eytt = true where id in (31, 38, 39, 47, 356)`; skráningar
  #522 (470), #555 (503), #561 (509), #712 (653), #3888 (3424), allar `uppruni = sjalfvirkt` frá 12.11.2026, teikning 4 (6H). Til baka: `eytt = false` á sömu fimm línum.
- **Eftir:** þær standa á Ajour-stað sínum við lárétta vegginn (x 1502–1546, y 910–925), með grárri útlínu (enginn nemi þar). Á lóðrétta veggnum stendur #5974 ein og
  sýnir nú „hinn endann vantar" (rautt ✕): þar er aðeins EITT stakt verk skráð, ekki par. Áður taldi kortið eina af fimm sem hinn endann.
- **Pörun við áætluð göt (`skr_aaetlud.parad`) er ÓENDURREIKNUÐ** (síðast 12.11.2026 10:30). Þurrkeyrsla `skraning-gatakort-para.cjs --haed 6H` nú: fullt 639 (geymt 640),
  hluti 55 (55), vantar 50 (49), pöruð stök verk 1.861 (1.863). Munurinn nær til allra færslna síðan 12.11 (líka handfærslur Agnars). Spurt hvort eigi að keyra `--write`.
- **Ath.:** verði sjálfvirka færslutólið keyrt aftur fyrir 6H gæti það fært þessar fimm á ný; þá þarf að undanskilja þær (ókannað hvernig tólið fer með `eytt = true` línur).

## Eitt hak = eitt stakt verk í merkinu (15.11.2026) — kjarni main 57f17ae
- **Orð Agnars (skjáskot: blátt 160 á vegg og grátt 160 við hliðina, tvö hök við hvort):** „Þetta er brjálæðislega villandi þegar þú sýnir alltaf 2 V við merki. Þegar það er bara 1 V þarna."
- **Orsök:** frá 13.11 fékk seinna hakasætið hak ef HINN ENDINN var skráður og kláraður, líka þegar hann var teiknaður sem annað merki (`nh`). Tvö merki með einu verki
  hvort sýndu þannig fjögur hök. (13.11-kvörtunin, „sýnir næstum alls staðar að bara sé búið öðrum megin", var leyst með þessu og olli nú hinu.)
- **Nú:** hak eingöngu fyrir klárað verk Í merkinu (`tA`, `tB`; tvö verk sömu megin = tvöfalt hak). Sætið er autt ef hinn endinn er í öðru merki; rautt ✕ ef enginn endi finnst.
  Svo 13.11-málið komi ekki aftur renna tveir endar sömu lokunar handan veggjar (`hlid = hinum`) í EITT merki innan `ENDA_SAMAN_PX` = 30 px (= ENDI_PX ≈ 0,9 m) í stað 12 px;
  sama mörk fyrir „ótengdur punktur".
- **Ósnert:** neonfylling („Tilbúið") reiknast áfram með hinum endanum (`nh`), svo stakt merki með einu haki getur verið grænt ef hinn endinn, lengra en 0,9 m frá eða
  sömu megin án veggjar, er kláraður.
- **Prófað** á prófunarþjóni og lifandi síðu í símahermi: staðurinn úr skjáskotinu er eitt merki með einu haki hvorum megin; tvö 160-merki í herbergi við vegg (ekki handan
  veggjar) sýna eitt hak hvort. Óprófað í síma Agnars.

## Pörun endurreiknuð og leit að fleiri söfnuðum klösum (15.11.2026) — kjarni main, commit „Gatakort-pörun: tillögur parast ekki"
- **Leyfi Agnars:** „Já mátt halda áfram að matcha og stilla til."
- **Villa fundin í tólinu fyrir keyrslu:** `skraning-gatakort-para.cjs` paraði líka óstaðfestar tillögur (`uppruni = tillaga:*`, 71 á 5H) og hefði tekið skráningar frá raunverulegum
  götum (þurrkeyrsla sýndi 319 göt á 5H í stað 248). Lagað: `uppruni=not.like.tillaga:*` (uppruni aldrei tómur: miro 992, tillaga 71, vidbot 35).
- **4H EKKI keyrð:** tólið finnur 0 skráningar á 4H (gólfgötin eru pöruð með öðru tóli 12.11 kl. 19:18); `--write` hefði þurrkað 19 paranir.
- **Afrit** af öllu `skr_aaetlud.parad` (1.098 raðir) fyrir keyrslu: `afrit_parad_2026-11-150122.json` í scratchpad lotunnar.
- **Keyrt `--write` 6H og 5H (15.11 kl. 01:23 UTC):** 6H fullt 640 → 639, hluti 55 → 55, vantar 49 → 50 (nýtt: gat 156, loftræsting ×2 við (1516, 971), neðan við #5974);
  pöruð stök verk 1.863 → 1.861. 5H óbreytt: 222 / 16 / 10. Tillögur ósnertar (parad tómt).
- **Leit að klösum eins og við hurðina:** `maela_klasa2.cjs`: merki með 3+ stök verk á nema þar sem Ajour-staðir dreifast > 0,6 m: 10 á 6H, 3 á 5H. Þrír með mestu færslu skoðaðir
  með Ajour-staði sýnda (`stadir.png`): C (5H #5212/#6777/#3120 við (1873, 2671)) og B (6H #873/#536/#421 við (1874, 617)) líta rétt út, stokkurinn fer gegnum vegginn þar;
  A (6H #7783/#7639/#7638 við (4023, 334), allar færðar ~0,9 m til hægri) er óljóst. ENGU breytt; spurt Agnar um A.

## 15.11.2026 — Hurðalína sem Agnar dregur sjálfur (kjarni main 8ac749e)
Agnar: „möguleikann að draga bláa línu yfir sum dyragötin svo sé þægilegra að para saman“. Sjálfvirku hurðalínurnar (veggir/*.json „hurdir“, ~340 per hæð) ná ekki öllum dyraopum.
- Hnappur **Lína** (neðri stika í síma) / **Hurðalína** (tölva), aðeins á 5H/6H (þar sem veggjagögn eru). Dregið með einum fingri; endar smella að rauðum vegg innan 16 skjápx; pikk á línu → staðfesting → eytt.
- Vistað í `skr_verk.stillingar.hurdalinur["<teikning_id>"]` = flatt [x1,y1,x2,y2,…] í px blaðsins. Eins á öllum tækjum.
- Línurnar bætast við veggjanetið (`veggir.v`): skerVegg/fjarVegg/veggurLarettur → punktar sitt hvorum megin verða „hinum“ og renna í eitt merki. Nemar EKKI endurreiknaðir (python-tól); línan hefur því ekki áhrif á skráningar sem þegar eru á nema.
- Engin skráning, færsla eða pörun áætlaðra gata breytist. Prófað í símahermi á dev og lifandi vef, skrif gripin.

## 15.11.2026 — Staður A færður aftur á Ajour-staðinn (Agnar: „Já færa þá")
- 6H (teikning 4): sjálfvirku færslurnar 492 (#7638), 493 (#7639) og 502 (#7783) settar `eytt=true`. Þær höfðu fært punktana ~0,9 m til hægri, frá x≈3993 að x≈4023.
  Punktarnir standa nú á Ajour-staðnum (fra_x/fra_y). Engin röð í skr_aaetlud.parad vísar í þessar skráningar, svo pörun var ekki keyrð aftur.
- Mynd af lifandi korti eftir breytinguna: `stadurA-eftir.png` (scratchpad), engar villur á síðu.

## 15.11.2026 — Lagnir 5H sýndar yfir milliloftsþéttingum 4H
Agnar: „better to use 5th floor drawing on 4th floor milliloftaþettingar. Then the dots should fit better to the pipes from wc, zinks, showers".
- 4H (teikning 6) notaði þegar grunnmynd 5H, en lögin voru aðeins LÁNUÐ (falin þar til hakað, og aðeins á þeim skjá). 4H er 367 göt, öll „Gólf Ø 160-200" (194 af teikningu 10, 173 af 17).
- Nýtt eigið lag á 4H: skr_log id 13 = afrit af lagi 9 (5H M115 Vatnslagnir í lit: frárennsli grænt, kalt/heitt vatn), synilegt=true. Eins á öllum tækjum.
  Þar sem 4H á nú eigið lag hætta lánuðu lögin (M395, M195) að birtast þar. M195 (þrif/hiti/kæling, þykkar dökkar línur) skyggði á.
  Til baka: `update skr_log set eytt=true where id=13`.
- Engar skráningar færðar. Sjónmat á einu svæði (vinstri álma, um (500, 450)): sum göt sitja á frárennsli WC eða vasks, önnur eru 0,5 m eða meira frá lögn eða á gangi. Ekki mælt kerfisbundið.
- **Mæling (scratchpad `maela_4h_lagnir.py` → `maela_4h.json`, mynd `h4-verst.png`):** fjarlægð hvers 4H-gats (varpað með vorpun teikninga 10/17) að M115-pixlum.
  Að hvaða litaðri lögn sem er: miðgildi 0,23 m; ≤0,3 m 215/367, ≤0,5 m 270, ≤1 m 335, >2 m 4. Að grænu frárennsli: miðgildi 0,74 m; ≤0,3 m 112, ≤1 m 213, >2 m 100.
  Engin kerfisbundin skekkja: meðalvigur að næsta frárennsli er ~3 px (0,1 m) á báðum teikningum, svo vörpunin er rétt og hliðrun alls lagsins bætir ekkert.
  Fjærst: #5549 (4,4 m, utan húss neðst á blaðinu), #5558 og #9633 á brunavegg, #12053 á vegg við lyftu, #6304 í ræstiklefa, #5318 á miðju sjúkrastofugólfi. ENGU breytt.
  Fyrirvari: „lituð lögn" telur allt litað í M115 (líka litaða texta), svo sú tala gæti verið aðeins of hagstæð.

## 15.11.2026 — Eigið spjald fyrir viðbótarverk 4. hæðar í stöðuskýrslu (kjarni main 2a1356d)
Agnar: „bætt við 4. hæðar aukaverkefnin sem voru að byrja, sem þú púslaðir saman myndunum“ = stútarnir 35 (kaflinn VIÐBÓTARVERK Á 4. HÆÐ, 12.11).
- Nýtt spjald `stutaspjald` (SkyrslaClient, klasi `.sk-vidbot`, strikaður appelsínugulur rammi) á eftir hæðaspjöldunum. Klárað lesið LIFANDI úr skr eftir
  `parad.ids` (ekki `parad.skr.stada`, sem fraus við pörun 12.11). Lifandi 15.11: 11 af 35 þéttir (31 %), 8 skráðir ekki kláraðir, 16 án skráningar (7 stútar ekki komnir).
- Spjaldið er HLUTI af „Gólf 5. hæðar“ (357/505) og er ekki lagt við heildartöluna; textinn segir „Innifalið í gólfi 5. hæðar“.
- Sannreynt á lifandi skýrslu í símabreidd 412 px, engar villur á síðu.

## 15.11.2026 — Stútarnir í Apex eins og í skýrslunni (kjarni main c1c084e)
Agnar: „þessir guide points og aðrir gulir ókláraðir punktar, hvernig koma þeir fram í Apex“.
- Áður: óskráður stútur var venjulegur rauður eftir-punktur (úttektin sást aðeins í athugasemd), og síminn opnaðist í Loftræstisýn þar sem EKKERT sést á 4H.
- Nú: liturinn er Í punktinum (`STUT_LIT`, sami og `STUT` í Haedir.tsx): rauður = eftir að þétta, gulur = þétt í úttekt en skráningu vantar,
  hvítur með rauðum hring = stútur ekki kominn / ómetið. Skýringar í neðri stiku telja gulu og hvítu.
- Sími á 4H skiptir sjálfur í Gólf-sýn (og aftur í Loftræstingu af 4H). Gólfsýnin sýnir líka vatnslög blaðsins sem eru stillt sýnileg (4H: M115).
- Pöruðu stútarnir (19) sjást sem skráningar sínar (✓ / opið merki), ekki sem stútur. Sannreynt í símahermi á lifandi vef við S1-S (#6–#10).

### 15.11.2026 — Stútalitir skilgreindir betur (kjarni c969830)
Agnar: „mætti skilgreina betur, t.d. appelsínugulur eða fleiri litum“. Gult var tvírætt (Hálfnað-merki Ajour vs þéttur stútur án skráningar).
- Sama í Apex (`STUT_LIT`, skýringar `st-g`/`st-h`/`st-o`) og skýrslu (`STUT`, `HkStutar.ometid`, skýring `eo`):
  rauður = eftir að þétta (3), **appelsínugulur #f97316** = þétt en skráningu vantar (3), hvítur m. rauðum ramma = stútur ekki kominn (7),
  **grár #94a3b8** = ómetið í úttekt (3; var áður sami litur og „ekki kominn").
- Talning 15.11 (verk 4): áætlun 1.098 göt (6H 744, 5H 319, 4H 35), 951 paruð, 147 án skráningar (134 rauðir + 13 stútar).
  Opnar Ajour-skráningar 236 (6H 16, 5H 206, 4H 10, Viðbótarverkefni-blað 4). Gul merki á korti = „Hálfnað“ (gegnumtak: eitthvað opið
  en eitthvað klárað, eða hinn endann vantar); merki þar sem ekkert er klárað eru „Opið“ (rautt). Fjöldi gulra merkja er ÓMÆLDUR (reiknast í biðlara).
- **LEIÐRÉTTING:** af 147 án skráningar eru 71 TILLÖGUR á 5H (`uppruni` 'tillaga:', appelsínugulur hringur með „?“, óstaðfestar), ekki rauðir punktar.
  Rauðir í raun: 6H 50 + 5H 10 + 4H 3 = 63. Ógert ≈ 236 opnar + 63 rauðir + 13 óskráðir stútar ≈ 312, auk 71 tillögu sem á eftir að meta.

### 15.11.2026 — Stöðusían „Ógert“ (kjarni 0419103)
Agnar: „get ég séð view með því sem er eftir“. Ný sía fremst á eftir „Allt“: opnar skráningar + áætluð göt án skráningar + áætluð göt sem vantar
hluta; kláraðar faldar. Talan á hnappnum = opnar + rauðir (án tillagna). Slóðin `/kjarni/skraning/kort?stada=ogert` opnar beint í síunni.
Sannreynt í símahermi á lifandi vef: 5H, Sýn: allt → „Ógert 216“ (206 opnar + 10 rauðir), Tilbúin 4.525, Í vinnslu 206, Eftir 10.
Síminn opnast í Loftræstisýn; til að sjá ALLT ógert þarf að velja „Sýn: allt“.


## 15.11.2026 — Ekki byrjað: rafmagn í 6 af 8 deildum og 5H S5 (teikningar + Ajour, ekkert skrifað)

Agnar: „held að mun meira sé eftir og ekki byrjað á jafnvel“. Procore skoðað aftur (Verkteikningar 5. og 6. hæð, 1.342 blöð): engin ný raf-blöð síðan 11.11; ný eru M215-08 rev F (10.11), M216-17 rev B, M115-02/-06 (27.10). Þakblöð (M117/M217/M317/M717, R1170, R6170) óskoðuð — útboðið er 5.–6. hæð.

Krossar raflagnaleiðar (lag R1150/R1160) við rauðan brunavegg, aðferð tillogur.py (`scratchpad/raf/rafkross.py`): 5H 353 (S1 83, S2 86, S4 93, S5 91), 6H 338 (S1 82, S2 80, S4 85, S5 91). Raf-skráningar í Ajour: 6H S1 133, S2 351, **S4 0, S5 0**; 5H S1 7, S2 66, **S4 0, S5 1**. → Rafmagn óbyrjað í hægra húsi beggja hæða og nær óbyrjað á 5H.
Loftræsikrossar: 5H S5 100 / 6H S5 87, en loftskráningar 5H S5 70 / 6H S5 263; stál 5H S5 318 / 6H S5 747; plast 145 / 262. → 5H S5 langt á eftir í öllum lögnum. Áætlun 5H nær aðeins yfir loftræstingu S1/S2 (Miro 5H1S/5H2S), svo rauðir punktar sjást ekki í S4/S5.
Gróft mat (hlutfall 6H, ekki mæling): raf ~1.500 skráningar eftir, 5H S5 ~740, 5H S4 loft ~60, raufar 5H ~90 → ~2.400 skráningar (~1.200 lokanir), ekki 312. Krossatalningin telur líka eitthvað á útvegg (rauð lína), svo hún er nálgun; samanburður hæða notar sömu aðferð.


## 15.11.2026 — 617 óbyrjuð áætluð göt sett inn (uppruni `teikning:<blað>-kross`)

Agnar: „Já, settu þá inn“. `scratchpad/raf/kross.py` (krossar lags við rauðan vegg) + `planta.cjs` (þurrkeyrt fyrst). Staður fær áætlað gat aðeins ef ENGIN skráning í sama flokkahópi er innan 60 px (1,8 m, skr_haedarhnit) og ekkert áætlað gat/tillaga sama hóps innan 30 px. fjoldi 2.
- rafmagn 5H 311 (S1 77, S2 51, S4 92, S5 91) · rafmagn 6H 174 (S4 85, S5 89; S1/S2 sleppt, búið)
- fravatn (græn lögn M115/M116 = frárennsli, flokkur Plast Ø35-50) 5H 23 · 6H 14
- loftræsting 5H S4/S5 29 · vatn 5H S5 26 · sprinkler 5H S5 40
Pörun (para.cjs) EKKI keyrð með --write: nýju punktarnir eru óparaðir = rauðir; þurrkeyrsla sýndi enga skráningu til að para við. Apex „Ógert“ (Sýn: allt): 5H Eftir 10 → 439, 6H 50 → 238.
LEIÐRÉTTING á mati fyrr í dag (~2.400 skráningar): krossar án skráningar eru 617 → ~1.234 stök verk ≈ 617 lokanir + eldri 63 rauðir + 236 opnar. 5H S5 hefur færri skráningar en 6H S5 en flestir krossar þar eiga skráningu innan 1,8 m.
Kragarör: frárennsliskrossar 5H 259 / 6H 277 (alls 536 ≈ útboð 600), en 236/259 og 263/277 eiga plast-skráningu nærri (oftast Plast Ø20-34). Agnar: forveggur (lagnaveggur) við klósettkassa í smíðum — grunar brunaheldan. Veggjayfirlit A400-20 rev D: IV-2.24 „flísar-lagnaveggur“ er skráður án EI-kröfu; IV-2.3 og IV-2.7 („veggur fyrir stærri stamma“) EI60. A400-21 „Veggjayfirlit – lagnir í vegg“ sýnir engar EI-kröfur. Hvaða veggtegund er við klósettin á grunnmynd (A255/A256): ÓMÆLT.
Procore-lög ekki á korti: R3150/R3160 Lágspenna, Smáspenna, R6150/R6160 Brunaviðvörun, R7150/R7160 Aðgangs-/öryggiskerfi, M715/M716 lyfjaloft hlutablöð, M515/M516 gólfhiti, U-Upphengjur, þakblöð.


## 15.11.2026 — Lágspenna, Smáspenna, Brunaviðvörun sem lög (skr_log, fag rafmagn, falin sjálfgefið)

Agnar samþykkti niðurhal: 107 blöð, 47,5 MB (R3150 20, R3160 16, R5150 18, R5160 17, R6150 19, R6160 17) úr Procore, sótt sem einn pakki
(`Downloads\nlsh-raf-log-15nov.dat`) og skipt í `Documents\NLSH\procore-hlutablod\NLSH-<blað>.pdf` (allir %PDF). Afstilling: `-fylgni.py` við
R1150/R1160 sama hlutanúmers (`scratchpad/as_R3150.json` …), styrkur 1,0–1,7; x-hliðrun ≈ 0, y 0 eða −20…−50 pt eftir blaði. Fjögur frávik
> 12 pt frá miðgildi systurblaða leiðrétt (R3150-18, R5160-02, R5160-14, R3160-19). Blöð án viðmiðs sleppt: R3150-09/-10, R6150-09, R6160-12, R5160-25.
Skeytt með `-skeyta-lit.py dokkt` (Lágspenna b45309, Smáspenna 7c3aed, Brunaviðvörun 0d9488), skráð með `-log.cjs --write` (rod 41–43).
Sjónskoðun: tákn lenda rétt í herbergjum. Blöðin sýna aðallega TÆKI (tengla, ljós, nema), fáar lagnaleiðir → engin sjálfvirk áætluð göt.


## 15.11.2026 — Úðakerfi og lyfjaloft hlutablöð + gataplön burðarvirkis (M814/M815/M816)

Agnar samþykkti niðurhal: 120 blöð, 30,4 MB (M315 18, M316 16, M715 16, M716 16, M814 20, M815 18, M816 16), `Downloads\nlsh-udi-gas-gat-15nov.dat`
→ `Documents\NLSH\procore-hlutablod\NLSH-<blað>.pdf` (allir %PDF). „Við lærum í leiðinni“ → tafla „Hvaða skjöl nýtast“ í SKILL.md skref 1.
- Afstilling: ÁSAMERKI blaðs → M115-NN/M116-NN (q 1,000, frávik ≤ 0,1 pt) → grunnur (as_M115/as_M116). `scratchpad/raf/stilla_asar.py`,
  `gatavarpa_lib.py`. M315-06/16/18 án ása → `-fylgni.py` við M115 (styrkur 1,67–1,75). Stillingar: `scratchpad/as_M315.json` o.fl.
- **Gataplön** (rev 0, 06.01.2025): götin lesin úr texta (`raf/gataplan.py`, „ø160“, „150 x 300“), tvítekin á blaðamörkum tekin út:
  M814 (plata yfir 4H) 582 göt: Ø160 520, Ø220–250 46, kantað 10, annað 6 · M815 (yfir 5H) 535: Ø160 513, Ø220–250 20, annað 2 ·
  M816 (yfir 6H/þak) 190: Ø160 90, Ø220–300 78, <100 12, >300 10.
  Samanburður við gólfskráningar 4H+5H (haedarhnit, 45 px): M814 466 með / 116 án (45 af 46 Ø220–250 án), M815 470 / 65 (19 af 20 án).
  Götin liggja hvert yfir öðru milli platna, svo staður einn segir EKKI hvorri plötu skráning tilheyrir. M816: 6H á aðeins 3–4 gólfskráningar →
  þakplata óbyrjuð ef hún er í verkinu (ÓMÆLT hvort). Miðbygging/garður í M814 alveg óskráð (gæti verið utan verks).
  Hringurinn er settur á stærðarTEXTANN, sem stendur 0,3–0,6 m frá gatatákninu.
- Lög (`-log.cjs`, falin): úði hlutablöð M315/M316 (dokkt 0369a1), lyfjaloft M715/M716 (litur), gataplan M814→4H, M815→5H, M816→6H (fag golf).


## 15.11.2026 — Yfirferð aftur með nýju lögunum (Agnar: „fara í gegnum allt aftur og sjá hvort þetta breytist eða matchast betur“)

`scratchpad/raf/yfirferd.cjs`: krossar per lag × hæð → skráning sama hóps innan 60 px / áætlað gat innan 30 px / EKKERT.
- Úði hlutablöð M315 (5H): 399 krossar, 351 skráðir, 12 áætlað, 36 ekkert (S2 22). M316 (6H): 439 / 397 / 11 / 31. → 5H S5 er EKKI á eftir í úða.
- Lyfjaloft hlutablöð M715 (5H): 114 / 102 / 7 / 5. M716 (6H): 168 / 150 / 5 / 13. → nær allt skráð.
- Úði yfirlit M395 studdi aðeins 4 af 40 áður settum úðapunktum á 5H S5 → 36 sett eytt=true (`udi_leidretta.cjs`, ástæða í athugasemd).
  Apex 5H „Eftir“ 439 → 403.
- Rafmagn, loft, vatn og frárennsli óbreytt (punktarnir komu þegar af hlutablöðum). Leifar í búnum svæðum (6H: loft 25, vatn 12, úði 31,
  lyfjaloft 13; 5H: loft 21, vatn 20, úði 36) EKKI settar inn — 5–8 % af krossum, líklega skráning > 1,8 m frá eða í öðrum flokki.
- Lærdómur í SKILL.md: aldrei áætluð göt úr yfirlitsmynd fags þegar hlutablöð eru til.


## 15.11.2026 — Gólfgöt liður 1.3: 9 Ø220-göt við lagnastokka sett inn (fag golf, uppruni `teikning:M81x-gataplan`)

Agnar: „prófaðu það ef þú finnur góða vísbendingu“. `raf/gat13.py`: Ø210–300 af M814/M815, stærðartexti festur á næsta hringtákn (45 af 66),
vísbendingar A engin gólfskráning 1,35 m · B engin skráning í neinum flokki 0,75 m · C utan miðbyggingar · D lögn á lagi 20 px.
M814: 46 → A+B+C 19; M815: 20 → 6. Sjónskoðun (`raf/gat13-flisar.png`): Ø250 í ljósgörðum, garði og við gler tengibyggingar = líklega
niðurföll út, ekki hæðaskil → SLEPPT (16). Ø220 öll við horn lagnastokka með lögn → 9 sett inn (`gat13_setja.cjs`, fjoldi 1, flokkur null):
4H (M814) 5, 5H (M815) 4. Apex Eftir: 4H 16 → 21, 5H 403 → 407.
ÓMÆLT: hvort lagnastokkarnir séu sjálfstæð brunahólf (þá væri þéttingin í stokkveggnum, ekki plötunni) — spyrja Agnar ef hann efast.


## 16.11.2026 — Rannsókn á Ø220-götunum (Agnar: „ég er bara ekki viss, mátt rannsaka betur“)

- Brunayfirlit A285-31: hvert Ø220-gat er í litlu SKOTI við horn lagnastokks, UTAN stokksins; stokkarnir eru „Lagnastokkur – opið niður“
  með EI60-CS hurð (sjálfstæð brunahólf opin niður). Nærmyndir M115/M315/M715: gatið er undir hreinlætistæki (skolvaskur/salerni) í skotinu.
- Ø220-götin eru nákvæmlega 24 (M814 12, M815 12) ≈ útboðsliður 1.3 Ø210-300: 25 stk → þetta ERU 1.3-götin. Ø250 í ljósgörðum/garði/við gler
  eru utan þeirrar tölu (líklega niðurföll út) — sleppt áfram.
- Aðeins 2 gólfskráningar við þau (#6465 við M814-15/M815-15, #12143 við M814-19/M815-19, ≤ 0,7 m). Skráningar 0,1–0,9 m frá hinum eru
  VEGGJAGEGNUMTÖK í stokkveggnum (Stál/Loft), ekki gatið → vísbending B („engin skráning í neinum flokki 0,75 m“) var of ströng.
- `raf/gat13_vidbot.cjs`: 11 Ø220 bætt við (M814-01/04/08/13/16, M815-01/04/07/08/13/16). Alls 20 Ø220 sem áætluð göt (fag golf, fjoldi 1).
  Apex Eftir: 4H 21 → 26, 5H 407 → 413.
- Opið: hvort pípulagningamenn þétti þessi göt sjálfir (stundum fylgir eldvarnarkragi niðurfallinu) — ÓMÆLT; Agnar veit það.


## 16.11.2026 — Kragarör (útboðsliður 2.2): 242 frárennsliskrossar án kraga settir inn

Agnar: „er útboðið ekki að sýna fleiri plast kragagöt á baðherbergjunum“ + mynd af útboðsblaði: **2.2 Ø35-50 plaströr m. eldv. kraga: 600 göt =
1.200 lokanir** (2 lokanir per gat; sama regla á öllum lið 2).
- Fyrri samanburður (15.11) taldi frárennsliskross „skráðan“ ef HVAÐA plastskráning sem er var nærri → Ø20-34 (vatnslögnin við hliðina) faldi vöntun.
- `raf/kragi.cjs`/`kragi2.cjs`: 6H S4/S5 — 53/57 krossa hafa BÆÐI Ø35-50 og Ø20-34; 6H S1/S2 — 61/50 aðeins Ø20-34, 1/0 með Ø35-50 (sama spegluð
  hönnun). Mynd `raf/kragi-samanburdur.png`: kragi við vask sjúkrastofu í S4, enginn á sama stað í S1.
- Frárennsliskrossar 536 (5H 259, 6H 277) ≈ útboð 600 göt. Án Ø35-50 innan 60 px: 293 (5H 136, 6H 157); 51 áttu þegar fravatn-gat →
  **242 ný** (`kragi_setja.cjs`, fag fravatn, flokkur Plast Ø35-50, fjoldi 2, uppruni `teikning:M11x-kragi`): 5H S1 29, S2 49, S4 22, S5 9 ·
  6H S1 61, S2 40, S4 14, S5 18. Apex Eftir: 5H 413 → 522, 6H 238 → 371.
- OPIÐ: í S4/S5 er ≈ 1 Ø35-50 skráning per kross (6H S4 64 skr / 72 krossar) en útboð telur 2 lokanir per gat → hinn endinn gæti vantað
  á „búnu“ kragagötunum líka. Spyrja Agnar hvort kragi telst ein lokun eða tvær í raun.


## 16.11.2026 — Kragi = ein heil lokun; vaskar eða klósett?

- Agnar: „2 stakar … 1 heil fyrir einn kraga“ → ein kragaskráning klárar gatið. 279 fravatn-punktar (uppruni `teikning:M11%`) fjoldi 2 → 1.
  (Stöðuskýrslan deilir lið 2.2 enn með 2 stök per ein.; það má stilla í „Stök per ein.“ ef Agnar vill — ÓBREYTT.)
- Úrtak 16 kragapunkta (`raf/kragi-taeki.png`, græn lögn ofan á brunayfirliti): 8 við VASKA (handlaugar í baðherbergjum/snyrtingum, vaskur í
  sjúkrastofu/lyfjaherbergi), 3 við klósettgrind á vegg, 5 greinalagnir milli baðherbergja/frá stamma.
- TILGÁTA (ómæld): klósettin eru Ø90–110 → útboðsliður 2.3 „Ø75-100 plaströr“ 100 göt, aðeins 20 stök skráð (10 lokanir). Gæti verið forveggurinn
  við klósettkassana sem Agnar nefndi 15.11 — óbyrjað. Ekki sett inn.


## 16.11.2026 — Tæki lesin af teikningum (tækjanúmer) → vaskar vs klósett

Agnar: „ættir þá að geta spottað vaskana út frá OCR/myndgreiningu“. Betra: VEKTOR-texti. Skýring á M109-01 „Skýringar við þrifatæki“ (skoðað í
vafra, ekki sótt): -NX00_T vatnssalerni · -NY10_T handlaug · -NY20_T ræstivaskur · -NY30_T skolvaskur · -NY40_T vaskeiningar · -UB10_T sturta ·
-UV10_T vatnskranar · -KN10_T niðurföll · -MR10_T skiljubox. `raf/taeki.py` les þau af M115/M116 og varpar á yfirlit:
5H 509 tæki (handlaug 247, salerni 109, sturta 99, niðurfall 30, skolvaskur 16, ræsti 4) · 6H 501 (handlaug 250, salerni 112, sturta 98, niðurfall 21, skol 16, ræsti 4).
Frárennsliskross → næsta tæki ≤ 75 px (`taeki_kross.py`): kragi SKRÁÐUR 243 = handlaug 164, sturta 49, salerni 11; kragi VANTAR 293 = handlaug 124,
salerni 90, sturta 61, niðurfall 9. → Ø35-50 kragi er við HANDLAUGAR og STURTUR; við salerni nánast aldrei.
Salernakrossar alls 101 ≈ útboðsliður 2.3 Ø75-100 plaströr 100 göt (21 skráð, engin með hæðarhnit). → 82 fravatn-punktar við salerni fá flokk
Plast Ø75-100 (`salerni_flokkur.cjs`). Eftir standa ~197 kragapunktar (Ø35-50) við handlaugar/sturtur.
Lærdómur: tækjanúmer + skýringablað fagsins (M109) er besta leiðin til að vita HVAÐA tæki lögn þjónar.


## 16.11.2026 — Herbergjatalning (Agnar: „alltaf handlaug í hverju herbergi utan baðherbergis … finna fjölda herbergja og baðherbergja“)

`raf/herbergi.py`: herbergjanúmer XXX.YY.ZZZ + heiti af M715/M716 (lyfjaloftsblöðin bera öll herbergjaheiti), varpað á yfirlit.
| | 5H | 6H |
|---|---|---|
| Sjúkrastofur (+einangrunarstofur) | 96 (24 per deild) | 97 |
| Baðherbergi | 100 | 99 |
| Snyrtingar | 12 | 13 |
| Skol/ræsting | 12 | 12 |
| Lyf | 24 | 24 |
Tæki (tækjanúmer M115/M116): handlaugar 247/250, sturtur 99/98, salerni 109/112.
Útboðsrök: handlaug í hverri sjúkrastofu (≈ 193) + handlaug í hverju baðherbergi (≈ 199) + sturta (≈ 197) ≈ 590 tæki með Ø40-50 frárennsli
≈ útboðsliður 2.2 kragi 600 göt. Salerni ≈ 221, en aðeins 101 frárennsli gegnum brunavegg ≈ liður 2.3 (100).
Frárennsliskross × tæki × herbergi (skráð / vantar): handlaug í sjúkrastofu 5H 52/6, 6H 41/29 · sturta í baðh. 5H 15/31, 6H 13/14 ·
handlaug í baðh. 5H 17/12, 6H 19/18 · salerni í baðh. 5H 4/37, 6H 3/43 (→ 2.3).
Skráð Ø35-50: 313 stök (5H 178, 6H 135). Ef hvert tæki = eitt kragagat eru ~290 eftir skv. útboði; á kortinu eru ~197 kragapunktar →
allt að ~90 kragagöt sem krossagreiningin sér ekki (lögn gegnum vegg sem ekki er rauður á A285/A286, eða niður í plötu). ÓMÆLT hver.


## 16.11.2026 — PDF: brunalokanir, staðsetning og gerð

`Documents\NLSH\NLSH-brunalokanir-stadsetning-og-gerd.pdf` (10 síður, A4): almennar kröfur (M109-01, R1080-01), HVAR (A285/A286 rauðir veggir og hurðamerki, veggtegundir A400-20, gataplön M814–M816, EI120 lóðrétt raf, tækjanúmer og herbergi), HVERNIG (deili M109-02, M329-01, M209-01 með myndum), efni lagna → útboðsliðir, opin atriði. Smíðað úr `scratchpad/pdf/brunalokanir.html` með Playwright (`prenta.cjs`); myndir eru sneiðar skoðaðar í vafra. Textinn sjálfur: `NLSH-BRUNATHETTINGAR.md`.


## 16.11.2026 — FYRIRMYNDARAÐFERÐ: búni húshlutinn varpaður á hina (Agnar: „mátt halda áfram“)

- Húsin tvö eru AFRIT (ekki spegluð): dökk súlubelti yfirlits 46→3685, 593→4235, 1321→4962, 1605→5246 ⇒ **dx = 3.640 px, dy = 0**; 5H og 6H sami
  rammi (fylgni 6H→5H = 0,0). Prófað: Ø35-50 klasar 6H S4/S5 → 5H S4/S5: 80/103 með kragaskráningu á sama stað (78 %).
- `raf/spegill.cjs` + `spegill_setja.cjs`: kragar — 74 ný (6H S1 9, S2 21; 5H S1 9, S2 23, S4 5, S5 7), uppruni `spegill:6H-S4S5`.
- `raf/spegill_allt.cjs` + `spegill_setja_allt.cjs`: fyrirmynd 6H vinstra hús fyrir rafmagn (227 gatastaðir), 6H hægra hús fyrir loft (215), stál (338),
  Plast Ø20-34 (179), raufar (6). **726 ný** (raf 422, loft 98, stál 137, plast 64, raufar 5; fjoldi = skráningar í fyrirmyndarklasa 1–4,
  flokkur = algengasti flokkur klasans, uppruni `spegill:6H-vinstra|haegra`). **126 raf-krossapunktar (teikning:R11x0-kross) eytt=true**: engin
  fyrirmyndarskráning innan 60 px á samsvarandi stað í fullskráða húsinu.
- Apex Eftir: 5H 522 → 566 → **964**, 6H 371 → 401 → **603**. Alls óskráð áætluð göt 1.593 (2.872 stök): raf 790, loft 164, vatn/stál/plast 233,
  frárennsli (kragar + Ø75-100) 357, gólf 36, úði 9, annað 4.
- Fyrirvari: 5H er ekki 100 % eins og 6H (kragapróf 78 %) → 5H-punktar merktir „Óbyrjað?“. Raf: fyrirmynd gefur ~908 göt alls á 4 húshluta
  á móti útboði 3.1 = 768.
- LÆRDÓMUR (SKILL): þegar hús/hæðir eru eins er fullskráður hluti BESTA fyrirmyndin — betri en krossar á teikningu (raf-krossar náðu ~40 %).


## 16.11.2026 — Stöðuskýrslan uppfærð (kjarni 6d38537)

Agnar: „Já uppfæra”. SkyrslaClient: markmið hóps á deild/hluta = max(fyrri regla, klárað + opið + Σ fjoldi óskráðra áætlaðra gata gatakortsins á deild) — `eftirHop` (hópur af flokki gatsins, annars fagi: rafmagn→Rafmagn, loftraesting→Loft, golf→Gólf, fravatn→Plast, vatn/hiti/sprinkler/gas/annad→Stál). Áður var 6H-markmið = klárað, svo óbyrjaðir hlutar (raf 6H S4/S5, kragar 6H S1/S2) töldust búnir. Útboðsliður 2.2 „stök per ein.” 2 → 1 (kragi = heil lokun). Forsendutexti uppfærður. Lifandi (sannreynt): **6H 83 %** (5.394 af 6.471 stökum), **5H 66 %** (4.509 af 6.849), gólf 5. hæðar 69 % (357 af 515); 2.2 kragi 304 af 600 = 51 % (var 25 %).


## 16.11.2026 — Pörun endurkeyrð (eftir fyrirmyndaraðferð og nýja lög)

Agnar: „halda áfram að matcha og yfirfara.” Keyrt `skraning-gatakort-para.cjs --haed 6H --write` og `--haed 5H --write` (radíus 60 px).

**6H** (1.297 áætluð göt, 5.510 skráningar á vörpuðum blöðum):
- 1. umferð (sami flokkur): 1.567 pöruð · 2. umferð (sami hópur): 438 → **2.005 af 3.012 stökum (67 %)**
- Fullt 778, hluti 73, vantar 446. Stærsta vandamálið: S4/S5 rafmagn (314 göt, 625 stök) — engar raf-skráningar á hægra húsinu.
  Hiti/sprinkler nær fullpöruð (99 %/94 %), loft 85 %, fravatn/vatn ~81 %.

**5H** (1.202 áætluð göt, 4.238 skráningar):
- 1. umferð: 379 · 2. umferð: 397 → **776 af 2.240 stökum (35 %)**
- Fullt 475, hluti 50, vantar 712, óparuð 81 (71 tillögur + 10 gataplan/golf).
  Rafmagn 5H aðeins 2 % pöruð (14 af 913 stökum) — fáar skráningar á raf-blöðum 5H.

**81 óparuð á 5H:** 71 eru `tillaga:kross-5h` (loftr., sleppt úr pörun) og 10 `teikning:M814-gataplan` (golf, enginn hópur).

**Stöðuskýrsla eftir pörun (sannreynt):** 6H **86 %** (5.394 af 6.302), 5H **68 %** (4.509 af 6.588), Gólf 69 %, 2.2 kragi 51 %.
Markmið lækkaði (6.471→6.302 á 6H, 6.849→6.588 á 5H) vegna þess að pöruð „fullt” göt hækka ekki markmið lengur — aðeins vantar-göt telja.

**Lykilniðurstaða:** raf í hægra húsi beggja hæða er aðalið sem eftir er (≈950 stök). Pípulagnir hægra húss nær fullpöruð.


## 16.11.2026 — AJOUR-VEFUR: rafmagnsskráningar úr „Raufar. (Metrer) LV“ í „Raflagnaþéttingar, göt og raufar“ (Agnar bað um)

- Gert í Ajour-vefnum sjálfum (brunaholf.ajoursystem.net, NLSH 5-6. hæð), ekki í okkar grunni. Teikning: `6H 2S-1S Rafmagnsþéttingar.jpg`,
  flokkur eftir flutning: „Raflagnaþéttingar, göt og raufar“ / Starfsmaður 1.
- **Flutt: 11 skráningar** — 12104 (stök, fyrst) og 10 ókláraðar með Change group → „All“ (Ajour flytur þá aðeins þær sem eru breytanlegar; PUT 200).
- **Eftir: 39 kláraðar (Done)** á sömu teikningu sitja enn í „Raufar. (Metrer) LV“ (mælt 16.11: flokkurinn 116 alls, 114 Done; markflokkur 311).
  Ajour læsir flokki á kláruðum skráningum: hægrismellur gefur aðeins „Show registration log“, og bein sending á 12102 skilaði 200 en breytti engu.
- Leyfileg leið sem viðmótið býður: taka Done af (staða afturkölluð), Change group, setja Done aftur. Stöðustimpillinn (nú 02-11-2026 08:27,
  brunaholf@brunaholf.is) verður þá dagurinn sem það er gert. BÍÐUR ákvörðunar Agnars. Ekki fara fram hjá læsingunni með beinum köllum.
- Gildra: teljarinn á flokkaflipanum er fyrir allar teikningar (116); 39 er talan á `6H 2S-1S Rafmagnsþéttingar.jpg` í teikningalistanum hægra megin.
- **PRÓF Á EINNI (12102), 16.11 kl. 16:43–16:46, Agnar: „Prófa eina fyrst“:** Done tekið af → Change group (Selected 1; Raflagnaþéttingar, göt og raufar /
  Starfsmaður 1 / Brunaþéttingar / Fireproofing) → Done sett aftur. Flutningurinn tókst (PUT 200; Raufar LV 116→115, markflokkur 311→312).
  Sagan fékk 4 línur (15 cancelled, 16 category group, 17 category, 18 completed); stöðustimpill 02-11-2026 08:27 → **16-11-2026 16:46**;
  `created` 22-10-2026 og `executionFrom/To` 22-10-2026 óbreytt.
- **GILDRA — Change group ÞURRKAR GÁTLISTAHÖKIN.** 12102 hafði hök í EI60 og „Kítti háþensla / Graphite Sealant“ (sögulínur 7–8, 02-11);
  eftir flutning er `registrationCategoryChecks` = []. Óhreyfðar skráningar í Raufar LV bera hök (96 af fyrstu 100). Hökin tilheyra gátlista
  gamla flokksins og fylgja ekki með. 38 kláraðar eru því ÓFLUTTAR þar til ákveðið er hvort hökin eru sett aftur á hverja (lesin úr sögu hennar).
- Þær 11 sem fóru fyrr um daginn misstu ekkert sem mælt var: 12104 og 8026 höfðu aldrei hök né Done (sagan sýnir það). Þær fengu flokkinn
  „Starfsmaður 1“ án gátlistans „Brunaþéttingar / Fireproofing“. 8026 var sett Í Raufar LV 20-10-2026 10:41 (sagan), ekki skráð þar upphaflega.
- Mæling á hökum án þess að opna hverja skráningu: `…viewModel.controller.constructionHelper.registrations[i].registrationCategoryChecks` á listasíðunni.
- **12102 LÖGUÐ 16.11 kl. 17:16–17:18 (Agnar: „Já, laga 12102“):** Done af → hægrismella → Edit registration → hakað í gátlistanum → Save → Done á.
  Sannreynt í gögnum listans: flokkur „Raflagnaþéttingar, göt og raufar“ / Starfsmaður 1 / Brunaþéttingar / Fireproofing, 14 gátlistaliðir,
  hakað í nr. 0 (EI60), 4 (Kítti háþensla) og 7 (Borðar / PWP Wraps), senderStatus 1, stimpill 16-11-2026 17:18.
- **REGLA AGNARS 16.11: á öllum rafmagnsgötum eru hökin ÞRJÚ — EI60, háþenslukítti og háþensluborði.** (12102 bar upphaflega aðeins tvö, án borða.)
- UPPSKRIFT fyrir kláraða skráningu sem þarf í annan flokk: (1) Done af, (2) Change group með flokki + Starfsmanni + gátlista, (3) Edit registration
  og haka í liðina, (4) Done á. Hökin verður að setja EFTIR flutning, Change group þurrkar þau. Hakreitirnir í Edit-glugganum eru í sömu röð og
  gátlistinn (0 EI60 … 4 Kítti háþensla … 7 Borðar). 38 kláraðar á `6H 2S-1S Rafmagnsþéttingar.jpg` bíða enn í Raufar LV.
- **38 ÓFLUTTAR ENN (16.11 kl. 17:30): hökin eru EKKI eins á þeim** — 0-32 göt bera EI60+kítti (eða akríl), raufar 400–630 mm bera EI60+þéttull+akríl+borða (saga 11948 staðfestir), 2 eru á Starfsmanni 40 með 4 liða gátlista. Engin ber EI60+kítti+borða. Bíður svars Agnars: sömu hök og áður, eða þrjú á allar. Afrit hér fyrir neðan — nota það til að setja hökin aftur eftir flutning.

### Afrit: hök á 38 kláruðum skráningum ÁÐUR en flutt (lesið úr Ajour 16.11.2026 ~17:25)

Flokkur þá: Raufar. (Metrer) LV · teikning `6H 2S-1S Rafmagnsþéttingar.jpg` · allar Done (senderStatus 1).
Dálkar: raðnr | starfsmaður | subject | fjöldi gátlistaliða | HAKAÐIR liðir (sæti í gátlista, talið frá 0) | stöðustimpill fyrir
Sæti í 14 liða gátlistanum: 0 EI60 · 1 EI 90 · 2 50 mm Þéttull · 3 Akríl · 4 Kítti háþensla · 5 Silicon · 6 Kragi · 7 Borðar · 8 Annað 1 · 9 Annað 2 · 10 EI 120 · 11 EI 180 · 12 EI 360 · 13 EI 240
(0 og 4 staðfest af sögu 12102; 2, 3, 7 eftir röð gátlistans.) Engar athugasemdir (note) voru á neinum lið.

12100 | S1 | 0-32 | 14 | 0,4 | 2026-11-02T08:26
12099 | S1 | 0-32 | 14 | 0,4 | 2026-11-02T08:26
12098 | S1 | 0-32 | 14 | 0,4 | 2026-11-02T08:26
12097 | S1 | 0-32 | 14 | 0,4 | 2026-11-02T08:26
12096 | S1 | (tómt) | 14 | 0,3,4 | 2026-11-02T08:26
12095 | S1 | 0-32 | 14 | 0,4 | 2026-11-02T08:26
12094 | S1 | 0-32 | 14 | 0,4 | 2026-11-02T08:25
11961 | S1 | (tómt) | 14 | 0,4 | 2026-10-21T15:46
11960 | S1 | 0-32 | 14 | 0,4 | 2026-10-21T15:46
11959 | S1 | 0-32 | 14 | 0,4 | 2026-10-21T15:45
11958 | S1 | 0-32 | 14 | 0 | 2026-10-21T15:45
11957 | S1 | 0-32 | 14 | 0,4 | 2026-10-21T15:45
11956 | S1 | (tómt) | 14 | (ekkert) | 2026-10-21T15:45
11955 | S1 | 0-32 | 14 | 0,3 | 2026-10-21T15:45
11954 | S1 | 0-32 | 14 | 0,3,4 | 2026-10-21T15:45
11953 | S1 | 0-32 | 14 | 0,3,4 | 2026-10-21T15:44
11952 | S1 | 0-32mm | 14 | 0,3 | 2026-10-21T15:44
11951 | S1 | 0-32mm | 14 | 0,3 | 2026-10-21T15:44
11948 | S1 | 420mm | 14 | 0,2,3,7 | 2026-10-20T15:57
11947 | S1 | 420mm | 14 | 0,2,3,7 | 2026-10-21T15:44
11946 | S1 | 420 | 14 | 0,2,3,7 | 2026-10-20T15:57
11945 | S1 | 420mm | 14 | 0,2,3,7 | 2026-10-20T15:57
11827 | S1 | 620mm / ???? | 14 | 0,2,3,7 | 2026-10-20T15:56
11826 | S1 | 620mm | 14 | 0,2,3,7 | 2026-10-19T15:57
11824 | S40 | 420x70-420mm | 4 | 0,1,2,3 (öll fjögur) | 2026-10-16T16:36
11823 | S1 | 620mm | 14 | 0,2,3,7 | 2026-10-16T16:04
11822 | S40 | 400x70-420mm | 4 | 0,1,2,3 (öll fjögur) | 2026-10-16T16:35
11821 | S1 | 620mm | 14 | 0,2,3,7 | 2026-10-16T16:04
11820 | S1 | 570mm | 14 | 0,2,3,7 | 2026-10-16T08:31
11819 | S1 | 550mm | 14 | 0,2,3,7 | 2026-10-16T08:30
11818 | S1 | 570mm | 14 | 0,2,3,7 | 2026-10-16T08:30
11817 | S1 | 550mm | 14 | 0,2,3,7 | 2026-10-16T08:30
11802 | S1 | 630mm / go over it / not good job | 14 | 0,2,3,4 | 2026-11-05T08:53
11801 | S1 | 530mm | 14 | 0,2,3,4 | 2026-11-05T08:53
11800 | S1 | 530mm | 14 | 0,2,3,4 | 2026-11-05T08:53
11799 | S1 | 630 mm / go over agin | 14 | 0,2,3,4 | 2026-11-05T08:53
11764 | S1 | 500mm | 14 | 0,2,3,7 | 2026-11-05T08:53
11763 | S1 | 400mm / fix | 14 | 0,2,3,7 | 2026-11-05T08:53


- **LOKIÐ 16.11.2026 kl. 17:34–18:15 — 38 kláraðar fluttar, hök endurheimt (Agnar: „Já, flytja 38“, svo „Sömu hök og áður“).**
  Raufar. (Metrer) LV 116 → **77**, Raflagnaþéttingar, göt og raufar 311 → **350** (12102 + 38). Gamli flokkurinn á enga skráningu eftir á
  `6H 2S-1S Rafmagnsþéttingar.jpg`; þær 77 sem eftir eru í honum eru á öðrum teikningum og voru ekki hluti af verkinu.
- Röðin: (1) Done af 38 með listann síaðan á Done (`regStatus=SenderApproved`): efsta röð hverfur við hvern smell; (2) 11824 og 11822 fluttar
  stakar á **Starfsmann 40**, hinar 36 í einu með Change group → All (36) á Starfsmann 1; (3) á hverri: Edit registration, upprunalegu hökin
  eftir afritinu hér að ofan, Save, Done.
- **Sannreynt eftir endurhleðslu: 39 af 39 réttar** (hök, Done, starfsmaður, flokkur, teikning; engin athugasemd á gátlistalið). 12102 fékk borðann
  tekinn af aftur og ber nú 0,4 eins og upphaflega. Framkvæmdardagar óbreyttir (12.–22.10.2026).
- **Starfsmaður 40:** í gamla flokknum var gátlistinn skráður sem 4 liðir, allir hakaðir. Sagan á 11824 og 11822 sýnir hverjir: EI60, 50 mm Þéttull,
  Akríl, Kítti háþensla → sæti 0,2,3,4 í 14 liða listanum. (Sama morgun 16.10 höfðu þær Kítti + Borða; flokki var breytt kl. 16:35 og þessir fjórir valdir.)
- **Það sem BREYTTIST umfram flokkinn:** stöðustimpill allra 39 er nú 16.11.2026 (var 16.10–05.11), og hver saga fékk línur um afturköllun,
  flokk, gátlista og Done. Hvort mánaðaruppgjörið les stöðustimpilinn er ÓMÆLT.
- **Okkar grunnur er ósnertur:** `ajour_registrations` / skr_* bera enn gamla flokkinn þar til næsti Ajour-innlestur keyrir (ekki keyrður hér).
- LÆRDÓMUR (SKILL): (a) lesa og vista hök HVERRAR skráningar áður en flokki er breytt, þau eru ekki eins þótt Agnar lýsi þeim almennt;
  (b) vafragluggi falinn (Agnar í síma) → Ajour-gluggar frjósa í hreyfingu og koma upp í bjöguðu útliti (`modal-selector-overflow`), þá Cancel og opna aftur;
  (c) bilslá hakar ekki og bil lendir í athugasemdareit; (d) sannreyna hvern smell með `elementFromPoint` áður en smellt er, og lesa
  `registrationCategoryChecks` úr listagögnunum eftir vistun.


## 16.11.2026 (kvöld) — Áhrif flokkaflutningsins á uppgjör hubsins + tvítekning í Ajour-innlestri (aðeins mælt, ekkert skrifað)

Agnar: „mátt halda áfram að betrumbæta“. Mælt í grunni (lesaðgangur), engu breytt.

**A. Hvað flutningurinn gerir við NLSH-uppgjörið (`nlsh-uppgjor.js`, les `skr_hub_skraningar` = `ajour_registrations`):**
- Uppgjörið raðar á mánuð eftir `checked_date` (dagsetning GÁTLISTAHAKS; framkvæmdardagur aðeins ef hak vantar), telur einstök raðnúmer
  með stöðu Done per flokk. Change group þurrkar hökin → endurhakað 16.11 → `checked_date` = 16.11.2026 → skráningin færist í NÓVEMBER.
  (12102 sýnir það þegar: Raflagnaþéttingar, checked 2026-11-16. Hinar 38 uppfærast við næsta innlestur, kl. 06:45.)
- Í október (FROSINN 10.11, R-388) voru þær „Raufar. (Metrer) LV“ = liður 2.11 (metrar úr subject, `raufMetrar`). Aðeins tvær gáfu metra:
  **11822 (0,94 m) og 11824 (0,98 m)**; ásamt 11679 (1,80 m, önnur teikning) eru það nákvæmlega 3,72 m sem október 2.11 ber. Hinar 37 gáfu
  0 m („620mm“, „0-32“ lesast ekki sem ummál) og voru því ALDREI rukkaðar.
- Í nóvember koma allar 39 inn á lið 3.1 (9.766 kr/heild, 2 stök = 1 heild): 39 stök = 19,5 heildir = **190.437 kr m/vsk**. Þar af eru
  37 nýrukkun (180.671 kr) og **2 tvírukkun** (11822, 11824: 1,92 m voru þegar í október-2.11 = 0,96 heild × 11.532 = 11.071 kr; í 3.1 = 9.766 kr).
  BÍÐUR Agnars: draga þær tvær frá í nóvember-lokatölu 3.1 eða leiðrétta október.
- Aukaverkun: `checked_by_user` þessara 39 er nú brunaholf@brunaholf.is 16.11 í stað starfsmanns í október (starfsmannatölur hubsins).

**B. GALLI: daglegi Ajour-innlesturinn tvítekur skráningar án framkvæmdardags (eigandi: gagnaleidslur).**
- `ajour-ingest-drive-background.js` (og `luna-bridge/ajour-ingest.py`) upserta á `(serial_number, project_name, execution_date)`. Þegar
  `execution_date` er NULL eru NULL-gildi ólík í einkvæmum vísi → ný röð við HVERJA keyrslu. Skráningar frá 09.11 (#12271–12332, 12368–12397)
  hafa engan framkvæmdardag.
- Mælt 16.11: 11.881 raðir, 11.226 einstök númer, **83 númer tvítekin (2–13 eintök), 655 aukaraðir**; öll 83 með tóman framkvæmdardag, ekkert
  tvítekið með dagsetningu. Aðeins NLSH. 9 ný númer (12389–12397) tvítakast á morgun.
- Uppgjörið telur einstök númer per flokk, svo hrein tvítök blása það ekki út. EN gömul eintök lifa: **12 skráningar sem voru Done 10.11 06:45
  og hafa verið Published síðan (10.11 21:54 →) teljast enn í nóvember**: Plast Ø35-50 12285–12288 (4), Loft Ø200-315 12289, 12290, 12304 (3),
  Plast Ø20-34 12280, 12281 (2), Stál Ø15-35 12291, 12292 (2), Loft Ø125-160 12298 (1) = **93.758 kr m/vsk oftalið** eins og staðan er.
- Á móti: **3 gólfgöt eru Done en hafa hvorki hak- né framkvæmdardag og lenda í engum mánuði**: #12272, 12396, 12397 (Gólf Ø160-200, liður 1.2,
  56.224 kr hvert = 168.672 kr m/vsk); auk #12329 (Annað). Lagast ef hakað er í gátlistann í Ajour.
- Lagfæring krefst (1) að aukaröðunum 655 sé eytt úr `ajour_registrations` (nýjasta eintak haldið) og (2) vísi breytt í NULLS NOT DISTINCT eða
  lykli í (serial_number, project_name). Hvorugt gert: skrif í `ajour_registrations` eru bönnuð án orðs Agnars.

**C. Gatakortið er 5 daga gamalt:** `skr_skraningar` (verk 4) síðast stofnað 10.11, uppfært 14.11; hæsta númer 12384 á móti 12397 í Ajour;
  37 Ajour-skráningar vantar og flokkur 45 fluttu skráninganna er enn „Raufar. (Metrer) LV“ (telst Loft í skýrslunni). Uppfærist ekki sjálft:
  þarf `luna-bridge/ajour-export-allt.js` → `skraning-gatakort-innflutningur.cjs` (þurrkeyrsla, svo --write) → `para.cjs`. Ógert.

LÆRDÓMUR (SKILL): áður en flokki er breytt á KLÁRAÐRI skráningu í Ajour: (1) afrita hök, (2) reikna hvaða uppgjörsmánuði og lið hún
færist á (checked_date ræður), (3) athuga hvort hún var þegar rukkuð í frosnum mánuði.


## 16.11.2026 (kvöld, síðar) — Tvítekningin í Ajour-innlestrinum LÖGUÐ (Agnar: „Já")

- **Gert:** (1) afrit `ajour_registrations_afrit_tvitok_20261116` (655 raðir, 83 númer, allt NLSH án framkvæmdardags, RLS á);
  (2) eldri eintökum eytt, hæsta id per raðnúmer stendur (sannreynt fyrst að hæsta id = nýjasta `imported_at` hjá öllum 83);
  (3) nýr lykill `ajour_registrations_radnumer_verkefni_key` á `(serial_number, project_name)`; gamli þriggja dálka lykillinn
  endurgerður sem `NULLS NOT DISTINCT` svo óuppfærður kóði tvítekur ekki heldur; (4) `luna-bridge/ajour-ingest.py` og
  `netlify/functions/ajour-ingest-drive-background.js` upserta nú á `(serial_number, project_name)`.
  Skráð í `brunaholf/sql/2026-11-16_ajour_registrations_einkvaemt_radnumer.sql` og hjá `gagnaleidslur`.
- **Mælt fyrir/eftir:** 26.808 → 26.153 raðir; NLSH 11.881 → 11.226 = einstök númer; 0 tvítekin í öllum verkefnum.
  Nóvember (Done, einstök númer per flokk): Loft Ø125-160 11→10, Loft Ø200-315 6→3, Plast Ø20-34 27→25, Plast Ø35-50 28→24,
  Stál Ø15-35 24→22; aðrir flokkar óbreyttir. Það eru nákvæmlega skráningarnar 12 (93.758 kr m/vsk) sem voru oftaldar.
- **Prófað:** (a) í færslu sem var afturkölluð: upsert á nýja lykilinn, á gamla lykilinn með tóman dag, og þegar skráning fær dag
  síðar: 11.226 raðir í öllum þremur; (b) raunsókn: `ajour-ingest.py` keyrt á `AjourRegistrationData nlsh 2026-11-16.csv`
  (154.154 línur / 11.504 upsert, engin villa), 26.153 raðir fyrir og eftir.
- **Aukafundur:** virki innlesarinn er `luna-bridge/ajour-ingest.py` á skrifstofuvélinni (06:45 + „Sækja núna"); Netlify-fallið
  keyrði síðast 05.10.2026. CSV-ið frá 17:23 í dag er eldra en flutningurinn (17:34–18:15), svo hinar 38 koma inn 17.11 kl. 06:45.
- **ÓBREYTT og bíður Agnars:** 11822/11824 tvírukkun (október 2.11 → nóvember 3.1); gólfgötin 12272, 12396, 12397 og 12329 (Annað)
  eru Done án haks og framkvæmdardags og lenda í engum mánuði; gatakortið (`skr_skraningar`) óuppfært.
- Afritstöflunni má eyða þegar nóvember-uppgjör NLSH er frosið.


## 16.11.2026 (kvöld, enn síðar) — „Óhökuðu" gólfgötin VORU hökuð; innlesturinn missti hakið (Agnar: „Ýta. Og haka í gátlista…")

- **LEIÐRÉTTING á fyrri fullyrðingu minni:** 12272, 12396, 12397 (Gólf Ø 160-200) og 12329 (Annað) eru hakaðar í Ajour
  (EI 90, 50 mm Þéttull, Akríl; 12329 líka Kítti háþensla), lesið úr listagögnum Ajour. Aðeins EI60 (fyrsti liður) er óhakaður.
  Ég hakaði því EKKERT í Ajour. Rótin var okkar megin: CSV-ið ber eina línu per gátlistalið og innlesturinn geymdi fyrstu línuna
  (EI60, án dagsetningar); án framkvæmdardags bar skráningin þá enga dagsetningu og lenti í engum mánuði.
- **Annar galli fundinn í leiðinni:** samþjöppunin var gerð per 500 lína lotu. Skráning á lotumörkum (~286 í sókn) fékk gildi
  síðari línu, og þar sem mörkin færast þegar skráin stækkar flökti `checked_date` þeirra milli sókna.
- **Lagað (`luna-bridge/ajour-ingest.py` + `netlify/functions/ajour-ingest-drive-background.js`):** ein röð per skráningu yfir alla
  skrána; fyrsta línan ræður eins og áður; sé hún óhökuð OG framkvæmdardag vanti er tekið fyrsta hakaða lið.
- **Þurrkeyrslur á undan (ekkert skrifað):** (a) almenn regla „fyrsti hakaði liður": 1.166 hakdagar breytast, 170 kláraðar skipta um
  mánuð, þar af 22 úr frosnum október í nóvember → HAFNAÐ (tvírukkun). (b) þrönga reglan: 254 hakdagar breytast (lotumarka-flöktið),
  12 kláraðar skipta um mánuð innan eldri mánaða (2025-09 … 2026-10), engin inn í eða út úr nóvember nema þessar fjórar.
- **Raunsókn keyrð:** 154.154 línur / 11.218 skráningar, engin villa. Eftir: 26.153 raðir, 0 tvítekin, 0 kláraðar án dagsetningar.
  Nóvember: Gólf Ø 160-200 33→36, Annað 1→2, aðrir flokkar óbreyttir. (3 × 56.224 = 168.672 kr m/vsk bætast við á lið 1.2.)
- **Próf hub-fallsins án skrifa:** fallið keyrt í node með gervi-fetch (Drive = skrá dagsins, öll skrif gripin): 23 upsert-köll á
  `on_conflict=serial_number,project_name`, 11.218 raðir, enginn mismunur við `ajour-ingest.lesa()` í 12 dálkum.
- **luna-bridge ýtt:** vélin var 14 (svo 15) commitum á eftir origin; togað með rebase, einn árekstur í `bridge.js` (SENT_CANDIDATES,
  báðar hliðar haldnar), `npm install` (@anthropic-ai/sdk), 11/11 próf í `test/moppur.test.js`, ýtt.
- LÆRDÓMUR (SKILL): `checked_date IS NULL` í `ajour_registrations` þýðir EKKI „óhakað í Ajour"; það þýðir aðeins að EI60 sé óhakað.
  Lesa hökin úr Ajour (listagögn) eða CSV-inu áður en fullyrt er að hak vanti.


## 16.11.2026 (kvöld) — Gatakort uppfært úr Ajour + pörun endurkeyrð (Agnar: „Geturðu matchað eitthvað meira")

- **Útflutningur** (`ajour-export-allt.js --project NLSH --no-photos --no-pdf`, aðeins lestur): 11.219 skráningar, 13 teikningar.
- **Innflutningur** (`skraning-gatakort-innflutningur.cjs`, þurrkeyrsla svo `--write`): `skr_skraningar` verk 4 11.206 → **11.219**, eytt óbreytt 497
  (466 án teikningar + 31 OFAN_FRÁ, sannreynt fyrir keyrslu að annað væri ekki falið), hæsta nr. 12397. Á `6H 2S-1S Rafmagnsþéttingar.jpg` er engin
  skráning eftir í „Raufar. (Metrer) LV“ (Raflagnaþéttingar 54, Raf raufar 183). Nýjar frá 10.11: 13 (nr. 12385–12397).
- **Afrit** af `skr_aaetlud.parad` fyrir pörun: taflan `skr_aaetlud_afrit_parad_20261116` (RLS á; stofnuð með execute_sql, ekki migration).
- **Pörun** (`skraning-gatakort-para.cjs --haed 6H|5H`, þurrkeyrsla svo `--write`, radíus 60 px):
  6H 2.005 → **2.009** af 3.012 stökum (fullt 778 → 780, hluti 73 → 72, vantar 446 → 445; 6 göt skiptu um stöðu);
  5H 776 → **780** af 2.392 (fullt 456 → 458, vantar 696 → 694; 4 göt skiptu um stöðu). 6H S2 rafmagn 95 af 110.
- **Víðari radíus PRÓFAÐUR OG HAFNAÐ** (`scratchpad/raf/para-greining.cjs`, les aðeins): af götum sem vantar í eiga 22–64 % ónotaða skráningu
  sama hóps í 60–90 px. LYFLEYSA (sömu göt hliðruð um 200 px í 8 áttir) gefur sama eða hærra hlutfall innan 90 px (6H S2 rör: raun 31 %,
  hliðrað 46 %; 5H S2 raf: raun 24 %, hliðrað 29 %). „Rétt utan radíuss" er því tilviljun í þéttum svæðum, ekki merki. Þriðja umferð með
  90–120 px hefði parað ~160–270 göt án heimildar. EKKI gert.
  Fyrirvari sem sama próf sýnir: í þéttustu svæðunum (6H S1/S2 rör) finnur hliðrað gat ónotaða skráningu innan 60 px í 29–47 % tilvika,
  svo 2. umferð (sami hópur) er veik heimild þar; 1. umferð (sami flokkur) er sterkari.
- **Annar hópur innan 60 px er ekki pörun:** 270 af 314 óbyrjuðum raf-götum 6H S4/S5 eiga rör- eða loftskráningu innan 1,8 m
  (Stál Ø40-50 87, Plast Ø20-34 62 …): lagnir og strengir fara gegnum sömu veggi. Ekki parað milli hópa.
- **4H stútar** (`skraning-gatakort-vidbot-stutar.cjs`, þurrkeyrsla): óbreytt 19 af 35 pöruð. Nýju gólfskráningarnar sex á `4H. S1-S2.jpg`
  (12392–12395 opnar, 12396–12397 kláraðar, stofnaðar 16.11 kl. 13:54–13:58) liggja í beinni röð við x ≈ 1.890 á yfirlitinu, y 1.102–1.877,
  11–21 m frá næsta stút og 3,5–18 m frá næsta Ø220-gati gataplans. Þær eiga ekkert áætlað gat á kortinu. Hvað þær eru: ÓMÆLT, spyrja Agnar.
- LÆRDÓMUR (SKILL): áður en radíus er víkkaður: lyfleysupróf (hliðra götunum og telja sömu hittni). Sé hittnin sú sama er ekkert merki.

- **16.11.2026 (kvöld) — Agnar: „Já nýja verkið":** gólfskráningarnar 12392–12397 á `4H. S1-S2.jpg` eru NÝTT viðbótarverk á 4. hæð, ekki meðal stútanna 35.
  Settar á kortið sem sex áætluð gólfgöt (`skr_aaetlud` id 2778–2783, fag golf, flokkur Gólf Ø 160-200, yfirlitsblað 4H, uppruni
  `vidbot:4h-nytt-20261116:<raðnr>`), hvert parað 1:1 við sína skráningu (`parad.stada = fullt`, `flokkun` klarad × 2 / opid × 4,
  `parad.vidbot = nytt-20261116`, ENGINN `stutur`-lykill). Hnit = `skr_haedarhnit` skráningarinnar. Skráningum ekki breytt.
  Áhrif á tölur (mælt í grunni): stútaspjaldið óbreytt (35 raðir með `stutur`), „eftir" á gólfi 4H óbreytt (26 = 16 stútar + 10 gataplan);
  skráningarnar sjálfar teljast í gólfi 5. hæðar (S2: 104 kláraðar, 11 opnar). Kort og skýrsla EKKI skoðuð í vafra eftir innsetningu.
  Til baka: `update skr_aaetlud set eytt = true where uppruni like 'vidbot:4h-nytt-20261116:%'`.
  Hvers konar verk þetta er (stofn, stærð, hvort fleiri göt eru væntanleg): ÓMÆLT.

- **17.11.2026 — Agnar: „Já, bæta við":** nýja viðbótarverkið á 4. hæð telst nú með í spjaldinu „Viðbótarverk 4. hæðar" í stöðuskýrslunni
  (kjarni 327f51f, `stutaspjald` í `SkyrslaClient.tsx`). Spjaldið telur stúta (`parad.stutur`) OG áætluð göt á 4H með `parad.vidbot` án
  `stutur`-lykils; prósentan er af heildinni og textinn sundurliðar hvort um sig. Mælt í grunni og lesið af síðunni á staðbundnum þjóni
  (Playwright, 1400 px): **13 af 41 = 32 %** (stútar 11 af 35 þéttir, 8 skráðir ekki kláraðir, 16 án skráningar, þar af 7 ekki komnir;
  nýtt verk 2 af 6 þétt, 4 skráð ekki kláruð). Áður 11 af 35 = 31 %. Hin spjöldin óbreytt (6H 86 %, 5H 68 %, gólf 5H 352 af 515).
  `hkStutar` og stútamerkin á kortinu (Haedir.tsx) eru ÓBREYTT: þau telja áfram aðeins stútana.
  Næsta viðbótarverk á 4H: setja `parad.vidbot = '<lykill>'` á áætlaða gatið og það kemur sjálft í spjaldið.
  Týpuprófun: 38 villur, allar gamla ImageZoom-hástafavillan á Windows (TS1192/TS1149), engin í skraning/.
