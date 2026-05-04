-- Phase 2 security hardening for Tinghor POS
-- Apply in Supabase SQL Editor.

-- 1) Ensure role supports account disable flow.
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'manager', 'disabled'));
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'profiles table missing; skipped role constraint update.';
END $$;

-- 2) Enable RLS on all business tables.
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
  EXECUTE 'ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE sale_edit_logs ENABLE ROW LEVEL SECURITY';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'One or more target tables are missing. Validate schema first.';
END $$;

-- 3) Auth helpers.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.current_user_role() IN ('admin', 'manager'), false)
$$;

-- 4) Remove legacy blanket policy.
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
    'payment_allocations',
    'inventory_movements',
    'delivery_logs',
    'sale_edit_logs'
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
  END LOOP;
END $$;

-- 5) Profiles: own read/update, admin full access.
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
FOR SELECT
USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_admin ON profiles;
CREATE POLICY profiles_insert_admin ON profiles
FOR INSERT
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS profiles_update_self_or_admin ON profiles;
CREATE POLICY profiles_update_self_or_admin ON profiles
FOR UPDATE
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (
  public.is_admin()
  OR (
    auth.uid() = id
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS profiles_delete_admin ON profiles;
CREATE POLICY profiles_delete_admin ON profiles
FOR DELETE
USING (public.is_admin());

-- 6) Store settings: active users can read, admin can write.
DROP POLICY IF EXISTS store_settings_select ON store_settings;
CREATE POLICY store_settings_select ON store_settings
FOR SELECT
USING (public.is_active_user());

DROP POLICY IF EXISTS store_settings_insert_admin ON store_settings;
CREATE POLICY store_settings_insert_admin ON store_settings
FOR INSERT
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS store_settings_update_admin ON store_settings;
CREATE POLICY store_settings_update_admin ON store_settings
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS store_settings_delete_admin ON store_settings;
CREATE POLICY store_settings_delete_admin ON store_settings
FOR DELETE
USING (public.is_admin());

-- 7) Core business tables.
DO $$
DECLARE
  table_name text;
  rw_tables text[] := ARRAY[
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
    'stock_movements',
    'payment_allocations',
    'inventory_movements',
    'delivery_logs',
    'sale_edit_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY rw_tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_select_active', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_insert_active', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_update_active', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_delete_admin', table_name);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (public.is_active_user())',
      table_name || '_select_active', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (public.is_active_user())',
      table_name || '_insert_active', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (public.is_active_user()) WITH CHECK (public.is_active_user())',
      table_name || '_update_active', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (public.is_admin())',
      table_name || '_delete_admin', table_name
    );
  END LOOP;
END $$;

-- 8) Activity logs: insert by active users, select by admin only.
DROP POLICY IF EXISTS activity_logs_select_admin ON activity_logs;
CREATE POLICY activity_logs_select_admin ON activity_logs
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS activity_logs_insert_active ON activity_logs;
CREATE POLICY activity_logs_insert_active ON activity_logs
FOR INSERT
WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS activity_logs_update_admin ON activity_logs;
CREATE POLICY activity_logs_update_admin ON activity_logs
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS activity_logs_delete_admin ON activity_logs;
CREATE POLICY activity_logs_delete_admin ON activity_logs
FOR DELETE
USING (public.is_admin());
