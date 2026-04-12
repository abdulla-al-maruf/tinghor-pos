
import React, { useContext, useState, useMemo } from 'react';
import { ProductGroup, Sale, Expense } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Users, Package, ArrowRight, Filter } from 'lucide-react';
import { LanguageContext } from '../App';

interface DashboardProps {
  inventory: ProductGroup[];
  sales: Sale[];
  expenses: Expense[];
}

type TimeRange = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all_time';

export const Dashboard: React.FC<DashboardProps> = ({ inventory, sales, expenses }) => {
  const { lang } = useContext(LanguageContext);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  // --- Date Filtering Logic (Memoized) ---
  const { start, end } = useMemo(() => {
    const now = new Date();
    const s = new Date();
    const e = new Date();

    if (timeRange === 'today') {
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
    } else if (timeRange === 'yesterday') {
      s.setDate(now.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      e.setDate(now.getDate() - 1);
      e.setHours(23, 59, 59, 999);
    } else if (timeRange === 'this_week') {
      s.setDate(now.getDate() - 7);
      s.setHours(0,0,0,0);
    } else if (timeRange === 'this_month') {
      s.setDate(1);
      s.setHours(0,0,0,0);
    } else {
      return { start: 0, end: 9999999999999 };
    }

    return { start: s.getTime(), end: e.getTime() };
  }, [timeRange]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => s.timestamp >= start && s.timestamp <= end);
  }, [sales, start, end]);
  
  // Calculate Totals based on filtered sales (Memoized)
  const revenue = useMemo(() => filteredSales.reduce((sum, s) => sum + s.finalAmount, 0), [filteredSales]);
  
  const collections = useMemo(() => {
    return sales.reduce((sum, s) => {
      const periodPayments = s.paymentHistory.filter(p => p.date >= start && p.date <= end);
      return sum + periodPayments.reduce((pSum, p) => pSum + p.amount, 0);
    }, 0);
  }, [sales, start, end]);

  const dueGenerated = useMemo(() => filteredSales.reduce((sum, s) => sum + s.dueAmount, 0), [filteredSales]);

  // Stock Chart Data (Memoized)
  const barData = useMemo(() => {
    const stockByBrand = inventory.reduce((acc, group) => {
      const groupStock = group.variants.reduce((vSum, variant) => vSum + variant.stockPieces, 0);
      acc[group.brand] = (acc[group.brand] || 0) + groupStock;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(stockByBrand).map(([name, value]) => ({ name, value }));
  }, [inventory]);

  const totalStock = useMemo(() => {
     return inventory.reduce((sum, g) => sum + g.variants.reduce((vSum, v) => vSum + v.stockPieces, 0), 0);
  }, [inventory]);

  const timeLabels: Record<TimeRange, string> = {
    today: 'আজকের',
    yesterday: 'গতকালের',
    this_week: 'এই সপ্তাহের (৭ দিন)',
    this_month: 'এই মাসের',
    all_time: 'সর্বমোট'
  };

  return (
    <div className="space-y-6 animate-fade-in font-bangla">
      
      {/* Date Filter Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
               <Calendar className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-xl font-bold text-slate-800">বিক্রয় সারাংশ</h2>
               <p className="text-xs text-slate-500 font-bold">{timeLabels[timeRange]} রিপোর্ট দেখছেন</p>
            </div>
         </div>
         
         <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['today', 'yesterday', 'this_week', 'this_month', 'all_time'] as TimeRange[]).map(range => (
               <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${timeRange === range ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                  {range === 'today' ? 'আজ' : range === 'yesterday' ? 'কাল' : range === 'this_week' ? 'সপ্তাহ' : range === 'this_month' ? 'মাস' : 'সব'}
               </button>
            ))}
         </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 text-white relative overflow-hidden">
            <div className="absolute -right-6 -top-6 bg-white/10 w-32 h-32 rounded-full blur-2xl"></div>
            <p className="font-bold text-indigo-100 text-sm uppercase mb-1">মোট বিক্রি (ইনভয়েস)</p>
            <h3 className="text-4xl font-bold">৳{revenue.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-indigo-200 text-xs font-bold bg-indigo-700/50 inline-flex px-3 py-1 rounded-lg">
               <Package className="w-4 h-4" /> {filteredSales.length} টি অর্ডার
            </div>
         </div>
         <div className="bg-emerald-500 p-6 rounded-2xl shadow-lg shadow-emerald-200 text-white relative overflow-hidden">
            <div className="absolute -right-6 -top-6 bg-white/10 w-32 h-32 rounded-full blur-2xl"></div>
            <p className="font-bold text-emerald-100 text-sm uppercase mb-1">ক্যাশ কালেকশন (জমা)</p>
            <h3 className="text-4xl font-bold">৳{collections.toLocaleString()}</h3>
            <p className="text-xs text-emerald-100 mt-2 opacity-80">এই সময়ের মধ্যে যত টাকা ক্যাশ এসেছে</p>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <p className="font-bold text-slate-400 text-sm uppercase mb-1">বাকি (Due Generated)</p>
            <h3 className="text-4xl font-bold text-slate-800">৳{dueGenerated.toLocaleString()}</h3>
            <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
               <ArrowRight className="w-3 h-3" /> মার্কেটে টাকা আটকে আছে
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
         
         {/* Customer List (Based on Filter) */}
         <div className="md:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
               <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <Users className="w-5 h-5 text-slate-600" /> কাস্টমার তালিকা ({timeLabels[timeRange]})
                  </h3>
               </div>
               <div className="flex-1 overflow-auto p-0">
                  <table className="w-full text-left border-collapse">
                     <thead className="text-xs font-bold text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                           <th className="p-4 border-b">তারিখ</th>
                           <th className="p-4 border-b">নাম</th>
                           <th className="p-4 border-b text-right">টোটাল বিল</th>
                           <th className="p-4 border-b text-right">অবস্থা</th>
                        </tr>
                     </thead>
                     <tbody className="text-sm">
                        {[...filteredSales].sort((a,b)=>b.timestamp - a.timestamp).slice(0, 50).map((sale) => (
                           <tr key={sale.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
                              <td className="p-4 text-slate-500 font-mono text-xs">
                                 {new Date(sale.timestamp).toLocaleDateString('bn-BD')}
                                 <br/>
                                 {new Date(sale.timestamp).toLocaleTimeString('bn-BD', {hour: '2-digit', minute:'2-digit'})}
                              </td>
                              <td className="p-4 font-bold text-slate-700">
                                 {sale.customerName}
                                 <span className="block text-[10px] text-slate-400 font-normal">{sale.items.length} আইটেম</span>
                              </td>
                              <td className="p-4 text-right font-bold text-slate-800">
                                 ৳{sale.finalAmount.toLocaleString()}
                              </td>
                              <td className="p-4 text-right">
                                 <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                    sale.deliveryStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                 }`}>
                                    {sale.deliveryStatus === 'pending' ? 'মাল বাকি' : 'ডেলিভারড'}
                                 </span>
                              </td>
                           </tr>
                        ))}
                        {filteredSales.length === 0 && (
                           <tr>
                              <td colSpan={4} className="p-10 text-center text-slate-400">
                                 <Filter className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                 এই সময়ের মধ্যে কোন বিক্রি নেই
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Chart & Quick Stock */}
         <div className="md:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="text-lg font-semibold mb-4 text-slate-700">ব্র্যান্ড স্টক চার্ট</h3>
               <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="name" fontSize={12} />
                     <YAxis fontSize={12} />
                     <Tooltip />
                     <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
               <div className="flex items-center gap-3 mb-4">
                  <Package className="w-8 h-8 text-emerald-400" />
                  <div>
                     <p className="text-slate-400 text-xs font-bold uppercase">সর্বমোট বর্তমান স্টক</p>
                     <h3 className="text-3xl font-bold">{totalStock} <span className="text-lg font-normal text-slate-400">পিস</span></h3>
                  </div>
               </div>
               <div className="h-1 bg-slate-700 rounded-full w-full mb-2">
                  <div className="h-1 bg-emerald-500 rounded-full" style={{width: '70%'}}></div>
               </div>
               <p className="text-xs text-slate-400">স্টক আপডেট রিয়েল-টাইম</p>
            </div>
         </div>
      </div>
    </div>
  );
};
