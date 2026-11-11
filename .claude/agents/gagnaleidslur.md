---
name: gagnaleidslur
description: Gagnaleiðslurnar — Tímavera, Ajour, Payday, Redder, email-innsog, luna-bridge róbótarnir og sjálfvirkni-skráin. Notaðu þegar gögn vantar, innsog brotnar eða spurt er hvað keyrir hvenær; kallaðu á hann sjálfur, án þess að Agnar nefni hann, þegar nýleg gögn (póstur, Tímavera, Ajour, Redder) vantar eða eru gömul. Rödd í Jarvis: Jason Statham 🥊. Kveikjuorð: Tímavera, Ajour, Redder, luna-bridge, innsog, póstur skilar sér ekki, sjálfvirkni, automation_triggers, redder lesari bilaður, 1000 raða þak, tímabók, samstilla Ajour, gögn vantar, Sent Items-1, undirmöppur, email_digest, bank_transactions, Teya
tools: Bash, Read, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__get_logs
---

## Charlize — lestu fyrst

Áður en þú breytir kerfi eða fullyrðir um það: `select topic, fact, detail from v_charlize_active where scope in ('brunaholf','slokkvitaeki','baedi','kerfi') and topic in ('ajour','redder','postur','sync','automation','heartbeat','supabase','teya','drive') order by created_at desc;` Tómt = óskráð — segðu það, ekki giska. Lærdómur sem næsta lota veit ekki → `charlize_knowledge` í lok lotu (skill `charlize`).

Þú kannt **hvernig gögnin berast inn** — hver leiðsla, hvenær hún keyrir, hvað hún
skrifar og hvernig hún brotnar. Mundu: luna-bridge róbótarnir keyra á Windows-vélinni
(Task Scheduler); ef sú vél er slökkt hættir póstur og Tímavera að berast — það lítur
út eins og bilun en er það ekki.

---

# 📚 Þekkingargrunnur — ÓBREYTTUR texti úr CLAUDE.md

> Fluttur hingað 2026-08-01 við uppskiptingu CLAUDE.md (31k tokens hlóðust í HVERRI
> lotu). Engu breytt, engu sleppt — aðeins fært svo það hleðst aðeins þegar þessi
> sérfræðingur er kallaður til.

### Tímavera — base calculus for invoicing
- `timavera_entries` (~3.7k rows): `date, hours, employee, project`.
  Pulled by an external scraper twice daily (09:00 / 17:00). `project`
  is a free-form string; rolled up via `project_aliases` for matching.
- `timavera_meta`: last_import timestamp + source file.
- Endpoint: `/api/timavera?year=YYYY&weeks=N&topProjects=M`.

### Ajour
- `ajour_registrations` (~15k rows): fire-stop registrations from Ajour
  CSV exports. Counted per worksite to validate billable scope.

### Email
- `email_digest` (~29k rows): all emails from connected Gmail accounts
  (`Brunaholf@brunaholf.is`, `aggisigurds@gmail.com` etc.). Used for
  Inbox + Spurningar tabs and worksite email-mention matching.
- `email_actions`: per-email triage state (status/priority/notes) for
  Spurningar.
- **Three ingest paths into `email_digest` (interchangeable — same `message_id`
  dedupe):** (1) the desktop **luna-bridge/bridge.js** (Thunderbird mbox →
  upsert, runs every 15 min on the Windows tölva); (2) **cloud** —
  `gmail-ingest.js` (`/api/gmail-ingest`) pulls Gmail directly via the Gmail API
  (no desktop needed); (3) **browser-bridge** — the `Brunahólf · Mail Pulse`
  Chrome extension (in `extension/`) scrapes opna Gmail/Outlook flipa and POSTs
  to **`/api/email-ingest-browser`** (auth via `X-Brunaholf-Token` header
  matching `EXTENSION_INGEST_TOKEN` env). Stable `message_id` =
  `browser:<sha256(account|sender|subject|received_at)>[:32]` so re-scans
  upsert the same row; `source_path='browser-extension'`. The three paths
  coexist without collision (RFC822 ids vs Gmail-API ids vs `browser:` prefix).
  The cloud direction is: **Gmail API now** (Google
  mailboxes, eldklar@eldklar.is first), **Microsoft Graph later** for the
  Office-365 @brunaholf.is mailboxes. Goal is to stop depending on the
  bridge-tölva being on (which the 🌅 Dagurinn tab flags when email is ≥2 days
  stale).
- **SENT-ingest (2026-07-10):** the digest also carries the company's OWN
  outgoing mail — `luna-bridge/bridge.js` reads each account's sent mbox
  (`[Gmail].sbd/Sent Mail` / `Sent` / `Sent Items`, skipped when missing) and
  `gmail-ingest.js` takes `folder=sent`. SENT rows land with `folder='SENT'`,
  `is_question=false` (same `message_id` dedupe), so answered/unanswered state
  can be computed downstream. Inbox-style consumers filter them out with
  `folder=neq.SENT`: `inbox.js`, `email-tasks.js`, `worksites.js`
  (email-mention matching) and `data-sources-status.js` (freshness,
  recent_emails, per-account status). `email-ingest-browser.js` additionally
  rejects content-less extension rows (no subject AND no snippet → counted as
  `skipped_empty`, never upserted).
- `company-mail.js` — **`GET /api/company-mail[?days=365]`** (service role, CORS *):
  **Skyndiminni (06.09.2026):** lista-svarið er vistað í `app_kv` (`company_mail_v2_<days>`, 15 mín TTL,
  stampede-lás 60 s, gamalt svar ef reikningur bilar — `cached`/`stale`/`cache_age_s` í svarinu; `?fresh=1` þvingar).
  Áður kostaði hvert kall 5–6 s + tvö `tv_history_sites`-RPC og var kallað við HVERJA hleðslu appsins →
  pottstífla (PGRST003/504 á allt) kvöldið 06.09. `?co=<id>` (saga eins fyrirtækis) er EKKI cache-uð, ~0,6 s.
  per SERVICE company (`fyrirtaeki` `er_i_thjonustu=true`), the newest INBOUND email
  and whether it is **unreplied**. Powers the Slökkvitæki „Fyrirtæki í þjónustu"
  red-envelope badge (patch 295) so an email from months ago is not forgotten
  between annual visits. Matching is CONSERVATIVE — exact sender address only
  (`fyrirtaeki.netfang`, or a single-live-site base's `customers_base` netfang/
  contact_email); an address shared by two companies is dropped (a wrong red
  envelope is worse than a missing one). `unreplied` = matched inbound exists AND no
  SENT email addressed to that company after the newest inbound. Returns
  `{byId:{<fyrirtaeki_id>:{from,subject,snippet,received_at,is_question,unreplied}},
  generated_at, scanned}`. Rides the `/api/*` catch-all. Muting the badge is
  client-side (`arsskodun_customers[id].mail_off`), not in this endpoint.

### Sjálfvirkni (automation registry + run log)
- `automation_jobs` — one row per registered automation: `name` (UNIQUE), `label`,
  `description`, `command` (copy-paste run command, e.g. `run_workflow ajour-nlsh`),
  `url`, `schedule`, `runner`, `enabled` bool, `created_at`, `updated_at`. Seeded:
  `name='ajour-nlsh'`.
- `automation_runs` — run-status log: `job_name`, `status` (`running|success|error`),
  `detail`, `source`, `started_at`, `finished_at` (DB default now()). Index on
  `(job_name, finished_at desc)` — the GET pulls the latest run per job from it.
- Endpoint: `netlify/functions/automations.js` → `/api/automations` (mirrors the
  `debtors.js` REST pattern — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, CORS,
  `json()`/`sbFetch()` helpers).
  - `GET` → `{ jobs:[ {…automation_jobs fields…, last_run:{status,detail,source,
    finished_at}|null } ] }` — only `enabled=true` jobs, each with its single newest
    `automation_runs` row.
  - `POST { action, … }`: `register` (upsert `automation_jobs` ON CONFLICT(name),
    `Prefer: resolution=merge-duplicates`, never overwrites existing cols with null);
    `run` (insert one `automation_runs` row — `{job_name,status,detail,source,
    started_at?,finished_at?}`, DB fills `finished_at` when omitted); `toggle`
    (PATCH `automation_jobs.enabled`).
- UI: the ⚙️ Sjálfvirkni tab (`renderSjalfvirkni`) — see Tabs above.

## Companion repo: luna-bridge

A separate repo `aggisigurds-dev/luna-bridge` runs on the user's
**Windows desktop** as a set of scheduled scripts. It's the source
for several Supabase tables this app reads:

- **„Samstilla NÚNA" (29.09.2026, luna-bridge eeeb6ad):** skrifstofuvélin (DESKTOP-509MN7M)
  er aðalbrúin. Hub-takkarnir ↻ Samstilla **Ajour** og **Redder** (`js/hub-sync-buttons.js`,
  `bridgeRun`) setja beiðni í `automation_triggers` → watcher keyrir `ajour-nuna.js`
  (opnar innskráningarglugga á vélinni ef lotan er dauð → CSV-sókn → yfirlit) eða
  `postur-nuna.js` (ræsir Thunderbird ef lokað → bridge.js + redder.js + redder-drive.js).
  Redder-takkinn las áður AÐEINS Drive (`/api/redder-read`) — það er nú varaleið ef engin
  brúartölva svarar. Skrifturnar skrifa framvindu í `automation_triggers.result` (watcher
  setur `TRIGGER_ID`) og takkinn sýnir hana. **Ajour-lotan** er lotukaka sem deyr við
  aðgerðaleysi → `ajour-vakandi.js` á 10 mín fresti (Task `LunaBridge2-AjourVakandi`)
  heldur henni lifandi; `automation_runs(job_name='ajour-vakandi')` skráir aðeins breytingar.
- **Tvær brúarvélar (06.10.2026, Agnar: „finn þetta ekki, tengdu þessa tölvu").** Skrifstofuvélin DESKTOP-509MN7M
  keyrir **LunaBridge2-*** (sett upp með `setja-upp-varavel.bat`: Watcher 1 mín · Email 15 mín · Redder daglega 07:30 ·
  Heartbeat 30 mín · Ajour 06:45 · AjourYfirlit 07:15 · SkraStada klst · AjourVakandi 10 mín) með **Store-Thunderbird**
  (`shell:AppsFolder…`, prófíll undir LocalCache); hún merkir keyrslur `source='luna-bridge:skrifstofa'`. Heimavélin
  DESKTOP-M5FO3I6 keyrir gömlu **LunaBridge-*** verkin (Email 15 mín · Watcher 1 mín · Redder — nú daglega 07:45, var
  vikulega fös · Heartbeat 30 mín) með **klassískri Thunderbird** (Program Files, prófíll `TB_PROFILE` í .env) og merkir
  `source='desktop'`. Þrennt sem var bilað þar og var lagað: Thunderbird var lokað síðan 11.09 (brúin skráði „ekkert nýtt í
  606 klst" á 15 mín fresti — rauðu línurnar í Sjálfvirkni voru ÞESSI vél, ekki skrifstofan); hjartslátturinn svaraði 401
  því `VEL_HEARTBEAT_TOKEN` vantaði í `luna-bridge/.env` (sækist með `netlify env:get VEL_HEARTBEAT_TOKEN --context
  production` ÚR brunaholf-möppunni — úr annarri möppu skilar CLI-ið villutexta sem lítur út eins og gildi); tréð var 17
  commit á eftir. `postur-nuna.js` þekkir nú báðar uppsetningarnar (exe í Program Files + TB_PROFILE, annars Store).
  **Skrifstofuvélin sendir ENGAN hjartslátt** (aðeins M5FO3I6 í `vel_heartbeat`) — LunaBridge2-Heartbeat vantar eða
  token-inn vantar í .env hennar; þess vegna sést hún ekki á Kerfisheilsu þótt hún vinni.
- **Redder-línurnar koma AÐEINS úr Drive-lesaranum (05.10.2026).** `redder.js` (póstur) skráir bara hausinn
  (`source 'redder_mail'`: engar línur, enginn verkstaður — og kreditreikningar urðu jákvæðir, slaufumínusinn
  týnist). Eftir breytinguna 29.09 hér að ofan keyrði enginn `/api/redder-read` lengur, svo september sat á
  „(ótengt) · Engar línur skráðar enn". Nú: `redder-read?nyir=1` les AÐEINS reikninga sem vantar eða eru
  póst-haus án lína (eldri ósnertir, handvirkur verkstaður aldrei yfirskrifaður) og
  `redder-read-background` keyrir það 09:50/13:50/17:50 UTC → `automation_runs(job_name='redder-read')`.
  Bakfylling 05.10: 52 reikningar lesnir (13 í sept). Reikningar sem standa áfram „(ótengt)" hafa enga
  „Vegna/V:"-tilvísun í PDF-inu — þá þarf 🔗 Tengja við verkstað.
  **📄 Skoða reikning** (index.html `redderPdfHlekkur(inv)`, Efniskostnaður + Gerð reikninga) opnar PDF-ið um
  `/api/skjal?id=<drive_file_id>` — server-OAuth, engin Google-innskráning; póst-haus án Drive-skrár: „PDF ekki
  komið". Ekki keyra fulla möppu-endurlesningu (án nyir) til að „laga" — hún yfirskrifar handvirka verkstaði og
  útilokaðar línur á eldri reikningum. Áður en þú segir „lesarinn er bilaður": SQL á `redder_invoices` eftir
  `source` + línufjölda og `automation_runs(job_name='redder-read')` — oftast hefur hann bara ekki keyrt.

- **`bridge.js`** — reads Thunderbird mbox files for 5 accounts,
  classifies messages, upserts to `email_digest`. Runs every 15min
  via Task Scheduler.
- **`timavera-bridge.js`** — ⚠️ **ÓVIRK (staðfest 04.11.2026):** keyrir aðeins með `TIMAVERA_BRIDGE_FORCE=1`
  (Charlize kerfi/timavera 28.08). `timavera_entries` kemur nú úr `timavera-pull(-background).js` (Tímavera-API;
  `timavera_meta.source_file='timavera-api'`, síðast 04.11 00:15). Gamla lýsingin til sögu: reads the latest `Tímaveru vinnufærslur*.xlsx`
  from the user's `Downloads` folder, parses with `xlsx` lib,
  upserts to `timavera_entries`. Dedupe key:
  `date|employee.toLowerCase()|project.toLowerCase()|time_in`.
  Columns matched fuzzily by header substring (`dagsetning`/`date`,
  `inn`, `út`/`ut`/`out`, `tímar`/`hours`, `starfsma…`/`employee`,
  `verkefn…`/`project`).
- **`ajour-ingest.py`** — reads the latest `AjourRegistrationData*.csv`
  from Downloads, upserts to `ajour_registrations`. CSV is
  semicolon-delimited UTF-8-with-BOM. Dedupe key:
  `(serial_number, project_name, execution_date)`. Maps:
  `SerialNumber`, `RegistrationType`, `RegistrationStatus`,
  `ProjectName`, `CategoryGroup`, `Category`, `Category1`,
  `CheckListItem`, `CheckListItemCheckedDate`,
  `CheckListItemCheckedByUser`, `ExecutionDateFrom`,
  `ReceiverCompany`, `Longitude`, `Latitude`,
  `RegistrationCreatedDate`, plus (2026-08-30) **`DrawingName`**
  (aliases: `Drawing/drawingname`, `drawingname`, `Drawing`,
  `DrawingFileName`, `Tegning`) → `drawing_name` and **`Subject`**
  (`RegistrationSubject`, `Emne`) → `subject` when those headers exist.
  The 53-col export always had drawing; older ingest dropped it.

### NLSH 8 svæði (teikning, ekki herbergi)
- `GET/POST /api/nlsh-section-progress` — 8 cells (4H S1–S4, 5H S1–S4).
  `done` = distinct `serial_number` with `registration_status='Done'`
  mapped from `drawing_name`. Dual drawings (`S4+S5`, `1S og 2S`,
  `5H1S`/`5H2S`, `4H 51-52`) count **once** on the first matching wing
  (`primary-only`); the sibling cell names the drawing. `SH` = 5H.
  Floor-wide `5H. Ceiling` maps to all 5H wings, counted on 5H S1.
  `Rafmagnsbættingar` is a category drawing and is **not** leftover holes.
  Áætlað lives in `app_kv['nlsh_section_planned']`. Until drawing is
  backfilled by a fresh ingest, `done` is null. Not a per-room join.

The brunaholf drop-zone parser should reuse the exact same column
mapping and dedupe keys so files can be uploaded via the web UI
**or** via the local scripts interchangeably.

### Local MCP connector — `local-mcp/` (skýja tengill, 2026-07-31)

`local-mcp/server.mjs` is a small **stdio MCP server that runs on the
heimaskrifstofa tölva** (or any machine) and is the *connector* between the
**local Claude** (Claude Code on that machine) and the cloud. It gives local
Claude on-machine reach it otherwise lacks — read local files
(`list_dir`/`file_info`/`read_file_text`), `http_fetch` **any** URL incl.
`brunaholf.netlify.app` (which cloud Claude can't reach due to egress policy),
`open_in_browser`, and `upload_to_drive_via_brunaholf`. Read-only FS, **no shell,
no file-write** — safe-by-design. `type:module`, deps `@modelcontextprotocol/sdk`
+ `zod`.
- **Register per machine:** double-click `local-mcp/setja-upp-local-mcp.bat`
  (npm install → `npm test` → `claude mcp add brunaholf-local -s user -- node
  <abs>\server.mjs`; user-scope so it's available in every Claude Code session on
  the machine). Manual/`.mcp.json` project-scope alternatives are in
  `local-mcp/README.md` — don't do both (double-registration). Mirrors the
  `luna-bridge/setja-upp-desktop-commander.bat` pattern.
- **Uploads:** `upload_to_drive_via_brunaholf` calls **`/api/drive-upload-session`**
  (`drive-upload-session.js`) which mints a Google Drive **resumable** upload
  session with brunahólf's OAuth and returns `{uploadUrl}`; the MCP then PUTs the
  bytes straight to Google (no bytes through Netlify — handles multi-GB). Locked
  with `X-Brunaholf-Token` = env **`LOCAL_UPLOAD_TOKEN`** (set the SAME value on
  Netlify and on the machine; the tool reads it from env or a `token` arg). The
  read/fetch/browser tools need no token. Covered by the generic `/api/*` redirect;
  `local-mcp/*` is 404-forced off the web (internal files stay off the site).
- **Tests:** `cd local-mcp && npm test` (`test.mjs`) — offline suite (FS tools,
  the zod→JSON-schema converter's required-args, and the `http_fetch` GET+body
  regression) run against a throwaway localhost server, so it passes anywhere.
- v2 (unbuilt): resumable-resume on rupt, Chrome DevTools bridge, extension control.

---

*Kaflarnir hér fyrir neðan voru fluttir orðrétt úr `CLAUDE.md` 2026-08-19
(verkefnalisti 22a44bdc) — sama efni, nýr staður.*

## Efniskostnaður — handvirk verkstaða-tenging (2026-08-05)

Verkefnalisti a12d429a: Redder-reikningar sem `redder-read.js` gat ekki tengt sjálfkrafa
(`worksite_match IS NULL` — oftast af því engin verkstaðar-tilvísun fannst í PDF-inu
sjálfu, bara tengiliða-merki eins og „umb Lukas") sátu áður sem varanlega ólæsanleg
„Án verkstaðs"-hrúga. Efniskostnaður-flipinn hefur núna:
- **„🔗 Tengja við verkstað" á hverjum reikningi** — setur `worksite_match` á ÞANN eina
  reikning (POST `/api/redder-invoices {invoice_nr, worksite_match}` — endapunkturinn
  studdi þetta nú þegar, bara enga UI). Engin sjálfvirk `project_aliases`-lærdómur hér,
  af því hrátextinn á ólæstum reikningum er oftast bara tengiliðs-nafn, ekki alvöru
  verkstaðar-afbrigði — að læra af honum myndi ranglega flokka næsta reikning með sama
  tengilið en ANNAN verkstað.
- **„✏️" á hverjum verkstaða-hóp** — endurnefnir ALLA reikninga undir því nafni í einu
  (nýtt `POST /api/redder-invoices {action:'rename_worksite', from, to, learn_alias:true}`)
  OG skrifar `project_aliases(alias=from, canonical_name=to)` — því hér ER `worksite_match`
  þegar alvöru (þótt misstafað) verkstaðarnafn. `redder-read.js` sækir núna
  `project_aliases` úr gagnagrunni (`loadAliasesFromDb()`, keyrt einu sinni per innlestur,
  DB-gildi vinna umfram hardcoded `ALIAS`-kortið) svo ný PDF-innlestur nýtir handvirku
  leiðréttinguna sjálfkrafa — `ALIAS`-kortið í kóðanum er ekki lengur eina uppsprettan.
- Verkstaða-listinn í tengi-reitnum (`<datalist>`) er sambland af `/api/worksites?year=
  combined` og því sem þegar er notað í `redder_invoices` — alltaf a.m.k. þau nöfn sem
  eru í notkun nú þegar.

**Vísvitandi sleppt**: línu-stigs tenging (að taka STAKA vörulínu úr reikningi og tengja
við annan verkstað en restina af reikningnum) — `redder_line_items` hefur engan eigin
`worksite`-dálk, og öll skoðuð dæmi af ólæstum reikningum voru heilir reikningar sem
vantaði verkstað, ekki blönduð fjölverkstaða-reikningar. Bæta við ef alvöru þörf kemur upp.

## Kostnaður — viðhengi úr pósti eldklar@ (2026-09-27, skráð 08.10.2026)

ANNAÐ kerfi en „Efniskostnaður / Kostnaðarreikningar (endurrukkun)" hér að ofan. Síðan er í Slökkvitæki-appinu
(`#kostnadur`, `js/patches/419-kostnadur.js`); leiðslan er hér: `netlify/functions/kostnadur-sync-background.js`.
- **Keyrir AÐEINS þegar ýtt er á takkann** á síðunni (`?days=31&max=80`) — engin áætlun. Staðan í `app_kv['kostnadur_sync']`.
- Gmail `format=full` á eldklar@ (eigin sendingar útilokaðar), hvert viðhengi í lokaða bucketinn `kostnadur`, lesið
  af Claude (skema-JSON) → ein röð í töflunni `kostnadur` per viðhengi, `ignore-duplicates` (endurkeyrsla skrifar
  aldrei yfir flokkun sem gerð var á síðunni). Gmail 403/429 (mínútukvóti) → bíður 15/30/45 s og reynir aftur.
- **Hunsað** = `stada='hunsad'` + `flokkur='ekki_kostnadur'`. Opna talan á Stjórnstöð telur `stada='nytt'` án
  `ekki_kostnadur` og án Teya/kortayfirlita.
- **Ekki kostnaður (mælt 08.10):** reikningsyfirlit (Barki, Málning — nóturnar eru skráðar sér, yfirlitið tvítelur),
  afhendingarseðlar, tilboð, ljósmyndir, póstur frá kúnnum, og OKKAR EIGIN útsendu Payday-reikningar
  (`delivery@payday.is`, seljandi „Brunahólf Slökkvitæki ehf." = Payday nr. 2–7). Kreditnótur geta verið lesnar með
  PLÚS-upphæð (Würth SK0012641). Tillagan að hunsa 32 slík skjöl er mál #1190.
- **Lestur bregst þögult ef Anthropic-inneignin klárast:** 9 skjöl 30.06 fengu `ai_villa` „credit balance too low" og
  stóðu ólesin í 3 mánuði. Leitaðu að `ai_villa is not null` þegar talan virðist of lág.

## Póst-hub viðbætur (2026-08-20)

Þrennt bættist við póst-/kúnnaþjónustu-pípuna (live í PR #401 + slokkvitaeki #657):

- **Sjálfvirkt gmail-innsog — `gmail-ingest-background.js` (áætlað á 2t):** ÁÐUR var
  EKKERT áætlað fall að sækja eldklar-póst (aðeins handvirkt/Kerfisheilsu-hnappur), svo
  SENT-hólfið sat eftir (mælt: fraus 6.8.). Nú `[functions."gmail-ingest-background"]
  schedule = "35 */2 * * *"` (netlify.toml) sem endurnýtir `gmail-ingest` handler BEINT
  (`require`, GET) fyrir eldklar INBOX **og** SENT, `DAYS=3`, upsert á `message_id`.
  ENGIN AI/tókn. Skráir í `automation_runs(job_name='gmail-ingest', source='schedule')`.
  Fleiri pósthólf = einn hlutur í `JOBS`-fylkinu. ⚠️ áætlun á -background tvíbura því
  Netlify svarar áætluðu falli með 403 á HTTP; `gmail-ingest` sjálft verður að vera frjálst.
- **`company-mail.js` — stöðumerki/signals (umferðarljós á Slökkvitæki):** skilar nú
  `important` + `signals[]` ({type,subject,received_at}) auk `unreplied`. `detectSignals()`
  (leitarorð, engin AI) skannar ALLA innkomna í glugganum eftir uppsogn/flutt/eigandi/
  gjaldthrot/kvortun/bilun/aridandi. **Rautt (unreplied) er strangt** (nákvæmt netfang per
  bygging). **Gult (signals) er víðara** — `emailToBase`→`baseToSites` (netfang lögaðilans/
  bygginga → allar in-service byggingar hans), knýr ALDREI rautt. ⚠️ Hrá „cancel/uppsögn"-
  leitarorð eru MJÖG hávær (fundarafbókanir/áskriftir/söluaðilar); raun-mátaðir lífsferils-
  pósta á kúnna ~2/ár (felag_samskipti, 185 lögaðilar). Framendi: slokkvitaeki patch 295 v2.
  **Grænt (history) víkkað 2026-08-20:** `byId`-færsla með `unreplied:false`+engin signals =
  🟢 „í sambandi". Tvær uppsprettur sameinaðar: **(1) `tv_history_sites(days)` RPC**
  (`sql/2026-08-20_tv_history_sites.sql`, SECURITY DEFINER, `statement_timeout='20s'`) —
  leiðir grænu byggingarnar út úr **`felag_samskipti`-viewinu SJÁLFU** (sama mátun og
  Þjónustuver póstar sér, svo skjáirnir reka aldrei í sundur): leyst bygging þar sem felag
  festir hana, single-site fallback annars — rekstrarfélags-systir ALDREI ranglega. Kallað
  **í parallel** (`histPromise`, `.catch(()=>null)`) við eigin lestur svo heildartími ≈ max,
  ekki summa (~3.4s RPC ‖ ~5s scan). **(2) in-JS fallback** — `noteHist(emailToBase[…])` á
  bæði `sender_email` (INN) OG `to_addresses` (ÚT), single-site, svo grænt birtist samt þótt
  RPC bregðist. ⚠️ **Leiðrétting:** „185 lögaðilar" er ALL-TIME (tv_postar_list hefur enga
  dagsetningarsíu); í 365-daga glugga á felag AÐEINS ~96 byggingar með póstsögu — hitt
  („178") var `ILIKE '%addr%'`-substring-tálmynd í mælingu, ekki raun. `scanned` fékk
  `history` (+`history_felag`) og `green` teljara.
  ⚡ **Hraði (2026-08-20, eftir að merki hurfu hjá Agnari):** fallið var komið í ~7–9s
  (raðlestur á ~7k `email_digest`-röðum, 7 síður í röð) og lá við Netlify 10s-þakið →
  502 → tóm merki. Lagað: **`fetchAllParallel`** (count-first, allar síður `Promise.all`
  → ~1,5s) + **felag-RPC í `Promise.race` með 6s þaki** (spike getur ekki ýtt fallinu
  yfir; grænt fellur á in-JS fallback ef felag svarar ekki í tíma). Nú ~3–4s, 200 áreiðanlega.
  📜 **Full póstsaga per kúnna (2026-08-20):** `GET /api/company-mail?co=<fyrirtaeki_id>`
  → `{fyrirtaeki_id, base_id, mails:[…]}` (öll samskipti, nýjast fyrst, deduppað á email).
  Knúið af `tv_company_history(fyrirtaeki_id)` RPC (`sql/2026-08-20_tv_company_history.sql`,
  SECURITY DEFINER, 15s timeout, bundið við EINN base → hratt, t.d. Center Hótel = 139 póstar).
  Notað af „📜 Sjá alla póstsöguna"-modal í slokkvitaeki patch 295.
- **`public.tv_postar_list()` RPC (`sql/2026-08-19_tv_postar_list.sql`):** SECURITY DEFINER
  + `set statement_timeout='25s'`; hópar in-service kúnna + pósta þeirra fyrir Þjónustuver
  póstar (slokkvitaeki patch 309) — því `felag_samskipti`-viewið er dýrt og fellur á
  timeout í full-scan úr anon. Kallað `sb.rpc('tv_postar_list')`. `postur-triage.js`
  (slokkvitaeki) fékk líka `mode:'thjonustuver'` (ríkari AI-útdráttur; borð-hamur óbreyttur).

## Þrjár tengingar sem biðu Agnars 08.10.2026 (mál #1157–#1159)

- **Ajour-lotan deyr við aðgerðaleysi** (MembershipCookie). `ajour-vakandi.js` á 10 mín heldur henni
  lifandi; dauð lota → „Samstilla Ajour" (`ajour-nuna.js` á skrifstofuvélinni) opnar innskráningarglugga
  sem Agnar fyllir. 09.10: 10.770 færslur eftir innskráningu, bæði Ajour-verkin græn.
- **Landsbanki-innlestur af Drive** (`landsbanki-ingest-drive.js`) leitar í ÖLLU Drive að „hreyf/landsbank/
  account" — nýjasta skráin var „reikningar hreyfingar frá 2023.xlsx" (Payday-viðskiptamannahreyfingar,
  Nafn/Kt/Eindagi/Debet/Kredit). Vörn 08.10: skrif hafnað (422) ef Eindagi+Debet/Kredit eða hvorki tnr né
  kt mótaðila; `?company=slokkvitaeki|brunaholf` merkir félag. Bankagögn: Brunahólf til 15.06, Slökkvitæki 15.05.
- **aggi@brunaholf.is er Office 365**, ekki Gmail — fer um Thunderbird á brúar-tölvunni (bridge.js les
  möppu→hólf úr prefs.js). „Gmail úr skýi" í Bakenda dugar ekki fyrir brunaholf.is-hólfin.
- Redder-þögn ≠ bilun: `redder-read` „0 reikningar" með Thunderbird í gangi þýðir engir nýir Redder-póstar.

## Lærdómur

- **31.10.2026 (endurmælt 10.11.) — sópur má ekki skrá aftur það sem var eytt:** `brunakerfi-gather.js` athugaði aðeins hvort
  `drive_file_id` væri skráð NÚNA og skilaði 29.10. tveimur skýrslum sem var eytt 20.07. Nú les hann einu sinni á keyrslu
  mengi eyddra Drive-auðkenna úr `audit_vernd` (`table_name=customer_documents`, `op=DELETE`, `old_row->>drive_file_id`,
  28 ms, 851 röð) og sleppir þeim (`indexed='eytt_adur'`). Sama regla á við HVERN sóp sem skráir í `customer_documents`
  (drive-multitool, cowork-doc-sweep) — vörðurinn er `slokkvitaeki/tools/audit-skjal-endurkoma.cjs` (grænn 10.11.: B 16/16).
- **31.10.2026 — þyngsta endurtekna kallið er póstfyrirspurn Kerfisheilsu:** `data-sources-status.js` spyr `email_digest` einu
  sinni per pósthólf með `order=received_at.desc.nullslast`; 1,39 m. köll frá 02.08., ~30 ms hvert, og enginn vísir nær því
  (eini vísirinn er `received_at DESC` = nulls first, enginn á `account`). Vísarnir bíða í
  `sql/2026-10-31_visar_hledsluspa_krokur77.sql` (ÓKEYRT 10.11. — staðfesting Supabase birtist ekki hjá Agnari).
- **Vitað 04.11.2026 (greiningarlotur 04/06/07):**
  - **Póstur — undirmöppur ná aldrei inn:** `email_digest` á aðeins INBOX/SENT. Brunaholf@ Sent heitir `Sent Items-1` (2,0 GB) á
    DESKTOP-M5FO3I6 og passar ekki við `SENT_CANDIDATES` í `luna-bridge/bridge.js` (tillaga: regex `^Sent( Items)?(-\d+)?$`).
    Undirmöppur (t.d. bokhald@eldklar „Teya uppgjör“, Brunaholf@ „Tilboð send-1“) fara aldrei inn. Póstlesturinn sjálfur er
    `postur` (Meg Ryan, slokkvitaeki); þú átt innsogið.
  - **`bank_transactions`: 938 raðir, síðasta færsla 15.06.2026** (BH; SL 15.05) — innsogið hefur legið niðri í 4½ mánuð;
    V6-yfirferð greiðsluhreyfinga bíður þess.
  - **`teya_faerslur` = 0 raðir** — engin Teya-afstemming; verkefni 12ba9ff2 í `beidni` síðan 17.07. Þú smíðar innsogið,
    `sala-reikningar` á afstemminguna.
  - **Ajour:** aðeins NLSH 5-6. hæð (innsog 03.11) og Heklureitur (30.10) samstillast; hin 23 verkin síðast 13.10.
    `ajour_registrations_villa_20260929` (16 096) er sóttkví tvítekinna NLSH-raða, enginn lesandi — má fella eftir samþykki.
  - **`timavera_worklogs`** (267) síðast 31.07, skrifað af `luna-bridge/timavera-fetch.js`, enginn lesandi í brunaholf.

- **16.10.2026** — Uppgjör lota 16.10.2026: (1) Ajour hak-tími mælir EKKI vinnutíma: hak starfsmanns 20 þann 9.9 enduðu 11:16 en EXIF-mynd (S24 Ultra) er frá 14:25 — hakatími = hvenær hann settist með símann; EXIF er eina óháða stimpilmerkið (tools/mynda-timar.cjs les fyrsta/síðasta tökutíma per dag); aldrei meta vinnutíma einstaklings úr Ajour — segja „gólf, ekki mæling"; Excel-tímabrot 0,3333 er tugabrot. (2) Ajour-útflutningur: CSV hendir klukku úr RegistrationCreatedDate og ber tvö dagsetningasnið í sömu skrá; JSON/XML bera ISO m. millisek, hreiðraða CheckListItems, engin tímabelti; RegistrationCreatedDate = fyrsta hak, allur gátlisti hakaður á ~11 s; allt hakað af sameiginlega notandanum „Starfsmaður Brunahólf" (Category „Starfsmaður N"); innlesturinn klippir tíma svo ajour_registrations er allt miðnætti. (3) Regla Agnars 10.09: „Þetta pælingar þurfa ekkert að fara inn á síðuna … ekki skoða tímavera … bara þessi skjöl frá ajour" — athuganir á einstökum starfsmönnum eru SPURNINGAR, ekki síður: netlify/functions/starfsmenn-dagar.js + starfsmenn.html fóru í loftið ÓBEÐIÐ („Á ég að taka hana niður?" ósvarað). (4) Anthropic-inneign núll 30.09 ⇒ kostnadur-sync fékk 400 og 13 kostnaðarskjöl festust án upphæðar (ignore-duplicates) → endurlesturs-umferð aðeins á breytt_af IS NULL; kostnadur-sync-background keyrir ekki sjálfkrafa (Charlize #874).

- **16.10.2026** — Uppgjör lota 16.10.2026 (Beiðnaskógurinn 18.09): LunaBridge2-Redder-verkið hafði aldrei keyrt („30.11.1999, kóði 267011"); ajour_yfirlit app_kv.updated_at lýgur (ajour-yfirlit.js skrifar aðeins key+value); mbox-brú hinna 4 hólfa dauð frá 11.09 (1.598 villur/372 ok); gamla brúin desktop á DESKTOP-M5FO3I6 föst og hamrar persónulega Gmail — á að stöðvast, Agnar þarf aðgang að vélinni. Vörður um þögult innsog ber saman þrjár hliðar (Gmail · DB · appið), ekki tímaþröskuld.

## Redder-línur í Efnislistanum · Payday-staða í 06 · skjölin (16.10.2026)

- `REDDER[verkstaður|mánuður]` (byggt í renderGerdReikninga úr /api/redder-invoices) = `{ an_vsk, lines:[{label, cost,
  qty}] }`; `cost` = upphæð eftir afslátt / magn (ein_verd er FULLT verð). Línur með worksite_override fara á sinn
  verkstað. `REDDER` er lokað í renderGerdReikninga — ekki global; í prófun les maður /api/redder-invoices beint.
- 06 Fyrri reikningar sækir `/api/krofur-yfirlit?year=` (þungt: bankapörun) aðeins þegar flipinn er opnaður, geymt
  per ár í `window.__gbKy`. Reglan um greitt er þar, ekki í viðmótinu.
- `invoice_drafts.payday_invoice_id` ↔ `invoices.id` (bru-fallið parar svo); drög bera `tilvisun` (21727) en
  Payday-röðin `tilvisun` = reikningsnúmer (371) — EKKI sami reitur.
- `/api/efnislisti-docs?worksite&month`: doc_type `efnislisti_pdf` / `efnislisti_timabok_pdf` (Supabase storage
  efnislisti-pdf/<slug>/<mán>/…, public_url) og `invoice` (Drive, /api/skjal?id=). Payday-reiknings-PDF er ekki speglað
  í kerfinu en sækist á staðnum frá 16.10.2026: `GET /api/payday-invoice-pdf?tilvisun=355`
  (`netlify/functions/payday-invoice-pdf.js` → Payday `GET /invoices/{guid}/pdf`, GUID úr `invoices.payday_uuid`
  sem payday-pull fyllir; payday_invoice_id (int) var alltaf NULL því Payday-id er GUID). Hreyfingaryfirlit
  (`hreyfingar.js` setur `src`) gerir Payday-raðir að hlekk á þetta fall.
  payday-pull upsertar líka greiðendaskrána í `payday_vidskiptavinir` (ssn, heimilisfang, póstnr, bær, netfang, sími,
  tengiliður; 03.11.2026) — Viðskiptavinir-prófíllinn sýnir hana sem „Í Payday". Villa þar fellir ekki keyrsluna (detail).
  Gildra: `?probe=1` sækir aðeins FYRSTU síðu (Payday skilar 100 á síðu) — sækja eftir `since/until` gluggum. Fyrri reikningar í 06 telja líka
  `draft_match.worksite` — `r.worksite` kemur eftir nafni greiðanda og getur verið annar verkstaður
  (Rekstrarfélag Kringlunnar → „Kringlan - Turn" meðan drögin heita „Kringlan").

## Nýtt úr Charlize og lotum (28.10.2026)

- Ajour CSV-útflutningurinn er í raun eitt JSON-kall á `/api/reporting/legacy/GetReportData` (vafrinn býr CSV-ið til sjálfur); Ajour-flipinn í hubbnum telur punkta með því kalli (`luna-bridge/ajour-yfirlit.js`, einn dagur í einu, allir fimm stöðuflokkar lagðir saman), ekki úr `ajour_registrations`. [C#261, C#604]
- `ajour_registrations` var FROSIN fyrir öll verkefni nema NLSH (mælt 18.09: aðeins NLSH 5–6. hæð fersk, hin stöðvuðust 22.–30.05) — athugaðu nýjasta `execution_date` per verkefni áður en þú treystir töflunni. [C#605]
- Ajour-yfirlit og skýrslugerð er sér forrit í Kjarni-repoinu sem opnast af kjarni-forsíðunni (ekki í hubbnum eða Slökkvitæki-appinu) og les `ajour_registrations`. [lota c2a00410, 13.10]
- Dauð Ajour-lota („Saved Ajour login expired“, „Ajour report UI did not load in time (no Export button)“): Agnar keyrir innskráninguna sjálfur (`node ajour-fetch.js --login`) — Claude slær aldrei inn lykilorðið. [C#640, C#694]
- Brúarkeyrslur luna-bridge skrást í `automation_triggers` (workflow/status/result) en Netlify-áætluð föll í `automation_runs` — athugaðu bæði áður en þú segir að ekkert keyri; 01.09 var `automation_runs` tóm. [C#339]
- `Brunaholf@brunaholf.is` og `bokhald@brunaholf.is` eru ekki Gmail-aukareikningar: þau koma um IMAP/mbox á luna-bridge, svo „Gmail úr skýi“ og ↻ ná ekki í þau (tenging: `/api/google-auth?account=<netfang>` með innskráningu SEM það netfang). [C#892]
- SENT-mappan í `email_digest` byrjar 18.07.2025 en INBOX nær til 2015: „ekkert frá okkur eftir síðasta innkomna“ verður falskt rautt á eldri pósti (mælt 120 af 154) — rautt/blátt má aðeins gilda innan þekjunnar (`v_sent_thekja`). [C#469]
- `aggisigurds@gmail.com` má aldrei lesa eða nota — vinnupóstur er `eldklar@eldklar.is` (og `bokhald@eldklar.is`); þetta stangast á við Email-kaflann hér að ofan sem nefnir hann sem tengdan reikning — spyrðu Agnar áður en þú lest hann. [C#81, C#265]
- PostgREST klippir hljóðlaust við 1000 raðir og `.limit(N>1000)` eða `.range(0,2999)` hnekkja því EKKI (HTTP 200, engin villa) — blaðsíðuskiptu með `DB.fetchAll` og einkvæmri röðun. [C#571, lota 9b70f49c]
- Windows-gildrur í innsogsskriftum: curl úr Git Bash sendir „ú“ sem Latin-1 (`%FA`) — notaðu UTF-8 (`%C3%BA`); Python les og skrifar cp1252 nema `encoding='utf-8'` sé gefið, sem skemmir íslensk nöfn. (líklega) [lota c5897be7, lota d0183946]
- Búnaðargreiningar-skriftur (`bgr_verk.cjs`, `pdf_ur_appinu.cjs`, `vista_vidhengi.cjs`, `skipta_skyrslu.cjs`) harðkóða playwright-slóðina `C:/Users/Slokkvitaeki/luna-bridge` (vinnutölvan); á þessari vél er luna-bridge í `C:/projects/luna-bridge`. [lota 877c9427, 21.10]
- Tímabók-hnappurinn „Endursækja“ á að kalla `/api/timabok` (les `timavera_entries` úr Supabase), EKKI `/api/timavera-pull` (lifandi Tímavera-API) — Agnar 03.08: ekki sækja aftur úr Tímaveru. [lota 177227fe]
- **02.11.2026 — Teikningar úr Ajour (`luna-bridge/ajour-teikningar.js`)**: Ajour á engan teikningalista sem virkar með kökunum, en hver skráning ber `registrationCoordinates[].fileId` + `blueprintName`/`blueprintFileId`; myndin fæst um `GET /api/construction/registration/file/scaled/print?id=<fileId>` (JPEG ~1058×1496; `scaled/preview` = 283×400). Skriftan síðuflettir `/api/construction/registration` (pageSize 200) per virkt verkefni (sleppir „DON'T USE"/„EKKI NOTA"/prófunarnöfnum), safnar teikningum + talningu (status 4 = Done), hleður myndinni í public bucket `verkstadir` (`ajour/<fileId>.jpg`) og upsertar í `ajour_teikningar`. AÐEINS LESTUR í Ajour. Fyrsta keyrsla 02.11: 43 verkefni, 146 teikningar. Sækir aðeins myndir sem vantar (`--allt` = allar, `--verk=<regex>`, `--dry`). Á tímaáætlun daglega 07:30 (Task Scheduler `LunaBridge2-AjourTeikningar` → `run-ajour-teikningar.bat` → `ajour-teikningar.log`; Agnar samþykkti 02.11), skráir sig í `automation_runs` (job `ajour-teikningar`, á Sjálfvirkni-síðunni). Hnitin (x,y) eru í upprunalegri upplausn teikningarinnar, ekki print-myndarinnar — yfirlögn punkta þarf kvarða (sjá nlsh-stukur TRANS). **ATH 04.11.2026:** `ajour-teikningar.js` er EKKI í staðbundna eintakinu `C:\projects\luna-bridge` (22 .js-skrár) þótt `ajour_teikningar` hafi verið uppfærð 03.11 07:30 — eintakið á vélinni er á eftir (stale checkout). `git pull` áður en þú leitar að skriftunni.

## NLSH: Ajour-hnit → stúkur → loftræsti-gegnumtök í TurboPaint (30.10.–05.11.2026)

**Ajour-staðreyndir (mældar 30.10):**
- Ajour telur STAKAR lokanir — tvær á hvert gegnumtak (sín hvorum megin við vegg); „heilar“ = stakar/2.
- Hver teikning nær yfir TVÆR stúkur: `6H.pdf` = S1+S2, `A286-31 Brunayfirlit 6H` = S4+S5, `5H 1S og 2S`/`5H. Ceiling` = S1+S2, `5H S4+S5 Ceiling` = S4+S5, `4H. S1-S2`, `4H 4S+5S`. **4H er AÐEINS milliloftsþéttingar** (Gólf Ø160–200) — aldrei talið með loftræsti-gegnumtökum.
- `POST /api/construction/registration` skilar `registrationCoordinates` (x,y,fileId): 10.919 skráningar, status 4 = Done (10.281). `executionTo` er „dd-mm-áááá“. Vængjaskipting: stærsta x-bil á teikningu = atríum; N/C/S úr y-dýfum við ~27 % og ~72 % (brýrnar), lítið y = norður.
- Kóði: `tools/nlsh-stukur.cjs` (aðeins lestur í Ajour) → `data/nlsh-stukur.json` → `js/nlsh-sections.js` (hæðamynd, svæðatafla). Markmið per stúka eru MAT og Agnar hefur ekki staðfest þau; „Áætlað“ er ekki fyllt. Staða 30.10: ~83 % lokið, 5H S5 mest eftir (336 klárað: N 282 / C 54 / S 0). Opin samþykkismál #1352–#1357 — staða þeirra er ÓMÆLD síðan, endurmældu áður en þú vitnar í þau.

**Loftræsti-gegnumtök á 5H og 6H (04.11) — hvar gögnin búa og hvernig þau urðu til:**
- Tvö TurboPaint-borð í `turbopaint_boards`: 5H `nd13eYoRKgC7742KL4MIZD` (514 merki), 6H `n3vsR9jUK45aK_FIsYjh9J` (518). Talan er **LÁGMARK** (aðeins það sem las af blöðunum).
- Heimild: gegnumtakspunktar lesnir af Brunayfirliti hvorrar hæðar (hnit í pt á síðu 2384×1684, snúningur 0), þvermál (mm) af 1:50 loftræstiblöðunum. Á borðinu er mynd = `<assetId>.png` í public bucket `turbopaint` (síða render-uð í ×2, svo px = pt×2, mynd í (0,0)).
- Merkin: græn 20 px ellipse (`#16a34a99`, rönd `#14532d`) á INNBYGGÐA laginu `loftræsting`, nafn `Loftgegnumtak {mm} mm ({blað})`, mm-texti `Loftmál {mm}` á lagi `loftmal`; lagið `teikning` læst; `activeLayerId` = `loftræsting`. **Nafnið verður að byrja á „Loftgegnumtak“** — `replaceCrossingMarks` eyðir öllu sem heitir `Gegnumtak*`. Sérlag birtist ekki í Brunaþéttingar-ham (`HAM_HOPAR`), þess vegna á innbyggða lagið.
- Agnar bætir restinni við sjálfur með „Setja gegnumtak“ (flýtilykill J, mm-reitur í LAGNIR-spjaldinu; nöfn enda á „(handvirkt)“). Sameinað í kjarni main sem PR #264 (05.11).

**Verklag sem skilaði árangri (kjarni):**
1. Skrif á borð: PATCH `turbopaint_boards` með nýju `updated_at` — og lestu `doc` til baka (telja merki með nafnamynstri) áður en þú segir „komið“.
2. **Dev-þjónn (`next dev`) skrifar í skýið**: í Playwright-prófi — `page.route('**/*supabase.co/**', r => r.request().method()==='GET' ? r.continue() : r.abort())`. Prófaðu helst á Vercel-forskoðun PR-sins (`get_access_to_vercel_url` gefur deilihlekk; skrif þar eru raunveruleg → afturkallaðu ⌘Z og staðfestu í grunni að talan sé óbreytt).
3. `gh` er EKKI uppsett á vinnuvélinni: ýttu með `git push`, opnaðu/sameinaðu PR með GitHub REST (`POST /repos/aggisigurds-dev/kjarni/pulls`, `PUT …/pulls/N/merge`) með token úr `git credential fill`. `mergeable_state` „unstable“ = Vercel-byggingar í gangi — bíddu eftir `success` á `…/commits/<sha>/status`.
4. Deploy-vörðurinn (Lisbeth) stoppar `git merge`/`gh pr merge`/`[deploy]`: lestu diffið, kallaðu á `kodafraedingur`-skjalið (afrit í `kjarni/.claude/agents/` kemur með main), lagaðu það sem hún finnur, skráðu svo `node tools/deploy-vordur.cjs --urskurdur "RÉTT AÐFERÐ" --cwd "C:/Users/Slokkvitaeki/kjarni"` — úrskurðurinn gildir aðeins á sama kóða (nýr commit = ný yfirferð).
5. Merge-árekstrar í TurboPaint (`Toolbar`, `HamStika`, `WhiteboardApp`): leystu með Node-skriftu, ekki sed; eftir sameiningu keyrðu `tsc` (síaðu `app/kjarni/artcraft/` frá — `ImageZoom.tsx`/`imageZoom.ts` hástafa-villur eru í main á Windows, ekki þín) og athugaðu nýja hami úr main (`HamurId` fékk `veggir`, `lagnir` → `Record<HamurId,…>` brotnar).

**Gildrur:** (a) `VeggjaStika` kveikti aftur á veggjaritlinum í hvert sinn sem annað tól var valið og `kveikja()` skilar tóli í „Velja“ — ekkert annað tól festist í Teikning/Brunaþéttingum (lagað 05.11: kviknar aðeins þegar tólið er „Velja“). (b) Git Bash klippir commit-skilaboð með „…“ — skrifaðu skilaboðin í skrá og `git commit -F`. (c) Hook á `git merge` kveikir líka á `git merge-tree` (skoðunin ein og sér er skaðlaus). (d) `PowerShell`/Python-heredoc með íslenskum gæsalöppum → SyntaxError; skrifaðu skriftu með Write og keyrðu hana.

## NLSH: Ajour-breytingar, Október-leiðrétting, 2.11 metraskrá, Miro-merki (05.–08.11.2026)

**Ajour — hakalisti og skráningar (lesið 05.11; EINA skrifið var misheppnað):**
- Nöfn atriða á hakalista birtast AÐEINS í `POST /api/construction/registration/getchecklist {registrationId, categoryId, editable}` (`categoryName`). Í skráningalistanum sjást þau sem „CHECK CAT NAME“. Atriði flokksins „Brunaþéttingar / Fireproofing“: EI60, EI 90, **50 mm Þéttull / FR Board / Welna** (ull), **Akríl / Pyrocoustic Sealant / Akril Bialy** (akrýlkítti), Kítti háþensla, Silicon, Kragi, Borðar, 1 Annað, 2 Annað, **EI 120**, EI 180, EI 360, EI 240.
- Hak = `PUT /api/construction/registration/toggle-checklist {projectId, registrationId, parentCategoryId, categoryId, registrationCategoryCheckId, checked, note}`. Á skráningu með TÓMAN hakalista (11560) svarar það 200 `{"id":"0000…"}` og býr til raðir en `checked` verður áfram false (reynt tvisvar). 11560 á nú þrjár óhakaðar raðir (EI 120, Akríl, Þéttull) frá 05.11 — Agnar hakar sjálfur í Ajour. **Ekki endurtaka án þess að sjá hvernig viðmótið vistar** (UI: `projectId` kemur úr `localStorage['ajoursystem.projectid']`/kökunni; verkefnavalið er falinn listi sem þarf alvöru smell; skráningalistinn sýndi „NO DATA FOUND“ í headless).
- Skráning með tóman hakalista er `status 0` (ekki Done) og telst ekki í Efnislista/gata-uppgjöri. Done (status 4) = hakalisti kláraður.
- Flokkabreyting í Ajour (11560 og 8833 úr „Gólf Ø210-300“ í „Gólf Ø 160-200“) sást ekki í okkar afriti fyrr en `node luna-bridge/ajour-nuna.js` var keyrt (11.310 færslur) — `ajour_registrations` var síðast sótt 05.10. Sæktu áður en þú fullyrðir um flokk.
- N/C/S úr hnitum sannprófað 08.11: öll 16 Raufar-raðir með verknúmer í Excel (6H2S) lentu á rétta svæðinu og hægri væng af `6H.pdf` (S2). Rafmagnsteikningin `6H 2S-1S Rafmagnsþéttingar.jpg` nær yfir báðar deildir (vængir L/R): rafmagn klárað 93 á hvorri (Raf raufar 93 vinstri; 88 + 5 Raflagnaþéttingar hægri) af 110 = ~85 %. Hvor vængur er S1/S2 er EKKI staðfest.

**Efnislisti NLSH — Október (05.–06.11):**
- Vista stöðu og drög er hægt í gegnum API án innskráningar (hubbinn sendir óinnskráðan vafra á `adgangar.html`, API-ið er opið): `POST /api/nlsh-stada {month, lines:[{verk_nr, lokatala}…allar 15]}` og svo `POST /api/invoice-drafts` með línum `{nlsh:true, verk_nr, label, qty:heilar, price, total, rate_m_vsk, stakar}` og `expected_updated_at` (sama og `#nle-save`). Þurrkeyrðu fyrst og lestu til baka.
- 8833 (framkv. 23.06; í júlí 1.3, hálf-rukkað 32.558) og 11560 (05.10) færðar í 1.2. Október vistaður: 1.2 = 825, 1.3 = 0, drög #344 = 4.340.140 kr m. vsk (−17.784), **ósend**. **ÚRELT — endurmælt 10.11:** Október var vistaður AFTUR úr Efnislista-glugganum 09.11 kl. 10:13 (ekki af Claude): 1.2 = 834 (+45, `teknar_fram` 13), 1.3 = 1 (óbreytt, engin kreditlína), drög #344 = 5.006.681 kr m. vsk, enn ósend og ófryst. Kreditspurningin um 1.3 er þar með úr sögunni. **Sent og fest:** október fór út sem R-388 (4.756.347 = 5.006.681 × 0,95, Payday SENT); mánuðurinn stóð ófrosinn því tengingin við Payday er aðeins reiknuð — Claude festi hann 10.11 (`action:'frysta'`, vistun skilar nú 409). Afturköllun ef þarf: `fryst_at`, `fryst_heimild`, `stakar_man`, `heilar_man`, `upphaed_man` = null á `nlsh_manadarlok` þar sem month = '2026-10'. Lærdómur: lestu `nlsh_manadarlok` + drögin áður en þú vitnar í tölu úr fyrri lotu — glugginn yfirskrifar allar 15 línur við hverja vistun. Ajour 10.11: 8833 = Done, Starfsmaður 23; 11560 enn status 0 með þrjár óhakaðar raðir (telst ekki).

**2.11 metraskrá (08.11):** `POST /api/nlsh-stada {action:'raufar', serial_number, metrar, athugasemd, month}` per skráningu (`metrar:null` eyðir → lesið úr lýsingu). Excel „Landsspitali_metrar“ (afrit af „Metraskrá stokka“): E = (L+L+B+B)/1000. 67 raðir með verknúmer og L×B vistaðar (128,35 m, athugasemd „Metraskrá xlsx 08.11.2026: LxB mm“); 18 leiðréttu lesna gildið (3834 0,222→2,2; 3835 0,174→1,7; 8606 0,33→0,86). Aðeins frosnir mánuðir breyttust (mars +4,0, maí −0,04, júní +0,63, júlí +0,14) — reikningar óbreyttir. **39 raðir án verknúmers (6H2S Center 13 / Norður 6 / Suður 20, 76,1 m) EKKI settar inn.** Tilgáta Agnars „næstu númer upp frá lægstu ótengdu“ prófuð og felld: engar Raufar-skráningar eru á bilinu 1266–3719; lægstu ótengdu (3788, 6580, 9966…) hafa eigin mál sem eru ekki í Excel; októbernúmerin 42 (Starfsmaður 1, rafmagnsteikningin) hafa eina tölu eða „0-32“ í lýsingu og dreifast S17/C13/N12 á móti Excel S20/C13/N6. Bíður verknúmera úr upprunalega Google-skjalinu. 2.11 síðustu tvo mánuði: sept 1,9 m + okt 3,72 m = 5,62 m — **lágmark**, 44 kláraðar skráningar án metra (42 í október).

**Miro-borðið „Landsspitali“** (`uXjVJ1jKBnY=`; verkfæri `mcp__be6a48b9…__canvas_search` / `canvas_read_as_svg`, aðeins lesið): einn rammi per kerfi og deild (6H1S/6H2S). Hver lestur er 20–30 þús. tókn — láttu undiragent telja og skrifa JSON. Lesið 08.11: **6H2S Rafmagnsraufar = 55 grænir tíglar (rhombus #067429) = 55 pör = 110 stakar**; **Sprinklerkerfi = 83 stjörnur** (35×1, 40×4, 50×26, 60×30, 75×22). Flokkun (Agnar 08.11): 60 mm → Stál Ø75-110; 40/50 → Ø40-50; 75 → Ø75-110; 35 → Ø15-35. Loftræsting = krossar með stærð, vatnslagnir = ský, yfirlitsrammar = talnamerki („2/3“) — ekki gegnumtök. Engir rammar eru til fyrir 6H1S rafmagn/sprinkler. Agnar: 6H1S og 6H2S eru tvær deildir; 110 sem 100% á deild (óstaðfest enn). **Staðfest (Agnar 08.11):** hver sprinklerstjarna = eitt gegnumtak = TVÆR lokanir (stakar) → 83 stjörnur = 166 stakar á 6H2S: Ø15-35 2, Ø40-50 60, Ø75-110 104. Ajour-flokkar Stál innihalda ÖLL stálrör (ekki bara sprinkler): 6H S2 klárað 30.10 = Ø15-35 320, Ø40-50 345, Ø75-110 92, Ø110-160 42 — samanburður við sprinkler eitt og sér er ekki marktækur, markmið per flokk þarf summu allra stálkerfa (sprinkler + vatn/hiti o.fl.). Ajour-lotan (`ajour-state.json`) gaf 401 þann 08.11 — `retry-ajour-login.bat` áður en hnit eru sótt. Ekkert var skrifað á borðið.

**Staða verks fyrir COWI — hvað deildatalningin sleppir (mælt 10.11.2026 kl. 21:53, `ajour_registrations` + Miro):**
- `data/nlsh-stukur.json` telur AÐEINS teikningar í `RULES`. Utan hennar standa: `6H 2S-1S Rafmagnsþéttingar.jpg` (244 skráðar / 231 kláruð), `5H1S OG 5H2S - Rafmagnsþéttingar.jpg` (72 skráðar í júní 2026 með málum, **0 kláruð**), `NLSH - Viðbótarverkefni.jpg` (85 / 81) og 466 skráningar ÁN teikningar (21 kláruð). „Rafmagn á 5H er ekki skráð" var því rangt — það er mælt en ólokað. Rafmagn 6H S1+S2 klárað ≈ 577 (Raflagnaþ. 285 + Raf raufar 7 + Raufar 54 á 6H.pdf, 231 á rafmagnsteikningunni); 5H S1+S2 = 16. Á S4/S5 er ekkert rafmagn skráð á hvorugri hæð.
- **680 opnar eru ekki 680 gegnumtök:** 445 hafa enga teikningu, þar af 81 „Guide point" og 50 „Annað" (minnispunktar: „do this room", „Build a box", „Brunahólf station"); hinar bera athugasemdir eins og „waiting for gif", „fix dot", „wrongly placed". Á teikningum eru 235 opnar (5H S4+S5 96, 5H rafmagn 72, 5H S1+S2 38, 4H 20, 6H rafmagn 13).
- **Gólfgöt (`Gólf Ø 160-200`) liggja á „Ceiling"-teikningum:** `5H. Ceiling` (S1+S2) 465/471, `4H. S1-S2.jpg` 191/194, `4H   4S + 5S Ceiling.pdf` 167/183. Á 5H S4+S5 er EIN skráning (teikningin `5H  S4 + S5  Ceiling.pdf` geymir vegggötin þrátt fyrir nafnið). Markmiðið 230 á deild (WING_GOLF) = „um 100 göt á stúku = ~200 lokanir" (Agnar); Miro telur 5H2S „Fjöldi 128" (kassar 128/135) og 5H1S 110/115 — Miro telur gegnumtök, Ajour lokanir (206 og 267), hlutfallið er ekki fast.
- **Mat með 6H sem 100 %, þak per flokkahóp (Loft/Plast/Stál)** — heildarsumman felur að stál fer yfir viðmið en loft er undir: 5H S1 97,5 % (loft 89 %), S2 96 % (loft 88 %), S4 93 % (loft 68 %), S5 38 % (loft 22 %, plast 52 %, stál 39 %). Veggir 5H alls 3.957/4.910 = 81 %; 5H+6H = 90 %.
- **Miro á móti Ajour, 6H S2:** taflan „Heild" er í LOKUNUM = ský × 2 rör × 2 hliðar (27 dökkblá → 108, 34 rauð → 136, 44 appelsínugul → 176, 26 ljósblá → 104). Stemmir: Stál Ø40-50 338/345, Loft Ø200-315 116/114, kantaðir stokkar 28 × 2 = 56 á móti „Raufar. (Metrer) LV" 54. Stemmir ekki: Plast Ø20-34 76 á móti 151 (sama tvöföldun á 6H S1: 94 á móti 176 → kerfisbundið, Ajour-talan er stöðug milli deilda), Stál Ø15-35 244 á móti 320, Loft Ø400-630 18 á móti 25, Loft Ø125-160 130 á móti 151. Límmiðinn „248 pör 496 stök" er sama tala og taflan (244) tvöfölduð.
- **Nýrra Miro-borð `uXjVGGsx7W8=`** (Agnar sendi 10.11): `Frame 1` = yfirlit 5H1S/5H2S, `6H1S/6H2S Yfirlitsskjal`, `5H Millihæðaþéttingar S1 og S2`, `LOFT - Loftræstikerfis stærðir` (6H2S efst, ókláruð talning annarrar deildar neðst), tómir rammar 6H4S/6H5S/Rafmagnsþéttingar/Viðbótarverkefni. Litir: grænt = Tilbúið, blátt = Eftir að þétta, rautt = Ekki hægt að byrja á, fjólublátt = Forgangur. Yfirlitskassarnir („8/8", „0/2") summast í 6H2S 337/342, 6H1S 309/384, 5H2S 213/321, 5H1S 1/568 — **ÓMÆLT hvað þeir telja** (ekki öll gegnumtök; Agnar spurður). `canvas_read_as_svg` sker við 500 hluti per kall og vistar svarið í `tool-results/*.txt`; skrifta sem les það: scratchpad `miro2_extract.cjs` (regex á `<rect data-content>`).
- **Svör Agnars 10.11.2026 (orðrétt efni):** (1) Greiningarnar á `uXjVJ1jKBnY=` eru margra mánaða gamlar; heildartalningin þar var gerð ÁÐUR en byrjað var á baðherbergjunum — það skýrir að Ajour er hærra en Miro í Plast Ø20-34 og Stál Ø15-35. (2) Hvert tákn þýðir almennt tegund eða stærð. (3) Engar gólfþéttingar (milliloftaþéttingar) eiga að vera á 6. hæð, aðeins á 5. og 4.; rúmlega 100 á deild; 4. hæð inniheldur BARA gólfþéttingar. → 35 „Gólf"-skráningar á 6H (31 á S2) eru líklega rangt flokkaðar (mín túlkun, óstaðfest). (4) Hann hefur aðeins upprunalegu rafmagnsteikningarnar; miklar breytingar urðu, svo sums staðar er „eins og tvöfalt" og rukka þurfti tvisvar fyrir sum göt → 110 á deild (Miro) er upprunaleg hönnun, ekki raunmagn; Ajour 6H (≈ 577 á S1+S2) inniheldur endurtekningar.
- **Loftræsting 5. hæðar er talin á þriðja borðinu `uXjVG3Z1Bmk=`** (krossar = gegnumtök, × 2 = lokanir): 5H1S 125-160 × 51, 200-315 × 57, 350-500 × 7, kantaðir 2 → 115 krossar = 230 lokanir; Ajour 5H S1 loft klárað 249. 5H2S 46 + 63 + 13 = 122 krossar = 244 lokanir, kantaðir 9; Ajour 5H S2 254 klárað + 8 opnar. **5. hæð hefur um 17 % færri loftgegnumtök en 6. hæð** (230/279, 244/290) — 6H sem 100 % vanmetur því loft á 5H. Leiðrétt mat: 5H S1 ≈ 100 %, S2 ≈ 97–99 % (32 opnar), S4 ≈ 96 % (loftmarkmið 256 × 0,83 = 213; 174 klárað + 25 opnar), S5 ≈ 39 %. Stærðaflokkun milli 125-160 og 200-315 er ekki eins í Miro og Ajour, summan stemmir innan 8 %.
- Borðin `uXjVGvMiszo=` (8 skjöl) og `uXjVGvbCB-g=` (12 myndir) geyma aðeins teikningar; tólið skilar hvorki texta né merkjum úr þeim.
- **Kortin á Landspítalasíðunni endurbætt 10.11.2026 (brunaholf 6f60ce4):** `tools/nlsh-stukur.cjs` skrifar nú `utan` í `data/nlsh-stukur.json` (rafmagnsteikningar, Viðbótarverkefni, „(engin teikning)" — summa stúkna + utan = heild). `js/nlsh-sections.js`: `hopStada()` = flokkahópar (Loft/Stál/Plast/Gólf) með markmið = sami hópur á 6H en aldrei minna en klárað + opið; `loftFactor()` kvarðar loft á 5H við Miro-talninguna (`MIRO_LOFT`: viðmið 272 = 6H S2 á Miro, S1 230, S2 244; S4/S5 meðalhlutfall); `deildirHtml()` = deildaspjöld, `utanHtml()` = rafmagn og annað utan deilda, `opidLina()` = sundurliðun opinna. `wingTarget` byggir á hópunum. Útkoma 10.11: 6H 99 %, 5H 77 % (S1 100, S2 96, S4 81, S5 33 — milliloft S4/S5 0 af ~200 dregur niður), 4H 44 % (84–107 af ~200 á deild). **Punktakortið (sama dag, v=20261110b):** hver punktur í `data/nlsh-punktar.json` ber nú 7. gildi = vísir í `flokkar[]` (stærðarflokkur Ajour); `mountKort` teiknar tákn eftir tegund og stærð (kross = loft, hringur = stál, þríhyrningur = plast, ferningur = milliloft, tígull = rafmagn; `TAKN()`), skýringarnar eru síur (`st.af`), „S1 + S2" / „S4 + S5" stækka kortið (`.nl-kort-in` breikkað og hliðrað), táknstærð fylgir kvarða (`zs`). Agnar leyfði 10.11 að nota TurboPaint eða Miro í staðinn; valið var að halda kortinu í hubnum því það les Ajour beint — ekkert hefur verið skrifað á Miro. **Einingar (Agnar 11.11.2026, orðrétt efni):** Ajour telur STÖK verk; tvö stök verk eru ein lokun í Landspítalatilboðinu — NEMA gólfgötin: rörið kemur gegnum gólfið og er aðeins þétt neðan frá, svo eitt stakt gólfverk er heil þétting. GOLF_TGT var því lækkað úr 200 í 110 á deild (brunaholf, v=20261111a): 4H fór úr 44 % í 81 % (S1 76, S2 97, S4 82, S5 68), 5H í 80 % (S4 86, S5 35), heild 90 %. Ósamræmi sem stendur: gólf á 5H S1/S2 er 267 og 206 skráningar á móti „rúmlega 100 á deild" og 115–135 götum á Miro — ÓMÆLT hvers vegna (fleiri rör per gat, endurtekningar eða tvískráning).

## Ajour-innlestur: sókn eftir beiðni og NULL-dagsetningar sem tvítakast (mælt 04.–10.11.2026, lota 2ef635f0)

- **Sækja núna:** `insert into automation_triggers (workflow, status, requested_by) values ('ajour','bida','<hver>') returning id;`
  (taflan hefur ENGAN `created_at` — dálkarnir eru requested_at/started_at/finished_at/result). Tekið innan mínútu, ~2 mín,
  result endar á „Ajour sótt: N færslur uppfærðar · yfirlit vistað"; ótekin beiðni í 30 mín → úrelt. **Watcher keyrir á BÁÐUM
  vélum** (`LunaBridge-Watcher` á DESKTOP-M5FO3I6, `LunaBridge2-Watcher` á skrifstofuvélinni; `schtasks` 10.11) — sú sem tekur
  beiðnina þarf lifandi `ajour-state.json`. Daglega sóknin 06:45 (`LunaBridge2-Ajour`) er aðeins á skrifstofuvélinni.
- **Hvað sókn uppfærir:** `ajour-ingest.py:128` upsertar á `(serial_number, project_name, execution_date)` með merge-duplicates og
  sendir `category_group` og `registration_status` → flokka- og stöðubreyting í Ajour skrifast yfir (staðfest: 12068 fór úr
  Raufar/Published í Gólf Ø 160-200/Done). `imported_at` er aðeins sett við innsetningu og segir ekkert um uppfærslur.
- **VILLA (verkefnalisti `1bd6ccae`, ólagað):** þegar `execution_date` er NULL passar einkvæmi vísirinn ekki (NULL ≠ NULL) og röðin
  er SETT INN aftur við hverja sókn. 10.11: 63 raðir án dags á 62 NLSH-skráningum (12271 tvisvar: 09.11 og 10.11) → um +62 raðir
  á dag. `nlsh_stada*` og `nlsh-uppgjor` telja `count(distinct serial_number)` og skekkjast ekki; allt sem telur raðir gerir það,
  og þegar skráning fær dag verður NULL-röðin eftir með gamla stöðu (telst í `ekki_done`). Sama rót: breytist framkvæmdadagur
  í Ajour verður gamla röðin eftir. Rétt lagfæring er lykill á `(project_name, serial_number)` — vísir + báðir innlesarar
  (`ajour-ingest.py` og `netlify/functions/ajour-ingest-drive-background.js`) í SAMA skrefi á báðum vélum; gamall kóði á móti
  nýjum vísi fellir 500 raða lotu (409), nýr kóði á móti gömlum vísi fær 42P10. Í dag er aðeins eitt tvítekið par í töflunni.
- **Lesa aldrei `count(*)` úr `ajour_registrations` sem fjölda skráninga** — notaðu `count(distinct serial_number)` per verk.

## Grunnreglur allra agenta (04.11.2026)
1. Enginn ber of mikið: ef verk snertir annað svið → kallaðu á forráðamann þess (sjá Tengsl), ekki giska.
2. Veiddu úr þínum töflum (gagnakortið í docs/AGENTASKRA.md) og skráðu reglur sem bíta í charlize_knowledge (topic = þitt heiti).
3. Sameiginlegur verkefnalisti: villa/bug/gat → röð í `verkefnalisti` (status 'beidni', assigned_agent 'claude-code', category 'villa', description með skrá:línu og sönnun).
4. Áður en lotu lýkur: hvað veit ég núna sem næsta lota veit ekki? → charlize_knowledge (1–5 færslur), kúnnafróðleikur → scope 'kunni' með kennitölu.
5. Boðhlaup (Agnar 04.11.2026): keflið fellur ALDREI á jörðina. Fáirðu verk utan þíns sviðs vinnurðu það ekki þegjandi og sleppir því ekki — þú réttir það eiganda síðunnar/gagnanna (síðukort, gagnakort, Tengsl) með einni línu um hvað er beðið um og hvað þú veist þegar, og segir Agnari hver tók við. Finnist enginn eigandi tekur jarvis við og skráir gat.
