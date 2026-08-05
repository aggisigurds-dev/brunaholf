---
name: google-drive
description: Company rules for the Google Drive connector at Slökkvitæki ehf / Brunahólf ehf — the canonical folder map, the úttektarskýrsla/reikningur/samningur filename conventions, the never-delete safety contract, and when to use the connector vs. the server-side /api/drive-* pipeline. Use whenever a task touches Drive files, folders, or document filing — searching for a customer's skýrsla or reikningur, checking what is in a master folder, renaming, moving, deduping, or linking a document to customer_documents.
---

# Google Drive — Slökkvitæki ehf / Brunahólf ehf

Drive is the **document archive for the customer spine**. Every úttektarskýrsla,
reikningur and þjónustusamningur we issue ends up in one canonical folder, named
to a fixed convention, and indexed into Supabase `customer_documents`.

The Drive connector (`mcp__Google_Drive__*`) is for **reading and one-off
lookups**. Bulk filing, renaming, deduping and DB-linking already exist as
hardened server-side endpoints — use those instead (see *Routing* below).

## The folder map

All canonical folders live under parent `1ZATA15k-c4gXe27nl9IsAamMLub8PaCP`.
Verified live 2026-07-29; these IDs are hardcoded across `netlify/functions/*`
and `multitool.html`, so treat them as fixed:

| Folder | ID | Holds |
|---|---|---|
| Reikningar - Invoices | `1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p` | Slökkvitæki-issued invoices (master) |
| Úttektarskýrslur | `1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg` | Fire-extinguisher inspection reports |
| Þjónustusamningar | `1hu405fCw01mYtYSn4BqIPvhtPCPuzmwM` | Service contracts (canonical — see note below) |
| Brunakerfisúttektir | `1OtsCTzM6FEQbaKBrQ7SqEU6xFKGBWICu` | Fire-alarm inspection reports |
| Brunakerfis reikningar | `1Qp5TogjHhszE_4hfMW5ebGKLDHk5iqEV` | Fire-alarm invoices |
| Annað | `1H6izhb24L5Rp2m7XMgt1ss-MkcLltf5O` | Vendor / bókhald / unrelated (never linked to a customer) |
| Afgangsskjöl | `18eANj9Uj37kSqV7NLyv-c_aIP6qlWLW5` | Leftovers awaiting triage |
| Eyđa - dublicates | `1CnnNHm1xCukiTs806z9Ha1nZnSELM9k8` | The bin — duplicates are **moved** here, never deleted |
| Reikningar — Redder | `1GXs9fVXfl_nU2L8xBy_aDIKdiev8lgIt` | Redder **supplier** invoices (Brunahólf material costs) |

Scope every search to a folder — `parentId = '<id>'` — rather than searching all
of Drive. An unscoped `title contains` search reaches personal files and the
`Annað` junk drawer and will surface the wrong document.

**Two samningar folders exist — resolved 2026-08-05.** The old "Slökkvitæki -
Þjónustusamningar - Master" folder (`1f2kzXhbkU0xJ0MFPxRpWjoPmWZBlm1zZ`) turned
out to be empty; all 264 real contracts live in the plain "Þjónustusamningar"
folder (`1hu405fCw01mYtYSn4BqIPvhtPCPuzmwM`, created 2026-07-26), which Agnar
confirmed is canonical. Code (`relink-docs.js`, `samningar-read.js`,
`samningar-sheet.js`, `multitool.html`, `index.html`) now points at it. The old
"Master" folder is retired — don't write into it.

## Filename conventions

Names are not decoration — the readers parse them, so they are the cheapest
correct answer to "who does this document belong to". Built by
`nameReport` / `nameInvoice` / `nameSamningur` in `netlify/functions/drive-multitool.js`:

```
Úttektarskýrsla   Fyrirtæki - [staður] - kt - úttektarskýrsla - ár.pdf
Brunakerfi        Fyrirtæki - [staður] - kt - brunakerfi - ár.pdf
Reikningur        Fyrirtæki - [heimilisfang] - kt - R-000123 - ár - 12.345 kr.pdf
Samningur         Fyrirtæki - [heimilisfang] - kt - þjónustusamningur - ár.pdf
```

- kt is **dashed** (`600508-0400`) in filenames; `payday_invoices_slokk` and the
  matching helpers store it **digits-only**. Fold before comparing.
- **Rekstrarfélög** (one kt, many sites — Center Hótel, Pizzan, Colas): the
  headquarters row is named `Félag ehf - kt - …` with no street; a branch is
  `Félag Gata - full address - kt - …`. Never collapse two sites into one name.
- A trailing **` - #<fyrirtaeki_id>`** is a *site stamp* written by
  `uttekt-rename` / `drive-sort` / `uttekt-upload`. It is the strongest proof of
  which site a document belongs to — preserve it when renaming.
- Compare Icelandic names case- and diacritic-folded (`æ→ae`, `þ→th`, `ð→d`);
  `Center Hótel Arnarhvoll` and `Center Hótel - Arnarhvoll` are the same site.

## Safety contract

1. **Never delete a Drive file.** Not with the connector, not via any endpoint.
   Duplicates get **moved** to `Eyđa - dublicates`. This is standing policy and
   the whole server-side pipeline is built around it.
2. **Never overwrite a document link on a guess.** `customer_documents` is keyed
   by `invoice_number` (reikningar) or `(customer_base_id, doc_type, year)`
   (+ `fyrirtaeki_id` for a rekstrarfélag). Pointing a key at the wrong file is
   the highest-consequence mistake available here.
3. **Site (`fyrirtaeki_id`) only with proof** — the shared rule in
   `netlify/functions/_spine.js` (`resolveSite`), in order: `#id` stamp → the
   company has exactly one live site → address or distinguishing name matches
   exactly one site. Zero or two matches means **leave it untouched**. Never guess.
4. Writing to Drive (`create_file`, `copy_file`) is a real change to the
   company archive — confirm with the user first unless they asked for it
   explicitly.

## Routing — connector vs. the pipeline

Use the **connector** for: finding a specific customer's document, reading a
PDF's contents, checking whether a folder contains what you expect, verifying a
folder ID, answering "where does this document live".

Use the **server-side endpoints** for anything bulk or destructive — they carry
OCR fallback, retry/backoff, resumable batching, dedup, `override_log` auditing
and the spine rules, none of which the connector has:

| Job | Endpoint |
|---|---|
| Sort a messy folder into the canonical ones | `/api/drive-sort` |
| Preview + apply per-file rename/move/link | `/api/drive-multitool` (or `multitool.html`) |
| Rename reports / invoices to convention | `/api/uttekt-rename`, `/api/reikningar-rename` |
| Duplicate names → bin | `/api/drive-dedup` |
| Repair dead `drive_file_id` links | `/api/relink-docs` |
| Index PDFs into `customer_documents` | `/api/doc-index`, `/api/reikningar-read` |
| File into `<ár>/` subfolders | `/api/skjalavarsla` |
| Count documents per year | `/api/drive-count` |
| Assign doc → site + year by hand | `/api/match-station` (🔗 Skýrslu-stöð) |

Reach for these before writing new Drive code — the coverage is broad and each
one already handles the edge cases.

## Gotchas

- Master folders are **trees**, not flat — files may sit in `<ár>/` subfolders
  (Skjalavörsla). Recurse, or a live file reads as a dead link.
- `pdf-parse` fails on some scanned PDFs; the endpoints fall back to Google-Doc
  OCR. The connector has no such fallback — an empty read means "couldn't parse",
  not "empty document".
- Only **Slökkvitæki-issued** documents (issuer kt `600508-0400`) belong in the
  customer folders. A supplier invoice *to* us goes to `Annað` and is never
  linked to a customer.
- Walk-in / anonymous sale = kt `999999-9999`.
- Drive access lives **only** in Brunahólf. The Slökkvitæki web app has no Drive
  credentials — it saves PDFs to the Supabase `samningar` bucket and pushes a
  copy through `/api/uttekt-upload`.
