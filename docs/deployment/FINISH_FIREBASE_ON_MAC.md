# Finish Firebase on the Mac (USB / hard disk)

**Give this file to the person on the Mac.** They plug in the disk, copy files, run 3 commands, done.

---

## Part 0 — Mac must be **Owner** on Firebase (do this first)

**Anwar (or any current Owner)** adds the Mac user’s **Gmail** to project `market-flow-7b074` as **Owner**.

Full steps: **`docs/deployment/ADD_FIREBASE_PROJECT_OWNER.md`**

Quick link (phone): https://console.firebase.google.com/project/market-flow-7b074/settings/iam → **Add member** → Gmail → **Owner**

- Use the same Google account they use for `npx firebase-tools login` on the Mac.
- **Service account JSON is not enough** for `firebase deploy` — they need this invite.

---

## Part A — Grabio Firebase credentials (the actual values)

### A1. Firebase project (every tool uses this)

| Field | Value |
|-------|--------|
| **Project ID** | `market-flow-7b074` |
| **Project number** | `997465465802` |
| **Console** | https://console.firebase.google.com/project/market-flow-7b074 |
| **Auth domain** | `market-flow-7b074.firebaseapp.com` |
| **Storage bucket** | `market-flow-7b074.firebasestorage.app` |
| **Default hosting site** | `market-flow-7b074` |
| **Live site** | https://grabio.space |
| **Cloud API (backend)** | `https://api-5nbn2jdbxa-uc.a.run.app` |

### A2. Web app config (already in code — for `.env.local` / debugging)

| Field | Value |
|-------|--------|
| `apiKey` | `AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U` |
| `authDomain` | `market-flow-7b074.firebaseapp.com` |
| `projectId` | `market-flow-7b074` |
| `storageBucket` | `market-flow-7b074.firebasestorage.app` |
| `messagingSenderId` | `997465465802` |
| `appId` (web) | `1:997465465802:web:3c6789ea41a9458a98e533` |
| `measurementId` (GA) | `G-YSSWDNYTSW` |

### A3. Copy this entire block → `ecosystem/.env.local`

Create the file if missing. **These are settings, not the admin secret.**

```env
VITE_API_BASE=https://api-5nbn2jdbxa-uc.a.run.app
VITE_FIREBASE_AUTH_DOMAIN=market-flow-7b074.firebaseapp.com
VITE_GOOGLE_CLIENT_ID=997465465802-aa8arghkqbm9jjdvokmgfr1adu17ih2e.apps.googleusercontent.com
VITE_GSC_PROPERTY=https://grabio.space/
VITE_FIREBASE_VAPID_KEY=BAqIup01nmdSPFPl2eNJzTQlxY5r35SYHgPNwdjleEIQJVx0OYcxGntXuiqvBboIZ0dIQS47WPronVDTUexGE5w
VITE_ECOSYSTEM_MODULAR=true
VITE_ECOSYSTEM_PACKAGE_DRAFT=true
VITE_ECOSYSTEM_MODULAR_CHECKOUT=true
VITE_ECOSYSTEM_ENFORCE_MODULES=true
VITE_PUBLIC_PRODUCT_STOCK_API=true
```

### A4. Copy this → `ecosystem/.firebaserc`

```json
{
  "projects": {
    "default": "market-flow-7b074",
    "grabio": "market-flow-7b074"
  },
  "targets": {
    "market-flow-7b074": {
      "hosting": {
        "production": ["market-flow-7b074"]
      }
    }
  }
}
```

(Or copy `grabio-usb-credentials/firebaserc.json` from the USB — same thing.)

---

## Part B — The SECRET (admin / Firestore / scripts)

**This is what “Firebase credentials” means for `node scripts/...` and provisioning users.**

| Item | Detail |
|------|--------|
| **What it is** | Firebase **service account** private key (JSON file) |
| **Filename on Mac repo** | `ecosystem/serviceAccountKey.json` (exact name) |
| **On USB / disk** | `firebase-service-account.json` or `serviceAccountKey.json` |
| **Which file** | **Newest** on disk (e.g. **19 Jul 2026**), not an old **28 Feb** copy |
| **Typical path** | `grabio-isolated/.../scripts/firebase-service-account.json` |
| **Also on USB kit** | `grabio-usb-credentials/serviceAccountKey.json` (if someone built the kit with the key) |

The JSON must contain (open file and check):

- `"project_id": "market-flow-7b074"`
- `"type": "service_account"`
- `"private_key": "-----BEGIN PRIVATE KEY-----..."`
- `"client_email": "firebase-adminsdk-....@market-flow-7b074.iam.gserviceaccount.com"`

**Do not paste this JSON into GitHub, email, or chat.** Copy the **file** only.

### Copy secret to repo (pick one command)

```bash
cd /path/to/ecosystem

# From grabio-isolated on USB:
cp "/Volumes/YOUR_USB/PATH/TO/scripts/firebase-service-account.json" ./serviceAccountKey.json

# OR from USB kit:
cp "/Volumes/YOUR_USB/grabio-usb-credentials/serviceAccountKey.json" ./serviceAccountKey.json

chmod 600 serviceAccountKey.json
```

Or:

```bash
./scripts/linkFirebaseAdminKey.sh "/Volumes/YOUR_USB/.../firebase-service-account.json"
```

**Without this file, the Mac is NOT connected to Firebase admin — no amount of `.env` fixes that.**

---

## Part C — Firebase CLI login (deploy only)

| Item | Detail |
|------|--------|
| **What it is** | Your **Google account** session in the browser |
| **NOT the same as** | `serviceAccountKey.json` |
| **File often empty until** | You run login once — **that is normal** |
| **Needed for** | `firebase deploy --only hosting` / functions |
| **NOT needed for** | `node scripts/provisionLiveKitchenPackage.cjs` |

```bash
npx firebase-tools login
npx firebase-tools use market-flow-7b074
```

Use a Google account that has access to project **market-flow-7b074** (owner/editor).

---

## Part D — What `.credentials.md` on the USB is

- **Human notebook** of logins (matches “Grabio login file” on disk).
- **Scripts do not read it.**
- Use it only to **find the path** to `firebase-service-account.json`.

---

## Part E — Do the job (order matters)

```bash
ls /Volumes                                    # find USB name
cd ~/Documents/ecosystem || git clone https://github.com/AynBeirut/ecosystem.git && cd ecosystem
git pull && npm install

# Settings (Part A3 + A4) — or:
bash "/Volumes/YOUR_USB/grabio-usb-credentials/install-on-mac.sh"

# Secret (Part B) — MUST do even if installer ran without key:
./scripts/linkFirebaseAdminKey.sh "/Volumes/YOUR_USB/.../firebase-service-account.json"

# Test connection:
node scripts/provisionLiveKitchenPackage.cjs littlehands407@gmail.com
node scripts/provisionLiveKitchenPackage.cjs littlehands407@gmail.com --write
```

Deploy website (Part C) only if asked:

```bash
npx firebase-tools login
npm run build && npx firebase-tools deploy --only hosting
```

---

## Part F — Checklist (Mac person signs off)

- [ ] `ecosystem/serviceAccountKey.json` exists, `chmod 600`, project_id = `market-flow-7b074`
- [ ] `ecosystem/.env.local` matches Part A3
- [ ] `ecosystem/.firebaserc` matches Part A4
- [ ] `node scripts/provisionLiveKitchenPackage.cjs ...` runs (no “serviceAccountKey not found”)
- [ ] (Optional) `firebase login` only if deploying

---

## Never commit to GitHub

`serviceAccountKey.json`, `firebase-service-account.json`, `.credentials.md`, `grabio-usb-credentials/`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “No Grabio credentials on Mac” | Missing **Part B** file at repo root |
| Empty CLI login | **Part C** — ignore unless deploying |
| Cloud agent worked, Mac didn’t | Cloud had uploaded JSON; Mac still needs **Part B** from USB |
| Permission denied | Wrong/old JSON — use **newest** key on disk |
