-- 2026-07-28 — Vörubirgðir: birgir/seljandi á vörur.
-- Additive, nullable. Notað af 🏷️ Vörubirgðir-síðunni (vorubirgdir.js) svo hægt sé
-- að skrá HVAR hver vara er keypt. Deildur `vorur`-tafla (Slökkvitæki Sala + hub).
alter table vorur add column if not exists birgi text;
comment on column vorur.birgi is 'Birgir/seljandi sem varan er keypt af (Vörubirgðir-síða í brunahólf hub)';
