import React, { useState } from 'react';
import { Sale, CartItem, ProductGroup, StoreSettings } from '../../types';
import { X, Edit, Plus, Trash2 } from 'lucide-react';
import { calculateLineItem, makeCartItem } from '../../lib/pricing';

interface EditSaleModalProps {
  editingSale: Sale;
  inventory: ProductGroup[];
  setInventory: (inv: ProductGroup[]) => void;
  settings?: StoreSettings;
  onUpdateSale: (sale: Sale) => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onClose: () => void;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  editingSale, inventory, setInventory, settings, onUpdateSale, notify, onClose,
}) => {
  const [editForm, setEditForm] = useState({
    customerName: editingSale.customerName,
    customerPhone: editingSale.customerPhone,
    customerAddress: editingSale.customerAddress || '',
    paidAmount: editingSale.paidAmount,
    discount: editingSale.discount,
    items: JSON.parse(JSON.stringify(editingSale.items)) as CartItem[],
  });

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selProductType, setSelProductType] = useState(settings?.productTypes[0] || '');
  const [selBrand, setSelBrand] = useState('');
  const [selSize, setSelSize] = useState<number | null>(null);
  const [addQty, setAddQty] = useState('');
  const [addRate, setAddRate] = useState('');

  const getSelectorData = () => {
    if (!inventory || !settings) return { brands: [], sizes: [], targetVariant: null, group: null };
    const brands = Array.from(new Set(
      inventory.filter(g => !selProductType || g.productType === selProductType).map(g => g.brand)
    ));
    const group = inventory.find(g => g.productType === selProductType && g.brand === selBrand);
    const sizes = group ? group.variants.map(v => v.lengthFeet).sort((a, b) => a - b) : [];
    const targetVariant = group?.variants.find(v => v.lengthFeet === selSize) || null;
    return { brands, sizes, targetVariant, group: group || null };
  };

  const { brands, sizes, targetVariant } = getSelectorData();

  const handleAddItem = () => {
    const { targetVariant, group } = getSelectorData();
    if (!group || !targetVariant || !addQty || !addRate) return;
    const qty = Number(addQty);
    const rate = Number(addRate);
    if (qty <= 0) return;
    const calc = calculateLineItem({
      groupType: group.type,
      variant: targetVariant,
      quantity: qty,
      rate,
      unitMode: 'piece',
    });
    const newItem: CartItem = makeCartItem({
      groupId: group.id,
      variantId: targetVariant.id,
      group,
      variant: targetVariant,
      calc,
      buyPriceUnit: targetVariant.avgCostPrice || 0,
    });
    setEditForm(f => ({ ...f, items: [...f.items, newItem] }));
    setIsAddingItem(false);
    setAddQty('');
    setAddRate('');
  };

  const handleRemoveItem = (index: number) => {
    setEditForm(f => { const items = [...f.items]; items.splice(index, 1); return { ...f, items }; });
  };

  const handleItemChange = (index: number, field: 'quantityPieces' | 'priceUnit', value: number) => {
    setEditForm(f => {
      const items = [...f.items];
      const item = { ...items[index], [field]: value };
      item.formattedQty = `${item.quantityPieces} pcs`;
      item.subtotal = Math.round(item.quantityPieces * item.priceUnit);
      items[index] = item;
      return { ...f, items };
    });
  };

  const saveFullEdit = () => {
    let tempInventory = [...inventory];

    // Restore old stock
    editingSale.items.forEach(oldItem => {
      if (oldItem.groupId === 'manual') return;
      tempInventory = tempInventory.map(g =>
        g.id !== oldItem.groupId ? g : {
          ...g,
          variants: g.variants.map(v =>
            v.id === oldItem.variantId ? { ...v, stockPieces: v.stockPieces + oldItem.quantityPieces } : v
          ),
        }
      );
    });

    // Deduct new stock
    let stockError = false;
    editForm.items.forEach(newItem => {
      if (newItem.groupId === 'manual') return;
      tempInventory = tempInventory.map(g =>
        g.id !== newItem.groupId ? g : {
          ...g,
          variants: g.variants.map(v => {
            if (v.id !== newItem.variantId) return v;
            if (v.stockPieces < newItem.quantityPieces) stockError = true;
            return { ...v, stockPieces: v.stockPieces - newItem.quantityPieces };
          }),
        }
      );
    });

    if (stockError && !confirm('সতর্কতা: স্টকের পরিমাণ নেগেটিভ হয়ে যাবে। আপনি কি নিশ্চিত?')) return;

    setInventory(tempInventory);

    const newSubTotal = editForm.items.reduce((s, i) => s + i.subtotal, 0);
    const newFinal = newSubTotal - editForm.discount;

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
      dueAmount: newFinal - editForm.paidAmount,
      note: (editingSale.note || '') + ' (Edited)',
    });

    notify('মেমো আপডেট সফল হয়েছে', 'success');
    onClose();
  };

  const subTotal = editForm.items.reduce((s, i) => s + i.subtotal, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" /> মেমো এডিট (#{editingSale.invoiceId})
          </h3>
          <button onClick={onClose}><X className="w-6 h-6 text-slate-400" /></button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 space-y-6 pr-2">
          {/* Customer fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">নাম</label>
              <input className="w-full p-2 border rounded" value={editForm.customerName} onChange={e => setEditForm(f => ({ ...f, customerName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">মোবাইল</label>
              <input className="w-full p-2 border rounded" value={editForm.customerPhone} onChange={e => setEditForm(f => ({ ...f, customerPhone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">ঠিকানা</label>
              <input className="w-full p-2 border rounded" value={editForm.customerAddress} onChange={e => setEditForm(f => ({ ...f, customerAddress: e.target.value }))} />
            </div>
          </div>

          {/* Add item */}
          <div className="border border-blue-100 rounded-xl overflow-hidden">
            <button onClick={() => setIsAddingItem(!isAddingItem)} className="w-full p-3 bg-blue-50 flex items-center justify-center gap-2 font-bold text-blue-600 hover:bg-blue-100 transition">
              <Plus className="w-4 h-4" /> নতুন পণ্য যোগ করুন
            </button>
            {isAddingItem && settings && (
              <div className="p-4 bg-white animate-fade-in grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase block mb-1">ধরন</label>
                  <select className="w-full p-2 border rounded text-sm" value={selProductType} onChange={e => { setSelProductType(e.target.value); setSelBrand(''); }}>
                    {settings.productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase block mb-1">ব্র্যান্ড</label>
                  <select className="w-full p-2 border rounded text-sm" value={selBrand} onChange={e => setSelBrand(e.target.value)}>
                    <option value="">নির্বাচন...</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase block mb-1">সাইজ</label>
                  <select className="w-full p-2 border rounded text-sm" value={selSize || ''} onChange={e => setSelSize(Number(e.target.value))}>
                    <option value="">নির্বাচন...</option>
                    {sizes.map(s => <option key={s} value={s}>{s}'</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase block mb-1">পরিমাণ</label>
                  <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={addQty} onChange={e => setAddQty(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase block mb-1">দর</label>
                  <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={addRate} onChange={e => setAddRate(e.target.value)} />
                </div>
                <button onClick={handleAddItem} disabled={!targetVariant} className="bg-emerald-600 text-white p-2 rounded text-sm font-bold disabled:opacity-50">যোগ</button>
              </div>
            )}
          </div>

          {/* Items table */}
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="p-2">নাম</th>
                <th className="p-2 w-20">পরিমাণ</th>
                <th className="p-2 w-24">দর</th>
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
                  <td className="p-2"><button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financials */}
          <div className="bg-blue-50 p-4 rounded-xl space-y-2 border border-blue-100">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-600">সাব-টোটাল:</span>
              <span className="font-bold text-slate-800">৳{subTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-600">ছাড়:</span>
              <input type="number" className="w-24 p-1 border rounded text-right font-bold text-red-600" value={editForm.discount} onChange={e => setEditForm(f => ({ ...f, discount: Number(e.target.value) }))} />
            </div>
            <div className="flex justify-between items-center border-t border-blue-200 pt-2">
              <span className="font-bold text-slate-800">সর্বমোট বিল:</span>
              <span className="font-bold text-xl text-blue-700">৳{(subTotal - editForm.discount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-emerald-700">জমা:</span>
              <input type="number" className="w-24 p-1 border rounded text-right font-bold text-emerald-600" value={editForm.paidAmount} onChange={e => setEditForm(f => ({ ...f, paidAmount: Number(e.target.value) }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t mt-4">
          <button onClick={saveFullEdit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg">
            আপডেট করুন
          </button>
        </div>
      </div>
    </div>
  );
};
