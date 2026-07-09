# Builder Phase 1 — Emulator test matrix

Run locally (no prod deploy):

```bash
npm run test:builder-phase1
```

## Unit: `storeCommerceGuard` (`scripts/testStoreCommerceGuard.cjs`)

| ID | Case | Expected |
|----|------|----------|
| G1 | Missing storeId | `MISSING_STORE_ID` |
| G2 | Missing profile | `STORE_NOT_FOUND` |
| G3 | `isDemo: true` | `DEMO_STORE` |
| G4 | `subscriptionStatus: active` | eligible |
| G5 | `subscriptionStatus: trial` | eligible |
| G6 | Legacy (no status field) | eligible |
| G7 | `subscriptionStatus: expired` | `SUBSCRIPTION_INACTIVE` |
| G8 | `subscriptionStatus: blocked` | `SUBSCRIPTION_INACTIVE` |

## Firestore rules (`scripts/testFirestoreRules.cjs`)

### Regression (existing CRM/finance checks)
Cases 1–8, 1b, 1c, 6, 6b, 7, 8a, 8b — must still pass.

### Phase 1 commerce / builder (new)
| ID | Case | Expected |
|----|------|----------|
| P1-1 | Stranger creates `products/` on indigo | DENY |
| P1-2 | Owner creates product on legacy store (no status) | ALLOW |
| P1-3 | Product with `storeId` = demo profile (`isDemo`) | DENY |
| P1-4 | Order on expired store | DENY |
| P1-5 | Builder writes `builders/{uid}/demoStores/.../products` | ALLOW |
| P1-6 | Stranger writes builder demo path | DENY |
| P1-7 | Stranger creates `subAccounts` on foreign store | DENY |
| P1-8 | Store owner creates `subAccounts` | ALLOW |

## Server guards (manual / Phase 1b integration)

After `functions` build, verify endpoints return 403 for demo/expired storeId:

- `POST /checkout` (index)
- `POST /payment/checkout`, stripe/square/omt/bob
- `POST /marketing/subscribe`
- `POST /pos/pairing/code`
- AI credit deduction routes

Use emulator or staging with seeded `storeProfiles` demo doc — **not prod without approved deploy**.
