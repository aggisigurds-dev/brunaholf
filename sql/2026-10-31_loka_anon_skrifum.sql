-- ============================================================================
-- LOKA ANON-SKRIFUM ÞAR SEM ENGINN ÞARF ÞAU (31.10.2026, allsherjar úttekt)
--
-- 1. cowork_js_patches — lifandi síður beggja vefja (Netlify snippet-innspýting,
--    utan git) sækja kóða úr töflunni og keyra hann með new Function(). Anon-lykillinn
--    mátti skrifa í hana, svo hver sem er gat keyrt kóða á öllum síðunum. Raðirnar
--    þrjár eru í dag aðeins athugasemdir. Nú: RLS á, anon/authenticated mega LESA
--    (hleðslan heldur áfram að virka), enginn má skrifa nema þjónustulykill.
-- 2. Afritstöflur (backup_*, cowork_*_backup(s), audit_settings_*) — ekkert í
--    kóðanum les þær (git grep í slokkvitaeki, brunaholf, luna-bridge, kjarni 31.10).
--    RLS á án policies, sama og eldri afritstöflurnar. merge_customers (SECURITY
--    DEFINER, eigandi postgres) skrifar áfram í cowork_merge_backups.
-- 3. audit_vernd — öryggisnetið sjálft mátti anon eyða. Gikkurinn audit_vernd_guard
--    er SECURITY DEFINER (postgres) og skrifar áfram. Anon/authenticated halda LESTRI
--    (300-stillingasaga, audit-skjal-endurkoma, audit_settings_endurgera).
-- 4. override_log — appið bætir við línum (153/199/270/280/490, drive-multitool,
--    link-heilsa) en breytir aldrei eða eyðir. Aðeins UPDATE/DELETE/TRUNCATE tekið.
--
-- AFTURKÖLLUN (ef eitthvað brotnar):
--   alter table public.cowork_js_patches disable row level security;
--   grant insert, update, delete on public.audit_vernd to anon, authenticated;
--   grant update, delete on public.override_log to anon, authenticated;
--   -- afritstöflur: alter table public.<nafn> disable row level security;
-- ============================================================================

alter table public.cowork_js_patches enable row level security;
drop policy if exists cowork_js_patches_les on public.cowork_js_patches;
create policy cowork_js_patches_les on public.cowork_js_patches
  for select to anon, authenticated using (true);

do $$
declare r record;
begin
  for r in
    select c.relname
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind = 'r'
       and not c.relrowsecurity
       and (c.relname like 'backup\_%'
            or c.relname in ('cowork_taeki_sync_backup', 'cowork_merge_backups',
                             'audit_settings_thjappad', 'audit_settings_rod'))
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    raise notice 'RLS á: %', r.relname;
  end loop;
end $$;

revoke insert, update, delete, truncate on public.audit_vernd from anon, authenticated;
revoke update, delete, truncate on public.override_log from anon, authenticated;
