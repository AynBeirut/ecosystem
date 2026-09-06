# Notification test suite — y.malek session (2026-09-07)

**Store:** NIPCO `DfIhBAEZ5NR7yNX0HboZvv58Nf82`  
**Owner:** `y.malek@nip-lb.com` (`DfIhBAEZ5NR7yNX0HboZvv58Nf82`)

## Before you start

1. Log in on **web** (`grabio.space`) as y.malek → allow browser notifications.
2. Install **Play Store** Grabio on phone → log in → allow notifications.
3. Run status check:

```bash
cd "/home/anwar/Documents/grabio space"
node scripts/notificationTestSuite.cjs --status
```

You need at least **1 FCM token** for the device you are testing.

## Instant tests (FCM now)

One type:

```bash
node scripts/notificationTestSuite.cjs --fire new_order
```

All types (~2 min apart default 8s):

```bash
node scripts/notificationTestSuite.cjs --fire all --gap 8000 --max-tokens=2
```

List every type:

```bash
node scripts/notificationTestSuite.cjs --list
```

## Real Cloud Function triggers

Creates Firestore docs (production FCM path):

```bash
node scripts/notificationTestSuite.cjs --real new_order
node scripts/notificationTestSuite.cjs --real store_announcement
node scripts/notificationTestSuite.cjs --real payment_paid
```

## Tomorrow scheduler seed (already run once)

```bash
node scripts/notificationTestSuite.cjs --seed
```

Log: `reporting/data/notification-test-seed-YYYY-MM-DD.json`

| Seeded | When it fires |
|--------|----------------|
| Order `TEST-SCHED` at 10:00 Beirut | `scheduled_order_1h` ~09:00, `30m` ~09:30 |
| CRM client visit 09:10 Beirut | `crm_visit_reminder` ±15 min |
| `assistantBriefingSentAt` cleared | `morning_briefing` Mon–Sat 08:15 |
| Product stock → 2 | `low_stock` daily 09:00 UTC |
| `storeAnnouncements` doc | FCM to users who **favorited** store (not owner unless favorited) |
| `crmActivities` visit | **Mobile local** alert if owner app open (work hours) |

## Mobile-only local alerts (app must be open, Mon–Sat 8–19 Beirut)

| Type | How to trigger |
|------|----------------|
| `new_order` (local) | Create new order while app open (`--real new_order`) |
| `crm_activity` | Rep logs visit; seed doc already added — reopen app or log visit as Jihan |
| `pending_approvals` | Leave pending orders; manager opens app 09:00–17:00 |
| `morning_briefing` (local) | Same as FCM seed + open app 07:00–10:00 |

## Notification types covered

`new_order`, `order_confirmed`, `order_preparing`, `order_ready`, `order_delivered`, `order_cancelled`, `payment_paid`, `payment_refunded`, `store_announcement`, `low_stock`, `expiry_alert`, `scheduled_order_1h`, `scheduled_order_30m`, `crm_visit_reminder`, `morning_briefing`, `pending_approvals`, `crm_activity`

Email/WhatsApp order notifications: separate path via `orderNotifications` collection — use Admin → Order notifications retry UI after a test order.
