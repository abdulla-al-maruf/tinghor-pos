-- Remove orphan sales (header saved but items failed — pre-atomic saveSale)
delete from sales s
where not exists (select 1 from sale_items si where si.sale_id = s.id);

-- Resync counter
update store_settings
set next_invoice_id = coalesce(
  (select max((invoice_id)::int) from sales where invoice_id ~ '^[0-9]+$'), 1000) + 1;

select (select count(*) from sales) as sales_left,
       (select next_invoice_id from store_settings) as next_no;
