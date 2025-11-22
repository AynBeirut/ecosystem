Server-side functions
=====================

This repository includes a `functions/` folder with a Firebase Cloud Function that implements an atomic `/api/checkout` endpoint. It should be deployed with the Firebase CLI and uses the Admin SDK to safely create orders and credit transactions while decrementing user credits in a Firestore transaction.

Quick start (from the repo root):

```powershell
cd functions; npm install; npm run build; npm run deploy
```

For local testing you can run the Functions emulator:

```powershell
cd functions; npm install; npm run start
```

See `functions/README.md` for more details.

Emulator notes:

- This repo now includes a `firebase.json` with `functions.source` set to `functions` and a `.firebaserc` placeholder. Replace `your-firebase-project-id` in `.firebaserc` with your actual Firebase project id or run `firebase use --add`.
- If you see the error "functions: Failed to start Functions emulator: codebase source must be specified", that means `firebase.json` was missing or `functions.source` wasn't set — it's included now, but make sure `.firebaserc` points to a valid project.

Start the emulator (from repo root):

```powershell
cd functions
npm install
npm run start
```

