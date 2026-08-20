-- oryggi_counts(): tölur fyrir Öryggi-sviðið á jarvis.html (svid-status.js).
-- SECURITY DEFINER svo það geti lesið pg_catalog/storage — en AÐEINS service_role
-- má keyra það (svið-fallið notar service-lykilinn); anon/authenticated fá ekkert.
-- Keyrt á verkefnið 2026-08-20 (apply_migration 'oryggi_counts_rpc').
create or replace function public.oryggi_counts()
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'toflur_alls', (
      select count(*) from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ),
    'rls_af', (
      select count(*) from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ),
    'rls_an_policy', (
      select count(*) from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        and not exists (select 1 from pg_catalog.pg_policy p where p.polrelid = c.oid)
    ),
    'buckets_alls', (select count(*) from storage.buckets),
    'buckets_public', (select count(*) from storage.buckets b where b.public)
  );
$$;

revoke all on function public.oryggi_counts() from public;
revoke all on function public.oryggi_counts() from anon;
revoke all on function public.oryggi_counts() from authenticated;
grant execute on function public.oryggi_counts() to service_role;
