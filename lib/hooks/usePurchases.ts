/**
 * usePurchases.ts — Purchase completion, supplier balance updates, avg_cost recalculation.
 * Extracted from App.tsx God Object (TD-1).
 */
import { useState, useCallback } from 'react';
import { Purchase as PurchaseType, Supplier, ProductGroup, Expense } from '../../types';
import {
  savePurchase, adjustVariantStock, saveStockMovement,
  saveActivityLog, saveSupplier,
} from '../db';
import { recalcAvgCost, createStockMovementEntry } from '../pricing';

type ToastType = 'success' | 'error' | 'info';

interface UsePurchasesDeps {
  notify: (msg: string, type?: ToastType) => void;
  onInventoryUpdate: (updater: (prev: ProductGroup[]) => ProductGroup[]) => void;
  onExpensesUpdate: (updater: (prev: Expense[]) => Expense[]) => void;
  onSaveExpense: (expense: Expense) => void;
}

interface UsePurchasesReturn {
  purchases: PurchaseType[];
  setPurchases: React.Dispatch<React.SetStateAction<PurchaseType[]>>;
  handleCompletePurchase: (purchase: PurchaseType, newSupplier?: Supplier) => Promise<void>;
}

export function usePurchases({ notify, onInventoryUpdate, onExpensesUpdate, onSaveExpense }: UsePurchasesDeps): UsePurchasesReturn {
  const [purchases, setPurchases] = useState<PurchaseType[]>([]);

  const handleCompletePurchase = useCallback(async (purchase: PurchaseType, newSupplier?: Supplier) => {
    let supId = purchase.supplierId;
    const finalPurchase = { ...purchase, supplierId: supId };

    // Step 1: Persist purchase to DB first
    try {
      await savePurchase(finalPurchase);
    } catch (err) {
      notify('ক্রয় সেভ হয়নি — আবার চেষ্টা করুন', 'error');
      console.error('savePurchase failed:', err);
      return;
    }

    // Step 2: Update stock in DB
    if (purchase.items.length > 0) {
      try {
        for (const item of purchase.items) {
          if (item.variantId) {
            await adjustVariantStock({
              variantId: item.variantId,
              qtyDelta: item.quantityPieces,
              incomingCostPerUnit: item.priceUnit,
              minStock: 0,
            });
            await saveStockMovement(createStockMovementEntry({
              variantId: item.variantId,
              qtyChange: item.quantityPieces,
              qtyAfter: item.quantityPieces,
              costPerUnit: item.priceUnit,
              voucherType: 'purchase',
              voucherId: finalPurchase.id,
            }));
          }
        }
      } catch (err) {
        notify('স্টক আপডেট হয়নি — কিন্তু ক্রয় সেভ হয়েছে', 'error');
        console.error('adjustVariantStock failed:', err);
      }
    }

    // Step 3: Update local inventory to match DB (weighted avg cost)
    if (purchase.items.length > 0) {
      onInventoryUpdate(prevInv => prevInv.map(group => {
        const relevantItems = purchase.items.filter(i => i.groupId === group.id);
        if (relevantItems.length === 0) return group;
        const updatedVariants = group.variants.map(variant => {
          const purchasedItem = relevantItems.find(item => item.variantId === variant.id);
          if (purchasedItem) {
            const avgResult = recalcAvgCost({
              currentStock: variant.stockPieces,
               currentAvgCost: variant.avgCostPrice || 0,
              incomingQty: purchasedItem.quantityPieces,
              incomingCostPerUnit: purchasedItem.priceUnit,
            });
             return { ...variant, stockPieces: avgResult.newTotalStock, avgCostPrice: avgResult.newAvgCost };
          }
          return variant;
        });
        return { ...group, variants: updatedVariants };
      }));

      if (purchase.paidAmount > 0) {
        const expEntry = { id: crypto.randomUUID(), reason: `Purchase #${purchase.invoiceId}`, amount: purchase.paidAmount, category: 'purchase' as const, timestamp: Date.now() };
        onExpensesUpdate(prev => [...prev, expEntry]);
        onSaveExpense(expEntry);
      }
    }

    // Activity log
    saveActivityLog({
      id: crypto.randomUUID(),
      userId: '',
      userName: 'System',
      action: `ক্রয় PUR-${purchase.invoiceId}`,
      details: `৳${purchase.finalAmount}`,
      timestamp: Date.now(),
    }).catch(console.error);

    notify('স্টক আপডেট হয়েছে', 'success');
  }, [notify, onInventoryUpdate, onExpensesUpdate, onSaveExpense]);

  return { purchases, setPurchases, handleCompletePurchase };
}
