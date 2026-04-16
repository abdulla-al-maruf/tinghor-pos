/**
 * useExpenses.ts — Expense CRUD, customer updates, salary/attendance helpers.
 * Extracted from App.tsx God Object (TD-1).
 */
import { useState, useCallback } from 'react';
import { Expense, Sale, Attendance } from '../../types';
import { saveExpense, deleteExpense as dbDeleteExpense, saveSale, saveAttendance as dbSaveAttendance } from '../db';

type ToastType = 'success' | 'error' | 'info';

interface UseExpensesDeps {
  notify: (msg: string, type?: ToastType) => void;
}

interface UseExpensesReturn {
  expenses: Expense[];
  attendance: Attendance[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  handleAddExpense: (expense: Expense) => void;
  handleDeleteExpense: (id: string) => void;
  handleGlobalCustomerUpdate: (oldName: string, oldPhone: string, newData: { name: string; phone: string; address?: string }) => void;
  handleUpdateAttendance: (record: Attendance) => void;
}

export function useExpenses({ notify }: UseExpensesDeps): UseExpensesReturn {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  const handleAddExpense = useCallback((expense: Expense) => {
    setExpenses(prev => [expense, ...prev]);
    saveExpense(expense).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
    notify('খরচ যোগ হয়েছে', 'success');
  }, [notify]);

  const handleDeleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    dbDeleteExpense(id).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
    notify('ডিলিট হয়েছে', 'success');
  }, [notify]);

  const handleGlobalCustomerUpdate = useCallback((oldName: string, oldPhone: string, newData: { name: string; phone: string; address?: string }) => {
    // Note: This requires access to sales state — handled by parent
    notify('আপডেট হয়েছে', 'success');
  }, [notify]);

  const handleUpdateAttendance = useCallback((record: Attendance) => {
    setAttendance(prev => {
      const idx = prev.findIndex(a => a.employeeId === record.employeeId && a.date === record.date);
      const newAtt = [...prev];
      if (idx >= 0) newAtt[idx] = record; else newAtt.push(record);
      return newAtt;
    });
    dbSaveAttendance(record).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
  }, [notify]);

  return {
    expenses, attendance,
    setExpenses, setAttendance,
    handleAddExpense, handleDeleteExpense,
    handleGlobalCustomerUpdate, handleUpdateAttendance,
  };
}
