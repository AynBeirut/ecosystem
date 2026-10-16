# Handoff — Anwar invoice template + quotation move (2026-09-19)

## Source of truth

Use this PDF as the invoice visual/source-of-truth reference:

- `/home/anwar/Downloads/7b4a747b-3f04-4e6f-bf3b-967a00c90c93.pdf`

Extracted fields:

- Email: `info@emoove.co`
- Phone: `+96171110952`
- Tax ID: `3107098`
- Footer country: `Lebanon`
- Footer website: `www.emoove.co`
- Invoice number: `INV-1789822490321`
- Client: `جمعية الرجاء ( مائدة المحبة )`

## What changed

### Branding settings

Store: `Av22LKyet8QmVcu9b8Njz1HVfoy1`

Patched live `storeProfiles/{storeId}.financeDocumentSettings`:

- `documentCompanyName: E-Service`
- `documentAddress: Lebanon`
- `documentPhone: +96171110952`
- `documentEmail: info@emoove.co`
- `documentWebsite: www.emoove.co`
- `documentCountry: Lebanon`
- `documentTaxId: 3107098`
- Existing logo/signature/template/layout preserved.

Evidence:

- `reporting/data/anwar-eservice-document-branding-2026-09-19.json`
- `reporting/data/anwar-order-invoice-number-source-truth-2026-09-19.json`

### Numbering rule

Added project rule:

- `.cursor/rules/no-opaque-document-ids.mdc`

Rule: no Firestore IDs, sliced IDs, POS IDs, or random tokens in document filenames, labels, memos, emails, PDFs, or UI labels.

Added helper:

- `src/lib/orderDocumentRef.ts`

Key behavior:

- Existing orders missing `invoiceNumber` get a real persisted number before PDF generation.
- The source order was corrected to `INV-1789822490321`.

### Web PDF code paths touched

Order page:

- `src/lib/invoiceTemplates.ts`
- `src/pages/admin/AdminOrders.tsx`

Invoice Manager:

- `vendor/beirut-finance-flow-main/src/lib/pdfExport.ts`
- `vendor/beirut-finance-flow-main/src/lib/grabio/storeService.ts`
- `vendor/beirut-finance-flow-main/src/lib/grabio/types.ts`

Document settings UI/model:

- `src/lib/financeDocumentSettings.ts`
- `src/types/storeProfile.ts`
- `src/pages/admin/finance/BusinessFinanceInvoiceTemplateSetup.tsx`

Related no-opaque-ID cleanup:

- `src/pages/admin/AdminPurchases.tsx`
- `src/pages/admin/AdminScheduledOrders.tsx`
- `src/pages/admin/AdminBankReconciliation.tsx`
- `src/pages/admin/AdminReports.tsx`
- `src/pages/admin/SalesReturns.tsx`
- `src/lib/resolveOrderCogs.ts`
- `src/lib/deliveryWalletService.ts`

## Deployments / verification

Build/deploy commands run multiple times:

- `npm run build`
- `firebase deploy --only hosting`

Latest confirmed live timestamp:

- `Sat, 19 Sep 2026 14:21:13 GMT`

Live domain check:

- `https://grabio.space` returned HTTP `200`.

Browser UI limitation:

- Browser test login `info@aynbeirut.com` redirects to `/subscription`, not the E-Service owner order page.
- No owner/E-Service password is filed in `.credentials.md`.
- Owner UI click-through could not be verified by agent.

## Final requested data move

Anwar requested to stop template work and move both records to quotation.

Moved:

- Invoice Manager invoice `financeInvoices/IB7kkQ7h8QA4PUfjOva5`
  - To `stores/Av22LKyet8QmVcu9b8Njz1HVfoy1/financeEstimates/QTN-1789822490321-INVOICE`
  - Amount: `$8,732`
  - Status: `draft`

- Order page order `orders/xFQSzNkeOzpkSTKVM2r9`
  - To `stores/Av22LKyet8QmVcu9b8Njz1HVfoy1/financeEstimates/QTN-1789822490321-ORDER`
  - Amount: `$12,082`
  - Previous status: `confirmed`
  - Previous payment status: `unpaid`
  - Status: `draft`

Verification:

- Original invoice record no longer exists in `financeInvoices`.
- Original order record no longer exists in `orders`.
- Both quotation records exist in `financeEstimates`.

Evidence:

- `reporting/data/anwar-move-invoice-order-to-quotations-2026-09-19.json`

## Current status

- The two problematic records are no longer invoices/orders.
- They are now draft quotations.
- Anwar will generate PDFs from mobile, not web.
- Do not continue spending time on web invoice template matching unless Anwar explicitly reopens that work.

## Remaining risks

- Deleting the order removes it from order reports and order workflows.
- If any ledger/stock side effects had been posted from the order before deletion, they were not reversed in this final move.
- UI verification of quotation page was not performed because owner login was unavailable to the agent.

