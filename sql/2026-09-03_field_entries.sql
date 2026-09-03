-- 2026-09-03 — Brunaþéttingar: verkstaða-appið (brunathettingar.html) · KEYRT í Supabase 03.09.2026
-- (apply_migration field_entries_brunathettingar). Skráningar starfsmanna á verkstað:
--   efni     = efni af lager sem á að fara á reikning verkkaupa (item_label/qty/unit/unit_price úr Verðskrá)
--   punktur  = lýsing/punktar úr verkinu (fara í innri athugasemd Efnislistans)
--   maeting  = athugasemd við starfsmann á degi (Veikur / Fjarverandi / Kom of seint …)
--   beidni   = beiðni til skrifstofu (Teikningar / Efni / Verkfæri …)
-- Lesið og skrifað EINGÖNGU gegnum /api/field-app (service role) — RLS á, engar reglur.
-- client_id (uuid frá appinu) er UNIQUE svo biðröð appsins geti endursent án tvítaka.

create table if not exists public.field_entries (
  id          bigserial primary key,
  kind        text not null check (kind in ('efni','punktur','maeting','beidni')),
  worksite_name text,
  work_month  text,
  entry_date  date not null default current_date,
  employee    text,
  author      text,
  item_label  text,
  qty         numeric(12,2),
  unit        text,
  unit_price  numeric(12,2),
  category    text,
  note        text,
  status      text not null default 'new' check (status in ('new','seen','done')),
  client_id   text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists field_entries_month_ws on public.field_entries (work_month, worksite_name);
create index if not exists field_entries_date on public.field_entries (entry_date);
alter table public.field_entries enable row level security;

-- Deilt með verkstað (TurboPaint-borð, hlekkir) — Agnar setur inn í hub-flipanum „Frá verkstað".
create table if not exists public.field_shares (
  id          bigserial primary key,
  kind        text not null default 'link',
  title       text not null,
  url         text not null,
  note        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.field_shares enable row level security;
