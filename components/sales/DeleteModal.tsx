import React from 'react';
import { Sale } from '../../types';
import { AlertTriangle } from 'lucide-react';

interface DeleteModalProps {
  sale: Sale;
  deleteInput: string;
  onChangeInput: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ sale, deleteInput, onChangeInput, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-fade-in border border-slate-200">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">ডিলিট নিশ্চিত করুন</h3>
        <p className="text-slate-600 mb-4 text-sm">
          মেমো <b>#{sale.invoiceId}</b> ডিলিট করতে চাইলে নিচের বক্সে মেমো নাম্বারটি লিখুন।
        </p>
        <input
          type="text"
          className="w-full p-2 border-2 border-red-200 rounded-lg text-center font-bold mb-4 focus:border-red-500 outline-none"
          placeholder={sale.invoiceId}
          value={deleteInput}
          onChange={e => onChangeInput(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200">বাতিল</button>
          <button
            onClick={onConfirm}
            disabled={deleteInput !== sale.invoiceId}
            className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ডিলিট
          </button>
        </div>
      </div>
    </div>
  );
};
