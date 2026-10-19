-- 19.10.2026 — hub_state_merge: tímastimpill ræður í ui.vidmot (hliðarstikan o.fl.)
-- Keyrt í framleiðslu með Supabase MCP apply_migration (hub_state_merge_vidmot_ts). Hér til skjals.
--
-- Agnar: „hliðarstikan fer stanslaust í rugl … 20–30 sinnum". Röðin og flokkalínurnar búa nú í
-- ui.vidmot.hlidarstika = { v:{rod:[…]}, ts } (sjá HLIÐARSTIKA v2 í index.html). Vafrinn lætur hærri
-- ts vinna í _mergeIn — en þjónninn gerði það EKKI: vél sem vaknaði/dó með gamalt skjal sendi það í
-- pagehide-flush og hub_state_merge skrifaði það beint yfir nýrra skjal. Nú er vidmot-undirlykill með
-- {ts} aðeins tekinn inn ef ts hans er >= því sem þjónninn á. Gildir um ALLA vidmot-lykla (sama snið).
-- Allt annað í fallinu er óbreytt frá sql/2026-09-06_samstilling_per_lykil.sql.

create or replace function public.hub_state_merge(p_key text, p_ui jsonb default '{}'::jsonb, p_top jsonb default '{}'::jsonb, p_deep jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
as $$
declare
  cur jsonb; ui jsonb; sub jsonb; k text; sk text; res jsonb;
  ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  nytt jsonb; gamalt jsonb;
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
        nytt := p_deep->k->sk;
        if jsonb_typeof(nytt) = 'null' then sub := sub - sk;
        else
          -- 19.10.2026: vidmot-gildi með tímastimpli — eldra gildi má aldrei skrifa yfir nýrra.
          gamalt := sub->sk;
          if k = 'vidmot' and jsonb_typeof(nytt) = 'object' and jsonb_typeof(gamalt) = 'object'
             and (nytt->>'ts') ~ '^[0-9]+(\.[0-9]+)?$' and (gamalt->>'ts') ~ '^[0-9]+(\.[0-9]+)?$'
             and (nytt->>'ts')::numeric < (gamalt->>'ts')::numeric then
            null;   -- sleppt: þjónninn á nýrra
          else
            sub := jsonb_set(sub, array[sk], nytt, true);
          end if;
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
