-- 19.10.2026 — Aðgangsstjórn stjórnstöðvarinnar (netlify/functions/hub-adgangar.js, adgangar.html).
-- Notandaskrá + ein stillingarröð (lykilorðs-hash, dulritað lykilorð til útsendingar, session-lykill,
-- einnota uppsetningarkóði). RLS er KVEIKT og engar policies → anon/authenticated komast ekki í töflurnar;
-- aðeins þjónustulykillinn (Netlify-föllin) les og skrifar.

create table if not exists public.hub_adgangar (
  id                bigint generated always as identity primary key,
  nafn              text not null,
  notandanafn       text unique,                       -- skammstöfun, hástafir (AS); tómt = getur ekki skráð sig inn enn
  starfsmannanumer  text,
  kennitala         text,
  postfang          text,
  simi              text,
  felog             text[] not null default '{}',      -- Brunahólf / Slökkvitæki
  rola              text not null default 'Starfsmaður' check (rola in ('Admin','Starfsmaður','Afgreiðsla')),
  sidur             text[] not null default '{}',      -- heiti síðna sem notandinn sér (Admin sér allar)
  virkur            boolean not null default true,     -- má skrá sig inn
  sent_at           timestamptz,                       -- aðgangsupplýsingar síðast sendar
  last_login_at     timestamptz,
  mistok            int not null default 0,            -- rangar tilraunir í röð
  laest_til         timestamptz,                       -- læstur eftir of margar tilraunir
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.hub_adgangar enable row level security;

create table if not exists public.hub_adgangar_stilling (
  id               int primary key default 1 check (id = 1),
  pw_hash          text,                                -- scrypt (innskráning)
  pw_enc           text,                                -- AES-256-GCM (aðeins til útsendingar; lykill í Netlify-env)
  pw_changed_at    timestamptz,
  session_secret   text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  setup_hash       text,                                -- sha256 af einnota uppsetningarkóða; núllað þegar uppsetningu lýkur
  updated_at       timestamptz not null default now()
);
alter table public.hub_adgangar_stilling enable row level security;

revoke all on public.hub_adgangar, public.hub_adgangar_stilling from anon, authenticated;

-- 19.10.2026 — rofi „krefjast innskráningar": slökkt sjálfgefið; admin kveikir á adgangar.html þegar allir hafa lagað sig að.
alter table public.hub_adgangar_stilling add column if not exists krefjast boolean not null default false;

-- 19.10.2026 — hversu lengi innskráning varir: false = 10 klst, true = „alltaf" (eitt ár; ógildist þó við lykilorðaskipti).
alter table public.hub_adgangar_stilling add column if not exists session_alltaf boolean not null default false;

-- 19.10.2026 — sjálfstæður rofi fyrir Slökkvitæki-appið (slokkvitaeki.netlify.app); false = opnast án innskráningar.
alter table public.hub_adgangar_stilling add column if not exists krefjast_slokk boolean not null default false;
