-- 29.09.2026 (beitt um Supabase MCP, migration automation_triggers_bida_status)
-- Gamli luna-bridge watcher-inn a DESKTOP-M5FO3I6 spyr adeins um status='pending'
-- og keyrdi gamlar skriftur thegar ytt var a Samstilla-takkana. Nyjar beidnir fa 'bida';
-- nyi watcher-inn (skrifstofuvelin, luna-bridge) tekur baedi 'pending' og 'bida'.
alter table public.automation_triggers alter column status set default 'bida';
alter policy "anon can request runs" on public.automation_triggers with check (status in ('pending', 'bida'));
