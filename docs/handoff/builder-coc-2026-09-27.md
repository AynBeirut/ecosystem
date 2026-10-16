# Builder CoC — Grabio (locked 2026-09-27)

Every builder (web, Functions, invoice mobile, POS Windows) follows this.

## Document what you did

Before you stop, write a short handoff in `docs/handoff/` and a line in `decision-log.md` or the session README:

- What you changed (files + behavior)
- Which store/surface you touched (never an unscoped tenant)
- What you did **not** deploy
- How Anwar should test

No “done” without that note.

## Anwar test confirm

When Anwar says the test passed, the builder **must write that down** in the same handoff:

- Date
- What Anwar tested
- Result: **confirmed**
- What is still a later round (polish), not a bug

Do not leave a closed item marked broken. Do not reopen a confirmed feature as a rebuild unless Anwar asks for a second round.

## New features (how they are treated)

New work is a **platform feature**, not a one-store patch.

1. Fit the main structure first: `users.subAccountId` → that subAccount’s `storeId`. Entitlement AND store toggle AND user permission.
2. Name the setup surface: Store Profile = shop + online menu. Theme = storefront. Invoice Document = PDFs only.
3. Numbers: `INV-000001` / `PO-000001` (date stored, not in the label). No Firestore ids in UI.
4. One-client pain becomes a tenant option or default. No hardcoded store id.
5. Plan in its own planning chat. Execute in a separate chat.

## Invoice template (planning status)

Round 1 **works** on mobile and the main platform. Anwar tested. A second round may make it better. That is polish, not “template is broken.”
