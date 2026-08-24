-- portal_users — aðgangur viðskiptavina að Þjónustuvefnum (/gatt/)
-- Grunnbygging kúndavefsins (Center Hótel pilot). Ein færsla per innskráningu;
-- hver binst NÁKVÆMLEGA einu customers_base.id (base_id) → einangrun.
--
-- ÖRYGGI: RLS KVEIKT en ENGAR policies → anon/publishable lykillinn kemst
-- EKKERT í töfluna (sama mynstur og `invoices`). Aðeins server-föll með
-- SUPABASE_SERVICE_ROLE_KEY lesa/skrifa hana. Lykilorð er ALDREI geymt í
-- hreinum texta — pass_hash = 'scrypt$<salt>$<hash>' (sjá _portal.js).

create table if not exists portal_users (
  id              uuid primary key default gen_random_uuid(),
  base_id         integer not null,            -- → customers_base.id (rekstrarfélag)
  slug            text,                        -- URL-auðkenni félags (/gatt/?c=<slug>)
  email           text,                        -- aðgangsorð/innskráning (lowercase); tómt þar til stofnað
  pass_hash       text,                        -- scrypt$salt$hash — null þar til lykilorð virkjað
  active          boolean not null default true,
  theme           text    not null default 'steel',   -- þema per viðskiptahóp
  display_name    text,                        -- t.d. "Center Hótel" (fyrir hausinn)
  failed_attempts integer not null default 0,  -- brute-force teljari
  locked_until    timestamptz,                 -- læst til (eftir of margar tilraunir)
  last_login      timestamptz,
  created_at      timestamptz not null default now(),
  created_by      text                         -- hver stofnaði (starfsmaður)
);

-- eitt netfang = einn aðgangur (aðeins þegar netfang er sett)
create unique index if not exists portal_users_email_key
  on portal_users (lower(email)) where email is not null and email <> '';

-- eitt slug = einn félags-URL
create unique index if not exists portal_users_slug_key
  on portal_users (slug) where slug is not null;

-- fljótleg uppfletting per félagi (stjórnsíðan listar aðganga per base)
create index if not exists portal_users_base_idx
  on portal_users (base_id);

alter table portal_users enable row level security;
-- Viljandi ENGAR policies: aðeins service-role (server-föll) kemst í töfluna.
