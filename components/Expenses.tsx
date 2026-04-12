import React, { useState } from 'react';
import { Expense } from '../types';
import { Wallet, Plus, Trash2, TrendingDown, Calendar } from 'lucide-react';
import { generateId } from '../lib/utils';

interface ExpensesProps {
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

export const Expenses: React.FC<ExpensesProps> = ({ expenses, onAddExpense, onDeleteExpense }) => {
  const [newExpense, setNewExpense] = useState({
    reason: '',
    amount: '',
    category: 'other' as Expense['category']
  });
  
  // Date Filter State
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewAll, setViewAll] = useState(false);

  const handleAdd = () => {
    if (!newExpense.reason || !newExpense.amount) return;
    const expense: Expense = {
      id: generateId(),
      reason: newExpense.reason,
      amount: Number(newExpense.amount),
      category: newExpense.category,
      timestamp: Date.now() // Uses current time for new entry
    };
    onAddExpense(expense);
    setNewExpense({ reason: '', amount: '', category: 'other' });
  };

  const categories = {
    transport: 'গাড়ি ভাড়া / পরিবহন',
    food: 'নাস্তা / আপ্যায়ন',
    utility: 'বিল (বিদ্যুৎ/নেট)',
    salary: 'লেবার / বেতন',
    other: 'অন্যান্য'
  };

  // Filter Logic
  const filteredExpenses = expenses.filter(e => {
    if (viewAll) return true;
    const expenseDate = new Date(e.timestamp).toISOString().split('T')[0];
    return expenseDate === filterDate;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => b.timestamp - a.timestamp);

  const inputStyle = "w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all shadow-sm font-medium";

  return (
    <div className="font-bangla space-y-6">
       
       <div className="flex flex-col md:flex-row gap-6">
          {/* Add Expense Form */}
          <div className="md:w-1/3 space-y-4">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                   <Plus className="w-5 h-5 text-red-600" /> নতুন খরচ যোগ করুন
                </h3>
                
                <div className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">খরচের বিবরণ</label>
                      <input 
                        type="text" 
                        className={inputStyle} 
                        value={newExpense.reason} 
                        onChange={e => setNewExpense({...newExpense, reason: e.target.value})}
                        placeholder="কি বাবদ খরচ?"
                      />
                   </div>
                   
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">ক্যাটাগরি</label>
                      <select 
                        className={inputStyle}
                        value={newExpense.category}
                        onChange={e => setNewExpense({...newExpense, category: e.target.value as any})}
                      >
                         {Object.entries(categories).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                         ))}
                      </select>
                   </div>

                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">টাকার পরিমাণ</label>
                      <input 
                        type="number" 
                        className={inputStyle} 
                        value={newExpense.amount} 
                        onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                        placeholder="0.00"
                      />
                   </div>

                   <button 
                     onClick={handleAdd}
                     className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-200"
                   >
                     খরচ সেভ করুন
                   </button>
                </div>
             </div>
          </div>

          {/* List */}
          <div className="md:w-2/3">
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                {/* Header with Date Filter */}
                <div className="p-5 border-b flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-4">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-slate-600" /> খরচের খাতা
                   </h3>
                   
                   <div className="flex items-center gap-2">
                      {!viewAll && (
                         <div className="relative">
                           <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-500"/>
                           <input 
                              type="date" 
                              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 bg-white"
                              value={filterDate}
                              onChange={e => setFilterDate(e.target.value)}
                           />
                         </div>
                      )}
                      <button 
                        onClick={() => setViewAll(!viewAll)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${viewAll ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}
                      >
                         {viewAll ? 'তারিখ বাছুন' : 'সব দেখুন'}
                      </button>
                   </div>

                   <div className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full font-bold text-sm">
                      মোট: ৳{filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                   {sortedExpenses.map(expense => (
                      <div key={expense.id} className="p-4 bg-white border border-slate-100 rounded-xl flex justify-between items-center group hover:border-red-200 hover:shadow-sm transition">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                               <TrendingDown className="w-5 h-5" />
                            </div>
                            <div>
                               <p className="font-bold text-slate-800">{expense.reason}</p>
                               <div className="flex gap-2 text-xs text-slate-500 mt-0.5">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded">{categories[expense.category]}</span>
                                  <span>• {new Date(expense.timestamp).toLocaleDateString('bn-BD', {dateStyle: 'medium', timeStyle: 'short'})}</span>
                               </div>
                            </div>
                         </div>
                         <div className="text-right flex items-center gap-4">
                            <span className="font-bold text-red-600 text-lg">৳{expense.amount.toLocaleString()}</span>
                            <button 
                              onClick={() => onDeleteExpense(expense.id)}
                              className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                            >
                               <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </div>
                   ))}

                   {filteredExpenses.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                         <Wallet className="w-12 h-12 mb-3 opacity-20" />
                         <p>এই তারিখে কোনো খরচ নেই</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};