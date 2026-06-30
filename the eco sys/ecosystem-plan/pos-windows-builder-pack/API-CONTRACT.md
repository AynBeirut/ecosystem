# POS API Contract

**API base:** `https://us-central1-market-flow-7b074.cloudfunctions.net/api`

---

## Pairing flow

1. Store owner opens `https://grabio.space/admin/pos`
2. Owner clicks generate code → `POST /pos/pairing-code`
3. POS shows pairing screen → user enters code + device name
4. POS calls `POST /pos/pair` → receives `storeId`, `deviceId`, `deviceToken`
5. POS stores token locally (secure settings table / app_settings)
6. POS calls `POST /pos/heartbeat` on interval

---

## Live endpoints

### `POST /pos/pairing-code`

Called from **Grabio admin** (owner logged in).

Body:

```json
{ "storeId": "...", "uid": "..." }
```

Response:

```json
{ "success": true, "code": "123456", "expiresInSeconds": 900 }
```

Code TTL: **15 minutes**. Stored at `stores/{storeId}/posPairingCodes/{code}`.

---

### `POST /pos/pair`

Called from **Windows POS**.

Body:

```json
{
  "code": "123456",
  "deviceName": "Front counter",
  "composedProductSource": "platform"
}
```

`composedProductSource`: `"platform"` or `"pos"` (default `platform`).

Response:

```json
{
  "success": true,
  "storeId": "...",
  "deviceId": "...",
  "deviceToken": "hex-string-64-chars",
  "composedProductSource": "platform"
}
```

**Save `deviceToken` on POS** — required for heartbeat. Server stores SHA-256 hash only.

Device doc: `stores/{storeId}/posDevices/{deviceId}`

---

### `POST /pos/heartbeat`

Body:

```json
{
  "storeId": "...",
  "deviceId": "...",
  "deviceToken": "..."
}
```

Response: `{ "success": true }`

Updates `lastSyncAt` on device document. Invalid token → `401`.

---

## Planned (not deployed — coordinate with Anwar)

### `GET /pos/catalog`

Pull products + composed recipes when `composedProductSource=platform`.

### `POST /pos/orders`

Push completed sale for stock deduction / order record.

---

## Firestore (reference)

| Path | Purpose |
|------|---------|
| `storeProfiles/{storeId}` | `enabledModules.pos`, `composedProductSource`, `posLocationCount`, `businessWorkflow` |
| `stores/{storeId}/posDevices/{deviceId}` | Paired terminal |
| `products/{id}` | Catalog (`storeId` field) |

---

## Live kitchen (composed products)

When `businessWorkflow=live_kitchen` and sale includes composed SKU:

| `composedProductSource` | Who deducts ingredients |
|-------------------------|-------------------------|
| `platform` | Grabio Firebase trigger |
| `pos` | POS sends deduction payload; platform logs outcome |

---

## Billing

`posLocationCount` on store profile — first terminal included in Kitchen package; extra locations billed per Grabio pricing.
