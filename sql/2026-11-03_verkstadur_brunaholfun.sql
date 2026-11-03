-- 03.11.2026 (HT-02.11 — Brunahólfun verkstaða): verkstaður ↔ teikningaborð Slökkvitækis + síðasta mæling brunahólfunar.
-- Keyrt á osfdzskyvisifcwyjkuk 03.11.2026 (Claude). Pilot: Skùlagata 26 → fyrirtaeki 1910 „Brunahólf - Skúlagata 26"
-- (customer_base_id 330 Brunahólf ehf, status óvirkur, er_i_thjonustu false — til svo teikning_bord virki, ekki þjónustukúnni).
alter table verkstadur_info add column if not exists slokk_company_id integer;
comment on column verkstadur_info.slokk_company_id is 'fyrirtaeki.id í Slökkvitæki sem á teikningaborðið (teikning_bord) fyrir þennan verkstað — Brunahólfs-röð (customer_base_id 330), HT-02.11';
alter table verkstadur_info add column if not exists brunaholfun jsonb;
comment on column verkstadur_info.brunaholfun is 'Síðasta mæling brunahólfunar (EI-merki, eldveggir, brunahólf per hæð) úr 3D-vél Teikningar — sér dálkur svo „Skrá heimilisfang" (sem skiptir hus út) þurrki hana ekki (HT-02.11)';
-- Snið: { maelt:'2026-11-03', adferd:'…', haedir:[{ nafn:'1. hæð', ei:15, eldveggir:30, holf:7, hurdir:21 }, { nafn:'Kjallari -1', ei:null, ath:'skönnuð teikning …' }] }
