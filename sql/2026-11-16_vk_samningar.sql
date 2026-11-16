-- Verk í samningsviðræðum + punktar (Viðskiptavinir, panelinn undir Yfirliti) — 16.11.2026
-- Agnar: „statusupdate með verk í samningsviðræðum, og að ég geti punktað eitthvað þarna inn líka".
--
-- Aðeins Netlify-fallið verkkaupar.js (service role) les og skrifar: RLS á, ENGAR reglur, svo
-- anon-lykillinn í vafranum kemst hvorki í lestur né skrif (sama mynstur og vefur_efni).
-- Ekkert er eytt: eyðing setur deleted_at. Stöðuna `hunsad` fær tillaga úr pósti sem Agnar hafnar,
-- svo hún birtist ekki aftur (uppruni = 'mail:<efnislína>').

create table if not exists public.vk_samningar (
  id           bigserial primary key,
  heiti        text not null,
  greidandi    text,
  stada        text not null default 'i_vidraedum'
               check (stada in ('fyrirspurn','tilbod_sent','i_vidraedum','samthykkt','hafnad','hunsad')),
  upphaed      numeric,
  naesta_skref text,
  uppruni      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text,
  deleted_at   timestamptz
);

create table if not exists public.vk_punktar (
  id           bigserial primary key,
  samningur_id bigint references public.vk_samningar(id) on delete set null,
  texti        text not null,
  hofundur     text,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists vk_samningar_uppfaert_idx on public.vk_samningar (updated_at desc) where deleted_at is null;
create index if not exists vk_punktar_samningur_idx on public.vk_punktar (samningur_id, created_at desc) where deleted_at is null;

alter table public.vk_samningar enable row level security;
alter table public.vk_punktar   enable row level security;
