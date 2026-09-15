# Grabio Admin (Mobile)

React Native / Expo admin app — native POS, orders, inventory, CRM, team tasks.

## Identity

| Field | Value |
|--------|--------|
| Play package | `space.grabio.app` |
| iOS bundle | `space.grabio.app` |
| Signing keystore | `android/app/grabio-release.keystore` |
| Key alias | `grabio` |
| Upload SHA1 | `3A:74:04:C7:1C:D8:5E:54:E3:EC:68:F1:D7:10:9C:EE:E6:25:AB:DD` |

## Play release tracker (MUST update every build)

**Before any Play upload:** bump `versionCode` to **highest used + 1**. Never reuse a code.

| versionCode | versionName | Artifact | Status |
|-------------|-------------|----------|--------|
| **140** | **1.3.9** | `release/grabio-1.3.9-140.aab` | **Built — tenant bind + mismatch guard; upload to Play** |
| **137** | **1.3.6** | `release/grabio-1.3.6-137.aab` | shipped (emoji icons) |
| 135 | 1.3.4 | sideload only | was on Anwar phone 2026-09-09 |
| 125 | 1.2.94 | `release/grabio-1.2.94-125.aab` | shipped |
| 124 | 1.2.93 | `release/grabio-1.2.93-124.aab` | shipped |
| 35 | 1.2.5 | `release/grabio-1.2.5-35.aab` | legacy |

**Next Android release must be versionCode ≥ 126.**

Also set the same numbers in:
- `app.json` → `expo.version` + `expo.android.versionCode`
- `android/app/build.gradle` → `versionName` + `versionCode`

## Build Android release

```sh
cd grabio-mobile
# 1) Bump versionCode / versionName in app.json AND android/app/build.gradle
# 2) Build
npm run build:android:release
npm run build:android:copy
# 3) Append the new row to the table above BEFORE uploading
```

## Do not confuse with Invoice Manager

Invoice Manager is a **different** Play app: `space.grabio.finance` (see `../grabio-invoice-mobile/README.md`). Different package, different keystore, different versionCode sequence.
