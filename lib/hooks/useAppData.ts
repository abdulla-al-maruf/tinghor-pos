/**
 * useAppData.ts — Load all data from Supabase, background sync.
 * Extracted from App.tsx God Object (TD-1).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ProductGroup, Sale, StoreSettings, Expense, User, ActivityLog,
  Employee, SalaryRecord, StockLog, Supplier, Purchase as PurchaseType, Attendance,
} from '../../types';
import {
  loadSettings, saveSettings,
  loadUsers, saveUsers,
  loadInventory, saveInventory,
  loadSales,
  loadPurchases, loadSuppliers, saveSupplier,
  loadExpenses,
  loadEmployees, loadSalaryRecords, loadAttendance, loadStockMovements,
  loadActivityLogs,
} from '../db';

interface UseAppDataDeps {
  currentUser: User | null;
  isDataLoaded: boolean;
  onDataLoaded: () => void;
}

interface UseAppDataReturn {
  settings: StoreSettings;
  users: User[];
  inventory: ProductGroup[];
  sales: Sale[];
  expenses: Expense[];
  employees: Employee[];
  salaryRecords: SalaryRecord[];
  attendance: Attendance[];
  logs: ActivityLog[];
  suppliers: Supplier[];
  purchases: PurchaseType[];
  stockLogs: StockLog[];
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setInventory: React.Dispatch<React.SetStateAction<ProductGroup[]>>;
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setSalaryRecords: React.Dispatch<React.SetStateAction<SalaryRecord[]>>;
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  setLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  setPurchases: React.Dispatch<React.SetStateAction<PurchaseType[]>>;
  setStockLogs: React.Dispatch<React.SetStateAction<StockLog[]>>;
}

export function useAppData({ currentUser, isDataLoaded, onDataLoaded }: UseAppDataDeps): UseAppDataReturn {
  const [settings, setSettings] = useState<StoreSettings>({
    shopName: 'টিনঘর.কম', shopPhone: '', shopAddress: '', brands: [], colors: [], thicknesses: [], productTypes: [], customFields: [], nextInvoiceId: 1001,
  });
  const [users, setUsers] = useState<User[]>([]);
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

  // Data Loading
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function loadAllData() {
      const results = await Promise.allSettled([
        loadSettings(), loadUsers(), loadInventory(), loadSales(),
        loadPurchases(), loadSuppliers(), loadExpenses(),
        loadEmployees(), loadSalaryRecords(), loadAttendance(),
        loadStockMovements(), loadActivityLogs(),
      ]);
      const [
        settingsRes, usersRes, inventoryRes, salesRes,
        purchasesRes, suppliersRes, expensesRes,
        employeesRes, salaryRes, attendanceRes, stockLogsRes, logsRes,
      ] = results;

      if (cancelled) return;

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
      if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value);
      if (stockLogsRes.status === 'fulfilled') setStockLogs(stockLogsRes.value);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value);

      onDataLoaded();
    }

    loadAllData();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Background Sync (debounced)
  const syncTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceSync = useCallback((key: string, fn: () => Promise<void>) => {
    if (syncTimeout.current[key]) clearTimeout(syncTimeout.current[key]);
    syncTimeout.current[key] = setTimeout(() => fn().catch(err => console.error('Sync error:', err)), 1500);
  }, []);

  useEffect(() => { if (isDataLoaded) debounceSync('settings', () => saveSettings(settings)); }, [settings, isDataLoaded, debounceSync]);
  useEffect(() => { if (isDataLoaded) debounceSync('users', () => saveUsers(users)); }, [users, isDataLoaded, debounceSync]);
  useEffect(() => { if (isDataLoaded) debounceSync('suppliers', () => Promise.all(suppliers.map(saveSupplier)).then(() => {})); }, [suppliers, isDataLoaded, debounceSync]);

  return {
    settings, users, inventory, sales, expenses, employees, salaryRecords,
    attendance, logs, suppliers, purchases, stockLogs,
    setSettings, setUsers, setInventory, setSales, setExpenses,
    setEmployees, setSalaryRecords, setAttendance, setLogs,
    setSuppliers, setPurchases, setStockLogs,
  };
}
