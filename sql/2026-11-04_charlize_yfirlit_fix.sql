-- 2026-11-04 — Lagfæring á charlize_yfirlit(kt)
-- Fundið í greiningu bútsins „Fyrirtæki & kúnnar“ 04.11.2026:
--   1) Breytan `nafn` skyggði á dálkinn fyrirtaeki.nafn í `select max(nafn) into nafn from fyrirtaeki`
--      → villa 42702 „column reference "nafn" is ambiguous“ fyrir 381 af 551 kt í þjónustu
--      (allar sem ekki eru í charlize_contacts).
--   2) charlize_contacts er með RLS án policies og fallið var ekki SECURITY DEFINER
--      → um anon-REST (appið, router-hookurinn) brást fallið ALLTAF.
-- Lausn: breyturnar fá v_-forskeyti, fallið verður SECURITY DEFINER með föstu search_path
-- (les aðeins, skilar texta — engar persónukennitölur umfram það sem kt-lykillinn sjálfur er).
-- KEYRA Í SQL EDITOR MEÐ SAMÞYKKI AGNARS. Prófun á eftir:
--   select charlize_yfirlit('<kt félags sem er EKKI í charlize_contacts>');   -- átti að kasta 42702, skilar nú texta
--   select charlize_yfirlit('<kt Heimaleigu>');                               -- með anon-lykli um REST /rpc/charlize_yfirlit

create or replace function public.charlize_yfirlit(kt text)
 returns text
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_nafn text;
  v_tengil text;
  v_minni text;
  v_n_faerslu int;
  v_kt_hrein text := regexp_replace(coalesce(kt, ''), '\D', '', 'g');
begin
  select max(coalesce(c.fyrirtaeki, c.kennitala)) into v_nafn
    from charlize_contacts c
   where c.kennitala = kt;

  if v_nafn is null then
    select max(f.nafn) into v_nafn
      from fyrirtaeki f
     where regexp_replace(coalesce(f.kennitala, ''), '\D', '', 'g') = v_kt_hrein;
  end if;

  select string_agg(coalesce(t.hlutverk, '?') || ': ' || t.netfang ||
                    coalesce(' (' || t.faerslur || ' postar)', ''), E'\n  ')
    into v_tengil
    from v_charlize_contacts_active t
   where t.kennitala = kt;

  select count(*), string_agg('[' || k.topic || '] ' || k.fact, E'\n  ' order by k.topic, k.created_at)
    into v_n_faerslu, v_minni
    from v_charlize_kunni k
   where k.kennitala = kt;

  return 'FYRIRTAEKI  ' || coalesce(v_nafn, '(othekkt)') || '  (' || kt || ')' || E'\n' ||
         E'\nTENGILIDIR\n  ' || coalesce(v_tengil, '(engir skradir)') ||
         E'\n\nMINNI (' || coalesce(v_n_faerslu, 0) || E' faerslur)\n  ' ||
         coalesce(v_minni, '(ekkert skrad enn)');
end
$function$;

-- Lesaðgangur fyrir anon og authenticated (fallið sjálft gætir þess að skila aðeins samantekt).
grant execute on function public.charlize_yfirlit(text) to anon, authenticated;
