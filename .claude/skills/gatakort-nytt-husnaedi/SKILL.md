---
name: gatakort-nytt-husnaedi
description: >
  Kortleggja húsnæði á Gatakortið í nýja Ajour (Skráning í Kjarna): frá teikningum að korti með skráningum, lögum,
  pörun og stöðuskýrslu. Skref fyrir skref: safna teikningum, velja hnitakerfi hæðar, púsla hlutablöðum saman, stilla
  fagteikningar af sem lög, flytja inn skráningar úr Ajour, varpa Ajour-teikningum á yfirlitsblað, finna brunaveggi og
  gegnumtök, færa punkta á skurðpunkt, para við áætluð göt og hinn endann, og sannreyna. Notaðu þegar Agnar segir
  „mappa upp annað húsnæði", „kortleggja nýja hæð", „púsla saman teikningum", „bæta við lagi", „setja fagteikningu yfir",
  „stilla af teikningu" eða „gera gatakort fyrir <verk>". Eigandi: agentinn `gatakort` (Jackie Chan). Fyrirmyndin er NLSH
  (verk 4), skráð í NLSH-DAGBOK.md í sömu möppu. Kóðinn og tólin eru í Kjarna (apps/slokkvitaeki/tools/skraning-gatakort-*).
  Kveikjuorð: mappa upp húsnæði, kortleggja nýja hæð, gatakort fyrir nýtt verk, púsla saman teikningum, bæta við lagi,
  setja fagteikningu yfir, stilla af teikningu, nýtt húsnæði á gatakort
---

# Gatakort fyrir nýtt húsnæði

Nýja Ajour heitir **Apex Ajour** í bili (greiningartól ofan á Ajour) og síðar **Apex** (Agnar 14.11.2026). Heiti í kóða eru óbreytt.

Fyrirmyndin er NLSH, meðferðarkjarni 4.–6. hæð (11.–14.11.2026). Allt sem þar var gert, mælt og úrskurðað er í
`NLSH-DAGBOK.md` í þessari möppu. Þetta skjal er leiðin; dagbókin er sönnunargagnið og gildrusafnið.

## Svona er þetta keyrt

1. **Lestu allt þetta skjal áður en þú byrjar.** Lestu svo agentaskrána `brunaholf/.claude/agents/gatakort.md` (reglur og
   ALDREI-listinn). Á skrifstofuvélinni: `C:\Users\Slokkvitaeki\brunaholf\.claude\agents\gatakort.md`.
2. **Skrefin eru í röð.** Hvert skref endar á „Staðfest þegar". Ekki halda áfram fyrr en það stendur.
3. **Þurrkeyrsla á undan `--write`, alltaf.** Lestu úttak þurrkeyrslunnar og berðu það við það sem þú áttir von á.
4. **Mælt eða ÓMÆLT.** Hver tala sem þú skilar er mæld (segðu með hvaða tóli) eða merkt ÓMÆLT. Aldrei „líklega", aldrei „um það bil"
   án mælingar á bak við.
5. **Tólin eru skrifuð fyrir NLSH.** Sjá skref 0. Keyrir þú NLSH-tól óbreytt á annað verk er útkoman röng, ekki mæling, og fimm
   þeirra skrifa þá beint í NLSH-verkið. **Skipanirnar í þessu skjali sýna NLSH-heiti tólanna; fyrir annað verk keyrirðu ALLTAF
   afritið þitt (`…-<verk>.cjs` / `…-<verk>.py`), aldrei upprunalega tólið.**
6. **STOPP og spyrja Agnar** þegar: sækja þarf skrá (segja heiti, uppruna, stærð); fela á skráningar; breyta þarf sýn sem uppgjör les;
   senda á eitthvað út; forsenda um magn eða einingu er ekki skrifuð hér né í dagbókinni; vörpun næst ekki undir mörkum í skrefi 5.
7. **Kóðinn er í Kjarna, ekki í brunaholf.** Vinnutré á skrifstofuvélinni: `C:\Users\Slokkvitaeki\kjarni-skrkort` (grein
   `skraning-nlsh-kort`, ýtt á main). Mappan `C:\Users\Slokkvitaeki\kjarni` var 14.11.2026 á gamalli grein: ekki nota hana.
   Tól: `apps/slokkvitaeki/tools/` í vinnutrénu. Vinnuskrár (PDF, PNG, JSON) fara í `C:\Users\Slokkvitaeki\Documents\<VERK>\…`,
   ekki í repo. Python: `python -I <tól>`.
8. **Skrifaðu dagbók jafnóðum:** `<VERK>-DAGBOK.md` í þessari möppu (`brunaholf/.claude/skills/gatakort-nytt-husnaedi/`), sama snið
   og NLSH-dagbókin (tól, tala, dagsetning, orð Agnars).

## Hugtök

- **Yfirlitsblað hæðar:** ein mynd af allri hæðinni (helst brunayfirlit með rauðum brunaveggjum). Hún ER hnitakerfi hæðarinnar.
  Á NLSH: skurður CROP (230, 265, 1930×950 pt) úr A1-blaði við 3 px/pt → 5790×2850 px, 1 px ≈ 29 mm.
- **Vörpun:** `x' = a·x + c·y + e`, `y' = b·x + d·y + f` (sama röð og canvas.transform). Hver Ajour-teikning fær vörpun á
  yfirlitsblað sinnar hæðar. Samsett blað fær `hlutar` (síðasti hluti með `fra_x ≤ x` ræður).
- **Lag:** fagteikning (loftræsing, úði, vatn, rafmagn) sem gegnsæ mynd í hnitum yfirlitsblaðsins, vörpun 1:1.
- **Hlutablað:** 1:50 blað af hluta hæðar. Mörg slík eru púsluð í eitt lag.
- **Stakt verk:** þétting öðrum megin við vegg. Tvö stök verk = ein lokun. Í gólfi: eitt verk = ein þétting, neðri vinnan.
- **Áætlað gat:** staður þar sem þétting á að koma (úr Miro, af teikningu eða handvirkt). **Tillaga:** ágiskun tóls sem
  Agnar hefur ekki staðfest; telst ekki í skýrslu.
- **Nemi:** gegnumtak lags gegnum brunavegg, með breidd. Kortið notar nema til að finna „hinn endann".

## Skref 0 — Forsendur (spyrja, ekki giska)

Fáðu þetta frá Agnari eða úr gögnum áður en nokkuð er keyrt. Það sem vantar: STOPP.

| Spurning | Hvers vegna |
|---|---|
| Hvaða hús, hvaða hæðir, hvað heitir verkið í Ajour? | Heiti greiningarverksins og leit í útflutningi |
| Les uppgjör (hub) þetta verk úr Ajour? | Þá VERÐUR `ajour_nafn` að vera NULL á greiningarverkinu |
| Hvaða teikningar eru til og hvar (Procore, Drive, Ajour)? Útgáfa? | Yfirlitsblað og lög; niðurhal þarf leyfi |
| Hvernig skiptist hæðin í deildir eða álmur? | Deildamörk eru föst í kóða fyrir NLSH |
| Hver er einingin og hvað telst ekki með? | Stök verk, gólf, lagfæringar; ekki erfa NLSH-reglur óséð |
| Er til áætlað magn (útboð, Miro-talning)? | Annars er engin prósenta til, aðeins talning |
| Er verkið eitt verk í Ajour eða fleiri? | Innflutningurinn les eina útflutningsmöppu |
| Eru yfirlitsblöðin vektor-PDF eða skönnun? Hafa hlutablöðin ásamerki? Sama blaðstærð og rammi á öllum? | Ræður leið í skrefi 2 og 3 |

**NLSH-fastar sem þarf að leysa fyrir nýtt verk.** Afritaðu tólið í `…-<verk>.{py,cjs}` og breyttu afritinu; snertu ekki NLSH-tólin.
Hvert `.cjs`-tól sem á `.py`-systur með sama heiti (`-skr-festa`, `-tillogur`, `-kerfi`, `-myndlitur`) KALLAR á hana: afritaðu bæði
og breyttu heitinu sem `.cjs` kallar á. Listinn er mældur með leit í tólunum 14.11.2026; leitaðu sjálfur aftur
(`grep -n "NLSH\|heiti=eq\|Brunayfirlit\|5790\|230, 265" tools/skraning-gatakort-*`) því tólin breytast.

- **⚠ Verkheitið er fast í sex tólum.** `-aaetlud.cjs`, `-flisar-upp.cjs`, `-para.cjs`, `-skr-festa.cjs`, `-vidbot-stutar.cjs` fletta
  upp `skr_verk` með heitinu `NLSH 5-6. hæð · gatakort`, og `-log.cjs` hefur það í `VERK`. Þau taka EKKI `--verk`. Óbreytt lesa þau
  og skrifa í NLSH-verkið, sama hvaða möppu þú gefur þeim.
- **Heiti yfirlitsblaða.** `-aaetlud.cjs`, `-para.cjs`, `-log.cjs`, `-flisar-upp.cjs` finna yfirlitsblað hæðar með
  `Brunayfirlit <haed>` í heiti teikningar. Nefndu yfirlitsblöðin þín „Brunayfirlit <haed>" eða breyttu leitinni í afritinu.
- `skraning-gatakort-innflutningur.cjs`: `HEITI`, `RULES` (blað → hæð/deildir), `TRANS` (blað → vörpun), `CROP`, `S`, leit að
  `/NLSH/` í útflutningsmöppu, `OFAN_FRA`, verkkaupi og heimilisfang, röðun hæða (`6H`/`5H`).
- `-lagmynd.py`, `-skeyta.py`, `-skeyta-lit.py`, `-flisar.py`: `S = 3`, `CX, CY, CW, CH = 230, 265, 1930, 950`.
- **Skráarheiti hlutablaða:** `-asar.py` les blaðnúmerið úr stöfum 6–12 í skráarheiti (`NLSH-M215-01…`); `-skeyta.py`,
  `-skeyta-lit.py` og `-fylgni.py` opna `NLSH-<nafn>.pdf`. Annað heitasnið: breyta í afritinu.
- **Blaðstærð og kvarði hlutablaða:** `TEIKN = Rect(40, 40, 2344, 1440)` (teiknisvæði A1 án nafnreits) í `-skeyta.py`,
  `-skeyta-lit.py`, `-flisar.py`, `-fylgni.py`; `q = 0,2` í `-asar.py` (hlutablað 1:50 á móti yfirliti NLSH). Annar kvarði eða
  önnur blaðstærð: mæla upp á nýtt.
- **Litamörk:** grá fylling stokka í `-skeyta.py` (180/200 og 214–215/230; útveggir 211–212) og rauður brunaveggur í `-veggir.py`
  (R > 190, G og B < 100) eru mæld á NLSH-blöðum. Mældu litina á þínum blöðum áður en þú treystir útkomunni.
- `-tillogur.cjs`: `VERK = 4`. `-kerfi.cjs`, `-myndlitur.cjs`, `skraning-myndir-ajour.cjs`: taka `--verk <id>` (sjálfgefið 4).
- `-skr-festa.cjs`, `-para.cjs`, `-tillogur.cjs`: `--haed <heiti hæðar>` verður að vera sama strengur og í heiti yfirlitsblaðs og í
  skráarheitunum `yfirlit-<haed>.jpg`, `lag-<haed>-<fag>-<blað>.png` (lágstafir í skrám). Flokkahópar ráðast af HEITI flokks
  (`Loft`/`Raufar` → loftræsting, `Stál`/`Plast` → lagnir, `Raf` → rafmagn): aðrir flokkar í nýja verkinu lenda í engum hópi.
- `-vidbot-stutar.cjs`, `KortClient.tsx` (`deildAf`), `SkyrslaClient.tsx` og sýnin `skr_haedarhnit`: deildamörkin 17,9 % · 50 % ·
  81,2 % og hlutamörkin 28,8 % · 71,16 %. **Önnur deildaskipting krefst kóðabreytinga á öllum fjórum stöðum** (sýnin fer um
  schemas og Hermione). Það er sérverk: STOPP og leggja fyrir Agnar áður en byrjað er.
- `KortClient.tsx`: kortin `VEGGIR` og `NEMAR` (lykill `"<haed>:<myndarheiti>"`).
- `SkyrslaClient.tsx`: `HAEDIR`, `DEILDIR`, `GOLF_MARK`, `RAF_MARK`, `OFAN_FRA`, útboðsliðir.

**Staðfest þegar:** svörin eru skrifuð efst í dagbók verksins; listi yfir afrituð tól með breyttum föstum er þar; og
`grep -n "NLSH" tools/*-<verk>.*` skilar engu nema athugasemdum.

## Skref 1 — Teikningar á disk

1. Biddu um leyfi fyrir hverri sókn: heiti skráar, uppruni, stærð. Skrárnar fara í eigin tóma möppu undir `Documents\<VERK>\`.
2. Fyrir hverja hæð: eitt yfirlitsblað (PDF, helst vektor), og fyrir hvert fag annaðhvort yfirlitsblað eða öll hlutablöðin.
3. Skráðu útgáfu og dagsetningu hvers blaðs í `skra.json` í möppunni.

**Staðfest þegar:** `skra.json` telur öll blöð og engin hæð er án yfirlitsblaðs. Vanti yfirlitsblað: STOPP (þá þarf að púsla því
saman úr hlutablöðum fyrst, sama aðferð og skref 3b, og segja Agnari að grunnurinn sé samsettur). Sé yfirlitsblað SKÖNNUN (mynd í
PDF, enginn vektor): STOPP og segja Agnari. Tólin teikna úr vektor og litamörk veggja voru mæld á vektorblöðum; skönnun á NLSH
(4H S1-S2) var snúin um 0,31° og þurfti sérmeðferð.

## Skref 2 — Hnitakerfi hæðar

1. Veldu skurð (CROP í pt) sem nær öllu húsinu á yfirlitsblaðinu, og `S` (px/pt). Sama CROP á allar hæðir ef blöðin eru í sama ramma.
2. Teiknaðu `yfirlit-<haed>.jpg` úr PDF við þann skurð.
3. Mældu kvarðann: px á metra = `S × 2834,65 / kvarðatala blaðsins`. Sannreyndu með þekktri fjarlægð á blaðinu (ásabil eða málsetning).
4. Mældu deildamörk sem hlutfall af breidd (stærstu bilin milli álma) og hlutamörk af hæð, og skráðu þau. Mörkin sjálf eru föst í
   kóða á fjórum stöðum (sjá skref 0): séu þín önnur en NLSH er það sérverk sem Agnar samþykkir fyrst. Þangað til telur kort og
   skýrsla deildir RANGT fyrir nýja verkið; segðu það í skilum.

**Staðfest þegar:** mæld fjarlægð á myndinni víkur minna en 1 % frá málsetningu, og mörkin eru skráð í dagbókina.

## Skref 3 — Lög: stilla fagteikningar af og púsla

**3a. Fagið á heilt yfirlitsblað (eitt PDF á hæð):**
```
python -I skraning-gatakort-stilla.py <brunayfirlit.pdf> <fagblað.pdf> [...]      # hliðrun (dx, dy) í fjórum gluggum
python -I skraning-gatakort-kvardi.py <grunnur.pdf> <lag.pdf> q0 q1 skref         # ef gluggarnir fjórir eru ósammála: leita að kvarða q
python -I skraning-gatakort-lagmynd.py <fagblað.pdf> <q> <dx> <dy> <út.png> [x y w h]   # lagmynd; síðustu fjórar tölur teikna prufu
```
**3b. Fagið á hlutablöðum (1:50), með ásamerkjum:**
```
python -I skraning-gatakort-asar.py <brunayfirlit.pdf> <stilling.json> <blað.pdf> [...]
python -I skraning-gatakort-skeyta.py <stilling.json> <mappa> <út.png>                 # aðeins fylltir stokkar (loftræsing)
python -I skraning-gatakort-skeyta-lit.py litur|dokkt <stilling.json> <mappa> <út.png> # litaðar lagnir | svart blek (raflagnaleiðir)
```
**3c. Hlutablöð ÁN ásamerkja:** borin við hlutablað sama númers úr fagi sem er þegar stillt af:
```
python -I skraning-gatakort-fylgni.py <stilling-viðmiðs.json> <mappa viðmiðs> <forskeyti> <út.json> <blað.pdf> [...]
```
Skref 3 skrifar AÐEINS skrár á disk (JSON og PNG). Lögin fara ekki á kortið fyrr en í skrefi 4, þegar verkið er til.

Gildrur (allar úr NLSH): húsið situr ekki á sama stað á öllum blöðum; eitt blað var 10 % minna; útveggjafylling (grá 211–212) má
ekki slæðast með stokkum (180/200 og 214–215/230); FFT-hliðrun álmu hægra megin má ekki vefja við W/2.

**Staðfest þegar:** fyrir hvert lag hefurðu skoðað prufumynd á TVEIMUR stöðum langt hvor frá öðrum (t.d. sitt hvor endi hússins) og
veggir lags og yfirlits liggja saman innan 3 px. Frávik ásamerkja á NLSH var ≤ 0,06 pt; skráðu þitt.

## Skref 4 — Verk, yfirlitsblöð og skráningar inn

1. Útflutningur úr Ajour (aðeins lestur): `node C:/Users/Slokkvitaeki/luna-bridge/ajour-export-allt.js --project <heiti> --no-photos`.
2. `node skraning-gatakort-innflutningur-<verk>.cjs --yfirlit <mappa>` (þurrkeyrsla). Berðu fjöldann við Ajour.
3. `… --write`. Verkið heitir `<verk> · gatakort` (orðið „gatakort" VERÐUR að vera í heitinu; síðurnar finna verkið á því) og hefur
   `ajour_nafn = NULL` ef uppgjör les verkið úr Ajour.
4. Ljósmyndir, ef Agnar leyfir: `node skraning-myndir-ajour.cjs --verk <id>` (þurrkeyrsla) → `--write`.
5. **Lögin á kortið og flísar** (nú er verkið til; listi laga og `VERK` uppfærð í afritinu af `-log.cjs`, verkheitið í afritinu af
   `-flisar-upp.cjs`):
```
node skraning-gatakort-log-<verk>.cjs            # þurrkeyrsla
node skraning-gatakort-log-<verk>.cjs --write
python -I skraning-gatakort-flisar-<verk>.py <stilling.json> <mappa>
node skraning-gatakort-flisar-upp-<verk>.cjs <mappa>          # þurrkeyrsla, svo --write
```

**Staðfest þegar:** fjöldi skráninga og fjöldi kláraðra í `skr_skraningar` (verk nýja) = tölur Ajour; `skr_yfirlit` og
`skr_hub_skraningar` telja jafnt og fyrir innflutning hjá ÖÐRUM verkum (teldu fyrir og eftir); kortið opnast á `?verk=<id>`.

## Skref 5 — Varpa Ajour-teikningum á yfirlitsblað

Fyrir hverja teikningu sem skráningar sitja á, í þessari röð þar til ein aðferð stenst:
1. **Sama blað og yfirlitið, annar skurður:** vörpun reiknuð úr CROP (`TRANS` í innflutningnum).
2. **Sama herbergjaskipulag:** FFT-fylgni veggja (rauðir/bleikir brunaveggir). Viðmið á NLSH: fylgni 0,50–0,66. Undir 0,50:
   ekki treysta vörpuninni nema bæði (a) og (b) hér að neðan standist; undir 0,40: nota aðferð 4.
3. **Samsett mynd (tvær álmur límdar saman):** sér vörpun á hvorn helming → `vorpun.hlutar` með `fra_x`.
4. **Skönnuð eða snúin mynd, eða annað skipulag:** lestu þrjú ásamót (t.d. A∩1, I∩13, D∩13) af báðum myndum → full affín vörpun.
5. **Blað sem sýnir tvær hæðir:** hlutar eftir y, hvor með sitt yfirlit (ógert á NLSH: „Viðbótarverkefni").

**Staðfest þegar:** (a) yfirlögn sýnir veggi teikningar ofan á veggjum yfirlits á tveimur stöðum; (b) óháð athugun stenst
(á NLSH: miðgildi fjarlægðar gólfskráninga í hreinlætistæki féll úr 1,74 í 1,15 m); (c) deild af stöðu = deild úr heiti blaðs
hjá öllum skráningum blaðsins, eða frávikin eru talin og útskýrð. Næst þetta ekki: STOPP, teikningin fær ekki `yfirlit_id` og
skráningar hennar eru taldar „án staðar" í skýrslu.

## Skref 6 — Brunaveggir og nemar

```
python -I skraning-gatakort-veggir.py <mappa>/yfirlit-<haed>.jpg app/kjarni/skraning/kort/veggir/yfirlit-<haed>.json
python -I skraning-gatakort-nemar.py <yfirlit.jpg> <loftræsilag.png> <veggir.json> app/kjarni/skraning/kort/nemar/loft-<haed>.json
```
Bættu skránum í `VEGGIR` og `NEMAR` í `KortClient.tsx`. Keyra aftur ef yfirlitsmynd eða loftræsilag breytist.

**Staðfest þegar:** `-veggir.py` prentar hlutfall miðlínu innan 1,5 px frá bút (96 % á NLSH; undir 90 %: skoða litamörkin, ekki halda áfram).

## Skref 7 — Færa punkta á skurðpunkt og para

```
node skraning-gatakort-skr-festa.cjs --haed <H> --yfirlit <mappa> --log <mappa>              # þurrkeyrsla
node skraning-gatakort-skr-festa.cjs --haed <H> --yfirlit <mappa> --log <mappa> --write
node skraning-gatakort-para.cjs --haed <H>             # þurrkeyrsla, svo --write
```
Regla færslunnar: næsti skurðpunktur síns lags og RAUÐS brunaveggjar innan 45 px (1,35 m á NLSH; endurreiknaðu radíus í metrum
fyrir þinn kvarða), annars svört vegglína innan 20 px. Punkturinn lendir SÍN megin við vegginn. Handvirkar færslur eru aldrei snertar.
`--afturkalla --write` tekur allar sjálfvirkar færslur hæðar til baka.

**Staðfest þegar:** deild breyttist hjá engri skráningu (teldu deild af stöðu fyrir og eftir; á NLSH: 0); miðgildi færslu er undir
0,6 m (á NLSH 0,18–0,29 m, rafmagn 0,53–0,59 m); `-para.cjs` hefur verið keyrt EFTIR færsluna.

## Skref 8 — Áætluð göt, tillögur og kerfi (eftir því sem gögn eru til)

- **Úr Miro:** `-miro-lesa.cjs` → `-miro-varpa.cjs` (með skjámynd, `-miro-skra.py`) eða `-miro-hough.py` + `-miro-varpa2.cjs` (án
  skjámyndar) → `-miro-flokka.cjs` → `-miro-festa.py` → `-aaetlud.cjs` (þurrkeyrsla, svo `--write`) → `-para.cjs`.
  `-miro-lesa.cjs` hefur slóð á lotuskrá NLSH-lotunnar fasta; gefðu skrá með svarinu sem þriðja viðfang.
- **Tillögur milli hæða:** `-tillogur.cjs --haed <H> --vidmid <nær fullkláruð hæð> --yfirlit … --log …`. Aðeins ef til er hæð sem
  er nær fullkláruð. Tillaga er ekki gat fyrr en Agnar staðfestir hana á kortinu.
- **Lagnakerfi stálröra:** `-kerfi.cjs --verk <id> --log <mappa>` og `-myndlitur.cjs --verk <id>`. Reglan um rauðmálaðar úðalagnir
  er NLSH-regla; spyrja hvort hún gildi í nýja húsinu.
- **Dómar af ljósmyndum** (`visbendingar.json`): stór keyrsla undiragenta. Þarf samþykki Agnars fyrir fram (kostnaður í tokens).

**Staðfest þegar:** hver tegund áætlaðra gata hefur `uppruni` sem segir hvaðan hún kom, og engin tillaga telst í skýrslu.

## Skref 9 — Stöðuskýrsla

Skýrslan (`SkyrslaClient.tsx`) er skrifuð utan um NLSH: hæðir, deildir, áætlun (6H = það sem er skráð; 5H = sami flokkur á sömu deild
á 6H; milliloft 110 og rafmagn 104 á deild) og útboðsliðir. **Ekkert af þessu gildir sjálfkrafa um annað hús.** Fyrir nýtt verk:
STOPP og leggja fyrir Agnar hvaða áætlun á við (útboðsmagn, talning af teikningu eða engin). Án áætlunar sýnir skýrslan talningu,
ekki prósentu.

**Staðfest þegar:** hver áætlunartala í skýrslunni á heimild í dagbókinni, og „Afstemming við Ajour" gengur upp á skráningu.

## Skref 10 — Sannprófun og birting

1. `npx tsc --noEmit -p .` úr `apps/slokkvitaeki` (sía út artcraft/ImageZoom).
2. Commit á `skraning-nlsh-kort` → ýta á main (skipunin er í agentaskránni). Aldrei `vercel --prod`.
3. Lifandi síða með Playwright og öll skrif á Supabase lokuð: kortið opnast á hverri hæð án villna í console, lög kveikjast,
   punktur opnar spjald með mynd, síur telja.
4. Vistaðu texta skýrslunnar fyrir og eftir; útskýrðu hverja tölu sem breyttist.

## Hvað má skrifa

| Hvað | Má | Skilyrði |
|---|---|---|
| `skr_log`, `skr_aaetlud`, `skr_faerslur`, `skr_kerfi`, `flisar`, `vorpun`, `yfirlit_id` | Já | Þurrkeyrsla lesin fyrst |
| Nýtt greiningarverk og skráningar þess (`skr_verk`, `skr_skraningar` með `ajour_registration_id`) | Já | `ajour_nafn = NULL`; sýnir uppgjörs taldar fyrir og eftir |
| JSON í `kort/veggir`, `kort/nemar`, `visbendingar.json` | Já | Í commit |
| `eytt = true` á skráningar | Aðeins með orðum Agnars í lotunni | Afrit + `skr_atburdir` + `--til-baka` |
| Flokkur, staða, texti eða hnit á skráningu | NEI úr tóli eða af agent | Færsla fer í `skr_faerslur`. Agnar breytir sjálfur í viðmótinu („Opna fyrir breytingar" í Stillingum); þau svið eru í `handvirkt` og innflutningur hlífir þeim |
| `ajour_registrations`, `skr_ajour_lesid`, Ajour sjálft | NEI | Aðeins lestur |
| Skilgreining `skr_yfirlit`, `skr_hub_skraningar`, `skr_haedarhnit` | NEI án Hermione | Schemas + samanburður uppgjörs |
| Hard-delete á hverju sem er | NEI | — |
| Póstur, skýrsla eða PDF út úr húsi | NEI | Drög handa Agnari |

## Lokagátlisti (skilaðu honum útfylltum, með ✔/✘ og HVERNIG staðfest)

- [ ] Forsendur skrefs 0 skráðar í dagbók verksins, með orðum Agnars þar sem hann svaraði.
- [ ] Hvert afritað tól: listi yfir fastar sem var breytt. Ekkert NLSH-tól breytt.
- [ ] Kvarði yfirlitsblaðs sannreyndur með málsetningu (frávik í %).
- [ ] Hvert lag: prufumynd skoðuð á tveimur stöðum (hvar, frávik í px).
- [ ] Fjöldi skráninga og kláraðra = Ajour (báðar tölur, dagsetning útflutnings).
- [ ] `skr_yfirlit` og `skr_hub_skraningar` fyrir og eftir hjá öðrum verkum (tölur).
- [ ] Hver Ajour-teikning: aðferð vörpunar, fylgni eða frávik, og fjöldi skráninga sem fékk EKKI stað (með ástæðu).
- [ ] Veggir: hlutfall miðlínu innan 1,5 px. Nemar: fjöldi.
- [ ] Sjálfvirk færsla: fjöldi færðra, miðgildi í metrum, deild breyttist hjá 0. Pörun keyrð eftir færslu.
- [ ] Áætluð göt: fjöldi per uppruna; tillögur taldar sér og ekki í skýrslu.
- [ ] Skýrsla: heimild hverrar áætlunartölu; afstemming gengur upp.
- [ ] tsc hreint; lifandi síða prófuð með skrif lokuð (hvaða hæðir, console-villur 0).
- [ ] Ekki prófað / ÓMÆLT: listi (t.d. „ekki prófað á síma Agnars").
- [ ] Dagbók verksins uppfærð í sama commit.
