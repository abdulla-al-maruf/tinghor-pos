
export type Brand = string; 
export type Color = string; 

export interface StoreSettings {
  brands: string[];
  colors: string[];
  thicknesses: string[];
  productTypes: string[]; // New: To distinguish between Tin, Dhala, Jhalot, Screw etc.
  customFields: { id: string, name: string, options: string[] }[]; 
  nextInvoiceId: number; 
}

// User & Auth Types
export type UserRole = 'admin' | 'manager';

export interface UserSession {
  sessionId: string;
  deviceName: string; // User Agent string simplified
  loginTime: number;
  isTrusted: boolean;
  ip?: string;
}

export interface User {
  id: string;
  name: string;
  email: string; // Changed from PIN to Email/Pass
  password: string;
  role: UserRole;
  sessions: UserSession[]; // Track active logins
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: number;
}

// Employee & Salary Types
export interface Employee {
  id: string;
  name: string;
  phone: string;
  designation: string;
  baseSalary: number;
  joinedDate: number;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  type: 'salary' | 'advance';
  forMonth: string; 
  forYear: number; 
  date: number;     
  note?: string;
}

// Supplier Types
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  companyName?: string;
  address?: string;
  totalPurchase: number;
  totalDue: number; // Positive means we owe them
}

// Inventory & Sales Types
export type CalculationMode = 'tin_bundle' | 'running_foot' | 'fixed_piece';

export interface ProductGroup {
  id: string;
  productType: string; // New: e.g., 'ঢেউ টিন', 'ঢালা'
  brand: string;
  color: string;
  thickness: string; 
  customValues?: Record<string, string>; 
  type: CalculationMode; 
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  lengthFeet: number; 
  calculationBase?: number; 
  stockPieces: number;
  averageCost: number; 
  sellingPrice?: number; 
}

export interface StockLog {
  id: string;
  date: number;
  productName: string;
  quantityAdded: number;
  costPrice: number;
  newStockLevel: number;
  note?: string;
}

export interface CartItem {
  groupId: string;
  variantId: string;
  name: string; 
  lengthFeet: number;
  calculationBase?: number;
  quantityPieces: number;
  formattedQty: string; 
  priceUnit: number; 
  buyPriceUnit: number; 
  subtotal: number;
  unitType: string; 
}

export interface PaymentHistory {
  amount: number;
  date: number;
  note?: string;
  receivedBy?: string; 
}

export interface Sale {
  id: string;
  invoiceId: string; 
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: CartItem[];
  subTotal: number; 
  discount: number; 
  finalAmount: number; 
  paidAmount: number;
  dueAmount: number; 
  paymentHistory: PaymentHistory[]; 
  timestamp: number;
  deliveryStatus: 'delivered' | 'pending'; 
  soldBy: string; 
  note?: string; 
}

export interface Purchase {
  id: string;
  invoiceId: string; // Vendor Invoice ID or Auto generated
  supplierId: string;
  supplierName: string;
  items: CartItem[];
  subTotal: number;
  discount: number; // Discount received from vendor
  finalAmount: number;
  paidAmount: number;
  dueAmount: number; // Amount we still owe
  timestamp: number;
  purchasedBy: string;
  note?: string;
}

export interface Expense {
  id: string;
  reason: string;
  amount: number;
  category: 'transport' | 'food' | 'utility' | 'salary' | 'other' | 'purchase';
  timestamp: number;
  addedBy?: string;
}

export interface AiInsight {
  type: 'stock' | 'market';
  title: string;
  content: string;
  sources?: { title: string; uri: string }[];
}

export type Language = 'bn' | 'en';