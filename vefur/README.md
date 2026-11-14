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
- Myndir bannerasafnsins (`img/banner/`, `img/hetja-v3.webp`, `img/verslun-hetja.webp`) eru sameiginlegar; nýr banner í einni tillögunni þarf að fara í hinar.
- Eftir færslu eru allar síðurnar keyrðar í vafra eins og lýst er undir „Prófað“.

## Skrár

| Skrá | Hvað er í henni |
|---|---|
| `index.html`, `v1.html`, `v3.html` | Texti og uppbygging. Neðst í hverri eru stillingar leiðarskriftunnar (`window.BH_SITE`). |
| `site/sida.css`, `ds/` | Útlit V2 og hönnunarkerfi þess. |
| `v1-skrar/` | Það sem V1 á ein: hönnunarkerfið (`ds/`), stílblaðið (`site/sida.css`) og vörugögnin (`verslun/gogn.js`). |
| `v3-skrar/` | Það sem V3 á ein: stílblaðið (`site/sida.css`), stílblað verslunarinnar (`verslun/verslun.css`) og vörugögnin (`verslun/gogn.js`). |
| `site/router.js` | Sýnirnar þrjár og slóðirnar, og í seinni hlutanum bannerasafnið og skriftan sem stýrir myndskeiðinu í forsíðuhausnum. Sameiginleg öllum síðunum. |
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

Forsíðuhausinn sýnir einn banner úr safni sem er sameiginlegt öllum útgáfunum: listinn `BANNERAR` í seinni hluta `site/router.js`.

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
- **Festa banner:** setja `id` hans í `data-hetja` á hausnum í síðunni og skrána hans í `src` á `<img data-hetja-mynd>` í sama haus, svo rétta myndin sjáist strax þegar síðan opnast. `<video>` og takkinn mega standa: skriftan felur þau þegar bannerinn er kyrrmynd og sækir myndskeiðið þá ekki.
- **Nýr banner:** setja myndina í `img/banner/` og bæta línu í `BANNERAR` með `id`, `heiti`, `gerd: 'mynd'`, `mynd` og `pos` (`object-position` myndarinnar í hausnum). Ljós mynd fær `ljos: true`.
- **Slikjan undir textanum** er í stílblaði hverrar útgáfu. V2 og V3 hafa þrjár: fyrir eldinn, fyrir aðrar myndir (`[data-hetja-gerd="mynd"]`, þéttari því húsin eru björt þar sem eldmyndin er dökk) og fyrir ljósa mynd (`[data-hetja-ljos]`). Í V1 er myndin hægra megin í hausnum og slikjan þétt undir textanum; þar er aðeins sérregla fyrir ljósa mynd. Eftir nýjan banner þarf að mæla litamun textans yfir myndinni.

## Þjónustugáttin

Hlekkur á innskráningu viðskiptavina, `https://slokkvitaeki.netlify.app/gatt/`, er í hausnum (`a.w-gatt` í V2, `a.c-gatt` í V1, `a.gatt` í V3; á mjóum skjá táknið eitt) og í spjaldi á forsíðunni í hverri síðu. Í V3 er hann líka í valmyndinni sem opnast á síma. Gáttin sjálf býr í kóðasafni Slökkvitækja-appsins (`gatt/`). Setningin í spjaldinu er orðrétt af innskráningarsíðu hennar.

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
3. Við DNS-breytinguna færist aðeins vefvísunin. Póstfærslur lénsins (MX) verða að standa óhreyfðar, annars hættir pósturinn að berast.
4. Ákveða hvort verslunin fer í loftið með ótengda greiðslu og afrit af vöruskránni, eða bíður.

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
