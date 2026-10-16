# Little Hands — expense nav + mobile tenant (handoff)

## Issue A (web)

**Symptom:** Expenses only on `/admin/inventory` tiles + dashboard Quick Actions; not in **left sidebar → Stock & Catalog**.

**Root cause:** Real sidebar is `AdminLayout` + `useAdminNavigation.ts`. `AdminDashboard.tsx` `menuGroups` is unused dead code.

**Fix (2026-09-17):** `useAdminNavigation` stock group — **Expenses** + **Quick expense** (`/admin/v-expense`), visibility `showInventoryNav && showStockExpenseNav` (+ store admin for quick expense). Quick-action visibility aligned for inventory managers.

**Verify:** Hard refresh grabio.space → expand **Stock & Catalog** → see Expenses + Quick expense. Deploy hosting after merge.

## Issue B (mobile)

**Symptom:** `manager@grabio.space` sees NIPCO after cache clear.

**Likely cause:** Old Play/APK binary or stale `users.storeId` / `activeStoreId` vs canonical `subAccounts.storeId` (Rule 35).

**Fix (2026-09-17):** `grabio-mobile/src/lib/tenantMismatchGuard.ts` + server-first `subAccounts` bind in `AuthContext.tsx` — alert + sign-out when user doc store ids conflict with subAccount store.

**Verify:** Install fresh build (≥ 1.3.9 / 140 or new release APK), sign out/in → store name = Little Hands.

**Local APK path:** `grabio-mobile/android/app/build/outputs/apk/release/app-release.apk` (rebuild after pull).

## Evidence (when present)

- `reporting/data/littlehands-tenant-auth-2026-09-13.json`
- `reporting/data/littlehands-tenant-isolation-fix-2026-09-12.json`

## Owner checklist

1. `firebase deploy --only hosting:production` (after Anwar approves).
2. Rebuild + adb install mobile APK; confirm sidebar + store name.
3. Close decision-log item when both verified.
