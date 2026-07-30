# Production Checklist

## Stripe (BYOK per org + global webhook)
- Each org adds Stripe secret key in **Settings → Payment Methods → Stripe** (`sk_live_...`).
- Configure ONE webhook endpoint in Stripe dashboard:
  - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
  - Copy the **signing secret** (`whsec_...`) and set as `STRIPE_WEBHOOK_SECRET` in Lovable Cloud → Backend → Secrets.

## PayPal
- Create REST app in PayPal developer dashboard.
- Set secrets in Lovable Cloud → Backend → Secrets:
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_SECRET`
  - `PAYPAL_WEBHOOK_ID`
  - (optional) `PAYPAL_API_BASE` → `https://api-m.sandbox.paypal.com` for sandbox testing.
- Configure webhook URL: `https://<project-ref>.supabase.co/functions/v1/paypal-webhook`
- Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`.

## Lovable Cloud env vars (Backend → Secrets)
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID`
- (auto) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `LOVABLE_API_KEY`

## Domain & SSL
- Add custom domain via Project Settings → Domains. SSL provisioned automatically.
- Update Stripe/PayPal success/cancel URLs to use the final production domain.

## Cron / Background jobs
- `psa-retry-timesheets` already deployed; schedule via Supabase scheduled functions if recurring retries needed.

## Backups
- Lovable Cloud takes automatic daily backups. For critical data, enable Point-In-Time Recovery in Cloud settings.
- Optionally export `invoices`, `payment_audit_logs` weekly to CSV via `/reports`.

## Monitoring
- Watch `payment_audit_logs` table for `signature_invalid`, `update_failed`, `exception` statuses.
- Edge function logs available in Lovable Cloud → Backend → Functions → Logs.
- Frontend logger writes structured entries — connect to Sentry later by adding a transport in `src/lib/logger.ts`.

## Launch Checklist
- [ ] All secrets set in Cloud (Stripe webhook + PayPal trio)
- [ ] Stripe + PayPal webhook URLs registered and showing "delivered" status
- [ ] Test invoice end-to-end (card + PayPal + offline) on staging
- [ ] Verify `payment_audit_logs` rows appear after each test
- [ ] Confirm `PaymentSuccess` polling flips to "Paid" within ~5s of webhook
- [ ] Run `bun run build` clean (no TS errors)
- [ ] Custom domain DNS verified, SSL active
- [ ] Org owner accounts created; seat limits verified per plan
- [ ] RLS sanity check: log in as agent → cannot see other orgs' data
