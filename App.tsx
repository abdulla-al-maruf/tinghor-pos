
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LanguageContext, ToastContext } from './lib/contexts';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { POS } from './components/POS';
import { Ledger } from './components/Ledger';
import { Customers } from './components/Customers';
import { Expenses } from './components/Expenses';
import { Reports } from './components/Reports';
import { SalaryManager } from './components/SalaryManager';
import { ActivityLogs } from './components/ActivityLogs';
import { AdminSettings } from './components/AdminSettings';
import { SalesHistory } from './components/SalesHistory';
import { Purchase } from './components/Purchase'; 
import { SupplierManager } from './components/SupplierManager'; 
import { ProductGroup, Sale, Language, StoreSettings, Expense, User, ActivityLog, Employee, SalaryRecord, StockLog, ProductVariant, Supplier, Purchase as PurchaseType } from './types';
import {
  loadSettings, saveSettings,
  loadUsers, saveUsers,
  loadInventory, saveInventory, saveProductGroup,
  loadSales, saveSale, deleteSale,
  loadPurchases, savePurchase,
  loadSuppliers, saveSupplier,
  loadExpenses, saveExpense, deleteExpense as dbDeleteExpense,
  loadEmployees, saveEmployee,
  loadSalaryRecords, saveSalaryRecord,
  loadActivityLogs, saveActivityLog,
  adjustVariantStock,
  saveStockMovement,
  savePaymentAllocation,
  signIn, signOut, onAuthStateChange, loadCurrentUserProfile,
} from './lib/db';
import { LayoutDashboard, ShoppingBag, Package, BookOpen, Menu, X, Languages, Home, Users, Wallet, PieChart, LogOut, History, UserCircle, Settings, FileText, CheckCircle, AlertCircle, Info, Lock, Loader2, Building2, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdmin } from './lib/hooks/useAdmin';
import { safeValidateSale, safeValidatePurchase } from './lib/validation';

// --- Toast / Notification System ---
type ToastType = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  type: ToastType;
  msg: string;
}

// --- Memoized Components ---
const MemoDashboard = React.memo(Dashboard);
const MemoInventory = React.memo(Inventory);
const MemoPOS = React.memo(POS);
const MemoLedger = React.memo(Ledger);
const MemoCustomers = React.memo(Customers);
const MemoExpenses = React.memo(Expenses);
const MemoReports = React.memo(Reports);
const MemoSalaryManager = React.memo(SalaryManager);
const MemoActivityLogs = React.memo(ActivityLogs);
const MemoAdminSettings = React.memo(AdminSettings);
const MemoSalesHistory = React.memo(SalesHistory);
const MemoPurchase = React.memo(Purchase);
const MemoSupplierManager = React.memo(SupplierManager);

const translations: Record<string, Record<string, string>> = {
  dashboard: { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  pos: { en: 'New Sale', bn: 'বিক্রয় (POS)' },
  purchase: { en: 'Purchase', bn: 'ক্রয় (Purchase)' },
  inventory: { en: 'Inventory', bn: 'স্টক খাতা' },
  ledger: { en: 'Due Ledger', bn: 'বাকি খাতা' },
  history: { en: 'Memos', bn: 'মেমো / ইনভয়েস' },
  customers: { en: 'Customers', bn: 'কাস্টমার' },
  suppliers: { en: 'Suppliers', bn: 'সাপ্লায়ার' },
  expenses: { en: 'Expenses', bn: 'খরচ' },
  reports: { en: 'Reports', bn: 'রিপোর্ট' },
  salary: { en: 'Salary', bn: 'বেতন/হাজিরা' },
  logs: { en: 'Logs', bn: 'লগ' },
  settings: { en: 'Settings', bn: 'সেটিংস' },
  appName: { en: 'Tinghor.com', bn: 'টিনঘর' },
};

const LOGO_URL = "https://tinghor.com/wp-content/uploads/2023/11/tinghor-logo-150x150.png";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // New: Sidebar State
  const [lang, setLang] = useState<Language>('bn');
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // --- Data States ---
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ brands: [], colors: [], thicknesses: [], productTypes: [], customFields: [], nextInvoiceId: 1001 });
  const [inventory, setInventory] = useState<ProductGroup[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseType[]>([]);

  // --- Performance Optimizations: Indexed Maps for O(1) Lookups ---
  const salesById = useMemo(() => 
    Object.fromEntries(sales.map(s => [s.id, s])), 
    [sales]
  );

  const inventoryById = useMemo(() =>
    Object.fromEntries(inventory.map(g => [g.id, g])),
    [inventory]
  );

  const suppliersById = useMemo(() =>
    Object.fromEntries(suppliers.map(s => [s.id, s])),
    [suppliers]
  );

  // Variant index within groups for faster size lookups
  const variantIndexByGroup = useMemo(() => {
    const index: Record<string, Record<number, ProductVariant>> = {};
    inventory.forEach(group => {
      const variantMap: Record<number, ProductVariant> = {};
      group.variants.forEach(variant => {
        variantMap[variant.lengthFeet] = variant;
      });
      index[group.id] = variantMap;
    });
    return index;
  }, [inventory]);

  // --- Supabase Auth + Data Loading ---
  useEffect(() => {
    // Guard: prevent duplicate loadAllData calls (StrictMode double-invoke, TOKEN_REFRESHED race)
    let dataLoadStarted = false;

    async function loadAllData() {
      if (dataLoadStarted) return;
      dataLoadStarted = true;
      const results = await Promise.allSettled([
        loadSettings(), loadUsers(), loadInventory(), loadSales(),
        loadPurchases(), loadSuppliers(), loadExpenses(),
        loadEmployees(), loadSalaryRecords(), loadActivityLogs(),
      ]);
      const [
        settingsRes, usersRes, inventoryRes, salesRes,
        purchasesRes, suppliersRes, expensesRes,
        employeesRes, salaryRes, logsRes,
      ] = results;

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('Data load failures:', failures.map(f => (f as PromiseRejectedResult).reason));
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value) setSettings(settingsRes.value);
      if (usersRes.status === 'fulfilled' && usersRes.value.length > 0) setUsers(usersRes.value);
      if (inventoryRes.status === 'fulfilled') setInventory(inventoryRes.value);
      if (salesRes.status === 'fulfilled') setSales(salesRes.value);
      if (purchasesRes.status === 'fulfilled') setPurchases(purchasesRes.value);
      if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value);
      if (expensesRes.status === 'fulfilled') setExpenses(expensesRes.value);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value);
      if (salaryRes.status === 'fulfilled') setSalaryRecords(salaryRes.value);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value);

      setIsDataLoaded(true);
    }

    // Defer DB queries outside the auth callback to avoid Supabase deadlock.
    // Making supabase.from() queries inside onAuthStateChange blocks because
    // Supabase is still processing its own auth state at that point.
    async function tryLoadUser(userId: string) {
      try {
        const profile = await loadCurrentUserProfile(userId);
        if (profile) {
          setCurrentUser(profile);
          loadAllData();
        }
      } catch (e) {
        console.error('Auth profile load error:', e);
      } finally {
        setIsAuthChecked(true);
      }
    }

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          // setTimeout(0) defers past the auth state lock — prevents deadlock
          setTimeout(() => tryLoadUser(session.user.id), 0);
        } else {
          setIsAuthChecked(true);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setTimeout(() => tryLoadUser(session.user.id), 0);
        } else {
          setIsAuthChecked(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsDataLoaded(false);
        dataLoadStarted = false;
        setIsAuthChecked(true);
      } else {
        setIsAuthChecked(true);
      }
    });

    return () => {
      subscription.unsubscribe();
      dataLoadStarted = false; // Reset for StrictMode re-run
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Supabase Background Sync (debounced) ---
  const syncTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceSync = useCallback((key: string, fn: () => Promise<void>) => {
    if (syncTimeout.current[key]) clearTimeout(syncTimeout.current[key]);
    syncTimeout.current[key] = setTimeout(() => fn().catch(console.error), 1500);
  }, []);

  useEffect(() => { if (isDataLoaded) debounceSync('settings', () => saveSettings(settings)); }, [settings, isDataLoaded, debounceSync]);
  useEffect(() => { if (isDataLoaded) debounceSync('users', () => saveUsers(users)); }, [users, isDataLoaded, debounceSync]);
  useEffect(() => { if (isDataLoaded) debounceSync('inventory', () => saveInventory(inventory)); }, [inventory, isDataLoaded, debounceSync]);
  useEffect(() => { if (isDataLoaded) debounceSync('suppliers', () => Promise.all(suppliers.map(saveSupplier)).then(() => {})); }, [suppliers, isDataLoaded, debounceSync]);

  // --- Helpers ---
  const t = useCallback((key: string) => translations[key]?.[lang] || key, [lang]);

  const notify = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const handleLogin = async () => {
    const { error } = await signIn(loginEmail, loginPass);
    if (error) {
      notify('ইমেইল বা পাসওয়ার্ড ভুল!', 'error');
    } else {
      setLoginEmail('');
      setLoginPass('');
    }
  };
  const handleLogout = useCallback(async () => {
    await signOut();
    setCurrentUser(null);
    setActiveTab('dashboard');
  }, []);

  // Re-pasting handlers for completeness
  const handleCompleteSale = useCallback((sale: Sale) => {
    // Validate sale data before processing
    const validationResult = safeValidateSale(sale);
    if (!validationResult.success) {
      console.error('Sale validation failed:', validationResult.error);
      notify('Invalid sale data. Please check the information.', 'error');
      return;
    }

    const validatedSale = validationResult.data;
    
    setSettings(prev => {
        const newInvoiceId = prev.nextInvoiceId.toString();
        const saleWithMeta = { ...validatedSale, invoiceId: newInvoiceId, soldBy: currentUser?.name || 'Unknown' };
        setSales(prevSales => [saleWithMeta, ...prevSales]);
        saveSale(saleWithMeta).catch(console.error);
        if (validatedSale.items.length > 0 && validatedSale.items[0].groupId !== 'manual') {
          setInventory(prevInv => prevInv.map(group => {
            const relevantItems = validatedSale.items.filter(i => i.groupId === group.id);
           if (relevantItems.length === 0) return group;
            const updatedVariants = group.variants.map(variant => {
              const soldItem = relevantItems.find(item => item.variantId === variant.id);
              if (soldItem) {
                adjustVariantStock({ variantId: variant.id, qtyDelta: -soldItem.quantityPieces, minStock: 0 })
                  .then((updated) => saveStockMovement({
                    variantId: variant.id,
                    qtyChange: -soldItem.quantityPieces,
                    qtyAfter: updated.stockPieces,
                    costPerUnit: updated.averageCost,
                    voucherType: 'sale',
                    voucherId: saleWithMeta.id,
                  }))
                  .catch(console.error);
                return { ...variant, stockPieces: variant.stockPieces - soldItem.quantityPieces };
              }
              return variant;
            });
            const updatedGroup = { ...group, variants: updatedVariants };
            return updatedGroup;
          }));
        }
       const newSettings = { ...prev, nextInvoiceId: prev.nextInvoiceId + 1 };
       saveSettings(newSettings).catch(console.error);
        saveActivityLog({ id: crypto.randomUUID(), userId: currentUser?.id ?? '', userName: currentUser?.name ?? 'Unknown', action: `বিক্রয় INV-${newInvoiceId}`, details: `৳${validatedSale.finalAmount}`, timestamp: Date.now() }).catch(console.error);
       return newSettings;
    });
    notify('মেমো সেভ হয়েছে', 'success');
  }, [currentUser, notify]);

  const handleCompletePurchase = useCallback((purchase: PurchaseType, newSupplier?: Supplier) => {
    // Validate purchase data before processing
    const validationResult = safeValidatePurchase(purchase);
    if (!validationResult.success) {
      console.error('Purchase validation failed:', validationResult.error);
      notify('Invalid purchase data. Please check the information.', 'error');
      return;
    }

    const validatedPurchase = validationResult.data;
    
    let supId = validatedPurchase.supplierId;
    if (newSupplier) {
       supId = newSupplier.id;
       setSuppliers(prev => [...prev, { ...newSupplier, totalPurchase: validatedPurchase.finalAmount, totalDue: validatedPurchase.dueAmount }]);
    } else {
       setSuppliers(prev => prev.map(s => s.id === supId ? { ...s, totalPurchase: s.totalPurchase + validatedPurchase.finalAmount, totalDue: s.totalDue + validatedPurchase.dueAmount } : s));
    }
    const finalPurchase = { ...validatedPurchase, supplierId: supId };
    setPurchases(prev => [finalPurchase, ...prev]);
    savePurchase(finalPurchase).catch(console.error);
    if (validatedPurchase.items.length > 0) {
      setInventory(prevInv => prevInv.map(group => {
        const relevantItems = validatedPurchase.items.filter(i => i.groupId === group.id);
        if (relevantItems.length === 0) return group;
        const updatedVariants = group.variants.map(variant => {
           const purchasedItem = relevantItems.find(item => item.variantId === variant.id);
           if (purchasedItem) {
               const oldVal = variant.stockPieces * (variant.averageCost || 0);
               const newVal = purchasedItem.quantityPieces * purchasedItem.priceUnit;
               const newTotalStock = variant.stockPieces + purchasedItem.quantityPieces;
               const newAvg = newTotalStock > 0 ? Math.round(((oldVal + newVal) / newTotalStock) * 100) / 100 : Math.round(purchasedItem.priceUnit * 100) / 100;
               adjustVariantStock({
                 variantId: variant.id,
                 qtyDelta: purchasedItem.quantityPieces,
                 incomingCostPerUnit: purchasedItem.priceUnit,
                 minStock: 0,
               })
                 .then((updated) => saveStockMovement({
                   variantId: variant.id,
                   qtyChange: purchasedItem.quantityPieces,
                   qtyAfter: updated.stockPieces,
                   costPerUnit: purchasedItem.priceUnit,
                   voucherType: 'purchase',
                   voucherId: finalPurchase.id,
                 }))
                 .catch(console.error);
               return { ...variant, stockPieces: newTotalStock, averageCost: newAvg };
           }
           return variant;
        });
        const updatedGroup = { ...group, variants: updatedVariants };
        return updatedGroup;
      }));
      if (validatedPurchase.paidAmount > 0) {
         const expEntry = { id: crypto.randomUUID(), reason: `Purchase #${validatedPurchase.invoiceId}`, amount: validatedPurchase.paidAmount, category: 'purchase' as const, timestamp: Date.now() };
         setExpenses(prev => [...prev, expEntry]);
         saveExpense(expEntry).catch(console.error);
      }
    }
    if (newSupplier) {
      saveSupplier({ ...newSupplier, totalPurchase: validatedPurchase.finalAmount, totalDue: validatedPurchase.dueAmount }).catch(console.error);
    } else {
      setSuppliers(prev => { const s = prev.find(x => x.id === supId); if (s) saveSupplier(s).catch(console.error); return prev; });
    }
    saveActivityLog({ id: crypto.randomUUID(), userId: '', userName: 'System', action: `ক্রয় PUR-${validatedPurchase.invoiceId}`, details: `৳${validatedPurchase.finalAmount}`, timestamp: Date.now() }).catch(console.error);
    notify('স্টক আপডেট হয়েছে', 'success');
  }, [notify]);

  const handleUpdateSale = useCallback((updatedSale: Sale) => { setSales(prev => { const oldSale = prev.find(s => s.id === updatedSale.id); if (oldSale && updatedSale.paidAmount > oldSale.paidAmount) { const delta = updatedSale.paidAmount - oldSale.paidAmount; savePaymentAllocation({ invoiceId: updatedSale.id, invoiceType: 'sale', allocatedAmount: delta, receivedByName: 'Collection' }).catch(console.error); } return prev.map(s => s.id === updatedSale.id ? updatedSale : s); }); saveSale(updatedSale).catch(console.error); notify('আপডেট হয়েছে', 'success'); }, [notify]);
  const handleInventoryUpdate = useCallback((newInventory: ProductGroup[]) => { setInventory(newInventory); }, []);
  const handleDeleteSale = useCallback((saleId: string) => {
      setSales(prevSales => {
       const sale = prevSales.find(s => s.id === saleId);
       if (!sale) return prevSales;
       const hasTrackedItems = sale.items.some(i => i.groupId !== 'manual');
       if (hasTrackedItems) {
          setInventory(prevInv => prevInv.map(group => {
             const relevantItems = sale.items.filter(i => i.groupId === group.id);
             if (relevantItems.length === 0) return group;
             const updatedVariants = group.variants.map(variant => {
                const soldItem = relevantItems.find(item => item.variantId === variant.id);
                return soldItem ? { ...variant, stockPieces: variant.stockPieces + soldItem.quantityPieces } : variant;
             });
             return { ...group, variants: updatedVariants };
          }));
       }
       return prevSales.filter(s => s.id !== saleId);
    });
    deleteSale(saleId).catch(console.error);
    notify('ডিলিট হয়েছে', 'success');
  }, [notify]);
  const handleReturnItem = useCallback((saleId: string, itemIndex: number, returnQty: number) => {
     setSales(prevSales => prevSales.map(sale => {
        if (sale.id === saleId) {
           const newItems = [...sale.items];
           const item = newItems[itemIndex];
           const refundAmount = returnQty >= item.quantityPieces
             ? item.subtotal
             : Math.round(item.subtotal * returnQty / item.quantityPieces);
           if (item.groupId !== 'manual') {
               setInventory(prevInv => prevInv.map(g => {
                 if (g.id !== item.groupId) return g;
                 const updatedVariants = g.variants.map(v => v.id === item.variantId ? {...v, stockPieces: v.stockPieces + returnQty} : v);
                 const updatedG = { ...g, variants: updatedVariants };
                 const variant = g.variants.find(v => v.id === item.variantId);
                 if (variant) {
                   adjustVariantStock({ variantId: variant.id, qtyDelta: returnQty, minStock: 0 })
                     .then((updated) => saveStockMovement({
                       variantId: variant.id,
                       qtyChange: returnQty,
                       qtyAfter: updated.stockPieces,
                       costPerUnit: updated.averageCost,
                       voucherType: 'return',
                       voucherId: sale.id,
                     }))
                     .catch(console.error);
                 }
                 return updatedG;
               }));
            }
           const newItemQty = item.quantityPieces - returnQty;
           if (newItemQty <= 0) newItems.splice(itemIndex, 1);
           else newItems[itemIndex] = { ...item, quantityPieces: newItemQty, subtotal: item.subtotal - refundAmount, formattedQty: `${newItemQty} pcs (Ret ${returnQty})` };
           const newFinalAmount = sale.finalAmount - refundAmount;
           const updatedRetSale = { ...sale, items: newItems, subTotal: sale.subTotal - refundAmount, finalAmount: newFinalAmount, dueAmount: newFinalAmount - sale.paidAmount, note: (sale.note || '') + ` | Ret: ${returnQty}` };
           saveSale(updatedRetSale).catch(console.error);
           return updatedRetSale;
        }
        return sale;
     }));
     notify('ফেরত নেওয়া হয়েছে', 'success');
  }, [notify]);
  const handleStockEntry = useCallback((groupId: string, updatedVariants: any, log: StockLog) => { setInventory(prev => { const updated = prev.map(g => g.id === groupId ? { ...g, variants: updatedVariants } : g); const updatedG = updated.find(g => g.id === groupId); if (updatedG) saveProductGroup(updatedG).catch(console.error); return updated; }); setStockLogs(prev => [log, ...prev]); notify('স্টক যোগ হয়েছে', 'success'); }, [notify]);
  const handleGlobalCustomerUpdate = useCallback((oldName: string, oldPhone: string, newData: any) => { setSales(prev => prev.map(s => { if (s.customerName !== oldName || s.customerPhone !== oldPhone) return s; const updated = { ...s, customerName: newData.name, customerPhone: newData.phone, customerAddress: newData.address || s.customerAddress }; saveSale(updated).catch(console.error); return updated; })); notify('আপডেট হয়েছে', 'success'); }, [notify]);
  const handleAddExpense = useCallback((expense: Expense) => { setExpenses(prev => [expense, ...prev]); saveExpense(expense).catch(console.error); notify('খরচ যোগ হয়েছে', 'success'); }, [notify]);
  const handleDeleteExpense = useCallback((id: string) => { setExpenses(prev => prev.filter(e => e.id !== id)); dbDeleteExpense(id).catch(console.error); notify('ডিলিট হয়েছে', 'success'); }, [notify]);

  // Wait for Supabase to check localStorage for existing session (brief, ~50ms)
  if (!isAuthChecked) return <div className="min-h-screen flex items-center justify-center font-bangla"><Loader2 className="w-10 h-10 text-blue-600 animate-spin"/></div>;

  // Wait for data to load after confirmed login
  if (currentUser && !isDataLoaded) return <div className="min-h-screen flex items-center justify-center font-bangla"><Loader2 className="w-10 h-10 text-blue-600 animate-spin"/></div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-bangla">
        {toasts.map(t => (<div key={t.id} className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white font-bold flex gap-2 ${t.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>{t.msg}</div>))}
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
           <img src={LOGO_URL} alt="Logo" className="w-20 h-20 mx-auto mb-6 object-contain" />
           <h1 className="text-2xl font-bold text-slate-800 mb-2">টিনঘর.কম</h1>
           <div className="space-y-4 text-left">
              <div><label className="text-xs font-bold text-slate-400">ID/Email</label><input className="w-full p-3 border rounded-lg" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
              <div><label className="text-xs font-bold text-slate-400">Password</label><input type="password" className="w-full p-3 border rounded-lg" value={loginPass} onChange={e => setLoginPass(e.target.value)} /></div>
              <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">লগিন</button>
           </div>
        </div>
      </div>
    );
  }

  // Use secure admin hook with server-side verification
  const { isAdmin, isLoading: isAdminLoading, hasPermission } = useAdmin(currentUser);

  // --- Compact Sidebar Nav Button ---
  const NavButton = React.memo(({ tab, icon: Icon, label, restricted, requiredPermission }: any) => {
    if (restricted && !isAdmin) return null;
    if (requiredPermission && !hasPermission(requiredPermission)) return null;
    return (
      <button
        onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all w-full text-left font-bangla ${
          activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        } ${isSidebarCollapsed ? 'justify-center' : ''}`}
        title={isSidebarCollapsed ? label : ''}
      >
        <Icon className={`${isSidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} /> 
        {!isSidebarCollapsed && <span className="font-semibold text-sm">{label}</span>}
      </button>
    );
  });

  return (
    <LanguageContext.Provider value={{ lang, t }}>
      <ToastContext.Provider value={{ notify }}>
      <div className={`min-h-screen bg-slate-50 flex ${lang === 'bn' ? 'font-bangla' : 'font-sans'}`}>
        {/* Toast Container */}
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-xl text-white font-bold flex items-center gap-3 animate-slide-in pointer-events-auto ${t.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
              {t.msg}
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 ${
          isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
          
          <div className={`h-16 flex items-center border-b border-slate-100 ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-6'}`}>
            {!isSidebarCollapsed ? <img src={LOGO_URL} alt="Logo" className="h-8 w-auto object-contain" /> : <div className="font-bold text-blue-600 text-xl">TG</div>}
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400"><X className="w-5 h-5" /></button>
          </div>

          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
            <NavButton tab="dashboard" icon={LayoutDashboard} label={t('dashboard')} />
            <NavButton tab="pos" icon={ShoppingBag} label={t('pos')} />
            <NavButton tab="purchase" icon={ShoppingCart} label={t('purchase')} />
            <div className="my-2 border-t border-slate-100"></div>
            <NavButton tab="inventory" icon={Package} label={t('inventory')} />
            <NavButton tab="ledger" icon={BookOpen} label={t('ledger')} />
            <NavButton tab="history" icon={FileText} label={t('history')} />
            <div className="my-2 border-t border-slate-100"></div>
            <NavButton tab="customers" icon={Users} label={t('customers')} />
            <NavButton tab="suppliers" icon={Building2} label={t('suppliers')} />
            <NavButton tab="expenses" icon={Wallet} label={t('expenses')} />
            
            {isAdmin && (
               <>
               <div className="my-2 border-t border-slate-100"></div>
               {!isSidebarCollapsed && <p className="px-3 text-[10px] font-bold text-slate-400 uppercase mb-1">Admin</p>}
                <NavButton tab="reports" icon={PieChart} label={t('reports')} restricted={true} requiredPermission="view_reports" />
                <NavButton tab="salary" icon={UserCircle} label={t('salary')} restricted={true} requiredPermission="manage_salary" />
                <NavButton tab="logs" icon={History} label={t('logs')} restricted={true} requiredPermission="view_logs" />
                <NavButton tab="settings" icon={Settings} label={t('settings')} restricted={true} requiredPermission="manage_settings" />
               </>
            )}
          </nav>

          {/* Bottom Actions */}
          <div className="absolute bottom-0 w-full border-t border-slate-100 bg-white p-3">
             {!isSidebarCollapsed ? (
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl mb-2">
                   <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">{currentUser.name?.[0] ?? '?'}</div>
                   <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold text-slate-700 truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{currentUser.role}</p>
                   </div>
                   <button onClick={handleLogout} className="text-slate-400 hover:text-red-500"><LogOut className="w-4 h-4"/></button>
                </div>
             ) : (
                <div className="flex flex-col items-center gap-4 mb-2">
                   <button onClick={handleLogout} className="text-slate-400 hover:text-red-500"><LogOut className="w-5 h-5"/></button>
                </div>
             )}
             
             {/* Collapse Toggle */}
             <button 
               onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
               className="w-full flex justify-center py-2 text-slate-300 hover:text-blue-600 transition border-t border-slate-100"
             >
                {isSidebarCollapsed ? <ChevronRight className="w-5 h-5"/> : <ChevronLeft className="w-5 h-5"/>}
             </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 p-4 lg:p-6 overflow-x-hidden ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          {/* Header Mobile */}
          <div className="lg:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-50 rounded-lg"><Menu className="w-5 h-5 text-slate-600" /></button>
              <img src={LOGO_URL} alt="Logo" className="h-6 w-auto" />
            </div>
            <button onClick={() => setLang(l => l === 'en' ? 'bn' : 'en')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-50 text-xs font-bold">
              <Languages className="w-4 h-4 text-blue-600" /> {lang === 'en' ? 'EN' : 'BN'}
            </button>
          </div>

          {/* Dynamic Content */}
          <div className="max-w-[1600px] mx-auto">
             {activeTab === 'dashboard' && <MemoDashboard inventory={inventory} sales={sales} expenses={expenses} />}
             {activeTab === 'pos' && <MemoPOS inventory={inventory} onCompleteSale={handleCompleteSale} settings={settings} sales={sales} />}
             {activeTab === 'purchase' && <MemoPurchase inventory={inventory} suppliers={suppliers} onCompletePurchase={handleCompletePurchase} settings={settings} />}
             {activeTab === 'history' && <MemoSalesHistory sales={sales} onUpdateSale={handleUpdateSale} onDeleteSale={handleDeleteSale} inventory={inventory} setInventory={handleInventoryUpdate} settings={settings} />}
              {activeTab === 'inventory' && <MemoInventory inventory={inventory} inventoryById={inventoryById} variantIndexByGroup={variantIndexByGroup} setInventory={setInventory} settings={settings} setSettings={setSettings} stockLogs={stockLogs} onStockAdd={handleStockEntry} currentUser={currentUser} />}
              {activeTab === 'ledger' && <MemoLedger sales={sales} salesById={salesById} onUpdateSale={handleUpdateSale} onAddNewSale={handleCompleteSale} onReturnItem={handleReturnItem} />}
             {activeTab === 'customers' && <MemoCustomers sales={sales} onUpdateCustomer={handleGlobalCustomerUpdate} />}
             {activeTab === 'suppliers' && <MemoSupplierManager suppliers={suppliers} onAddSupplier={(s) => setSuppliers(prev => [...prev, s])} />}
             {activeTab === 'expenses' && <MemoExpenses expenses={expenses} onAddExpense={handleAddExpense} onDeleteExpense={handleDeleteExpense} />}
             
             {isAdmin && (
                <>
                {activeTab === 'reports' && <MemoReports sales={sales} expenses={expenses} />}
                {activeTab === 'salary' && (
                   <MemoSalaryManager 
                     employees={employees} 
                     salaryRecords={salaryRecords} 
                     attendance={attendance}
                     onAddEmployee={(e) => { setEmployees(prev => [...prev, e]); saveEmployee(e).catch(console.error); }} 
                     onAddRecord={(r) => {
                       setSalaryRecords(prev => [...prev, r]);
                       saveSalaryRecord(r).catch(console.error);
                       saveActivityLog({ id: crypto.randomUUID(), userId: '', userName: 'System', action: `বেতন - ${r.employeeName}`, details: `৳${r.amount}`, timestamp: Date.now() }).catch(console.error);
                       handleAddExpense({ id: crypto.randomUUID(), reason: `Salary - ${r.employeeName}`, amount: r.amount, category: 'salary', timestamp: r.date });
                     }}
                     onUpdateAttendance={(r) => {
                        setAttendance(prev => {
                           const idx = prev.findIndex(a => a.employeeId === r.employeeId && a.date === r.date);
                           const newAtt = [...prev];
                           if(idx>=0) newAtt[idx] = r; else newAtt.push(r);
                           return newAtt;
                        });
                     }}
                     currentUser={currentUser}
                   />
                )}
                {activeTab === 'logs' && <MemoActivityLogs logs={logs} />}
                {activeTab === 'settings' && <MemoAdminSettings settings={settings} setSettings={setSettings} users={users} setUsers={setUsers} />}
                </>
             )}
          </div>
        </main>
      </div>
      </ToastContext.Provider>
    </LanguageContext.Provider>
  );
};

export default App;
