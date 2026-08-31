# Agentaskrá

Kanónísk skrá yfir sérfræðinga og skills sem liggja **á diski í git**. Byggð 31.08.2026 af skrám í `slokkvitaeki`, `brunaholf` og `kjarni`. Claude-artifactið „Agentaskráin" var **ekki** synchað: lota opnaði parent-möppu og hlóð **0 af 23** agentum.

**Regla:** ein staðreynd, einn staður. Heimaskráin er í dálkinum Heim. Kjarni á afrit, ekki frumrit. **Engin fjórða kópia** í parent `.claude/agents` (sú mappa er ekki til og á ekki að verða til).

Opnaðu **repo-rótina** (`slokkvitaeki` eða `brunaholf`), ekki parent-möppuna. Annars finnur Claude engar agent-skrár.

Kveikjuorðin í stuttu máli: [`docs/TRIGGERS.md`](TRIGGERS.md). Þetta skjal er nafn, heim, slóð, kveikjur og aldrei-gera.

Teljarinn **153/187** (tilbúið-staða) er **óbreyttur**. Hann er ekki hluti af þessari skrá.

---

## Hvað var úr takti

| Uppspretta | Staða á diski | Vandinn |
|---|---|---|
| Claude-artifact „Agentaskráin" | 0/23 hlaðnir | Cwd var parent-mappa. Artifactið er ekki git. |
| `docs/AGENTASKRA.md` | vantaði | Engin git-heimild fyrir áhöfnina. |
| `docs/TRIGGERS.md` | á diski, **ekki** í `master` | Villuleit-skill vísar hingað; taflan var ócommituð. |
| Jarvis-roster (`brunaholf/jarvis.html` áhöfnin) | 16 HUD-sæti + disk-listi | Uppfært 31.08.2026: HUD sýnir 16 raddir; þar undir 6 agentar án HUD + `villuleit` (hindra klúður). Svið/raddir/KPI-reikningur óbreytt. |
| `kjarni/.claude/agents` | 20 afrit | Afrit (dagsett 20.08.2026), **ekki** heim. Vantar `natalie`, `netvordur`, `elon-musk`. |
| `kjarni/.agents/skills` | 5 **raunveruleg** skills | Ekki stubbar. Platform-tól (schema, shadcn, pgTap, cache). |
| Parent `.claude/agents` | ekki til | Rétt. Ekki búa til. |
| Skill `hindra-kludur` / „hindra klúður" | **ekki á diski** | Leitað í öllum þremur repo. Næsta vörn: `villuleit` + `variant-analysis` + `netvordur`. |

**23 einstök agent-nöfn** á diski (13 í brunaholf + 12 í slokkvitaeki; `joker` og `kunnaskra` eru í báðum sem sitthvor heimaskrá).

---

## 23 agentar

`Heim` = kanóníska skráin. `kj` = afrit í `kjarni/.claude/agents` (stale vs heim). Dual-home: `joker` og `kunnaskra` eiga raunverulega skrá í **báðum** rekstrar-repo (hub vs app).

| Nafn | Roster | Heim | Slóð | Kveikjur | Aldrei |
|---|---|---|---|---|---|
| `jarvis` | 🎩 Jarvis | brunaholf | `.claude/agents/jarvis.md` (kj afrit) | `hver er staðan` · `morgunyfirferð` · `Jarvis` | Fundin upp tala/dagsetning/nafn. Lestu ekki heilar töflur. |
| `bokari` | 💰 Samantha | brunaholf | `.claude/agents/bokari.md` (kj afrit) | `taxti` · `VSK` · `NLSH` · `uppgjör` · `stemmir tala` · `krafa` (með sala) | Baka afslátt í línu **og** geyma í `afslattur`. Stofna eða senda reikning. |
| `sara-organizer` | 🗂️ Sara (pör) | brunaholf | `.claude/agents/sara-organizer.md` (kj afrit) | `para` · `þekja` · `gloppa` · `vantar að rukka` | Giska á pörun. Stofna/breyta reikningi. Senda póst. Sameina rekstrarfélaga-staði. |
| `sara-coworker` | 🗂️ Sara (skýrslur) | slokkvitaeki | `.claude/agents/sara-coworker.md` (kj afrit, styttra) | `skýrsla` · `úttekt` · `fylla skýrslu` | Yfirskrifa texta sem er þegar í reit. Baka afslátt **og** `afslattur`. Segja „vistað" án lesturs til baka. Hengja brunakerfi á úttekt. Sameina staði. |
| `kunnaskra` | ❄️ Charlize | **bæði** | bh `.claude/agents/kunnaskra.md` (hryggurinn) · slokk sama nafn (app-hlið) · kj = bh-afrit | `kennitala` · `kt` · `999999` · `customers_base` · `rekstrarfélag` · `sameina` · `tvítak` · `Tengireglan` · `hits[0]` · `companyForBld` | Sameina staði rekstrarfélags. Giska / núlla `fyrirtaeki_id`. Eyða/skrifa yfir kúnnaröð án Agnars. Rugla `fyrirtaeki_id` við kennitölu. |
| `skjol` | 🎙️ Freeman | brunaholf | `.claude/agents/skjol.md` (kj afrit) | `Drive` · `PDF` · `endurnefna` · `skjal` | Eyða Drive-skrá (`files.delete`). Treysta skráarheiti. Giska á fyrirtæki. |
| `gagnaleidslur` | 🥊 Statham | brunaholf | `.claude/agents/gagnaleidslur.md` (kj afrit, styttra) | `Tímavera` · `Ajour` · `Redder` · `innsog` | Merkja rautt af hráu „cancel". Giska rekstrarfélags-systur. |
| `hradi` | 💥 Willis | brunaholf | `.claude/agents/hradi.md` (kj afrit) | `hraði` · `hægt` · `polling` · `bundle` | Fullyrða um bata án mælingar fyrir og eftir. Hamra á DB á meðan mælt er. |
| `tengingar` | 😤 Samuel L. J. | brunaholf | `.claude/agents/tengingar.md` (kj afrit) | `lykill` · `tengingar` · `gult` · `rautt` | Falskt grænt. Skila lyklum. Setja lykil í kóða eða skjal. |
| `kerfisheilsa` | 🩺 Dr. House | brunaholf | `.claude/agents/kerfisheilsa.md` (kj afrit) | `bilað` · `niðri` · `timeout` · `eitthvað skrítið` | Úrskurða af status-síðu. Afturkalla deploy til að „prófa". |
| `hype` | 🇺🇸 Trump | brunaholf | `.claude/agents/hype.md` (kj afrit) | `hype` · `hvernig gengur` | Finna upp tölur. |
| `oryggi` | 💪 Arnold (RLS-rödd) | brunaholf | `.claude/agents/oryggi.md` (kj afrit) | `RLS` · `policy` · `lekt` · `anon` · `bucket` | Enable RLS án policy. Lyklar í frontend/repo. |
| `framendi` | *(ekkert sæti)* | brunaholf | `.claude/agents/framendi.md` (kj afrit) | hub-flipi, hvar eitthvað í `index.html` býr | Lesta `index.html` í heilu lagi. |
| `joker` | 🃏 Joker | **bæði** | slokk `.claude/agents/joker.md` (app) · bh sama nafn (hub) · kj = **bh**-afrit (app-útgáfan er lengri) | `útlit` · `sími` · `mobile` · `þröngt` · `endurhanna` | Giska á útlit án skjás. `node deploy.js`. Harður stoppari á Vista. Fara framhjá Stílstjóra. |
| `natalie` | 🌸 Natalie | slokkvitaeki | `.claude/agents/natalie.md` (**ekki** í kjarni) | `stemmir þetta` · `er þetta rétt` · `factcheck` · `farðu yfir árið` · `hvað er satt hérna` | Leiðrétta gögn. Skrifa í `solur` / `uttaeki` / `customer_documents`. „Nokkur tilvik" án töflu. |
| `netvordur` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/netvordur.md` (**ekki** í kjarni) | `öryggisnet` · `er óhætt` · `brýtur þetta` · `audit-all` | Breyta kóða (úrskurðar SAFE / CUTS-A-WIRE). Persónu-kt í log. |
| `elon-musk` | ⚡ Elon Musk | slokkvitaeki | `.claude/agents/elon-musk.md` + skill sama nafn (**ekki** í kjarni) | `árs` · `ársreitur` · `pera` · `FULLBÚIÐ` · `VANTAR` · `SOURCE` · `FILTER` | Endurstíla `._yr`. Sameina hótel á kt. `hits[0]`. `node deploy.js`. Vista allan Ársskoðun-blob. |
| `prentun` | 🏷️ DeVito | slokkvitaeki | `.claude/agents/prentun.md` (kj afrit) | `prentun` · `QR` · `miði` · `Brother` · `raðnúmer` | Gamla QR-fallback (falskur QR). Geyma QR í dálk. |
| `kort` | 🗺️ Ramsay | slokkvitaeki | `.claude/agents/kort.md` (kj afrit) | `kort` · `pinnar` · `geocode` · `Leaflet` · `kill-dots` | Vektor-merki (á að vera `L.divIcon`). Rugla við `bord-flettur` (síðurnar). |
| `sala-reikningar` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/sala-reikningar.md` (kj afrit) | `reikningur` · `sala` · `POS` · `Payday` · `dkPlus` · `afsláttur` · `krafa` | Afsláttur á tvo vegu. Blokka Vista. Yfirskrifa úttektartexta. Leiða vottun af tækjalista. |
| `thema` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/thema.md` (kj afrit) | `þema` · `skinna` · `Brunastál` · `theme.css` | Endurvekja þemaskipti (frosið 17.08.2026) án Agnars. |
| `bord-flettur` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/bord-flettur.md` (kj afrit, styttra) | `flipi` · `borð` · `nav` · `bílstjóri` · `aksturslisti` · `bakk` | Blanda bakk-lögum (18/276/277). Nota `history.length` fyrir bakk. |
| `adstod` | *(ekkert sæti)* | slokkvitaeki | `.claude/agents/adstod.md` (kj afrit) | `watchlist` · `banner` · `aðstoð` | (Fasi 2 AI-tips er óunninn; ekki lofa honum.) |

---

## Skills sem hindra klúður

`hindra-kludur` / „hindra klúður" er **ekki** skill-mappa á diski. Það sem *er* til og gegnir því hlutverki:

| Nafn | Tegund | Heim | Slóð | Kveikjur | Aldrei |
|---|---|---|---|---|---|
| `villuleit` | skill | slokkvitaeki | `.claude/skills/villuleit/SKILL.md` | `villuleit` · `variant` · `variant-alert` · `sama mynstur` · `er þetta víðar` · `afrit` · `systkini` · `fölsk staðreynd` · `röng join` | Nýtt app / nýr flipi / ný tafla. Laga fyrsta hitt. |
| `variant-analysis` | skill | slokkvitaeki | `.claude/skills/variant-analysis/SKILL.md` | `er þetta víðar` · `laga þetta alls staðar` · eftir að villa finnst | Segja „lagað" án RÓT/LEITAÐ/FUNDIÐ/LAGAÐ/EFTIR/SANNAÐ. |
| `netvordur` | agent | slokkvitaeki | `.claude/agents/netvordur.md` | sjá að ofan | Sjá að ofan. |
| `uttekt-audit` | skill | slokkvitaeki | `.claude/skills/uttekt-audit/SKILL.md` | `audit` · `samræmi` · `stemmir` · `passar magnið` | Skrifa (lesaðeins). |
| `charlize` | skill | slokkvitaeki | `.claude/skills/charlize/SKILL.md` | `muna` · `skrá` · `Charlize` · `hvernig var þetta` | Spyrja Agnar að því sem Charlize veit nú þegar. |
| `arnold` | skill | slokkvitaeki | `.claude/skills/arnold/SKILL.md` | `staðsetning` · `slökkvigildi` · `flóttaleið` · `byggingarreglugerð` | Rugla við agent `oryggi` (RLS). Roster-Arnold er **bæði**: þetta skill + `oryggi`-rödd. |
| `elon-musk` | skill | slokkvitaeki | `.claude/skills/elon-musk/SKILL.md` | sama og agentinn | Sjá `elon-musk` að ofan. |
| `deploy` | skill | slokk + bh | `.claude/skills/deploy/SKILL.md` | `deploy` · `ýta` · `deploy.js` | `node deploy.js`. |

---

## Jarvis-roster (brunaholf)

Áhöfnin á `jarvis.html` er **tveir opnir hópar** (16 raddir + 6 lén). Villuleit er alvöru HUD-sæti (`data-spjald="villuleit"`) með grep-kveikjum — skill, ekki rödd.

Sæti: Jarvis · Samantha · Sara · Charlize · Freeman · Statham · Willis · Samuel L. J. · Dr. House · Trump · Arnold · DeVito · Ramsay · Elon Musk · Natalie · Joker.

Veiði-kort koma úr `/api/veidin` + `v_veidin_hunt_*`. Grunnlínan **2026-07-30** er **staða um mánuði síðan**. Hunt-kort (systkini-kt, blob-græn, HUD Búið vs skýrsla, Drive-tvítök) eiga enga grunnlínu. `153/187` er óbreytt.

Aðrar Jarvis-tölur sem `jarvis.md` telur ósamræmdar (ekki lagaðar hér): `js/jarvis-voice.js` AGENTS = 15 raddir; `svid-status.js` SVID = 12 svið. Roster er útlit, ekki loader.

---

## Kjarni: afrit vs raunveruleg skills

`.claude/agents/` í kjarna er **samsteypa afrita** (CLAUDE.md: „Afrit, ekki frumrit", afritað 20.08.2026). Breytingar fara fyrst í Heim-dálkinn hér að ofan.

Afritin eru **ekki stubbar** (fullar skrár) en þau eru **stale**: stærðarmunur vs heim, og þrjú nýrri agentar vantar (`natalie`, `netvordur`, `elon-musk`). Ekki lagað hér; kjarni er ekki git-heimildin.

`.agents/skills/` í kjarna eru **raunveruleg** platform-skills (ekki stubbar, ekki afrit af slokk/bh):

| Skill | Slóð | Notað þegar |
|---|---|---|
| `supabase-schema-migrations` | `kjarni/.agents/skills/supabase-schema-migrations/SKILL.md` | Schema / RLS / migrations. Aldrei handskrifa migration. |
| `shadcn-expert` | `kjarni/.agents/skills/shadcn-expert/SKILL.md` | shadcn/ui í Next.js. |
| `pgtap-test-generator` | `kjarni/.agents/skills/pgtap-test-generator/SKILL.md` | pgTap / RLS-próf. |
| `nextjs-cache-components` | `kjarni/.agents/skills/nextjs-cache-components/SKILL.md` | Next.js 16 `use cache` / PPR. |
| `component-to-shadcn-component-converter` | `kjarni/.agents/skills/component-to-shadcn-component-converter/SKILL.md` | Flytja UI yfir í shadcn. |

Kjarni á líka `.claude/skills/` (viðskipta-afrit + hönnun). Þau eru ekki heim.

---

## Repo-vísun

| Lén | Repo |
|---|---|
| App, POS, Ársskoðun, Bílstjóri, QR, kort | `slokkvitaeki` |
| Hub, customer.html, Drive-tól, Jarvis-síða, RLS | `brunaholf` |
| Ný Next.js / schema / shadcn | `kjarni` |

Bæði slökkvitæki og brunahólf lesa sama Supabase `osfdzskyvisifcwyjkuk`.

**Hvernig Agnar sendir:** opna rétt repo, líma eina línu úr [`TRIGGERS.md`](TRIGGERS.md), t.d. `villuleit: sama mynstur og Plaza`.

## Tengt

- Kveikjur: [`docs/TRIGGERS.md`](TRIGGERS.md)
- Charlize-vísun (eldri listi, 12 slokk-agentar): `.claude/skills/charlize/references/agentar.md`
- Öryggisnet: [`docs/ORYGGISNET.md`](ORYGGISNET.md)
- As-built: [`docs/RAFKERFI.md`](RAFKERFI.md)
