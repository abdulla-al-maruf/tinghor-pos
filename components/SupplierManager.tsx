
import React, { useState } from 'react';
import { Supplier } from '../types';
import { User, Phone, Building2, Plus, Search } from 'lucide-react';
import { generateId } from '../lib/utils';

interface SupplierManagerProps {
  suppliers: Supplier[];
  onAddSupplier: (s: Supplier) => void;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({ suppliers, onAddSupplier }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newSup, setNewSup] = useState({ name: '', phone: '', company: '' });

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.companyName && s.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSave = () => {
    if(!newSup.name) return;
    onAddSupplier({
      id: generateId(),
      name: newSup.name,
      phone: newSup.phone,
      companyName: newSup.company,
      totalPurchase: 0,
      totalDue: 0
    });
    setNewSup({ name: '', phone: '', company: '' });
    setIsAdding(false);
  };

  return (
    <div className="font-bangla space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
         <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600">
               <Building2 className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-2xl font-bold text-slate-800">মহাজন / সাপ্লায়ার তালিকা</h2>
               <p className="text-slate-500">মোট সাপ্লায়ার: {suppliers.length} জন</p>
            </div>
         </div>
         <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1">
               <Search className="absolute left-3 top-3.5 text-slate-400 w-4 h-4" />
               <input 
                  type="text" 
                  placeholder="নাম বা কোম্পানি খুঁজুন..." 
                  className="w-full pl-10 p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
               />
             </div>
             <button onClick={() => setIsAdding(true)} className="bg-purple-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700">
                <Plus className="w-5 h-5"/> নতুন
             </button>
         </div>
       </div>

       {isAdding && (
          <div className="bg-white p-6 rounded-2xl shadow border border-purple-100 animate-fade-in mb-6">
             <h3 className="font-bold text-slate-700 mb-4">নতুন সাপ্লায়ার তথ্য</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input className="p-3 border rounded-lg" placeholder="নাম" value={newSup.name} onChange={e=>setNewSup({...newSup, name: e.target.value})} />
                <input className="p-3 border rounded-lg" placeholder="মোবাইল" value={newSup.phone} onChange={e=>setNewSup({...newSup, phone: e.target.value})} />
                <input className="p-3 border rounded-lg" placeholder="কোম্পানির নাম" value={newSup.company} onChange={e=>setNewSup({...newSup, company: e.target.value})} />
             </div>
             <div className="flex gap-3 mt-4">
                <button onClick={handleSave} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold">সেভ করুন</button>
                <button onClick={() => setIsAdding(false)} className="bg-slate-100 text-slate-600 px-6 py-2 rounded-lg font-bold">বাতিল</button>
             </div>
          </div>
       )}

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(s => (
             <div key={s.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative hover:shadow-md transition">
                <div className="flex items-start gap-4 mb-4">
                   <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center font-bold text-slate-400 border border-slate-100">
                      {s.name[0]}
                   </div>
                   <div>
                      <h3 className="font-bold text-slate-800 text-lg">{s.name}</h3>
                      <p className="text-sm text-slate-500 font-bold">{s.companyName}</p>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Phone className="w-3 h-3"/> {s.phone}</p>
                   </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center">
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">মোট পাওনা (Due)</p>
                      <p className={`text-xl font-bold ${s.totalDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>৳{s.totalDue.toLocaleString()}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase">মোট কেনা</p>
                      <p className="text-slate-700 font-bold">৳{s.totalPurchase.toLocaleString()}</p>
                   </div>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};
