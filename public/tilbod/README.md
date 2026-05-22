# Tilboðsgerð — Brunavarnir í sameign

Sjálfvirk tilboðsgerð fyrir Slökkvitæki ehf. — útbýr Word-skjal og býr til lifandi skýringarmynd af húsnæði.

## Hvað er í pakkanum

| Skrá | Lýsing |
|---|---|
| `index.html` | Vefurinn — slá inn upplýsingar, sjá lifandi forskoðun, sækja .docx |
| `build_tilbod.js` | Node.js script — býr til .docx beint úr config (fyrir sjálfvirka tilboðsgerð) |
| `logo.png` | Slökkvitæki Brunahólf merkið (3.5:1) |
| `package.json` | Node deps (docx pakkinn) |

## Notkun A — Vefurinn (einfaldast)

`index.html` er sjálfstæð HTML skrá. Drag-and-drop í Netlify, eða leggðu inn í brunaholf repo undir `/public/tilbod/` eða svipað:

```
brunaholf/
  └── public/
      └── tilbod/
          ├── index.html
          └── logo.png
```

Slóð verður þá `brunaholf.netlify.app/tilbod/`.

Til að gera fínni slóð (`/tilbod` án `/index.html`), bætið við í `netlify.toml`:

```toml
[[redirects]]
  from = "/tilbod"
  to = "/tilbod/index.html"
  status = 200
```

## Notkun B — Node.js script (sjálfvirk tilboðsgerð)

Ef þú vilt búa til .docx skjöl úr terminal eða úr backend:

```bash
npm install
node build_tilbod.js
```

Þetta býr til `Tilbod_<husfelag>.docx` í möppunni.

## Hvernig á að breyta upplýsingum

Allt er stillt í þremur blokkum efst í `build_tilbod.js`:

```javascript
const COMPANY = {       // sjaldan breytt — Slökkvitæki ehf. upplýsingar
  nafn: 'Slökkvitæki ehf.',
  kt: 'Kt. 600508-0400  ·  Vsk. nr. 98107',
  ...
};

const RATES = {         // sjaldan breytt — verðskráin þín
  yfirferdLettvatn: 3150,
  nyttLettvatn6kg:  11693,
  nyttCO2:          23790,
  serkjor:          0.80,  // 20% afsláttur
  ...
};

const BUILDING = {      // BREYTIST PER TILBOÐ
  husfelag:     'Húsfélag XXX',
  byggAdr:      '107 Reykjavík',
  stiga:        3,        // fjöldi stigaganga
  haedir:       5,        // fjöldi hæða
  kjallari:     true,     // er kjallari?
  ibudir:       31,
  co2IKjallara: true,     // er CO₂ við rafmagnstöflu?
  uppsetningKlst: 5,      // klst í uppsetningu
  tegund:       'uppsetning',  // 'uppsetning' eða 'yfirferd'
  ...
};
```

Skýringarmyndin aðlagar sig sjálfvirkt að þessum stillingum: fjöldi stigaganga á planmynd, fjöldi hæða í lóðréttu sniði, og merkin í kjallara taka tillit til þess hvort CO₂ er notað.

## Magntölur reiknast sjálfvirkt

| Stilling í BUILDING | Hvað hún breytir |
|---|---|
| `stiga` | Fjöldi stigaganga í teikningu og magntölum |
| `haedir` | Fjöldi hæða í teikningu og fjöldi slökkvitækja á stigapöllum |
| `kjallari: true/false` | Bætir við eða fjarlægir kjallararými + 6L léttvatn + samtengdir skynjarar í kjallara |
| `co2IKjallara: true/false` | Bætir við eða fjarlægir CO₂ tæki við rafmagnstöflu |
| `lettvatnPerHaed` | Fjöldi léttvatnstækja per hæð per stigi (sjálfgefið 1) |
| `skynjariPerHaed` | Fjöldi reykskynjara per hæð per stigi (sjálfgefið 1) |
| `tegund: 'uppsetning'` | Ár 1 — sundurliðun sýnir ný tæki með 20% afslætti og uppsetningarvinnu |
| `tegund: 'yfirferd'` | Ár 2+ — sundurliðun sýnir árlega yfirferð (akstur, skýrslugerð, yfirferð) |

## Tengsl við Luna (Claude AI)

Vefurinn er með innbyggt `askLuna()` fall sem leitar að `window.luna.ask(...)` á síðunni. Ef Luna client er í brunaholf appinu, virkar Spyrja-Luna hnappurinn beint.

Annars er hægt að setja upp Netlify Function (sjá `netlify/functions/luna.js` í brunaholf repoinu) og pluga API lykli inn.

## Mæli með kerfinu

- Brunavarnir í sameign skv. byggingarreglugerð nr. 112/2012
- Reglugerð nr. 723/2017 um eldvarnir og eldvarnareftirlit
- ÍST EN 3 staðall um handslökkvitæki

## Spurningar

Agnar Sigurðsson — Slökkvitæki ehf.
565-4080 · eldklar@eldklar.is
