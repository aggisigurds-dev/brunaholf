-- tv_company_history(fyrirtaeki_id) — FULL communication history for one company,
-- resolved to its customer_base and read from felag_samskipti (deduped by email).
-- Backs the "📜 Sjá alla póstsöguna" expander in the Slökkvitæki traffic-light popover
-- (patch 295) via GET /api/company-mail?co=<fyrirtaeki_id>.
--
-- SECURITY DEFINER + raised statement_timeout: felag_samskipti is a lateral address
-- matcher that times out on a full scan from anon; bounded here to ONE base it is fast
-- (e.g. Center Hótel base = 139 mails). Returns all-time, newest first, deduped by email.
-- Applied live 2026-08-20 via mcp apply_migration (name: tv_company_history).

create or replace function public.tv_company_history(p_fyrirtaeki_id bigint)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
set statement_timeout to '15s'
as $function$
  with b as (select customer_base_id as bid from fyrirtaeki where id = p_fyrirtaeki_id)
  select jsonb_build_object(
    'fyrirtaeki_id', p_fyrirtaeki_id,
    'base_id', (select bid from b),
    'mails', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.email_id, 'subject', x.subject, 'snippet', x.snippet,
        'sender_name', x.sender_name, 'sender_email', x.sender_email,
        'is_question', x.is_question, 'fra_okkur', x.fra_okkur,
        'received_at', x.received_at, 'via', x.via
      ) order by x.received_at desc)
      from (
        select distinct on (fs.email_id)
          fs.email_id, fs.subject, fs.snippet, fs.sender_name, fs.sender_email,
          fs.is_question, fs.fra_okkur, fs.received_at, fs.via
        from felag_samskipti fs
        where fs.customer_base_id = (select bid from b)
        order by fs.email_id, fs.received_at desc
      ) x
    ), '[]'::jsonb)
  );
$function$;

grant execute on function public.tv_company_history(bigint) to anon, authenticated, service_role;
