-- 2026-09-11 — Persónulega pósthólfið (aggisigurds@gmail.com) fer ALDREI inn í email_digest.
-- Agnar: „já eyða öllu tengt aggisigurds@gmail.com". Innsogið kom úr Thunderbird-brúnni á tölvunni „Notandi"
-- (source_path C:\Users\Notandi\AppData\Roaming\Thunderbird…), ekki úr skýinu. Lokað á þremur stöðum:
--   1) þessi trigger (grípur ALLAR leiðir: brú, gmail-ingest, vafrainnsog),
--   2) netlify/functions/gmail-ingest.js hafnar hólfinu (403), líka sem aðal-tengingu,
--   3) kerfisheilsa.js: aðal-Google-kortið lifir fyrir Drive/Sheets en án „Sækja póst núna".
-- Aðal-Google-tengingin (google_oauth) er VILJANDI látin vera — hún keyrir Drive og Sheets.
-- Eyðing eldri gagna er gerð handvirkt af Agnari í SQL Editor (sjá skilaboð 11.09.2026).
-- Beitt sem Supabase-migration `utiloka_personulegt_postholf`.

create or replace function public.bh_utiloka_personulegt_postholf()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(coalesce(new.account, '')) = 'aggisigurds@gmail.com' then
    return null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_utiloka_personulegt_postholf on public.email_digest;
create trigger trg_utiloka_personulegt_postholf
  before insert or update on public.email_digest
  for each row execute function public.bh_utiloka_personulegt_postholf();

comment on function public.bh_utiloka_personulegt_postholf() is
  'Hafnar röðum persónulega pósthólfsins (aggisigurds@gmail.com) í email_digest, frá hvaða innsogi sem er. Agnar 11.09.2026.';
