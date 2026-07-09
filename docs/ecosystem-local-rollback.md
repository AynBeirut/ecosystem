# Ecosystem rollout — local only & rollback

**Branch:** `feat/ecosystem-modular-local`  
**Status:** Phase 0 foundation — flags default **OFF** (production behaviour unchanged)

## What was added (safe / additive)

| File | Purpose |
|------|---------|
| `src/lib/ecosystemFlags.ts` | Feature flags — all default off |
| `src/lib/moduleManifest.ts` | Package presets + module IDs |
| `src/lib/entitlements.ts` | Legacy/modular entitlement resolver |
| `src/lib/packageDraft.ts` | Session draft for home → signup (flagged) |
| `src/hooks/useModuleEntitlement.ts` | Generic hook for future gating |
| `functions/src/lib/entitlements.ts` | Server mirror (opt-in env) |
| `scripts/backfillStoreEntitlements.ts` | Dry-run backfill script |

Extended types on `storeProfiles` (optional fields only — no migration required).

## Rollback options

### 1. Discard all ecosystem work (fastest)

```bash
cd "/home/anwar/Documents/grabio space"
git checkout main
git branch -D feat/ecosystem-modular-local   # optional: delete branch
```

### 2. Keep branch, disable flags

Ensure `.env.local` does **not** set:

```env
VITE_ECOSYSTEM_MODULAR=true
VITE_ECOSYSTEM_ENFORCE_MODULES=true
VITE_ECOSYSTEM_PACKAGE_DRAFT=true
```

Without flags, runtime uses **legacy tier path only**.

### 3. Revert specific commits

```bash
git log --oneline feat/ecosystem-modular-local
git revert <commit-sha>   # one commit at a time
```

### 4. Stash before experimenting

```bash
git stash push -m "ecosystem WIP"
git checkout main
# later: git checkout feat/ecosystem-modular-local && git stash pop
```

## What NOT to do (production safety)

- Do **not** `firebase deploy` from this branch until Phase 2+ reviewed
- Do **not** run `backfillStoreEntitlements.ts --write` on production
- Do **not** enable `VITE_ECOSYSTEM_ENFORCE_MODULES` until route gating is tested

## Enable locally (optional dev test)

Create `.env.local` (gitignored):

```env
VITE_ECOSYSTEM_MODULAR=true
VITE_ECOSYSTEM_PACKAGE_DRAFT=true
```

For a test store, set on `storeProfiles/{uid}`:

```json
{
  "pricingVersion": "modular-v2",
  "businessWorkflow": "shop",
  "startingPackage": "pkg_shop",
  "enabledModules": { "invoicing": true, "marketplace": true, "crm": false }
}
```

## Phases 1–7 implemented locally (2026-06-23)

| Phase | Key deliverables |
|-------|------------------|
| **1** | `PackageOnboarding.tsx`, `packagePresets.ts`, `moduleDependencies.ts`, `moduleSuggestions.ts` |
| **2** | `ModuleGate.tsx`, `moduleRouteMap.ts`, `useStoreEntitlements.ts`, functions `moduleGate` middleware |
| **3** | `financeService.ts`, finance pages, `finance-firestore-schema.md` |
| **4** | `posSync.ts`, `kitchenSaleDeduction.ts`, `PosPairing.tsx`, `pos-sync-contract.md` |
| **5** | `aiCredits.ts`, AI credit API, `AiBuilder.tsx`, `AdminProjects.tsx` |
| **6** | `modularPricing.ts`, `subscribeModular`, `mapLegacyToModular.ts`, Subscription modular UI |
| **7** | `legacyTierShim.ts`, `VITE_LEGACY_TIERS_RETIRED` flag |

Routes: `/onboarding/package`, `/admin/finance/*`, `/admin/pos`, `/admin/ai-builder`, `/admin/projects`

**Still not deployed. Test with `.env.local` flags before any production rollout.**

## Phase 0 completed locally (2026-06-23)

Files added on branch `feat/ecosystem-modular-local`:

- `src/lib/ecosystemFlags.ts`
- `src/lib/moduleManifest.ts`
- `src/lib/entitlements.ts`
- `src/lib/packageDraft.ts`
- `src/lib/applyPackageDraft.ts`
- `src/hooks/useModuleEntitlement.ts`
- `functions/src/lib/entitlements.ts`
- `scripts/backfillStoreEntitlements.ts`
- `src/types/storeProfile.ts` (optional modular fields)
- `.env.local.example`
- `public/home.html` (persists toggles to sessionStorage)
- `src/pages/admin/AdminProfile.tsx` (applies draft on first save when flag on)

**Not deployed. Flags default OFF. No production behaviour change.**

## Phase 0b completed locally (2026-06-23)

1. Home toggles → `sessionStorage` key `grabio_package_draft_v1`
2. First `AdminProfile` save applies draft when `VITE_ECOSYSTEM_PACKAGE_DRAFT=true`
3. Writes `enabledModules`, `businessWorkflow`, `pricingVersion: modular-v2`
