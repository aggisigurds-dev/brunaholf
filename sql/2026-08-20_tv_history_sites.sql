-- tv_history_sites(days) — in-service building ids we have email history with,
-- derived from felag_samskipti (the SAME source Þjónustuver póstar uses) so the
-- 🟢 green traffic-light on Slökkvitæki's "Fyrirtæki í þjónustu" list can never
-- drift from that screen.
--
--   • resolved building where felag pins one (via single/evidence/addr)
--   • single-site fallback (lone building) for any base with unresolved rows
--
-- SECURITY DEFINER + raised statement_timeout: the felag_samskipti view is a
-- lateral address-matcher that times out on a full scan from anon; bounded to
-- in-service bases here it runs ~3.4s. company-mail.js calls it in PARALLEL with
-- its own email_digest scan (total ≈ max, not sum) and merges the ids as green.
--
-- Returns { ids: [bigint], detail: { "<site_id>": {from, subject, received_at} } }
-- where detail carries the newest INBOUND mail per site for the badge popover.
-- Applied live 2026-08-20 via mcp apply_migration (name: tv_history_sites).

create or replace function public.tv_history_sites(days integer default 365)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
set statement_timeout to '20s'
as $function$
  with svc as (
    select id, customer_base_id from fyrirtaeki
    where er_i_thjonustu = true and deleted_at is null and customer_base_id is not null
  ),
  svc_sites as (
    select customer_base_id, count(*)::int n, min(id) lone
    from svc group by customer_base_id
  ),
  fs as (
    select coalesce(f.fyrirtaeki_id, case when ss.n = 1 then ss.lone end) as site_id,
           f.sender_email, f.subject, f.received_at, f.fra_okkur
    from felag_samskipti f
    join svc_sites ss on ss.customer_base_id = f.customer_base_id
    where f.received_at >= now() - make_interval(days => greatest(1, least(days, 1095)))
  ),
  ids as (select distinct site_id from fs where site_id is not null),
  best as (
    select distinct on (site_id) site_id, sender_email as from_addr, subject, received_at
    from fs
    where site_id is not null and not fra_okkur
    order by site_id, received_at desc
  )
  select jsonb_build_object(
    'ids', (
      select coalesce(array_agg(i.site_id order by i.site_id), '{}')
      from ids i join svc s on s.id = i.site_id
    ),
    'detail', (
      select coalesce(jsonb_object_agg(b.site_id::text, jsonb_build_object(
               'from', b.from_addr, 'subject', b.subject, 'received_at', b.received_at)), '{}'::jsonb)
      from best b join svc s on s.id = b.site_id
    )
  );
$function$;

grant execute on function public.tv_history_sites(integer) to anon, authenticated, service_role;
