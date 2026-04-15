# Tinghor POS — টিনঘর পয়েন্ট অব সেল

Full-featured inventory and point-of-sale management system for **Tinghor.com** — a tin/corrugated iron sheet business in Bangladesh.

## Features

- **POS** — Sales with product search, quantity, and receipt generation
- **Inventory** — Stock tracking, low-stock alerts, product management
- **Purchase** — Supplier orders and purchase history
- **Ledger** — Customer credit/debit ledger
- **Sales History** — Complete transaction log with filters
- **Customers** — Customer profiles and account balances
- **Suppliers** — Supplier management
- **Expenses** — Business expense tracking
- **Reports** — Sales, inventory, and financial reports with charts
- **Salary Manager** — Employee salary records
- **Activity Logs** — Full audit trail of all actions
- **Admin Settings** — Multi-user access, Bengali/English language toggle

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Database:** Supabase (PostgreSQL)
- **Build:** Vite
- **Deploy:** Netlify

## Local Setup

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Run dev server:
    ```bash
    npm run dev
    ```

## Security Bootstrap (Phase 1)

Run `supabase/sql/phase1_security.sql` in Supabase SQL Editor after first setup.
This enables RLS, creates baseline authenticated policies, and adds a non-negative stock constraint.

## Deploy to Netlify

1. Connect this repo to Netlify
2. Add environment variables in Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
