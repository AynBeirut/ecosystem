# S1 — Proposal experience (Present)

**Start only after S0 is ACCEPTED** (see STATUS.md).
**Why:** Airial's strongest UX is the shareable, branded itinerary the traveller opens and approves. Today `/travel/p/:token` is a dark text page. This is what the client will judge first.
**Rule:** Airial UX, Grabio UI. Reuse the existing Grabio/Tailwind tokens, no new design system. Demo data only.

## Scope — `PublicProposalPage.tsx` (client-facing, mobile-first)
Build, top to bottom:
1. **Hero:** full-width destination image, trip title, destination, dates, pax, agency name and logo, quote number.
2. **Trip summary strip:** days count, travellers, total price, valid-until date.
3. **Day-by-day section:** one card per day (`Day 1 — title`, date). Items inside as a timeline with type icon (flight, hotel, activity, transfer, note), time, title, description, image when present. Items do NOT show cost or margin to the traveller.
4. **Inclusions / exclusions:** two clean lists.
5. **Price card:** total in quote currency, deposit due (if set), payment note. Never show cost or margin.
6. **Sticky bottom bar on mobile:** price + `Approve proposal` button. After approve: confirmation state with next steps (agent will confirm deposit and booking).
7. **Agent contact block:** name, phone/WhatsApp link, email (from branding/settings).
8. **States:** loading skeleton, error ("link invalid or expired"), already-approved view, expired view.

## Scope — agent side
- Quote editor `QuoteEditorPage.tsx`: add an `Open preview` button that opens `/p/:token` (or a preview route using the current unsaved state) so the agent sees exactly what the traveller sees.
- Add optional quote fields: `heroImageUrl`, `validUntil`, `agentPhone` (types, demo store, Firestore save, public payload). Keep them optional.
- Editor UI fixes from the S0 review (U1-U3): visible "Cost" / "Sell" labels on item inputs; stack item title above time at 390px so titles do not truncate; bottom totals row becomes a read-only summary (Cost / Sell / Margin).

## Constraints
- Pure presentation plus the three optional fields; no pricing logic changes.
- Public payload must never expose `cost`, `costTotal`, `margin` (check `functions/src/api/travelAgency.ts` and the client mock in `travelApi.ts`; strip them server-side).
- Works for legacy text-only quotes (render `itinerary` text in a single styled section).
- Accessible: contrast, tap targets at least 44px, alt text on images, no layout shift.
- Zero console errors. Do NOT deploy; Anwar approves deploys.

## Acceptance criteria
- [ ] `/travel/p/demo` shows hero, summary strip, 5 day cards with typed items, inclusions, price card, agent block.
- [ ] 390px width: no horizontal scroll, sticky approve bar visible, hero readable.
- [ ] Desktop 1280px: centred layout, not stretched.
- [ ] Network payload of the public endpoint contains no cost or margin fields (evidence required).
- [ ] Approve flow works in demo mode and shows the confirmation state; approving twice is safe.
- [ ] Legacy text-only quote renders acceptably.
- [ ] Loading, error, expired, and approved states all reachable and styled.
- [ ] Builds pass (`web`, `functions`), zero console errors.

## Builder report must include
Files changed, screenshots (390px and 1280px: hero, day cards, price/sticky bar, approved state, error state), payload evidence, deviations, questions.
