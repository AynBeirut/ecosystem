# POS Sync Contract (Phase 4)

## Pairing flow

1. Admin opens `/admin/pos` → generates pairing code (6 digits, 15 min TTL)
2. Windows POS enters code + store credentials
3. Prompt: **composed product source** — `platform` | `pos` (locked at pairing)
4. Device registered in `stores/{storeId}/posDevices/{deviceId}`

## Device document

| Field | Type |
|-------|------|
| `deviceName` | string |
| `platform` | `windows` |
| `composedProductSource` | `platform` \| `pos` |
| `pairedAt` | timestamp |
| `lastSyncAt` | timestamp |
| `apiKeyHash` | string |

## Sync endpoints (`functions/src/api/posSync.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/pos/pair` | Exchange pairing code for device token |
| GET | `/pos/catalog` | Pull products + composed recipes (if source=platform) |
| POST | `/pos/orders` | Push completed sale → stock deduction |
| POST | `/pos/heartbeat` | Last seen + version |

## Live kitchen deduction

When `businessWorkflow=live_kitchen` and sale includes composed SKU:
- If `composedProductSource=platform` → Firebase trigger deducts recipe ingredients
- If `composedProductSource=pos` → POS sends deduction payload; platform records outcome only

## Billing

`posLocationCount` on `storeProfiles` — first location included in Kitchen preset; +$15/mo per extra.
