# Vendored finance module

`beirut-finance-flow-main/` is a deploy-time copy of the finance app source used by Grabio hosting builds.

**Canonical source (development):** `suba eco sys/finance/beirut-finance-flow-main/` (nested ecosystem repo).

**Why vendored:** The ecosystem tree lives in a separate git repo; hosting CI and clean clones must not depend on an untracked sibling checkout.

**Sync ledger / finance src after edits in ecosystem:**

```bash
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude '.env' --exclude '.env.*' \
  "suba eco sys/finance/beirut-finance-flow-main/" \
  vendor/beirut-finance-flow-main/
```

Commit changes under `vendor/beirut-finance-flow-main/src/lib/ledger/` (and related src) with the platform change that depends on them.
