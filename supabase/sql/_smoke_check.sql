select
  (select count(*) from sales) as sales,
  (select invoice_id from sales limit 1) as invoice,
  (select customer_name from sales limit 1) as customer,
  (select final_amount from sales limit 1) as total,
  (select paid_amount from sales limit 1) as paid,
  (select due_amount from sales limit 1) as due,
  (select count(*) from sale_items) as items,
  (select count(*) from payment_allocations) as allocations,
  (select count(*) from activity_logs) as logs;
