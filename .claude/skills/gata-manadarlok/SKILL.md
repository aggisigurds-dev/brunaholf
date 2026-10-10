---
name: gata-manadarlok
description: >
  Mánaðarlok gata-verkanna tveggja — Landsspítalinn (NLSH, ÞG verktakar) og Heklureitur
  (Framkvæmdafélagið Laugavegur) — í Gerð reikninga: hvaða gluggi, hvaða mánuður, hvernig
  lokatölur verða að drögum og PDF, hvað er frosið og hvar 5% afslátturinn fer. Notaðu þegar
  Agnar segir „loka mánuðinum", „Efnislisti NLSH", „Landsspítalinn september", „Heklureitur
  göt", „lokastaðan", „setja stöðuna inn", „sendi reikning fyrir mismuninum", eða þegar
  NLSH/Heklureits-gluggi opnast læstur, á röngum mánuði eða með 0 kr.
---

# Mánaðarlok gata-verka (NLSH + Heklureitur)

Hvorugt verkið rukkast eftir Tímaveru. **Dýpri þekking (verð, reglur, saga): agent `bokari`**
(kaflarnir „NLSH" og „Heklureitur"). Minni: `project-nlsh-skyrsla`, `project-heklureitur-efnislisti`.
**Claude stofnar aldrei né sendir reikning** — vistar drög og PDF þegar Agnar biður um það.

## NLSH — Efnislisti · NLSH

**Hvar:** Gerð reikninga → Landsspitalinn (`[data-gr-gata="Landsspitalinn"]`) →
`openNlshEfnislisti(name, monthArg)` í index.html. Sami gluggi opnast úr Kröfu yfirliti
(📄 Efnisl.) og úr Tilbúnum reikningum (Prenta á NLSH-drögum → `printSavedInvoice`).

**Reglurnar sem mega aldrei brotna:**
1. **Sendur mánuður er FROSINN.** `nlsh_manadarlok.fryst_at` sett → glugginn læsir reitum,
   POST á mánuðinn skilar 409. Frosnir mánuðir eru ALDREI endurreiknaðir eftir reglu — senda
   blaðið vék frá reglunni í 5 mánuðum. Leiðrétting fer í NÆSTA mánuð sem mismunur.
2. **Opinn mánuður:** Δ = lokatala − lokatala síðasta mánaðar; heilar = Δ × ½, nema
   gólf/hæðarskil 1.x (1=1). Upphæð Heild = Σ frosnir mánuðir + þessi.
3. **`teknar_fram`:** sé lokatala vistuð eftir mánaðamót (staðan „í dag", eins og september
   07.10) reiknar fallið per verklið `min(lokatala − tillaga, Ajour eftir mánaðamót)` og næsti
   mánuður dregur það frá nýjum lokunum — ekkert tvítalið. Venjuleg vistun gefur 0.
4. **5% afsláttur er settur í Payday, ekki í drögin.** Hver NLSH-reikningur síðan í apríl =
   Efnislisti × 0,95 (ágúst 6.435.896 → R-370 6.114.101). Drög og Kröfu yfirlit sýna upphæð
   FYRIR afslátt — ekki „leiðrétta" það nema Agnar ákveði annað (borðmál #1131).
5. **Sjálfvirk frysting:** drög mánaðarins send (payday_invoice_id / invoiced) með
   `nlsh:true`-línum → frystast við næsta GET. Annars „🔒 Festa" (`#nle-frysta`,
   POST `{action:'frysta', month}`) — birtist þegar reikningur er sendur en mánuður ófestur.

**Skrefin (þegar Agnar biður):**
1. Opna gluggann. Hann velur sjálfur **fyrsta ófrosna mánuðinn** (`autoMan`) — síðumánuður
   skiptir ekki máli. Mánaðarval: `#nle-man`.
2. Reitirnir `#nle-in-N` sýna lokatölu (eða tillögu = fyrri staða + Ajour). „Tillaga"
   (`#nle-tillaga`) fyllir tillögurnar. 📐 `#nle-metrar` = 2.11 í metrum (3 skráningar
   ólæsilegar — Agnar setur þær).
3. **Vista** (`#nle-save`) → POST `/api/nlsh-stada` (lokatölur) + drög „Landsspitalinn"
   (ÞG verktakar ehf. 581198-2569, `discount_pct: 0`, línur `{nlsh:true, verk_nr, qty: heilar…}`).
   Hausinn `#nle-hd-status` sýnir „staða vistuð dd/mm HH:MM".
4. **PDF** (`#nle-pdf`) → `drawNlshEfnislistiPage` (liggjandi A4): heilar per fyrri mánuð,
   st./heil. mánaðarins, Heildar lokanir, Upphæð heild, mánaðarupphæð. Hakið „Fyrri mánuðir:
   aðeins heilar" (`#nle-baraheil`, sjálfgefið á) felur st.-dálka fyrri mánaða.
5. Staðfesta í Kröfu yfirliti: línan `draftinv|Landsspitalinn|<mán>` með PDF-hlekk, og
   **engin** „Tími eftir" fyrir sama mánuð (1c35343: drög → aðeins viðbót, lykill `nlsh-vidbot|<mán>`).

**Lyklagildra:** drögin heita „Landsspitalinn" (án broddstafs), þrep-3 línan „Landsspítalinn".
Mátaðu verkstaðinn með `/landssp|nlsh/i`, aldrei stafsetningu.

## Heklureitur — Efnislisti · göt

**Hvar:** Gerð reikninga → Heklu reitur → 🧾 Efnislisti · göt → `openHeklureitur(name, monthArg)`.
Kláraðar Ajour-skráningar (`registration_status='Done'`) × eigin verðskrá
(`hole_size_rates` scope='heklureitur'). Engir tímar, ekkert efni.

1. **Glugginn á eigið mánaðarval `#hk-man`.** Drögin eru `DRAFTS[ws|mánuður gluggans]` — ALDREI
   `draftFor` (hann les mánuð síðunnar). Gildran 06.10: síðan á ágúst → 0 kr drög #338.
2. Mánuður án kláraðra gata → glugginn hoppar á síðasta heila mánuð.
3. Ókláraðar skráningar og flokkar utan verðskrár sjást sem viðvörun — Agnar bætir við
   handvirkt (`#hk-add-sel`).
4. Vista (`#hk-save`) → drög „Heklu reitur" (gat-línur `gat:true`, `materials_total` 0,
   `fixed_total` = samtala) · PDF `#hk-pdf`.
5. Ajour-raðirnar koma frá luna-bridge `ajour-yfirlit.js syncVerkefnaRadir` — útrunnin
   Ajour-innskráning brúarinnar = gamlar tölur (`retry-ajour-login.bat`).

## Áður en þú segir „klárt"
Prófaðu í gegnum viðmótið með skill `vidmotsprof` — líka með síðuna stillta á ANNAN mánuð en
gluggann. Raunvistun aðeins þegar Agnar bað um hana; PDF-ið sent honum (SendUserFile).
