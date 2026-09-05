# Reikningalota — kynning sem hver ný lota les FYRST

> Fyrir Cowork, Claude Code og hvern þann sem sest niður með Agnari til að klára
> reikninga. Agnar (05.09.2026): „í hvert sinn sem ég loksins ætla að gera þetta þarf ég að
> útskýra allt — hvernig allt virkar, hvernig félögin tengjast, hvort hann sé með nýjustu
> póstana, hvort póst-tengingin hafi dottið út, afslættirnir … svo kemur truflun og ég
> byrja upp á nýtt viku síðar." **Þetta skjal er svarið: lestu það, spurðu ekki um það.**
>
> Reglan um staðreyndir gildir: tölur og kúnna-staðreyndir búa í `docs/STADREYNDIR.md`
> og gagnagrunninum — hér er kortið og rútínan, ekki afrit af tölum.
>
> **Agentinn sem á þetta skjal: `rukkari` 🦆** (`.claude/agents/rukkari.md`, spegill í
> slokkvitaeki) — kallaðu á hann og hann gerir kafla 1 sjálfur, kallar á bokari /
> sala-reikningar / eldklar-postur og heldur utan um lotuna.

---

## 1 · Byrjunarrútína lotu (gerðu þetta ÁN þess að spyrja)

1. **Opnaðu Drög-stöðina** — `brunaholf.netlify.app/#drogstod` (eða `GET /api/reikningspunktar?op=stada`
   + `GET /api/reikningspunktar?status=nytt,flokkad`). Þar er allt sem Agnar hefur hent inn:
   punktar, vísbendingar, ákvarðanir sem bíða. Miðarnir út um allt eru þarna núna, ekki á borðinu.
2. **Athugaðu tengingarnar** — `GET /api/data-sources-status` (sama og strimillinn efst í
   Drög-stöðinni). Segðu í EINNI línu hvað er ferskt, hvað er að eldast og hvað er ótengt:
   sex póstreikningar (`email_accounts`), Tímavera, Payday, Redder, Landsbanki, Ajour.
   Sé póstreikningur `not_connected` eða `aging` → segja það strax; ekki fullyrða að þú
   „sjáir nýjustu póstana" fyrr en `newest` á reikningnum er frá deginum.
3. **Segðu stöðuna í fjórum línum:** (a) tilbúið að senda (`ready:true`), (b) bíður punkta
   eða upplýsinga, (c) **bíður ákvörðunar Agnars** (punktar með `tegund:'spurning'` eða
   ósvöruðum `spurningar[]`), (d) tengingar sem eru dottnar út.
4. **Vinnið eftir Drög-stöðinni**, eitt verk í einu: staðfesta punkta („✓ Setja á drögin"),
   klára gátlistann, senda. Hver punktur sem er skrifaður í drögin merkist `notad` með
   `applied`-afriti — ekkert tapast þótt lotan slitni.
5. **Þegar Agnar nefnir eitthvað nýtt** („muna að …", „spyrja X um …") — skráðu það sem
   punkt í Drög-stöðina (`POST /api/reikningspunktar {action:'add', felag, raw}`), ekki í
   svarið þitt. Næsta lota, þótt hún sé viku síðar, byrjar þá nákvæmlega hér.

**Ef lotan slitnar** (truflun, vika líður): ekkert þarf að endurtaka. Innhólfið, gátlistarnir
og `applied`-sagan eru sannleikurinn. Byrjaðu aftur á skrefi 1.

---

## 2 · Félögin og kerfin — kortið

| | Brunahólf ehf | Slökkvitæki ehf |
|---|---|---|
| Hvað | Brunaþéttingar / brunavarnir í sameign. **Móðurfélagið**; keypti Slökkvitæki fyrir nokkrum mánuðum. | Þjónusta og sala slökkvitækja, brunavarnaúttektir, búð. kt 600508-0400. |
| Appið | Hubbinn `brunaholf.netlify.app` (`index.html`, ein skrá) | `slokkvitaeki.netlify.app` (POS, úttektir, kröfu-yfirlit) |
| Reikningurinn verður til | Efnislisti í Gerð Reikninga → `invoice_drafts` | Sala í POS → `solur` |
| Krafan fer í banka | Bókarinn (bokhald@brunaholf.is) býr til Payday-reikning eftir „Senda í bókun" | `payday-push.js` beint úr kröfu-yfirliti appsins |
| Sérfræðingur (agent) | `brunaholf/.claude/agents/bokari.md` | `slokkvitaeki/.claude/agents/sala-reikningar.md` |

- **Sami Supabase-grunnur** (`osfdzskyvisifcwyjkuk`) undir báðum — `fyrirtaeki` (kúnnar
  Slökkvitækis), `solur`, `invoice_drafts`, `invoices` (Payday), `email_digest`, `reikningspunktar`.
- Eignarhaldið á kúnnum/rekstrarfélögum er enn í tiltekt — **aldrei finna upp tengingu milli
  félaga**; sjá `docs/STADREYNDIR.md` og `kunnaskra`-agentinn.
- Eitt sameiginlegt innhólf (Drög-stöð) þjónar báðum; `felag`-reiturinn á punktinum segir hvor.

---

## 3 · Reikningsflæði Slökkvitækis (það sem Agnar er aðallega að klára)

```
POS (js/pos.js) → solur: status 'drog' (greitt síðar) eða 'final'
  → drög lyftast í final við „✅ Klára sölu" / „Sótt ✓" / kröfusendingu
  → kröfu-yfirlit appsins (#krofu-yfirlit) → payday-push.js → Payday reikningur + krafa (SENT)
  → banki. Úttektarskýrsla + reikningur (R-xxxxxx) vistast SJÁLFKRAFA sem PDF á fyrirtækið.
```
- Allt ferlið, gáttirnar og það sem hefur farið úrskeiðis (tvírukkun, rangt félag, skjal
  barst ekki): **`slokkvitaeki/docs/RUKKUNARKEDJAN.md`** — lestu kafla 1 og 3 áður en þú
  sendir kröfu.
- „Reikningur" og „greitt síðar" eru **ekki** það sama: greitt_sidar → reikningur er
  einstefna, aldrei til baka (regla Agnars 20.05.2026).
- **Draft-karfa (05.09.2026):** Slökkvitækis-punktur í Drög-stöðinni á „🧺 Karfa" — krassblað með vörum
  úr vörulistanum, magni, verði, afslætti og samtölu (`reikningspunktar.karfa`, EKKI sala, EKKI drög í
  `solur`). Línurnar lesast sjálfkrafa úr texta punktsins („7 × 5 kg CO2-tæki", „10 klst × 12.500 kr").
  „Senda í körfu" opnar söluborðið með `?karfa=<id>` (patch 352) — reikningurinn verður til ÞAR, eftir
  reglum söluborðsins. Opnast úr skráningarstikunni (🧺 Karfa), á punktinum og í Valið („🧺 Ný karfa").
- **Krassblaðið:** textinn á hverjum punkti er ritanlegur á staðnum (vistast sjálfkrafa), krass-reitur á
  kúnnann (→ `fyrirtaeki.athugasemdir`) og verkið (→ `invoice_drafts.notes`) í Valið, „+ punktur" á spjöldunum.
- Úttekt sem á eftir að klára = fyrirtæki í þjónustu, á vinnublaði, án úttektarsölu ársins.
  Listinn sem gilti 04.09.2026 er kominn í Drög-stöðina sem punktar.

## 4 · Reikningsflæði Brunahólfs

```
Tímavera (klst per verkstað) → Gerð Reikninga / Efnislisti → invoice_drafts (verkstaður|mánuður)
  → Kröfu yfirlit þrep 2 „Ósendar" → „Senda í bókun" (skjöl á bokhald@brunaholf.is)
  → bókarinn gerir Payday-reikning → payday-pull → þrep 1 „Ógreiddar".
```
- Tvö verðlíkön sem má **aldrei** rugla: Tímavera-verkstaðir (klst × taxti + efni) og
  **gata-verkefnin þrjú** (Landspítalinn/NLSH, Heklureitur, Dalvegur 30 — fjöldi gata úr Ajour).
  Allt í `bokari.md`. Taxtar eru **per verkstað** (`pricing_guide`) — fletta upp, ekki muna.
- **Fast verð** (`fixed_total` í Efnislistanum) ræður upphæðinni þegar það er sett —
  Landspítala-uppgjörið er dæmið; þá á klst-áætlunin ekki við.
- Greiðandi ≠ verkstaður: `customer_worksite_map` → `pricing_guide` leysa verkstað í greiðanda.

---

## 5 · Afslættir — hvar þeir búa (ekki muna, fletta upp)

**Slökkvitæki — þrír afsláttarhættir, forgangur sannreyndur 2026-08-18**
(`slokkvitaeki/docs/AFSLATTA-YFIRFERD.md`):
1. Tilboðsverð per vöru (`app_settings.company_pricing`) — endanlegt verð, hæstur forgangur
2. Afsláttarhópur (`discount_tiers`, t.d. Center Hotels) — fast hópsverð > hóps-% > fastur
3. Fastur afsláttur (`fyrirtaeki.afslattur_pct`) — nær aðeins á línur án sérverðs/hóps

Vélin: `slokkvitaeki/js/discount-engine.js`. **Konvensjónin sem klúðrar mest:**
`solur.afslattur` er geymdur **MEÐ vsk** en línur og haus **ÁN vsk** (`docs/STADREYNDIR.md`,
„afsláttar-konvensjónin" í `bokari.md`). Reiknaðu aldrei afslátt út frá minni.

**Brunahólf:** afsláttur er handvirk leiðrétting á Efnislistanum (`invoice_drafts.discount_pct`),
vistuð á drögunum svo endurprentun stemmi á öllum tækjum. Sértaxtar (t.d. Fjallaböðin
9.300/13.950) í `pricing_guide`.

---

## 6 · Pósturinn — hvað „ertu með nýjustu póstana?" þýðir

- Allur póstur er sóttur í **`email_digest`** af `gmail-ingest-background` **á tveggja klst
  fresti** (`netlify.toml`), auk luna-bridge fyrir @brunaholf.is. Ekkert AI þar.
- Reikningarnir sem eru sóttir (staða 04.09.2026): `eldklar@eldklar.is`, `Brunaholf@brunaholf.is`,
  `bokhald@brunaholf.is` (fersk) · `brunaholfehf@gmail.com`, `bokhald@eldklar.is` (að eldast) ·
  **`aggi@brunaholf.is` — ekki tengt.**
- „Nýjustu póstar" = `newest` per reikningi í `GET /api/data-sources-status` → `email_accounts`.
  Sé `age_days` > 0 á reikningi sem skiptir máli, segðu það og lestu póstinn beint (Chrome/Outlook)
  í stað þess að treysta samantektinni. brunaholf-pósturinn býr í **Outlook**, ekki Gmail.
- Tengingastrimillinn efst í Drög-stöðinni sýnir þetta sama — rautt = ótengt/gamalt.
- **Póstvörður Eldklárs** („✉ Sækja úr pósti" í Drög-stöðinni = `POST /api/postur-punktar {action:'skra'}`,
  agent `eldklar-postur`): les AÐEINS eldklar@eldklar.is, síðustu 14 daga, INBOX; lykilorð + kt-mátun
  við `fyrirtaeki`, ekkert AI; sami póstur verður aldrei tvisvar að punkti (`client_id = mail:<message_id>`).

---

## 7 · Reglur sem lotan má aldrei brjóta

1. **ALLTAF LEYFA VISTUN** — engin vörn má stoppa „Vista"; kröfur um réttleika eru yfirferðar-megin.
2. **Gervigreindin leggur til, skrifar aldrei** — aðeins „✓ Setja á drögin" (Agnar) skrifar í drögin.
3. **Giskaðu aldrei á tölu sem endar á reikningi** — fletta upp í `pricing_guide`, `solur`, samningum.
4. **Einn sannleikur** — staðreyndir í `docs/STADREYNDIR.md`, kúnnar hjá `kunnaskra`; ekki afrita hingað.
5. **Skráðu í Drög-stöðina, ekki á miða** — það sem Agnar segir í lotunni fer í innhólfið.

---

## 8 · Fljótleiðir

| Þarf | Slóð / skipun |
|---|---|
| Drög-stöð | `brunaholf.netlify.app/#drogstod` · úr Slökkvitæki-appinu: `brunaholf.netlify.app/?embed=1#drogstod` |
| Gátlisti + kúnnar með punkta | `GET /api/reikningspunktar?op=stada` |
| Tengingar | `GET /api/data-sources-status` |
| Kröfu yfirlit Brunahólfs | `brunaholf.netlify.app/#krofuyfirlit` |
| Kröfu-yfirlit Slökkvitækis | `slokkvitaeki.netlify.app/#krofu-yfirlit` |
| Óklárað hjá Slökkvitækjum (04.09.2026) | Artifact „Óklárað hjá Slökkvitækjum" — innihaldið er komið í Drög-stöðina |
| Hvað gerðist síðast | `slokkvitaeki/docs/MINNISBOK.md` (efst = nýjast) |
