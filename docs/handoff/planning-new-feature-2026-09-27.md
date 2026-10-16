# Handoff — New planning conversation (2026-09-27)

Paste the block below into a **new planning chat**. Do not continue the old thread. That thread is closed for planning.

This chat is **planning only**. Do not execute. Do not deploy. Do not push.

---

```text
You are planning in /home/anwar/Documents/grabio space.

This is a NEW planning conversation. The previous planning thread is closed (too long, mixed POS / APK / old template notes). Do not reopen those as current problems.

Mission: plan the next feature Anwar names. Fit it to the main structure. Do not execute until he says execute in a separate chat.

## Read first

1. README.md (session notes at the top)
2. architecture.md
3. decision-log.md — 2026-09-27 Builder CoC + invoice template planning status
4. docs/handoff/builder-coc-2026-09-27.md
5. ~/Documents/grabio-platform-docs/Architecture/Fine-Dining-Platform-Map.md
6. ~/Documents/grabio-platform-docs/Architecture/Setup-Surface-Separation.md

## Locked structure (new features must follow this)

- Tenant: users.subAccountId → that subAccount.storeId. Never email-only. Never unscoped limit(1).
- Access: allowed = entitlement AND store toggle AND user/sub-account permission.
- New work is a platform option or default. Not a one-store patch. No hardcoded store id.
- Setup surfaces (do not merge):
  - Store Profile = web shop + online menu
  - Theme / website setup = storefront look
  - Invoice Document setup = A4 / PDFs only (financeDocumentSettings)
- Numbers: INV-000001 / PO-000001 (6 digits). Date is stored, not shown in the number. No Firestore ids in UI.
- NIPCO invoice-template lock stays. Do not write NIPCO financeDocumentSettings.

## Do not reopen as broken

- Invoice template: working on invoice mobile and the main platform. Anwar tested. Round 1 closed. A later second round is polish only.
- Invoice phone: do not install 1.2.46–1.2.50. 1.2.45 APK is in grabio backup release. Later phone builds are in other chats — ask Anwar before treating mobile as a problem.
- POS Windows: product for every store. Little Hands is a repro, not the scope. That work has its own builder prompt. Not this chat unless Anwar says so.

## Builder CoC (every builder)

From docs/handoff/builder-coc-2026-09-27.md:

- Document what you did (handoff + decision-log/README line): files, surface, what was not deployed, how to test.
- When Anwar confirms a test, write confirmed: date, what he tested, result, what is later polish.
- Do not leave a closed item marked broken.

## How to plan a new feature

1. Ask Anwar the feature in one sentence if he has not named it.
2. Name which setup surface and which gate (entitlement / toggle / role) it uses.
3. Write the plan + TODO in backlog.md or decision-log.md. Wait for confirmation before any execution chat.
4. Keep shop/menu branding out of invoice PDFs and invoice setup out of the shop.

## Stop

- No deploy, no push, no Play sideload, no production writes.
- No mixing NIPCO and Little Hands.
```

---

## After paste

Anwar names the new feature in the new chat. Plan it there.
