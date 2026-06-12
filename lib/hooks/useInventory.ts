/**
 * useInventory.ts — Inventory state, stock entry, stock movement logging.
 * Extracted from App.tsx God Object (TD-1).
 */
import { useState, useCallback } from 'react';
import { ProductGroup, ProductVariant, StockLog, User } from '../../types';
import { saveProductGroup, saveStockMovement, adjustVariantStock } from '../db';
import { calculateStockEntry, recalcAvgCost, createStockMovementEntry } from '../pricing';

type ToastType = 'success' | 'error' | 'info';

interface UseInventoryDeps {
  currentUser: User | null;
  notify: (msg: string, type?: ToastType) => void;
}

interface UseInventoryReturn {
  inventory: ProductGroup[];
  stockLogs: StockLog[];
  setInventory: React.Dispatch<React.SetStateAction<ProductGroup[]>>;
  setStockLogs: React.Dispatch<React.SetStateAction<StockLog[]>>;
  handleStockEntry: (groupId: string, updatedVariants: ProductVariant[], log: StockLog) => void;
  handleInventoryUpdate: (newInventory: ProductGroup[]) => void;
}

export function useInventory({ currentUser, notify }: UseInventoryDeps): UseInventoryReturn {
  const [inventory, setInventory] = useState<ProductGroup[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);

  const handleStockEntry = useCallback((groupId: string, updatedVariants: ProductVariant[], log: StockLog) => {
    setInventory(prev => {
      const updated = prev.map(g => g.id === groupId ? { ...g, variants: updatedVariants } : g);
      const updatedG = updated.find(g => g.id === groupId);
      if (updatedG) saveProductGroup(updatedG).catch(err => { console.error(err); notify("সেভ করা যায়নি", "error"); });
      return updated;
    });
    setStockLogs(prev => [log, ...prev]);
    notify('স্টক যোগ হয়েছে', 'success');
  }, [notify]);

  const handleInventoryUpdate = useCallback((newInventory: ProductGroup[]) => {
    setInventory(newInventory);
  }, []);

  return {
    inventory, stockLogs,
    setInventory, setStockLogs,
    handleStockEntry, handleInventoryUpdate,
  };
}
