# Firebase & Google Cloud — Billing & Payment Guide

> Purpose: Help the AI and Anwar quickly diagnose and fix billing-related deployment failures across multiple Firebase projects.

---

## Projects Inventory

| Project Name | Firebase Project ID | App | Billing Account |
|---|---|---|---|
| Market Flow | `market-flow-7b074` | grabio / market-flow | `01353E-267B55-310591` |
| _(add others here)_ | | | |

**Billing Account:** `01353E-267B55-310591`
**Account Name:** Firebase Payment — AYN BEIRUT
**Currency:** USD
**Payment:** Visa •••• 7787 (expires 12/27), Postpay threshold $100

---

## Common Deployment Errors and Fixes

### Error 1 — "Extensions require the Blaze plan"
```
Error: Extensions require the Blaze plan, but project X is not on the Blaze plan.
```
**What it means:** Firebase thinks billing is disabled or the project is on the Spark (free) plan.

**Fix checklist:**
1. Go to [Firebase Console → Usage & Billing](https://console.firebase.google.com/project/market-flow-7b074/usage/details)
   - Confirm plan shows **Blaze — Pay as you go**
2. Go to [GCloud Billing Linked Account](https://console.cloud.google.com/billing/linkedaccount?project=market-flow-7b074)
   - Confirm billing account `01353E-267B55-310591` is linked
3. If billing was suspended (overdue balance), go to [GCloud Billing Overview](https://console.cloud.google.com/billing/01353E-267B55-310591)
   - Make a manual payment or confirm $0 balance
   - Wait 5–10 minutes for billing to re-activate
4. Retry: `firebase deploy --only functions`

---

### Error 2 — "Write access denied: check billing account"
```
HTTP Error: 403, Write access to project 'X' was denied: please check billing account associated
```
**What it means:** Cloud Functions API is blocked — usually billing was suspended or Cloud Functions API is not enabled.

**Fix checklist:**
1. Enable Cloud Functions API:
   → https://console.cloud.google.com/apis/library/cloudfunctions.googleapis.com?project=market-flow-7b074
2. Enable Cloud Run API (required for gen2 functions):
   → https://console.cloud.google.com/apis/library/run.googleapis.com?project=market-flow-7b074
3. Check billing is active (see Error 1 steps above)
4. Retry deploy

---

### Error 3 — "Verify that your project has a Google App Engine instance"
```
Verify that your project has a Google App Engine instance setup at https://console.cloud.google.com/appengine
```
**What it means:** Cloud Functions v2 (gen2) requires App Engine to be initialized in the same region.

**Fix (one-time per project):**
1. Go to: https://console.cloud.google.com/appengine?project=market-flow-7b074
2. Click **Create Application**
3. Select region: **`us-central`** (must match `us-central1` in firebase.json)
4. Click Create — no need to deploy any app, just initialize
5. Retry: `firebase deploy --only functions`

> This is a one-time setup. Once done, it never needs to be repeated for this project.

---

## Proactive Monitoring — How to Avoid Interruptions

### 1. Set a Budget Alert
Go to: https://console.cloud.google.com/billing/01353E-267B55-310591/budgets
- Create a budget for each project
- Set alerts at 50%, 90%, 100% of your expected monthly spend
- Add your email so you get notified BEFORE billing is suspended

### 2. Check the Payment Method
Go to: https://console.cloud.google.com/billing/01353E-267B55-310591/payment-method
- Make sure Visa •••• 7787 is valid and not expiring soon (expires 12/27 — renew before then)
- Keep a backup card on file

### 3. Monthly Check (takes 2 minutes)
Open: https://console.cloud.google.com/billing/01353E-267B55-310591
- Balance should be $0.00 or show a recent charge
- If it shows a failed payment → make a manual payment immediately
- Functions deploy will fail within hours of a payment failure

---

## Deployment Command Reference

```bash
# Deploy everything
firebase deploy

# Deploy only frontend
firebase deploy --only hosting

# Deploy only backend functions
firebase deploy --only functions

# Deploy both hosting + functions (not extensions)
firebase deploy --only hosting,functions

# Check which functions are deployed
firebase functions:list
```

---

## AI Instructions — When a Functions Deploy Fails

When `firebase deploy --only functions` fails, always check in this order:

1. **Read the exact error** — match it to one of the 3 errors above
2. **Check billing first** → https://console.cloud.google.com/billing/01353E-267B55-310591
3. **Ask Anwar to verify** the Firebase console billing page and the GCloud linked billing page
4. **Do NOT assume** the code is broken — billing failures look like code/permission errors
5. **Retry deploy** after Anwar confirms billing is active
6. **Hosting deploys separately** — always deploy hosting first so the frontend is live while billing is resolved:
   ```bash
   firebase deploy --only hosting
   ```

---

## Quick Links (bookmark these)

| Page | URL |
|---|---|
| Firebase Billing | https://console.firebase.google.com/project/market-flow-7b074/usage/details |
| GCloud Billing Account | https://console.cloud.google.com/billing/01353E-267B55-310591 |
| GCloud Linked Account | https://console.cloud.google.com/billing/linkedaccount?project=market-flow-7b074 |
| App Engine Setup | https://console.cloud.google.com/appengine?project=market-flow-7b074 |
| Cloud Functions API | https://console.cloud.google.com/apis/library/cloudfunctions.googleapis.com?project=market-flow-7b074 |
| Budgets & Alerts | https://console.cloud.google.com/billing/01353E-267B55-310591/budgets |
| Payment Methods | https://console.cloud.google.com/billing/01353E-267B55-310591/payment-method |
