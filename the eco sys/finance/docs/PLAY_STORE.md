# Play Store — Grabio Invoice Manager

**Package:** `space.grabio.finance`  
**Web app:** https://grabio.space/invoice/  
**Privacy:** https://grabio.space/privacy  
**Support:** support@grabio.space  

TWA (Trusted Web Activity) — the Play Store APK wraps the live web app. Ship web updates anytime; bump `appVersionCode` only when Android shell changes.

---

## 1. Prerequisites (done in repo)

| Item | Location |
|------|----------|
| Release keystore | `twa/grabio-finance-release.keystore` (gitignored) |
| Keystore passwords | `.credentials.md` (gitignored) |
| TWA manifest | `twa/twa-manifest.json` |
| Digital Asset Links | `public/.well-known/assetlinks.json` → `grabio.space/.well-known/assetlinks.json` |
| Store icons | `twa/store-assets/icon-512.png`, `icon-192.png` |

After enabling **Play App Signing**, add Google's **app signing certificate** SHA256 as a second entry in `assetlinks.json` (keep the upload-key fingerprint too until verified).

---

## 2. Build the Android APK/AAB

```bash
cd "the eco sys/finance/twa"

# One-time: generate Android project from TWA manifest
npx @bubblewrap/cli@latest init --manifest=twa-manifest.json --directory=android

# Build release bundle (upload to Play Console)
npx @bubblewrap/cli@latest build --directory=android
# Output: android/app-release-signed.aab (or .apk)
```

When prompted for keystore password, use values from `.credentials.md`.

**Bump version** before each Play upload (only when shell changes):

- `twa-manifest.json` → `appVersionCode` + `appVersionName`
- Re-run `bubblewrap update --directory=android` then `bubblewrap build`

---

## 3. Play Console — create app

1. [Google Play Console](https://play.google.com/console) → **Create app**
2. **App name:** Grabio Invoice Manager  
3. **Default language:** English (United States) — add Arabic later if needed  
4. **App or game:** App  
5. **Free or paid:** Free  
6. **Declarations:** comply with Play policies (no COVID misinfo, etc.)

---

## 4. Store listing copy (paste into Play Console)

### Short description (80 chars max)

```
Invoices, estimates, receipts & finance tools for your business — by Grabio.
```

### Full description (4000 chars max)

```
Grabio Invoice Manager is a full finance suite for small businesses — part of the Grabio ecosystem at grabio.space.

CREATE & SEND
• Professional invoices, estimates, and receipts
• Multi-currency support with custom exchange rates
• Export documents as PDF (print to PDF)
• Email documents via your mail app

MANAGE YOUR BUSINESS
• Clients and suppliers directory
• Products and inventory with stock movements
• Purchase orders and expenses
• Staff payroll and delivery cash tracking
• Financial reports

GRABIO ECOSYSTEM
• Sign in with the same Google / email account as grabio.space
• Data syncs to your Grabio store in the cloud
• Works with Grabio marketplace and admin tools

Grabio Invoice Manager is a Trusted Web Activity — you always get the latest features without waiting for app updates.

Support: support@grabio.space
Privacy: https://grabio.space/privacy
```

### Category

**Business** (primary) — Finance (secondary tag if available)

### Contact details

| Field | Value |
|-------|-------|
| Email | support@grabio.space |
| Website | https://grabio.space/invoice/ |
| Privacy policy | https://grabio.space/privacy |

---

## 5. Graphics checklist

| Asset | Size | Notes |
|-------|------|-------|
| App icon | 512×512 PNG | `store-assets/icon-512-hires.png` |
| Feature graphic | 1024×500 PNG | **TODO** — teal #38B2AC, "Grabio Invoice Manager" |
| Phone screenshots | 2–8 | Capture: Dashboard, Invoice create, PDF preview, Clients |
| 7-inch tablet | Optional | Same web UI scales |

Screenshot URLs (capture after deploy):

- Login / dashboard
- New invoice form
- Currency settings
- Reports

---

## 6. Content rating

Complete **IARC questionnaire**:

- No violence, gambling, or user-generated public content
- Business / finance app
- Account creation required (Firebase Auth)
- Expected rating: **Everyone** or **PEGI 3**

---

## 7. Data safety form (summary)

| Data type | Collected | Purpose | Shared |
|-----------|-----------|---------|--------|
| Email, name | Yes | Account / auth | No (Firebase only) |
| Business data (clients, invoices) | Yes | App functionality | No |
| Crash logs | Optional | Stability | Firebase |

- Data encrypted in transit (HTTPS)
- Users can request deletion via support@grabio.space
- Privacy policy: https://grabio.space/privacy

---

## 8. Release track strategy

1. **Internal testing** — upload first AAB, add your Gmail as tester  
2. Verify: install → Google sign-in → create invoice → PDF export  
3. **Closed testing** — small client group (optional)  
4. **Production** — submit for review (typically 1–7 days)

While review is pending, continue shipping web updates to `grabio.space/invoice/` — TWA users get them immediately.

---

## 9. Post-approval

- [ ] Add Play Store link to `InstallPWA` page
- [ ] Monitor Play Console vitals (ANRs, crashes)
- [ ] If using Play App Signing: update `assetlinks.json` with Google signing cert SHA256
- [ ] Optional: Firebase App Check for Android TWA

---

## 10. Verify Digital Asset Links

After deploying `assetlinks.json`:

```bash
curl -s https://grabio.space/.well-known/assetlinks.json
```

Or use [Statement List Generator and Tester](https://developers.google.com/digital-asset-links/tools/generator).

Package `space.grabio.finance` must match the signing certificate fingerprint in the file.
