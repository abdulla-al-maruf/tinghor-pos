import React from 'react';
import { Sale } from '../../types';
import { Eye, Edit, Trash2, RotateCcw, CheckCircle, ArrowDown } from 'lucide-react';

interface SalesTableProps {
  sales: Sale[];
  totalFiltered: number;
  onView: (sale: Sale) => void;
  onReturn: (sale: Sale) => void;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onLoadMore: () => void;
  currentUser?: { role: string };
}

export const SalesTable: React.FC<SalesTableProps> = ({
  sales, totalFiltered, onView, onReturn, onEdit, onDelete, onLoadMore, currentUser,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  return (
    <>
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
              {sales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition group">
                  <td className="p-4 font-mono font-bold text-blue-600">#{sale.invoiceId}</td>
                  <td className="p-4 text-slate-500">
                    {new Date(sale.timestamp).toLocaleDateString('bn-BD')}
                    <br />
                    <span className="text-[10px] opacity-70">
                      {new Date(sale.timestamp).toLocaleTimeString('bn-BD', { timeStyle: 'short' })}
                    </span>
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
                      <span className="text-emerald-500 flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3" /> Paid</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => onView(sale)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="View"><Eye className="w-4 h-4" /></button>
                      {isAdmin && (
                        <>
                          <button onClick={() => onReturn(sale)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="Return"><RotateCcw className="w-4 h-4" /></button>
                          <button onClick={() => onEdit(sale)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => onDelete(sale)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">কোনো তথ্য পাওয়া যায়নি</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sales.length < totalFiltered && (
        <div className="flex justify-center mt-4 pb-10">
          <button
            onClick={onLoadMore}
            className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
          >
            <ArrowDown className="w-4 h-4" /> আরও দেখুন ({totalFiltered - sales.length} বাকি)
          </button>
        </div>
      )}
    </>
  );
};
