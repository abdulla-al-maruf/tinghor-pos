/**
 * useSales.ts — Sale CRUD, returns, payment allocations.
 * Extracted from App.tsx God Object (TD-1).
 */
import { useState, useCallback } from 'react';
import { Sale, ProductGroup, User, StoreSettings } from '../../types';
import {
  saveSale, deleteSale,
  reserveStock, saveStockMovement, savePaymentAllocation,
  saveActivityLog, saveSettings, adjustVariantStock,
} from '../db';
import { createStockMovementEntry } from '../pricing';

type ToastType = 'success' | 'error' | 'info';

interface UseSalesDeps {
  settings: StoreSettings;
  currentUser: User | null;
  notify: (msg: string, type?: ToastType) => void;
}

interface UseSalesReturn {
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  handleCompleteSale: (sale: Sale) => Promise<Sale | null>;
  handleUpdateSale: (updatedSale: Sale) => void;
  handleDeleteSale: (saleId: string) => void;
  handleReturnItem: (saleId: string, itemIndex: number, returnQty: number) => void;
}

export function useSales({ settings, currentUser, notify }: UseSalesDeps): UseSalesReturn {
  const [sales, setSales] = useState<Sale[]>([]);

  const handleCompleteSale = useCallback(async (sale: Sale) => {
    const newInvoiceId = settings.nextInvoiceId.toString();
    const saleWithMeta = { ...sale, invoiceId: newInvoiceId, soldBy: currentUser?.name || 'Unknown' };

    // Step 1: Persist to DB first
    try {
      await saveSale(saleWithMeta);
    } catch (err) {
      notify('বিক্রি সেভ হয়নি — আবার চেষ্টা করুন', 'error');
      console.error('saveSale failed:', err);
      return null;
    }

    // Step 2: Reserve stock in DB
    if (sale.items.length > 0 && sale.items[0].groupId !== 'manual') {
      try {
        for (const item of sale.items) {
          if (item.variantId) {
            await reserveStock({ variantId: item.variantId, qty: item.quantityPieces, saleId: saleWithMeta.id });
            await saveStockMovement({
              variantId: item.variantId,
              qtyChange: -item.quantityPieces,
              qtyAfter: 0,
              costPerUnit: 0,
              voucherType: 'sale',
              voucherId: saleWithMeta.id,
            });
          }
        }
      } catch (err) {
        notify('স্টক রিজার্ভ হয়নি — কিন্তু বিক্রি সেভ হয়েছে', 'error');
        console.error('reserveStock failed:', err);
      }
    }

    // Step 3: Update React state
    setSales(prevSales => [saleWithMeta, ...prevSales]);

    // Update local inventory reservedQty
    if (sale.items.length > 0 && sale.items[0].groupId !== 'manual') {
      // Note: inventory update is handled by parent via callback
    }

    // Step 4: Update invoice counter
    const newSettings = { ...settings, nextInvoiceId: settings.nextInvoiceId + 1 };
    // Note: settings update is handled by parent via callback
    saveSettings(newSettings).catch(err => { console.error(err); notify("ইনভয়েস নম্বর আপডেট হয়নি", "error"); });

    // Step 5: Activity log
    saveActivityLog({
      id: crypto.randomUUID(),
      userId: currentUser?.id ?? '',
      userName: currentUser?.name ?? 'Unknown',
      action: `Sale INV-${newInvoiceId}`,
      details: `Amount: ${sale.finalAmount}`,
      timestamp: Date.now(),
    }).catch(console.error);

    notify('মেমো সেভ হয়েছে', 'success');
    return saleWithMeta;
  }, [currentUser, notify, settings]);

  const handleUpdateSale = useCallback((updatedSale: Sale) => {
    setSales(prev => {
      const oldSale = prev.find(s => s.id === updatedSale.id);
      if (oldSale && updatedSale.paidAmount > oldSale.paidAmount) {
        const delta = updatedSale.paidAmount - oldSale.paidAmount;
        savePaymentAllocation({
          invoiceId: updatedSale.id,
          invoiceType: 'sale',
          allocatedAmount: delta,
          receivedByName: 'Collection',
        }).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
      }
      return prev.map(s => s.id === updatedSale.id ? updatedSale : s);
    });
    saveSale(updatedSale).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
    notify('আপডেট হয়েছে', 'success');
  }, [notify]);

  const handleDeleteSale = useCallback((saleId: string) => {
    setSales(prevSales => {
      const sale = prevSales.find(s => s.id === saleId);
      if (!sale) return prevSales;
      const hasTrackedItems = sale.items.some(i => i.groupId !== 'manual');
      if (hasTrackedItems) {
        // Note: inventory stock restoration is handled by parent
      }
      return prevSales.filter(s => s.id !== saleId);
    });
    deleteSale(saleId).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
    notify('ডিলিট হয়েছে', 'success');
  }, [notify]);

  const handleReturnItem = useCallback((saleId: string, itemIndex: number, returnQty: number) => {
    setSales(prevSales => prevSales.map(sale => {
      if (sale.id === saleId) {
        const newItems = [...sale.items];
        const item = newItems[itemIndex];
        const refundAmount = returnQty >= item.quantityPieces
          ? item.subtotal
          : Math.round(item.subtotal * returnQty / item.quantityPieces);
        if (item.groupId !== 'manual') {
          // Note: inventory stock restoration is handled by parent
          if (item.variantId) {
            adjustVariantStock({ variantId: item.variantId, qtyDelta: returnQty, minStock: 0 })
              .then((updated) => saveStockMovement(createStockMovementEntry({
                variantId: item.variantId,
                qtyChange: returnQty,
                qtyAfter: updated.stockPieces,
                 costPerUnit: updated.avgCostPrice,
                voucherType: 'return',
                voucherId: sale.id,
              })))
              .catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
          }
        }
        const newItemQty = item.quantityPieces - returnQty;
        if (newItemQty <= 0) newItems.splice(itemIndex, 1);
        else newItems[itemIndex] = { ...item, quantityPieces: newItemQty, subtotal: item.subtotal - refundAmount, formattedQty: `${newItemQty} pcs (Ret ${returnQty})` };
        const newFinalAmount = sale.finalAmount - refundAmount;
        const updatedRetSale = { ...sale, items: newItems, subTotal: sale.subTotal - refundAmount, finalAmount: newFinalAmount, dueAmount: newFinalAmount - sale.paidAmount, note: (sale.note || '') + ` | Ret: ${returnQty}` };
        saveSale(updatedRetSale).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
        return updatedRetSale;
      }
      return sale;
    }));
    notify('ফেরত নেওয়া হয়েছে', 'success');
  }, [notify]);

  return {
    sales, setSales,
    handleCompleteSale, handleUpdateSale, handleDeleteSale, handleReturnItem,
  };
}
