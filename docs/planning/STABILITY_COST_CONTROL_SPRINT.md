# Stability + Cost Control Sprint

Goal: reduce risk and cost before major feature expansion.

## Sprint Outcome Targets

1. Keep deploy velocity high by reducing high-noise lint debt.
2. Cut first-load JS size by route-level code splitting.
3. Add billing guardrails to prevent Firebase overrun.

## Completed in This Sprint (Initial Pass)

- Added route-level lazy loading in app routing for admin and lower-frequency pages.
- Added Firebase budget alert runbook.
- Started lint debt triage in shared libraries and admin pages (low-risk fixes).

## Next 2-Week Execution Plan

### Track A: Bundle Size
- [ ] Measure post-split bundle with each release.
- [ ] Move additional heavy routes to lazy modules if needed.
- [ ] Add manual chunking only if route splitting is not enough.
- [ ] Optimize large shared dependencies in storefront path.

### Track B: Lint Debt (Gradual, No Big-Bang)
- [ ] Shared libs first: remove explicit any in core helpers.
- [ ] Admin pages second: type form payloads and Firestore record shapes.
- [ ] Scripts/mobile lint scope last, unless actively modified.
- [ ] Keep lint fixes in small batches (20-40 issues per PR).

### Track C: Firebase Cost Guardrails
- [ ] Create monthly billing budget with 50/75/90/100 alerts.
- [ ] Enable backup notification channel.
- [ ] Review Firestore reads on top admin pages.
- [ ] Verify scheduler frequencies and function memory/time settings.

## Release Gate for Big Feature Work

Resume larger upgrades once all are true:
- [ ] Build and tests are green.
- [ ] Main entry JS chunk materially reduced from current baseline.
- [ ] Billing alerts configured and tested.
- [ ] Lint error trend is decreasing steadily over at least 2 releases.

## Notes

- If client growth is early, prioritize this sprint before major roadmap items.
- This approach keeps risk low while preserving upgrade speed.
