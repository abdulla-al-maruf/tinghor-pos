
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ProductGroup, ProductVariant, CartItem, Sale, StoreSettings } from '../types';
import { ShoppingCart, CheckCircle, Trash, Layers, Tag, Calculator, User, Phone, Truck, FileText, MapPin, Save, PenTool, AlertCircle, X, Eye, EyeOff, TrendingUp, TrendingDown } from 'lucide-react';
import { ToastContext } from '../App';
import { generateId } from '../lib/utils';

interface POSProps {
  inventory: ProductGroup[];
  onCompleteSale: (sale: Sale) => void;
  settings: StoreSettings;
  sales: Sale[]; 
}

export const POS: React.FC<POSProps> = ({ inventory, onCompleteSale, settings }) => {
  const { notify } = useContext(ToastContext);
  
  const [cart, setCart] = useState<CartItem[]>(() => {
     const saved = localStorage.getItem('pos_draft_cart');
     return saved ? JSON.parse(saved) : [];
  });
  
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('pos_draft_name') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('pos_draft_phone') || '');
  const [customerAddress, setCustomerAddress] = useState(() => localStorage.getItem('pos_draft_address') || '');
  
  const [selProductType, setSelProductType] = useState<string>(''); 
  const [selBrand, setSelBrand] = useState<string>('');             
  const [selThickness, setSelThickness] = useState<string>('');     
  const [selColor, setSelColor] = useState<string>('');             
  const [selSize, setSelSize] = useState<number | null>(null);      

  const [manualName, setManualName] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [sellingRate, setSellingRate] = useState<string>(''); 
  const [unitMode, setUnitMode] = useState<'bundle' | 'piece'>('piece'); 
  
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [deliveryStatus, setDeliveryStatus] = useState<'delivered' | 'pending'>('delivered');
  const [saleNote, setSaleNote] = useState('');

  // New: Profit Visibility Toggle
  const [showProfit, setShowProfit] = useState(false);

  // --- Effects ---
  useEffect(() => {
    const timer = setInterval(() => {
       localStorage.setItem('pos_draft_cart', JSON.stringify(cart));
       localStorage.setItem('pos_draft_name', customerName);
       localStorage.setItem('pos_draft_phone', customerPhone);
       localStorage.setItem('pos_draft_address', customerAddress);
    }, 5000); 
    return () => clearInterval(timer);
  }, [cart, customerName, customerPhone, customerAddress]);

  useEffect(() => {
     if (!selProductType && settings.productTypes.length > 0) {
        setSelProductType(settings.productTypes[0]); 
     }
  }, [settings.productTypes]);

  // --- Derived State & Logic ---
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartFinal = cartTotal - (Number(discountAmount)||0);
  const due = cartFinal - (Number(paidAmount)||0);

  // Profit Calculation Logic
  const estimatedProfit = useMemo(() => {
    const discount = Number(discountAmount) || 0;
    const cartGross = cart.reduce((sum, item) => sum + item.subtotal, 0);
    // Distribute discount proportionally per item by revenue share
    return cart.reduce((sum, item) => {
      const cost = item.buyPriceUnit || 0;
      const itemDiscount = cartGross > 0 ? (item.subtotal / cartGross) * discount : 0;
      const effectiveRevenue = item.subtotal - itemDiscount;
      const itemCost = cost * item.quantityPieces;
      return sum + (effectiveRevenue - itemCost);
    }, 0);
  }, [cart, discountAmount]);

  useEffect(() => {
     if(cartFinal > 0 && !paidAmount) setPaidAmount(cartFinal.toString());
  }, [cartFinal]);

  const isManualMode = selProductType === 'অন্যান্য';

  const availableBrands = Array.from(new Set(inventory.filter(g => !selProductType || g.productType === selProductType).map(g => g.brand)));
  
  const availableThicknesses = Array.from(new Set(inventory.filter(g => 
    (!selProductType || g.productType === selProductType) && (!selBrand || g.brand === selBrand)
  ).map(g => g.thickness))).filter(Boolean);

  const availableColors = Array.from(new Set(inventory.filter(g => 
    (!selProductType || g.productType === selProductType) && (!selBrand || g.brand === selBrand) && (!selThickness || g.thickness === selThickness)
  ).map(g => g.color))).filter(Boolean);

  const targetGroup = !isManualMode ? inventory.find(g => 
    g.productType === selProductType && g.brand === selBrand && 
    (availableThicknesses.length === 0 || g.thickness === selThickness) && 
    (availableColors.length === 0 || g.color === selColor)
  ) : null;

  const availableSizes = targetGroup ? targetGroup.variants.map(v => v.lengthFeet).sort((a,b)=>a-b) : [];
  const targetVariant = targetGroup?.variants.find(v => v.lengthFeet === selSize);

  useEffect(() => {
    setSellingRate(''); 
    if (targetVariant) setUnitMode('piece'); 
  }, [targetVariant, targetGroup]);

  // --- Handlers ---
  const handleAddToCart = () => {
    const qtyNum = Number(quantity);
    const rateNum = Number(sellingRate); 

    if (!quantity || qtyNum <= 0) { notify('পরিমাণ (Quantity) লিখুন', 'error'); return; }
    if (!sellingRate || rateNum <= 0) { notify('বিক্রয় মূল্য (Rate) লিখুন', 'error'); return; }

    if (isManualMode) {
       if (!manualName) { notify('পণ্যের নাম লিখুন', 'error'); return; }
       setCart([...cart, {
          groupId: 'manual', variantId: generateId(), name: manualName, lengthFeet: 0, quantityPieces: qtyNum, subtotal: Math.round(qtyNum * rateNum),
          formattedQty: `${qtyNum} pcs`, priceUnit: rateNum, buyPriceUnit: 0, unitType: 'piece', calculationBase: 0
       }]);
       setManualName(''); setQuantity(''); setSellingRate(''); notify('অন্যান্য পণ্য যোগ হয়েছে', 'success'); return;
    }

    if (!targetGroup || !targetVariant) { notify('দয়া করে সব অপশন সিলেক্ট করুন', 'error'); return; }

    let qtyPieces = 0;
    let finalPrice = 0;
    let formattedQty = '';
    let itemPriceUnit = 0;

    // --- Unified Logic (Synced with Purchase.tsx) ---
    if (targetGroup.type === 'tin_bundle') {
       const base = targetVariant.calculationBase || 72;
       const length = targetVariant.lengthFeet;
       const piecesPerBundle = base / length; 

       if (unitMode === 'bundle') {
          qtyPieces = Math.round(qtyNum * piecesPerBundle);
          finalPrice = Math.round(qtyNum * rateNum);
          formattedQty = `${qtyNum} বান`;
          itemPriceUnit = Math.round((rateNum / piecesPerBundle) * 100) / 100;
       } else {
          // Rate is Bundle Rate, Selling Pieces
          qtyPieces = qtyNum;
          finalPrice = Math.round((qtyNum * rateNum) / piecesPerBundle);
          formattedQty = `${qtyNum} পিস`;
          itemPriceUnit = Math.round((rateNum / piecesPerBundle) * 100) / 100;
       }
    } else if (targetGroup.type === 'running_foot') {
       // DHALA Logic: Rate is Per Foot
       qtyPieces = qtyNum;
       const totalFeet = qtyPieces * targetVariant.lengthFeet;
       finalPrice = Math.round(totalFeet * rateNum); 
       formattedQty = `${qtyPieces} pcs (${totalFeet} ft)`;
       // Store Per Piece Price for internal calculation consistency
       itemPriceUnit = Math.round(targetVariant.lengthFeet * rateNum * 100) / 100;
    } else {
       qtyPieces = qtyNum;
       finalPrice = Math.round(qtyPieces * rateNum);
       formattedQty = `${qtyPieces} pcs`;
       itemPriceUnit = rateNum;
    }

    if (qtyPieces > targetVariant.stockPieces) {
      notify(`স্টক নেই! আছে মাত্র ${targetVariant.stockPieces} পিস।`, 'error');
      return;
    }

    const thicknessStr = targetGroup.thickness && targetGroup.thickness !== 'N/A' && targetGroup.thickness !== 'Standard' ? targetGroup.thickness : '';
    const colorStr = targetGroup.color && targetGroup.color !== 'N/A' ? targetGroup.color : '';
    const itemName = `${targetGroup.productType} | ${targetGroup.brand} | ${thicknessStr} ${colorStr} | ${targetVariant.lengthFeet}'`.replace(/\s+/g, ' ').trim();

    setCart([...cart, {
      groupId: targetGroup.id,
      variantId: targetVariant.id,
      name: itemName,
      lengthFeet: targetVariant.lengthFeet,
      calculationBase: targetVariant.calculationBase,
      quantityPieces: qtyPieces,
      subtotal: finalPrice,
      unitType: targetGroup.type === 'tin_bundle' ? unitMode : 'piece',
      formattedQty: formattedQty,
      priceUnit: itemPriceUnit, // Effective Price per Piece
      buyPriceUnit: targetVariant.averageCost || 0 
    }]);

    setQuantity('');
    notify('কার্টে যোগ হয়েছে', 'success');
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleCheckout = () => {
    if (cart.length === 0) { notify('কার্ট খালি!', 'error'); return; }
    if (!customerName) { notify('কাস্টমারের নাম লিখুন (আবশ্যক)', 'error'); return; }
    if (due > 0 && (!customerPhone || customerPhone.length < 11)) { notify('বাকি থাকলে মোবাইল নাম্বার অবশ্যই দিতে হবে', 'error'); return; }

    const subTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = Number(discountAmount) || 0;
    const final = subTotal - discount;
    const paid = Number(paidAmount) || 0;
    const currentDue = final - paid;

    onCompleteSale({
      id: generateId(),
      invoiceId: 'PENDING',
      customerName,
      customerPhone: customerPhone || 'N/A',
      customerAddress,
      items: cart,
      subTotal,
      discount,
      finalAmount: final,
      paidAmount: paid,
      dueAmount: currentDue, 
      timestamp: Date.now(),
      paymentHistory: paid > 0 ? [{ amount: paid, date: Date.now(), note: 'Initial' }] : [],
      deliveryStatus,
      soldBy: 'POS',
      note: saleNote
    });

    localStorage.removeItem('pos_draft_cart');
    localStorage.removeItem('pos_draft_name');
    localStorage.removeItem('pos_draft_phone');
    localStorage.removeItem('pos_draft_address');

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setPaidAmount('');
    setDiscountAmount('');
    setSaleNote('');
    setDeliveryStatus('delivered');
  };

  // --- UI Components ---
  const renderItemName = (name: string) => {
     if (!name.includes('|')) return <div className="font-bold text-slate-800 text-sm">{name}</div>;
     const parts = name.split('|').map(s => s.trim());
     return (
        <div className="flex flex-col items-start gap-0.5">
           <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded uppercase tracking-wider">{parts[0]}</span>
              <span className="text-sm font-extrabold text-blue-700">{parts[1]}</span>
           </div>
           <div className="flex items-center gap-1 flex-wrap">
               {parts[2] && <span className="text-[10px] font-medium bg-slate-50 border border-slate-100 px-1 rounded text-slate-600">{parts[2]}</span>}
               {parts[3] && <span className="text-xs font-bold text-slate-800 bg-yellow-100 px-1.5 rounded border border-yellow-200">{parts[3]}</span>}
           </div>
        </div>
     );
  };

  const getPriceLabel = () => {
     if (targetGroup?.type === 'tin_bundle') return 'রেট (বান)';
     if (targetGroup?.type === 'running_foot') return 'রেট (প্রতি ফুট)';
     return 'রেট (পিস)';
  };

  // Compact Button Style
  const getBtnClass = (active: boolean) => `
    px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm border whitespace-nowrap
    ${active 
      ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105' 
      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
    }
  `;
  
  const inputStyle = "w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm font-bold text-sm";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full font-bangla">
      <div className="xl:col-span-7 flex flex-col gap-4">
        
        {/* PRODUCT SELECTION PANEL */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
             <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
               <Layers className="w-4 h-4 text-blue-600" /> পণ্য নির্বাচন
             </h3>
             <div className="flex gap-2 overflow-x-auto max-w-[60%] no-scrollbar">
               {settings.productTypes.map(type => (
                 <button 
                   key={type} 
                   onClick={() => { setSelProductType(type); setSelBrand(''); setSelThickness(''); setSelColor(''); setSelSize(null); setManualName(''); }} 
                   className={`flex-none px-3 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap border ${selProductType === type ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                 >
                   {type}
                 </button>
               ))}
             </div>
          </div>

          <div className="space-y-5 animate-fade-in">
             {isManualMode ? (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                   <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2 text-sm"><PenTool className="w-4 h-4"/> ম্যানুয়াল এন্ট্রি</h4>
                   <input type="text" className={inputStyle} placeholder="পণ্যের নাম লিখুন" value={manualName} onChange={e => setManualName(e.target.value)} autoFocus />
                </div>
             ) : (
             <>
             {/* 1. Brands */}
             {availableBrands.length > 0 && (
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">ব্র্যান্ড</label>
                  <div className="flex flex-wrap gap-2">
                     {availableBrands.map(b => <button key={b} onClick={() => { setSelBrand(b); setSelThickness(''); setSelColor(''); setSelSize(null); }} className={getBtnClass(selBrand === b)}>{b}</button>)}
                  </div>
               </div>
             )}

             {/* 2. Thickness & Color (Side by Side) */}
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

             {/* 3. Size Grid (Compact) */}
             {((availableThicknesses.length === 0 || selThickness) && (availableColors.length === 0 || selColor) && selBrand) && (
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">সাইজ / মাপ (ফুট)</label>
                  {availableSizes.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                       {availableSizes.map(s => (
                         <button 
                           key={s} 
                           onClick={() => setSelSize(s)} 
                           className={`h-10 rounded-lg text-sm font-bold border transition flex items-center justify-center shadow-sm 
                             ${selSize === s 
                               ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200' 
                               : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                             }`}
                         >
                           {s}'
                         </button>
                       ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-xs text-red-400 font-bold">স্টক নেই</div>
                  )}
               </div>
             )}
             </>
             )}
          </div>
        </div>

        {/* INPUT & ACTION PANEL */}
        {(targetVariant || isManualMode) && (
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl animate-fade-in relative overflow-hidden border border-slate-700">
             <div className="flex flex-col md:flex-row gap-4 items-end relative z-10">
                 <div className="flex-1 w-full">
                    <div className="flex items-center justify-between mb-2">
                       <span className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wide"><CheckCircle className="w-3 h-3" /> নির্বাচিত পণ্য</span>
                       {!isManualMode && targetVariant && <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">স্টক: <b className="text-white">{targetVariant.stockPieces}</b> pcs</span>}
                    </div>
                    
                    {isManualMode ? (
                        <h4 className="text-lg font-bold text-white mb-1 truncate">{manualName || 'পণের নাম লিখুন...'}</h4>
                    ) : (
                        <div className="flex flex-col">
                           <h4 className="text-xl font-bold text-white tracking-tight leading-tight mb-1">{targetGroup?.brand} <span className="text-base font-normal text-slate-300">{targetGroup?.productType}</span></h4>
                           <div className="flex gap-2 text-xs text-slate-400">
                              {targetGroup?.color && targetGroup.color !== 'N/A' && <span>{targetGroup.color}</span>}
                              {targetGroup?.thickness && targetGroup.thickness !== 'N/A' && <span className="text-yellow-400">{targetGroup.thickness}</span>}
                              {targetVariant && <span className="text-white bg-slate-700 px-1 rounded">{targetVariant.lengthFeet}'</span>}
                           </div>
                        </div>
                    )}
                 </div>

                 <div className="flex gap-3 w-full md:w-auto">
                    <div className="w-24 shrink-0">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">
                         {getPriceLabel()}
                      </label>
                      <input type="number" className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white font-bold text-sm outline-none focus:border-blue-500" placeholder="Rate" value={sellingRate} onChange={e => setSellingRate(e.target.value)} />
                    </div>

                    <div className="w-32 shrink-0 relative">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">পরিমাণ (Pcs)</label>
                      <input type="number" className="w-full p-2.5 rounded-lg bg-white text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Qty" value={quantity} onChange={e => setQuantity(e.target.value)} />
                      {targetGroup?.type === 'tin_bundle' && (
                          <div className="absolute right-1 top-[22px] flex bg-slate-200 rounded p-0.5">
                             <button onClick={() => setUnitMode('bundle')} className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition ${unitMode === 'bundle' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>বান</button>
                             <button onClick={() => setUnitMode('piece')} className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition ${unitMode === 'piece' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>পিস</button>
                          </div>
                      )}
                    </div>

                    <button onClick={handleAddToCart} className="bg-emerald-500 text-emerald-950 px-4 rounded-xl font-bold text-sm hover:bg-emerald-400 shadow-lg transition h-[42px] mt-auto whitespace-nowrap">
                       যোগ
                    </button>
                 </div>
             </div>
          </div>
        )}
      </div>

      {/* CART & CHECKOUT SECTION */}
      <div className="xl:col-span-5 flex flex-col h-full gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-[300px]">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
             <span className="font-bold text-slate-800 flex items-center gap-2 text-sm"><ShoppingCart className="w-4 h-4 text-blue-600" /> কার্ট লিস্ট</span>
             <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{cart.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/30">
             {cart.map((item, idx) => (
               <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-1 relative group hover:border-blue-400 transition">
                  <div className="flex justify-between items-start">
                     <div className="flex-1 pr-2">{renderItemName(item.name)}</div>
                     <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">৳{Math.round(item.subtotal).toLocaleString()}</div>
                     </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                     <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{item.formattedQty}</span>
                     <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> @৳{Math.round(item.priceUnit).toLocaleString()}</span>
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="absolute -top-2 -right-2 bg-white text-red-500 p-1.5 rounded-full shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition hover:bg-red-500 hover:text-white"><Trash className="w-3 h-3" /></button>
               </div>
             ))}
             {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-10">
                   <ShoppingCart className="w-8 h-8 opacity-20 mb-2" />
                   <p className="text-xs">কার্ট ফাঁকা</p>
                </div>
             )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-200">
           <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">নাম <span className="text-red-500">*</span></label><input type="text" className={inputStyle} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="নাম" /></div>
                 <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">মোবাইল</label><input type="text" className={`${inputStyle} ${due > 0 && !customerPhone ? 'border-red-300 bg-red-50' : ''}`} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="017..." /></div>
              </div>
              
              <div><input type="text" className={inputStyle} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="ঠিকানা..." /></div>
              
              <div className="grid grid-cols-2 gap-3">
                 <div className="flex bg-slate-100 rounded-lg p-1"><button onClick={() => setDeliveryStatus('delivered')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition ${deliveryStatus === 'delivered' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500'}`}>Delivered</button><button onClick={() => setDeliveryStatus('pending')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition ${deliveryStatus === 'pending' ? 'bg-white text-amber-600 shadow' : 'text-slate-500'}`}>Pending</button></div>
                 <div className="flex items-center gap-2 border-b border-slate-300 px-1"><span className="text-[10px] font-bold text-slate-500">ছাড়</span><input type="number" className="w-full text-right font-bold text-red-600 bg-transparent outline-none" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} placeholder="0" /></div>
              </div>
           </div>
           
           {/* Profit Monitor (Toggle) */}
           <div className="mt-3">
              <div className="flex items-center justify-between">
                 <button onClick={() => setShowProfit(!showProfit)} className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-blue-600 transition">
                    {showProfit ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>} 
                    {showProfit ? 'লাভ লুকান' : 'লাভ দেখুন (গোপন)'}
                 </button>
                 {showProfit && (
                    <div className={`text-xs font-bold flex items-center gap-1 ${estimatedProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                       {estimatedProfit >= 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                       আনুমানিক লাভ: ৳{Math.round(estimatedProfit).toLocaleString()}
                    </div>
                 )}
              </div>
           </div>
           
           <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2 space-y-1">
              <div className="flex justify-between items-center text-sm text-slate-600"><span>মোট বিল</span><span className="font-bold">৳{cartTotal.toLocaleString()}</span></div>
              <div className="flex justify-between items-center text-lg text-slate-800 font-extrabold border-t border-slate-200 pt-1"><span>সর্বমোট</span><span>৳{cartFinal.toLocaleString()}</span></div>
           </div>

           <div className="mt-3 grid grid-cols-2 gap-3">
              <div><label className="text-[9px] font-bold text-emerald-600 uppercase block">জমা</label><input type="number" className="w-full p-2 rounded-lg border border-emerald-200 font-bold text-emerald-700 outline-none" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0" /></div>
              <div className="text-right flex flex-col justify-center"><span className="text-[9px] font-bold text-red-500 uppercase block">বাকি</span><span className="text-lg font-bold text-red-600">৳{(cartFinal - (Number(paidAmount)||0)).toLocaleString()}</span></div>
           </div>

           <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex justify-center gap-2 items-center disabled:bg-slate-300 text-sm"><CheckCircle className="w-4 h-4" /> কনফার্ম করুন</button>
        </div>
      </div>
    </div>
  );
};
