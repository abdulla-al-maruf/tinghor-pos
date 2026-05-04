import React, { useState, useContext, useMemo } from 'react';
import { Sale, ProductGroup, StoreSettings } from '../types';
import { Search, Calendar, FileText } from 'lucide-react';
import { ToastContext } from '../lib/contexts';
import { ReturnModal, ReturnModalState } from './sales/ReturnModal';
import { DeleteModal } from './sales/DeleteModal';
import { EditSaleModal } from './sales/EditSaleModal';
import { InvoiceModal } from './sales/InvoiceModal';
import { SalesTable } from './sales/SalesTable';

interface SalesHistoryProps {
  sales: Sale[];
  onUpdateSale: (sale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  onReturnItem: (saleId: string, itemIndex: number, returnQty: number) => void;
  inventory: ProductGroup[];
  setInventory: (inv: ProductGroup[]) => void;
  settings?: StoreSettings;
}

const EMPTY_RETURN: ReturnModalState = { isOpen: false, sale: null, itemIndex: null, returnQty: '' };

export const SalesHistory: React.FC<SalesHistoryProps> = ({
  sales, onUpdateSale, onDeleteSale, onReturnItem, inventory, setInventory, settings,
}) => {
  const { notify } = useContext(ToastContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [returnModal, setReturnModal] = useState<ReturnModalState>(EMPTY_RETURN);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleteInput, setDeleteInput] = useState('');

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
      result = result.filter(s => new Date(s.timestamp).toLocaleDateString('en-CA') === filterDate);
    }
    return result;
  }, [sales, searchTerm, filterDate]);

  const displaySales = filteredSales.slice(0, displayLimit);

  const processReturn = () => {
    const { sale, itemIndex, returnQty } = returnModal;
    if (!sale || itemIndex === null || !returnQty) {
      notify('সব তথ্য দিন', 'error'); return;
    }
    const qty = Number(returnQty);
    const item = sale.items[itemIndex];
    if (qty <= 0) { notify('ফেরত পরিমাণ সঠিক নয়', 'error'); return; }
    if (qty > item.quantityPieces) { notify('ফেরত পরিমাণ সঠিক নয়', 'error'); return; }
    onReturnItem(sale.id, itemIndex, qty);
    setReturnModal(EMPTY_RETURN);
  };

  const confirmDelete = () => {
    if (saleToDelete && deleteInput === saleToDelete.invoiceId) {
      onDeleteSale(saleToDelete.id);
      setSaleToDelete(null);
      setViewSale(null);
    } else {
      notify('ইনভয়েস আইডি সঠিক নয়', 'error');
    }
  };

  return (
    <div className="font-bangla space-y-6 animate-fade-in">
      {returnModal.isOpen && (
        <ReturnModal
          modal={returnModal}
          onChange={setReturnModal}
          onProcess={processReturn}
          onClose={() => setReturnModal(EMPTY_RETURN)}
        />
      )}
      {saleToDelete && (
        <DeleteModal
          sale={saleToDelete}
          deleteInput={deleteInput}
          onChangeInput={setDeleteInput}
          onConfirm={confirmDelete}
          onCancel={() => setSaleToDelete(null)}
        />
      )}
      {editingSale && (
        <EditSaleModal
          editingSale={editingSale}
          inventory={inventory}
          setInventory={setInventory}
          settings={settings}
          onUpdateSale={onUpdateSale}
          notify={notify}
          onClose={() => setEditingSale(null)}
        />
      )}
      {viewSale && (<InvoiceModal sale={viewSale} settings={settings} onClose={() => setViewSale(null)} />)}

      {/* Header + Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" /> মেমো ও বিক্রয় খাতা
          </h2>
          <p className="text-xs text-slate-500 mt-1">সকল বিক্রয় ও ইনভয়েস তালিকা</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="date"
              className="pl-10 p-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-600"
              value={filterDate}
              onChange={e => { setFilterDate(e.target.value); setDisplayLimit(20); }}
            />
          </div>
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              className="w-full pl-10 p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="মেমো নং বা নাম..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setDisplayLimit(20); }}
            />
          </div>
        </div>
      </div>

      <SalesTable
        sales={displaySales}
        totalFiltered={filteredSales.length}
        onView={setViewSale}
        onReturn={sale => setReturnModal({ isOpen: true, sale, itemIndex: null, returnQty: '' })}
        onEdit={setEditingSale}
        onDelete={sale => { setSaleToDelete(sale); setDeleteInput(''); }}
        onLoadMore={() => setDisplayLimit(prev => prev + 20)}
      />
    </div>
  );
};
