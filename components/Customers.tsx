
import React, { useState, useMemo } from 'react';
import { Sale } from '../types';
import { User, Phone, MapPin, Search, Edit, X, Save } from 'lucide-react';

interface CustomersProps {
  sales: Sale[];
  onUpdateCustomer?: (oldName: string, oldPhone: string, newData: { name: string, phone: string, address: string }) => void;
}

interface CustomerData {
  name: string;
  phone: string;
  address?: string;
  totalPurchased: number;
  totalDue: number;
  lastVisit: number;
}

export const Customers: React.FC<CustomersProps> = ({ sales, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(20);
  
  // Edit State
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '' });

  // Optimized Derived Customers Data using useMemo
  const customers = useMemo(() => {
    const customersMap = new Map<string, CustomerData>();

    sales.forEach(sale => {
      // Unique key combination
      const key = `${sale.customerName}-${sale.customerPhone}`;
      const existing = customersMap.get(key);

      if (existing) {
        customersMap.set(key, {
          ...existing,
          totalPurchased: existing.totalPurchased + sale.finalAmount,
          totalDue: existing.totalDue + sale.dueAmount,
          lastVisit: Math.max(existing.lastVisit, sale.timestamp),
          // Update address if available and newer
          address: sale.customerAddress || existing.address
        });
      } else {
        customersMap.set(key, {
          name: sale.customerName,
          phone: sale.customerPhone,
          address: sale.customerAddress,
          totalPurchased: sale.finalAmount,
          totalDue: sale.dueAmount,
          lastVisit: sale.timestamp
        });
      }
    });

    return Array.from(customersMap.values());
  }, [sales]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
       c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       c.phone.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  const visibleCustomers = filteredCustomers.slice(0, displayLimit);

  const startEdit = (c: CustomerData) => {
    setEditingCustomer(c);
    setEditForm({ name: c.name, phone: c.phone, address: c.address || '' });
  };

  const handleSaveEdit = () => {
    if (!editingCustomer || !onUpdateCustomer) return;
    if (!editForm.name) {
      alert('নাম খালি রাখা যাবে না');
      return;
    }
    
    // Call the parent update function
    onUpdateCustomer(editingCustomer.name, editingCustomer.phone, {
       name: editForm.name,
       phone: editForm.phone,
       address: editForm.address
    });
    
    setEditingCustomer(null);
  };

  return (
    <div className="font-bangla space-y-6 animate-fade-in">
       
       {/* Edit Modal */}
       {editingCustomer && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
               <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Edit className="w-5 h-5 text-blue-600" /> কাস্টমার এডিট
                  </h3>
                  <button onClick={() => setEditingCustomer(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X className="w-5 h-5 text-slate-500"/></button>
               </div>
               <div className="p-6 space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">নাম</label>
                     <input className="w-full p-3 rounded-xl border border-slate-300" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">মোবাইল</label>
                     <input className="w-full p-3 rounded-xl border border-slate-300" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">ঠিকানা</label>
                     <input className="w-full p-3 rounded-xl border border-slate-300" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                  </div>
                  <button onClick={handleSaveEdit} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2">
                     <Save className="w-4 h-4" /> সেভ করুন
                  </button>
               </div>
            </div>
         </div>
       )}

       <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
         <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
               <User className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-2xl font-bold text-slate-800">কাস্টমার তালিকা</h2>
               <p className="text-slate-500">মোট কাস্টমার: {customers.length} জন</p>
            </div>
         </div>
         <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
            <input 
               type="text" 
               placeholder="নাম বা মোবাইল দিয়ে খুঁজুন..." 
               className="w-full pl-12 p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
               value={searchTerm}
               onChange={e => { setSearchTerm(e.target.value); setDisplayLimit(20); }}
            />
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCustomers.map((c, idx) => (
             <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition relative group">
                <button 
                   onClick={() => startEdit(c)}
                   className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg opacity-0 group-hover:opacity-100 transition"
                >
                   <Edit className="w-4 h-4" />
                </button>

                <div className="flex justify-between items-start mb-4">
                   <div>
                      <h3 className="text-xl font-bold text-slate-800">{c.name}</h3>
                      <div className="flex items-center gap-1 text-slate-500 mt-1 font-sans">
                         <Phone className="w-3 h-3" /> {c.phone}
                      </div>
                      {c.address && (
                        <div className="flex items-center gap-1 text-slate-500 mt-1 text-sm">
                           <MapPin className="w-3 h-3" /> {c.address}
                        </div>
                      )}
                   </div>
                   <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 font-bold border border-slate-100">
                      {c.name[0]}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl mb-4">
                   <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">মোট কেনাকাটা</p>
                      <p className="text-lg font-bold text-slate-800">৳{c.totalPurchased.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">বর্তমান বাকি</p>
                      <p className={`text-lg font-bold ${c.totalDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                         ৳{c.totalDue.toLocaleString()}
                      </p>
                   </div>
                </div>

                <div className="text-right text-xs text-slate-400">
                   শেষ ভিসিট: {new Date(c.lastVisit).toLocaleDateString('bn-BD')}
                </div>
             </div>
          ))}
       </div>
       
       {visibleCustomers.length < filteredCustomers.length && (
          <div className="flex justify-center mt-6">
             <button 
                onClick={() => setDisplayLimit(prev => prev + 20)}
                className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full font-bold shadow-sm hover:bg-slate-50"
             >
                আরও লোড করুন...
             </button>
          </div>
       )}

       {filteredCustomers.length === 0 && (
          <div className="py-20 text-center">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <User className="w-8 h-8" />
             </div>
             <p className="text-slate-500 font-medium">কোনো কাস্টমার পাওয়া যায়নি</p>
          </div>
       )}
    </div>
  );
};
