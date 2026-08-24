# Handoff — Grabio Invoice Manager

**Date:** 2026-08-23  
**Use:** paste this file into a new Cursor chat for Invoice Manager only.

---

## What it is

Native Android app (not TWA, not WebView). Invoices, estimates, receipts, clients, products, CRM field work. Same Firebase account as Grabio.

| Item | Value |
|------|--------|
| Code | `grabio-invoice-mobile/` |
| Play package | `space.grabio.finance` |
| Keystore | `suba eco sys/finance/twa/grabio-finance-release.keystore` (alias `grabio-finance`) |
| Upload SHA1 | `1B:EF:5B:34:12:DF:62:1D:A6:22:64:78:4F:01:50:91:16:D6:10:74` |
| Web (footer only) | `https://grabio.space/invoice/` |

**Never** sign with `grabio-release.keystore` (Admin / `space.grabio.app`).

---

## Current ship

| Field | Value |
|-------|--------|
| Upload now | `grabio-invoice-mobile/release/invoice-1.2.10-14.aab` |
| versionName / versionCode | **1.2.10 / 14** |
| minSdk | **21** (matches old TWA v5 so Play can save) |
| Next code | **≥ 15** |

Play on v14: **warnings only** (new permissions vs TWA v5; no R8 mapping). R8 minify is off — ignore mapping warning. Save/roll out.

Discard drafts **12** and **13** (device-catalog errors vs TWA 21+).

---

## Product rules (non-negotiable)

- App stays in-app. Products + clients add/edit on native screens. Do **not** open Admin web or WebView for those.
- One Settings tab. Footer link `grabio.space/invoice` is the only web exit.
- Flutter is forbidden. Do not wrap the web app as the product.

---

## Data (same as web Invoice Manager)

| Data | Path |
|------|------|
| Invoices | `stores/{storeId}/financeInvoices/{id}` |
| Estimates | `stores/{storeId}/financeEstimates/{id}` |
| Receipts | `stores/{storeId}/financeReceipts/{id}` |
| Clients | `customers` (`storeId`) |
| Products | `products` (`storeId`) |
| CRM | `crmActivities` |

---

## Rebuild

Bump `app.json` **and** `android/app/build.gradle` together. Copy finance keystore into `android/app/`. Then:

```sh
cd "/home/anwar/Documents/grabio space/grabio-invoice-mobile"
cd android && ./gradlew bundleRelease && cd ..
cp android/app/build/outputs/bundle/release/app-release.aab release/invoice-<version>-<code>.aab
```

Update the tracker table in `grabio-invoice-mobile/README.md` **before** Play upload.

Web invoice shell (TWA users still on old binaries): `npm run build:invoice` then `firebase deploy --only hosting:production`.

---

## Do not

- Reuse Play versionCodes (used: 1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14).
- Mix Admin and Invoice keystores.
- Edit the Invoice CRM plan file unless Anwar asks.
- Lower native Hermes/RN below API 24 in **libraries** — the **app** catalog is 21+ via manifest override so Play matches TWA v5.
