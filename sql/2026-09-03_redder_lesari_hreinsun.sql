-- 2026-09-03 — Hreinsun eftir lagfæringu Redder-lesarans (redder-read.js) · KEYRT í Supabase
--
-- Tvær villur í lesaranum skildu eftir sig rusl í töflunni:
--   1) „Vegna"-lesturinn hljóp í enda skjalsins þegar ekkert stopporð fylgdi verkstaðnum,
--      svo vörulínu-slitur lentu í worksite_match (reikningur varð ósýnilegur í Efniskostnaði).
--   2) Dálkahaus vörulínanna („Vörunr.VöruheitiMagnEin.verðAfsl") rann aftan í sölumannsnafnið.
--
-- Lesarinn var lagaður (stopporð + vörunúmer stöðva lesturinn, öryggisventill í normWorksite)
-- og reikningar sem enn eru í Drive-möppunni voru endurlesnir með ?only=<nr>:
--   0142980 (01.09.2026, 419.021 kr) → „ýmis verk"     · 0125013 → „bíll Anþór"
--   0116455 → „Lagun"
-- Tveir elstu (2024) eru ekki lengur í möppunni og voru lagaðir hér beint.

update public.redder_invoices
   set salesperson = btrim(regexp_replace(salesperson, '\s*Vörunr.*$', ''))
 where salesperson is not null and salesperson ~ 'Vörunr';          -- 331 raðir

update public.redder_invoices set worksite_match = 'Álver Gundartangi' where invoice_nr = '0081639';
update public.redder_invoices set worksite_match = 'Norðurál'          where invoice_nr = '0079347';

-- Eftirlit: bæði á að skila 0.
-- select count(*) filter (where length(salesperson) > 30) as rusl_solumadur,
--        count(*) filter (where length(worksite_match) > 40 or worksite_match ~ '\d[.,]\d{2}') as rusl_verkstadur
--   from public.redder_invoices;
