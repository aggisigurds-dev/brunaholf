-- Samningsbundin yfirvinna á verkstað (15.11.2026, PR #468 — sjálfvirk drög úr Tímaveru).
--
-- drog-timar.js stofnar og uppfærir drög líðandi mánaðar úr Tímaveru. Regla 15.10.2026: allir tímar fara í
-- DAGVINNU nema yfirvinna eigi við. Hvenær hún á við réði áður reiturinn eftirvinna_threshold_per_day, en hann
-- er EKKI samningsmerki: Viðskiptavinir-glugginn skrifar 8 (og eftirvinna_leyfid = true) við hverja vistun, svo
-- yfirvinna hefði laumast á hvert verk sem vistað væri þar (yfirferð Lisbeth 15.11.2026). Þessi reitur er sá eini
-- sem segir það: ekkert viðmót fyllir hann sjálfgefið, hann er AF nema Agnar haki við hann í Verðskrá
-- (Verðreglur-glugginn, „Yfirvinna samkvæmt samningi").
--
--   true  → sjálfvirk drög skipta tímum eftir tímabók: yfir 8 klst/dag á mann og helgar = yfirvinna.
--   false → allt í dagvinnu (nema drögin beri þegar yfirvinnu — þá réð manneskja því, regla 15.10).
--
-- Fjallaböðin Þjórsárdal fær true: öll drög þess með tímum (jan, feb, mar, apr, júl 2026) báru yfirvinnu
-- á samningstaxta 13.950 kr. Mælt 15.11.2026.
--
-- AÐGANGUR: pricing_guide er óbreytt að öðru leyti (sjá .claude/agents/oryggi.md um stöðu töflunnar);
-- nýr reitur, enginn nýr lestur eða skrif — /api/pricing-guide skrifar hann aðeins sé hann sendur (hvítlisti).

alter table public.pricing_guide
  add column if not exists yfirvinna_samningur boolean not null default false;

comment on column public.pricing_guide.yfirvinna_samningur is
  'Samningsbundin yfirvinna: sjálfvirk drög (drog-timar) skipta tímum eftir tímabók (8 klst/dag, helgar). Sjálfgefið af. 15.11.2026.';

update public.pricing_guide set yfirvinna_samningur = true
  where worksite_name = 'Fjallaböðin Þjórsárdal';
