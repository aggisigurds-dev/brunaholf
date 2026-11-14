-- Efni nýja vefsins (vefur/): breytingar sem gerðar eru í ritlinum á síðunni sjálfri.
--
-- Ein röð á hverja útgáfu síðunnar (v1, v2, v3): drögin sem verið er að vinna í og útgáfan sem er birt.
-- vefur_efni_saga geymir hverja birta útgáfu, svo hægt sé að fara til baka.
--
-- AÐGANGUR (ákveðið við stofnun, sbr. reglu í .claude/agents/oryggi.md):
--   Hvorug taflan er opin. RLS er Á og ENGIN regla er til fyrir anon eða authenticated, og réttindi þeirra eru tekin af.
--   Eina leiðin að þeim er Netlify-fallið vefur-efni, sem notar service role.
--   Birta efnið er opinbert (það er það sem gestir sjá á vefnum), en fallið ber það fram, ekki taflan.
--   Skrif í gegnum fallið krefjast lykilorðs ritilsins (umhverfisbreytan VEFUR_RITILL_LYKILORD á Netlify-vef stjórnstöðvarinnar).
--   Sé hún ekki sett svarar fallið engu nema lestri á birtu efni.
--
-- Myndir sem hlaðið er upp í ritlinum fara í bucketinn vefverslun (opinn til lestrar, engin skrifregla fyrir anon),
-- undir forskeytinu vefur/. Enginn nýr bucket er stofnaður.

create table if not exists public.vefur_efni (
  utgafa        text primary key check (utgafa in ('v1', 'v2', 'v3')),
  drog          jsonb       not null default '{}'::jsonb,
  drog_uppfaert timestamptz not null default now(),
  drog_af       text,
  birt          jsonb       not null default '{}'::jsonb,
  birt_nr       integer     not null default 0,
  birt_kl       timestamptz,
  birt_af       text
);

alter table public.vefur_efni enable row level security;
revoke all on public.vefur_efni from anon, authenticated;

create table if not exists public.vefur_efni_saga (
  id         bigint generated always as identity primary key,
  utgafa     text        not null check (utgafa in ('v1', 'v2', 'v3')),
  nr         integer     not null,
  efni       jsonb       not null,
  af         text,
  created_at timestamptz not null default now()
);

alter table public.vefur_efni_saga enable row level security;
revoke all on public.vefur_efni_saga from anon, authenticated;
revoke all on sequence public.vefur_efni_saga_id_seq from anon, authenticated;

create index if not exists vefur_efni_saga_utgafa_nr on public.vefur_efni_saga (utgafa, nr desc);

insert into public.vefur_efni (utgafa) values ('v1'), ('v2'), ('v3') on conflict (utgafa) do nothing;
