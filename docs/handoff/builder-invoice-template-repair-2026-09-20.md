# Builder handoff — Invoice Template Repair (2026-09-20)

Paste everything below the line into a **new builder/execution** chat. Planning conversation is preserved separately.

---

```text
You are working in /home/anwar/Documents/grabio space.

Mission: make invoice / estimate / quotation PDFs match Invoice Document setup on web and invoice-mobile, add estimate delete, and stop mixing shop branding with document branding. Do not execute restaurant, Play, or tenant-binding work in this chat.

This is the execution conversation. The planning conversation is preserved separately.

## Read first

1. README.md
2. architecture.md
3. decision-log.md (2026-09-10 setup surfaces + 2026-09-19 invoice branding)
4. ~/Documents/grabio-platform-docs/Architecture/Setup-Surface-Separation.md
5. reporting/data/invoice-mobile-issues-reported-2026-09-20.md
6. docs/handoff/anwar-invoice-template-quotation-handoff-2026-09-19.md
7. .cursor/rules/no-opaque-document-ids.mdc
8. Plan: Invoice Template Repair (one resolver, one renderer)

## Setup ownership — non-negotiable

Three surfaces. Do not merge them.

1. Store Profile (src/pages/admin/AdminProfile.tsx)
   Serves the web shop and the online menu.
   Owns shop name, shop logo, public contact, catalog/menu identity, operational defaults.
   Does NOT own A4 invoice layout, document company name, document logo, or PDF colors.

2. Website / Theme setup (Theme Editor / AdminTemplates)
   Serves storefront layout and public page look.

3. Invoice Document setup
   Serves invoices, estimates, quotations, and PDFs only.
   Source of truth: storeProfiles/{storeId}.financeDocumentSettings
   Canonical UI: src/pages/admin/finance/BusinessFinanceInvoiceTemplateSetup.tsx
   Canonical HTML: src/lib/invoiceTemplates.ts via resolveA4DocumentBranding()

Fallback only: if document company/logo/address are empty, PDF may use Store Profile name/logo.
Saving Store Profile must not overwrite financeDocumentSettings.
Saving Invoice Document setup must not change the online shop or menu.

## Why this is broken

There are three PDF engines, not one template:

- Orders: src/lib/invoiceTemplates.ts (HTML, uses resolveA4DocumentBranding)
- Invoice Manager: vendor/beirut-finance-flow-main/src/lib/pdfExport.ts (jsPDF; ignores invoiceTemplate)
- Invoice mobile: grabio-invoice-mobile/src/lib/pdfShare.ts (hardcoded teal HTML; uses profile.name)

Invoice Document setup is not routed. Invoice Manager CompanyProfile has a primitive 3-style picker that PDFs ignore. Mobile has no document setup screen.

## Locked rules

- Test store: E-Service Av22LKyet8QmVcu9b8Njz1HVfoy1
- Do not write NIPCO financeDocumentSettings (DfIhBAEZ5NR7yNX0HboZvv58Nf82). Keep NIPCO PDF lock path.
- One branding resolver. One PDF renderer. Do not invent a fourth engine.
- Canonical renderer is the order HTML in src/lib/invoiceTemplates.ts. IM and mobile must print that HTML.
- No Firestore ids in UI, PDFs, or filenames. Numbers are EST-/INV-YYYY-MM-DD-000001.
- Mobile numbering: allocate one serial. Do not run full-store renumber from the phone.
- Tenant: users.subAccountId → that subAccount.storeId. Never email-only, never unscoped limit(1).
- storeId is never subAccountId.
- No Play sideload over backup 1.2.44 (48). No deploy/push without Anwar approval.
- Do not mix NIPCO and Little Hands emails/roles.

## Slice 1 — one resolver, one renderer, one setup page

1. Expand resolveA4DocumentBranding() in src/lib/financeDocumentSettings.ts to be the only branding function (logo, company, address, phone, email, website, tax, colors, layout, template, signature).
2. Keep src/lib/invoiceTemplates.ts as the only document HTML. Change vendor/beirut-finance-flow-main/src/lib/pdfExport.ts and grabio-invoice-mobile/src/lib/pdfShare.ts to print that HTML. Do not keep a parallel jsPDF layout family. NIPCO stays on its locked path.
3. Fix storeProfileToCompany() in vendor/beirut-finance-flow-main/src/lib/grabio/storeService.ts: financeDocumentSettings.invoiceTemplate first, then top-level invoiceTemplate. Stop defaulting silently to basic.
4. Stop using shop name as invoice header when documentCompanyName exists.
5. Wire BusinessFinanceInvoiceTemplateSetup into Invoice Manager web and invoice-mobile settings. Remove or redirect the Company Profile 3-style picker so setup cannot drift. One write helper: updateFinanceDocumentSettings().
6. Verify Store Profile save does not overwrite document template fields.

Done when the same saved Invoice Document setup prints the same page on order PDF, Invoice Manager PDF, and mobile PDF — not just the same colors in different layouts. Shop/menu look must be unchanged.

## Slice 2 — estimate / quotation delete

deleteEstimate already exists unused in vendor/beirut-finance-flow-main/src/context/AppContext.tsx. Mobile has no delete API.

1. Web: Delete on EstimateList.tsx with confirm; call existing deleteEstimate.
2. Mobile: deleteEstimate in grabio-invoice-mobile/src/lib/financeService.ts on stores/{storeId}/financeEstimates/{id}; Delete on EstimatesListScreen.tsx.
3. Store-scoped only. If converted to an invoice, warn then delete the estimate doc. Use existing finance write gate.
4. Show estimateNumber (EST-YYYY-MM-DD-000001), never Firestore ids.

## Slice 3 — invoice-mobile safety (before extra template UI)

From reporting/data/invoice-mobile-issues-reported-2026-09-20.md:

1. Estimate sync: map client_name/clientName, line name/description, tax/discount/total, estimateNumber; await save; do not force status pending on every save; do not reset createdAt.
2. Numbering: allocate one EST-/INV-YYYY-MM-DD-000001. No INV-${Date.now()}. No full-store renumber from the phone.
3. Product create: try/catch + user error; bind storeId correctly (never subAccountId as store).
4. Contrast: explicit color + placeholderTextColor on all create/edit TextInputs.
5. PDF/share uses Slice 1 renderer for invoice and estimate.
6. Nav: Invoices / Products / Settings visible for entitled finance users; Estimates reachable.
7. Install: local APK only after Anwar says so. Do not sideload over Play backup.

## Slice 4 — richer Invoice Document options (last)

Only after Slice 1 is live. Expand Invoice Document setup only, not Store Profile:

- Identity: logo, company name, address, phone, email, website, tax ID, country
- Layout: map existing keys classic/modern/professional/minimal; do not add an unused enum
- Colors: primary, secondary, text
- Optional: signature, footer, show/hide tax, show/hide logo
- Live preview must call the same HTML renderer as PDF

Existing stores must not change until the user saves.

## Do not do

- Do not deploy or push.
- Do not sideload the invoice app over Play.
- Do not write NIPCO template/settings.
- Do not turn Store Profile into the invoice editor.
- Do not use Invoice Document setup to restyle the web shop or online menu.
- Do not leave two template pickers (Company Profile + Invoice Document).
- Do not add richer options before the shared renderer is live.
- Do not run unscoped email/sub-account queries.
- Do not show opaque ids in lists, PDFs, or filenames.

## Evidence

Write reporting/data/invoice-template-sync-gate-2026-09-20.json with: resolver used, files changed, which surfaces now read financeDocumentSettings, NIPCO skipped, estimate delete paths, shop/menu unchanged, remaining mobile risks.

Update README.md, decision-log.md, and Setup-Surface-Separation after the resolver is the real SOT.

## Required final report

- Files changed
- Exact branding resolver + renderer path
- Proof shop/menu still read Store Profile, PDFs read financeDocumentSettings
- Estimate delete paths (web + mobile)
- Tests/builds run (say reviewed if not run)
- Evidence JSON path
- What is still pending Anwar approval (deploy, push, APK)
```
