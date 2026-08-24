# Grabio Admin (Mobile)

React Native / Expo admin app — POS, orders, inventory, CRM, WebView Invoice shell.

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
| **35** | **1.2.5** | `release/grabio-1.2.5-35.aab` | **Current — upload this** |
| 34 | 1.2.4 | `release/grabio-1.2.4-34.aab` | shipped |
| 33 | 1.2.3 | `release/grabio-admin-v1.2.3-build33.aab` | shipped |
| 32 | 1.2.2 | `release/grabio-admin-v1.2.2-build32.aab` | shipped |
| 31 | 1.2.1 | `release/grabio-admin-v1.2.1-build31.aab` | shipped |

**Next Android release must be versionCode ≥ 36.**

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
