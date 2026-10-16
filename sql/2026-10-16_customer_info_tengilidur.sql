-- 2026-10-16 — Viðskiptavinir-síðan endurhönnuð (Agnar: „komast inn á page sem ég get sett einhverjar
-- upplýsingar um viðskiptavininn, eins og tölvupóstinn"). Þrír nýir reitir á greiðanda í customer_info;
-- netfang (contact_email) og sími (contact_phone) voru til fyrir. Allt nullable, engu breytt í gögnum.
-- Keyrt með apply_migration sama dag; skráin er heimild.
alter table public.customer_info
  add column if not exists contact_name  text,   -- tengiliður (nafn)
  add column if not exists invoice_email text,   -- reikningspóstur (ef annað en netfang tengiliðar)
  add column if not exists heimilisfang  text;   -- póstfang greiðanda (pricing_guide ber heimilisfang per verkstað)
