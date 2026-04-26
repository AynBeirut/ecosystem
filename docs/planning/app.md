# Grabio App — Session Recap

## App Identity
- **Package**: `space.grabio.app`
- **App Name**: Grabio
- **Current versionCode**: 12
- **Current versionName**: `1.1.7`
- **minSdkVersion**: 24 (Android 7.0+) — enforced by `@react-native-google-signin`, cannot be lowered
- **targetSdkVersion**: from `rootProject.ext.targetSdkVersion`

## Keystore / Signing
- **Keystore file**: `grabio-release.keystore` (in `grabio-mobile/android/app/`)
- **Key alias**: `grabio`
- **Store password**: `grabio2026`
- **Key password**: `grabio2026`

## Git Repository
- **Remote**: `https://github.com/AynBeirut/grabio.space.git`
- **Branch**: `main`

## Firebase
- **Project**: grabio (from `google-services.json`)
- **Deploy functions**: `cd functions && npm run build && cd .. && firebase deploy --only functions`
- **Firestore order path**: `storeProfiles/{storeId}/orders/{orderId}` (subcollection, NOT collectionGroup)

## Build Commands
```bash
# Build release AAB (for Play Store upload)
cd "/home/anwar/Documents/grabio space/grabio-mobile/android"
./gradlew bundleRelease
# AAB output: grabio-mobile/android/app/build/outputs/bundle/release/app-release.aab

# Build release APK (for ADB direct install)
./gradlew assembleRelease
# APK output: grabio-mobile/android/app/build/outputs/apk/release/app-release.apk

# Full ADB clean install (phone connected via USB)
adb shell pm clear space.grabio.app
adb shell rm -rf /sdcard/Android/data/space.grabio.app
adb uninstall space.grabio.app
adb install "/home/anwar/Documents/grabio space/grabio-mobile/android/app/build/outputs/apk/release/app-release.apk"

# Start Metro (dev)
cd "/home/anwar/Documents/grabio space/grabio-mobile"
nohup npx expo start > /tmp/metro.log 2>&1 & disown

# Launch app on device
adb reverse tcp:8081 tcp:8081
adb shell am start -n space.grabio.app/.MainActivity

# Deploy Firebase functions
cd "/home/anwar/Documents/grabio space/functions"
npm run build
cd ..
firebase deploy --only functions
```

## Key Files Modified This Session

### `grabio-mobile/android/app/build.gradle`
- `versionCode 12`
- `versionName "1.1.7"`
- `minSdkVersion rootProject.ext.minSdkVersion` (resolves to 24)
- Signing config uses `grabio-release.keystore`

### `grabio-mobile/android/gradle.properties`
```
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```
All 4 ABIs included to support all device types.

### `grabio-mobile/android/app/src/main/AndroidManifest.xml`
Added `<uses-feature android:required="false"/>` for:
- `android.hardware.camera`
- `android.hardware.camera.autofocus`
- `android.hardware.microphone`
- `android.hardware.location`
- `android.hardware.location.gps`

This prevents Play Store from filtering out devices without these hardware features.

### `grabio-mobile/metro.config.js`
```js
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```
Must use `expo/metro-config`, NOT `@react-native/metro-config`.

### `grabio-mobile/src/screens/customer/MarketplaceScreen.tsx`
Migrated to modular Firebase API:
```tsx
import { getFirestore, collection, query, where, onSnapshot } from '@react-native-firebase/firestore';
const db = getFirestore();
```

### `grabio-mobile/src/screens/customer/OrderTrackingScreen.tsx`
Uses direct doc path (not collectionGroup):
```tsx
const db = getFirestore();
const orderRef = doc(db, 'storeProfiles', params.storeId, 'orders', params.orderId);
```

### `grabio-mobile/src/screens/customer/CheckoutScreen.tsx`
Fixed setState-during-render by moving `navigation.goBack()` into `useEffect`:
```tsx
useEffect(() => {
  if (items.length === 0) navigation.goBack();
}, [items.length, navigation]);

if (items.length === 0) return null;
```

### `grabio-mobile/src/types/index.ts`
```ts
OrderTracking: { orderId: string; storeId: string };
```

## Problems Fixed

| Problem | Root Cause | Fix |
|---|---|---|
| Firebase deprecation warnings | Namespaced API used | Migrated to modular API |
| `collectionGroup documentId` crash | Requires full doc path | `doc(db, 'storeProfiles', storeId, 'orders', orderId)` |
| Metro `.virtual-metro-entry` 404 | Wrong metro config | `expo/metro-config` |
| Blank screen on device | Metro suspended (`&` alone) | `nohup ... & disown` |
| setState-during-render error | `navigation.goBack()` in render | Moved to `useEffect` |
| Version code rejected (5,6,7,8) | Already used on Play Store | Incremented to 9 |
| 7 devices not supported error | `CAMERA`/`RECORD_AUDIO`/`LOCATION` permissions auto-require hardware | Added `<uses-feature required="false"/>` in AndroidManifest |
| Only 64-bit devices supported | `reactNativeArchitectures=arm64-v8a` only | Changed to all 4 ABIs |
| minSdkVersion cannot go below 24 | `@react-native-google-signin` hard requirement | Accepted — minSdk stays at 24 |
| Google Sign-In DEVELOPER_ERROR | Play App Signing SHA-1 missing from google-services.json | Added both SHA-1s to google-services.json |
| App icon not showing on device | `.webp` files were actually PNG data | Renamed all 15 icon files `.webp` → `.png` in all mipmap folders |
| Adaptive icon XML broken | Missing `</adaptive-icon>` closing tag in both XML files | Added closing tag to `ic_launcher.xml` and `ic_launcher_round.xml` |
| Leftover app data after uninstall | ADB uninstall leaves `/sdcard/Android/data/` folder | Use `pm clear` + `rm -rf` + `uninstall` sequence |

## Stack
- **React Native**: 0.81.5
- **Expo**: managed workflow
- **Firebase**: modular API (`@react-native-firebase/firestore`)
- **Google Sign-In**: `@react-native-google-signin/google-signin` (requires minSdk 24)
- **Build tool**: Gradle 8.14.3

## Google Sign-In SHA-1 Keys
- **Upload key SHA-1**: `3A:74:04:C7:1C:D8:5E:54:E3:EC:68:F1:D7:10:9C:EE:E6:25:AB:DD`
- **Play App Signing SHA-1**: `05:7E:93:36:4B:73:9A:F7:FA:8C:57:AC:AA:24:F6:28:57:1C:50:6A`
- **webClientId**: `997465465802-biu0r3k8ff880560gvgd8tao71361bp4.apps.googleusercontent.com`
- Both SHA-1s must be present in `google-services.json` under `space.grabio.app` client

## Play Store Notes
- The "7 devices" error was caused by hardware feature auto-requirements from permissions — fixed in versionCode 9
- If Play Store shows a confirmation dialog about device changes, click **Proceed** to accept
- Each upload MUST use a higher versionCode than the previous one
- Upload path: Play Console → Your App → **Closed Testing (Alpha)** → Create new release → Upload AAB
- Tester opt-in link: `https://play.google.com/apps/testing/space.grabio.app`
- **Closed testing requirement**: 12+ testers opted-in, 14 days active → unlocks production track

## Version History
| versionCode | versionName | Notes |
|---|---|---|
| 5 | 1.1.0 | Rejected — already used |
| 6 | 1.1.1 | ABI fix (all 4 ABIs) |
| 7 | 1.1.2 | Bumped due to rejection |
| 8 | 1.1.3 | Bumped due to rejection |
| 9 | 1.1.4 | AndroidManifest hardware feature fix |
| 10 | 1.1.5 | Google Sign-In SHA-1 fix |
| 11 | 1.1.6 | Both SHA-1s in google-services.json |
| 12 | 1.1.7 | **CURRENT** — Fixed app icon (webp→png, missing XML closing tags) |

## Closed Testing Status (as of Apr 23 2026)
- ✅ AAB versionCode 12 uploaded to Closed Testing track
- ✅ 12+ testers opted in (acknowledged by Google)
- ⏳ 14-day timer running — completes ~May 7 2026
- After 14 days → Apply for production access
