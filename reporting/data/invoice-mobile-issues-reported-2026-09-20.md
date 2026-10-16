# Grabio Invoice Manager (mobile) — issues reported (2026-09-19 session)

**App:** `space.grabio.finance` (`grabio-invoice-mobile`)  
**Scope:** User-reported only. **Do not implement from this doc without explicit approval.**

---

## 1. Estimate / quotation sync (web → mobile)

- Editing an **estimate (quotation)** on **web Invoice Manager** does **not** show on **mobile** (stale or missing data).
- **Editing an estimate on mobile** does **not work** reliably (save / persistence).
- **Example (user):** doc id `QTN-1789822490321-ORDER`, client **جمعية الرجاء ( مائدة المحبة )**, status **draft**, total **~$12.1K**, date **9/19/2026**. Web shows Share / Preview / Edit; mobile should match after refresh.
- **Store context (from handoff / Firestore pull during session):** `Av22LKyet8QmVcu9b8Njz1HVfoy1` (E-Service).

---

## 2. Document numbering

- Mobile does **not** use the same **main / chronological** numbering as web (e.g. `EST-YYYY-MM-DD-000001`, `INV-…`), or shows wrong numbers (e.g. timestamp-style `INV-{time}` on create).

---

## 3. New product

- **Add new product** throws an error and **kicks user out of the app** (crash or unhandled rejection / permissions).

---

## 4. UI — form contrast (create / edit screens)

- **New / create pages** (and similar forms): **text not visible** (contrast) — user cannot see what they type (placeholder / text color on light background).

---

## 5. Invoice template & branding settings

- User reports **template settings removed** from mobile (expected access to invoice template / branding; previously available in their workflow).

---

## 6. PDF export

- User reports **create / share PDF** missing or broken on mobile (expects PDF from quotation/invoice flow, e.g. web **Share** on preview).

---

## 7. App shell / navigation (regression during sideload attempts)

- User reports **pages / sections missing** and **UI changed** vs their known build (tabs such as Invoices / Products hidden; Settings menu reduced).
- **Not the same app feel** as pre-session build (**reference backup:** `invoice-1.2.44-48.apk`, Sept 2026 backup).

---

## 8. Install / delivery (process, not product logic)

- User wanted **test build on phone** without breaking the **Play / backup** build they rely on.
- Sideloads during session caused **version churn** and **loss of trust**; final restore target: **1.2.44 (versionCode 48)** from backup.

---

## Out of scope for this list

- Grabio Admin app (`space.grabio.app`) — separate package unless user clarifies.
- Web-only Invoice Manager bugs (except where mobile must read the same Firestore docs).

---

## Suggested fix order (report only)

1. Confirm **storeId** and **Firestore read path** for `financeEstimates` (match web `loadStoreData`, server read, field names `client_name`, `lineItems`, `name` on lines).
2. **Product create** — Firestore rules + `storeId` binding; catch errors in UI.
3. **Numbering** — align create/update with web renumber policy (do not renumber entire store on every save).
4. **PDF / template** — confirm expected entry points vs `InvoicePreviewScreen` + web deep links.
5. **Form contrast** — `TextInput` `color` + `placeholderTextColor` on editor screens only.
