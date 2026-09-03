-- 2026-09-03 — Samreikningur milli mánaða · KEYRT í Supabase (apply_migration invoice_drafts_samreikningur)
-- Agnar: „búa til nýjan sameiginlegan reikning milli mánaða — t.d. verk síðustu vikuna í mánuði og
-- fyrstu vikuna í þeim næsta — án þess að eyða hinum alveg strax", og: reikningurinn á að lenda
-- „í seinni mánuðinum".
--
-- Samreikningurinn ER drög SEINNI mánaðarins: engin ný röð, ekkert nýtt flæði gegnum PDF/kröfur/Vinnubók.
--   period_from/period_to  tímabil verksins (úr fyrstu/síðustu tímafærslu) — ræður Frá/Til í Efnislista,
--                          texta á reikningi og því hvaða daga tímaskýrslan nær yfir
--   merged_from            á samreikningnum: [{work_month, hours, stadfesting, net_an_vsk, total_m_vsk}]
--   merged_into            á upprunaröðunum: work_month samreikningsins (status verður 'merged')
--   merge_snapshot         eigin tölur seinni mánaðarins fyrir sameiningu → „Aftengja" skilar þeim
--
-- Upphæðir eru reiknaðar server-megin í /api/invoice-drafts (action 'merge'):
-- reitirnir leggjast saman, staðfesting brunaþéttinga fer EINU SINNI og
-- net = Σ net − tvítalin staðfesting (rétt óháð töxtum, því hvert net er innbyrðis rétt).

alter table public.invoice_drafts
  add column if not exists period_from    date,
  add column if not exists period_to      date,
  add column if not exists merged_from    jsonb,
  add column if not exists merged_into    text,
  add column if not exists merge_snapshot jsonb;

create index if not exists invoice_drafts_merged_into on public.invoice_drafts (merged_into) where merged_into is not null;
