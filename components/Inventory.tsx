
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { ProductGroup, StoreSettings, CalculationMode, StockLog, ProductVariant, User } from '../types';
import { Plus, Trash2, ChevronDown, ChevronUp, Package, Search, Save, Eye, EyeOff } from 'lucide-react';
import { ToastContext } from '../lib/contexts';
import { generateId } from '../lib/utils';
import { recalcAvgCost, calculateStockEntry } from '../lib/pricing';

interface StockEntryInput {
  length: number;
  base: number;
  buyPrice: number;
  qtyInput: string;
  qtyMode: 'bundle' | 'piece';
}

interface ProductGroupCardProps {
  group: ProductGroup;
  isExpanded: boolean;
  onToggleExpand: (id: string | null) => void;
  onDeleteGroup: (group: ProductGroup) => void;
  onStockUpdate: (groupId: string, groupType: CalculationMode, stockEntry: StockEntryInput) => void;
  inputStyle: string;
  variantIndexByGroup?: Record<string, Record<number, ProductVariant>>;
}

interface InventoryProps {
  inventory: ProductGroup[];
  inventoryById?: Record<string, ProductGroup>; // Optional indexed map for O(1) lookups
  variantIndexByGroup?: Record<string, Record<number, ProductVariant>>; // Optional variant index
  setInventory: React.Dispatch<React.SetStateAction<ProductGroup[]>>;
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  stockLogs?: StockLog[];
  onStockAdd?: (groupId: string, updatedVariants: ProductVariant[], log: StockLog, newGroup?: ProductGroup) => void;
  currentUser: User | null;
}

// --- Memoized Individual Group Card ---
const ProductGroupCard = React.memo(({ 
  group, 
  isExpanded, 
  onToggleExpand, 
  onDeleteGroup, 
  onStockUpdate, 
  inputStyle,
  variantIndexByGroup // Pass the variant index down
}: ProductGroupCardProps) => {
  const [stockEntry, setStockEntry] = useState<StockEntryInput>({
    length: 6,
    base: 72,
    buyPrice: 0,
    qtyInput: '',
    qtyMode: 'bundle'
  });
  const [showCost, setShowCost] = useState<Record<string, boolean>>({}); 

  const getBundleDisplay = (g: ProductGroup, v: ProductVariant) => {
     if (g.type === 'tin_bundle' && v.calculationBase) {
       const pcsPerBan = v.calculationBase / v.lengthFeet;
       const pcs = v.stockPieces;
       const bundles = Math.floor(pcs / pcsPerBan);
       const remainder = Math.round(pcs % pcsPerBan);
       return bundles + ' বান ' + remainder + ' পিস';
     }
     return '-';
  };

  const getPriceLabel = () => {
     if (group.type === 'tin_bundle') return 'ক্রয় মূল্য (প্রতি বান)';
     if (group.type === 'running_foot') return 'ক্রয় মূল্য (প্রতি ফুট)';
     return 'ক্রয় মূল্য (প্রতি পিস)';
  };

  // Predefined sizes for quick selection
  const commonSizes = [6,7,8,9,10,12]; 

  return (
    <div className={`bg-white rounded-xl border transition duration-200 overflow-hidden ${isExpanded ? 'border-blue-300 shadow-md' : 'border-slate-200 hover:border-blue-200 hover:shadow-sm'}`}>
      
      {/* Header Row - Clickable to toggle */}
      <div 
        className="p-4 flex justify-between items-center cursor-pointer bg-white group select-none"
        onClick={() => onToggleExpand(isExpanded ? null : group.id)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm border border-opacity-50
             ${group.type === 'tin_bundle' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
               group.type === 'running_foot' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
               'bg-purple-50 text-purple-600 border-purple-100'}`}>
            {group.brand[0]}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              {group.brand} 
              <span className="text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{group.productType}</span>
            </h3>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
               {group.thickness && group.thickness !== 'N/A' && group.thickness !== 'Standard' && <span>{group.thickness}</span>}
               {group.color && group.color !== 'N/A' && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{group.color}</span>}
            </div>
          </div>
        </div>
        
        {/* Toggle Arrow */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${isExpanded ? 'bg-blue-50 text-blue-600 rotate-180' : 'text-slate-400 bg-slate-50 group-hover:bg-slate-100'}`}>
           <ChevronDown className="w-5 h-5" />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-fade-in">
          
          {/* Quick Stock Entry */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Package className="w-4 h-4 text-emerald-600" />
              স্টক এন্ট্রি (মাল ক্রয়)
            </h4>
            
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* Size Selector */}
              <div className="col-span-2 lg:col-span-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">সাইজ (ফুট)</label>
                {group.type === 'tin_bundle' ? (
                   <div className="flex flex-wrap gap-1">
                      {commonSizes.map(s => (
                         <button 
                           key={s} 
                            onClick={() => {
                               const l = s;
                               // Use variant index for O(1) lookup if available
                               const variant = variantIndexByGroup && variantIndexByGroup[group.id] 
                                 ? variantIndexByGroup[group.id][l]
                                 : group.variants.find((v: ProductVariant) => v.lengthFeet === l);
                               const base = variant?.calculationBase || (l > 12 ? 70 : (l === 7 || l === 10 ? 70 : 72));
                               setStockEntry(p => ({...p, length: l, base}));
                            }}
                           className={`w-8 h-8 rounded text-xs font-bold border transition ${stockEntry.length === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                         >
                            {s}
                         </button>
                      ))}
                      <input 
                        type="number" 
                        className="w-12 h-8 p-1 text-xs font-bold border border-slate-200 rounded text-center focus:border-blue-500 outline-none" 
                        value={stockEntry.length} 
                            onChange={e => {
                               const l = Number(e.target.value);
                               // Use variant index for O(1) lookup if available
                               const variant = variantIndexByGroup && variantIndexByGroup[group.id]
                                 ? variantIndexByGroup[group.id][l]
                                 : group.variants.find((v: ProductVariant) => v.lengthFeet === l);
                               const base = variant?.calculationBase || (l > 12 ? 70 : (l === 7 || l === 10 ? 70 : 72));
                               setStockEntry(p => ({...p, length: l, base}));
                            }}
                        placeholder=".."
                      />
                   </div>
                ) : (
                  <input type="number" className="w-full p-2 text-sm border rounded-lg outline-none focus:border-blue-500" value={stockEntry.length} onChange={e => setStockEntry(p => ({...p, length: Number(e.target.value)}))} placeholder="Size" />
                )}
              </div>

              {group.type === 'tin_bundle' && (
                <div className="col-span-1 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">বেস</label>
                  <input type="number" className="w-full p-2 text-sm border rounded-lg bg-slate-50 text-center font-bold" value={stockEntry.base} onChange={e => setStockEntry(p => ({...p, base: Number(e.target.value)}))} />
                </div>
              )}

              <div className="col-span-1 lg:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                   {getPriceLabel()}
                </label>
                <input type="number" className="w-full p-2 text-sm border rounded-lg outline-none focus:border-blue-500" value={stockEntry.buyPrice || ''} onChange={e => setStockEntry(p => ({...p, buyPrice: Number(e.target.value)}))} placeholder="0" />
              </div>
              
              <div className="col-span-2 lg:col-span-2 relative">
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">পরিমাণ</label>
                 <input type="number" placeholder="Qty" className="w-full p-2 text-sm border rounded-lg outline-none focus:border-blue-500 font-bold" value={stockEntry.qtyInput} onChange={e => setStockEntry(p => ({...p, qtyInput: e.target.value}))} />
                 {group.type === 'tin_bundle' && (
                   <div className="absolute right-1 top-[22px] bg-slate-100 rounded p-0.5 flex">
                      <button onClick={() => setStockEntry(p => ({...p, qtyMode: 'bundle'}))} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${stockEntry.qtyMode === 'bundle' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>বান</button>
                      <button onClick={() => setStockEntry(p => ({...p, qtyMode: 'piece'}))} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${stockEntry.qtyMode === 'piece' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>পিস</button>
                   </div>
                 )}
              </div>

              <div className="col-span-2 lg:col-span-2">
                 <button 
                   onClick={() => {
                      onStockUpdate(group.id, group.type, stockEntry);
                      setStockEntry(p => ({...p, qtyInput: '', buyPrice: 0}));
                   }}
                   className="w-full bg-slate-800 text-white py-2 rounded-lg font-bold hover:bg-slate-900 transition flex justify-center items-center gap-2 text-xs h-[38px]"
                 >
                   <Save className="w-3 h-3" /> আপডেট
                 </button>
              </div>
            </div>
          </div>

          {/* Current Stock Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">সাইজ</th>
                  {group.type === 'tin_bundle' && <th className="p-3">বেস</th>}
                  <th className="p-3 text-center">মজুদ (পিস)</th>
                  {group.type === 'tin_bundle' && <th className="p-3 text-center">মজুদ (বান)</th>}
                  <th className="p-3 text-right">Avg Cost (পিস)</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 text-sm divide-y divide-slate-50">
                {group.variants.map((v: ProductVariant) => (
                  <tr key={v.id} className="hover:bg-blue-50/50 transition">
                    <td className="p-3 font-bold">{v.lengthFeet}'</td>
                    {group.type === 'tin_bundle' && <td className="p-3 text-slate-400 text-xs">{v.calculationBase}</td>}
                    <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${v.stockPieces < 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{v.stockPieces}</span>
                    </td>
                    {group.type === 'tin_bundle' ? <td className="p-3 text-center text-slate-500 text-xs">{getBundleDisplay(group, v)}</td> : <td className="p-3 text-center">-</td>}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {showCost[v.id] ? <span className="font-mono font-bold text-xs">৳{(v.avgCostPrice || 0).toFixed(2)}</span> : <span className="text-slate-300 text-[10px]">Hidden</span>}
                        <button onClick={() => setShowCost(p => ({...p, [v.id]: !p[v.id]}))} className="text-slate-300 hover:text-blue-500">
                          {showCost[v.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {group.variants.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400 text-xs">স্টক খালি</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end">
            <button onClick={() => onDeleteGroup(group)} className="text-red-400 hover:text-red-600 px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition">
              <Trash2 className="w-3 h-3" /> ডিলিট পেজ
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export const Inventory: React.FC<InventoryProps> = ({ 
  inventory, 
  inventoryById, 
  variantIndexByGroup,
  setInventory, 
  settings, 
  onStockAdd, 
  currentUser 
}) => {
  const { notify } = useContext(ToastContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState<Partial<ProductGroup>>({
    productType: settings.productTypes[0] || 'ঢেউ টিন',
    brand: settings.brands[0] || '',
    color: settings.colors[0] || '',
    thickness: settings.thicknesses[0] || '',
    type: 'tin_bundle', 
    customValues: {}, 
    variants: []
  });

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; targetId: string | null; targetName: string; typedName: string; }>({ isOpen: false, targetId: null, targetName: '', typedName: '' });
  // Ensure we can toggle correctly. Use a string ID or null.
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // ── নতুন মাল wizard (এক স্ক্রিনে: ধরন→ব্র্যান্ড→...→সাইজ→পরিমাণ→দাম) ──
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wiz, setWiz] = useState({
    productType: settings.productTypes[0] || 'ঢেউ টিন',
    brand: '',
    thickness: '',
    color: '',
    type: 'tin_bundle' as CalculationMode,
    size: '',
    base: '72',
    qty: '',
    qtyMode: 'bundle' as 'bundle' | 'piece',
    buyPrice: '',
  });
  const setW = (patch: Partial<typeof wiz>) => setWiz(p => ({ ...p, ...patch }));

  const handleWizardSave = (keepOpen: boolean) => {
    const size = Number(wiz.size);
    const qty = Number(wiz.qty);
    const rate = Number(wiz.buyPrice);
    if (!wiz.brand) { notify('ব্র্যান্ড দিন', 'error'); return; }
    if (!size || size <= 0) { notify('সাইজ দিন', 'error'); return; }
    if (!qty || qty <= 0) { notify('পরিমাণ দিন', 'error'); return; }
    if (!rate || rate <= 0) { notify('ক্রয়মূল্য দিন', 'error'); return; }

    const color = wiz.color || 'N/A';
    const thickness = wiz.thickness || 'Standard';

    // আগে থেকে একই group আছে কিনা (ধরন+ব্র্যান্ড+কালার+মিলি)
    const existing = inventory.find(g =>
      g.productType === wiz.productType && g.brand === wiz.brand &&
      g.color === color && g.thickness === thickness
    );
    const groupType: CalculationMode = existing ? existing.type : wiz.type;
    const base = groupType === 'tin_bundle' ? (Number(wiz.base) || 72) : 0;

    const { piecesToAdd, costPerPiece } = calculateStockEntry({
      groupType, quantity: qty, rate, length: size, base, qtyMode: wiz.qtyMode,
    });

    const groupId = existing ? existing.id : generateId();
    const baseVariants = existing ? existing.variants : [];
    const idx = baseVariants.findIndex(v => v.lengthFeet === size);
    let updatedVariants: ProductVariant[];
    let newLevel: number;

    if (idx >= 0) {
      const cur = baseVariants[idx];
      const avg = recalcAvgCost({
        currentStock: cur.stockPieces,
        currentAvgCost: cur.avgCostPrice || 0,
        incomingQty: piecesToAdd,
        incomingCostPerUnit: costPerPiece,
      });
      newLevel = avg.newTotalStock;
      updatedVariants = baseVariants.map((v, i) => i === idx
        ? { ...v, stockPieces: avg.newTotalStock, avgCostPrice: avg.newAvgCost, calculationBase: groupType === 'tin_bundle' ? base : v.calculationBase }
        : v);
    } else {
      newLevel = piecesToAdd;
      updatedVariants = [...baseVariants, {
        id: generateId(),
        lengthFeet: size,
        calculationBase: groupType === 'tin_bundle' ? base : undefined,
        stockPieces: piecesToAdd,
        reservedQty: 0,
        avgCostPrice: costPerPiece,
      }].sort((a, b) => a.lengthFeet - b.lengthFeet);
    }

    const newGroup: ProductGroup | undefined = existing ? undefined : {
      id: groupId, productType: wiz.productType, brand: wiz.brand,
      color, thickness, type: groupType, customValues: {}, variants: [],
    };

    const log: StockLog = {
      id: generateId(), date: Date.now(),
      productName: `${wiz.brand} ${thickness} ${color} (${size}')`,
      quantityAdded: piecesToAdd, costPrice: rate, newStockLevel: newLevel, note: 'নতুন মাল',
    };

    onStockAdd?.(groupId, updatedVariants, log, newGroup);

    if (keepOpen) {
      // ধরন/ব্র্যান্ড/মিলি/কালার রেখে শুধু সাইজ-পরিমাণ-দাম ফাঁকা
      setW({ size: '', qty: '', buyPrice: '' });
    } else {
      setWizardOpen(false);
    }
  };

  const filteredGroups = useMemo(() => {
    return inventory.filter(g => 
      g.productType?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.brand.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.thickness.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.color.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  const handleCreateGroup = () => {
    if (!newGroup.brand || !newGroup.productType) {
       notify("পণ্যের ধরন এবং ব্র্যান্ড আবশ্যক", "error");
       return;
    }

    const group: ProductGroup = {
      id: generateId(),
      productType: newGroup.productType || 'অন্যান্য',
      brand: newGroup.brand,
      color: newGroup.color || 'N/A',
      thickness: newGroup.thickness || 'Standard',
      type: newGroup.type || 'tin_bundle',
      customValues: newGroup.customValues || {},
      variants: []
    };
     setInventory((prev: ProductGroup[]) => [...prev, group]);
    setIsCreatingGroup(false);
    notify("নতুন ক্যাটাগরি তৈরি হয়েছে", "success");
  };

  const handleStockUpdate = (groupId: string, groupType: CalculationMode, stockEntry: StockEntryInput) => {
    const qty = Number(stockEntry.qtyInput);
    const incomingRate = Number(stockEntry.buyPrice);

    if (!qty) { notify("পরিমাণ দেওয়া আবশ্যক", "error"); return; }
    
    let piecesToAdd = 0;
    const { base, length } = stockEntry;
    
    // --- COST CALCULATION (Synced) ---
    let incomingCostPerPiece = 0;

    if (groupType === 'tin_bundle') {
       const piecesPerBundle = base / length;
       if (stockEntry.qtyMode === 'bundle') {
         piecesToAdd = Math.round((qty * base) / length);
         incomingCostPerPiece = incomingRate / piecesPerBundle;
       } else {
         piecesToAdd = qty;
         incomingCostPerPiece = incomingRate / piecesPerBundle;
       }
    } else if (groupType === 'running_foot') {
       // DHALA LOGIC: User inputs Qty (Pieces) and Cost Per Foot.
       // We calculate cost per piece = length * cost_per_foot
       piecesToAdd = qty;
       incomingCostPerPiece = incomingRate * length;
    } else {
       // Fixed Piece (Screw, etc)
       piecesToAdd = qty; 
       incomingCostPerPiece = incomingRate;
    }

    // Use indexed map for O(1) lookup if available
    const group = inventoryById ? inventoryById[groupId] : inventory.find(g => g.id === groupId);
    if (!group) return;

    // Use variant index for O(1) lookup if available
    let existingIndex = -1;
    let existingVariant = null;
    
    if (variantIndexByGroup && variantIndexByGroup[groupId]) {
      existingVariant = variantIndexByGroup[groupId][length];
      if (existingVariant) {
        existingIndex = group.variants.findIndex(v => v.id === existingVariant!.id);
      }
    } else {
      // Fall back to O(n) search
      existingIndex = group.variants.findIndex(v => v.lengthFeet === length);
    }
    let updatedVariants = [...group.variants];

    if (existingIndex >= 0) {
      const currentStock = updatedVariants[existingIndex].stockPieces;
      const currentAvgCost = updatedVariants[existingIndex].avgCostPrice || 0;
      const avg = recalcAvgCost({
        currentStock,
        currentAvgCost,
        incomingQty: piecesToAdd,
        incomingCostPerUnit: incomingCostPerPiece,
      });
      const newTotalStock = avg.newTotalStock;
      const newAvgCost = Math.round(avg.newAvgCost);

      updatedVariants[existingIndex] = {
        ...updatedVariants[existingIndex],
        stockPieces: newTotalStock,
        avgCostPrice: newAvgCost,
        calculationBase: groupType === 'tin_bundle' ? base : undefined
      };
    } else {
      updatedVariants.push({
        id: generateId(),
        lengthFeet: length,
        calculationBase: groupType === 'tin_bundle' ? base : undefined,
        stockPieces: piecesToAdd,
        reservedQty: 0,
        avgCostPrice: Math.round(incomingCostPerPiece)
      });
    }
    updatedVariants.sort((a, b) => a.lengthFeet - b.lengthFeet);

    if (onStockAdd) {
       const log: StockLog = {
          id: generateId(),
          date: Date.now(),
          productName: `${group.brand} ${group.thickness} ${group.color} (${length}')`,
          quantityAdded: piecesToAdd,
          costPrice: incomingRate, 
          newStockLevel: existingIndex >= 0 ? updatedVariants[existingIndex].stockPieces : piecesToAdd,
          note: 'Manual Entry'
       };
       onStockAdd(groupId, updatedVariants, log);
    }
  };

  const initiateDeleteGroup = (group: ProductGroup) => {
    setDeleteModal({
      isOpen: true,
      targetId: group.id,
      targetName: `${group.brand} ${group.color}`,
      typedName: ''
    });
  };

  const executeDelete = () => {
    if (deleteModal.targetId) {
       setInventory((prev: ProductGroup[]) => prev.filter(g => g.id !== deleteModal.targetId));
      notify("পেজ ডিলিট করা হয়েছে", "success");
    }
    setDeleteModal({ isOpen: false, targetId: null, targetName: '', typedName: '' });
  };

  const inputStyle = "w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium";

  return (
    <div className="space-y-6 font-bangla pb-20">
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-slate-600 mb-6 text-sm">নিশ্চিত করতে নিচের বক্সে <span className="font-bold text-red-600">"{deleteModal.targetName}"</span> লিখুন।</p>
              <input type="text" className="w-full p-3 border border-red-200 rounded-xl text-center mb-4 focus:ring-red-500 focus:outline-none" value={deleteModal.typedName} onChange={e => setDeleteModal({...deleteModal, typedName: e.target.value})} autoFocus />
              <div className="flex gap-3">
                 <button onClick={() => setDeleteModal({ isOpen: false, targetId: null, targetName: '', typedName: '' })} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold">বাতিল</button>
                 <button onClick={executeDelete} disabled={deleteModal.typedName !== deleteModal.targetName} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50">ডিলিট করুন</button>
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
          <input type="text" placeholder="ব্র্যান্ড বা টাইপ খুঁজুন..." className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => setWizardOpen(true)} className="w-full md:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 text-sm shadow-md hover:bg-blue-700 transition">
           <Plus className="w-4 h-4" /> নতুন মাল
        </button>
      </div>

      {wizardOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={() => setWizardOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Package className="w-5 h-5 text-emerald-600" /> নতুন মাল তোলা</h3>
              <button onClick={() => setWizardOpen(false)} className="text-slate-400 hover:text-slate-600"><Plus className="w-6 h-6 rotate-45" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">পণ্যের ধরন</label>
                  <select className={inputStyle} value={wiz.productType} onChange={e => setW({ productType: e.target.value })}>
                    {settings.productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">হিসাবের একক</label>
                  <div className="flex gap-1">
                    <button onClick={() => setW({ type: 'tin_bundle' })} className={`flex-1 py-2.5 rounded-lg font-bold text-[11px] ${wiz.type === 'tin_bundle' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>বান</button>
                    <button onClick={() => setW({ type: 'running_foot' })} className={`flex-1 py-2.5 rounded-lg font-bold text-[11px] ${wiz.type === 'running_foot' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>ফুট</button>
                    <button onClick={() => setW({ type: 'fixed_piece' })} className={`flex-1 py-2.5 rounded-lg font-bold text-[11px] ${wiz.type === 'fixed_piece' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>পিস</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">ব্র্যান্ড</label>
                  <select className={inputStyle} value={wiz.brand} onChange={e => setW({ brand: e.target.value })}>
                    <option value="">—</option>{settings.brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">মিলি</label>
                  <select className={inputStyle} value={wiz.thickness} onChange={e => setW({ thickness: e.target.value })}>
                    <option value="">—</option>{settings.thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">কালার</label>
                  <select className={inputStyle} value={wiz.color} onChange={e => setW({ color: e.target.value })}>
                    <option value="">—</option>{settings.colors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-3 border border-slate-100">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">সাইজ (ফুট)</label>
                  <input type="number" className={inputStyle} value={wiz.size} onChange={e => setW({ size: e.target.value })} placeholder="যেমন ৮" />
                </div>
                {wiz.type === 'tin_bundle' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">বান বেস</label>
                    <div className="flex gap-1">
                      {['70', '72'].map(b => <button key={b} onClick={() => setW({ base: b })} className={`flex-1 py-2.5 rounded-lg text-xs font-bold ${wiz.base === b ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{b}</button>)}
                    </div>
                  </div>
                )}
                <div className="relative">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">পরিমাণ</label>
                  <input type="number" className={inputStyle} value={wiz.qty} onChange={e => setW({ qty: e.target.value })} placeholder="0" />
                  {wiz.type === 'tin_bundle' && (
                    <div className="absolute right-1 top-[26px] flex bg-slate-200 rounded p-0.5">
                      <button onClick={() => setW({ qtyMode: 'bundle' })} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${wiz.qtyMode === 'bundle' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>বান</button>
                      <button onClick={() => setW({ qtyMode: 'piece' })} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${wiz.qtyMode === 'piece' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>পিস</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                    {wiz.type === 'tin_bundle' ? 'ক্রয়মূল্য (বান)' : wiz.type === 'running_foot' ? 'ক্রয়মূল্য (ফুট)' : 'ক্রয়মূল্য (পিস)'}
                  </label>
                  <input type="number" className={inputStyle} value={wiz.buyPrice} onChange={e => setW({ buyPrice: e.target.value })} placeholder="0" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-100">
              <button onClick={() => handleWizardSave(true)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition text-sm">সেভ করে আরেকটা</button>
              <button onClick={() => handleWizardSave(false)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition text-sm">সেভ ও বন্ধ</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredGroups.map(group => (
            <ProductGroupCard 
               key={group.id} 
               group={group} 
               isExpanded={editingGroupId === group.id} 
               onToggleExpand={setEditingGroupId} 
               onDeleteGroup={initiateDeleteGroup} 
               onStockUpdate={handleStockUpdate} 
               inputStyle={inputStyle}
               variantIndexByGroup={variantIndexByGroup}
            />
        ))}
      </div>
    </div>
  );
};
