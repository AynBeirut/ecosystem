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

## Security

- Do **not** commit `serviceAccountKey.json` or `grabio-usb-credentials/` to GitHub.
- Keep the USB drive private; rotate the service account key if it is lost.
