# Ný brunaholf.is (tillaga)

Kyrrstæður vefur án smíðaskrefs: skrárnar í þessari möppu eru vefurinn eins og hann er borinn fram.

| Síða | Útgáfa |
|---|---|
| `index.html` | V1, sú sem vefurinn byrjar á. Hönnunarkerfið Brunahólf: dökkblár haus með flipum, pillulaga hnappar, letrið Poppins. |
| `v2.html` | V2, geymd til hliðar. Hönnunarkerfið Brunahólf V2: ljósblár grunnur, hvít spjöld með mjúkum skugga. |

Efni og virkni eru þau sömu í báðum: forsíða, Brunaþéttingar, vefverslun (42 vörur, vörusíður, karfa) og Hafa samband á hverri sýn.

## Skipta yfir í V2

Endurnefna `index.html` í `v1.html` og `v2.html` í `index.html`. Allar slóðir í síðunum eru afstæðar við þessa möppu, svo ekkert annað breytist.

## Skrár

| Skrá | Hvað er í henni |
|---|---|
| `index.html`, `v2.html` | Texti og uppbygging. Neðst í hvorri eru stillingar leiðarskriftunnar (`window.BH_SITE`). |
| `site/sida.css`, `ds/` | Útlit V1 og hönnunarkerfi þess. |
| `v2-skrar/` | Það sem V2 á ein: hönnunarkerfið (`ds/`), stílblaðið (`site/sida.css`) og vörugögn með litum V2 (`verslun/gogn.js`). |
| `site/router.js` | Sýnirnar þrjár og slóðirnar. Sameiginleg báðum síðum. |
| `verslun/verslun.js`, `verslun/verslun.css` | Verslunin sjálf, tekin úr `vefverslun/` í kóðasafni Slökkvitækja-appsins og aðlöguð á sjö stöðum sem taldir eru upp efst í skránni. Sameiginleg báðum síðum. |
| `verslun/gogn.js` | Vörur, verð, birgðir og stillingar verslunarinnar fyrir V1. |
| `img/`, `vv/v/`, `myndir/` | Merkið og forsíðumyndir, vörumyndir (heitið er númer vörunnar) og myndir á vörusíðum. Sameiginlegar. |

## Slóðir

Síðan er ein skrá með þremur sýnum sem skipt er á milli með #-slóðum.

| Slóð | Sýn |
|---|---|
| `#verslun` | Verslunin, vörulistinn |
| `#vara-<id>` | Vörusíða, t.d. `#vara-12` |
| `#karfa` | Karfan |
| `#brunathettingar` | Brunaþéttingar |
| `#hafa-samband` | Kaflinn Hafa samband á þeirri sýn sem er opin |
| allt annað | Forsíðan |

Leiðarskriftan reiðir sig á þessi stök í síðunum: `#heim`, `#brunasyn`, `#verslunarsyn`, `#vv-app`, `#kynning`, `#allar`, `#allar-n`, `.w-cart`, `#w-cart-n`, `#hafa-samband`, og valmyndarhlekkina með `data-spy`.

## Vörur og verslun

`verslun/gogn.js` er afrit af vöruskránni frá 12.11.2026, ekki lifandi tenging. Breyting þar sést aðeins á þessum vef.

- Heiti vöru: `efni.t["vara.<id>.nafn"] = {"x": "Nýtt heiti"}`. Taflan `NOFN` í `verslun.js` ræður annars heiti 20 vara og gengur fyrir `nafn` í `vorur`.
- Verð: `verd` (með vsk) og `an` (án vsk) á vörunni.
- Fela vöru: bæta númerinu í `efni.vorur.falid`.
- Röð: röðin í `vorur` er röðin í versluninni, og fyrstu vörurnar sjást í vörukynningunni á forsíðunni.
- Texti og myndir í versluninni: `efni.t["<lykill>"]` og `efni.m["<lykill>"]`. Lykillinn er `data-e` eða `data-m` á stakinu.

Sé breytt í `verslun/gogn.js` þarf sama breyting að fara í `v2-skrar/verslun/gogn.js`, sem ber að auki liti V2 í `efni.thema`.

Verslunin er í prufuham: „Halda áfram í greiðslu“ sýnir skilaboð og sendir ekkert.

## Áður en lénið er tengt

1. Stofna sérstakan Netlify-vef fyrir þessa möppu: Base directory `vefur`, engin build-skipun, Publish directory `vefur`. Rót þessa kóðasafns er stjórnstöðin og á ekki að svara á léninu. Vefurinn þarf sömu `ignore`-reglu og er í `netlify.toml` í rótinni, annars kostar hver ýting birtingu.
2. Taka línuna `<meta name="robots" content="noindex">` úr báðum síðunum.
3. Við DNS-breytinguna færist aðeins vefvísunin. Póstfærslur lénsins (MX) verða að standa óhreyfðar, annars hættir pósturinn að berast.
4. Ákveða hvort verslunin fer í loftið með ótengda greiðslu og afrit af vöruskránni, eða bíður.

## Prófað 13.11.2026

Skrárnar eins og þær standa hér voru keyrðar í vafra (Chromium):

- Sex síður (forsíða, Brunaþéttingar, vörulisti, tvær vörusíður, karfa) í sjö breiddum frá 320 til 1440 px á hvorri útgáfu: engin lárétt skrun, engar brotnar myndir, engir dauðir hlekkir, engar skriftuvillur.
- Ferð kaupanda: valmynd, setja í körfu, flokkur, leit, röðun, vörusíða, karfa, greiðsluhnappurinn, beinar slóðir, til baka í vafra, valmynd og karfa á síma.
- Litamunur texta og bakgrunns nær 4,5:1 alls staðar nema á hvítum texta á appelsínugulum hnöppum.
