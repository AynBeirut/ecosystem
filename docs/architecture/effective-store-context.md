# Effective store context (web admin slice)

**Implemented:** 2026-09-15 · **Code:** `src/lib/effectiveStoreContext.ts`

Partial implementation of `~/Documents/grabio-platform-docs/Architecture/Resolver-Contracts.md` for **web admin** only. Mobile, Functions, and POS should call the same pure functions when wired.

## Entry points

| Function | Contract |
|----------|----------|
| `resolveEffectiveStoreContext` | Facade: profile + entitlements + optional user + environment |
| `resolveEffectiveModuleCapabilities` | Package modules ∩ `venueOpsSettings` nav toggles |
| `resolveEffectiveRolePolicy` | Sub-account role ∩ module visibility |
| `canShowAdminCrmNav` / `canShowAdminSeoNav` | Sidebar helpers |

## Access formula (2026-09-15)

```text
allowed = subscription entitlement ∧ venue/store toggle ∧ user permission
```

Implemented in `src/lib/featureAccessGate.ts`. Venue toggles never unlock unpaid modules.

## Defaults

- **Legacy:** `restaurantFirstNavEnabled` unset/false → full admin nav (`venueOpsNav` legacy mode). Unpaid modules still hidden via entitlements.
- **Restaurant-first:** `live_kitchen` / `pkg_live_kitchen` defaults hide inventory + finance nav until toggles on Store Profile → Venue operations layout (and package includes module).

## Consumers

- `useAdminNavigation` — sidebar visibility
- `venueSetupReadiness` — ops readiness tracks + continue links
- `VenueOpsSettingsPanel` — effective toggle state

## Not in this slice

- `resolveSetupProgress` full product/recipe state
- Functions/mobile re-exports (backlog: mirror `grabio-mobile` tenant binding)
