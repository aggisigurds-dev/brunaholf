-- 2026-07-27 — v_service_gaps
-- „Gleymt að skrá í þjónustu": fyrirtæki sem eiga úttektarskýrslu / brunakerfi /
-- þjónustusamning (customer_documents) EN enginn lifandi staður þeirra er merktur
-- er_i_thjonustu. Öfug hlið á Skýrslu-vaktinni (v_stadir_skyrslu_stada).
-- Notað af netlify/functions/service-gaps.js (/api/service-gaps) + Bakendi-spjaldinu
-- „🕵️ Gleymt að skrá í þjónustu".

create or replace view v_service_gaps as
select
  b.id                                                              as base_id,
  b.nafn,
  b.kennitala,
  b.rekstrarfelag,
  count(*) filter (where d.doc_type in ('uttektarskyrsla','brunakerfi')) as skyrslur,
  count(*) filter (where d.doc_type = 'samningur')                  as samningar,
  max(d.year)                                                        as nyjasta_ar,
  (select count(*) from fyrirtaeki f
     where f.customer_base_id = b.id and f.deleted_at is null)       as lifandi_stadir
from customers_base b
join customer_documents d on d.customer_base_id = b.id
where d.doc_type in ('uttektarskyrsla','brunakerfi','samningur')
  and not exists (
    select 1 from fyrirtaeki f
    where f.customer_base_id = b.id
      and f.er_i_thjonustu is true
      and f.deleted_at is null
  )
group by b.id, b.nafn, b.kennitala, b.rekstrarfelag;

grant select on v_service_gaps to anon;
