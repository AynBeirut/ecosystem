# 🚀 Master Build & Deployment Checklist
**Last Updated:** April 18, 2026

> **Canonical deploy rules:** `~/Documents/grabio-platform-docs/Deploy/Protocol.md`  
> This checklist is a historical feature backlog. Non-negotiable gates live in the vault.

---

## ✅ ALREADY LIVE

- [x] Core platform (stores, products, orders)
- [x] Whish Money sandbox integration
- [x] Stripe integration
- [x] Guest checkout + multi-currency
- [x] Subscription system (Trial/Starter/Pro/Business)
- [x] Admin dashboard + all management pages
- [x] Friendly URLs (`/nipco`, `/store/nipco`)
- [x] Custom domain support
- [x] Contact Us (platform + per-store) via SMTP
- [x] Order via WhatsApp (wa.me, all paid plans)
- [x] WhatsApp hidden on Trial (revenue share enforcement)
- [x] Push notifications (FCM)
- [x] Store page: carousel, About, custom pages, reviews
- [x] websiteUrl updated: aynbeirut.com → grabio.space *(done today)*

---

## 🔴 PHASE 1 — No external accounts needed (start now)

### SEO: Meta Tags + Open Graph
- [ ] Add `<title>`, `<meta description>` per page
- [ ] Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- [ ] Twitter Card tags
- [ ] Dynamic tags on store pages (store name, logo, description)
- [ ] Dynamic tags on product pages (product name, image, price)
- **File:** `src/components/SEOHead.tsx` (new component using react-helmet-async)

### SEO: Sitemap + robots.txt
- [ ] Generate `sitemap.xml` with all store slugs + product slugs
- [ ] Update `public/robots.txt` to reference sitemap
- [ ] Cloud Function `GET /sitemap.xml` that builds dynamically from Firestore
- **File:** `functions/src/api/sitemap.ts` (new)

### SEO: Schema.org Structured Data
- [ ] `LocalBusiness` schema on store pages
- [ ] `Product` schema on product pages (name, price, availability, image)
- [ ] `BreadcrumbList` schema on product pages
- **File:** injected via `SEOHead.tsx`

### Google Analytics 4
- [ ] Create GA4 property at analytics.google.com
- [ ] Add Measurement ID (`G-XXXXXXXXXX`) to `.env` as `VITE_GA4_ID`
- [ ] Install `react-ga4` or use `gtag.js`
- [ ] Track: page views, add to cart, checkout start, purchase, store view
- **File:** `src/lib/analytics.ts` (new)

### Customer Reviews Public UI
- [ ] Reviews already stored in `storeReviews` Firestore collection ✅
- [ ] Reviews displayed on `StoreDetail.tsx` already ✅
- [ ] **Missing:** Public product-level reviews (if needed)
- [ ] **Missing:** Review moderation in Admin panel
- [ ] **Missing:** Star rating shown on StoreCard in marketplace
- **Files:** `src/pages/StoreDetail.tsx`, `src/components/StoreCard.tsx`

---

## 🟠 PHASE 2 — Need external accounts/keys

### SendGrid Email Marketing
- [ ] Sign up: https://sendgrid.com (free tier: 100 emails/day)
- [ ] Verify domain `grabio.space` in SendGrid
- [ ] Get API key → add to Firebase env: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` already set via nodemailer *(email already works via grabio.space SMTP)*
- [ ] **Marketing campaigns:** Build Admin UI for sending newsletters to customer list
- [ ] Store customer emails in `storeProfiles/{id}/subscribers` subcollection
- [ ] Cloud Function `POST /marketing/send-campaign`
- **Note:** Transactional email (order confirm, subscription) already works ✅

### Meta Pixel
- [ ] Create Facebook App at developers.facebook.com
- [ ] Get Pixel ID → add as `VITE_META_PIXEL_ID`
- [ ] Install `react-facebook-pixel`
- [ ] Track: PageView, ViewContent (product), AddToCart, Purchase
- **File:** `src/lib/metaPixel.ts` (new)

### Meta Catalog / Instagram Shopping
- [ ] Requires Meta Business Manager + Commerce Account approval
- [ ] Cloud Function `GET /meta-catalog.xml` — generates product feed XML
- [ ] Submit feed URL to Meta Commerce Manager
- [ ] **Estimated time after pixel:** 1–2 weeks for approval + setup
- **File:** `functions/src/api/metaCatalog.ts` (new)

---

## 🟡 PHASE 3 — Security & Compliance

### 2FA for Admin Accounts
- [ ] Enable Firebase Auth MFA (TOTP) in Firebase Console
- [ ] Add 2FA enrollment step in AdminProfile or first-login flow
- [ ] Show QR code for Google Authenticator
- **File:** `src/pages/admin/AdminProfile.tsx` + Firebase Auth MFA SDK

### GDPR: Cookie Consent Banner
- [ ] Simple banner on first visit (localStorage flag)
- [ ] Accept / Decline / Settings options
- [ ] Block GA4 + Meta Pixel until accepted
- **File:** `src/components/CookieConsent.tsx` (new)

### GDPR: Data Export & Right to Delete
- [ ] Cloud Function `POST /gdpr/export` — returns all user data as JSON
- [ ] Cloud Function `POST /gdpr/delete` — removes all user data from Firestore
- [ ] Admin UI + customer-facing request form
- **File:** `functions/src/api/gdpr.ts` (new)

---

## 🔴 WHISH MONEY — Production Go-Live

### Status: ⚠️ Still on SANDBOX

**Contact:** Steven Ayoub — s.ayoub@whish.money
**Last email:** Feb 19, 2026 — gave sandbox credentials + API docs

**What we already have:**
- Channel: `10198838`
- Secret: `009ca52d70e54fe0971b9143fe3e2b3a`
- Sandbox URL: `https://api.sandbox.whish.money/itel-service/api` ✅ (in code)
- Production URL (commented out): `https://api.whish.money/itel-service/api` *(needs confirmation)*
- websiteUrl: updated to `grabio.space` ✅

**Reply email to send Steven (see below) — ask for:**
- [ ] Confirm production API URL is `https://api.whish.money/itel-service/api`
- [ ] Update `websiteUrl` from `aynbeirut.com` to `grabio.space` on their side
- [ ] Confirm our webhook URL: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish`
- [ ] Get test/production channel credentials for `grabio.space`

**To switch to production** (one line change in `whishPayment.ts`):
```typescript
// Change:
baseUrl: process.env.WHISH_BASE_URL || 'https://api.sandbox.whish.money/itel-service/api',
// To:
baseUrl: process.env.WHISH_BASE_URL || 'https://api.whish.money/itel-service/api',
```

---

## ⚪ PHASE 4 — Mobile App (Multi-week project)

### React Native / Expo App
- [ ] `npx create-expo-app grabio-mobile` — scaffold today
- [ ] Bottom tab navigation (Marketplace, Cart, Orders, Profile)
- [ ] Firebase Auth (Google + email/password)
- [ ] Reuse same Firestore + Functions backend
- [ ] Push notifications via FCM (already implemented on backend)
- [ ] App Store + Google Play submission
- **Realistic timeline:** 6–10 weeks full app
- **Today's goal:** Scaffold + Auth screen only

---

## 📋 QUICK REFERENCE — Env Variables Needed

| Variable | Where | Status |
|----------|-------|--------|
| `SMTP_HOST` | Firebase Functions | ✅ Set (mail.grabio.space) |
| `SMTP_USER` | Firebase Functions | ✅ Set |
| `SMTP_PASS` | Firebase Functions | ✅ Set |
| `WHISH_BASE_URL` | Firebase Functions | ⚠️ Using sandbox |
| `VITE_GA4_ID` | .env frontend | ❌ Not set |
| `VITE_META_PIXEL_ID` | .env frontend | ❌ Not set |
| `VITE_API_URL` | .env frontend | ✅ Set |


### 1. Whish Money API Configuration
**Status:** ⚠️ REQUIRED - Using placeholder URL

**Action Steps:**
1. Contact Whish Money support
2. Get production API base URL
3. Update `functions/src/services/whishPayment.ts` line 8:
   ```typescript
   baseUrl: 'https://ACTUAL-WHISH-API-URL.com/v1'
   ```
4. Verify endpoints match their documentation:
   - POST `/payments/initiate`
   - POST `/payments/verify`
   - POST `/refunds`

**Current Credentials:**
- Channel: `10198838`
- Secret: `009ca52d70e54fe0971b9143fe3e2b3a`
- Website: `aynbeirut.com`

**Contact:** Ask Whish Money for:
- [ ] Production API URL
- [ ] Sandbox/Test URL (for testing)
- [ ] Webhook callback requirements
- [ ] Payment flow documentation

---

### 2. Email Service Setup
**Status:** ⚠️ REQUIRED - Currently only logging

**Option A: SendGrid (Recommended)**
1. Sign up: https://signup.sendgrid.com/
2. Get API key: Settings → API Keys
3. Install package:
   ```bash
   cd functions
   npm install @sendgrid/mail
   ```
4. Update `functions/src/services/emailService.ts`:
   ```typescript
   import sgMail from '@sendgrid/mail';
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   
   async function sendEmail(template: EmailTemplate) {
     await sgMail.send({
       to: template.to,
       from: 'noreply@aynbeirut.com', // Verify this domain in SendGrid
       subject: template.subject,
       html: template.html
     });
   }
   ```
5. Set environment variable:
   ```bash
   firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
   ```

**Option B: Mailgun**
1. Sign up: https://www.mailgun.com/
2. Get API key from dashboard
3. Install: `npm install mailgun.js`
4. Similar setup to SendGrid

**Option C: Firebase Extensions**
1. Go to Firebase Console → Extensions
2. Install "Trigger Email" extension
3. Configure SMTP settings
4. Use the extension's API

---

### 3. Environment Variables
**Status:** ⚠️ REQUIRED

Set these in Firebase Functions:

```bash
# Email service
firebase functions:config:set sendgrid.key="YOUR_API_KEY"
# or
firebase functions:config:set mailgun.key="YOUR_API_KEY"
firebase functions:config:set mailgun.domain="YOUR_DOMAIN"

# Whish Money (already in code, but can use env vars for security)
firebase functions:config:set whish.channel="10198838"
firebase functions:config:set whish.secret="009ca52d70e54fe0971b9143fe3e2b3a"
firebase functions:config:set whish.website="aynbeirut.com"

# App URLs
firebase functions:config:set app.url="https://aynbeirut.com"
```

Check current config:
```bash
firebase functions:config:get
```

---

### 4. Deploy Functions
**Status:** ⏳ PENDING

```bash
cd "/home/anwar/Documents/grabio space/functions"

# Build TypeScript
npm run build

# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:subscriptionAPI
firebase deploy --only functions:handleWhishWebhook
firebase deploy --only functions:checkSubscriptions
```

---

### 5. Configure Firestore Security Rules
**Status:** ⚠️ CHECK REQUIRED

Ensure `storeProfiles` collection allows:
- Users can read their own profile
- Only server (via Functions) can write subscription data

Example rule:
```javascript
match /storeProfiles/{userId} {
  allow read: if request.auth.uid == userId;
  allow write: if request.auth.uid == userId 
    && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['subscriptionStatus', 'subscriptionTier', 'isLegacyUser']);
}
```

---

### 6. Test Payment Flow
**Status:** ⏳ AFTER DEPLOYMENT

1. **Test Trial ($1)**:
   - [ ] Login as new user
   - [ ] Click "Start $1 Trial"
   - [ ] Complete payment with Whish
   - [ ] Verify webhook activates trial
   - [ ] Check email received
   - [ ] Verify Firestore updated

2. **Test Subscription**:
   - [ ] Click "Upgrade to Premium"
   - [ ] Complete payment
   - [ ] Verify subscription activated
   - [ ] Check billing history

3. **Test Cancellation**:
   - [ ] Click "Cancel Subscription"
   - [ ] Verify grace period starts
   - [ ] Check email notification

4. **Test Expiry**:
   - [ ] Manually set expiry date to yesterday in Firestore
   - [ ] Wait for daily checker to run (or trigger manually)
   - [ ] Verify grace period email sent
   - [ ] After 7 days, verify account blocked

---

### 7. Configure Whish Webhooks
**Status:** ⏳ AFTER DEPLOYMENT

In Whish Money dashboard:
1. Set webhook URL to: `https://YOUR-REGION-PROJECT-ID.cloudfunctions.net/handleWhishWebhook`
2. Enable webhook events:
   - Payment success
   - Payment failed
   - Refund processed
3. Test webhook delivery

---

### 8. Setup Scheduled Function
**Status:** ⏳ AFTER DEPLOYMENT

The daily subscription checker runs at 09:00 UTC:
- Verify it's deployed: `firebase functions:log --only checkSubscriptions`
- Check Cloud Scheduler in Firebase Console
- Test manually: Call the function URL with appropriate auth

---

## 🧪 Testing Checklist

### Before Production:
- [ ] Whish API responds correctly (use test mode if available)
- [ ] Emails send successfully
- [ ] Payment success → subscription activates
- [ ] Payment failure → user notified
- [ ] Webhooks verified with signature
- [ ] Cancellation works
- [ ] Legacy users can access admin
- [ ] Non-subscribers redirected to upgrade page
- [ ] Daily checker sends reminders
- [ ] Grace period logic works
- [ ] Account blocking after grace period
- [ ] Data deletion after 30 days

### Production Go-Live:
- [ ] All environment variables set
- [ ] Functions deployed
- [ ] Firestore rules secure
- [ ] Whish webhooks configured
- [ ] Email service sending
- [ ] SSL/HTTPS working
- [ ] Error monitoring enabled (Firebase Crashlytics)
- [ ] Backup plan for payment failures

---

## 📞 Support Contacts

**Whish Money Issues:**
- Support: [Get from Whish Money]
- Documentation: [Request from Whish Money]

**Firebase Issues:**
- Console: https://console.firebase.google.com/
- Documentation: https://firebase.google.com/docs

**Email Service Issues:**
- SendGrid Support: https://support.sendgrid.com/
- Mailgun Support: https://help.mailgun.com/

---

## 🚨 Quick Deployment (Step-by-Step)

### Right Now (Local):
```bash
# 1. Build functions
cd "/home/anwar/Documents/grabio space/functions"
npm run build

# 2. Check for errors
npm run build 2>&1 | grep -i error
```

### After Getting API Keys:
```bash
# 3. Set environment variables
firebase functions:config:set sendgrid.key="YOUR_KEY"
firebase functions:config:set whish.base_url="ACTUAL_URL"

# 4. Deploy functions
firebase deploy --only functions

# 5. Deploy frontend
cd ..
npm run build
firebase deploy --only hosting
```

### After Deployment:
```bash
# 6. Test the API
curl https://YOUR-REGION-PROJECT-ID.cloudfunctions.net/subscriptionAPI/info

# 7. Check logs
firebase functions:log
```

---

## 📊 Current Status Summary

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Backend Code | ✅ Complete | None |
| Frontend Code | ✅ Complete | None |
| Whish API | ⚠️ Placeholder | Get production URL |
| Email Service | ⚠️ Logging only | Setup SendGrid/Mailgun |
| Environment Vars | ⚠️ Not set | Configure in Firebase |
| Functions Deployed | ❌ Not deployed | Run `firebase deploy` |
| Webhooks | ❌ Not configured | Setup after deployment |
| Testing | ⏳ Pending | After deployment |
| Legacy Users | ⚠️ 2/8 activated | Users need to upgrade |

---

**NEXT IMMEDIATE STEPS:**
1. ✅ Get Whish Money production API URL
2. ✅ Sign up for SendGrid (free tier allows 100 emails/day)
3. ✅ Set environment variables
4. ✅ Deploy to Firebase
5. ✅ Test payment flow

**Estimated Time:** 2-3 hours (mostly waiting for API keys)

