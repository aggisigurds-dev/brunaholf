# Dagsetningar — eitt snið, og línan sem má ekki fara yfir

**Sniðið er `DD/MM/YYYY`.** Dagur fyrst, skástrik, tveggja stafa dagur og mánuður.
Ákveðið af Agnari 17.09.2026: *„skiptir ekki með skrástik eða punkta … vill bara DD
fyrst … Hafðu bara sama allstaðar hafðu /".*

## Reglan

> **Birt** dagsetning fær `DD/MM/YYYY`.
> **Geymd eða lesin** dagsetning heldur sínu sniði og er ALDREI snert.

Þetta er ekki smekksatriði. Sami strengur getur verið hvort tveggja, og þá brotnar
hann þegjandi: sniðmátarinn skrifar `17/09/2026`, lesarinn leitar að punkti, finnur
ekkert og skilar tómu — engin villa, bara rangt svar.

## Hvernig þetta er tryggt

| Lag | Hvar | Hvað |
|---|---|---|
| Sjálfvirkt | `brunaholf/js/dags-snid.js` · `slokkvitaeki/js/patches/148-date-format-unify.js` | Vefja `Date.prototype.toLocaleDateString` OG `toLocaleString` fyrir `is`/`is-IS`/sjálfgefið **án valkosta** → `DD/MM/YYYY`. Kall MEÐ valkostum (langform, vikudagur) fer óbreytt í gegn. `Number.prototype` er ósnert — krónutölur breytast ekki. |
| Handsmíðað | `String(d.getDate()).padStart(2,'0') + '/' + …` | Skástrik. |
| ISO → texti | `m[3] + '/' + m[2] + '/' + m[1]`, `split('-').reverse().join('/')` | Skástrik. |

## Það sem heldur punktinum — og af hverju

Þessi eru **undanskilin** og eiga að vera það áfram:

- **`netlify/functions/reikningar-rename.js` → `toDdmmyy`.** Byggir skráarnafn í Drive
  (`Fyrirtæki - kt - R 000123 - 17.09.26 - 45.000 kr`). Skástrik í skráarnafni er rangt,
  og fjögur verkfæri lesa árið aftur út úr nafninu með punkti: `drive-count.js`,
  `drive-sort.js`, `drive-multitool.js`, `pdf-classify-background.js`.
- **Lesarar á utanaðkomandi skjölum.** `payday-ingest-drive.js`, `payday-pull*.js`,
  `reikningar-read.js`, `samningar-read.js`, `redder-read.js`. Þessi skjöl eru ekki okkar
  — þau eru með íslenskum punkti og verða það áfram.
- **Geymd gögn.** `slokkvitaeki/js/patches/368-thjonustubord5.js` þáttar
  `s.dagsetning`/`b.dagsetning` með `/(\d{1,2})\.(\d{1,2})\.(\d{4})/`. Þau gildi koma úr
  `sara_yfirferd` — innslegin eða lesin úr vinnublöðum, ekki úr sniðmátara.

Þrír lesarar á **okkar eigin** reitum voru gerðir umburðarlyndir í staðinn (taka punkt,
skástrik eða bandstrik): `ymd` í efnislista-ritlinum, mánaðarreglan á Redder-takkanum og
`isDateTok`.

## Það sem síðan ræður EKKI

`<input type="date">` sýnir dagsetninguna á því sniði sem **vafrinn** er stilltur á, ekki
síðan. Mælt 17.09.2026 á `brunaholf.netlify.app`: gildið `2026-03-09` birtist sem
`03/09/2026` — mánuður fyrst — hvort sem reiturinn stóð í `lang="is"`, `lang="en-GB"` eða
engu `lang`. Chrome tekur röðina úr eigin viðmótstungumáli.

Eina leiðin til að laga það án þess að skipta reitnum út er að stilla tungumál Chrome
(Stillingar → Tungumál → „Sýna Google Chrome á þessu tungumáli" → Íslenska eða
English (United Kingdom)). Þá verða allir dagsetningarreitir dagur-fyrst, líka á síðum
sem við eigum ekki.

Hin leiðin — að skipta `type="date"` út fyrir okkar eigin reit með `showPicker()` — er
möguleg en snertir 60 reiti og breytir því hvernig `.value` lest. Hún hefur ekki verið
farin.

## Þegar þú bætir við dagsetningu

Notaðu `dagsIS(x)` (brunahólf) eða `fmtDateIS(x)` (slökkvitæki). Bæði taka ISO-streng
eða `Date` og skila `DD/MM/YYYY`, eða `—` ef gildið er ónýtt.
