# Handoff — Grabio Admin Dashboard

**Date:** 2026-08-23  
**Use:** paste this file into a new Cursor chat for Admin (web + owner Android) only. Invoice Manager is a **separate** Play app — see `docs/handoff/invoice-manager.md`.

---

## What it is

Owner/staff dashboard: POS, orders, inventory, customers, CRM, finance embed. Two surfaces, one Firebase project.

| Surface | Where |
|---------|--------|
| Web admin | `https://grabio.space/admin` — React/Vite in repo root `src/pages/admin/` |
| Android admin | `grabio-mobile/` — Play **`space.grabio.app`** |

| Item | Value |
|------|--------|
| Web stack | React 18 + Vite + Tailwind + Firebase |
| Admin package | `space.grabio.app` |
| Keystore | `grabio-mobile/android/app/grabio-release.keystore` (alias `grabio`) |
| Upload SHA1 | `3A:74:04:C7:1C:D8:5E:54:E3:EC:68:F1:D7:10:9C:EE:E6:25:AB:DD` |

**Never** sign Admin with the finance keystore (`space.grabio.finance`).

---

## Current ship

| Field | Value |
|-------|--------|
| Web hosting | Live (v1.2.4 session). Invoice hosting also deployed 2026-08-23. |
| Android upload | `grabio-mobile/release/grabio-1.2.5-35.aab` |
| versionName / versionCode | **1.2.5 / 35** |
| Next Android code | **≥ 36** |

### Android 1.2.5 (35) already includes

- Create Order: all sellable products (not `inStock` only).
- Composed/recipe products: quick price/stock edit.
- Home tab → POS (not public marketplace).
- Orders chips: Paid now / Unpaid / Schedule; “Today” includes scheduled-for-today.

---

## Product rules

- Owner app is an **app**. Do not dump users onto a website for core flows (POS, orders, catalog).
- Flutter is forbidden.
- Invoice work for merchants belongs in **Invoice Manager** (`space.grabio.finance`), not a WebView pretending to be Invoice Manager. Admin may still have a legacy Invoice WebView shell — do not extend it.
- Nipco / Little Hands / E-Moove: real data only. No invented metrics.

---

## Important web paths

| Area | Path |
|------|------|
| Admin app | `src/pages/admin/` |
| POS pairing | `/admin/pos` — `src/pages/admin/PosPairing.tsx` |
| POS API | `functions/src/api/posSync.ts` |
| Windows POS download | `pos/Grabio-POS-Setup.exe` (replace same Storage object; do not change the URL) |
| Deploy web | `npm run build` then `firebase deploy --only hosting:production` |

---

## Rebuild Admin Android

Bump `grabio-mobile/app.json` **and** `android/app/build.gradle`. Then:

```sh
cd "/home/anwar/Documents/grabio space/grabio-mobile"
npm run build:android:release
npm run build:android:copy
```

Update the tracker in `grabio-mobile/README.md` **before** Play upload. Next versionCode **≥ 36**.

---

## Do not

- Reuse Admin versionCodes (highest shipped **35**).
- Sign Admin AAB with finance keystore.
- Force-refetch catalogs on every V·OPS navigation (sessionStorage cache is intentional).
- Touch Nipco as a dump target. Accounting: Lebanese PCG display vs Grabio 3-digit posting — do not reseed E-Moove COA.
