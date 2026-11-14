# Ný brunaholf.is (tillaga)

Kyrrstæður vefur án smíðaskrefs: skrárnar í þessari möppu eru vefurinn eins og hann er borinn fram.

| Síða | Útgáfa |
|---|---|
| `index.html` | V2, aðalsíðan. Hönnunarkerfið Brunahólf V2: ljósblár grunnur, hvít spjöld með mjúkum skugga, letrið Poppins. |
| `v1.html` | V1, geymd til hliðar. Hönnunarkerfið Brunahólf: dökkblár haus með flipum, pillulaga hnappar. |
| `v3.html` | V3, geymd til hliðar. Útlit núverandi brunaholf.is: dökkblár haus, hvítur grunnur, appelsínugul áhersla, letrið Questrial í fyrirsögnum og Inter í texta. |

Efni og virkni eru þau sömu í öllum þremur: forsíða, Brunaþéttingar, vefverslun (42 vörur, vörusíður, karfa) og Hafa samband á hverri sýn.

## Skipta um aðalútgáfu

Aðalsíðan er sú sem heitir `index.html`. Til að gera aðra útgáfu að aðalsíðu: endurnefna `index.html` í `v2.html` og síðu hinnar útgáfunnar (`v1.html` eða `v3.html`) í `index.html`. Allar slóðir í síðunum eru afstæðar við þessa möppu. Eitt þarf að fylgja: listinn `window.BH_UTGAFUR` neðst í síðunum þremur (heiti og skrá hverrar útgáfu), sem bannerasafnið notar til að skipta á milli þeirra.

## Breytingar úr tillögunum í Claude

Vefurinn er smíðaður úr þremur Claude-artifactum, tillögunum V2, V1 og V3, sem bera sömu skrár og hér. Fínpússun fer fram þar og er svo færð hingað. Hlekkirnir á tillögurnar eru í minninu undir efninu `vefsida`.

- Skrár aðalsíðunnar fara óbreyttar á sinn stað: `site/sida.css`, `ds/`, `verslun/gogn.js` og `verslun/verslun.css`.
- Skrár hinna útgáfnanna fara undir `v1-skrar/` og `v3-skrar/`. Þar verður `url(../img/…)` í stílblaði að `url(../../img/…)`, því skráin liggur einni möppu dýpra.
- `index.html` tillögunnar er aðeins innihald síðunnar. Hér stendur það í heilu HTML-skjali: það sem er ofan við fyrsta stak síðunnar í tillögunni (`<div class="bh2 …">` í V2, `<div class="bh …">` í V1, `<svg width="0" …>` í V3) fer inn í `<head>`, á eftir línunum sem þar standa fyrir, að frátöldum `<title>`, athugasemdinni og `claude:viewport-fit-sides`. Í `v1.html` og `v3.html` fá eigin skrár útgáfunnar forskeytið `v1-skrar/` eða `v3-skrar/`.
- `site/router.js` og `verslun/verslun.js` eru sameiginleg öllum síðunum, og `verslun/verslun.css` er sameiginleg V2 og V1. Breytist þau í einni tillögunni þurfa hinar að fylgja.
- Línan `<script>window.BH_UTGAFUR=…</script>` neðst í hverri síðu er aðeins hér, ekki í tillögunum, því hver tillaga stendur ein.
- Sama gildir um `data-api` og `data-myndir` á `<script src="site/efni.js">` í `<head>`: þau eru aðeins hér. Án `data-api` sækir síðan ekkert og ritillinn er ekki í boði, og þannig eru tillögurnar.
- Eigindirnar `data-e`, `data-m`, `data-mr` og `data-mf` í síðunum eru lyklar ritilsins (sjá Ritillinn). Þær verða að haldast óbreyttar þegar breyting er færð úr tillögu.
- Myndir bannerasafnsins (`img/banner/`, `img/hetja-v3.webp`, `img/verslun-hetja.webp`) eru sameiginlegar; nýr banner í einni tillögunni þarf að fara í hinar.
- Eftir færslu eru allar síðurnar keyrðar í vafra eins og lýst er undir „Prófað“.

## Skrár

| Skrá | Hvað er í henni |
|---|---|
| `index.html`, `v1.html`, `v3.html` | Texti og uppbygging. Neðst í hverri eru stillingar leiðarskriftunnar (`window.BH_SITE`). |
| `site/sida.css`, `ds/` | Útlit V2 og hönnunarkerfi þess. |
| `v1-skrar/` | Það sem V1 á ein: hönnunarkerfið (`ds/`), stílblaðið (`site/sida.css`) og vörugögnin (`verslun/gogn.js`). |
| `v3-skrar/` | Það sem V3 á ein: stílblaðið (`site/sida.css`), stílblað verslunarinnar (`verslun/verslun.css`) og vörugögnin (`verslun/gogn.js`). |
| `site/efni.js` | Efnislagið: bannerasafnið (`BANNERAR`), breytingar úr ritlinum settar á síðuna, og hleðsla ritilsins (`?ritill`). Hleðst í `<head>`. Sameiginleg öllum síðunum. |
| `site/ritill.js`, `site/ritill.css` | Ritillinn sjálfur. Hlaðast aðeins þegar slóðin ber `?ritill`. Eru ekki í tillögunum í Claude. |
| `site/router.js` | Sýnirnar þrjár og slóðirnar, og í seinni hlutanum skriftan sem setur bannerinn í forsíðuhausinn og stýrir myndskeiðinu. Sameiginleg öllum síðunum. |
| `verslun/verslun.js` | Verslunin sjálf, tekin úr `vefverslun/` í kóðasafni Slökkvitækja-appsins og aðlöguð á sjö stöðum sem taldir eru upp efst í skránni. Sameiginleg öllum síðunum. |
| `verslun/verslun.css` | Útlit verslunarinnar í V2 og V1. |
| `verslun/gogn.js` | Vörur, verð, birgðir og stillingar verslunarinnar fyrir V2, þar á meðal litir hennar í `efni.thema`. |
| `img/`, `vv/v/`, `myndir/` | Merkið, myndskeiðið í forsíðuhausnum og myndir bannerasafnsins (þrjár þeirra í `img/banner/`), vörumyndir (heitið er númer vörunnar) og myndir á vörusíðum. Sameiginlegar. |

## Slóðir

Hver síða er ein skrá með þremur sýnum sem skipt er á milli með #-slóðum.

| Slóð | Sýn |
|---|---|
| `#verslun` | Verslunin, vörulistinn |
| `#vara-<id>` | Vörusíða, t.d. `#vara-12` |
| `#karfa` | Karfan |
| `#brunathettingar` | Brunaþéttingar |
| `#hafa-samband` | Kaflinn Hafa samband á þeirri sýn sem er opin |
| allt annað | Forsíðan |

Leiðarskriftan reiðir sig á þessi stök í síðunum: `#heim`, `#brunasyn`, `#verslunarsyn`, `#vv-app`, `#kynning`, `#allar`, `#allar-n`, `.w-cart`, `#w-cart-n`, `#hafa-samband`, og valmyndarhlekkina með `data-spy`.

Sé síða opnuð beint á kafla, t.d. `v3.html#hafa-samband`, skrunar leiðarskriftan aftur að honum á meðan síðan hleðst og lengist, þar til sá sem skoðar hreyfir síðuna sjálfur.

## Myndskeiðið í forsíðuhausnum

Forsíðuhausinn í öllum útgáfunum sýnir myndskeiðið sem er í forsíðuhaus núverandi brunaholf.is, í fullri upplausn (1920×1080, 26 sekúndur, án hljóðs) og í tveimur sniðum. Undir því liggur kyrrmynd af fyrsta ramma þess, `img/hetja-eldur.webp`.

| Skrá | Snið | Stærð | Hver fær hana |
|---|---|---|---|
| `img/hetja-eldur-hevc.mp4` | HEVC | 12,0 MB | Vafrar sem spila HEVC: Safari, og Chrome og Edge á tækjum sem afkóða það í vélbúnaði. |
| `img/hetja-eldur.mp4` | H.264 | 14,7 MB | Allir aðrir. |

Vafrinn tekur fyrri `<source>`-línuna sem hann getur spilað.

- Skrárnar eru unnar upp úr frumskránni (29,5 MB, HEVC í .mov, sem spilast ekki í öllum vöfrum). Þær eru speglaðar, svo loginn er hægra megin og textinn vinstra megin, og upphaf og endir eru felld saman svo lykkjan hökti ekki.
- Kyrrmyndin sést þar til myndskeiðið spilar. Það er sótt eftir að síðan er hlaðin og aðeins þegar forsíðan er opin.
- Það fer ekki sjálft í gang þar sem hreyfing er afþökkuð í tækinu (`prefers-reduced-motion`), gagnasparnaður er á eða tengingin er hæg, og það stöðvast á meðan hausinn sést ekki.
- Takkinn í hausnum stöðvar það og ræsir. Án skriftu stendur kyrrmyndin ein.
- Skipta um myndskeið: setja báðar skrárnar undir sömu heitum og kyrrmyndina sem fyrsta ramma þess. HEVC-skráin þarf merkið `hvc1`; sé hún ekki til má taka fyrri `<source>`-línuna út, því H.264-skráin spilast alls staðar. Slikjan yfir myndskeiðinu er stillt eftir þessu myndskeiði, svo litamun textans þarf að mæla aftur. Hún er blá í V2 (`.w-hero--video::after` í `site/sida.css`) og V1 (`.c-hero::after` í `v1-skrar/site/sida.css`) og svört í V3 (`.hero--video::after` í `v3-skrar/site/sida.css`).
- Taka það út: festa annan banner í hausnum (sjá Bannerasafnið hér fyrir neðan). Myndskeiðið er þá ekki sótt.

Myndskeiðið er aðkeypt lagerefni af núverandi vef. Leyfið fyrir því þarf að gilda áfram á nýja vefnum.

## Bannerasafnið

Forsíðuhausinn sýnir einn banner úr safni sem er sameiginlegt öllum útgáfunum: listinn `BANNERAR` efst í `site/efni.js`.

| Heiti | `id` | Mynd |
|---|---|---|
| Eldur, myndskeið | `eldur` | Myndskeiðið, yfir kyrrmyndinni `img/hetja-eldur.webp`. Er á öllum síðunum núna. |
| Eldur, kyrrmynd | `eldur-kyrr` | `img/hetja-eldur.webp` |
| Húsið | `hus` | `img/hetja-v3.webp`, forsíðumynd fyrstu tillagnanna |
| Hús við vatn | `hus-vatn` | `img/verslun-hetja.webp`, forsíðumynd verslunarinnar |
| Hús, breið mynd | `hus-breid` | `img/banner/hus-breid.webp`, úr þjónustugáttinni |
| Sólarlag | `solarlag` | `img/banner/solarlag.webp`, innskráningarmynd þjónustugáttarinnar, spegluð svo húsið sé hægra megin |
| Logi | `logi` | `img/banner/logi.webp`, teikningin af síðunni Slökkvitæki á núverandi brunaholf.is. Pappírinn er framlengdur til vinstri svo Logi standi hægra megin við textann. |

- **Skoða og bera saman:** `?bannerar` aftan við slóð síðunnar, t.d. `/vefur/?bannerar`, opnar bannerasafnið neðst á síðunni. Þar er skipt á milli bannera og á milli útgáfnanna þriggja, og hlekkurinn sem þar stendur sýnir síðuna með völdum banner (`?hetja=<id>`). Þetta er forskoðun: valið fylgir slóðinni og breytir engu fyrir aðra gesti.
- **Festa banner:** í ritlinum (smella á hausinn, velja banner, Birta). Án ritilsins: setja `id` hans í `data-hetja` á hausnum í síðunni og skrána hans í `src` á `<img data-hetja-mynd>` í sama haus, svo rétta myndin sjáist strax þegar síðan opnast. `<video>` og takkinn mega standa: skriftan felur þau þegar bannerinn er kyrrmynd og sækir myndskeiðið þá ekki.
- **Nýr banner:** setja myndina í `img/banner/` og bæta línu í `BANNERAR` með `id`, `heiti`, `gerd: 'mynd'`, `mynd` og `pos` (`object-position` myndarinnar í hausnum). Ljós mynd fær `ljos: true`.
- **Slikjan undir textanum** er í stílblaði hverrar útgáfu. V2 og V3 hafa þrjár: fyrir eldinn, fyrir aðrar myndir (`[data-hetja-gerd="mynd"]`, þéttari því húsin eru björt þar sem eldmyndin er dökk) og fyrir ljósa mynd (`[data-hetja-ljos]`). Í V1 er myndin hægra megin í hausnum og slikjan þétt undir textanum; þar er aðeins sérregla fyrir ljósa mynd. Eftir nýjan banner þarf að mæla litamun textans yfir myndinni.

## Ritillinn

`?ritill` aftan við slóð síðunnar, t.d. `/vefur/?ritill`, opnar ritil á síðunni sjálfri: stika neðst og spjald til hægri (skúffa neðst á síma). Smellt er á það sem á að breyta.

| Hvað | Hvernig |
|---|---|
| Texti | Smella á hann og skrifa. Enter gefur línuskil. |
| Hluti af texta | Velja orðin og breyta letri, stærð, feitletrun, lit eða setja hlekk. Sniðið fer aðeins á valda textann. |
| Reitur í heild | Letur, stærð, þykkt, línubil, stafabil, jöfnun, litur. |
| Litir | Litaval með 15 litum. Sérlitur er valinn af öllum litaskalanum og má bæta í litavalið. |
| Mynd eða lógó | Hlaða upp, velja úr myndasafni, breyta hæð. Lógóið breytist á öllum stöðum í einu sé það valið. |
| Forsíðuhaus | Banner úr safninu eða eigin mynd, heil mynd eða fylla svæðið, hæð svæðis, aðdráttur, staðsetning. Smellt er á hausinn utan við orðin, eða á „Breyta banner“ í spjaldinu. |
| Sími | Á síma, eða með „Sími“ í stikunni á tölvu (síðan birtist í ramma í símabreidd), gilda stærðir og uppröðun sem breytt er aðeins á síma. |

**Vistun.** Breytingar vistast sjálfkrafa sem drög á þjóninum og eru þær sömu á öllum tækjum. Gestir sjá ekkert fyrr en ýtt er á **Birta**; þá fer útgáfan í loftið innan mínútu og í útgáfusöguna, þaðan sem hægt er að sækja eldri útgáfu aftur í drögin. Vinni tvö tæki í drögunum samtímis lætur ritillinn vita og spyr hvora útgáfuna eigi að halda.

**Innskráning.** Lykilorð ritilsins er umhverfisbreytan `VEFUR_RITILL_LYKILORD` á Netlify-vef stjórnstöðvarinnar, minnst 16 stafir. Sé hún ekki sett (eða of stutt) er ritillinn í **prufuham**: allt virkar á skjánum, en ekkert vistast og gestir sjá engar breytingar. Breytt lykilorð skráir alla út. Eftir að breytan er sett þarf eina birtingu (`[deploy]`) svo fallið sjái hana.

**Breytingar sem texti.** Í „Fleiri aðgerðir“ er efnið sýnt sem JSON. Það má afrita, laga (til dæmis með hjálp Claude) og setja inn aftur, og þar er líka hægt að sækja lista yfir alla texta síðunnar með lyklum þeirra. Þannig þarf ekki að breyta kóða til að breyta efni.

### Hvernig þetta er byggt

- Breytingarnar eru **efni, ekki kóði**. Síðurnar í þessari möppu breytast ekki; efnið geymir aðeins það sem vikið var frá þeim. Sniðið stendur efst í `site/efni.js`: `t` (textar), `m` (myndir), `hetja` (banner), `litir`, `myndasafn`. `s` gildir alls staðar og `sm` á síma (mjórri en 701 px).
- **Lyklar.** Hvert stak sem má breyta ber lykil: `data-e` á texta, `data-m` á mynd. `data-mr` merkir svæðið sem mynd með `data-mf` fyllir (forsíðuhausinn). Lykill má aldrei breytast eða flytjast á annað stak, því vistaðar breytingar hanga á honum. Nýtt stak fær nýjan, einkvæman lykil á forminu `<sýn>.<kafli>.<heiti>`. Texti sem stendur við hlið tákns er vafinn í `<span data-e>`, svo táknið sé ekki hluti af því sem breytt er.
- **Þjónninn.** Fallið `netlify/functions/vefur-efni.js` (`/api/vefur-efni`) geymir drög, birta útgáfu og sögu í töflunum `vefur_efni` og `vefur_efni_saga` (`sql/2026-11-14_vefur_efni.sql`): RLS er á, engar reglur, aðeins fallið kemst í þær. Myndir fara í bucketinn `vefverslun` undir `vefur/`. Lestur á birtu efni er opinn; allt annað krefst innskráningar.
- **Hjá gestum.** `site/efni.js` sækir birta efnið og setur það á síðuna. Síðasta útgáfa er geymd í vafranum, svo síðan birtist rétt strax við næstu heimsókn; við fyrstu heimsókn bíður breytanlegt efni í mest 0,35 sekúndur eftir þjóninum svo eldri texti blikki ekki.
- **Hreinsun.** Texti er hreinsaður tvisvar: á þjóninum við vistun og í vafranum áður en hann fer á síðuna. Aðeins þessi merki lifa: `b`, `strong`, `i`, `em`, `u`, `s`, `br`, `span`, `small`, `a`, `sup`, `sub`, með stílum og letri af lista. Klasi á texta stendur aðeins ef upprunalegi textinn í sama staki notar hann. Myndir mega aðeins koma úr þessari möppu eða úr `vefverslun/vefur/`. Stillingar (stærðir, letur, litir, staðsetning og hæð mynda) eru prófaðar á sama hátt: aðeins þekktir reitir með gildi innan marka eru geymdir og notaðir. Gallað gildi á einum stað stöðvar ekki hitt efnið. Listarnir eru á tveimur stöðum (`site/efni.js` og fallið) og þurfa að vera eins.
- **Vörur og verslun** eru ekki í ritlinum: þær koma úr `verslun/gogn.js` (sjá Vörur og verslun).

## Þjónustugáttin

Hlekkur á innskráningu viðskiptavina, `https://slokkvitaeki.netlify.app/gatt/`, er í hausnum (`a.w-gatt` í V2, `a.c-gatt` í V1, `a.gatt` í V3; á mjóum skjá táknið eitt), í spjaldi á forsíðunni og í fætinum við hlið Facebook-hlekksins í hverri síðu. Í V3 er hann líka í valmyndinni sem opnast á síma. Gáttin sjálf býr í kóðasafni Slökkvitækja-appsins (`gatt/`). Setningin í spjaldinu er orðrétt af innskráningarsíðu hennar.

## Facebook

Hlekkur á Facebook-síðuna er í fætinum í öllum síðunum (`a.w-foot__fb` í V2, `a.c-foot__fb` í V1, `a.footer__fb` í V3) og opnast í nýjum flipa. Slóðin er deilihlekkurinn sem Agnar lét í té: `https://www.facebook.com/share/1DqFztD5Uv/`.

## Vörur og verslun

`verslun/gogn.js` er afrit af vöruskránni frá 12.11.2026, ekki lifandi tenging. Breyting þar sést aðeins á þessum vef.

- Heiti vöru: `efni.t["vara.<id>.nafn"] = {"x": "Nýtt heiti"}`. Taflan `NOFN` í `verslun.js` ræður annars heiti 20 vara og gengur fyrir `nafn` í `vorur`.
- Verð: `verd` (með vsk) og `an` (án vsk) á vörunni.
- Fela vöru: bæta númerinu í `efni.vorur.falid`.
- Röð: röðin í `vorur` er röðin í versluninni, og fyrstu vörurnar sjást í vörukynningunni á forsíðunni.
- Texti og myndir í versluninni: `efni.t["<lykill>"]` og `efni.m["<lykill>"]`. Lykillinn er `data-e` eða `data-m` á stakinu.

Sé breytt í `verslun/gogn.js` þarf sama breyting að fara í `v1-skrar/verslun/gogn.js` og `v3-skrar/verslun/gogn.js`.

Verslunin er í prufuham: „Halda áfram í greiðslu“ sýnir skilaboð og sendir ekkert.

## Áður en lénið er tengt

1. Stofna sérstakan Netlify-vef fyrir þessa möppu: Base directory `vefur`, engin build-skipun, Publish directory `vefur`. Rót þessa kóðasafns er stjórnstöðin og á ekki að svara á léninu. Vefurinn þarf sömu `ignore`-reglu og er í `netlify.toml` í rótinni, annars kostar hver ýting birtingu. Netlify-vefur stjórnstöðvarinnar bætir auk þess skriftu hennar við hverja HTML-síðu sem hann ber fram, líka þessar; sérstakur vefur gerir það ekki.
2. Taka línuna `<meta name="robots" content="noindex">` úr öllum síðunum.
3. Ritillinn: fallið býr á vef stjórnstöðvarinnar. Á nýja léninu verður `data-api` á `<script src="site/efni.js">` að vera full slóð þangað (`https://brunaholf.netlify.app/api/vefur-efni`). Lénið er þegar á listanum `UPPRUNI` í fallinu.
4. Við DNS-breytinguna færist aðeins vefvísunin. Póstfærslur lénsins (MX) verða að standa óhreyfðar, annars hættir pósturinn að berast.
5. Ákveða hvort verslunin fer í loftið með ótengda greiðslu og afrit af vöruskránni, eða bíður.

## Prófað 14.11.2026

Skrárnar eins og þær standa hér voru keyrðar í vafra (Chromium):

- Sex síður (forsíða, Brunaþéttingar, vörulisti, tvær vörusíður, karfa) í sjö breiddum frá 320 til 1440 px á hverri útgáfu: engin lárétt skrun, engar brotnar myndir, engir dauðir hlekkir, engar skriftuvillur.
- Ferð kaupanda: valmynd, setja í körfu, flokkur, leit, röðun, vörusíða, karfa, greiðsluhnappurinn, beinar slóðir (líka beint á kaflann Hafa samband), til baka í vafra, valmynd og karfa á síma.
- Litamunur texta og bakgrunns nær 4,5:1 alls staðar nema á hvítum texta á appelsínugulum hnöppum.
- Myndskeiðið í forsíðuhausnum (H.264-skráin; prófunarvafrinn spilar ekki HEVC): spilar, takkinn stöðvar það og ræsir (líka með lyklaborði), það stöðvast þegar farið er af forsíðunni eða skrunað frá hausnum, er ekki sótt þegar hreyfing er afþökkuð eða síðan er opnuð beint á versluninni. HEVC-skráin var lesin með ffprobe: Main, þrep 4.0, merkið `hvc1`.
- Hausinn með hlekknum á þjónustugáttina í fjórtán breiddum frá 320 til 1920 px á hverri útgáfu: engin lárétt skrun.
- Textinn yfir myndskeiðinu, mældur á móti því sem er á bak við hann í 27 römmum (einn á sekúndu) í þrettán breiddum frá 360 til 1920 px: stór fyrirsögn nær 3:1 og annar texti 4,5:1 í hverjum ramma.
- Bannerasafnið á hverri útgáfu: hver banner sést í hausnum á tölvu og síma, myndskeiðið er ekki sótt þegar bannerinn er kyrrmynd, safnið (`?bannerar`) skiptir um banner og um útgáfu, afritar hlekkinn og lokast, og engin lárétt skrun verður niður í 320 px.
- Textinn yfir hverri kyrrmynd safnsins (sex myndir), mældur á móti myndinni á bak við hann í þrettán breiddum frá 360 til 1920 px á hverri útgáfu: stór fyrirsögn nær 3:1 og annar texti 4,5:1.
- Ritillinn á hverri útgáfu, keyrður í vafra á móti eftirlíkingu af þjóninum (raunverulega fallið á töflu í minni, svo ekkert er skrifað í lifandi gögn), 112 atriði: prufuhamur vistar ekkert; innskráning; texti, snið á reit og á völdum orðum, litaval og afturköllun; lógó og banner (upphleðsla, hæð, staðsetning, aðdráttur); birting og það sem gestur sér á öðru tæki; tvö tæki samtímis; útgáfusaga; breytingar sem texti; sími og símarammi á tölvu; fjandsamlegt efni er hreinsað og keyrir ekki; gölluð gildi stöðva ekki annað efni; nýbirt útgáfa víkur ekki fyrir eldra svari af jaðrinum.
- Fallið `vefur-efni` eitt og sér, 61 atriði: án lykilorðs (eða með of stuttu) svarar það aðeins lestri á birtu efni; rangt lykilorð og falsaðir miðar fá 401; vistun á úreltum grunni fær 409; birting skrifar söguna fyrst; villa frá gagnagrunni er ekki geymd á jaðrinum; texti og stillingar eru hreinsuð fyrir vistun.
- Sérstök yfirferð á hreinsuninni: 1.044 handskrifuð og 40.000 slembin fjandsamleg inntök í vafra og 31.044 gegnum hreinsun fallsins. Enginn kóði keyrði og ekkert efni frá öðru léni komst á síðuna.
- Töflurnar `vefur_efni` og `vefur_efni_saga` í lifandi gagnagrunni: með opinbera lyklinum skila lestur og skrif 401 (42501).
