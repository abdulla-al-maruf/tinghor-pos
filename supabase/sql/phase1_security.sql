-- Phase 1 security baseline for Tinghor POS
-- Run in Supabase SQL Editor.

DO $$
BEGIN
  EXECUTE 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE sales ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE purchases ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE expenses ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE employees ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'One or more target tables are missing. Validate schema first.';
END $$;

-- Idempotent policy creation helper
DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'profiles',
    'store_settings',
    'product_groups',
    'product_variants',
    'sales',
    'sale_items',
    'purchases',
    'purchase_items',
    'suppliers',
    'expenses',
    'employees',
    'salary_records',
    'activity_logs',
    'stock_movements',
    'payment_allocations'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = 'Allow all for authenticated'
    ) THEN
      EXECUTE format('DROP POLICY "Allow all for authenticated" ON %I', table_name);
    END IF;

    EXECUTE format(
      'CREATE POLICY "Allow all for authenticated" ON %I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
      table_name
    );
  END LOOP;
END $$;

-- Guardrail for inventory consistency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_stock_non_negative'
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT product_variants_stock_non_negative CHECK (stock_pieces >= 0);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'product_variants table missing; skipped stock constraint.';
END $$;
