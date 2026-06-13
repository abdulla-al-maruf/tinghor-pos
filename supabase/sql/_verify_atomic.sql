select
  (select count(*) from sales) as total_sales,
  (select count(*) from sales s where not exists (select 1 from sale_items si where si.sale_id=s.id)) as orphan_sales,
  (select next_invoice_id from store_settings) as next_no,
  (select max((invoice_id)::int) from sales where invoice_id ~ '^[0-9]+$') as max_invoice,
  (select count(*) from payment_allocations) as allocations,
  (select count(*) from stock_movements where voucher_type='sale') as sale_movements;
