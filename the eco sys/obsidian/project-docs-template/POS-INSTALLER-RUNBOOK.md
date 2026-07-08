# POS Installer Runbook

Use this checklist when `/admin/pos` download fails.

## Symptom

- Browser console shows `/favicon.ico` 404
- POS download button fails
- Installer URL returns 404

## Important

`/favicon.ico` 404 is usually unrelated noise.
The real check is the installer URL response.

## Installer URL (current)

`https://firebasestorage.googleapis.com/v0/b/market-flow-7b074.firebasestorage.app/o/pos%2FGrabio-POS-Setup.exe?alt=media`

## Root causes

1. Installer file not uploaded to bucket path `pos/Grabio-POS-Setup.exe`
2. Storage rules do not allow read on `pos/{filename}`
3. UI points to wrong bucket URL

## Required storage rule

```text
match /pos/{filename} {
  allow read: if true;
  allow write: if false;
}
```

## Publish flow (owner)

1. Build installer on Windows
2. Rename to `Grabio-POS-Setup.exe`
3. Upload to bucket path: `pos/Grabio-POS-Setup.exe`
4. Verify URL returns `200`
5. Open `/admin/pos` and test download

## Quick verification

```bash
node - <<'NODE'
const https = require('https');
const url='https://firebasestorage.googleapis.com/v0/b/market-flow-7b074.firebasestorage.app/o/pos%2FGrabio-POS-Setup.exe?alt=media';
https.get(url,res=>{console.log('status',res.statusCode);res.resume();});
NODE
```

Expected: `status 200`

## If still failing

- Confirm exact filename case: `Grabio-POS-Setup.exe`
- Confirm object path starts with `pos/`
- Hard refresh browser and retest
