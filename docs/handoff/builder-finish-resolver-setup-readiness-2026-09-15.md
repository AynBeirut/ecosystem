# Builder Prompt - Finish Resolver Layer And Setup Readiness

Use this prompt in the builder/execution conversation.

---

You are working in `/home/anwar/Documents/grabio space`.

Mission: finish the two remaining structural tasks from the fine-dining pivot:

1. Full effective resolver layer.
2. Setup readiness / UI toggles.

Do not build new restaurant features from guesses. New fine-dining features will come later from the client's Excel/workflow pain map.

## Read First

1. `README.md`
2. `architecture.md`
3. `decision-log.md`
4. `docs/handoff/builder-start-main-structure-fine-dining-2026-09-15.md`
5. `~/Documents/grabio-platform-docs/Architecture/Fine-Dining-Platform-Map.md`
6. `~/Documents/grabio-platform-docs/Architecture/Resolver-Contracts.md`
7. `~/Documents/grabio-platform-docs/Architecture/Role-Permission-Environment-Policy.md`
8. `~/Documents/grabio-platform-docs/Backlog/Open.md`

## Task 1 - Full Effective Resolver Layer

Goal: one shared answer for what a store/user can see and do.

Implement or finish a resolver that combines:

- Store profile.
- Package / workflow.
- Enabled modules.
- Tenant settings.
- Role / sub-account policy.
- Environment context: web admin, mobile, POS, builder, SEO/content, accounting, inventory.

Expected result:

- Existing stores keep current behavior by default.
- Fine-dining / `live_kitchen` gets restaurant-first capability flags.
- Finance and inventory stay optional, not forced.
- Builder/template/SEO stay connected but role/module gated.
- No hardcoded client/store behavior.

Inspect:

- `src/lib/tenantBinding.ts`
- `src/lib/productClassification.ts`
- `src/lib/restaurantRolePolicy.ts`
- `src/lib/venueOpsNav.ts`
- `src/lib/venueSetupReadiness.ts`
- `src/lib/moduleManifest.ts`
- `src/lib/packagePresets.ts`
- `src/lib/moduleDependencies.ts`
- `src/lib/subAccountAccess.ts`
- `src/types/storeProfile.ts`
- `src/types/subaccount.ts`
- `functions/src/lib/moduleManifest.ts`
- `grabio-mobile/src/lib/venueRolePolicy.ts`
- `grabio-mobile/src/lib/storeProfileSync.ts`

Done when:

- A store/user/context resolver exists or current partial resolvers are unified clearly.
- Web admin uses the resolver where nav/module/action visibility is decided.
- Tests cover at least:
  - legacy store defaults unchanged
  - `live_kitchen` restaurant-first settings
  - manager/store-admin access
  - finance/inventory off unless enabled
  - builder/SEO gated separately
- Docs updated with the resolver contract actually implemented.

## Task 2 - Setup Readiness / UI Toggles

Goal: restaurant setup is visible and controllable from UI.

Finish admin setup surfaces for:

- `restaurantFirstNavEnabled`
- reservations/service readiness
- guest CRM readiness
- staff/role readiness
- kitchen/order readiness
- website/template/SEO readiness
- inventory optional toggle/readiness
- finance/accounting optional toggle/readiness

Rules:

- New restaurants can start without finance or inventory.
- Existing stores must not change unless a toggle is enabled.
- Toggles must write to store-scoped settings only.
- Setup readiness should show missing setup and links to continue.
- Do not put readiness on the normal client dashboard unless approved; use `/admin/grabio-platform` or the correct setup/admin surface.

Inspect:

- `src/components/admin/VenueOpsSettingsPanel.tsx`
- `src/components/admin/VenueSetupReadinessPanel.tsx`
- `src/lib/venueOpsSettingsUi.ts`
- `src/lib/venueSetupReadiness.ts`
- `src/pages/admin/AdminProfile.tsx`
- `src/pages/admin/AdminGrabioPlatform.tsx`
- `src/hooks/useAdminNavigation.ts`
- `src/types/storeProfile.ts`

Done when:

- Store Profile has clear venue/fine-dining toggles where appropriate.
- `/admin/grabio-platform` shows setup readiness and missing items.
- Finance/inventory can remain hidden/off for new restaurants.
- Existing clients are unchanged by default.
- Evidence JSON is written under `reporting/data/`.

## Do Not Do

- Do not deploy.
- Do not push.
- Do not run production write scripts.
- Do not change POS Windows code in this repo.
- Do not hardcode the new restaurant client.
- Do not invent reservation/CRM features before Excel/client workflow is reviewed.
- Do not delete shop/factory/builder/accounting/inventory modules.

## Required Final Report

When done, report:

- Files changed.
- Exact resolver behavior.
- Exact setup toggles/readiness behavior.
- Tests/builds run.
- Evidence files written.
- What remains for POS, Play, and human verification.
- Whether deploy/push is pending approval.

Do not say verified unless verification actually ran.
