/**
 * Central database service — all Supabase queries go through here.
 * App.tsx calls these functions instead of localStorage directly.
 */
import { supabase } from './supabase';
import type {
  User, StoreSettings, ProductGroup, ProductVariant,
  Sale, Purchase, Expense, Employee, SalaryRecord,
  StockLog, Supplier, ActivityLog
} from '../types';

// ─── SETTINGS ────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<StoreSettings | null> {
  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .single();
  if (error || !data) return null;
  return {
    brands: data.brands ?? [],
    colors: data.colors ?? [],
    thicknesses: data.thicknesses ?? [],
    productTypes: data.product_types ?? [],
    customFields: data.custom_fields ?? [],
    nextInvoiceId: data.next_invoice_id ?? 1001,
  };
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  const { data, error } = await supabase.from('store_settings').update({
    brands: settings.brands,
    colors: settings.colors,
    thicknesses: settings.thicknesses,
    product_types: settings.productTypes,
    custom_fields: settings.customFields,
    next_invoice_id: settings.nextInvoiceId,
    updated_at: new Date().toISOString(),
  }).not('id', 'is', null).select('id');
  if (error) throw new Error(`saveSettings: ${error.message}`);
  if (!data || data.length === 0) throw new Error('saveSettings: no store_settings row found — run the database migration first');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback);
}

/** Load profile (name, role) for a logged-in user by their auth UID. */
export async function loadCurrentUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('profiles').select('id, name, email, role').eq('id', userId).single();
  if (error || !data) return null;
  return { id: data.id, name: data.name, email: data.email, role: data.role, sessions: [] };
}

/**
 * Create a new auth user from the admin panel.
 * Uses a temp supabase client with persistSession:false so the current
 * admin session is NOT replaced by the newly created user's session.
 */
export async function createAuthUser(
  email: string, password: string, name: string, role: string
): Promise<{ error: string | null }> {
  const { createClient } = await import('@supabase/supabase-js');
  const tempClient = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false, storageKey: `tmp_${Date.now()}` } }
  );

  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: { data: { name, role } },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: 'User creation failed' };

  // Trigger already creates the profile row, but ensure name/role are correct
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    name,
    email,
    role,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    return { error: `User created but profile setup failed: ${profileError.message}` };
  }

  return { error: null };
}

// ─── USERS / PROFILES ────────────────────────────────────────────────────────

export async function loadUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('profiles').select('id, name, email, role');
  if (error || !data) return [];
  return data.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, sessions: [] }));
}

export async function saveUser(user: User): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveUser: ${error.message}`);
}

export async function saveUsers(users: User[]): Promise<void> {
  for (const user of users) await saveUser(user);
}

// ─── INVENTORY ───────────────────────────────────────────────────────────────

export async function loadInventory(): Promise<ProductGroup[]> {
  const { data: groups, error } = await supabase
    .from('product_groups')
    .select('*, product_variants(*)');
  if (error || !groups) return [];
  return groups.map(g => ({
    id: g.id,
    productType: g.product_type,
    brand: g.brand,
    color: g.color,
    thickness: g.thickness,
    type: g.calc_mode,
    customValues: g.custom_values ?? {},
    variants: (g.product_variants ?? []).map((v: any) => ({
      id: v.id,
      lengthFeet: v.length_feet,
      calculationBase: v.calculation_base,
      stockPieces: v.stock_pieces,
      averageCost: v.average_cost,
      sellingPrice: v.selling_price,
    })),
  }));
}

export async function saveProductGroup(group: ProductGroup): Promise<void> {
  const { error } = await supabase.from('product_groups').upsert({
    id: group.id,
    product_type: group.productType,
    brand: group.brand,
    color: group.color,
    thickness: group.thickness,
    calc_mode: group.type,
    custom_values: group.customValues ?? {},
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveProductGroup: ${error.message}`);
  for (const variant of group.variants) {
    const { error: varError } = await supabase.from('product_variants').upsert({
      id: variant.id,
      group_id: group.id,
      length_feet: variant.lengthFeet,
      calculation_base: variant.calculationBase,
      stock_pieces: variant.stockPieces,
      average_cost: variant.averageCost,
      selling_price: variant.sellingPrice,
      updated_at: new Date().toISOString(),
    });
    if (varError) throw new Error(`saveProductVariant: ${varError.message}`);
  }
}

export async function saveInventory(inventory: ProductGroup[]): Promise<void> {
  for (const group of inventory) await saveProductGroup(group);
}

// ─── SALES ───────────────────────────────────────────────────────────────────

export async function loadSales(): Promise<Sale[]> {
  // Load sales + items. Payment history loaded separately via payment_allocations.
  const { data, error } = await supabase
    .from('sales')
    .select('*, sale_items(*)')
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  // Load all payment allocations for sales in one query
  const saleIds = data.map(s => s.id);
  let paymentMap: Record<string, { amount: number; date: number; note?: string; receivedBy?: string }[]> = {};
  if (saleIds.length > 0) {
    const { data: allocData } = await supabase
      .from('payment_allocations')
      .select('*, payments(*)')
      .eq('invoice_type', 'sale')
      .in('invoice_id', saleIds);
    if (allocData) {
      for (const alloc of allocData) {
        if (!paymentMap[alloc.invoice_id]) paymentMap[alloc.invoice_id] = [];
        paymentMap[alloc.invoice_id].push({
          amount: alloc.allocated_amount,
          date: new Date(alloc.payments?.created_at ?? alloc.created_at).getTime(),
          note: alloc.payments?.note ?? '',
          receivedBy: alloc.payments?.received_by_name ?? '',
        });
      }
    }
  }

  return data.map(s => ({
    id: s.id,
    invoiceId: s.invoice_id,
    customerName: s.customer_name,
    customerPhone: s.customer_phone ?? '',
    customerAddress: s.customer_address ?? '',
    items: (s.sale_items ?? []).map((item: any) => ({
      groupId: item.group_id ?? 'manual',
      variantId: item.variant_id ?? '',
      name: item.product_name,
      lengthFeet: item.length_feet ?? 0,
      calculationBase: item.calculation_base,
      quantityPieces: item.qty_pieces,
      formattedQty: item.formatted_qty ?? '',
      priceUnit: item.price_unit,
      buyPriceUnit: item.cost_price,
      subtotal: item.subtotal,
      unitType: item.unit_type ?? '',
    })),
    subTotal: s.sub_total,
    discount: s.discount,
    finalAmount: s.final_amount,
    paidAmount: s.paid_amount,
    dueAmount: s.due_amount,
    paymentHistory: paymentMap[s.id] ?? [],
    timestamp: new Date(s.created_at).getTime(),
    deliveryStatus: s.delivery_status,
    soldBy: s.sold_by_name ?? '',
    note: s.note ?? '',
  }));
}

export async function saveSale(sale: Sale): Promise<void> {
  const { error } = await supabase.from('sales').upsert({
    id: sale.id,
    invoice_id: sale.invoiceId,
    customer_name: sale.customerName,
    customer_phone: sale.customerPhone,
    customer_address: sale.customerAddress ?? '',
    sub_total: sale.subTotal,
    discount: sale.discount,
    final_amount: sale.finalAmount,
    paid_amount: sale.paidAmount,
    due_amount: sale.dueAmount,
    delivery_status: sale.deliveryStatus,
    status: 'confirmed',
    sold_by_name: sale.soldBy,
    note: sale.note ?? '',
    posting_date: new Date(sale.timestamp).toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveSale: ${error.message}`);

  // Delete old items and re-insert (simplest approach for updates)
  const { error: delError } = await supabase.from('sale_items').delete().eq('sale_id', sale.id);
  if (delError) throw new Error(`saveSale items delete: ${delError.message}`);
  if (sale.items.length > 0) {
    const { error: insertError } = await supabase.from('sale_items').insert(
      sale.items.map(item => ({
        sale_id: sale.id,
        group_id: item.groupId === 'manual' ? null : item.groupId,
        variant_id: item.variantId || null,
        product_name: item.name,
        length_feet: item.lengthFeet,
        calculation_base: item.calculationBase,
        qty_pieces: item.quantityPieces,
        formatted_qty: item.formattedQty,
        price_unit: item.priceUnit,
        cost_price: item.buyPriceUnit ?? 0,
        subtotal: item.subtotal,
        unit_type: item.unitType,
        is_manual: item.groupId === 'manual',
      }))
    );
    if (insertError) throw new Error(`saveSale items insert: ${insertError.message}`);
  }
}

export async function deleteSale(id: string): Promise<void> {
  // Delete child rows first to respect FK constraint
  const { error: itemsError } = await supabase.from('sale_items').delete().eq('sale_id', id);
  if (itemsError) throw new Error(`deleteSale items: ${itemsError.message}`);
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw new Error(`deleteSale: ${error.message}`);
}

// ─── PURCHASES ───────────────────────────────────────────────────────────────

export async function loadPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, purchase_items(*)')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(p => ({
    id: p.id,
    invoiceId: p.invoice_id,
    supplierId: p.supplier_id ?? '',
    supplierName: p.supplier_name,
    items: (p.purchase_items ?? []).map((item: any) => ({
      groupId: item.group_id ?? '',
      variantId: item.variant_id ?? '',
      name: item.product_name,
      lengthFeet: item.length_feet ?? 0,
      calculationBase: item.calculation_base,
      quantityPieces: item.qty_pieces,
      formattedQty: item.formatted_qty ?? '',
      priceUnit: item.price_unit,
      buyPriceUnit: item.price_unit,
      subtotal: item.subtotal,
      unitType: item.unit_type ?? '',
    })),
    subTotal: p.sub_total,
    discount: p.discount,
    finalAmount: p.final_amount,
    paidAmount: p.paid_amount,
    dueAmount: p.due_amount,
    timestamp: new Date(p.created_at).getTime(),
    purchasedBy: p.purchased_by_name ?? '',
    note: p.note ?? '',
  }));
}

export async function savePurchase(purchase: Purchase): Promise<void> {
  const { error } = await supabase.from('purchases').upsert({
    id: purchase.id,
    invoice_id: purchase.invoiceId,
    supplier_id: purchase.supplierId || null,
    supplier_name: purchase.supplierName,
    sub_total: purchase.subTotal,
    discount: purchase.discount,
    final_amount: purchase.finalAmount,
    paid_amount: purchase.paidAmount,
    due_amount: purchase.dueAmount,
    status: 'confirmed',
    purchased_by_name: purchase.purchasedBy,
    note: purchase.note ?? '',
    posting_date: new Date(purchase.timestamp).toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`savePurchase: ${error.message}`);

  const { error: delError } = await supabase.from('purchase_items').delete().eq('purchase_id', purchase.id);
  if (delError) throw new Error(`savePurchase items delete: ${delError.message}`);
  if (purchase.items.length > 0) {
    const { error: insertError } = await supabase.from('purchase_items').insert(
      purchase.items.map(item => ({
        purchase_id: purchase.id,
        group_id: item.groupId || null,
        variant_id: item.variantId || null,
        product_name: item.name,
        length_feet: item.lengthFeet,
        calculation_base: item.calculationBase,
        qty_pieces: item.quantityPieces,
        formatted_qty: item.formattedQty,
        price_unit: item.priceUnit,
        subtotal: item.subtotal,
        unit_type: item.unitType,
      }))
    );
    if (insertError) throw new Error(`savePurchase items insert: ${insertError.message}`);
  }
}

// ─── SUPPLIERS ───────────────────────────────────────────────────────────────

export async function loadSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*');
  if (error || !data) return [];
  return data.map(s => ({
    id: s.id,
    name: s.name,
    phone: s.phone ?? '',
    companyName: s.company_name ?? '',
    address: s.address ?? '',
    totalPurchase: s.total_purchase,
    totalDue: s.total_due,
  }));
}

export async function saveSupplier(supplier: Supplier): Promise<void> {
  const { error } = await supabase.from('suppliers').upsert({
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    company_name: supplier.companyName,
    address: supplier.address,
    total_purchase: supplier.totalPurchase,
    total_due: supplier.totalDue,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveSupplier: ${error.message}`);
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────

export async function loadExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(e => ({
    id: e.id,
    reason: e.reason,
    amount: e.amount,
    category: e.category,
    timestamp: new Date(e.created_at).getTime(),
    addedBy: e.added_by_name ?? '',
  }));
}

export async function saveExpense(expense: Expense): Promise<void> {
  const { error } = await supabase.from('expenses').upsert({
    id: expense.id,
    reason: expense.reason,
    amount: expense.amount,
    category: expense.category,
    added_by_name: expense.addedBy ?? '',
    posting_date: new Date(expense.timestamp).toISOString().split('T')[0],
  });
  if (error) throw new Error(`saveExpense: ${error.message}`);
}

export async function deleteExpense(id: string): Promise<void> {
  await supabase.from('expenses').delete().eq('id', id);
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────

export async function loadEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('*').eq('is_active', true);
  if (error || !data) return [];
  return data.map(e => ({
    id: e.id,
    name: e.name,
    phone: e.phone ?? '',
    designation: e.designation ?? '',
    baseSalary: e.base_salary,
    joinedDate: e.joined_date ? new Date(e.joined_date).getTime() : Date.now(),
  }));
}

export async function saveEmployee(employee: Employee): Promise<void> {
  const { error } = await supabase.from('employees').upsert({
    id: employee.id,
    name: employee.name,
    phone: employee.phone,
    designation: employee.designation,
    base_salary: employee.baseSalary,
    joined_date: new Date(employee.joinedDate).toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveEmployee: ${error.message}`);
}

// ─── SALARY RECORDS ──────────────────────────────────────────────────────────

export async function loadSalaryRecords(): Promise<SalaryRecord[]> {
  const { data, error } = await supabase
    .from('salary_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(r => ({
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    amount: r.amount,
    type: r.type,
    forMonth: r.for_month,
    forYear: r.for_year,
    date: new Date(r.created_at).getTime(),
    note: r.note ?? '',
  }));
}

export async function saveSalaryRecord(record: SalaryRecord): Promise<void> {
  const { error } = await supabase.from('salary_records').upsert({
    id: record.id,
    employee_id: record.employeeId,
    employee_name: record.employeeName,
    amount: record.amount,
    type: record.type,
    for_month: record.forMonth,
    for_year: record.forYear,
    note: record.note ?? '',
    posting_date: new Date(record.date).toISOString().split('T')[0],
  });
  if (error) throw new Error(`saveSalaryRecord: ${error.message}`);
}

// ─── PAYMENT ALLOCATIONS ─────────────────────────────────────────────────────

export async function savePaymentAllocation(params: {
  invoiceId: string;
  invoiceType: 'sale' | 'purchase';
  allocatedAmount: number;
  receivedByName?: string;
}): Promise<void> {
  const { error } = await supabase.from('payment_allocations').insert({
    id: crypto.randomUUID(),
    invoice_id: params.invoiceId,
    invoice_type: params.invoiceType,
    allocated_amount: params.allocatedAmount,
    received_by_name: params.receivedByName ?? '',
    payment_date: new Date().toISOString().split('T')[0],
  });
  if (error) throw new Error(`savePaymentAllocation: ${error.message}`);
}

// ─── STOCK LOGS ──────────────────────────────────────────────────────────────

export async function saveStockMovement(params: {
  variantId: string;
  qtyChange: number;
  qtyAfter: number;
  costPerUnit: number;
  voucherType: 'purchase' | 'sale' | 'return' | 'manual_entry' | 'adjustment';
  voucherId?: string;
  note?: string;
  createdByName?: string;
}): Promise<void> {
  const { error } = await supabase.from('stock_movements').insert({
    variant_id: params.variantId,
    qty_change: params.qtyChange,
    qty_after: params.qtyAfter,
    cost_per_unit: params.costPerUnit,
    voucher_type: params.voucherType,
    voucher_id: params.voucherId ?? null,
    note: params.note ?? '',
    created_by_name: params.createdByName ?? '',
    posting_date: new Date().toISOString().split('T')[0],
  });
  if (error) throw new Error(`saveStockMovement: ${error.message}`);
}

export async function adjustVariantStock(params: {
  variantId: string;
  qtyDelta: number;
  minStock?: number;
  incomingCostPerUnit?: number;
  maxRetries?: number;
}): Promise<{ stockPieces: number; averageCost: number }> {
  const retries = params.maxRetries ?? 5;

  for (let attempt = 0; attempt < retries; attempt++) {
    const { data: current, error: readError } = await supabase
      .from('product_variants')
      .select('stock_pieces, average_cost')
      .eq('id', params.variantId)
      .single();

    if (readError || !current) {
      throw new Error(`adjustVariantStock read: ${readError?.message ?? 'Variant not found'}`);
    }

    const currentStock = Number(current.stock_pieces ?? 0);
    const currentAvgCost = Number(current.average_cost ?? 0);
    const nextStock = currentStock + params.qtyDelta;
    const minStock = params.minStock ?? Number.NEGATIVE_INFINITY;

    if (nextStock < minStock) {
      throw new Error(`adjustVariantStock: insufficient stock for ${params.variantId}`);
    }

    let nextAvgCost = currentAvgCost;
    if (params.qtyDelta > 0 && typeof params.incomingCostPerUnit === 'number') {
      const incomingValue = params.qtyDelta * params.incomingCostPerUnit;
      const currentValue = currentStock * currentAvgCost;
      const totalValue = currentValue + incomingValue;
      nextAvgCost = nextStock > 0 ? Math.round((totalValue / nextStock) * 100) / 100 : currentAvgCost;
    }

    const { data: updated, error: updateError } = await supabase
      .from('product_variants')
      .update({
        stock_pieces: nextStock,
        average_cost: nextAvgCost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.variantId)
      .eq('stock_pieces', currentStock)
      .select('stock_pieces, average_cost')
      .maybeSingle();

    if (updateError) {
      throw new Error(`adjustVariantStock update: ${updateError.message}`);
    }

    if (updated) {
      return {
        stockPieces: Number(updated.stock_pieces ?? nextStock),
        averageCost: Number(updated.average_cost ?? nextAvgCost),
      };
    }
  }

  throw new Error(`adjustVariantStock: concurrent update conflict for ${params.variantId}`);
}

// ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────

export async function loadActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data.map(l => ({
    id: l.id,
    userId: l.user_id ?? '',
    userName: l.user_name,
    action: l.action,
    details: l.details ?? '',
    timestamp: new Date(l.created_at).getTime(),
  }));
}

export async function saveActivityLog(log: ActivityLog): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    id: log.id,
    user_id: log.userId,
    user_name: log.userName,
    action: log.action,
    details: log.details,
  });
  if (error) throw new Error(`saveActivityLog: ${error.message}`);
}
