# Market Flow - Grabio Space

**Modern Multi-Vendor Marketplace Platform**

> **Docs:** Canonical platform documentation is in the Obsidian vault `~/Documents/grabio-platform-docs/` (architecture, backlog, deploy protocol, gotchas). Code-repo `backlog.md` is legacy.

## Git — dual push (required)

**Every code or doc update must be pushed to both GitHub accounts** (primary + backup). Never leave one mirror behind.

| What | Primary (`AynBeirut`) | Backup (`a-nooor`) | Git remote |
|------|----------------------|-------------------|------------|
| Main / ecosystem code | `ecosystem` | `backup` | this repo (`grabio space`) |
| Platform docs | `origin` | `backup` | `~/Documents/grabio-platform-docs` |

```bash
# Code (from grabio space, branch main)
git push ecosystem main && gh auth switch -u a-nooor && git push backup main && gh auth switch -u AynBeirut

# Docs (from grabio-platform-docs)
git push origin main && gh auth switch -u a-nooor && git push backup main && gh auth switch -u AynBeirut
```

Do not commit `.env.production`, credentials, or local backup folders.

**GitHub secret scanning:** Firebase `apiKey` in `google-services.json` / `GoogleService-Info.plist` are **public client IDs** (required for mobile builds). In GitHub → Security → Secret scanning → mark as *used in tests* / resolved. Restrict keys in [Firebase Console → API keys](https://console.cloud.google.com/apis/credentials). Server keys (`FIREBASE_TOKEN`, `OPENAI_API_KEY`, etc.) stay in GitHub Secrets only.

### Session 2026-08-27 — P&L AM form
P&L tab now matches the AM print: INCOME / Total Class 7, C.O.S (B.I, Purchases Goods, E.I), Gross Profit, EXPENSES, Profit Before Tax, Others / Additions, Taxable / NET PROFIT, then Difference of Exchange footer. LBP column, 3 decimals, parentheses for losses. 65-account audit still waits on AM file. **Prod deploy requested 2026-08-27.**

### Session 2026-08-27 — SOA print layout (AM sample)
Statement of Account now matches the AM print: header Code/Name/Currency + From/To, B/F row, Date/Description/Dr/Cr/Balance with Db/Cr, totals, “Say Account Currency … Only”. Voucher serial stays clickable inside Description.

### Session 2026-08-27 — Accounting AM fixes (P0–P3)
Implemented from `docs/finishing.md` / accounting AM plan: TB class rollup + fallback; SOA/Quick/GL From→To with opening Dr/Cr and one account per page; COA add account; auto AR/AP subaccounts; voucher FX + preview + required JV party + edit = reverse+repost; **P&L AM form**. 65-account audit still waits on AM file. **Prod deploy requested 2026-08-27.**

### Session 2026-08-27 — GL range + TB empty (AM)
`docs/finishing.md`: GL needs From→To accounts; TB not showing rows; classes 1–7 all zero.

### Session 2026-08-27 — Quick statement broken (AM)
`docs/finishing.md`: quick statement preview still wrong — Dr/Cr, grouping, search, PCG display.

### Session 2026-08-27 — Vouchers (AM)
`docs/finishing.md`: currency + FX display, preview before post, JV party required, edit after post, auto client/supplier subaccounts.

### Session 2026-08-27 — Account statement SOA (AM)
`docs/finishing.md`: all accounts in flexible search; opening Dr/Cr; one statement per page; full voucher detail.

### Session 2026-08-27 — GL voucher display (AM)
`docs/finishing.md`: GL rows must open/display full voucher (dialog); clickable serial, not truncated id.

### Session 2026-08-27 — Trial Balance UX (AM)
`docs/finishing.md`: account entry UX, LE/currency clarity, full numbers (no K/M), currency picker, inline voucher view, fullscreen TB.

### Session 2026-08-27 — Accounting finishing (AM)
Account manager capture in `docs/finishing.md`: COA add-account (auto or manual code), **65 accounts** audit pending.

### Session 2026-08-24 — Dual-push policy
Code + docs mirrored: `AynBeirut/ecosystem` ↔ `a-nooor/ecosystem`; `AynBeirut/grabio-platform-docs` ↔ `a-nooor/grabio-platform-docs`.

### Session 2026-08-25 — Invoice launch crash fix
v1.2.10 (code 14) crashed on launch (`expo-keep-awake` + minSdk 21). Upload **`grabio-invoice-mobile/release/invoice-1.2.11-15.aab`** (1.2.11 / code 15). Next code ≥ 16.

Invoice Manager: `docs/handoff/invoice-manager.md`. Admin dashboard: `docs/handoff/admin-dashboard.md`.

### Session 2026-08-23 — Invoice app stays in-app
Products + clients stay in-app. One Settings. Footer `grabio.space/invoice` only. Hosting deployed. Upload **`grabio-invoice-mobile/release/invoice-1.2.10-14.aab`** (1.2.10 / code 14, minSdk 21). Next invoice code ≥ 15.

### Session 2026-08-22 — Deploy v1.2.4
Web hosting live (V·POS/V·Buy/V·Expense). Admin Android **1.2.5 (35)** → `grabio-mobile/release/grabio-1.2.5-35.aab` (orders chip fix + unpaid/schedule). Next admin versionCode ≥ 36.

### Session 2026-08-22 — Native Invoice Manager + CRM app
Standalone Expo app `grabio-invoice-mobile/` — Play package **`space.grabio.finance`**, signed with finance keystore (SHA1 `1B:EF:5B…`). Upload **`grabio-invoice-mobile/release/invoice-1.2.7-11.aab`** (versionName **1.2.7**, versionCode **11**). Play “no deobfuscation file” on v10 is a warning — R8 minify is off. Admin next ≥36; Invoice next ≥12. Trackers: `grabio-mobile/README.md`, `grabio-invoice-mobile/README.md`.

### Session 2026-08-22 — Mobile admin POS fixes
Create Order now loads all sellable products (matches V·POS). Composed/recipe products get quick price/stock edit. Owner Home tab → POS (no public marketplace exit).

### Session 2026-08-22 — V·POS client autofill
Phone match fills name; name typeahead picks existing customer; sale uses matched customerId (no duplicate).

### Session 2026-08-22 — V·OPS speed (round 2)
Bug: warm cache still force-refetched products/materials. Fixed. Catalogs now sessionStorage; ProtectedRoute sub/IP cached across routes; V pages eager-loaded; trial+invoice = one txn.

### Session 2026-08-22 — OCR receipts
Mobile scan → Vision OCR → confirm → save Purchase/Expense; image not stored. Needs Vision API enable + deploy before live.

A comprehensive e-commerce platform built with React, TypeScript, and Firebase, enabling multiple vendors to manage their stores, products, and orders in a unified marketplace.

## Features

### For Buyers

- Browse products from multiple stores
- Add items to cart with delivery address and GPS coordinates
- Google OAuth authentication
- Track order status in real-time
- View detailed order history with product information
- Dual currency display (USD/LBP)

### For Sellers (Premium)

- **Complete Store Management**: Create and customize your store profile
- **Product Management**: Add unlimited products with images and details
- **Order Processing**: Track orders with customer delivery info and GPS coordinates
- **Invoice Generation**: Create and share professional PDF invoices
- **Inventory Control**: Manage stock levels and raw materials
- **Purchase Orders**: Create and track supplier purchase orders
- **Customer Management**: Access customer data and order history
- **Analytics Dashboard**: View sales insights and store performance
- **Template Selection**: Choose from Modern, Classic, or Vibrant store templates
- **Custom Exchange Rates**: Set USD to LBP conversion rates
- **Multi-User Access**: Manage sales staff and sub-accounts

## Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Backend**: Firebase (Authentication, Firestore, Storage, Functions)
- **Build Tool**: Vite
- **PDF Generation**: jsPDF + html2canvas
- **Routing**: React Router
- **State Management**: React Context API
- **UI Components**: Custom components with shadcn/ui patterns

## Authentication

- Google OAuth with popup authentication
- Firebase Authentication for secure user management
- Role-based access control (User/Admin/Seller)

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

```sh
npm install
```

### Environment Variables

Create `.env.production` file:

```env
VITE_API_BASE=https://us-central1-market-flow-7b074.cloudfunctions.net/api
VITE_FIREBASE_AUTH_DOMAIN=market-flow-7b074.firebaseapp.com
```

### Local Development

```sh
npm run dev
```

The app will be available at [http://localhost:8080](http://localhost:8080)

### Build for Production

```sh
npm run build
```

### Deploy to Firebase

```sh
firebase deploy --only hosting
```

## Deployment

- **Live URL**: [https://www.grabio.space](https://www.grabio.space)
- **Firebase Hosting**: market-flow-7b074.web.app
- **Firebase Project**: market-flow-7b074

## Key Features Implementation

### Dual Currency System

- USD as primary currency
- LBP conversion with custom exchange rates per store
- Display both currencies on cart and invoices

### Delivery Management

- Customer delivery address input
- City and notes fields
- GPS coordinates capture
- Google Maps integration for location viewing

### Invoice System

- Generate professional PDF invoices
- Multiple template styles (Modern, Classic, Vibrant)
- Share via native share API or download
- Dual currency display on invoices

### Order Tracking

- Real-time order status updates
- Product details with quantities and prices
- Customer delivery information display
- Store contact information

To deploy, use Vercel, Netlify, or your preferred static hosting provider. Upload the contents of the `dist/` folder.

### General Improvements

- Cleaned up old build artifacts and ensured no legacy plugin code remains.
- README updated with all recent changes and troubleshooting steps.

# HappyBasket

## Project info

**URL**: [https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b)

## Project Name

**HappyBasket** (formerly market-flow-emporium)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Major Changes & Features (2025 Session)

### Firebase/Firestore Integration

- Seller upgrade logic uses Firestore for persistent seller/admin status (`sellers` collection).
- Store profile management is connected to Firestore (`storeProfiles` collection), with type safety and error handling.
- Product management (add/edit/delete) is fully integrated with Firestore (`products` collection), associating products with seller/store ID.

### Security & Setup

- Firestore security rules provided to allow authenticated users to write to their own data.
- Guidance for Firebase project/database setup included.
- Added Payment Credentials section for store admins to securely enter and save WishPay and Visa/MasterCard details to Firestore (`AdminPayments.tsx`).
- Added Cash on Delivery as a payment option for regular users in the cart (`Cart.tsx`).

### UI/UX

- Loading and processing states for async Firestore operations.
- Toast notifications for success/error feedback.

### How to Continue Development

- All seller/admin features are now persistent and user-specific.
- To add more features, follow the Firestore integration patterns in `src/pages/UpgradeToAdmin.tsx`, `src/pages/admin/AdminProfile.tsx`, and `src/pages/admin/AdminProducts.tsx`.

---

---

## What technologies are used for this project?

HappyBasket is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Local editor hints and `.hintrc`

This repository includes a small `.hintrc` file used to tune webhint/editor warnings that are noisy in some dev environments (for example, theme-color compatibility messages across older browsers or inline-style rules flagged by some tools).

- Why: these rules were added to reduce distracting editor warnings while debugging the admin routing/hook issue.
- How to opt-out: remove or rename `.hintrc` in the repo root. Your editor will then show the original webhint warnings again.
- How to adjust: open `.hintrc` and update or remove specific rules; prefer editing the rules rather than deleting the file so CI behavior remains consistent for the team.

If you'd like, I can revert `.hintrc` and instead fix individual issues strictly (for example by removing all inline styles) — tell me which approach you prefer.  
  
Quick Stack Tip: Since you're using React, don't upload directly from the frontend to R2 using your master API keys. Generate an S3 Pre-signed URL using a lightweight Firebase Cloud Function. The React frontend gets the temporary URL from the function and uploads the image securely straight to R2.

This setup gives you the fast delivery speed your clients want without risking unexpected multi-hundred-dollar bills.

Which project are we configuring this for first? Let me know if you want the boilerplate code for the pre-signed URL upload flow.