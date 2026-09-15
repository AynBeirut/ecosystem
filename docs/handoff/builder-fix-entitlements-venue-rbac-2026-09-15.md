# Builder Prompt - Fix Entitlements vs Venue Toggles vs Sub-Account RBAC

Use this prompt in the builder/execution conversation.

---

You are working in `/home/anwar/Documents/grabio space`.

Mission: fix the architecture confusion between billing/subscription, venue UI toggles, and sub-account permissions.

Do not treat restaurant venue toggles as paid access. Do not give accounting, SEO, builder, inventory, or finance features for free.

## Correct Access Model

Every feature must pass three layers:

```text
allowed = subscription/module entitlement AND store setting/toggle AND user/sub-account permission
```

Layer 1 - Package / subscription / entitlements:

- Hard billing gate.
- Decides what the store bought.
- If a store did not buy accounting, finance routes/tools must stay blocked.
- If a store did not buy SEO/builder/template service, those surfaces must stay blocked.
- Venue toggles must never unlock unpaid modules.

Layer 2 - Store settings / venue toggles:

- Soft configuration inside what the store already has access to.
- Controls restaurant-first layout, visibility preference, setup flow, and maturity-stage UX.
- Cannot grant a feature missing from entitlements.
- Example: `enableBusinessFinance` only matters if finance/accounting entitlement exists.

Layer 3 - User / sub-account permissions:

- Per-user access inside the store's entitled features.
- Managed from the Sub Accounts page.
- Store admin should add/remove what each sub-account can see on their account/dashboard.
- User permissions cannot exceed store entitlements.

## What To Fix

Audit and enforce this formula across navigation, route gates, setup readiness, mobile, and backend:

```text
featureVisible = isEntitled(feature) && isEnabledForStore(feature) && userCanAccess(feature)
```

For restaurant-first nav:

```text
showFinanceNav = financeEntitled && venueFinanceToggle && userFinancePermission
showInventoryNav = inventoryEntitled && venueInventoryToggle && userInventoryPermission
showSeoBuilderNav = seoOrBuilderEntitled && venueGrowToggle && userBuilderOrSeoPermission
```

If entitlement is false, the feature must not appear as enabled just because a venue toggle is on.

## Inspect First

- `src/lib/venueOpsNav.ts`
- `src/hooks/useAdminNavigation.ts`
- `src/lib/venueSetupReadiness.ts`
- `src/lib/venueOpsSettingsUi.ts`
- `src/lib/productClassification.ts`
- `src/lib/packageEntitlements.ts`
- `src/hooks/useStoreEntitlements.ts`
- `src/components/ModuleGate.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/lib/subAccountAccess.ts`
- `src/types/subaccount.ts`
- `src/pages/admin/AdminSubAccounts.tsx`
- `src/pages/admin/AdminProfile.tsx`
- `src/pages/admin/AdminGrabioPlatform.tsx`
- `grabio-mobile/src/lib/entitlements.ts`
- `grabio-mobile/src/lib/venueRolePolicy.ts`
- `functions/src/lib/moduleManifest.ts`

## Sub-Account Page Requirement

Sub-account permissions must be manageable from the Sub Accounts page.

Required direction:

- Role templates provide safe defaults.
- Store admin can add/remove allowed views/actions per sub-account where the package supports it.
- Dashboard/nav visibility should follow the effective sub-account permission.
- Sensitive areas like finance, accounting, SEO, builder, cost, inventory, and reports must be explicit permissions.
- Permissions must remain store-scoped and tenant-safe.

Do not create hidden one-account exceptions.

## Billing Rule

If the user did not pay for a module:

- Do not show it as active.
- Do not let a venue toggle activate it.
- Do not let a sub-account permission activate it.
- Show locked/upgrade state only where product intentionally allows upsell.

Examples:

- No accounting subscription: no ledger, vouchers, trial balance, GL, invoice manager accounting tools.
- No SEO/builder service: no SEO/builder/admin template tools except allowed basic store profile branding.
- No inventory module: no stock/purchasing/costing dashboards unless included by the subscribed package.

## Done When

- `venueOpsSettings` is confirmed as layout/setup config only, not billing.
- Finance/inventory/SEO/builder nav requires entitlement + venue toggle + user permission.
- Route gates still block direct URL access even if nav hides correctly.
- Sub-account page direction is documented or implemented for per-user dashboard/access control.
- Mobile and Functions are not reading venue toggles as paid access.
- Tests cover at least:
  - no finance entitlement + finance toggle on = blocked/hidden
  - finance entitlement + finance toggle off = hidden/disabled
  - finance entitlement + toggle on + no user permission = blocked
  - builder/SEO entitlement false = blocked even if Grow toggle is on
  - manager/admin permissions still work only inside entitled modules

## Do Not Do

- Do not deploy.
- Do not push.
- Do not run production write scripts.
- Do not grant free modules through store settings.
- Do not hardcode one restaurant or one sub-account.
- Do not mix subscription billing with UI preference toggles.
- Do not remove existing modules.

## Required Final Report

Report:

- Files changed.
- Exact gating formula implemented.
- Which routes/nav items were audited.
- Sub Accounts page changes or documented next step.
- Tests/builds run.
- Evidence files written.
- Remaining risks.
- Whether deploy/push is pending approval.

Do not say verified unless verification actually ran.
