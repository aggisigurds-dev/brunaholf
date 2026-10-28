-- Athugasemdir Agnars við hvern agent/skill (Jarvis → Sérfræðingar → Bæta við upplýsingum).
-- Lota les þær seinna og vinnur þær inn í agent-skrána; þá er status = 'tekid_inn'.
-- RLS kveikt án policy: aðeins service role (netlify/functions/agent-notes.js) kemst í töfluna.
create table if not exists public.agent_notes (
  id         bigserial primary key,
  agent      text        not null check (agent ~ '^[a-z0-9_-]{2,48}$'),
  note       text        not null check (length(note) between 1 and 4000),
  author     text,
  status     text        not null default 'nytt' check (status in ('nytt','tekid_inn','hafnad')),
  created_at timestamptz not null default now(),
  taken_at   timestamptz,
  taken_note text
);
create index if not exists agent_notes_agent_idx  on public.agent_notes (agent, created_at desc);
create index if not exists agent_notes_status_idx on public.agent_notes (status) where status = 'nytt';
alter table public.agent_notes enable row level security;
