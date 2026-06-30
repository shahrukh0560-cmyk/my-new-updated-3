# OptiCRM — Product Requirements (Mobile App)

## Overview
Full-stack Expo (React Native) mobile app for an optical retail CRM, imported from
`https://github.com/shahrukh671994/optical-crm` and extended with admin-grade
customer data **import / export** and **staff login & management**.

## Stack
- **Frontend**: Expo SDK 54, expo-router, react-native-safe-area-context, expo-image, expo-document-picker, expo-file-system, expo-sharing, @expo/vector-icons.
- **Backend**: FastAPI + Motor (async MongoDB), JWT auth (bcrypt), CSV via stdlib `csv`.
- **Integrations**: Emergent LLM key (Gemini 3 Flash) for prescription AI summaries.

## Roles
- **super_admin** → platform console (`/admin`), tenants, billing, broadcasts.
- **owner** → top of tenant; created via `/auth/register`.
- **admin** → tenant-level full access (manage staff, imports, branches).
- **staff** → day-to-day operations (customers, orders, inventory). No admin pages.

## Newly-added Features (latest iteration)
### 1. Country + Currency on Registration
- `GET /api/countries` → 13 ISO-2 countries with currency, symbol, locale.
- `POST /api/auth/register` accepts `country` and persists `currency`, `currency_symbol`, `locale` on the owner record. Staff inherit owner's currency.
- `/auth/me`, `/auth/login` return these fields. Frontend `useCurrency()` formats all amounts (dashboard, reports, orders, inventory).

### 2. Global Branch Switcher
- `BranchProvider` (`src/branch.tsx`) holds the active branch id, persisted per-user.
- `BranchSwitcher` pill component appears in Dashboard, Customers, Inventory, Orders & Reports headers.
- Every list/aggregate API call (`/customers`, `/inventory`, `/orders`, `/dashboard`, `/reports/sales(.csv)`) is automatically scoped to the active branch.

### 3. Dashboard Quick Actions
- Two prominent cards: **New Order** → `/order/new`, **New Customer** → `/customer/new`.

### 4. Inline Customer Creation from New Order
- The customer picker modal now exposes an **Add new customer** row at the top.
- Tapping opens an inline form (name + phone + email), creates via `POST /api/customers`, auto-selects the new customer.

### 5. Reports — Custom Date Range + Monthly/Yearly
- New `period=daily|monthly|yearly` param on `GET /api/reports/sales` → returns a sorted `series` array (period, orders, revenue, due, gst, discount, total).
- UI: preset chips (Today / 7d / This month / This year / All-time / Custom) + Group-by segment + custom Start/End inputs.
- Monthly/yearly breakdown rendered as a horizontal bar list.
- `GET /api/reports/sales.csv` now accepts `branch_id` + `start`/`end` and the **Export** button on Reports streams the date-filtered CSV.

### 6. Historical Sales (Invoice) CSV Import
- `GET /api/sales-template.csv` — pre-filled migration template.
- `POST /api/sales-import` — bulk imports invoices into the `orders` collection with `is_imported=true`. Skips duplicates by `invoice_no`. Invalid dates produce per-row errors instead of silent inserts.
- UI on `/data` has a third **Sales** tab with Download Template + Import buttons.

## Existing Features (from repo)
- Auth (register/login/me) with biometrics & offline cache.
- Customers + multi-prescription RX (OD/OS, PD, near_pd, k_readings, AI summary).
- Inventory (frame/lens/contact/accessory) with low-stock, barcode/SKU lookup.
- Orders with line items, GST, discounts, payments, fulfillment timeline.
- Reminders (mock SMS/WhatsApp), Reports (sales/GST/inventory), Subscription (mock Razorpay).
- Super-Admin console: tenant CRUD, plan override, status (suspend/restore), broadcasts.

## Smart Business Enhancement
Admin CSV import unlocks **fast onboarding** for new shops migrating from spreadsheets or
legacy POS — the #1 friction point for SMB CRM adoption. The export then doubles as a
**backup channel** that builds owner trust before they commit to a paid plan.
