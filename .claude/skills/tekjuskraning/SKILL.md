---
name: tekjuskraning
description: >
  Hvenær tekjur Slökkvitækis og Brunahólfs teljast (unnið · reikningsfært · greitt): reglur Agnars frá 21.11.2026,
  lagaramminn (bókhaldslög 145/1994, VSK-afhendingarregla rg. 50/1993, ársreikningalög 3/2006, IFRS 15, tekjuskattur),
  hvernig á að sannreyna tölu sem sögð er „tekjur" og hvernig síðbúin skýrsla er meðhöndluð. Notaðu þegar spurt er
  „hvenær telst salan", „tekjuskráning", „unnið vs reikningsfært", „geymslufé", „ógefið út", „lýsing á tekjuskráningu",
  „tímamark tekna", eða þegar tvær tekjutölur stemma ekki (Tekjur-síðan á móti Rekstrarskýrslu).
---

# Tekjuskráning — hvenær tekjur teljast

**Endurskoðandinn** sannreynar og skilar lista, hann leiðréttir aldrei. Þetta er stjórnendayfirlit, **ekki lögbundið
bókhald** (það er hjá bókara) og **ekki VSK-skil**. Engar upphæðir eða kúnnagögn í þessa skrá — repóið er opinbert.

## Fjögur lög sem má ekki blanda
| Lag | Reglan (staðfest = lesin í opinberum texta) |
|---|---|
| **VSK** | Afhendingarregla: sölureikningur við afhendingu, velta til tímabils afhendingar, innborgun þegar hún berst, mánaðarreikningur fyrir þjónustu heimill (rg. 50/1993 3., 18. gr.; Skatturinn „skráning tekna"). Staðfest. Lög 50/1988 sjálf: ólesin (403). |
| **Bókhald 145/1994** | 9. gr.: viðskipti skráð jafnskjótt og þau fara fram í samræmi við góða bókhaldsvenju. 6. gr. og 4. gr.: bókhald í samræmi við bókhaldsvenju og **settar reikningsskilareglur**. Lögin ákveða EKKI augnablik tekjufærslu. Staðfest (Lagasafn 1.10.2026, útg. 158a). |
| **Reikningsskil** | Tekjur reikningsársins færðar án tillits til greiðslu; óreikningsfært er eign (lög 3/2006 — **greinanúmer óstaðfest**); IFRS 15: tekja þegar frammistöðuskylda er uppfyllt, óreikningsfært = samningseign, haldið fé (geymslufé) lækkar ekki tekju. Íslenskur staðall um verksamninga: ekki fundinn. |
| **Tekjuskattur** | Meginregla: tekjur teljast þegar krafa myndast, ekki við greiðslu. Meðferð ófaktureraðs verks hjá lögaðila: **óstaðfest — spyrja bókara**. |

## Kröfur 145/1994 á kerfi sem telur eftir „unnu verki"
- **7. gr.** — skrifleg lýsing á tekjuskráningu og sjálfvirkri úrvinnslu skal liggja fyrir (hver atburður er tekja í hverjum flokki).
- **17. gr.** — tekjuskráning byggist á skýru og öruggu kerfi sem sannar að allar tekjur komi fram. Hver unnin eining endar á númeruðum reikningi eða er merkt „ógefið út". Ekkert hverfur.
- **8. og 19. gr.** — færsla byggð á frumgagni (skoðunarskýrsla, afhendingarnóta, tímaskýrsla) sem rekja má báðar leiðir.
- **21. gr.** — engu eytt eða breytt. Leiðrétting = ný færsla + fylgiskjal sem nefnir færsluna og ástæðu.
- **24. gr.** — allar tekjur reikningsársins á rekstrarreikning. **37. gr. 3. tl. og 38. gr. 2. tl.** — kerfisbundin vantalning og ótrygg tekjuskráning eru brot.
- 14. gr. gildir ekki um ehf. (aðeins þá sem eru undanþegnir tvíhliða bókhaldi, 3. gr.).

## Reglur Agnars 21.11.2026 (stjórnendayfirlit)
- **Slökkvitæki, úttekt:** telst í MÁNUÐI úttektarinnar skv. skýrslunni, þótt hún sé ógreidd. Sé skýrslan gerð í mánuðinum á eftir: dagstekjur á SÍÐASTA DAG úttektarmánaðarins; „skýrslur sendar" telja eftir raunverulegum kláradegi í kerfinu.
- **Slökkvitæki, hleðsla af verkstæði:** þegar tækið er merkt done og sent í afgreiðslu (ekki við innlögn).
- **Brunahólf:** eftir tímaskýrslu (Tímavera: stimplaðar vaktir × dagvinnutaxti verkstaðar, sjálfgefinn taxti ef verkstaður vantar — merkt „án taxta") og göt eftir Done-dagsetningu í Ajour.
- **Ajour = Done-dagsetning:** þar sem `execution_date` er til (flest verk) er hún Done-dagurinn; á Landspítalaverkinu er hún nær alltaf tóm og `checked_date` er eina dagsetningin á Done-röðunum. Aðeins röðin með `registration_status = 'Done'` telur; afritið „NLSH … gatakort" er sleppt.
- Eitt gólfgat af stærð Ø160–200 er ein heild í uppgjöri.
- **Framsetning:** ein fyrirsögn „Unnið", undir henni „reikningsfært / ógefið út" og „Greitt". Markmið (2× tekjur) mælt á Unnið. Útgefið heitir aldrei „tekjur" eitt og sér.
- Geymslufé (5 % hjá einum verkkaupa) er tekja, ekki afsláttur: sýnt sem „haldið eftir". Yfirvinna sem ekki er reiknuð og ólokin verk eru **áætlun** og merkt þannig. Drög og bakfærðar sölur teljast aldrei.

## Svona sannreynirðu tölu sem sögð er „tekjur"
1. Hvaða tímamark: unnið, reikningsfært eða greitt? Ef það stendur ekki skýrt → ósvarað.
2. Frumgagn: skýrsla / afhendingarnóta / tímaskýrsla / reikningur — finnst það og ber það réttan dag?
3. Tvítalning: er sama verk bæði sem sala (innlögn) og sem unnið (done)? Verkstæðislína (V-lína) á að teljast einu sinni.
4. Dagsetning úr rétta dálki (Ajour: Done-dagur; Tímavera: dagur vaktar; úttekt: skoðunarmánuður — ár hafa verið rangt lesin áður).
5. Gögn komin? Ajour og Tímavera berast í lotum — nýjustu dagar eru „ófullt". Nefndu hvaða dag gögnin ná til.
6. Stimplunarvillur (vakt með óeðlilega marga tíma) og ósamræmd verkstaðarnöfn (rangur taxti).
7. Er talan merkt „stjórnunartala, ekki bókhald né VSK"? Annars bæta því við.

## Síðbúin skýrsla (21. gr.)
Fyrri færslu er ekki breytt. Opið tímabil: skrá strax með réttri dagsetningu (9. gr.). Lokað tímabil: ný færsla með fylgiskjali; í stjórnendayfirliti sérstök lína „bókað síðar" með dagsetningu í stað þess að skrifa þegjandi yfir birta tölu. Hvort leiðrétting á lokuðu tímabili fer á tímabil atburðar eða leiðréttingar: **óstaðfest — spyrja bókara**.

## Óstaðfest (ekki fullyrða)
Lög 50/1988 (ólesin), greinanúmer í lögum 3/2006 um tekjur án tillits til greiðslu, íslenskur staðall um verksamninga, skattameðferð ófaktureraðs verks hjá lögaðila, hvort hálfunnið tæki á verkstæði ætti strangt tekið að hlutfallsfærast (afhending er ásættanleg einföldun fyrir stutt verk — staðfesta við bókara).

## Heimildir (opinberar, lesnar 21.11.2026)
- Lög um bókhald 145/1994 — althingi.is/lagas/nuna/1994145.html (sjálfvirkur lesari fær 403; les í vafra eða úr vistaðri skrá)
- Reglugerð 50/1993 — reglugerd.is/reglugerdir/allar/nr/050-1993 (breytt með 136/1997)
- Skatturinn: tekjuskráning; bókhald og tekjuskráning; VSK — skráning tekna (skatturinn.is/atvinnurekstur/…)
- IFRS 15 dæmi 27, 38, 39 — ifrs.org
- Handbók reikningsskilanefndar (lög og reglur, PDF á stjornarradid.is): PDF-ið er LZW-þjappað og WebFetch les það ekki; textaútdráttur þarf pdftotext/pypdf.

## ALDREI
Segja stjórnendatölu vera bókhald eða VSK-grunn · leiðrétta eða eyða færslu · telja drög eða void · blanda Slökkvitæki og Brunahólfi í eina röð án þess að merkja það · setja upphæðir eða kúnnaheiti í þessa skrá.
