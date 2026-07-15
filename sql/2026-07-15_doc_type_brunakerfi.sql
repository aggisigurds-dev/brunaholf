-- 2026-07-15 · felag-endurlestur: additive doc_type gildi 'brunakerfi'.
-- Úttektarskýrsla sem reynist (úr INNIHALDI) vera brunaviðvörunarkerfis-skýrsla
-- (viðtökupróf/árleg prófun, engar slökkvitækja-Fjöldi-línur) fær doc_type
-- 'brunakerfi' — skýrslu-lesarar sía doc_type='uttektarskyrsla' og hætta þá
-- réttilega að telja hana. year_shape: brunakerfi má vera með eða án árs.
-- (KEYRT LIVE gegnum Supabase-migration customer_documents_doc_type_brunakerfi.)
alter table customer_documents drop constraint if exists customer_documents_doc_type_check;
alter table customer_documents add constraint customer_documents_doc_type_check
  check (doc_type = any (array['samningur','uttektarskyrsla','reikningur','brunakerfi']));
alter table customer_documents drop constraint if exists customer_documents_year_shape;
alter table customer_documents add constraint customer_documents_year_shape
  check ( (doc_type = 'samningur' and year is null)
       or (doc_type in ('uttektarskyrsla','reikningur') and year is not null)
       or (doc_type = 'brunakerfi') );
