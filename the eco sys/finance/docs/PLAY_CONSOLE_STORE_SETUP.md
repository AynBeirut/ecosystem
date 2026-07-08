# Google Play Console — Store Setup Answers

**Purpose:** Paste-ready answers for Play Console policy and listing forms.  
**Last updated:** 2026-07-06  
**Publisher:** Grabio / Ayn Beirut (emoove.co ecosystem)

This document covers **two** Android apps in the Grabio ecosystem. Use the section that matches the app you are submitting.

| App | Package | Play Console app |
|-----|---------|------------------|
| **Grabio Invoice Manager** | `space.grabio.finance` | Invoice / finance TWA |
| **Grabio Admin** | `space.grabio.app` | Store owner & marketplace app |

---

# App A — Grabio Invoice Manager (`space.grabio.finance`)

## 1. Tell us about the content of your app

**What does your app do? (short)**

> Grabio Invoice Manager is a business finance app for creating and managing invoices, estimates, receipts, clients, products, and financial reports. It is part of the Grabio platform at grabio.space. Users sign in with their Grabio account; business data is stored securely in the cloud.

**App type**

- **App** (not a game)
- **Free** (subscription is managed on grabio.space — the Play Store download is free)

**Primary user**

- Small business owners, freelancers, shop managers, and accountants who need invoicing and basic finance tools on mobile.

**Core features (v1 Play Store scope)**

- Invoices — create, edit, preview, PDF export, share
- Estimates and receipts
- Clients and products directory
- Financial reports
- Multi-currency support (e.g. USD / LBP)
- Settings and company profile (via Grabio store profile)

**Technical note (internal — do not paste to users)**

- Trusted Web Activity (TWA) wrapping `https://grabio.space/invoice/`
- Web updates ship without a new APK unless the Android shell changes

**Does the app contain user-generated content shown publicly?**

- **No** — business documents are private to the signed-in store account.

**Does the app allow users to interact or share content with other users?**

- **No public social features.** Users may email/share their own invoices to clients outside the app.

---

## 2. Privacy policy

| Field | Value |
|-------|--------|
| **Privacy policy URL** | `https://grabio.space/privacy` |

**Declaration**

- Privacy policy is publicly accessible, non-geofenced, and applies to Grabio mobile apps and grabio.space.
- Invoice and business data (clients, invoices, amounts) are covered under “account” and “service operation” data in the policy.

**Recommended follow-up (not blocking Play submission)**

- Add an explicit “Invoice Manager / business finance data” bullet to `public/privacy.html` when convenient.

---

## 3. Sign-in details

**Does your app allow users to sign in?**

- **Yes**

**Sign-in methods**

| Method | Supported |
|--------|-----------|
| Email + password (Firebase Auth) | Yes |
| Google Sign-In | Yes |
| Sign in with Apple | No |
| Facebook / other social | No |
| Guest / anonymous use | No |

**Account requirement**

- **Account required** to use the app. There is no meaningful functionality without signing in.

**Account creation**

- Users can register in-app (email/password) or sign in with Google.
- Same Firebase Auth account as grabio.space web and Grabio Admin app.

**Credentials / test account for Google reviewers**

Provide in Play Console → **App access**:

| Field | Suggested test account |
|-------|------------------------|
| Email | *(create a dedicated reviewer account — do not use production owner email)* |
| Password | *(set in Firebase Auth; store in `.credentials.md` only)* |
| Instructions | Sign in → select or create store → open Invoices → create a sample invoice → export PDF |

**Note for reviewers**

> This app requires internet. After sign-in, the home screen lists Invoices, Estimates, Receipts, Clients, Products, and Reports. Use the “Create Invoice” shortcut or Invoices menu.

---

## 4. Ads

**Does your app contain ads?**

- **No**

**Ad SDKs**

- None (no AdMob, Meta Audience Network, etc.)

---

## 5. Content rating (IARC questionnaire)

Complete the **IARC** questionnaire in Play Console. Recommended answers:

| Question area | Answer |
|---------------|--------|
| Violence | None |
| Sexuality | None |
| Language | None / infrequent mild (business app) |
| Controlled substances | None |
| Gambling | None |
| User interaction / sharing | No public UGC |
| Location sharing | No (location delegation disabled in TWA manifest) |
| Personal info | Yes — account and business data (declared in Data safety) |
| Digital purchases | No in-app Play billing — subscriptions on website |

**Expected rating:** Everyone / PEGI 3 / similar (business productivity app)

---

## 6. Target audience

**Target age group**

- **18 and over** (business / professional use)

**Is this app designed for children?**

- **No**

**Play Console “Target audience and content”**

- Select **18+** only.
- Do **not** select age groups under 13.
- App is not in Designed for Families.

**Appeals to children?**

- **No** — invoicing and business finance tools for adults running a business.

---

## 7. Data safety

Use Play Console → **Data safety** and align with answers below.

### Data collection summary

| Data type | Collected | Required? | Purpose |
|-----------|-----------|-----------|---------|
| Email address | Yes | Yes | Account management, authentication |
| Name | Yes | Yes | Account profile |
| User IDs | Yes | Yes | Firebase UID, store ID |
| Photos (optional) | Optional | No | Company logo upload |
| Financial info (business) | Yes | Yes | Invoices, estimates, receipts, payment records — **user-entered business data**, not consumer banking |
| App interactions | Optional | No | Diagnostics / stability |
| Crash logs | Optional | No | Stability (Firebase) |

### Data safety form — key toggles

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | **Yes — collected** |
| Is data encrypted in transit? | **Yes** (HTTPS) |
| Can users request data deletion? | **Yes** — email support@grabio.space |
| Is collection required or optional? | Account fields **required**; photos **optional** |
| Do you sell user data? | **No** |
| Shared with third parties? | **Yes — service providers only** (Google Firebase) |

### Third-party processors

- **Google Firebase** — Authentication, Firestore, Storage, Analytics (if enabled)

### Data not collected

- Precise location (disabled in TWA)
- Health data
- Political or religious beliefs
- Contacts list (unless user manually types client info)
- SMS / call logs

---

## 8. Government apps

**Is this app developed by or on behalf of a government?**

- **No**

---

## 9. Financial features

Play Console → **Financial features** declaration.

**Which applies?**

| Feature | Applies? | Notes |
|---------|----------|-------|
| Banking / money transmitter | **No** | App does not hold deposits or transfer money between users |
| Cryptocurrency | **No** | |
| Personal loans / credit | **No** | |
| Buy now pay later | **No** | |
| Trading / investment | **No** | |
| Rewards / points / coupons | **No** | |
| **Invoicing / bookkeeping / expense tracking** | **Yes** | Primary purpose |
| Payment processing for goods/services | **Partial** | Users record payments and may link Stripe/OMT on web; app is not a standalone payment processor |
| Wallet / stored value | **No** | |

**Short declaration text (if free-text field):**

> Grabio Invoice Manager helps businesses create invoices, estimates, and receipts and track payment status. It is an invoicing and bookkeeping tool, not a bank, lender, or cryptocurrency service. Optional payment gateway configuration (e.g. Stripe) is for the merchant’s own checkout links; Grabio does not custody customer funds.

---

## 10. Health

**Health apps declaration**

- **No** — this app is not a health, medical, or fitness application.
- Does not collect health data.
- Skip / answer **No** to health-related questionnaires.

---

## 11. Store listing — category & contact

### App category

| Field | Value |
|-------|--------|
| **Primary category** | Business |
| **Tags (if offered)** | Finance, Productivity, Invoicing |

### Contact details

| Field | Value |
|-------|--------|
| **Developer / company name** | Grabio (or legal entity on Play Console account) |
| **Email** | support@grabio.space |
| **Phone** | *(optional — leave blank or add business line)* |
| **Website** | https://grabio.space/invoice/ |
| **Privacy policy** | https://grabio.space/privacy |

### Short description (80 characters max)

```
Invoices, estimates, receipts & finance tools for your business — by Grabio.
```

### Full description

```
Grabio Invoice Manager is a full finance suite for small businesses — part of the Grabio ecosystem at grabio.space.

CREATE & SEND
• Professional invoices, estimates, and receipts
• Multi-currency support with custom exchange rates
• Export documents as PDF
• Share documents via email or your preferred apps

MANAGE YOUR BUSINESS
• Clients directory
• Products catalog
• Financial reports

GRABIO ECOSYSTEM
• Sign in with the same Google or email account as grabio.space
• Data syncs to your Grabio store in the cloud
• Works alongside Grabio marketplace and admin tools

Grabio Invoice Manager is a Trusted Web Activity — you get the latest features from grabio.space without waiting for app updates.

Support: support@grabio.space
Privacy: https://grabio.space/privacy
```

---

# App B — Grabio Admin (`space.grabio.app`)

Use this section if submitting the **Grabio** owner/marketplace Android app.

## 1. Content of your app

**What does your app do?**

> Grabio is a modular business platform for store owners. The Android app lets merchants manage orders, products, inventory, customers, expenses, purchases, suppliers, account statements, and Sales CRM on the go. Customers can also browse the marketplace, place orders, and track deliveries. Part of grabio.space.

**App type:** App · Free  
**Ads:** No

**Owner features:** Dashboard, orders, products, inventory, CRM (if enabled), Invoice Manager launcher (opens grabio.space/invoice in browser when entitled).

**Customer features:** Marketplace, cart, checkout, order tracking, profile.

---

## 2. Privacy policy

| Field | Value |
|-------|--------|
| **URL** | `https://grabio.space/privacy` |

---

## 3. Sign-in details

| Method | Supported |
|--------|-----------|
| Google Sign-In | Yes |
| Email/password | Yes (Firebase) |
| Guest marketplace browse | Limited — guest mode may be available without account |

**Account required** for owner tools and checkout; marketplace may allow guest browsing.

**Reviewer instructions:** Sign in as store owner → Dashboard → Orders / Products. Or sign in as customer → Marketplace → Track order.

---

## 4. Ads

- **No**

---

## 5. Content rating

Same as Invoice Manager: business/commerce app, no violence/gambling, expected **Everyone / 3+** with account/data declarations.

---

## 6. Target audience

- **Primary:** Adults 18+ (business owners, staff, shoppers)
- **Not designed for children** — select 18+ in target audience form; do not include under-13.

---

## 7. Data safety

| Data type | Collected | Purpose |
|-----------|-----------|---------|
| Email, name | Yes | Account |
| Order & delivery info | Yes | Marketplace / fulfillment |
| Device / FCM token | Yes | Push notifications |
| Photos | Optional | Product images |
| Location | Optional | Sales CRM visit logging only, when rep grants permission and logs a visit |
| Business data | Yes | Inventory, expenses, CRM notes |

- Encrypted in transit: **Yes**
- Deletion requests: **support@grabio.space**
- Sold to third parties: **No**
- Firebase as processor: **Yes**

---

## 8. Government apps

- **No**

---

## 9. Financial features

| Feature | Applies? |
|---------|----------|
| Invoicing / bookkeeping | **Yes** (account statements, expense tracking; Invoice Manager via browser) |
| Payment processing | **Partial** — records payments; does not operate as a bank |
| Banking / crypto / lending | **No** |

---

## 10. Health

- **No**

---

## 11. Store listing

| Field | Value |
|-------|--------|
| **Primary category** | Business |
| **Secondary / tags** | Shopping, Productivity |
| **Email** | support@grabio.space |
| **Website** | https://grabio.space |
| **Privacy** | https://grabio.space/privacy |

### Short description (80 chars)

```
Run your store on the go — orders, inventory, CRM & marketplace by Grabio.
```

### Full description (draft)

```
Grabio Admin is the mobile companion for grabio.space — one sign-in, all your store data.

FOR STORE OWNERS
• Dashboard with today’s sales and quick actions
• Orders, products, inventory, customers
• Purchases, suppliers, expenses, account statements
• Sales CRM for field reps (when enabled on your package)
• Invoice Manager access (opens in browser when included in your plan)

FOR CUSTOMERS
• Browse the Grabio marketplace
• Cart, checkout, and order tracking

Built on Firebase with Google Sign-In. Modular packages — activate only the tools your business needs.

Support: support@grabio.space
Privacy: https://grabio.space/privacy
```

---

# Quick checklist before Submit for review

- [ ] Privacy policy URL live: https://grabio.space/privacy
- [ ] `assetlinks.json` deployed for TWA package (`space.grabio.finance` or `space.grabio.app`)
- [ ] Test account credentials added under **App access**
- [ ] Data safety form matches tables above
- [ ] Financial features = invoicing/bookkeeping (**not** banking)
- [ ] Target audience = **18+** only
- [ ] Ads = **No**
- [ ] Government app = **No**
- [ ] Health = **No**
- [ ] Store listing graphics uploaded (icon 512, feature graphic 1024×500, screenshots)
- [ ] Contact email **support@grabio.space** monitored

---

# Related files

| File | Purpose |
|------|---------|
| `the eco sys/finance/docs/PLAY_STORE.md` | TWA build & release steps |
| `the eco sys/finance/twa/twa-manifest.json` | Invoice Manager package metadata |
| `grabio-mobile/app.json` | Admin app package metadata |
| `public/privacy.html` | Live privacy policy |
| `docs/planning/app.md` | Admin app build & version history |
