import React from 'react';
import { Sale, StoreSettings } from '../../types';
import { X, FileText, Printer } from 'lucide-react';

interface InvoiceModalProps {
  sale: Sale;
  settings?: StoreSettings;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, settings, onClose }) => {
  const shopName = settings?.shopName || 'টিনঘর.কম';
  const shopPhone = settings?.shopPhone || 'N/A';
  const shopAddress = settings?.shopAddress || 'N/A';

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl shadow-2xl rounded-xl overflow-hidden animate-fade-in relative print:w-full print:fixed print:inset-0 print:h-screen print:z-[200] print:rounded-none">

        <div className="p-4 bg-slate-100 flex justify-between items-center print:hidden border-b border-slate-200">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <FileText className="w-5 h-5" /> মেমো প্রিভিউ
          </h3>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700">
              <Printer className="w-4 h-4" /> প্রিন্ট
            </button>
            <button onClick={onClose} className="bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-8 print:p-0 bg-white" id="invoice-area">
          <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-1">{shopName}</h1>
            <p className="text-slate-500 text-sm">ঠিকানা: {shopAddress}</p>
            <p className="text-slate-500 text-sm">মোবাইল: {shopPhone}</p>
          </div>

          <div className="flex justify-between items-end mb-6 text-sm">
            <div className="w-1/2">
              <p className="font-bold text-slate-700 text-lg">ক্রেতা: {sale.customerName}</p>
              <p className="text-slate-600">মোবাইল: {sale.customerPhone}</p>
              {sale.customerAddress && <p className="text-slate-600">ঠিকানা: {sale.customerAddress}</p>}
            </div>
            <div className="text-right">
              <div className="bg-slate-100 px-3 py-1 rounded inline-block mb-1">
                <span className="font-bold text-slate-700">মেমো নং: #{sale.invoiceId}</span>
              </div>
              <p className="text-slate-500">তারিখ: {new Date(sale.timestamp).toLocaleDateString('bn-BD')}</p>
              <p className="text-slate-500">সময়: {new Date(sale.timestamp).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</p>
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
              {sale.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 px-2 text-slate-800 font-medium">{item.name}</td>
                  <td className="py-3 px-2 text-center text-slate-600">{item.formattedQty}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{item.priceUnit}</td>
                  <td className="py-3 px-2 text-right text-slate-800 font-bold">{item.subtotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/2 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>সাব-টোটাল:</span><span>৳{sale.subTotal.toLocaleString()}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>ছাড় / ডিসকাউন্ট:</span><span>(-) ৳{sale.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-slate-800 border-t border-slate-300 pt-2">
                <span>সর্বমোট বিল:</span><span>৳{sale.finalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>জমা দেওয়া হয়েছে:</span><span>৳{sale.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-dashed border-slate-300 pt-2">
                <span>বর্তমান অবস্থা:</span>
                <span className={sale.dueAmount > 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {sale.dueAmount > 0
                    ? `বাকি ৳${sale.dueAmount}`
                    : sale.dueAmount < 0
                    ? `অ্যাডভান্স ৳${Math.abs(sale.dueAmount)}`
                    : 'পরিশোধিত'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between text-xs text-slate-400 mt-20 pt-4 border-t border-slate-200">
            <div><p>ক্রেতার স্বাক্ষর</p></div>
            <div className="text-right"><p>বিক্রেতার স্বাক্ষর</p></div>
          </div>
          <div className="text-center text-[10px] text-slate-300 mt-4">
            Software by Tinghor.com | Printed on {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
