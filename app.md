# Grabio App — Session Recap

## App Identity
- **Package**: `space.grabio.app`
- **App Name**: Grabio
- **Current versionCode**: 9
- **Current versionName**: `1.1.4`
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
# Build release AAB
cd "/home/anwar/Documents/grabio space/grabio-mobile/android"
./gradlew bundleRelease

# AAB output location
grabio-mobile/android/app/build/outputs/bundle/release/app-release.aab

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
- `versionCode 9`
- `versionName "1.1.4"`
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

## Problems Fixed This Session

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

## Stack
- **React Native**: 0.81.5
- **Expo**: managed workflow
- **Firebase**: modular API (`@react-native-firebase/firestore`)
- **Google Sign-In**: `@react-native-google-signin/google-signin` (requires minSdk 24)
- **Build tool**: Gradle 8.14.3

## Play Store Notes
- The "7 devices" error was caused by hardware feature auto-requirements from permissions — fixed in versionCode 9
- If Play Store shows a confirmation dialog about device changes, click **Proceed** to accept
- Each upload MUST use a higher versionCode than the previous one
- Upload path: Play Console → Your App → Production → Create new release → Upload AAB

## Version History
| versionCode | versionName | Notes |
|---|---|---|
| 5 | 1.1.0 | Rejected — already used |
| 6 | 1.1.1 | ABI fix (all 4 ABIs) |
| 7 | 1.1.2 | Bumped due to rejection |
| 8 | 1.1.3 | Bumped due to rejection |
| 9 | 1.1.4 | AndroidManifest hardware feature fix |
