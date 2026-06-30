# POS Code Tasks & QA

## POS app location

```
the eco sys/ecosystem-plan/posfinal-main/pos-v1/
```

Stack: Electron 28 · SQL.js (SQLite) · vanilla JS · offline-first

---

## Existing files (do not break)

| File | Role |
|------|------|
| `electron-main.js` | Electron shell |
| `js/pos-core.js` | Cart, checkout, payments |
| `js/db-sql.js` | Local database |
| `js/sync-manager.js` | **Legacy VPS sync** — keep until Grabio QA passes |
| `js/auth.js` | Local cashier login |

---

## New files to create

```
pos-v1/js/grabio/
  grabio-config.js
  grabio-pairing.js
  grabio-sync.js
```

### `grabio-config.js`

- API base URL (constant above)
- Load/save: `storeId`, `deviceId`, `deviceToken`, `composedProductSource`
- Use same persistence pattern as VPS config in `sync-manager.js` (`app_settings`)

### `grabio-pairing.js`

- UI: device name + 6-digit code
- Ask `composedProductSource`: platform vs pos (radio)
- `POST /pos/pair` with JSON body
- On success → save config → show "Paired"
- On error → show message (expired code, invalid code)

### `grabio-sync.js`

- `startHeartbeat(intervalMinutes)` → `POST /pos/heartbeat`
- Queue when offline; retry when `navigator.onLine`
- **Phase 2:** `GET /pos/catalog` → merge into local products tables
- **Phase 2:** after local sale → `POST /pos/orders`

Wire into POS settings / first-run wizard (before main POS screen if not paired).

---

## Platform code (for reference only)

| File | Role |
|------|------|
| `functions/src/api/posSync.ts` | Pairing + heartbeat implementation |
| `src/pages/admin/PosPairing.tsx` | Admin UI at `/admin/pos` |

Installer URL on admin page points to Firebase Storage `Grabio-POS-Setup.exe`.

---

## QA checklist

- [ ] POS installs on Windows 10/11
- [ ] Test store has POS module enabled
- [ ] Admin generates code at `/admin/pos`
- [ ] POS pairs successfully
- [ ] Heartbeat updates device `lastSyncAt` in Firestore
- [ ] POS works offline (sales without network)
- [ ] Token survives app restart
- [ ] Wrong code shows clear error
- [ ] Expired code shows clear error

---

## When API catalog/orders exist

- [ ] Pull catalog → local products match Grabio admin
- [ ] Complete sale online → stock updates in Grabio
- [ ] Complete sale offline → queues → syncs when online
- [ ] `composedProductSource=platform` → platform deducts recipe
- [ ] `composedProductSource=pos` → POS sends deduction payload
