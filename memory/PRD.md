# OptiCRM — Product Requirements (Mobile App)

## Overview
Full-stack Expo (React Native) mobile/web app for an optical retail CRM, imported from
`https://github.com/Shahrukh6794/arn.git` and extended with engagement features,
operational tooling, and AI-assisted prescription capture.

## Stack
- **Frontend**: Expo SDK 54, expo-router, expo-camera, expo-document-picker, expo-file-system, expo-sharing, @expo/vector-icons. Web served on port 3000 via `expo start --web --port 3000`.
- **Backend**: FastAPI + Motor (async MongoDB), JWT auth (bcrypt), CSV/PDF/XLSX exports.
- **Integrations**: Emergent LLM key (Gemini 3 Flash) for prescription AI scan + summaries.

## Roles
- **super_admin** → platform console (`/admin`), tenants, billing, broadcasts, oversight of coupons/referrals/repairs/wishes.
- **owner** → top of tenant; created via `/auth/register`.
- **admin** → tenant-level full access (manage staff, imports, branches, coupons).
- **staff** → day-to-day operations (customers, orders, inventory, repairs).

## What's Been Implemented

### Iteration 9 (2026-06-30) — Feature Expansion
1. **Customer search in New Order picker** — searchable picker modal filters by name/phone/email.
2. **Add new inventory from New Order** — inline modal creates an inventory item and adds it to the current order in one step.
3. **PDF + Excel exports** — `/api/customers.{pdf,xlsx}`, `/api/inventory.{pdf,xlsx}`, `/api/reports/sales.{pdf,xlsx}` alongside existing CSV. UI offers all three formats per data type.
4. **Customer Birthday + Anniversary fields** — persisted on Customer; included in customers.{csv,xlsx,pdf}.
5. **Birthday & Anniversary auto-wish flow** — `/api/customers/celebrations/today`, `/api/customers/wishes/send`, `/api/customers/wishes/send-bulk`. Dashboard banner + dedicated Wishes screen + sent log under reminders. MOCKED WhatsApp/SMS channel.
6. **Repair Orders module** — new collection with auto invoice number RPR-YYYYMM-NNNNN, status pipeline (received → diagnosed → in_repair → ready → delivered → cancelled), timeline, dashboard quick action + tile.
7. **Coupon Codes** — CRUD + `/api/coupons/validate` with min_order/expiry/usage_limit/percent-or-flat; "Apply" input on New Order computes discount.
8. **Referral System** — link a referring customer, mark converted, auto-credit loyalty_points. Idempotent re-conversion.
9. **Subscription Expiry Reminder + Auto-Renewal** — `/api/subscription/auto-renew` and `/api/subscription/expiry-reminder`; Settings page exposes toggle + days input + banner.
10. **AI Prescription Scanner** — `/api/prescription/ai-scan` uses Gemini 3 Flash vision to OCR a prescription photo into structured JSON (OD/OS sph/cyl/axis/add, PD, doctor, diagnosis, confidence). Camera + library fallback in app.
11. **Super-Admin oversight** — `/api/admin/coupons-all`, `/admin/referrals-all`, `/admin/repair-orders-all`, `/admin/wishes-all` + admin screens.

### Pre-existing (from imported repo)
- Auth (register/login/me) with biometric & offline cache, country/currency on signup.
- Customers + multi-prescription RX (OD/OS, PD, near_pd, AI summary).
- Inventory (frame/lens/contact/accessory) with low-stock, barcode/SKU lookup.
- Orders with line items, GST, discounts, payments, fulfillment timeline.
- Reminders (MOCK SMS/WhatsApp), Reports (sales/GST/inventory), Subscription (MOCK Razorpay).
- Branches + global Branch Switcher; staff CRUD.
- CSV import/export (customers, inventory, sales).
- Super-admin: tenant CRUD, plan override, status (suspend/restore), broadcasts.

## Testing
- Backend: 34/34 tests passing in `/app/backend/tests/test_iteration_9.py` (report at `/app/test_reports/iteration_9.json`).
- Frontend: Expo web bundle serves at port 3000.

## Backlog (P1/P2)
- Real SMS/WhatsApp/Email integration (Twilio/SendGrid) — currently MOCKED.
- Live Razorpay integration — currently MOCKED.
- Push notifications for birthday/anniversary celebrations.
- Coupon usage tracking on order creation (decrement uses on apply at checkout).
- Re-stock action from Repair Order completion.
- Refactor server.py (>2400 LoC) into modular routers.

## Smart Business Enhancement
The new **referral + coupon + birthday wishes** trio turns OptiCRM from a transactional POS into a **loyalty engine** — every customer becomes a potential acquisition channel (referrals) and a repeat-visit driver (timely celebration wishes + first-order coupons). This is the highest-leverage growth lever for SMB optical shops.
