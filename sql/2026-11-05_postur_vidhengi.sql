-- 2026-11-05 — Viðhengi úr Gmail-innsoginu (Agnar: „ég vil geta sótt gögn úr innsoginu“).
-- gmail-ingest.js skráði aðeins NÖFN viðhengja (email_digest.attachment_names); skrárnar sjálfar
-- fóru aldrei inn. Þessi tafla + lokaður bucket taka við þeim. Keyra í SQL Editor sem eigandi.
--
-- Lesaðeins fyrir alla nema þjóninn: föllin lesa/skrifa með service-lykli; anon/authenticated fá
-- ENGA stefnu (RLS á, engar policies) — aðgengi er um netlify/functions/postur-vidhengi.js (staff-hlið)
-- sem skilar undirritaðri slóð með gildistíma.

create table if not exists public.postur_vidhengi (
  id            bigserial primary key,
  message_id    text not null,                 -- email_digest.message_id (RFC Message-Id eða gmail:<hólf>/<id>)
  account       text not null,                 -- pósthólf (eldklar@eldklar.is …)
  folder        text,                          -- INBOX / SENT
  gmail_msg_id  text not null,                 -- Gmail messages.id
  attachment_id text,                          -- Gmail attachmentId (breytilegt milli sókna, aðeins til hliðsjónar)
  filename      text not null,
  mime          text,
  size          integer,
  storage_path  text not null,                 -- í bucket postur-vidhengi: <hólf>/<ár>/<gmail_msg_id>/<skrá>
  received_at   timestamptz,
  sha256        text,
  created_at    timestamptz not null default now(),
  unique (account, gmail_msg_id, filename)
);
create index if not exists postur_vidhengi_message_id_idx on public.postur_vidhengi (message_id);
create index if not exists postur_vidhengi_received_idx on public.postur_vidhengi (received_at desc);
alter table public.postur_vidhengi enable row level security;
-- engar policies viljandi: service-lykill einn kemst að

-- Lokaður bucket (public=false). Skrár sóttar um undirritaðar slóðir (storage/v1/object/sign).
insert into storage.buckets (id, name, public, file_size_limit)
values ('postur-vidhengi', 'postur-vidhengi', false, 20971520)
on conflict (id) do nothing;

comment on table public.postur_vidhengi is 'Viðhengi úr Gmail-innsoginu (gmail-ingest?vidhengi=1 / gmail-vidhengi-background). Skráin í bucket postur-vidhengi. 05.11.2026.';
