# STAÐREYNDIR — sannreynt grunnkort (fact ledger)

Þetta skjal er **and-endurtekningar-skráin**: staðreyndir sem Agnar hefur þurft að
leiðrétta/endurtaka, skrifaðar niður EINU SINNI og sannreyndar gegn lifandi
gagnagrunni. Þegar Agnar leiðréttir staðreynd í samtali á hún að lenda HÉR (og í
CLAUDE.md ef hún breytir vinnureglu). Tölur merktar *(DB 2026-07-30)* voru lesnar
beint úr Supabase þann dag — þær eldast; reglurnar sjálfar eldast ekki.

Speglað í báðum repo-um (slokkvitaeki + brunaholf) því gagnalíkanið er sameiginlegt.

---

## 0. Fyrirtækin og öppin — hvað á hvað, hvar býr hvað

**⭐ SAMHENGIÐ SEM ÚTSKÝRIR ALLT (Agnar 2026-07-30):** Slökkvitæki ehf var **keypt
fyrir ~3 mánuðum** (vor 2026) og skipulagið sem fylgdi var HRÆÐILEGT. Síðustu 3
mánuðir — og áfram — eru **endurheimtar-aðgerð: finna ALLA þjónustukúnna félagsins
og endurheimta þá.** Þetta er ástæðan fyrir öllu Bakendi-tólasettinu (Skýrslu-stöð,
Hreinsi-borð, Drive-flokkun, Kt-samræming, Skýrslu-vakt, Þjónustu-gloppur…): það er
ekki ofur-verkfræði heldur björgunarbúnaður. Þess vegna er skráarheitum ekki
treystandi, þess vegna er allt tengt með sönnun (Tengireglan), og þess vegna er
„fyrirtæki með skjöl en ekki merkt í þjónustu" = líklega TÝNDUR kúnni, ekki
gagnavilla. **Öll forgangsröðun tóla og verka á að þjóna þessari endurheimt.**

*Endurheimtar-staðan (DB 2026-07-30):* 655 staðir merktir í þjónustu · **56 félög
eiga þjónustuskjöl en ENGINN staður þeirra er í þjónustu** (líklega týndir kúnnar
→ `thjonusta-gloppur.html`) · skýrslu-þekja staða í þjónustu: 366 ok · 180 gömul ·
62 ENGIN skýrsla · 47 ólesanleg (→ Skýrslu-vakt/Skýrslu-stöð).

**Stolpi — gamla kerfið, ókannaður endurheimtarbrunnur (Agnar 2026-07-30):**
gamla forritið félagsins heitir **Stolpi** — old-school, erfitt í notkun, **lifir á
afgreiðslutölvu Slökkvitækja** og gæti geymt MEIRI upplýsingar (kúnnar, reikninga-
sögu) sem ekki hafa verið endurheimtar. Þekkt spor í gögnunum: `Stolpi_Invoice_
10xxxx.pdf` / `…bokhald-Nóta.pdf` skrár í Drive (multitool greinir þær sem OKKAR
reikninga) og „týndu Stólpa-reikningarnir feb–mars 2026" (fundnir gegnum
bokhald@eldklar.is SENT). Könnun á Stolpi-gögnunum sjálfum er skráð á Verkefnalistann.


- **Brunahólf ehf Á Slökkvitæki ehf** (kt 600508-0400) — móður-/eigendafélag
  (Agnar 2026-07-30). Eldri skjölun sagði „sister business" — eignarhald er rétta
  sambandið. Brunahólf = brunavarnir í sameign/verktakahlið; Slökkvitæki =
  slökkvitækjaþjónusta.
- **brunaholf.netlify.app er STJÓRNSTÖÐIN/bakendinn** — geymir dýpri bakenda-
  upplýsingar og -tól fyrir BÆÐI félögin, líka um Slökkvitæki: skjala-/Drive-tólin,
  Skýrslu-stöð, Kt-samræming, Hreinsi-borð, Kerfis-kort, gmail-ingest, dkPlus/
  Payday-functions. **Þegar leitað er að ítarlegri/bakenda-upplýsingum um
  Slökkvitæki: byrja í Brunahólfs-hubbnum**, ekki slokkvitaeki-appinu.
- **slokkvitaeki.netlify.app er daglegi reksturs-appið** Slökkvitækja (Sala/POS,
  tæki, þjónusta, bílstjórar).
- **Áhorfendur appanna (Agnar 2026-07-30):** brunaholf-hubburinn er **stjórn- og
  greiningartól AGNARS** (control & analysis); slokkvitaeki-appið er **starfsmanna-/
  vinnustaðaapp** (staff worksite app). Ný stjórn-/greiningarvirkni á heima
  brunaholf-megin; starfsmanna-flæði slokkvitaeki-megin.
- **⚠️ AÐSKILNAÐUR ÞJÓNUSTUKERFA (Agnar 2026-07-30): brunakerfis-þjónusta og
  slökkvitækja-þjónusta hafa AÐSKILDA starfsmannahópa — skýrslur mega ALDREI leka
  milli kerfanna.** Gagnahliðin er þegar aðskilin (`doc_type='brunakerfi'` vs
  `'uttektarskyrsla'`; skýrslu-lesarar sía á uttektarskyrsla; multitool hefur SÉR
  markmöppur fyrir brunakerfis-skýrslur/-reikninga) — reglan gildir líka um ALLA
  framtíðar-UI: skýrslu-veljarar, Bílstjóri/vakt-sýnir og starfsmannaflæði mega
  aðeins sýna skýrslur SÍNS kerfis.
- Bæði öpp deila EINUM Supabase (`osfdzskyvisifcwyjkuk`).
- **Vélaflotinn (Agnar 2026-07-30) — FIMM tölvur:** fjórar hjá Slökkvitækjum —
  **afgreiðsla** (þar lifir Stolpi) · **stærri** · **laptop** · **verkstæði** —
  plús **heimaskrifstofa** heima hjá Agnari. Claude Code-uppsetningin (setja-upp.py
  + athuga-uppsetningu.sh, sjá Verkefnalistann) á að fara á þær allar; EIN var
  kláruð aðfaranótt 2026-07-30 (Windows-notandi „Slokkvitaeki", repo-in í
  `Desktop\Claude workshop` — óstaðfest hvaða vél af fjórum það er). Ósvarað:
  hvaða vél er „bridge-tölvan" sem keyrir luna-bridge Task Scheduler-scripturnar.

## 1. Viðskiptavina-líkanið — hver tafla er hvað

**Þrjár „viðskiptavina-töflur" eru til, en þær eru EITT kerfi, ekki þrjú:**

| Tafla | Er | Staða *(DB 2026-07-30)* |
|---|---|---|
| `customers_base` | **„Allir viðskiptavinir"** — kanóníski hryggurinn, ein röð per kennitölu | 1.082 raðir, allar með kt |
| `fyrirtaeki` | **Staðir/starfsstöðvar** — greinin á hryggnum, EKKI sér kúnnalisti | 1.214 lifandi (+143 soft-deleted); **655 í þjónustu** = „Fyrirtæki í þjónustu" (601 aðgreind félög) |
| `vidskiptavinir` | **LÆGSTA þrepið** — legacy einstaklingar frá því fyrir hrygginn | 414 raðir; **375 af 383 kt eru þegar í base (~97% tvítekning)**; aðeins 8 kt lifa EINGÖNGU hér |

- **Forgangsröð (Agnar 2026-07-30):** það sem skiptir máli er `customers_base` +
  `fyrirtaeki` með `er_i_thjonustu=true`. `vidskiptavinir` er ALDREI aðal-uppfletting.
- `er_i_thjonustu` ER þjónustuflokks-merkið — það er engin sér flokka-dálkur.
- **Walk-in / nafnlaus sala = kt `999999-9999`** — nákvæmlega EIN base-röð *(DB 2026-07-30)*.
- Hjálpartöflur (ekki kúnnalistar): `customer_worksite_map` (119 — greiðandi→verkstaður
  í Brunahólfi) og `customer_info` (33 — greiðsluhegðunar-nótur).

**Rekstrarfélög — einn kt á marga staði. ALDREI sameina/eyða stöðum rekstrarfélags** (Agnar, standandi regla). Stærstu *(DB 2026-07-30)*:

| Merki/félag | Staðir |
|---|---:|
| Eignaumsjón (merki þvert á kt) | 69 |
| Heimaleiga ehf (510117-0690) | 11 |
| Pizzan ehf (681016-1200) | 11 |
| Center Hótel (450905-1430) | 10 |
| Steypustöðin (660707-0420) | 7 |
| Endurvinnslan (610789-1299) | 5 |
| Colas Ísland (420187-1499) | 4 |
| Aðalskoðun (540994-2269) | 4 |

NB eldri skjölun sagði „Colas 3 staðir" og „Eignaumsjón 59+" — lifandi tölur að ofan
gilda. Sama gildir um „95+ companies" í gömlu schema-lýsingunni (nú 1.214).

**`uttaeki` (tæki): 5.843, þar af 5.648 án staðar** *(DB 2026-07-30)* — þau eru
**auto-generuð placeholder og „án staðar" er EKKI vandamál** (Agnar 2026-07-12).
Ekki flagga sem heilsubrest, má eyða/endurgera. **Ótengd tæki eru ALDREI verkefni
(Agnar 2026-07-30)** — sannleikurinn um tækjafjölda staðar er **NÝJASTA
úttektarskýrslan** (`arsskodun_report_facts`, PK per stað, aldrei yfirskrifað með
eldri skýrslu); uttaeki-raðir mega fylgja henni með eyðslu/endurgerð að vild.

**Skráningarregla bygginga (Agnar 2026-07-30):** hver bygging/staður skal skráð á
sitt rekstrarfélag — og við tengingu skal sannreyna **BÆÐI staðsetningu
(heimilisfang) OG kennitölu**; nafn eitt og sér er ekki sönnun (sbr. Tengireglan,
og Hamraborg 7 ≠ Hamraborg ehf ruglingurinn).

**Opnar gloppur** *(DB 2026-07-30)*: 179 lifandi `fyrirtaeki` ótengd base · 29
`vidskiptavinir` ótengd · 8 kt aðeins í vidskiptavinir. Verkfærin: Sameining
(`#sameining`, slökkvitæki) + Kt-samræming/Hreinsi-borð (Bakendi, brunahólf).

## 2. Skjöl viðskiptavina (`customer_documents`) *(DB 2026-07-30)*

**📌 VEIÐI-GRUNNLÍNAN (tekin 2026-07-30, fyrir veiðina):** framvinda veiðinnar
mælist gegn þessum tölum — sbr. `ar_checkpoints`-mynstrið. Þetta er
**upphaf Agnars**, ekki dagsins tala — aldrei færa. **Lifandi mælaborð:
`brunaholf.netlify.app/veidin.html`** og HUD á `jarvis.html` (nuna vs
grunnlína vs delta + hunt-listar: systkini-kt, blob-græn, HUD Búið vs
`customer_documents`, Drive-tvítök).

| Ár | Úttektarskýrslur (staðir) | Reikningar (staðir) | Brunakerfi |
|---|---|---|---|
| 2026 | 294 (252 staðir · 42 tvítök) | 588 (336) | 18 |
| 2025 | 415 (283 · 125 tvítök) | 325 (215) | 19 |
| 2024 | 513 (360 · 152 tvítök) | 283 (206) | 24 |
| 2023 | 493 (364 · 103 tvítök) | 81 (69) | 11 |

Þekja 655 þjónustustaða: **243 með 2026-skýrslu (37%) · 274 með 2025-skýrslu (42%)
· 250 staðir með HVORUGT ÁRIÐ (38%)** — það er aðal-skotmark veiðinnar. Auk þess
336 skjöl ÁN ÁRS í trackernum (skyrslu-ar/felag-endurlestur laga).

*2026-borun (leiðrétt við smíði Veiðinnar — fyrri „~80 rukkuð án skýrslu" taldi
alla staði; rétt skilgreining er ÞJÓNUSTUstaðir):* **45 þjónustustaðir rukkaðir
2026 án 2026-skýrslu.**  238 félög með 2026-skoðun á tækjum · 237 með 2026-skýrslu · 210 með
bæði · **28 félög með skoðun EN ENGA skýrslu** (amber „tekið út — skjöl eftir" =
auðveldustu veiði-vinningarnir) · 76 merkt „Tekið út" í Bílstjóra. Fact-check
(`reviewed` í Skýrslu-stöð): **14 af 294 2026-skýrslum (5%)**, 57 alls. Skýrsla↔
prófíl-tæki: 496/506 félög passa nákvæmlega (98% — NB tækin eru GENERUÐ úr
skýrslunum svo þetta mælir innra samræmi; 10 frávik = skýrsla propagaðist ekki).

*Skjala-heild per stað (öll ár):* öll þrjú skjölin (skýrsla+reikningur+samningur)
**90 staðir (14%)** · með samning yfirhöfuð aðeins **144 (22%) — samningar eru
veikasta hliðin**. *Tæki:* 593 staðir eiga report-facts (`total_devices`, 546
hreinar þáttanir) — það ER tækjatalan; uttaeki-raðir eru ótengdar (589/593 núll)
og skipta ekki máli skv. reglu. *Tengiliðir:* netfang á 457/655 stöðum (70%) og
409/601 félögum — **~192 þjónustufélög ÁN netfangs** (skotmark tengiliða-veiðinnar);
sími aðeins á 188 stöðum (29%).

| doc_type | Fjöldi | Án base | Án staðar | Tvítök-flögguð |
|---|---:|---:|---:|---:|
| uttektarskyrsla | 1.726 | 51 | 13 | 423 |
| reikningur | 1.353 | 0 | 40 | 6 |
| samningur | 336 | 83 | 81 | 48 |
| brunakerfi | 75 | 3 | 1 | 7 |

- **Kanónískar Drive-möppur — ALLAR Í VIRKRI SÖFNUN (Agnar 2026-07-30):**
  úttektarskýrslur fyrirtækja í þjónustu → **`1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg`**
  („Úttektarskýrslur") · reikningar → **`1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p`**
  („Reikningar - Invoices") · **brunakerfis-úttektir →
  `1OtsCTzM6FEQbaKBrQ7SqEU6xFKGBWICu`** · **brunakerfis-reikningar →
  `1Qp5TogjHhszE_4hfMW5ebGKLDHk5iqEV`**. Brunakerfis-möppurnar tvær eru SÉR
  masterar (aðskilnaðarreglan í §0: brunakerfis-skjöl blandast ALDREI við
  slökkvitækja-skjölin) — þetta eru markmöppurnar sem multitool
  „brunakerfisskýrslur"/„brunakerfis reikningar"-reitirnir eiga að fá.
  **⚠️ Innihald brunakerfis-mappanna er EKKI enn fact-checkað (Agnar 2026-07-30)**
  — safnað en óyfirfarið; ekki treysta flokkun/tengingum þar fyrr en yfirferð
  hefur farið fram. Allar fjórar í virkri söfnun — hluti af endurheimtar-
  aðgerðinni, EKKI fullbúin skjalasöfn: skjöl bætast enn við (drive-sort,
  uttekt-upload, multitool, reikningar-read mata þær), svo talningar úr þeim eru
  augnabliksmynd, ekki heild.
- **Virk skjala-söfnun (Agnar 2026-07-30):** þegar þjónustuskjal (úttektarskýrsla/
  reikningur/samningur/brunakerfisskjal) FINNST hvar sem er — Drive, póstur,
  tölvurnar, Stolpi — skal það VIRKT tekið upp og keyrt gegnum
  **multitool-verklagið**: (1) endurnefnt í kanóníska nafnasniðið (skýrsla:
  `Fyrirtæki - kt - Heimilisfang - Ár - Mánuður [ - #site]` · reikningur:
  `Fyrirtæki - kt - R nr - dags - upphæð`), (2) FÆRT í réttu master-möppuna (sjá
  að ofan — brunakerfi í SÍNA), (3) TENGT í `customer_documents` með sönnun
  (linkMode `warn`, Tengireglan). Aldrei látið liggja þar sem það fannst.
- EIN úttektarskýrsla per (staður, ár); reikningar dedup á R-númer.
- `is_duplicate` er afturkræft flagg — skjali er ALDREI eytt.
- **Tengireglan** (`_spine.js`): `fyrirtaeki_id` AÐEINS með sönnun (#id-stimpill í
  nafni / eini staðurinn / heimilisfang / aðgreinandi nafn) — aldrei giskað, aldrei núllað.

## 3. Sölur, kröfur, bókhald — hvað tengist hverju

- **`solur`** (Slökkvitæki POS): 575 *(DB 2026-07-30)*. **`payday_invoices_slokk`**:
  171 — kt geymt STAFATÖLUR EINGÖNGU, tengist eftir kt (ekki FK).
- **`invoices`** (Brunahólf AR): 435. **⚠️ `status` er BLANDAÐUR orðaforði** —
  Payday-API skrifar enska HÁSTAFI (PAID/SENT/CANCELLED/CREDIT/DRAFT), Landsbanki+
  handvirkt íslensku (Greidd/Ógreidd/…). **Lesa ALLTAF með substring-match** og
  „ó/o"-forskeyti = neitun. Opið AR = FYLLIMENGIÐ (ekki paid/draft/cancelled/credit).
- **TVEIR Payday-aðgangar, aldrei blanda:** Brunahólf-Payday → `invoices`;
  Slökkvitæki-Payday → `payday_invoices_slokk`.
- **dkPlus = bókhald Slökkvitækja.** Kúnni VERÐUR að vera til í dk fyrir reikning
  (annars villandi „Value cannot be null: user"); `SalesPerson` skylda ('as');
  draft vs póstað er `?post=false|true`.
- Upphæðir í AR-síðum eru **MEÐ VSK** (`upphaed_total`) — passar við bókhaldslykil 3400.

## 4. Tölvupóstur (`email_digest`) *(DB 2026-07-30)*

30.724 raðir, 5 pósthólf:

| Pósthólf | Raðir | Nýjast | SENT |
|---|---:|---|---:|
| aggisigurds@gmail.com | 22.552 | 27.7. | 28 |
| eldklar@eldklar.is | 5.147 | 29.7. | 138 |
| Brunaholf@brunaholf.is | 2.916 | 27.7. | 0 |
| bokhald@brunaholf.is | 72 | 26.7. | 0 |
| brunaholfehf@gmail.com | 37 | 9.7. (staðnað) | 0 |

- ÞRJÁR innsogs-leiðir, allar jafngildar (dedup á `message_id`): luna-bridge
  (desktop/Thunderbird) · gmail-ingest (ský) · Chrome-viðbót (browser-bridge).
- SENT-raðir bera `folder='SENT'` — innhólfs-lesarar sía `folder=neq.SENT`.
- **Virku pósthólfin NÚNA (Agnar 2026-07-30):** Slökkvitæki = **eldklar@eldklar.is**
  + **bokhald@eldklar.is** · Brunahólf = **brunaholf@brunaholf.is** +
  **bokhald@brunaholf.is**. Önnur hólf í digest eru persónuleg (aggisigurds@gmail.com)
  eða legacy (brunaholfehf@gmail.com, staðnað 9.7.).
- **⚠️ GLOPPA (fundin við sannreyn 2026-07-30): `bokhald@eldklar.is` er EKKI í
  `email_digest`** — eitt af fjórum virkum hólfum er ekki innsogað (gmail-ingest
  hefur aðeins tekið SENT-möppuna þess í eitt skipti skv. skjölun, aldrei INBOX
  reglulega). Þarf tengingu í gmail-ingest fjöl-aðganga (`google_oauth` röð per hólf).
- **aggisigurds@gmail.com = Claude-aðgangurinn** (innskráning, Drive-deiling);
  eldklar@eldklar.is er VIÐSKIPTA-pósthólf, ekki Claude-aðgangur.
- **Þráður = nýjasta skilaboðið (Agnar 2026-07-30):** við mat á stöðu póstsamtals
  gildir NÝJASTA skilaboðið í þræðinum — EKKI gömul stjörnumerkt skilaboð í miðjum
  þræði (sbr. `threadLatest`-lógík Verkborðs; SENT-raðir teljast með í svarað-mati).

## 4b. Kúnna-þjónustuborð — stefnan (Agnar 2026-07-30)

Samskipta-summurnar eru FYRSTU pústarnir í stærra **multi-funct kúnna-þjónustuborði**
sem tengist tölvupósti beint. Stefnan (byggt stig af stigi):
- **Summa per kúnna/félag** — lítil, ALLTAF sýnileg (staða · tengiliðir · nýjast · opin mál),
  útvíkkanleg í fulla póstsögu + aðgerðir. Geymt í `app_settings.rekstrarfelag_notes[merki]`
  (rekstrarfélög) — sömu leið má nota per `fyrirtaeki_id` fyrir staka kúnna.
- **Póst-tengingin** er þegar til: sýnin `rekstrarfelag_samskipti` (merki→póstar gegnum
  base+staða-netföng+lén) og `fyrirtaeki_samskipti` (per stað). Patch 286 birtir hráa listann;
  næsta skref er að birta CURATED summuna ofan á honum.
- **Framtíð = eitt þjónustuborð** sem sameinar: summu, póstsögu, svör beint (240 `replyTo`
  Resend-uppkast), NÝTT/flögg (281), beiðnir (Verkborð `thjonustubeidni`), tilboð/samninga.
  Þ.e. hvert kúnna-spjald verður full CRM-eining með lifandi póst-tengingu — ekki bara lesin saga.
- Hlið-varúð: NÝ sameiginleg þjónustuborðs-tafla (ef byggð) á að virða aðskilnað brunakerfis/
  slökkvitækja (§0) og lifa Brunahólf-megin ef hún er stjórn-/greiningartól.

## 5. Fastar vinnureglur (brotnar oftast — þess vegna hér)

- **ALLTAF LEYFA VISTUN** — enginn Vista-hnappur má blokka á validation/undirskrift.
  Kröfu-check á heima í YFIRFERÐ, aldrei sem stopp á vistun.
- **Deploy slökkvitækja = `git push` EINGÖNGU** (CI keyrir build-dist + functions).
  `deploy.js` er ÓVIRKJAÐ og eyðir functions — aldrei keyra. 4 vélar deila repo-inu:
  alltaf `git pull` fyrst.
- **Brunahólf: ekkert build-þrep** — `index.html` + functions beint.
- UI á íslensku · ISK án aukastafa · dagsetningar ISO í geymslu, dd.mm.yyyy í birtingu.
- **`project_aliases` fyrir ALLA þvers-uppflettingu verkstaða** — sami staður heitir
  mörgum nöfnum (Fjarðagata = Fjörður/Fjörðurinn/Strandgata/Fjarðargata). Bæta við
  alias þegar nýtt afbrigði sést, ekki harðkóða.
- Innri tímar (Slökkvitæki ehf í Tímaveru) eru EKKI rukkaðir (NON_BILLABLE).
- **Ókláruð kóðavinna → Verkefnalisti (Agnar 2026-07-30):** vinna sem skilin er
  eftir hálfnuð/óhafin skal SKRÁÐ á Verkefnalistann (`verkefnalisti.html` +
  `POST /api/verkefnalisti {action:'add', title, description}`) svo hún gufi ekki
  upp með session-inu. Gildir um Claude-sessions jafnt sem menn.
- **Verkefnalisti skoðaður í UPPHAFI samtals (Agnar 2026-07-30):** spegilreglan —
  við upphaf vinnu-session skal líta á opin verk
  (`GET https://brunaholf.netlify.app/api/verkefnalisti`, staðir beidni/i_vinnu)
  áður en nýtt verk er hafið; hálfnuð verk og feedback frá Agnari ganga fyrir.
- **Tengiliðaupplýsingar — virk söfnun (Agnar 2026-07-30):** þegar sími, netfang
  eða tengiliður sést HVAR SEM ER (póstur, PDF, skýrsla, samtal) skal skrá það á
  prófíl félagsins um leið (`fyrirtaeki`/`customers_base`: sími/netfang/tengiliður)
  — ekki láta fljóta hjá. NB `fyrirtaeki` ber tvítekna dálkinn
  `tengiliður`/`tengilidur` (sjá Bakendi-skema) — skrifa í þann sem röðin notar.
- **VIRK VEIÐI — hunt, ekki bara grípa (Agnar 2026-07-30):** veiðin er HAMUR, ekki
  verkefni — hún keyrir SAMHLIÐA annarri vinnu, alltaf. Í hvert sinn sem session
  snertir póst (`email_digest`), nótur á Verkborði (`thjonustubeidni`), eða mynd af
  HANDSKRIFAÐRI nótu sem Agnar sendir (lesa hana og beina innihaldinu í réttan
  farveg: tengiliðir → prófíll · skjöl → multitool · verk → Verkefnalisti ·
  staðreyndir → þessi skrá · byggingar-uppl. → prófíll) skal um leið leitað að
  (1) tengiliðaupplýsingum félaga, (2) **NÝJUM tækifærum — skátun (Agnar
  2026-07-30):** nýjar þjónustubeiðnir (Verkborð `nytt` + ósvaraður póstur),
  tilboðs-beiðnir sem enginn svaraði, og óskráðar sölur (unnið verk án
  solur-raðar, drög >7 daga) — og (3)
  **byggingar-upplýsingum staða**: hvar tækin eru (inni í herbergjum eða í
  SAMEIGN), skipulag hússins, og aðgangs-/hurðakóðar til að komast inn. Allt á
  að safnast og vera SÝNILEGT á prófíl félagsins (sbr. minnispunkta-mynstrið
  `arsskodun_customers` sem samstillir skrifstofu↔bílstjóra, og `uttaeki.location`).
  **⚠️ ÖRYGGISFYRIRVARI: hurðakóðar eru viðkvæm gögn** — 19 töflur eru með RLS AF
  og anon-lykillinn er opinber (js/config.js), svo kóðar mega EKKI fara í opna
  anon-lesanlega dálka; geymsla þeirra þarf læsta töflu (RLS/service-role — sbr.
  `vefryni_pages`-mynstrið). Þar til sú tafla er til: skrá kóða EKKI í grunninn.

## 6. Öryggi — staða og lærdómar

- **CLAUDE.md beggja síðna var opinberlega sóttanlegt** (lagað 2026-07-29 með
  404-redirect-reglum FREMST í netlify.toml á báðum). Rót á slökkvitæki: TVÆR
  deploy-leiðir keppa (CI→dist/ vs Netlify-Git→rót) — reglur í netlify.toml verja báðar.
- **NETLIFY_TOKEN var í birta skjalinu → SKIPTA UM HANN** (app.netlify.com →
  Applications → Personal access tokens). Opið verk þar til gert.
- Leyndarmál eiga heima í Netlify env vars — ALDREI í CLAUDE.md/repo.
- 19 töflur með RLS af (anon-lykill les/skrifar) — þekkt, bíður sér verkefnis með
  stefnum per töflu.
