-- 2026-11-04 — Lestrarhlutverk handa stjóra (Claude hans tengist með þessu)
-- Aðeins SELECT á public. Ekkert INSERT/UPDATE/DELETE, ekki superuser.
-- BYPASSRLS er KVEIKT (sjá neðst): 348 töflur eru með RLS og margar án policies — án þess sæi hlutverkið þær tómar.
-- Það er óhætt því hlutverkið hefur engin skrifréttindi.
-- Lykilorðið velur Agnar sjálfur í dashboardinu eða með:
--   alter role stjori_lesari with password '<lykilorð>';
-- Það fer ALDREI í þessa skrá né í Charlize (regla oryggi.md).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'stjori_lesari') then
    create role stjori_lesari login nosuperuser nocreatedb nocreaterole noinherit
      connection limit 5;
  end if;
end $$;
alter role stjori_lesari bypassrls;  -- lestur fram hjá RLS, engin skrif

grant connect on database postgres to stjori_lesari;
grant usage on schema public to stjori_lesari;
grant select on all tables in schema public to stjori_lesari;
grant select on all sequences in schema public to stjori_lesari;

-- Nýjar töflur sem postgres (migrations) stofnar verða líka lesanlegar
alter default privileges for role postgres in schema public grant select on tables to stjori_lesari;
alter default privileges for role postgres in schema public grant select on sequences to stjori_lesari;

-- Statement timeout svo þung fyrirspurn stífli ekki þjóninn (sbr. query_logs-reglan)
alter role stjori_lesari set statement_timeout = '30s';
