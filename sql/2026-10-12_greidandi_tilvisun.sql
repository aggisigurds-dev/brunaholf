-- 12.10.2026 (Agnar, Kröfu yfirlit, Borgarspítalinn · Áland 6):
-- „Kt. er 500300-2130 LSH og númerið sem þarf að koma fram er 21727. geturðu leyft mér að breyta
-- þessu þarna, vill skrá kennitöluna"
-- Payday R-371 (ágúst, Áland 6) bar tilvísunina „21727" og lýsinguna „Vegna 21727, Áland 6" —
-- tilvísunin er því per verk og á heima á verkstaðnum, drögin erfa hana.
-- Beitt sem migration `greidandi_tilvisun`.
alter table public.customer_worksite_map add column if not exists tilvisun text;
alter table public.invoice_drafts add column if not exists tilvisun text;
