
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
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
import { ProductGroup, Sale, Language, StoreSettings, Expense, User, ActivityLog, Employee, SalaryRecord, StockLog, ProductVariant, Supplier, Purchase as PurchaseType, Attendance } from './types';
import {
  loadSettings, saveSettings,
  loadUsers, saveUsers,
  loadInventory, saveProductGroup,
  loadSales, saveSale, deleteSale, saveSaleEditLog,
  loadPurchases, savePurchase,
  loadSuppliers, saveSupplier,
  loadExpenses, saveExpense, deleteExpense as dbDeleteExpense,
  loadEmployees, saveEmployee,
  loadSalaryRecords, saveSalaryRecord,
  loadActivityLogs, saveActivityLog,
  loadAttendance, saveAttendance,
  loadStockMovements,
  adjustVariantStock as dbAdjustVariantStock,
  saveStockMovement,
  savePaymentAllocation,
  signIn, signOut, onAuthStateChange, loadCurrentUserProfile,
} from './lib/db';
import { LayoutDashboard, ShoppingBag, Package, BookOpen, Menu, X, Languages, Home, Users, Wallet, PieChart, LogOut, History, UserCircle, Settings, FileText, CheckCircle, AlertCircle, Info, Lock, Loader2, Building2, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  type: ToastType;
  msg: string;
}

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lang, setLang] = useState<Language>('bn');
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ shopName: 'টিনঘর.কম', shopPhone: '', shopAddress: '', brands: [], colors: [], thicknesses: [], productTypes: [], customFields: [], nextInvoiceId: 1001 });
  const [inventory, setInventory] = useState<ProductGroup[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseType[]>([]);

  useEffect(() => {
    let dataLoadStarted = false;

    async function loadAllData() {
      if (dataLoadStarted) return;
      dataLoadStarted = true;
      const results = await Promise.allSettled([
        loadSettings(), loadUsers(), loadInventory(), loadSales(),
        loadPurchases(), loadSuppliers(), loadExpenses(),
        loadEmployees(), loadSalaryRecords(), loadActivityLogs(),
        loadAttendance(), loadStockMovements(),
      ]);
      const [
        settingsRes, usersRes, inventoryRes, salesRes,
        purchasesRes, suppliersRes, expensesRes,
        employeesRes, salaryRes, logsRes,
        attendanceRes, stockLogsRes,
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
      if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value);
      if (stockLogsRes.status === 'fulfilled') setStockLogs(stockLogsRes.value);

      setIsDataLoaded(true);
    }

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
      dataLoadStarted = false;
    };
  }, []);

  const syncTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceSync = useCallback((key: string, fn: () => Promise<void>) => {
    if (syncTimeout.current[key]) clearTimeout(syncTimeout.current[key]);
    syncTimeout.current[key] = setTimeout(() => fn().catch(console.error), 1500);
  }, []);

  useEffect(() => { if (isDataLoaded) debounceSync('settings', () => saveSettings(settings)); }, [settings, isDataLoaded, debounceSync]);
  useEffect(() => { if (isDataLoaded) debounceSync('users', () => saveUsers(users)); }, [users, isDataLoaded, debounceSync]);
  useEffect(() => { if (isDataLoaded) debounceSync('suppliers', () => Promise.all(suppliers.map(saveSupplier)).then(() => {})); }, [suppliers, isDataLoaded, debounceSync]);

  // Remove full inventory debounce sync to prevent overwriting concurrent stock changes
  // Each mutation handler persists changed groups individually.

  useEffect(() => {
    const listener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) CapApp.exitApp();
      else window.history.back();
    });
    return () => { listener.then(h => h.remove()); };
  }, []);

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

  const adjustVariantStock = useCallback(async (params: {
    variantId: string;
    qtyDelta: number;
    incomingCostPerUnit?: number;
  }) => {
    return dbAdjustVariantStock({
      variantId: params.variantId,
      qtyDelta: params.qtyDelta,
      incomingCostPerUnit: params.incomingCostPerUnit,
    });
  }, []);

  const handleCompleteSale = useCallback(async (sale: Sale) => {
    try {
      const newInvoiceId = (settings.nextInvoiceId).toString();
      const saleWithMeta = { ...sale, invoiceId: newInvoiceId, soldBy: currentUser?.name || 'Unknown' };

      await saveSale(saleWithMeta);
      setSales(prevSales => [saleWithMeta, ...prevSales]);

      const nextSettings = { ...settings, nextInvoiceId: settings.nextInvoiceId + 1 };
      setSettings(nextSettings);
      await saveSettings(nextSettings);

      await saveActivityLog({
        id: crypto.randomUUID(), userId: currentUser?.id ?? '', userName: currentUser?.name ?? 'Unknown',
        action: `বিক্রয় INV-${newInvoiceId}`, details: `৳${sale.finalAmount}`, timestamp: Date.now(),
      });

      setInventory(prevInv => prevInv.map(group => {
        const relevantItems = sale.items.filter(i => i.groupId === group.id);
        if (relevantItems.length === 0) return group;
        return {
          ...group,
          variants: group.variants.map(variant => {
            const soldItem = relevantItems.find(item => item.variantId === variant.id);
            if (!soldItem) return variant;
            dbAdjustVariantStock({
              variantId: variant.id,
              qtyDelta: -soldItem.quantityPieces,
            }).catch(console.error);
            return { ...variant, stockPieces: variant.stockPieces - soldItem.quantityPieces };
          }),
        };
      }));

      notify('মেমো সেভ হয়েছে', 'success');
    } catch (err) {
      console.error('handleCompleteSale failed:', err);
      notify('মেমো সেভ করা যায়নি', 'error');
    }
  }, [currentUser, notify, settings]);

  const handleCompletePurchase = useCallback(async (purchase: PurchaseType, newSupplier?: Supplier) => {
    try {
      let supId = purchase.supplierId;
      if (newSupplier) {
        supId = newSupplier.id;
        const savedSupplier = { ...newSupplier, totalPurchase: purchase.finalAmount, totalDue: purchase.dueAmount };
        await saveSupplier(savedSupplier);
        setSuppliers(prev => [...prev, savedSupplier]);
      } else {
        const updatedSupplier = { ...suppliers.find(s => s.id === supId)!,
          totalPurchase: (suppliers.find(s => s.id === supId)?.totalPurchase ?? 0) + purchase.finalAmount,
          totalDue: (suppliers.find(s => s.id === supId)?.totalDue ?? 0) + purchase.dueAmount,
        };
        await saveSupplier(updatedSupplier);
        setSuppliers(prev => prev.map(s => s.id === supId ? updatedSupplier : s));
      }

      const finalPurchase = { ...purchase, supplierId: supId };
      await savePurchase(finalPurchase);
      setPurchases(prev => [finalPurchase, ...prev]);

      if (purchase.items.length > 0) {
        const updates = purchase.items
          .filter(item => item.variantId)
          .map(item =>
            dbAdjustVariantStock({
              variantId: item.variantId!,
              qtyDelta: item.quantityPieces,
              incomingCostPerUnit: item.priceUnit,
            }).then(updated =>
              saveStockMovement({
                variantId: item.variantId!,
                qtyChange: item.quantityPieces,
                qtyAfter: updated.stockPieces,
                costPerUnit: item.priceUnit,
                voucherType: 'purchase',
                voucherId: finalPurchase.id,
              })
            )
          );
        await Promise.all(updates);

        setInventory(prevInv => prevInv.map(group => {
          const relevantItems = purchase.items.filter(i => i.groupId === group.id);
          if (relevantItems.length === 0) return group;
          return {
            ...group,
            variants: group.variants.map(variant => {
              const purchasedItem = relevantItems.find(item => item.variantId === variant.id);
              if (!purchasedItem) return variant;
              return {
                ...variant,
                stockPieces: variant.stockPieces + purchasedItem.quantityPieces,
                avgCostPrice: variant.avgCostPrice,
              };
            }),
          };
        }));

        if (purchase.paidAmount > 0) {
          const expEntry = { id: crypto.randomUUID(), reason: `Purchase #${purchase.invoiceId}`, amount: purchase.paidAmount, category: 'purchase' as const, timestamp: Date.now() };
          await saveExpense(expEntry);
          setExpenses(prev => [...prev, expEntry]);
        }
      }

      await saveActivityLog({
        id: crypto.randomUUID(), userId: '', userName: 'System',
        action: `ক্রয় PUR-${purchase.invoiceId}`, details: `৳${purchase.finalAmount}`, timestamp: Date.now(),
      });

      notify('স্টক আপডেট হয়েছে', 'success');
    } catch (err) {
      console.error('handleCompletePurchase failed:', err);
      notify('ক্রয় সেভ করা যায়নি', 'error');
    }
  }, [suppliers, notify]);

  const handleUpdateSale = useCallback(async (updatedSale: Sale) => {
    try {
      const oldSale = sales.find(s => s.id === updatedSale.id);
      setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
      await saveSale(updatedSale);
      if (oldSale && updatedSale.paidAmount > oldSale.paidAmount) {
        const delta = updatedSale.paidAmount - oldSale.paidAmount;
        await savePaymentAllocation({
          invoiceId: updatedSale.id, invoiceType: 'sale', allocatedAmount: delta, receivedByName: 'Collection',
        });
      }
      if (oldSale && currentUser) {
        await saveSaleEditLog({
          saleId: updatedSale.id, editedBy: currentUser.id,
          fieldChanged: 'sale_update',
          oldValue: oldSale, newValue: updatedSale,
        });
      }
      notify('আপডেট হয়েছে', 'success');
    } catch (err) {
      console.error('handleUpdateSale failed:', err);
      notify('আপডেট করা যায়নি', 'error');
    }
  }, [sales, currentUser, notify]);

  const handleInventoryUpdate = useCallback((newInventory: ProductGroup[]) => {
    setInventory(newInventory);
  }, []);

  const handleDeleteSale = useCallback(async (saleId: string) => {
    try {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;
      if (currentUser) {
        await saveSaleEditLog({
          saleId, editedBy: currentUser.id,
          fieldChanged: 'sale_delete',
          oldValue: sale, newValue: null,
        });
      }
      await deleteSale(saleId);
      setSales(prev => prev.filter(s => s.id !== saleId));
      const hasTrackedItems = sale.items.some(i => i.groupId !== 'manual');
      if (hasTrackedItems) {
        setInventory(prevInv => prevInv.map(group => {
          const relevantItems = sale.items.filter(i => i.groupId === group.id);
          if (relevantItems.length === 0) return group;
          return {
            ...group,
            variants: group.variants.map(variant => {
              const soldItem = relevantItems.find(item => item.variantId === variant.id);
              return soldItem ? { ...variant, stockPieces: variant.stockPieces + soldItem.quantityPieces } : variant;
            }),
          };
        }));
      }
      notify('ডিলিট হয়েছে', 'success');
    } catch (err) {
      console.error('handleDeleteSale failed:', err);
      notify('ডিলিট করা যায়নি', 'error');
    }
  }, [sales, currentUser, notify]);

  const handleReturnItem = useCallback(async (saleId: string, itemIndex: number, returnQty: number) => {
    try {
      const sale = sales.find(s => s.id === saleId);
      if (!sale || !currentUser) return;
      const item = sale.items[itemIndex];
      const refundAmount = returnQty >= item.quantityPieces
        ? item.subtotal
        : Math.round(item.subtotal * returnQty / item.quantityPieces);

      if (item.groupId !== 'manual' && item.variantId) {
        const updated = await dbAdjustVariantStock({
          variantId: item.variantId,
          qtyDelta: returnQty,
        });
        await saveStockMovement({
          variantId: item.variantId,
          qtyChange: returnQty,
          qtyAfter: updated.stockPieces,
          costPerUnit: updated.avgCostPrice,
          voucherType: 'return',
          voucherId: sale.id,
        });
      }

      const newItems = [...sale.items];
      const newItemQty = item.quantityPieces - returnQty;
      if (newItemQty <= 0) newItems.splice(itemIndex, 1);
      else newItems[itemIndex] = { ...item, quantityPieces: newItemQty, subtotal: item.subtotal - refundAmount, formattedQty: `${newItemQty} pcs (Ret ${returnQty})` };

      const newFinalAmount = sale.finalAmount - refundAmount;
      const updatedRetSale = {
        ...sale, items: newItems, subTotal: sale.subTotal - refundAmount,
        finalAmount: newFinalAmount, dueAmount: newFinalAmount - sale.paidAmount,
        note: (sale.note || '') + ` | Ret: ${returnQty}`,
      };

      setSales(prev => prev.map(s => s.id === saleId ? updatedRetSale : s));
      await saveSale(updatedRetSale);

      await saveSaleEditLog({
        saleId, editedBy: currentUser.id,
        fieldChanged: 'sale_return',
        oldValue: { itemIndex, returnQty },
        newValue: updatedRetSale.items,
      });

      notify('ফেরত নেওয়া হয়েছে', 'success');
    } catch (err) {
      console.error('handleReturnItem failed:', err);
      notify('ফেরত নেওয়া যায়নি', 'error');
    }
  }, [sales, currentUser, notify]);

  const handleStockEntry = useCallback(async (groupId: string, updatedVariants: ProductVariant[], log: StockLog) => {
    try {
      const updated = inventory.map(g => g.id === groupId ? { ...g, variants: updatedVariants } : g);
      const updatedG = updated.find(g => g.id === groupId);
      if (updatedG) await saveProductGroup(updatedG);
      setInventory(updated);
      setStockLogs(prev => [log, ...prev]);
      notify('স্টক যোগ হয়েছে', 'success');
    } catch (err) {
      console.error('handleStockEntry failed:', err);
      notify('স্টক যোগ করা যায়নি', 'error');
    }
  }, [inventory, notify]);

  const handleGlobalCustomerUpdate = useCallback(async (oldName: string, oldPhone: string, newData: { name: string; phone: string; address: string }) => {
    try {
      const updates = sales
        .filter(s => s.customerName === oldName && s.customerPhone === oldPhone)
        .map(async (s) => {
          const updated = {
            ...s,
            customerName: newData.name || s.customerName,
            customerPhone: newData.phone || s.customerPhone,
            customerAddress: newData.address || s.customerAddress,
          };
          await saveSale(updated);
          return updated;
        });
      const updatedSales = await Promise.all(updates);
      setSales(prev => prev.map(s => {
        const match = updatedSales.find(u => u.id === s.id);
        return match ?? s;
      }));
      notify('আপডেট হয়েছে', 'success');
    } catch (err) {
      console.error('handleGlobalCustomerUpdate failed:', err);
      notify('আপডেট করা যায়নি', 'error');
    }
  }, [sales, notify]);

  const handleAddExpense = useCallback(async (expense: Expense) => {
    try {
      await saveExpense(expense);
      setExpenses(prev => [expense, ...prev]);
      notify('খরচ যোগ হয়েছে', 'success');
    } catch (err) {
      console.error('handleAddExpense failed:', err);
      notify('খরচ যোগ করা যায়নি', 'error');
    }
  }, [notify]);

  const handleDeleteExpense = useCallback(async (id: string) => {
    try {
      await dbDeleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      notify('ডিলিট হয়েছে', 'success');
    } catch (err) {
      console.error('handleDeleteExpense failed:', err);
      notify('ডিলিট করা যায়নি', 'error');
    }
  }, [notify]);

  if (!isAuthChecked) return <div className="min-h-screen flex items-center justify-center font-bangla"><Loader2 className="w-10 h-10 text-blue-600 animate-spin"/></div>;

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

  const isAdmin = currentUser.role === 'admin';

  interface NavButtonProps {
    tab: string;
    icon: React.FC<{ className?: string }>;
    label: string;
    restricted?: boolean;
  }

  const NavButton = React.memo<NavButtonProps>(({ tab, icon: Icon, label, restricted }) => {
    if (restricted && !isAdmin) return null;
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
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-xl text-white font-bold flex items-center gap-3 animate-slide-in pointer-events-auto ${t.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
              {t.msg}
            </div>
          ))}
        </div>

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
               <NavButton tab="reports" icon={PieChart} label={t('reports')} restricted={true} />
               <NavButton tab="salary" icon={UserCircle} label={t('salary')} restricted={true} />
               <NavButton tab="logs" icon={History} label={t('logs')} restricted={true} />
               <NavButton tab="settings" icon={Settings} label={t('settings')} restricted={true} />
               </>
            )}
          </nav>

          <div className="absolute bottom-0 w-full border-t border-slate-100 bg-white p-3">
             {!isSidebarCollapsed ? (
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl mb-2">
                   <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">{currentUser.name?.[0] ?? '?'}</div>
                   <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold text-slate-700 truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{currentUser.role === 'admin' ? 'অ্যাডমিন' : 'স্টাফ'}</p>
                   </div>
                   <button onClick={handleLogout} className="text-slate-400 hover:text-red-500"><LogOut className="w-4 h-4"/></button>
                </div>
             ) : (
                <div className="flex flex-col items-center gap-4 mb-2">
                   <button onClick={handleLogout} className="text-slate-400 hover:text-red-500"><LogOut className="w-5 h-5"/></button>
                </div>
             )}

             <button
               onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
               className="w-full flex justify-center py-2 text-slate-300 hover:text-blue-600 transition border-t border-slate-100"
             >
                {isSidebarCollapsed ? <ChevronRight className="w-5 h-5"/> : <ChevronLeft className="w-5 h-5"/>}
             </button>
          </div>
        </aside>

        <main className={`flex-1 transition-all duration-300 p-4 lg:p-6 overflow-x-hidden ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <div className="lg:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-50 rounded-lg"><Menu className="w-5 h-5 text-slate-600" /></button>
              <img src={LOGO_URL} alt="Logo" className="h-6 w-auto" />
            </div>
            <button onClick={() => setLang(l => l === 'en' ? 'bn' : 'en')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-50 text-xs font-bold">
              <Languages className="w-4 h-4 text-blue-600" /> {lang === 'en' ? 'EN' : 'BN'}
            </button>
          </div>

          <div className="max-w-[1600px] mx-auto">
             {activeTab === 'dashboard' && <MemoDashboard inventory={inventory} sales={sales} expenses={expenses} />}
             {activeTab === 'pos' && <MemoPOS inventory={inventory} onCompleteSale={handleCompleteSale} settings={settings} />}
             {activeTab === 'purchase' && <MemoPurchase inventory={inventory} suppliers={suppliers} onCompletePurchase={handleCompletePurchase} settings={settings} />}
              {activeTab === 'history' && <MemoSalesHistory sales={sales} onUpdateSale={handleUpdateSale} onDeleteSale={handleDeleteSale} onReturnItem={handleReturnItem} inventory={inventory} setInventory={handleInventoryUpdate} settings={settings} />}
             {activeTab === 'inventory' && <MemoInventory inventory={inventory} setInventory={setInventory} settings={settings} setSettings={setSettings} stockLogs={stockLogs} onStockAdd={handleStockEntry} currentUser={currentUser} />}
             {activeTab === 'ledger' && <MemoLedger sales={sales} onUpdateSale={handleUpdateSale} onAddNewSale={handleCompleteSale} onReturnItem={handleReturnItem} />}
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
                     onAddEmployee={async (e) => {
                       await saveEmployee(e);
                       setEmployees(prev => [...prev, e]);
                     }}
                     onAddRecord={async (r) => {
                       await saveSalaryRecord(r);
                       setSalaryRecords(prev => [...prev, r]);
                       await saveActivityLog({
                         id: crypto.randomUUID(), userId: '', userName: 'System',
                         action: `বেতন - ${r.employeeName}`, details: `৳${r.amount}`, timestamp: Date.now(),
                       });
                       const expEntry: Expense = {
                         id: crypto.randomUUID(), reason: `Salary - ${r.employeeName}`,
                         amount: r.amount, category: 'salary', timestamp: r.date,
                       };
                       await saveExpense(expEntry);
                       setExpenses(prev => [expEntry, ...prev]);
                       notify('বেতন সেভ হয়েছে', 'success');
                     }}
                     onUpdateAttendance={async (r) => {
                       await saveAttendance(r);
                       setAttendance(prev => {
                         const idx = prev.findIndex(a => a.employeeId === r.employeeId && a.date === r.date);
                         const newAtt = [...prev];
                         if (idx >= 0) newAtt[idx] = r; else newAtt.push(r);
                         return newAtt;
                       });
                       notify('হাজিরা সেভ হয়েছে', 'success');
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
