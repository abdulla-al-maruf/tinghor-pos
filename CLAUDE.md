# CLAUDE.md — Tinghor POS Project Guide

> এই file টা Claude Code সবসময় পড়বে। কোনো কিছু করার আগে এখানের rules follow করবে।

---

## Project Overview

**নাম:** Tinghor POS — টিনঘর পয়েন্ট অব সেল  
**ব্যবসা:** Bangladesh এর ঢেউটিন ও নির্মাণসামগ্রীর দোকান  
**লক্ষ্য:** একটি দোকানে কাজ করছে, ভবিষ্যতে SaaS হবে  

**Project path:** "S:\Gemini\Tinghor Claude  awstore"
**Supabase project ref:** `ofjkrjzqujpvttkygxie`  

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Deploy:** Netlify

---

## Core Business Rules — এগুলো কখনো ভুলবে না

### Calculation Methods (4 ধরনের)
```
1. ban_pcs      → ঢেউ টিনের জন্য। Rate per ban, stock in pcs
2. per_ft_pcs   → মাইটা/টুয়া/ঢালার জন্য। Rate per ft × size
3. running_ft   → ঝালট/প্লেন সিটের জন্য। Coil tracking লাগে
4. manual       → স্ক্রু/পলিথিন। Stock affect করে না
```

### Stock Rules
- Stock সবসময় **পিসে (integer)** store করো — কখনো decimal না
- Display এ "৩ বান ৫ পিস" format করো: `Math.floor(pcs/pcsPerBan)` বান + remainder পিস
- **Negative stock allowed** — block করবে না, warning দেখাবে (লাল রঙে)
- Negative stock এ বিক্রি হলে `last_avg_cost` ব্যবহার করো profit এ

### Pricing Rules
- সব price **integer** — কোনো decimal নেই
- Per-pcs price suggest করবে: `Math.round(banRate / banBaseFt * sizeFt)`
- দোকানদার final rate নিজে edit করতে পারবে
- Line total = `final_rate × qty` (integer)

### Profit Method: Weighted Average
```
new_avg_cost = (current_stock_value + purchase_value) / (current_qty + purchase_qty)
```
- প্রতি purchase এ `product_variants.avg_cost_price` update করো
- Sale save হওয়ার সময় সেই মুহূর্তের avg_cost কে `sale_items.cost_price_snapshot` এ store করো
- Profit report সবসময় `cost_price_snapshot` থেকে পড়বে — কখনো current price থেকে না

### Stock Deduction: Delivery Confirm এ
- Sale create হলে → `stock.reserved_qty` বাড়বে (`on_hand_qty` কমবে না)
- Delivery confirm হলে → `reserved_qty` কমবে, `on_hand_qty` কমবে
- Dashboard এ দুটো দেখাবে: **Physical Stock** এবং **Available** (= on_hand - reserved)

### Invoice Edit
- Edit in place করা যাবে, কিন্তু প্রতিটা edit এ `sale_edit_logs` এ record রাখতে হবে
- Log এ রাখো: `sale_id`, `edited_by`, `edited_at`, `field_changed`, `old_value` (JSON), `new_value` (JSON)
- Admin এই log দেখতে পাবে, staff দেখতে পাবে না

---

## Database Schema — সব Table

### Core Tables (already exist in Supabase)
```
profiles, store_settings, product_groups, product_variants,
sales, sale_items, purchases, purchase_items,
suppliers, expenses, employees, salary_records,
activity_logs, stock_movements, payment_allocations
```

### নতুন Columns যোগ করতে হবে
```sql
-- product_variants এ:
ALTER TABLE product_variants ADD COLUMN avg_cost_price INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN reserved_qty INTEGER DEFAULT 0;

-- sale_items এ:
ALTER TABLE sale_items ADD COLUMN cost_price_snapshot INTEGER DEFAULT 0;

-- stock এর জন্য on_hand concept:
-- product_variants.stock_pieces = on_hand_qty
-- product_variants.reserved_qty = reserved for pending delivery
```

### নতুন Tables যোগ করতে হবে

**1. inventory_movements** — সব stock change এর ledger
```sql
CREATE TABLE inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID,
  variant_id UUID REFERENCES product_variants(id),
  movement_type TEXT, -- 'purchase','sale','return','adjustment','transfer','delivery'
  ref_table TEXT,     -- 'sales','purchases', etc.
  ref_id UUID,
  qty_change INTEGER, -- positive = stock বাড়া, negative = কমা
  qty_after INTEGER,
  cost_snapshot INTEGER,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. delivery_logs** — partial delivery tracking
```sql
CREATE TABLE delivery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id),
  delivered_qty INTEGER NOT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  warehouse TEXT,
  note TEXT,
  delivered_by UUID
);
```

**3. sale_edit_logs** — audit trail
```sql
CREATE TABLE sale_edit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id),
  edited_by UUID,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  field_changed TEXT,
  old_value JSONB,
  new_value JSONB
);
```

---

## Known Bugs — Priority Order এ Fix করতে হবে

### 🔴 Critical (আগে করো)

**BUG 1 — Payment join broken** (`lib/db.ts:204`)
```typescript
// ❌ ভুল — 'payments' table নেই
.select('*, payments(*)')

// ✅ ঠিক — payment_allocations use করো
.select('*, payment_allocations(*)')
```

**BUG 2 — User delete client-only** (`components/admin/UserManagementPanel.tsx:51`)
```typescript
// ❌ শুধু local state থেকে মুছছে, Supabase এ মুছছে না
setUsers(prev => prev.filter(...))

// ✅ Supabase Auth + profiles table থেকেও delete করো
await supabase.auth.admin.deleteUser(userId)
await supabase.from('profiles').delete().eq('id', userId)
```

**BUG 3 — Attendance not persisted** (`App.tsx:101`)
```typescript
// ❌ attendance: any[] — reload এ সব হারায়
const [attendance, setAttendance] = useState<any[]>([])

// ✅ attendance table বানাও, load এবং save করো
// Table: employee_attendance (id, employee_id, date, status, note)
```

**BUG 4 — Stock movements never loaded** (`App.tsx:96`)
```typescript
// stockLogs state আছে কিন্তু DB থেকে load হয় না
// db.ts এ loadStockMovements() function যোগ করো
// App.tsx এ loadAllData() এ call করো
```

### 🟠 Important (তারপর করো)

**BUG 5 — saveSettings inside state updater** (`App.tsx:262-265`)
```typescript
// ❌ async call inside setState updater — dangerous
setSettings(prev => {
  const newSettings = {...prev, nextInvoiceId: prev.nextInvoiceId + 1}
  saveSettings(newSettings) // ← এটা এখানে থাকা উচিত না
  return newSettings
})

// ✅ updater এর বাইরে করো
const newSettings = {...settings, nextInvoiceId: settings.nextInvoiceId + 1}
setSettings(newSettings)
await saveSettings(newSettings)
```

**BUG 6 — Calendar import missing** (`components/ActivityLogs.tsx:67`)
```typescript
// ❌ local stub function আছে
function Calendar(props: any) { ... }

// ✅ import করো
import { Calendar } from 'lucide-react'
```

**BUG 7 — Full inventory re-save on every change** (`App.tsx:201`)
```typescript
// ❌ সব group save হচ্ছে একসাথে
debounceSync(() => saveInventory(inventory))

// ✅ শুধু changed group save করো
debounceSync(() => saveProductGroup(changedGroup))
```

**BUG 8 — Dead dependency**
```bash
npm uninstall react-router-dom
# package.json থেকে সরাও — কোথাও use হচ্ছে না
```

### 🟡 Minor (পরে করো)

**ISSUE 9 — any types ঠিক করো**
- `App.tsx`: `attendance: any[]` → proper type
- `Inventory.tsx`: `ProductGroupCard props: any` → typed interface
- `SalaryManager.tsx`: attendance props → typed

**ISSUE 10 — Silent errors**
```typescript
// ❌ error user দেখতে পায় না
.catch(console.error)

// ✅ toast notification দেখাও
.catch(err => { notify('error', 'সেভ করা যায়নি'); console.error(err) })
```

**ISSUE 11 — Token refresh full reload**
```typescript
// TOKEN_REFRESHED event এ full data reload বন্ধ করো
// শুধু SIGNED_IN এ load করো
```

**ISSUE 12 — AiInsight type**
```typescript
// types.ts থেকে AiInsight interface সরাও — কোথাও use নেই
```

---

## Missing Features — Build করতে হবে

### Phase 1 (Launch এর আগে)

1. **Schema SQL file** — `supabase/sql/schema.sql` বানাও সব table create করার জন্য। Repository তে schema নেই, এটা critical।

2. **Weighted Average cost update** — purchase save হলে `avg_cost_price` recalculate করো

3. **cost_price_snapshot** — sale save হওয়ার সময় snapshot নাও

4. **Reserved stock** — `reserved_qty` field যোগ করো, delivery flow ঠিক করো

5. **Delivery logs** — partial delivery tracking, date + qty + warehouse + note

6. **Purchase return** — supplier কে মাল ফেরত, stock কমবে, supplier balance adjust

7. **Return condition** — resaleable vs damaged। Resaleable stock এ ফিরবে, damaged আলাদা

8. **Basic roles** — Admin vs Staff। Staff পুরনো invoice edit/delete করতে পারবে না

### Phase 2 (Stabilization)

9. **Draft/Hold memo** — কাস্টমার দাঁড়িয়ে থাকলে hold করার option
10. **Customer due aging** — ৩০/৬০/৯০ দিনের পুরনো বাকির report
11. **Cash reconciliation** — daily opening → sales → expenses → closing balance
12. **Physical stock count** — বছর শেষে গণনা মেলানোর feature
13. **Memo print/WhatsApp share** — invoice PDF generate + share

---

## File Structure — কোথায় কী আছে

```
App.tsx              ← Root. Auth, state, handlers. ~560 lines
types.ts             ← সব TypeScript types
lib/
  db.ts              ← সব Supabase queries. ~650 lines. এখানেই বেশি কাজ করতে হবে
  supabase.ts        ← Supabase client init
  contexts.ts        ← Language + Toast contexts
  utils.ts           ← generateId() only
components/
  POS.tsx            ← বিক্রি করার main screen
  Inventory.tsx      ← Stock + product management
  Purchase.tsx       ← কেনাকাটার entry
  SalesHistory.tsx   ← Invoice list, edit, delete, return
  Ledger.tsx         ← বাকির হিসাব
  Dashboard.tsx      ← KPI + charts
  Customers.tsx      ← Customer list
  Expenses.tsx       ← খরচের হিসাব
  Reports.tsx        ← P&L report
  SalaryManager.tsx  ← কর্মচারী + বেতন
  ActivityLogs.tsx   ← Audit log viewer
  AdminSettings.tsx  ← Settings shell
  admin/
    CategoryPanel.tsx       ← Brand/Color/Thickness manage
    SystemPanel.tsx         ← Invoice number settings
    UserManagementPanel.tsx ← User CRUD (BUG: delete broken)
  sales/
    InvoiceModal.tsx   ← Print view
    EditSaleModal.tsx  ← Sale edit
    ReturnModal.tsx    ← Return process
    DeleteModal.tsx    ← Confirm delete
    SalesTable.tsx     ← Table display
supabase/sql/
  phase1_security.sql  ← RLS policies (may not be applied)
  schema.sql           ← ⚠️ MISSING — তৈরি করতে হবে
```

---

## Rules — কাজ করার সময় সবসময় মানবে

1. **একটা bug fix করার সময় অন্য কিছু ছুঁবে না** — scope creep করবে না
2. **যেকোনো DB query এ error handle করবে** — silent `.catch(console.error)` না
3. **Stock change হলে সবসময় `inventory_movements` এ log করবে**
4. **Sale edit হলে সবসময় `sale_edit_logs` এ record করবে**
5. **TypeScript `any` use করবে না** — proper type দাও
6. **Bengali UI text** — সব user-facing text Bengali এ
7. **Integer only** — কোনো price বা stock এ float/decimal রাখবে না
8. **Test করার আগে Supabase dashboard এ check করবে** — table আছে কিনা

---

## কাজ শুরুর আগে এই order follow করো

```
Step 1: schema.sql তৈরি করো → Supabase এ apply করো
Step 2: BUG 1 fix করো (payment join)
Step 3: BUG 3 fix করো (attendance persist)  
Step 4: BUG 4 fix করো (stock movements load)
Step 5: avg_cost_price + cost_price_snapshot logic যোগ করো
Step 6: reserved_qty + delivery_logs যোগ করো
Step 7: বাকি bugs ক্রমানুসারে
```