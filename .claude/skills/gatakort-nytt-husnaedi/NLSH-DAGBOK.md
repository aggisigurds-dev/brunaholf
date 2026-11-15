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
