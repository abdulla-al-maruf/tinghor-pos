import { z, ZodError } from 'zod';
import { Sale, Purchase as PurchaseType, CartItem } from '../types';

// CartItem validation schema
export const CartItemSchema = z.object({
  groupId: z.string(),
  variantId: z.string(),
  name: z.string(),
  lengthFeet: z.number().nonnegative(),
  calculationBase: z.number().nonnegative().optional(),
  quantityPieces: z.number().positive(),
  formattedQty: z.string(),
  priceUnit: z.number().nonnegative(),
  buyPriceUnit: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  unitType: z.string(),
});

// PaymentHistory validation schema
export const PaymentHistorySchema = z.object({
  amount: z.number(),
  date: z.number().positive(),
  note: z.string().optional(),
  receivedBy: z.string().optional(),
});

// Sale validation schema
export const SaleSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string(),
  customerAddress: z.string().optional(),
  items: z.array(CartItemSchema).min(1, 'At least one item is required'),
  subTotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  finalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  dueAmount: z.number(),
  paymentHistory: z.array(PaymentHistorySchema),
  timestamp: z.number().positive(),
  deliveryStatus: z.enum(['delivered', 'pending']),
  soldBy: z.string(),
  note: z.string().optional(),
});

// Purchase validation schema
export const PurchaseSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  supplierId: z.string(),
  supplierName: z.string().min(1, 'Supplier name is required'),
  items: z.array(CartItemSchema).min(1, 'At least one item is required'),
  subTotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  finalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  dueAmount: z.number(),
  timestamp: z.number().positive(),
  purchasedBy: z.string(),
  note: z.string().optional(),
});

// Validation functions
export function validateSale(sale: unknown): Sale {
  return SaleSchema.parse(sale);
}

export function validatePurchase(purchase: unknown): PurchaseType {
  return PurchaseSchema.parse(purchase);
}

export function safeValidateSale(sale: unknown): { success: true; data: Sale } | { success: false; error: string } {
  try {
    const result = SaleSchema.safeParse(sale);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: 'Invalid sale data' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Validation error' };
  }
}

export function safeValidatePurchase(purchase: unknown): { success: true; data: PurchaseType } | { success: false; error: string } {
  try {
    const result = PurchaseSchema.safeParse(purchase);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: 'Invalid purchase data' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Validation error' };
  }
}

// LocalStorage cart validation with versioning
export const LocalStorageCartSchema = z.array(CartItemSchema);

// Safe localStorage parsing with validation
export function parseLocalStorageCart(key: string = 'pos_draft_cart'): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    
    const parsed = JSON.parse(raw);
    const result = LocalStorageCartSchema.safeParse(parsed);
    
    if (result.success) {
      return result.data;
    } else {
      console.warn(`Invalid cart data in localStorage key "${key}":`, result.error.issues || 'Validation failed');
      // Clear corrupted data
      localStorage.removeItem(key);
      return [];
    }
  } catch (error) {
    console.error(`Error parsing localStorage key "${key}":`, error);
    // Clear corrupted data
    localStorage.removeItem(key);
    return [];
  }
}

// Safe localStorage saving with validation
export function saveToLocalStorageCart(key: string = 'pos_draft_cart', data: CartItem[]): boolean {
  try {
    const result = LocalStorageCartSchema.safeParse(data);
    if (!result.success) {
      console.error('Invalid cart data to save:', result.error.issues || 'Validation failed');
      return false;
    }
    
    localStorage.setItem(key, JSON.stringify(result.data));
    return true;
  } catch (error) {
    console.error(`Error saving to localStorage key "${key}":`, error);
    return false;
  }
}

// Migration helper for future schema changes
export function migrateLocalStorageCart(
  oldKey: string = 'pos_draft_cart',
  newKey: string = 'pos_draft_cart_v1'
): boolean {
  try {
    const raw = localStorage.getItem(oldKey);
    if (!raw) return false;
    
    const parsed = JSON.parse(raw);
    const result = LocalStorageCartSchema.safeParse(parsed);
    
    if (result.success) {
      // Valid data, migrate to new key
      localStorage.setItem(newKey, JSON.stringify(result.data));
      localStorage.removeItem(oldKey);
      return true;
    } else {
      // Invalid data, clear old key
      localStorage.removeItem(oldKey);
      return false;
    }
  } catch {
    localStorage.removeItem(oldKey);
    return false;
  }
}

// Check and clean corrupted localStorage data on app startup
export function cleanupLocalStorage(): void {
  const keys = ['pos_draft_cart', 'pos_draft_name', 'pos_draft_phone', 'pos_draft_address'];
  
  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        // Try to parse if it's JSON (cart data)
        if (key === 'pos_draft_cart') {
          JSON.parse(value);
        }
        // For string values, just ensure they're strings
      }
    } catch (error) {
      console.warn(`Cleaning corrupted localStorage key: ${key}`);
      localStorage.removeItem(key);
    }
  });
}
