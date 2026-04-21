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
-- END OF SCHEMA
-- ============================================================
