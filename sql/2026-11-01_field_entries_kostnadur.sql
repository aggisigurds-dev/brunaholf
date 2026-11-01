-- 2026-11-01 — Brunaþéttingar-appið: nýjar færslutegundir `kostnadur` og `verk`.
-- Agnar 01.11.2026: „tengingu við efnislistana, sem verkstjórarnir geta bætt við efniskostnaði inn í verkin“ + „light version
-- í verk í gangi, Landspítalann og Heklureit“ + „geta bætt við verki, ef hann er fyrstur á staðinn að taka út verkið“.
--   kostnadur = sérkaup: item_label (hvað) · category (verslun) · unit_price (upphæð ÁN vsk) · qty 1 · note (kvittun m. vsk …)
--   verk      = verk sem starfsmaður bætir við listann: worksite_name (heiti/staður) · note (athugasemd)
-- Eina breytingin er CHECK-reglan á kind; engin gögn hreyfast. Afturkallanlegt með því að setja gömlu regluna aftur
-- (eftir að `kostnadur`- og `verk`-raðir hafa verið fjarlægðar).
alter table public.field_entries drop constraint if exists field_entries_kind_check;
alter table public.field_entries add constraint field_entries_kind_check
  check (kind in ('efni','punktur','maeting','beidni','kostnadur','verk'));
