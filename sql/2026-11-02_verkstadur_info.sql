-- 02.11.2026 (Agnar, Kröfu yfirlit: „vanti mynd þarna af heimilisfanginu og að það sé hægt að sjá betri
-- upplýsingar og teikningar af verkstaðnum eins og á slökkvitæki company profiles").
-- Ein röð per verkstað (sama nafn og worksite_name í invoice_drafts / customer_worksite_map).
-- Myndin er sótt einu sinni (Slökkvitækja-fallið husmynd: Google Street View, annars loftmynd) og geymd í
-- public bucket `verkstadir`; húsupplýsingar + teikningalisti úr hus-upplysingar (skjalasafn / map.is).
-- Aðeins /api/verkstadur skrifar (service role) — RLS á, engar policyur.
create table if not exists public.verkstadur_info (
  worksite_name        text primary key,
  heimilisfang         text,
  heimilisfang_heimild text,          -- 'handvirkt' | 'nafn' | 'map'
  mynd_url             text,
  mynd_heimild         text,          -- 'google-streetview' | 'borgarvefsja-2018' | 'mapis-loftmynd' | 'engin'
  mynd_texti           text,          -- attribution, t.d. „Google Street View · 2024-08"
  hus                  jsonb,         -- { eign, tillogur, teikningar (samantekt), heimild }
  teikningar           jsonb,         -- styttur listi (gildandi grunnmyndir fyrst, mest 60)
  updated_at           timestamptz not null default now(),
  updated_by           text
);
alter table public.verkstadur_info enable row level security;

insert into storage.buckets (id, name, public)
values ('verkstadir', 'verkstadir', true)
on conflict (id) do nothing;
