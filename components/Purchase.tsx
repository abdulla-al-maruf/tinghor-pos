
import React, { useState, useEffect, useContext } from 'react';
import { ProductGroup, ProductVariant, CartItem, Purchase as PurchaseType, StoreSettings, Supplier } from '../types';
import { ShoppingCart, CheckCircle, Trash, Layers, Tag, Calculator, User, FileText, Plus } from 'lucide-react';
import { ToastContext } from '../lib/contexts';
import { generateId } from '../lib/utils';
import { calculateLineItem, makeCartItem } from '../lib/pricing';

interface PurchaseProps {
  inventory: ProductGroup[];
  suppliers: Supplier[];
  onCompletePurchase: (purchase: PurchaseType, newSupplier?: Supplier) => void;
  onAddVariant?: (groupId: string, variant: ProductVariant) => void;
  settings: StoreSettings;
}

export const Purchase: React.FC<PurchaseProps> = ({ inventory, suppliers, onCompletePurchase, onAddVariant, settings }) => {
  const { notify } = useContext(ToastContext);
  
  // -- State Initialization --
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Supplier State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierCompany, setSupplierCompany] = useState('');
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');

  // -- Product Selection State --
  const [selProductType, setSelProductType] = useState<string>(''); 
  const [selBrand, setSelBrand] = useState<string>('');             
  const [selThickness, setSelThickness] = useState<string>('');     
  const [selColor, setSelColor] = useState<string>('');             
  const [selSize, setSelSize] = useState<number | null>(null);      

  // Input States
  const [quantity, setQuantity] = useState<string>('');
  const [costRate, setCostRate] = useState<string>(''); 
  const [unitMode, setUnitMode] = useState<'bundle' | 'piece'>('piece'); 
  
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [purchaseNote, setPurchaseNote] = useState('');

  // নতুন সাইজ যোগ (inline)
  const [addingSize, setAddingSize] = useState(false);
  const [newSizeFt, setNewSizeFt] = useState('');
  const [newSizeBase, setNewSizeBase] = useState('72');

  // Initial Selection Logic
  useEffect(() => {
     if (!selProductType && settings.productTypes.length > 0) {
        setSelProductType(settings.productTypes[0]); 
     }
  }, [settings.productTypes]);

  // Handle Supplier Selection
  useEffect(() => {
    if (selectedSupplierId && selectedSupplierId !== 'new') {
      const sup = suppliers.find(s => s.id === selectedSupplierId);
      if (sup) {
        setSupplierName(sup.name);
        setSupplierPhone(sup.phone);
        setSupplierCompany(sup.companyName || '');
        setIsNewSupplier(false);
      }
    } else if (selectedSupplierId === 'new') {
      setSupplierName('');
      setSupplierPhone('');
      setSupplierCompany('');
      setIsNewSupplier(true);
    }
  }, [selectedSupplierId, suppliers]);

  // --- Filtering Logic (Inventory) ---
  const availableBrands = Array.from(new Set(
     inventory.filter(g => !selProductType || g.productType === selProductType)
              .map(g => g.brand)
  ));

  const availableThicknesses = Array.from(new Set(
    inventory.filter(g => 
      (!selProductType || g.productType === selProductType) && 
      (!selBrand || g.brand === selBrand)
    ).map(g => g.thickness)
  )).filter(Boolean);

  const availableColors = Array.from(new Set(
    inventory.filter(g => 
      (!selProductType || g.productType === selProductType) &&
      (!selBrand || g.brand === selBrand) && 
      (!selThickness || g.thickness === selThickness)
    ).map(g => g.color)
  )).filter(Boolean);

  const targetGroup = inventory.find(g => 
    g.productType === selProductType &&
    g.brand === selBrand && 
    (availableThicknesses.length === 0 || g.thickness === selThickness) && 
    (availableColors.length === 0 || g.color === selColor)
  );

  const availableSizes = targetGroup ? targetGroup.variants.map(v => v.lengthFeet).sort((a,b)=>a-b) : [];
  const targetVariant = targetGroup?.variants.find(v => v.lengthFeet === selSize);

  // দর/পরিমাণ ditto-র জন্য persist — শুধু পণ্য (ব্র্যান্ড/মিলি/কালার/ধরন) বদলালে clear।
  // ফলে একই মডেলের ৭/৮/৯ ফুট একই দরে দ্রুত তোলা যায় (কাগজের মেমোর মতো)।
  useEffect(() => {
    setCostRate('');
    setQuantity('');
    setUnitMode('piece');
    setSelSize(null);
  }, [selProductType, selBrand, selThickness, selColor]);

  // --- ACTIONS ---

  const handleAddToCart = () => {
    const qtyNum = Number(quantity);
    const rateNum = Number(costRate); 

    if (!quantity || qtyNum <= 0) { notify('পরিমাণ (Quantity) লিখুন', 'error'); return; }
    if (!costRate || rateNum <= 0) { notify('ক্রয় মূল্য (Cost Rate) লিখুন', 'error'); return; }

    if (!targetGroup || !targetVariant) { notify('দয়া করে সব অপশন সিলেক্ট করুন', 'error'); return; }

    // Use centralized pricing calculation (lib/pricing.ts)
    const calc = calculateLineItem({
      groupType: targetGroup.type,
      variant: targetVariant,
      quantity: qtyNum,
      rate: rateNum,
      unitMode,
    });

    const cartItem = makeCartItem({
      groupId: targetGroup.id,
      variantId: targetVariant.id,
      group: targetGroup,
      variant: targetVariant,
      calc,
      buyPriceUnit: calc.pricePerUnit,
    });

    setCart([...cart, cartItem]);

    // দর ও পরিমাণ রেখে দিই (ditto) — শুধু সাইজ clear, পরের সাইজ ট্যাপ করলেই রেডি
    setSelSize(null);
    notify('ক্রয় তালিকায় যোগ হয়েছে', 'success');
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleCheckout = () => {
    if (cart.length === 0) { notify('কার্ট খালি!', 'error'); return; }
    if (!supplierName) { notify('সাপ্লায়ারের নাম লিখুন', 'error'); return; }

    const subTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = Number(discountAmount) || 0;
    const final = subTotal - discount;
    const paid = Number(paidAmount) || 0;
    const currentDue = final - paid;

    let newSupplier: Supplier | undefined = undefined;
    if (isNewSupplier) {
      newSupplier = {
        id: generateId(),
        name: supplierName,
        phone: supplierPhone || '',
        companyName: supplierCompany || '',
        totalPurchase: 0,
        totalDue: 0
      };
    }

    onCompletePurchase({
      id: generateId(),
      invoiceId: vendorInvoiceNo || 'AUTO',
      supplierId: isNewSupplier && newSupplier ? newSupplier.id : selectedSupplierId,
      supplierName,
      items: cart,
      subTotal,
      discount,
      finalAmount: final,
      paidAmount: paid,
      dueAmount: currentDue,
      timestamp: Date.now(),
      purchasedBy: 'Admin',
      note: purchaseNote
    }, newSupplier);

    setCart([]);
    setPaidAmount('');
    setDiscountAmount('');
    setPurchaseNote('');
    setVendorInvoiceNo('');
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartFinal = cartTotal - (Number(discountAmount)||0);

  const handleAddNewSize = () => {
    const ft = Number(newSizeFt);
    if (!ft || ft <= 0) { notify('সাইজ (ফুট) লিখুন', 'error'); return; }
    if (!targetGroup) { notify('আগে ব্র্যান্ড/কালার বাছুন', 'error'); return; }
    if (targetGroup.variants.some(v => v.lengthFeet === ft)) { notify('এই সাইজ আগেই আছে', 'error'); setSelSize(ft); setAddingSize(false); return; }
    const variant: ProductVariant = {
      id: generateId(),
      lengthFeet: ft,
      calculationBase: targetGroup.type === 'tin_bundle' ? Number(newSizeBase) || 72 : undefined,
      stockPieces: 0,
      reservedQty: 0,
      avgCostPrice: 0,
    };
    onAddVariant?.(targetGroup.id, variant);
    setSelSize(ft);
    setNewSizeFt('');
    setAddingSize(false);
  };

  const getPriceLabel = () => {
     if (targetGroup?.type === 'tin_bundle') return 'ক্রয় মূল্য (বান)';
     if (targetGroup?.type === 'running_foot') return 'ক্রয় মূল্য (প্রতি ফুট)';
     return 'ক্রয় মূল্য (পিস)';
  };

  // Compact Style Helper
  const getBtnClass = (active: boolean) => `
    px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm border whitespace-nowrap
    ${active 
      ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105' 
      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-400 hover:text-orange-600'
    }
  `;
  
  const inputStyle = "w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-sm font-bold text-sm";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full font-bangla">
      
      {/* Left: Product Selector */}
      <div className="xl:col-span-7 flex flex-col gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
             <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
               <Layers className="w-4 h-4 text-orange-600" /> পণ্য নির্বাচন (ক্রয়)
             </h3>
             <div className="flex gap-2 overflow-x-auto max-w-[60%] no-scrollbar">
               {settings.productTypes.map(type => (
                 <button 
                   key={type} 
                   onClick={() => { setSelProductType(type); setSelBrand(''); setSelThickness(''); setSelColor(''); setSelSize(null); }} 
                   className={`flex-none px-3 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap border ${selProductType === type ? 'bg-orange-50 text-orange-600 border-orange-200' : 'text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                 >
                   {type}
                 </button>
               ))}
             </div>
          </div>

          <div className="space-y-5 animate-fade-in">
             {availableBrands.length > 0 && (
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">ব্র্যান্ড</label>
                  <div className="flex flex-wrap gap-2">
                     {availableBrands.map(b => <button key={b} onClick={() => { setSelBrand(b); setSelThickness(''); setSelColor(''); setSelSize(null); }} className={getBtnClass(selBrand === b)}>{b}</button>)}
                  </div>
               </div>
             )}

             {(selBrand && (availableThicknesses.length > 0 || availableColors.length > 0)) && (
               <div className="grid grid-cols-2 gap-4">
                  {availableThicknesses.length > 0 && (
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">মিলি</label>
                        <div className="flex flex-wrap gap-2">
                           {availableThicknesses.map(t => <button key={t} onClick={() => { setSelThickness(t); setSelColor(''); setSelSize(null); }} className={getBtnClass(selThickness === t)}>{t}</button>)}
                        </div>
                     </div>
                  )}
                  {availableColors.length > 0 && (selThickness || availableThicknesses.length === 0) && (
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">কালার</label>
                        <div className="flex flex-wrap gap-2">
                           {availableColors.map(c => <button key={c} onClick={() => { setSelColor(c); setSelSize(null); }} className={getBtnClass(selColor === c)}>{c}</button>)}
                        </div>
                     </div>
                  )}
               </div>
             )}

             {((availableThicknesses.length === 0 || selThickness) && (availableColors.length === 0 || selColor) && selBrand && targetGroup) && (
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">সাইজ / মাপ (ফুট)</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                     {availableSizes.map(s => {
                       const sv = targetGroup?.variants.find(v => v.lengthFeet === s);
                       const stock = sv ? sv.stockPieces : 0;
                       return (
                       <button
                         key={s}
                         onClick={() => setSelSize(s)}
                         className={`h-12 rounded-lg text-sm font-bold border transition flex flex-col items-center justify-center shadow-sm leading-tight
                           ${selSize === s
                             ? 'bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-200'
                             : stock < 0
                               ? 'bg-red-50 text-red-600 border-red-200 hover:border-red-400'
                               : 'bg-white text-slate-700 border-slate-200 hover:border-orange-400 hover:text-orange-600'
                           }`}
                       >
                         <span>{s}'</span>
                         <span className={`text-[9px] font-semibold ${selSize === s ? 'text-orange-100' : stock < 0 ? 'text-red-500' : 'text-slate-400'}`}>{stock}</span>
                       </button>
                       );
                     })}
                     <button
                       onClick={() => setAddingSize(true)}
                       className="h-12 rounded-lg text-xs font-bold border border-dashed border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100 transition flex items-center justify-center gap-1"
                     >
                       <Plus className="w-3 h-3" /> সাইজ
                     </button>
                  </div>

                  {addingSize && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-orange-200 flex flex-wrap items-end gap-2">
                       <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">নতুন সাইজ (ফুট)</label>
                          <input type="number" autoFocus className="w-20 p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-orange-500" value={newSizeFt} onChange={e => setNewSizeFt(e.target.value)} placeholder="যেমন ১১" />
                       </div>
                       {targetGroup.type === 'tin_bundle' && (
                          <div>
                             <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">বান বেস</label>
                             <div className="flex gap-1">
                                {['70','72'].map(b => (
                                   <button key={b} onClick={() => setNewSizeBase(b)} className={`px-3 py-2 rounded-lg text-xs font-bold border ${newSizeBase === b ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>{b}</button>
                                ))}
                             </div>
                          </div>
                       )}
                       <button onClick={handleAddNewSize} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold h-[36px]">যোগ</button>
                       <button onClick={() => { setAddingSize(false); setNewSizeFt(''); }} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold h-[36px]">বাতিল</button>
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>

        {targetVariant && (
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl animate-fade-in relative overflow-hidden border border-slate-700">
             <div className="flex flex-col md:flex-row gap-4 items-end relative z-10">
                 <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 text-orange-400 mb-2 font-bold uppercase tracking-wide text-xs"><CheckCircle className="w-3 h-3" /> স্টকে যোগ হচ্ছে</div>
                    <div className="flex flex-col">
                       <h4 className="text-xl font-bold text-white tracking-tight leading-tight mb-1">{targetGroup?.brand} <span className="text-base font-normal text-slate-300">{targetGroup?.productType}</span></h4>
                       <div className="flex gap-2 text-xs text-slate-400">
                          {targetGroup?.color && targetGroup.color !== 'N/A' && <span>{targetGroup.color}</span>}
                          {targetGroup?.thickness && <span>{targetGroup.thickness}</span>}
                          {targetVariant && <span className="text-white bg-slate-700 px-1 rounded">{targetVariant.lengthFeet}'</span>}
                       </div>
                    </div>
                    {/* Calculation Preview */}
                    {targetGroup?.type === 'tin_bundle' && costRate && (
                       <div className="mt-2 text-[10px] text-slate-400">
                          হিসাব: ৳{Math.round(Number(costRate) / ((targetVariant.calculationBase||72)/targetVariant.lengthFeet))} / পিস
                       </div>
                    )}
                 </div>

                 <div className="flex gap-3 w-full md:w-auto">
                    <div className="w-24 shrink-0">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">
                         {getPriceLabel()}
                      </label>
                      <input type="number" className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white font-bold text-sm outline-none" placeholder="মূল্য" value={costRate} onChange={e => setCostRate(e.target.value)} />
                    </div>

                    <div className="w-32 shrink-0 relative">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">পরিমাণ (Pcs)</label>
                      <input type="number" className="w-full p-2.5 rounded-lg bg-white text-slate-900 font-bold text-sm outline-none" placeholder="পরিমাণ" value={quantity} onChange={e => setQuantity(e.target.value)} />
                      {targetGroup?.type === 'tin_bundle' && (
                          <div className="absolute right-1 top-[22px] flex bg-slate-200 rounded p-0.5">
                             <button onClick={() => setUnitMode('bundle')} className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition ${unitMode === 'bundle' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>বান</button>
                             <button onClick={() => setUnitMode('piece')} className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition ${unitMode === 'piece' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>পিস</button>
                          </div>
                      )}
                    </div>

                    <button onClick={handleAddToCart} className="bg-orange-500 text-white px-4 rounded-xl font-bold text-sm hover:bg-orange-400 shadow-lg transition h-[42px] mt-auto whitespace-nowrap">
                       যোগ
                    </button>
                 </div>
             </div>
          </div>
        )}
      </div>

      {/* Right: Cart Summary */}
      <div className="xl:col-span-5 flex flex-col h-full gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-[300px]">
          <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
             <span className="font-bold text-orange-900 flex items-center gap-2 text-sm"><ShoppingCart className="w-4 h-4 text-orange-600" /> ক্রয়ের তালিকা</span>
             <span className="bg-white text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold border border-orange-200">{cart.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/30">
             {cart.map((item, idx) => (
               <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-1 relative group hover:border-orange-400 transition">
                  <div className="flex justify-between items-start">
                     <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                     <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">৳{Math.round(item.subtotal).toLocaleString()}</div>
                     </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                     <span className="bg-slate-100 px-1.5 py-0.5 rounded">{item.formattedQty}</span>
                     <span>মূল্য/পিস: ৳{item.priceUnit}</span>
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"><Trash className="w-3 h-3" /></button>
               </div>
             ))}
          </div>
        </div>

        {/* Purchase Form */}
        <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-200">
           <div className="mb-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><User className="w-3 h-3" /> মহাজন / সাপ্লায়ার <span className="text-red-500">*</span></label>
              <div className="relative">
                 <select className={inputStyle} value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                    <option value="">সিলেক্ট করুন...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    <option value="new">+ নতুন সাপ্লায়ার</option>
                 </select>
              </div>
              {isNewSupplier && (
                 <div className="mt-2 p-3 bg-orange-50 rounded-xl space-y-2 animate-fade-in border border-orange-100">
                    <input className={inputStyle} placeholder="নাম" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
                    <input className={inputStyle} placeholder="মোবাইল" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} />
                 </div>
              )}
           </div>

           <div className="mt-2 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
               <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-[9px] font-bold uppercase mb-1 block">ভাউচার নং</label><input type="text" className={inputStyle} value={vendorInvoiceNo} onChange={e => setVendorInvoiceNo(e.target.value)} /></div>
                 <div><label className="text-[9px] font-bold uppercase mb-1 block">নোট</label><input type="text" className={inputStyle} value={purchaseNote} onChange={e => setPurchaseNote(e.target.value)} /></div>
               </div>
               <div className="flex justify-between items-center border-t border-slate-200 pt-2"><span className="text-slate-600 font-medium text-xs">ডিসকাউন্ট (-)</span><input type="number" className="w-20 text-right font-bold text-orange-600 bg-transparent outline-none" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} placeholder="0" /></div>
           </div>
           
           <div className="mt-3 grid grid-cols-2 gap-3">
              <div><label className="text-[9px] font-bold text-emerald-600 uppercase block mb-1">নগদ প্রদান</label><input type="number" className="w-full p-2 rounded-lg border border-emerald-200 font-bold text-emerald-700 outline-none" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0" /></div>
              <div className="text-right flex flex-col justify-center"><span className="text-[9px] font-bold text-red-500 uppercase block">বাকি</span><span className="text-lg font-bold text-red-600 block">৳{(cartFinal - (Number(paidAmount)||0)).toLocaleString()}</span></div>
           </div>

           <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full mt-4 bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-900 shadow-xl transition flex justify-center gap-2 items-center disabled:bg-slate-300">
             <CheckCircle className="w-4 h-4" /> ক্রয় নিশ্চিত করুন
           </button>
        </div>
      </div>
    </div>
  );
};
