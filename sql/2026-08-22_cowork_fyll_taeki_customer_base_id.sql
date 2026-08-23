-- 2026-08-22 · Verkefnalisti e8b187eb
-- "Tækjatenging: bæta customer_base_id við heimilisfangs-joinið (rekstrarfélög tvítelja)"
--
-- Applied to Supabase via MCP migration `cowork_fyll_taeki_customer_base_id`.
-- Skjalið hér er til endurgerðar (sama mynstur og v_kerfi_kort / v_service_gaps).
--
-- HVAÐ VAR AÐ
-- `cowork_fyll_taeki_ur_skyrslum(p_rf, p_apply)` fyllir tæki (uttaeki) hverrar
-- starfsstöðvar rekstrarfélags út frá nýjustu úttektarskýrslu (arsskodun_report_facts).
-- Hún paraði / afritaði / EYDDI tækjum eftir heimilisfangi EINGÖNGU:
--
--     WHERE location = r.addr OR client = r.fnafn
--
-- Þegar tvö ólík félög sátu á sama heimilisfangi fékk HVORT um sig öll tæki hússins:
--   · Grensásvegur 14 — Heimaleiga Höfuðstöðvar (6 tæki) + G14 ehf (7) → bæði töldu 13.
--   · Urðarhvarf 4 — Heimaleiga Icelandic Apartments (40) + Pure Deli (0) → bæði 40.
--   · Seljavegur 2 — Center Hótel Grandi (25) + Mýrin brasserie (0) → bæði 25.
-- Verra: p_apply=true hefði BACKUP-að + EYTT öllum 13 tækjunum þegar annað félagið var
-- unnið og sett svo aðeins ~5 TMP-tæki í staðinn → tæki hins félagsins þurrkuð út.
-- (Þess vegna dugði EKKI að breyta heimilisföngunum handvirkt — sbr. Laugaveg 18.)
--
-- LAGFÆRINGIN
--   · Joinið ber nú kennitöluna:   WHERE customer_base_id = r.bid AND location = r.addr
--     — uttaeki.customer_base_id er rétt fyllt á hverri tækjaröð (staðfest á öllum
--       stöðum Heimaleigu (382 tæki) og Center Hótel (231) gegn úttektarskýrslum),
--       svo aðgerðin snertir AÐEINS tæki þessa félags á þessu heimilisfangi.
--   · Nýju TMP-tækin fá líka customer_base_id (r.bid) OG worksite_id (r.fid) svo þau
--     tengist rétt og aðgerðin sé idempotent — áður fengu þau null base og duttu úr
--     base-joininu (v_kerfi_kort o.fl.) og hefðu safnast upp sem tvítök við endurkeyrslu.
--
-- STAÐFEST (preview, p_apply=false): Heimaleiga - Höfuðstöðvar fyrir 13 → 6; Center
-- Hótel - Arnarhvoll 21 → 20 (nú nákvæmlega jafnt skýrslunni); allar aðrar stöðvar óbreyttar.
--
-- ROLLBACK (gamla, ranga hegðunin): sömu skilgreining nema öll þrjú skilyrðin verða
--   WHERE location = r.addr OR client = r.fnafn
-- og INSERT-lína án customer_base_id / worksite_id.

CREATE OR REPLACE FUNCTION public.cowork_fyll_taeki_ur_skyrslum(p_rf text, p_apply boolean DEFAULT false)
 RETURNS TABLE(bygging_id bigint, nafn text, fyrir integer, eftir integer, skyrsla text)
 LANGUAGE plpgsql
AS $function$
DECLARE r record; m record; c int; li date; ser int;
BEGIN
  SELECT coalesce(max(regexp_replace(serial,'\D','','g')::int),5000) INTO ser FROM uttaeki WHERE serial ~ '^TMP-\d+$';
  FOR r IN
    SELECT f.id fid, f.customer_base_id bid, f.nafn fnafn, f.heimilisfang addr,
           a.equipment eq, a.report_year yr, a.inspect_month mo
    FROM fyrirtaeki f
    JOIN customers_base cb ON cb.id=f.customer_base_id
    JOIN arsskodun_report_facts a ON a.fyrirtaeki_id=f.id
    WHERE cb.rekstrarfelag=p_rf AND f.deleted_at IS NULL
      AND coalesce(a.parse_ok,false) AND coalesce(a.total_devices,0)>0
      AND coalesce(f.heimilisfang,'')<>''
  LOOP
    bygging_id := r.fid; nafn := r.fnafn;
    SELECT count(*) INTO fyrir FROM uttaeki WHERE customer_base_id=r.bid AND location=r.addr;
    IF p_apply THEN
      INSERT INTO cowork_taeki_sync_backup
        SELECT u.*, now(), p_rf FROM uttaeki u WHERE u.customer_base_id=r.bid AND u.location=r.addr;
      DELETE FROM uttaeki WHERE customer_base_id=r.bid AND location=r.addr;
      li := make_date(coalesce(r.yr, extract(year from now())::int), coalesce(r.mo,1), 1);
      FOR m IN SELECT * FROM (VALUES
          ('lettvatn','Léttvatn'),('co2_2','CO2'),('co2_5','CO2'),
          ('duft2','ABC Duft'),('duft6_12','ABC Duft'),
          ('brunaslongur','Brunaslanga'),('reykskynjarar','Reykskynjari'),('eldvarnarteppi','Eldvarnateppi')
        ) v(k, typ)
      LOOP
        c := coalesce((r.eq->>m.k)::int,0);
        FOR i IN 1..c LOOP
          ser := ser+1;
          INSERT INTO uttaeki(serial,type,client,location,customer_base_id,worksite_id,last_insp,next_insp,status,created_at)
          VALUES ('TMP-'||ser, m.typ, r.fnafn, r.addr, r.bid, r.fid, li, (li + interval '1 year')::date, 'active', now());
        END LOOP;
      END LOOP;
    END IF;
    SELECT count(*) INTO eftir FROM uttaeki WHERE customer_base_id=r.bid AND location=r.addr;
    skyrsla := coalesce(r.mo::text,'?')||'/'||coalesce(r.yr::text,'?');
    RETURN NEXT;
  END LOOP;
END $function$;
