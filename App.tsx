
import React, { useState, useCallback } from 'react';
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
  saveSettings, saveUsers, saveSupplier,
  saveEmployee, saveSalaryRecord, saveAttendance,
  saveActivityLog, saveExpense,
} from './lib/db';
import { LayoutDashboard, ShoppingBag, Package, BookOpen, Menu, X, Languages, Users, Wallet, PieChart, LogOut, History, UserCircle, Settings, FileText, Loader2, Building2, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth, useAppData, useSales, usePurchases, useInventory, useExpenses } from './lib/hooks';

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
  pos: { en: 'New Sale', bn: 'বিক্রয় (POS)' },
  purchase: { en: 'Purchase', bn: 'ক্রয় (Purchase)' },
  inventory: { en: 'Inventory', bn: 'স্টক খাতা' },
  ledger: { en: 'Due Ledger', bn: 'বাকি খাতা' },
  history: { en: 'Memos', bn: 'মেমো / ইনভয়েস' },
  customers: { en: 'Customers', bn: 'কাস্টমার' },
  suppliers: { en: 'Suppliers', bn: 'সাপ্লায়ার' },
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

  // --- Toast Helper ---
  const notify = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // --- Hook: Auth ---
  const {
    currentUser, isAuthChecked,
    loginEmail, loginPass, setLoginEmail, setLoginPass,
    handleLogin: hookHandleLogin, handleLogout: hookHandleLogout,
  } = useAuth({ notify });

  // --- Hook: App Data (loading + background sync) ---
  const {
    settings, users, inventory, sales, expenses, employees, salaryRecords,
    attendance, logs, suppliers, purchases, stockLogs,
    setSettings, setUsers, setInventory, setSales, setExpenses,
    setEmployees, setSalaryRecords, setAttendance, setLogs,
    setSuppliers, setPurchases, setStockLogs,
  } = useAppData({
    currentUser,
    isDataLoaded,
    onDataLoaded: () => setIsDataLoaded(true),
  });

  // --- Hook: Inventory ---
  const { handleStockEntry, handleInventoryUpdate } = useInventory({ currentUser, notify });

  // --- Hook: Sales ---
  const { handleCompleteSale, handleUpdateSale, handleDeleteSale, handleReturnItem } = useSales({
    settings, currentUser, notify,
  });

  // Wire up sale's inventory reservedQty update
  const handleCompleteSaleWithInventory = useCallback(async (sale: Sale) => {
    await handleCompleteSale(sale);
    // Update local inventory reservedQty to match DB
    if (sale.items.length > 0 && sale.items[0].groupId !== 'manual') {
      setInventory(prevInv => prevInv.map(group => {
        const relevantItems = sale.items.filter(i => i.groupId === group.id);
        if (relevantItems.length === 0) return group;
        const updatedVariants = group.variants.map(variant => {
          const soldItem = relevantItems.find(item => item.variantId === variant.id);
          if (soldItem) {
            return { ...variant, reservedQty: (variant.reservedQty ?? 0) + soldItem.quantityPieces };
          }
          return variant;
        });
        return { ...group, variants: updatedVariants };
      }));
    }
    // Update invoice counter
    setSettings(prev => ({ ...prev, nextInvoiceId: prev.nextInvoiceId + 1 }));
  }, [handleCompleteSale, setInventory, setSettings]);

  // --- Hook: Purchases ---
  const { handleCompletePurchase } = usePurchases({
    notify,
    onInventoryUpdate: setInventory,
    onExpensesUpdate: setExpenses,
    onSaveExpense: (expense: Expense) => {
      saveExpense(expense).catch(console.error);
    },
  });

  // Wire up purchase's supplier + purchase list updates
  const handleCompletePurchaseWithSuppliers = useCallback(async (purchase: PurchaseType, newSupplier?: Supplier) => {
    let supId = purchase.supplierId;
    if (newSupplier) {
      supId = newSupplier.id;
      setSuppliers(prev => [...prev, { ...newSupplier, totalPurchase: purchase.finalAmount, totalDue: purchase.dueAmount }]);
      saveSupplier({ ...newSupplier, totalPurchase: purchase.finalAmount, totalDue: purchase.dueAmount }).catch(console.error);
    } else {
      setSuppliers(prev => prev.map(s => s.id === supId ? { ...s, totalPurchase: s.totalPurchase + purchase.finalAmount, totalDue: s.totalDue + purchase.dueAmount } : s));
    }
    setPurchases(prev => [purchase, ...prev]);
    await handleCompletePurchase(purchase, newSupplier);
  }, [handleCompletePurchase, setSuppliers, setPurchases]);

  // --- Hook: Expenses ---
  const { handleAddExpense, handleDeleteExpense, handleUpdateAttendance } = useExpenses({ notify });

  // --- Global Customer Update (needs sales state) ---
  const handleGlobalCustomerUpdate = useCallback((oldName: string, oldPhone: string, newData: { name: string; phone: string; address?: string }) => {
    const { saveSale } = require('./lib/db');
    setSales(prev => prev.map(s => {
      if (s.customerName !== oldName || s.customerPhone !== oldPhone) return s;
      const updated = { ...s, customerName: newData.name, customerPhone: newData.phone, customerAddress: newData.address || s.customerAddress };
      saveSale(updated).catch((err: unknown) => { console.error(err); notify("সেভ করা যায়নি", "error"); });
      return updated;
    }));
    notify('আপডেট হয়েছে', 'success');
  }, [notify, setSales]);

  // --- Login / Logout ---
  const handleLogin = async () => {
    await hookHandleLogin();
  };
  const handleLogout = useCallback(async () => {
    await hookHandleLogout();
    setActiveTab('dashboard');
  }, [hookHandleLogout]);

  // --- Translation Helper ---
  const t = useCallback((key: string) => translations[key]?.[lang] || key, [lang]);

  // --- Loading States ---
  if (!isAuthChecked) return <div className="min-h-screen flex items-center justify-center bg-surface-50"><Loader2 className="w-10 h-10 text-primary-600 animate-spin"/></div>;
  if (currentUser && !isDataLoaded) return <div className="min-h-screen flex items-center justify-center bg-surface-50"><Loader2 className="w-10 h-10 text-primary-600 animate-spin"/></div>;

  // --- Login Screen ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-surface-950 flex font-bangla">
        {toasts.map(t => (
          <div key={t.id} className={`fixed top-4 right-4 px-4 py-3 rounded-xl shadow-xl text-white font-bold flex items-center gap-2 z-50 ${t.type === 'error' ? 'bg-danger-600' : 'bg-success-600'}`}>
            {t.msg}
          </div>
        ))}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-700 via-primary-800 to-surface-900 items-center justify-center p-12">
          <div className="text-center text-white">
            <img src={LOGO_URL} alt="Tinghor" className="w-24 h-24 mx-auto mb-8 object-contain animate-fade-in" />
            <h1 className="text-4xl font-bold mb-3">টিনঘর.কম</h1>
            <p className="text-primary-200 text-lg">ব্যবসা পরিচালনা করুন সহজে — পস, ইনভেন্টরি, হিসাব</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card p-8 max-w-sm w-full animate-scale-in">
            <div className="text-center mb-6">
              <img src={LOGO_URL} alt="Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
              <h2 className="text-xl font-bold text-surface-900">স্বাগতম</h2>
              <p className="text-sm text-surface-500 mt-1">অ্যাকাউন্টে লগিন করুন</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1.5">ইমেইল / আইডি</label>
                <input className="input-base w-full" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1.5">পাসওয়ার্ড</label>
                <input type="password" className="input-base w-full" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••••" />
              </div>
              <button onClick={handleLogin} className="btn btn-primary w-full">লগিন</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'admin';

  // --- Sidebar Nav Button ---
  const NavButton = React.memo(({ tab, icon: Icon, label, restricted }: { tab: string; icon: React.ComponentType<{ className?: string }>; label: string; restricted?: boolean }) => {
    if (restricted && !isAdmin) return null;
    return (
      <button
        onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 w-full text-left font-bangla ${
          activeTab === tab
            ? 'bg-white/10 text-white border-l-[3px] border-l-primary-400'
            : 'text-surface-400 hover:text-white hover:bg-white/5 border-l-[3px] border-l-transparent'
        } ${isSidebarCollapsed ? 'justify-center border-l-0' : ''}`}
        title={isSidebarCollapsed ? label : ''}
      >
        <Icon className={`${isSidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
        {!isSidebarCollapsed && <span className="font-semibold text-sm truncate">{label}</span>}
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
        <aside className={`fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-surface-900 to-surface-800 transition-all duration-300 ${
          isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>

          <div className={`h-16 flex items-center border-b border-white/10 ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-6'}`}>
            {!isSidebarCollapsed ? <img src={LOGO_URL} alt="Logo" className="h-7 w-auto object-contain brightness-0 invert" /> : <div className="font-bold text-primary-400 text-xl">TG</div>}
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-surface-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <nav className="p-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-180px)]">
            <NavButton tab="dashboard" icon={LayoutDashboard} label={t('dashboard')} />
            <NavButton tab="pos" icon={ShoppingBag} label={t('pos')} />
            <NavButton tab="purchase" icon={ShoppingCart} label={t('purchase')} />
            <div className="my-2 border-t border-white/10"></div>
            <NavButton tab="inventory" icon={Package} label={t('inventory')} />
            <NavButton tab="ledger" icon={BookOpen} label={t('ledger')} />
            <NavButton tab="history" icon={FileText} label={t('history')} />
            <div className="my-2 border-t border-white/10"></div>
            <NavButton tab="customers" icon={Users} label={t('customers')} />
            <NavButton tab="suppliers" icon={Building2} label={t('suppliers')} />
            <NavButton tab="expenses" icon={Wallet} label={t('expenses')} />

            {isAdmin && (
               <>
               <div className="my-2 border-t border-white/10"></div>
               {!isSidebarCollapsed && <p className="px-3 text-[10px] font-bold text-surface-500 uppercase mb-1 tracking-wider">Admin</p>}
               <NavButton tab="reports" icon={PieChart} label={t('reports')} restricted={true} />
               <NavButton tab="salary" icon={UserCircle} label={t('salary')} restricted={true} />
               <NavButton tab="logs" icon={History} label={t('logs')} restricted={true} />
               <NavButton tab="settings" icon={Settings} label={t('settings')} restricted={true} />
               </>
            )}
          </nav>

          {/* Bottom Actions */}
          <div className="absolute bottom-0 w-full border-t border-white/10 bg-surface-900/50 p-3">
             {!isSidebarCollapsed ? (
                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg mb-2">
                   <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">{currentUser.name?.[0] ?? '?'}</div>
                   <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold text-surface-200 truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-surface-500 capitalize">{currentUser.role}</p>
                   </div>
                   <button onClick={handleLogout} className="text-surface-400 hover:text-danger-400 transition-colors"><LogOut className="w-4 h-4"/></button>
                </div>
             ) : (
                <div className="flex flex-col items-center gap-4 mb-2">
                   <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center font-bold text-white text-xs">{currentUser.name?.[0] ?? '?'}</div>
                   <button onClick={handleLogout} className="text-surface-400 hover:text-danger-400 transition-colors"><LogOut className="w-5 h-5"/></button>
                </div>
             )}

             <button
               onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
               className="w-full flex justify-center py-2 text-surface-500 hover:text-white transition border-t border-white/10"
             >
                {isSidebarCollapsed ? <ChevronRight className="w-5 h-5"/> : <ChevronLeft className="w-5 h-5"/>}
             </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 p-4 lg:p-6 overflow-x-hidden ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <div className="lg:hidden flex justify-between items-center mb-6 card p-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-surface-50 rounded-lg"><Menu className="w-5 h-5 text-surface-600" /></button>
              <img src={LOGO_URL} alt="Logo" className="h-6 w-auto" />
            </div>
            <button onClick={() => setLang(l => l === 'en' ? 'bn' : 'en')} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-50 text-xs font-bold hover:bg-surface-100 transition-colors">
              <Languages className="w-4 h-4 text-primary-600" /> {lang === 'en' ? 'EN' : 'BN'}
            </button>
          </div>

          {/* Dynamic Content */}
          <div className="max-w-[1600px] mx-auto">
             {activeTab === 'dashboard' && <MemoDashboard inventory={inventory} sales={sales} expenses={expenses} />}
             {activeTab === 'pos' && <MemoPOS inventory={inventory} onCompleteSale={handleCompleteSaleWithInventory} settings={settings} sales={sales} />}
             {activeTab === 'purchase' && <MemoPurchase inventory={inventory} suppliers={suppliers} onCompletePurchase={handleCompletePurchaseWithSuppliers} settings={settings} />}
             {activeTab === 'history' && <MemoSalesHistory sales={sales} onUpdateSale={handleUpdateSale} onDeleteSale={handleDeleteSale} inventory={inventory} setInventory={handleInventoryUpdate} settings={settings} />}
             {activeTab === 'inventory' && <MemoInventory inventory={inventory} setInventory={setInventory} settings={settings} setSettings={setSettings} stockLogs={stockLogs} onStockAdd={handleStockEntry} currentUser={currentUser} />}
             {activeTab === 'ledger' && <MemoLedger sales={sales} onUpdateSale={handleUpdateSale} onAddNewSale={handleCompleteSaleWithInventory} onReturnItem={handleReturnItem} />}
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
                     onAddEmployee={(e: Employee) => { setEmployees(prev => [...prev, e]); saveEmployee(e).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); }); }}
                     onAddRecord={(r: SalaryRecord) => {
                       setSalaryRecords(prev => [...prev, r]);
                       saveSalaryRecord(r).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
                       saveActivityLog({ id: crypto.randomUUID(), userId: '', userName: 'System', action: `বেতন - ${r.employeeName}`, details: `৳${r.amount}`, timestamp: Date.now() }).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
                       handleAddExpense({ id: crypto.randomUUID(), reason: `Salary - ${r.employeeName}`, amount: r.amount, category: 'salary', timestamp: r.date });
                     }}
                     onUpdateAttendance={handleUpdateAttendance}
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
