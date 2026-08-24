-- portal_messages — samskipti (fyrirspurnir) milli viðskiptavinar og starfsfólks
-- á Þjónustuvefnum. Ein lína per skilaboð, bundin við base_id (rekstrarfélag).
--
-- ÖRYGGI: RLS kveikt, engar policies → aðeins server-föll (service-role) lesa/skrifa.
-- Viðskiptavinur sér AÐEINS sinn þráð (gatt.js síar á base_id úr tokeni).

create table if not exists portal_messages (
  id                uuid primary key default gen_random_uuid(),
  base_id           integer not null,          -- → customers_base.id
  sender            text    not null,          -- 'kunni' (viðskiptavinur) | 'starf' (starfsfólk)
  body              text    not null,
  author_name       text,                      -- nafn sendanda (valfrjálst)
  created_at        timestamptz not null default now(),
  read_by_staff     boolean not null default false,
  read_by_customer  boolean not null default false
);

create index if not exists portal_messages_base_idx
  on portal_messages (base_id, created_at);

alter table portal_messages enable row level security;
-- Viljandi engar policies: aðeins service-role kemst í töfluna.
