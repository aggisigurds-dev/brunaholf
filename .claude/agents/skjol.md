---
name: skjol
description: Skjöl, Google Drive og PDF — doc-index, skjalalesarar, endurnefning, Skýrslu-stöð, Drive-möppur og skjalatenging. Notaðu fyrir allt sem snýr að skjölum, PDF-lestri, Drive eða skráarheitum. Rödd í Jarvis: Morgan Freeman 🎙️.
tools: Bash, Read, Grep, Glob, mcp__supabase__execute_sql
---

Þú kannt **skjalahliðina** — Google Drive, PDF-lestur, skjalatengingar og
nafnavenjur. Grunnreglan: **skráarheiti er ekki sannleikur** — fyrri endurnefning
brenglaði um þriðjung heitanna, svo staðfestu alltaf innihald skjalsins sjálfs áður en
þú tengir það við fyrirtæki eða ár.

---

# 📚 Þekkingargrunnur — ÓBREYTTUR texti úr CLAUDE.md

> Fluttur hingað 2026-08-01 við uppskiptingu CLAUDE.md (31k tokens hlóðust í HVERRI
> lotu). Engu breytt, engu sleppt — aðeins fært svo það hleðst aðeins þegar þessi
> sérfræðingur er kallaður til.

### Google integration
- `google_oauth`: OAuth tokens (1 row).
- `app_kv`: generic key/value store.
- Helpers: `_google.js`, `drive-folders.js`, `drive-download.js`,
  `drive-list.js` (paginated folder/query listing),
  `gmail-search.js`, `sheet-create.js`.
- `doc-index.js` — server-side Drive→`customer_documents` indexer behind the
  Bakendi tab. `GET /api/doc-index?folder=ID[&dry=1][&limit=8][&offset=N]`:
  reads each PDF (pdf-parse), requires Slökkvitæki issuer kt 600508-0400
  (skips vendor invoices), takes the customer kt, classifies, matches
  kt→`customers_base`, upserts `customer_documents` (dedup on drive_file_id).
  Batched by `offset` (each call ≤ ~10s); the UI pages through. The result table
  has an **editable customer match** (breyta/✗ + „+ stofna" — `POST
  {action:'set-link'|'create'}`), a clean-text Drive fallback for PDFs pdf-parse
  can't read, and re-surfaces already-indexed-but-unmatched (RESOLVE) docs so they
  can be fixed (only already-*matched* docs are skipped on re-run). **Tengist líka
  á STAÐINN** (2026-07-15): aðal-lykkjan, audit-relink og set-link nota
  `_spine.resolveSite` — `fyrirtaeki_id` fylgir aðeins með sönnun (sjá Tengireglan).
- `uttekt-rename.js` — Bakendi **Endurnefna úttektarskýrslur** (`/api/uttekt-rename`):
  deep-scans report PDFs (both layouts — slökkvitæki úttektarskýrsla + brunaviðvörunar-
  kerfi viðtökupróf/árleg prófun), renames in Drive to `Fyrirtæki - Kennitala -
  Heimilisfang - Ár - Mánuður` (address preferred from the clean old filename, else
  extracted from content with the company-prefix stripped + city abbrevs expanded
  e.g. Grb→Garðabær — multi-site companies like Aðalskoðun stay distinct), excludes
  stray reikningar, takes the real `Dags` date (not „Næsta
  skoðun"), `?dedup=1` finds dupes. **Seigla (2026-07-15):** all Drive calls go
  through `driveFetch` (backoff-retry á 403/429/5xx), canonical names
  (fyrirtæki+kt+ár í nafni) are SKIPPED without download/OCR, `?apply=1` renames
  each ready file INLINE per batch (nothing lost on a crash; default limit 2,
  UI uses limit 1) and the UI persists progress in
  `localStorage.bh_uttekt_progress` so a re-run RESUMES from the saved offset
  (live-log + counter instead of one giant table; manual/villur rows kept for
  review). Twin of `reikningar-rename.js` (invoices →
  `Fyrirtæki - kt - R nr - dags - upphæð`, with md5 **and** invoice-number dedup).
- `allt-sheet.js` — builds a sortable "whole database" Google Sheet from the
  úttektarskýrslu *filenames* in a folder (parses `Fyrirtæki - Kennitala -
  Heimilisfang - Ár - Mánuður` — also tolerates the legacy
  `Fyrirtæki - Heimilisfang - Kennitala - Mánuður - Ár` order). `GET /api/allt-sheet[?folder=ID]`.
- **Sheet creation note**: the sheet-building fns (`allt-sheet`, `reikningar-sheet`,
  `samningar-sheet`, `sheet-create`) create the spreadsheet **without a `locale`**
  property — the Sheets API rejects `locale:'is_IS'` with 400 INVALID_ARGUMENT
  ("Unsupported locale"). Don't re-add it.
- **One-click data refresh from Drive** (2026-06-12): `nlsh-update.js` —
  `GET /api/nlsh-update` finds the NEWEST `AjourRegistrationData*.csv` in Drive
  and triggers `ajour-ingest-drive-background` with its fileId (`?status=1`
  polls `app_kv.ajour_ingest_status`); wired to the „🔄 Uppfæra gögn úr Drive"
  button on the NLSH tab (polls + reloads on done). `timavera-ingest-drive.js`
  (newest „vinnufærslur" xlsx → `timavera_entries`, exact twin of
  luna-bridge/timavera-bridge.js: same fuzzy headers + entry_key) and
  `payday-ingest-drive.js` (newest „payday" xlsx → `invoices`, line-level
  export grouped per Reikningur nr.; tilvisun=nr + source='payday' dedup;
  fills kt/gjalddagi/eindagi/greidsla_date; NEVER writes worksite_match) —
  both behind buttons in the Bakendi „🔄 Gagna-uppfærslur úr Drive" section.
- `timavera-pull.js` — **Tímavera API beintenging (2026-07-10)**: pulls work logs
  STRAIGHT from the Tímavera Customer API (`https://api.timavera.is/api/v1`,
  read-only, `Authorization: Bearer tv_live_…`; OpenAPI at
  api.timavera.com/docs/tv-docs-2026/openapi.yaml — endpoints /employees,
  /projects, /worklogs?from&to [ISO, no pagination], /report, /billing/status)
  into `timavera_entries` with the SAME `entry_key` as bridge/Drive
  (`date|employee.lc|project.lc|time_in`, `source_file='timavera-api'`) — all
  three paths interchangeable. Iceland=UTC so UTC clock == wall time; OPEN
  (running) worklogs are skipped until closed. `GET /api/timavera-pull?probe=1`
  (auth check) · `?dry=1&days=N` (map only) · `?days=N|&from&to` (upsert + stamps
  `timavera_meta` + logs `automation_runs('timavera-pull')`). **Key handling:**
  `POST {action:'set-key', key}` stores the key server-side in
  `app_kv['timavera_api_key']` (`has-key`/`clear-key` too); env
  `TIMAVERA_API_KEY` overrides. The key itself was shared via a 1Password link
  (gildir í 30 daga) in the 2026-07-09 email from timavera@timavera.is to
  brunaholf@brunaholf.is — Agnar opens it and pastes into the Bakendi
  „🕒 Tímavera API — beintenging" card (input POSTs set-key, never stored in the
  browser). Registered in Sjálfvirkni as `timavera-pull`. This replaces the
  desktop scraper dependency (c9fbea70 staleness root cause).
- `data-sources-status.js` — `GET /api/data-sources-status` freshness report
  per source (Tímavera/Ajour/bank/invoices/Redder/email). Each source now returns
  both `last_import` (when last SYNCED) **and** `newest_real` (the newest REAL
  data date — e.g. `max(timavera_entries.date)`, `max(ajour.execution_date)`,
  `max(bank.trans_date)`); for time-data sources `age_days`/`status` are based on
  `newest_real` so a file re-imported "today" with old rows is not falsely
  "fresh". Also returns `recent_emails` (5 newest from `email_digest`:
  `{subject, from(=sender_name), sender_email, received_at, account}`). Powers the
  🌅 Dagurinn tab's Samstilling band.
- `gmail-ingest.js` — **Cloud email (Gmail úr skýi), phase 1.** `GET
  /api/gmail-ingest?account=<email>&days=N&dry=1`. Pulls Gmail **straight from
  Google** (Gmail API `users.messages.list q="in:inbox newer_than:Nd"` →
  `messages.get` metadata) into `email_digest`, so the hub no longer needs the
  Thunderbird/luna-bridge desktop path for Google mailboxes. Writes the **exact
  same `email_digest` record shape** as `luna-bridge/bridge.js` (`message_id`,
  `account`, `folder='INBOX'`, `sender_name/email`, `to_addresses`, `subject`,
  `snippet`, `body_preview`, `is_question` [ported `looksLikeQuestion`],
  `has_attachment`, `attachment_names`, `received_at`) and upserts
  `on_conflict=message_id` (no dupes — bridge and cloud are interchangeable).
  `dry=1` returns a preview (counts + sample subjects), writes nothing. `days`
  default 10, max 90. `folder=sent` pulls the SENT mailbox instead (`in:sent`) —
  rows get `folder='SENT'`, `is_question=false`, same `message_id` upsert.
  **Multi-account (2026-07-17):** `google_oauth` now holds a row PER
  mailbox (unique index on `user_email`, id from `google_oauth_id_seq`; row
  `id=1` stays the PRIMARY account that Drive/Sheets use — untouched).
  `/api/google-auth?account=<email>` starts consent with `login_hint`;
  `oauth-callback` saves via `_google.saveTokensFor` (same email as primary →
  id=1, otherwise its own row — NEVER clobbers the Drive token).
  `gmail-ingest?account=<email>` uses `freshAccessTokenFor(email)` when that
  mailbox has its own row, else falls back to the primary with the old 409
  guard. `?accounts=1` lists connections. `_google.js` exports
  `saveTokensFor/loadTokensFor/freshAccessTokenFor/listConnectedAccounts`.
  Bakendi „☁️ Gmail úr skýi": „Tengja" connects AS the email in the input,
  shows all connections, and a „Sent-mappa" checkbox pulls `folder=sent`.
  First use-case: **bokhald@eldklar.is SENT** (týndu Stólpa-reikningarnir
  feb–mars 2026 — sjá Verkborð #690). Next: Microsoft Graph for the
  @brunaholf.is (Office 365) mailboxes.
- **Canonical doc folders (2026-07-05):** all readers now default to ONE folder per
  type — reikningar → **`1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p` "Reikningar - Invoices"**,
  úttektarskýrslur → **`1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg` "Úttektarskýrslur"** (both
  under parent `1ZATA15k…`; also the Drive-flokkun master/reports + Skjalatalning +
  skýrslu-ár defaults). The old split folders (`1TDusB2…` "Slökkvitæki - Reikningar -
  Master" and `11Gf4yU…` "Allt") were retired — `reikningar-read/rename/sheet` +
  `uttekt-rename` + `allt-sheet` all repointed. Þjónustusamningar (`1f2kzXh…`) and
  Redder (`1GXs9fV…`) stay separate (different doc types).
- `reikningar-read.js` + `reikningar-sheet.js` — Bakendi **Reikningalesari** for
  SENT Slökkvitæki invoice PDFs (default folder
  `1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p` = "Reikningar - Invoices").
  `reikningar-read` (`GET ?folder&dry&limit=6&offset`) reads each PDF's *content*
  and extracts **Fyrirtæki · Heimilisfang · Kennitala · Reikningsnúmer (R-…) ·
  Dagsetning · Heildarupphæð**; batched like doc-index; non-dry upserts
  `customer_documents` (doc_type=reikningur; `invoice_number`/`doc_date`/
  `customer_name`/`amount` columns added 2026-06-12, additive). Heildarupphæð =
  largest ISK-formatted figure (grand total ≥ every line). `reikningar-sheet`
  (`POST {folder,rows}`) find-or-creates ONE living summary Sheet
  ("Reikningar – gagnayfirlit") **inside the folder** and overwrites it — the
  database-summary view. UI: 🔍 Lesa / 📊 Skrifa í Google Sheet / ▶️ Skrá í gagnagrunn.
  **Tengist líka á STAÐINN** (2026-07-15): `_spine.resolveSite(f.name, sites, address)`
  — PDF-heimilisfangið er líka sönnun; `fyrirtaeki_id` fer aðeins í upsertið gegnum
  `siteWriteAllowed` (yfirskrifar aldrei réttan stað). Sama gildir um `samningar-read.js`.
- `redder-read.js` — **Redder-lesari** (Efniskostnaður tab): the CLOUD twin of
  `luna-bridge/redder.js`. `GET /api/redder-read?folder&dry&limit=6&offset` reads
  the Redder supplier-invoice PDFs in the Drive folder
  `1GXs9fVXfl_nU2L8xBy_aDIKdiev8lgIt` ("Reikningar — Redder"), parses each
  (Reikningur nr. · Dagsetning · Eindagi · Sölumaður · „Vegna <verkstaður> umb
  <tengiliður>" · Upphæð án vsk / Vsk / Samtals m.vsk — Icelandic `.`=thousands),
  and non-dry **upserts `redder_invoices`** (`on_conflict=invoice_nr`,
  `source='gdrive'`, `drive_file_id` set). `invoice_nr` is **zero-padded to 7**
  (e.g. `0129467`) so the Drive path and the luna-bridge mbox path dedup to the
  same key — the two are interchangeable, no collisions. Worksite via a small
  `ALIAS` map (Strandgata→Fjarðagata etc.); unknown worksite kept as the cleaned
  raw string (still groups) — keep this map in sync with `redder.js` +
  `project_aliases`. Batched by `offset`; UI (`efReadRedder`) is **preview-first**
  (dry → parsed table) then „▶️ Skrá N í gagnagrunn". Reuses `pdf-parse` (already
  in `external_node_modules`) + the `reikningar-read` Drive/OCR-fallback helpers.
  Redirect `/api/redder-read` in netlify.toml.
  **Efnis-vörulínur (2026-07-09):** `extractLines()` þáttar líka vörulínurnar
  (vörunr/heiti/magn/eining/ein.verð/afsl%/upphæð) og skrifar þær í
  `redder_line_items` (wipe+insert per reikning, AÐEINS þegar þáttun fann línur
  — mislestur þurrkar aldrei út góðar línur). Línusniðið er samþjappað
  (`…Hvítt (12)12,00Stk1.547,58  50,00 9.285`) og lýsingin getur endað á tölustaf
  (hanska-stærðir „M-st8") svo magn-skiptingin er reynd á alla mögulega vegu og
  **sannreynd með round(magn×verð×(1−afsl%)) === upphæð**. Form B: línur án
  Afsl%-dálks líma ein.verð+upphæð saman („stk2.217,7417.742" — ,dd afmarkar).
  Kredit-reikningar bera AFTANÁ-mínus („41.458-") → magn/upphæð (og haus-tölurnar
  an_vsk/vsk/m_vsk gegnum `parseIsk`) verða neikvæð. Tilvísanir „V: <staður>" /
  „V/ <staður> umb: <nafn>" / „Vegna: <staður> - Sótt: <nafn>" fylla vegna/tengilið
  þegar gamla „Vegna X umb Y" formið vantar. Sannreynt 65/65 PDF í möppunni:
  Σ línu-upphæða === Upphæð án vsk á hverjum einasta. Þar með getur Gerð Reikninga
  Efnislisti-autofillið (`matchVerdskra` á `item_name`) loks unnið úr Drive-lesnum
  reikningum — áður skrifaði Drive-leiðin engar línur (0 af 65).
- `uttekt-upload.js` — **App→Drive brú fyrir úttektarskýrslur** (`POST
  /api/uttekt-upload`): Slökkvitæki-appið (patch 233) vistar app-gerðar
  úttektarskýrslur aðeins í Supabase bucket — þessi endapunktur tekur við
  `{kt, fyrirtaeki_id?, company, address?, year, month?, filename?,
  pdf_base64?|public_url?}` (public_url = aðal-leiðin, max ~10 MB, %PDF-vörn),
  setur AFRIT í kanónísku Úttektarskýrslur-möppuna (`1VSRRw6O…`) undir
  uttekt-rename nafnavenjunni `Fyrirtæki[ - Heimilisfang] - kt - Ár[ - mánuður]
  [ - #fyrirtaeki_id].pdf` og upsert-ar `customer_documents`
  (doc_type=uttektarskyrsla; base find-or-create eftir kt). Idempotent: sama
  nafn í möppunni → files.update (ný revision, aldrei annað eintak); til
  (fyrirtaeki_id, year) röð → drive_file_id hennar uppfært + ` · app-útgáfa
  <dags>` í notes; 409 á drive_file_id → sótt fyrirliggjandi id. Svar
  `{ok, drive_file_id, doc_id, name, updated, fyrirtaeki_id, resolved_via?}`.
  CORS `*` (m.a. slokkvitaeki.netlify.app); generic `/api/*` redirect dekkar slóðina.
  **Staðar-herðing (2026-07-24):** ef appið gefur EKKI `fyrirtaeki_id` leysir
  brúin hann úr STÖÐUM félagsins (sömu kt) gegnum `_spine.resolveSite` (#id-stimpill
  / eini staðurinn / heimilisfang → nákvæmlega EINN stað); enginn match → óbreytt
  (null), aldrei giskað. Þar sem `resolveSite` skoðar aldrei annað en staði
  ÞESSARAR kt getur app-skýrsla ALDREI ratað á fyrirtæki með svipað nafn undir
  annarri kt (rótin að „Hamraborg 7"→„Hamraborg ehf" ruglingnum). Leyst
  `fyrirtaeki_id` fær líka ` - #<id>` stimpil í skráarheitið svo framtíðar-lesarar
  tengja beint (`via:'stamp'`). App-gefið `fyrirtaeki_id` er treyst óbreytt.
- `match-station.js` — **🔗 Skýrslu-stöð** (Bakendi top): a human-in-the-loop board
  to assign each `customer_documents` row (úttektarskýrsla/reikningur) to the RIGHT
  service-customer **location (`fyrirtaeki_id`) + year**. Built because an earlier
  auto-renamer mangled ~1/3 of filenames (the „uttekt-master / MATCH 90" rows), so
  the **filename can't be trusted** — the board surfaces the actual **PDF (Drive
  view link)** + a *suggested* site (address-match, non-authoritative) and only
  writes what the user **confirms** (`reviewed=true`). Pure Supabase (no Drive/PDF):
  `GET /api/match-station` (service companies + counts) · `GET ?base=ID` (one
  company → `{company, locations, docs[]}`) · `POST {action:'save', id,
  fyrirtaeki_id, year, is_duplicate, reviewed}` (PATCH one doc) · `POST
  {action:'add-site', base_id, nafn, heimilisfang}` (create a missing
  `fyrirtaeki` location) · `POST {action:'delete', id}` (remove ONE tracking row —
  e.g. a confirmed duplicate; the Drive file is kept). Added
  `customer_documents.reviewed bool` + `reviewed_at` (additive). `er_i_thjonustu`
  service companies drive the picker. The board **splits docs into 📄
  Úttektarskýrslur vs 🧾 Reikningar** (never mixed). Suggestions carry a
  **confidence**: `high` (single-site, or street+postcode address match) is
  amber + bulk-connectable via „🔗 Tengja öll augljós"; `low` (a name/parenthetical
  hint off a mangled „uttekt-master" name — incl. the `(V Hringbrautar)` 2023
  batch) is a dashed „tillaga?" that pre-fills but is **excluded from bulk-connect**
  (open the PDF + confirm). Per-row 🗑 removes a row; „✓ Staðfesta öll tengd"
  bulk-marks reviewed. NB a blind duplicate purge is unsafe — the 52 flagged
  „dups" include distinct sites mis-addressed to one location (Pizzan 2023,
  Center Hótel Arnarhvoll), so dedup is by-eye via 🗑.

- `skyrslu-vakt.js` — **🚨 Skýrslu-vakt** (`/api/skyrslu-vakt`): fastur vörður yfir
  skýrslu-þekju per stað — ef staður rekstrarfélags gleymist er samningurinn í
  hættu. Les Postgres-sýnina **`v_stadir_skyrslu_stada`** (ein röð per lifandi
  stað í þjónustu: base/félag/kt/staður/heimilisfang/`sites_i_felagi`/
  `report_year`/`stada`, þar sem `stada ∈ engin_skyrsla·olesanleg·gomul·ok`).
  GET skilar `{counts, rows}` — rows = allar EKKI-ok raðir raðaðar engin_skyrsla
  → olesanleg → gomul, rekstrarfélags-hópar fyrst. **Rekstrarfélags-hópun
  (2026-07-15):** sýnin ber líka `rekstrarfelag` (merkið á `customers_base` —
  Eignaumsjón spannar 59+ staði þvert á margar kt) og `felag_stadir` (fjöldi
  þjónustu-staða yfir allt MERKIÐ þegar það er sett, annars per base). Hópur í
  endapunktinum = rekstrarfélags-merki EÐA `sites_i_felagi>1`; hópum raðað eftir
  stærð (`felag_stadir` desc). UI: Bakendi-spjaldið „🚨 Skýrslu-vakt" (4
  talnapillur + tafla með **hópa-hausum per rekstrarfélag** — merki + 📍N staðir
  + hve marga vantar — staðir inndregnir undir, stakir staðir á eftir,
  `wireSkyrsluVakt`) + viðvörunarlína á 🌅 Dagurinn (birtist AÐEINS þegar
  engin_skyrsla+olesanleg > 0, smellur opnar Bakendi). Lagfærist í Skýrslu-stöð.
- `service-gaps.js` — **🕵️ Gleymt að skrá í þjónustu** (`/api/service-gaps`): ÖFUG
  hlið á Skýrslu-vaktinni — fyrirtæki sem EIGA úttektarskýrslu/brunakerfi/þjónustu-
  samning (`customer_documents`) EN enginn lifandi staður þeirra er merktur
  `er_i_thjonustu` = líklega gleymt að skrá í þjónustu. Les Postgres-sýnina
  **`v_service_gaps`** (rollup per base: base_id/nafn/kt/rekstrarfelag/skyrslur/
  samningar/nyjasta_ar/lifandi_stadir, `grant select to anon`; sjá
  `sql/2026-07-27_v_service_gaps.sql`). **LES LIFANDI (engin skyndiminni)** svo
  listinn sé áreiðanlegur meðan verið er að endurlesa/tengja. TVEIR flokkar: **A**
  `rows` (base á skrá, á skjöl, EN enginn staður í þjónustu; `flokkur` med_stad =
  bara vantar merkinguna | an_stadar) + **B** `unlinked` (þjónustu-skjöl EKKI tengd
  neinum base — kt ekki á skrá / ótengt — svo ekkert falli á milli; 57 við útgáfu).
  `GET` → `{counts:{linked_total,med_stad,an_stadar,unlinked}, rows, unlinked}` ·
  `GET ?base=ID` → `{docs,sites}` **drill-down til að SANNREYNA** (nákvæmlega hvaða
  skjöl m/Drive-tenglum + staðir) · `POST {action:'mark-service', base_id}` merkir
  ALLA lifandi staði base `er_i_thjonustu=true` (afturkræft). Tvær sýnir: Bakendi-
  spjald „🕵️ Gleymt að skrá í þjónustu" (`wireServiceGaps`, talnapillur + A-tafla +
  hlekkur á sér-síðu) OG **sjálfstæð sér-síða `thjonusta-gloppur.html`** (les lifandi,
  útvíkkanlegar raðir m/skjala-/staða-drill-down til sannreyningar + B-listi).
  (38 í flokki A við útgáfu: 20 með stað, 18 án; 57 ótengd í flokki B.)
- `felag-endurlestur.js` — **„🔁 Endurlesa öll skjöl (innihald)"** (`/api/
  felag-endurlestur`), hnappur í haus Skýrslu-stöðvar-borðsins per félag. Les ÖLL
  `customer_documents` eins base úr Drive (pdf-parse → Google-Doc OCR fallback,
  `driveFetch`-backoff), flokkar úr INNIHALDI (slökkvitæki-úttekt [Fjöldi-línur] ·
  **brunakerfi** [viðtökupróf/árleg prófun, engin slökkvitæki — NÝTT additive
  doc_type gildi, sjá `sql/2026-07-15_doc_type_brunakerfi.sql`; skýrslu-lesarar
  sía `uttektarskyrsla` svo brunakerfi-skjal hættir réttilega að teljast] ·
  reikningur [R-nr/„til greiðslu"]), les rétt ár+mánuð (Dags, ekki „Næsta
  skoðun") og með `&apply=1` leiðréttir `year`/`doc_type`/`fyrirtaeki_id`.
  Staðurinn fer gegnum Tengiregluna (`_spine.resolveSite` + `siteWriteAllowed`)
  **plús nafna-sönnun `via:'name'`** (Agnar: „endurtengja á address … eða
  heiti"): sameiginlegt forskeyti staða-nafna klippt („Center Hótel Plaza" →
  „plaza") og NÁKVÆMLEGA EITT aðgreinandi nafn í skráarheiti/PDF-texta = sönnun;
  0 eða 2+ → ósnert. Eftir lotu: nýjasta slökkvitæki-skýrsla hvers staðar →
  upsert **`arsskodun_report_facts`** (PK fyrirtaeki_id; equipment 9-bucket
  jsonb, Fjöldi-lógíkin er SAMEIGINLEG í `_bunadur.js` — líka notuð af
  `skyrsla-bunadur.js`; aldrei yfirskrifað með eldri skýrslu). **CO2-gildran
  (2026-07-16, `_bunadur.js`):** pdf-parse brýtur ₂-subscriptið í „Co₂" á eigin
  línu („Slökkvitæki Co\n2\n 2 kg. Fjöldi: …") svo línu-bundnu regexin misstu
  ALLAR CO2-línur → co2_2/co2_5 kerfisbundið 0 í facts. `normalizeText` límir
  brotið saman (+NBSP/₂), CO2-merkið þolir að „Slökkvitæki"-forskeytið vanti
  („Kolsýrutæki 5 kg") og stærðarlaus CO2-lína fer í co2_5 — aldrei tvítalin í
  duft6_12-remainder. ~184 staðir þurfa facts-endurkeyrslu eftir deploy (listi:
  co2-rerun-list, sjá PR). `GET ?base=ID[&offset&limit=2][&apply=1]` →
  `{base,total,offset,nextOffset,rows:[{id,file,verdict,year,site,via,changed}],
  counts,facts_updated}`; batchað (~8s vörn), UI lykkjar með live-log +
  localStorage framvindu (`bh_felag_endurlestur`, `rereadFelag` í index.html).
  Skráð í Sjálfvirkni sem `felag-endurlestur` (sjálfvirkt í lok apply-yfirferðar).
- `kt-samraeming.js` — **Bakendi „🧩 Kt-samræming"** (`/api/kt-samraeming`): closes the
  last gaps in the customer spine (`customers_base` root → `fyrirtaeki` locations →
  `vidskiptavinir`) **additively — never deletes/merges a location**. `GET` returns three
  worklists: **kt-less live fyrirtaeki** (no kennitala AND no `customer_base_id`),
  **multi-location kts** (one kt across >1 live `fyrirtaeki` = rekstrarfélög með marga
  staði; flags `same_address` when ≥2 sites share one address), and **vidskiptavinir gaps**
  (unlinked / no-kt). `POST` actions: `set-kt` (set `fyrirtaeki.kennitala` + find-or-create
  base by kt + link `customer_base_id`), `link-base`, `create-base` (find-or-create),
  `relabel` (fix a mislabelled site nafn/heimilisfang), `flag-note` (mark a site for review
  via `banner_note`). Bakendi card + `wireKtSamraeming` in index.html. Service role.
- `hreinsi-bord.js` — **Bakendi „🧽 Hreinsi-borð"** (`/api/hreinsi-bord`): safe, additive,
  idempotent **batch reconnect of `customer_documents` to the spine**. Never deletes a doc,
  never flags a duplicate (that stays by-eye in Skýrslu-stöð), never touches a location.
  `GET` computes preview buckets from a full snapshot; `POST {action:'apply',bucket,ids}`
  **recomputes server-side** so apply always matches the preview. Buckets: `reconnect`
  (fyrirtaeki_id null · kt-in-notes → exactly ONE live fyrirtæki → set it +base), `base_link`
  (cb null · kt already in base → set cb), `base_missing` (kt not in base → create base +
  link), `deleted_ptr` (fyrirtaeki_id → soft-deleted row → repoint to lone live sibling else
  clear, keep base), `dangling` (fyrirtaeki_id → no row → clear), `bad_year` (year <2005 or
  >next year → null). `reconnect_many` (kt → several live sites), `reconnect_conflict`
  (doc's base kt disagrees with a second kt in notes), `bad_kt` (implausible/corrupted kt
  in notes — `ktShapeValid` guards it, so a base is NEVER minted for a garbage kt), and
  `bad_year` are all COUNT/surface-only → handed to Skýrslu-stöð. **Run history (2026-07-05):**
  reconnect 372, deleted_ptr 72, dangling 1 applied live (445 docs reconnected); base_missing
  ran via SQL with the same ktShapeValid guard → 73 new `customers_base` rows (ids 962-1034,
  7 misleading auto-names reset to `kt …` placeholders) + 92 docs linked; docs-without-base
  164→72. Remaining: reconnect_many 26 · reconnect_conflict 1 · bad_kt 1 (VR-5) · bad_year 3 ·
  ~970 mangled names → all by-hand in Skýrslu-stöð. Bakendi card + `wireHreinsiBord` in
  index.html. Service role.

- `relink-docs.js` — **Bakendi „🔗 Dauðir skjala-linkar"** (`/api/relink-docs`): when
  files were MOVED into the two master folders and old copies deleted in cleanup,
  `customer_documents.drive_file_id` kept pointing at the deleted copy → dead link.
  Lists both masters (reikningar + úttektarskýrslur), builds R-number→file (reikn.)
  and kt|year(+addr)→file (skýrslur) lookups, and for every doc whose `drive_file_id`
  is NOT in a master, finds the right master file and relinks. **Multi-site guard:**
  reikningar match on the unique R-number (right file regardless of site); skýrslur of
  a **rekstrarfélag (>1 live fyrirtaeki: Pizzan/Colas)** must ALSO match the site's
  `heimilisfang` (fyrirtaeki_id) — no unique address match → „óviss", never cross-linked.
  `GET ?dry=1` → summary + FULL `ambiguous`/`unmatched` lists (each enriched: base
  nafn · site · year · dead fid · candidate master files) rendered as a picker in the
  Bakendi card. `GET ?apply=1[&flagdups=1]` → relinks (parallel chunks) + optionally
  flags collisions `is_duplicate`. `POST {action:'set',id,drive_file_id}` → manual pick
  of the right master file for one óviss/unmatched doc (409 on UNIQUE collision). NB
  Skýrslu-stöð assigns site+year but does NOT repair dead drive_file_ids — THIS does.
  Run history (2026-07-13): 149 relinked + 177→170 collisions flagged; 6 multi-site
  relinks all reikningar (0 skýrslur crossed). Bakendi card + `wireRelinkDocs` in
  index.html; redirect in netlify.toml. Service role + `_google.freshAccessToken`.
  **Recursion (2026-07-22):** `listFolder` now WALKS the master tree (subfolders
  too), so when a master is split into `<ár>/` subfolders (Skjalavörsla) a file
  living at `master/2023/…` stays in `masterIds` — otherwise relink-docs would see
  the live file as a dead link and false-cross-link it. Folders themselves are never
  returned; behaviour is identical when there are no subfolders.

- `drive-dedup.js` — **Bakendi „🗂️ Drive tvítekningar"** (`/api/drive-dedup`): pick any
  Drive folder → lists files with **duplicate names** (groups by name with the extension
  and a trailing `(1)/(2)` copy-suffix stripped, case-folded). `GET ?folder=ID[&cap=N]`
  returns the duplicate groups (one keeper per name — prefers the copy WITHOUT a `(n)`
  suffix, else oldest `createdTime` — plus the extra copies to move); `cap=100` stops after
  the first 100 duplicate files. Human-in-the-loop: the UI shows the list for confirmation,
  then `POST {action:'move', fileIds:[…], trashFolder}` **moves** (never deletes) each copy
  into the bin folder (default `1CnnNHm1xCukiTs806z9Ha1nZnSELM9k8`) via Drive
  `files.update` (addParents=trash, removeParents=current). Reuses `_google.freshAccessToken`.

- `drive-sort.js` — **Bakendi „🧹 Drive-flokkun"** (`/api/drive-sort`): resilient,
  slow-&-steady pipeline for a messy source folder of mixed PDFs. `GET
  ?src=&master=&reports=&dupes=&other=[&limit=2][&rename=1][&dry=1]` reads a FEW
  files per call with the **OCR reader** (pdf-parse → Google-Doc OCR fallback, the
  reliable path for dkPlus PDFs) and MOVES each immediately, so a freeze never loses
  more than the file in hand (resumable — sorted files leave `src`). Only
  **Slökkvitæki-issued** docs (issuer kt 600508-0400) are kept: reikningur (has an
  R-number) → rename → master + link `customer_documents`; úttektarskýrsla (report
  wording, no R-nr) → rename → reports + link (doc_type `uttektarskyrsla`); a copy of
  an already-recorded doc → dupes (delete folder); everything else (vendor bókhald,
  Nóta, mbox, …) → other (óflokkað). Dedup by invoice number (reikn.) or (base,year)
  (skýrsla). Reuses `_google.freshAccessToken`. UI loops 2-at-a-time until `done`.
  **Subfolders (2026-07-05):** `recurse` (default ON) walks the whole folder tree
  — files anywhere under `src` get sorted (each keeps its own `parents`, so a move
  lifts it straight out of its subfolder); `done` covers the whole tree. `recurse=0`
  restores flat, direct-children-only behaviour. Folders themselves are never moved.
  **Tengist líka á STAÐINN** (2026-07-15): báðar greinar (skýrsla + reikningur) nota
  `_spine.resolveSite` (skýrslur fá `siteFrom(text)` sem auka-sönnun) og skrifa
  `fyrirtaeki_id` aðeins gegnum `siteWriteAllowed`; endurnefnd skýrsla með þekktan
  stað fær ` - #<fyrirtaeki_id>` stimpilinn aftast (reikninga-nafnasniðið óbreytt —
  R-nr er lykillinn).

- `drive-multitool.js` — **Bakendi „🧰 Skjala-multitool"** (`/api/drive-multitool`):
  sameinaða skjala-tólið — READ **og** WRITE, tveir hamir sem sameina með tímanum
  Skjalalestur · Drive-flokkun · Drive tvítekningar · Endurnefna skýrslur · Skjalavörsla.
  Endurnýtir sönnuðu frumaðgerðir drive-sort (move/rename via `files.update`,
  `upsertDoc`, dedup-uppfletting) + `_spine` (`sitesForBase`/`resolveSite`/
  `siteWriteAllowed`/`siteStampFromName`).
  - **Fasi 1 — GET (les-eingöngu forskoðun):** `?src=&recurse=&limit=3&offset=N[&order=]`
    → OCR-flokkar hvert PDF og skilar TILLÖGU per skrá (`doc_type · base/site ·
    proposed_name · target · already_linked`). FÆRIR EKKERT, SKRIFAR EKKERT.
    `order` (UI-veljari „Röð", geymt í `localStorage.multitool_order_v1`): `name`
    (sjálfg. A→Ö) · `new` (nýjast BÆTT við fyrst, createdTime desc) · `name-desc`
    (öfug nöfn). `new` gerir kleift að lesa AÐEINS nýbættar skrár (t.d. 100 nýjar í
    1100-skjala möppu) án þess að endur-OCR-a allt — `createdTime` bætt í fields.
  - **Fasi 2 — POST `{action:'apply', id, doc_type, base_id, year, invoice_number,
    site_id, proposed_name, targetFolder, linkMode}`** (eyðileggjandi, EITT skjal
    sem UI rekur af yfirfarnu forskoðuninni — aldrei blint bulk-sweep): (1)
    endurnefnir í `proposed_name`, (2) **FÆRIR** (relocate) í `targetFolder` gegnum
    `files.update` addParents/removeParents, (3) tengir `customer_documents` eftir
    `linkMode`. Endurnefning+færsla gerast óháð `linkMode`; aðeins DB-tengingin er
    hlið-stýrð. Skilar `{ok, id, renamed, moved, linked, linkAction, conflict, doc_id}`.
  - **`linkMode` (þrír hamir):** `warn` (SJÁLFGEFIÐ, öruggast) — ef tengill fyrir
    lykilinn er þegar til á ANNARRI skrá → `conflict:true, linkAction:'conflict'`,
    EKKERT tengt (skrifar aldrei í hljóði; UI birtir mannin til að leysa). `if_empty`
    — tengir aðeins ef enginn tengill er til; annars `linkAction:'skipped_exists'`,
    ósnert. `overwrite` — beinir fyrirliggjandi lykil-röð á ÞESSA skrá (fall-back
    upsert á `drive_file_id` við einkvæmnisárekstur). Lykill = `invoice_number`
    (reikningur) · `(customer_base_id, doc_type, year)` [+ `fyrirtaeki_id` fyrir
    rekstrarfélag með >1 lifandi stað] (skýrsla/brunakerfi/samningur).
  - **Öryggis-samningur (allur útfærður):** ekkert án `action:'apply'`+`id` (GET
    er les-eingöngu); **ALDREI `files.delete`** — tvítök eru FÆRÐ í ruslmöppu;
    idempotent (rétt nafn→engin endurnefning · þegar í markmöppu→engin færsla ·
    upsert á `drive_file_id`); `vendor`/`other` hvorki færð né tengd nema UI sendi
    þeim markmöppu vísvitandi (og ALDREI tengd í customer_documents); markmöppu
    vantar → færsla sleppt (endurnefna+tengja samt); hver villa skilar
    `{ok:false,error}` fyrir ÞÁ skrá (kastar aldrei hálf-kláruðu); hvert apply skráð
    í **`override_log`** (`field='multitool_apply'`, old=upphaflegt nafn,
    new=proposed+target+linkAction). Hæsta áhætta: rangur `linkMode:'overwrite'`
    beinir lykil-röð á ranga skrá — því er `warn` sjálfgefið og aldrei skrifað án
    ótvíræðs vals; jafnvel þá er skráin bara FÆRÐ (afturkræft), ekkert eytt.
  - **UI (Bakendi-spjaldið):** linkMode-rofi (warn sjálfgefinn), markmöppu-reitir per
    tegund (reikningar-master · skýrslur · samningar · **brunakerfisskýrslur** ·
    **brunakerfis reikningar** · rusl, með 📁 Velja picker), hak per röð (sjálfgefið
    valið fyrir okkar tegundir; vendor/other/villa afvalin+óvirk) + „▶️ Keyra valið (N)"
    sem POST-ar valdar raðir í röð (samhliðni ≤2) með lifandi framvindu + niðurstöðu
    per röð (✓ fært+tengt / ⚠ árekstur / ✗ villa / — sleppt) + „⏸ Stöðva"; virðir
    „Stöðva eftir N" þakið. **Skrá-nafnið í forskoðuninni er tengill** → opnar PDF-ið í
    Drive (`drive.google.com/file/d/<id>/view`) svo hægt sé að skoða skjalið fyrir apply.
  - **Brunakerfi — TVÆR markmöppur (2026-07-26):** skýrslur (doc_type `brunakerfi` →
    target `brunakerfi-skýrslur`) og reikningar (doc_type `reikningur` + sub_hint
    `brunakerfi-reikningur` → target `brunakerfi-reikningar`) fara í SITT hvora möppuna;
    brunakerfis-reikningur fellur á reikningar-master ef sú mappa er ekki fyllt.
    Brunakerfis-reikningur greinist AÐEINS á sterku fire-alarm-orðalagi
    (`brunaviðvörunarkerfi`/`ársskoðun brunakerfis`/`brunakerfis…`) — ekki hverju stöku
    „brunakerfi"-orði. Samningar fá nafn `Fyrirtæki - kt - (þjónustu|brunakerfis)samningur - ár`.
  - **Kaupanda-kt (2026-07-26):** `customerKt` sleppir NÚ bæði útgefanda-kt (600508-0400)
    OG kt undirritaðs Slökkvitæki-fulltrúa („Fyrir hönd Slökkvitækja ehf … Frank Höybye
    kt: 080379-5019" er ekki kúnninn) og kýs kt í kaupanda-blokk („Nafn: <félag> … kt:").
    `allKts` þolir bil við bandstrik („510809 - 0170" úr form-línum).
  - **Tvítök (2026-07-26):** UI hópar raðir eftir tillögu-nafni; aukaeintök (sama nafn)
    fá 🔁-merki + „🗑 Færa aukaeintök í rusl"-hnapp. POST `{action:'move-dupe', id,
    targetFolder}` FÆRIR eintakið í ruslmöppu (engin endurnefning/tenging/eyðing, afturkræft;
    heldur einu — helst þegar-tengda — í hverjum hópi). Skráð í override_log.
  - **Standalone-síða `multitool.html` (2026-07-26):** full-breidd útgáfa á eigin síðu
    (`brunaholf.netlify.app/multitool.html`, tengt af Bakendi-spjaldinu) af því tólið var
    of þröngt í 2-dálka Bakendi-grindinni (nöfn ólæsileg). Tveggja-glugga útlit: vinstra
    megin skjala-listinn (full breidd, læsileg nöfn), hægra megin **PDF-forskoðun í iframe**
    (`drive.google.com/file/d/<id>/preview`) sem uppfærist við að smella á röð eða fletta
    með ◀ ▶ / örvatökkum. Sami `/api/drive-multitool` endapunktur + sama apply-lógík
    (linkMode, markmöppur, Keyra valið ≤2 samhliða). Auka: **möppu-tenglar** (localStorage
    `multitool_folders_v1`) — vista Drive-möppur sem flýtileiðir (setja sem uppsprettu +
    forskoða / opna í Drive) til að skipuleggja. Bakendi-spjaldið er áfram til en vísar á síðuna.
    **Líka innfelldur SPA-flipi `multitool`** (🗂️ Skjala-multitool í hliðarstiku, fyrir ofan
    Bakendi; `renderMultitool` fellir `/multitool.html` inn í `#view` sem full-hæðar iframe —
    endurnýtir sömu síðu, enginn tvíverknaður). Bætt í `DEFAULT_STATE.tabs` + `ensureNewTabs`
    + dispatcher eins og aðrir flipar; deep-link `#multitool`.
  - **Röðun + fljót tvítaka-hreinsun + edit-vernd (2026-07-27):** „Röð"-veljari
    (`?order=name|new|name-desc`, geymt í `localStorage.multitool_order_v1`) — `new`
    (createdTime desc) les AÐEINS nýbættar skrár svo ekki þarf að endur-OCR-a allt.
    „🗂️ Tvítök (nöfn)"-hnappur opnar glugga sem endurnýtir `/api/drive-dedup` (les BARA
    nöfn, engin OCR, strípar `(1)/(2)`, færir aukaeintök í rusl — sjá drive-dedup.js).
    `paint()` varðveitir nú ó-vistaðar breytingar í opnum „✏️ Leiðrétta"-ritli (`__draft*`)
    + fókus/bendil við endur-teikningu, svo næsta forskoðunar-lota sópi þeim ekki burt.
    „ekki tengt" statusinn er rauð pilla (⛔).
  - **Leiðréttingar + villuskýrsla (2026-07-26):** hver forskoðunar-röð fær „✏️ Leiðrétta"
    hnapp sem opnar innfelldan ritil (Tegund · Ár · Nafn · Athugasemd). „💾 Vista leiðréttingu"
    (1) uppfærir röðina svo „Keyra valið" noti leiðréttu gildin (breytt tegund → ný markmappa
    gegnum `TARGET_LBL`, `site_id` hreinsað ef ekki-okkar tegund) OG (2) skráir í nýja töflu
    **`multitool_corrections`** (tillaga tólsins vs leiðrétting notandans + athugasemd; service
    role skrifar, RLS af). POST `{action:'log-correction', …}` snertir EKKERT í Drive — bara
    skráning. „📋 Leiðréttingaskrá" hnappur efst opnar viewer (`GET ?corrections=1&limit=N`,
    nýjast fyrst) svo hægt sé að yfirfara og stilla flokkarann/nafnasmíðina út frá raunverulegum
    villum. Ritillinn breytir röðinni AÐEINS við vistun (án vistunar → apply notar upprunalegu
    tillöguna, engin þögul gliðnun). NB v1 leiðréttir nafn/tegund/ár — base/staðar-tenging er
    áfram Skýrslu-stöðvar-verk.
  - **Gamlir „Stolpi"-reikningar greindir sem OKKAR (2026-07-26):** Slökkvitæki-útgefnir
    reikningar úr gamla Stolpi-kerfinu (skráarnöfn eins og `…bokhald-Nóta.pdf` /
    `Stolpi_Invoice_10xxxx.pdf`) lentu ranglega í vendor/óflokkað því `slokkviIssuer`
    náði ekki seljanda-merkinu í OCR. Hert: (1) `slokkviIssuer` þolir bert `98107`
    (seljanda-VSK, OCR sleppir stundum „VSK nr."-forskeytinu — kaupanda-VSK er ALDREI
    prentað svo 98107 = við erum seljandi, óhætt) OG fellur á Slökkvitæki-þjónustulínur
    (`slokkviServiceLines ≥2`: léttvatn · skýrslugerð og vottun · yfirferð/hleðsla
    Co2/duft/kolsýra · handslökkvitæki — okkar vörulisti, birt AÐEINS á reikningi sem
    VIÐ gefum út). (2) Ný classify-grein 2b: `!inv && issuerOurs && „reikningur"-orðalag
    && !isReport` → reikningur (invoice_number null) svo hann lendi í reikningar-master
    + tengist þótt R-nr misfórst í OCR. ÖRUGGT: issuerOurs er seljanda-eingöngu, svo
    birgja-reikningur TIL okkar (ber okkar kt í kaupanda-blokk en hvorki 98107 né
    þjónustulínur) helst vendor. Sannreynt á Babalú R-104339 (hreint + gallað OCR) +
    mótdæmi (birgja-reikningur → áfram vendor). **Hert (Agnar 2026-07-26):** veika
    þjónustulínu-fallbackið (`slokkviServiceLines ≥2`) krefst NÚ að **Akstur EÐA
    Skýrslugerð** sé á reikningnum (`hasAksturOrSkyrsla`) — þessar tvær einkennislínur
    eru á nær öllum okkar þjónustureikningum en aldrei á birgja-reikningi til okkar.
    98107-seljanda-merkið stendur áfram eitt sér (óháð þessu).
  - **„Annað / óflokkað"-markmappa (2026-07-26):** nýr markmöppu-reitur `tf-annad`
    (📦 docs · sheets · innkaup) fyrir vendor/other skjöl. `targetFor` beinir
    vendor+other þangað; þegar reiturinn er fylltur verða vendor/other raðir VALANLEGAR
    (opt-in, sjálfgefið ÓVALIÐ — okkar tegundir áfram sjálfvaldar) svo hægt sé að SÓPA
    óskyldum birgja-/bókhalds-/innkaupa-skjölum í eina Annað-möppu. Bakendinn færir
    vendor/other AÐEINS þegar markmappa fylgir og TENGIR þau ALDREI í customer_documents
    (óbreyttur öryggis-samningur). Reiturinn geymist í `localStorage.multitool_tf_annad_v1`.

- `drive-count.js` — **Bakendi „📊 Skjalatalning"** (`/api/drive-count`): read-only
  file counter for the reikningar (master) + skýrslur Drive folders, broken down
  **per year** (parsed from each file name via a `20\d\d` / date regex). `GET
  ?reikningar=<id>&skyrslur=<id>[&recurse=0]` walks each folder tree (recurse
  default ON), tallies non-folder files by year, returns
  `{ folders:{ reikningar:{total,pdf,subfolders,byYear}, skyrslur:{…} } }`. UI is a
  per-year table + a „↻ Uppfæra talningu" manual-refresh button (defaults to the
  Drive-flokkun master/reports folder ids). No move, no DB write.
- `skyrslu-ar.js` — **Bakendi „🔎 Lesa ár á skýrslur án árs"** (`/api/skyrslu-ar`):
  many úttektarskýrslu file names carry NO date (`Torfufell 50 111 Reykjavík -
  481074-1349.pdf`) → counted as „óþekkt". These reports are app-generated PDFs
  with a real TEXT LAYER (`…yfirfarin af Slökkvitæki ehf í nóvember 2025`), so this
  reads the date with **pdf-parse (NO OCR — no Google-Doc copy)** and **renames**
  the file appending „ - <ár> - <mánuður>" (same „Dags"/„{mánuður} {ár}"-not-„Næsta
  skoðun" logic as `uttekt-rename`). Batched (`?limit=4`, default folder = skýrslur);
  the Skjalatalning card loops it until done, then re-counts. Read + rename only.
- `skjalavarsla.js` — **Bakendi „🗂️ Skjalavörsla"** (`/api/skjalavarsla`): files every
  doc into a `<ár>/` subfolder (2024/, 2025/…, óþekkt/) under a canonical folder by
  the **year in its NAME** (cheap — NO OCR, NO rename). Optional `src` = an old folder
  → its files are **moved** into `dest/<ár>/` (names KEPT, so well-named files are not
  downgraded). `GET ?dest=<canonical>[&src=<old>][&dupes=<bin>][&limit=20][&dry=1]`,
  batched; the UI loops with 👁 dry preview + ▶️ run. **Dedup is by exact filename
  within a year folder** — so multi-address kts (rekstrarfélög with several sites, whose
  names carry different addresses) are NEVER collapsed; only true same-name copies go to
  the bin. NB it trusts the filename year; run `skyrslu-ar` (and any OCR-rename) FIRST so
  names are reliable before filing.
- `pdf-split.js` — **Bakendi „✂️ Skipta PDF í stakar síður"** (`/api/pdf-split`): splits a
  big Drive PDF (e.g. 70 pages) into one-page PDFs written BACK to Drive, into a new
  `„<nafn> - stakar"` subfolder beside the source (or under a given `dest`). `GET
  ?file=<id|url>[&dest=<parentFolder>][&folder=<destSubfolder>][&offset=N][&limit=M]`
  — batched/resumable like drive-sort (first call creates the subfolder + returns its
  id; UI loops passing `folder`+`nextOffset` until `done`, ~8 pages/call). Uses
  `pdf-lib` (added to deps + `external_node_modules`) + `_google.freshAccessToken`;
  re-reads the (small/medium) source per batch; read+create+upload only, no DB. The
  Bakendi card also has a **local browser mode** (úr tölvu → ZIP) via client-side
  `pdf-lib`+`JSZip` — no Drive, nothing sent to the server.

---

*Kaflarnir hér fyrir neðan voru fluttir orðrétt úr `CLAUDE.md` 2026-08-19
(verkefnalisti 22a44bdc) — sama efni, nýr staður.*

## customer.html — skjalatenglar benda á Supabase (2026-08-07)

`/api/customer` byggði `view_url` EINGÖNGU úr `drive_file_id`, þótt röðin ætti
`storage_path`. Mælt á lifandi gögnum 2026-08-07 (alls 3.590 raðir):

| | |
|---|---|
| Aðeins Drive | 2.626 |
| **Aðeins Storage** | **241** ← sýndust „án Drive-tengingar", skráin samt til |
| Bæði | 287 |
| **Hvorugt** (draugaraðir) | **436** |

Nýtt `docViewUrl(d)` í `customer.js` — sama rökfræði og `openUrl` í
`service-gaps.js` en með **Supabase á undan Drive**: `storage_path` er stöðug slóð
sem rofnar ekki við endurnefningu og krefst engrar Google-innskráningar, á meðan
Drive-hlekkur er skráarauðkenni sem rofnar (793 mældir dauðir — sjá
`docs/SKJALA-FLUTNINGUR.md`). Þau 287 sem eiga BÁÐA opnast því á örugga eintakinu.
Ekkert er flutt eða endurnefnt og engu eytt í Drive; `drive_file_id` stendur áfram
í svarinu. `link_source` (`'storage'|'drive'|null`) fylgir með svo viðmótið geti
sagt hvaðan skráin kemur (birt í `title` á tenglinum).

⚠️ `storage_path` ber bucket-nafnið sjálft (allar 528 raðir byrja á `samningar/`,
sem er public bucket) — ALDREI bæta bucket-forskeyti við slóðina.

`summary.missing_drive_file_id` → **`summary.missing_file`**, og telur nú aðeins
raðir með HVORUGA uppsprettu (draugaraðirnar, varnagli 3 í SKJALA-FLUTNINGUR).
Gamla talan gaf falskt viðvörunarflagg á skjöl sem áttu fína Supabase-skrá.
Sama leiðrétting í `docLink()` í `customer.html`: „engin Drive-tenging" →
„engin skrá".

Þetta er hlekkja-lagfæring á framsetningu, ekki Fasi 0 — hún nær aðeins til raða
sem ERU í `customer_documents`. Þau ~1.534 storage-hlutir sem eiga enga röð eru
enn ósóttir (Fasi 0 í `docs/SKJALA-FLUTNINGUR.md`).

## Ártals-lesarinn í Drive-föllunum (2026-08-07)

`yearFrom`/`yearFromName` er afritað í FIMM skrár (`drive-count`, `skyrslu-ar`,
`drive-sort`, `drive-multitool`, `doc-index`) og útgáfurnar höfðu rekið í sundur.
Tvennt lagað — báðar breytingar eru á lestri, engin skrá hreyfð:

- **`_` telst nú sem bil.** Innsog sem kemur ekki frá Drive-flokkuninni skrifar
  `Tangarbryggja_2024.pdf`; `_` er orðstafur svo hvorki bandstriks-liðurinn né
  „stakt 20xx umlukið bilum" sá ártalið. Mælt: **31 af 56** ártalslausum skrám í
  Úttektarskýrslur-möppunni lagast, þar af 4 frá 2026 (einstök 2026-skjöl 243 → 247).
- **`drive-sort` fjarlægir nú kennitölu fyrst**, eins og `drive-multitool` gerði
  þegar. Kt endar oft á gildu ártali (`500993-2009`) og var lesin sem ÁRIÐ. Það var
  verst í `drive-sort` af öllum stöðunum, því þar ræður talan í hvaða ár-möppu skrá
  er FÆRÐ. Mælt: 12 fyrirtæki eiga slíka kt, 6 þeirra í þjónustu. Bæði föllin fengu
  líka þak (`2008..nú+1`) sem `drive-multitool` vantaði.

⚠️ Eftir stendur meðvitað frávik: `drive-sort`/`drive-multitool` lesa
dagsetningarforskeyti (`2024-03-11 nóta.pdf`), `drive-count`/`skyrslu-ar` ekki.
Það er eldra en þessi lagfæring og snertir reikninganöfn, ekki skýrslur.

**Ef þú breytir einu þeirra, breyttu hinum.** Ósamræmi milli `skyrslu-ar` og
`drive-count` þýðir að skrá sem á ártal fyrir fer samt í endurnefningu.

## Eyðublöð — skjalasmiðja með útgáfusögu (2026-08-06)

Nýr flipi **`eydublod`** + sjálfstæð síða `eydublod.html` (sama iframe-mynstur og
`multitool`/`pdftools`; `renderEydublod(t)` í index.html). Býr til útprentanleg
skjöl til verkkaupa. Fyrsta eyðublaðið: **„Yfirlýsing vegna brunalokana"**.

- **Stafrétt eftirmynd af Word-frumritinu.** Uppsetningin er lesin beint úr
  `Staðfesting_Keldur31072026.docx` — ekki ágiskuð: US Letter 8,5×11in, spássía
  1in, grunnletur Aptos 11pt (`docDefaults`), meginmál **Calibri 12pt** (sz 24),
  fyrirsögn Calibri 14pt feitletruð miðjuð (sz 28), línubil 1,15 (`line 276`),
  bil á eftir málsgrein 0, punktar `●` með 0,5in inndrætti og 0,25in hangandi,
  haus með merki 2,04×0,49in miðjuðu og línu undir, undirskrift 4,39×1,06in.
  ATH: þrjár „Hvað var gert"-línurnar eru á grunnletrinu (11pt) í frumritinu, ekki
  Calibri 12pt — það er hermt eftir viljandi.
- **Myndirnar eru úr frumritinu**: `img/yfirlysing-logo.jpg` (merkið, `word/media/
  image2.jpg`) og `img/undirskrift-annthor.png` (undirskrift Annþórs, `image1.png`).
  ⚠️ Báðar eru sóttanlegar opinberlega því `publish = "."` — loka má á þær með
  redirect-reglu þegar innskráningin kemur (sjá „Open work").
- **Ritað BEINT ofan í skjalið** (`contenteditable` per svæði). Hliðarstikan geymir
  aðeins það sem er ekki í skjalinu: dagsetningarval, `byggingar`, `sveitarfelag`
  og undirskriftarflötinn. Sjálfvirku setningarnar tvær („Um ræðir…" og
  niðurstaðan) skrifa sig út frá byggingunum og hætta því um leið og notandinn
  skrifar ofan í þær. Vantar byggingarnúmer (t.d. „Rekstrarfélag Kringlunnar,
  Útisvæði – Kúmen 07-009-222") er efnið sótt í fyrirsögnina á eftir kommunni.
- **Gulu svæðin** = nákvæmlega þau sem Agnar strikaði gul á fyrirmyndinni. Rofinn
  „Sýna breytileg svæði" kveikir/slekkur; prentast aldrei.
- **PDF**: `js/jspdf.umd.min.js` (vistað í repo-inu, EKKI cdnjs — PDF-inn er
  afurðin og má ekki detta út þótt CDN sé niðri) + `fonts/carlito-*.ttf`
  (OFL, málsamhæft við Calibri, hlutmengjað í latínu+íslensku svo hver PDF er
  ~140 KB). Vektor, leitanlegur texti, réttir íslenskir stafir.
  ⚠️ Google Fonts skilar Carlito-skránum í röðinni *italic, bold-italic, regular,
  bold* — bold/italic víxluðust í fyrstu atrennu. Staðfestu alltaf með
  `TTFont(p)['name'].getDebugName(4)` ef skipt er um leturskrár.
- **Geymsla + útgáfur**: tafla `eydublod_skjol` + public fatan `eydublod`
  (`sql/2026-08-06_eydublod.sql`), endapunktur `netlify/functions/eydublod.js`
  (`/api/eydublod`, ríður `/api/*` catch-all). `gogn` (jsonb) geymir REITAGILDIN —
  þau eru uppspretta sannleikans, svo hægt er að opna skjal, breyta og vista sem
  NÝJA útgáfu. `skjal_id` heldur útgáfunum saman, `utgafa` telur upp; hver útgáfa
  fær sinn eigin storage-hlut svo eldri PDF (þegar farinn til verkkaupa) er
  ALDREI skrifaður yfir. GET skilar nýjustu útgáfu per skjal (`?all=1` fyrir allar).
- **A4, ekki Letter (2026-08-07)**: frumritið var US Letter (Word-sjálfgildi) en
  hér er prentað á A4 — `@page{size:A4}`, `.doc{width:210mm}` og jsPDF
  `format:'a4'` (595,28×841,89pt). Spássían er áfram 1in.
- **Línubil er stillanlegt (2026-08-07)**: Agnar bað um rýmra bil en frumritsins
  1,15. Sjálfgefið **1,5**, geymt í `values.linubil` svo það fylgi skjalinu og
  vistist með því. Stillt á EINUM stað — `--lh` (CSS) og `LH` (PDF) lesa bæði
  sama gildi; ekki hardkóða línubil aftur.
  **„📄 Passa á eina síðu"** (`passaEinaSidu()`) prófar bilið frá völdu gildi
  niður í 1,0 í 0,05-þrepum og velur það STÆRSTA sem heldur skjalinu á einni
  síðu — byggir PDF í hverri umferð því það er eina örugga mælingin (HTML-
  forskoðunin brýtur línur ekki alltaf eins). Leturskrárnar eru í `_fontCache`
  svo umferðirnar séu ódýrar. Dæmi: Kringlan-skjalið fer úr 2 síðum í 1 við 1,35.
- **Kveðjublokkin er ein heild**: „Með kveðju / FH. Brunahólf ehf. / nafn /
  undirskrift" fær `P.need(...)` á undan sér svo undirskriftin slitni ALDREI
  frá nafninu yfir á næstu síðu.
- **Cache-gildra (2026-08-07)**: iframe-ar endurnýta vistað eintak án þess að
  spyrja þjóninn, svo Agnar sat fastur á gamalli útgáfu eftir deploy og hélt að
  breytingarnar virkuðu ekki. Hub-inn hleður núna `/eydublod.html?v=<Date.now()>`
  (alltaf ferskt; síðan er ~60 KB, þungu skrárnar cachast áfram). Síðan sýnir
  líka `UTGAFA` í hausnum — **bumpaðu því við hverja breytingu**, það er eina
  leiðin til að sjá strax hvort vafrinn situr á gömlu eintaki.
- **Nýtt eyðublað** = einn hlutur í `FORMS`-fylkinu í `eydublod.html`
  (`id/titill/lysing/sections/doc(v,E)/pdf(v,P)`) — sjá leiðbeiningarnar í
  haus-athugasemdinni þar. Engin bakenda-breyting þarf; `form_id` er frjálst.

## Samningar mega bera ár (2026-08-11)

Agnar: „multitool use the year in the name that I want — to have when it was
registered.. but something in the system dont want files with years within the
filename." **„Eitthvað í kerfinu" var CHECK-reglan `customer_documents_year_shape`**,
sem krafðist `year IS NULL` á `doc_type='samningur'`.

Samningar BERA ártal í raunveruleikanum (endurnýjunarár — sjá Samningar-möppuna:
„… - þjónustusamningur - 2026.pdf"). Reglan var því röng forsenda, ekki vörn, og
braut þrennt í hljóði:

1. **`samningar-read.js`** sendir `year` á samning → `23514 check_violation` →
   samningurinn skráðist ALDREI þegar heitið bar ártal.
2. **`drive-multitool.js`** neyddist til að henda árinu (`rowYear = null`) og
   geyma það í `notes` í staðinn. Mælt: **146 af 204** multitool-samningum báru
   ártal í notes, **0** í `year`-dálknum.
3. **`findExistingLink`** síar á `year=eq.<ár>`. Þar sem hver geymdur samningur
   hafði `year=NULL` fann sú fyrirspurn ALDREI fyrirliggjandi samning → hvert
   sweep bjó til NÝJA röð. Tvítök: Thai Lindin 5 raðir, Center Hótel 4,
   Húsfélagið Stakkholt 2-4 4, Prikið 3, Suðurhella 9 3.
4. **`match-station`** deduppar samninga á `(staður, ár)`; með ár alltaf NULL
   féllu ALLIR samningar staðarins í einn hóp.

Migration `allow_year_on_samningur` rýmkar regluna: samningur MÁ hafa ár (áfram
valfrjálst svo eldri NULL-raðir standist). Vörnin sem skiptir máli heldur —
`uttektarskyrsla`/`reikningur` VERÐA áfram að hafa ár (prófað: innsetning án árs
er enn hafnað).

Bakfyllt: 146 ártöl endurheimt úr `notes` (2008–2026). 212 samningar eru enn án
árs — nöfn þeirra bera ekkert ártal.

⚠️ **`findExistingLink` leyfir `year.is.null` LÍKA fyrir samninga.** Samningar
skráðir fyrir þessa breytingu eiga `year=NULL`; hrein árs-sía sæi þá ekki og
byggi til nýja röð — sama tvítaka-hegðun og var verið að laga. Ekki herða þetta
í hreina árs-jöfnun fyrr en bakfyllingin nær til allra.

## Skjala-multitool — ⚙️ Stillingar, staðgreitt og sóttkví (2026-08-12)

**⚙️ Stillingar** (modal í `multitool.html`) er nú EINI staðurinn fyrir lestrar-
stillingar (undirmöppur/þak/röð) og markmöppurnar — þær voru áður á aðal-skjánum og
í keyrslu-boxinu. Vistast í `localStorage.multitool_settings_v1` OG í `app_kv`
gegnum `/api/app-state` (`multitool_settings` bætt í `ALLOWED_KEYS`) svo þær fylgi
milli vélanna fjögurra. **Bættu nýrri stillingu við á EINUM stað** — `SET_FIELDS`
fylkið sér um lestur/vistun/endurheimt sjálfkrafa.

**💵 Staðgreitt.** Nóta með kt `999999-9999` EÐA „Greiðsl.skilm.: Staðgreiðsla" fær
eigin `doc_type='stadgreitt'`, eigin möppu, og er **aldrei** tengd í
`customer_documents` (hún er ekki í `LINKABLE`) — kt 999999-9999 er walk-in
staðgengillinn (`customers_base` 870 „Staðgreitt"), ekki viðskiptavinur.

⚠️ **Yfirskriftin má ekki hverfa:** beri nótan **Akstur** OG **Skýrslugerð (og
vottun)** er hún úttektarreikningur þrátt fyrir staðgreiðsluna — við keyrðum á
staðinn og skrifuðum skýrslu (Agnar 2026-08-12, R-108017 Álfaskeið 104). Búðarsala
yfir borðið ber hvoruga línuna (R-107962: bara „Hleðsla Léttvatn").

⚠️ **Merkið er lesið úr ORÐINU, ekki merkimiðanum.** OCR ruglar dálkunum á dkPlus-
nótu svo „Greiðsl.skilm.:" og „Staðgreiðsla" lenda á sitt hvorri línunni — regla sem
festir sig við merkimiðann finnur ekkert. Staðfest á hráum OCR-texta R-107962.

**✏️ Möppuheitið er ekki félagsnafn.** Lotu-skönnun skrifar „`<möppuheiti> - bls
NNN.pdf`" á hverja síðu; `companyFromStem` las því möppuna sem kaupandann á HVERJUM
reikningi í bunkanum („mars-mai stolpi - Skeiðarvogi 159 - …"). `sameAsFolder` hafnar
nú möppuheiti sem félagsnafni og `nameInvoice` lætur heimilisfangið leiða þegar félag
vantar. „Óþekkt" stendur aðeins eftir þegar hvorugt er til.

**📂 Þrír útkomu-hamir** (radio `outmode`):
- `master` — óbreytt: endurnefnir, færir í meistaramöppurnar, tengir.
- `quarantine` — **sóttkví**: raðar í undirmöppur INNI Í lesmöppunni og tengir ekkert.
- `presort` — **reikninga-forflokkun**: skiptir bunka af nótum AÐEINS í tvennt
  (💵 Staðgreiðslunótur / 📄 Úttektarnótur + 📦 Annað) og telur skiptinguna.

`POST {action:'quarantine-folders', src, mode}` býr möppurnar til (idempotent);
`noLink` í `apply` sleppir gagnagrunns-skrefinu. Hver röð sýnir `stad_signal` /
`stad_override` sem merki, svo flokkunin sé sannreynanleg í listanum án þess að opna
PDF-ið. Sóttkví/forflokkun færa ALDREI út fyrir lesmöppuna — vantar möppurnar er
markmappan tóm og ekkert færist.

## 📋 Skráalisti (2026-08-12)

`skraalisti.html` + `netlify/functions/drive-filelist.js` + flipi `skraalisti`.
Telur Drive-möppu, listar öll skráarheiti, flytur út í CSV/Google Sheets og ber
**tvær möppur saman** til að finna hvað vantar. **Engin OCR, engin flokkun, engin
tenging** — þess vegna ræður það við möppur með þúsundum skráa (multitoolið er
mínútur á sama gagni) og þess vegna er GET-ið hættulaust.

⚠️ **Samanburðurinn stendur og fellur með lyklinum.** Sama skjal ber sjaldnast sama
heiti í tveimur möppum. Reikningsnúmera-lykillinn les því ÞRJÁR ritvenjur — `R-107962`,
`Stolpi_Invoice_107962` og bert `1xxxxx` — af því samanburðurinn sem raunverulega er
gerður er hrátt dkPlus-heiti á móti endurnefndu. Læsi hann aðeins „R-"-formið teldist
hvert óendurnefnt skjal „vantar". Kennitölur eru teknar út ÁÐUR en bert númer er lesið,
en með þéttri reglu (`\d{6}-\d{4}` eða `\d{10}`) — lausari regla gleypti „R-106741 -
2025" sem kennitölu og skildi merkta númerið eftir ólesið.

Skrár án lykils eru merktar „lykil vantar" og taldar **hvorki** samsvörun né mismunur.
