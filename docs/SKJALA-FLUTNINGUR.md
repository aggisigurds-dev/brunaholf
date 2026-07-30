# Skjala-flutningur: Drive → Supabase Storage

**Staða:** tillaga, tilbúin til ákvörðunar · **Ritað** 2026-07-30 · **Mælt** sama dag á lifandi gögnum

Tilefni: dauðir skjala-hlekkir „koma alltaf aftur". Þetta skjal segir hvers vegna,
hvað er þegar til staðar, og í hvaða RÖÐ á að gera hlutina. Allar tölur hér eru
mældar, ekki áætlaðar.

---

## 1 · Vandinn í einni setningu

Hlekkur á skjal er í dag **Drive-skráarauðkenni + nafnavenja** — og tengingin er
endurreiknuð með því að **þátta kt og ár úr SKRÁARHEITINU**
(`relink-docs.js:224` og `:357`: `ktFromName(f.name)`, `yearFromName(f.name)`).

Þess vegna rofnar hann í hvert sinn sem einhver endurnefnir, færir eða hleður
skrá upp aftur — og skrár sem aldrei voru endurnefndar (t.d. átta eintök af
`a. Smith.pdf`) geta ALDREI tengst, því nafnið ber hvorki kt né ár.

**Þetta er hönnunargalli, ekki uppsöfnuð óreiða.** Fleiri relink-lotur laga hann
ekki; þær endurreikna bara sömu brothættu ágiskunina.

### Það sem var ÚTILOKAÐ (ekki rannsaka aftur)

| Tilgáta | Niðurstaða |
|---|---|
| 1000-skráa þak í Drive-listun | ❌ Rangt. `listFolder` paginerar rétt (`do/while` á `nextPageToken`) OG gengur rekursíft í undirmöppur. **Sönnun: taldi 1.214 skýrslur — hærra en 1000.** |
| „Setja 2023 í 2023/ undirmöppu lagar þetta" | ❌ Nei. Rekursjón er þegar til staðar (2026-07-22). Skaðlaust fyrir skipulag, lagar engan hlekk. |
| Drive-innsogsföll vantar pagination | ❌ Nei. Þau nota `pageSize:1` + `orderBy modifiedTime desc` viljandi — „nýjasta skráin". Rétt hönnun. |
| Framendinn les >1000 raðir án `.range()` | ❌ Ekki fundið. Aðal-hleðslur (`db.js`, `companieslist.js`, patch 153) paginera; 16 grunuð köll reyndust sía server-megin eða nota `count:'exact'`. |
| `_spine.sitesByBases` sprengir þakið | ❌ Nei, batchar 100 base-id í einu (~130 raðir per kall). |

⚠️ **Undantekning sem stendur eftir:** `pdf-classify.js` notar `pageSize:200` án
lykkju — getur klippt af ef fleiri en 200 passa. Eina raunverulega þak-atriðið.

---

## 2 · Mældar tölur (2026-07-30)

### Skjalaskráin
| | |
|---|---|
| `customer_documents` alls | **3.487** |
| … með `drive_file_id` | 3.080 |
| … með `storage_path` | 212 |
| … með BÆÐI | 16 |
| … með **HVORUGT** ⚠️ | **211** ← draugaraðir, segjast þekja en engin skrá að baki |

### Hlekkja-heilsa (úr `/api/relink-docs?dry=1`)
| | |
|---|---|
| Vísa á skrá sem ER í master | 1.930 |
| **Vísa EKKI á neina master-skrá** | **1.150** |
| … þar af dauðir (fundust hvergi) | 793 |
| … óvissir (fleiri kandídatar) | 64 |
| … tengjast sjálfkrafa strax | 13 |
| Árekstrar (margar raðir á sömu skrá) | 280 |

Unmatched eftir tegund: samningur 332 · **uttektarskyrsla 212** · reikningur 179 · brunakerfi 70

⚠️ **Samningatalan er login.** `relink-docs` telur samningar-masterinn **0 skrár**
— mappan er ekki skönnuð. Öll 332 samnings-skjölin eru því talin unmatched án þess
að vera endilega dauð. **Laga þetta ÁÐUR en tölur eru túlkaðar.**

### Drive-masterar
skýrslur **1.214** · reikningar **870** · samningar **0 (ekki skannað — sjá ofar)**

---

## 3 · Það sem er ÞEGAR TIL — og er stærsta einstaka tækifærið

`customer_documents` **hefur nú þegar `storage_path` dálk**, og appið hefur skrifað
í Supabase Storage síðan patch 233. Í `samningar`-bucketinu liggja:

| | |
|---|---|
| Hlutir alls | **1.559** (239 MB, meðaltal **157 kB**, stærst 1,3 MB) |
| Með `fyrirtaeki_id` Í SLÓÐINNI | **1.537** (98,6%) |
| Vísa á LIFANDI stað | **1.472** |
| Ólíkir staðir | 489 |
| **ÁN samsvarandi `customer_documents` raðar** | **1.534** |

Slóðasniðið sem appið notar er sjálf-auðkennandi:

```
company_attachments/<fyrirtaeki_id>/<ts>_<Fyrirtæki>_-_<kt>_-_<ár>_-_<tegund>.pdf
brunakerfi-skyrslur/<fyrirtaeki_id>/<ár>_<uttekt_nr>_<ts>.pdf
```

> **Staðurinn er MAPPAN.** Engin nafna-ágiskun, engin OCR, engin Drive-köll.
> Um 1.470 rétt-tengd PDF liggja í Supabase sem skjalaskráin veit ekkert um.
> Þetta er líka sönnun þess að slóð-ber-tenginguna líkanið VIRKAR í rekstri —
> patch 233 hefur gert þetta rétt allan tímann.

---

## 4 · Kostnaður

3.080 Drive-skjöl × 157 kB (mælt meðaltal) ≈ **480 MB**. Með því sem þegar er
inni ≈ **0,7 GB**. Supabase Pro inniheldur 100 GB. **Kostnaður er ekki
ákvörðunarþáttur** — hann er í reynd enginn.

---

## 5 · Áfangar — RÖÐIN SKIPTIR ÖLLU

> **Meginregla: AUÐKENNA fyrst, FLYTJA svo.** Að flytja illa nefnda skrá í
> Supabase færir vandann bara um set. Flutningur kemur í veg fyrir FRAMTÍÐAR-rof;
> hann endurheimtir ekki fortíðina. Þetta eru tvö aðskilin verk.

### Fasi 0 — Uppskera Supabase-bucketið *(mesti ávinningur, minnst áhætta)*
Skrá 1.537 sjálf-auðkennandi hluti í `customer_documents` með `storage_path`.
Staður úr slóðinni, kt/ár/tegund úr nafninu. **Engin OCR, engin Drive-köll,
ekkert flutt.** Hrein viðbót; villa er afturkræf með því að eyða röðunum.
Sumir þessara eru líklega afrit af skjölum sem eiga DAUÐAN Drive-hlekk → hlekkir
endurheimtast án þess að snerta Drive.

### Fasi 1 — Laga samningar-masterinn í `relink-docs`
Ein stillingar-lagfæring. Þar til hún er komin eru unmatched-tölurnar rangar
(332 samningar taldir dauðir að ósekju). Ódýrt, og gerir mælingarnar marktækar.

### Fasi 2 — Auðkenna Drive-skrárnar *(óumflýjanlegt, dýrast)*
Keyra innihalds-lesara svo heiti beri `Fyrirtæki - kt - ár`:
`uttekt-rename` (OCR) · `skyrslu-ar` (pdf-parse, ár á skýrslur án árs) ·
`drive-multitool`. Fyrst ÞÁ getur `relink-docs` fundið þær.
Keyra `drive-dedup` á `(1)/(2)` eintökin (færir í rusl, eyðir aldrei).

### Fasi 3 — Flytja í Supabase með ÁKVARÐANLEGRI slóð
```
skjol/<customer_base_id>/<fyrirtaeki_id>/<ár>/<doc_type>[-<invoice_number>].pdf
```
Slóðin er LEIDD AF gagnagrunnsröðinni, ekki af skráarheiti. Þar með **getur
hlekkur ekki rofnað** — hann er reiknaður, ekki geymdur giska. Skrifa
`storage_path`; halda `drive_file_id` sem aukatilvísun (ekkert eytt í Drive).

### Fasi 4 — Leggja niður það sem verður óþarft
`relink-docs` hættir að vera til (engir hlekkir til að laga). Einnig má einfalda
`skjalavarsla`, `drive-dedup`, hluta af `drive-sort`. **Þetta er langtíma-
einföldunin sem réttlætir verkefnið**, ekki bara hlekkja-lagfæringin.

---

## 6 · Enda-mynd: TVINN, ekki hrein skipti

- **Drive helst** mannlega niðurkastið: skannar, Gmail-viðhengi, starfsfólk sem
  flettir í möppum, hlekkir sendir kúnnum. Þessu má ekki fórna.
- **Supabase verður heimildin** (system of record): stöðugar slóðir, tengingin
  búin til EINU SINNI við innsog, aldrei endurgiskuð.
- `multitool.html` er þegar ~mestallur skjala-vafri ef vantar viðmót.

---

## 7 · Varnaglar

1. **Aldrei eyða úr Drive** í neinum fasa. Afrit, ekki flutningur.
2. **Fasi 0 fyrst** — hann er hrein viðbót og gæti einn og sér lagað stóran hluta.
3. **211 draugaraðir** (hvorki Drive né Storage) eru ÞRIÐJA uppspretta falsks
   græns, aðskilin frá dauðum hlekkjum og Heimaleigu-mistengingunni. Yfirfara sér.
4. **`reviewed=true` ofan á RANGA tengingu er verra en ótengt skjal** — það
   þaggar niður í Skýrslu-vaktinni (sbr. Heimaleiga doc 1955: staðfest á rangan
   stað, Freyjugata 16 stóð eftir skjalalaus). Íhuga að krefjast PDF-opnunar
   áður en `reviewed` er sett, og skrá HVER staðfesti (`reviewed_at` var NULL).
5. Mæla eftir hvern fasa með `/api/relink-docs?dry=1` svo framvindan sé töluleg.

---

## 8 · Ákvörðun sem þarf frá Agnari

1. Samþykkja tvinn-endamyndina (Drive = niðurkast, Supabase = heimild)?
2. Keyra Fasa 0 strax? Hann er afturkræfur, snertir hvorki Drive né núverandi
   hlekki, og gæti skilað ~1.470 skjölum inn í skrána á einni keyrslu.
