# Grabio Platform Integration (read first)

> **One folder for the builder:** `../pos-windows-builder-pack/README.md`

**Full handoff:** `../pos-windows-builder-pack/` (replaces scattered docs below)

## This folder

| Path | Purpose |
|------|---------|
| `pos-v1/` | Electron POS — **edit here on Windows** |
| `AynBeirutPOS-Release/` | Installer / release notes |

## Connect to Grabio

1. Owner enables **POS** module on store (`grabio.space/subscription`).
2. Owner opens `grabio.space/admin/pos` → generates 6-digit code.
3. POS calls `POST https://us-central1-market-flow-7b074.cloudfunctions.net/api/pos/pair`.
4. Store `deviceToken` locally; send heartbeat every few minutes.

## Your first tasks

- [ ] `pos-v1/js/grabio/grabio-config.js` — API base + saved credentials
- [ ] `pos-v1/js/grabio/grabio-pairing.js` — pairing screen
- [ ] `pos-v1/js/grabio/grabio-sync.js` — heartbeat (catalog/orders when API exists)

Do **not** remove `js/sync-manager.js` until Grabio sync is proven in QA.
