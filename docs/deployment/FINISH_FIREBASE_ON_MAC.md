# Finish Firebase on the Mac (USB / hard disk)

**Audience:** Person on the Mac with the Grabio USB plugged in.  
**Goal:** Connect to Firebase and run admin scripts. **No all-day back-and-forth.**

---

## What “connect to Firebase” actually means

| What | Type | Required for | Where it lives |
|------|------|----------------|----------------|
| **Firebase admin JSON** | Secret file | `node scripts/...`, Firestore admin, provision users | `serviceAccountKey.json` at **repo root** |
| **`.env.local` / `.env.production`** | Settings (not secret) | `npm run dev` / `npm run build` | Repo root |
| **`.firebaserc`** | Settings | Tells CLI project id `market-flow-7b074` | Repo root |
| **Firebase CLI login** | Browser session | **`firebase deploy` only** | Created by `firebase login` — **empty until you run that** |

**If the CLI login file is empty:** that is **normal**. Scripts still work once `serviceAccountKey.json` is in place.

**`.credentials.md` on the USB:** human index of logins. Scripts **do not** read it. Use it to **find** the admin JSON path.

**Use the newer admin key** on the disk (e.g. July 2026), not an older copy from February — same Firebase account, newer key wins.

---

## What to take from the hard disk

On the Mac, open Terminal:

```bash
ls /Volumes
```

Replace `YOUR_USB` below with the real volume name.

Look for **one** of these (first match wins):

1. `/Volumes/YOUR_USB/grabio-usb-credentials/serviceAccountKey.json`
2. `/Volumes/YOUR_USB/grabio-isolated/**/scripts/firebase-service-account.json`
3. Any `market-flow-7b074-firebase-adminsdk-*.json` on the disk (newest date)

Also useful (not secret):

- `grabio-usb-credentials/dot-env-local` → repo `.env.local`
- `grabio-usb-credentials/firebaserc.json` → repo `.firebaserc`
- `grabio-usb-credentials/install-on-mac.sh` → run once (see below)

---

## Do this in order (copy-paste)

### 1. Get the code

```bash
cd ~
git clone https://github.com/AynBeirut/ecosystem.git
cd ecosystem
git pull
npm install
```

(If you already have the repo, `cd` there and `git pull` instead.)

### 2. Install settings + secret from USB

**Option A — installer (easiest)**

```bash
bash "/Volumes/YOUR_USB/grabio-usb-credentials/install-on-mac.sh"
```

When prompted, enter the full path to the `ecosystem` folder, e.g. `/Users/you/Documents/ecosystem`.

**Option B — manual admin key only**

```bash
cd /path/to/ecosystem
chmod +x scripts/linkFirebaseAdminKey.sh
./scripts/linkFirebaseAdminKey.sh "/Volumes/YOUR_USB/PATH/TO/firebase-service-account.json"
```

That creates `serviceAccountKey.json` in the repo (what all admin scripts expect).

### 3. Prove Firebase admin works

Dry run (no writes):

```bash
node scripts/provisionLiveKitchenPackage.cjs littlehands407@gmail.com
```

If you see JSON with `email` and `patch`, you are **connected**. Apply for real:

```bash
node scripts/provisionLiveKitchenPackage.cjs littlehands407@gmail.com --write
```

**Job done** for provisioning / Firestore admin.

### 4. Only if you must deploy the website (`grabio.space`)

```bash
npx firebase-tools login
npx firebase-tools use market-flow-7b074
npm run build
npx firebase-tools deploy --only hosting
```

Step 4 is **not** required for step 3.

---

## Fixed values (do not guess)

| Setting | Value |
|---------|--------|
| Firebase project ID | `market-flow-7b074` |
| Auth domain | `market-flow-7b074.firebaseapp.com` |
| Live API | `https://api-5nbn2jdbxa-uc.a.run.app` |

---

## Never commit to GitHub

- `serviceAccountKey.json`
- `firebase-service-account.json`
- `.credentials.md`
- `grabio-usb-credentials/` folder

---

## Troubleshooting (30 seconds)

| Symptom | Fix |
|---------|-----|
| `serviceAccountKey.json not found` | Run step 2 — key must be at **repo root** with that exact name |
| `Failed to authenticate` / `firebase login` | You are trying **deploy** without step 4 — or wrong Google account in browser |
| Cloud agent “could connect” but Mac cannot | Cloud used a key **uploaded to Cursor**; Mac needs its **own copy** from USB (step 2) |
| Permission denied on Firestore | Wrong or **old** JSON key — use the **newer** file from the disk |

---

## Checklist

- [ ] USB mounted (`ls /Volumes`)
- [ ] Newest `firebase-service-account.json` copied → `ecosystem/serviceAccountKey.json`
- [ ] `chmod 600 serviceAccountKey.json`
- [ ] `.env.local` present (installer or kit)
- [ ] `node scripts/provisionLiveKitchenPackage.cjs ...` runs without “not found”
- [ ] (Optional) `firebase login` only if deploying hosting
