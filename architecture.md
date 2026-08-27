# Architecture

## Current platform

- Frontend: React + Vite app served from Firebase Hosting.
- Backend: Firebase Auth, Firestore, Cloud Functions, and Firebase Storage.
- Admin POS page: `src/pages/admin/PosPairing.tsx` on `/admin/pos`.
- POS API: `functions/src/api/posSync.ts`.

## POS download path

- The live Windows installer download is hardcoded in `src/lib/posApi.ts`.
- Stable public asset URL:
  `https://firebasestorage.googleapis.com/v0/b/market-flow-7b074.firebasestorage.app/o/pos%2FGrabio-POS-Setup.exe?alt=media`
- Stable storage object path:
  `pos/Grabio-POS-Setup.exe`

## POS pairing model

- Store owner opens `/admin/pos` and downloads the installer.
- Grabio generates either:
  - `pairing.json` for auto-link on first launch, or
  - a 6-digit manual pairing code.
- Windows POS pairs against the Functions API and stores its device token locally.

## Important operational rule

- Future Windows POS releases should replace the same storage object path so the Grabio download button does not need code changes for every release.

## Lebanese PCG v2 (E-Moove pilot)

- **Display:** ~522-account PCG tree (`LebanesePcgCoaPanel`) when `storeProfiles.accountingMode=lebanese`.
- **Reports:** Trial Balance / Balance Sheet show PCG or client codes via `grabioToPcgMap` + `pcgClientAccounts` (display only). P&L uses the Lebanese AM form (`lebaneseProfitLoss.ts`): Class 7, inventory C.O.S, expense buckets, FX others.
- **Posting:** Unchanged on Grabio 3-digit `ledgerAccounts` — do not reseed E-Moove COA.
- **Client codes:** Firestore `stores/{storeId}/pcgClientAccounts`; bulk import via Accounting UI or `scripts/seedEmoovePcgClientAccounts.cjs` (E-Moove store ID only).
- **Stores:** E-Moove `EZfuoNQFTJVU4cubNuckpp4K7zw2` (pilot, 1 client code). Little Hands `8WgfKtgaE8aAXdqFhIfweEo5WFq2` — **Lebanese mode live 2026-07-29**, 0 client codes yet. Nipco off limits.
