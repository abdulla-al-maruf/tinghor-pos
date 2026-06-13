-- ============================================================
-- create_sale_atomic — পুরো বিক্রি এক transaction-এ
-- ঠিক করে: orphan sales header, invoice counter desync,
-- আর initial জমা payment_allocations-এ না থাকা (cash book-এ লাগবে)।
-- SECURITY DEFINER: যেকোনো authenticated seller মেমো নম্বর পাবে।
-- ============================================================
create or replace function public.create_sale_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id   uuid := gen_random_uuid();
  v_invoice   int;
  v_ts        bigint := (extract(epoch from now()) * 1000)::bigint;
  v_today     date := current_date;
  v_paid      int := coalesce((payload->>'paid_amount')::int, 0);
  it          jsonb;
  v_cost      int;
  v_after     int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- 1) মেমো নম্বর atomically নাও + বাড়াও (একই row-এ lock হয়, duplicate অসম্ভব)
  update store_settings
     set next_invoice_id = next_invoice_id + 1
   where id = (select id from store_settings limit 1)
  returning next_invoice_id - 1 into v_invoice;

  if v_invoice is null then
    raise exception 'store_settings not configured';
  end if;

  -- 2) sales header
  insert into sales (
    id, invoice_id, customer_name, customer_phone, customer_address,
    sub_total, discount, final_amount, paid_amount, due_amount,
    payment_history, timestamp, posting_date, delivery_status, sold_by, note, status
  ) values (
    v_sale_id, v_invoice::text,
    payload->>'customer_name',
    nullif(payload->>'customer_phone',''),
    nullif(payload->>'customer_address',''),
    coalesce((payload->>'sub_total')::int,0),
    coalesce((payload->>'discount')::int,0),
    coalesce((payload->>'final_amount')::int,0),
    v_paid,
    coalesce((payload->>'due_amount')::int,0),
    '[]'::jsonb, v_ts, v_today,
    coalesce(payload->>'delivery_status','delivered'),
    payload->>'sold_by',
    nullif(payload->>'note',''),
    'confirmed'
  );

  -- 3) প্রতিটা item + stock কমানো + movement log
  for it in select * from jsonb_array_elements(payload->'items')
  loop
    -- cost snapshot = বর্তমান avg cost (variant থাকলে)
    v_cost := 0;
    if coalesce(it->>'variant_id','') <> '' and coalesce(it->>'group_id','manual') <> 'manual' then
      select coalesce(avg_cost_price,0) into v_cost
        from product_variants where id = (it->>'variant_id')::uuid;
    end if;

    insert into sale_items (
      sale_id, group_id, variant_id, name, length_feet, calculation_base,
      quantity_pieces, formatted_qty, price_unit, buy_price_unit, subtotal,
      unit_type, is_manual, cost_price_snapshot
    ) values (
      v_sale_id,
      coalesce(it->>'group_id','manual'),
      nullif(it->>'variant_id','')::uuid,
      it->>'name',
      nullif(it->>'length_feet','')::numeric,
      nullif(it->>'calculation_base','')::numeric,
      coalesce((it->>'quantity_pieces')::int,0),
      it->>'formatted_qty',
      round(coalesce((it->>'price_unit')::numeric,0))::int,
      round(coalesce((it->>'buy_price_unit')::numeric,0))::int,
      coalesce((it->>'subtotal')::int,0),
      it->>'unit_type',
      coalesce(it->>'group_id','manual') = 'manual',
      v_cost
    );

    -- stock কমাও (manual বাদ)
    if coalesce(it->>'variant_id','') <> '' and coalesce(it->>'group_id','manual') <> 'manual' then
      update product_variants
         set stock_pieces = stock_pieces - coalesce((it->>'quantity_pieces')::int,0),
             updated_at = now()
       where id = (it->>'variant_id')::uuid
      returning stock_pieces into v_after;

      insert into stock_movements (variant_id, qty_change, qty_after, cost_per_unit,
        voucher_type, voucher_id, note, created_by_name, posting_date)
      values ((it->>'variant_id')::uuid, -coalesce((it->>'quantity_pieces')::int,0),
        coalesce(v_after,0), v_cost, 'sale', v_sale_id, null,
        payload->>'sold_by', v_today);
    end if;
  end loop;

  -- 4) initial জমা → payment_allocations (cash book-এর জন্য)
  if v_paid > 0 then
    insert into payment_allocations (invoice_id, invoice_type, allocated_amount,
      received_by_name, date, payment_date, note)
    values (v_sale_id::text, 'sale', v_paid, payload->>'sold_by', v_ts, v_today, 'বিক্রির সময় জমা');
  end if;

  -- 5) activity log
  insert into activity_logs (user_id, user_name, action, details, timestamp, posting_date)
  values (coalesce(payload->>'user_id',''), coalesce(payload->>'sold_by','Unknown'),
    'বিক্রয় INV-' || v_invoice::text,
    '৳' || coalesce((payload->>'final_amount')::int,0)::text, v_ts, v_today);

  return jsonb_build_object('id', v_sale_id, 'invoice_id', v_invoice::text, 'timestamp', v_ts);
end $$;

revoke execute on function public.create_sale_atomic(jsonb) from anon;
grant  execute on function public.create_sale_atomic(jsonb) to authenticated;

notify pgrst, 'reload schema';
