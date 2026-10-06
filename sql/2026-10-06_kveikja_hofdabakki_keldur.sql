-- Kveikt á Höfðabakka 9B og KELDUR í Kröfu yfirliti (Agnar 06.10.2026: „mátt kveikja á höfðabakka og Keldur“).
-- Keyrt 06.10.2026 í Supabase.
alter table public.krofur_yfirlit_meta add column if not exists syna_alltaf boolean;
update krofur_yfirlit_meta set hidden = false, updated_at = now()
  where inv_key in ('ws|Höfðabakka 9B','ws|KELDUR','draftinv|KELDUR|2026-08') and hidden is true;
insert into krofur_yfirlit_meta (inv_key, hidden, paid, syna_alltaf, updated_at) values
  ('draftinv|Höfðabakka 9B|2026-01', false, false, true, now()),
  ('draftinv|Höfðabakka 9B|2026-03', false, false, true, now())
  on conflict (inv_key) do update set syna_alltaf = true, hidden = false, updated_at = now();
