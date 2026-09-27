-- Kostnaður (27.09.2026, Agnar): viðhengi úr pósti eldklar@eldklar.is lesin sjálfkrafa og flokkuð.
-- Ein röð = eitt viðhengi. Sótt og lesið af /api/kostnadur-sync (brunaholf); síðan „Kostnaður" í
-- Slökkvitæki-appinu les og tengir (fyrirtæki / verk / flokkur / staða).
create table if not exists public.kostnadur (
  id               bigserial primary key,
  account          text not null default 'eldklar@eldklar.is',
  message_id       text not null,              -- Gmail message id
  attachment_key   text not null,              -- skráarheiti + hlutanúmer (einkvæmt innan skeytis)
  skra_nafn        text,
  mime             text,
  staerd           integer,
  storage_path     text,                       -- bucket 'kostnadur' (lokaður; slóð undirrituð af föllum)
  sendandi         text,
  sendandi_email   text,
  efni             text,                       -- efnislína póstsins
  mottekid_at      timestamptz,
  -- Það sem Claude las úr skjalinu
  tegund           text,                       -- reikningur | kvittun | teya_yfirlit | kortayfirlit | greidsluselill | okkar_reikningur | tilbod | annad
  flokkur          text,                       -- verkstaedi | verk | efni | rekstur | bill | hugbunadur | annad | ekki_kostnadur
  seljandi         text,
  seljandi_kt      text,
  reikningsnr      text,
  dags             date,
  gjalddagi        date,
  upphaed          numeric,                    -- með VSK
  vsk              numeric,
  gjaldmidill      text default 'ISK',
  linur            jsonb default '[]'::jsonb,  -- [{lysing, magn, einingarverd, upphaed, dags?, kort?}]
  samantekt        text,
  tilvisun         text,                       -- verknúmer / tilvísun / staður sem skjalið nefnir
  ai               jsonb,
  ai_vissa         numeric,
  ai_villa         text,
  -- Tengingar (appið)
  fyrirtaeki_id    bigint,
  verkbeidni_id    bigint,
  thjonustubeidni_id bigint,
  stada            text not null default 'nytt', -- nytt | yfirfarid | hunsad
  nota             text,
  breytt_af        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (message_id, attachment_key)
);
create index if not exists kostnadur_mottekid_idx on public.kostnadur (mottekid_at desc);
create index if not exists kostnadur_flokkur_idx on public.kostnadur (flokkur);

alter table public.kostnadur enable row level security;
drop policy if exists kostnadur_anon_read on public.kostnadur;
create policy kostnadur_anon_read on public.kostnadur for select to anon, authenticated using (true);
-- Appið má aðeins breyta tengingum/flokkun/stöðu — innsetning og eyðing fara um þjónustulykil (fallið).
drop policy if exists kostnadur_anon_update on public.kostnadur;
create policy kostnadur_anon_update on public.kostnadur for update to anon, authenticated using (true) with check (true);

create or replace function public.kostnadur_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists kostnadur_touch on public.kostnadur;
create trigger kostnadur_touch before update on public.kostnadur for each row execute function public.kostnadur_touch();

-- Skjölin sjálf: lokaður bucket (reikningar birgja eru ekki opinberir).
insert into storage.buckets (id, name, public) values ('kostnadur', 'kostnadur', false)
  on conflict (id) do nothing;
