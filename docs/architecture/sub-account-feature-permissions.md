# Sub-account permissions vs entitlements

**Rule:** `allowed = entitlement ∧ store toggle ∧ user permission`

Sub-accounts inherit **store modules** from subscription. They cannot exceed what the store bought.

## Today (web admin)

- **Roles:** `manager` ≈ store admin UI; `sales`, `cashier`, `delivery`, `accounting`, `web_maintenance` use `ROLE_PERMISSIONS` defaults in `src/types/subaccount.ts`.
- **Sensitive areas:** Finance routes require `canAccessRestaurantFinance` (owner/manager/accounting freelancer). Inventory uses `view_inventory` / `manage_inventory`. SEO uses store admin only (`canAccessSeoOps`).
- **Nav:** `useAdminNavigation` reads `effectiveStoreContext` (triple gate).
- **Direct URLs:** `ProtectedRoute` + `getAdminPathFeatureDenial`.

## Sub Accounts page — next implementation slice

1. Expose checkboxes for `view_inventory`, `manage_inventory`, `view_reports`, `process_payments`, etc., capped by store entitlements (disable options not on subscription).
2. Add explicit `view_finance` / `view_seo` permissions when product approves Firestore schema change (today finance is role-based manager/admin only).
3. Preview effective nav for selected sub-account using `resolveEffectiveStoreContext` with that user shape.

No per-store hardcoding.
