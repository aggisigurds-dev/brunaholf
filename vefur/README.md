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
| `site/innranet.js` | Innskráning starfsfólks á síðunni og valmyndin eftir hana. Hleðst aðeins þegar smellt er á „Innranet“ í fætinum eða slóðin ber `?innranet`. |
| `site/innskraning.js`, `site/innskraning.css` | Innskráningarskjár starfsfólks í premium útliti: sama myndefni, kort, reitir og hnappar og á innskráningarsíðu þjónustugáttarinnar. „Innranet“ og innskráning ritilsins teikna bæði á hann. Hlaðast aðeins með þeim. |
| `site/router.js` | Sýnirnar þrjár og slóðirnar, og í seinni hlutanum skriftan sem setur bannerinn í forsíðuhausinn og stýrir myndskeiðinu. Sameiginleg öllum síðunum. |
| `verslun/verslun.js` | Verslunin sjálf, tekin úr `vefverslun/` í kóðasafni Slökkvitækja-appsins og aðlöguð á átta stöðum sem taldir eru upp efst í skránni (sá áttundi sækir lifandi vörur). Sameiginleg öllum síðunum. |
| `verslun/verslun.css` | Útlit verslunarinnar í V2 og V1. |
| `verslun/gogn.js` | Stillingar verslunarinnar fyrir V2, þar á meðal litir hennar í `efni.thema`, og afrit af vörunum: það er sýnt þar til lifandi vörur berast (sjá Vörur og verslun). |
| `manifest.webmanifest`, `img/app-192.png`, `img/app-512.png`, `img/app-maskable-512.png`, `img/apple-touch-icon.png` | Tákn fyrir heimaskjá síma: loginn úr merkinu á dökkbláum grunni. Allar síðurnar nefna `apple-touch-icon.png`; aðalsíðan nefnir líka manifestið, svo flýtileið af henni heitir Brunahólf og opnar aðalsíðuna í vafranum (`display: browser`, gestum er ekki boðið að setja upp app). Flýtileið af `v1.html` eða `v3.html` opnar þá síðu. Litla táknið í flipa vafrans er áfram `img/taknmynd.png`. |
| `img/`, `vv/v/`, `myndir/` | Merkið, myndskeiðið í forsíðuhausnum og myndir bannerasafnsins (þrjár þeirra í `img/banner/`), bakgrunnur innskráningarskjásins (`img/innskraning.webp`, sama mynd og á innskráningarsíðu þjónustugáttarinnar), vörumyndir (heitið er númer vörunnar) og myndir á vörusíðum. Sameiginlegar. |

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

`?ritill` aftan við slóð síðunnar, t.d. `/vefur/?ritill`, opnar ritil á síðunni sjálfri: stika neðst og spjald til hægri (skúffa neðst á síma). Smellt er á það sem á að breyta. Hamurinn er valinn efst í spjaldinu:

- **Einfalt** (sjálfgefið): texti, myndir, banner, kaflar (bakgrunnur, litur texta, fela, færa) og aðallitir og letur síðunnar.
- **Ítarlegt** (`?ritill&hamur=itarlegt`): allar stillingar á hverju svæði og hverjum texta, hvert þematákn fyrir sig og leiðbeiningar sem Claude getur unnið eftir.

| Hvað | Hvernig |
|---|---|
| Texti | Smella á hann og skrifa. Enter gefur línuskil. |
| Hluti af texta | Velja orðin og breyta letri, stærð, feitletrun, lit eða setja hlekk. Sniðið fer aðeins á valda textann. |
| Reitur í heild | Letur, stærð, þykkt, jöfnun, litur, fela. Ítarlegt: línubil, stafabil, skáletur, hástafir, bakgrunnur, bil, horn, rammi og skuggi. |
| Hnappur eða hlekkur | „Hvert vísar hlekkurinn“ í spjaldi textans: `https://…`, `#kafli`, `tel:` eða `mailto:`. |
| Kafli | Smella á autt svæði í honum, eða á heiti hans í spjaldi texta. Bakgrunnur, litur texta (nær til texta í kaflanum, nema hnappa og hlekkja), fela, færa framar eða aftar. Ritillinn varar við texta sem sést illa á bakgrunninum. |
| Hvaða svæði sem er (ítarlegt) | Spjöld, listar, atriði og hnappar: bil innan í og utan um, mesta breidd og staða, lágmarkshæð, horn, rammi, skuggi, gegnsæi, bil milli staka, dálkar í grind og jöfnun texta. Spjaldið sýnir lykil svæðisins og svæðin utan um það og inni í því. |
| Litir og letur síðunnar | Aðeins í aðalútgáfunni (V2). Einfalt: aðallitur, áherslulitur, bakgrunnur síðu og letur; tónar hvers litar fylgja sjálfkrafa. Ítarlegt: hver tónn, textalitir, línur, horn og mesta breidd efnis. Verði texti torlæsilegur varar ritillinn við og býður að laga textalitina. |
| Falið | Það sem er falið sést dauft með strikalínu í ritlinum og er á lista í tóma spjaldinu („Falið á síðunni“), þar sem það er sýnt aftur. |
| Litaval | 15 litir. Sérlitur er valinn af öllum litaskalanum og má bæta í litavalið. |
| Mynd eða lógó | Hlaða upp, velja úr myndasafni, breyta hæð. Lógóið breytist á öllum stöðum í einu sé það valið. |
| Forsíðuhaus | Banner úr safninu eða eigin mynd, heil mynd eða fylla svæðið, hæð svæðis, aðdráttur, staðsetning. Smellt er á hausinn utan við orðin, eða á „Breyta banner“ í spjaldinu. |
| Sími | Á síma, eða með „Sími“ í stikunni á tölvu (síðan birtist í ramma í símabreidd), gilda stærðir, bil, dálkar og að fela aðeins á síma. Litir, letur, horn og rammar gilda alls staðar. |

**Vistun.** Breytingar vistast sjálfkrafa sem drög á þjóninum og eru þær sömu á öllum tækjum. Gestir sjá ekkert fyrr en ýtt er á **Birta**; þá fer útgáfan í loftið innan mínútu og í útgáfusöguna, þaðan sem hægt er að sækja eldri útgáfu aftur í drögin. Vinni tvö tæki í drögunum samtímis lætur ritillinn vita og spyr hvora útgáfuna eigi að halda.

**Innskráning.** Sama notandanafn og lykilorð og í stjórnstöðinni og Slökkvitæki-appinu (notendaskrá starfsmanna, `hub_adgangar`). Aðeins notendur með hlutverkið **Admin** geta vistað og birt; hlutverkum er stýrt í Aðgöngum stjórnstöðvarinnar. Sá sem er þegar skráður inn í stjórnstöðina í sama vafra er líka skráður inn í ritilinn, og útskráning á öðrum staðnum gildir á hinum. Án innskráningar er ritillinn í **prufuham**: allt virkar á skjánum, en ekkert vistast og gestir sjá engar breytingar. Þegar lykilorði starfsmanna er skipt skrást allir út. Innskráningin er heill skjár í premium útliti (`site/innskraning.js`), sá sami og „Innranet“ opnar. Hann sýnir aðeins notandanafn og lykilorð og nefnir engin innri kerfi.

**Innranet.** Neðst á hverri síðu er hlekkurinn „Innranet“ (líka `?innranet` aftan við slóðina). Hann opnar innskráningarskjá starfsfólks á síðunni sjálfri, í sama útliti og innskráningarsíða þjónustugáttarinnar (myndin á bak við, merkið, kort með reitum og appelsínugulum hnappi), með sama notandanafni og lykilorði og að ofan, og eftir innskráningu valmynd á sama skjá: Breyta síðunni, Stillingar síðunnar (ítarlegi ritillinn) og leiðir í innri kerfin (stjórnborð þjónustugáttar, Slökkvitæki-kerfið, stjórnstöðin). Leiðirnar í innri kerfin koma frá þjóninum eftir innskráningu (`INNRANET` í `netlify/functions/vefur-efni.js`) og standa ekki í skriftum síðunnar, svo gestir sjái þær ekki. Hlekkurinn er falinn í síðunni (`hidden`) og `site/efni.js` sýnir hann þar sem þjónninn er til staðar; í tillögunum í Claude sést hann því ekki.

**Með hjálp Claude.** „Leiðbeiningar fyrir Claude“ (í ítarlega spjaldinu og í „Fleiri aðgerðir“) er texti til að afrita í spjall við Claude: reglurnar, dæmi, lyklar allra texta, svæða, mynda og tákna á síðunni og breytingarnar eins og þær standa. Claude svarar með einum JSON-hlut sem er límdur í „Setja inn svar frá Claude“ og sameinaður við breytingarnar sem fyrir eru (gildið `null` eyðir færslu). Ritillinn lagar það sem er næstum rétt (lit sem `red` eða `rgb(…)`, `"12px"`), sleppir gildum sem síðan tekur ekki gild og segir frá þeim, og nefnir lykla sem eru ekki til og aðra vefi sem hlekkir vísa á. Allt verður drög og má afturkalla. Claude sem stýrir vafranum sjálfur getur kallað á `window.BH_RITILL.lysing()` og `window.BH_RITILL.sameina({…})`.

**Breytingar sem texti.** Í „Fleiri aðgerðir“ er allt efnið sýnt sem JSON. „Setja inn“ skiptir öllum breytingunum út fyrir textann.

**Það sem ritillinn gerir ekki.** Nýir kaflar, ný stök og ný tákn (íkon) eru í síðunni sjálfri og þurfa kóðabreytingu. Vörurnar koma lifandi úr vöruskránni og textar verslunarinnar úr `verslun/gogn.js` (sjá Vörur og verslun). Litir og letur síðunnar í heild eru aðeins í aðalútgáfunni. Í V3 standa kaflarnir í sýn sem ber engan lykil og verða því ekki færðir.

### Hvernig þetta er byggt

- Breytingarnar eru **efni, ekki kóði**. Síðurnar í þessari möppu breytast ekki; efnið geymir aðeins það sem vikið var frá þeim. Sniðið stendur efst í `site/efni.js`: `t` (textar), `k` (svæði), `rod` (röð svæða), `utlit` (þematákn), `m` (myndir), `hetja` (banner), `litir`, `myndasafn`. `s` gildir alls staðar og `sm` á síma (mjórri en 701 px).
- **Lyklar.** Hvert stak sem má breyta ber lykil: `data-e` á texta, `data-m` á mynd, `data-k` á svæði (kafli, haus, fótur, spjald, listi, atriði, hnappur með tákni). `data-mr` merkir svæðið sem mynd með `data-mf` fyllir (forsíðuhausinn). Lykill má aldrei breytast eða flytjast á annað stak, því vistaðar breytingar hanga á honum. Nýtt stak fær nýjan, einkvæman lykil á forminu `<sýn>.<kafli>.<heiti>`. Texti sem stendur við hlið tákns er vafinn í `<span data-e>`, svo táknið sé ekki hluti af því sem breytt er.
- **Þema (V2).** Listinn `<script type="application/json" id="bh-utlit">` í haus `index.html`, á undan `site/efni.js`, telur upp táknin sem ritillinn má breyta: `k` táknið, `t` tegund (`l` litur, `f` letur, `px` mál), `n` heiti í ritlinum, `h` hópur, `v` upprunalegt gildi (það sama og í `ds/tokens.css`), `e` sést í einfalda hamnum, `af` tónn sem fylgir öðru tákni, `med` tákn sem breytast með, `min` og `max`. Litir í `ds/bundle.css` og `site/sida.css` vísa í táknin: `var(--…)`, eða `color-mix(in srgb,var(--…) N%,transparent)` þar sem liturinn er hálfgegnsær, með fasta litinn á undan fyrir vafra sem kunna ekki `color-mix`. Nýr litur í stílblaði á að vísa í tákn, annars fylgir hann ekki þemanu. Tákn sem er ekki á listanum breytist ekki, sama hvað stendur í efninu.
- **Þjónninn.** Fallið `netlify/functions/vefur-efni.js` (`/api/vefur-efni`) geymir drög, birta útgáfu og sögu í töflunum `vefur_efni` og `vefur_efni_saga` (`sql/2026-11-14_vefur_efni.sql`): RLS er á, engar reglur, aðeins fallið kemst í þær. Myndir fara í bucketinn `vefverslun` undir `vefur/`. Lestur á birtu efni er opinn; allt annað krefst innskráningar. Fallið hefur ekkert eigið lykilorð: það les cookie-ið `hub_user` sem `/api/hub-adgangar` setur við innskráningu og sannreynir það á sama hátt og það fall (`sessionUser` þar, `notandi` hér; breytist annað þarf hitt að fylgja). Skrif þurfa auk þess að koma frá síðunni sjálfri (hausinn `x-ritill` og `Origin` af listanum `UPPRUNI`).
- **Hjá gestum.** `site/efni.js` sækir birta efnið og setur það á síðuna. Síðasta útgáfa er geymd í vafranum, svo síðan birtist rétt strax við næstu heimsókn; við fyrstu heimsókn bíður breytanlegt efni í mest 0,35 sekúndur eftir þjóninum svo eldri texti blikki ekki. Svar þjónsins er geymt á jaðrinum og getur verið nokkurra mínútna gamalt rétt eftir birtingu; vafri sem hefur séð nýrri útgáfu á síðustu tíu mínútum tekur eldra svar ekki fram yfir hana.
- **Hreinsun.** Texti er hreinsaður tvisvar: á þjóninum við vistun og í vafranum áður en hann fer á síðuna. Aðeins þessi merki lifa: `b`, `strong`, `i`, `em`, `u`, `s`, `br`, `span`, `small`, `a`, `sup`, `sub`, með stílum og letri af lista. Klasi á texta stendur aðeins ef upprunalegi textinn í sama staki notar hann. Myndir mega aðeins koma úr þessari möppu eða úr `vefverslun/vefur/`. Stillingar (stærðir, letur, litir, bil, horn, rammar, skuggar, dálkar, slóðir hlekkja, staðsetning og hæð mynda, þematákn) eru prófaðar á sama hátt: aðeins þekktir reitir með gildi innan marka eru geymdir og notaðir, og ekkert frjálst CSS kemst á síðuna. Litir eru `#rgb` eða `#rrggbb`, án gegnsæis. Vefslóð þarf vélarheiti strax á eftir `https://` (enginn notandahluti, ekkert öfugt skástrik). Engin regla stílblaðsins sem efnislagið býr til nær inn í verslunina (`#vv-app`). Gallað gildi á einum stað stöðvar ekki hitt efnið. Listarnir eru á tveimur stöðum (`site/efni.js` og fallið) og þurfa að vera eins.
- **Það sem kemur að utan í ritilinn** (svar frá Claude, innsettur texti, drög úr prufuham) fer í gegnum sömu reglur og þjónninn notar áður en það er notað (`yfirfara` í `site/ritill.js`): óþekktir lyklar, óþekktir reitir og gildi utan marka eru tekin út og talin upp. Ritillinn setur gildi úr efninu aldrei hrátt í spjöldin sín (rennur fá tölur, annað fer gegnum `esc`), og eftir innsetningu les hann af síðunni sjálfri hvert hlekkir vísa og telur upp nýjar slóðir út af vefnum, símanúmer og netföng.
- **Vörur og verslun** eru ekki í ritlinum: vörurnar koma lifandi úr vöruskránni og textar verslunarinnar úr `verslun/gogn.js` (sjá Vörur og verslun).

## Þjónustugáttin

Hlekkur á innskráningu viðskiptavina, `https://slokkvitaeki.netlify.app/gatt/`, er í hausnum (`a.w-gatt` í V2, `a.c-gatt` í V1, `a.gatt` í V3; á mjóum skjá táknið eitt), í spjaldi á forsíðunni og í fætinum við hlið Facebook-hlekksins í hverri síðu. Í V3 er hann líka í valmyndinni sem opnast á síma. Gáttin sjálf býr í kóðasafni Slökkvitækja-appsins (`gatt/`). Setningin í spjaldinu er orðrétt af innskráningarsíðu hennar.

## Facebook

Hlekkur á Facebook-síðuna er í fætinum í öllum síðunum (`a.w-foot__fb` í V2, `a.c-foot__fb` í V1, `a.footer__fb` í V3) og opnast í nýjum flipa. Slóðin er deilihlekkurinn sem Agnar lét í té: `https://www.facebook.com/share/1DqFztD5Uv/`.

## Vörur og verslun

**Vörurnar eru lifandi.** Verslunin teiknar sig strax úr afritinu í `verslun/gogn.js` og sækir svo vörurnar af `/api/vefur-vorur` (`netlify/functions/vefur-vorur.js` í rót kóðasafnsins): heiti, flokk, verð, lager, mynd og vöruval. Lýsingarnar eru ekki lifandi (sjá Lýsing hér fyrir neðan). Fallið les vöruskrána gegnum vefverslunarfall Slökkvitækja-appsins (`/api/vefverslun`), sem ræður hvaða vörur eru til sölu á netinu og í hvaða röð. Vefurinn sýnir því sömu vörur og sama verð og vefverslunin þar, og breyting í vöruskránni sést hér á fáeinum mínútum án þess að neitt sé birt (svarið er geymt í 5 mínútur; sjá SKYNDIMINNI efst í fallinu). Vörum, verði og lager er breytt í Slökkvitæki-kerfinu, ekki í þessari möppu.

- Hvaða vörur sjást: þær sem eru á forsíðu söluborðsins og þær sem ritill vefverslunarinnar bætir við, að frátöldum þeim sem hann felur. Vara án verðs er ekki sýnd, og ekki heldur vara sem ber síma, netfang, slóð, löng númer eða orð lengra en 40 stafir í heiti eða flokki.
- Heiti: heitið í vöruskránni. Taflan `NOFN` í `verslun.js` gefur 20 vörum læsilegra heiti og gengur fyrir því; `efni.t["vara.<id>.nafn"] = {"x": "Nýtt heiti"}` í `gogn.js` gengur fyrir báðum.
- Lýsing: yfirfarna lýsingin úr afritinu, aldrei beint úr vöruskránni. Lýsingardálkurinn þar er líka minnisblað starfsfólks (birgjanúmer, birgjareikningar, innkaupsverð), og sía sem leitar að slíku nær aldrei öllu. Ný eða breytt lýsing birtist því þegar afritið er endurnýjað, og ný vara hefur enga lýsingu þangað til. Fallið skilar engum lýsingum.
- Myndir: smækkuðu myndirnar í `vv/v/<id>.webp` fylgja vefnum og eru notaðar meðan myndin í vöruskránni er sú sama og þegar afritið var gert (fingrafarið `ms`). Ný vara, eða vara sem fær nýja mynd, sýnir myndina beint úr vöruskránni í fullri stærð.
- Röð: röðin í vöruskránni er röðin í versluninni, og fyrstu vörurnar sjást í vörukynningunni á forsíðunni.
- Texti og myndir verslunarinnar sjálfrar (ekki varanna) eru í `gogn.js`: `efni.t["<lykill>"]` og `efni.m["<lykill>"]`. Lykillinn er `data-e` eða `data-m` á stakinu. Sé breytt í `verslun/gogn.js` þarf sama breyting að fara í `v1-skrar/verslun/gogn.js` og `v3-skrar/verslun/gogn.js`.

**Hvernig síðan fer með lifandi vörur** (`verslun/verslun.js`, kaflinn „Lifandi vörur“). Breyti þær einhverju sem sést er verslunin teiknuð aftur, annars er ekkert snert. Ekki er teiknað meðan skrifað er í reit í versluninni, hnappi haldið niðri eða síðan skrunar. Það sem stendur í reitum körfunnar helst, og fókusinn stendur á sama hnappi þótt röð varanna breytist. Svarið er geymt í vafranum (`bh_vv_lifandi_v1`, aðeins skyndiminni) svo næsta heimsókn byrji á nýjustu vörum. Svarið er sannreynt bæði í fallinu og á síðunni: aðeins reitirnir sem taldir eru upp efst í fallinu fara inn, hver af sinni gerð, og vörutexti er alltaf settur á síðuna sem texti, aldrei sem HTML.

**Þegar fallið næst ekki** stendur afritið: verslunin virkar áfram með vörurnar eins og þær voru þegar það var gert (`sott` efst í `gogn.js`). Sama gildir þar sem fallið er ekki til, til dæmis í tillögunum í Claude og þegar síða er opnuð af diski.

**Afritið endurnýjað.** Þess þarf ekki til að vörur og verð séu rétt, en nýtt afrit færir nýjar og breyttar lýsingar á vefinn, lætur fyrstu teikningu passa við lifandi vörur og gefur nýjum vörum smækkaða mynd. Afritið er svar vöruskrárinnar unnið með reglu fallsins, `umbreyta(svar, { lysing: true })`, sem tekur minnispunkta úr lýsingum og skilar `null` fyrir lýsingu sem enn líkist minnispunkti; hvert `null` er ákveðið af manni. Lýsingar sem eru nýjar eða breyttar frá síðasta afriti eru lesnar yfir áður en þær fara út, og `mynd` vísar á `vv/v/<id>.webp`. Afritið fer í `gogn.js` hverrar útgáfu.

Verslunin er í prufuham: „Halda áfram í greiðslu“ sýnir skilaboð og sendir ekkert.

**Afhending.** Vörur eru aðeins sóttar: Helluhrauni 10, Hafnarfirði, virka daga 9 til 17. Reglulegar heimsendingar eru ekki hafnar (Agnar 14.11.2026), svo í stað valsins „Fá sent heim“ stendur ábending sem opnar póst til verslunarinnar. Textarnir bera lyklana `afh.saekja.x` og `afh.heim.ath`. Hlekkurinn opnar póst á netfang verslunarinnar; standi annað netfang á léni félagsins í textanum fer pósturinn þangað, en netfang á öðru léni er aldrei notað í hlekkinn. Þetta kemur úr `vefverslun/` í kóðasafni Slökkvitækja-appsins (fallið `afhending()` í `verslun.js`): þegar heimsendingar hefjast kemur valið aftur þar og er svo fært hingað.

## Áður en lénið er tengt

1. Stofna sérstakan Netlify-vef fyrir þessa möppu: Base directory `vefur`, engin build-skipun, Publish directory `vefur`. Rót þessa kóðasafns er stjórnstöðin og á ekki að svara á léninu. Vefurinn þarf sömu `ignore`-reglu og er í `netlify.toml` í rótinni, annars kostar hver ýting birtingu. Netlify-vefur stjórnstöðvarinnar bætir auk þess skriftu hennar við hverja HTML-síðu sem hann ber fram, líka þessar; sérstakur vefur gerir það ekki.
2. Taka línuna `<meta name="robots" content="noindex">` úr öllum síðunum.
3. Ritillinn: fallið býr á vef stjórnstöðvarinnar. Á nýja léninu verður `data-api` á `<script src="site/efni.js">` að vera full slóð þangað (`https://brunaholf.netlify.app/api/vefur-efni`), svo gestir fái birta efnið. Innskráningin er cookie á vef stjórnstöðvarinnar og fylgir ekki beiðnum frá öðru léni: ritillinn er því áfram notaður á `brunaholf.netlify.app/vefur/?ritill`, ekki á nýja léninu, nema fallið og innskráningin flytjist með. Hlekkurinn „Innranet“ í fætinum vísar þá sjálfkrafa á `brunaholf.netlify.app/vefur/?innranet` (`site/efni.js` sér að þjónninn er á öðru léni). Lifandi vörur verslunarinnar fylgja sömu stillingu: slóð fallsins `vefur-vorur` er leidd af `data-api`, og fallið má lesa frá öðru léni.
4. Við DNS-breytinguna færist aðeins vefvísunin. Póstfærslur lénsins (MX) verða að standa óhreyfðar, annars hættir pósturinn að berast.
5. Ákveða hvort verslunin fer í loftið með ótengda greiðslu, eða bíður.

## Prófað 15.11.2026

Skrárnar eins og þær standa hér voru keyrðar í vafra (Chromium):

- Sex síður (forsíða, Brunaþéttingar, vörulisti, tvær vörusíður, karfa) í sjö breiddum frá 320 til 1440 px á hverri útgáfu: engin lárétt skrun, engar brotnar myndir, engir dauðir hlekkir, engar skriftuvillur.
- Ferð kaupanda: valmynd, setja í körfu, flokkur, leit, röðun, vörusíða, karfa, greiðsluhnappurinn, beinar slóðir (líka beint á kaflann Hafa samband), til baka í vafra, valmynd og karfa á síma.
- Litamunur texta og bakgrunns nær 4,5:1 alls staðar nema á hvítum texta á appelsínugulum hnöppum.
- Myndskeiðið í forsíðuhausnum (H.264-skráin; prófunarvafrinn spilar ekki HEVC): spilar, takkinn stöðvar það og ræsir (líka með lyklaborði), það stöðvast þegar farið er af forsíðunni eða skrunað frá hausnum, er ekki sótt þegar hreyfing er afþökkuð eða síðan er opnuð beint á versluninni. HEVC-skráin var lesin með ffprobe: Main, þrep 4.0, merkið `hvc1`.
- Hausinn með hlekknum á þjónustugáttina í fjórtán breiddum frá 320 til 1920 px á hverri útgáfu: engin lárétt skrun.
- Textinn yfir myndskeiðinu, mældur á móti því sem er á bak við hann í 27 römmum (einn á sekúndu) í þrettán breiddum frá 360 til 1920 px: stór fyrirsögn nær 3:1 og annar texti 4,5:1 í hverjum ramma.
- Bannerasafnið á hverri útgáfu: hver banner sést í hausnum á tölvu og síma, myndskeiðið er ekki sótt þegar bannerinn er kyrrmynd, safnið (`?bannerar`) skiptir um banner og um útgáfu, afritar hlekkinn og lokast, og engin lárétt skrun verður niður í 320 px.
- Textinn yfir hverri kyrrmynd safnsins (sex myndir), mældur á móti myndinni á bak við hann í þrettán breiddum frá 360 til 1920 px á hverri útgáfu: stór fyrirsögn nær 3:1 og annar texti 4,5:1.
- Ritillinn á hverri útgáfu, keyrður í vafra á móti eftirlíkingu af þjóninum (raunverulega fallið á töflu í minni, svo ekkert er skrifað í lifandi gögn; innskráningin er raunverulega fallið `hub-adgangar` á notendaskrá í minni), 126 atriði: prufuhamur vistar ekkert; innskráning með notandanafni og lykilorði, notandi án Admin-hlutverks fær ekki að breyta, innskráning sem rennur út; texti, snið á reit og á völdum orðum, litaval og afturköllun; lógó og banner (upphleðsla, hæð, staðsetning, aðdráttur); birting og það sem gestur sér á öðru tæki; tvö tæki samtímis; útgáfusaga; breytingar sem texti; sími og símarammi á tölvu; fjandsamlegt efni er hreinsað og keyrir ekki, og ritillinn segir hvaða gildum hann sleppti; gölluð gildi stöðva ekki annað efni; nýbirt útgáfa víkur ekki fyrir eldra svari af jaðrinum.
- Útlitsstillingar ritilsins, í sama umhverfi (144 atriði á V2, 120 á V1, 119 á V3): hamirnir tveir; kafli fær bakgrunn og lit texta, og ritillinn varar við texta sem sést illa; fela og sýna aftur; færa kafla; slóð hnapps; birting og það sem gestur sér; bil, breidd, horn, rammi, skuggi og dálkar á svæði og texta; á síma gilda fela og bil aðeins þar; litir og letur síðunnar (tónar fylgja grunnlit, viðvörun og lagfæring textalita, horn, breidd) á V2; leiðin fyrir Claude (leiðbeiningarnar, svar sameinað við drögin, litur sem `red` eða `"12px"` lagað, ógild gildi, óþekktir reitir og lyklar sem eru ekki til nefnd, nýjar slóðir út af vefnum lesnar af síðunni og nefndar); fjandsamleg gildi gera ekkert: merki í tölureit keyra ekki í spjöldum ritilsins, ekkert nær á sameiginlegar frumgerðir og ekkert inn í verslunina.
- Innskráning starfsfólks á síðunni, í sama umhverfi (36 atriði á hverri útgáfu): hlekkurinn „Innranet“ í fætinum í þrettán breiddum frá 320 til 1920 px; innskráningarskjárinn í premium útliti (myndin á bak við, merkið, kort, tákn í reitum, sýna og fela lykilorð, Tab helst á skjánum, síðan undir skrunar ekki, á hægri tengingu sést ekkert af skjánum fyrr en útlit hans er komið; texti á kortinu nær 4,5:1 og hvítur texti á appelsínugula hnappinum 3:1); innskráning og rangt lykilorð; valmyndin fyrir Admin og fyrir annan starfsmann; útskráning; `?innranet` í slóðinni; sími niður í 320 px; og skriftur síðunnar nefna engin innri kerfi, þær leiðir koma frá þjóninum eftir innskráningu.
- Afhending í versluninni, á hverri útgáfu í tölvu og síma (111 atriði), og í verslun Slökkvitækja-appsins sem hún er tekin úr (37 atriði): aðeins er sótt, tíminn er 9 til 17, ekkert val um heimsendingu og enginn texti um hana eftir, ábendingin opnar póst til verslunarinnar og hlekkur hennar fer aldrei út fyrir lén félagsins, hvað sem stendur í textanum (átta tilvik), litaskil hennar ná 4,5:1 og ekkert rennur út af skjá.
- Lifandi vörur verslunarinnar, í sama umhverfi (84 atriði á hverri útgáfu; raunverulega fallið `vefur-vorur` á eftirlíkingu af vöruskránni): verslunin teiknar sig úr afritinu og tekur svo við lifandi vörum, og sé ekkert breytt er ekkert teiknað aftur; nýtt verð, heiti, lager og mynd, ný vara á sínum stað, vara sem hverfur eða er falin (líka úr körfunni), og vörukynningin á forsíðunni fylgir; vara með 45 stafa orð eða símanúmer í heiti sést ekki; lýsingar koma úr yfirfarna afritinu, aldrei úr vöruskránni, og ný vara sýnir enga lýsingu; merki og skriftur í heiti birtast sem texti og keyra ekki; nýtt verð færir ekkert til á skjánum; ekki er teiknað undir þeim sem skrifar í reit, heldur músarhnappi niðri, skrunar eða fer um með lyklaborði, fókusinn fylgir vörunni þegar röðin breytist, og það sem stóð í reitum körfunnar helst; tólf tegundir bilana (fallið ekki til, villa, rangt snið, gallaðar vörur) láta afritið standa; eintakið í vafranum er aðeins notað sé það nýrra en afritið, yngra en vika, ekki dagsett fram í tímann og með myndir þaðan sem fallið leyfir; gamalt svar úr skyndiminni leiðir til einnar spurningar í viðbót; ekkert er sótt þar sem fallið er ekki til (tillögurnar í Claude, síða af diski); vefurinn á eigin léni les fallið á hinu; sími.
- Tákn fyrir heimaskjá (26 atriði): Chrome les manifest aðalsíðunnar án villna, nafnið undir tákninu er Brunahólf, flýtileiðin opnar aðalsíðuna í vafranum, táknin eru af réttri stærð með logann í miðjunni (á Android-tákninu innan öryggishringsins), hliðarsíðurnar nefna táknið en ekkert manifest, svo flýtileið af þeim opnar þá síðu, og táknið í flipa vafrans er óbreytt.
- Fallið `vefur-efni` eitt og sér, 115 atriði: án innskráningar svarar það aðeins lestri á birtu efni; fölsuð, útrunnin og breytt cookie fá 401, eins óvirkur notandi og innskráning frá því fyrir lykilorðaskipti; notandi sem er ekki Admin fær 403; skrif án haussins `x-ritill` eða frá annarri síðu fá 403; vistun á úreltum grunni fær 409; birting skrifar söguna fyrst; villa frá gagnagrunni er ekki geymd á jaðrinum; texti, stillingar, svæði, röð, þematákn og slóðir hlekkja eru hreinsuð fyrir vistun; leiðir starfsfólks í innri kerfin eru aðeins afhentar innskráðum.
- Fallið `vefur-vorur` eitt og sér, 200 atriði: engar lýsingar í svarinu; hvítlisti reita og gerða; heiti og flokkur með síma, netfangi, slóð, löngu númeri eða 41 stafa orði falla út, og ósýnilegir stafir eru teknir úr þeim; myndaslóðir aðeins úr vöruskránni og myndageymslu vefverslunarinnar; aðeins GET án fyrirspurnarstrengs og undirslóðar; enginn lykill og engin cookie; svarið geymt á CDN, og bilun í vöruskránni er ekki geymd; síðasta góða svar dugar í sex klukkutíma. Regla afritsins: 18 tegundir minnispunkta (birgir, kostnaður, heildsala, pantanir, reikningar, upphæðir, sími, netfang, slóð) komast ekki í lýsingu, staðlanúmer eins og EN 14604 standa, og allar 42 lýsingar vöruskrárinnar komast í gegn.
- Sérstök yfirferð á hreinsuninni: 1.044 handskrifuð og 40.000 slembin fjandsamleg inntök í vafra og 31.044 gegnum hreinsun fallsins. Enginn kóði keyrði og ekkert efni frá öðru léni komst á síðuna.
- Töflurnar `vefur_efni` og `vefur_efni_saga` í lifandi gagnagrunni: með opinbera lyklinum skila lestur og skrif 401 (42501).
