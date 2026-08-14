# POS Sync Contract (Phase 4)

**Handoff for Windows builder:** `docs/planning/pos-windows-handoff.md`  
**API implementation:** `functions/src/api/posSync.ts`  
**Admin UI:** `https://grabio.space/admin/pos` (`src/pages/admin/PosPairing.tsx`)

## Pairing flow

1. Admin opens `/admin/pos` → generates pairing code (6 digits, 15 min TTL)
2. Windows POS enters code + device name
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
| `apiKeyHash` | string (SHA-256 of device token) |

## Sync endpoints

**API base:** `https://us-central1-market-flow-7b074.cloudfunctions.net/api`

| Method | Path | Status | Purpose |
|--------|------|--------|---------|
| POST | `/pos/pairing-code` | **Live** | Owner generates code (`{ storeId, uid }` body) |
| POST | `/pos/pair` | **Live** | Exchange code → `{ storeId, deviceId, deviceToken, composedProductSource }` |
| POST | `/pos/heartbeat` | **Live** | `{ storeId, deviceId, deviceToken }` → updates `lastSyncAt` |
| GET | `/pos/catalog` | **Live** | Pull products + composed recipes (if source=platform); each product includes `icon` |
| POST | `/pos/products` | **Live** | Push POS catalog → platform; preserves `icon` / `emoji` per SKU |

### `POST /pos/pair` body

```json
{
  "code": "123456",
  "deviceName": "Front counter",
  "composedProductSource": "platform"
}
```

### `POST /pos/heartbeat` body

```json
{
  "storeId": "...",
  "deviceId": "...",
  "deviceToken": "..."
}
```

### Product icon sync

Both directions use the same emoji rules as the Grabio storefront (`src/lib/visualFallbacks.ts`):

| Field | Direction | Notes |
|-------|-----------|-------|
| `icon` | POS ↔ Platform | Primary emoji (e.g. `🥐`). POS may send `icon`, `emoji`, or `productIcon`. |
| `image` | Platform → POS | Optional photo URL when the store has a real product image. |

If `icon` is missing, category/name fallback applies so POS tiles match the web store.

## Live kitchen deduction

When `businessWorkflow=live_kitchen` and sale includes composed SKU:

- If `composedProductSource=platform` → Firebase trigger deducts recipe ingredients
- If `composedProductSource=pos` → POS sends deduction payload; platform records outcome only

## Billing

`posLocationCount` on `storeProfiles` — first location included in Kitchen preset; +$15/mo per extra.

## POS app integration (Windows)

| File | Action |
|------|--------|
| `pos-v1/js/sync-manager.js` | Legacy VPS — keep until Grabio path proven |
| `pos-v1/js/grabio/grabio-pairing.js` | **New** — pairing UI + token storage |
| `pos-v1/js/grabio/grabio-sync.js` | **New** — heartbeat, catalog, orders |
