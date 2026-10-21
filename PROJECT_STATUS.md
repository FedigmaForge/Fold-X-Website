# FoldX — Project Status & Developer Guide

_Last updated: 21 October 2026_

FoldX is an online store for handcrafted leather goods (India, INR, GST). It is a
**React storefront + admin dashboard** talking to an **Express + Prisma API**.
This document is the starting point for any developer picking the project up:
what exists, how it fits together, how to run it, and what is still to do.

> ⚠️ **Most of the work below is not committed yet.** The last commit is
> `7b030ad` (17 Sep 2026). Everything from "Order management" onwards — 7
> database migrations and ~115 files — is only in the working tree. Commit
> before doing anything else.

---

## Contents

1. [Tech stack](#1-tech-stack)
2. [Running it locally](#2-running-it-locally)
3. [Project structure](#3-project-structure)
4. [What's built](#4-whats-built)
5. [Key design decisions & invariants](#5-key-design-decisions--invariants)
6. [Data model](#6-data-model)
7. [What's left](#7-whats-left)
8. [Known issues & gotchas](#8-known-issues--gotchas)
9. [Demo data & accounts](#9-demo-data--accounts)

---

## 1. Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, Zustand 5 (state), Recharts 3 (charts), lucide-react (icons), react-dropzone, react-hot-toast |
| Backend | Node 24, Express 4, Prisma 6, SQLite (dev), JWT auth (`jsonwebtoken`), bcryptjs, multer (uploads), razorpay SDK, qrcode |
| Payments | Razorpay (online) + Cash on delivery. Runs in **mock mode** when Razorpay keys are absent |
| Email | Gmail SMTP from `foldx01@gmail.com` — **configured, not yet built** (see §7) |

No TypeScript, no test suite yet. Plain JavaScript (ESM on the frontend, CommonJS on the backend).

---

## 2. Running it locally

```bash
# 1. Install
npm install
npm install --prefix backend

# 2. Environment
cp .env.example .env                    # frontend: VITE_API_URL
cp backend/.env.example backend/.env    # backend: DB, JWT secret, port, Razorpay, SMTP

# 3. Database (SQLite file at backend/prisma/dev.db)
cd backend
npx prisma migrate dev                  # applies all migrations + generates the client
npm run seed                            # demo products, orders, customers, staff
cd ..

# 4. Run both servers
npm run dev:all                         # frontend :5173 + backend (PORT from backend/.env)
```

- Storefront: http://localhost:5173 · Admin: http://localhost:5173/admin/login
- **Ports must agree:** `backend/.env` `PORT` and the frontend's `VITE_API_URL` must point at the same port. The local `.env` files use **4001**; the `.env.example` files still say 4000.

### Environment variables

**Frontend (`.env`)**

| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL, no trailing slash |
| `VITE_RAZORPAY_KEY_ID` | Optional; only needed for the real Razorpay widget |

**Backend (`backend/.env`)**

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Prisma DB URL (`file:./dev.db` for SQLite) |
| `JWT_SECRET` | Signs session tokens **and** derives the key that encrypts 2FA secrets — changing it invalidates both |
| `PORT` | API port |
| `PUBLIC_URL` | Absolute base URL for uploaded images (set in production) |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Live/test keys. Blank = mock payments (refused when `NODE_ENV=production`) |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Outgoing email via Gmail. `SMTP_PASS` must be a Gmail **App Password** |

### Useful commands

| Command | What |
|---|---|
| `npm run lint` | ESLint (3 known pre-existing errors, see §8) |
| `npm run build` | Production build of the frontend |
| `npm run prisma:studio --prefix backend` | Browse/edit the database |
| `POST /api/admin/reset-demo-data` (Super Admin) | Wipe and re-seed everything — **dev only, destructive** |

---

## 3. Project structure

```
FoldX/
├── src/                          # React app (storefront + admin in one SPA)
│   ├── App.jsx                   # All routes (lazy-loaded pages)
│   ├── index.css                 # Tailwind theme + `.admin-theme` (see §5)
│   ├── services/api.js           # EVERY backend call goes through here
│   ├── store/                    # Zustand: auth, cart, wishlist, settings, siteContent
│   ├── layouts/                  # CustomerLayout, AdminLayout (auth guard)
│   ├── pages/customer/           # Storefront pages
│   ├── pages/admin/              # Admin pages
│   ├── components/{customer,admin,ui}/
│   ├── data/                     # mockData (seed source), siteContentDefaults, indianStates
│   └── utils/                    # permissions, cartToken, useDocumentMeta, formatting
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/           # 14 migrations
│   │   ├── seed.js, seedData.js  # seeding (idempotent "ensure*" helpers)
│   │   ├── defaultPages.js       # About/FAQ starter pages
│   │   └── policyPages.js        # Shipping/Returns/Privacy/Terms texts
│   ├── src/
│   │   ├── app.js                # Express app, route mounting order matters
│   │   ├── routes/*.routes.js    # One file per area
│   │   ├── lib/                  # Business logic (pricing, stock, discounts, ledger, totp…)
│   │   └── middleware/           # auth (requireAuth/Admin/Role), errors, uploads
│   └── uploads/                  # Uploaded images (git-ignored)
└── docs/                         # Store policies draft (.docx / .pdf)
```

### Backend modules worth knowing

| File | Responsibility |
|---|---|
| `lib/pricing.js` | `quoteOrder()` — prices a bag **from the DB**: lines, discount, shipping, gift wrap, COD fee, total |
| `lib/discounts.js` | Coupon/automatic-discount evaluation; one discount per order |
| `lib/stock.js` | Atomic stock deduct/restore (variant-aware) + `StockMovement` history |
| `lib/ledger.js` | Payment log entries (capture / refund) |
| `lib/customers.js` | Customer blocking, COD eligibility |
| `lib/totp.js` | Two-step login codes (RFC 6238) + AES-GCM encryption of secrets |
| `lib/razorpay.js` | Live vs mock mode, signature verification, `assertCheckoutAvailable()` |
| `lib/visibility.js` | Whether a product is visible (published + past `publishAt`) |
| `lib/csv.js` | CSV read/write with spreadsheet-formula injection protection |
| `lib/audit.js` | `logAudit()` — staff activity log |
| `lib/roles.js` | Role lists: `ADMIN_ROLES`, `CATALOG_WRITE_ROLES`, `REFUND_ROLES` |

---

## 4. What's built

### Storefront

| Area | Notes |
|---|---|
| Design | FoldX sells **bags only**. Layout copies damilano.com: rust announcement bar; header ("+ Contact Us" · logo · search/account/wishlist/bag/☰) floats transparent over the homepage slideshow and turns solid on scroll; all navigation in the ☰ drawer. Homepage sections in Da Milano order: slideshow → shop by category (3-col) → gift store strip → for her / for him → made for every moment → featured collection (image + product carousel) → trending now (category tiles) → your next stop → join the community; light footer. Every section is **editable in admin → Storefront** (`SiteContent`) |
| Category pages | Da Milano-style banner on every listing page (slanted photo + uppercase title, subtitle, bag count), breadcrumb, and round "shop by type" thumbnails for the category's bag types. Banners are per listing link in admin → Storefront → Category banners; the most specific match wins (type > category, `/products` = fallback) — `src/utils/categoryBanner.js` |
| Collections & gifts | Named collections (`/collections`, `/collections/:id`; admin → Collections, or per product). Gift store at `/gifts` with `?for=her|him|sets` and `?under=` filters. "Special prices" = `/products?sale=1` (price below original price) |
| Free customisation | Shoppers can have any bag made in another leather at no charge (product page → Customisation; explained at `/customisation`). Leathers, note and on/off in admin → Settings; per-product opt-out in the product form. The choice travels as `variant.leather` on the cart line and `OrderItem.variant` (validated in `lib/customisation.js`), and shows in the bag, checkout, confirmation, My Orders, admin order detail (highlighted) and the invoice. Staff see what to make on the **dashboard** ("Custom leather to make" queue = open orders, `GET /admin/orders?customised=open`) and can filter **Orders** by "Custom leather" (`?customised=1`) |
| Catalogue | Category/subcategory/material/colour/price filters; `?type=` subcategory links; variant picker with per-variant stock; draft & scheduled products hidden; per-product SEO title/description |
| Checkout | 3 steps (address → review → payment). Server-side pricing; Razorpay or COD; promo-code box; gift wrap; Indian state dropdown; saves the bag for abandoned-cart recovery |
| My account | Orders with status timeline, courier & tracking, refunds, **return requests** (10-day window) |
| Pages | Contact form (honeypot + rate limit), content pages at `/pages/:slug`, journal, wishlist, cart-recovery links `/cart/recover/:token` |

### Admin (`/admin/*`)

| Section | Pages / features |
|---|---|
| **Overview** | Dashboard (sales charts, "COD to confirm", "running low"); **Reports** (KPIs vs previous period, sales chart, breakdowns by product/category/state/city, CSV); **Finance** (profit, payment log, settlement matching) |
| **Sales** | **Orders** (filters, detail page with timeline/notes, shipping & tracking, COD confirmation, cancel incl. "refused at delivery", partial/full refunds, GST invoice, CSV export); **Returns** (approve → received/restock → close); **Abandoned carts** (WhatsApp/email/link reminders with optional code); **Customers** (guests included, profile, notes, tags, block, per-customer COD); **Discounts** (codes + automatic, full rules, stats); **Inbox** (contact messages) |
| **Catalog** | **Products** (variants & SKUs, stock history, low-stock threshold, cost price, image reordering, draft/scheduled, CSV import with dry-run preview + export); **Categories** (CRUD, reorder, hide, subcategory rename moves products); **Reviews** |
| **Content** | **Storefront** (menu, homepage, footer); **Banners**; **Pages** (markdown-lite editor with live preview) |
| **Team** | **Staff** (roles, activate/deactivate, 2FA status/reset, require 2FA for all); **Activity log**; **My account** (2FA setup, backup codes, sign-in history) |
| **Settings** | Store info & contact (`foldx01@gmail.com`), GSTIN/legal name/state, GST & HSN defaults, shipping/gift-wrap fees, return window, COD rules, shipping cost per order |

### Roles

| Role | Can |
|---|---|
| **Support** | Orders, returns, customers (notes/tags), inbox, reviews, abandoned carts. Catalog/settings are **read-only** |
| **Manager** | Everything Support can + catalog, content, discounts, settings, refunds, **Finance**, block customers |
| **Super Admin** | Everything + staff management, activity log, sign-in history, require 2FA, reset demo data |

Server-side enforcement lives in route middleware (`requireRole`); the UI mirrors it via `src/utils/permissions.js` (`usePermissions()`), which only **hides** controls.

---

## 5. Key design decisions & invariants

Read these before changing checkout, stock or money code.

1. **The server prices everything.** `quoteOrder()` builds the order from DB prices; anything price-like sent by the browser is ignored. `POST /orders` re-quotes and, in live mode, verifies the Razorpay signature **and** the amount Razorpay actually captured.
2. **Orders are idempotent.** Online orders are keyed by `razorpayOrderId`; COD orders by a client `checkoutKey` (`cod_<uuid>`) stored in the same column. Re-submitting returns the existing order.
3. **Mock payments never run in production.** `assertCheckoutAvailable()` refuses checkout when `NODE_ENV=production` and keys are missing.
4. **Stock is atomic and logged.** Deductions use conditional `updateMany` so the last unit can't be sold twice; every change writes a `StockMovement`. `Product.stock` = sum of active variants' stock when variants exist (`syncProductStock`). `Order.stockDeducted` tracks whether an order currently holds stock (cancel restores, reopen re-deducts).
5. **Order snapshots are frozen.** Each `OrderItem.productSnapshot` stores name, price, HSN, GST rate, `lineDiscount` and **`costPrice`** at the time of sale, so invoices and profit never change retroactively.
6. **Never leak `costPrice`.** It is stripped in `toPublic()` (products) and `serializeCustomerOrder()` (orders). Keep it that way in any new customer-facing endpoint.
7. **GST invoices tax the amount paid.** Prices are GST-inclusive; tax is backed out per line after its share of the discount. Same state as the store → CGST+SGST, otherwise IGST. Shipping/gift-wrap/COD fees take the principal item's rate.
8. **One discount per order** — the entered code or the best automatic discount, whichever saves more. Discounts are whole rupees. Usage is counted atomically at order creation and released on cancel.
9. **COD flow:** order is `pending` with `paymentStatus: pending` → staff **confirm** (required before processing/shipping) → **delivered** marks it paid and logs the cash → courier remittance is recorded in Finance. Refusals (`codRefused`) and open COD orders limit future COD per customer.
10. **Staff sign-in:** `/api/admin/auth/login` returns either a session or a 5-minute 2FA challenge. The **customer** login (`/api/auth/login`) rejects staff roles — otherwise it would bypass 2FA.
11. **Admin theming:** admin pages use plain Tailwind `violet-*` / `gray-*` classes; the `.admin-theme` scope in `index.css` re-maps those CSS variables to the brand palette. Keep using `violet-*` for accent and `gray-*` for neutrals in new admin UI.
12. **Customers are keyed by email** (lower-cased), so guests and registered accounts share one profile.

---

## 6. Data model

25 Prisma models (`backend/prisma/schema.prisma`):

| Group | Models |
|---|---|
| Catalogue | `Product`, `ProductVariant`, `StockMovement`, `Category`, `Review` |
| Orders | `Order`, `OrderItem`, `OrderEvent` (timeline), `ReturnRequest` |
| Money | `PaymentTransaction` (payment log), `SettlementImport`, `Coupon`, `CouponRedemption` |
| Customers | `User` (customers + staff), `CustomerProfile`, `AbandonedCart`, `ContactMessage` |
| Content | `Banner`, `SiteContent` (menu/announcements/homepage sections/gift store/footer JSON), `Page`, `Collection`, `NewsletterSubscriber` |
| Admin | `Settings` (single row, id 1), `AuditLog`, `StaffLogin` |

**Migrations** (in order): `init` → `add_user_isactive` → `add_gift_wrap` → `add_staff_roles_and_audit_log` → *(not committed from here)* `order_management` → `stock_and_gst` → `site_content` → `variants_content_support` → `coupons` → `customers_and_cod` → `finance_2fa_carts` → `collections_newsletter` → `free_customisation` → `custom_leathers_text` (the second fixes a JSON default SQLite can't store — leathers are a comma-separated string).

Moving to Postgres: change `provider` in `schema.prisma` and `DATABASE_URL`, then create a fresh migration baseline. Some code relies on SQLite's case-insensitive `LIKE` for `contains` and then re-checks exact matches in JS — that still works on Postgres but could use `mode: 'insensitive'` there.

---

## 7. What's left

### Blocked on the store owner

| Task | Where |
|---|---|
| Gmail **App Password** for `foldx01@gmail.com` | `backend/.env` → `SMTP_PASS` |
| **Razorpay live keys** | `backend/.env` |
| Policy pages: legal name, GSTIN and phone are filled in (21 Oct 2026); still need the **Grievance Officer's name** and the "last updated" date, a legal review, then publish | Admin → Pages, or `docs/FoldX-Store-Policies-DRAFT.docx` |
| ~~GSTIN & store state~~ done — 07BGJPK9798M1Z9, Delhi. The site, invoices and policies show only **FoldX** + address + GSTIN; the registered legal/trade names are kept in Settings for records only (not in the public `/api/settings`). Still: confirm GST rate/HSN (18% / 4202) with a CA | Admin → Settings |
| Cost price per product; shipping cost per order | Products / Settings |
| Turn on 2FA, then replace the demo staff accounts | Admin → My account / Staff |

### To build (in suggested order)

1. **Customer emails** (next). Order confirmation, COD "we'll call you", shipped + tracking, delivered, refund, return approved/rejected, password reset (doesn't exist yet), automatic abandoned-cart reminders, new-order alert to the owner. Plan: `nodemailer` with the SMTP vars above, a `lib/mailer.js` that logs to the console when `SMTP_PASS` is blank, simple branded HTML templates, and sends triggered from the existing order/return/cart code paths.
2. **Shipping integration** (Shiprocket or Delhivery). Book courier and print label from the order page, auto-fill tracking, webhook status updates, pincode serviceability check at checkout.
3. **Saved addresses** on the customer account page (tab is a placeholder).
4. **Newsletter emails** — sign-ups are saved (admin → Subscribers, CSV export) but nothing is sent to them yet.
5. **Tests.** There are none; checkout pricing, stock, discounts and refunds are the highest-value targets.

### Going live

- Hosting (API + static frontend), **Postgres**, domain + HTTPS, `PUBLIC_URL`, `CORS_ORIGIN`
- Strong `JWT_SECRET` (and keep it stable — it also encrypts 2FA secrets)
- `NODE_ENV=production`
- Backups of the DB and `backend/uploads/`
- Custom-domain email for better deliverability than Gmail (~500 mails/day limit)
- End-to-end test with a real ₹1 payment and refund

---

## 8. Known issues & gotchas

- **Lint:** 3 pre-existing `react-hooks/set-state-in-effect` errors in `DashboardPage.jsx`, `ProductDetailPage.jsx`, `ProductListingPage.jsx`. Harmless, not yet fixed.
- **Orphaned dev servers (Windows).** Stopping `npm run dev` from some tools leaves `node --watch src/server.js` running; it keeps grabbing the API port and serves **old code**. Before starting the backend, check for and kill stray processes:
  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -match 'src/server.js'
  ```
- **`node --watch` restarts once right after start** on this machine — wait a few seconds before running API tests.
- **Prisma `EPERM` on generate/migrate** while the backend runs (the query engine DLL is locked). Stop the backend first.
- **New demo products:** add them to `mockProducts` in `src/data/mockData.js` and run `npm run seed` — `ensureDemoProducts` creates the missing ones (by id) without touching existing products.
- **Seeding doesn't overwrite.** `seedAll()` upserts with empty updates; changing `mockData.js` won't change an existing DB — use reset-demo-data.
- **Another project's Vite server** may also be on port 5173 (`127.0.0.1` vs FoldX on `[::1]`); `localhost:5173` can occasionally hit the wrong app.
- **Sidebar badges** (pending orders, new messages, open returns) load once and don't refresh live.
- **Settlement sync** (`client.settlements.reports`) is untested against live Razorpay — CSV import is the tested path.
- **Contact form rate limit** is in memory (per process) — fine for one server, needs a shared store if scaled out. Same for 2FA attempt counting.
- **The policies PDF** in `docs/` may be older than the `.docx`; regenerate it from the Word file.

---

## 9. Demo data & accounts

Created by the seed. **Development only — weak passwords committed in code. Replace before launch.**

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@foldx.com` | `admin123` |
| Manager | `manager@foldx.com` | `password123` |
| Support | `support@foldx.com` | `password123` |
| Customer | `ananya.r@email.com` (and others in `src/data/mockData.js`) | `password123` |

Demo content: 26 bags across every subcategory (with colour variants; the 16 added on 21 Oct 2026 use logo-free photos and have no reviews), 4 categories (Women, Men, Travel, Gifts), 3 collections, 3 banners, 5 orders (March 2024), the `FOLDX10` coupon, and 6 unpublished policy/content pages. The admin login form pre-fills the Super Admin credentials **only in dev builds**.

Store contact email: **foldx01@gmail.com** (also the planned sender for all outgoing mail).
