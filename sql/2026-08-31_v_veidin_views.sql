-- ============================================================================
-- v_veidin_*  —  sýnirnar á bak við Veiði-mælaborðið (jarvis.html / veidin.html)
-- ============================================================================
-- SÓTT ÚR GRUNNINUM 31.08.2026 með pg_get_viewdef(). Þær voru búnar til
-- 30.07.2026 („migration veidin_views", sjá netlify/functions/veidin.js:8) en
-- ÞÆR VORU ALDREI SETTAR Í ÚTGÁFUSTÝRINGU. Fram að þessari skrá var engin
-- heimild til á disknum: talan á mælaborðinu gat breyst án þess að nokkur sæi
-- það í git. v_service_gaps og v_bundle_coverage voru rétt vistaðar; þessar
-- fjórar duttu úr.
--
-- Þetta er AFRIT AF NÚVERANDI ÁSTANDI, ekki lagfæring. Skjalfestir gallar sem
-- mældust 30.-31.08 og bíða ákvörðunar Agnars:
--
--  1. v_veidin_amber síar `last_insp >= '2026-01-01'`. Dagsetning með árinu
--     4025/4026 STENST þá síu. 1.271 raðir í uttaeki bera slíkt ár (allar
--     FC-raðnúmer, allar frá 23.08.2026) og 17 af 41 amber-röðum eru þar
--     eingöngu þess vegna. Lagast við dagsetninga-leiðréttinguna, ekki hér.
--
--  2. v_veidin_rukkud_an_skyrslu telur reikning = customer_documents. Hún sér
--     hvorki solur né Payday, svo staðir sem voru rukkaðir í appinu vantar á
--     listann (mælt: a.m.k. 8). Hún síar heldur ekki is_duplicate né tómar
--     reikningsraðir — 37 afrit og 60 tómar raðir eru til fyrir 2026.
--
--  3. stadir_med_samning telur aðeins samninga sem PDF-skjöl. Töflurnar
--     thjonustusamningar (48 raðir) og kerfi_samningar (5) eru aldrei lesnar.
--
--  4. skyrslur_2026_reviewed mælir `reviewed`, sem þýðir „skjalið hangir á
--     réttum stað" — EKKI að skýrslan hafi verið yfirfarin. Fjölda-hnappur í
--     index.html:4019 gæti sett hana í 358 með einum smelli. Raunverulegu
--     fact-check gögnin eru í doc_factcheck.
--
--  5. skyrslur_2026 (nefnarinn) síar ekki is_duplicate — 42 af 358 eru afrit.
--
--  6. felog_med_netfang byggir á sama sites-CTE og felog_i_thjonustu og er því
--     hlutmengi þess. Hún fellur þegar félag fer úr þjónustu, óháð netfangi.
-- ============================================================================

create or replace view public.v_veidin_amber as
with insp as (
  select customer_base_id,
         count(*)::integer as taeki_skodud,
         max(last_insp)    as sidasta_skodun
    from uttaeki
   where last_insp >= '2026-01-01'::date
     and customer_base_id is not null
   group by customer_base_id
), r26 as (
  select distinct customer_base_id
    from customer_documents
   where doc_type = 'uttektarskyrsla' and year = 2026
     and customer_base_id is not null
)
select cb.id as base_id, cb.nafn, cb.kennitala, i.taeki_skodud, i.sidasta_skodun
  from insp i
  join customers_base cb on cb.id = i.customer_base_id
 where i.customer_base_id not in (select customer_base_id from r26);

create or replace view public.v_veidin_engin_skyrsla as
with r as (
  select distinct fyrirtaeki_id
    from customer_documents
   where doc_type = 'uttektarskyrsla' and year = any (array[2025, 2026])
     and fyrirtaeki_id is not null
)
select f.id as site_id, f.nafn, f.heimilisfang, f.kennitala,
       cb.nafn as felag, cb.rekstrarfelag
  from fyrirtaeki f
  left join customers_base cb on cb.id = f.customer_base_id
 where f.deleted_at is null and f.er_i_thjonustu
   and f.id not in (select fyrirtaeki_id from r);

create or replace view public.v_veidin_rukkud_an_skyrslu as
with re as (
  select distinct fyrirtaeki_id
    from customer_documents
   where doc_type = 'reikningur' and year = 2026 and fyrirtaeki_id is not null
), sk as (
  select distinct fyrirtaeki_id
    from customer_documents
   where doc_type = 'uttektarskyrsla' and year = 2026 and fyrirtaeki_id is not null
)
select f.id as site_id, f.nafn, f.heimilisfang, cb.nafn as felag
  from re
  join fyrirtaeki f on f.id = re.fyrirtaeki_id
  left join customers_base cb on cb.id = f.customer_base_id
 where f.deleted_at is null and f.er_i_thjonustu
   and re.fyrirtaeki_id not in (select fyrirtaeki_id from sk);

create or replace view public.v_veidin_tolur as
with sites as (
  select id, customer_base_id, netfang
    from fyrirtaeki
   where deleted_at is null and er_i_thjonustu
)
select
  (select count(*) from sites)::integer as stadir_i_thjonustu,
  (select count(distinct customer_base_id) from sites
    where customer_base_id is not null)::integer as felog_i_thjonustu,
  (select count(*) from sites where id in (
     select distinct fyrirtaeki_id from customer_documents
      where doc_type = 'uttektarskyrsla' and year = 2026
        and fyrirtaeki_id is not null))::integer as stadir_med_2026_skyrslu,
  (select count(*) from sites where id in (
     select distinct fyrirtaeki_id from customer_documents
      where doc_type = 'uttektarskyrsla' and year = 2025
        and fyrirtaeki_id is not null))::integer as stadir_med_2025_skyrslu,
  (select count(*) from customer_documents
    where doc_type = 'uttektarskyrsla' and year = 2026)::integer as skyrslur_2026,
  (select count(*) from customer_documents
    where doc_type = 'uttektarskyrsla' and year = 2026
      and reviewed)::integer as skyrslur_2026_reviewed,
  (select count(*) from customer_documents
    where year is null and doc_type <> 'samningur')::integer as skjol_an_ars,
  (select count(*) from sites where id in (
     select distinct fyrirtaeki_id from customer_documents
      where doc_type = 'samningur'
        and fyrirtaeki_id is not null))::integer as stadir_med_samning,
  (select count(distinct s.customer_base_id)
     from sites s join customers_base cb on cb.id = s.customer_base_id
    where coalesce(s.netfang, '') <> ''
       or coalesce(cb.netfang, '') <> ''
       or coalesce(cb.contact_email, '') <> '')::integer as felog_med_netfang,
  (select count(*) from v_service_gaps)::integer as gleymd_felog;

grant select on public.v_veidin_amber            to anon, authenticated;
grant select on public.v_veidin_engin_skyrsla     to anon, authenticated;
grant select on public.v_veidin_rukkud_an_skyrslu to anon, authenticated;
grant select on public.v_veidin_tolur             to anon, authenticated;
