# Firebase cost guardrails (Parts 1a–1d)

**Status:** L1 client cache implemented. GCP budgets + L2 CDN = manual ops steps below.  
**Out of scope:** Global auto-shutdown, Supabase migration, repository pattern.

---

## 1a — GCP billing budgets (manual — ~30 min)

Create in [GCP Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets) for project `market-flow-7b074`:

| Budget | Threshold alerts | Action |
|--------|------------------|--------|
| $10/mo | 50%, 90%, 100% | Email only |
| $25/mo | 50%, 90%, 100% | Email only |
| $50/mo | 50%, 90%, 100% | Email + review Firestore read spikes |

**No kill-switch** — alerts only. Review: Firestore usage, Hosting bandwidth, Functions invocations, Storage egress.

---

## 1b — Read caching

### L1 — Client memory TTL (done)

- `src/lib/publicReadCache.ts`
- Wired on Marketplace (`storeProfiles`, `products` lists)
- Storefront profile/product loads can use same helper

Default TTL: **60s** per cache key per tab. Clears on full page reload.

### L2 — CDN / Hosting headers (pending deploy review)

`firebase.json` currently sets `no-cache` on HTML shells. For static assets, ensure long `max-age`.  
Optional later: Cloud Function read-through cache for hot public collections (not started).

---

## 1c — What Firestore rules cannot do

- **Rules do not rate-limit reads.** Every client `getDocs` still bills if allowed.
- **Rules do not cache.** Use client TTL (L1), CDN (L2), or move hot paths to Functions.
- **App Check** (later): reduces abuse from non-app clients; not a substitute for caching.

---

## 1d — Explicitly deferred

- Automatic project shutdown on budget breach
- Per-IP throttling in rules
- Full public API gateway rewrite

---

## WordPress ops config (Part 3)

Create once in Firestore Console:

```
platformConfig/grabio
  opsUids: ["<your-firebase-uid>", "..."]
```

Only listed UIDs can list/update all `wordpressProvisioningRequests` and open `/admin/ops/wordpress`.

---

## R2 media (Part 2 — scaffold only)

- `src/lib/r2Upload.ts` — disabled unless `VITE_R2_UPLOAD_ENABLED=true`
- Requires Cloud Function `POST /r2/presign` + R2 bucket credentials in Functions secrets
- **New uploads only** (no migration) when enabled

---

## Builder demo slots (Part 4a — done)

`BUILDER_MAX_DEMO_SLOTS = 2` in `src/lib/builderConstants.ts`.
