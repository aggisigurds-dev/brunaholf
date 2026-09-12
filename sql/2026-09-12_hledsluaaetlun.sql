-- Hleðsluáætlun · lánstæki (12.09.2026) — keyrt í Supabase osfdzskyvisifcwyjkuk sem tveir flutningar:
--   hledsluaaetlun_reikningslinur  (töflur, RLS, rpc reikningslestur_skra)
--   hledsluaaetlun_yfirlit         (v_hledslur_stadur_ar, v_reikningslestur_stada, v_reikningar_olesnir)
-- Agnar: „nýtt tól í bakenda brunahólf sem les okkar vörulínur út úr invoicum til að safna í
-- gagnabanka yfir hleðsluáætlanirnar". Tólið: hledsluaaetlun.html + js/reikningslinur-lesari.js.

-- ── 1. Töflur ───────────────────────────────────────────────────────────────
create table if not exists public.reikningslestur (
  reikningur_nr text primary key,
  uppruni text not null default 'stolpi_pdf',
  doc_id bigint,
  drive_file_id text,
  fyrirtaeki_id bigint,
  kennitala text,
  vidskiptavinur text,
  vegna text,
  tilvisun text,
  dags date,
  ar smallint,
  kredit boolean not null default false,
  linur smallint not null default 0,
  samtala numeric,
  til_greidslu numeric,
  stemmir boolean,
  ath jsonb not null default '[]'::jsonb,
  lesid_af text,
  lesid_at timestamptz not null default now()
);
comment on table public.reikningslestur is 'Einn lesinn reikningur (Stólpa-PDF o.fl.) — haus, samtölur og hvort línurnar reiknist upp í „Til greiðslu" (stemmir). Skrifað aðeins gegnum reikningslestur_skra().';
create index if not exists reikningslestur_fyrirtaeki_idx on public.reikningslestur (fyrirtaeki_id, ar);
create index if not exists reikningslestur_doc_idx on public.reikningslestur (doc_id);

create table if not exists public.reikningslinur (
  id bigint generated always as identity primary key,
  reikningur_nr text not null references public.reikningslestur(reikningur_nr) on delete cascade,
  linu_nr smallint not null,
  lysing text not null,
  vorunumer text,
  magn numeric,
  einingaverd numeric,
  afslattur_pct numeric,
  upphaed numeric,
  vsk text,
  thjonusta text,
  tegund text,
  flokkun text,
  snid text,
  stemmir boolean,
  unique (reikningur_nr, linu_nr)
);
comment on table public.reikningslinur is 'Vörulínur lesinna reikninga. thjonusta: hledsla|yfirferd|nytt|annad · tegund: lettvatn|duft6|duft2|abf|co2_5|co2_2|co2_kg|slanga|reyk|teppi · flokkun: vorunumer|heiti.';
create index if not exists reikningslinur_thjonusta_idx on public.reikningslinur (thjonusta, tegund);

alter table public.reikningslestur enable row level security;
alter table public.reikningslinur enable row level security;
drop policy if exists reikningslestur_lesa on public.reikningslestur;
create policy reikningslestur_lesa on public.reikningslestur for select to anon, authenticated using (true);
drop policy if exists reikningslinur_lesa on public.reikningslinur;
create policy reikningslinur_lesa on public.reikningslinur for select to anon, authenticated using (true);

-- ── 2. Vistun (eina skrifleiðin) ────────────────────────────────────────────
create or replace function public.reikningslestur_skra(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nr    text   := nullif(trim(p->>'reikningur_nr'), '');
  v_doc   bigint := nullif(p->>'doc_id', '')::bigint;
  v_fid   bigint := nullif(p->>'fyrirtaeki_id', '')::bigint;
  v_kt    text   := nullif(regexp_replace(coalesce(p->>'kennitala', ''), '\D', '', 'g'), '');
  v_dags  date   := nullif(p->>'dags', '')::date;
  v_linur jsonb  := coalesce(p->'linur', '[]'::jsonb);
  v_n     int;
begin
  if v_nr is null or v_nr !~ '^R-\d{6}$' then
    raise exception 'reikningur_nr vantar eða er ógilt: %', coalesce(v_nr, '∅');
  end if;
  if jsonb_typeof(v_linur) <> 'array' or jsonb_array_length(v_linur) > 300 then
    raise exception 'linur verður að vera listi með í mesta lagi 300 línum';
  end if;
  -- Staður: úr tengdu skjali; annars kennitala sem á NÁKVÆMLEGA einn lifandi stað (annars óleyst).
  if v_fid is null and v_doc is not null then
    select fyrirtaeki_id into v_fid from customer_documents where id = v_doc;
  end if;
  if v_fid is null and v_kt is not null then
    select min(id) into v_fid from fyrirtaeki
     where deleted_at is null and regexp_replace(coalesce(kennitala, ''), '\D', '', 'g') = v_kt
    having count(*) = 1;
  end if;

  insert into reikningslestur as r (reikningur_nr, uppruni, doc_id, drive_file_id, fyrirtaeki_id, kennitala, vidskiptavinur, vegna,
                                    tilvisun, dags, ar, kredit, linur, samtala, til_greidslu, stemmir, ath, lesid_af, lesid_at)
  values (v_nr, coalesce(nullif(p->>'uppruni', ''), 'stolpi_pdf'), v_doc, nullif(p->>'drive_file_id', ''), v_fid, v_kt,
          nullif(p->>'vidskiptavinur', ''), nullif(p->>'vegna', ''), nullif(p->>'tilvisun', ''), v_dags,
          extract(year from v_dags)::smallint, coalesce((p->>'kredit')::boolean, false), jsonb_array_length(v_linur),
          nullif(p->>'samtala', '')::numeric, nullif(p->>'til_greidslu', '')::numeric, (p->>'stemmir')::boolean,
          coalesce(p->'ath', '[]'::jsonb), nullif(p->>'lesid_af', ''), now())
  on conflict (reikningur_nr) do update set
    uppruni = excluded.uppruni, doc_id = coalesce(excluded.doc_id, r.doc_id), drive_file_id = coalesce(excluded.drive_file_id, r.drive_file_id),
    fyrirtaeki_id = coalesce(excluded.fyrirtaeki_id, r.fyrirtaeki_id), kennitala = excluded.kennitala,
    vidskiptavinur = excluded.vidskiptavinur, vegna = excluded.vegna, tilvisun = excluded.tilvisun, dags = excluded.dags,
    ar = excluded.ar, kredit = excluded.kredit, linur = excluded.linur, samtala = excluded.samtala,
    til_greidslu = excluded.til_greidslu, stemmir = excluded.stemmir, ath = excluded.ath, lesid_af = excluded.lesid_af, lesid_at = now();

  delete from reikningslinur where reikningur_nr = v_nr;
  insert into reikningslinur (reikningur_nr, linu_nr, lysing, vorunumer, magn, einingaverd, afslattur_pct, upphaed, vsk,
                              thjonusta, tegund, flokkun, snid, stemmir)
  select v_nr, coalesce(nullif(e->>'linu_nr', '')::smallint, ord::smallint), left(coalesce(e->>'lysing', ''), 300),
         nullif(e->>'vorunumer', ''), nullif(e->>'magn', '')::numeric, nullif(e->>'einingaverd', '')::numeric,
         nullif(e->>'afslattur_pct', '')::numeric, nullif(e->>'upphaed', '')::numeric, nullif(e->>'vsk', ''),
         nullif(e->>'thjonusta', ''), nullif(e->>'tegund', ''), nullif(e->>'flokkun', ''), nullif(e->>'snid', ''),
         (e->>'stemmir')::boolean
    from jsonb_array_elements(v_linur) with ordinality as t(e, ord);
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', true, 'reikningur_nr', v_nr, 'fyrirtaeki_id', v_fid, 'linur', v_n);
end $$;

revoke all on function public.reikningslestur_skra(jsonb) from public;
grant execute on function public.reikningslestur_skra(jsonb) to anon, authenticated, service_role;

-- ── 3. Yfirlit ──────────────────────────────────────────────────────────────
-- Hleðslur og ný tæki per stað/ár/tegund: lesnir Stólpa-reikningar + sölur appsins (vörunúmer, annars heiti).
create or replace view public.v_hledslur_stadur_ar with (security_invoker = on) as
with koda (vorunumer, thjonusta, tegund) as (values
  ('123', 'hledsla', 'lettvatn'), ('125', 'hledsla', 'duft6'), ('126', 'hledsla', 'duft2'), ('127', 'hledsla', 'abf'),
  ('128', 'hledsla', 'co2_5'), ('129', 'hledsla', 'co2_2'), ('206', 'hledsla', 'co2_5'), ('207', 'hledsla', 'co2_2'),
  ('131', 'hledsla', 'co2_kg'), ('328', 'hledsla', 'duft1'), ('331', 'hledsla', 'duft12'),
  ('117', 'nytt', 'lettvatn'), ('118', 'nytt', 'duft6'), ('119', 'nytt', 'duft2'), ('120', 'nytt', 'abf'),
  ('121', 'nytt', 'co2_5'), ('122', 'nytt', 'co2_2'), ('329', 'nytt', 'lettvatn2'), ('341', 'nytt', 'co2_1'),
  ('342', 'nytt', 'co2_5'), ('343', 'nytt', 'co2_5')
),
stolpi as (
  select coalesce(cd.fyrirtaeki_id, r.fyrirtaeki_id) as fyrirtaeki_id, r.ar::int as ar,
         coalesce(k.thjonusta, l.thjonusta) as thjonusta, coalesce(k.tegund, l.tegund) as tegund,
         l.magn, r.reikningur_nr as heimild
    from reikningslinur l
    join reikningslestur r on r.reikningur_nr = l.reikningur_nr
    left join customer_documents cd on cd.id = r.doc_id
    left join koda k on k.vorunumer = l.vorunumer
),
app_linur as (
  select s.customer_id as fyrirtaeki_id, extract(year from s.created_at)::int as ar, s.num as heimild,
         coalesce(e->>'desc', '') as lysing, nullif(e->>'product_id', '') as pid,
         case when e->>'qty' ~ '^-?\d+(\.\d+)?$' then (e->>'qty')::numeric end as magn
    from solur s
    cross join lateral jsonb_array_elements(case when jsonb_typeof(s.linur) = 'array' then s.linur else '[]'::jsonb end) e
   where s.status in ('final', 'sott') and s.customer_id is not null
),
app as (
  select a.fyrirtaeki_id, a.ar, a.heimild, a.magn,
         coalesce(k.thjonusta,
           case when a.pid is null and a.lysing ~* 'hle[ðd]sl' and a.lysing !~* '^\s*[−-]|afsl' then 'hledsla' end) as thjonusta,
         coalesce(k.tegund,
           case when a.pid is null then
             case when a.lysing ~* 'l[ée]ttvatn' then 'lettvatn'
                  when a.lysing ~* 'duft\s*12' then 'duft12'
                  when a.lysing ~* 'duft\s*1\s*kg' then 'duft1'
                  when a.lysing ~* 'duft\s*2' then 'duft2'
                  when a.lysing ~* 'duft' then 'duft6'
                  when a.lysing ~* '(co2|co₂)\s*5' then 'co2_5'
                  when a.lysing ~* '(co2|co₂)\s*2' then 'co2_2'
                  when a.lysing ~* 'abf|froð' then 'abf' end end) as tegund
    from app_linur a
    left join vorur v on v.id::text = a.pid
    left join koda k on k.vorunumer = v.dk_vorunr
)
select fyrirtaeki_id, ar, thjonusta, tegund, sum(magn) as magn, count(distinct heimild) as reikningar, 'stolpi'::text as uppruni
  from stolpi
 where fyrirtaeki_id is not null and thjonusta in ('hledsla', 'nytt') and tegund is not null
 group by 1, 2, 3, 4
union all
select fyrirtaeki_id, ar, thjonusta, tegund, sum(magn), count(distinct heimild), 'app'::text
  from app
 where thjonusta in ('hledsla', 'nytt') and tegund is not null and magn is not null
 group by 1, 2, 3, 4;

create or replace view public.v_reikningslestur_stada with (security_invoker = on) as
select d.year as ar, count(*) as skjol, count(r.reikningur_nr) as lesin,
       count(*) filter (where r.stemmir is true) as stemma,
       count(*) filter (where r.reikningur_nr is not null and r.stemmir is not true) as stemma_ekki
  from customer_documents d
  left join reikningslestur r on r.reikningur_nr = regexp_replace(d.invoice_number, '^R[-\s]*', 'R-')
 where d.doc_type = 'reikningur' and d.invoice_number ~ '^R[-\s]*10\d{4}$' and d.drive_file_id is not null
   and not coalesce(d.is_duplicate, false)
 group by d.year;

create or replace view public.v_reikningar_olesnir with (security_invoker = on) as
select d.id as doc_id, regexp_replace(d.invoice_number, '^R[-\s]*', 'R-') as reikningur_nr, d.year, d.drive_file_id, d.fyrirtaeki_id
  from customer_documents d
 where d.doc_type = 'reikningur' and d.invoice_number ~ '^R[-\s]*10\d{4}$' and d.drive_file_id is not null
   and not coalesce(d.is_duplicate, false)
   and not exists (select 1 from reikningslestur r where r.reikningur_nr = regexp_replace(d.invoice_number, '^R[-\s]*', 'R-'));

grant select on public.v_hledslur_stadur_ar, public.v_reikningslestur_stada, public.v_reikningar_olesnir to anon, authenticated;
