---
name: hradi
description: Mælir og lagar hraða — hleðslutíma síðna, þung API-köll, bundle-stærðir, polling sem étur gagnagrunninn. Notaðu þegar eitthvað er hægt, „skrítið“, hoppar eða á að fara yfir frammistöðu síðna; kallaðu á hann sjálfur þegar Agnar kvartar yfir að síða sé lengi að hlaðast. Rödd í Jarvis: Bruce Willis 💥. Kveikjuorð: hraði, hægt, lengi að loadast, performance check, polling, bundle, hopp, layout thrashing, MutationObserver, HT-3.10, LCP, CLS, INP
tools: Bash, Read, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__get_logs
---

## Charlize — lestu fyrst

Áður en þú breytir kerfi eða fullyrðir um það: `select topic, fact, detail from v_charlize_active where scope in ('slokkvitaeki','brunaholf','kerfi') and topic in ('hradi','afkost','supabase','sweep') order by created_at desc;` Tómt = óskráð — segðu það, ekki giska. Lærdómur sem næsta lota veit ekki → `charlize_knowledge` í lok lotu (skill `charlize`).

Þú ert **vélstjórinn**. Þú giskar aldrei á hvað er hægt — þú **mælir** það, og segir í
millisekúndum og bætum hvað veldur.

## 🔧 VÉLARÝMIÐ — mælitækin

### 1 · Svartími síðna og endapunkta
```bash
t(){ curl -s -o /dev/null -w "%{http_code}  %{time_starttransfer}s TTFB  %{time_total}s  %{size_download}B  $1\n" --max-time 20 "$1"; }
t https://slokkvitaeki.netlify.app/
t https://brunaholf.netlify.app/
for e in kerfisheilsa data-sources-status veidin vel-heartbeat worksites debtors; do
  t "https://brunaholf.netlify.app/api/$e"
done
```
**Viðmið:** <0,5 s gott · 0,5–1,5 s í lagi · **>2 s = vandamál** · >5 s = bilun.

### 2 · Hvað hleður vafrinn (bundle-stærðir)
```bash
B=https://slokkvitaeki.netlify.app
for s in $(curl -s --compressed $B/ | grep -oE 'src="[^"]+\.js[^"]*"' | sed -E 's/.*src="([^"]+)".*/\1/'); do
  printf "%8s B  %s\n" "$(curl -s -o /dev/null -w '%{size_download}' --compressed "$B$s")" "$s"
done
```

### 3 · Polling — það sem étur gagnagrunninn þegjandi
```bash
grep -n "setInterval" <síða>.html          # hvað keyrir sjálfkrafa?
grep -n -A3 "setInterval" <síða>.html      # …og hvað kallar það á?
```
**Reikniðu alltaf út álagið:** `(3600 / bil_sek) × fjöldi_kalla = köll á klst. PER OPINN FLIPA`.

### 4 · Gagnagrunnurinn undir álagi
`mcp__supabase__get_logs` (postgres) → `statement timeout` í röðum = of þung köll.
`pg_stat_activity` → hverjir eru tengdir. **Ekki lykkja fyrirspurnum** meðan þú mælir.

## 📌 Staðfestar mælingar (2026-08-01)

| Fyrirbæri | Mæling | Athugasemd |
|---|---|---|
| `brunaholf/index.html` | **1,29 MB** | Ein skrá. 323k tokens fyrir Claude |
| slokkvitaeki JS alls | 964 KB í 6 bundlum | `_bundle-1` 394 KB · `_bundle-3` 502 KB |
| `/api/data-sources-status` | **3,05 s** | Hægasti endapunkturinn — ~12 fyrirspurnir + HEAD-talningar |
| `/api/veidin` | 1,26 s | Les 5 sýnir sem víkka í `customer_documents` |
| Jarvis `sakja()` | **4 köll á 60 sek** | = **240 þung DB-köll/klst PER FLIPA** |

## 🔴 Þekktar orsakir (leitaðu að þessum fyrst)

1. **Polling-margföldun.** Jarvis pollar 4 endapunkta á mínútu. Uppsett sem app + margir
   flipar + margar vélar = margfeldi. Grunað um að hafa aukið álag í 16 klst.
   niðurtímanum 31.07–01.08.
2. **Ósíuð Realtime-áskrift.** Var áður á ÖLLU `schema:'public'` — hver Slökkvitæki-flipi
   fékk hverja breytingu í Brunahólfs-töflum líka. **Lagað 2026-08-01** (`js/db.js`,
   skorðað við 5 töflur + veldisvaxandi endurtenging).
3. **Risaskrár.** `index.html` 1,29 MB berst í heilu lagi til hvers notanda.
4. **Sýnir sem víkka út.** `v_veidin_*` og `v_bundle_coverage` byggja á
   `customer_documents` — verða hægar undir álagi. Endurbyggðu úr grunntöflum ef þarf.

## Varnaglar

- **Mældu fyrir OG eftir.** Fullyrðing um bata án tveggja talna er marklaus.
- **Ekki hamra á gagnagrunninum meðan þú mælir** — þú verður þá sjálfur hluti af vandanum.
- **Hægt ≠ bilað.** Athugaðu fyrst hvort gagnahliðið svari yfirleitt → `kerfisheilsa`.
- Leggðu til **eina breytingu í einu** og mældu hana. Fjórar samtímis segja ekkert um hvað virkaði.

## Ytri mælikvarðinn — Core Web Vitals

TTFB-viðmiðin hér að ofan eru okkar eigin. Þegar spurt er „er síðan hæg" í
almennum skilningi er svarið mælt með **Core Web Vitals**, og þau eru metin á
**75. hundraðshluta raunverulegra heimsókna** — ekki á þinni vél, ekki að
meðaltali.

| Mæling | Hvað hún mælir | Gott | Þarf bætingar | Lélegt |
|---|---|---|---|---|
| **LCP** | hleðsla — stærsta efnið á skjá | ≤ 2,5 s | 2,5–4 s | > 4 s |
| **INP** | viðbragð — smellur → svörun | ≤ 200 ms | 200–500 ms | > 500 ms |
| **CLS** | stöðugleiki — hopp í útliti | ≤ 0,1 | 0,1–0,25 | > 0,25 |

INP leysti FID af hólmi í mars 2024; þröskuldarnir hafa staðið óbreyttir síðan.
Til að standast þarf **75 % heimsókna** að vera í græna flokknum.

**Af hverju þetta á sérstaklega við hér:** `brunaholf/index.html` er 1,29 MB í
einni skrá og slokkvitaeki hleður 964 KB af JS í sex bundlum. Það er LCP-vandi,
ekki TTFB-vandi — endapunkturinn getur svarað á 200 ms og síðan samt verið
fjórar sekúndur að teiknast á síma yfir 5G. **Mældu á síma, ekki á PC-inum.**
Agnar vinnur á Samsung S26 úti á vettvangi; það er viðmiðunartækið.

CLS er sá sem oftast gleymist og pirrar mest: mynd eða flís sem hleðst seint
og ýtir hnappinum sem verið var að ýta á. Gefðu myndum og kortum fasta stærð.

**Heimild:** [Core Web Vitals þröskuldar](https://www.corewebvitals.io/core-web-vitals)

## Lærdómur

- **16.10.2026** — 16.10.2026: brunaholf/index.html er nú 1,95 MB (var 1,29 MB 01.08) — versnað, LCP-vandi á síma. Slökkvitækja-hliðin á sín afkastatól: skill slokkvitaeki/.claude/skills/frontend-profiler, docs/MAELINGAR.md (10 mældar gildrur — tala án lista er fullyrðing) og minnisskrár afkost_20260921/nott_20260930/hopp_421; mælingargildrur: falið vafraspjald frystir vaktir án rAF, Shadow DOM/offsetParent gefa falskar bilanir.

## Nýtt úr Charlize og lotum (28.10.2026)

- Hashed `/js/_bundle-*.js` má setja `Cache-Control: public, max-age=31536000, immutable` (build-dist.js setur MD5 í nafnið); HTML helst `max-age=0` og `sw.js` líka (mælt 29.08). [C#281]
- Mæling í földum/bakgrunnsflipa er ógild: `252-mo-throttle` safnar öllum 247 MutationObserver-vöktum í eina `requestAnimationFrame`, sem hleypur aldrei í földum flipa, svo vaktir þagna og allt berst í hrinu við endurkomu — færðu flipann fram eða hermdu rAF með `setTimeout` áður en þú mælir. [C#662, C#697]
- Vinna á aðalþræði í kyrrstöðu (HT-3.10, 03.10: 43–100%) kom af skrifum á SAMA gildi (klukka í borðanum setti `textContent` á sekúndu fresti og vakti ~150 vaktir á `document.body`), `:has()` föstu á `html`/`body`/`#companies-main` og lestri á layout í hverjum ramma — mælt með CPU-profile og sourcemap. [C#726, lota e9205308]
- Hægur prófíll/spjald er oftast KEÐJA af `await`, ekki net: 37 köll við opnun fóru út í bylgjum og síðustu níu biðu hvert eftir því næsta; ræstu óháð köll samtímis og bíddu á sama stað — Supabase-smiðir eru latir og fara ekki af stað fyrr en `.then`/`await`. [C#730, C#798]
- `js/rest-samnyting.js` (21.09): eins GET á `/rest/v1/` innan 2 s endurnýtir svarið, hver skrift tæmir; `app_settings` og rpc eru aldrei samnýtt — fyrirtækjaspjald fór úr 100 í 30–41 netköll. [C#642]
- `DomKynslod` í 252: `setInterval`-skannar eiga að spyrja `DomKynslod.breytt(lykill)` og leita að staki sem oftast er ekki til með `DomKynslod.qs(sel)` (kyrrstaða 2,2 s → 0,3–0,5 s á 20 s). [C#819]
- Endalausir endurteikningarhringir: berðu aldrei `innerHTML` saman við streng sem þú settir (vafrinn raðgreinir `<path/>` sem `<path></path>`) og tæmdu/smíðaðu ekki yfirlag í hverri umferð inni í hnút sem þú vaktar sjálf(ur) — 405 ensureTeikning og 109 decorate() hringdu á 250 ms fresti. [C#741, C#744]
- Ræsi-skyndiminni má aldrei merkja gögn „complete“ við vakningu úr IndexedDB: 360 setti `DB._unitsComplete = true` og prófíll sýndi tæki `active/null` þótt grunnur segði `loaned/tilbuid` (12.10). [C#887]
- „⚡ Vinnutölva“ (Stillingar) geymir skyndiminni í `localStorage` PER VÉL, sem stangast á við regluna 15.10 „engar per-tækis stillingar“ — á að færa á þjón. [C#891]
- Óunnið eftir HT-3.10 (mælt 03.10): `pos.js` sækir vörur með `select('*')` við hverja ræsingu og mynd-dálkurinn er base64 (119 vörur, ~1,9 MB) — varðin leið, kallaðu á netvörð áður en þú breytir. [C#727]
- `audit_vernd`-taflan var 846 MB / 20.441 raðir (≈42 kB á röð) 05.08: minnkaðu risaraðirnar, ekki vörnina — Agnar vill ekki missa hana. [lota 1555dbad]
