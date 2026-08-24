# Grabio Invoice Manager (Mobile)

Standalone React Native/Expo app — native invoices, estimates, receipts, clients, products, CRM field work.

## Identity

| Field | Value |
|--------|--------|
| Play package | `space.grabio.finance` |
| iOS bundle | `space.grabio.finance` |
| Signing keystore | `android/app/grabio-finance-release.keystore` (from `suba eco sys/finance/twa/`) |
| Key alias | `grabio-finance` |
| Upload SHA1 | `1B:EF:5B:34:12:DF:62:1D:A6:22:64:78:4F:01:50:91:16:D6:10:74` |

**Never** sign this app with `grabio-release.keystore` (that is Admin / `space.grabio.app` only — SHA1 `3A:74:04…`).

## Play release tracker (MUST update every build)

**Before any Play upload:** bump `versionCode` to **highest used on Play + 1**. Never reuse a code.

Used on Play Console (as of 2026-08-22):

| versionCode | versionName | Notes |
|-------------|-------------|--------|
| 9 | 1.2.5 | Play — Active |
| 8 | 1.2.4 | Play — Active |
| 7 | 1.2.3 | Play — Inactive |
| 5 | 1.2.1 | Play — Active |
| 4 | 1.2.0 | Play — Active |
| 3 | 1.1.0 | Play — Inactive |
| 1 | (unnamed) | Play — Active |

Local builds / upload candidates:

| versionCode | versionName | Artifact | Status |
|-------------|-------------|----------|--------|
| **14** | **1.2.10** | `release/invoice-1.2.10-14.aab` | **Current — upload this** (declares minSdk 21 to match TWA v5) |
| 13 | 1.2.9 | `release/invoice-1.2.9-13.aab` | discarded — Play 24+ device drop |
| 12 | 1.2.8 | `release/invoice-1.2.8-12.aab` | discarded — Play device-catalog drop vs TWA |
| 11 | 1.2.7 | `release/invoice-1.2.7-11.aab` | superseded |
| 10 | 1.2.6 | `release/invoice-1.2.6-10.aab` | on Play (warning only — no R8 mapping needed) |
| 5 | 1.2.1 | `release/invoice-1.2.1-5.aab` | DO NOT upload (code already on Play) |
| 4 | 1.2.0 | `release/invoice-1.2.0-4.aab` | DO NOT upload (code already on Play) |

**Next Android release must be versionCode ≥ 15.**

Play device-catalog error on v12: TWA (minSdk 21, no GPS feature) vs native Expo (minSdk 24). v13 marks location/GPS/touchscreen as optional and unlocks orientation. Remaining drop is Android 5–6 only — proceed if Play still flags it. R8 mapping warning is safe (minify is off).

Play “no deobfuscation file” on v10 is a **warning**, not a reject. This app does **not** minify with R8 (`android.enableMinifyInReleaseBuilds` is false). v11 includes native debug symbols (`ndk.debugSymbolLevel = SYMBOL_TABLE`).

Also set the same numbers in:
- `app.json` → `expo.version` + `expo.android.versionCode`
- `android/app/build.gradle` → `versionName` + `versionCode`

## Firestore model

| Data | Path |
|------|------|
| Invoices | `stores/{storeId}/financeInvoices/{id}` |
| Estimates | `stores/{storeId}/financeEstimates/{id}` |
| Receipts | `stores/{storeId}/financeReceipts/{id}` |
| Clients | `customers` (`storeId`) |
| Products | `products` (`storeId`) |
| CRM | `crmActivities` |

## Build Android release

```sh
cd grabio-invoice-mobile
# 1) Bump versionCode / versionName in app.json AND android/app/build.gradle
# 2) Ensure finance keystore is present
cp "../suba eco sys/finance/twa/grabio-finance-release.keystore" android/app/
# 3) Build (signing config already points at grabio-finance-release.keystore)
cd android && ./gradlew clean bundleRelease && cd ..
cp android/app/build/outputs/bundle/release/app-release.aab release/invoice-<version>-<code>.aab
# 4) Append the new row to the tracker table ABOVE before uploading
```

## Firebase note

Register Android app `space.grabio.finance` in Firebase Console and keep `google-services.json` in sync for production Google Sign-In.

## iOS

Same codebase — `npx expo prebuild --platform ios` when Apple developer account is ready (`space.grabio.finance`).

## Do not confuse with Grabio Admin

Admin app is **`space.grabio.app`** (see `../grabio-mobile/README.md`). Separate Play listing and versionCode sequence.
