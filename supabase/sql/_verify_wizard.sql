select pg.brand, pg.thickness, pg.color, pg.calculation_mode,
       pv.length_feet, pv.calculation_base, pv.stock_pieces, pv.avg_cost_price
from product_variants pv
join product_groups pg on pg.id = pv.group_id
where pg.brand = 'AKS'
order by pv.length_feet;
