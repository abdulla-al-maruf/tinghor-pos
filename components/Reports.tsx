import React from 'react';
import { Sale, Expense } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle } from 'lucide-react';

interface ReportsProps {
  sales: Sale[];
  expenses: Expense[];
}

export const Reports: React.FC<ReportsProps> = ({ sales, expenses }) => {
  // --- Calculation Logic ---
  
  // Total Revenue (Sales Final Amount)
  const totalRevenue = sales.reduce((sum, s) => sum + s.finalAmount, 0);

  // Total COGS (Cost of Goods Sold)
  // Logic: Sum of (Item Quantity * Item Cost Price stored at sale time)
  const totalCOGS = sales.reduce((saleSum, sale) => {
    const saleCost = sale.items.reduce((itemSum, item) => {
      // Fallback: if buyPriceUnit is missing (old data), assume 0 (which inflates profit, but safe for crash)
      const cost = item.buyPriceUnit || 0; 
      return itemSum + (cost * item.quantityPieces);
    }, 0);
    return saleSum + saleCost;
  }, 0);

  // Total Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Net Profit
  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  return (
    <div className="font-bangla space-y-8 animate-fade-in">
       
       <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500 opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2 relative z-10">
             <TrendingUp className="w-8 h-8 text-emerald-400" />
             লাভ-ক্ষতি রিপোর্ট (Profit & Loss)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
             <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <p className="text-slate-400 font-bold text-sm mb-2 uppercase">মোট বিক্রি (Revenue)</p>
                <h3 className="text-3xl font-bold text-white">৳{totalRevenue.toLocaleString()}</h3>
             </div>
             <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <p className="text-slate-400 font-bold text-sm mb-2 uppercase">পণ্যের কেনা দাম (COGS)</p>
                <h3 className="text-3xl font-bold text-amber-400">(-) ৳{totalCOGS.toLocaleString()}</h3>
                <p className="text-xs text-slate-500 mt-2">বিক্রিত মালের কেনা খরচ</p>
             </div>
             <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <p className="text-slate-400 font-bold text-sm mb-2 uppercase">দোকানের খরচ (Expenses)</p>
                <h3 className="text-3xl font-bold text-red-400">(-) ৳{totalExpenses.toLocaleString()}</h3>
             </div>
             <div className="bg-emerald-500/20 p-6 rounded-2xl border border-emerald-500/30">
                <p className="text-emerald-300 font-bold text-sm mb-2 uppercase">নিট লাভ (Net Profit)</p>
                <h3 className={`text-4xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                   {netProfit >= 0 ? '+' : ''}৳{netProfit.toLocaleString()}
                </h3>
             </div>
          </div>
       </div>

       {/* Breakdown List */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b flex items-center gap-2">
             <DollarSign className="w-5 h-5 text-slate-600" />
             <h3 className="font-bold text-lg text-slate-800">মেমো অনুযায়ী লাভ বিশ্লেষণ</h3>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                   <tr>
                      <th className="p-4">তারিখ</th>
                      <th className="p-4">কাস্টমার</th>
                      <th className="p-4 text-right">বিক্রয় মূল্য</th>
                      <th className="p-4 text-right">কেনা দাম</th>
                      <th className="p-4 text-right">ডিসকাউন্ট</th>
                      <th className="p-4 text-right">লাভ</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                   {[...sales].sort((a,b) => b.timestamp - a.timestamp).map(sale => {
                      // Calculate individual sale metrics
                      const saleCost = sale.items.reduce((sum, item) => sum + ((item.buyPriceUnit||0) * item.quantityPieces), 0);
                      const saleProfit = sale.finalAmount - saleCost; // Final Amount already has discount deducted?
                      // Wait: finalAmount = subTotal - discount.
                      // So Profit = (SubTotal - Discount) - Cost. Correct.
                      
                      return (
                         <tr key={sale.id} className="hover:bg-slate-50 transition">
                            <td className="p-4">{new Date(sale.timestamp).toLocaleDateString('bn-BD')}</td>
                            <td className="p-4">
                               <div className="font-bold text-slate-800">{sale.customerName}</div>
                               <div className="text-xs text-slate-400">{sale.items.length} items</div>
                            </td>
                            <td className="p-4 text-right text-slate-800">৳{sale.finalAmount.toLocaleString()}</td>
                            <td className="p-4 text-right text-slate-500">৳{saleCost.toLocaleString()}</td>
                            <td className="p-4 text-right text-red-400">৳{sale.discount.toLocaleString()}</td>
                            <td className="p-4 text-right">
                               <span className={`font-bold px-2 py-1 rounded ${saleProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                  ৳{saleProfit.toLocaleString()}
                               </span>
                            </td>
                         </tr>
                      );
                   })}
                   {sales.length === 0 && (
                      <tr>
                         <td colSpan={6} className="p-10 text-center text-slate-400">কোনো ডাটা নেই</td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};