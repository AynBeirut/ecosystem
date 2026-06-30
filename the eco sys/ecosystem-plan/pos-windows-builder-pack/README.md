# Grabio POS — Windows Builder Pack

**One folder. Start here.**

Owner: Anwar · Firebase: `market-flow-7b074` · Live site: `grabio.space`

---

## What you are doing

Connect the **existing Windows POS app** (Electron + SQL.js, offline-first) to **Grabio** — same store, products, and stock as the web admin. You work on **Windows**. The Grabio web/API code lives in the same git repo but is mostly edited on Linux.

You are **not** rebuilding POS as a website.

---

## Step 1 — Get the code (Windows)

```bat
git clone <REPO_URL>
cd "grabio space\the eco sys\ecosystem-plan\posfinal-main\pos-v1"
npm install
npm start
```

| What | Path in repo |
|------|----------------|
| **POS app (your main work)** | `the eco sys/ecosystem-plan/posfinal-main/pos-v1/` |
| Platform API (read only unless Anwar approves deploy) | `functions/src/api/posSync.ts` |
| Admin pairing page (read only) | `src/pages/admin/PosPairing.tsx` |

---

## Step 2 — Read these files (in this folder)

| Order | File | Content |
|-------|------|---------|
| 1 | **README.md** | This page |
| 2 | **API-CONTRACT.md** | Pairing API — what is live vs what you still build |
| 3 | **CODE-TASKS.md** | Exact files to create in POS + QA checklist |
| 4 | **CURSOR-SETUP.md** | How Anwar copies rules/skills to a new Windows PC |

Optional: copy `rules/grabio-pos.mdc` into the repo root `.cursor/rules/` after clone.

---

## Step 3 — How Grabio connection works

```
Grabio Admin (browser)                    Windows POS
─────────────────────                    ───────────
1. Open grabio.space/admin/pos
2. Generate 6-digit code  ──────────────► 3. User enters code in POS
                                          4. POS calls API /pos/pair
                                          5. POS saves storeId + deviceToken
                                          6. POS sends /pos/heartbeat every few min
```

**API base (production):**

```
https://us-central1-market-flow-7b074.cloudfunctions.net/api
```

| Endpoint | Status |
|----------|--------|
| `POST /pos/pairing-code` | Live (admin generates code) |
| `POST /pos/pair` | Live (POS pairs) |
| `POST /pos/heartbeat` | Live |
| `GET /pos/catalog` | **Not built yet** — you need this for product sync |
| `POST /pos/orders` | **Not built yet** — you need this to push sales |

Full request/response shapes → **API-CONTRACT.md**

---

## Step 4 — What to build in POS

Create new folder:

```
pos-v1/js/grabio/
  grabio-config.js    — API URL, storeId, deviceId, deviceToken
  grabio-pairing.js   — screen: enter 6-digit code + device name
  grabio-sync.js      — heartbeat; later catalog pull + order push
```

**Keep** existing `js/sync-manager.js` (old VPS sync) until Grabio path is tested.

At pairing, user chooses **composed product source**:

- `platform` — recipes live in Grabio; platform deducts stock on sale
- `pos` — POS deducts locally; platform records result only

---

## Step 5 — Test account

1. Store must have **POS module** enabled (`grabio.space/subscription`).
2. Ask Anwar for test store credentials.
3. Pair at `/admin/pos` → enter code in POS → confirm heartbeat in Firestore.

---

## Step 6 — Deploy rules

| Change | Who |
|--------|-----|
| POS `.exe` installer | You build on Windows → send to Anwar |
| Firebase Functions / hosting | **Anwar only** — no deploy without approval |
| Secrets | `.credentials.md` — never in git |

---

## Step 7 — Contact

- support@grabio.space
- Questions on API shape → read **API-CONTRACT.md** first, then Anwar

---

## Zip this folder to send

Anwar can zip and email/Drive:

```bash
cd "the eco sys/ecosystem-plan"
zip -r pos-windows-builder-pack.zip pos-windows-builder-pack/
```

Builder only needs: **this zip** + **git repo access**.
