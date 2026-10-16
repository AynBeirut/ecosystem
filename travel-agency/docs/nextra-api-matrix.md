# Nextra API capability matrix

**Status:** Phase 0 — fill `Verified` column when client supplies official API docs + sandbox keys.  
**Portal reference:** [screenshots/nextra-customer-facing-vardhantravels/INDEX.md](../screenshots/nextra-customer-facing-vardhantravels/INDEX.md)

## Auth

| Item | Expected | Verified | Notes |
|------|----------|----------|-------|
| Auth model | API key or OAuth per agency | Pending | Store in Secret Manager; map `agentUserId` per sub-agent |
| Base URL | Tenant subdomain or central API host | Pending | e.g. `vardhantravels-app.nextra.travel` backoffice vs customer API |
| Rate limits | TBD | Pending | Adapter must backoff + cache search |

## Normalized adapter methods (`functions/src/integrations/nextra/`)

| Method | Portal feature | API needed | Verified | Fallback if missing |
|--------|----------------|------------|----------|---------------------|
| `walletBalance` | Account wallet / credit / due | Yes | Pending | Manual entry on Money page |
| `bookingList` | My booking | Yes | Pending | Manual PNR on deal |
| `search` | Flights / hotels / activities / cabs / tours | Yes | Pending | Open Nextra in new tab (deprecated path) |
| `hold` | 15-minute hold | Yes | Pending | Skip hold; book direct if API allows |
| `book` | Confirm booking | Yes | Pending | Manual booking ref |
| `cancel` | Refunds flow | Optional | Pending | Owner handles in Nextra |
| `reports` | Reports page | Optional | Pending | Our Phase 4 owner dashboard |

## Product verticals

| Vertical | Portal route | Search API | Book API | Verified |
|----------|--------------|------------|----------|----------|
| Flights | `/`, `/flights` | Pending | Pending | |
| Hotels | `/hotels` | Pending | Pending | |
| Activities | `/activities` | Pending | Pending | |
| Cabs | `/cabs` | Pending | Pending | |
| Group tours | `/group-tours` | Pending | Pending | |
| Wishlist | `/activities/wishlist` | N/A | N/A | Out of v1 |

## Go / no-go (MVP)

- **Go (quote-first):** CRM + quotes without book API.  
- **Go (full):** `walletBalance` + `search` + `book` verified on sandbox.  
- **Blocker:** No read wallet and no booking list → Phase 2 limited to manual PNR only.

## Mock mode

Set `NEXTRA_MOCK=true` on Cloud Functions for local/demo without live Nextra (returns sample flights + wallet).
