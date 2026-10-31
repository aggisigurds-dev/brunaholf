-- ============================================================================
-- VÍSAR, HLEÐSLUSPÁ OG EINN REITUR (31.10.2026, allsherjar úttekt)
--
-- 1. email_digest: póstfyrirspurn Kerfisheilsu (data-sources-status, eitt kall per pósthólf)
--    keyrði 1,39 m. sinnum frá 02.08 á ~30 ms. Hún raðar `received_at desc nulls last` en eini
--    vísirinn var `received_at desc` (nulls first) og enginn vísir á account → full röðun í hvert sinn.
-- 2. Fjórir tvítaldir vísar (sama tafla, sömu dálkar) — hver skrif uppfærðu báða. eydublod_skjol_skjal_idx
--    (skjal_id, utgafa DESC) er EKKI tekinn: röðunin er önnur en í unique-lyklinum.
-- 3. v_hledsluspa.til_hledslu var GREATEST(öll tæki − öll nýleg, 0): umframhleðsla einnar tegundar (t.d. 41 duft
--    hlaðin á móti 8 í eigu) át upp aðrar tegundir, svo staðir sýndu „0 til hleðslu" þótt tegundadálkarnir segðu annað.
--    Nú: summa klemmdu tegundadálkanna að frádreginni óskilgreindri hleðslu, klemmt við 0.
--    Mælt fyrir breytingu: 57 staðir breytast, enginn lækkar, +123 tæki samtals, 27 staðir í þjónustu fara úr 0
--    (Colas Gullhella 1: 0→16, Hjálparsveit skáta 12→21, Colas Gullhella 0→8, Miklatorg/IKEA 46→52).
-- 4. Krókur 77 ehf. (fyrirtaeki 1896): reikningur R-001230, prófíll og arsskodun_report_facts segja 36 tæki
--    (20 léttvatn = 10× 6 L + 10× 3 L). Afritið í Ársskoðun sagði léttvatn 10 (26 alls) — línan „3L léttvatn
--    yfirferð" var aldrei talin. audit-t-s-i var rautt á þessu eina félagi.
--
-- AFTURKÖLLUN:
--   drop index if exists public.email_digest_account_received_idx, public.email_digest_received_nl_idx;
--   create index idx_email_digest_sender_lower on public.email_digest (lower(sender_email));
--   create index idx_customer_documents_fyrirtaeki on public.customer_documents (fyrirtaeki_id);
--   create index portal_users_base_idx on public.portal_users (base_id);
--   create index audit_settings_thjappad_id_idx on public.audit_settings_thjappad (id);
--   v_hledsluspa: endurkeyra DO-blokkina með old/new víxlað.
--   Krókur 77: jsonb_set … '10' (gamla gildið er líka í audit_vernd).
-- ============================================================================

create index if not exists email_digest_account_received_idx
  on public.email_digest (account, received_at desc nulls last);
create index if not exists email_digest_received_nl_idx
  on public.email_digest (received_at desc nulls last);

drop index if exists public.idx_email_digest_sender_lower;        -- = email_digest_sender_lower_idx
drop index if exists public.idx_customer_documents_fyrirtaeki;    -- = customer_documents_fyrirtaeki
drop index if exists public.portal_users_base_idx;                -- = portal_users_base_id_key (unique)
drop index if exists public.audit_settings_thjappad_id_idx;       -- = audit_settings_thjappad_pkey

do $$
declare
  d text;
  gamalt text := 'GREATEST(g.lettvatn + g.duft + g.co2 - COALESCE(s.lv_nyleg, 0::bigint) - COALESCE(s.duft_nyleg, 0::bigint) - COALESCE(s.co2_nyleg, 0::bigint) - COALESCE(s.osk_nyleg, 0::bigint), 0::bigint) AS til_hledslu';
  nytt text := 'GREATEST(GREATEST(g.lettvatn - COALESCE(s.lv_nyleg, 0::bigint), 0::bigint) + GREATEST(g.duft - COALESCE(s.duft_nyleg, 0::bigint), 0::bigint) + GREATEST(g.co2 - COALESCE(s.co2_nyleg, 0::bigint), 0::bigint) - COALESCE(s.osk_nyleg, 0::bigint), 0::bigint) AS til_hledslu';
begin
  d := pg_get_viewdef('public.v_hledsluspa'::regclass, true);
  if position(gamalt in d) = 0 then
    raise exception 'v_hledsluspa: gamla til_hledslu-formúlan fannst ekki — engu breytt';
  end if;
  execute 'create or replace view public.v_hledsluspa as ' || replace(d, gamalt, nytt);
end $$;

update public.app_settings
   set settings = jsonb_set(settings, '{arsskodun_customers,1896,equipment,lettvatn}', '20'::jsonb)
 where id = 1
   and settings #>> '{arsskodun_customers,1896,equipment,lettvatn}' = '10';
