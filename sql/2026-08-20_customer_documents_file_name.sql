-- customer_documents.file_name — the ORIGINAL Drive filename, verbatim.
-- Agnar names his master files in a structured convention:
--   "Fyrirtæki - Heimilisfang - kennitala - tegund - ár.pdf"
-- so the filename itself carries the ground-truth address + kt + year. The app
-- used to show the `notes` field ("drive-multitool · 2024" — a source stamp),
-- hiding the real name and losing that data. This column stores the true name so
-- the UI can show it AND parse it to fact-check the customer record (e.g. a
-- samningur whose filename says "Dofrahella 8" against a record that says
-- "Flatahrauni 23"). Also makes invoices/reports identifiable in the pairing UI.
--
-- Populated by drive-multitool.js (docRow.file_name = origName) going forward,
-- and backfilled from the master Drive folders. Applied live 2026-08-20 via
-- mcp apply_migration (name: customer_documents_file_name).

alter table public.customer_documents add column if not exists file_name text;

comment on column public.customer_documents.file_name is
  'Original Drive filename (structured "Fyrirtæki - Heimilisfang - kt - tegund - ár"). Source of truth for the doc name shown in the UI and for parsing address/kt to fact-check the customer record. Populated by drive-multitool + backfill from the master folders.';
