-- 2026-08-07 — AFRIT af þeim 42 timavera_entries röðum sem fyrsta speglunar-
-- keyrslan (sjá netlify/functions/timavera-pull.js, beiðni 0138d239) fjarlægir.
--
-- Þetta eru draugaraðir: færslur sem var BREYTT eða EYTT í tímaveru.is en sátu
-- eftir hjá okkur af því `entry_key` inniheldur `time_in` — breytt innstimplun
-- gaf nýjan lykil, svo upsertið bjó til aðra röð í stað þess að uppfæra þá gömlu.
-- Þær tvítöldust í tímabók og Efnislista. Staðfest gegn LIVE Tímavera API
-- 2026-08-07: allar 42 vantar í núverandi stöðu Tímaveru.
--
-- Samtals 296,91 klst á tímabilinu 2026-06-29 → 2026-07-29.
-- Þyngst: Orkureitur júlí 22,79 klst (84,25 → 61,46 — passar við tímaveru.is),
-- og tvær augljóslega gallaðar Tímaveru-færslur: marius 6.7 skráður 96,234 klst
-- fyrir 08:53–09:07, og elías ásgeir 7.7 skráður 25,546 klst fyrir 08:44–10:17.
--
-- ÞETTA SKJAL ER EKKI MIGRATION — það er eingöngu til að geta bakkað.
-- Keyrist AÐEINS ef í ljós kemur að speglunin hafi tekið eitthvað sem átti að
-- halda sér. Athugið: speglunin keyrir aftur á 2 tíma fresti, svo endurinnsettar
-- raðir sem Tímavera kannast ekki við verða fjarlægðar á ný — leiðréttið þá í
-- tímaveru.is, ekki hér.

INSERT INTO timavera_entries
  (id, entry_key, date, time_in, time_out, hours, employee, project, source_file, imported_at)
VALUES
  (2570592,'2026-07-01|marius|fjallaböðin þjórsárdal|18:26','2026-07-01','18:26','18:26',0.008,'marius','Fjallaböðin Þjórsárdal','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570593,'2026-07-01|lukasz|fjallaböðin þjórsárdal|10:52','2026-07-01','10:52','18:06',7.248,'lukasz','Fjallaböðin Þjórsárdal','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570602,'2026-06-30|alfred|landsspitalinn|15:09','2026-06-30','15:09','15:09',0.004,'alfred','Landsspitalinn','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570605,'2026-06-30|andri|slökkvitæki ehf|08:52','2026-06-30','08:52','18:07',9.246,'andri','Slökkvitæki ehf','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570610,'2026-06-30|marius|fjallaböðin þjórsárdal|07:30','2026-06-30','07:30','18:00',10.504,'marius','Fjallaböðin Þjórsárdal','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570611,'2026-06-30|lukasz|fjallaböðin þjórsárdal|07:30','2026-06-30','07:30','18:00',10.500,'lukasz','Fjallaböðin Þjórsárdal','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570616,'2026-06-29|marius|súðavogur 7|08:16','2026-06-29','08:16','09:31',1.248,'marius','Súðavogur 7','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570620,'2026-06-29|marius|slökkvitæki ehf|07:24','2026-06-29','07:24','08:16',0.876,'marius','Slökkvitæki ehf','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570621,'2026-06-29|kamara|!!! brunahólf veikindi / sick leave|07:10','2026-06-29','07:10','07:10',0.001,'kamara','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-01 19:01:52.507+00'),
  (2570622,'2026-06-29|lukasz|súðavogur 7|07:03','2026-06-29','07:03','09:31',2.456,'lukasz','Súðavogur 7','timavera-api','2026-07-01 19:01:52.507+00'),
  (2580694,'2026-07-06|elías ásgeir|!!! brunahólf veikindi barns / sick leave because of child|09:00','2026-07-06','09:00','09:00',0.001,'elías ásgeir','!!! Brunahólf Veikindi Barns / Sick Leave because of child','timavera-api','2026-07-07 00:16:02.332326+00'),
  (2580702,'2026-07-06|elías ásgeir|!!! brunahólf veikindi / sick leave|07:53','2026-07-06','07:53','07:54',0.018,'elías ásgeir','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-07 00:16:02.332326+00'),
  (2580703,'2026-07-06|marius|!!! brunahólf veikindi / sick leave|07:52','2026-07-06','07:52','07:52',0.002,'marius','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-07 00:16:02.332326+00'),
  (2580720,'2026-07-02|lukasz|fjallaböðin þjórsárdal|07:32','2026-07-02','07:32','18:31',10.985,'lukasz','Fjallaböðin Þjórsárdal','timavera-api','2026-07-07 00:16:02.332326+00'),
  (2580721,'2026-07-02|marius|fjallaböðin þjórsárdal|07:30','2026-07-02','07:30','18:33',11.050,'marius','Fjallaböðin Þjórsárdal','timavera-api','2026-07-07 00:16:02.332326+00'),
  (2593964,'2026-07-13|nour|orkureitur|07:28','2026-07-13','07:28','16:01',8.542,'nour','Orkureitur','timavera-api','2026-07-14 13:44:13.139085+00'),
  (2593965,'2026-07-11|marius|slökkvitæki ehf|10:50','2026-07-11','10:50','10:50',0.000,'marius','Slökkvitæki ehf','timavera-api','2026-07-14 13:44:13.139085+00'),
  (2593980,'2026-07-09|andri|slökkvitæki ehf|08:40','2026-07-09','08:40','17:20',8.679,'andri','Slökkvitæki ehf','timavera-api','2026-07-14 13:44:13.139085+00'),
  (2593991,'2026-07-08|hákon|slökkvitæki ehf|08:33','2026-07-08','08:33','17:10',8.626,'hákon','Slökkvitæki ehf','timavera-api','2026-07-14 13:44:13.139085+00'),
  (2593998,'2026-07-07|elías ásgeir|!!! brunahólf veikindi / sick leave|08:44','2026-07-07','08:44','10:17',25.546,'elías ásgeir','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-14 13:44:13.139085+00'),
  (2594009,'2026-07-06|marius|!!! brunahólf veikindi / sick leave|08:53','2026-07-06','08:53','09:07',96.234,'marius','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-14 13:44:13.139085+00'),
  (2600241,'2026-07-17|elías ásgeir|!!! brunahólf veikindi barns / sick leave because of child|16:07','2026-07-17','16:07','16:07',0.001,'elías ásgeir','!!! Brunahólf Veikindi Barns / Sick Leave because of child','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600242,'2026-07-17|elías ásgeir|!!! brunahólf veikindi / sick leave|16:05','2026-07-17','16:05','16:07',0.028,'elías ásgeir','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600248,'2026-07-17|hamza|!!! brunahólf veikindi / sick leave|08:03','2026-07-17','08:03','08:03',0.007,'hamza','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600255,'2026-07-16|hákon|slökkvitæki ehf|08:34','2026-07-16','08:34','17:04',8.506,'hákon','Slökkvitæki ehf','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600256,'2026-07-16|hamza|!!! brunahólf veikindi / sick leave|08:03','2026-07-16','08:03','08:05',0.024,'hamza','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600257,'2026-07-16|hamza|!!! brunahólf veikindi barns / sick leave because of child|08:03','2026-07-16','08:03','08:03',0.006,'hamza','!!! Brunahólf Veikindi Barns / Sick Leave because of child','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600265,'2026-07-15|hákon|slökkvitæki ehf|08:28','2026-07-15','08:28','17:00',8.529,'hákon','Slökkvitæki ehf','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600279,'2026-07-14|nour|orkureitur|07:29','2026-07-14','07:29','16:01',8.543,'nour','Orkureitur','timavera-api','2026-07-17 19:25:20.067031+00'),
  (2600460,'2026-07-24|alfred|landsspitalinn|18:42','2026-07-24','18:42','18:42',0.001,'alfred','Landsspitalinn','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600475,'2026-07-24|nour|orkureitur|07:27','2026-07-24','07:27','09:07',1.681,'nour','Orkureitur','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600477,'2026-07-23|lena|keldur|09:04','2026-07-23','09:04','09:04',0.001,'lena','KELDUR','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600500,'2026-07-21|elías ásgeir|!!! brunahólf veikindi / sick leave|09:20','2026-07-21','09:20','19:06',9.767,'elías ásgeir','!!! Brunahólf Veikindi / Sick Leave','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600503,'2026-07-21|hákon|slökkvitæki ehf|08:29','2026-07-21','08:29','17:00',8.510,'hákon','Slökkvitæki ehf','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600510,'2026-07-21|nour|orkureitur|07:27','2026-07-21','07:27','11:29',4.028,'nour','Orkureitur','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600520,'2026-07-20|hamza|landsspitalinn|07:58','2026-07-20','07:58','16:00',8.021,'hamza','Landsspitalinn','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600523,'2026-07-20|lukasz|!!! brunahólf veikindi barns / sick leave because of child|07:25','2026-07-20','07:25','16:00',8.582,'lukasz','!!! Brunahólf Veikindi Barns / Sick Leave because of child','timavera-api','2026-07-24 22:55:17.543334+00'),
  (2600990,'2026-07-27|alfred|landsspitalinn|08:04','2026-07-27','08:04','16:00',7.926,'alfred','Landsspitalinn','timavera-api','2026-07-27 22:17:43.64377+00'),
  (2601299,'2026-07-28|alfred|landsspitalinn|07:54','2026-07-28','07:54','15:27',7.559,'alfred','Landsspitalinn','timavera-api','2026-07-28 17:18:24.42466+00'),
  (2601609,'2026-07-29|prosper|keldur|16:37','2026-07-29','16:37','16:38',0.015,'prosper','KELDUR','timavera-api','2026-07-30 12:16:52.374261+00'),
  (2601610,'2026-07-29|kamara|keldur|16:01','2026-07-29','16:01','16:04',0.039,'kamara','KELDUR','timavera-api','2026-07-30 12:16:52.374261+00'),
  (2601613,'2026-07-29|lena|keldur|10:23','2026-07-29','10:23','13:45',3.366,'lena','KELDUR','timavera-api','2026-07-30 12:16:52.374261+00')
ON CONFLICT (entry_key) DO NOTHING;
