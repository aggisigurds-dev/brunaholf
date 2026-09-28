-- Kostnaður: mynd_path dálkur (28.09.2026).
-- Leyfir notanda að hlaða upp mynd af pappírsreikningi og tengja við röð.
-- Myndir eru vistaðar í sama bucket ('kostnadur') undir myndir/{id}/{timestamp}.{ext}.
alter table public.kostnadur add column if not exists mynd_path text;
