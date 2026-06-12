-- Tinghor POS — initial seed (run once after schema.sql)
-- Creates the single store_settings row the app expects, with default catalog.

insert into store_settings (shop_name, brands, colors, thicknesses, product_types, next_invoice_id)
select
  'টিনঘর',
  '["PHP","AKS","TK","Anowar","Aramit","Local"]'::jsonb,
  '["বইচা/সাদা","নফ (NOF)","মাস্টার গ্রীন","গ্রীন/CNG","লাল","সিলভার"]'::jsonb,
  '["220","320","340","360","420","430","25 SBW","26 SBW"]'::jsonb,
  '["ঢেউ টিন","মাইটা টিন","টুয়া","ঢালা","ঝালট","প্লেন সিট","অন্যান্য"]'::jsonb,
  1001
where not exists (select 1 from store_settings);

notify pgrst, 'reload schema';
