-- Rekstrarfélags-prófíll (customer.html) — handvirk skráning í brunakerfisþjónustu.
-- Additive, nullable, afturkræft. Afleidd staða (brunakerfi_skyrslur / doc_type=brunakerfi)
-- gildir áfram þegar merkið er null; merkið leyfir að skrá þjónustu ÁÐUR en fyrsta skýrsla kemur.
alter table public.fyrirtaeki add column if not exists thjonusta_brunakerfi boolean;
comment on column public.fyrirtaeki.thjonusta_brunakerfi is
  'Handvirk skráning í brunakerfisþjónustu af rekstrarfélags-prófílnum (customer.html, 26.11.2026). NULL/false = ekki skráð handvirkt. Afturkræft.';
