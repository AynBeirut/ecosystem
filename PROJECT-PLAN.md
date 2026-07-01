# Grabio POS — Project Plan

**Last updated:** 2026-06-30 · **Status:** Paused — continue tomorrow

---

## What this project is

Take the **existing production POS** (offline-first, Electron + SQL.js, already live) and turn it into **Grabio POS**:

1. Connect to **Grabio** cloud (online sync) while keeping offline sales working
2. **Rebrand UI** to match Grabio look & feel
3. Add **new vertical features**: manufacturing, hotel

---

## Important — source of truth

| Wrong assumption | Correct |
|------------------|---------|
| Start from `pos-v1` only as a separate/old app | **Production-ready POS is in `posfinal`** (the full repo/folder) |
| Builder pack path `posfinal-main/pos-v1/` is the only code | That path is the **ecosystem repo layout**; copy/sync from local **`../posfinal/`** (full tree, not a stripped subtree) |

**Local production POS (read-only reference until synced):**

```
C:\Users\Alaa\Documents\githup\pos\posfinal\
```

**Grabio work folder (edit here, push to ecosystem):**

```
C:\Users\Alaa\Documents\githup\pos\eco sys pos\
  the eco sys\ecosystem-plan\posfinal-main\   ← sync full posfinal here tomorrow
```

**Git remote:** https://github.com/AynBeirut/ecosystem.git  
**Branch pushed:** `pos-windows-grabio` (needs Anwar merge to `main`)

---

## Phase 1 — Grabio online connection (priority)

POS stays **offline-first**. Online is additive.

### 1a. Pairing + heartbeat (API live today)

Create `js/grabio/` in the POS app:

| File | Purpose |
|------|---------|
| `grabio-config.js` | API URL, `storeId`, `deviceId`, `deviceToken`, `composedProductSource` |
| `grabio-pairing.js` | 6-digit code + device name screen |
| `grabio-sync.js` | Heartbeat; later catalog pull + order push |

**API base:** `https://us-central1-market-flow-7b074.cloudfunctions.net/api`

| Endpoint | Status |
|----------|--------|
| `POST /pos/pairing-code` | Live (admin) |
| `POST /pos/pair` | Live |
| `POST /pos/heartbeat` | Live |
| `GET /pos/catalog` | **Not built** — coordinate with Anwar |
| `POST /pos/orders` | **Not built** — coordinate with Anwar |

**Keep** `js/sync-manager.js` (legacy VPS sync) until Grabio path passes QA.

**Docs:** `the eco sys/ecosystem-plan/pos-windows-builder-pack/`

### 1b. Catalog + orders (when API exists)

- Pull products/recipes from Grabio → local SQLite
- Push completed sales → Grabio stock
- Offline queue → sync when `navigator.onLine`

### 1c. QA checklist

- [ ] Pair at `grabio.space/admin/pos`
- [ ] Heartbeat updates Firestore `lastSyncAt`
- [ ] Sales work offline
- [ ] Token survives restart
- [ ] Clear errors for wrong/expired code

### Known gap (before shipping to operators)

- [ ] **Re-pair entry point in UI** — `window.openGrabioPairingModal()` is callable but not exposed in Settings or any menu. Operators who need to re-pair (new admin code, token revoked, heartbeat 401) cannot reach it without dev tools. Add a visible "Pair with Grabio" / "Re-pair" button in Settings before production rollout. Logged only — not built yet.

---

## Phase 2 — UI rebrand (Grabio look)

- Match Grabio web admin: colors, typography, logo, app name
- Replace Ayn Beirut branding in:
  - `package.json` (productName, appId)
  - `index.html`, `login.html`, installer assets (`build/`)
  - `css/styles.css`, `css/themes.css`
- Electron window title, shortcuts, installer name → **Grabio POS**
- **Do not** break offline layout or touch performance-critical paths without testing

*Need from Anwar:* Grabio brand assets (logo, colors, font) if not in ecosystem repo.

---

## Phase 3 — New features

### Manufacturing

- Tie into Grabio `composedProductSource` (`platform` vs `pos`)
- Recipe / raw materials / production flow (align with Grabio `live_kitchen` workflow)
- Depends on catalog API + stock deduction rules

### Hotel

- Scope TBD with Anwar — likely: rooms, folios, charges to POS, housekeeping hooks
- Confirm which modules exist on Grabio subscription (`enabledModules`)

*Both phases need feature spec from Anwar before deep build.*

---

## What we did today (2026-06-30)

- [x] Cursor rules + CoC (`anwar.mdc`, `grabio-pos.mdc`)
- [x] Created `eco sys pos` workspace (isolated from old `posfinal` git)
- [x] Copied POS source + builder pack into ecosystem path layout
- [x] Wired git → `AynBeirut/ecosystem`, pushed `pos-windows-grabio`
- [x] `js/grabio/` Phase 1 — config, pairing, heartbeat (pushed `pos-windows-grabio`)
- [ ] Re-pair button in Settings UI (see Known gap above)
- [ ] **Tomorrow:** Re-sync from full **`posfinal`** if production drifted
- [ ] Anwar: merge PR + fix Windows-invalid paths in ecosystem repo (`assets/xandroid /...`)

---

## Tomorrow — start here

1. Open folder: `C:\Users\Alaa\Documents\githup\pos\eco sys pos`
2. Read this file + `pos-windows-builder-pack/CODE-TASKS.md`
3. Sync latest from `../posfinal/` → `the eco sys/ecosystem-plan/posfinal-main/` (full tree)
4. `npm install` + `npm start` in the POS app folder
5. Implement `js/grabio/grabio-config.js`, `grabio-pairing.js`, `grabio-sync.js`

**First agent prompt:**

> Read `PROJECT-PLAN.md` and `pos-windows-builder-pack/CODE-TASKS.md`. Sync from local `posfinal`, then implement Grabio pairing + heartbeat in `js/grabio/`.

---

## Rules of engagement

- **Edit only** inside `eco sys pos/`
- **Do not** push to `AynBeirut/posfinal`
- **Do not** deploy Firebase / production hosting without Anwar
- Credentials → `.credentials.md` (gitignored), never in code
