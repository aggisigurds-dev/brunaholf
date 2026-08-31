-- ============================================================================
-- v_veidin_hunt_*  —  veiði-kortin sem herinn fann 31.08.2026
-- ============================================================================
-- Lesið af /api/veidin. Bætir við listum; breytir EKKI v_veidin_tolur /
-- amber / engin_skyrsla / rukkud. 153/187 óbreytt.
--
-- Skilgreiningar (lifandi, ekki fundnar upp):
--   systkini_kt     — þjónustustaður deilir kt með öðrum stað sem Á 2026-
--                     úttektarskýrslu, en hefur enga eigin á þessum fid.
--   blob_graen      — skurðpunktur systkini_kt og AppSettings-blob
--                     last_year_inspected=2026 (falskt grænt á HUD).
--   hud_buid_gloppa — í þjónustu, blob Búið 2026, engin 2026-skýrsla á fid.
--                     HUD/blob vs customer_documents — ekki sama tala.
--   drive_tvitok    — 2026 úttektarskýrslur merktar is_duplicate.
--   skjol_an_ars    — skjöl án árs (ekki samningur).
-- ============================================================================

create or replace view public.v_veidin_has_2026 as
select distinct fyrirtaeki_id as fid
  from customer_documents
 where doc_type = 'uttektarskyrsla'
   and year = 2026
   and fyrirtaeki_id is not null;

create or replace view public.v_veidin_blob_ly as
select (e.key)::int as fid,
       nullif(e.value->>'last_year_inspected','')::int as ly
  from app_settings a,
       lateral jsonb_each(a.settings->'arsskodun_customers') e(key, value)
 where e.key ~ '^\d+$';

create or replace view public.v_veidin_systkini_kt as
with sites as (
  select f.id, f.nafn, f.kennitala, f.heimilisfang,
         regexp_replace(coalesce(f.kennitala,''), '\D', '', 'g') as kt
    from fyrirtaeki f
   where f.deleted_at is null and f.er_i_thjonustu
     and length(regexp_replace(coalesce(f.kennitala,''), '\D', '', 'g')) = 10
), kt_with_report as (
  select distinct s.kt
    from sites s
    join v_veidin_has_2026 h on h.fid = s.id
)
select s.id as site_id, s.nafn, s.kennitala, s.heimilisfang
  from sites s
  join kt_with_report k on k.kt = s.kt
 where not exists (select 1 from v_veidin_has_2026 h where h.fid = s.id);

create or replace view public.v_veidin_blob_graen as
select s.site_id, s.nafn, s.kennitala, s.heimilisfang
  from v_veidin_systkini_kt s
  join v_veidin_blob_ly b on b.fid = s.site_id and b.ly = 2026;

create or replace view public.v_veidin_hud_buid_gloppa as
select f.id as site_id, f.nafn, f.kennitala, f.heimilisfang
  from v_veidin_blob_ly b
  join fyrirtaeki f on f.id = b.fid
 where b.ly = 2026
   and f.deleted_at is null
   and f.er_i_thjonustu
   and not exists (select 1 from v_veidin_has_2026 h where h.fid = b.fid);

create or replace view public.v_veidin_drive_tvitok as
select d.id as doc_id,
       d.fyrirtaeki_id as site_id,
       d.drive_file_id,
       d.customer_name,
       d.file_name,
       f.nafn as felag
  from customer_documents d
  left join fyrirtaeki f on f.id = d.fyrirtaeki_id
 where d.doc_type = 'uttektarskyrsla'
   and d.year = 2026
   and coalesce(d.is_duplicate, false) = true;

create or replace view public.v_veidin_skjol_an_ars as
select d.id as doc_id,
       d.doc_type,
       d.customer_name,
       d.file_name,
       d.drive_file_id,
       d.fyrirtaeki_id as site_id
  from customer_documents d
 where d.year is null
   and d.doc_type <> 'samningur';

create or replace view public.v_veidin_hunt_tolur as
select
  (select count(*) from v_veidin_systkini_kt)::integer as systkini_kt,
  (select count(*) from v_veidin_blob_graen)::integer as blob_graen_an_skyrslu,
  (select count(*) from v_veidin_blob_ly b
     join fyrirtaeki f on f.id = b.fid
    where b.ly = 2026 and f.deleted_at is null and f.er_i_thjonustu)::integer as hud_buid_2026,
  (select stadir_med_2026_skyrslu from v_veidin_tolur)::integer as stadir_med_2026_skyrslu,
  (select count(*) from v_veidin_hud_buid_gloppa)::integer as hud_buid_vs_skyrsla,
  (select count(*) from customer_documents
    where doc_type = 'uttektarskyrsla' and year = 2026)::integer as drive_2026_radir,
  (select count(distinct drive_file_id) from customer_documents
    where doc_type = 'uttektarskyrsla' and year = 2026
      and drive_file_id is not null and drive_file_id <> '')::integer as drive_2026_distinct,
  (select count(*) from v_veidin_drive_tvitok)::integer as drive_tvitok,
  (select count(*) from v_veidin_skjol_an_ars)::integer as skjol_an_ars;

grant select on public.v_veidin_has_2026          to anon, authenticated;
grant select on public.v_veidin_blob_ly           to anon, authenticated;
grant select on public.v_veidin_systkini_kt       to anon, authenticated;
grant select on public.v_veidin_blob_graen        to anon, authenticated;
grant select on public.v_veidin_hud_buid_gloppa   to anon, authenticated;
grant select on public.v_veidin_drive_tvitok      to anon, authenticated;
grant select on public.v_veidin_skjol_an_ars      to anon, authenticated;
grant select on public.v_veidin_hunt_tolur        to anon, authenticated;
