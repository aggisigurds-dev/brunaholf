# DESIGN.md — Slökkvitæki ehf. / Brunahólf

Innra vinnutól fyrir slökkvitækjaþjónustu á Íslandi. Notendur eru fjórir til sex:
Agnar á skrifstofunni og bílstjórar sem lesa skjáinn í bíl, í kjallara og úti í
dagsljósi. Skjárinn er tól, ekki vefsíða — hann á að sýna mikið í einu og þola
að vera lesinn með hanska á höndum.

Öll gildi hér eru mæld úr appinu sem er í loftinu (`slokkvitaeki.netlify.app`)
og úr ákvörðunum sem voru teknar í hönnunarlotu 29.08–02.09.2026.

---

## 1 · Visual Theme & Atmosphere

Verkfærakassi, ekki app. Þéttar raðir af raunverulegum gögnum á ljósum grunni,
með dökkri stálblári stiku sem greinir umgjörð frá innihaldi. Ekkert skraut sem
tekur pláss frá gögnum.

- **Þéttleiki er markmið, ekki hliðarverkun.** Agnar hefur sagt það skýrast:
  „vil alveg ná að sjá mjög mikið og alveg í lagi að scrolla til hliðar og niður."
  Þegar plássið þrýtur er svarið að skruna, aldrei að fella dálka út.
- **Eitt þungt stak á spjald/röð.** Fyrsta útgáfan af bílstjóraspjaldinu hafði
  sjö jafnþunga metal-hnappa og var hafnað. Ein fyllt aðgerð ræður, restin er
  hljóðlát.
- **Tóm staða er fullyrðing.** „enginn póstur bíður svars" er betra en tómur
  reitur. Tólf tómir reitir sem taka 40% af skjánum eru villa.
- **Aldur gagna er upplýsing.** Mál sem hefur beðið sex daga á að sjást sem
  litur, ekki sem lítill grár texti.

## 2 · Color Palette & Roles

```css
:root {
  /* Umgjörð */
  --sl-stika:        #1a1f2e;  /* toppstika, hliðarstika */
  --sl-stika-djup:   #16181c;  /* verkfærapanell, spjaldbotn */
  --sl-grunnur:      #f5f4ef;  /* síðugrunnur */
  --sl-flotur:       #ffffff;  /* spjöld, raðir, borð */
  --sl-rammi:        #e3e1dc;  /* hárlínurammi */
  --sl-skil:         #eeece7;  /* raðaskil */

  /* Auðkenni — EKKI aðgerð */
  --sl-brand:        #C93C1D;  /* Slökkvitæki-rautt: merki, „+ Nýtt mál" */

  /* Aðgerð — einn litur, öll snerting */
  --sl-adgerd:       #17324f;  /* fyllt aðgerð: Skoðað, Vista, Senda */
  --sl-adgerd-mjuk:  #5980a6;  /* kantar, sleðar, virkt val */
  --sl-adgerd-djup:  #2a4763;  /* smátexti í aðgerðarlit */
  --sl-adgerd-flotur:#eef4fb;  /* ljós blokk (t.d. „Í vinnslu") */
  --sl-adgerd-rammi: #cfdcea;

  /* Texti */
  --sl-texti:        #16181c;
  --sl-texti-mjukur: #5d5a54;  /* 6.9:1 — lægsta leyfilega fyrir gögn */
  --sl-texti-merki:  #6f6b63;  /* 4.6:1 — aðeins 10px upphástafamerki */

  /* Staða */
  --sl-skodad:       #2e6b4a;
  --sl-vinnslu:      #5980a6;
  --sl-a-eftir:      #c0392b;
  --sl-sleppt:       #c9a227;
  --sl-dagskra:      #ded9d2;
}
```

**Reglur um liti**

- `--sl-brand` er auðkenni. Það merkir Slökkvitæki, ekki „ýttu hér". Aðeins
  merkið og hnappurinn sem býr til nýtt mál á hverjum skjá.
- **Einn aðgerðarlitur á skjá.** Fyrir breytinguna 02.09 voru fjórir „aðal"
  hnappalitir á Þjónustuborðinu (rauður, blár, grænn, gulur) og enginn þeirra
  las sem aðalaðgerð. Nú er `--sl-adgerd` sá eini sem er fylltur.
- **Aldur er litur.** 0–1 dagur `--sl-texti-mjukur`, 2–4 dagar
  `--sl-adgerd-djup`, 5+ dagar `--sl-a-eftir`.
- **Aldrei litur á lit í smátexta.** `#5980a6` er 4.2:1 og fer ekki á texta
  undir 14px — notaðu `--sl-adgerd-djup` (8.8:1) í staðinn. Hrái tónninn er
  fyrir kanta og fleti.
- **Ekkert undir 4.5:1 á gögn.** `#8c8880` (3.5:1) og `#a8a49c` (2.5:1) voru
  notuð og hafa verið fjarlægð. Þetta er lesið í dagsljósi.

## 3 · Typography Rules

Kerfisletur — appið er tól og á að lesast eins og stýrikerfið sem það liggur í.

```css
--sl-letur:  system-ui, -apple-system, "Segoe UI", sans-serif;
--sl-tolur:  ui-monospace, Menlo, monospace;
```

| Notkun | Stærð / þyngd |
| --- | --- |
| Skjátitill | 25px / 600 |
| Spjaldheiti, fyrirtækjanafn | 16.5px / 600, `letter-spacing:-.015em` |
| Nafn í borðaröð | 15.5px / 600 |
| Gögn í röð, heimilisfang, nóta | 12.5–13px / 400 |
| Reitamerki (upphástafir) | 10px / 600, `letter-spacing:.06em` |
| Tölur, dagsetningar, kennitölur, verð | `--sl-tolur`, 11–13px / 600 |

- **Allar tölur í mono.** Dagsetningar, aldur (`6D`), verð, tækjafjöldi,
  kennitölur, klukka. Þær eiga að stafla lóðrétt milli raða.
- **Krónur með punkti:** `105.710 kr`, aldrei `105,710`. Notaðu `fmtKr` í
  `js/utils.js` — ekki `toLocaleString` beint.
- Ekkert undir 12.5px nema upphástafamerki.

## 4 · Component Stylings

**Spjald (bílstjóri)**

```
hvítur flötur · 1px rammi --sl-rammi · radíus 3px
skuggi 0 1px 1px rgba(20,20,18,.04)
vinstri kantur 3px í lit stöðunnar
padding 13px 14px · spjaldabil 12px
```
Aldrei fylltur litaflötur á spjaldið sjálft. Fyrsta útgáfan fyllti spjaldið
bláu og textinn varð ólæsilegur.

**Röð í borði**

```
hæð 52px · hausar 38px · skil 1px --sl-skil
nafndálkur 150px frosinn, box-shadow:3px 0 8px -6px rgba(0,0,0,.45)
```

**Hnappar**

| Tegund | Útlit |
| --- | --- |
| Fyllt aðgerð | `--sl-adgerd` bakgrunnur, `#f2f5f8` texti, 40px, radíus 2px |
| Hljóðlát | hvítur, 1px `--sl-rammi`, `--sl-texti` — 38px |
| Táknhnappur | 38×38px, hárlínurammi, hvítur (Hringja, Leiðsögn) |
| Segment (akstur 1/2/3) | einn rammi utan um, 1px skil, valinn reitur `--sl-adgerd` |

Óhakað `Skoðað?` er hljóðlátur hnappur; hakað `✓ Skoðað` er fylltur. Munurinn
**verður** að sjást — í loftútgáfunni 29.08 var hann blár í báðum tilvikum og
enginn sá hvað var búið.

**Árs-reitir (4 ár)**

Flatir, 31×20px, radíus 2px, ártalið sjálft í reitnum:
`--sl-skodad` skoðað · `--sl-sleppt` yfirstandandi ár ·
`#e8e5e0` með `--sl-texti-merki` ekki skoðað.
Engir gljáar, engar ljósdíóður, engir deplar undir — sú útgáfa var prófuð og
var of þung í röð sem endurtekst 600 sinnum.

**Merki — þrjú þrep, aldrei einn flatur listi**

Ellefu merki í einum lista blanda þrem óskyldum hlutum. Skiptu þeim:

1. **Staða** — eitt val, útiloka hvert annað. Segment-strimill.
   (Ómerkt · Í vinnslu · Bíður svars · Klárt)
2. **Næsta aðgerð** — mörg val, hnappar. (Hringja, Gera tilboð, Senda skýrslur…)
3. **Flokkur** — hlutlausir merkimiðar, engin aðgerð. (Bókhald, Brunakerfi…)

**„Í vinnslu — óklárað"**

Ljós blokk `--sl-adgerd-flotur`, 2px vinstri strik `--sl-adgerd-mjuk`, texti
`--sl-adgerd-djup`, með talningu (`3 af 9 tækjum skráð`) og
`⟳ Samstilla í Ársskoðun`. Aldrei fullur blár flötur.

## 5 · Layout Principles

```css
--sl-bil-1: 4px;  --sl-bil-2: 7px;   --sl-bil-3: 9px;
--sl-bil-4: 12px; --sl-bil-6: 16px;  --sl-bil-8: 20px;
```

- **Ein sía á skjá.** Sami starfsmaður var valinn þrisvar á Þjónustuborðinu — í
  BORÐ-listanum, Skipulagsborðinu og Spjall-hausnum. Sían á toppi ræður öllu
  sem er undir.
- **Sami hlutur, eitt útlit.** Dagskrá og Skipulagsborð voru tvö útlit á sama
  hlutnum (mál sem fékk dag). Eitt af þeim er ofaukið.
- **Skruna, ekki fella út.** Borð sem er breiðara en skjárinn skrunast til
  hliðar með frosnum nafndálki. Síustrimlar skrunast til hliðar í einni línu —
  ekki fjórum röðum sem taka 160px.
- **Samstillt skrun.** Frosinn dálkur og skrunandi hluti verða að spegla
  `scrollTop`. Þau fóru 456px úr fasa í loftútgáfunni.

## 6 · Depth & Elevation

Nánast flatt. Dýpt er notuð til að segja „þetta liggur ofan á", ekki til að
skreyta.

```css
--sl-skuggi-spjald: 0 1px 1px rgba(20,20,18,.04);
--sl-skuggi-frosinn: 3px 0 8px -6px rgba(0,0,0,.45);
--sl-skuggi-panell: 0 -1px 0 rgba(0,0,0,.08);
```

Radíus: 2px á hnappa og reiti, 3px á spjöld. Ekkert hærra — hringlaga hnappar
eiga bara við um stöðuhringinn í röð (26px).

## 7 · Do's and Don'ts

**Gerðu**

- Sýndu meira og láttu notandann skruna.
- Ein fyllt aðgerð á spjald eða skjá.
- Tölur í mono, krónur með punkti.
- Aldur máls sem lit.
- Segment fyrir staða, hnappa fyrir aðgerð, merkimiða fyrir flokk.
- Snertisvæði 36px lágmark, 40px á aðalaðgerð.

**Ekki**

- Ekki dökka metal-halla á allt. Prófað 29.08, hafnað — sjö jafnþungir hlutir
  slást um sama spjaldið.
- Ekki fylltan litaflöt á spjald sem er í vinnslu.
- Ekki texta undir 4.5:1. Þetta er lesið úti.
- Ekki gljáa, ljósdíóður eða depla á stak sem endurtekst 600 sinnum.
- Ekki fella dálka eða síur út til að spara plass.
- Ekki tvö CSS-lög á sama borð. Tvær 314-skrár stýrðu sama borði og inline-
  stílar töpuðu fyrir `@media`-reglum tvisvar á sama degi.
- Ekki fela viðvörun í gulu horni („96 af 98 málum eru falin" var ólæsileg).

## 8 · Responsive Behavior

**Kveikjan er `data-viewmode` á `<html>`, ekki `matchMedia`.** Notandinn velur
sýn; hún er ekki ráðin af gluggabreidd. Þetta er skjalfest í `joker.md` og var
sannreynt 29.08.

| Sýn | Hvað hún er |
| --- | --- |
| Sími — borð | Frosinn 150px nafndálkur + 668px skrunandi (Mán 56 · Ár 112 · Tæki 96 · Akstur 60 · Staða 52 · Virði 84 · Síðast 78 · Nóta 130) |
| Sími — bílstjóri | Spjaldalisti, hópað eftir mánuði, flipar fyrir aksturslista 1/2/3/Allir |
| Skjár | Fullt borð, KPI-spjöld sýnileg |

KPI-spjöldin (187px) eru **ekki** í símaútlitinu — bílstjóri notar þær tölur
ekki á staðnum og þær rúmast í botnstrimlinum sem þegar sýnir fjölda og samtölu.

Öll símastærðargildi liggja í `css/ars-simi-vars.css` sem CSS-breytur, á einum
stað. Engin tala má vera skrifuð tvisvar. Þetta er forsenda hönnunarhamsins
(sleðar sem skrifa í `setProperty` og vista í `AppSettings`).

## 9 · Agent Prompt Guide

Fyrir hvern sem byggir skjá í þetta app:

> Notaðu tokens úr `css/ars-simi-vars.css` og litina í kafla 2 hér. Engin ný
> litapalletta, engin hörð tala sem tokens eiga þegar.

> Gögnin koma úr `AppSettings.path('arsskodun_customers')`, `CanonStadur` (312)
> fyrir mánuð og canonical tækjafjölda, `ArsAkstur` fyrir aksturslistann,
> `161-leidsogn` fyrir leiðsögn. Endurnotaðu útreikninga úr `153-arsskodun.js`
> — ekki afrita þá.

> Vistaðu **alltaf eitt fyrirtæki í einu**:
> `AppSettings.save({ arsskodun_customers: { [String(id)]: patch } })`.
> Aldrei alla töfluna — það er race-lagfæringin frá 2026-07-15.

> Áður en þú ýtir: `git fetch`, `node tools/audit-all.cjs`, gegnum `netvordur`
> (Ársskoðun er varinn slóði), `elon-musk` fyrir útreikninga, `joker` fyrir
> símaútlit. Prófað í 390px með raunverulegum gögnum — og segðu hvernig það
> var prófað, ekki bara að það sé búið. Skrifaðu í Charlize í lokin.
