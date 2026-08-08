-- Yfirferðar-flæði (2026-08-08): skrifstofan flaggar Efnislista til yfirferðar
-- hjá yfirmanni (The Big Boss app → yfirferd.html); yfirmaður breytir magni/
-- tímum, vistar og staðfestir af símanum. Staðan birtist á Ósendar-röðum í
-- Kröfu yfirliti. Keyrt á Supabase 2026-08-08 (apply_migration
-- invoice_drafts_review_columns) — þessi skrá er heimild, ekki til endurkeyrslu.
alter table invoice_drafts
  add column if not exists review_requested boolean not null default false,
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_requested_by text,
  add column if not exists review_confirmed_at timestamptz,
  add column if not exists review_confirmed_by text;
