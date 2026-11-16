-- 16.11.2026 — Tvítekning í Ajour-innlestri lagfærð (Agnar samþykkti; verkefnalisti 1bd6ccae).
-- Applied on Supabase 2026-11-16 (apply_migration ajour_registrations_afrit_tvitok_20261116
-- og ajour_registrations_einkvaemt_radnumer).
--
-- Rót: innlesararnir (luna-bridge/ajour-ingest.py og netlify/functions/ajour-ingest-drive-background.js)
-- upsertuðu á (serial_number, project_name, execution_date). Tómur framkvæmdardagur er NULL og NULL ≠ NULL í
-- einkvæmum vísi, svo skráning án dags var SETT INN aftur við hverja sókn. Mælt 16.11: 83 NLSH-númer
-- (12271–12388) tvítekin 2–13×, 655 aukaraðir. Gömul eintök með eldri stöðu töldust áfram í uppgjöri:
-- 12 skráningar sem voru Done 10.11 og Published síðan = 93.758 kr m/vsk oftalið í nóvember.
--
-- Mælt eftir á: 26.808 → 26.153 raðir, 0 tvítekin (project_name, serial_number); full sókn keyrð aftur á
-- nýja lyklinum (154.154 línur / 11.504 upsert) og raðafjöldinn stóð í 26.153.

-- 1) Afrit af öllum eldri eintökum (allt nema hæsta id per raðnúmer og verkefni). RLS á, engin stefna.
create table public.ajour_registrations_afrit_tvitok_20261116 as
select a.*, now() as afritad_at
from public.ajour_registrations a
where exists (
  select 1 from public.ajour_registrations b
  where b.project_name = a.project_name
    and b.serial_number = a.serial_number
    and b.id > a.id
);
alter table public.ajour_registrations_afrit_tvitok_20261116 enable row level security;
comment on table public.ajour_registrations_afrit_tvitok_20261116 is
  'Afrit 16.11.2026: eldri eintök tvítekinna raða úr ajour_registrations (NLSH, tómur framkvæmdardagur) fyrir eyðingu. Má eyða þegar nóvember-uppgjör NLSH er frosið.';

-- 2) Eldri eintökum eytt; nýjasta eintak (hæsta id = nýjasta imported_at, sannreynt) stendur.
delete from public.ajour_registrations a
using public.ajour_registrations_afrit_tvitok_20261116 f
where a.id = f.id;

-- 3) Gamli lykillinn sér nú tóman dag sem sama gildi → eldri innlestrarkóði (on_conflict á þremur dálkum,
--    t.d. óuppfærð luna-bridge á Heimatölvu) uppfærir í stað þess að bæta við.
alter table public.ajour_registrations
  drop constraint ajour_registrations_serial_number_project_name_execution_da_key;
alter table public.ajour_registrations
  add constraint ajour_registrations_serial_number_project_name_execution_da_key
  unique nulls not distinct (serial_number, project_name, execution_date);

-- 4) Rétti lykillinn: ein röð per raðnúmer og verkefni. Báðir innlesarar upserta á þennan frá 16.11.2026
--    (on_conflict=serial_number,project_name), svo skráning sem fær eða skiptir um framkvæmdardag uppfærist í sömu röð.
alter table public.ajour_registrations
  add constraint ajour_registrations_radnumer_verkefni_key unique (serial_number, project_name);

-- Endurheimt (ef þarf): fella ajour_registrations_radnumer_verkefni_key og setja raðirnar aftur inn úr afritinu
-- (allir dálkar nema afritad_at).
