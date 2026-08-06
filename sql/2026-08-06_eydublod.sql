-- Eyðublöð (brunaholf.netlify.app/eydublod.html) — vistuð skjöl + útgáfusaga.
-- Keyrt á osfdzskyvisifcwyjkuk 2026-08-06.
--
-- Hver útgáfa er sín eigin röð; `skjal_id` heldur útgáfunum saman svo hægt sé
-- að opna nýjustu útgáfu, breyta henni og vista sem NÝJA útgáfu án þess að
-- eldri PDF glatist (hann er mögulega þegar farinn til verkkaupa).
--
-- `gogn` geymir reitagildin sjálf — þau eru uppspretta sannleikans, PDF-inn er
-- afurðin. Þess vegna er hægt að endurskapa/breyta skjali löngu síðar.

create table if not exists public.eydublod_skjol (
  id           uuid primary key default gen_random_uuid(),
  skjal_id     uuid not null default gen_random_uuid(),
  utgafa       int  not null default 1,
  form_id      text not null,
  titill       text,
  stadur       text,
  dagsetning   date,
  gogn         jsonb not null default '{}'::jsonb,
  skra_nafn    text,
  storage_path text,
  public_url   text,
  created_at   timestamptz not null default now(),
  created_by   text,
  unique (skjal_id, utgafa)
);

create index if not exists eydublod_skjol_skjal_idx   on public.eydublod_skjol (skjal_id, utgafa desc);
create index if not exists eydublod_skjol_created_idx on public.eydublod_skjol (created_at desc);

-- Geymslan fyrir PDF-ana. Public eins og systurfötur (`efnislisti-pdf`,
-- `samningar`) svo verkkaupi geti opnað hlekkinn án innskráningar.
insert into storage.buckets (id, name, public)
values ('eydublod', 'eydublod', true)
on conflict (id) do nothing;

-- ATH: RLS er slökkt hér eins og á 19 öðrum töflum (sjá „Security note" í
-- CLAUDE.md). Taka skal á því sem heildarverki með stefnum per töflu, ekki
-- stakt hér — að kveikja á RLS án stefnu læsir appið úti.
