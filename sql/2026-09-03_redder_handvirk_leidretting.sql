-- 2026-09-03 — Handvirk leiðrétting Redder-reikninga · KEYRT í Supabase
-- (apply_migration redder_line_worksite_override + redder_month_override_and_bundle)
--
-- Agnar: „skiptu ýmis verk á verkstæði … opnaðu bara fyrir það að ég geti lagað reikningana"
-- og „mátt síðan opna á að ég geti sameinað reikninga eða búið til auka útgáfu með sameinuðu".
-- Allt er ritstýrt í Efniskostnaðar-glugganum og vistast strax; ENGINN reikningur er
-- afmyndaður — bókhaldsdagsetning, upphæðir og línur standa óbreytt.
--
--   redder_line_items.worksite_override — ein lína má tilheyra öðrum verkstað en reikningurinn,
--       svo safnreikningur („ýmis verk", 337.920 kr) skiptist á raunveruleg verk. Autt = fylgir
--       reikningnum. Ræður grúppun í redder-invoices, Gerð reikninga og Brunaþéttingar-appinu.
--   redder_invoices.month_override — efni keypt í lok mánaðar má teljast með næsta mánuði
--       (fylgir verkinu, ekki innkaupsdeginum). Síun og samantekt virða það.
--   redder_invoices.bundle_label   — nokkrir reikningar merktir sömu samstæðu; birtist á
--       spjaldinu svo sjáist að þeir eiga saman.

alter table public.redder_line_items
  add column if not exists worksite_override text;
create index if not exists redder_line_items_ws_override
  on public.redder_line_items (worksite_override) where worksite_override is not null;

alter table public.redder_invoices
  add column if not exists month_override text,
  add column if not exists bundle_label   text;
create index if not exists redder_invoices_bundle
  on public.redder_invoices (bundle_label) where bundle_label is not null;
