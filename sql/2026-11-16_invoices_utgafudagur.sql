-- 2026-11-16: Bæta útgáfudegi reiknings (invoiceDate úr Payday) við invoices.
-- Einkaritarinn þarf þennan dálk til að telja sendar kröfur Brunahólfs á viku.
-- payday-pull.js er uppfært til að fylla hann sjálfkrafa; eldri reikningar
-- fá daginn næst þegar payday-pull keyrir.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS utgafudagur date;

COMMENT ON COLUMN invoices.utgafudagur IS 'Útgáfudagur reiknings (invoiceDate úr Payday)';
