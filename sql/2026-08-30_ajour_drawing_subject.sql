-- Ajour CSV has drawing + subject (UI: Drawing/drawingname, Subject).
-- Ingest used to drop them; leftover-per-section needs drawing_name.
-- Applied on Supabase 2026-08-30 (apply_migration ajour_registrations_drawing_subject).
-- Safe to re-run (IF NOT EXISTS).
alter table public.ajour_registrations
  add column if not exists drawing_name text,
  add column if not exists subject text;

create index if not exists ajour_registrations_nlsh_drawing_idx
  on public.ajour_registrations (project_name, drawing_name);
