# Containment Lift Runbook (Raw Material Integrity)

Date: 2026-03-18
Store: DfIhBAEZ5NR7yNX0HboZvv58Nf82

## Objective
Re-enable production operations safely while preserving the integrity fix.

## Current Safe State
- Order-side raw mutations are disabled in [src/pages/admin/AdminOrders.tsx](src/pages/admin/AdminOrders.tsx#L40)
  - `ENABLE_ORDER_RAW_MATERIAL_DEDUCTION = false`
- Production completion is temporarily blocked in [src/pages/admin/AdminProduction.tsx](src/pages/admin/AdminProduction.tsx#L36)
  - `PRODUCTION_COMPLETION_LOCKDOWN = true`

## Lift Strategy
- Keep order-side raw mutation disabled **permanently** (single source of truth: production + purchases/returns).
- Lift only production completion lockdown.

## Change Set
1. In [src/pages/admin/AdminProduction.tsx](src/pages/admin/AdminProduction.tsx#L36), set:
   - `PRODUCTION_COMPLETION_LOCKDOWN = false`
2. Do **not** change [src/pages/admin/AdminOrders.tsx](src/pages/admin/AdminOrders.tsx#L40):
   - `ENABLE_ORDER_RAW_MATERIAL_DEDUCTION` remains `false`.

## Deployment Steps
1. Build:
   - `npm run build`
2. Deploy frontend:
   - `firebase deploy --only hosting`

## Post-Lift Verification Gates (Required)

### Gate A — Immediately after deploy
- Confirm code flags in deployed source behavior:
  - Production completion button works again.
  - Order status changes no longer affect raw materials.

### Gate B — After 1 real production completion
For the produced SKU’s ingredients:
- Expected usage = `ingredient.quantity * actualQuantity / outputQuantity`
- Verify raw material drop equals expected usage (within tolerance ±0.001).

### Gate C — After 1 real sale/delivery cycle
- Verify sale changes finished goods only.
- Verify raw materials do **not** change from order lifecycle actions.

### Gate D — 24-hour drift check on incident materials
Materials:
- `kPWepQNvyHlOZS03ZdSx` (14 GSM 2PLY 80CM)
- `CPDd3KJjKm8dwVDyQQ9o` (20 GSM 2PLY 80CM)
- `QUCkefY9LkkrfwOrihyr` (300G Facial INTERNAL Bag)
- `omNntXGXd0CYgW59GKyg` (External Bag with Hand 40x90)

Acceptance:
- No unexplained decreases.
- All decreases can be mapped to completed production batches.

## Rollback Criteria
Rollback immediately if any of the below occurs:
- Raw material decreases on order status change/edit/delete/void.
- Production completion deducts more than expected formula.
- Same batch appears to deduct raw materials twice.

## Rollback Action
1. Re-enable lockdown in [src/pages/admin/AdminProduction.tsx](src/pages/admin/AdminProduction.tsx#L36):
   - `PRODUCTION_COMPLETION_LOCKDOWN = true`
2. Build and deploy hosting again.
3. Run read-only incident snapshot and pause operations until reviewed.

## Notes
- Use [RAW_MATERIAL_INTEGRITY_INCIDENT_2026-03-18.md](RAW_MATERIAL_INTEGRITY_INCIDENT_2026-03-18.md) as the authoritative incident ledger.
- Do not run order-based raw reconcile scripts for this incident model.
