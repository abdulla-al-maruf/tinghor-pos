Here full audit:

---

# Tinghor POS — Design & Architecture Audit

**Stack:** React 19 · TypeScript · Supabase · Tailwind · Vite
**Audited:** [App.tsx](App.tsx) · [src/components/POS.tsx](src/components/POS.tsx) · [src/components/Ledger.tsx](src/components/Ledger.tsx) · [src/lib/db.ts](src/lib/db.ts) · all supporting components

---

## 1. User Friction

### Critical Issues

**CF-1 — 4-Step Product Selection (Every Single Item)**
User must click: Product Type → Brand → Thickness/Color → Size before adding to cart. No shortcuts, no search. For a cashier adding 10 line items, that's 40+ dropdown interactions.

**CF-2 — Manual Quantity Calculation Exposed to User**
`tin_bundle` mode forces cashier to mentally know the bundle math before entry. System calculates internally but shows no preview until item is in cart. Wrong input = wrong stock deduction.

**CF-3 — No Quick-Add or Barcode Path**
Zero support for keyboard shortcuts, item codes, or scanner. Every sale starts from scratch with 4 dropdowns.

**CF-4 — Delivery Status is Binary at Checkout**
`delivered` or `pending` — set once at sale creation. No way to partially deliver, no timeline, no delivery confirmation step separate from the sale. Cashier must guess at time of order.

**CF-5 — Profit Toggle is Hidden Insight**
Profit visibility toggle exists but is not discoverable. First-time users miss it entirely. Important margin information buried.

---

### Suggested Improvements

| # | Fix | Effort |
|---|-----|--------|
| 1 | Add product search bar — filter by name/code across all variants | Low |
| 2 | Implement "Recent Items" or "Favourites" for fast re-add | Medium |
| 3 | Show quantity preview (pieces ↔ bundles) before cart add | Low |
| 4 | Add keyboard shortcut for checkout confirm (Enter/F10) | Low |
| 5 | Separate Delivery Confirmation into its own flow post-sale | High |

---

## 2. Workflow Gaps

### Critical Issues

**WG-1 — No Delivery State Machine**
`deliveryStatus` is a single flag on the Sale object. No history, no timestamps, no confirmation step. "Pending" orders just sit in Ledger with no escalation or follow-up mechanism.

**WG-2 — Payment and Delivery Entangled**
Checkout mixes payment entry + delivery status in one form. These are logically separate concerns — a sale can be paid but not delivered, or delivered but still owed.

**WG-3 — Stock Deduction Happens Before Delivery**
Stock is decremented at sale creation, not at delivery confirmation. If an order is cancelled or pending delivery, stock is already gone. No reservation model.

**WG-4 — Returns Have No Delivery Link**
SalesHistory return flow restores stock and adjusts payment, but doesn't check if item was ever actually delivered. Return of undelivered goods = phantom stock increase.

**WG-5 — Edit Sale Silently Mutates Stock**
EditSaleModal reverses old stock + applies new in local state AND calls `adjustVariantStock()` async. If network fails mid-edit, local state diverges from DB with no user notification.

---

### Suggested Improvements

| # | Fix | Effort |
|---|-----|--------|
| 1 | Introduce explicit delivery states: `draft → confirmed → in_transit → delivered → cancelled` | High |
| 2 | Add "Mark as Delivered" action in Ledger with timestamp | Low |
| 3 | Implement stock reservation at order creation; deduct only at delivery | High |
| 4 | Gate returns on `deliveryStatus === 'delivered'` | Low |
| 5 | Show stock movement audit trail per variant | Medium |

---

## 3. Error Prevention

### Critical Issues

**EP-1 — Stock Deduction Race Condition (Data Integrity Risk)**
```
handleCompleteSale():
  1. setInventory(updated)     ← React state updated immediately
  2. adjustVariantStock().then() ← DB call async, no await, no rollback
```
If DB call fails silently (`.catch(console.error)`), local state shows 100 pcs, DB still shows 110. Next load overwrites React state from DB — deduction is **lost**.

**EP-2 — Silent Save Failures Throughout**
Every Supabase call pattern:
```ts
saveSale(sale).catch(console.error);
```
User receives no feedback if network drops mid-transaction. Sale appears complete on screen but is never persisted.

**EP-3 — localStorage Cart Has No Schema Guard**
```ts
const saved = localStorage.getItem('pos_draft_cart');
const cart = JSON.parse(saved); // No validation
```
If schema changes between deploys, stale cart loads and crashes silently or corrupts new sale.

**EP-4 — Discount Exceeding Total Not Blocked**
Discount field has no upper bound. `finalAmount` can go negative. System allows negative due amounts (treated as advance credit) but shows no warning.

**EP-5 — Admin Access is Client-Side Only**
```tsx
if (restricted && !isAdmin) return null;
```
Route restriction exists only in render logic. Supabase RLS policies are broad — authenticated non-admin users can still call DB functions directly.

**EP-6 — Manual Mode Items Have Zero Cost Basis**
`groupId: 'manual'` items set `buyPriceUnit: 0`. Every manual-mode sale shows 100% profit. Skews Dashboard metrics and makes Reports unreliable.

---

### Suggested Improvements

| # | Fix | Effort |
|---|-----|--------|
| 1 | Wrap all DB mutations in Supabase transactions; surface errors via Toast | Medium |
| 2 | Add optimistic update rollback on DB failure | Medium |
| 3 | Validate localStorage cart against current type schema before loading | Low |
| 4 | Cap discount at `finalAmount`; show warning at >30% | Low |
| 5 | Move admin RBAC enforcement to Supabase RLS policies | High |
| 6 | Prompt for cost on manual-mode items; don't default to 0 | Low |
| 7 | Add Zod schema validation on all form inputs | Medium |

---

## 4. Technical Debt

### Critical Issues

**TD-1 — App.tsx is a God Object (3,393 lines)**
Holds: auth state, all data arrays, all CRUD handlers, all navigation, settings, and activity logging. Adding any Phase 2 feature (multi-branch, roles, notifications) requires editing this single file. Merge conflicts will be constant.

**TD-2 — Business Logic Triplicated**
Tin bundle calculation exists in `POS.tsx:137-153`, `Purchase.tsx:126-142`, and `Inventory.tsx:36-40`. No shared utility. One formula change = 3 files to update = 3 places to get wrong.

**TD-3 — No Reducer Pattern; State Mutations Are Inline**
```ts
setInventory(prev => prev.map(g =>
  g.id === groupId ? { ...g, variants: g.variants.map(v =>
    v.id === variantId ? { ...v, stock: v.stock - qty } : v
  )} : g
));
```
This pattern appears 15+ times. Untestable. State transitions are implicit, not declarative.

**TD-4 — Hardcoded Magic Numbers and Bengali Strings**
```ts
const commonSizes = [6,7,8,9,10,12];            // No config
const base = variant?.calculationBase || 72;     // Domain constant in component
if (selProductType === 'অন্যান্য') ...          // Bengali string as condition
```
Adding a new product category requires hunting down string comparisons.

**TD-5 — No Test Coverage**
Zero unit tests, zero integration tests, zero E2E. Business-critical math (bundle calculation, stock deduction, profit margin) runs entirely on manual QA. Regression risk is high for Phase 2 refactors.

**TD-6 — O(n) Lookups on Every Render**
```ts
sales.find(s => s.id === id)       // In Ledger, Customers, SalesHistory
inventory.find(g => g.id === gid)  // In POS, Purchase
```
No indexed maps. With 1,000+ sales, these loops run on every render cycle.

---

### Suggested Improvements

| # | Fix | Effort |
|---|-----|--------|
| 1 | Split App.tsx: `useInventory`, `useSales`, `useCustomers`, `useAuth` custom hooks | High |
| 2 | Extract `src/lib/pricing.ts` with all bundle/cost calculations | Low |
| 3 | Replace inline setState with `useReducer` for inventory and cart | Medium |
| 4 | Create `src/config/products.ts` for magic numbers and category strings | Low |
| 5 | Add Vitest + Testing Library; write tests for pricing and stock logic first | Medium |
| 6 | Build `salesById: Map<string, Sale>` index in useMemo | Low |

---

## 5. User Flow Diagram

```
CURRENT FLOW (as-built)
═══════════════════════════════════════════════════════════════

  [Login]
     │
     ▼
  [POS Screen]
     │
     ├─ Step 1: Select Product Type (dropdown)
     ├─ Step 2: Select Brand (dropdown, filtered)
     ├─ Step 3: Select Thickness/Color (dropdown, filtered)
     └─ Step 4: Select Size/Variant (dropdown, filtered)
                    │
                    ▼
             [Enter Quantity]
             [Enter Rate]
             [Add to Cart] ──→ Cart Item Added
                                    │
                         ┌──────────┘
                         ▼
               [Enter Customer Name]
               [Enter Phone] (required only if due > 0)
               [Enter Address] (optional)
               [Enter Discount]
               [Enter Paid Amount]
               [Set Delivery: delivered | pending]
                         │
                         ▼
                   [Checkout Button]
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       [Stock Deducted]      [Sale Saved to DB]
       (immediate, local)    (async, silent fail)
              │
              ▼
       [Cart Cleared]
       [Invoice Shown]


PAYMENT COLLECTION (Ledger, separate session)
═══════════════════════════════════════════════

  [Ledger Screen]
     │
     ├─ Filter: Pending Deliveries / Due Amount
     └─ Select Sale
               │
               ▼
         [Add Payment Modal]
         [Enter Amount + Note]
               │
               ▼
         [paidAmount += amount]
         [dueAmount -= amount]
         [paymentHistory appended]


GAPS VISIBLE IN DIAGRAM:
──────────────────────────────────────────────────────────────
  ✗ No "Delivery Confirmed" step — status is set at sale time
  ✗ No partial delivery support
  ✗ Stock deduction and DB save are NOT atomic
  ✗ No customer notification at any step
  ✗ Returns path has no delivery verification gate


RECOMMENDED FLOW (Phase 2 target)
═══════════════════════════════════════════════════════════════

  [POS Screen]
     │
     ├─ [Search / Scan / Browse] ─ unified entry
     │
     ▼
  [Cart] ──→ Stock RESERVED (not deducted)
     │
     ▼
  [Customer Info + Payment]
     │
     ▼
  [Order Confirmed] ──→ Sale saved (DB transaction, atomic)
     │                   Status: CONFIRMED
     ▼
  [Delivery Queue] ──→ Driver/staff views pending orders
     │
     ▼
  [Mark as Delivered] ──→ Stock DEDUCTED (at delivery point)
     │                     Status: DELIVERED
     ▼
  [Customer Notification] (optional, SMS/WhatsApp)
     │
     ▼
  [Payment Collection] ──→ Ledger reconciliation
```

---

## Priority Matrix

| Issue | Impact | Effort | Fix First? |
|-------|--------|--------|-----------|
| EP-2 Silent save failures | Critical | Low | ✅ Yes |
| EP-1 Stock race condition | Critical | Medium | ✅ Yes |
| TD-1 God object App.tsx | High | High | Phase 2 |
| WG-1 No delivery state machine | High | High | Phase 2 |
| CF-1 4-step product selection | High | Medium | ✅ Yes |
| TD-2 Triplicated logic | Medium | Low | ✅ Yes |
| EP-5 Client-side admin check | High | High | Before multi-user |
| TD-5 No tests | High | Medium | Before refactor |
| EP-4 Discount no upper bound | Low | Low | ✅ Quick win |
| TD-6 O(n) lookups | Medium | Low | ✅ Quick win |

---

**Bottom line:** Core POS flow works for single-user low-volume use. Three things block production readiness: silent DB failures, stock race condition, and no delivery confirmation workflow. Phase 2 (multi-branch, roles, analytics) is blocked by the monolithic App.tsx god object.