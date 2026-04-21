import React from 'react';
import { Sale } from '../../types';
import { X, RotateCcw } from 'lucide-react';

export interface ReturnModalState {
  isOpen: boolean;
  sale: Sale | null;
  itemIndex: number | null;
  returnQty: string;
}

interface ReturnModalProps {
  modal: ReturnModalState;
  onChange: (modal: ReturnModalState) => void;
  onProcess: () => void;
  onClose: () => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({ modal, onChange, onProcess, onClose }) => {
  if (!modal.isOpen || !modal.sale) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[180] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="font-bold text-red-600 flex items-center gap-2">
            <RotateCcw className="w-5 h-5" /> পণ্য ফেরত (Return)
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">কোন পণ্য ফেরত?</label>
            <select
              className="w-full p-2 border rounded-lg bg-slate-50"
              onChange={e => onChange({ ...modal, itemIndex: Number(e.target.value) })}
              value={modal.itemIndex === null ? '' : modal.itemIndex}
            >
              <option value="">সিলেক্ট করুন...</option>
              {modal.sale.items.map((item, idx) => (
                <option key={idx} value={idx}>{item.name} ({item.quantityPieces} pcs sold)</option>
              ))}
            </select>
          </div>

          {modal.itemIndex !== null && (
            <>
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                কেনা দর: ৳{modal.sale.items[modal.itemIndex].priceUnit} / pcs
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">ফেরত পরিমাণ (Qty)</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded font-bold text-lg"
                  value={modal.returnQty}
                  onChange={e => onChange({ ...modal, returnQty: e.target.value })}
                />
              </div>
              {modal.returnQty && (
                <p className="text-xs text-center text-slate-400">
                  হিসাব অনুযায়ী ফেরত: ৳{Number(modal.returnQty) * modal.sale.items[modal.itemIndex].priceUnit}
                </p>
              )}
              <button onClick={onProcess} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg">
                ফেরত নিশ্চিত করুন
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
