---
name: samthykki-a-bord
description: >
  Setja spurningar og ákvarðanir sem bíða Agnars á Þjónustuborðið hans sem samþykkismál — eitt
  mál per atriði, merkt `samthykki`, með ✓ Samþykkja / ✕ Hafna (og ▶ / 💬) svo hann geti svarað
  úr símanum. Gildir fyrir bæði félög (sama Supabase-tafla `thjonustubeidni`). Notaðu þegar
  Agnar segir „settu þetta á þjónustuborðið", „setja spurningarnar inn á samþykktir", „kíki á
  þetta á morgun", „settu á mig", eða þegar lota endar með opnum ákvörðunum sem hann þarf að taka.
  Úrvinnsla svaranna er agent `samthykktir` (Columbo), ekki þetta skill.
---

# Samþykkismál á Þjónustuborðið

Reglurnar koma úr minni `feedback-aminningar-a-bord` (lesa það ef eitthvað er óljóst).
Agnar skimar: spurning í spjalli eða safnspjaldi týnist; eitt mál per atriði þar sem hann vinnur
gerir það ekki.

## ⛔ Þröskuldurinn — flest á EKKI að fara á borðið (Agnar 07.11.2026)

„Til hvers að setja á þjónustuborð ef þú veist svarið" · „ef þú finnur svarið þá auðvitað
leiðréttiru. **Ég vil helst ekkert fá á þjónustuborðið mitt nema eitthvað sem er bráðnauðsynlegt að
þið getið ekki fundið svarið.**"

Áður en mál er stofnað: **get ég mælt svarið?** Teikningarnar, skráningartaflan, `v_stadur_flokkun`,
reikningurinn, skýrslan, Payday, PDF-ið. Finnist heimild — **leiðréttu strax** og segðu frá í einni
línu með því hvaðan talan kom. Ekkert mál.

Á borðið fara þá aðeins **raunverulegar ákvarðanir Agnars** (verð, afsláttur, hvort senda eigi,
hvort rukka eigi, hvort fara eigi á staðinn) og það sem **engin heimild svarar**. Mál sem hann þarf
bara að staðfesta það sem við vissum þegar er ekki ákvörðun — það er vinna sem var ýtt yfir á hann,
og hver slík lína gerir þau sem skipta máli ósýnilegri.

**95%-umboðið (Agnar 07.11.2026):** „ég mun aldrei nokkurn tímann getað farið yfir þetta — ef þú
getur svarað þessu með 95% vissu þá máttu taka sem mest fyrir mig." Umboðið nær til þess að
**svara, loka, hafna, leiðrétta og samþykkja í gögnunum**, með afriti (`backup_<dags>_<tafla>`)
fyrst og `review_note` í hverja snerta röð sem segir hvað var mælt og hvaðan. Utan umboðsins eru
óafturkræf og ytri skref: senda póst eða reikning, hreyfa peninga, afturkalla, eyða — þau þarf hann
að segja í spjallinu. Nái mæling ekki 95% stendur málið og er sagt ÓMÆLT.

Dæmi 07.11.2026: Máni Apartments var skráð með 56 hæðir. Teikningarnar sýna Kjallari + 1.–6. hæð og
reiturinn heitir „Hæðir ofan jarðar" → svarið er 6, mælt. Skrifað beint, ekkert mál stofnað.
Án heimildar er niðurstaðan **ÓMÆLT**, ekki ágiskun skrifuð í gögnin.

## Áður en þú skrifar
1. **Mæltu forsenduna aftur** — talan, reikningurinn, staðan. Gamlar ákvarðanir (Verkefnalisti,
   eldri lotur) eru endurmældar áður en þær fara á borðið (minni `feedback-samthykki-factcheck`:
   9 af 93 voru röng).
2. **Er málið þegar á borðinu?** `select id,title,status from thjonustubeidni where deleted_at is null
   and status <> 'lokad' and title ilike '%<lykilorð>%'` — uppfæra frekar en tvítaka.
3. Eitt mál = ein ákvörðun. Tvær spurningar um sama verk = tvö mál.
   **ÞAK (slokkvitaeki/CLAUDE.md, 11.11.2026): lotan stofnar mest TVÖ mál á Agnar**, og aðeins um aðgerð sem fer út
   fyrir kerfið eða er óafturkræf (krafa, reikningur, kredit, póstur til kúnna, þjónustustaða, eyðing), með mælingu
   sama dag í málinu. Fyrst leitað að opnu máli um sama efni (nafn, kt, R-númer) og línu bætt við það. Kerfisspurningar,
   afturkræfar leiðréttingar og verk fyrir starfsmenn fara á Verkefnalistann, ekki borðið.

## Insert-sniðið (Supabase `osfdzskyvisifcwyjkuk`)

```sql
insert into thjonustubeidni (title, notes, source, type, status, priority, assigned_to, created_by, tags, customer_nafn, fyrirtaeki_id, created_at)
select t, n, 'claude', 'annad', 'nytt', 'venjulegur', 'Agnar', 'claude', tg::jsonb, c, f, now() from (values
($t$<Verkstaður/kúnni>: <ákvörðunin sem spurning>?$t$,
$n$✓ Samþykkja: <nákvæmlega hvað ég geri, með tölu>.
✕ Hafna: <hvað gerist þá — oft „óbreytt">.

Tillaga: <ein setning, með ástæðu>.

Byggt á:
• <sönnun 1 á mannamáli + hvar hann sér hana (reikningur R-…, Payday, skýrsla, Tímavera)>
• <sönnun 2>$n$, '["samthykki","spurning","bh:<stutt-slug>"]', '<nafn greiðanda eða null>', null)
) v(t, n, tg, c, f)
returning id, title;
```

- **`assigned_to 'Agnar'` er SKYLDA** — án þess lendir málið laust og takkarnir birtast ekki.
- `tags`: `samthykki` (takkarnir) + `spurning` + slug með forskeyti félagsins (`bh:` Brunahólf,
  `sl:` Slökkvitæki) svo úrvinnslan finni málið. Notaðu `$t$…$t$`/`$n$…$n$` — íslenskar
  gæsalappir og úrfellingarmerki brjóta venjulegar SQL-tilvitnanir.
- `fyrirtaeki_id` þegar eitt fyrirtæki á í hlut (Slökkvitækis-mál) — þá fylgir nafn staðarins.
- **Titill = aðgerðin**, ekki „leiðrétting/kredit/bakfærsla" nema málið sé það — þau orð draga
  málið í „Bakfærslur og breytingar"-haminn.
- **Fyrsta lína notes** er það eina sem listinn sýnir → „✓ Samþykkja: …" (eða „▶ Í vinnslu: …").
  „💬 Skýring: …" þegar svarið er frjáls texti (t.d. „hvaða verk?").
- **Undir ~1.000 stöfum, engin innri hugtök** (töfluheiti, v_-sýnir, audit_vernd, par-númer,
  commit-hash). Tæknileg smáatriði fara í stutta „— Unnið"-línu síðar.
- **Skjáskot af sönnuninni** fylgir þegar hún er sjónræn (`thjonustubeidni_files`, bucket
  `verkbord-files/<id>/<ms>-<nafn>`, service-lykill í luna-bridge/.env).

## Á eftir
- Lestu málin til baka (`returning`) og segðu Agnari í EINNI línu: „N mál á borðinu (#a–#b)".
- Skráðu númerin í minni verksins svo næsta lota finni þau (t.d. `project-nlsh-skyrsla`).
- **Svörin vinnur agent `samthykktir`.** Óafturkræf eða ytri skref (Payday, sending, afturköllun)
  aðeins þegar Agnar hefur LÍKA sagt það í spjallinu — svar á borðinu eitt og sér er ekki nóg.

Sýnidæmi: #1130–#1144 (07.10.2026, NLSH + gömul drög + Payday-pörun), #871–#886 (11.09.2026).

## Rekjanlegar heimildir (Agnar 01.11.2026: „finnst vanta oft meiri sannanir, vísanir í facts")
Borðið og síminn sýna blokkina Heimildir, sem les staðreyndir beint úr grunninum eftir því sem málið nefnir. Skrifaðu því:
- R-númer orðrétt með sex tölum (`R-000123`), og `Payday 276` eða `Stólpa 108096` þegar það á við.
- `fyrirtaeki_id` í hvert mál sem snertir stað.
- „mælt dd.mm.áááá“ í „Byggt á“.

Annars fær málið rautt merki: „Engin heimild tengd“ eða „Mælidagur ekki skráður“.

## Fjórar mælingar sem hvert mál þarf að standast (lærdómur 08.–09.10.2026, 128 mál endurmæld)

Af 93 opnum samþykkismálum voru 9 röng og 18 úrelt — nær öll af þessum ástæðum:

1. **Kreditfærslur.** „Ósent" / „enginn reikningur" er ekki fullyrt fyrr en `select num from solur
   where credit_of = <id>` er tómt og Payday-staðan er hvorki CANCELLED né CREDIT. Bakfærður
   reikningur sem var endurgerður (Eclipse R-000727 → R-000728 → R-000940) er ekki ósendur.
2. **Stólpi.** Reikningur getur legið í `stolpi_reikningar` á kennitölu án þess að vera skjal á
   staðnum (21 félög). Leita líka á `solur.customer_id`, `customer_base_id` og systkina-kt.
3. **Dagsetning mælingar.** „Byggt á (mælt dd.mm.áááá kl. HH:MM)" — og mæla sama dag og málið
   er birt, ekki vikum fyrr. Greitt/sent/sótt eftir stofnun gerir málið úrelt.
4. **Tvítök.** `select id,title from thjonustubeidni where status<>'lokad' and (title ilike '%<nafn>%'
   or notes ilike '%R-00xxxx%')` áður en nýtt er stofnað. Sama félag í tveimur málum = eitt mál.

**Skjáskot með hverju máli** (Agnar 08.10.2026): myndin af síðunni/tölunni sem málið byggir á fer í
`thjonustubeidni_files` (bucket `verkbord-files/<id>/<ms>-<nafn>`, dálkar beidni_id,name,path,url,
mime_type,size). Samþykkja-símasíðan sýnir hana á spjaldinu. Skrifta: service-lykill úr
`C:\Users\Slokkvitaeki\luna-bridge\.env`, POST á `/rest/v1/thjonustubeidni` með `Prefer: return=representation`
→ id → upload í `/storage/v1/object/verkbord-files/<id>/<ms>-<nafn>` → röð í `thjonustubeidni_files`.

**Leiðrétting er lína, ekki þögul breyting:** rangt mál fær „— Leiðrétt <dags> (Claude): …" aftast,
`samthykki` tekið af og `leidrett`/`urelt`/`tvitekid` sett í staðinn; endurskrifað mál heldur
`samthykki` með nýjum titli og nýjum ✓/▶/✕-línum efst í viðbótinni.

## „ÞETTA GERIST" efst og síur (lærdómur 09.10.2026, skráð 16.10)
Agnar: „er svo lengi að fara í gegnum þetta sérstaklega þegar buið er að endurmeta og blablaa, ég gefst upp á því oft". Því setur 368 `adgerdirUrNotu` **„ÞETTA GERIST"** efst í hverju máli: ✓/▶/✕/💬 — hvað hver takki gerir, í einni línu hver; sagan (Fyrri tillaga/Endurmetið/Uppfært/———) er skorin af. Sönnun er merkt **mælt · ágiskun · upplýsing · „ENGIN SJÁLFVIRK MÆLING"** — þögn má aldrei líta út sem staðfesting. Skrifaðu notes þannig frá byrjun: aðgerðalínurnar fyrst, sönnunin með merki, sagan neðst. „Svara pósti" á 446 er SÍA (source=email, assigned_to=Agnar, ósvarað), ekki röðun.
