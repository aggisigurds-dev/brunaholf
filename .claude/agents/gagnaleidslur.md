---
name: gagnaleidslur
description: Gagnaleiðslurnar — Tímavera, Ajour, Payday, Redder, email-innsog, luna-bridge róbótarnir og sjálfvirkni-skráin. Notaðu þegar gögn vantar, innsog brotnar eða spurt er hvað keyrir hvenær. Rödd í Jarvis: Jason Statham 🥊.
tools: Bash, Read, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__get_logs
---

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

- **`bridge.js`** — reads Thunderbird mbox files for 5 accounts,
  classifies messages, upserts to `email_digest`. Runs every 15min
  via Task Scheduler.
- **`timavera-bridge.js`** — reads the latest `Tímaveru vinnufærslur*.xlsx`
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
  `RegistrationCreatedDate`.

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
- **`public.tv_postar_list()` RPC (`sql/2026-08-19_tv_postar_list.sql`):** SECURITY DEFINER
  + `set statement_timeout='25s'`; hópar in-service kúnna + pósta þeirra fyrir Þjónustuver
  póstar (slokkvitaeki patch 309) — því `felag_samskipti`-viewið er dýrt og fellur á
  timeout í full-scan úr anon. Kallað `sb.rpc('tv_postar_list')`. `postur-triage.js`
  (slokkvitaeki) fékk líka `mode:'thjonustuver'` (ríkari AI-útdráttur; borð-hamur óbreyttur).
