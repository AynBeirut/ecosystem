# Handoff — Invoice Manager edit + store currency (2026-09-25)

Paste everything below the line into a new chat.

---

```text
You are working in /home/anwar/Documents/grabio space.

Owner is testing live. Fix and deploy hosting in the same turn. Do not wait for a separate “deploy”. Do not git commit or git push unless asked. Do not enable Stripe. Do not change Whish. Do not delete UI test reservations. Do not mix tenants. Do not show Firestore ids in the UI.

## Where the tester is

Staging (this is the tab they use): https://market-flow-7b074--staging-qj6e98fx.web.app
Production: https://grabio.space
Both already serve assets/index-DAqUWas3.js (hosting release live 1790201096022000, staging 1790201098335000).
Firebase CLI login for anwar.abouhassan@gmail.com is dead. Hosting deploy that works: gcloud access token + curl to firebasehosting.googleapis.com v1beta1. Before finalize, map live config rewrites that use run to { glob, function, functionRegion }. Release the same version to channels live and staging. Do not release an empty version.

## Done this pass

1. E-MOOVE mooveelectro@gmail.com: remaining enabledModules set true on that store only. Evidence reporting/data/emoove-full-access-2026-09-23.json. Stripe stays off.
2. Orders search no longer crashes on a missing customer name. Reservations outside the event window are rejected in the form and the API. Test rows were left in place.
3. Stock & Catalog purchases (src/pages/admin/AdminPurchases.tsx): edit can add lines, supplier name is filled from the supplier record, currency choices are the store main and secondary only.
4. Invoice Manager lists use the purchase row: name, date · amount · status, teal Edit under the name, Preview / Share / Export on the right. Pages: invoices, quotations, receipts, expenses, products. Clients and suppliers show money in the store currency.
5. Document currency is not the world catalog. Shared field: vendor/beirut-finance-flow-main/src/components/StoreCurrencyField.tsx. Full catalog stays on Currency Settings only.
6. Little Hands store profile, read 2026-09-23: mainCurrency USD, secondaryCurrency LBP, accountingMode lebanese, customExchangeRate 0, usdToLbpRate null. So the purchase form shows USD and LBP, and there is no conversion rate.

## Do not reopen

- CRM vs Sales Orders routing, and Expenses vs CRM clients. Not reproduced.
- Stripe, Whish.
- Opaque ids in labels, memos, PDFs.

## Not done

- Nothing in this pass is git-committed.
- Little Hands USD/LBP rate is still 0. Do not invent a rate.
- Admin purchase currency type is still USD | LBP in the stock purchase type. A store whose secondary is neither of those will not round-trip on that page.
- Leftover QA from earlier rounds, only if asked: payments config, announcements, email marketing, delivery wallets, daily presence, salary, marketplace sync, Sally, remaining SEO.
```
