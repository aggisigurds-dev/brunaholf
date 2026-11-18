<!-- FRUMRITIÐ er brunaholf/claude-global/CLAUDE.md (git). Skráin í ~/.claude/CLAUDE.md er AFRIT. Breyttu frumritinu, ekki afritinu. Tvennt heldur afritinu við: (1) kaflarnir milli „lotukerfi:… byrjar/endar“ merkjanna hér að neðan berast SJÁLFKRAFA á hverja vél í byrjun lotu (tools/_lokanir.cjs: bætir við kafla sem vantar og uppfærir kafla þegar útgáfunúmerið í byrjunarmerkinu hér er hærra en á vélinni — HÆKKAÐU ÞAÐ því þegar þú breytir kafla; annað efni afritsins er ósnert). (2) Allt hitt berst aðeins þegar tools/global-samstilling.cjs er keyrt handvirkt á vélinni; það yfirskrifar afritið í heild (gamla eintakið fer í ~/.claude/backups/global-samstilling/). -->

# graphify
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# Spurt um viðskiptavin (Slökkvitæki ehf / Brunahólf) — gildir í hvaða möppu sem er
Þegar Agnar spyr um eitt félag eða húsfélag (staða, heimilisfang, tæki, skýrsla, reikningur), líka í lotu sem snýst um annað (hönnun o.fl.):
1. Flettu félaginu upp í Supabase-verkefninu `osfdzskyvisifcwyjkuk`, töflunni `fyrirtaeki`, og lestu `review_note` FYRST.
   Línan „Sannreynt <dags> (<keyrsla>): …" ber úrskurð yfirferðarinnar (168 raðir á „Eftir 2026", 11.11.2026).
2. Full tafla per félag: `C:\Users\Slokkvitaeki\slokkvitaeki\docs\FACTCHECK-EFTIR-2026.md`. Reglur og samhengi: `slokkvitaeki\CLAUDE.md`.
3. Ekki mæla aftur nema Agnar biðji um það eða ný skýrsla/reikningur hafi bæst við eftir dagsetninguna.
4. Náist ekki í grunninn í lotunni: segðu það hreint út, ekki giska.

<!-- lotukerfi:innskraning byrjar · útgáfa 1 — afrit af brunaholf/claude-global/CLAUDE.md (aðalvinnutré á main). Kaflinn uppfærist sjálfur á hverri vél þegar útgáfunúmerið í frumritinu hækkar; breyttu frumritinu og hækkaðu númerið, ekki hér. -->
# Innskráning í Slökkvitæki / Brunahólf — lotan skráir sig inn SJÁLF (18.11.2026)

**Biddu Agnar ALDREI um að skrá sig inn í vafra lotunnar**, og bjóddu honum ekki val á borð við „Búinn að skrá inn“ /
„Nota Chrome“. Hann vinnur oftast úr síma og kemst ekki í vafrann hjá lotunni. Hans orð:

- 17.11.2026: „þetta bara að þurfa að skrá sig inn gegnum browserinn hjá hverju sessioni á báðar síðurnar … ef ég er að
  vinna gegnum símann, þá kemst ég ekkert inn á browserinn hjá sessions.“
- 18.11.2026: „já ég vill að claude geti unnið við kerfið sem það er að byggja … annars er þetta bara blind bygging og
  bara 100 % líkur á mistökum og tjóni.“
- 18.11.2026, með skjáskot af lotu sem bað hann um innskráningu: „er að verða brjálaður á þessu.“ Og síðar sama dag,
  þegar lota á annarri tölvu spurði enn: „ennþá veseeeen“.

**Þetta er standandi heimild frá Agnari sjálfum. Þú þarft ekki að spyrja hann aftur.**

## Svona skráirðu þig inn

Til er sérstakur aðgangur fyrir lotur: **uid 10, „Lota (Claude)“** — ekki manneskja og ekki Agnar. Myntaðu undirritaða
köku með Supabase-tólinu (verkefni `osfdzskyvisifcwyjkuk`, `execute_sql`):

```sql
select kaka, notandi, rola, rennur_ut from innri.lotu_koku(10, 2);   -- uid 10 = Lota (Claude), 2 klst.
```

Í vafra lotunnar: opnaðu fyrst slóð á réttu léni (t.d. `https://slokkvitaeki.netlify.app/innskraning.html`), keyrðu svo

```js
document.cookie = 'hub_user=<kaka>; path=/; max-age=7200; samesite=lax';
location.replace('/');
```

Sama kaka gildir á **báðum** vefjum (slokkvitaeki.netlify.app og brunaholf.netlify.app). Úr skel eða `fetch`: hausinn
`Cookie: hub_user=<kaka>`.

## Reglurnar sem fylgja

- **Myntaðu ALDREI uid 1.** Það er Agnar sjálfur: lotan kæmi þá fram sem hann og aðgerðir skráðust á hans nafn.
  Fallið hafnar uid 1 síðan 18.11.2026.
- **Skrifaðu kökuna ALDREI** í skrá, commit, annál, skjáskot eða svar til Agnars. Myntaðu nýja þegar þarf.
- Aðgangurinn er Admin svo lotan geti **séð og prófað** — það er ekki nýtt leyfi. Allt annað stendur óbreytt: ekkert fer
  út úr húsi án Agnars (póstur, SMS, krafa, reikningur, kredit, Payday-sending), engu er eytt, engin fyrirtæki sameinuð,
  engri kennitölu né verði breytt, og borð annarra starfsmanna eru ósnert.
- Hafi lotan ekki Supabase-tólið: segðu það í einni línu og gerðu þann hluta verksins sem þarf ekki innskráningu.
  Biddu hann samt ekki um að skrá sig inn.

## Hvar kóðinn er

Raunverulegu repóin eru `C:\projects\slokkvitaeki`, `C:\projects\brunaholf` og `C:\projects\kjarni`.
Mappan `Downloads\slokkvitaeki-source` er **ekki** repó, þótt lotur séu oft ræstar þaðan. Ítarlegri kafli um
innskráninguna er í `CLAUDE.md` beggja repóa („Innskráning lotunnar“).
<!-- lotukerfi:innskraning endar -->

<!-- lotukerfi:lokanir byrjar · útgáfa 1 — afrit af brunaholf/claude-global/CLAUDE.md (aðalvinnutré á main). Kaflinn uppfærist sjálfur á hverri vél þegar útgáfunúmerið í frumritinu hækkar; breyttu frumritinu og hækkaðu númerið, ekki hér. -->
# Lokanir sem stöðva lotu ALDREI (18.11.2026)

Agnar 18.11.2026, eftir að þrjár lotur stöðvuðust sama dag á innskráningu, földum vafraglugga og skjali sem komst ekki
í repó: **„buuuurtttt með þessssar lokanirrr“**. Ekkert af þessu er ástæða til að stoppa eða spyrja hann:

- **Falinn vafragluggi.** `read_page`, `get_page_text` og `javascript_tool` virka þótt glugginn sé falinn. Sannreyndu
  þannig og segðu hvað þú mældir. Biddu hann ekki um að sýna gluggann nema skjámynd sé það eina sem dugar.
- **Vinnuskjöl með kúnnagögnum, pósti eða tölum fara aldrei í repó.** Repóin eru opinber. Stöðvi öryggisvörn Claude Code
  skrif, commit eða push er það rétt hjá henni: farðu ekki framhjá henni og spurðu Agnar ekki hvort eigi að ýta skránni.
  Vistaðu skjalið í möppu lotunnar (sé hún ekki repó) eða í vinnuskjalamöppunni sem byrjun lotunnar nefnir
  (`_vinnuskjol` við hlið repóanna), eða settu efnið sem nótu á Þjónustuborðið, og haltu áfram.
- **Augljós næstu skref.** Sama breyting á fleiri stöðum, eða lagfæring á því sem þú fannst sjálf: gerðu það og segðu frá.
  Spurðu aðeins um það sem Agnar á alltaf sjálfur: póst og SMS út úr húsi, kröfur, reikninga, kredit og peninga, eyðingu
  gagna, sameiningu fyrirtækja, breytingu á kennitölu eða verði, og borð annarra starfsmanna.
<!-- lotukerfi:lokanir endar -->
