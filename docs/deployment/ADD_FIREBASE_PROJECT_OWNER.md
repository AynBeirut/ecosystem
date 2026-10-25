# Add the Mac user as Firebase project Owner

Project: **`market-flow-7b074`** (Grabio)

Only someone who is **already Owner** on the project can do this (phone or laptop). The Mac person **cannot** add themselves.

---

## Which email to add?

**Grabio Mac login (this machine):** `anwar.abouhassan@gmail.com`

That is the Google account used on the Mac for:

```bash
npx firebase-tools login
```

Add **this email** as Owner — not other accounts (e.g. `mooveelectro@gmail.com` is a separate Grabio **client/store** login, not the Mac dev Firebase CLI login).

**Not** the `firebase-adminsdk-...@market-flow-7b074.iam.gserviceaccount.com` address — that is the service account JSON file, not a human login.

---

## Option 1 — Firebase Console (easiest on phone)

1. Open: https://console.firebase.google.com/project/market-flow-7b074/settings/iam  
   (Or: Firebase → **market-flow-7b074** → ⚙️ **Project settings** → **Users and permissions**)
2. Click **Add member**
3. Email: **`anwar.abouhassan@gmail.com`**
4. Role: **Owner**
5. **Add member**
6. They accept the invite email if Google asks them to.

Tell the Mac person to run again:

```bash
npx firebase-tools login
npx firebase-tools use market-flow-7b074
firebase projects:list
```

They should see `market-flow-7b074`.

---

## Option 2 — Google Cloud Console (same result)

1. Open: https://console.cloud.google.com/iam-admin/iam?project=market-flow-7b074  
2. **Grant access** (or **Add**)
3. **New principals:** `anwar.abouhassan@gmail.com`
4. Role: **Owner** (or **Firebase Admin** `roles/firebase.admin` if you want deploy + console but not billing delete)
5. Save

---

## Option 3 — Command line (laptop with Owner login)

```bash
gcloud config set project market-flow-7b074
gcloud projects add-iam-policy-binding market-flow-7b074 \
  --member="user:anwar.abouhassan@gmail.com" \
  --role="roles/owner"
```

For Firebase-only admin (no full GCP Owner):

```bash
gcloud projects add-iam-policy-binding market-flow-7b074 \
  --member="user:anwar.abouhassan@gmail.com" \
  --role="roles/firebase.admin"
```

---

## What Owner fixes on the Mac

| Task | Needs Owner on project? |
|------|-------------------------|
| `node scripts/...` with `serviceAccountKey.json` | **No** — uses JSON key only |
| `firebase deploy` | **Yes** — CLI uses **Google login**, not the JSON |
| Firebase Console in browser | **Yes** — same Google account |
| Empty / denied CLI after login | Often **wrong Google account** or **not invited yet** |

---

## After adding Owner

Mac user:

```bash
cd /path/to/ecosystem
npx firebase-tools login --reauth
npx firebase-tools use market-flow-7b074
npx firebase-tools deploy --only hosting
```

Still copy **`serviceAccountKey.json`** for admin scripts — Owner on the project does not replace that file.
