-- ============================================================
-- Tinghor POS — Complete Database Schema
-- Project: ofjkrjzqujpvttkygxie
-- Run once in Supabase SQL Editor.
-- All statements are idempotent (safe to re-run).
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- -----------------------------------------------------------
-- profiles — user profiles linked to Supabase Auth
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'disabled')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- store_settings — shop configuration
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_name TEXT DEFAULT 'টিনঘর',
  shop_phone TEXT,
  shop_address TEXT,
  brands JSONB DEFAULT '[]',          -- text[]
  colors JSONB DEFAULT '[]',          -- text[]
  thicknesses JSONB DEFAULT '[]',     -- text[]
  product_types JSONB DEFAULT '[]',   -- text[]
  custom_fields JSONB DEFAULT '[]',   -- [{id, name, options}]
  next_invoice_id INTEGER DEFAULT 1001,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- product_groups — grouping by brand + color + thickness
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type TEXT NOT NULL,         -- e.g. 'ঢেউ টিন', 'ঢালা'
  brand TEXT NOT NULL,
  color TEXT NOT NULL,
  thickness TEXT NOT NULL,
  custom_values JSONB DEFAULT '{}',   -- {key: value}
  calculation_mode TEXT NOT NULL DEFAULT 'tin_bundle'
    CHECK (calculation_mode IN ('tin_bundle', 'running_foot', 'fixed_piece', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- product_variants — individual sizes within a group
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES product_groups(id) ON DELETE CASCADE,
  length_feet NUMERIC NOT NULL,       -- stored as integer feet (e.g. 12 for 12ft)
  calculation_base NUMERIC,           -- ban base feet for tin_bundle
  stock_pieces INTEGER NOT NULL DEFAULT 0,
  reserved_qty INTEGER NOT NULL DEFAULT 0,  -- NEW: reserved for pending delivery
  avg_cost_price INTEGER NOT NULL DEFAULT 0, -- NEW: weighted average cost
  selling_price INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- sales — sale/invoice header
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT NOT NULL UNIQUE,    -- e.g. '1001'
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  sub_total INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  final_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  due_amount INTEGER NOT NULL DEFAULT 0,
  payment_history JSONB DEFAULT '[]', -- [{amount, date, note, receivedBy}]
  timestamp BIGINT NOT NULL,          -- epoch ms
  posting_date DATE,                   -- date portion for reporting
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('delivered', 'pending')),
  sold_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- sale_items — line items per sale
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,             -- 'manual' for non-inventory items
  variant_id TEXT,
  name TEXT NOT NULL,
  length_feet NUMERIC,
  calculation_base NUMERIC,
  quantity_pieces INTEGER NOT NULL,
  formatted_qty TEXT,
  price_unit INTEGER NOT NULL,        -- per-unit selling price
  buy_price_unit INTEGER,             -- per-unit cost at time of sale
  subtotal INTEGER NOT NULL,
  unit_type TEXT,
  cost_price_snapshot INTEGER NOT NULL DEFAULT 0  -- NEW: avg_cost at sale time
);

-- -----------------------------------------------------------
-- purchases — purchase header
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  supplier_id TEXT,
  supplier_name TEXT NOT NULL,
  sub_total INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  final_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  due_amount INTEGER NOT NULL DEFAULT 0,
  timestamp BIGINT NOT NULL,
  posting_date DATE,                   -- date portion for reporting
  purchased_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- purchase_items — line items per purchase
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  variant_id TEXT,
  name TEXT NOT NULL,
  length_feet NUMERIC,
  quantity_pieces INTEGER NOT NULL,
  price_unit INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  unit_type TEXT
);

-- -----------------------------------------------------------
-- suppliers
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  address TEXT,
  total_purchase INTEGER NOT NULL DEFAULT 0,
  total_due INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- expenses
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reason TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('transport', 'food', 'utility', 'salary', 'other', 'purchase')),
  timestamp BIGINT NOT NULL,
  posting_date DATE,                   -- date portion for reporting
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- employees
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  designation TEXT,
  base_salary INTEGER NOT NULL DEFAULT 0,
  joined_date BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- salary_records
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'salary' CHECK (type IN ('salary', 'advance')),
  for_month TEXT,
  for_year INTEGER,
  date BIGINT NOT NULL,
  posting_date DATE,                   -- date portion for reporting
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- activity_logs — general audit trail
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  timestamp BIGINT NOT NULL,
  posting_date DATE,                   -- date portion for reporting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- stock_movements — legacy stock tracking (keep for backward compat)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID REFERENCES product_variants(id),
  qty_change INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  cost_per_unit NUMERIC,
  voucher_type TEXT,                  -- 'sale', 'purchase', 'return', 'adjustment'
  voucher_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- payment_allocations — partial payment tracking
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  invoice_type TEXT NOT NULL DEFAULT 'sale',  -- 'sale' or 'purchase'
  allocated_amount INTEGER NOT NULL,
  received_by TEXT,
  received_by_name TEXT,
  date BIGINT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. NEW TABLES (Phase 1)
-- ============================================================

-- -----------------------------------------------------------
-- inventory_movements — comprehensive stock change ledger
-- Replaces / extends stock_movements with more detail
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID,
  variant_id UUID REFERENCES product_variants(id),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('purchase', 'sale', 'return', 'adjustment', 'transfer', 'delivery')),
  ref_table TEXT,                     -- 'sales', 'purchases', etc.
  ref_id UUID,
  qty_change INTEGER NOT NULL,        -- positive = stock up, negative = down
  qty_after INTEGER NOT NULL,
  cost_snapshot INTEGER,              -- cost per unit at time of movement
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by variant
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant
  ON inventory_movements(variant_id, created_at DESC);

-- -----------------------------------------------------------
-- delivery_logs — partial delivery tracking
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  delivered_qty INTEGER NOT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  warehouse TEXT,
  note TEXT,
  delivered_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_sale
  ON delivery_logs(sale_id, delivered_at DESC);

-- -----------------------------------------------------------
-- sale_edit_logs — audit trail for invoice edits
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_edit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES profiles(id),
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  field_changed TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB
);

CREATE INDEX IF NOT EXISTS idx_sale_edit_logs_sale
  ON sale_edit_logs(sale_id, edited_at DESC);

-- ============================================================
-- 4. NEW COLUMNS ON EXISTING TABLES (idempotent)
-- ============================================================

-- product_variants: weighted average cost + reserved stock
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'avg_cost_price'
  ) THEN
    ALTER TABLE product_variants ADD COLUMN avg_cost_price INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'reserved_qty'
  ) THEN
    ALTER TABLE product_variants ADD COLUMN reserved_qty INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- product_variants: remove legacy average_cost after migration to avg_cost_price
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'average_cost'
  ) THEN
    ALTER TABLE product_variants DROP COLUMN average_cost;
  END IF;
END $$;

-- sale_items: cost price snapshot at time of sale
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'cost_price_snapshot'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN cost_price_snapshot INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 5. CONSTRAINTS
-- ============================================================

-- Non-negative stock (allow negative for business rule, but warn)
-- NOTE: Business allows negative stock, so NO CHECK constraint on stock_pieces

-- Ensure prices and amounts are integers (PostgreSQL INTEGER enforces this)

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
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
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- ============================================================
-- 7. TRIGGERS — auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles',
    'store_settings',
    'product_groups',
    'product_variants',
    'sales',
    'purchases',
    'suppliers',
    'employees'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    -- Drop existing trigger if exists
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);

    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- 8. HELPER FUNCTIONS
-- ============================================================

-- Generate a random UUID (client-side fallback)
CREATE OR REPLACE FUNCTION generate_uuid()
RETURNS UUID AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8b. ADD MISSING COLUMNS (idempotent migrations)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='status') THEN
    ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'confirmed';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='is_manual') THEN
    ALTER TABLE sale_items ADD COLUMN is_manual BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='status') THEN
    ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'confirmed';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='purchased_by_name') THEN
    ALTER TABLE purchases ADD COLUMN purchased_by_name TEXT DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_items' AND column_name='calculation_base') THEN
    ALTER TABLE purchase_items ADD COLUMN calculation_base NUMERIC;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_items' AND column_name='formatted_qty') THEN
    ALTER TABLE purchase_items ADD COLUMN formatted_qty TEXT DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='added_by_name') THEN
    ALTER TABLE expenses ADD COLUMN added_by_name TEXT DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='is_active') THEN
    ALTER TABLE employees ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='salary_records' AND column_name='posting_date') THEN
    ALTER TABLE salary_records ADD COLUMN posting_date DATE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_allocations' AND column_name='payment_date') THEN
    ALTER TABLE payment_allocations ADD COLUMN payment_date DATE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='created_by_name') THEN
    ALTER TABLE stock_movements ADD COLUMN created_by_name TEXT DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='posting_date') THEN
    ALTER TABLE stock_movements ADD COLUMN posting_date DATE;
  END IF;
END $$;

-- ============================================================
-- 8c. EMPLOYEE ATTENDANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'late')),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_attendance_unique
  ON employee_attendance(employee_id, date);

-- ============================================================
-- 9. RLS POLICIES
-- ============================================================

-- Helper: get current user role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_role() = 'admin';
$$;

-- Apply policies for each table
-- profiles: users can read own, admins read all; users update own
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_select ON profiles;
  CREATE POLICY profiles_select ON profiles FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );
  DROP POLICY IF EXISTS profiles_insert ON profiles;
  CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS profiles_update ON profiles;
  CREATE POLICY profiles_update ON profiles FOR UPDATE USING (
    auth.uid() = id OR public.is_admin()
  );
  DROP POLICY IF EXISTS profiles_delete ON profiles;
  CREATE POLICY profiles_delete ON profiles FOR DELETE USING (public.is_admin());
END $$;

-- store_settings: authenticated users read, admins write
DO $$ BEGIN
  DROP POLICY IF EXISTS store_settings_select ON store_settings;
  CREATE POLICY store_settings_select ON store_settings FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS store_settings_insert ON store_settings;
  CREATE POLICY store_settings_insert ON store_settings FOR INSERT WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS store_settings_update ON store_settings;
  CREATE POLICY store_settings_update ON store_settings FOR UPDATE USING (public.is_admin());
END $$;

-- product_groups, product_variants: authenticated read, admins write
DO $$ BEGIN
  DROP POLICY IF EXISTS product_groups_select ON product_groups;
  CREATE POLICY product_groups_select ON product_groups FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS product_groups_insert ON product_groups;
  CREATE POLICY product_groups_insert ON product_groups FOR INSERT WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS product_groups_update ON product_groups;
  CREATE POLICY product_groups_update ON product_groups FOR UPDATE USING (public.is_admin());
  DROP POLICY IF EXISTS product_groups_delete ON product_groups;
  CREATE POLICY product_groups_delete ON product_groups FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS product_variants_select ON product_variants;
  CREATE POLICY product_variants_select ON product_variants FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS product_variants_insert ON product_variants;
  CREATE POLICY product_variants_insert ON product_variants FOR INSERT WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS product_variants_update ON product_variants;
  CREATE POLICY product_variants_update ON product_variants FOR UPDATE USING (public.is_admin());
  DROP POLICY IF EXISTS product_variants_delete ON product_variants;
  CREATE POLICY product_variants_delete ON product_variants FOR DELETE USING (public.is_admin());
END $$;

-- sales, sale_items, purchases, purchase_items, suppliers, expenses: authenticated CRUD
DO $$ BEGIN
  DROP POLICY IF EXISTS sales_select ON sales;
  CREATE POLICY sales_select ON sales FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS sales_insert ON sales;
  CREATE POLICY sales_insert ON sales FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS sales_update ON sales;
  CREATE POLICY sales_update ON sales FOR UPDATE USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS sales_delete ON sales;
  CREATE POLICY sales_delete ON sales FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS sale_items_select ON sale_items;
  CREATE POLICY sale_items_select ON sale_items FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS sale_items_insert ON sale_items;
  CREATE POLICY sale_items_insert ON sale_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS sale_items_update ON sale_items;
  CREATE POLICY sale_items_update ON sale_items FOR UPDATE USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS sale_items_delete ON sale_items;
  CREATE POLICY sale_items_delete ON sale_items FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS purchases_select ON purchases;
  CREATE POLICY purchases_select ON purchases FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS purchases_insert ON purchases;
  CREATE POLICY purchases_insert ON purchases FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS purchases_update ON purchases;
  CREATE POLICY purchases_update ON purchases FOR UPDATE USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS purchases_delete ON purchases;
  CREATE POLICY purchases_delete ON purchases FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS purchase_items_select ON purchase_items;
  CREATE POLICY purchase_items_select ON purchase_items FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS purchase_items_insert ON purchase_items;
  CREATE POLICY purchase_items_insert ON purchase_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS purchase_items_update ON purchase_items;
  CREATE POLICY purchase_items_update ON purchase_items FOR UPDATE USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS purchase_items_delete ON purchase_items;
  CREATE POLICY purchase_items_delete ON purchase_items FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS suppliers_select ON suppliers;
  CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS suppliers_insert ON suppliers;
  CREATE POLICY suppliers_insert ON suppliers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS suppliers_update ON suppliers;
  CREATE POLICY suppliers_update ON suppliers FOR UPDATE USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS suppliers_delete ON suppliers;
  CREATE POLICY suppliers_delete ON suppliers FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS expenses_select ON expenses;
  CREATE POLICY expenses_select ON expenses FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS expenses_insert ON expenses;
  CREATE POLICY expenses_insert ON expenses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS expenses_update ON expenses;
  CREATE POLICY expenses_update ON expenses FOR UPDATE USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS expenses_delete ON expenses;
  CREATE POLICY expenses_delete ON expenses FOR DELETE USING (public.is_admin());
END $$;

-- employees, salary_records: admin only
DO $$ BEGIN
  DROP POLICY IF EXISTS employees_select ON employees;
  CREATE POLICY employees_select ON employees FOR SELECT USING (public.is_admin());
  DROP POLICY IF EXISTS employees_insert ON employees;
  CREATE POLICY employees_insert ON employees FOR INSERT WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS employees_update ON employees;
  CREATE POLICY employees_update ON employees FOR UPDATE USING (public.is_admin());
  DROP POLICY IF EXISTS employees_delete ON employees;
  CREATE POLICY employees_delete ON employees FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS salary_records_select ON salary_records;
  CREATE POLICY salary_records_select ON salary_records FOR SELECT USING (public.is_admin());
  DROP POLICY IF EXISTS salary_records_insert ON salary_records;
  CREATE POLICY salary_records_insert ON salary_records FOR INSERT WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS salary_records_update ON salary_records;
  CREATE POLICY salary_records_update ON salary_records FOR UPDATE USING (public.is_admin());
  DROP POLICY IF EXISTS salary_records_delete ON salary_records;
  CREATE POLICY salary_records_delete ON salary_records FOR DELETE USING (public.is_admin());
END $$;

-- activity_logs, stock_movements, payment_allocations, inventory_movements, delivery_logs, sale_edit_logs, employee_attendance: authenticated
DO $$ BEGIN
  DROP POLICY IF EXISTS activity_logs_select ON activity_logs;
  CREATE POLICY activity_logs_select ON activity_logs FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS activity_logs_insert ON activity_logs;
  CREATE POLICY activity_logs_insert ON activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS activity_logs_delete ON activity_logs;
  CREATE POLICY activity_logs_delete ON activity_logs FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS stock_movements_select ON stock_movements;
  CREATE POLICY stock_movements_select ON stock_movements FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS stock_movements_insert ON stock_movements;
  CREATE POLICY stock_movements_insert ON stock_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS payment_allocations_select ON payment_allocations;
  CREATE POLICY payment_allocations_select ON payment_allocations FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS payment_allocations_insert ON payment_allocations;
  CREATE POLICY payment_allocations_insert ON payment_allocations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS payment_allocations_delete ON payment_allocations;
  CREATE POLICY payment_allocations_delete ON payment_allocations FOR DELETE USING (public.is_admin());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS inventory_movements_select ON inventory_movements;
  CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS inventory_movements_insert ON inventory_movements;
  CREATE POLICY inventory_movements_insert ON inventory_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS delivery_logs_select ON delivery_logs;
  CREATE POLICY delivery_logs_select ON delivery_logs FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS delivery_logs_insert ON delivery_logs;
  CREATE POLICY delivery_logs_insert ON delivery_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS sale_edit_logs_select ON sale_edit_logs;
  CREATE POLICY sale_edit_logs_select ON sale_edit_logs FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS sale_edit_logs_insert ON sale_edit_logs;
  CREATE POLICY sale_edit_logs_insert ON sale_edit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS employee_attendance_select ON employee_attendance;
  CREATE POLICY employee_attendance_select ON employee_attendance FOR SELECT USING (public.is_admin());
  DROP POLICY IF EXISTS employee_attendance_insert ON employee_attendance;
  CREATE POLICY employee_attendance_insert ON employee_attendance FOR INSERT WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS employee_attendance_update ON employee_attendance;
  CREATE POLICY employee_attendance_update ON employee_attendance FOR UPDATE USING (public.is_admin());
END $$;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
