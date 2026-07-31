-- v_bundle_coverage — REGISTRATION RULE for report↔invoice bundles (2026-07-31).
-- One row per (customer_base_id, year, kind) where a report AND/OR an app-invoice
-- exists. kind ∈ ('uttekt','brunakerfi'). Auto-matches as reports (customer_documents)
-- and invoices (solur.source) are made — the ongoing rule behind the 📦 Pör send button
-- in the apps (Slökkvitæki: Sala → Fyrri viðskipti + brunakerfis-síðan) and the
-- 🎯 Veiðin bundle goal (/api/veidin reads yr = current year).
--   stada: klarad          = báðum til (skýrsla + app-reikningur)  → tilbúið að senda
--          vantar_reikning = skýrsla til, enginn app- né Payday-reikningur (rukka)
--          vantar_skyrslu  = app-reikningur til, engin skýrsla á skrá (skrá/tengja)
--          reikn_payday    = skýrsla til, reikningur til í Payday (ekki paraður í app)
-- billed_payday flaggar Payday-spegil-reikning fyrir þá kt+ár svo dkPlus/Payday-rukkuð
-- skýrsla sé ekki ranglega „óinnheimt".
create or replace view v_bundle_coverage as
with rep as (
  select customer_base_id as base_id, year as yr,
    case when doc_type='brunakerfi' then 'brunakerfi' else 'uttekt' end as kind,
    count(*) as n_report,
    (array_agg(drive_file_id order by year desc))[1] as report_fid
  from customer_documents
  where doc_type in ('uttektarskyrsla','brunakerfi') and coalesce(is_duplicate,false)=false
    and customer_base_id is not null and year is not null
  group by 1,2,3
),
inv as (
  select b.id as base_id, (extract(year from s.created_at))::int as yr, s.source as kind,
    count(*) as n_invoice,
    (array_agg(s.num order by s.created_at desc))[1] as invoice_num,
    (array_agg(s.id  order by s.created_at desc))[1] as invoice_id
  from solur s join customers_base b
    on regexp_replace(coalesce(b.kennitala,''),'\D','','g') = regexp_replace(coalesce(s.customer_kt,''),'\D','','g')
   and length(regexp_replace(coalesce(s.customer_kt,''),'\D','','g'))=10
  where s.source in ('uttekt','brunakerfi') and s.status='final'
  group by 1,2,3
),
pay as (
  select b.id as base_id, (extract(year from coalesce(p.created_date,p.due_date)))::int as yr, count(*) as n_payday
  from payday_invoices_slokk p join customers_base b
    on regexp_replace(coalesce(b.kennitala,''),'\D','','g') = regexp_replace(coalesce(p.kt,''),'\D','','g')
   and length(regexp_replace(coalesce(p.kt,''),'\D','','g'))=10
  group by 1,2
),
u as (
  select coalesce(rep.base_id,inv.base_id) as base_id,
         coalesce(rep.yr,inv.yr) as yr,
         coalesce(rep.kind,inv.kind) as kind,
         (rep.base_id is not null) as has_report,
         (inv.base_id is not null) as has_invoice,
         rep.n_report, rep.report_fid, inv.n_invoice, inv.invoice_num, inv.invoice_id
  from rep full join inv using (base_id, yr, kind)
)
select u.base_id, b.nafn as felag, b.kennitala as kt, b.rekstrarfelag,
  u.yr, u.kind, u.has_report, u.has_invoice,
  coalesce(pay.n_payday,0) > 0 as billed_payday,
  u.n_report, u.report_fid, u.n_invoice, u.invoice_num, u.invoice_id,
  case
    when u.has_report and u.has_invoice then 'klarad'
    when u.has_invoice and not u.has_report then 'vantar_skyrslu'
    when u.has_report and coalesce(pay.n_payday,0) > 0 then 'reikn_payday'
    else 'vantar_reikning'
  end as stada
from u
join customers_base b on b.id = u.base_id
left join pay on pay.base_id = u.base_id and pay.yr = u.yr;

grant select on v_bundle_coverage to anon;
