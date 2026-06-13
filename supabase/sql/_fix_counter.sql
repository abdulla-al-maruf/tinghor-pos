-- Sync invoice counter to max numeric invoice + 1 (test data left it behind)
update store_settings
set next_invoice_id = greatest(
  next_invoice_id,
  coalesce((select max((invoice_id)::int) from sales where invoice_id ~ '^[0-9]+$'), 1000) + 1
);
select next_invoice_id from store_settings;
