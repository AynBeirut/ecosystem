# 🚀 Subscription System Deployment Checklist

## ✅ Code Complete (100%)
- [x] Backend API endpoints
- [x] Payment gateway integration
- [x] Frontend UI pages
- [x] Migration scripts
- [x] Documentation

---

## 🔧 Required Setup (Before Going Live)

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

