# White Label Client App

## What this is

A copy of the Grabio guest-mode customer app, intended to become a **standalone branded app** for individual Grabio store owners (clients).

Each client gets their own app — with their logo, name, domain, and app store listing — that shows only their store and lets their customers browse, order, and track deliveries.

---

## Concept

A bakery owner on Grabio wants their customers to download "Bakery X App" from the Play Store — not the Grabio marketplace. They get:

- Their own app name, icon, and splash screen
- Their own domain (e.g., `orders.bakeryx.com`) as the deep link base
- App loads only their store — no marketplace, no competitors
- Their customers order, pay, and track — all within the branded app
- The seller manages everything from the same Grabio seller dashboard

---

## What needs to be customized per client

| Item | File to change |
|---|---|
| App name | `app.json` → `name`, `slug` |
| App icon | `assets/icon.png`, `assets/splash.png` |
| Bundle ID | `app.json` → `android.package`, `ios.bundleIdentifier` |
| Deep link domain | `app.json` → `intentFilters` host |
| Store ID (hardcoded) | `src/config/clientConfig.ts` ← to be created |
| Brand color | `src/theme.ts` |
| Firebase project | `google-services.json`, `GoogleService-Info.plist` |

---

## Architecture

- Based on: `grabio-mobile` guest-mode screens only
- No owner/seller screens included
- Screens: Marketplace (single store) → Product Detail → Cart → Checkout → Order Tracking
- Auth: Guest mode only (no login required)
- Backend: Shared Grabio Firebase project, filtered by `storeId`

---

## Status

✅ **Integrated with Grabio Firebase** — no Supabase, single backend  
✅ **Single-store customer app** — filtered by `storeId` in `app.json` extra  
✅ **Guest checkout** — no Grabio marketplace login  
✅ **Admin hub** — `/admin/whitelabel` in Grabio dashboard  

🔲 Per-client EAS builds — set `storeId` in `app.json` extra before each build  
🔲 Custom icon/splash per client  
🔲 Play Store / App Store submission per client  

---

## Configure a client build

1. Open Grabio admin → **White-Label Store App** (`/admin/whitelabel`)
2. Copy your **Store ID**
3. Edit `app.json`:

```json
"extra": {
  "storeId": "YOUR_FIREBASE_STORE_ID",
  "appName": "Bakery X",
  "deepLinkHost": "grabio.space"
}
```

4. Replace icon/splash in `assets/`
5. Run `eas build --profile preview` (APK) or `production`

---

## Next Steps

See `backlog.md` in root workspace for full task list.
