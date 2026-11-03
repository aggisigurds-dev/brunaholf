-- Greiðendaskrá Payday (Brunahólf) — heimilisfangið, netfangið og síminn sem reikningarnir fara á.
-- 03.11.2026 (Agnar: „Mátt endurbæta allt sem þú sérð"): Viðskiptavinir-prófílarnir stóðu heimilisfangs- og netfangslausir
-- þótt Payday vissi hvort tveggja. payday-pull.js upsertar hingað í sömu keyrslu og reikningana (07/15 daglega);
-- verkkaupar.js sýnir gildin í prófílnum sem „Í Payday" með Nota-takka — skrifar aldrei sjálft í customer_info.
create table if not exists public.payday_vidskiptavinir (
  ssn            text primary key,          -- kennitala, aðeins tölustafir
  payday_id      text,
  nafn           text,
  heimilisfang   text,
  postnr         text,
  baer           text,
  netfang        text,
  simi           text,
  tengilidur     text,
  gjalddagi_dagar int,
  breytt         timestamptz,               -- customer.edited í Payday
  updated_at     timestamptz not null default now()
);
alter table public.payday_vidskiptavinir enable row level security;
