
import React, { useState, useMemo } from 'react';
import { Sale, CartItem } from '../types';
import { Phone, FileText, PlusCircle, History, CheckCircle, Plus, X, Truck, StickyNote, Edit, MapPin, Save, User, Trash, AlertTriangle, RotateCcw, Calendar, Search, ArrowDown } from 'lucide-react';
import { generateId } from '../lib/utils';

interface LedgerProps {
  sales: Sale[];
  salesById?: Record<string, Sale>; // Optional indexed map for O(1) lookups
  onUpdateSale: (sale: Sale) => void;
  onReturnItem: (saleId: string, itemIndex: number, returnQty: number) => void;
  onAddNewSale?: (sale: Sale) => void; 
}

export const Ledger: React.FC<LedgerProps> = ({ sales, salesById, onUpdateSale, onReturnItem, onAddNewSale }) => {
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // Filter State
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // Memo or Name search
  const [displayLimit, setDisplayLimit] = useState(20);

  // Manual Entry State
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    name: '',
    phone: '',
    address: '',
    amount: '',
    note: ''
  });

  // Edit Customer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    note: ''
  });

  // Return Modal State
  const [returnModal, setReturnModal] = useState<{
    isOpen: boolean;
    sale: Sale | null;
    itemIndex: number | null;
    item: CartItem | null;
    returnQty: string;
  }>({ isOpen: false, sale: null, itemIndex: null, item: null, returnQty: '' });

  // Optimized Filter Logic
  const filteredLedgerSales = useMemo(() => {
    let ledgerSales = [...sales].sort((a, b) => b.timestamp - a.timestamp);
    
    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       ledgerSales = ledgerSales.filter(s => 
          (s.invoiceId && s.invoiceId.toString().includes(q)) ||
          s.customerName.toLowerCase().includes(q) ||
          s.customerPhone.includes(q)
       );
    } else if (showTodayOnly) {
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const todayEnd = new Date();
      todayEnd.setHours(23,59,59,999);
      ledgerSales = ledgerSales.filter(s => s.timestamp >= todayStart.getTime() && s.timestamp <= todayEnd.getTime());
    } else {
      ledgerSales = ledgerSales.filter(s => {
        // Rule 1: Currently has Due or Advance
        if (Math.abs(s.dueAmount) > 1) return true; 

        // Rule 2: Delivery Pending
        if (s.deliveryStatus === 'pending') return true;

        // Rule 3: History Check - Was it originally Credit?
        const initialPayment = s.paymentHistory && s.paymentHistory.length > 0 ? s.paymentHistory[0].amount : 0;
        
        if (s.finalAmount - initialPayment > 5) { 
           return true;
        }
        return false;
      });
    }
    return ledgerSales;
  }, [sales, searchQuery, showTodayOnly]);

  const displaySales = filteredLedgerSales.slice(0, displayLimit);

  const handleAddPayment = () => {
    if (!selectedSaleId || !paymentAmount) return;
    
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    // Use indexed map for O(1) lookup if available, otherwise fall back to O(n) find
    const sale = salesById ? salesById[selectedSaleId] : sales.find(s => s.id === selectedSaleId);
    if (!sale) return;

    // We allow payment even if due is 0 (it becomes advance/negative due)
    const updatedSale: Sale = {
      ...sale,
      paidAmount: sale.paidAmount + amount,
      dueAmount: sale.dueAmount - amount,
      paymentHistory: [
        ...(sale.paymentHistory || []),
        { amount, date: Date.now(), note: 'Collection' }
      ]
    };

    onUpdateSale(updatedSale);
    setPaymentAmount('');
    setSelectedSaleId(null);
  };

  const handleCreateOldDue = () => {
    if (!manualEntry.name || !manualEntry.amount) {
      alert('নাম এবং টাকার পরিমাণ আবশ্যক');
      return;
    }
    const amount = Number(manualEntry.amount);
    const oldDueSale: Sale = {
      id: generateId(),
      invoiceId: 'OLD',
      customerName: manualEntry.name,
      customerPhone: manualEntry.phone,
      customerAddress: manualEntry.address,
      items: [{
        groupId: 'manual',
        variantId: 'manual',
        name: 'পূর্বের বকেয়া',
        lengthFeet: 0,
        quantityPieces: 1,
        formattedQty: '1',
        priceUnit: amount,
        buyPriceUnit: 0, 
        subtotal: amount,
        unitType: 'fixed'
      }],
      subTotal: amount,
      discount: 0,
      finalAmount: amount,
      paidAmount: 0,
      dueAmount: amount,
      paymentHistory: [],
      timestamp: Date.now(),
      deliveryStatus: 'delivered',
      soldBy: 'Admin',
      note: manualEntry.note || 'Manually added'
    };

    if (onAddNewSale) onAddNewSale(oldDueSale);
    setIsManualEntryOpen(false);
    setManualEntry({ name: '', phone: '', address: '', amount: '', note: '' });
  };
  
  const handleEditClick = (sale: Sale) => {
    setEditFormData({
      id: sale.id,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      customerAddress: sale.customerAddress || '',
      note: sale.note || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveChanges = () => {
    // Use indexed map for O(1) lookup if available, otherwise fall back to O(n) find
    const sale = salesById ? salesById[editFormData.id] : sales.find(s => s.id === editFormData.id);
    if (!sale) return;
    onUpdateSale({
      ...sale,
      customerName: editFormData.customerName,
      customerPhone: editFormData.customerPhone,
      customerAddress: editFormData.customerAddress,
      note: editFormData.note
    });
    setIsEditModalOpen(false);
  };

  const toggleDeliveryStatus = (sale: Sale) => {
    const newStatus = sale.deliveryStatus === 'pending' ? 'delivered' : 'pending';
    if(confirm(`এই অর্ডারের মাল কি ${newStatus === 'delivered' ? 'কাস্টমারকে বুঝিয়ে দেওয়া হয়েছে?' : 'এখনো দোকানে আছে (Pending)?'}`)) {
       onUpdateSale({ ...sale, deliveryStatus: newStatus });
    }
  };

  const openReturnModal = (sale: Sale, itemIndex: number) => {
    if (itemIndex < 0 || itemIndex >= sale.items.length) return;
    const item = sale.items[itemIndex];
    setReturnModal({
      isOpen: true,
      sale,
      itemIndex,
      item,
      returnQty: ''
    });
  };

  const confirmReturn = () => {
    const { sale, itemIndex, returnQty, item } = returnModal;
    if (!sale || itemIndex === null || !item || !returnQty) return;

    const qty = Number(returnQty);
    if (qty <= 0) {
      alert("পরিমাণ সঠিক দিন");
      return;
    }
    if (qty > item.quantityPieces) {
      alert("ক্রয়কৃত পরিমাণের চেয়ে বেশি ফেরত নেওয়া যাবে না!");
      return;
    }

    if (confirm(`${qty} পিস মাল ফেরত এবং স্টক আপডেট করতে চান?`)) {
      onReturnItem(sale.id, itemIndex, qty);
      setReturnModal({ isOpen: false, sale: null, itemIndex: null, item: null, returnQty: '' });
    }
  };

  const renderItemName = (name: string) => {
     if (!name.includes('|')) return <span className="font-medium text-slate-800">{name}</span>;
     const parts = name.split('|').map(s => s.trim());
     return (
        <div className="flex flex-col items-start gap-0.5">
           <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded uppercase">{parts[0]}</span>
              <span className="text-sm font-bold text-blue-700">{parts[1]}</span>
           </div>
           <div className="text-xs text-slate-500 flex gap-1 items-center">
              {parts[2] && <span>{parts[2]}</span>}
              {parts[3] && <span className="font-bold bg-yellow-100 text-slate-800 px-1 rounded">{parts[3]}</span>}
           </div>
        </div>
     );
  };

  const inputStyle = "flex-1 p-3 rounded-lg border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-slate-800";
  const modalInputStyle = "w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium";

  return (
    <div className="space-y-6 font-bangla animate-fade-in">
      
      {/* Return Modal */}
      {returnModal.isOpen && returnModal.item && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[130] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-5 bg-red-50 border-b flex justify-between items-center">
                 <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                   <RotateCcw className="w-5 h-5" /> মাল ফেরত (Return)
                 </h3>
                 <button onClick={() => setReturnModal({...returnModal, isOpen: false})}><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4">
                 <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                    <p className="font-bold">{returnModal.item.name}</p>
                    <p>কিনেছিল: {returnModal.item.quantityPieces} পিস</p>
                    <p>দর: ৳{returnModal.item.priceUnit}/unit</p>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">কত পিস ফেরত?</label>
                    <input 
                      type="number" 
                      className="w-full p-3 rounded-xl border border-red-300 focus:ring-red-500 font-bold text-xl text-red-600" 
                      value={returnModal.returnQty} 
                      onChange={e => setReturnModal({...returnModal, returnQty: e.target.value})} 
                      autoFocus
                    />
                 </div>
                 
                 {returnModal.returnQty && (
                   <div className="text-center">
                      <p className="text-xs text-slate-400">ফেরত বাবদ টাকা</p>
                      <p className="text-xl font-bold text-slate-800">
                        ৳{Math.round((returnModal.item.subtotal / returnModal.item.quantityPieces) * Number(returnModal.returnQty)).toLocaleString()}
                      </p>
                   </div>
                 )}

                 <button onClick={confirmReturn} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg">
                    কনফার্ম করুন (স্টক বাড়বে)
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                   <Edit className="w-5 h-5 text-blue-600" /> তথ্য পরিবর্তন করুন
                 </h3>
                 <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X className="w-5 h-5 text-slate-500"/></button>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">কাস্টমারের নাম</label>
                    <input className={modalInputStyle} value={editFormData.customerName} onChange={e => setEditFormData({...editFormData, customerName: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">মোবাইল</label>
                    <input className={modalInputStyle} value={editFormData.customerPhone} onChange={e => setEditFormData({...editFormData, customerPhone: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">ঠিকানা</label>
                    <input className={modalInputStyle} value={editFormData.customerAddress} onChange={e => setEditFormData({...editFormData, customerAddress: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">নোট</label>
                    <input className={modalInputStyle} value={editFormData.note} onChange={e => setEditFormData({...editFormData, note: e.target.value})} />
                 </div>
                 <button onClick={handleSaveChanges} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">সেভ করুন</button>
              </div>
           </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualEntryOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-slate-800">পূর্বের বকেয়া যোগ করুন</h3>
                 <button onClick={() => setIsManualEntryOpen(false)}><X className="w-5 h-5 text-slate-500"/></button>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">কাস্টমারের নাম</label>
                    <input className={modalInputStyle} value={manualEntry.name} onChange={e => setManualEntry({...manualEntry, name: e.target.value})} placeholder="নাম" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">মোবাইল</label>
                      <input className={modalInputStyle} value={manualEntry.phone} onChange={e => setManualEntry({...manualEntry, phone: e.target.value})} placeholder="নাম্বার" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">টাকার পরিমাণ</label>
                      <input type="number" className={modalInputStyle + " text-red-600 font-bold"} value={manualEntry.amount} onChange={e => setManualEntry({...manualEntry, amount: e.target.value})} placeholder="0.00" />
                    </div>
                 </div>
                 <button onClick={handleCreateOldDue} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">সেভ করুন</button>
              </div>
           </div>
        </div>
      )}

      {/* Main List Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <StickyNote className="w-6 h-6 text-blue-600" /> মেমো খাতা ও বাকি তালিকা
           </h2>
           <p className="text-xs text-slate-500 mt-1">পুরনো মেমো খুঁজতে সার্চ বক্সে নাম্বার লিখুন</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative">
             <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
             <input 
               type="text" 
               className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
               placeholder="মেমো নং / নাম..."
               value={searchQuery}
               onChange={e => { setSearchQuery(e.target.value); setDisplayLimit(20); }}
             />
          </div>

          <button 
            onClick={() => setShowTodayOnly(!showTodayOnly)}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition whitespace-nowrap ${showTodayOnly ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Calendar className="w-4 h-4" /> আজকের
          </button>
          <button 
            onClick={() => setIsManualEntryOpen(true)}
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold shadow-sm border border-blue-200 hover:bg-blue-50 transition flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> পূর্বের বকেয়া
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {displaySales.map(sale => (
          <div key={sale.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition relative group">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xl text-slate-800 line-clamp-1" title={sale.customerName}>{sale.customerName}</h3>
                  <button onClick={() => handleEditClick(sale)} className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex flex-col gap-1 mt-1">
                   <div className="flex items-center text-slate-500 text-sm gap-1 font-sans font-bold">
                     <span className="bg-slate-100 px-1.5 rounded text-xs text-slate-600">#{sale.invoiceId || 'OLD'}</span>
                     <Phone className="w-3 h-3 ml-1" />
                     {sale.customerPhone || 'N/A'}
                   </div>
                   {sale.customerAddress && (
                     <div className="flex items-center text-slate-500 text-sm gap-1">
                       <MapPin className="w-3 h-3" />
                       <span className="line-clamp-1">{sale.customerAddress}</span>
                     </div>
                   )}
                   <div className="text-xs text-slate-400 mt-1">Sold By: {sale.soldBy}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-xs text-slate-400 mb-1 font-bold uppercase">
                   {sale.dueAmount >= 0 ? 'বর্তমান বাকি' : 'অ্যাডভান্স জমা'}
                </span>
                <span className={`text-2xl font-bold ${sale.dueAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                   ৳{Math.abs(Math.round(sale.dueAmount)).toLocaleString()}
                </span>
                {sale.dueAmount < 0 && <span className="block text-[10px] text-emerald-600 font-bold">(কাস্টমার পাবে)</span>}
              </div>
            </div>
            
            {/* Delivery Status & Note Badge */}
            <div className="flex flex-wrap gap-2 mb-4">
               <button 
                 onClick={() => toggleDeliveryStatus(sale)}
                 className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 border transition ${
                   sale.deliveryStatus === 'pending' 
                     ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 animate-pulse' 
                     : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                 }`}
               >
                 <Truck className="w-3 h-3" />
                 {sale.deliveryStatus === 'pending' ? 'মাল বাকি (Pending)' : 'মাল বুঝিয়ে দেওয়া হয়েছে'}
               </button>
            </div>
            
            {/* Payment Progress */}
            {sale.finalAmount > 0 && (
               <>
               <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                 <div 
                   className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                   style={{ width: `${Math.min(100, (sale.paidAmount / sale.finalAmount) * 100)}%` }}
                 ></div>
               </div>
               <div className="flex justify-between text-xs font-bold text-slate-500 mb-4">
                  <span>বিল: ৳{sale.finalAmount.toLocaleString()}</span>
                  <span className="text-emerald-600">জমা: ৳{sale.paidAmount.toLocaleString()}</span>
               </div>
               </>
            )}

            {/* Actions */}
            <div className="flex gap-2 mb-4">
              {selectedSaleId === sale.id ? (
                 <div className="flex-1 bg-emerald-50 p-2 rounded-xl border border-emerald-200 flex gap-2 animate-fade-in">
                    <input 
                      type="number" className="flex-1 p-2 rounded border outline-none text-sm font-bold"
                      value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="জমা..." autoFocus
                    />
                    <button onClick={handleAddPayment} className="bg-emerald-600 text-white px-3 rounded font-bold text-xs">জমা</button>
                    <button onClick={() => setSelectedSaleId(null)} className="text-slate-400 px-1">X</button>
                 </div>
              ) : (
                <button onClick={() => setSelectedSaleId(sale.id)} className="flex-1 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100 hover:bg-emerald-100 transition text-sm flex justify-center items-center gap-1">
                  <PlusCircle className="w-4 h-4" /> টাকা জমা / এন্ট্রি
                </button>
              )}
            </div>

            {/* Items Summary with Return Button */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> আইটেমসমূহ (ফেরত নিতে ক্লিক করুন):
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {sale.items.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-600 flex justify-between border-b border-dashed border-slate-100 pb-2 last:border-0 items-start group/item">
                    <div className="pr-2">
                       {renderItemName(item.name)}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <span className="font-mono bg-slate-100 px-2 rounded text-xs py-0.5">{item.formattedQty || item.quantityPieces}</span>
                       {item.groupId !== 'manual' && (
                         <button 
                           onClick={() => openReturnModal(sale, idx)}
                           className="text-[10px] text-red-400 hover:text-red-600 font-bold underline opacity-0 group-hover/item:opacity-100 transition"
                         >
                           ফেরত
                         </button>
                       )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right mt-3 text-[10px] text-slate-400 font-sans flex items-center justify-end gap-1">
               <History className="w-3 h-3" />
               {new Date(sale.timestamp).toLocaleDateString('bn-BD', { dateStyle: 'long' })}
            </div>
          </div>
        ))}
      </div>
      
      {/* Show More Button */}
      {displaySales.length < filteredLedgerSales.length && (
         <div className="flex justify-center mt-6 pb-10">
            <button 
               onClick={() => setDisplayLimit(prev => prev + 20)}
               className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
            >
               <ArrowDown className="w-4 h-4"/> আরও দেখুন ({filteredLedgerSales.length - displaySales.length} বাকি)
            </button>
         </div>
      )}

      {displaySales.length === 0 && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="text-2xl font-bold text-slate-800">কোন রেকর্ড নেই!</div>
            <p className="text-slate-500">সব ক্লিয়ার, অথবা মেমো আইডি দিয়ে খুঁজুন</p>
          </div>
      )}
    </div>
  );
};
