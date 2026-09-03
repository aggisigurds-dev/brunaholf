# Boss-þemað — hönnunarkerfið (vistað 2026-09-03)

Þetta er **sannleikurinn** um útlitið sem Agnar valdi fyrir brunaholf.netlify.app
(og vill síðar nota á Þjónustuborð í slokkvitaeki.netlify.app): svart stál ·
rjómapappír · gullmálmur. Hannað í Claude Design (verkefnið „Slokkvitaeki mobile
app design", id `21f22ed6-aa1a-445a-9938-86de5ea89775`) og flutt hingað í heilu
lagi svo enginn þurfi að ná í það aftur.

Útfærslan sem síðurnar hlaða er **`css/theme.css`** (v2). Þetta möppusafn er
uppruninn; theme.css er afleiða.

## Hvað er hér

| Skrá / mappa | Hvað það er |
| --- | --- |
| `readme.md` | Kerfið í orðum — efnin þrjú, gull-uppskriftirnar fjórar, dýptarhlutirnir, radíus, motion. **Lestu þetta fyrst.** |
| `DESIGN.md` | Sama kerfi í níu-kafla `DESIGN.md`-sniði fyrir kóðandi agenta (litir, týpa, bil, uppskriftir orðrétt). |
| `tokens/colors.css` | Stál-stiginn, pappír, texti, staða — `--boss-*` breytur. |
| `tokens/gold.css` | Gull-rampurinn (100→950) og uppskriftirnar `--gold-line` / `--gold-face` / `--gold-side` / `--gold-coin` / `--gold-band` / `--gold-text` + bevel-skuggar. **Aldrei semja nýjan gull-gradient — nota einn þessara.** |
| `tokens/elevation.css` | Einn skuggi per hlut: panel · strip · ivory key · well · obsidian key · slab · dark well · header · sidebar. |
| `tokens/typography.css` | Playfair Display 700/800 (titlar, KPI-tölur) · IBM Plex Mono 500/600 (merki, tölur, klukka) · kerfis-sans (meginmál) + stærðarstigi. |
| `tokens/spacing.css` | Bil, radíus (2/4/5/14px), fastar hæðir (header 78, sidebar 196, takki 36/30/42). |
| `components.css` | `.boss-*` klasar (header, sidebar, panel, plate, kpi, slab, btn ivory/obsidian/gold, field, chip, LED, pin). |
| `components/*.card.html` | Sýnishorn: takkar, rammar. |
| `guidelines/*.card.html` | Sýnishorn: efni, gull-rampur, gull-uppskriftir, dýptarhlutir, týpa. |
| `pages/krofu-yfirlit-boss.html` | Kröfu yfirlit — fullhönnuð síða (haus, sync-lyklar, KPI×4, tólastika, fyrirtækja-panel með raðir og vinnuflæðis-lykla). |
| `pages/fjarmala-yfirlit-boss.html` | Fjármála-yfirlit — dökk „00 Heildar-pípa" slab með gulltölu, númeraðir kaflar, spjöld. |
| `pages/vinnubok-boss.html` | Vinnubók — verkstaðir × mánuðir tafla í panel, KPI×4, athugasemdir, „valinn reitur" dökk slab. |
| `pages/thjonustubord-boss-v4.html` | **Þjónustuborð boss v4** — viðmiðunarskjárinn sem allt kerfið er mælt úr. Fyrir slokkvitaeki (sjá joker.md þar). |
| `pages/thjonustubord-boss-v4.dc.html` | Sama skrá ÓBREYTT úr Claude Design (með keyrslu-skriftu) — má flytja aftur inn í Claude Design. |
| `pages/support.js` | Keyrslutími `.dc.html` skránna (dc-runtime). Þarf aðeins ef síðurnar eru opnaðar beint. |
| `slokkvitaeki-root-readme.md` / `-DESIGN.md` | Rótarkerfið (flata Slökkvitæki-kerfið) sem Boss er skinn ofan á: efnisreglur, stöðuskali, birtuskila-gólf, gagnalag. |

## Hvernig síðurnar eru lesnar

`pages/*.html` eru `.dc.html` (Claude Design) skjöl með `sc-for`/`sc-if` sniðmátum
og `<script type="text/x-dc">` gagnaskriftu neðst. **Allir stílar eru inline** —
það er ætlunin: hvert gildi (gradient, skuggi, bil) er hægt að afrita orðrétt.
Til að sjá síðu rennda: opna í vafra með `support.js` í sömu möppu, eða skoða
skjámyndirnar sem Agnar sendi (Kröfu yfirlit 2026-09-03).

## Þrjú atriði sem gera síðu að „Boss"

1. Svartur stál-haus með **4px gullbandi** neðst, medalíu og gull-wordmark.
2. **Plata** (`01`, `CG-01`) á hverjum panel-titli og **gull-hárlína** undir strip-haus.
3. **Nákvæmlega einn gull-takki** á panel; allt annað fílabein (hljóðlátt) eða obsidian (aðal).

Gull er skraut — aldrei upplýsingar. Staða les úr eigin lit (grænt / terra /
gull-blek) og tölu. Ekkert undir `#6f685c` (5.3:1) ber gögn.

## Að nota þetta á aðra síðu / annað app

1. Afrita `tokens/*.css` + `components.css` (eða `css/theme.css` úr brunaholf) inn.
2. Hlaða Playfair Display 700/800 + IBM Plex Mono 500/600 (Google Fonts).
3. Byggja með `.boss-*` klösunum og speglaðu næstu `pages/*`-fyrirmynd.
4. Halda gögnum og hegðun óbreyttri — þetta er **skinn**, ekki ný upplýsingahönnun.

Sjá `.claude/agents/joker.md` (kaflinn „Boss-þemað") fyrir vinnulag.
