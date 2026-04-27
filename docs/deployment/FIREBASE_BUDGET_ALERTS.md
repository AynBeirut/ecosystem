# Firebase Budget Alerts Runbook

Purpose: prevent billing surprises while traffic is growing.

## Recommended Budget Setup (Start Lean)

Create one monthly budget with alerts at:
- 50%
- 75%
- 90%
- 100%

Suggested first budget amount:
- USD 25 to 50 if traffic is still early stage
- Raise once you have stable paid usage patterns

## Scope to Include

Include all Firebase and Google Cloud services used by this project:
- Firebase Hosting
- Cloud Functions
- Firestore
- Cloud Storage
- Cloud Logging (if retained beyond free tier)

## Console Steps

1. Open Google Cloud Console for the Firebase project.
2. Go to Billing -> Budgets and alerts.
3. Click Create budget.
4. Budget scope:
- Billing account: select your active account
- Projects: include this Firebase project
- Services: All services (or restrict to Firebase + core services)
5. Amount:
- Set a fixed monthly amount (example: 30 USD)
6. Threshold rules:
- Add 50, 75, 90, and 100 percent alerts
7. Notification channels:
- Add at least one owner email and one backup email
- Optionally add Slack, SMS, or webhook through Cloud Monitoring channels
8. Save budget.

## Optional Hardening

- Add a second "critical" budget alert at 110% to catch overrun quickly.
- Add weekly cost report emails for non-technical stakeholders.
- Review top cost driver monthly from Billing -> Reports.

## Cost Hotspots to Watch in This Codebase

1. Firestore read volume from dashboard/admin polling and large list pages.
2. Cloud Functions invocations from checkout, notifications, and schedulers.
3. Hosting bandwidth from large JS chunks and media assets.
4. Storage egress for product images and downloadable files.

## Monthly Review Checklist

- [ ] Budget alerts still active and notification channels valid
- [ ] Top 3 services by cost reviewed
- [ ] Largest Firestore read paths identified and optimized if needed
- [ ] Largest Hosting assets reviewed and compressed/split
- [ ] Old logs and unused storage objects cleaned up
