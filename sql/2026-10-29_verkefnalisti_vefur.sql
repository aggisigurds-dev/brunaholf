-- Verkefnalisti: vefur-flipar (Brunahólf / Slökkvitæki / Sameiginlegt) — verk 809627e5.
-- „Til að halda beiðnum frá hvorum vef aðgreindum og forgangsraða betur."
--
-- Keyra EINU SINNI í Supabase (SQL editor). Endurkeyrsla er örugg: dálkurinn og skorðan
-- eru `if not exists`-vernduð og UPDATE-ið snertir aðeins raðir sem enn eru 'sameiginlegt'.
-- verkefnalisti.html virkar líka ÁÐUR en þetta er keyrt (flipaöndin birtist ekki fyrr en
-- dálkurinn er til).
--
-- Aðgangur: engin RLS á töflunni; síðan les/skrifar í gegnum /api/verkefnalisti (service role).
-- Ekkert í þessari skrá breytir því.

alter table public.verkefnalisti
  add column if not exists vefur text not null default 'sameiginlegt';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'verkefnalisti_vefur_check' and conrelid = 'public.verkefnalisti'::regclass
  ) then
    alter table public.verkefnalisti
      add constraint verkefnalisti_vefur_check
      check (vefur in ('brunaholf', 'slokkvitaeki', 'sameiginlegt'));
  end if;
end $$;

-- Upphafsflokkun. `category` er EFNISFLOKKUR (útlit, bakendi, sala …), ekki vefur, svo hún ein
-- dugar ekki; því gildir í þessari röð:
--   1. Titill nefnir annan vefinn (ekki báða): Slökkvitæki/Slokkvitæki/slokkvitaeki → slokkvitaeki,
--      Brunahólf/brunaholf → brunaholf. Nefni titillinn báða fer röðin í sameiginlegt.
--   2. Efnisflokkur sem er eingöngu Slökkvitækis (sala = POS/afgreiðsla, utkall = útköll/skoðanir
--      hjá viðskiptavinum) → slokkvitaeki.
--   3. Allt annað helst 'sameiginlegt' (sjálfgefið) — Agnar flokkar það með ✏️ í síðunni.
update public.verkefnalisti
set vefur = case
  when title ~* 'sl(ö|o)kkvit(æ|ae)ki' and title !~* 'brunah(ó|o)lf' then 'slokkvitaeki'
  when title ~* 'brunah(ó|o)lf' and title !~* 'sl(ö|o)kkvit(æ|ae)ki' then 'brunaholf'
  when title ~* 'sl(ö|o)kkvit(æ|ae)ki' and title ~* 'brunah(ó|o)lf' then 'sameiginlegt'
  when category in ('sala', 'utkall') then 'slokkvitaeki'
  else 'sameiginlegt'
end
where vefur = 'sameiginlegt';
