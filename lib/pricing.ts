/**
 * pricing.ts — Shared pricing & bundle calculations
 * Single source of truth for POS, Purchase, Inventory.
 */

import { CalculationMode, ProductGroup, ProductVariant, CartItem } from '../types';

// ── Bundle Math ──────────────────────────────────────────────

export function piecesPerBundle(base: number, length: number): number {
  return base / length;
}

export interface BundleResult {
  qtyPieces: number;
  finalPrice: number;
  formattedQty: string;
  pricePerUnit: number; // effective per-piece price
}

/**
 * Calculate cart line item from user input.
 * Used by both POS (selling) and Purchase (buying).
 */
export function calculateLineItem(params: {
  groupType: CalculationMode;
  variant: ProductVariant;
  quantity: number;
  rate: number;
  unitMode?: 'bundle' | 'piece';
}): BundleResult {
  const { groupType, variant, quantity, rate, unitMode = 'piece' } = params;

  if (groupType === 'tin_bundle') {
    const base = variant.calculationBase || 72;
    const length = variant.lengthFeet;
    const ppb = piecesPerBundle(base, length);

    if (unitMode === 'bundle') {
      return {
        qtyPieces: Math.round(quantity * ppb),
        finalPrice: Math.round(quantity * rate),
        formattedQty: `${quantity} বান`,
        pricePerUnit: Math.round((rate / ppb) * 100) / 100,
      };
    }
    // Selling pieces, rate is bundle rate
    return {
      qtyPieces: quantity,
      finalPrice: Math.round((quantity * rate) / ppb),
      formattedQty: `${quantity} পিস`,
      pricePerUnit: Math.round((rate / ppb) * 100) / 100,
    };
  }

  if (groupType === 'running_foot') {
    const totalFeet = quantity * variant.lengthFeet;
    return {
      qtyPieces: quantity,
      finalPrice: Math.round(totalFeet * rate),
      formattedQty: `${quantity} pcs (${totalFeet} ft)`,
      pricePerUnit: Math.round(variant.lengthFeet * rate * 100) / 100,
    };
  }

  // fixed_piece / manual
  return {
    qtyPieces: quantity,
    finalPrice: Math.round(quantity * rate),
    formattedQty: `${quantity} pcs`,
    pricePerUnit: rate,
  };
}

// ── Stock Entry (Inventory) ──────────────────────────────────

export interface StockEntryResult {
  piecesToAdd: number;
  costPerPiece: number;
}

/**
 * Convert user stock entry input to pieces + cost per piece.
 */
export function calculateStockEntry(params: {
  groupType: CalculationMode;
  quantity: number;
  rate: number;
  length: number;
  base: number;
  qtyMode?: 'bundle' | 'piece';
}): StockEntryResult {
  const { groupType, quantity, rate, length, base, qtyMode = 'piece' } = params;

  if (groupType === 'tin_bundle') {
    const ppb = piecesPerBundle(base, length);
    const piecesToAdd = qtyMode === 'bundle'
      ? Math.round((quantity * base) / length)
      : quantity;
    return {
      piecesToAdd,
      costPerPiece: rate / ppb,
    };
  }

  if (groupType === 'running_foot') {
    return {
      piecesToAdd: quantity,
      costPerPiece: rate * length,
    };
  }

  return {
    piecesToAdd: quantity,
    costPerPiece: rate,
  };
}

// ── Weighted Average Cost ────────────────────────────────────

export interface AvgCostResult {
  newTotalStock: number;
  newAvgCost: number;
}

/**
 * Recalculate average cost after incoming stock.
 * new_avg = (current_value + incoming_value) / new_total
 */
export function recalcAvgCost(params: {
  currentStock: number;
  currentAvgCost: number;
  incomingQty: number;
  incomingCostPerUnit: number;
}): AvgCostResult {
  const { currentStock, currentAvgCost, incomingQty, incomingCostPerUnit } = params;

  const oldVal = currentStock * currentAvgCost;
  const newVal = incomingQty * incomingCostPerUnit;
  const newTotal = currentStock + incomingQty;
  const newAvg = newTotal > 0
    ? Math.round(((oldVal + newVal) / newTotal) * 100) / 100
    : Math.round(incomingCostPerUnit * 100) / 100;

  return { newTotalStock: newTotal, newAvgCost: newAvg };
}

// ── Stock Movement Builder ───────────────────────────────────

export interface StockMovementParams {
  variantId: string;
  qtyChange: number;
  qtyAfter: number;
  costPerUnit: number;
  voucherType: 'sale' | 'purchase' | 'return' | 'adjustment' | 'manual_entry' | 'delivery';
  voucherId: string;
  note?: string;
  createdByName?: string;
}

/**
 * Build a stock movement entry ready to pass to saveStockMovement().
 * Centralizes the pattern repeated in handleCompleteSale, handleCompletePurchase, handleReturnItem.
 */
export function createStockMovementEntry(params: {
  variantId: string;
  qtyChange: number;
  qtyAfter: number;
  costPerUnit: number;
  voucherType: StockMovementParams['voucherType'];
  voucherId: string;
  note?: string;
  createdByName?: string;
}): StockMovementParams {
  return {
    variantId: params.variantId,
    qtyChange: params.qtyChange,
    qtyAfter: params.qtyAfter,
    costPerUnit: params.costPerUnit,
    voucherType: params.voucherType,
    voucherId: params.voucherId,
    note: params.note,
    createdByName: params.createdByName,
  };
}

// ── Display Helpers ──────────────────────────────────────────

/**
 * Build display name for a product variant.
 */
export function buildItemName(group: ProductGroup, variant: ProductVariant): string {
  const thickness = group.thickness && group.thickness !== 'N/A' && group.thickness !== 'Standard'
    ? group.thickness
    : '';
  const color = group.color && group.color !== 'N/A' ? group.color : '';
  return `${group.productType} | ${group.brand} | ${thickness} ${color} | ${variant.lengthFeet}'`
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a CartItem from calculation results.
 */
export function makeCartItem(params: {
  groupId: string;
  variantId: string;
  group: ProductGroup;
  variant: ProductVariant;
  calc: BundleResult;
  buyPriceUnit?: number;
}): CartItem {
  const { groupId, variantId, group, variant, calc, buyPriceUnit = 0 } = params;
  return {
    groupId,
    variantId,
    name: buildItemName(group, variant),
    lengthFeet: variant.lengthFeet,
    calculationBase: variant.calculationBase,
    quantityPieces: calc.qtyPieces,
    subtotal: calc.finalPrice,
    unitType: group.type === 'tin_bundle' ? 'bundle' : 'piece',
    formattedQty: calc.formattedQty,
    priceUnit: calc.pricePerUnit,
    buyPriceUnit,
  };
}
