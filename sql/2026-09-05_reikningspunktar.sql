-- 2026-09-05 — Drög-stöð: innhólf fyrir reikningspunkta sem safnast yfir tíma áður en
-- reikningur er sendur (Agnar 04.09.2026: „draft invoice station … notes, hints, clues").
-- KEYRT í Supabase 05.09.2026 (apply_migration reikningspunktar_drogstod).
--
--   raw         = punkturinn eins og hann var sleginn inn — ALDREI breytt (regla 1: tapast aldrei)
--   status      = nytt → flokkad (tillaga komin) → notad (skrifað í invoice_drafts með ✓) | hafnad
--   worksite_name/work_month = hvaða drög punkturinn tilheyrir; NULL þar til raðað
--   ai          = tillaga flokkunarinnar {verkstadur, manudur, vissa, tegund, tolur, samantekt, spurningar}
--   applied     = hvað var raunverulega skrifað í drögin þegar Agnar ýtti á ✓ (rekjanleiki)
--   client_id   = UNIQUE svo biðröð vafrans (net datt út) geti endursent án tvítaka
-- Lesið og skrifað EINGÖNGU gegnum /api/reikningspunktar (service role) — RLS á, engar reglur.

create table if not exists public.reikningspunktar (
  id            bigserial primary key,
  raw           text not null,
  source        text not null default 'hub' check (source in ('hub','simi','postur','mynd','rodd')),
  author        text,
  client_id     text unique,
  attachments   jsonb not null default '[]'::jsonb,
  status        text not null default 'nytt' check (status in ('nytt','flokkad','notad','hafnad')),
  worksite_name text,
  work_month    text,
  ai            jsonb,
  applied       jsonb,
  applied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reikningspunktar_status on public.reikningspunktar (status, created_at desc);
create index if not exists reikningspunktar_verk   on public.reikningspunktar (worksite_name, work_month);
alter table public.reikningspunktar enable row level security;

-- 05.09.2026 (sama dag, apply_migration reikningspunktar_felag): eitt sameiginlegt innhólf fyrir
-- BÆÐI félögin. felag='slokkvitaeki' → worksite_name geymir KÚNNA (fyrirtaeki.nafn), work_month
-- valfrjálst, og 'apply' merkir punktinn aðeins notaðan (reikningurinn verður til í Slökkvitæki-appinu).
alter table public.reikningspunktar
  add column if not exists felag text not null default 'brunaholf' check (felag in ('brunaholf','slokkvitaeki'));
create index if not exists reikningspunktar_felag on public.reikningspunktar (felag, status);
