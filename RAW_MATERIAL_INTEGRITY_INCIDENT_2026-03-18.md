# Raw Material Integrity Incident Report

Date: 2026-03-18
Store: DfIhBAEZ5NR7yNX0HboZvv58Nf82
Status: Containment active, root cause confirmed, data repair pending approval

## Incident Summary
Client reported over-deduction of raw materials during production.

Expected for batch actual quantity 82 (All Care 2 Ply Facial 3Kg):
- 14 GSM 2PLY 80CM: 2.95 × 82 = 241.9 kg
- 300G Facial INTERNAL Bag: 0.055 × 82 = 4.51 kg
- External Bag with Hand 40x90: 0.033 × 82 = 2.706 kg

Live recipe values match these exact quantities and units (kg), so this is not a grams-to-kg conversion bug.

## Confirmed Root Cause Pattern
Overlapping raw stock mutation paths existed:
1) Production completion consumes raw materials (expected path)
2) Order lifecycle also consumed/restored raw materials using recipe lookup

This overlap creates double-impact risk and reconciliation drift.

## Containment Implemented (Live)
1) Production completion lockdown
- File: src/pages/admin/AdminProduction.tsx
- Completion action is blocked in handler and UI with warning banner.
- Reason shown: raw-material integrity audit in progress.

2) Order-side raw mutation disabled
- File: src/pages/admin/AdminOrders.tsx
- Feature flag set: ENABLE_ORDER_RAW_MATERIAL_DEDUCTION = false
- All applyRawMaterialStockFromOrder(...) call sites are gated off.

3) Deployment
- Hosting deployed successfully.
- Live URL: https://market-flow-7b074.web.app

## Evidence Collected
### Scoped full-history dry-run (4 critical materials)
Command:
node scripts/reconcileRawMaterialStock.cjs --storeId DfIhBAEZ5NR7yNX0HboZvv58Nf82 --before 2100-01-01 --materials kPWepQNvyHlOZS03ZdSx,CPDd3KJjKm8dwVDyQQ9o,QUCkefY9LkkrfwOrihyr,omNntXGXd0CYgW59GKyg

Result highlights:
- 14 GSM 2PLY 80CM: consume 293.25
- 20 GSM 2PLY 80CM: consume 164.5
- 300G Facial INTERNAL Bag: consume 1.98

### Full-history forensic split (read-only)
Computed expected consumption from:
- Completed production batches (production formula)
- Counted orders (order-side formula)

Summary:
- 14 GSM: production 5532.45, orders 2572.891, overlap-risk total 8105.341
- 20 GSM: production 6016.95, orders 3738.46, overlap-risk total 9755.41
- Internal bag: production 10.89, orders 10.945, overlap-risk total 21.835
- External bag: production 94.281, orders 68.4354, overlap-risk total 162.7164

Interpretation:
Order-side path added substantial extra theoretical consumption on top of production-side consumption.

## Current Safety State
- No further production completion writes can happen from UI.
- No further order-driven raw stock writes can happen from UI.
- Purchases and supplier returns remain active paths by design.

## Pending (No Data Write Yet)
1) Generate full-history per-material expected-vs-current audit table for all affected raw materials.
2) Produce dry-run reconciliation proposal with date-window and material scope.
3) Obtain client sign-off.
4) Apply reconciliation in small audited chunks with rollback IDs.
5) Verify post-fix with repeat dry-run and audit scripts.

---

## Phase 2: Dry-Run Approval Sheet (No Writes)

### High-confidence window used
- Window: `since 2026-02-01`
- Missing recipe batches in this window: `0`

### Forensic model (production-only expected consumption)
- 14 GSM 2PLY 80CM: `3479.95 kg`
- 20 GSM 2PLY 80CM: `5533.35 kg`
- 300G Facial INTERNAL Bag: `4.51 kg`
- External Bag with Hand 40x90: `82.269 kg`

### Overlap evidence (if order+production both active)
- 14 GSM orders-side expected: `2469.966 kg`
- 20 GSM orders-side expected: `3527.86 kg`
- 300G INTERNAL orders-side expected: `10.56 kg`
- External 40x90 orders-side expected: `64.6404 kg`

This confirms large double-impact risk when both paths were enabled.

### Existing reconcile script dry-run output (order-driven model)
Command run:
`node scripts/reconcileRawMaterialStock.cjs --storeId DfIhBAEZ5NR7yNX0HboZvv58Nf82 --before 2100-01-01 --after 2026-02-01 --materials kPWepQNvyHlOZS03ZdSx,CPDd3KJjKm8dwVDyQQ9o,QUCkefY9LkkrfwOrihyr,omNntXGXd0CYgW59GKyg`

Dry-run proposal from script:
- 14 GSM: `-293.25`
- 20 GSM: `-164.5`
- 300G INTERNAL: `-1.98`

### Recommendation for approval
**Do NOT apply the existing script output now** because it uses delivered-order logic and does not represent the new agreed integrity model (production-only raw consumption).

Approve this safer path instead:
1) Keep containment active.
2) Build and run a production-only reconciliation dry-run (new script/report mode) for the same 4 materials and approved date window.
3) Review deltas with client.
4) Apply in one audited batch only after sign-off.

### Approval checkpoint
- [ ] Approve production-only reconciliation implementation.
- [ ] Approve no-apply on current order-based dry-run result.

---

## Phase 2.1: Production-only reconciliation dry-run (new tool)

Script added:
- `scripts/reconcileRawMaterialStockProduction.cjs`
- Model: completed production batches only
- Formula: `ingredient.quantity * actualQuantity / outputQuantity`
- Supports: `--storeId --before --after --materials [--apply]`

Dry-run executed:
`node scripts/reconcileRawMaterialStockProduction.cjs --storeId DfIhBAEZ5NR7yNX0HboZvv58Nf82 --before 2100-01-01 --after 2026-02-01 --materials kPWepQNvyHlOZS03ZdSx,CPDd3KJjKm8dwVDyQQ9o,QUCkefY9LkkrfwOrihyr,omNntXGXd0CYgW59GKyg`

Output deltas (NO WRITE):
- 20 GSM: `consume 5533.35` → would become `-2544.25`
- 14 GSM: `consume 3479.95` → would become `-1672.10`
- External 40x90: `consume 82.269` → would become `-82.269`
- Internal 300G: `consume 4.51` → would become `133.93`

Interpretation:
- This confirms production-only model is being computed correctly.
- It also confirms the chosen window still includes historical baseline/reset/initialization effects, so direct apply would be invalid and unsafe.

Recommendation:
1) Keep this dry-run as analysis only.
2) Segment reconciliation around known stocktake/baseline events before any apply.
3) Use a shorter post-baseline window per material (or explicit `--after` anchors) and re-run dry-run until all resulting stocks are non-negative and operationally plausible.

---

## Post-correction closure snapshot (Live)

Timestamp snapshot: `2026-03-18T12:43:42.405Z`

Applied correction event:
- Backup audit id: `G4zxsTAIrMAE2p8DRYyK`
- Deltas applied:
	- 14 GSM 2PLY 80CM: `+293.25`
	- 20 GSM 2PLY 80CM: `+81.9`

Current live balances:
- 14 GSM 2PLY 80CM: `2101.1 kg` (updated `2026-03-18T12:41:37.350Z`)
- 20 GSM 2PLY 80CM: `3071 kg` (updated `2026-03-18T12:41:37.350Z`)
- 300G Facial INTERNAL Bag: `138.44 kg`
- External Bag with Hand 40x90: `0 kg`

Containment state (still active):
- Order raw mutation disabled: `ENABLE_ORDER_RAW_MATERIAL_DEDUCTION = false` in [src/pages/admin/AdminOrders.tsx](src/pages/admin/AdminOrders.tsx#L40)
- Production completion lockdown enabled: `PRODUCTION_COMPLETION_LOCKDOWN = true` in [src/pages/admin/AdminProduction.tsx](src/pages/admin/AdminProduction.tsx#L36)

Operational note:
- Keep containment active until at least one real production cycle and one delivery cycle are observed with expected-only movement and no drift in the 4 incident materials.
