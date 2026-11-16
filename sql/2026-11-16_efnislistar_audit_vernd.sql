-- 16.11.2026 — Breytingasaga á efnislista og drög (KEYRT í grunni 16.11.2026, migration efnislistar_audit_vernd_2026_11_16).
--
-- Agnar 16.11.2026: „eldri efnislistar eyðast eða týnast … hef ekki hugmynd hver gömlu reikningarnir voru".
-- Mælt sama dag: invoice_drafts (ein röð per verkstað + mánuð) og efnislisti_documents áttu ENGA sögu — 0 raðir í
-- audit_vernd, enginn afritunartrigger. Yfirskrift (t.d. Tindasel okt. 2026 þegar tímaskýrslan var endursótt) var óafturkræf.
-- Slökkvitækis-töflurnar (solur, thjonustubeidni, fyrirtaeki …) hafa haft þessa vörn frá því í sumar.
--
-- Hvað þetta gerir: audit_vernd geymir ELDRI útgáfu raðar við hverja efnisbreytingu og hverja eyðingu.
-- Bætir aðeins við — breytir engum gögnum og engri hegðun. Uppfærsla sem breytir aðeins updated_at / updated_by er ekki skráð
-- (annars fyllti sjálfvirki tímainnlesturinn töfluna).
--
-- Endurheimta eldri útgáfu draga:
--   select id, changed_at, op, old_row from audit_vernd
--    where table_name = 'invoice_drafts' and old_row->>'worksite_name' = '<verkstaður>' and old_row->>'work_month' = '<áááá-mm>'
--    order by changed_at desc;
-- old_row er öll röðin eins og hún var FYRIR breytinguna (materials_jsonb, tímar, taxtar, upphæðir).

drop trigger if exists audit_vernd_trg_upd on public.invoice_drafts;
create trigger audit_vernd_trg_upd before update on public.invoice_drafts
  for each row
  when (((to_jsonb(old) - 'updated_at') - 'updated_by') is distinct from ((to_jsonb(new) - 'updated_at') - 'updated_by'))
  execute function public.audit_vernd_guard();

drop trigger if exists audit_vernd_trg_del on public.invoice_drafts;
create trigger audit_vernd_trg_del before delete on public.invoice_drafts
  for each row execute function public.audit_vernd_guard();

-- efnislisti_documents á ekkert id (lykill: verkstaður + mánuður + drive_file_id) → eigið fall sem setur lykilinn í row_id.
create or replace function public.audit_vernd_guard_efnislisti()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_vernd (table_name, op, row_id, old_row)
  values (TG_TABLE_NAME, TG_OP, old.worksite_name || '|' || old.work_month || '|' || coalesce(old.drive_file_id, ''), to_jsonb(old));
  if TG_OP = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists audit_vernd_trg_upd on public.efnislisti_documents;
create trigger audit_vernd_trg_upd before update on public.efnislisti_documents
  for each row
  when (to_jsonb(old) is distinct from to_jsonb(new))
  execute function public.audit_vernd_guard_efnislisti();

drop trigger if exists audit_vernd_trg_del on public.efnislisti_documents;
create trigger audit_vernd_trg_del before delete on public.efnislisti_documents
  for each row execute function public.audit_vernd_guard_efnislisti();

-- Prófað 16.11.2026: uppfærsla sem breytir aðeins updated_at → 0 afrit; breyting á notes → afrit með eldri texta;
-- breyting á title í efnislisti_documents → afrit með lyklinum í row_id. Prófunarraðirnar settar aftur eins og þær voru.
