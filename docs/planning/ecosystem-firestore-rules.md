# Ecosystem Firestore Rules Plan (Phase 0)

**Status:** Document only — no production rules deploy without owner sign-off.

## New `storeProfiles` fields

| Field | Type | Who writes |
|-------|------|------------|
| `pricingVersion` | string | Owner (onboarding), Cloud Functions (renewal migration) |
| `businessWorkflow` | string | Owner (onboarding) |
| `startingPackage` | string | Owner (onboarding) |
| `enabledModules` | map | Owner (onboarding), Functions (renewal) |
| `seatCount` | number | Owner, Functions |
| `posLocationCount` | number | Owner, Functions |
| `composedProductSource` | string | Owner (POS pairing) |
| `nextPlanPreset` | string | Functions (migration scheduler) |
| `nextEnabledModules` | map | Functions |
| `scheduledPlanMigrationAt` | timestamp | Functions |
| `legacyPlanSnapshot` | map | Functions |

## Proposed rule additions (draft)

```
match /storeProfiles/{storeId} {
  allow read: if isStoreMember(storeId) || isPublicStoreRead(storeId);
  allow update: if isStoreOwner(storeId)
    && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['nextPlanPreset', 'nextEnabledModules', 'scheduledPlanMigrationAt', 'legacyPlanSnapshot']);
  allow create: if isAuthenticated() && request.auth.uid == storeId;
}
```

Migration fields (`next*`, `legacyPlanSnapshot`) should be **Functions-only** via Admin SDK.

## New collections (Phase 3+)

- `stores/{storeId}/financeEstimates/{id}`
- `stores/{storeId}/financeReceipts/{id}`
- `stores/{storeId}/projects/{id}`
- `stores/{storeId}/aiCreditLedger/{id}`
- `stores/{storeId}/posDevices/{id}`

All scoped under storeId with `isStoreOwner` / `isStoreMember` helpers.

## Dry-run checklist before deploy

1. Run `scripts/backfillStoreEntitlements.ts` (dry-run) and review CSV
2. Test rules in Firebase Emulator with sample modular + legacy profiles
3. Owner approval on Slack/email
