-- 2026-11-04 — charlize_sessions: lotuminnið (Agentakerfið 2.0, fasi 4)
-- Ein röð per Claude Code-lotu, skrifuð af tools/lotu-lok.cjs (Stop-hook, upsert á session_id)
-- og lesin af tools/lotu-byrjun.cjs (SessionStart-hook: „Síðustu lotur hér“).
--
-- RLS: charlize_knowledge er með RLS SLÖKKT og fullar anon/authenticated-heimildir (athugað
-- 04.11.2026: relrowsecurity=false, engar policies). Hér er JAFN opið fyrir hookana (anon-lykillinn
-- úr slokkvitaeki/js/config.js), en skráð sem RLS + policies svo security advisor kvarti ekki og
-- svo hægt sé að þrengja síðar. EKKI delete fyrir anon. Athugið: summary (600 stafir af síðasta svari)
-- er þá læsilegt hverjum sem hefur anon-lykilinn (sem er í opnum framenda) — sama staða og charlize_knowledge.
-- Kennitölur: hookarnir skrifa aðeins kt lögaðila (4–7…), aldrei einstaklinga.
--
-- KEYRA Í SQL EDITOR MEÐ SAMÞYKKI AGNARS. Prófun á eftir:
--   node tools/lotu-byrjun.cjs --texti            → „Síðustu lotur hér (brunaholf): engar skráðar enn.“
--   (eitt svar í lotu með Stop-hookinn á)          → select * from v_charlize_sessions_7d;

create table if not exists public.charlize_sessions (
  session_id     text primary key,
  cwd            text,
  repo           text,
  machine        text,
  started_at     timestamptz default now(),
  last_at        timestamptz default now(),
  turns          int default 0,
  agents_called  text[] default '{}',
  kennitolur     text[] default '{}',
  kunni_skrifad  int default 0,
  got            jsonb default '[]',
  summary        text,
  facts_written  int default 0
);

create index if not exists charlize_sessions_repo_last_idx on public.charlize_sessions (repo, last_at desc);

alter table public.charlize_sessions enable row level security;

drop policy if exists charlize_sessions_lesa on public.charlize_sessions;
create policy charlize_sessions_lesa on public.charlize_sessions
  for select to anon, authenticated using (true);
drop policy if exists charlize_sessions_skrifa on public.charlize_sessions;
create policy charlize_sessions_skrifa on public.charlize_sessions
  for insert to anon, authenticated with check (true);
drop policy if exists charlize_sessions_uppfaera on public.charlize_sessions;
create policy charlize_sessions_uppfaera on public.charlize_sessions
  for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.charlize_sessions to anon, authenticated;

-- Síðustu 7 dagar + merki um ólokið minni (kt nefnd, ekkert í kúnnaminni)
create or replace view public.v_charlize_sessions_7d with (security_invoker = true) as
select session_id, repo, machine, started_at, last_at, turns, agents_called, kennitolur,
       kunni_skrifad, facts_written, jsonb_array_length(coalesce(got, '[]'::jsonb)) as got_fjoldi, got, summary,
       (cardinality(kennitolur) > 0 and coalesce(kunni_skrifad, 0) = 0) as olokid_minni
from public.charlize_sessions
where last_at > now() - interval '7 days'
order by last_at desc;

grant select on public.v_charlize_sessions_7d to anon, authenticated;
