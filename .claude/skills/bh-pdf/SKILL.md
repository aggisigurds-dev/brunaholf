---
name: bh-pdf
description: >
  Útlit og smíði PDF-skjala Brunahólfs í vafranum (jsPDF + autoTable) — Efnislisti, Tímaskýrsla,
  Efnislisti · göt (Heklureitur), Efnislisti · NLSH. Sameiginlegi hausinn, Playfair-titillinn,
  spássíur, töflustílar, vistun á Supabase og hvernig á að sannreyna PDF. Notaðu þegar á að
  breyta eða búa til PDF í index.html, þegar Agnar sendir hönnun af skjali („láta PDF-ið líta
  svona út", „font í Verkstaður", „lógóið eins og í Efnislistanum"), eða þegar PDF lítur rangt út.
---

# PDF-skjöl Brunahólfs (jsPDF)

Hönnunin er Agnars „Report redesign with summary" (06.10.2026, d87db13). Öll skjöl eru teiknuð
í `index.html` (grep — aldrei lesa skrána í heild). Minni: `project-efnislisti-pdf-utlit`.

## Hvar hvað býr

| Skjal | Smiður → teiknari | Snið |
|---|---|---|
| Tímaskýrsla | `buildAndSaveTimabokPdf` → `drawTimabokPage` | A4 standandi |
| Efnislisti (Tímaveru-verk) | `buildAndSaveEfnislistiPdf` → `drawEfnislistiPage` | A4 standandi |
| Efnislisti · göt (Heklureitur) | `buildAndSaveGatEfnislistiPdf` → `drawGatEfnislistiPage` | A4 standandi |
| Efnislisti · NLSH | `buildAndSaveNlshEfnislistiPdf` → `drawNlshEfnislistiPage` | A4 **liggjandi** |
| Samsett (Efnislisti + Tímaskýrsla) | `buildAndSaveCombinedPdf` | teiknararnir á sömu síðu-röð |

Teiknararnir teikna á NÚVERANDI síðu svo samsetta PDF-ið endurnýtir þá. Vistun:
`bhSavePdfToSupabase(doc, {fileName, worksite_name, work_month, doc_type, overwrite})`,
nafn úr `bhPdfName('<Tegund>', {ws, month})` (ekkert `/` í skráarnafni).

## Sameiginlegu hjálparföllin (nota þau — ekki teikna haus upp á nýtt)

- `bhPdfHaus(doc, logo, lina1, lina2)` — lógó (`bhLogoDataUrl()`) vinstra megin · „Brunahólf ehf"
  (times bold) + tvær gráar línur hægra megin · svört 1,4 pt lína á y=107.
- `bhPdfMerki(doc, 'VERKSTAÐUR', x, y, align)` — lítill grár hástafa-merkimiði með stafabili.
- `bhPdfTitill(doc, heiti, y, maxW)` — heiti verkstaðar í **Playfair Display Bold** 21 pt;
  skilar grunnlínu síðustu línu (löng heiti brotna).
- `BH_PDF_L = 54` spássíur · `BH_PDF_HEAD` / `BH_PDF_BODY` = autoTable-stílar (hástafa-haus
  6,5 pt með svartri undirlínu, línur 9 pt með ljósgrárri undirlínu, engar fyllingar).
- Dálkaheiti: LIÐUR · EIN.VERÐ ÁN VSK · MAGN · SAMTALS ÁN VSK. VERKKAUPI hægra megin við
  VERKSTAÐ. „Vegna"-línan undir heiti verkstaðar.

## Playfair í jsPDF

`doc.__playfair = await bhPdfPlayfair(doc)` í hverjum smið, ÁÐUR en teiknað er. Fallið sækir TTF
einu sinni af fonts.gstatic.com (CORS `*`, ~120 KB), `addFileToVFS` + `addFont('…','Playfair','bold')`;
bregðist það → Times. **woff2 virkar ekki í jsPDF** — TTF-slóðina færðu úr Google Fonts CSS með
gömlum User-Agent (curl). Íslenskir stafir: Helvetica jsPDF ræður við þá í WinAnsi; nýtt letur
verður að vera TTF með þeim stöfum.

## Gildrur sem kostuðu umferðir

- **Teiknararnir eru nær eins.** Edit með stuttu samhengi lenti í `drawGatEfnislistiPage` í stað
  `drawEfnislistiPage` („Vegna"-línan, 06.10). Láttu fallheitið fylgja `old_string` eða staðfestu
  með grep á eftir.
- **Mánaðarheiti í þröngum dálkum brotna í miðju orði** → stutt heiti (`manStutt`: „Sep 25",
  „Ágú 26").
- **Tímaskýrslan flæddi á síðu 3** → minna padding, neðri spássía 28; teldu síður eftir breytingu.
- **Nöfn starfsmanna** eru lágstafir í gögnunum („lukasz") → `nafn()` setur stóran upphafsstaf.
- Breið tafla (NLSH: 12 fyrri mánuðir + st./heil.) → liggjandi og valkvætt „aðeins heilar"
  (`o.baraHeilar`) frekar en minna letur.
- HTML-forskoðunin í ritlunum (`.gr-doc`, `#nle-doc`) er SÉR teikning — breyting á PDF breytir
  henni ekki, og öfugt. Þema appsins lekur inn í forskoðun: yfirskrifað með forskeyttum
  `!important`-reglum (`.gr-modal-bg.boss.nl-ef .nle-doc …`), sbr. minni `project-css-override-specificity`.

## Sannreyna

Skill `vidmotsprof` §3: grípa `/api/pdf-store` → `sink.cjs`, opna með pdf.js, skjáskot af hverri
síðu, `getTextContent().styles` sýnir hvort Playfair hlóðst. Skoðaðu myndirnar sjálfur og sendu
Agnari PDF-ið (SendUserFile) — ekki lýsingu af því.
