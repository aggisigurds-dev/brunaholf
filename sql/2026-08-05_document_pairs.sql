-- document_pairs — explicit skýrsla<->reikningur pairs (verkefnalisti 94295522, "Pörun").
--
-- Complements v_bundle_coverage (2026-07-31_v_bundle_coverage.sql), which is a
-- pure kt+year+kind heuristic view with no stored document-to-document link and
-- no way to say "this one report also covers that other service type". This
-- table persists the actual customer_documents/solur ids for each
-- (customer_base_id, year, service_type) pair, so:
--   1. It can be queried directly instead of re-deriving the join every time.
--   2. A pair can be confirmed/overridden by a human later (status/notes).
--   3. One physical report can satisfy TWO service_type pairs in the same year
--      (matched_by='shared_report') — see the E Fasteignafélag / Norðurhella 17
--      example in the task: a single úttektarskýrsla covered BOTH the Úttekt
--      2026 (R-000652) and Brunakerfi 2026 (R-000651) invoices, which
--      v_bundle_coverage misclassified as "vantar_skyrslu" for the brunakerfi
--      kind because it forces one doc_type per row.
--
-- service_type is limited to the two real kind values already in use
-- (solur.source / the collapsed customer_documents.doc_type) — 'uttekt' and
-- 'brunakerfi'. company_id in this domain is customers_base.id, NOT
-- fyrirtaeki.id (confirmed: fyrirtaeki_id is the separate site/location id).

create table if not exists document_pairs (
  id bigint generated always as identity primary key,
  customer_base_id bigint not null references customers_base(id),
  year int not null,
  service_type text not null check (service_type in ('uttekt','brunakerfi')),
  report_doc_id bigint references customer_documents(id),
  invoice_doc_id bigint references customer_documents(id),
  solur_id bigint references solur(id),
  status text not null default 'vantar_reikning' check (status in ('klarad','vantar_reikning','vantar_skyrslu','reikn_payday')),
  matched_by text,   -- 'exact' | 'shared_report' | 'manual'
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_base_id, year, service_type)
);
create index if not exists document_pairs_report_idx on document_pairs(report_doc_id);
create index if not exists document_pairs_invoice_doc_idx on document_pairs(invoice_doc_id);
create index if not exists document_pairs_solur_idx on document_pairs(solur_id);
comment on table document_pairs is 'Explicit skýrsla<->reikningur pairs per (customer_base_id, year, service_type). Complements v_bundle_coverage with persisted doc/solur ids; matched_by=shared_report means one physical report satisfies two service-type pairs. See verkefnalisti 94295522 / CLAUDE.md Pörun section.';
grant select, insert, update on document_pairs to anon;
grant usage, select on sequence document_pairs_id_seq to anon;

-- ── One-time backfill ──────────────────────────────────────────────────────
-- Mirrors v_bundle_coverage's matching (kt+year+kind, most-recent-wins on
-- duplicates) but persists real ids, and additionally fills a missing report
-- for one kind by reusing the sibling kind's report doc for the same
-- (base, year) when that kind truly has none of its own (the "one visit
-- covers two billed services" case).
with rep_raw as (
  select cd.id as doc_id, cd.customer_base_id as base_id, cd.year as yr,
    case when cd.doc_type = 'brunakerfi' then 'brunakerfi' else 'uttekt' end as kind,
    cd.doc_date
  from customer_documents cd
  where cd.doc_type in ('uttektarskyrsla','brunakerfi')
    and coalesce(cd.is_duplicate, false) = false
    and cd.customer_base_id is not null and cd.year is not null
),
rep_best as (
  select distinct on (base_id, yr, kind) doc_id, base_id, yr, kind, doc_date
  from rep_raw
  order by base_id, yr, kind, doc_date desc nulls last, doc_id desc
),
inv_raw as (
  select s.id as solur_id, b.id as base_id,
    (extract(year from s.created_at))::int as yr,
    s.source as kind, s.created_at, s.num
  from solur s
  join customers_base b
    on regexp_replace(coalesce(b.kennitala,''),'\D','','g') = regexp_replace(coalesce(s.customer_kt,''),'\D','','g')
   and length(regexp_replace(coalesce(b.kennitala,''),'\D','','g')) = 10
  where s.source in ('uttekt','brunakerfi') and s.status = 'final'
),
inv_best as (
  select distinct on (base_id, yr, kind) solur_id, base_id, yr, kind, created_at, num
  from inv_raw
  order by base_id, yr, kind, created_at desc, solur_id desc
),
invdoc_raw as (
  select cd.id as doc_id, cd.customer_base_id as base_id, cd.year as yr,
    cd.invoice_number, cd.doc_date
  from customer_documents cd
  where cd.doc_type = 'reikningur' and coalesce(cd.is_duplicate,false)=false
    and cd.customer_base_id is not null and cd.invoice_number is not null
),
u as (
  select coalesce(rep_best.base_id, inv_best.base_id) as base_id,
    coalesce(rep_best.yr, inv_best.yr) as yr,
    coalesce(rep_best.kind, inv_best.kind) as kind,
    rep_best.doc_id as report_doc_id,
    inv_best.solur_id, inv_best.num as invoice_num
  from rep_best full join inv_best using (base_id, yr, kind)
),
u2 as (
  select u.base_id, u.yr, u.kind, u.solur_id, u.invoice_num,
    coalesce(u.report_doc_id, sib.report_doc_id) as report_doc_id,
    (u.report_doc_id is null and sib.report_doc_id is not null) as shared_report
  from u
  left join u sib
    on sib.base_id = u.base_id and sib.yr = u.yr and sib.kind <> u.kind and sib.report_doc_id is not null
),
final as (
  select u2.base_id, u2.yr, u2.kind, u2.report_doc_id, u2.solur_id,
    idoc.doc_id as invoice_doc_id,
    case
      when u2.report_doc_id is not null and u2.solur_id is not null then 'klarad'
      when u2.solur_id is not null and u2.report_doc_id is null then 'vantar_skyrslu'
      when u2.report_doc_id is not null and u2.solur_id is null then 'vantar_reikning'
      else 'vantar_reikning'
    end as status,
    case when u2.shared_report then 'shared_report' else 'exact' end as matched_by
  from u2
  left join invdoc_raw idoc
    on idoc.base_id = u2.base_id and idoc.yr = u2.yr and idoc.invoice_number = u2.invoice_num
  where u2.base_id is not null and u2.yr is not null and u2.kind is not null
    and (u2.report_doc_id is not null or u2.solur_id is not null)
)
insert into document_pairs (customer_base_id, year, service_type, report_doc_id, invoice_doc_id, solur_id, status, matched_by)
select base_id, yr, kind, report_doc_id, invoice_doc_id, solur_id, status, matched_by
from final
on conflict (customer_base_id, year, service_type) do nothing;

-- Ran once already 2026-08-05 against the live project (91 klarad incl. 1 via
-- shared_report, 1085 vantar_reikning, 5 vantar_skyrslu). `on conflict do
-- nothing` makes re-running safe.
