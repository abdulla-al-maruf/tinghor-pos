# Tinghor POS — Engineer Briefing

> **For the engineer taking over this codebase.**
> This doc covers: what the app does, all known bugs, suggested fixes, and things to avoid.
> Make your own judgement calls — this is a guide, not a prescription.

---

## What This App Is

**Tinghor POS** — a point-of-sale + inventory management system for a corrugated tin sheet business in Bangladesh.

- **Stack**: React 19 + TypeScript + Vite + Supabase (PostgreSQL + Auth)
- **Deployed**: Netlify (web), Capacitor (Android APK)
- **Language support**: Bengali + English toggle
- **Users**: Admin + Manager roles

**Key modules**: POS, Inventory, Ledger, Sales History, Customers, Purchases, Suppliers, Expenses, Salary Manager, Reports, Activity Logs, Admin Settings.

---

## How to Run Locally

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase dashboard
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## 🔴 Critical Issues (Fix First)

### 1. White Screen on Dev — Missing `.env.local`

**Cause**: `lib/supabase.ts` throws if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing. React crashes before mounting → blank page.

**Fix**: Always ensure `.env.local` exists with valid Supabase credentials before running.

**Better fix idea**: Catch the error in `index.tsx` and show a readable "Configuration missing" screen instead of blank white.

---

### 2. RLS Policies Are Too Permissive (Security Risk)

**File**: `supabase/sql/phase1_security.sql`

**Problem**: Current RLS policies are `"Allow all for authenticated"` — any logged-in user can read/modify ANY user's data. In a multi-user setup, User A can see User B's sales, inventory, customers.

**Suggested approach**: Add `user_id` or `org_id` scoping to RLS policies. Example:
```sql
-- Instead of: USING (auth.role() = 'authenticated')
-- Use:        USING (auth.uid() = user_id)
```
Decide whether this is single-org (all users share data) or multi-org (each user isolated). Currently it's effectively single-org but without intent.

---

### 3. Auth Callback Type Error

**File**: `App.tsx:162`

**Error**: `Type 'void' is not assignable to type 'Promise<void>'`

**Fix**:
```ts
// Change this:
onAuthStateChange((event, session) => {
  loadAllData();
})

// To this:
onAuthStateChange(async (event, session) => {
  await loadAllData();
})
```

---

### 4. Inventory TypeScript Errors

**File**: `components/Inventory.tsx:107, 122`

**Error**: Parameter `v` implicitly has `any` type

**Fix**:
```ts
// Change: group.variants.find(v => v.lengthFeet === l)
// To:     group.variants.find((v: ProductVariant) => v.lengthFeet === l)
```

---

## 🟡 Medium Issues (Fix When Possible)

### 5. Silent Failures — ~20+ `.catch(console.error)` calls

**Problem**: Errors in database operations (save sale, save purchase, etc.) are swallowed silently. User gets no feedback if their data didn't save.

**Files**: `App.tsx` — lines ~245, 289, and many more throughout.

**Suggested fix**: Create a helper:
```ts
const dbAction = async (fn: () => Promise<void>, errorMsg: string) => {
  try {
    await fn();
  } catch (err) {
    console.error(err);
    notify(errorMsg, 'error');
  }
};
```
Replace all `.catch(console.error)` with this where user feedback matters.

---

### 6. Attendance State Never Persists

**File**: `App.tsx` — `attendance` state exists but is never saved to Supabase.

**Problem**: Any attendance data entered is lost on page refresh.

**Fix**: Add `loadAttendance()` + `saveAttendance()` to `lib/db.ts`, create an `attendance` table in Supabase, and hook it up same as other state.

---

### 7. Data Loss Risk — 1500ms Debounce on Save

**File**: `App.tsx:197 (debounceSync)`

**Problem**: Changes are synced to Supabase 1.5 seconds after the last edit. If the user closes the tab/app within that window, data is lost.

**Options**:
- Reduce debounce to 500ms (more API calls, less risk)
- Force-sync on `beforeunload` event
- Show a "saving..." indicator so user knows when it's safe to close

---

### 8. `store_settings` Initialization

**File**: `lib/db.ts:40-41`

**Problem**: `saveSettings()` throws `"no store_settings row found"` if the Supabase table has no row yet. App may crash on first-time setup.

**Fix**: Add an upsert instead of update, or ensure a default row is seeded during database setup. Add a migration script for this.

---

### 9. Race Condition on Stock Adjustment

**File**: `lib/db.ts:557-619 (adjustVariantStock)`

**Problem**: Retry logic exists (up to 5 attempts) but if 2 users sell the last unit simultaneously, stock could still go negative.

**Better fix idea**: Add a Postgres constraint `CHECK (quantity >= 0)` on `product_variants` table and handle the constraint violation error gracefully in the UI.

---

### 10. `react-router-dom` Installed But Never Used

**File**: `package.json`

**Problem**: `react-router-dom@7.14.0` is in dependencies (~40KB) but zero imports exist in the codebase.

**Fix**: `npm uninstall react-router-dom` — saves bundle size.

---

## 🟢 Low Issues (Polish / Nice to Have)

### 11. Tailwind via CDN (Slow, No Tree-shaking)

**File**: `index.html:7`

```html
<script src="https://cdn.tailwindcss.com"></script>
```

**Problem**: CDN Tailwind loads the full Tailwind CSS (~3MB), no tree-shaking, requires internet.

**Better**: Install Tailwind locally as a PostCSS plugin. Reduces CSS from ~3MB to ~10KB after purging unused classes. Also makes the app work offline.

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

### 12. Unused Icon Imports

**File**: `App.tsx:35`

Unused lucide-react icons: `Home`, `Info`, `CheckCircle`, `AlertCircle`, `Lock`

Remove to slightly reduce bundle.

---

### 13. No Loading Timeout on Auth

**File**: `App.tsx:407-411`

If Supabase auth check hangs (network issue), user sees infinite loading spinner forever.

**Fix**: Add a 10-second timeout that shows an error or retry button.

---

### 14. `base: './'` in Vite Config — Conditional Needed

**File**: `vite.config.ts:7`

`base: './'` was added for Capacitor Android WebView. Fine for production builds but can cause subtle issues in some dev environments.

**Safer**:
```ts
base: process.env.NODE_ENV === 'production' ? './' : '/',
```

---

### 15. Dev Logs Leak to Production

Multiple `console.log` and `console.error` calls exist throughout. Guard them:
```ts
if (import.meta.env.DEV) console.log(...)
```

---

## Architecture Notes

### File Structure
```
/App.tsx          — Main container, auth, state, routing logic (~950 lines)
/types.ts         — All TypeScript interfaces
/index.tsx        — React entry + ErrorBoundary
/lib/
  db.ts           — All Supabase queries (~650 lines)
  supabase.ts     — Client init
  contexts.ts     — Language + Toast contexts
/components/      — 14 major page components
/components/admin/     — Settings sub-panels
/components/sales/     — Sales modal sub-components
/supabase/sql/    — Database migration SQL
```

### State Management
- All state lives in `App.tsx` — no Redux/Zustand
- State passed down as props to all components
- Debounced sync to Supabase on every state change
- No optimistic UI rollback on most operations (only stock adjustment has retry)

### Known Complexity Areas
- **Inventory calculation modes**: 3 different modes (`tin_bundle`, `running_foot`, `fixed_piece`) — each calculates price/quantity differently. Touch carefully.
- **Payment allocations**: Partial payments across multiple invoices. Logic is in `lib/db.ts` — read it fully before modifying.
- **Stock movements**: Every sale/purchase creates a stock movement log. Used for audit trail. Don't bypass this.

---

## Android Build

Capacitor is set up. To rebuild APK after code changes:

```bash
npm run build          # Build React app
npx cap sync android   # Copy to Android project
# Then open android/ in Android Studio → Build → Build APK
```

Or via CLI (requires JAVA_HOME set to Android Studio's bundled JRE):
```bash
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
cd android && ./gradlew assembleDebug
# APK output: android/app/build/outputs/apk/debug/app-debug.apk
```

**Supabase config for Android**: In Supabase Dashboard → Auth → URL Configuration, add `https://localhost/**` to redirect URLs.

---

## Things That Work Well (Don't Break These)

- Error boundary in `index.tsx` — catches React crashes gracefully
- Env var validation at startup in `lib/supabase.ts`
- Draft cart persistence in POS (localStorage)
- Bengali/English language toggle — wired through Context
- Activity logging on all mutations — good audit trail
- Stock conflict retry logic in `adjustVariantStock`

---

## Suggested Priority Order

1. Fix `.env.local` documentation / startup error screen
2. Fix TypeScript compile errors (3 total)
3. Fix RLS policies — decide on data access model
4. Replace silent `.catch(console.error)` with user-facing errors
5. Fix attendance persistence
6. Remove unused `react-router-dom`
7. Local Tailwind install (big UX improvement for load time)
8. Add stock quantity constraint in Postgres
9. Add auth loading timeout
