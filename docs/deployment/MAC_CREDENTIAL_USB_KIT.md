# Grabio credentials — USB transfer to Mac

When your Mac says there are no Grabio credentials, use this kit instead of typing env vars on a small screen.

## On the machine that has the repo (or Cloud Agent)

```bash
chmod +x scripts/buildGrabioUsbKit.sh scripts/installGrabioCredentialsOnMac.sh
./scripts/buildGrabioUsbKit.sh
```

Optional — include Firebase admin key in the kit:

```bash
./scripts/buildGrabioUsbKit.sh ~/Downloads/market-flow-7b074-firebase-adminsdk-xxxxx.json
```

This creates **`grabio-usb-credentials/`** (gitignored). Copy that folder to your USB hard disk.

## On the Mac

1. Plug in the USB drive.
2. In Terminal:

```bash
bash /Volumes/YOUR_USB_NAME/grabio-usb-credentials/install-on-mac.sh
```

3. Enter your local repo path (example: `/Users/you/Documents/ecosystem`).
4. Log in to Firebase once:

```bash
cd /Users/you/Documents/ecosystem
npx firebase-tools login
npx firebase-tools use market-flow-7b074
```

## grabio-isolated layout (Mac handoff from USB)

After mounting the disk, you may keep keys outside the main repo:

| File | Purpose |
|------|---------|
| `.credentials.md` | Master login index (matches USB Grabio login file) |
| `scripts/firebase-service-account.json` | **Newer** Firebase admin key (prefer this) |
| Older key beside it | Archive only — do not use for scripts |
| Firebase CLI login cache | Often **empty** until you run `firebase login` |

Scripts expect the admin key at repo root as `serviceAccountKey.json`. Link or copy:

```bash
cp /path/to/grabio-isolated/.../scripts/firebase-service-account.json \
   /path/to/ecosystem/serviceAccountKey.json
chmod 600 /path/to/ecosystem/serviceAccountKey.json
```

Empty CLI login is normal until:

```bash
npx firebase-tools login
npx firebase-tools use market-flow-7b074
```

Admin scripts (`provisionLiveKitchenPackage.cjs`, etc.) use **service account JSON**, not CLI login.

## Cloud agent

The cloud agent **cannot read your Mac USB** or local `grabio-isolated/` paths. Paste handoff notes in chat, upload the JSON, or push a non-secret path doc to GitHub.

## Security

- Do **not** commit `serviceAccountKey.json`, `firebase-service-account.json`, or `grabio-usb-credentials/` to GitHub.
- Keep the USB drive private; rotate the service account key if it is lost.
