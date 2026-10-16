# NIPCO Account And Sub-Account Map

**Date:** 2026-09-17

## Store

- Store: NIPCO
- Store ID: `DfIhBAEZ5NR7yNX0HboZvv58Nf82`

## Correct Active Sub-Accounts

| Email | Name | Role | Status | Purpose |
|---|---|---|---|---|
| `h.akalfouni@nip-lb.com` | Hadi Abou Kalfouni | `sales` | active | NIPCO sales manager |
| `j.sayegh@nip-lb.com` | Jihan Sayegh | `sales` | active | NIPCO sales manager |

## Not NIPCO

These accounts are Little Hands context and must not be attached to NIPCO:

- `manager@grabio.space`
- `ahmadshaheen78@gmail.com`

## Correction Applied

Wrong NIPCO sub-accounts removed:

- `manager@grabio.space` / old NIPCO subAccount ID: `7tyb6tbO6YvkKwdvmVgz`
- `ahmadshaheen78@gmail.com` / wrong NIPCO subAccount ID: `nipco-ahmad-accounting-manager`

Reason:

- `manager@grabio.space` belongs to Little Hands manager context.
- Ahmad belongs to Little Hands accounting manager context.

Safety:

- Wrong NIPCO sub-accounts were archived before deletion from active `subAccounts`.
- Ahmad was rebound to the Little Hands accounting sub-account.

## Little Hands Target Accounts

| Email | Name | Role | Status | Purpose |
|---|---|---|---|---|
| `manager@grabio.space` | Grabio Manager | `manager` | active | Little Hands manager |
| `ahmadshaheen78@gmail.com` | Ahmad Shaheen | `accounting` | active | Little Hands accounting manager |

## Ahmad Binding After Correction

Ahmad's Auth user is now bound to:

- `users/Rfvkw1MEoFduGjaxRKhz7YasCv02`
- `storeId`: `8WgfKtgaE8aAXdqFhIfweEo5WFq2`
- `activeStoreId`: `8WgfKtgaE8aAXdqFhIfweEo5WFq2`
- `subAccountId`: `PhG34sQUjSDNNdYBXWWc`
- `subAccountRole`: `accounting`

## Evidence

- `reporting/data/nipco-subaccounts-correction-2026-09-17.json`
- `reporting/data/nipco-littlehands-subaccount-correction-2026-09-17.json`

## Rule Going Forward

Do not reuse support emails such as `manager@grabio.space` across tenants.

Do not resolve sub-accounts by email alone.

For every client account:

1. Confirm store ID.
2. Confirm exact `subAccounts/{id}`.
3. Confirm `users/{uid}.subAccountId`.
4. Confirm `users/{uid}.storeId` and `activeStoreId` match the sub-account store.
5. Confirm role and permissions from the sub-account page.
