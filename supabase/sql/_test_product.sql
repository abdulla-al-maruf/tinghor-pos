-- Test product for POS verification (ঢেউ টিন PHP 320 বইচা/সাদা, 4 sizes)
with g as (
  insert into product_groups (product_type, brand, color, thickness, calculation_mode)
  values ('ঢেউ টিন', 'PHP', 'বইচা/সাদা', '320', 'tin_bundle')
  returning id
)
insert into product_variants (group_id, length_feet, calculation_base, stock_pieces, avg_cost_price)
select id, 6,  72, 23, 558 from g union all
select id, 8,  72, 19, 700 from g union all
select id, 10, 70, 0,  880 from g union all
select id, 12, 72, -4, 1050 from g;

select pg.brand, pv.length_feet, pv.calculation_base, pv.stock_pieces
from product_variants pv join product_groups pg on pg.id = pv.group_id
order by pv.length_feet;
