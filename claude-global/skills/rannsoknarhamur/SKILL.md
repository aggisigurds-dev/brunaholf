---
name: rannsoknarhamur
description: >
  Rannsóknarhamur — leita að verðmætum og földum málum sem enginn hefur spurt um, með sex lotum
  samtímis (eitt svið hver, lesaðeins), sönnunarleit og fáum málum á borðið. Ekki staðfesting
  („er þetta satt?") heldur „hvað er hér sem enginn hefur spurt um?". Notaðu þegar Agnar segir
  „rannsóknarhamur", „hvað liggur úti", „órukkað", „finna verðmæti", „ósvarað", „hvað höfum við
  misst af", „fara yfir allt", „hvað er ósent", „kredit án endurgerðar", „gleymdar skoðanir",
  eða þegar á að sópa gagnagrunninn eftir peningum og gleymdum málum. Aðferðin skilaði um
  1,5 m.kr. og hreinsaði 869 mál í 1 (07.11.2026). Staðfesting á einni tölu er `fact-check`,
  ekki þetta skill.
---

# Rannsóknarhamur

Skrifað 07.11.2026 eftir lotu sem skilaði um **1,5 m.kr.** og skar **869 mál niður í 1**.
Aðferðin er hér svo hún sé endurtekin en ekki fundin upp aftur.

## 1. Munurinn

| Staðfesting | Rannsókn |
|---|---|
| „Er þetta satt?" | **„Hvað er hér sem enginn hefur spurt um?"** |
| Ein tala, eitt mál | Heilt svið, allar raðir |
| Skill `fact-check`, agent `natalie` | Þetta skill |

Rannsókn byrjar ekki á grun heldur á svæði. Hún finnur það sem enginn hafði grun um.

## 2. Ein lota, eitt svið

Sex lotur (Agent, `general-purpose`) fara **samtímis** í einum skilaboðum, hver með afmarkað svið.
Lota með tvö svið skilar hálfu af báðum.

| # | Svið | Spurningin | Byrja á sýn |
|---|---|---|---|
| 1 | Órukkað verk | Hvað var unnið en aldrei reikningsfært? | `v_verk_an_reiknings`, `v_krafa_ekki_send` |
| 2 | Kredit án endurgerðar | Hvaða reikningur var bakfærður og aldrei gerður aftur? | `v_kredit_an_endurgerdar` |
| 3 | Kúnnar sem bíða svars | Hver spurði og fékk ekkert svar? | `v_erindi_osvarad`, `v_skeytamidlun_vantar` |
| 4 | Mótsagnir í gögnum | Hvar stangast skýrsla, reikningur og tækjaskrá á? | `v_taekjatolur_misraemi` |
| 5 | Gleymdar skoðanir | Hvaða staður fær enga skoðun þegar hennar var von? | `v_skodun_gleymd` |
| 6 | Lifandi mál á borðinu | Hvað á `thjonustubeidni` sem er dautt, tvítekið eða löngu leyst? | `thjonustubeidni` |

## 3. Lesaðeins er rétti hamurinn

**Rannsóknarlotur SKRIFA EKKERT.** Þær skila fundum. Fundur þarf mat áður en honum er breytt í
aðgerð; sex lotur sem skrifa samtímis í sömu töflu búa til mótsagnir. Skrif koma á eftir, frá
einum aðila, og þá gilda 95%-umboðið og afritareglan úr `samthykki-a-bord`.

## 4. Gildrulistinn er helmingur brífsins

Hver lota fær talin upp þær gildrur sem hafa bitið áður. Þannig útilokuðu loturnar sjálfar tugi
falskra funda. Skrifaðu þær **orðrétt inn í brífið**:

- Kreditfærður OG endurgerður reikningur er ekki ósendur: `credit_of` + Payday-staða (hvorki CANCELLED né CREDIT).
- Stólpi: reikningur getur legið á kennitölu án þess að vera skjal á staðnum. Leita líka á `customer_id`, `customer_base_id`, systkina-kt.
- **Yfirtökureikningar („opinn við yfirtöku") voru greiddir til FYRRI EIGANDA — aldrei okkar krafa.**
- Rekstrarfélög: einn reikningur nær oft yfir marga staði sömu kennitölu (sjá skill `rekstrarfelog-parun`).
- Gengið inn `999999-9999` er staðgreiðsla; einstaklingar staðgreiða, kröfur aðeins á félög.
- `uttaeki.status` hefur fjögur gildi sem merkja lifandi tæki: notaðu `<> 'urelt'`, aldrei `= 'active'`.
- Árstíðir: skoðun sem á að vera í desember er ekki í vanskilum í nóvember.
- `invoiced_at` er tómt á reikningum sem bíða kröfu: notaðu `greitt_med='reikningur'`.
- Fáni sem er aldrei settur (`reikningspunktar.applied`) segir ekkert.
- Húsfélag (sameign) er ekki fyrirtæki í húsinu; heimilisfang er ekki tvítak.

## 5. „ÓMÆLT" er skylda

Hver lota skrifar **ÓMÆLT** frekar en að þegja um það sem hún náði ekki. Þögn lítur út eins og
staðfesting. Tómt svar eða RLS sem þegir er ekki staðreynd (`docs/MAELINGAR.md`).

## 6. „Beið" þýðir „las og dugði ekki"

Ein lota skilaði 35 málum sem „látin bíða" en hafði ekki lesið gögnin. Óskoðað mál er ekki
niðurstaða. **Spyrðu alltaf hve mörg lotan MÆLDI, ekki hve mörg hún afgreiddi.** Krefstu talnanna
`mælt / fundið / útilokað / ÓMÆLT` í skilunum og leggðu þær saman.

## 7. Sönnunarleit er sérstök umferð

Eftir að fundirnir liggja fyrir fer **ein lota** (lesaðeins) í að finna sönnunina á bak við hverja
kröfu: skýrslu, tækjaskrá, póst, þjónustusögu, reikningspunkt. Hún borgar sig: hún fann að
**R-000716 Þangbakki (190.987 kr.) mátti alls ekki rukka, verkið var aldrei unnið.**

Regla: **tala úr talningu er ekki krafa fyrr en einhver hefur lesið söguna á bak við hana.**
Merktu hverja kröfu **sterk / miðlungs / engin sönnun**. Aðeins sterk fer áfram án spurningar.

## 8. Niðurstöður fara í FÁ mál

**Mest TVÖ mál á borðið per lotu (samþykkisþakið, 11.11.2026)** — þau tvö sem varða mesta peninga og krefjast
aðgerðar út fyrir kerfið; allt annað fer á Verkefnalistann eða í skjal lotunnar. Fundir lotunnar eru skrifaðir í
`docs/RANNSOKN-<dags>.md` jafnóðum svo þeir lifi af slitna lotu. Sjá skill `samthykki-a-bord`
(þröskuldurinn: það sem við getum mælt leiðréttum við sjálf, ekki ýta á hann).

## 9. Það sem endurtekur sig fer í gagnagrunninn

Mælingarnar eru nú sýnir sem endurreiknast:
`v_krafa_ekki_send` · `v_kredit_an_endurgerdar` · `v_verk_an_reiknings` · `v_skodun_gleymd` ·
`v_taekjatolur_misraemi` · `v_erindi_osvarad` · `v_skeytamidlun_vantar`.

Hver ber `comment on view` með sínum gildrum. Lestu hann **áður en þú treystir tölunni**:

```sql
select obj_description('v_krafa_ekki_send'::regclass);
```

**Byrjaðu á sýnunum; leitaðu handvirkt aðeins að því sem þær ná ekki.** Verðir í
`tools/audit-*.cjs` vakta þær með grunntölu dagsins svo aðeins NÝ tilvik verði rauð.
Ný regla sem lota lærir fer í `comment on view`, ekki aðeins í þetta skjal.

## Brífið sem virkaði (sýnidæmi)

Eitt brif per lota. Sama grind, annað svið:

```
SVIÐ: Kredit án endurgerðar (EITT svið; ekkert annað).
MARKMIÐ: Finna reikninga sem voru bakfærðir og aldrei gerðir aftur. Spurning: hvað hefur enginn spurt um?
HAMUR: LESAÐEINS. Skrifaðu ekkert í neina töflu. Skilaðu fundum.
BYRJA Á: select * from v_kredit_an_endurgerdar; lestu fyrst obj_description('v_kredit_an_endurgerdar'::regclass).
GILDRUR (hafa bitið áður):
 - credit_of + Payday-staða: endurgerður reikningur er ekki ósendur.
 - Stólpi: reikningur á kt án skjals; leita líka customer_base_id og systkina-kt.
 - Yfirtökureikningar voru greiddir til fyrri eiganda, aldrei okkar krafa.
 - Rekstrarfélag: einn reikningur nær mörgum stöðum.
 - 999999-9999 / einstaklingar = staðgreiðsla.
SKILABOÐ (nákvæmlega þetta snið):
 FUNDIÐ: <R-nr · félag · kr · ein lína um hvað vantar> × N
 ÚTILOKAÐ: <hvað og af hvaða gildru> × N
 ÓMÆLT: <það sem þú náðir ekki, og hvers vegna>
 TÖLUR: mælt X · fundið Y · útilokað Z · ÓMÆLT W  (X verður að vera raunverulega lesið)
 SÖNNUN hvers fundar: sterk / miðlungs / engin + hvar hún sést.
```

## Röðin

1. Lesa sýnin og `comment on view` (sjálfur, 5 mínútur).
2. Segja Agnari áður að sex undirlotur fari af stað (kostar marga tokens; kvóti á þrotum = stöðva strax). Senda þær
   svo í EINUM skilaboðum, brif eins og að ofan.
3. Leggja saman tölurnar; ganga á allt sem er „beið" án mælingar.
4. Ein sönnunarlota á fundina.
5. Meta: sterk sönnun fer áfram, engin sönnun fellur. Hvað sem endurtekur sig fer í sýn eða vörð.
6. Mest tvö mál á borðið, hitt á Verkefnalistann; skrif eftir 95%-umboðinu, með afriti og `review_note`.
