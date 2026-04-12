
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Sale, CartItem, ProductGroup, StoreSettings } from '../types';
import { Search, Eye, Printer, Edit, Trash2, Calendar, FileText, X, CheckCircle, AlertTriangle, Save, RotateCcw, Plus, Layers, ArrowDown } from 'lucide-react';
import { ToastContext } from '../App';

interface SalesHistoryProps {
  sales: Sale[];
  onUpdateSale: (sale: Sale, restoreStock?: boolean) => void;
  onDeleteSale: (saleId: string) => void;
  inventory: ProductGroup[];
  setInventory: (inv: ProductGroup[]) => void;
  settings?: StoreSettings; // Need settings for dropdowns in full edit
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, onUpdateSale, onDeleteSale, inventory, setInventory, settings }) => {
  const { notify } = useContext(ToastContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [displayLimit, setDisplayLimit] = useState(20);
  
  // Invoice Modal State
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  
  // Edit State
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState<{
     customerName: string;
     customerPhone: string;
     customerAddress: string;
     paidAmount: number;
     discount: number;
     items: CartItem[];
  } | null>(null);

  // --- Add Product States in Edit Mode ---
  const [selProductType, setSelProductType] = useState<string>(''); 
  const [selBrand, setSelBrand] = useState<string>('');             
  const [selThickness, setSelThickness] = useState<string>('');     
  const [selColor, setSelColor] = useState<string>('');             
  const [selSize, setSelSize] = useState<number | null>(null);
  const [addQty, setAddQty] = useState('');
  const [addRate, setAddRate] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Return Modal State
  const [returnModal, setReturnModal] = useState<{
    isOpen: boolean;
    sale: Sale | null;
    itemIndex: number | null;
    returnQty: string;
    manualRefundAmount: string; // "se koto tk pabe manually"
  }>({ isOpen: false, sale: null, itemIndex: null, returnQty: '', manualRefundAmount: '' });

  // Delete Confirmation State
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleteInput, setDeleteInput] = useState('');

  // --- Filtering Logic (Memoized) ---
  const filteredSales = useMemo(() => {
    let result = [...sales].sort((a, b) => b.timestamp - a.timestamp);

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.customerName.toLowerCase().includes(q) || 
        s.invoiceId?.toString().includes(q) ||
        s.customerPhone.includes(q)
      );
    }

    if (filterDate) {
      result = result.filter(s => {
        const d = new Date(s.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
        return d === filterDate;
      });
    }
    return result;
  }, [sales, searchTerm, filterDate]);

  const displaySales = filteredSales.slice(0, displayLimit);

  // --- Print ---
  const handlePrint = () => window.print();

  // --- Full Edit Logic ---
  const startEdit = (sale: Sale) => {
    setEditingSale(sale);
    setEditForm({
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      customerAddress: sale.customerAddress || '',
      paidAmount: sale.paidAmount,
      discount: sale.discount,
      items: JSON.parse(JSON.stringify(sale.items)) 
    });
    // Reset Add Item States
    setIsAddingItem(false);
    setSelProductType(settings?.productTypes[0] || '');
    setSelBrand(''); setSelThickness(''); setSelColor(''); setSelSize(null);
    setAddQty(''); setAddRate('');
  };

  // Helper for Product Selector in Edit Modal
  const getSelectorData = () => {
     if (!inventory || !settings) return { brands: [], thicknesses: [], colors: [], sizes: [], targetVariant: null };
     
     const brands = Array.from(new Set(inventory.filter(g => !selProductType || g.productType === selProductType).map(g => g.brand)));
     
     const thicknesses = Array.from(new Set(inventory.filter(g => 
       (!selProductType || g.productType === selProductType) && (!selBrand || g.brand === selBrand)
     ).map(g => g.thickness))).filter(Boolean);

     const colors = Array.from(new Set(inventory.filter(g => 
       (!selProductType || g.productType === selProductType) && (!selBrand || g.brand === selBrand) && (!selThickness || g.thickness === selThickness)
     ).map(g => g.color))).filter(Boolean);

     const group = inventory.find(g => 
       g.productType === selProductType && g.brand === selBrand && 
       (thicknesses.length === 0 || g.thickness === selThickness) && 
       (colors.length === 0 || g.color === selColor)
     );

     const sizes = group ? group.variants.map(v => v.lengthFeet).sort((a,b)=>a-b) : [];
     const targetVariant = group?.variants.find(v => v.lengthFeet === selSize);

     return { brands, thicknesses, colors, sizes, targetVariant, group };
  };

  const handleAddItemToEdit = () => {
     const { targetVariant, group } = getSelectorData();
     if (!group || !targetVariant || !addQty || !addRate || !editForm) return;

     const qty = Number(addQty);
     const rate = Number(addRate);
     if (qty <= 0) return;

     const newItem: CartItem = {
        groupId: group.id,
        variantId: targetVariant.id,
        name: `${group.productType} - ${group.brand} ${group.thickness} ${group.color || ''} - ${targetVariant.lengthFeet}'`,
        lengthFeet: targetVariant.lengthFeet,
        calculationBase: targetVariant.calculationBase,
        quantityPieces: qty,
        formattedQty: `${qty} pcs (Added)`,
        priceUnit: rate,
        buyPriceUnit: targetVariant.averageCost || 0,
        subtotal: Math.round(qty * rate),
        unitType: 'piece'
     };

     setEditForm({ ...editForm, items: [...editForm.items, newItem] });
     setIsAddingItem(false);
     setAddQty(''); setAddRate('');
  };

  const handleRemoveItemFromEdit = (index: number) => {
     if(!editForm) return;
     const newItems = [...editForm.items];
     newItems.splice(index, 1);
     setEditForm({...editForm, items: newItems});
  };

  const handleItemChange = (index: number, field: 'quantityPieces' | 'priceUnit', value: number) => {
     if (!editForm) return;
     const newItems = [...editForm.items];
     const item = newItems[index];
     
     if (field === 'quantityPieces') item.quantityPieces = value;
     else if (field === 'priceUnit') item.priceUnit = value;
     
     item.formattedQty = `${item.quantityPieces} pcs`;
     item.subtotal = Math.round(item.quantityPieces * item.priceUnit);
     setEditForm({ ...editForm, items: newItems });
  };

  const saveFullEdit = () => {
    if (!editingSale || !editForm) return;

    // Logic to Revert Old Stock & Deduct New Stock (Same as before)
    let tempInventory = [...inventory];
    
    // 1. Restore Old Stock
    editingSale.items.forEach(oldItem => {
       if (oldItem.groupId === 'manual') return;
       tempInventory = tempInventory.map(g => {
          if (g.id === oldItem.groupId) {
             return { ...g, variants: g.variants.map(v => v.id === oldItem.variantId ? { ...v, stockPieces: v.stockPieces + oldItem.quantityPieces } : v) };
          }
          return g;
       });
    });

    // 2. Deduct New Stock
    let stockError = false;
    editForm.items.forEach(newItem => {
       if (newItem.groupId === 'manual') return;
       tempInventory = tempInventory.map(g => {
          if (g.id === newItem.groupId) {
             return { ...g, variants: g.variants.map(v => {
                   if (v.id === newItem.variantId) {
                      if (v.stockPieces < newItem.quantityPieces) stockError = true;
                      return { ...v, stockPieces: v.stockPieces - newItem.quantityPieces };
                   }
                   return v;
                })
             };
          }
          return g;
       });
    });

    if (stockError) {
       if(!confirm("সতর্কতা: স্টকের পরিমাণ নেগেটিভ হয়ে যাবে। আপনি কি নিশ্চিত?")) return;
    }

    setInventory(tempInventory);

    // 3. Update Sale
    const newSubTotal = editForm.items.reduce((sum, item) => sum + item.subtotal, 0);
    const newFinal = newSubTotal - editForm.discount;
    const newDue = newFinal - editForm.paidAmount;

    onUpdateSale({
      ...editingSale,
      customerName: editForm.customerName,
      customerPhone: editForm.customerPhone,
      customerAddress: editForm.customerAddress,
      paidAmount: editForm.paidAmount,
      discount: editForm.discount,
      items: editForm.items,
      subTotal: newSubTotal,
      finalAmount: newFinal,
      dueAmount: newDue,
      note: (editingSale.note || '') + " (Edited)"
    });
    
    setEditingSale(null);
    setEditForm(null);
    notify('মেমো আপডেট সফল হয়েছে', 'success');
  };

  // --- Return Logic ---
  const initiateReturn = (sale: Sale) => {
     setReturnModal({ isOpen: true, sale, itemIndex: null, returnQty: '', manualRefundAmount: '' });
  };

  const processReturn = () => {
     const { sale, itemIndex, returnQty, manualRefundAmount } = returnModal;
     if (!sale || itemIndex === null || !returnQty || !manualRefundAmount) {
        notify('সব তথ্য দিন', 'error');
        return;
     }

     const item = sale.items[itemIndex];
     const qty = Number(returnQty);
     const refund = Number(manualRefundAmount);

     if (qty > item.quantityPieces) {
        notify('ফেরত পরিমাণ সঠিক নয়', 'error');
        return;
     }

     // 1. Update Stock (+)
     if (item.groupId !== 'manual') {
        const updatedInventory = inventory.map(g => {
           if (g.id === item.groupId) {
              return { ...g, variants: g.variants.map(v => v.id === item.variantId ? {...v, stockPieces: v.stockPieces + qty} : v) };
           }
           return g;
        });
        setInventory(updatedInventory);
     }

     // 2. Update Sale Item & Financials
     const updatedItems = [...sale.items];
     const newItemQty = item.quantityPieces - qty;
     
     if (newItemQty === 0) {
        updatedItems.splice(itemIndex, 1);
     } else {
        updatedItems[itemIndex] = {
           ...item,
           quantityPieces: newItemQty,
           subtotal: newItemQty * item.priceUnit,
           formattedQty: `${newItemQty} pcs (Returned ${qty})`
        };
     }

     // Recalculate Subtotal
     const newSubTotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);
     const newFinal = newSubTotal - sale.discount;
     
     const updatedSale: Sale = {
        ...sale,
        items: updatedItems,
        subTotal: newSubTotal,
        finalAmount: newFinal,
        paidAmount: sale.paidAmount - refund, 
        dueAmount: newFinal - (sale.paidAmount - refund),
        paymentHistory: [
           ...(sale.paymentHistory || []),
           { amount: -refund, date: Date.now(), note: `Returned ${qty}x ${item.name}` }
        ],
        note: (sale.note || '') + ` | Return: ${qty}pcs`
     };

     onUpdateSale(updatedSale);
     setReturnModal({ isOpen: false, sale: null, itemIndex: null, returnQty: '', manualRefundAmount: '' });
     notify('ফেরত সম্পন্ন হয়েছে', 'success');
  };

  // --- Delete Logic ---
  const initiateDelete = (sale: Sale) => {
     setSaleToDelete(sale);
     setDeleteInput('');
  };

  const confirmDelete = () => {
    if (saleToDelete && deleteInput === saleToDelete.invoiceId) {
      onDeleteSale(saleToDelete.id);
      setSaleToDelete(null);
      setViewSale(null); 
    } else {
       notify('ইনভয়েস আইডি সঠিক নয়', 'error');
    }
  };

  const { brands, thicknesses, colors, sizes, targetVariant } = getSelectorData();

  return (
    <div className="font-bangla space-y-6 animate-fade-in">
      
      {/* --- RETURN MODAL --- */}
      {returnModal.isOpen && returnModal.sale && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[180] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200">
               <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h3 className="font-bold text-red-600 flex items-center gap-2"><RotateCcw className="w-5 h-5"/> পণ্য ফেরত (Return)</h3>
                  <button onClick={() => setReturnModal({...returnModal, isOpen: false})}><X className="w-5 h-5 text-slate-400"/></button>
               </div>
               
               <div className="space-y-4">
                  {/* Item Selector */}
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">কোন পণ্য ফেরত?</label>
                     <select 
                        className="w-full p-2 border rounded-lg bg-slate-50"
                        onChange={e => setReturnModal({...returnModal, itemIndex: Number(e.target.value)})}
                        value={returnModal.itemIndex === null ? '' : returnModal.itemIndex}
                     >
                        <option value="">সিলেক্ট করুন...</option>
                        {returnModal.sale.items.map((item, idx) => (
                           <option key={idx} value={idx}>{item.name} ({item.quantityPieces} pcs sold)</option>
                        ))}
                     </select>
                  </div>

                  {returnModal.itemIndex !== null && (
                     <>
                        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                           কেনা দর: ৳{returnModal.sale.items[returnModal.itemIndex].priceUnit} / pcs
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">ফেরত পরিমাণ (Qty)</label>
                              <input 
                                 type="number" className="w-full p-2 border rounded font-bold text-lg"
                                 value={returnModal.returnQty}
                                 onChange={e => setReturnModal({...returnModal, returnQty: e.target.value})}
                              />
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">টাকা ফেরত (Refund)</label>
                              <input 
                                 type="number" className="w-full p-2 border border-red-300 rounded font-bold text-lg text-red-600"
                                 placeholder="Amount"
                                 value={returnModal.manualRefundAmount}
                                 onChange={e => setReturnModal({...returnModal, manualRefundAmount: e.target.value})}
                              />
                           </div>
                        </div>
                        {returnModal.returnQty && (
                           <p className="text-xs text-center text-slate-400">
                              হিসাব অনুযায়ী ফেরত: ৳{Number(returnModal.returnQty) * returnModal.sale.items[returnModal.itemIndex].priceUnit}
                           </p>
                        )}
                        <button onClick={processReturn} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg">
                           ফেরত নিশ্চিত করুন
                        </button>
                     </>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {saleToDelete && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-fade-in border border-slate-200">
               <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold text-slate-800 mb-2">ডিলিট নিশ্চিত করুন</h3>
               <p className="text-slate-600 mb-4 text-sm">
                  মেমো <b>#{saleToDelete.invoiceId}</b> ডিলিট করতে চাইলে নিচের বক্সে মেমো নাম্বারটি লিখুন।
               </p>
               <input 
                  type="text" 
                  className="w-full p-2 border-2 border-red-200 rounded-lg text-center font-bold mb-4 focus:border-red-500 outline-none"
                  placeholder={saleToDelete.invoiceId}
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  autoFocus
               />
               <div className="flex gap-3">
                  <button onClick={() => setSaleToDelete(null)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200">বাতিল</button>
                  <button onClick={confirmDelete} disabled={deleteInput !== saleToDelete.invoiceId} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">ডিলিট</button>
               </div>
            </div>
         </div>
      )}

      {/* --- EDIT MODAL (FULL EDIT WITH ADD PRODUCT) --- */}
      {editingSale && editForm && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center border-b pb-4 mb-4">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                     <Edit className="w-5 h-5 text-blue-600"/> মেমো এডিট (#{editingSale.invoiceId})
                  </h3>
                  <button onClick={() => setEditingSale(null)}><X className="w-6 h-6 text-slate-400"/></button>
               </div>
               
               <div className="overflow-y-auto custom-scrollbar flex-1 space-y-6 pr-2">
                  {/* Customer Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl">
                     <div><label className="text-xs font-bold text-slate-500 uppercase">নাম</label><input className="w-full p-2 border rounded" value={editForm.customerName} onChange={e => setEditForm({...editForm, customerName: e.target.value})} /></div>
                     <div><label className="text-xs font-bold text-slate-500 uppercase">মোবাইল</label><input className="w-full p-2 border rounded" value={editForm.customerPhone} onChange={e => setEditForm({...editForm, customerPhone: e.target.value})} /></div>
                     <div><label className="text-xs font-bold text-slate-500 uppercase">ঠিকানা</label><input className="w-full p-2 border rounded" value={editForm.customerAddress} onChange={e => setEditForm({...editForm, customerAddress: e.target.value})} /></div>
                  </div>

                  {/* Add New Item Section (Collapsible) */}
                  <div className="border border-blue-100 rounded-xl overflow-hidden">
                     <button onClick={() => setIsAddingItem(!isAddingItem)} className="w-full p-3 bg-blue-50 flex items-center justify-center gap-2 font-bold text-blue-600 hover:bg-blue-100 transition">
                        <Plus className="w-4 h-4" /> নতুন পণ্য যোগ করুন
                     </button>
                     {isAddingItem && settings && (
                        <div className="p-4 bg-white animate-fade-in grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                           <div className="col-span-2">
                              <label className="text-[10px] font-bold uppercase block mb-1">Type</label>
                              <select className="w-full p-2 border rounded text-sm" value={selProductType} onChange={e => {setSelProductType(e.target.value); setSelBrand('');}}>
                                 {settings.productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                           </div>
                           <div className="col-span-2">
                              <label className="text-[10px] font-bold uppercase block mb-1">Brand</label>
                              <select className="w-full p-2 border rounded text-sm" value={selBrand} onChange={e => setSelBrand(e.target.value)}>
                                 <option value="">Select...</option>
                                 {brands.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                           </div>
                           <div className="col-span-2">
                              <label className="text-[10px] font-bold uppercase block mb-1">Size</label>
                              <select className="w-full p-2 border rounded text-sm" value={selSize || ''} onChange={e => setSelSize(Number(e.target.value))}>
                                 <option value="">Select...</option>
                                 {sizes.map(s => <option key={s} value={s}>{s}'</option>)}
                              </select>
                           </div>
                           {/* Add Colors/Thickness if needed, simplifying for UI space */}
                           
                           <div>
                              <label className="text-[10px] font-bold uppercase block mb-1">Qty</label>
                              <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={addQty} onChange={e => setAddQty(e.target.value)} />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold uppercase block mb-1">Rate</label>
                              <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={addRate} onChange={e => setAddRate(e.target.value)} />
                           </div>
                           <button onClick={handleAddItemToEdit} disabled={!targetVariant} className="bg-emerald-600 text-white p-2 rounded text-sm font-bold disabled:opacity-50">Add</button>
                        </div>
                     )}
                  </div>

                  {/* Existing Items Table */}
                  <table className="w-full text-sm text-left border-collapse">
                     <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
                        <tr>
                           <th className="p-2">নাম</th>
                           <th className="p-2 w-20">Qty</th>
                           <th className="p-2 w-24">Rate</th>
                           <th className="p-2 text-right">Total</th>
                           <th className="p-2 w-10"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {editForm.items.map((item, idx) => (
                           <tr key={idx}>
                              <td className="p-2 font-medium">{item.name}</td>
                              <td className="p-2"><input type="number" className="w-full p-1 border rounded text-center" value={item.quantityPieces} onChange={e => handleItemChange(idx, 'quantityPieces', Number(e.target.value))} /></td>
                              <td className="p-2"><input type="number" className="w-full p-1 border rounded text-center" value={item.priceUnit} onChange={e => handleItemChange(idx, 'priceUnit', Number(e.target.value))} /></td>
                              <td className="p-2 text-right font-bold">৳{item.subtotal.toLocaleString()}</td>
                              <td className="p-2"><button onClick={() => handleRemoveItemFromEdit(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>

                  {/* Financials (Same as before) */}
                  <div className="bg-blue-50 p-4 rounded-xl space-y-2 border border-blue-100">
                     <div className="flex justify-between items-center"><span className="font-bold text-slate-600">সাব-টোটাল:</span><span className="font-bold text-slate-800">৳{editForm.items.reduce((s, i) => s + i.subtotal, 0).toLocaleString()}</span></div>
                     <div className="flex justify-between items-center"><span className="font-bold text-slate-600">ছাড় (Discount):</span><input type="number" className="w-24 p-1 border rounded text-right font-bold text-red-600" value={editForm.discount} onChange={e => setEditForm({...editForm, discount: Number(e.target.value)})} /></div>
                     <div className="flex justify-between items-center border-t border-blue-200 pt-2"><span className="font-bold text-slate-800">সর্বমোট বিল:</span><span className="font-bold text-xl text-blue-700">৳{(editForm.items.reduce((s, i) => s + i.subtotal, 0) - editForm.discount).toLocaleString()}</span></div>
                     <div className="flex justify-between items-center"><span className="font-bold text-emerald-700">জমা (Paid):</span><input type="number" className="w-24 p-1 border rounded text-right font-bold text-emerald-600" value={editForm.paidAmount} onChange={e => setEditForm({...editForm, paidAmount: Number(e.target.value)})} /></div>
                  </div>
               </div>

               <div className="flex gap-3 pt-4 border-t mt-4">
                  <button onClick={saveFullEdit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg">আপডেট করুন</button>
               </div>
            </div>
         </div>
      )}

      {/* --- INVOICE VIEW MODAL (Unchanged) --- */}
      {viewSale && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto">
           <div className="bg-white w-full max-w-2xl shadow-2xl rounded-xl overflow-hidden animate-fade-in relative print:w-full print:fixed print:inset-0 print:h-screen print:z-[200] print:rounded-none">
              
              <div className="p-4 bg-slate-100 flex justify-between items-center print:hidden border-b border-slate-200">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> মেমো প্রিভিউ
                 </h3>
                 <div className="flex gap-2">
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700">
                       <Printer className="w-4 h-4" /> প্রিন্ট
                    </button>
                    <button onClick={() => setViewSale(null)} className="bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50">
                       <X className="w-5 h-5 text-slate-500" />
                    </button>
                 </div>
              </div>

              <div className="p-8 print:p-0 bg-white" id="invoice-area">
                 <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-1">টিনঘর.কম</h1>
                    <p className="text-slate-500 text-sm font-medium">প্রোঃ মোঃ মালিক সাহেব</p>
                    <p className="text-slate-500 text-sm">ঠিকানা: বাজার রোড, সদর, জেলা</p>
                    <p className="text-slate-500 text-sm">মোবাইল: ০১৭১১-XXXXXX</p>
                 </div>

                 <div className="flex justify-between items-end mb-6 text-sm">
                    <div className="w-1/2">
                       <p className="font-bold text-slate-700 text-lg">ক্রেতা: {viewSale.customerName}</p>
                       <p className="text-slate-600">মোবাইল: {viewSale.customerPhone}</p>
                       {viewSale.customerAddress && <p className="text-slate-600">ঠিকানা: {viewSale.customerAddress}</p>}
                    </div>
                    <div className="text-right">
                       <div className="bg-slate-100 px-3 py-1 rounded inline-block mb-1">
                          <span className="font-bold text-slate-700">মেমো নং: #{viewSale.invoiceId}</span>
                       </div>
                       <p className="text-slate-500">তারিখ: {new Date(viewSale.timestamp).toLocaleDateString('bn-BD')}</p>
                       <p className="text-slate-500">সময়: {new Date(viewSale.timestamp).toLocaleTimeString('bn-BD', {hour:'2-digit', minute:'2-digit'})}</p>
                    </div>
                 </div>

                 <table className="w-full text-left text-sm border-collapse mb-6">
                    <thead>
                       <tr className="bg-slate-50 text-slate-700 uppercase tracking-wide border-y border-slate-300">
                          <th className="py-3 px-2 font-bold">বিবরণ</th>
                          <th className="py-3 px-2 text-center font-bold">পরিমাণ</th>
                          <th className="py-3 px-2 text-right font-bold">দর</th>
                          <th className="py-3 px-2 text-right font-bold">মোট</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {viewSale.items.map((item, i) => (
                          <tr key={i}>
                             <td className="py-3 px-2 text-slate-800 font-medium">
                                {item.name}
                             </td>
                             <td className="py-3 px-2 text-center text-slate-600">
                                {item.formattedQty}
                             </td>
                             <td className="py-3 px-2 text-right text-slate-600">
                                {item.priceUnit}
                             </td>
                             <td className="py-3 px-2 text-right text-slate-800 font-bold">
                                {item.subtotal.toLocaleString()}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

                 <div className="flex justify-end mb-12">
                    <div className="w-1/2 space-y-2 text-sm">
                       <div className="flex justify-between text-slate-600">
                          <span>সাব-টোটাল:</span>
                          <span>৳{viewSale.subTotal.toLocaleString()}</span>
                       </div>
                       {viewSale.discount > 0 && (
                          <div className="flex justify-between text-red-500">
                             <span>ছাড় / ডিসকাউন্ট:</span>
                             <span>(-) ৳{viewSale.discount.toLocaleString()}</span>
                          </div>
                       )}
                       <div className="flex justify-between font-bold text-lg text-slate-800 border-t border-slate-300 pt-2">
                          <span>সর্বমোট বিল:</span>
                          <span>৳{viewSale.finalAmount.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-emerald-600 font-bold">
                          <span>জমা দেওয়া হয়েছে:</span>
                          <span>৳{viewSale.paidAmount.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between font-bold border-t border-dashed border-slate-300 pt-2">
                          <span>বর্তমান অবস্থা:</span>
                          <span className={`${viewSale.dueAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                             {viewSale.dueAmount > 0 ? `বাকি ৳${viewSale.dueAmount}` : viewSale.dueAmount < 0 ? `অ্যাডভান্স ৳${Math.abs(viewSale.dueAmount)}` : 'পরিশোধিত'}
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="flex justify-between text-xs text-slate-400 mt-20 pt-4 border-t border-slate-200">
                    <div>
                       <p>ক্রেতার স্বাক্ষর</p>
                    </div>
                    <div className="text-right">
                       <p>বিক্রেতার স্বাক্ষর</p>
                    </div>
                 </div>
                 <div className="text-center text-[10px] text-slate-300 mt-4">
                    Software by Tinghor.com | Printed on {new Date().toLocaleString()}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- MAIN LIST UI --- */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <FileText className="w-6 h-6 text-blue-600" /> মেমো ও বিক্রয় খাতা
            </h2>
            <p className="text-xs text-slate-500 mt-1">সকল বিক্রয় ও ইনভয়েস তালিকা</p>
         </div>
         
         <div className="flex gap-2 w-full md:w-auto">
            <div className="relative">
               <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
               <input type="date" className="pl-10 p-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-600" value={filterDate} onChange={e => { setFilterDate(e.target.value); setDisplayLimit(20); }} />
            </div>
            <div className="relative flex-1 md:w-64">
               <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
               <input type="text" className="w-full pl-10 p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="মেমো নং বা নাম..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setDisplayLimit(20); }} />
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                  <tr>
                     <th className="p-4 border-b">মেমো নং</th>
                     <th className="p-4 border-b">তারিখ</th>
                     <th className="p-4 border-b">কাস্টমার</th>
                     <th className="p-4 border-b text-right">মোট বিল</th>
                     <th className="p-4 border-b text-right">জমা</th>
                     <th className="p-4 border-b text-right">অবস্থা</th>
                     <th className="p-4 border-b text-center">অ্যাকশন</th>
                  </tr>
               </thead>
               <tbody className="text-sm divide-y divide-slate-100">
                  {displaySales.map(sale => (
                     <tr key={sale.id} className="hover:bg-slate-50 transition group">
                        <td className="p-4 font-mono font-bold text-blue-600">#{sale.invoiceId}</td>
                        <td className="p-4 text-slate-500">
                           {new Date(sale.timestamp).toLocaleDateString('bn-BD')}
                           <br/>
                           <span className="text-[10px] opacity-70">{new Date(sale.timestamp).toLocaleTimeString('bn-BD', {timeStyle:'short'})}</span>
                        </td>
                        <td className="p-4">
                           <div className="font-bold text-slate-800">{sale.customerName}</div>
                           <div className="text-xs text-slate-400">{sale.items.length} টি আইটেম</div>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800">৳{sale.finalAmount.toLocaleString()}</td>
                        <td className="p-4 text-right text-emerald-600 font-medium">৳{sale.paidAmount.toLocaleString()}</td>
                        <td className="p-4 text-right">
                           {sale.dueAmount > 0 ? (
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">বাকি ৳{sale.dueAmount}</span>
                           ) : sale.dueAmount < 0 ? (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">অ্যাডভান্স ৳{Math.abs(sale.dueAmount)}</span>
                           ) : (
                              <span className="text-emerald-500 flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3"/> Paid</span>
                           )}
                        </td>
                        <td className="p-4 text-center">
                           <div className="flex justify-center gap-2">
                              <button onClick={() => setViewSale(sale)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="View"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => initiateReturn(sale)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="Return / Refund"><RotateCcw className="w-4 h-4" /></button>
                              <button onClick={() => startEdit(sale)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Edit Full"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => initiateDelete(sale)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
                           </div>
                        </td>
                     </tr>
                  ))}
                  {displaySales.length === 0 && (
                     <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400">কোনো তথ্য পাওয়া যায়নি</td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
      
      {/* Show More Button */}
      {displaySales.length < filteredSales.length && (
         <div className="flex justify-center mt-4 pb-10">
            <button 
               onClick={() => setDisplayLimit(prev => prev + 20)}
               className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
            >
               <ArrowDown className="w-4 h-4"/> আরও দেখুন ({filteredSales.length - displaySales.length} বাকি)
            </button>
         </div>
      )}
    </div>
  );
};
