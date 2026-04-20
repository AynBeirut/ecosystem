# 📱 Grabio Mobile App — Scope & Feature List
**Last Updated:** April 18, 2026  
**Stack:** React Native + Expo  
**Backend:** Shared Firebase (Firestore + Cloud Functions) — same as web

---

## ✅ Customer Features

| Feature | Notes |
|---------|-------|
| Browse marketplace (stores + products) | Firestore queries, same as web |
| Search + filter | By name, category, price range |
| Store detail page | Read-only |
| Product detail page | Read-only |
| Cart + checkout | Calls `/payment/checkout` Cloud Function |
| Order tracking | Reads `orders` collection |
| Favorites | Reads/writes `users/{id}/favorites` |
| Login / Signup | Firebase Auth — Google + email/password |
| WhatsApp contact button | `wa.me/` deep link |
| Push notifications | FCM — order status updates |

---

## ✅ Store Owner Features (on-the-go)

| Feature | Notes |
|---------|-------|
| View incoming orders | Read `orders` where `storeId == myStore` |
| Change order status | Update `orders/{id}.status` |
| View products list | Read-only for all product types |
| **Simple products only:** create | Write to `products` collection |
| **Simple products only:** edit | Update name, price, stock, image, category |
| Upload product images | Expo ImagePicker → Firebase Storage |
| Quick stock toggle | Update `products/{id}.inStock` |
| Revenue summary | Today / this week totals from `orders` |
| Push notifications | New order, expiry alert, low stock alert |

> ⚠️ Composed products, production runs, finished goods, recipes — **READ ONLY** on mobile. Full management stays on web.

---

## 🖥️ Web Only (not in mobile app)

- Composed product create/edit
- Production runs
- Finished goods inventory
- Recipes + raw materials
- Suppliers + purchases + returns
- Staff + salaries
- Financial reports + bank reconciliation
- Subscription + billing
- Store design / template editor
- Sub-accounts management
- Email marketing campaigns
- Custom domain setup
- Audit logs
- Announcements manager

---

## 🔌 Required Backend Endpoints

| Endpoint | Status | Used for |
|----------|--------|---------|
| `POST /payment/checkout` | ✅ Live | Cart checkout |
| `GET /sitemap.xml` | ✅ Live | (web only) |
| `POST /contact/send` | ✅ Live | Contact store |
| `POST /subscription/*` | ✅ Live | (web only) |
| `POST /marketing/*` | ✅ Live | (web only) |
| FCM push notifications | ✅ Live | New orders, expiry, low stock |
| Firebase Storage (images) | ✅ Live | Product image upload |
| Firestore: `orders` | ✅ Live | Order list + status update |
| Firestore: `products` | ✅ Live | Product CRUD |
| Firestore: `storeProfiles` | ✅ Live | Store info |

---

## 📦 Expo Packages Needed

```bash
npx create-expo-app grabio-mobile --template blank-typescript
cd grabio-mobile

# Navigation
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

# Firebase
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/storage @react-native-firebase/messaging

# Image picker
npx expo install expo-image-picker

# Push notifications
npx expo install expo-notifications expo-device

# Google Sign-In
npx expo install @react-native-google-signin/google-signin

# Storage (AsyncStorage for cart/favorites)
npx expo install @react-native-async-storage/async-storage
```

---

## 🗂️ Proposed Folder Structure

```
grabio-mobile/
├── app/                     # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx        # Marketplace
│   │   ├── cart.tsx         # Cart
│   │   ├── orders.tsx       # Order tracking
│   │   └── profile.tsx      # Login / profile
│   ├── store/[slug].tsx     # Store detail
│   ├── product/[id].tsx     # Product detail
│   └── owner/
│       ├── orders.tsx       # Manage orders
│       ├── products.tsx     # Products list
│       └── product-form.tsx # Create/edit simple product
├── components/              # Shared UI
├── lib/
│   ├── firebase.ts          # Firebase config
│   ├── analytics.ts         # GA4 (reuse)
│   └── notifications.ts     # FCM setup
├── context/
│   ├── AuthContext.tsx
│   └── CartContext.tsx
└── types/
    └── product.ts           # Shared types (copy from web)
```

---

## 🚀 Build Order

1. Scaffold + Firebase config + Auth (Google + email)
2. Marketplace — browse stores + products
3. Store detail + Product detail
4. Cart + Checkout (calls existing Cloud Function)
5. Order tracking (customer)
6. Store owner: orders list + status update
7. Store owner: create/edit simple product + image upload
8. Push notifications (FCM)
9. App Store + Google Play submission prep

---

## 📋 Pre-Build Checklist (backend verification)

- [x] `/payment/checkout` supports guest + auth checkout
- [x] FCM tokens saved to `storeProfiles/{id}.fcmTokens`
- [x] Push notification sent on new order (Cloud Function)
- [x] Push notification sent on expiry alert (`checkExpiringStock`)
- [ ] Push notification for low stock — **needs to be added to `checkExpiringStock`**
- [x] Firebase Storage rules allow authenticated writes to `products/images/`
- [ ] Storage rules — verify mobile upload path is allowed
- [ ] Firestore rules — verify `products` write allowed for store owner from mobile

---

## ⚠️ Pre-Build Fixes Needed (see audit)

Items flagged during backend audit before scaffolding the app.
