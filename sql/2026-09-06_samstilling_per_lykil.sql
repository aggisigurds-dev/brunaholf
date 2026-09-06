-- Samstilling per lykil (05.–06.09.2026) — RPC-föllin sem hub_state og Kröfu yfirlit nota.
-- Þegar keyrt í framleiðslu (Supabase MCP apply_migration: hub_state_merge_rpc, hub_state_merge_v2_and_ky_wf_merge).
-- Hér til skjals og fyrir nýja grunna. Sjá CLAUDE.md „SAMSTILLT MILLI VÉLA" og docs/UTTEKT-VAFRASTADA-20260905.txt.

-- hub_state: p_ui = heilir ui-lyklar (null = eyða), p_deep = map-lyklar sameinaðir per undirlykil,
-- p_top = topp-lyklar (tabs, buttons …) skipt út heilir. Raðlás (for update) → 4 vélar yfirskrifa aldrei hver aðra.
drop function if exists public.hub_state_merge(text, jsonb, jsonb);
create or replace function public.hub_state_merge(p_key text, p_ui jsonb default '{}'::jsonb, p_top jsonb default '{}'::jsonb, p_deep jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
as $$
declare
  cur jsonb; ui jsonb; sub jsonb; k text; sk text; res jsonb;
  ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select value into cur from public.app_kv where key = p_key for update;
  if cur is null or jsonb_typeof(cur) <> 'object' then cur := '{}'::jsonb; end if;
  ui := coalesce(cur->'ui', '{}'::jsonb);
  if jsonb_typeof(ui) <> 'object' then ui := '{}'::jsonb; end if;
  for k in select jsonb_object_keys(coalesce(p_ui, '{}'::jsonb)) loop
    if jsonb_typeof(p_ui->k) = 'null' then ui := ui - k;
    else ui := jsonb_set(ui, array[k], p_ui->k, true);
    end if;
  end loop;
  for k in select jsonb_object_keys(coalesce(p_deep, '{}'::jsonb)) loop
    sub := coalesce(ui->k, '{}'::jsonb);
    if jsonb_typeof(sub) <> 'object' then sub := '{}'::jsonb; end if;
    if jsonb_typeof(p_deep->k) = 'object' then
      for sk in select jsonb_object_keys(p_deep->k) loop
        if jsonb_typeof(p_deep->k->sk) = 'null' then sub := sub - sk;
        else sub := jsonb_set(sub, array[sk], p_deep->k->sk, true);
        end if;
      end loop;
    end if;
    ui := jsonb_set(ui, array[k], sub, true);
  end loop;
  ui := jsonb_set(ui, '{updated_at}', to_jsonb(ts), true);
  res := cur || coalesce(p_top, '{}'::jsonb);
  res := jsonb_set(res, '{ui}', ui, true);
  insert into public.app_kv (key, value, updated_at) values (p_key, res, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  return res;
end
$$;

-- Kröfu yfirlit: wf_state sameinast reit fyrir reit (vafrinn sendir aðeins breytta reiti — wf_patch).
create or replace function public.ky_wf_merge(p_inv_key text, p_patch jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
as $$
declare cur jsonb; k text; res jsonb;
begin
  select wf_state into cur from public.krofur_yfirlit_meta where inv_key = p_inv_key for update;
  if not found then
    insert into public.krofur_yfirlit_meta (inv_key, wf_state, updated_at) values (p_inv_key, '{}'::jsonb, now());
    cur := '{}'::jsonb;
  end if;
  res := coalesce(cur, '{}'::jsonb);
  if jsonb_typeof(res) <> 'object' then res := '{}'::jsonb; end if;
  for k in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if jsonb_typeof(p_patch->k) = 'null' then res := res - k;
    else res := jsonb_set(res, array[k], p_patch->k, true);
    end if;
  end loop;
  update public.krofur_yfirlit_meta set wf_state = res, updated_at = now() where inv_key = p_inv_key;
  return res;
end
$$;

-- Aðgerðaskrá agenta (06.09.2026) — sjá netlify/functions/agent-logs.js og P.log() í _portal.js.
create table if not exists public.agent_logs (
  id bigserial primary key, ts timestamptz not null default now(),
  agent text not null, action text not null, felag text, target text,
  input jsonb, output jsonb, status text not null default 'ok', duration_ms integer, by_who text, session_id text
);
create index if not exists idx_agent_logs_ts on public.agent_logs (ts desc);
create index if not exists idx_agent_logs_agent_ts on public.agent_logs (agent, ts desc);
alter table public.agent_logs enable row level security;
