-- 2026-06-04 — Customer-DB "finish" pass (applied to Supabase osfdzskyvisifcwyjkuk)
--
-- Companion record for changes applied live via the Supabase API while finishing
-- the customer-base cleanup. Re-runnable (guards included). Owner-confirmed via the
-- Verkborð (Miro) decisions board.
--
-- Scope:
--   1. customer_worksite_map: become the unified "payer (base) -> starfsstöð" table
--      (was a name-only draft of Brunahólf construction worksites). Add base_id +
--      heimilisfang; backfill base_id/kt_greidanda for exact customers_base name
--      matches; add Colas's 3 starfsstöðvar (one kt, three locations).
--   2. solur: link CampEasy sale; void (henda út) ICS + Hjallabraut 41 sales.
--   3. customers_base: harmonize VR-5 / Vélrás (same company, two kt by location).
-- ---------------------------------------------------------------------------------

begin;

-- 1a. New columns on the unified customer -> worksite/starfsstöð map -----------------
alter table public.customer_worksite_map
  add column if not exists base_id bigint references public.customers_base(id),
  add column if not exists heimilisfang text;

comment on column public.customer_worksite_map.base_id is
  'FK to customers_base — the payer customer this worksite/starfsstöð belongs to';
comment on column public.customer_worksite_map.heimilisfang is
  'Street address of the worksite/starfsstöð';

-- 1b. Backfill base_id + kt_greidanda for unambiguous exact name matches -------------
--     (Landsblikk->796, NSN tæki->743, SAFÍR byggingar->442). Leaves `confidence`
--     untouched (it records the worksite-match source, not the base match).
update public.customer_worksite_map m
set base_id      = b.id,
    kt_greidanda = coalesce(m.kt_greidanda, b.kennitala)
from public.customers_base b
where lower(btrim(m.customer_name)) = lower(btrim(b.nafn))
  and m.base_id is null;

-- 1c. Colas — one kt (420187-1499 / base 52), three starfsstöðvar -------------------
insert into public.customer_worksite_map
  (customer_name, base_id, kt_greidanda, worksite_name, heimilisfang, retention_pct, confidence, notes)
select v.customer_name, v.base_id, v.kt_greidanda, v.worksite_name, v.heimilisfang, 0,
       'owner-verkbord-2026-06-04', v.notes
from (values
  ('Colas', 52::bigint, '420187-1499', 'Óseyrarbraut', 'Óseyrarbraut, Hafnarfjörður', 'Colas starfsstöð 1/3 — ein kt, 3 staðir'),
  ('Colas', 52::bigint, '420187-1499', 'Gullhella',    'Gullhella 221, Hafnarfjörður', 'Colas starfsstöð 2/3 — ein kt, 3 staðir'),
  ('Colas', 52::bigint, '420187-1499', 'Álfhellu',     'Álfhellu, Hafnarfjörður',      'Colas starfsstöð 3/3 — ein kt, 3 staðir')
) as v(customer_name, base_id, kt_greidanda, worksite_name, heimilisfang, notes)
where not exists (
  select 1 from public.customer_worksite_map m
  where m.base_id = v.base_id and m.worksite_name = v.worksite_name
);
-- TODO (owner): Steypustöðin (kt 660707-0420 / base 720) has 3–4 starfsstöðvar —
-- site list not yet supplied; add the same way once provided.

-- 2a. CampEasy ehf. — link drop-off sale R-000247 to base 399 -----------------------
update public.solur set customer_base_id = 399
where num = 'R-000247' and customer_base_id is null;

-- 2b. Void (henda út, owner-confirmed) — ICS ehf. + Hjallabraut 41 ------------------
--     The app counts every status except 'drog' as income (tekjur.js /
--     54-sales-analytics.js: .neq('status','drog')), so 'drog' is the correct
--     "out of the books" lever. Reversible; audit note recorded in athugasemdir.
update public.solur
set status = 'drog',
    athugasemdir = '[VOID 2026-06-04 henda út – staðfest af eiganda] ' || coalesce(athugasemdir,'')
where num in ('R-000033','R-000034','R-000230','R-000241')
  and (athugasemdir is null or athugasemdir not like '[VOID 2026-06-04%');
-- (guard keeps re-runs from stacking the prefix; rows already voided are skipped)

-- 3. VR-5 / Vélrás — same company, two kt by location; harmonize -------------------
update public.customers_base set nafn = 'Vélrás'
where id = 265 and nafn = 'Vélrás Klettagörðum';          -- sits at Álhellu, not Klettagörðum

update public.customers_base set heimilisfang = 'Klettagörðum 12, 104 Reykjavík'
where id = 869 and heimilisfang like 'Klettagörðum 12 104 Reykjavík%';  -- de-garble

commit;
